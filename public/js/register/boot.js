// Report initialization failures before users interact with an unwired form.
(() => {
  const script=document.currentScript;
  const main=document.getElementById('reg-main');
  const notice=document.createElement('p');
  notice.className='registration-load-status';
  notice.setAttribute('role','status');
  notice.textContent='Inihahanda ang registration…';
  main.before(notice);
  main.inert=true;
  const timer=setTimeout(()=>{notice.textContent='Matagal mag-load ang registration. Suriin ang internet connection at i-refresh ang pahina.';},15000);
  import(new URL(script.dataset.module,script.src).href).then(()=>{
    clearTimeout(timer);main.inert=false;notice.remove();
    if(['localhost','127.0.0.1'].includes(location.hostname)){
      const hint=document.createElement('p');hint.className='form-hint';hint.textContent='Local preview: ang OTP ay nasa Firebase Auth emulator terminal, hindi ipinapadala sa SMS.';
      main.querySelector('[id$="btn-send-otp"]')?.before(hint);
    }
  }).catch(error=>{
    clearTimeout(timer);console.error('Registration initialization failed',error);
    notice.setAttribute('role','alert');notice.textContent='Hindi ma-load ang registration. Suriin ang internet connection, pagkatapos i-refresh ang pahina. ';
    const retry=document.createElement('button');retry.type='button';retry.className='btn btn-ghost';retry.textContent='I-refresh';retry.onclick=()=>location.reload();notice.append(retry);
  });
})();
