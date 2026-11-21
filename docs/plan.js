// loadshift: plan a flexible industrial load on day-ahead prices.
// Prices are [{ t: unix seconds, eur: EUR per MWh }] in 15-minute slots.

export const SLOT_H = 0.25;

/** Cost in EUR of running `mw` during the given slots. */
export function costOf(slots, mw) {
  return slots.reduce((sum, p) => sum + p.eur * mw * SLOT_H, 0);
}

/** The cheapest run of `n` consecutive slots (sliding window). */
export function cheapestBlock(slots, n) {
  let sum = 0, best = Infinity, bestStart = 0;
  for (let i = 0; i < slots.length; i++) {
    sum += slots[i].eur;
    if (i >= n) sum -= slots[i - n].eur;
    if (i >= n - 1 && sum < best) { best = sum; bestStart = i - n + 1; }
  }
  return slots.slice(bestStart, bestStart + n);
}

/** The `n` cheapest slots, in time order (the load can pause and resume). */
export function cheapestSlots(slots, n) {
  return [...slots].sort((a, b) => a.eur - b.eur || a.t - b.t).slice(0, n).sort((a, b) => a.t - b.t);
}

/** Slots must follow each other with no gap, or the window has holes in the data. */
function hasGaps(slots) {
  return slots.some((p, i) => i > 0 && p.t - slots[i - 1].t !== 900);
}

/**
 * Plan a load of `mw` that needs `hours` of running between `from` and `to` (unix seconds).
 * Returns { ok:false, reason } when the data cannot support a plan, instead of guessing.
 */
export function plan(prices, { mw, hours, from, to, contiguous }) {
  const n = Math.round(hours / SLOT_H);
  if (!(mw > 0) || !(n > 0)) return { ok: false, reason: 'Power and run time must be above zero.' };
  const window = prices.filter((p) => p.t >= from && p.t < to);
  const neededSlots = Math.round((to - from) / 900);
  if (window.length < neededSlots) {
    const last = prices.length ? prices[prices.length - 1].t + 900 : from;
    return { ok: false, reason: `Prices are only published up to ${fmt(last)}. Shorten the window or wait for the next auction (about 13:00 the day before).` };
  }
  if (hasGaps(window)) return { ok: false, reason: 'The price data has gaps in this window.' };
  if (window.length < n) return { ok: false, reason: `The window is ${window.length / 4} h long but the load needs ${hours} h.` };
  const chosen = contiguous ? cheapestBlock(window, n) : cheapestSlots(window, n);
  const baseline = window.slice(0, n);
  const cost = costOf(chosen, mw), baseCost = costOf(baseline, mw);
  return { ok: true, n, chosen, baseline, cost, baseCost, saving: baseCost - cost, window };
}

/** Group chosen slots into runs like 02:00-05:30 for the explanation. */
export function runs(slots) {
  const out = [];
  for (const p of slots) {
    const r = out[out.length - 1];
    if (r && p.t === r.end) r.end = p.t + 900; else out.push({ start: p.t, end: p.t + 900 });
  }
  return out;
}

export function fmt(t) {
  return new Date(t * 1000).toLocaleString('en-GB', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

/** A plain-language explanation a site operator can check. */
export function explain(r, mw) {
  if (!r.ok) return [r.reason];
  const avg = (s) => s.reduce((a, p) => a + p.eur, 0) / s.length;
  const peak = r.window.reduce((a, p) => (p.eur > a.eur ? p : a));
  const lines = [
    `Run ${runs(r.chosen).map((x) => `${fmt(x.start)} to ${fmt(x.end).split(' ')[1]}`).join(', ')}, at an average of ${avg(r.chosen).toFixed(0)} €/MWh.`,
    `Starting as early as allowed would average ${avg(r.baseline).toFixed(0)} €/MWh. The plan saves ${eur(r.saving)} (${pct(r.saving, r.baseCost)}) on ${(mw * r.n * SLOT_H).toFixed(1)} MWh.`,
    `It avoids the window's peak of ${peak.eur.toFixed(0)} €/MWh at ${fmt(peak.t)}.`,
  ];
  if (r.chosen.some((p) => p.eur < 0)) lines.push('Some chosen slots have negative prices: the site is paid to use power then.');
  if (r.saving < 1) lines.push('Shifting saves almost nothing here, so there is no reason to move the load.');
  return lines;
}

const eur = (x) => `${x < 0 ? '-' : ''}€${Math.abs(x).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
const pct = (a, b) => (b > 0 ? `${((100 * a) / b).toFixed(0)}%` : 'n/a');
