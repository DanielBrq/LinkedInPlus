# MV3 migration inventory

## Entry points and manifest-referenced files

| archivo | rol | LOC | destino en src/ | fase |
|---|---|---:|---|---|
| `content.js` | content | 51 | `src/content/index.ts` | F3 |
| `popup.html` | popup | 34 | `src/popup/index.html` | F4 |
| `popup.js` | popup | 26 | `src/popup/main.ts` | F4 |
| `theme.css` | otro (popup stylesheet) | — | `src/popup/style.css` | F4 |
| `lib/aiFilter.js` | otro (content module) | — | `src/content/aiFilter.ts` | F3 |
| `lib/constants.js` | otro (shared module) | — | `src/shared/constants.ts` | F2 |
| `lib/parser.js` | otro (content module) | — | `src/content/parser.ts` | F3 |
| `lib/settings.js` | otro (shared module) | — | `src/shared/settings.ts` | F2 |
| `lib/utils.js` | otro (shared module) | — | `src/shared/utils.ts` | F2 |
| `lib/observer.js` | otro (content module) | — | `src/content/observer.ts` | F3 |
| `lib/pipeline.js` | otro (content module) | — | `src/content/pipeline.ts` | F3 |
| `icons/icon16.png` | otro (icon) | — | `public/icons/icon16.png` | F1 |
| `icons/icon48.png` | otro (icon) | — | `public/icons/icon48.png` | F1 |
| `icons/icon128.png` | otro (icon) | — | `public/icons/icon128.png` | F1 |

## Contratos MV3

- Storage: `chrome.storage.local.classifier_config` object with `apiKey: string` (AI Gateway), `model: string` (decision model, default `typesafe-ai/jev`), `threshold: number` (default 65); `timeoutMs` may be read by the classifier. No sync/session keys found.
- Message: `AI_CLASSIFY`, content script → service worker, async via `sendResponse`; request `{type, prompt, model, timeout}`; response `{ok: true, score: integer 0..100}` or `{ok: false, error: string}`. Sender must be a LinkedIn tab; model and prompt are bounded.
- Decision model: `AI_CLASSIFY` sends the prompt as decision `state` and asks one `score` question with a 5-level rubric; level 0..4 maps to 0..100. Content payload unchanged.
- Permissions: `storage`. Host permissions: `https://www.linkedin.com/*`, `https://linkedin.com/*`, `https://ai-gateway.vercel.sh/*`.
- Content script: matches the two LinkedIn hosts above; `run_at: document_idle`; no `world` specified.
- Host selectors: description `[data-testid="expandable-text-box"]` and `span[data-testid="expandable-text-box"]`; post container `[role="listitem"], article, .job-card-container, .jobs-unified-top-card`; text extraction `span, time`.
- No alarms, context menus, or commands found.

## Runtime dependencies and MV3 risks

- Runtime packages: `ai` (Vercel AI Gateway decision models); build dependency `esbuild`. No vendored libraries or CDN references found.
- No `eval`, `new Function`, inline handlers, or inline scripts found.
- Background has a per-request abort timer (bounded to 1–60 seconds, default 15 seconds); no long-lived timer or `window`/`document` use found there. Content uses 2-second initial scan delay and 80ms observer debounce.
