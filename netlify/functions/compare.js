/**
 * AudioScope — Netlify Function: compare.js
 *
 * Secure proxy for Anthropic API calls.
 * The ANTHROPIC_API_KEY is stored as a Netlify environment variable
 * and is NEVER exposed to the browser.
 *
 * Set in Netlify dashboard:
 *   Site settings → Environment variables → Add variable
 *   Key: ANTHROPIC_API_KEY  Value: sk-ant-xxxxxxxx
 */

const API_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL        = 'claude-sonnet-4-20250514';
const MAX_TOKENS   = 1024;

const CORS = {
  'Content-Type':                 'application/json',
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  // ── CORS preflight ────────────────────────────────────────
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  // ── Method guard ──────────────────────────────────────────
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // ── API key guard ─────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY environment variable is not set');
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Server configuration error: API key not set. See README for setup instructions.' }),
    };
  }

  // ── Parse request body ────────────────────────────────────
  let name, category;
  try {
    ({ name, category } = JSON.parse(event.body || '{}'));
  } catch (_) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: 'Invalid JSON in request body' }),
    };
  }

  if (!name || !category) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: 'Missing required fields: name and category' }),
    };
  }

  // ── Call Anthropic API ────────────────────────────────────
  try {
    const anthropicRes = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        messages:   [{ role: 'user', content: buildPrompt(name, category) }],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      console.error(`Anthropic API error ${anthropicRes.status}:`, errBody);
      throw new Error(`Anthropic API returned status ${anthropicRes.status}`);
    }

    const apiData = await anthropicRes.json();
    const rawText = (apiData.content || []).map(b => b.text || '').join('');

    // Strip markdown code fences (the model sometimes wraps JSON in ```)
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    // Validate JSON before returning
    const parsed = JSON.parse(cleaned);

    return {
      statusCode: 200,
      headers:    CORS,
      body:       JSON.stringify(parsed),
    };

  } catch (err) {
    console.error('AudioScope compare function error:', err.message);
    return {
      statusCode: 500,
      headers:    CORS,
      body:       JSON.stringify({ error: err.message || 'Internal server error' }),
    };
  }
};

/* ─── Build AI Prompt ────────────────────────────────────────── */
function buildPrompt(name, category) {
  return `You are a precise, authoritative hi-fi audio equipment database. Your task is to return detailed technical information about a specific audio component.

Return ONLY valid JSON — absolutely no markdown formatting, no code fences (\`\`\`), no preamble text, no explanation after the JSON. Just the raw JSON object.

Category: ${category}
Component to look up: "${name}"

Return this exact JSON structure with ALL fields populated:

{
  "brand": "Manufacturer name only",
  "model": "Model name/number only (no brand prefix)",
  "fullName": "Complete brand + model name as one string",
  "msrpUSD": "Price in USD, e.g. '$2,499' or 'Approx. $X,XXX' or 'Discontinued (~$X,XXX)' or 'Price varies'",
  "yearIntroduced": "Year introduced, e.g. '2021' or '2019–present' or 'c. 2018'",
  "specs": {
    "Include 8–12 of the most technically important specifications for a ${category}. Use proper engineering units throughout.":
    "AMPLIFIER specs: Output Power (stereo), Output Power (mono), THD+N, Signal-to-Noise Ratio, Input Sensitivity, Frequency Response, Damping Factor, Input Impedance, Output Impedance, Available Inputs, Available Outputs",
    "SPEAKER specs: Frequency Response, Sensitivity, Nominal Impedance, Minimum Impedance, Woofer Diameter, Tweeter, Midrange (if applicable), Enclosure Type, Crossover Frequency, Recommended Amplifier Power",
    "TURNTABLE specs: Drive Type, Motor Type, Platter Material, Platter Weight, Speeds, Wow & Flutter, Signal-to-Noise Ratio, Channel Separation, Included Tonearm, Anti-Skating, Tracking Force Range, Built-in Phono Stage",
    "HEADPHONE specs: Driver Type, Driver Size, Frequency Response, Impedance, Sensitivity (SPL/mW), THD, Maximum Input Power, Weight (without cable), Cable Length, Connector Type, Headband Type",
    "DAC specs: DAC Chip(s), Supported Sample Rates (PCM), DSD Support, Dynamic Range, THD+N, SNR, Digital Inputs, Analog Outputs, Headphone Output, USB Class, Power Requirement",
    "PHONO PREAMP specs: Input Type (MM/MC/Both), MM Gain, MC Gain, RIAA Accuracy, SNR (MM), SNR (MC), Input Impedance (MM), Input Impedance (MC) Range, Output Impedance, Subsonic Filter, Power Supply Type",
    "STREAMER specs: Supported Services, Supported Formats, Maximum PCM Resolution, DSD Support, Network Connectivity, Outputs, Built-in DAC, App Control Platform, Roon Ready, MQA Support",
    "TONEARM specs: Effective Length, Mounting Distance, Overhang, Offset Angle, Effective Mass, Bearing Type, Headshell Weight, Headshell Mount Type, Azimuth Adjustment, VTA Adjustment, Anti-Skating",
    "CARTRIDGE specs: Type (MM/MC/MI), Output Voltage, Channel Separation, Channel Balance, Frequency Response, Tracking Force (Recommended), Compliance, Stylus Shape, Cantilever Material, Body Material, Required Loading Impedance",
    "Adapt these intelligently to the actual category. Use real technical terminology and proper units."
  },
  "dimensions": {
    "width":  "measurement with both metric and imperial, e.g. '440 mm (17.3\")'",
    "height": "measurement with both metric and imperial",
    "depth":  "measurement with both metric and imperial (including any protruding connectors if known)",
    "weight": "measurement with both units, e.g. '8.4 kg (18.5 lbs)'"
  },
  "notableFeatures": [
    "Key distinguishing feature 1 — be specific",
    "Key distinguishing feature 2 — be specific",
    "Key distinguishing feature 3 — be specific",
    "Key distinguishing feature 4 — be specific"
  ],
  "summary": "Write 2–3 sentences in an editorial voice describing: (1) the component's sonic character and overall design philosophy, (2) its market positioning and key strengths, and (3) the ideal system or listener it suits best. Be specific and informative — avoid generic phrases.",
  "strengths": [
    "Specific technical or sonic strength 1",
    "Specific technical or sonic strength 2",
    "Specific technical or sonic strength 3"
  ],
  "considerations": [
    "Honest consideration or limitation 1",
    "Honest consideration or limitation 2"
  ],
  "manufacturerUrl": "https://www.manufacturer-domain.com/product-page (best known URL for this product)",
  "reviewLinks": [
    { "outlet": "Stereophile",       "url": "https://www.stereophile.com/search/?q=${encodeURIComponent(name)}" },
    { "outlet": "What Hi-Fi",        "url": "https://www.whathifi.com/search?q=${encodeURIComponent(name)}" },
    { "outlet": "The Absolute Sound","url": "https://www.theabsolutesound.com/?s=${encodeURIComponent(name)}" }
  ],
  "youtubeSearches": [
    "${name} review",
    "${name} sound demo",
    "${name} unboxing setup"
  ]
}

Important: For any specification value you are not certain about, write "Contact manufacturer" rather than guessing. Accuracy is critical.`;
}

/**
 * Helper: safely encode strings for URL use within the prompt.
 * (Standard JS encodeURIComponent — just making intent clear.)
 */
function encodeURIComponent(str) {
  return global.encodeURIComponent(str);
}
