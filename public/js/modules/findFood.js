import { loadLahugSitios, normalizeSitio, populateSitios } from '../core/lahug-locations.js';
import { auth, isLocalDev } from '../core/firebaseConfig.js';
import { sendOTP, confirmOTP, signOutCurrentUser } from '../core/auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { listCommunityOrganizations, submitCommunityRequest, listMyCommunityRequests, cancelCommunityRequest } from '../core/callables.js';
import { esc } from '../core/utils.js';
const $=id=>document.getElementById(id);
const availabilityLabels={accepting:'Tumatanggap ng requests',at_capacity:'Puno na ang kapasidad',unavailable:'Pansamantalang unavailable'};
const localDate=value=>new Date(value).toLocaleString('en-PH',{timeZone:'Asia/Manila'});
const labels={cancelled:'Kinansela',pending:'Naghihintay ng review',accepted:'Tinanggap — basahin ang instructions',declined:'Hindi matutugunan',fulfilled:'Naibigay na ang tulong'};
let sitios=[], requests=[], activeRequest=null, historyReady=false;
let organizations=[], selected=null, pending=null, key=crypto.randomUUID(), cooldownUntil=0;
const errorText=e=>e.message || 'Hindi makumpleto. Suriin ang koneksyon at subukan muli.';
async function catalog(){
  $('catalog-status').textContent='Kinukuha ang mga organization…';$('catalog-retry').hidden=true;
  try{
    const data=await listCommunityOrganizations(); organizations=data.organizations;
    $('demo-notice').hidden=!organizations.some(o=>o.isDemo);renderOrganizations();
  }catch(e){$('catalog-status').textContent=errorText(e);$('catalog-retry').hidden=false;}
}
function renderOrganizations(){
  const sitio=$('sitio-filter').value;
  const rows=organizations.filter(o=>!sitio || !o.serviceSitios.length || o.serviceSitios.includes(sitio));
  $('catalog-status').textContent=rows.length?`${rows.length} organization ang maaaring hingan ng tulong.`:'Walang organization na nakalista para sa sitio na ito. Subukang tingnan ang lahat ng sitio.';
  if(activeRequest)$('catalog-status').textContent='May aktibong request ka na. Tingnan ang Mga request ko sa ibaba; hindi ka muna makapagpapadala ng panibago.';
  $('organizations').innerHTML=rows.map(o=>`<article class="community-org"><h3>${esc(o.name)}</h3><p class="community-status">${o.isDemo?'DEMO · Simulated verified organization':'Verified organization'}</p><p>${esc(o.serviceSitios.length?o.serviceSitios.join(', '):'Lahug — kumpirmahin ang coverage sa coordinator')}</p><p class="community-status">${esc(availabilityLabels[o.availability] || availabilityLabels.accepting)}</p><p>Ang pagkain at schedule ay kukumpirmahin pagkatapos ng review.</p><button class="btn btn-primary" type="button" data-org="${esc(o.id)}" ${o.availability!=='accepting' || activeRequest?'disabled':''}>Humiling sa organization</button></article>`).join('');
}
$('organizations').addEventListener('click',e=>{
  const button=e.target.closest('[data-org]');if(!button)return;
  selected=organizations.find(o=>o.id===button.dataset.org);key=crypto.randomUUID();
  $('selected-org').textContent=selected.name;$('request-sitio').value=$('sitio-filter').value;
  const allowed=sitios;
  $('request-sitio').innerHTML='<option value="">Pumili ng sitio</option>'+allowed.map(s=>`<option>${esc(s)}</option>`).join('');$('request-sitio').value=$('sitio-filter').value;
  checkCoverage();syncRequestForm();$('request-status').textContent='';$('request-section').hidden=false;$('request-title').focus();
});
$('sitio-filter').addEventListener('change',renderOrganizations);$('catalog-retry').addEventListener('click',catalog);
function openTracking(){ $('phone-step').hidden=Boolean(auth.currentUser?.phoneNumber); $('tracking-title').focus(); if(!auth.currentUser?.phoneNumber)$('resident-phone').focus(); }
$('track-login').addEventListener('click',openTracking);
$('request-login').addEventListener('click',openTracking);
$('change-number').addEventListener('click',async()=>{try{await signOutCurrentUser(); pending=null; $('code-step').hidden=true; $('resident-code').value=''; $('phone-status').textContent='';openTracking();}catch(e){$('phone-status').textContent=errorText(e);}});
function syncRequestForm(){
  const verified=Boolean(auth.currentUser?.phoneNumber);
  $('request-form').hidden=!verified || !historyReady || Boolean(activeRequest);
  $('request-login').hidden=verified;
  $('active-request-note').textContent=activeRequest?'May aktibong request ka na. Tingnan ang Mga request ko bago humiling muli.':verified&&!historyReady?'Sinusuri ang dati mong requests…':'';
  renderOrganizations();
}
$('send-code').addEventListener('click',async()=>{
  const button=$('send-code');if(Date.now()<cooldownUntil)return;button.disabled=true;
  $('phone-status').textContent='Ipinapadala ang code…';
  try{pending=await sendOTP($('resident-phone').value,'resident-recaptcha');$('code-step').hidden=false;$('resident-code').value='';$('resident-code').focus();cooldownUntil=Date.now()+60000;
    $('phone-status').textContent=isLocalDev?'Tingnan ang OTP sa Auth emulator terminal. Walang SMS na ipinadala.':'Ilagay ang code mula sa SMS.';
  }catch(e){$('phone-status').textContent=errorText(e);}finally{button.disabled=Date.now()<cooldownUntil;}
});
setInterval(()=>{const remaining=Math.ceil((cooldownUntil-Date.now())/1000);if(remaining>0){$('send-code').textContent=`Magpadala ulit (${remaining}s)`;}else if(cooldownUntil){cooldownUntil=0;$('send-code').disabled=false;$('send-code').textContent='Magpadala ulit';}},1000);
$('verify-code').addEventListener('click',async()=>{
  const button=$('verify-code');button.disabled=true;
  try{await confirmOTP(pending,$('resident-code').value);$('phone-status').textContent='Verified na ang numero.';}catch(e){$('phone-status').textContent=errorText(e);}finally{button.disabled=false;}
});
onAuthStateChanged(auth,user=>{
  const verified=Boolean(user?.phoneNumber);
  historyReady=false;requests=[];activeRequest=null;$('change-number').hidden=!verified;
  $('phone-step').hidden=verified;$('track-login').hidden=verified;$('refresh-requests').hidden=!verified;
  $('identity').textContent=verified?`Verified number: ${user.phoneNumber}`:'';
  syncRequestForm(); if(verified)loadRequests();else $('my-requests').replaceChildren();
});
$('request-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!checkCoverage())return;if(!selected){$('request-status').textContent='Pumili muna ng organization sa itaas.';return;}
  const form=e.currentTarget,button=form.querySelector('button[type="submit"]');button.disabled=true;$('request-status').textContent='Ipinapadala ang request…';
  try{
    const result=await submitCommunityRequest({orgId:selected.id,requestKey:key,name:form.elements.residentName.value,sitio:form.elements.sitio.value,people:Number(form.elements.people.value),note:form.elements.note.value,consent:form.elements.consent.checked});
    key=crypto.randomUUID();form.reset();$('request-status').textContent=`Naipadala sa ${selected.name}. Reference: ${result.id.slice(0,12)}. Naghihintay ng review; wala pang nakalaang pagkain.`;$('request-status').focus();await loadRequests();
  }catch(e){$('request-status').textContent=errorText(e);if(e.code==='functions/already-exists')await loadRequests();}finally{button.disabled=false;checkCoverage();}
});
function renderRequests(){
  const filter=$('request-filter').value;
  const rows=requests.filter(r=>filter==='all'||(filter==='active')===['pending','accepted'].includes(r.status));
  $('my-requests').innerHTML=rows.map(r=>`<article class="community-request"><h3>${esc(r.orgName)}</h3>${r.isDemo?'<p class="community-notice">DEMO — simulated assistance</p>':''}<p>${esc(r.sitio)} · ${r.people} tao · ${esc(localDate(r.createdAt))}</p><p class="community-status">${esc(labels[r.status]||r.status)}</p><p>${esc(r.response||'Maghintay ng sagot mula sa organization.')}</p>${r.assistance?`<dl><dt>Bilang na matutulungan</dt><dd>${r.assistance.people}</dd><dt>Schedule (Philippine time)</dt><dd>${esc(localDate(r.assistance.collectionAt))}</dd><dt>Meeting point</dt><dd>${esc(r.assistance.meetingPoint)}</dd></dl>`:''}${r.cancellationReason?`<p>Dahilan ng cancellation: ${esc(r.cancellationReason)}</p>`:''}<small>Reference: ${esc(r.id.slice(0,12))}</small><details><summary>Status history</summary><ol>${(r.history||[]).map(h=>`<li>${esc(labels[h.status]||h.status)} · ${esc(localDate(h.at))} · ${h.actorUid===auth.currentUser?.uid?'Ikaw':'Organization'}</li>`).join('')||'<li>Walang naitalang history para sa mas lumang request.</li>'}</ol></details>${['pending','accepted'].includes(r.status)?`<form data-cancel="${esc(r.id)}"><label for="cancel-${esc(r.id)}">Dahilan ng cancellation</label><textarea class="form-input" id="cancel-${esc(r.id)}" name="reason" required minlength="5" maxlength="500"></textarea><button class="btn btn-ghost" type="submit">I-cancel ang Request</button></form>`:''}</article>`).join('')||'<p>Walang request sa listahang ito. Pumili ng organization sa itaas kung kailangan mo ng tulong.</p>';
}
async function loadRequests(){
  const uid=auth.currentUser?.uid;if(!uid)return;
  $('my-requests').textContent='Kinukuha ang requests…';
  try{const data=await listMyCommunityRequests();if(auth.currentUser?.uid!==uid)return;requests=data.requests;activeRequest=requests.find(r=>['pending','accepted'].includes(r.status));historyReady=true;syncRequestForm();renderRequests();}
  catch(e){if(auth.currentUser?.uid===uid){$('my-requests').textContent=errorText(e);historyReady=false;syncRequestForm();}}
}
$('request-filter').addEventListener('change',renderRequests);
$('my-requests').addEventListener('submit',async e=>{
  const form=e.target.closest('[data-cancel]');if(!form)return;e.preventDefault();const button=form.querySelector('button');button.disabled=true;
  try{await cancelCommunityRequest({id:form.dataset.cancel,reason:form.elements.reason.value});await loadRequests();}catch(error){$('phone-status').textContent=errorText(error);button.disabled=false;}
});
$('refresh-requests').addEventListener('click',loadRequests);
catalog();

