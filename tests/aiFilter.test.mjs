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

let sendMock;

function mockReply(content) {
  return { ok: true, status: 200, data: { choices: [{ message: { content } }] }, error: null };
}

function installSendMock() {
  sendMock = mock.method(chrome.runtime, 'sendMessage', (_msg, cb) => cb(mockReply(JSON.stringify(VALID_RESULT))));
}

describe('parseResponse (via callGateway)', () => {
  before(() => { installChromeMock(); });

  beforeEach(() => {
    clearAICache();
    installSendMock();
  });

  after(() => { sendMock.mock.restore(); });

  test('extracts valid plain JSON', async () => {
    const r = await classifyWithAI('desc', 'h1', PROFILE, '', AI_CONFIG);
    assert.equal(r.relevant, true);
    assert.equal(r.fitScore, 85);
  });

  test('extracts JSON wrapped in markdown code block', async () => {
    sendMock.mock.mockImplementation((_msg, cb) => cb(mockReply('```json\n' + JSON.stringify(VALID_RESULT) + '\n```')));
    const r = await classifyWithAI('desc', 'h2', PROFILE, '', AI_CONFIG);
    assert.equal(r.relevant, true);
  });

  test('extracts JSON surrounded by prose', async () => {
    sendMock.mock.mockImplementation((_msg, cb) => cb(mockReply('Here is the result:\n' + JSON.stringify(VALID_RESULT) + '\nDone.')));
    const r = await classifyWithAI('desc', 'h3', PROFILE, '', AI_CONFIG);
    assert.equal(r.relevant, true);
  });

  test('returns AI_UNAVAILABLE_RESULT when relevant field is missing', async () => {
    sendMock.mock.mockImplementation((_msg, cb) => cb(mockReply(JSON.stringify({ fitScore: 50, title: 'No relevant field' }))));
    const r = await classifyWithAI('desc', 'h4', PROFILE, '', AI_CONFIG);
    assert.equal(r.reason, 'ai-failed');
  });

  test('returns AI_UNAVAILABLE_RESULT when relevant is not boolean', async () => {
    sendMock.mock.mockImplementation((_msg, cb) => cb(mockReply(JSON.stringify({ relevant: 'true' }))));
    const r = await classifyWithAI('desc', 'h5', PROFILE, '', AI_CONFIG);
    assert.equal(r.reason, 'ai-failed');
  });

  test('returns AI_UNAVAILABLE_RESULT on malformed JSON', async () => {
    sendMock.mock.mockImplementation((_msg, cb) => cb(mockReply('not json at all { broken')));
    const r = await classifyWithAI('desc', 'h6', PROFILE, '', AI_CONFIG);
    assert.equal(r.reason, 'ai-failed');
  });

  test('clamps fitScore below 0 to 0', async () => {
    sendMock.mock.mockImplementation((_msg, cb) => cb(mockReply(JSON.stringify({ ...VALID_RESULT, fitScore: -50 }))));
    const r = await classifyWithAI('desc', 'h7', PROFILE, '', AI_CONFIG);
    assert.equal(r.fitScore, 0);
  });

  test('clamps fitScore above 100 to 100', async () => {
    sendMock.mock.mockImplementation((_msg, cb) => cb(mockReply(JSON.stringify({ ...VALID_RESULT, fitScore: 250 }))));
    const r = await classifyWithAI('desc', 'h8', PROFILE, '', AI_CONFIG);
    assert.equal(r.fitScore, 100);
  });

  test('rejects invalid modality', async () => {
    sendMock.mock.mockImplementation((_msg, cb) => cb(mockReply(JSON.stringify({ ...VALID_RESULT, modality: 'telework' }))));
    const r = await classifyWithAI('desc', 'h9', PROFILE, '', AI_CONFIG);
    assert.equal(r.modality, null);
  });

  test('accepts valid modalities (remote/hybrid/onsite)', async () => {
    for (const m of ['remote', 'hybrid', 'onsite']) {
      sendMock.mock.mockImplementation((_msg, cb) => cb(mockReply(JSON.stringify({ ...VALID_RESULT, modality: m }))));
      const r = await classifyWithAI('desc', `hm-${m}`, PROFILE, '', AI_CONFIG);
      assert.equal(r.modality, m);
    }
  });

  test('filters falsy values from technologies array', async () => {
    sendMock.mock.mockImplementation((_msg, cb) => cb(mockReply(JSON.stringify({ ...VALID_RESULT, technologies: ['react', null, '', 'typescript', undefined, false] }))));
    const r = await classifyWithAI('desc react typescript', 'h10', PROFILE, '', AI_CONFIG);
    assert.deepEqual(r.technologies, ['react', 'typescript']);
  });

  test('truncates reason over 200 chars', async () => {
    const longReason = 'x'.repeat(500);
    sendMock.mock.mockImplementation((_msg, cb) => cb(mockReply(JSON.stringify({ ...VALID_RESULT, reason: longReason }))));
    const r = await classifyWithAI('desc', 'h11', PROFILE, '', AI_CONFIG);
    assert.equal(r.reason.length, 200);
  });
});

