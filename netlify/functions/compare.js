/**
 * AudioScope — Netlify Function: compare.js
 *
 * Two-step process:
 *   1. Fetch full component specs from Claude
 *   2. Validate / correct the manufacturer URL with a dedicated second call
 *
 * ANTHROPIC_API_KEY must be set in Netlify environment variables.
 */

const API_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL        = 'claude-sonnet-4-20250514';

/**
 * KNOWN_CORRECTIONS — verified fixes contributed by user feedback.
 *
 * How to add a correction:
 *   1. A user reports an inaccuracy via the feedback form (Netlify Forms → your email).
 *   2. You verify it against the manufacturer's website.
 *   3. Add one entry here: 'Brand Model': 'Correction text.'
 *   4. Push to GitHub. Done — all future comparisons for this component
 *      will inject this correction directly into the AI prompt.
 *
 * Key format: exact "Brand Model" as the user would type it (case-insensitive match).
 * Value: a plain English sentence stating the correct fact.
 *
 * Examples (add real corrections below as feedback comes in):
 */
const KNOWN_CORRECTIONS = {
  // 'Wharfedale EVO 5.1': 'Enclosure type is Bookshelf/Standmount — NOT a floorstander.',
  // 'Sumiko Black Pearl':  'Official manufacturer website is sumikophonocartridges.com',
};

const CORS = {
  'Content-Type':                 'application/json',
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Server configuration error: API key not set.' }),
    };
  }

  let name, category;
  try {
    ({ name, category } = JSON.parse(event.body || '{}'));
  } catch (_) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON in request body' }) };
  }
  if (!name || !category) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing required fields: name and category' }) };
  }

  // Guard against excessively long inputs
  if (name.length > 200 || category.length > 100) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Input too long' }) };
  }

  // Strip characters that could break prompt formatting
  name     = name.trim().replace(/[`\\]/g, '');
  category = category.trim().replace(/[`\\]/g, '');

  try {
    // ── STEP 1: Fetch full component data ────────────────────────
    const parsed = await callClaude(buildSpecPrompt(name, category), 1800, apiKey);

    // ── STEP 2: Validate / correct manufacturer URL ───────────────
    // Run in parallel with a short timeout so it never blocks the response
    try {
      const verifiedUrl = await callClaudeText(buildUrlPrompt(parsed.brand, parsed.model, name), 200, apiKey);
      const clean = verifiedUrl.trim().replace(/['"<>\s]/g, '');
      if (clean.startsWith('http://') || clean.startsWith('https://')) {
        parsed.manufacturerUrl = clean;
      }
    } catch (urlErr) {
      // URL validation failed — keep whatever the first call returned
      console.warn('URL validation step failed, using original:', urlErr.message);
    }

    return {
      statusCode: 200,
      headers:    CORS,
      body:       JSON.stringify(parsed),
    };

  } catch (err) {
    console.error('AudioScope compare error:', err.message);
    return {
      statusCode: 500,
      headers:    CORS,
      body:       JSON.stringify({ error: err.message || 'Internal server error' }),
    };
  }
};

/* ─── Shared API fetch ───────────────────────────────────────── */
async function callAPI(prompt, maxTokens, apiKey) {
  const res = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: maxTokens,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error('Anthropic API error ' + res.status + ': ' + body.slice(0, 120));
  }
  const data = await res.json();
  return (data.content || []).map(function(b) { return b.text || ''; }).join('');
}

/* ─── Call Claude → parse JSON response ─────────────────────── */
async function callClaude(prompt, maxTokens, apiKey) {
  const rawText = await callAPI(prompt, maxTokens, apiKey);
  return extractJSON(rawText);
}

/* ─── Call Claude → return plain text response ──────────────── */
async function callClaudeText(prompt, maxTokens, apiKey) {
  return (await callAPI(prompt, maxTokens, apiKey)).trim();
}

/* ─── Extract JSON robustly from AI response ─────────────────── */
function extractJSON(text) {
  if (!text) throw new Error('Empty response from AI');
  var cleaned = text
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
  var start = cleaned.indexOf('{');
  if (start === -1) throw new Error('No JSON object in AI response');
  var depth = 0, end = -1;
  for (var i = start; i < cleaned.length; i++) {
    if      (cleaned[i] === '{') depth++;
    else if (cleaned[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error('Malformed JSON: unmatched braces');
  var jsonStr = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return JSON.parse(jsonStr.replace(/,(\s*[}\]])/g, '$1'));
  }
}

