import { test, describe, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeMock } from './helpers/mock-chrome.mjs';

const { classifyWithAI, clearAICache } = await import('../lib/aiFilter.js');

const VALID_RESULT = {
  relevant: true,
  fitScore: 85,
  title: 'Senior Frontend',
  description: 'React + TypeScript',
  location: 'San José, CR',
  modality: 'remote',
  englishLevel: 'intermediate',
  technologies: ['react', 'typescript'],
  posterName: 'Alice',
  companyName: 'Acme',
  applicationEmail: null,
  applicationLink: 'https://example.com/apply',
};

const AI_CONFIG = { apiKey: 'sk-test', gatewayUrl: 'https://test.example/v1/chat/completions', model: 'test-model', timeoutMs: 5000 };
const PROFILE = 'Frontend dev, 5y exp, React/TS/Node';

let fetchMock;

function okResponse(content) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
}

describe('parseResponse (via callGateway)', () => {
  before(() => { installChromeMock(); });

  beforeEach(() => {
    clearAICache();
    fetchMock = mock.method(globalThis, 'fetch', async () => okResponse(JSON.stringify(VALID_RESULT)));
  });

  after(() => { fetchMock.mock.restore(); });

  test('extracts valid plain JSON', async () => {
    const r = await classifyWithAI('desc', 'h1', PROFILE, AI_CONFIG);
    assert.equal(r.relevant, true);
    assert.equal(r.fitScore, 85);
  });

  test('extracts JSON wrapped in markdown code block', async () => {
    fetchMock.mock.mockImplementation(async () => okResponse('```json\n' + JSON.stringify(VALID_RESULT) + '\n```'));
    const r = await classifyWithAI('desc', 'h2', PROFILE, AI_CONFIG);
    assert.equal(r.relevant, true);
  });

  test('extracts JSON surrounded by prose', async () => {
    fetchMock.mock.mockImplementation(async () => okResponse('Here is the result:\n' + JSON.stringify(VALID_RESULT) + '\nDone.'));
    const r = await classifyWithAI('desc', 'h3', PROFILE, AI_CONFIG);
    assert.equal(r.relevant, true);
  });

  test('returns AI_UNAVAILABLE_RESULT when relevant field is missing', async () => {
    fetchMock.mock.mockImplementation(async () => okResponse(JSON.stringify({ fitScore: 50, title: 'No relevant field' })));
    const r = await classifyWithAI('desc', 'h4', PROFILE, AI_CONFIG);
    assert.equal(r.reason, 'ai-unavailable');
  });

  test('returns AI_UNAVAILABLE_RESULT when relevant is not boolean', async () => {
    fetchMock.mock.mockImplementation(async () => okResponse(JSON.stringify({ relevant: 'true' })));
    const r = await classifyWithAI('desc', 'h5', PROFILE, AI_CONFIG);
    assert.equal(r.reason, 'ai-unavailable');
  });

  test('returns AI_UNAVAILABLE_RESULT on malformed JSON', async () => {
    fetchMock.mock.mockImplementation(async () => okResponse('not json at all { broken'));
    const r = await classifyWithAI('desc', 'h6', PROFILE, AI_CONFIG);
    assert.equal(r.reason, 'ai-unavailable');
  });

  test('clamps fitScore below 0 to 0', async () => {
    fetchMock.mock.mockImplementation(async () => okResponse(JSON.stringify({ ...VALID_RESULT, fitScore: -50 })));
    const r = await classifyWithAI('desc', 'h7', PROFILE, AI_CONFIG);
    assert.equal(r.fitScore, 0);
  });

  test('clamps fitScore above 100 to 100', async () => {
    fetchMock.mock.mockImplementation(async () => okResponse(JSON.stringify({ ...VALID_RESULT, fitScore: 250 })));
    const r = await classifyWithAI('desc', 'h8', PROFILE, AI_CONFIG);
    assert.equal(r.fitScore, 100);
  });

  test('rejects invalid modality', async () => {
    fetchMock.mock.mockImplementation(async () => okResponse(JSON.stringify({ ...VALID_RESULT, modality: 'telework' })));
    const r = await classifyWithAI('desc', 'h9', PROFILE, AI_CONFIG);
    assert.equal(r.modality, null);
  });

  test('accepts valid modalities (remote/hybrid/onsite)', async () => {
    for (const m of ['remote', 'hybrid', 'onsite']) {
      fetchMock.mock.mockImplementation(async () => okResponse(JSON.stringify({ ...VALID_RESULT, modality: m })));
      const r = await classifyWithAI('desc', `hm-${m}`, PROFILE, AI_CONFIG);
      assert.equal(r.modality, m);
    }
  });

  test('filters falsy values from technologies array', async () => {
    fetchMock.mock.mockImplementation(async () => okResponse(JSON.stringify({ ...VALID_RESULT, technologies: ['react', null, '', 'ts', undefined, false] })));
    const r = await classifyWithAI('desc', 'h10', PROFILE, AI_CONFIG);
    assert.deepEqual(r.technologies, ['react', 'ts']);
  });

  test('truncates reason over 200 chars', async () => {
    const longReason = 'x'.repeat(500);
    fetchMock.mock.mockImplementation(async () => okResponse(JSON.stringify({ ...VALID_RESULT, reason: longReason })));
    const r = await classifyWithAI('desc', 'h11', PROFILE, AI_CONFIG);
    assert.equal(r.reason.length, 200);
  });
});

