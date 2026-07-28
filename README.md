# LinkedIn Job Description Collector

> Chrome extension that automatically extracts, classifies, and saves LinkedIn job descriptions matching your profile — powered by AI.

![License: MIT](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-2.2.0-black)
![Chrome](https://img.shields.io/badge/chrome-≥112-4285F4?logo=google-chrome)

## Features

- **Auto-detection** — scans LinkedIn feed and job posts via `[data-testid="expandable-text-box"]`
- **Smart pre-filter** — skips irrelevant posts (e.g. `#opentowork`) and old posts (1+ month) before AI call, saving tokens
- **AI classification** — sends descriptions to an OpenAI-compatible API and returns structured data: title, location, modality, technologies, fit score, application link/email
- **Multiple AI presets** — configure and switch between multiple AI providers (OpenAI, DeepSeek, Groq, local LLMs, etc.) with a single click
- **Filter matching** — only saves jobs that match your filters; non-matching posts get hidden
- **Deduplication** — SHA-256 hashing prevents duplicate storage
- **Built-in viewer** — browse saved jobs with fit score badges, tech tags, and description previews

<!-- TODO: -->
<!-- ## Screenshots
> _(Add a screenshot of the popup and the viewer here)_ -->

## Installation

```bash
git clone https://github.com/YOUR_USER/linkedin-job-collector
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the cloned folder

No build step required — the extension is pure vanilla JS.

## User guide

### 1. AI setup (Presets)

The extension supports **multiple AI provider presets**. Each preset stores its own connection settings and filters, so you can switch between providers (e.g. OpenAI, Groq, a local LLM) with one click.

Open the extension popup and click **⚙** next to the preset selector to manage presets. Each preset has:

| Field | What to put |
|---|---|
| **Preset Name** | A descriptive name like `openai`, `groq`, `local-llama` |
| **Gateway URL** | Endpoint for chat completions. Defaults to Vercel AI Gateway, but you can use any OpenAI-compatible API (OpenAI, DeepSeek, Groq, Together, etc.) |
| **API Key** | Your API key / bearer token. Stored locally in `chrome.storage` — never sent anywhere except the AI provider. |
| **Model** | A cheap classification model like `gpt-4o-mini` or `deepseek-chat`. The model receives a system prompt + the job description and returns structured JSON. |
| **Filters** | What you're looking for: skills, experience, preferred industries. The AI matches jobs against this. Be specific: *"Senior Angular developer, 5+ years, interested in remote fintech roles"*. |
| **Negative Filters** | What you want to exclude. The AI rejects jobs matching this. E.g. *"No Java, no on-site, no agencies"*. |

**Switching presets:** Use the dropdown in the popup to instantly switch the active preset. All fields save automatically as you type in the presets page.

### 2. Toggles explained

| Toggle | Default | What it does |
|---|---|---|
| **Enable Collector** | ON | Master switch. Turn off to stop all detection without losing your config. |
| **Save matched jobs** | ON | When a job passes AI classification, save it to `chrome.storage`. Turn off to only preview matches (visible via green outline) without storing them. |
| **Hide non-relevant posts** | ON | Hide posts that don't pass AI classification. The post gets `display: none` after a short delay. |
| **Educate LinkedIn algorithm** | OFF | For every rejected post (pre-filter or AI), automatically clicks the "Not interested" menu option on the post. This teaches LinkedIn's algorithm to show you fewer irrelevant posts over time. |

**Tip:** Start with "Educate LinkedIn algorithm" OFF until you've tuned your filters and verified the AI is classifying correctly. Then turn it on so LinkedIn itself learns what you don't want.

### 3. What happens when you scroll LinkedIn

```
Post appears on screen
  ↓
Extension detects job text
  ↓
Pre-filter: is this an engagement bait / #opentowork post?
  ├─ YES → click "Not interested" (if enabled) → hide → done
  └─ NO →
      ↓
Pre-filter: is the post 1+ month old? (LinkedIn 'mo' label)
  ├─ YES → click "Not interested" (if enabled) → hide → done
  └─ NO →
      ↓
Is the description long enough (&lt; 100 chars)?
  ├─ NO → click "Not interested" (if enabled) → hide → done
  └─ YES →
      ↓
AI classifies against your filters + negative filters
  ├─ RELEVANT (fitScore ≥ 50)
  │   ├─ green outline on the post
  │   └─ saved to storage (if toggle ON)
  └─ NOT RELEVANT (fitScore < 50)
      ├─ click "Not interested" (if enabled)
      └─ post hidden (if toggle ON)
```

### 4. Viewing saved matches

Click **Open Viewer** in the popup footer, or open `viewer/index.html` from the extension's page. The viewer shows every saved job as a card with:

- Fit score badge (color-coded: green ≥ 70, amber ≥ 40, red < 40)
- Job title, location, modality, English level
- Technology tags
- Expandable description preview
- Application link or email
- Individual delete button

### 5. Debug mode

Enable **Show rejected posts with red border** to see which posts are filtered out before they disappear. Adjust the **Hide delay** slider to control how long they stay visible (red border is immediate, then fade out after the delay).

This is useful for:
- Verifying the pre-filter is catching the right posts
- Checking that the AI is classifying correctly
- Understanding what LinkedIn content the extension processes

## How it works

```
LinkedIn page → content.js detects job text
  → NEGATIVE_PATTERNS check (regex pre-filter)
    → AGE check (1+ month posts discarded)
      → AI classification (structured JSON)
        → fitScore >= threshold → save to chrome.storage
        → fitScore < threshold → hide post via display: none
```

## Project structure

```
├── content.js          Content script orchestrator
├── manifest.json       Manifest V3
├── popup.html / .js    Preset switcher & toggles UI
├── background.js       Service worker (AI fetch proxy)
├── theme.css           Dark theme variables
├── icons/              Extension icons
├── lib/
│   ├── aiFilter.js     AI classification via OpenAI-compatible API
│   ├── constants.js    Shared constants, storage keys, regexes
│   ├── parser.js       DOM extraction & text normalization
│   ├── pipeline.js     Main processing pipeline
│   ├── storage.js      Job storage & SHA-256 dedup
│   ├── settings.js     Config persistence & preset API
│   ├── observer.js     MutationObserver lifecycle
│   └── utils.js        chrome.storage helpers, hashing, download
├── presets/
│   ├── index.html      Preset management page
│   └── presets.js      Preset CRUD logic (add/edit/delete/activate)
├── viewer/
│   ├── index.html      Saved matches browser
│   └── viewer.js       Viewer logic
└── tests/
    ├── aiFilter.test.mjs
    ├── parser.test.mjs
    ├── pipeline.test.mjs
    ├── storage.test.mjs
    └── helpers/mock-chrome.mjs
```

## Tech stack

- **Runtime:** Chrome Extension Manifest V3
- **Storage:** `chrome.storage.local`
- **AI:** OpenAI-compatible API (BYO key — works with OpenAI, DeepSeek, Groq, Together, Perplexity, Mistral, OpenRouter, and more)
- **Auth / config:** Preset system with per-provider settings → `chrome.storage.local`

## Recomendations
You should use a fast and cheap lightweight model like **meta/llama 3.1 8B**

## License

MIT
