# AudioScope — Hi-Fi Component Comparison

An AI-powered hi-fi audio equipment comparison tool. Compare 2–6 components side by side with full technical specifications, physical dimensions, pricing, expert summaries, and curated links to professional reviews.

**Live demo:** https://audioscopehifi.com

---

## Features

- Compare amplifiers, preamplifiers, phono preamps, turntables, tonearms, cartridges, DACs, streamers, speakers, and headphones
- AI-retrieved specifications with proper engineering units
- Physical dimensions (metric + imperial) and weight
- MSRP pricing and year of introduction
- Editorial summaries, strengths, and considerations
- Links to manufacturer pages, professional reviews, and YouTube demos
- Progressive loading — results appear as each component loads
- Google AdSense integrated (publisher ID: ca-pub-8677522350792212)
- Royalty-free images (Unsplash Free Commercial License)
- Fully responsive — works on mobile, tablet, and desktop
- No build step — pure HTML/CSS/JavaScript

---

## Tech Stack

| Layer     | Technology                                   |
|-----------|----------------------------------------------|
| Frontend  | HTML5, CSS3, vanilla JavaScript (ES6+)       |
| Backend   | Netlify Functions (Node.js 18 serverless)    |
| AI        | Anthropic Claude API (`claude-sonnet-4-*`)   |
| Hosting   | Netlify                                       |
| Ads       | Google AdSense                               |

---

## File Structure

```
audioscope/
├── index.html                  ← Main comparison tool
├── about.html                  ← About page
├── privacy-policy.html         ← Privacy Policy (required for AdSense)
├── favicon.svg                 ← SVG favicon / logo
├── robots.txt                  ← SEO crawl rules
├── netlify.toml                ← Netlify build + header config
├── .gitignore
├── README.md
├── css/
│   └── styles.css              ← All styles (shared across pages)
├── js/
│   └── app.js                  ← Application JavaScript
└── netlify/
    └── functions/
        └── compare.js          ← Anthropic API proxy (serverless)
```

---

## Deploying to Netlify via GitHub

### Step 1 — Push to GitHub

```bash
# In this folder:
git init
git add .
git commit -m "Initial commit — AudioScope"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/audioscope.git
git push -u origin main
```

### Step 2 — Connect to Netlify

1. Log in to [app.netlify.com](https://app.netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **GitHub** and authorize Netlify
4. Select the `audioscope` repository
5. Build settings (Netlify auto-detects from `netlify.toml`):
   - **Build command:** *(leave empty)*
   - **Publish directory:** `.`
6. Click **"Deploy site"**

### Step 3 — Set the Anthropic API Key

The site will deploy but comparisons won't work until you add your API key.

1. In Netlify dashboard → **Site configuration** → **Environment variables**
2. Click **"Add a variable"**
3. Set:
   - **Key:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-api03-your-actual-key-here`
4. Click **Save**
5. Go to **Deploys** → **Trigger deploy** → **Deploy site**

Get an API key at [console.anthropic.com](https://console.anthropic.com)

---

## Setting Up AdSense Ad Slots

After your site is approved by Google AdSense:

1. Log in to [adsense.google.com](https://adsense.google.com)
2. Go to **Ads → By ad unit → Display ads**
3. Create a new ad unit for each slot below
4. Copy the **slot ID** (the number after `data-ad-slot=`)
5. Open each HTML file and replace the placeholder slot IDs:

| File                 | Placeholder              | Location                     |
|----------------------|--------------------------|------------------------------|
| `index.html`         | `REPLACE_TOP_SLOT_ID`    | Top banner (shows on results)|
| `index.html`         | `REPLACE_MID_SLOT_ID`    | Mid-page (between table/cards)|
| `index.html`         | `REPLACE_BOT_SLOT_ID`    | Bottom of results            |
| `about.html`         | `REPLACE_ABOUT_SLOT_ID`  | Content area                 |

6. Commit and push to redeploy:
```bash
git add .
git commit -m "Add AdSense slot IDs"
git push
```

---

## Local Development

### Prerequisites

- Node.js 18+
- Netlify CLI: `npm install -g netlify-cli`
- Anthropic API key

### Setup

1. Create `.env` in project root:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
   ```

2. Start dev server:
   ```bash
   netlify dev
   ```

3. Open [http://localhost:8888](http://localhost:8888)

The Netlify CLI automatically serves your functions at `/.netlify/functions/compare` and injects the `.env` variables.

---

## AdSense Approval Checklist

Before applying, verify:

- [x] `<meta name="google-adsense-account" content="ca-pub-8677522350792212">` on all pages
- [x] Privacy Policy page exists and is linked in footer
- [x] About page with genuine original content
- [x] Clear navigation on all pages
- [x] Footer with policy links
- [x] Original content (not scraped or AI-spun filler)
- [x] Royalty-free images with proper licensing
- [ ] Replace all `REPLACE_*_SLOT_ID` placeholders with real slot IDs
- [ ] Domain verified in Google AdSense
- [ ] Site has been live with real traffic for a few weeks
- [ ] Update contact email (currently `contact@audioscope.example.com`)
- [ ] Update canonical URLs if your domain differs from `audioscopehifi.com`

---

## Image Credits

All images are sourced from [Unsplash](https://unsplash.com) under the **Unsplash License**, which permits free use for commercial purposes without attribution (attribution included as best practice).

- **Hero image** (index.html): Speaker drivers — Unsplash Free Commercial License
- **About image** (about.html): Sony headphones — Photo by C D-X, Unsplash

---

## License

MIT — see [LICENSE](LICENSE) for details.
