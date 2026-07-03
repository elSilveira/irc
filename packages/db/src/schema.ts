import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

let cachedSchema: string | null = null;

const SCHEMA_URL = new URL('../../../db/schema.sql', import.meta.url);

export function readSchema(): string {
  if (!cachedSchema) {
    cachedSchema = readFileSync(SCHEMA_URL, 'utf8');
  }
  return cachedSchema;
}

export type { DatabaseSync };
