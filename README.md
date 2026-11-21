# loadshift

When should a flexible industrial load run on German day-ahead electricity prices? Pick a load (power, run time, earliest start, deadline, one block or not) and loadshift finds the cheapest slots, compares them with starting right away, and explains the plan in plain words. When the data cannot support a plan, it says why instead of guessing: prices not yet published for part of the window, gaps in the data, or a window shorter than the run time.

**Live:** [vishalbanwari.tech/loadshift](https://vishalbanwari.tech/loadshift/)

Built in about 30 minutes with Claude Code, as a small exercise.

## How it works

- Prices: DE-LU day-ahead, 15-minute slots, from Bundesnetzagentur | SMARD.de via the Energy-Charts API (CC BY 4.0). A GitHub Action fetches today and tomorrow every day after the auction and commits `docs/prices.json`.
- [`docs/plan.js`](docs/plan.js): the cheapest block of consecutive slots (sliding window) for a load that must run in one go, or the cheapest slots in any order for a load that can pause, like a cold store. The baseline is starting as early as allowed.
- The page is plain HTML and a module, no build step.

`npm test` runs the unit tests (Node's test runner). `npm run prices` fetches fresh prices.

## Limits

- Day-ahead energy price only. Grid fees, taxes, peak-load charges, ramp limits and the process itself (minimum run and pause times, storage levels) are left out, and in a real plant they often decide the answer.
- One price zone, one load, no forecast beyond the published prices.

MIT licence.
