// Count completed handovers from donations, rather than editable profile counters.
export function receiptDate(value) {
  if (!value) return null;
  const date = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

export function receiptStats(donations, now = new Date()) {
  const verified = donations.filter(d => d.status === 'verified');
  const today = dayKey(now);
  const month = today.slice(0, 7);
  const monthly = verified.filter(d => {
    const date = receiptDate(d.verifiedAt);
    return date && dayKey(date).slice(0, 7) === month;
  });
  const kg = docs => Math.round(docs.reduce((sum, d) => sum + (Number(d.quantityKg) || 0), 0) * 10) / 10;
  const todayVerified = verified.filter(d => {
    const date = receiptDate(d.verifiedAt);
    return date && dayKey(date) === today;
  });
  return {
    verified, totalKg: kg(verified), missions: verified.length,
    monthlyKg: kg(monthly), monthlyMissions: monthly.length,
    monthlyVolunteers: new Set(monthly.map(d => d.volunteerId).filter(Boolean)).size,
    monthlyAverage: monthly.length ? Math.round(kg(monthly) / monthly.length * 10) / 10 : 0,
    todayVerified, todayMissions: todayVerified.length,
  };
}
