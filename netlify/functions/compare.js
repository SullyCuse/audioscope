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

  // ── Parasound Phono Preamplifiers ────────────────────────────

  'Parasound Zphono XRM': 'VERIFIED SPECS from parasound.com and authoritative dealer listings — Parasound Zphono XRM Phono Preamplifier: ' +
    'Type: MM/MC Phono Preamplifier, Z Custom series, half-rack width chassis (1U). MSRP: $595. ' +
    'Inputs: Separate MM and MC inputs — supports two turntables simultaneously. ' +
    'MM Gain: 40 dB or 50 dB (unbalanced); 46 dB or 56 dB (balanced). ' +
    'MC Gain: 50 dB or 60 dB (unbalanced); 56 dB or 66 dB (balanced). ' +
    'MC Input Impedance: Variable 50–1050 Ω (continuously adjustable knob). ' +
    'MM Input Impedance: 47kΩ. ' +
    'Output Impedance: 150Ω (unbalanced RCA); 150Ω per leg (balanced XLR). ' +
    'Outputs: Gold-plated RCA (unbalanced) and XLR (balanced). ' +
    'RIAA Accuracy: ±0.2 dB, 20Hz–20kHz. ' +
    'Frequency Response: 20Hz–20kHz, ±0.2 dB. ' +
    'THD: <0.02% at 1kHz. ' +
    'Inter-Channel Crosstalk: >80 dB at 1kHz. ' +
    'S/N Ratio (MM, 40 dB setting): >94 dB IHF A-weighted; >90 dB unweighted. ' +
    'S/N Ratio (MM, 50 dB setting): >94 dB IHF A-weighted; >90 dB unweighted. ' +
    'S/N Ratio (MC, 50 dB setting): >92 dB IHF A-weighted; >88 dB unweighted. ' +
    'S/N Ratio (MC, 60 dB setting): >82 dB IHF A-weighted; >80 dB unweighted. ' +
    'Front Panel Controls: Input select (MM/MC), mono/stereo switch, rumble filter (40Hz, 18dB/octave, defeatable). ' +
    'Power Supply: Internal linear power supply (no wall-wart). ' +
    'Chassis: Half-rack width (1U high); rack-mountable with ZRK kit (sold separately). ' +
    'Manufacturer website: https://www.parasound.com',

  // ── Parasound Amplifiers ─────────────────────────────────────

  'Parasound JC5': 'VERIFIED SPECS from parasound.com — Parasound Halo JC5 Stereo Power Amplifier: ' +
    'Type: Two-Channel Power Amplifier, High-bias Class A/AB; first 12W per channel in pure Class A. Designed by John Curl. MSRP: $7,000. ' +
    'Power Output (both channels driven, 0.05% THD, 20Hz-20kHz): 400W x2 @ 8Ω; 600W x2 @ 4Ω. ' +
    'Bridged Mono: 1200W @ 8Ω (4Ω bridged not recommended). ' +
    'Current Capacity: 90 amps peak per channel. Stable to 1.5Ω impedance dips. ' +
    'Slew Rate: >130 V/µs. ' +
    'Frequency Response: 5Hz–100kHz, +0/-3dB; 20Hz–20kHz, ±0.25dB. ' +
    'THD: <0.05% at full power; <0.03% at typical listening levels. ' +
    'IM Distortion: <0.04%. TIM: Unmeasurable. ' +
    'Inter-Channel Crosstalk: >87dB @ 1kHz; >72dB @ 20kHz. ' +
    'Input Impedance: Unbalanced 33kΩ; Balanced 66kΩ (33kΩ per leg). ' +
    'Total Gain: 29dB. Input Sensitivity: 1V (unbalanced and balanced). ' +
    'S/N Ratio: >116dB (IHF A-weighted); >111dB unweighted. ' +
    'Damping Factor: 1000 at 20Hz. ' +
    'DC Trigger: +9–12Vdc, 5mA. Audio Trigger: 2–10mV. ' +
    'Inputs: Balanced XLR (Neutrik locking) and RCA (Vampire gold-plated); loop output. ' +
    'Dimensions: 448mm W x 197mm H (with feet) x 546mm D (with cables) / 17-5/8" x 7-3/4" x 21-1/2". ' +
    'Net Weight: 73 lbs (33.1 kg). ' +
    'Power: 1W standby; 225W idle; 1500W maximum. Chassis: 4U rack spaces. ' +
    'Manufacturer website: https://www.parasound.com',

  'Parasound HALO A21+': 'VERIFIED SPECS from parasound.com — Parasound Halo A21+ Stereo Power Amplifier: ' +
    'Type: Two-Channel Power Amplifier, Class A/AB; first 7W per channel in pure Class A. Designed by John Curl. MSRP: $5,000. ' +
    'Power Output (both channels driven, 0.1% THD, 20Hz-20kHz): 300W x2 @ 8Ω; 500W x2 @ 4Ω. ' +
    'Bridged Mono: 1000W @ 8Ω (4Ω bridged not recommended). ' +
    'Current Capacity: 60 amps peak per channel. Stable to 2Ω. ' +
    'Slew Rate: >130 V/µs. ' +
    'Frequency Response: 5Hz–100kHz, +0/-3dB; 20Hz–20kHz, ±0.25dB. ' +
    'THD: <0.1% at full power; <0.03% at typical listening levels. ' +
    'IM Distortion: <0.04%. TIM: Unmeasurable. ' +
    'Inter-Channel Crosstalk: >80dB @ 1kHz; >70dB @ 20kHz. ' +
    'Input Impedance: Unbalanced 33kΩ; Balanced 66kΩ (33kΩ per leg). ' +
    'Total Gain: 29dB. Input Sensitivity: 1V (unbalanced and balanced). ' +
    'S/N Ratio: >115dB (IHF A-weighted). ' +
    'Inputs: Balanced XLR and RCA; loop output jacks. ' +
    'Chassis: 4U rack spaces. ' +
    'Manufacturer website: https://www.parasound.com',

  'Parasound HALO A23+': 'VERIFIED SPECS from parasound.com — Parasound Halo A23+ Stereo Power Amplifier: ' +
    'Type: Two-Channel Power Amplifier, dual-mono Class A/AB architecture, independent transformers per channel. Designed by John Curl. MSRP: $2,500. ' +
    'Power Output (both channels driven, 0.06% THD, 20Hz-20kHz): 160W x2 @ 8Ω; 240W x2 @ 4Ω. ' +
    'Power Output (0.9% THD): 210W x2 @ 8Ω. ' +
    'Bridged Mono: 500W @ 8Ω. ' +
    'Frequency Response: 5Hz–100kHz, +0/-3dB (per published reviews). ' +
    'Inputs: Balanced XLR and gold-plated RCA; loop output jacks. ' +
    'Chassis: 2U rack spaces. ' +
    'Manufacturer website: https://www.parasound.com',

  'Parasound HALO HINT6': 'VERIFIED SPECS from parasound.com — Parasound Halo HINT 6 Integrated Amplifier: ' +
    'Type: Integrated Amplifier with built-in DAC, MM/MC phono stage, headphone amplifier, and Home Theater Bypass. Class A/AB. Designed by John Curl. MSRP: $3,000. ' +
    'Power Output (both channels driven, 0.05% THD, 20Hz-20kHz): 160W x2 @ 8Ω; 240W x2 @ 4Ω. ' +
    'Power Output (0.9% THD): 180W x2 @ 8Ω; 270W x2 @ 4Ω. ' +
    'Current Capacity: 45 amps peak per channel. ' +
    'Built-in DAC: ESS Sabre32 Reference (ES9018K2M); USB up to 32-bit/384kHz PCM and DSD256; Coax/Optical up to 192kHz/24-bit. ' +
    'Built-in Phono Stage: MM and MC. ' +
    'Built-in Headphone Amplifier: Yes. ' +
    'Home Theater Bypass: Yes, with balanced XLR. ' +
    'Inputs: Balanced XLR, multiple RCA, USB, Coaxial digital, Optical digital, Phono (MM/MC). ' +
    'Manufacturer website: https://www.parasound.com',

  'Parasound NC 2250 v.2': 'VERIFIED SPECS from parasound.com — Parasound NewClassic 2250 v.2 Stereo Power Amplifier: ' +
    'Type: Two-Channel Power Amplifier, Class AB, THX Ultra2 certified. MSRP: $1,500. ' +
    'Power Output (all channels driven, RMS 20Hz-20kHz): 275W x2 @ 8Ω; 400W x2 @ 4Ω; 400W x2 @ 2Ω (load switch 2-3Ω). ' +
    'Bridged Mono: 750W x1 @ 8Ω; 750W x1 @ 4Ω (load switch 2-3Ω). ' +
    'Current Capacity: 45 amps peak per channel. ' +
    'THD: <0.2% at full rated output; 0.015% at average listening levels. ' +
    'S/N Ratio: 114dB at rated output (IHF A-weighted); 106dB unweighted; 93dB at 2.828V (IHF A-weighted); 84dB at 2.828V unweighted. ' +
    'AC Power: 110-120V / 220-240V, 50-60Hz. Standby: 0.5W; Idle: 35W; Full output: 1000W. ' +
    'Dimensions: 437mm W x 470mm D (with cables) x 153mm H with feet (17.25" x 18.5" x 6"); 133mm panel only (3U). ' +
    'Manufacturer website: https://www.parasound.com',

  'Parasound 2125 v.2': 'VERIFIED SPECS from official Parasound Model 2125 v.2 Owner\'s Guide: ' +
    'Type: Two-Channel Power Amplifier, Class A/B, THX-certified. ' +
    'Power Output (all channels driven, RMS 20Hz-20kHz): 150W x2 @ 8Ω; 225W x2 @ 4Ω; 225W x2 @ 2Ω (load switch 2-3Ω). ' +
    'Bridged Mono: 400W x1 @ 8Ω; 400W x1 @ 4Ω (load switch 2-3Ω). ' +
    'Current Capacity: 35 amps peak per channel. ' +
    'Frequency Response: 20Hz–50kHz, +0/-3dB at 1 watt. ' +
    'Dynamic Headroom: 1.3 dB. ' +
    'THD: 0.25% at full rated output; 0.015% at average listening levels. ' +
    'IM Distortion: 0.05%. Transient IM Distortion: Not measurable. ' +
    'S/N Ratio: 114 dB at rated output (IHF A-weighted); 106 dB unweighted; 93 dB at 2.828V (IHF A-weighted); 84 dB at 2.828V unweighted. ' +
    'Input Impedance: 33kΩ. ' +
    'Input Sensitivity: 1V in for 28.28V out (THX standard). Total Gain: 28 dB. ' +
    'Inter-Channel Crosstalk: 85 dB @1kHz; 73 dB @10kHz; 67 dB @20kHz. ' +
    'Damping Factor: Over 150 at 20Hz. ' +
    '12V Trigger: DC 9–12V, 15mA. Audio Turn-On: Quieter=1mV; Louder=6mV. ' +
    'High Pass Filter: Flat / 20Hz / 40Hz at 18dB/octave. Speaker Load Switch: 2-3Ω or 4-8Ω. ' +
    'AC Power: 110-120V / 220-240V, 50-60Hz. Standby: 0.5W; Idle: 32W; Full output: 550W. ' +
    'Dimensions: 437mm W x 406mm D x 107mm H (17.25" x 16" x 4.25" with feet; 3.5"/88.2mm panel only, 2U). ' +
    'Net Weight: 27 lbs (12.3 kg). Rack mount kit: RMK22 (sold separately). ' +
    'Manufacturer website: https://www.parasound.com',

  'Parasound 275': 'VERIFIED SPECS from official Parasound Model 275 Technical Specs sheet: ' +
    'Type: Two-Channel Power Amplifier, Class AB, NewClassic series. ' +
    'Power Output (both channels driven, RMS): 75W x2 @ 8Ω; 125W x2 @ 4Ω; 125W x2 @ 2Ω. ' +
    'Bridged Mono: 200W @ 8Ω or 4Ω. ' +
    'Current Capacity: 30 amps peak per channel. ' +
    'High Pass Filter: 18dB/octave, switchable 20Hz or 40Hz. ' +
    'Inputs: Gold-plated RCA input jacks, loop output jacks. ' +
    'Speaker Terminals: A/B with individual on/off; heavy-duty 24K gold-plated 5-way terminals. ' +
    'Trigger: DC trigger input with looping output. Audio signal sensing for automatic on/off. ' +
    'Other: Impedance selector switch (2Ω operation); bridging switch; rear-mounted gain controls; ground lift switch; 115/230V selector. ' +
    'Protection: DC Servo and relay protection circuits. ' +
    'Front Panel: High temperature, standby, and channel status indicators. ' +
    'Chassis: 1U (one rack space). Rack mount kit: RMK11 (optional). ' +
    'Dimensions (W x D x H): 17.25" x 16" x 2.5" with feet / 1.75" panel only (1U). ' +
    'Manufacturer website: https://www.parasound.com',

  'Parasound 275 v.2': 'VERIFIED SPECS from official Parasound Model 275 v.2 Owner\'s Guide: ' +
    'Type: Two-Channel Power Amplifier, Class AB, NewClassic series. ' +
    'Power Output (all channels driven, RMS 20Hz-20kHz): 90W x2 @ 8Ω; 150W x2 @ 4Ω; 150W x2 @ 2Ω (load switch 2-3Ω). ' +
    'Bridged Mono: 200W x1 @ 8Ω; 200W x1 @ 4Ω (load switch 2-3Ω). ' +
    'Current Capacity: 20 amps peak per channel. ' +
    'Frequency Response: 20Hz–50kHz, +0/-3dB at 1 watt. ' +
    'Dynamic Headroom: 1.3 dB. ' +
    'THD: 0.35% at full rated output; 0.025% at average listening levels. ' +
    'IM Distortion: 0.05%. Transient IM Distortion: Not measurable. ' +
    'S/N Ratio: 110 dB at rated output (IHF A-weighted); 103 dB unweighted; 93 dB at 2.828V (IHF A-weighted); 84 dB at 2.828V unweighted. ' +
    'Input Impedance: 33kΩ. ' +
    'Input Sensitivity: 800mV for full rated output (28dB gain). ' +
    'Inter-Channel Crosstalk: 80 dB @1kHz; 72 dB @10kHz; 65 dB @20kHz. ' +
    'Damping Factor: Over 150 at 20Hz. ' +
    '12V Trigger: DC 9–12V, 15mA. Audio Turn-On: Quieter=1mV; Louder=6mV. ' +
    'AC Power: 110-120V / 220-240V, 50-60Hz. Standby: 0.5W; Idle: 25W; Full output: 350W. ' +
    'Dimensions: 437mm W x 406mm D x 63mm H (17.25" x 16" x 2.5" with feet; 1.75"/44.1mm panel only, 1U). ' +
    'Net Weight: 20 lbs (9.1 kg). Rack mount kit: RMK11 (sold separately). ' +
    'Manufacturer website: https://www.parasound.com',

  // ── Wharfedale EVO 5 Series ──────────────────────────────────

  'Wharfedale EVO 5.1': 'VERIFIED SPECS from official Wharfedale EVO 5 Series User Manual: ' +
    'Enclosure Type: Standmount/Bookshelf — NOT a floorstander. ' +
    'Bass Driver: Woven Kevlar Cone. ' +
    'Tweeter: 35 x 70mm AMT (Air Motion Transformer). ' +
    'Midrange Driver: None (2-way design). ' +
    'AV Shield: No. ' +
    'Sensitivity: 87 dB. ' +
    'Crossover Frequency: 2.7kHz. ' +
    'Enclosure Volume: 11.5 litres. ' +
    'Width: 220mm. ' +
    'Net Weight: 8.0 kg per speaker. ' +
    'Standard Accessories: Rubber feet. ' +
    'Manufacturer website: https://www.wharfedale.co.uk',

  'Wharfedale EVO 5.2': 'VERIFIED SPECS from official Wharfedale EVO 5 Series User Manual: ' +
    'Enclosure Type: Standmount/Bookshelf — NOT a floorstander. ' +
    'Bass Driver: Woven Kevlar Cone. ' +
    'Tweeter: 35 x 70mm AMT (Air Motion Transformer). ' +
    'AV Shield: No. ' +
    'Sensitivity: 88 dB. ' +
    'Peak SPL: 105 dB. ' +
    'Frequency Response: 44Hz–24kHz. ' +
    'Minimum Frequency: 38Hz. ' +
    'Crossover Frequencies: 800Hz and 4.3kHz. ' +
    'Enclosure Volume: 27.2 litres. ' +
    'Width: 260mm. ' +
    'Net Weight: 15.0 kg per speaker. ' +
    'Standard Accessories: Rubber feet. ' +
    'Manufacturer website: https://www.wharfedale.co.uk',

  'Wharfedale EVO 5.3': 'VERIFIED SPECS from official Wharfedale EVO 5 Series User Manual: ' +
    'Enclosure Type: Floorstander. ' +
    'Bass Drivers: 2 x Woven Kevlar Cone. ' +
    'Tweeter: 35 x 70mm AMT (Air Motion Transformer). ' +
    'AV Shield: No. ' +
    'Sensitivity: 88 dB. ' +
    'Peak SPL: 106 dB. ' +
    'Frequency Response: 46Hz–24kHz. ' +
    'Minimum Frequency: 40Hz. ' +
    'Crossover Frequencies: 825Hz and 4kHz. ' +
    'Enclosure Volume: 35.4 litres. ' +
    'Width: 266mm. ' +
    'Net Weight: 21.5 kg per speaker. ' +
    'Standard Accessories: Spike seats. ' +
    'Manufacturer website: https://www.wharfedale.co.uk',

  'Wharfedale EVO 5.4': 'VERIFIED SPECS from official Wharfedale EVO 5 Series User Manual: ' +
    'Enclosure Type: Floorstander. ' +
    'Bass Drivers: 2 x Woven Kevlar Cone. ' +
    'Tweeter: 35 x 70mm AMT (Air Motion Transformer). ' +
    'AV Shield: No. ' +
    'Peak SPL: 108 dB. ' +
    'Frequency Response: 42Hz–24kHz. ' +
    'Minimum Frequency: 36Hz. ' +
    'Crossover Frequencies: 1.1kHz and 4kHz. ' +
    'Height: 1028mm. Width: 302mm. ' +
    'Net Weight: 31.2 kg per speaker. ' +
    'Standard Accessories: Spike seats. ' +
    'Manufacturer website: https://www.wharfedale.co.uk',

  'Wharfedale EVO 5.C': 'VERIFIED SPECS from official Wharfedale EVO 5 Series User Manual: ' +
    'Enclosure Type: Centre Channel speaker. ' +
    'Bass Drivers: 2 x Woven Kevlar Cone. ' +
    'Tweeter: 35 x 70mm AMT (Air Motion Transformer). ' +
    'AV Shield: No. ' +
    'Peak SPL: 103 dB. ' +
    'Frequency Response: 56Hz–24kHz. ' +
    'Crossover Frequency: 2.3kHz. ' +
    'Enclosure Volume: 14 litres. ' +
    'Width: 188mm. Height: 520mm. ' +
    'Net Weight: 12.4 kg. ' +
    'Standard Accessories: Rubber feet. ' +
    'Manufacturer website: https://www.wharfedale.co.uk',
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

