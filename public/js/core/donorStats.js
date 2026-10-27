// Derived from donation records, never from editable profile counters.
export function donorStats(donations) {
  const verified = donations.filter(d => d.status === 'verified');
  const expiredCount = donations.filter(d => d.status === 'expired').length;
  return {
    totalDonations: donations.length, verifiedCount: verified.length,
    cancelledCount: donations.filter(d => d.status === 'cancelled').length,
    expiredCount, totalDonatedKg: verified.reduce((sum, d) => sum + (Number(d.quantityKg) || 0), 0),
    points: verified.length * 10, reliabilityScore: verified.length * 10 - expiredCount * 5,
  };
}
