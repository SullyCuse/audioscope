/**
 * AudioScope — Netlify Function: compare.js
 *
 * Secure proxy for Anthropic API calls.
 * ANTHROPIC_API_KEY is stored as a Netlify environment variable.
 *
 * Set in Netlify dashboard:
 *   Site configuration → Environment variables → Add variable
 *   Key: ANTHROPIC_API_KEY   Value: sk-ant-xxxxxxxx
 */

const API_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL        = 'claude-sonnet-4-20250514';
const MAX_TOKENS   = 1200;

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
    console.error('ANTHROPIC_API_KEY environment variable is not set');
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Server configuration error: API key not set. See README for setup instructions.' }),
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
      console.error('Anthropic API error ' + anthropicRes.status + ':', errBody);
      throw new Error('Anthropic API returned status ' + anthropicRes.status);
    }

    const apiData = await anthropicRes.json();
    const rawText = (apiData.content || []).map(function(b) { return b.text || ''; }).join('');

    const parsed = extractJSON(rawText);

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

/**
 * Robustly extract a JSON object from the AI response.
 * Handles markdown fences, preamble text, and trailing content.
 */
function extractJSON(text) {
  if (!text) throw new Error('Empty response from AI');

  // Strip markdown code fences
  var cleaned = text
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  // Find the outermost JSON object by brace matching
  var start = cleaned.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in AI response');

  var depth = 0;
  var end   = -1;
  for (var i = start; i < cleaned.length; i++) {
    if      (cleaned[i] === '{') { depth++; }
    else if (cleaned[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }

  if (end === -1) throw new Error('Malformed JSON: unmatched braces in AI response');

  var jsonStr = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Fix common AI mistakes: trailing commas before } or ]
    var fixed = jsonStr
      .replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(fixed);
  }
}

function buildPrompt(name, category) {
  var encodedName = encodeURIComponent(name);

  return 'You are a hi-fi audio equipment expert with access to manufacturer specifications, published reviews, and audio databases. Return accurate technical data for the component listed below.\n\n' +
    'Return ONLY a raw JSON object. No markdown, no code fences, no preamble, no trailing text. Start with { and end with }.\n\n' +
    'Category: ' + category + '\n' +
    'Component: "' + name + '"\n\n' +
    'Source priority: Use official manufacturer specs when available. If not, use reputable sources such as Stereophile, What Hi-Fi, Audio Science Review, The Absolute Sound, Rtings.com, or other established audio publications and databases. Write "N/A" for any value that is genuinely unknown — never guess.\n\n' +
    'Return this exact JSON structure (all fields required, no extra fields):\n\n' +
    '{\n' +
    '  "brand": "Manufacturer name only",\n' +
    '  "model": "Model name only (no brand prefix)",\n' +
    '  "fullName": "Brand and model as one string",\n' +
    '  "msrpUSD": "e.g. $2499 or Approx. $2500 or Discontinued (~$1800)",\n' +
    '  "yearIntroduced": "e.g. 2021 or 2019-present",\n' +
    '  "specs": {\n' +
    '    "Spec Name 1": "value with units",\n' +
    '    "Spec Name 2": "value with units"\n' +
    '  },\n' +
    '  "dimensions": {\n' +
    '    "width":  "e.g. 440mm (17.3in)",\n' +
    '    "height": "e.g. 116mm (4.6in)",\n' +
    '    "depth":  "e.g. 380mm (15.0in)",\n' +
    '    "weight": "e.g. 8.4kg (18.5lbs)"\n' +
    '  },\n' +
    '  "notableFeatures": ["Feature 1", "Feature 2", "Feature 3", "Feature 4"],\n' +
    '  "summary": "2-3 sentences describing sonic character, build quality, design philosophy, and ideal use case.",\n' +
    '  "strengths": ["Strength 1", "Strength 2", "Strength 3"],\n' +
    '  "considerations": ["Consideration 1", "Consideration 2"],\n' +
    '  "manufacturerUrl": "https://www.manufacturer.com/product-page",\n' +
    '  "reviewLinks": [\n' +
    '    { "outlet": "Stereophile",        "url": "https://www.stereophile.com/search/?q=' + encodedName + '" },\n' +
    '    { "outlet": "What Hi-Fi",         "url": "https://www.whathifi.com/search?q=' + encodedName + '" },\n' +
    '    { "outlet": "The Absolute Sound", "url": "https://www.theabsolutesound.com/?s=' + encodedName + '" }\n' +
    '  ],\n' +
    '  "youtubeSearches": ["' + name + ' review", "' + name + ' sound demo", "' + name + ' unboxing"]\n' +
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
