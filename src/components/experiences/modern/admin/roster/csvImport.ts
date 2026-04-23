import { isValidEmail } from "@wxyc/shared/validation";

export type CSVImportRow = {
  name: string;
  username: string;
  djName: string;
  email: string;
};

export type CSVRowError = {
  row: number;
  field: string;
  message: string;
};

export type CSVParseResult = {
  rows: CSVImportRow[];
  errors: CSVRowError[];
};

const FORMULA_PREFIXES = ["=", "+", "-", "@"];

/**
 * Strip formula-injection prefixes and trim whitespace.
 */
export function sanitizeCSVField(field: string): string {
  let result = field;
  if (result.length > 0 && FORMULA_PREFIXES.some((p) => result.startsWith(p))) {
    result = result.slice(1);
  }
  return result.trim();
}

/**
 * Derive a username from an email address (local part before @).
 */
export function deriveUsername(email: string): string {
  return email.split("@")[0];
}

/**
 * Parse raw CSV text into a 2D array of strings.
 * Handles quoted fields, escaped quotes (""), newlines inside quotes, CRLF/LF.
 */
export function parseCSVText(text: string): string[][] {
  if (text.length === 0) return [];

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
        i++;
      } else if (char === "\r") {
        // CRLF or bare CR
        currentRow.push(currentField);
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
        i++;
        if (i < text.length && text[i] === "\n") {
          i++;
        }
      } else if (char === "\n") {
        currentRow.push(currentField);
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  // Flush the last field/row (unless we just finished a newline)
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

// Header aliases for flexible column matching (all lowercase)
const NAME_ALIASES = ["name", "first and last name", "full name"];
const USERNAME_ALIASES = ["username", "user name", "username (optional)"];
const DJ_NAME_ALIASES = ["dj name", "dj_name", "djname"];
const EMAIL_ALIASES = ["email", "email address"];

function findColumnIndex(headers: string[], aliases: string[]): number {
  return headers.findIndex((h) => aliases.includes(h.toLowerCase().trim()));
}

/**
 * Parse CSV text into structured import rows with validation.
 * Returns all rows (including invalid ones) and a list of errors.
 */
export function parseCSVImport(text: string): CSVParseResult {
  const rawRows = parseCSVText(text);
  if (rawRows.length === 0) return { rows: [], errors: [] };

  const headers = rawRows[0];
  const nameIdx = findColumnIndex(headers, NAME_ALIASES);
  const usernameIdx = findColumnIndex(headers, USERNAME_ALIASES);
  const djNameIdx = findColumnIndex(headers, DJ_NAME_ALIASES);
  const emailIdx = findColumnIndex(headers, EMAIL_ALIASES);

  // Check for required headers
  const missingHeaders: string[] = [];
  if (nameIdx === -1) missingHeaders.push("Name");
  if (djNameIdx === -1) missingHeaders.push("DJ Name");
  if (emailIdx === -1) missingHeaders.push("Email");

  if (missingHeaders.length > 0) {
    return {
      rows: [],
      errors: [{
        row: 0,
        field: "header",
        message: `Missing required columns: ${missingHeaders.join(", ")}`,
      }],
    };
  }

  const rows: CSVImportRow[] = [];
  const errors: CSVRowError[] = [];
  const seenEmails = new Set<string>();

  for (let i = 1; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowNum = i; // 1-indexed (row 1 = first data row)

    const name = sanitizeCSVField(raw[nameIdx] ?? "");
    const rawUsername = usernameIdx !== -1 ? sanitizeCSVField(raw[usernameIdx] ?? "") : "";
    const djName = sanitizeCSVField(raw[djNameIdx] ?? "");
    const email = sanitizeCSVField(raw[emailIdx] ?? "");

    const username = rawUsername || (email ? deriveUsername(email) : "");

    // Validate
    if (!name) {
      errors.push({ row: rowNum, field: "name", message: "Name is required" });
    }
    if (!djName) {
      errors.push({ row: rowNum, field: "djName", message: "DJ Name is required" });
    }
    if (!email) {
      errors.push({ row: rowNum, field: "email", message: "Email is required" });
    } else if (!isValidEmail(email)) {
      errors.push({ row: rowNum, field: "email", message: "Email address is invalid" });
    } else {
      const emailLower = email.toLowerCase();
      if (seenEmails.has(emailLower)) {
        errors.push({ row: rowNum, field: "email", message: `Duplicate email: ${email}` });
      }
      seenEmails.add(emailLower);
    }

    rows.push({ name, username, djName, email });
  }

  return { rows, errors };
}
