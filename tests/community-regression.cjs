process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
const assert=require('node:assert/strict'),admin=require('firebase-admin');admin.initializeApp({projectId:'resqfood-ec8f5'});const db=admin.firestore();
const api={},prefix='community-regression-'+Date.now(),uids=[],refs=[];
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
require('../functions/lib/communityRequests')({exports:api,functions:{https:{HttpsError,onCall:fn=>fn}},admin,db,requireActiveAccount:require('../functions/lib/access').requireActiveAccount});
const context=(uid,role)=>({auth:{uid,token:{role}}});
async function save(c,id,data){const ref=db.collection(c).doc(id);refs.push(ref);await ref.set(data);return ref;}
async function run(){
 const resident=prefix+'-resident',coord=prefix+'-coord',outsider=prefix+'-other',orgId=prefix+'-org';
 for(const [i,uid]of [resident,coord,outsider].entries()){uids.push(uid);await admin.auth().createUser({uid,phoneNumber:'+63915'+String(Date.now()).slice(-6)+i});}
 await save('users',coord,{role:'orgAdmin',orgId,status:'active'});await save('users',outsider,{role:'orgAdmin',orgId:prefix+'-otherorg',status:'active'});
 await save('organizations',orgId,{status:'active',orgName:'Regression organization',barangay:'Lahug',serviceSitios:['ACACIA'],primaryContactUid:coord,verifierUids:[coord]});
 const r=context(resident),c=context(coord,'orgAdmin');
 const payload={orgId,requestKey:'first',sitio:'ACACIA',people:3,name:'Test Resident',note:'',consent:true};
 await assert.rejects(api.submitCommunityRequest(payload,{}),{code:'unauthenticated'});
 await assert.rejects(api.submitCommunityRequest({...payload,sitio:'UNKNOWN'},r),{code:'invalid-argument'});
 await assert.rejects(api.submitCommunityRequest({...payload,sitio:'PASTEUR'},r),{code:'failed-precondition'});
 await api.setCommunityAvailability({availability:'at_capacity'},c);
 await assert.rejects(api.submitCommunityRequest(payload,r),{code:'failed-precondition'});
 await api.setCommunityAvailability({availability:'accepting'},c);
 const created=await api.submitCommunityRequest(payload,r);assert.equal((await api.submitCommunityRequest(payload,r)).id,created.id);
 await assert.rejects(api.submitCommunityRequest({...payload,requestKey:'duplicate'},r),{code:'already-exists'});
 assert.equal((await api.listMyCommunityRequests({},context(outsider))).requests.length,0);
 await assert.rejects(api.reviewCommunityRequest({id:created.id,status:'accepted',response:'Please collect'},context(outsider,'orgAdmin')),{code:'permission-denied'});
 await assert.rejects(api.reviewCommunityRequest({id:created.id,status:'accepted',response:'Please collect'},c),{code:'invalid-argument'});
 await api.reviewCommunityRequest({id:created.id,status:'accepted',response:'Please collect at the hall',assistance:{people:2,meetingPoint:'Community hall',collectionAt:new Date(Date.now()+3600000).toISOString()}},c);
 await assert.rejects(api.cancelCommunityRequest({id:created.id,reason:'Cannot collect'},context(outsider)),{code:'permission-denied'});
 await api.cancelCommunityRequest({id:created.id,reason:'Cannot collect today'},r);
 await assert.rejects(api.reviewCommunityRequest({id:created.id,status:'fulfilled',response:'Completed delivery'},c),{code:'failed-precondition'});
 const rows=(await api.listMyCommunityRequests({},r)).requests;assert.deepEqual(rows[0].history.map(h=>h.status),['pending','accepted','cancelled']);
 await db.collection('communityRequestLimits').doc(resident).update({lastSubmittedAt:new Date(0)});
 const raced=await Promise.allSettled(['race1','race2'].map(requestKey=>api.submitCommunityRequest({...payload,requestKey},r)));
 assert.equal(raced.filter(r=>r.status==='fulfilled').length,1,'Concurrent duplicate requests must not both succeed');
 const accepted=raced.find(r=>r.status==='fulfilled').value;
 await api.reviewCommunityRequest({id:accepted.id,status:'declined',response:'No available food today'},c);
 console.log('PASS: community auth, coverage, availability, retry idempotency, active-request uniqueness, privacy, acceptance validation, cancellation, stale transitions, history, and concurrent submissions');
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{for(const uid of uids){for(const d of (await db.collection('communityRequests').where('requesterUid','==',uid).get()).docs)await d.ref.delete();for(const d of (await db.collection('auditLogs').where('actorUid','==',uid).get()).docs)await d.ref.delete();await db.collection('communityRequestLimits').doc(uid).delete();await admin.auth().deleteUser(uid).catch(()=>{});}for(const ref of refs)await ref.delete();await admin.app().delete();});
