# LinkedIn Job Description Collector — Architecture

## Overview
Runs on `linkedin.com/*`. Detects posts via `[data-testid="expandable-text-box"]`, extracts text, normalizes, sends to AI for classification. Only relevant matches saved. Non-matching → `display: none` on parent `[role="listitem"]`.

## Pipeline
```
DOM detect → NEGATIVE_PATTERNS pre-filter → age pre-filter (1+ month) → min-length check
→ AI classify (structured JSON, FIFO queue max 1 concurrent, session cache per hash)
→ sanitizeResult (validate technologies/location against description text)
→ relevant=true + locationFilter match → save to chrome.storage.local
→ relevant=false → hide + optional "Not interested" click
```

## Anti-hallucination guards
1. **SYSTEM_PROMPT** enforces `ZERO FABRICATION RULE`: all fields extracted ONLY from description, never from user profile/preferences.
2. **`buildUserPrompt()`** separates "User preferences (for relevance scoring only)" from "Job description (extract ALL field values from this section ONLY)".
3. **`sanitizeResult()`** post-AI: strips technologies not found in description (case-insensitive), nullifies location if not in description.
4. **`relevant`** requires AND: `parsed.relevant === true && fitScore >= 50`.

## Key files
- `lib/aiFilter.js` — AI classification, prompt, sanitize, cache
- `lib/pipeline.js` — orchestrator, pre-filters, storage flow
- `lib/parser.js` — DOM extraction, text normalization
- `lib/storage.js` — SHA-256 dedup, chrome.storage.local
- `lib/settings.js` — presets CRUD, config persistence
- `lib/constants.js` — regexes, thresholds, storage keys
- `content.js` — content script entry, dynamic imports
- `background.js` — service worker (AI fetch proxy)
- `presets/` — standalone preset management page
- `viewer/` — standalone saved matches browser
- `tests/` — node:test + mock-chrome helpers