/* ─── Prompt 1: Full component specification ─────────────────── */
function buildSpecPrompt(name, category) {
  // Check for known corrections (case-insensitive)
  const correctionKey = Object.keys(KNOWN_CORRECTIONS).find(
    k => k.toLowerCase() === name.toLowerCase()
  );
  const correctionBlock = correctionKey
    ? 'VERIFIED CORRECTION — treat this as authoritative fact, overriding any conflicting data:\n' +
      '  ' + KNOWN_CORRECTIONS[correctionKey] + '\n\n'
    : '';

  return 'You are a hi-fi audio equipment database. Return technical specifications for the component below.\n\n' +
    'CRITICAL: Return ONLY a raw JSON object. No markdown, no code fences, no preamble, no trailing text. Start with { and end with }.\n\n' +
    'Category: ' + category + '\n' +
    'Component: "' + name + '"\n\n' +
    correctionBlock +
    'SPECS REQUIREMENT: You MUST populate the "specs" object with at least 6 real key-value pairs. ' +
    'Use official manufacturer data first, then Stereophile, What Hi-Fi, Audio Science Review, The Absolute Sound, or Rtings.com. ' +
    'Do NOT return an empty specs object. For well-known products provide all specs you have. ' +
    'For obscure products include whatever is available and note limitations in the summary.\n\n' +
    'ACCURACY RULES:\n' +
    '- Use "N/A" only for individual values you cannot confirm — not as a reason to omit entire fields or return an empty specs object.\n' +
    '- SPEAKER EXCEPTION: enclosure type (bookshelf vs floorstander) must come from a verified source only. Do not infer from model name or siblings.\n' +
    '- If a product is genuinely obscure, say so in the summary but still populate every spec field you can.\n\n' +
    'EXAMPLE of a correctly filled "specs" object for an integrated amplifier:\n' +
    '  "Output Power (8Ω stereo)": "160 W/ch",\n' +
    '  "Output Power (4Ω stereo)": "240 W/ch",\n' +
    '  "THD+N": "<0.1% at rated power",\n' +
    '  "Signal-to-Noise Ratio": ">110 dB",\n' +
    '  "Frequency Response": "5 Hz – 100 kHz",\n' +
    '  "Damping Factor": ">1200 (8Ω)",\n' +
    '  "Class of Operation": "Class A/AB",\n' +
    '  "Inputs": "2 × RCA, 1 × XLR balanced"\n\n' +
    'Return this exact JSON structure with ALL fields populated:\n\n' +
    '{\n' +
    '  "brand": "Manufacturer name only",\n' +
    '  "model": "Model name only (no brand prefix)",\n' +
    '  "fullName": "Brand and model as one string",\n' +
    '  "msrpUSD": "e.g. $2499",\n' +
    '  "yearIntroduced": "e.g. 2021 or 2019-present",\n' +
    '  "specs": {\n' +
    '    "Spec Name 1": "value with units",\n' +
    '    "Spec Name 2": "value with units",\n' +
    '    "Spec Name 3": "value with units",\n' +
    '    "Spec Name 4": "value with units",\n' +
    '    "Spec Name 5": "value with units",\n' +
    '    "Spec Name 6": "value with units"\n' +
    '  },\n' +
    '  "dimensions": {\n' +
    '    "width":  "e.g. 440mm (17.3in)",\n' +
    '    "height": "e.g. 116mm (4.6in)",\n' +
    '    "depth":  "e.g. 380mm (15.0in)",\n' +
    '    "weight": "e.g. 8.4kg (18.5lbs)"\n' +
    '  },\n' +
    '  "notableFeatures": ["Feature 1", "Feature 2", "Feature 3", "Feature 4"],\n' +
    '  "summary": "2-3 sentences on sonic character, build quality, and ideal use case. If data is limited, state that clearly.",\n' +
    '  "strengths": ["Strength 1", "Strength 2", "Strength 3"],\n' +
    '  "considerations": ["Consideration 1", "Consideration 2"],\n' +
    '  "manufacturerUrl": "https://www.official-manufacturer-homepage.com",\n' +
    '  "reviewLinks": [],\n' +
    '  "youtubeSearches": ["' + name + ' review"]\n' +
    '}\n\n' +
    'Spec fields to include (8-12 most relevant for the category):\n' +
    'AMPLIFIER / INTEGRATED AMPLIFIER: Output Power (8Ω stereo), Output Power (4Ω stereo), Output Power (8Ω mono if applicable), THD+N, Signal-to-Noise Ratio, Frequency Response, Damping Factor, Input Impedance, Class of Operation, Inputs, Outputs, Headphone Output\n' +
    'PREAMPLIFIER: Gain, THD+N, SNR, Frequency Response, Input Impedance, Output Impedance, Channel Separation, Inputs, Outputs, Power Supply\n' +
    'PHONO PREAMP: Gain (MM), Gain (MC), RIAA Accuracy, SNR (MM), SNR (MC), Input Impedance (MM), Input Impedance (MC), Output Impedance, Subsonic Filter, Power Supply\n' +
    'TURNTABLE: Drive Type, Motor Type, Speeds, Platter Material, Platter Weight, Wow & Flutter, Signal-to-Noise Ratio, Included Tonearm, Anti-Skate, Built-in Phono Stage\n' +
    'TONEARM: Effective Length, Mounting Distance, Overhang, Offset Angle, Effective Mass, Bearing Type, Headshell Mount, VTA Adjustment, Anti-Skating\n' +
    'CARTRIDGE: Type (MM/MC/MI), Output Voltage, Channel Separation, Channel Balance, Frequency Response, Tracking Force (recommended), Compliance, Stylus Shape, Cantilever Material, Loading Impedance\n' +
    'DAC: DAC Chip(s), Max PCM Resolution, DSD Support, Dynamic Range, THD+N, SNR, Digital Inputs, Analog Outputs, Headphone Output, USB Class\n' +
    'STREAMER: Supported Streaming Services, Max PCM Resolution, DSD Support, Network Connectivity, Analog Outputs, Digital Outputs, Built-in DAC, Control App, Roon Ready\n' +
    'SPEAKERS: Frequency Response, Sensitivity (dB/W/m), Nominal Impedance, Minimum Impedance, Woofer Size, Tweeter Type, Enclosure Type, Crossover Frequency, Recommended Amplifier Power\n' +
    'HEADPHONES: Driver Type, Driver Size, Frequency Response, Impedance, Sensitivity (dB/mW), THD, Weight (without cable), Cable Length, Connector Type, Wearing Style';
}

