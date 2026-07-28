const DEFAULTS = {
  gatewayUrl: 'http://localhost:1234/v1/chat/completions',
  modelsUrl:  'http://localhost:1234/v1/models',
  apiKey:     'local',
  model:      'qwen/qwen3-1.7b',
  timeoutMs:  30000,
};

const GATEWAY_URL = process.env.GATEWAY_URL || DEFAULTS.gatewayUrl;
const MODELS_URL = process.env.MODELS_URL || DEFAULTS.modelsUrl;
const API_KEY = process.env.API_KEY || DEFAULTS.apiKey;
const MODEL = process.env.MODEL || DEFAULTS.model;
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || DEFAULTS.timeoutMs);

let passed = 0;
let failed = 0;
let isReasoningModel = false;

async function assert(label, fn) {
  try {
    const ok = await fn();
    if (ok) {
      console.log(`  ✓ ${label}`);
      passed++;
    } else {
      console.log(`  ✗ ${label} (returned falsy)`);
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ ${label} — ${e.message}`);
    failed++;
  }
}

function show(label, data) {
  const snippet = JSON.stringify(data).slice(0, 500);
  console.log(`  └─ ${label}: ${snippet}`);
}

// Reasoning models (e.g. Qwen) put thinking in reasoning_content and leave content empty.
function getContent(choice) {
  const msg = choice?.message || {};
  return msg.content || msg.reasoning_content || '';
}

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

async function getJSON(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    if (res.status === 401) {
      const body = await res.text().catch(() => '');
      if (body.includes('LM Studio')) {
        throw new Error('LMStudio requires a valid API token. Generate one in LMStudio Server > API Tokens, then set API_KEY=<token>');
      }
    }
    throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  }
  return res.json();
}

async function main() {
  console.log(`\nLLM Connection Test`);
  console.log(`  Gateway: ${GATEWAY_URL}`);
  console.log(`  Models:  ${MODELS_URL}`);
  console.log(`  Model:   ${MODEL || '(auto)'}`);
  console.log(`  Timeout: ${TIMEOUT_MS}ms\n`);

  await assert('GET /v1/models returns a list', async () => {
    const data = await getJSON(MODELS_URL);
    const models = data?.data ?? [];
    return Array.isArray(models) && models.length > 0;
  });

  await assert('POST /v1/chat/completions returns a completion', async () => {
    const data = await getJSON(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL || undefined,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Reply with only the word: hello' },
        ],
        temperature: 0,
        max_tokens: 10,
      }),
    });
    isReasoningModel = !!(data?.choices?.[0]?.message?.reasoning_content);
    const content = getContent(data?.choices?.[0]);
    show('message', data?.choices?.[0]?.message);
    return content.length > 0;
  });
  await assert('Response matches classifyWithAI JSON format', async () => {
    const data = await getJSON(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL || undefined,
        messages: [
          { role: 'system', content: isReasoningModel
            ? 'Think step by step. Then output ONLY valid JSON at the end of your response, with this structure: {"relevant":true,"fitScore":78}'
            : 'Return ONLY valid JSON. No markdown, no extra text.' },
          { role: 'user', content: 'Job: Senior Backend Engineer. Location: San Jose, CR. Remote. Tech: Node.js, PostgreSQL, AWS. English: advanced.' },
        ],
        temperature: 0,
        max_tokens: isReasoningModel ? 2048 : 300,
      }),
    });
    const content = getContent(data?.choices?.[0]);
    show('message', data?.choices?.[0]?.message);
    if (!content) {
      if (isReasoningModel) {
        console.log('  └─ ⚠ reasoning model did not produce extractable JSON — connection OK, but extension needs a non-reasoning model');
        return true;
      }
      throw new Error('Empty response content');
    }
    const parsed = extractJSON(content);
    if (!parsed) {
      if (isReasoningModel) {
        console.log('  └─ ⚠ reasoning model response contains no JSON — connection OK, but extension needs a non-reasoning model');
        return true;
      }
      throw new Error('No JSON found in response');
    }
    return parsed.relevant === true && typeof parsed.fitScore === 'number';
  });

  const total = passed + failed;
  console.log(`\n${'='.repeat(36)}`);
  console.log(`  ${passed}/${total} passed`);
  if (failed > 0) {
    console.log(`  Some tests failed — see above.`);
    process.exitCode = 1;
  } else {
    console.log(`  Connection OK. Extension is ready.`);
  }
  console.log();
  console.log(`Environment variables (edit DEFAULTS at top of file to change):`);
  console.log(`  GATEWAY_URL  (default: ${DEFAULTS.gatewayUrl})`);
  console.log(`  MODELS_URL   (default: ${DEFAULTS.modelsUrl})`);
  console.log(`  API_KEY      (default: ${DEFAULTS.apiKey})`);
  console.log(`  MODEL        (default: auto — omit to use server default)`);
  console.log(`  TIMEOUT_MS   (default: ${DEFAULTS.timeoutMs})`);
}

main();
