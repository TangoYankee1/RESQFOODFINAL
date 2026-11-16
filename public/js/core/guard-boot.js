import { installWorkspace } from './workspace-shell.js';
import { requirePage } from './router.js';
import { installDashboardTools } from './dashboard-tools.js';
export async function bootGuardedPage(opts, init) {
  let timer;
  try {
    if(location.pathname.startsWith('/app-admin/')) opts={...opts,roles:['systemAdmin']};
    const session=await Promise.race([requirePage(opts),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('session-timeout')),18000);})]);
    clearTimeout(timer);
    await Promise.race([Promise.resolve().then(()=>typeof init==='function'?init(session):null),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('initialization-timeout')),18000);})]);
    clearTimeout(timer);
    installWorkspace(session);
    document.documentElement.hidden=false;
    document.documentElement.dataset.pageReady='1';
    window.dashboardBoot?.ready();
    installDashboardTools(session);
    return session;
  } catch(error) {
    clearTimeout(timer);
    if(error?.code==='guard-redirect')return null;
    console.error('Dashboard initialization failed',error);
    document.documentElement.hidden=false;
    window.dashboardBoot?.fail('Hindi ma-load ang dashboard. Suriin ang koneksyon, subukan muli, o mag-sign in.');
    return null;
  }
}
