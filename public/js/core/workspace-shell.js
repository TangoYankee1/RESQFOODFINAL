import { bindSignOutDialog } from './role-ui.js';
import { signOutCurrentUser } from './auth.js';
import { fetchDoc } from './data.js';
const roles = {
 donor:{name:'Donor',links:[['Overview','index.html'],['History','history.html'],['Stats','index.html?tab=tab-stats']],action:['Mag-post ng Pagkain','post.html']},
 volunteer:{name:'Volunteer',links:[['Missions','index.html'],['Aking Missions','index.html?tab=tab-my'],['Pickup Scanner','scanner.html'],['History','history.html']]},
 'org-admin':{name:'Organization',links:[['Overview','index.html'],['Community Requests','index.html#community-inbox'],['I-verify ang Receipt','verify.html'],['History','history.html']]},
 'lgu-admin':{name:'LGU Admin',links:[['Overview','index.html'],['Mga User','users.html'],['Reports','reports.html'],['Audit Trail','audit.html']]},
 admin:{name:'Administration',links:[['Overview','index.html'],['Mga User','users.html'],['Donations','donations.html'],['Audit Trail','audit.html']]},
 'app-admin':{name:'App Admin',links:[['Overview','index.html'],['Mga User','users.html'],['Review Applications','index.html#verification-review-table'],['LGU Invitations','index.html#invite-form'],['Global Audit','audit.html']]},
};
const icons={Overview:'M3 10 12 3l9 7M5 9v12h14V9M9 21v-7h6v7',History:'M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2',Stats:'M5 20V10m7 10V4m7 16v-7',default:'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5'};
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.innerHTML=`<path d="${icons[name]||icons.default}"/>`;return svg;}
export function installWorkspace(session){
 const role=location.pathname.split('/')[1],config=roles[role];if(!config||document.querySelector('.workspace-sidebar'))return;
 document.body.classList.add('workspace-page');
 const sidebar=document.createElement('aside');sidebar.className='workspace-sidebar';sidebar.id='workspace-navigation';
 sidebar.innerHTML='<a class="resqfood-brand" href="/" aria-label="ResQFood home"><img class="resqfood-logo" src="/assets/resqfood-logo.png" width="266" height="84" alt="RESQFOOD"></a><p class="workspace-role"></p><nav aria-label="Role navigation"></nav><div class="workspace-account"><span class="workspace-avatar" aria-hidden="true">R</span><div><strong class="workspace-user">Account</strong><small class="workspace-account-role"></small></div></div>';
 sidebar.querySelector('.workspace-role').textContent=config.name+' workspace';sidebar.querySelector('.workspace-account-role').textContent=config.name;
 const nav=sidebar.querySelector('nav');
 config.links.forEach(([label,target])=>{const a=document.createElement('a');a.href=`/${role}/${target}`;a.append(icon(label),document.createTextNode(label));const url=new URL(a.href);if(url.pathname===location.pathname&&url.search===location.search&&!url.hash)a.setAttribute('aria-current','page');nav.append(a);});
 let signout=document.getElementById('btn-signout');if(!signout){signout=document.createElement('button');signout.type='button';signout.id='btn-signout';document.body.append(signout);bindSignOutDialog(signOutCurrentUser);}if(signout){signout.className='workspace-signout';signout.textContent='Mag-sign out';sidebar.append(signout);}
 document.body.prepend(sidebar);
 const refreshNavigation=()=>{const tab=document.querySelector('.donor-tab[aria-selected="true"],.vol-tab[aria-selected="true"]')?.id;for(const a of nav.querySelectorAll('a')){const u=new URL(a.href);const target=u.searchParams.get('tab');const current=u.pathname===location.pathname&&!u.hash&&(target?target===tab:(!tab||!['tab-stats','tab-my'].includes(tab)));if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}};
 document.querySelectorAll('[role="tab"]').forEach(tab=>tab.addEventListener('click',refreshNavigation));refreshNavigation();
 const header=document.createElement('header');header.className='workspace-header';
 header.innerHTML='<button type="button" class="workspace-menu" aria-controls="workspace-navigation" aria-expanded="false">☰ <span>Menu</span></button><div class="workspace-heading"><p></p><h1></h1><div class="workspace-location" role="status">Kinukuha ang account status…</div></div><div class="workspace-primary"></div>';
 const home=location.pathname.endsWith('/index.html')||location.pathname.endsWith('/');
 const titles={'post.html':'Mag-post ng Pagkain','history.html':'History','scanner.html':'Pickup Scanner','verify.html':'I-verify ang Receipt','users.html':'Mga User','reports.html':'Reports','audit.html':'Audit Trail','donations.html':'Donations','active-mission.html':'Mission Details','qr-display.html':'Donation Details'};
 header.querySelector('.workspace-heading p').textContent=config.name;
 header.querySelector('h1').textContent=home?(role==='donor'?'Iyong Donations':role==='volunteer'?'Mga Mission':role==='org-admin'?'Organization Overview':config.name+' Overview'):(titles[location.pathname.split('/').pop()]||config.name);
 if(config.action&&home){let button=document.getElementById('post-fab-btn');if(button){button.className='btn btn-primary';button.textContent=config.action[0];header.querySelector('.workspace-primary').append(button);}else{const a=document.createElement('a');a.className='btn btn-primary';a.href=`/${role}/${config.action[1]}`;a.textContent=config.action[0];header.querySelector('.workspace-primary').append(a);}}
 sidebar.after(header);
 const menu=header.querySelector('.workspace-menu');const close=()=>{document.body.classList.remove('workspace-menu-open');menu.setAttribute('aria-expanded','false');};
 menu.onclick=()=>{const open=document.body.classList.toggle('workspace-menu-open');menu.setAttribute('aria-expanded',String(open));};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('workspace-menu-open')){close();menu.focus();}});
 document.addEventListener('click',e=>{if(!sidebar.contains(e.target)&&!menu.contains(e.target))close();});
 sidebar.addEventListener('click',e=>{if(e.target.closest('a'))close();});
 const tabs=document.querySelector('.donor-tabs');if(tabs){tabs.querySelectorAll('.tab-icon').forEach(el=>el.remove());tabs.querySelector('#tab-board')?.childNodes.forEach(n=>{if(n.nodeType===3)n.textContent=n.textContent.replace('Board','Donations');});}
 if(home&&role==='donor'){
   const metrics=document.createElement('section');metrics.className='workspace-metrics';metrics.setAttribute('aria-label','Donation summary');
   [['Active donations','active-count'],['Verified donations','stat-verified'],['Food received','stat-kg']].forEach(([label,id])=>{const card=document.createElement('div');card.className='workspace-metric';const title=document.createElement('span');title.textContent=label;const value=document.createElement('strong');value.textContent='—';card.append(title,value);metrics.append(card);const source=document.getElementById(id);if(source){const sync=()=>value.textContent=source.textContent;sync();new MutationObserver(sync).observe(source,{childList:true,characterData:true,subtree:true});}});header.after(metrics);
 }
 // Keep existing organization delivery tasks ahead of its longer assistance inbox.
 const inbox=document.getElementById('community-inbox');if(inbox)inbox.parentElement.append(inbox);
 fetchDoc(`users/${session.user.uid}`).then(profile=>{
   const name=profile?.fullName||config.name;sidebar.querySelector('.workspace-user').textContent=name;sidebar.querySelector('.workspace-avatar').textContent=name.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
   const statuses={active:'Aktibo',pending_review:'Pending review',pending_orientation:'Pending orientation',pending_training:'Pending training',rejected:'Hindi naaprubahan',suspended:'Suspended'};
   header.querySelector('.workspace-location').textContent=[statuses[profile?.status]||profile?.status,profile?.sitio,profile?.barangay].filter(Boolean).join(' · ')||config.name;
 }).catch(()=>header.querySelector('.workspace-location').textContent='Hindi makuha ang account details.');
}
