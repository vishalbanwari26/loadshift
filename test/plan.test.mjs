import test from 'node:test';
import assert from 'node:assert/strict';
import { plan, cheapestBlock, cheapestSlots, runs, explain } from '../docs/plan.js';

const T0 = 1_800_000_000 - (1_800_000_000 % 900);
const series = (eurs) => eurs.map((eur, i) => ({ t: T0 + i * 900, eur }));

test('cheapest block finds the lowest consecutive run', () => {
  const s = series([50, 40, 10, 20, 90, 5, 80]);
  assert.deepEqual(cheapestBlock(s, 2).map((p) => p.eur), [10, 20]);
});

test('cheapest slots may be split and come back in time order', () => {
  const s = series([50, 40, 10, 20, 90, 5, 80]);
  assert.deepEqual(cheapestSlots(s, 2).map((p) => p.eur), [10, 5]);
});

test('plan saves money against starting as early as allowed', () => {
  const s = series([100, 100, 10, 10, 100]);
  const r = plan(s, { mw: 2, hours: 0.5, from: T0, to: T0 + 5 * 900, contiguous: true });
  assert.equal(r.ok, true);
  assert.equal(r.cost, 10 * 2 * 0.25 * 2);
  assert.equal(r.baseCost, 100 * 2 * 0.25 * 2);
});

test('refuses to plan past the last published price', () => {
  const s = series([10, 10, 10, 10]);
  const r = plan(s, { mw: 1, hours: 0.5, from: T0, to: T0 + 8 * 900, contiguous: true });
  assert.equal(r.ok, false);
  assert.match(r.reason, /only published up to/);
});

test('refuses a window shorter than the run time', () => {
  const s = series([10, 10, 10, 10]);
  const r = plan(s, { mw: 1, hours: 2, from: T0, to: T0 + 4 * 900, contiguous: false });
  assert.equal(r.ok, false);
  assert.match(r.reason, /needs 2 h/);
});

test('refuses data with holes', () => {
  const s = series([10, 10, 10, 10]); s.splice(2, 1);
  const r = plan(s, { mw: 1, hours: 0.25, from: T0, to: T0 + 3 * 900, contiguous: false });
  assert.equal(r.ok, false);
});

test('runs merge neighbouring slots', () => {
  const s = series([1, 1, 9, 1]);
  assert.equal(runs([s[0], s[1], s[3]]).length, 2);
});

test('explanation says when shifting is pointless', () => {
  const s = series([10, 10, 10, 10]);
  const r = plan(s, { mw: 1, hours: 0.5, from: T0, to: T0 + 4 * 900, contiguous: true });
  assert.ok(explain(r, 1).some((l) => l.includes('no reason to move')));
});
