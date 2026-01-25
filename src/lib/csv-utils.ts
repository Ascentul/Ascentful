/**
 * CSV Utilities
 *
 * Shared utilities for CSV generation with security protections.
 */

// ============================================================================
// OUTCOMES CSV EXPORT FIELDS
// ============================================================================

/**
 * CSV field definitions for outcomes export.
 * Defines both headers and value extractors to prevent header/value drift.
 * Used by both the export route and tests for consistency.
 */
export interface OutcomeExportRow {
  external_student_id?: string;
  student_name?: string;
  student_email?: string;
  cohort_name?: string;
  outcome_status: string;
  outcome_type?: string;
  employer_name?: string;
  job_title?: string;
  is_verified?: boolean;
  confidence_score?: number;
  evidence_files?: Array<{ id: string; name?: string; type?: string }>;
  data_source?: string;
  updated_at: number;
}

export const OUTCOME_CSV_FIELDS: Array<{
  header: string;
  getValue: (o: OutcomeExportRow) => string;
}> = [
  { header: 'external_student_id', getValue: (o) => o.external_student_id || '' },
  { header: 'student_name', getValue: (o) => o.student_name || '' },
  { header: 'student_email', getValue: (o) => o.student_email || '' },
  { header: 'cohort_name', getValue: (o) => o.cohort_name || '' },
  { header: 'outcome_status', getValue: (o) => o.outcome_status || '' },
  { header: 'outcome_type', getValue: (o) => o.outcome_type || '' },
  { header: 'employer_name', getValue: (o) => o.employer_name || '' },
  { header: 'job_title', getValue: (o) => o.job_title || '' },
  {
    header: 'is_verified',
    getValue: (o) => (o.is_verified === undefined ? '' : o.is_verified ? 'true' : 'false'),
  },
  { header: 'confidence_score', getValue: (o) => o.confidence_score?.toString() || '' },
  { header: 'evidence_count', getValue: (o) => o.evidence_files?.length?.toString() || '0' },
  { header: 'data_source', getValue: (o) => o.data_source || '' },
  {
    header: 'last_updated',
    getValue: (o) => (o.updated_at ? new Date(o.updated_at).toISOString().split('T')[0] : ''),
  },
];

/** Derived headers array for convenience */
export const OUTCOME_CSV_HEADERS = OUTCOME_CSV_FIELDS.map((f) => f.header);

// ============================================================================
// CSV SECURITY UTILITIES
// ============================================================================

/**
 * Characters that can trigger formula execution in spreadsheet applications.
 * These are dangerous when they appear at the start of a cell value.
 */
const FORMULA_CHARS = ['=', '+', '-', '@', '|'];

/**
 * Escape a CSV cell value to handle commas, quotes, newlines, and prevent CSV injection.
 *
 * Security features:
 * - Quotes fields containing commas, quotes, newlines, or carriage returns
 * - Escapes embedded quotes by doubling them
 * - Prefixes formula-starting cells with a tab to prevent Excel formula injection
 *
 * @param field - The cell value to escape (undefined/null return empty string)
 * @returns The escaped CSV cell value
 */
export function escapeCSV(field: string | number | undefined | null): string {
  if (field === undefined || field === null) return '';
  const stringField = String(field);

  // Check if the field starts with a formula character (Excel trims leading whitespace)
  const trimmedForFormula = stringField.trimStart();
  const startsWithFormula = FORMULA_CHARS.some((char) => trimmedForFormula.startsWith(char));

  // Determine if the field needs quoting
  const needsQuoting =
    stringField.includes(',') ||
    stringField.includes('"') ||
    stringField.includes('\n') ||
    stringField.includes('\r') ||
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
 * Parse a single CSV line into an array of values.
 *
 * Handles:
 * - Quoted fields with commas inside
 * - Escaped quotes (doubled "")
 * - Preserves whitespace in quoted fields (standard CSV behavior)
 * - Trims unquoted fields (handles common user mistakes)
 *
 * @param line - A single line of CSV content
 * @returns Array of parsed values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  let wasQuoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      // Handle escaped quotes ("" -> literal ")
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip the next quote
      } else {
        inQuotes = !inQuotes;
        if (inQuotes) wasQuoted = true;
      }
    } else if (char === ',' && !inQuotes) {
      // Only trim unquoted fields - preserve whitespace in quoted fields
      values.push(wasQuoted ? current : current.trim());
      current = '';
      wasQuoted = false;
    } else {
      current += char;
    }
  }
  // Only trim unquoted fields - preserve whitespace in quoted fields
  values.push(wasQuoted ? current : current.trim());
  return values;
}

/**
 * Parse CSV content into headers and rows.
 *
 * Handles:
 * - Quoted fields with commas inside
 * - Escaped quotes (doubled "")
 * - Both \r\n and \n line endings
 *
 * Limitations:
 * - Does NOT handle newlines within quoted fields (assumes one record per line)
 *
 * @param text - The raw CSV text content
 * @returns Object with headers array and rows array of arrays
 */
export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const trimmed = text.trim();
  if (!trimmed) return { headers: [], rows: [] };
  const lines = trimmed.split(/\r?\n/);

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map(parseCSVLine);

  return { headers, rows };
}
