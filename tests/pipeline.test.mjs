import { test, describe, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeMock } from './helpers/mock-chrome.mjs';

const VALID_RESULT = {
  relevant: true, fitScore: 88, title: 'X', description: 'd', location: 'CR',
  modality: 'remote', englishLevel: 'intermediate', technologies: ['js'],
  posterName: 'P', companyName: 'C', applicationEmail: null, applicationLink: null,
};

const CTX = {
  displayConfig: { debugMode: false, hideDelay: 0 },
  notInterestedEnabled: false,
  saveMatchesEnabled: true,
  hideNonRelevantEnabled: true,
  aiConfig: { filters: 'profile', negativeFilters: '', apiKey: 'k' },
};

const NEG_POST = '[role="listitem"]';

function makeContainer(description) {
  const listitem = { classList: { add: () => {}, remove: () => {} }, style: {}, closest: () => null };
  const descEl = {
    innerText: description,
    textContent: description,
    parentElement: { querySelector: () => null },
  };
  const c = {
    closest: (sel) => sel === NEG_POST ? listitem : null,
    querySelector: (sel) => {
      if (sel.includes('expandable-text-box')) return descEl;
      if (sel === 'button[aria-label*="Open control menu"]') return null;
      return null;
    },
    matches: () => false,
  };
  return { container: c, listitem };
}

function aiReply(content) {
  return { ok: true, status: 200, data: { choices: [{ message: { content } }] }, error: null };
}

let sendMock, pipeline, storage, aiFilter, parser;

describe('processContainer - early exits', () => {
  before(async () => {
    installChromeMock();
    pipeline = await import('../lib/pipeline.js');
    storage = await import('../lib/storage.js');
    aiFilter = await import('../lib/aiFilter.js');
    parser = await import('../lib/parser.js');
  });

  beforeEach(() => {
    aiFilter.clearAICache();
    storage.clearSavedJobs();
    sendMock = mock.method(chrome.runtime, 'sendMessage', (_msg, cb) => cb(aiReply(JSON.stringify(VALID_RESULT))));
  });

  test('null container → returns immediately', async () => {
    await pipeline.processContainer(null, CTX);
    assert.ok(true);
  });

  test('no description found → returns without AI call', async () => {
    let calls = 0;
    sendMock.mock.mockImplementation((_msg, cb) => { calls++; cb(aiReply('{}')); });
    const c = { closest: () => null, querySelector: () => null };
    await pipeline.processContainer(c, CTX);
    assert.equal(calls, 0);
  });

  test('negative pre-filter (#opentowork) hides without calling AI', async () => {
    let calls = 0;
    sendMock.mock.mockImplementation((_msg, cb) => { calls++; cb(aiReply('{}')); });
    const { container, listitem } = makeContainer('#OpenToWork looking for new opportunities, 5y React dev');
    await pipeline.processContainer(container, CTX);
    assert.equal(calls, 0, 'AI should not be called for #opentowork');
    assert.equal(listitem.style.display, 'none', 'post should be hidden');
  });

  test('engagement bait (like this post) hides without calling AI', async () => {
    let calls = 0;
    sendMock.mock.mockImplementation((_msg, cb) => { calls++; cb(aiReply('{}')); });
    const { container, listitem } = makeContainer('Like this post if you agree! comment below with your thoughts');
    await pipeline.processContainer(container, CTX);
    assert.equal(calls, 0);
    assert.equal(listitem.style.display, 'none');
  });

  test('description shorter than MIN_DESCRIPTION_LENGTH (100) hides without calling AI', async () => {
    let calls = 0;
    sendMock.mock.mockImplementation((_msg, cb) => { calls++; cb(aiReply('{}')); });
    const { container, listitem } = makeContainer('short text only fifty chars here');
    await pipeline.processContainer(container, CTX);
    assert.equal(calls, 0);
    assert.equal(listitem.style.display, 'none');
  });
});

describe('processContainer - AI flow', () => {
  before(async () => {
    installChromeMock();
    pipeline = await import('../lib/pipeline.js');
    storage = await import('../lib/storage.js');
    aiFilter = await import('../lib/aiFilter.js');
  });

  beforeEach(() => {
    aiFilter.clearAICache();
    storage.clearSavedJobs();
    pipeline.clearProcessedHashes();
    sendMock = mock.method(chrome.runtime, 'sendMessage', (_msg, cb) => cb(aiReply(JSON.stringify(VALID_RESULT))));
  });

  test('relevant match → saves job and applies green outline', async () => {
    const longDesc = 'a'.repeat(150) + ' Senior Frontend Developer at Acme in San José, Costa Rica.';
    const { container, listitem } = makeContainer(longDesc);
    await pipeline.processContainer(container, CTX);
    const saved = await storage.getSavedJobs();
    assert.equal(saved.length, 1);
    assert.equal(saved[0].fitScore, 88);
    assert.ok(listitem.style.outline, 'relevant post should be outlined');
  });

  test('non-relevant match → hides post and does not save', async () => {
    const NONREL = { ...VALID_RESULT, relevant: false, fitScore: 10 };
    sendMock.mock.mockImplementation((_msg, cb) => cb(aiReply(JSON.stringify(NONREL))));
    const { container, listitem } = makeContainer('a'.repeat(150) + ' Some irrelevant post content here.');
    await pipeline.processContainer(container, CTX);
    const saved = await storage.getSavedJobs();
    assert.equal(saved.length, 0);
    assert.equal(listitem.style.display, 'none');
  });

  test('AI unavailable → post is left visible and nothing is saved', async () => {
    sendMock.mock.mockImplementation((_msg, cb) => cb({ ok: false, status: 502, data: null, error: 'bad gateway' }));
    const { container, listitem } = makeContainer('a'.repeat(150) + ' Some content that would normally be processed.');
    await pipeline.processContainer(container, CTX);
    assert.equal(listitem.style.display, undefined, 'post should remain visible');
    const saved = await storage.getSavedJobs();
    assert.equal(saved.length, 0);
  });

  test('session dedup → second call for same description skips AI and storage', async () => {
    let calls = 0;
    sendMock.mock.mockImplementation((_msg, cb) => { calls++; cb(aiReply(JSON.stringify(VALID_RESULT))); });
    const longDesc = 'a'.repeat(150) + ' dedup test job description content.';
    const { container } = makeContainer(longDesc);
    await pipeline.processContainer(container, CTX);
    await pipeline.processContainer(container, CTX);
    assert.equal(calls, 1, 'AI should be called only once for the same content');
    const saved = await storage.getSavedJobs();
    assert.equal(saved.length, 1);
  });

  test('storage dedup → already-saved job is not re-classified', async () => {
    let calls = 0;
    sendMock.mock.mockImplementation((_msg, cb) => { calls++; cb(aiReply(JSON.stringify(VALID_RESULT))); });
    pipeline.clearProcessedHashes();
    const longDesc = 'a'.repeat(150) + ' storage dedup test job content.';
    const { container } = makeContainer(longDesc);
    await pipeline.processContainer(container, CTX);
    pipeline.clearProcessedHashes();
    await pipeline.processContainer(container, CTX);
    assert.equal(calls, 1, 'AI should not be called again for an already-saved job');
  });
});
