import { fetchDoc } from './data.js';
const definitions = {
  donor: ['Donor', [['Mag-post ng Pagkain','post.html'],['Kasaysayan','history.html']]],
  volunteer: ['Volunteer', [['Mga Mission','index.html'],['Pickup Scanner','scanner.html'],['Kasaysayan','history.html']]],
  'org-admin': ['Organization', [['Paparating na Delivery','index.html'],['I-verify ang Receipt','verify.html'],['Kasaysayan','history.html']]],
  'lgu-admin': ['LGU Admin', [['Mga User','users.html'],['Reports','reports.html'],['Audit Trail','audit.html']]],
  admin: ['Admin', [['Mga User','users.html'],['Donations','donations.html'],['Audit Trail','audit.html']]],
  'app-admin': ['App Admin', [['Mga User','users.html'],['Review Applications','index.html#verification-review-table'],['Global Audit','audit.html'],['LGU Invitations','index.html#invite-form']]],
};
export function installDashboardTools(session) {
  if(document.getElementById('dashboard-tools')) return;
  const role=location.pathname.split('/')[1], definition=definitions[role];
  const main=document.querySelector('main'); if(!main || !definition)return;
  main.id ||= 'dashboard-main'; main.tabIndex=-1;
  const skip=document.createElement('a'); skip.className='skip-link';skip.href='#'+main.id;skip.textContent='Lumaktaw sa pangunahing nilalaman';document.body.prepend(skip);
  const tools=document.createElement('section');tools.id='dashboard-tools';tools.className='dashboard-tools';
  main.prepend(tools);
  document.querySelectorAll('nav a').forEach(a=>{if(!a.closest('.workspace-sidebar') && new URL(a.href).pathname===location.pathname && !new URL(a.href).hash)a.setAttribute('aria-current','page');});
  const targets=[...document.querySelectorAll('#active-list,#completed-list,#history-list,#panel-available,#panel-my,#panel-incoming,#panel-verified,tbody')];
  if(!targets.length)return;
  const label=document.createElement('label');label.htmlFor='dashboard-search';label.className='dashboard-search-label';label.textContent='Hanapin sa mga naka-load na rekord';tools.append(label);
  const row=document.createElement('div');row.className='dashboard-search';
  const input=document.createElement('input');input.type='search';input.id='dashboard-search';input.className='form-input';input.placeholder='Pagkain, pangalan, lugar o status…';input.value=new URL(location.href).searchParams.get('q')||'';
  const clear=document.createElement('button');clear.type='button';clear.className='btn btn-ghost';clear.textContent='I-clear';row.append(input,clear);tools.append(row);
  const note=document.createElement('p');note.className='dashboard-filter-note';note.setAttribute('role','status');tools.append(note);
  function filter(){const q=input.value.trim().toLocaleLowerCase();let total=0,matched=0;targets.forEach(target=>{[...target.children].forEach(item=>{if(!item.matches('.donation-card,.mission-card,.delivery-card,.verified-card,tr')||item.querySelector('td[colspan]'))return;const match=!q||item.textContent.toLocaleLowerCase().includes(q);item.classList.toggle('dashboard-filtered',!match);if(!target.closest('[hidden],.hidden')){total++;if(match)matched++;}});});const message=q?(total?`${matched} sa ${total} naka-load na rekord ang tumugma.`:'Wala pang naka-load na rekord sa view na ito.'):' ';if(note.textContent!==message)note.textContent=message;}
  input.addEventListener('input',()=>{const url=new URL(location.href);if(input.value)url.searchParams.set('q',input.value);else url.searchParams.delete('q');history.replaceState(null,'',url);filter();});
  clear.onclick=()=>{input.value='';input.dispatchEvent(new Event('input'));input.focus();};
  targets.forEach(target=>new MutationObserver(filter).observe(target,{childList:true,subtree:true,characterData:true}));
  document.querySelectorAll('[role="tab"]').forEach(tab=>tab.addEventListener('click',filter));
  filter();
}