/**
 * Normalise a component name for fuzzy matching.
 * Strips punctuation, collapses whitespace, lowercases.
 * Examples that all normalise to the same string:
 *   "Parasound 2125 v.2"  → "parasound 2125 v2"
 *   "Parasound 2125 V2"   → "parasound 2125 v2"
 *   "parasound  2125 v 2" → "parasound 2125 v2"
 *   "Parasound 2125"      → "parasound 2125"  (won't match — intentional)
 */
function normalise(str) {
  return str
    .toLowerCase()
    .replace(/[.\-_,()]/g, '')   // strip common punctuation
    .replace(/\s+/g, ' ')        // collapse multiple spaces
    .trim();
}

/* ─── Prompt 1: Full component specification ─────────────────── */
function buildSpecPrompt(name, category) {
  // Fuzzy lookup — normalise both the input name and each key before comparing
  const normalisedName = normalise(name);
  const correctionKey = Object.keys(KNOWN_CORRECTIONS).find(
    k => normalise(k) === normalisedName
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
    '  "youtubeSearches": ["' + name + ' review"],\n' +
    '  "ratings": null\n' +
    '}\n\n' +
    'RATINGS — populate ONLY when category is Loudspeakers/Speakers. For all other categories set "ratings": null.\n' +
    'For speakers, replace "ratings": null with this object:\n' +
    '  "ratings": {\n' +
    '    "detailClarity": <integer 1-10, where 1=very dull/rolled-off, 10=highly detailed/extended>,\n' +
    '    "bass": <integer 1-10, where 1=very thin/lean, 10=very powerful/heavy>,\n' +
    '    "vocals": <integer 1-10, where 1=recessed/laid-back, 10=very forward/prominent>,\n' +
    '    "soundProfile": <integer 1-10, where 1=very warm, 5=neutral, 10=very bright>\n' +
    '  }\n' +
    'Base all ratings on published professional reviews (Stereophile, What Hi-Fi, Audio Science Review, The Absolute Sound, SoundStage). Use the consensus view across multiple reviews where available.\n' +
    'IMPORTANT: If you do not have sufficient published review data to make an accurate judgement for a specific rating, set that field to null — do not guess. It is better to return null than an inaccurate number.\n\n' +
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
