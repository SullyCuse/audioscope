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

  try {
    // ── STEP 1: Fetch full component data ────────────────────────
    const parsed = await callClaude(buildSpecPrompt(name, category), 1200, apiKey);

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

/* ─── Call Claude → parse JSON response ─────────────────────── */
async function callClaude(prompt, maxTokens, apiKey) {
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
  const data    = await res.json();
  const rawText = (data.content || []).map(function(b) { return b.text || ''; }).join('');
  return extractJSON(rawText);
}

/* ─── Call Claude → return plain text response ──────────────── */
async function callClaudeText(prompt, maxTokens, apiKey) {
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
  if (!res.ok) throw new Error('URL validation API error ' + res.status);
  const data = await res.json();
  return (data.content || []).map(function(b) { return b.text || ''; }).join('').trim();
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
  return 'You are a hi-fi audio equipment expert. Return accurate technical data for the component below.\n\n' +
    'Return ONLY a raw JSON object. No markdown, no code fences, no preamble, no trailing text. Start with { and end with }.\n\n' +
    'Category: ' + category + '\n' +
    'Component: "' + name + '"\n\n' +
    'Source priority: Use official manufacturer specs first, then reputable sources such as Stereophile, What Hi-Fi, Audio Science Review, The Absolute Sound, or Rtings.com.\n\n' +
    'ACCURACY RULES:\n' +
    '- Provide all specs you can source with reasonable confidence — do not be overly cautious on well-documented products.\n' +
    '- Write "N/A" only when you genuinely have no reliable data for a specific value — not as a blanket response.\n' +
    '- EXCEPTION — for speakers specifically: enclosure type (bookshelf/standmount vs floorstander/tower) must come from a verified source. Do NOT infer it from the model name, number, or series siblings. If uncertain, write "N/A".\n' +
    '- For newer, boutique, or regional products with limited data: provide what you can confirm and use "N/A" for the rest. In the summary, note if data is limited.\n' +
    '- Do not fabricate specs. If a product is genuinely obscure, say so in the summary rather than returning empty specs.\n\n'
    'Return this exact JSON structure:\n\n' +
    '{\n' +
    '  "brand": "Manufacturer name only",\n' +
    '  "model": "Model name only (no brand prefix)",\n' +
    '  "fullName": "Brand and model as one string",\n' +
    '  "msrpUSD": "e.g. $2499",\n' +
    '  "yearIntroduced": "e.g. 2021 or 2019-present",\n' +
    '  "specs": {\n' +
    '    "Spec Name": "value with units"\n' +
    '  },\n' +
    '  "dimensions": {\n' +
    '    "width":  "e.g. 440mm (17.3in)",\n' +
    '    "height": "e.g. 116mm (4.6in)",\n' +
    '    "depth":  "e.g. 380mm (15.0in)",\n' +
    '    "weight": "e.g. 8.4kg (18.5lbs)"\n' +
    '  },\n' +
    '  "notableFeatures": ["Feature 1", "Feature 2", "Feature 3", "Feature 4"],\n' +
    '  "summary": "2-3 sentences on sonic character, build quality, and ideal use case.",\n' +
    '  "strengths": ["Strength 1", "Strength 2", "Strength 3"],\n' +
    '  "considerations": ["Consideration 1", "Consideration 2"],\n' +
    '  "manufacturerUrl": "https://www.official-manufacturer-homepage.com",\n' +
    '  "reviewLinks": [],\n' +
    '  "youtubeSearches": ["' + name + ' review"]\n' +
    '}\n\n' +
    'Include 8-12 of the most relevant specs for a ' + category + ':\n' +
    'AMPLIFIER: Output Power (stereo/8ohm), Output Power (mono/4ohm), THD+N, SNR, Input Sensitivity, Frequency Response, Damping Factor, Inputs, Outputs, Class of operation\n' +
    'PREAMPLIFIER: Gain, THD+N, SNR, Frequency Response, Input Impedance, Output Impedance, Channel Separation, Inputs, Outputs\n' +
    'PHONO PREAMP: Gain (MM), Gain (MC), RIAA Accuracy, SNR (MM), SNR (MC), Input Impedance (MM), Input Impedance (MC), Output Impedance, Subsonic Filter, Power Supply\n' +
    'TURNTABLE: Drive Type, Motor, Speeds, Platter Material, Platter Weight, Wow and Flutter, SNR, Tonearm (if included), Anti-Skate, Built-in Phono Stage\n' +
    'TONEARM: Effective Length, Mounting Distance, Overhang, Offset Angle, Effective Mass, Bearing Type, Headshell Mount, VTA Adjustment, Anti-Skating\n' +
    'CARTRIDGE: Type, Output Voltage, Channel Separation, Channel Balance, Frequency Response, Tracking Force, Compliance, Stylus Shape, Cantilever, Loading Impedance\n' +
    'DAC: DAC Chip, PCM Resolution, DSD Support, Dynamic Range, THD+N, SNR, Digital Inputs, Analog Outputs, Headphone Output, USB Class\n' +
    'STREAMER: Supported Services, Max PCM Resolution, DSD Support, Network Connectivity, Outputs, Built-in DAC, App Platform, Roon Ready, MQA\n' +
    'SPEAKERS: Frequency Response, Sensitivity, Nominal Impedance, Minimum Impedance, Woofer Size, Tweeter, Enclosure Type, Crossover Frequency, Recommended Power\n' +
    'HEADPHONES: Driver Type, Driver Size, Frequency Response, Impedance, Sensitivity, THD, Weight, Cable Length, Connector, Wearing Style';
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
