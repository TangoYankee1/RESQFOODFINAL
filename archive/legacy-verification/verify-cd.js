// Phase C/D ground-truth verifier. Writes concise results to stdout.
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

const htmlFiles = walk(PUBLIC).filter((f) => f.endsWith('.html'));

// 1. External refs (exclude Firebase SDK runtime on gstatic + apis.googleusercontent)
const EXTERNAL_OK = /gstatic\.com|googleapis\.com|googleusercontent\.com|firebaseio|firebasestorage/;
console.log('=== EXTERNAL REFS (non-Firebase-SDK) ===');
let extCount = 0;
for (const f of htmlFiles) {
  const txt = fs.readFileSync(f, 'utf8');
  const re = /(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
  let m;
  while ((m = re.exec(txt))) {
    if (!EXTERNAL_OK.test(m[1])) { console.log(`  ${rel(f)} -> ${m[1]}`); extCount++; }
  }
}
console.log(`  total non-SDK external refs: ${extCount}`);

// 2. Mock/demo/sessionStorage/alert across html + modules
console.log('=== MOCK/DEMO/SESSIONSTORAGE/ALERT in html ===');
const MOCK = /MOCK_|DEMO_|FALLBACK_VALID_PIN|sessionStorage|localStorage|\balert\(|confirm\(/;
for (const f of htmlFiles) {
  const txt = fs.readFileSync(f, 'utf8');
  const hits = txt.match(/MOCK_\w+|DEMO_\w+|FALLBACK_VALID_PIN|sessionStorage|localStorage|\balert\(/g);
  if (hits) console.log(`  ${rel(f)}: ${[...new Set(hits)].join(', ')}`);
}

// 3. admin/ vs app-admin/ trees
console.log('=== ADMIN TREES ===');
for (const d of ['public/admin', 'public/app-admin']) {
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) { console.log(`  ${d}: (missing)`); continue; }
  const files = walk(dir).filter((f) => f.endsWith('.html'));
  console.log(`  ${d}: ${files.map(rel).join(', ')}`);
}

// 4. Who links to app-admin?
console.log('=== LINKS TO app-admin ===');
let appLinks = 0;
for (const f of [...htmlFiles, ...walk(path.join(PUBLIC, 'js'))]) {
  if (!/\.(html|js)$/.test(f)) continue;
  const txt = fs.readFileSync(f, 'utf8');
  const re = /app-admin/gi;
  let c = 0; let m;
  while ((m = re.exec(txt))) c++;
  if (c) { console.log(`  ${rel(f)}: ${c} ref(s)`); appLinks += c; }
}
console.log(`  total app-admin refs: ${appLinks}`);

// 5. appAdmin.js referenced by which html?
console.log('=== appAdmin.js / systemAdmin.js usage ===');
for (const f of htmlFiles) {
  const txt = fs.readFileSync(f, 'utf8');
  const sm = txt.match(/modules\/(appAdmin|systemAdmin)\.js/g);
  if (sm) console.log(`  ${rel(f)}: ${sm.join(', ')}`);
}

// 6. tests present
console.log('=== TESTS ===');
const tdir = path.join(ROOT, 'tests');
if (fs.existsSync(tdir)) console.log('  ' + walk(tdir).filter((f) => f.endsWith('.js')).map(rel).join('\n  '));

// 7. top-level junk files created during work
console.log('=== TOP-LEVEL JUNK (STATE*/verify-*/test-output) ===');
for (const e of fs.readdirSync(ROOT)) {
  if (/^(STATE\d*\.txt|verify-(state|stage|out)\.(js|txt)|test-output\.log)$/.test(e)) console.log('  ' + e);
}
console.log('=== DONE ===');
