import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText } from '../lib/parser.js';

describe('normalizeText', () => {
  test('returns empty string for null/undefined/empty', () => {
    assert.equal(normalizeText(''), '');
    assert.equal(normalizeText(null), '');
    assert.equal(normalizeText(undefined), '');
  });

  test('lowercases input', () => {
    assert.equal(normalizeText('Hello WORLD'), 'hello world');
  });

  test('removes zero-width characters (\\u200B–\\u200D, \\uFEFF)', () => {
    assert.equal(normalizeText('hel\u200Blo\u200C wo\u200Drl\uFEFFd'), 'hello world');
  });

  test('replaces control characters with space (then collapsed with adjacent whitespace)', () => {
    assert.equal(normalizeText('hello\x00\x01world'), 'hello world');
    assert.equal(normalizeText('a\x7Fb'), 'a b');
  });

  test('collapses multiple whitespace into a single space', () => {
    assert.equal(normalizeText('a   b\n\nc\td'), 'a b c d');
    assert.equal(normalizeText('   leading and trailing   '), 'leading and trailing');
  });

  test('combined: uppercase + zero-width + control + whitespace', () => {
    assert.equal(normalizeText('  HEL\u200BLO\x01 WORLD\x7F!  '), 'hello world !');
  });
});
