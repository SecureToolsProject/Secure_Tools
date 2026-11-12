import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { canonicalVersion, validateBuildProvenance } from './build-provenance.mjs';

// Execute the deployed packaging recipe without credentials or any deployment.
const review = path.resolve('.ts-build/release-review');
assert.equal(path.dirname(review),path.resolve('.ts-build'));
fs.rmSync(review,{recursive:true,force:true}); fs.mkdirSync(review,{recursive:true});
const artifact = path.join(review,'site');
const workflow = fs.readFileSync('.github/workflows/deploy-cloudflare-bridge.yml','utf8');
const preparation = workflow.match(/- name: Prepare isolated bridge artifact[\s\S]*?run: \|\n([\s\S]*?)\n      - name:/)?.[1];
assert.ok(preparation,'Actual isolated deployment recipe must exist');
const shell = process.platform === 'win32' ? path.join(process.env.ProgramFiles,'Git/bin/bash.exe') : 'bash';
const target = process.platform === 'win32' ? artifact.replaceAll('\\','/').replace(/^([A-Za-z]):\//,(_,drive)=>`/${drive.toLowerCase()}/`) : artifact;
const result = spawnSync(shell,['-e','-o','pipefail','-c',preparation.replace(/^          /gm,'')],{env:{...process.env,BRIDGE_DIRECTORY:target},stdio:'inherit'});
assert.equal(result.status,0,'Release review must pass actual deployment packaging');
const info = validateBuildProvenance(artifact);
assert.match(canonicalVersion,/^[1-9]\d*\.\d+\.\d+$/,'Release version must be intentional, not placeholder 0.0.0');
assert.equal(info.version,canonicalVersion);
assert.ok(!fs.existsSync(path.join(artifact,'CNAME')));
assert.equal(fs.readFileSync('CNAME','utf8').trim(),'securetools.app');
assert.equal(fs.readFileSync('dist/CNAME','utf8').trim(),'securetools.app');
const files = [];
function visit(directory) {
  for (const entry of fs.readdirSync(directory,{withFileTypes:true})) {
    const file = path.join(directory,entry.name);
    if (entry.isDirectory()) visit(file);
    else files.push(path.relative(artifact,file).replaceAll('\\','/'));
  }
}
visit(artifact); files.sort();
for (const file of files) {
  assert.doesNotMatch(file,/(^|\/)(?:node_modules|tests|scripts|\.git)(\/|$)|\.(?:ts|tsx|map)$/,'No test/build/debug files');
  if (file.endsWith('.html')) {
    const html = fs.readFileSync(path.join(artifact,file),'utf8');
    assert.doesNotMatch(html,/<script[^>]+src=["']https?:|<link[^>]+rel=["']stylesheet["'][^>]+href=["']https?:/i,'No runtime CDN');
    assert.doesNotMatch(html,/static\.cloudflareinsights\.com|\/cdn-cgi\/rum|beacon\.min\.js/i,'No telemetry injection');
  }
}
const report = {provenance:info,fileCount:files.length,files,isolatedCnameAbsent:true,headersPresent:fs.existsSync(path.join(artifact,'_headers')),note:'Review candidate only; future main/deployment SHA must be verified separately. Not an attestation or reproducible-build proof.'};
fs.writeFileSync(path.join(review,'inspection.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,files:undefined},null,2));
