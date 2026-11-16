// Progressive enhancement: native selects remain the form's source of truth.
(() => {
  const instances=new Map();
  const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const label=s=>s===s.toUpperCase() && /[A-Z]{3}/.test(s)?s.toLowerCase().replace(/\b\p{L}/gu,c=>c.toUpperCase()).replace(/\b(Bsp|Nga|Tesda)\b/g,s=>s.toUpperCase()):s;
  function enhance(select){
    if(instances.has(select)||select.multiple||select.size>1)return;
    const wrap=document.createElement('div');wrap.className='select-combo';
    const input=document.createElement('input');input.type='text';input.className='select-combo-input';input.autocomplete='off';input.spellcheck=false;
    const id=(select.id||'select-'+instances.size)+'-combo';input.id=id;
    input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');
    const toggle=document.createElement('button');toggle.type='button';toggle.className='select-combo-toggle';toggle.textContent='⌄';toggle.setAttribute('aria-label','Buksan ang pagpipilian');toggle.tabIndex=-1;
    const panel=document.createElement('div');panel.className='select-combo-panel';panel.hidden=true;
    const count=document.createElement('div');count.className='select-combo-count';count.setAttribute('role','status');
    const list=document.createElement('div');list.className='select-combo-list';list.id=id+'-list';list.setAttribute('role','listbox');input.setAttribute('aria-controls',list.id);
    panel.append(count,list);wrap.append(input,toggle,panel);select.after(wrap);
    select.classList.add('select-combo-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
    const labels=[...select.labels];labels.forEach(l=>l.htmlFor=id);
    if(!labels.length)input.setAttribute('aria-label',select.getAttribute('aria-label')||'Pumili');
    let open=false, visible=[],active=-1;
    function sync(){
      input.disabled=select.disabled;toggle.disabled=select.disabled;
      input.setAttribute('aria-required',String(select.required));
      for(const attr of ['aria-invalid','aria-describedby']){const value=select.getAttribute(attr);if(value)input.setAttribute(attr,value);else input.removeAttribute(attr);}
      if(!open)input.value=label(select.selectedOptions[0]?.textContent||'');
      if(open)render();
    }
    function mark(){
      [...list.children].forEach((el,i)=>el.classList.toggle('is-active',i===active));
      if(active>=0&&list.children[active]){input.setAttribute('aria-activedescendant',list.children[active].id);list.children[active].scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');
    }
    function choose(option){select.value=option.value;close();select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));input.focus();}
    function render(){
      const query=normalize(input.value);const options=[...select.options];
      visible=options.filter(o=>!o.hidden&&normalize(o.textContent).includes(query));active=-1;list.replaceChildren();
      const total=options.filter(o=>o.value).length;
      count.textContent=query?`${visible.filter(o=>o.value).length} sa ${total} ang tumugma`:`${total} pagpipilian · Mag-type upang maghanap`;
      visible.forEach((option,i)=>{const item=document.createElement('div');item.id=id+'-option-'+i;item.className='select-combo-option';item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.selected));item.setAttribute('aria-disabled',String(option.disabled||option.parentElement.disabled||false));item.textContent=label(option.textContent)+(option.selected?' ✓':'');item.addEventListener('pointerdown',e=>e.preventDefault());item.addEventListener('click',()=>{if(item.getAttribute('aria-disabled')!=='true')choose(option);});list.append(item);});
      if(!visible.length){const empty=document.createElement('p');empty.className='select-combo-empty';empty.textContent='Walang tugma. Subukan ang ibang pangalan.';list.append(empty);}
      input.removeAttribute('aria-activedescendant');
    }
    function show(){if(select.disabled)return;for(const [s,instance] of instances)if(s!==select)instance.close();open=true;panel.hidden=false;input.value='';input.placeholder='Maghanap o pumili…';input.setAttribute('aria-expanded','true');render();}
    function close(){open=false;panel.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');sync();}
    input.addEventListener('click',()=>{if(!open)show();});
    input.addEventListener('input',()=>{if(!open){open=true;panel.hidden=false;input.setAttribute('aria-expanded','true');}render();});
    toggle.addEventListener('click',()=>{if(open)close();else show();input.focus();});
    input.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();close();return;}
      if(e.key==='Tab'){close();return;}
      if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)&&(open||e.key.startsWith('Arrow'))){e.preventDefault();if(!open)show();const enabled=visible.map((o,i)=>!o.disabled&&!o.parentElement.disabled?i:-1).filter(i=>i>=0);if(!enabled.length)return;const at=enabled.indexOf(active);active=e.key==='Home'?enabled[0]:e.key==='End'?enabled.at(-1):e.key==='ArrowUp'?enabled[Math.max(0,at<0?enabled.length-1:at-1)]:enabled[Math.min(enabled.length-1,at+1)];mark();}
      if(e.key==='Enter'&&open){e.preventDefault();if(active>=0)choose(visible[active]);else if(visible.length===1&&!visible[0].disabled)choose(visible[0]);}
    });
    wrap.addEventListener('focusout',()=>setTimeout(()=>{if(!wrap.contains(document.activeElement))close();},0));
    select.addEventListener('change',sync);select.addEventListener('invalid',e=>{e.preventDefault();input.setAttribute('aria-invalid','true');input.focus();show();});
    select.form?.addEventListener('reset',()=>setTimeout(()=>{close();},0));
    new MutationObserver(sync).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','required','aria-invalid','aria-describedby','selected']});
    instances.set(select,{close,sync});
    for(const prop of ['value','selectedIndex']){const descriptor=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,prop);Object.defineProperty(select,prop,{configurable:true,get(){return descriptor.get.call(this);},set(value){descriptor.set.call(this,value);sync();}});}
    sync();
  }
  function scan(){document.querySelectorAll('select').forEach(enhance);for(const [select]of instances)if(!select.isConnected)instances.delete(select);}
  document.addEventListener('pointerdown',e=>{for(const [select,instance]of instances)if(!select.nextElementSibling?.contains(e.target))instance.close();});
  document.addEventListener('select-options-updated',()=>{for(const instance of instances.values())instance.sync();});
  scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
})();
