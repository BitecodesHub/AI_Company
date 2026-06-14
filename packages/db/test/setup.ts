import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/**
 * Parse a single `.env` line into [key, value], honoring quotes and stripping
 * inline comments for unquoted values (matches dotenv semantics). Returns null
 * for blank/comment lines.
 */
function parseEnvLine(line: string): [string, string] | null {
  const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) return null;
  const key = m[1];
  let val = m[2];
  const q = val[0];
  if (q === '"' || q === "'") {
    const end = val.indexOf(q, 1);
    val = end === -1 ? val.slice(1) : val.slice(1, end);
  } else {
    // Strip an inline comment: a `#` at the start of the value or preceded by
    // whitespace (a leading `#` means the whole value is a comment → empty).
    const hash = val.search(/(?:^|\s)#/);
    if (hash !== -1) val = val.slice(0, hash);
    val = val.trim();
  }
  return [key, val];
}

/**
 * Load the repo-root `.env` into process.env (without overriding values already
 * set) so RLS / tenant-isolation tests run against the local database. Walks up
 * from cwd to find it. If no `.env` is found (CI without a database), the RLS
 * suite skips gracefully via `describe.skipIf(!DATABASE_URL)`.
 */
function loadDotenv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const envPath = resolve(dir, '.env');
    if (existsSync(envPath)) {
      for (const line of readFileSync(envPath, 'utf8').split('\n')) {
        const parsed = parseEnvLine(line);
        if (!parsed) continue;
        const [key, val] = parsed;
        if (process.env[key] === undefined) process.env[key] = val;
      }
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

loadDotenv();