describe('classifyWithAI - cache & fallback', () => {
  before(() => { installChromeMock(); });

  beforeEach(() => { clearAICache(); });

  test('returns AI_UNAVAILABLE_RESULT when apiKey is missing', async () => {
    const r = await classifyWithAI('desc', 'hf1', PROFILE, '', { gatewayUrl: 'x', model: 'y' });
    assert.equal(r.reason, 'ai-unavailable');
  });

  test('returns AI_UNAVAILABLE_RESULT when profile is empty', async () => {
    const r = await classifyWithAI('desc', 'hf2', '', '', { apiKey: 'k' });
    assert.equal(r.reason, 'ai-unavailable');
  });

  test('returns AI_UNAVAILABLE_RESULT when description is empty', async () => {
    const r = await classifyWithAI('', 'hf3', PROFILE, '', { apiKey: 'k' });
    assert.equal(r.reason, 'ai-unavailable');
  });

  test('second call with same hash returns cached result without hitting send', async () => {
    let calls = 0;
    const sm = mock.method(chrome.runtime, 'sendMessage', (_msg, cb) => { calls++; cb(mockReply(JSON.stringify(VALID_RESULT))); });
    const r1 = await classifyWithAI('desc', 'h-cache', PROFILE, '', AI_CONFIG);
    const r2 = await classifyWithAI('desc', 'h-cache', PROFILE, '', AI_CONFIG);
    assert.equal(calls, 1);
    assert.equal(r1.fitScore, 85);
    assert.equal(r2.cached, true);
    sm.mock.restore();
  });

  test('concurrent calls for same hash dedup to a single send', async () => {
    let calls = 0;
    const sm = mock.method(chrome.runtime, 'sendMessage', (_msg, cb) => { calls++; cb(mockReply(JSON.stringify(VALID_RESULT))); });
    const [r1, r2] = await Promise.all([
      classifyWithAI('desc', 'h-dedup', PROFILE, '', AI_CONFIG),
      classifyWithAI('desc', 'h-dedup', PROFILE, '', AI_CONFIG),
    ]);
    assert.equal(calls, 1);
    assert.equal(r1.fitScore, 85);
    assert.equal(r2.fitScore, 85);
    sm.mock.restore();
  });

  test('serializes different hashes through the FIFO queue (max 1 concurrent)', async () => {
    let concurrent = 0, peak = 0;
    const sm = mock.method(chrome.runtime, 'sendMessage', (_msg, cb) => {
      concurrent++;
      peak = Math.max(peak, concurrent);
      setTimeout(() => {
        concurrent--;
        cb(mockReply(JSON.stringify(VALID_RESULT)));
      }, 20);
    });
    await Promise.all([
      classifyWithAI('desc', 'hq1', PROFILE, '', AI_CONFIG),
      classifyWithAI('desc', 'hq2', PROFILE, '', AI_CONFIG),
      classifyWithAI('desc', 'hq3', PROFILE, '', AI_CONFIG),
    ]);
    assert.equal(peak, 1);
    sm.mock.restore();
  });

  test('clearAICache resets state so next call hits send again', async () => {
    let calls = 0;
    const sm = mock.method(chrome.runtime, 'sendMessage', (_msg, cb) => { calls++; cb(mockReply(JSON.stringify(VALID_RESULT))); });
    await classifyWithAI('desc', 'h-clr', PROFILE, '', AI_CONFIG);
    clearAICache();
    await classifyWithAI('desc', 'h-clr', PROFILE, '', AI_CONFIG);
    assert.equal(calls, 2);
    sm.mock.restore();
  });

  test('clearAICache settles queued jobs so awaiters do not hang', async () => {
    let release;
    const gate = new Promise(r => { release = r; });
    const sm = mock.method(chrome.runtime, 'sendMessage', (_msg, cb) => {
      gate.then(() => cb(mockReply(JSON.stringify(VALID_RESULT))));
    });
    const p1 = classifyWithAI('desc one', 'h-hang1', PROFILE, '', AI_CONFIG);
    const p2 = classifyWithAI('desc two', 'h-hang2', PROFILE, '', AI_CONFIG);
    const p3 = classifyWithAI('desc three', 'h-hang3', PROFILE, '', AI_CONFIG);
    await new Promise(r => setTimeout(r, 5));
    clearAICache();
    release();
    const settled = await Promise.race([
      Promise.allSettled([p1, p2, p3]),
      new Promise((_, rej) => setTimeout(() => rej(new Error('awaiters hung after clearAICache')), 1000)),
    ]);
    assert.equal(settled.length, 3);
    assert.equal(settled[1].status, 'fulfilled');
    assert.equal(settled[1].value.reason, 'ai-failed');
    assert.equal(settled[2].status, 'fulfilled');
    assert.equal(settled[2].value.reason, 'ai-failed');
    sm.mock.restore();
  });
});

