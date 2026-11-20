// Authoritative Phase B verifier. Run with: node verify-state.js
const fs = require('fs');
const path = require('path');

const ROOT = 'c:/Users/Joshua/OneDrive/Desktop/resqfood/RESQFOODFINAL';
const pub = path.join(ROOT, 'public');
const modDir = path.join(pub, 'js', 'modules');
const coreDir = path.join(pub, 'js', 'core');

const pairs = {
  'adminUsers.js': 'admin/users.html',
  'adminDonations.js': 'admin/donations.html',
  'adminAudit.js': 'admin/audit.html',
  'orgHistory.js': 'org-admin/history.html',
  'activeMission.js': 'volunteer/active-mission.html',
};

const coreCache = {};
function coreExports(file) {
  if (file in coreCache) return coreCache[file];
  const p = path.join(coreDir, file);
  if (!fs.existsSync(p)) return (coreCache[file] = null);
  const src = fs.readFileSync(p, 'utf8');
  const names = new Set();
  let m;
  const re1 = /export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z0-9_$]+)/g;
  while ((m = re1.exec(src))) names.add(m[1]);
  const re2 = /export\s*\{([^}]*)\}/g;
  while ((m = re2.exec(src))) {
    m[1].split(',').forEach((s) => {
      s = s.trim();
      if (!s) return;
      const parts = s.split(/\s+as\s+/);
      const nm = (parts[1] || parts[0]).trim();
      if (nm) names.add(nm);
    });
  }
  return (coreCache[file] = names);
}

let problems = 0;
const usedIds = {};

for (const [mod, page] of Object.entries(pairs)) {
  console.log('\n=== ' + mod + '  ->  ' + page + ' ===');
  const mp = path.join(modDir, mod);
  const pp = path.join(pub, page);
  if (!fs.existsSync(mp)) { console.log('  MODULE MISSING'); problems++; continue; }
  if (!fs.existsSync(pp)) { console.log('  PAGE MISSING'); problems++; continue; }
  const src = fs.readFileSync(mp, 'utf8');
  const html = fs.readFileSync(pp, 'utf8');

  // 1) imports resolve
  const importRe = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(src))) {
    const syms = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    const mm = m[2].match(/core\/([A-Za-z0-9_]+)\.js/);
    if (!mm) continue;
    const exps = coreExports(mm[1] + '.js');
    if (!exps) { console.log('  CORE MISSING: core/' + mm[1] + '.js'); problems++; continue; }
    for (const s of syms) if (!exps.has(s)) { console.log('  BAD IMPORT: ' + s + ' <- core/' + mm[1] + '.js'); problems++; }
  }

  // 2) DOM ids referenced exist in the page
  const idRe = /getElementById\(\s*['"]([^'"]+)['"]\s*\)/g;
  const ids = new Set();
  while ((m = idRe.exec(src))) ids.add(m[1]);
  for (const id of ids) {
    usedIds[page + '#' + id] = true;
    if (!new RegExp('id=["\']' + id + '["\']').test(html)) { console.log('  DOM ID NOT IN PAGE: ' + id); problems++; }
  }

  // 3) page must load this module and have NO inline mock script
  const scriptTags = html.match(/<script\b[^>]*>/g) || [];
  const moduleTags = scriptTags.filter((t) => /type=["']module["']/.test(t)).length;
  const inlineTags = scriptTags.filter((t) => !/\bsrc=/.test(t) && !/type=["']module["']/.test(t)).length;
  const loadsMod = new RegExp("modules/" + mod.replace(/\.js$/, '') + "\\.js").test(html);
  const hasMock = /MOCK_|sessionStorage/.test(html);
  console.log('  moduleTag=' + moduleTags + ' inlineScript=' + inlineTags + ' loadsModule=' + loadsMod + ' mock/sessionStorage=' + hasMock);
  if (!loadsMod) { console.log('  NOT WIRED: page does not load modules/' + mod); problems++; }
  if (inlineTags > 0) { console.log('  LEFTOVER INLINE <script> x' + inlineTags); problems++; }
  if (hasMock) { console.log('  LEFTOVER MOCK/sessionStorage in page'); problems++; }
}

console.log('\n==== TOTAL PROBLEMS: ' + problems + ' ====');
