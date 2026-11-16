import { loadLahugSitios, populateSitios } from '../core/lahug-locations.js';
const select=document.getElementById('inp-barangay'), count=document.getElementById('sitio-result-count');
select.addEventListener('change',()=>{
  select.removeAttribute('aria-invalid');select.classList.remove('error');
  const error=document.getElementById('err-barangay');error.textContent='';error.classList.remove('visible');
  document.getElementById('sitio-selected').textContent=select.value?select.value+' · Barangay Lahug':'';
});
async function load(){select.disabled=true;count.textContent='Kinukuha ang 48 sitios…';try{const sitios=await loadLahugSitios();populateSitios(select,sitios);select.disabled=false;count.textContent='48 sitios · Mag-type sa field upang maghanap.';}catch(error){count.textContent=error.message;const retry=document.createElement('button');retry.type='button';retry.className='btn btn-ghost';retry.textContent='Subukan muli';retry.onclick=load;count.append(retry);}}
load();