describe('classifyWithAI - cache & fallback', () => {
  before(() => { installChromeMock(); });

  beforeEach(() => { clearAICache(); });

  test('returns AI_UNAVAILABLE_RESULT when apiKey is missing', async () => {
    const r = await classifyWithAI('desc', 'hf1', PROFILE, { gatewayUrl: 'x', model: 'y' });
    assert.equal(r.reason, 'ai-unavailable');
  });

  test('returns AI_UNAVAILABLE_RESULT when profile is empty', async () => {
    const r = await classifyWithAI('desc', 'hf2', '', { apiKey: 'k' });
    assert.equal(r.reason, 'ai-unavailable');
  });

  test('returns AI_UNAVAILABLE_RESULT when description is empty', async () => {
    const r = await classifyWithAI('', 'hf3', PROFILE, { apiKey: 'k' });
    assert.equal(r.reason, 'ai-unavailable');
  });

  test('second call with same hash returns cached result without hitting fetch', async () => {
    let calls = 0;
    const fm = mock.method(globalThis, 'fetch', async () => { calls++; return okResponse(JSON.stringify(VALID_RESULT)); });
    const r1 = await classifyWithAI('desc', 'h-cache', PROFILE, AI_CONFIG);
    const r2 = await classifyWithAI('desc', 'h-cache', PROFILE, AI_CONFIG);
    assert.equal(calls, 1);
    assert.equal(r1.fitScore, 85);
    assert.equal(r2.cached, true);
    fm.mock.restore();
  });

  test('concurrent calls for same hash dedup to a single fetch', async () => {
    let calls = 0;
    const fm = mock.method(globalThis, 'fetch', async () => { calls++; return okResponse(JSON.stringify(VALID_RESULT)); });
    const [r1, r2] = await Promise.all([
      classifyWithAI('desc', 'h-dedup', PROFILE, AI_CONFIG),
      classifyWithAI('desc', 'h-dedup', PROFILE, AI_CONFIG),
    ]);
    assert.equal(calls, 1);
    assert.equal(r1.fitScore, 85);
    assert.equal(r2.fitScore, 85);
    fm.mock.restore();
  });

  test('serializes different hashes through the FIFO queue (max 1 concurrent)', async () => {
    let concurrent = 0, peak = 0;
    const fm = mock.method(globalThis, 'fetch', async () => {
      concurrent++;
      peak = Math.max(peak, concurrent);
      await new Promise(r => setTimeout(r, 20));
      concurrent--;
      return okResponse(JSON.stringify(VALID_RESULT));
    });
    await Promise.all([
      classifyWithAI('a', 'hq1', PROFILE, AI_CONFIG),
      classifyWithAI('b', 'hq2', PROFILE, AI_CONFIG),
      classifyWithAI('c', 'hq3', PROFILE, AI_CONFIG),
    ]);
    assert.equal(peak, 1);
    fm.mock.restore();
  });

  test('clearAICache resets state so next call hits fetch again', async () => {
    let calls = 0;
    const fm = mock.method(globalThis, 'fetch', async () => { calls++; return okResponse(JSON.stringify(VALID_RESULT)); });
    await classifyWithAI('desc', 'h-clr', PROFILE, AI_CONFIG);
    clearAICache();
    await classifyWithAI('desc', 'h-clr', PROFILE, AI_CONFIG);
    assert.equal(calls, 2);
    fm.mock.restore();
  });
});

describe('buildUserPrompt & stripBoilerplate (via callGateway)', () => {
  before(() => { installChromeMock(); });

  beforeEach(() => { clearAICache(); });

  test('strips URLs and EEO boilerplate before sending to gateway', async () => {
    let capturedPrompt = null;
    const fm = mock.method(globalThis, 'fetch', async (_url, init) => {
      const body = JSON.parse(init.body);
      capturedPrompt = body.messages[1].content;
      return okResponse(JSON.stringify(VALID_RESULT));
    });
    const messy = 'Check https://example.com/jobs/123 for more. We are an Equal Opportunity Employer and EOE M/F/V/D. Real job content here.';
    await classifyWithAI(messy, 'hp1', PROFILE, AI_CONFIG);
    assert.ok(!capturedPrompt.includes('https://example.com'), 'URL should be stripped');
    assert.ok(!/equal opportunity/i.test(capturedPrompt), 'EEO boilerplate should be stripped');
    assert.ok(capturedPrompt.includes('Real job content here.'));
    fm.mock.restore();
  });

  test('truncates descriptions longer than MAX_DESCRIPTION_CHARS (4000)', async () => {
    let capturedPrompt = null;
    const fm = mock.method(globalThis, 'fetch', async (_url, init) => {
      const body = JSON.parse(init.body);
      capturedPrompt = body.messages[1].content;
      return okResponse(JSON.stringify(VALID_RESULT));
    });
    const long = 'a'.repeat(5000);
    await classifyWithAI(long, 'hp2', PROFILE, AI_CONFIG);
    assert.ok(capturedPrompt.includes('...'), 'truncation marker should be present');
    const descMatch = capturedPrompt.match(/Job description:\n([\s\S]*?)\n\nExtract/);
    assert.ok(descMatch[1].length <= 4003, 'description section should be truncated');
    fm.mock.restore();
  });
});
