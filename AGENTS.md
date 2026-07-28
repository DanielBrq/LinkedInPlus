# LinkedIn Job Description Collector - Extension Architecture & Specifications

## Overview
Runs on all `linkedin.com/*` pages. Detects posts/jobs by `[data-testid="expandable-text-box"]`, extracts text, normalizes, sends to AI for classification. AI returns structured JSON with fit score, title, location, modality, technologies, etc. Only posts that match the user's profile (CV) are saved. **Non-matching posts get `display: none`** via parent `[role="listitem"]`.

## Core Rules & Constraints
1. **Scope:** AI classifies every description against the user's profile. Only relevant matches are saved. The AI extracts structured fields (title, location, modality, englishLevel, technologies, application email/link) plus a fitScore (0-100).
2. **Negative Pre-filter:** Before AI call, `content.js` checks `NEGATIVE_PATTERNS` regexes (e.g. `/#opentowork/i`). Match → hide post immediately, skip AI entirely. Saves tokens/latency. SYSTEM_PROMPT also includes a negative rule as safety net.
3. **DOM Target:** Target `[data-testid="expandable-text-box"]` or fallback selectors (`.jobs-description__content`, `#job-details`).
4. **Auto Expansion:** Automatically click "See more" (`.jobs-description__footer-button`, `button[aria-label*="see more"]`, `button[aria-label*="mostrar más"]`) if truncated.
5. **Text Normalization:**
   - Convert to lowercase.
   - Remove invisible/control characters (`\u200B-\u200D`, `\uFEFF`, ASCII control chars).
   - Collapse duplicate whitespace into a single space (`\s+` -> `' '`).
6. **AI Classification:** Uses Vercel Gateway (OpenAI-compatible). Prompt asks for structured JSON with `relevant`, `fitScore`, `title`, `description`, `location`, `modality`, `englishLevel`, `technologies[]`, `applicationEmail`, `applicationLink`. All fields nullable except `relevant`. Session cache per hash, FIFO queue (max 1 concurrent). Supports multiple named presets (provider + model + filters) with active preset switching.
7. **Deduplication & Storage:**
   - Generate SHA-256 hash using native `crypto.subtle.digest`.
   - Store AI result object uniquely in `chrome.storage.local` (keyed by `job_<hash>`).
8. **Viewer:** Standalone HTML app (`viewer/index.html`) that lists saved AI results formatted as cards with fit score badges, tech tags, description preview toggle, and individual delete.

## File Structure
- `manifest.json`: Manifest V3 extension definition
- `content.js`: Content script orchestrator; dynamically imports all modules
- `popup.html` & `popup.js`: Preset switcher & debug settings UI
- `theme.css`: Shared CSS variables (light/dark theme)
- `lib/parser.js`: DOM extraction and text normalization (`extractDescription`)
- `lib/storage.js`: Job storage & SHA-256 deduplication (`saveJob`, `hasJob`, `getSavedJobs`, `clearSavedJobs`)
- `lib/settings.js`: Config persistence (`getEnabled`, `getActivePresetConfig`, `getPresets`, `getDisplayConfig`)
- `lib/aiFilter.js`: AI classification with Vercel Gateway (`classifyWithAI`, `clearAICache`)
- `lib/observer.js`: Reusable MutationObserver lifecycle (`createObserver`)
- `lib/utils.js`: Generic chrome.storage helpers, SHA-256 hashing, file download
- `viewer/index.html` & `viewer/viewer.js`: Standalone viewer for AI-classified job matches
- `presets/index.html` & `presets/presets.js`: Standalone preset management page (CRUD for AI provider presets)
