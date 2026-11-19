import { test, describe, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeMock } from './helpers/mock-chrome.mjs';

const config = { apiKey: 'k', model: 'provider/model', filters: 'developer', negativeFilters: '', threshold: 65 };
const context = { aiConfig: config };
const selector = '[role="listitem"]';

function makeContainer(description) {
  const listitem = {
    style: {},
    classList: { add() {}, remove() {} },
    closest: () => null,
    querySelectorAll: () => [],
  };
  const text = { innerText: description, textContent: description, parentElement: { querySelector: () => null } };
  const container = {
    closest: sel => sel === selector ? listitem : null,
    querySelector: sel => sel.includes('expandable-text-box') ? text : null,
    matches: () => false,
  };
  return { container, listitem };
}

describe('processContainer', () => {
  let pipeline, aiFilter, send;
  before(async () => {
    installChromeMock();
    pipeline = await import('../lib/pipeline.js');
    aiFilter = await import('../lib/aiFilter.js');
  });
  beforeEach(() => {
    aiFilter.clearAICache();
    pipeline.clearProcessedHashes();
    send = mock.method(chrome.runtime, 'sendMessage', (_message, callback) => {
      callback({ ok: true, score: 80 });
    });
  });

  test('hides prefiltered posts without calling the model', async () => {
    const { container, listitem } = makeContainer('#OpenToWork looking for new opportunities, ' + 'x'.repeat(150));
    await pipeline.processContainer(container, context);
    assert.equal(listitem.style.display, 'none');
    assert.equal(send.mock.callCount(), 0);
  });

  test('hides scores below the configured threshold with display:none', async () => {
    send.mock.mockImplementation((_message, callback) => callback({ ok: true, score: 64 }));
    const { container, listitem } = makeContainer('x'.repeat(160));
    await pipeline.processContainer(container, context);
    assert.equal(listitem.style.display, 'none');
  });

  test('leaves scores equal to or above the threshold visible', async () => {
    const { container, listitem } = makeContainer('x'.repeat(160));
    await pipeline.processContainer(container, context);
    assert.equal(listitem.style.display, undefined);
  });

  test('keeps posts visible when Gateway classification fails', async () => {
    send.mock.mockImplementation((_message, callback) => callback({ ok: false, error: 'gateway unavailable' }));
    const { container, listitem } = makeContainer('x'.repeat(160));
    await pipeline.processContainer(container, context);
    assert.equal(listitem.style.display, undefined);
  });

  test('does not send the same post twice in one session', async () => {
    const { container } = makeContainer('x'.repeat(160));
    await pipeline.processContainer(container, context);
    await pipeline.processContainer(container, context);
    assert.equal(send.mock.callCount(), 1);
  });
});
