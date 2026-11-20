// One-shot authoritative stage verifier. Run: node verify-stage.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const out = [];
const log = (s) => out.push(s);

// 1. Modules
const modDir = path.join(PUB, 'js', 'modules');
const modules = fs.existsSync(modDir) ? fs.readdirSync(modDir).filter(f => f.endsWith('.js')).sort() : [];
log('=== MODULES ===');
modules.forEach(m => log('  ' + m));

// 2. The 5 Phase-B target pages: wired? inline? mocks?
const targets = [
  'admin/users.html',
  'admin/donations.html',
  'admin/audit.html',
  'org-admin/history.html',
  'volunteer/active-mission.html',
];
log('\n=== PHASE-B PAGES ===');
for (const rel of targets) {
  const p = path.join(PUB, rel);
  if (!fs.existsSync(p)) { log(`  ${rel}: MISSING`); continue; }
  const html = fs.readFileSync(p, 'utf8');
  const moduleScripts = (html.match(/<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/gi) || [])
    .map(t => (t.match(/src=["']([^"']+)["']/) || [])[1]).filter(Boolean);
  const inlineScripts = (html.match(/<script(?![^>]*src=)[^>]*>/gi) || []).length;
  const mocks = (html.match(/\b(MOCK_|DEMO_PIN|FALLBACK_VALID|sessionStorage|localStorage)/g) || []).length;
  log(`  ${rel}: moduleSrc=${moduleScripts.length} inline=${inlineScripts} mockHits=${mocks}`);
  moduleScripts.forEach(s => log(`       -> ${s}`));
}

// 3. CDN references across all HTML
log('\n=== EXTERNAL CDN REFS (all html) ===');
let cdn = 0;
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name.endsWith('.html')) {
      const html = fs.readFileSync(f, 'utf8');
      const hits = html.match(/https?:\/\/[^"'\s)]+/gi) || [];
      const ext = hits.filter(u => !/firebaseio|googleapis\.com\/firestore|gstatic\.com\/firebasejs/i.test(u));
      if (ext.length) { cdn += ext.length; log(`  ${path.relative(PUB, f)}: ${ext.join(', ')}`); }
    }
  }
}
walk(PUB);
if (cdn === 0) log('  (none)');

// 4. admin/ vs app-admin/
log('\n=== ADMIN TREES ===');
for (const dir of ['admin', 'app-admin']) {
  const p = path.join(PUB, dir);
  if (fs.existsSync(p)) {
    const files = fs.readdirSync(p).filter(f => f.endsWith('.html'));
    log(`  ${dir}/: ${files.join(', ')}`);
  }
}

// 5. node --check on the 5 phase-B modules
log('\n=== SYNTAX CHECK (node --check) ===');
for (const m of ['adminUsers', 'adminDonations', 'adminAudit', 'orgHistory', 'activeMission']) {
  const p = path.join(modDir, m + '.js');
  if (!fs.existsSync(p)) { log(`  ${m}: MISSING`); continue; }
  try { execSync(`node --check "${p}"`, { stdio: 'pipe' }); log(`  ${m}: OK`); }
  catch (e) { log(`  ${m}: FAIL`); }
}

fs.writeFileSync(path.join(ROOT, 'STAGE.txt'), out.join('\n') + '\n');
console.log('written STAGE.txt');