function checkCoverage(){
  const value=$('request-sitio').value;
  const valid=sitios.includes(value);
  const covered=!selected || !selected.serviceSitios.length || selected.serviceSitios.includes(value);
  $('coverage-note').textContent=!sitios.length?'Hinihintay ang kumpletong listahan ng 48 sitios.':value&&!covered?'Hindi sakop ng organization na ito ang napiling sitio. Pumili ng ibang organization.':'Lahat ng 48 sitios ay nasa listahan. Nakahiwalay ang coverage ng bawat organization.';
  $('request-form').querySelector('button[type="submit"]').disabled=!valid || !covered;
  return valid && covered;
}
async function initSitios(){
  $('sitio-retry').hidden=true;$('sitio-load-status').textContent='Kinukuha ang 48 sitios…';
  try{sitios=await loadLahugSitios();populateSitios($('sitio-filter'),sitios,'Lahat ng sitio sa Lahug');populateSitios($('request-sitio'),sitios);$('sitio-load-status').textContent='48 sa 48 sitios ang na-load.';checkCoverage();renderOrganizations();}
  catch(error){$('sitio-load-status').textContent=error.message;$('sitio-retry').hidden=false;}
}
$('request-sitio').addEventListener('change',checkCoverage);
$('sitio-retry').addEventListener('click',initSitios);
initSitios();
