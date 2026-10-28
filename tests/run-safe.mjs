import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const home = mkdtempSync(join(tmpdir(), '8788-safe-tests-'));
try {
  const tests = readdirSync(join(root, 'tests')).filter(n => n.endsWith('.test.mjs')).sort().map(n => join(root, 'tests', n));
  const result = spawnSync(process.execPath, ['--test', ...tests], {
    cwd: root, stdio: 'inherit', env: { ...process.env, HOME: home, BAW_DATA_DIR: join(home, 'data'),
      NODE_OPTIONS: '--import=' + new URL('./network-guard.mjs', import.meta.url).href },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { rmSync(home, { recursive: true, force: true }); }
