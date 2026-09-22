# Snake Oil fixture

Local, offline development fixture for the Snake Oil reference dataset.

## Provenance

- **Source URL:** https://docs.google.com/spreadsheets/d/1VqJQ_C_R0OziW7m2wtdYz2-8n4_4xxyFRypzmo8iLN8/edit
- **Retrieved:** 2026-09-16, via the sheet's public CSV export endpoint
  (`.../export?format=csv`).
- **Import mechanism:** [`scripts/import-snake-oil.mjs`](../../../scripts/import-snake-oil.mjs).
  Re-run with:

  ```bash
  node scripts/import-snake-oil.mjs
  ```

  This is a one-off development tool, run manually when the fixture needs
  refreshing. The application itself (the Snake Oil example, the Balloon
  Race engine) never talks to Google Sheets at runtime — it only ever reads
  this committed CSV file.

## Transformation performed

The raw sheet export has three leading metadata rows before real data
begins:

1. machine-readable field keys (`name`, `primaryvalue`, `metric_001`, …)
2. human-readable field descriptions (e.g. "google hits (used to scale the
   bubbles)")
3. a scoring-legend note that (in the source sheet) happens to sit in the
   `primaryvalue` column of what looks like a row, rather than being a real
   record. Its exact text, verified directly against the live source
   (re-fetched 2026-09-16 during Phase 2.2, matching the original Phase 0
   retrieval): **"our score. 0 = harmful 1 = no evidence, 2 = slight, 3 =
   conflicting/moderate, 4 = promising , 5 = good, 6 = strong"**. This is
   the authoritative basis for `snakeOilAxisTickFormatter`'s evidence-score
   labels (see `src/examples/snake-oil/snakeOilAxis.ts`) — it is not
   otherwise preserved anywhere in the committed fixture, since the row
   itself is dropped as metadata.

The import script:

- drops those three rows
- keeps every remaining row as-is — **no values are corrected, guessed, or
  fabricated**
- writes a clean CSV header. Two source columns had no header at all in the
  raw export (visible only in row 2's description text); the script names
  them `notesLong` and `sourceNames` based on those descriptions.

## Fields retained

All 17 source columns are retained in the fixture:
`name, alternativename, primaryvalue, subcategory, category, type,
highlight, metric_001, searchterm, notes, notesLong, sourceNames, link,
firstsource, secondsource, thirdsource, ID`.

## Fields discarded

None. Nothing from the source rows is dropped by the import script itself.
(The adapter, [`snakeOilAdapter.ts`](../../examples/snake-oil/snakeOilAdapter.ts),
chooses which of these fields become first-class `BalloonDatum` fields vs.
`metadata` — see that file and its schema for the mapping.)

## Parsing assumptions

- The sheet uses standard CSV quoting (RFC 4180-style): fields containing
  commas, quotes, or newlines are double-quoted, with `""` as an escaped
  quote. Several `notes`/`sourceNames` fields contain embedded newlines.
- `primaryvalue` and `metric_001` are otherwise-numeric strings but
  `metric_001` uses thousands separators (e.g. `"87,500"`) — parsed by the
  adapter/schema, not by this import step.
- `ID` is expected to be a unique per-row identifier. As retrieved, **3 of
  192 data rows have a blank `ID`** (`borage seed oil` / evening primrose
  oil is present twice under a fresh row; `mistletoe`). These are left in
  the fixture untouched — they exist to exercise the validation layer (see
  `snakeOilSchema.ts`), not silently dropped or invented.
- One supplement can legitimately appear on multiple rows (once per
  condition/claim it's evaluated against) — this is intentional source
  behaviour, not a duplication bug. Each row keeps its own `ID` value from
  the source sheet, and the Balloon Race engine's `normalizeData` treats
  identity as per-row (via `snakeOilAdapter.ts`'s `id: (r) => r.ID`
  mapping), not per-supplement, so multiple rows for the same supplement
  become separate balloons rather than colliding or overwriting each
  other.

## Do not

Do not edit `snake-oil.csv` by hand to "fix" bad rows. If the fixture needs
a genuine refresh, re-run the import script and re-review this document.
