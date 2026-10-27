// functions/lib/csvExport.js
// Role-gated, audit-logged CSV export (PROD.MD: every export writes
// `report_exported` to auditLogs so DILG reviews can trace data egress).
// The client receives rows it is already authorized to read and the server
// re-checks scoping before serializing.
const ADMIN_ROLES = ['lguAdmin', 'systemAdmin'];

function toCsvCell(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[\s]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  return rows.map((r) => r.map(toCsvCell).join(',')).join('\n');
}

async function exportCsv(firestore, { kind = 'donations', actorUid, actorRole, barangay, status, action, range, max = 1000 }) {
  if (!ADMIN_ROLES.includes(actorRole)) return { success: false, reason: 'permission-denied' };
  const limit = Math.floor(Math.min(Math.max(Number(max) || 500, 1), 2000));
  if (range && !['7', '30', 'month'].includes(String(range))) return { success: false, reason: 'invalid_range' };
  const now = new Date();
  let since = null;
  if (range === 'month') {
    const manila = new Date(now.getTime() + 8 * 3600000);
    since = new Date(Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), 1) - 8 * 3600000);
  } else if (range) since = new Date(now.getTime() - Number(range) * 86400000);
  let rows = [['donationId', 'foodType', 'quantityKg', 'barangay', 'status', 'donorId', 'volunteerId', 'orgId', 'createdAt']];
  if (kind === 'donations') {
    let q = firestore.collection('donations');
    if (barangay) q = q.where('barangay', '==', barangay);
    if (status && status !== 'all') q = q.where('status', '==', status);
    if (since) q = q.where('createdAt', '>=', since);
    q = q.orderBy('createdAt', 'desc').limit(limit);
    const snap = await q.get();
    snap.forEach((d) => {
      const v = d.data();
      rows.push([d.id, v.foodType, v.quantityKg, v.barangay, v.status, v.donorId, v.volunteerId || '', v.orgId || '', v.createdAt && v.createdAt.toDate ? v.createdAt.toDate().toISOString() : '']);
    });
  } else if (kind === 'audit') {
    // Historical records used `at` and `type`. Normalize before ordering/limiting
    // so they are not silently excluded by a createdAt-only Firestore query.
    const snapshot = await firestore.collection('auditLogs').get();
    const records = snapshot.docs.map(d => ({ id: d.id, ...normalizeAudit(d.data()) }))
      .filter(v => (!action || action === 'all' || v.action === action) && (!since || v.createdAt >= since))
      .sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
    rows = [['logId', 'action', 'actorUid', 'entityType', 'entityId', 'createdAt']];
    records.forEach((v) => {
      rows.push([v.id, v.action, v.actorUid, v.entityType, v.entityId, v.createdAt.toISOString()]);
    });
  } else {
    return { success: false, reason: 'invalid_kind' };
  }
  const csv = toCsv(rows);
  const auditRef = firestore.collection('auditLogs').doc();
  await auditRef.set({
    logId: auditRef.id, entityType: 'report', entityId: `${kind}-${now.getTime()}`,
    action: 'report_exported', actorUid: actorUid || null,
    details: { kind, barangay: barangay || null, status: status || null, action: action || null, range: range || null, rowCount: rows.length - 1 },
    createdAt: now,
  });
  return { success: true, kind, rowCount: rows.length - 1, csv };
}

function normalizeAudit(v) {
  const raw = v.createdAt || v.at;
  const date = raw?.toDate ? raw.toDate() : new Date(raw || 0);
  return { action: v.action || v.type || '', actorUid: v.actorUid || v.uid || '',
    entityType: v.entityType || (v.donationId ? 'donation' : ''),
    entityId: v.entityId || v.donationId || v.targetUid || '',
    createdAt: Number.isNaN(date.getTime()) ? new Date(0) : date };
}
module.exports = { exportCsv, toCsv, normalizeAudit };