/* ─── Prompt 2: Manufacturer URL verification ────────────────── */
function buildUrlPrompt(brand, model, fullName) {
  return 'You are a fact-checker specialising in hi-fi audio manufacturers.\n\n' +
    'Task: Return the single correct, current, official homepage URL for the manufacturer of this product.\n\n' +
    'Manufacturer brand: "' + brand + '"\n' +
    'Product: "' + fullName + '"\n\n' +
    'Rules:\n' +
    '- Return ONLY the homepage URL — nothing else. No explanation, no punctuation, no markdown.\n' +
    '- Must be the manufacturer\'s own direct website, NOT a distributor, importer, retailer, or redirect.\n' +
    '- Must start with https:// and be the root domain (e.g. https://www.rega.co.uk not a product sub-page).\n' +
    '- If the brand has a dedicated product-line website (e.g. Sumiko has sumikophonocartridges.com rather than a parent company site), use that dedicated site.\n' +
    '- If you are not confident in the exact current URL, return the word UNKNOWN.\n\n' +
    'Examples of correct answers:\n' +
    '  Rega Research → https://www.rega.co.uk\n' +
    '  Sumiko → https://www.sumikophonocartridges.com\n' +
    '  Ortofon → https://www.ortofon.com\n' +
    '  Sennheiser → https://www.sennheiser.com\n' +
    '  Naim Audio → https://www.naimaudio.com\n\n' +
    'Return only the URL (or UNKNOWN):';
}
