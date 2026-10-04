import test from 'node:test';
import assert from 'node:assert/strict';
import { EventHub, History, Settings, tokenize } from '../dist/packages/core/src/index.js';
import { CalculatorModel } from '../dist/packages/accessories/src/calculator.js';
import { floodFill } from '../dist/packages/accessories/src/paint.js';
import { encodeMessage, decodeMessage } from '../dist/packages/internet/src/mime.js';

test('EventHub unsubscribe is idempotent and does not detach replacement listeners', () => {
  const events = new EventHub();
  let count = 0;
  const off = events.on('a', () => count++);
  off();
  events.on('a', () => (count += 10));
  off();
  events.emit('a');
  assert.equal(count, 10);
  const life = new AbortController();
  events.on('b', () => count++, { signal: life.signal });
  life.abort();
  events.emit('b');
  assert.equal(count, 10);
});
test('History supports undo/redo and clears the redo branch after an edit', () => {
  const history = new History(2);
  history.push(1);
  history.push(2);
  history.push(3);
  assert.equal(history.undo(4), 3);
  assert.equal(history.redo(3), 4);
  assert.equal(history.undo(4), 3);
  history.push(5);
  assert.equal(history.redo(6), undefined);
  assert.deepEqual(history.past, [2, 5]);
});
test('Settings remains usable when browser storage is denied', () => {
  const settings = new Settings({
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('quota');
    },
  });
  settings.set('volume', 22);
  assert.equal(settings.get('volume'), 22);
  assert.equal(settings.persistenceError.message, 'quota');
  assert.deepEqual(tokenize('notepad "C:\\My Documents\\hello.txt"'), [
    'notepad',
    'C:\\My Documents\\hello.txt',
  ]);
});
const calculate = (sequence) => {
  const calc = new CalculatorModel();
  for (const key of sequence) calc.press(key);
  return calc;
};
test('Calculator evaluates immediately, repeats equals and keeps decimal precision useful', () => {
  assert.equal(calculate(['2', '+', '3', '*', '4', '=']).display, '20');
  assert.equal(calculate(['2', '+', '3', '=', '=']).display, '8');
  assert.equal(calculate(['0', '.', '1', '+', '0', '.', '2', '=']).display, '0.3');
  assert.equal(calculate(['2', '0', '0', '+', '1', '0', '%', '=']).display, '220');
});
test('Calculator handles entry clearing, memory, errors and recovery', () => {
  assert.equal(calculate(['9', '+', '7', 'CE', '2', '=']).display, '11');
  assert.equal(calculate(['4', 'MS', 'C', 'MR', '*', '2', '=']).display, '8');
  const calc = calculate(['1', '/', '0', '=']);
  assert.equal(calc.error, true);
  calc.press('2');
  assert.equal(calc.display, '2');
});
test('Flood fill stays within a connected region and preserves boundaries', () => {
  const width = 5,
    height = 4,
    data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 0; y < height; y++) data.set([0, 0, 0, 255], (y * width + 2) * 4);
  floodFill({ width, height, data }, 0, 0, [255, 0, 0, 255]);
  assert.deepEqual([...data.slice(0, 4)], [255, 0, 0, 255]);
  assert.deepEqual([...data.slice(8, 12)], [0, 0, 0, 255]);
  assert.deepEqual([...data.slice(12, 16)], [255, 255, 255, 255]);
});
test('MIME round-trips Unicode, CRLF and binary attachments', () => {
  const bytes = new Uint8Array([0, 255, 7, 13, 10, 128, 42]),
    message = {
      from: 'me@example.test',
      to: 'you@example.test',
      subject: 'Zażółć gęślą — 🎵',
      date: 1700000000000,
      body: 'First\r\nDruga linia ✓\nThird',
      attachments: [{ name: 'dźwięk.bin', bytes, mime: 'application/octet-stream' }],
    };
  const raw = encodeMessage(message),
    result = decodeMessage(raw);
  assert.equal(result.subject, message.subject);
  assert.equal(result.body, 'First\nDruga linia ✓\nThird');
  assert.equal(result.attachments[0].name, 'dźwięk.bin');
  assert.deepEqual(result.attachments[0].bytes, bytes);
  assert.equal(result.date, message.date);
  assert.throws(
    () => encodeMessage({ ...message, attachments: [{ name: 'missing.dat' }] }),
    /missing/i,
  );
});
test('MIME decodes quoted-printable and folded headers', () => {
  const decoded = decodeMessage(
    'Subject: A long\r\n subject\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nCaf=C3=A9=\r\n!',
  );
  assert.equal(decoded.subject, 'A long subject');
  assert.equal(decoded.body, 'Café!');
});
