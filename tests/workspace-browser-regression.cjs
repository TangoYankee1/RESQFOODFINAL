process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process'),assert=require('node:assert/strict'),admin=require('firebase-admin');
admin.initializeApp({projectId:'resqfood-ec8f5'});const db=admin.firestore(),prefix='workspace-regression-'+Date.now(),actors=[],errors=[];let browser,ws,seq=0;const pending=new Map();const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function command(method,params={}){return new Promise((resolve,reject)=>{const id=++seq,t=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},30000);pending.set(id,m=>{clearTimeout(t);m.error?reject(Error(m.error.message)):resolve(m.result)});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function until(expression,label){const end=Date.now()+45000;while(Date.now()<end){if(await evaluate(expression))return;await sleep(150);}throw Error('Timeout '+label+'; '+errors.join('\n'));}
async function go(url){await command('Page.navigate',{url:'http://localhost:5000'+url});await until(`location.pathname===${JSON.stringify(url.split('?')[0])}&&document.readyState==='complete'`,url);}
async function run(){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'resqfood-regression-'));
 browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 const portFile=path.join(profile,'DevToolsActivePort');for(let i=0;i<100&&!fs.existsSync(portFile);i++)await sleep(100);const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
 const pages=await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json());ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r));
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
 await command('Page.enable');await command('Runtime.enable');
 await go('/find-food.html');await until(`document.querySelectorAll('#sitio-filter option').length===49`,'48 sitios');
 await evaluate(`document.getElementById('sitio-filter-combo').focus();document.getElementById('sitio-filter-combo').click();document.getElementById('sitio-filter-combo').value='anap';document.getElementById('sitio-filter-combo').dispatchEvent(new Event('input',{bubbles:true}));`);
 assert.equal(await evaluate(`document.querySelectorAll('#sitio-filter-combo-list [role=option]').length`),1);
 await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 assert.equal(await evaluate(`document.getElementById('sitio-filter').value`),'ANAPOG');
 await evaluate(`document.getElementById('sitio-filter').value='PASTEUR'`);assert.equal(await evaluate(`document.getElementById('sitio-filter-combo').value`),'Pasteur');
 console.log('PASS: all 48 sitios, combobox filtering, Enter selection, programmatic value synchronization');
 for(const [route,role]of [['donor','donor'],['volunteer','volunteer'],['org-admin','orgAdmin'],['lgu-admin','lguAdmin'],['app-admin','systemAdmin'],['admin','systemAdmin']]){
  const uid=prefix+'-'+route;actors.push(uid);await admin.auth().createUser({uid});await admin.auth().setCustomUserClaims(uid,{role});await db.collection('users').doc(uid).set({role,status:'active',trustStatus:'approved',fullName:'Regression '+route,barangay:'Lahug',sitio:'ACACIA',orgId:uid,profileComplete:true,onboardingComplete:true});
  if(role==='orgAdmin')await db.collection('organizations').doc(uid).set({orgId:uid,orgName:'Regression organization',status:'active',barangay:'Lahug',primaryContactUid:uid,verifierUids:[uid],address:'Regression location',mode:'standard'});
  await go('/register/index.html');const token=await admin.auth().createCustomToken(uid);
  await evaluate(`(async()=>{const {auth}=await import('/js/core/firebaseConfig.js');const sdk=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');await sdk.signOut(auth);await sdk.signInWithCustomToken(auth,${JSON.stringify(token)});sessionStorage.removeItem('resqfood_post_login_redirect');})()`);
  await go('/'+route+'/index.html');await until(`document.documentElement.dataset.pageReady==='1'&&!!document.querySelector('.workspace-sidebar')`,'workspace '+route);
  for(const width of [1440,390]){await command('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await sleep(200);if(!(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`)))console.log(await evaluate(`JSON.stringify([...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&e.getBoundingClientRect().width).map(e=>({tag:e.tagName,cls:e.className,id:e.id,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right})).slice(0,15))`));assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),true,route+' horizontal overflow at '+width);}
  await evaluate(`document.querySelector('.workspace-menu').click()`);assert.equal(await evaluate(`getComputedStyle(document.querySelector('.workspace-sidebar')).display`),'flex');
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});assert.equal(await evaluate(`document.querySelector('.workspace-menu').getAttribute('aria-expanded')`),'false');
  if(route==='donor'){await evaluate(`document.getElementById('tab-stats').click()`);assert.equal(await evaluate(`!document.getElementById('panel-stats').hidden`),true);assert.equal(await evaluate(`document.querySelector('.workspace-sidebar a[aria-current]').textContent`),'Stats');}
  await evaluate(`document.getElementById('btn-signout').click()`);assert.equal(await evaluate(`document.getElementById('signout-modal').open`),true);await evaluate(`document.getElementById('btn-cancel-signout').click()`);
  console.log('PASS: '+route+' workspace, 1440/390px layout, mobile menu, sign-out dialog');
 }
 assert.deepEqual(errors,[],'Unhandled browser errors');
 console.log('PASS: no unhandled browser exceptions');
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(ws){await command('Browser.close').catch(()=>{});ws.close();}browser?.kill();for(const uid of actors){await db.collection('users').doc(uid).delete();await db.collection('organizations').doc(uid).delete();await admin.auth().deleteUser(uid).catch(()=>{});}await admin.app().delete();});
