/**
 * CSV Utilities
 *
 * Shared utilities for CSV generation with security protections.
 */

/**
 * Characters that can trigger formula execution in spreadsheet applications.
 * These are dangerous when they appear at the start of a cell value.
 */
const FORMULA_CHARS = ['=', '+', '-', '@', '|'];

/**
 * Escape a CSV cell value to handle commas, quotes, newlines, and prevent CSV injection.
 *
 * Security features:
 * - Quotes fields containing commas, quotes, or newlines
 * - Escapes embedded quotes by doubling them
 * - Prefixes formula-starting cells with a tab to prevent Excel formula injection
 *
 * @param field - The cell value to escape (undefined/null return empty string)
 * @returns The escaped CSV cell value
 */
export function escapeCSV(field: string | number | undefined | null): string {
  if (field === undefined || field === null) return '';
  const stringField = String(field);

  // Check if the field starts with a formula character
  const startsWithFormula = FORMULA_CHARS.some((char) => stringField.startsWith(char));

  // Determine if the field needs quoting
  const needsQuoting =
    stringField.includes(',') ||
    stringField.includes('"') ||
    stringField.includes('\n') ||
    startsWithFormula;

  if (needsQuoting) {
    // Escape embedded quotes by doubling them
    const escaped = stringField.replace(/"/g, '""');
    // Prefix with tab to prevent formula interpretation in Excel
    return startsWithFormula ? `"\t${escaped}"` : `"${escaped}"`;
  }

  return stringField;
}

/**
 * Convert an array of rows to CSV content.
 *
 * @param headers - The CSV header row
 * @param rows - Array of data rows, each row is an array of cell values
 * @returns The complete CSV content as a string
 */
export function toCSV(headers: string[], rows: (string | number)[][]): string {
  return [
    headers.map(escapeCSV).join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ].join('\n');
}

/**
 * Generate a filename for a CSV export with today's date.
 *
 * @param prefix - The filename prefix (e.g., "university-report")
 * @returns The filename with date suffix (e.g., "university-report-2024-01-22.csv")
 */
export function csvFilename(prefix: string): string {
  return `${prefix}-${new Date().toISOString().split('T')[0]}.csv`;
}

/**
 * Parse CSV content into headers and rows.
 *
 * Handles:
 * - Quoted fields with commas inside
 * - Escaped quotes (doubled "")
 * - Both \r\n and \n line endings
 *
 * @param text - The raw CSV text content
 * @returns Object with headers array and rows array of arrays
 */
export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
  const rows = lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        // Handle escaped quotes ("" -> literal ")
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip the next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  });

  return { headers, rows };
}
