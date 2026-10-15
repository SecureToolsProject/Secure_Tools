import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// cloudflare-bridge.test has just exercised the real build and isolated packaging.
for (const file of ['AGENTS.md','package.json','package-lock.json','tsconfig.json','tsconfig.build.json','.gitignore','README.md','CHANGELOG.md','SECURITY.md']) {
  assert.ok(!fs.existsSync(path.join('dist',file)), `${file} is not a public root asset`);
}
assert.equal(fs.readFileSync('dist/CNAME','utf8').trim(),'securetools.app');
assert.ok(fs.existsSync('dist/LICENSE'));
for (const file of ['assets/icons/.gitkeep','assets/images/.gitkeep']) assert.ok(!fs.existsSync(path.join('dist',file)), 'No repository scaffolding');
const probe = path.resolve('dist','unexpected-release-file.txt');
assert.equal(path.dirname(probe), path.resolve('dist'));
try {
  fs.writeFileSync(probe,'synthetic artifact inventory regression');
  const result = spawnSync(process.execPath,['scripts/validate-build.mjs'],{encoding:'utf8'});
  assert.notEqual(result.status,0,'Unexpected output must fail artifact validation');
  assert.match(result.stderr,/Unexpected artifact root entry/);
} finally { fs.unlinkSync(probe); }
console.log('Release artifact root allowlist rejects accidental repository/config files; license and generic CNAME preserved.');
