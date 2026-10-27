const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/js/core/receiptStats.js'), 'utf8');
  const { receiptStats } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  // At 00:30 Manila on October 1, September UTC receipts may belong to October.
  const now = new Date('2026-09-30T16:30:00Z');
  const docs = [
    { status: 'verified', quantityKg: 2.5, volunteerId: 'a', verifiedAt: new Date('2026-09-30T16:01:00Z') },
    { status: 'verified', quantityKg: '1.2', volunteerId: 'a', verifiedAt: { toDate: () => new Date('2026-09-30T16:02:00Z') } },
    { status: 'verified', quantityKg: 4, volunteerId: 'b', verifiedAt: new Date('2026-09-30T15:59:00Z'), updatedAt: now },
    { status: 'verified', quantityKg: 1, volunteerId: 'c', createdAt: now },
    { status: 'delivered', quantityKg: 100, verifiedAt: now },
    { status: 'cancelled', quantityKg: 100, verifiedAt: now },
  ];
  const stats = receiptStats(docs, now);
  assert.equal(stats.totalKg, 8.7);
  assert.equal(stats.missions, 4);
  assert.equal(stats.monthlyKg, 3.7);
  assert.equal(stats.monthlyMissions, 2);
  assert.equal(stats.todayMissions, 2);
  assert.equal(stats.monthlyVolunteers, 1);
  assert.equal(stats.monthlyAverage, 1.9);
  assert.equal(receiptStats([], now).monthlyAverage, 0);
  console.log('Receipt statistics passed: verified-only totals, Manila boundaries, receipt timestamps, and empty history.');
})().catch(err => { console.error(err); process.exitCode = 1; });
