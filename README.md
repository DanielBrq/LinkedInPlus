# LinkedIn Post Classifier

Chrome extension that classifies LinkedIn posts against configurable job-search preferences and hides low-scoring posts with `display: none`. It does not save posts.

## Setup

1. Install Node.js 20+ and pnpm.
2. Run `pnpm install`, then `pnpm build`.
3. Load `dist/` as an unpacked extension from `chrome://extensions`.
4. Open the extension popup and set a Vercel AI Gateway API key, model ID, positive preferences, negative preferences, and score threshold.

The threshold ranges from 0–100. Posts scoring below it are hidden. Configuration is stored in `chrome.storage.local`; existing saved posts are removed once during migration. The Gateway key is read and used by the extension service worker, not sent by the content script.

## Classification flow

```text
LinkedIn post → text normalization
  → Vercel AI Gateway via Vercel AI SDK
  → score against positive and negative preferences
  → score below threshold: display:none
```

If the Gateway is unavailable or not configured, the post remains visible.

## Development

- `pnpm build` bundles the extension into `dist/` (service worker, content script, popup).
- `pnpm test` runs unit tests.

The extension uses only Vercel AI Gateway; provider/model selection is configured with the Gateway model ID.
