import { bootGuardedPage } from '../core/guard-boot.js';
import { loadAdminSession } from '../core/adminSession.js';
import { bindSignOutDialog } from '../core/role-ui.js';
import { signOutCurrentUser } from '../core/auth.js';
import { usersQuery, watchQuery } from '../core/data.js';
import { initInvites } from './adminInvites.js';
bootGuardedPage({roles:['systemAdmin']},async session=>{
  if(!await loadAdminSession(session))return;
  bindSignOutDialog(signOutCurrentUser);initInvites();
  const unsubscribe=watchQuery(usersQuery({max:0}),{
    next(users){const values=[users.length,users.filter(u=>u.role==='lguAdmin').length,users.filter(u=>['pending_review','pending_training','pending_orientation'].includes(u.status)).length];document.querySelectorAll('[data-user-metric]').forEach((el,i)=>el.textContent=values[i]);document.getElementById('user-metrics-status').textContent='Lahat ng kasalukuyang user records';},
    error(){document.querySelectorAll('[data-user-metric]').forEach(el=>el.textContent='—');document.getElementById('user-metrics-status').textContent='Hindi makuha ang mga bilang. I-refresh para subukan muli.';}
  });window.addEventListener('pagehide',unsubscribe,{once:true});
});
