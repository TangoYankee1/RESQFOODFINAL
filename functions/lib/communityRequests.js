const sitios = require('./lahug-sitios.json');
const crypto = require('node:crypto');
module.exports = function registerCommunityRequests({ exports, functions, admin, db, requireActiveAccount }) {
  const ErrorType = functions.https.HttpsError;
  const fail = (code,message) => { throw new ErrorType(code,message); };
  const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
  const availability = o => o.requestAvailability || 'accepting';
  const serialize = d => { const r=d.data(); return {id:d.id,...r,createdAt:r.createdAt.toDate().toISOString(),history:(r.history || []).map(h=>({...h,at:h.at?.toDate ? h.at.toDate().toISOString():h.at}))}; };
  const demoAllowed = org => !org.isDemo || Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  async function resident(context) {
    if(!context.auth) fail('unauthenticated','I-verify muna ang iyong numero.');
    const account = await admin.auth().getUser(context.auth.uid);
    if(account.disabled || !/^\+639\d{9}$/.test(account.phoneNumber || '')) fail('permission-denied','Kailangan ang verified Philippine mobile number.');
    const profile = await db.collection('users').doc(account.uid).get();
    if(['suspended','rejected'].includes(profile.data()?.status)) fail('permission-denied','Hindi aktibo ang account.');
    return account;
  }
  async function coordinator(context) {
    const user = await requireActiveAccount(db,context,ErrorType);
    if(user.role !== 'orgAdmin' || !validId(user.orgId)) fail('permission-denied','Organization coordinator lamang.');
    const org = (await db.collection('organizations').doc(user.orgId).get()).data();
    if(!org || org.status !== 'active' || !demoAllowed(org) || !(org.primaryContactUid === context.auth.uid || (org.verifierUids || []).includes(context.auth.uid))) fail('permission-denied','Kailangan ang aktibong organization membership.');
    return user.orgId;
  }
  exports.listCommunityOrganizations = functions.https.onCall(async () => {
    const snapshot = await db.collection('organizations').where('status','==','active').get();
    return { sitios, organizations:snapshot.docs.filter(d=>demoAllowed(d.data())).map(d=>{
      const o=d.data();
      return { id:d.id, name:o.orgName || 'Organization', barangay:o.barangay || '', sitio:o.sitio || '', serviceSitios:Array.isArray(o.serviceSitios)?o.serviceSitios.filter(s=>sitios.includes(s)):[], isDemo:Boolean(o.isDemo), availability:availability(o) };
    }).filter(o=>o.barangay.toLowerCase()==='lahug') };
  });
  exports.submitCommunityRequest = functions.https.onCall(async (data,context) => {
    const account = await resident(context);
    if(!data || !validId(data.orgId) || !validId(data.requestKey) || !sitios.includes(data.sitio) || !Number.isInteger(data.people) || data.people<1 || data.people>50 || typeof data.name !== 'string' || data.name.trim().length<2 || data.name.trim().length>100 || typeof data.note !== 'string' || data.note.length>500 || data.consent !== true) fail('invalid-argument','Suriin ang pangalan, sitio, at bilang (1–50).');
    const id=crypto.createHash('sha256').update(account.uid+':'+data.requestKey).digest('hex');
    const requestRef=db.collection('communityRequests').doc(id);
    const guardRef=db.collection('communityRequestLimits').doc(account.uid);
    return db.runTransaction(async tx=>{
      const [existing,orgSnap,guard] = await Promise.all([tx.get(requestRef),tx.get(db.collection('organizations').doc(data.orgId)),tx.get(guardRef)]);
      if(existing.exists) return { id, status:existing.data().status };
      const previous=await tx.get(db.collection('communityRequests').where('requesterUid','==',account.uid));
      const active=previous.docs.find(d=>['pending','accepted'].includes(d.data().status));
      if(active) fail('already-exists','May pending o accepted request ka na. Tingnan ang Mga request ko.');
      const org=orgSnap.data();
      if(!org || org.status!=='active' || org.barangay?.toLowerCase()!=='lahug' || !demoAllowed(org)) fail('failed-precondition','Hindi available ang organization. Pumili muli.');
      if(availability(org)!=='accepting') fail('failed-precondition','Hindi tumatanggap ng bagong request ang organization.');
      if(Array.isArray(org.serviceSitios) && org.serviceSitios.length && !org.serviceSitios.includes(data.sitio)) fail('failed-precondition','Hindi sakop ng organization ang sitio.');
      const now=new Date();
      const recent=guard.data()?.lastSubmittedAt?.toMillis?.() || 0;
      if(now.getTime()-recent<60000) fail('resource-exhausted','Maghintay ng isang minuto bago humiling muli.');
      const day=now.toISOString().slice(0,10), count=guard.data()?.day===day ? guard.data().count : 0;
      if(count>=5) fail('resource-exhausted','Naabot ang limang request ngayong araw.');
      tx.create(requestRef,{ requesterUid:account.uid, orgId:data.orgId, orgName:org.orgName, isDemo:Boolean(org.isDemo), name:data.name.trim(), phone:account.phoneNumber, sitio:data.sitio, barangay:'Lahug', people:data.people, note:data.note.trim(), consentAt:now, status:'pending', response:'', history:[{status:'pending',actorUid:account.uid,at:now}], createdAt:now, updatedAt:now });
      tx.set(guardRef,{lastSubmittedAt:now,day,count:count+1});
      return {id,status:'pending'};
    });
  });
  exports.listMyCommunityRequests = functions.https.onCall(async (_,context)=>{
    const account=await resident(context);
    const rows=await db.collection('communityRequests').where('requesterUid','==',account.uid).get();
    return {requests:rows.docs.map(serialize).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))};
  });
  exports.listOrganizationCommunityRequests = functions.https.onCall(async (_,context)=>{
    const orgId=await coordinator(context);
    const rows=await db.collection('communityRequests').where('orgId','==',orgId).get();
    const org=(await db.collection('organizations').doc(orgId).get()).data();
    return {availability:availability(org), requests:rows.docs.map(serialize).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))};
  });
  exports.reviewCommunityRequest = functions.https.onCall(async (data,context)=>{
    const orgId=await coordinator(context);
    if(!data || !validId(data.id) || !['accepted','declined','fulfilled'].includes(data.status) || typeof data.response !== 'string' || data.response.trim().length<5 || data.response.length>500) fail('invalid-argument','Maglagay ng malinaw na sagot (5–500 characters).');
    return db.runTransaction(async tx=>{
      const ref=db.collection('communityRequests').doc(data.id), snap=await tx.get(ref), row=snap.data();
      const org=await tx.get(db.collection('organizations').doc(orgId));
      if(!row || row.orgId!==orgId || org.data()?.status!=='active') fail('permission-denied','Hindi maaaring baguhin ang request.');
      if(!(row.status==='pending' && ['accepted','declined'].includes(data.status)) && !(row.status==='accepted' && ['fulfilled','declined'].includes(data.status))) fail('failed-precondition','Nagbago na ang request. I-refresh ang listahan.');
      const now=new Date();
      let assistance = row.assistance || null;
      if(data.status==='accepted') {
        const a=data.assistance;
        if(!a || !Number.isInteger(a.people) || a.people<1 || a.people>row.people || typeof a.meetingPoint!=='string' || a.meetingPoint.trim().length<5 || a.meetingPoint.length>300 || typeof a.collectionAt!=='string' || !Number.isFinite(Date.parse(a.collectionAt)) || Date.parse(a.collectionAt)<=now.getTime()) fail('invalid-argument','Kailangan ang bilang na matutulungan, future collection date/time, at meeting point.');
        assistance={people:a.people,meetingPoint:a.meetingPoint.trim(),collectionAt:new Date(a.collectionAt).toISOString()};
      }
      tx.update(ref,{status:data.status,assistance,history:[...(row.history||[]),{status:data.status,actorUid:context.auth.uid,at:now}],response:data.response.trim(),reviewedBy:context.auth.uid,updatedAt:now});
      tx.create(db.collection('auditLogs').doc(),{action:'community_request_'+data.status,entityType:'communityRequest',entityId:data.id,actorUid:context.auth.uid,createdAt:now});
      return {success:true};
    });
  });
  exports.setCommunityAvailability = functions.https.onCall(async (data,context)=>{
    const orgId=await coordinator(context);
    if(!['accepting','at_capacity','unavailable'].includes(data?.availability)) fail('invalid-argument','Pumili ng valid availability.');
    const batch=db.batch(),now=new Date();
    batch.update(db.collection('organizations').doc(orgId),{requestAvailability:data.availability,updatedAt:now});
    batch.create(db.collection('auditLogs').doc(),{action:'community_availability_updated',entityId:orgId,actorUid:context.auth.uid,availability:data.availability,createdAt:now});
    await batch.commit();return {success:true};
  });
  exports.cancelCommunityRequest = functions.https.onCall(async (data,context)=>{
    const account=await resident(context);
    if(!validId(data?.id) || typeof data.reason!=='string' || data.reason.trim().length<5 || data.reason.length>500) fail('invalid-argument','Magbigay ng dahilan (5–500 characters).');
    return db.runTransaction(async tx=>{
      const ref=db.collection('communityRequests').doc(data.id),row=(await tx.get(ref)).data();
      if(!row || row.requesterUid!==account.uid) fail('permission-denied','Hindi sa iyo ang request.');
      if(!['pending','accepted'].includes(row.status)) fail('failed-precondition','Hindi na maaaring i-cancel ang request. I-refresh ang listahan.');
      const now=new Date();
      tx.update(ref,{status:'cancelled',cancellationReason:data.reason.trim(),updatedAt:now,history:[...(row.history||[]),{status:'cancelled',actorUid:account.uid,at:now}]});
      tx.create(db.collection('auditLogs').doc(),{action:'community_request_cancelled',entityId:data.id,actorUid:account.uid,createdAt:now});
      return {success:true};
    });
  });

};
