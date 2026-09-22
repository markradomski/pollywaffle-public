# Pollywaffle 2017 fixture (preserved reference)

This documents `pollywaffle-2017.csv` specifically — the original 2017-era
snapshot, currently disabled in the app (not removed) — not the active
2025 edition. See `pollywaffle-2025-README.md` for the dataset the app
actually renders by default.

Local, offline development fixture for the Pollywaffle (Australian federal
politician declared property ownership) dataset.

## Provenance

- **Source URL:** https://markradomski.github.io/app/data-viz/pollywaffle/assets/data/data.json
  — the same data file the live "Smashed Avocado on Toast Property Price
  Index" VizSweet Balloon Race embed at
  https://markradomski.github.io/app/data-viz/pollywaffle/ reads from
  (visible by inspecting that page's `<iframe>` and its own network
  requests). That page's own config
  (https://markradomski.github.io/app/data-viz/pollywaffle/assets/data/config.json)
  documents the underlying calculation and cites its sources: ABC News
  (https://www.abc.net.au/news/2017-04-20/australian-politician-property-ownership-details/8453782)
  and Bernard Salt via The Australian.
- **Retrieved:** 2026-09-18, via the endpoint's own public JSON response.
- **Import mechanism:** [`scripts/import-pollywaffle.mjs`](../../../scripts/import-pollywaffle.mjs).
  Re-run with:

  ```bash
  node scripts/import-pollywaffle.mjs
  ```

  This is a one-off development tool, run manually when the fixture needs
  refreshing. The application itself (the Pollywaffle example, the Balloon
  Race engine) never talks to this endpoint at runtime — it only ever reads
  this committed CSV file.

## What's in the source, and what isn't

The source JSON uses the same generic VizSweet Balloon Race template field
names as Snake Oil's own source sheet (`primaryvalue`, `metric_001`, …) —
both datasets were built on the same underlying tool.

Per politician, the source provides: name, declared property count
(`primaryvalue`), a comma-separated list of declared property types
(`category`, e.g. "residential, investment"), political party (`type`), and
a pre-computed combined property value in AUD (`metric_001` — declared
property count × the site's stated median house price, $656,800).

The source does **not** provide, for individual politicians: electorate,
state, chamber, per-record source links, or notes. This fixture does not
invent placeholder values for any of these — the Pollywaffle adapter simply
omits fields the source doesn't have (see
[`snakeOilAdapter.ts`](../../examples/snake-oil/snakeOilAdapter.ts)'s
sibling, `pollywaffleAdapter.ts`). Provenance for the dataset as a whole
(not per-record) is shown at the application level, sourced from the
config.json citations above.

One row (`COLLINS, Julie`) has a blank `primaryvalue`/`id` in the source
itself — kept as-is (not repaired or dropped here) so the same
validate-and-report pattern Snake Oil uses surfaces it as a rejected row
rather than silently guessing a property count.

## Transformation performed

The raw JSON response has two leading metadata rows before real data
begins (row 0: machine-readable field keys: row 1: human-readable field
descriptions) — both skipped. Six columns are kept
(`id, name, primaryvalue, category, type, metric_001`); the source's
`alternativename`/`subcategory` columns are dropped because they're exact
duplicates of `category` and a pre-formatted derivative of `metric_001`
respectively (the adapter recomputes the "years of smashed avo" figure
itself from `metric_001`, using the same $22/day, 365-day-year constants
the source's own `config.json` states — verified to reproduce the source's
own pre-formatted `subcategory` text exactly for every sampled row). The
always-empty `notes`/`highlight`/`firstsource`/`secondsource`/`thirdsource`
columns are also dropped.
