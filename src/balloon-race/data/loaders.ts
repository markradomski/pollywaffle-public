/**
 * Generic, dataset-agnostic loading helpers. These know nothing about
 * Snake Oil, Pollywaffle, or any other source — they just turn raw text
 * into plain row objects that a dataset's own adapter can then map.
 */

/** Minimal CSV parser: handles quoted fields, escaped quotes, and commas. */
export function parseCsv(csvText: string): Record<string, string>[] {
  const rows = splitCsvRows(csvText)
  if (rows.length === 0) return []

  const [header, ...body] = rows
  return body
    .filter((row) => row.some((cell) => cell.trim() !== ''))
    .map((row) => {
      const record: Record<string, string> = {}
      header.forEach((key, index) => {
        record[key.trim()] = (row[index] ?? '').trim()
      })
      return record
    })
}

function splitCsvRows(csvText: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    const next = csvText[i + 1]

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

/** Fetches a text resource (e.g. a CSV fixture served from /fixtures). */
export async function loadTextResource(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load resource at ${url}: ${response.status} ${response.statusText}`)
  }
  return response.text()
}

export async function loadCsvResource(url: string): Promise<Record<string, string>[]> {
  const text = await loadTextResource(url)
  return parseCsv(text)
}
