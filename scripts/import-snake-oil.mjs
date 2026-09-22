#!/usr/bin/env node
/**
 * Reproducible import: fetches the public Snake Oil Google Sheet as CSV and
 * writes the validated development fixture used by the Snake Oil example.
 *
 * This script is a one-off development tool. The application itself never
 * calls Google Sheets at runtime — see src/fixtures/snake-oil/README.md.
 *
 * Usage:
 *   node scripts/import-snake-oil.mjs
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SHEET_ID = '1VqJQ_C_R0OziW7m2wtdYz2-8n4_4xxyFRypzmo8iLN8'
const SOURCE_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`

const OUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'fixtures',
  'snake-oil',
  'snake-oil.csv',
)

// Clean, self-documenting header names for the fixture. The public sheet's
// own first row uses these same machine keys; its second row (skipped, see
// below) holds human-readable descriptions of each column, and two columns
// have no header at all in the source sheet — named here from that
// description row ("notes long" and "source names").
const FIXTURE_HEADER = [
  'name',
  'alternativename',
  'primaryvalue',
  'subcategory',
  'category',
  'type',
  'highlight',
  'metric_001',
  'searchterm',
  'notes',
  'notesLong',
  'sourceNames',
  'link',
  'firstsource',
  'secondsource',
  'thirdsource',
  'ID',
]

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

function toCsvField(value) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function toCsvRow(fields) {
  return fields.map(toCsvField).join(',')
}

async function main() {
  console.log(`Fetching ${SOURCE_URL}`)
  const response = await fetch(SOURCE_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch Snake Oil sheet: ${response.status} ${response.statusText}`)
  }
  const csvText = await response.text()
  const rows = parseCsv(csvText)

  // The sheet has three leading metadata rows before real data begins:
  //   0: machine-readable field keys (our header)
  //   1: human-readable field descriptions
  //   2: a scoring-legend note that happens to live in the primaryvalue column
  // Retrieved 2026-09-16; verified by inspecting the raw export directly.
  const dataRows = rows.slice(3).filter((row) => row.some((cell) => cell.trim() !== ''))

  console.log(`Parsed ${dataRows.length} data rows (excluding the 3 header/description rows).`)

  const outLines = [toCsvRow(FIXTURE_HEADER), ...dataRows.map(toCsvRow)]
  writeFileSync(OUT_PATH, outLines.join('\n') + '\n', 'utf-8')
  console.log(`Wrote fixture to ${OUT_PATH}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
