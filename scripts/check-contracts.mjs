import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Compare bytes, not git status: this also detects stale uncommitted/untracked output.
const temporary = mkdtempSync(join(tmpdir(), 'tracevault-contract-'));
try {
  const generated = join(temporary, 'http.ts');
  execFileSync(process.execPath, ['node_modules/openapi-typescript/bin/cli.js',
    '../tracevault-contracts/http/openapi.json', '-o', generated], { stdio: 'pipe' });
  if (readFileSync(generated, 'utf8') !== readFileSync('src/types/generated/http.ts', 'utf8')) {
    throw new Error('Generated HTTP types are stale. Run npm run contracts:generate.');
  }
  console.log('Generated HTTP types match the canonical OpenAPI contract.');
} finally { rmSync(temporary, { recursive: true, force: true }); }
