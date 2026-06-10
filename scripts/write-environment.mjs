/**
 * Injects Supabase (and other) settings into Angular environment files at Docker build time.
 * Coolify: set SUPABASE_URL and SUPABASE_ANON_KEY as build arguments per environment.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.env.ENV_FILE ?? 'src/environments/environment.prod.ts';

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.log(
    `[write-environment] SUPABASE_URL / SUPABASE_ANON_KEY not set — leaving ${target} unchanged.`,
  );
  process.exit(0);
}

const relaxed =
  process.env.GATEKEEPER_RELAXED_EXECUTION === 'true' ||
  process.env.GATEKEEPER_RELAXED_EXECUTION === '1';

const production = process.env.ANGULAR_PRODUCTION !== 'false';

const contents = `export const environment = {
  production: ${production},
  gatekeeperRelaxedExecution: ${relaxed},
  supabaseUrl: '${supabaseUrl}',
  supabaseAnonKey: '${supabaseAnonKey}',
};
`;

const outPath = join(root, target);
writeFileSync(outPath, contents, 'utf8');
console.log(`[write-environment] Wrote ${target} (production=${production}, relaxed=${relaxed})`);
