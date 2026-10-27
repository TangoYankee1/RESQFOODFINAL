import { fetchDoc } from './data.js';

export async function loadOrganizationSession(session) {
  const user = await fetchDoc(`users/${session.user.uid}`);
  if (user?.role !== 'orgAdmin') throw Error('Organization role is missing');
  if (typeof user?.orgId !== 'string' || !user.orgId || user.orgId.includes('/')) throw Error('Organization membership is missing');
  const org = await fetchDoc(`organizations/${user.orgId}`);
  if (!org || (org.primaryContactUid !== session.user.uid && !(org.verifierUids || []).includes(session.user.uid))) throw Error('Organization membership is missing');
  const active = user.status === 'active' && org.status === 'active';
  const status = user.status !== 'active' ? user.status : org.status;
  const message = status === 'rejected' ? 'Hindi naaprubahan ang application. Makipag-ugnayan sa administrator.'
    : status === 'suspended' ? 'Naka-suspend ang organization. Makipag-ugnayan sa administrator.'
    : 'Pending ang document at training review. I-refresh ang pahina pagkatapos ng approval.';
  return { user, org: { ...org, orgId: user.orgId }, active, message, primary: org.primaryContactUid === session.user.uid };
}
