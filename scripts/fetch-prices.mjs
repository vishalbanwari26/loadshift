// Fetch German day-ahead prices (today and tomorrow, Europe/Berlin) into docs/prices.json.
// Data: Bundesnetzagentur | SMARD.de via api.energy-charts.info, CC BY 4.0.
import { writeFileSync } from 'node:fs';

const day = (offset) => new Date(Date.now() + offset * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
const url = `https://api.energy-charts.info/price?bzn=DE-LU&start=${day(0)}&end=${day(1)}`;
const res = await fetch(url);
if (!res.ok) throw new Error(`${res.status} from ${url}`);
const d = await res.json();
const prices = d.unix_seconds.map((t, i) => ({ t, eur: d.price[i] })).filter((p) => p.eur !== null);
if (prices.length < 96) throw new Error(`only ${prices.length} prices, keeping the old file`);
writeFileSync(new URL('../docs/prices.json', import.meta.url), JSON.stringify({
  zone: 'DE-LU', unit: d.unit, fetchedAt: new Date().toISOString(), license: d.license_info, prices,
}));
console.log(`wrote ${prices.length} prices, last slot ${new Date(prices.at(-1).t * 1000).toISOString()}`);
