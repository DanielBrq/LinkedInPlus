import { test, describe, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeMock } from './helpers/mock-chrome.mjs';

const { classifyWithAI, clearAICache } = await import('../lib/aiFilter.js');
const config = { apiKey: 'secret', model: 'provider/model' };

describe('classifyWithAI', () => {
  let send;
  before(() => installChromeMock());
  beforeEach(() => {
    clearAICache();
    send = mock.method(chrome.runtime, 'sendMessage', (_message, callback) => {
      callback({ ok: true, score: 81 });
    });
  });

  test('returns a validated score and caches identical post classifications', async () => {
    const first = await classifyWithAI('post text', 'hash-1', 'Frontend developer', 'No agencies', config);
    const second = await classifyWithAI('post text', 'hash-1', 'Frontend developer', 'No agencies', config);
    assert.equal(first.fitScore, 81);
    assert.equal(second.cached, true);
    assert.equal(send.mock.callCount(), 1);
  });

  test('sends both positive and negative preferences but never the API key', async () => {
    let request;
    send.mock.mockImplementation((message, callback) => {
      request = message;
      callback({ ok: true, score: 65 });
    });
    await classifyWithAI('post text', 'hash-2', 'Angular roles', 'No onsite', config);
    assert.match(request.prompt, /Angular roles/);
    assert.match(request.prompt, /No onsite/);
    assert.equal(request.model, config.model);
    assert.equal(JSON.stringify(request).includes(config.apiKey), false);
  });

  test('leaves invalid or unavailable results as failures', async () => {
    send.mock.mockImplementation((_message, callback) => callback({ ok: true, score: 'high' }));
    assert.equal((await classifyWithAI('post', 'hash-3', 'jobs', '', config)).reason, 'ai-failed');
    assert.equal((await classifyWithAI('post', 'hash-4', '', '', config)).reason, 'ai-unavailable');
  });

  test('clamps numeric scores to 0–100', async () => {
    send.mock.mockImplementation((_message, callback) => callback({ ok: true, score: 140 }));
    assert.equal((await classifyWithAI('post', 'hash-5', 'jobs', '', config)).fitScore, 100);
  });
});
