#!/usr/bin/env node
/**
 * Reproducible import: fetches the public Pollywaffle dataset (the same
 * data.json the live https://markradomski.github.io/app/data-viz/pollywaffle/
 * VizSweet Balloon Race embed reads from) and writes the validated
 * development fixture used by the Pollywaffle example.
 *
 * This script is a one-off development tool. The application itself never
 * calls this endpoint at runtime — see src/fixtures/pollywaffle/pollywaffle-2017-README.md.
 *
 * Usage:
 *   node scripts/import-pollywaffle.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SOURCE_URL =
  "https://markradomski.github.io/app/data-viz/pollywaffle/assets/data/data.json";

const OUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "fixtures",
  "pollywaffle",
  "pollywaffle-2025.csv",
);

// Clean fixture header. The source JSON's own field names (primaryvalue,
// metric_001, ...) are the VizSweet Balloon Race template's generic column
// names, shared with Snake Oil's own source sheet — kept as-is here rather
// than renamed, since that's genuinely what the source calls them.
const FIXTURE_HEADER = [
  "id",
  "name",
  "primaryvalue",
  "category",
  "type",
  "metric_001",
];

function toCsvField(value) {
  const str = String(value ?? "");
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields) {
  return fields.map(toCsvField).join(",");
}

async function main() {
  console.log(`Fetching ${SOURCE_URL}`);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Pollywaffle data: ${response.status} ${response.statusText}`,
    );
  }
  const rows = await response.json();

  // The JSON has two leading metadata rows before real data begins (same
  // shape as Snake Oil's sheet): row 0 is the machine-readable field-key
  // header, row 1 is human-readable field descriptions. Retrieved and
  // verified by inspecting the raw endpoint directly.
  const dataRows = rows.slice(2);

  console.log(
    `Parsed ${dataRows.length} data rows (excluding the 2 header/description rows).`,
  );

  const outLines = [
    toCsvRow(FIXTURE_HEADER),
    ...dataRows.map((r) =>
      toCsvRow([
        r.id,
        r.name,
        r.primaryvalue,
        r.category,
        r.type,
        r.metric_001,
      ]),
    ),
  ];
  writeFileSync(OUT_PATH, outLines.join("\n") + "\n", "utf-8");
  console.log(`Wrote fixture to ${OUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