describe('buildUserPrompt & stripBoilerplate (via callGateway)', () => {
  before(() => { installChromeMock(); });

  beforeEach(() => { clearAICache(); });

  test('strips URLs and EEO boilerplate before sending to gateway', async () => {
    let capturedPrompt = null;
    const sm = mock.method(chrome.runtime, 'sendMessage', (msg, cb) => {
      capturedPrompt = msg.body.messages[1].content;
      cb(mockReply(JSON.stringify(VALID_RESULT)));
    });
    const messy = 'Senior Frontend React TypeScript developer. Check https://example.com/jobs/123 for more. We are an Equal Opportunity Employer and EOE M/F/V/D. Real job content here.';
    await classifyWithAI(messy, 'hp1', PROFILE, '', AI_CONFIG);
    assert.ok(!capturedPrompt.includes('https://example.com'), 'URL should be stripped');
    assert.ok(!/equal opportunity/i.test(capturedPrompt), 'EEO boilerplate should be stripped');
    assert.ok(capturedPrompt.includes('Real job content here.'));
    sm.mock.restore();
  });

  test('truncates descriptions longer than MAX_DESCRIPTION_CHARS (6000)', async () => {
    let capturedPrompt = null;
    const sm = mock.method(chrome.runtime, 'sendMessage', (msg, cb) => {
      capturedPrompt = msg.body.messages[1].content;
      cb(mockReply(JSON.stringify(VALID_RESULT)));
    });
    const long = 'a'.repeat(7000);
    await classifyWithAI(long, 'hp2', PROFILE, '', AI_CONFIG);
    assert.ok(capturedPrompt.includes('...[truncated]...'), 'truncation marker should be present');
    const descMatch = capturedPrompt.match(/Job description \(extract ALL field values from this section ONLY\):\n([\s\S]*?)\n\n/);
    assert.ok(descMatch[1].length < 7000, 'description section should be truncated');
    assert.ok(descMatch[1].length > 4000, 'description section should keep head+tail');
    sm.mock.restore();
  });
});
