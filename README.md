# LinkedIn Job Description Collector

> Chrome extension that automatically extracts, classifies, and saves LinkedIn job descriptions that match your profile — powered by AI.

## Features

- **Auto-detection** — scans LinkedIn feed and job posts via `[data-testid="expandable-text-box"]`
- **Smart pre-filter** — skips irrelevant posts (e.g. `#opentowork`) before AI call, saving tokens
- **AI classification** — sends descriptions to an OpenAI-compatible API (Vercel Gateway) and returns structured data: title, location, modality, technologies, fit score, application link/email
- **Profile matching** — only saves jobs that match your CV; non-matching posts are hidden
- **Deduplication** — SHA-256 hashing prevents duplicate storage
- **Built-in viewer** — browse saved jobs with fit score badges, tech tags, and description previews

## Installation

1. Clone the repo
2. Open `chrome://extensions` → **Load unpacked**
3. Select the project folder

No build step required — the extension is pure vanilla JS.

## Configuration

Open the extension popup to set:

| Field | Description |
|---|---|
| API Key | OpenAI-compatible key (e.g. Vercel Gateway, OpenAI) |
| Gateway URL | Endpoint for chat completions |
| Model | e.g. `gpt-4o-mini` |
| Profile / CV | The text the AI uses to evaluate fit |

These are stored in `chrome.storage.local`.

## How it works

```
LinkedIn page → content.js detects job text
  → NEGATIVE_PATTERNS check (regex pre-filter)
    → AI classification (structured JSON)
      → fitScore >= threshold → save to chrome.storage
      → fitScore < threshold → hide post via display: none
```

## Project structure

```
├── content.js          # Content script orchestrator
├── manifest.json       # Manifest V3
├── popup.html / .js    # AI config & debug UI
├── theme.css           # Light/dark theme variables
├── lib/
│   ├── aiFilter.js     # AI classification (Vercel Gateway)
│   ├── parser.js       # DOM extraction & text normalization
│   ├── storage.js      # Job storage & SHA-256 dedup
│   ├── settings.js     # Config persistence
│   ├── observer.js     # MutationObserver lifecycle
│   └── utils.js        # chrome.storage helpers, hashing, download
└── viewer/
    ├── index.html      # Saved jobs browser
    └── viewer.js       # Viewer logic
```

## Tech stack

- **Runtime:** Chrome Extension Manifest V3
- **Storage:** `chrome.storage.local`
- **AI:** OpenAI-compatible API via Vercel Gateway
- **Auth / config:** Extension popup → `chrome.storage.local`

## License

MIT
