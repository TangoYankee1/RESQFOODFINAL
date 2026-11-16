// All sitio selectors use this loader, independent of Firebase and organization coverage.
let pending;
export function loadLahugSitios() {
  if (!pending) pending = (async () => {
    const response = await fetch('/data/lahug-sitios.json', { cache:'no-cache' });
    if (!response.ok) throw new Error('Hindi ma-load ang 48 sitios. Subukan muli.');
    const list = await response.json();
    if (!Array.isArray(list) || list.length !== 48 || list.some(s=>typeof s!=='string' || !s.trim()) || new Set(list).size !== 48) throw new Error('Hindi kumpleto ang sitio list. Kailangan ang lahat ng 48 sitios.');
    return Object.freeze(list);
  })().catch(error=>{ pending=undefined; throw error; });
  return pending;
}
export const normalizeSitio = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function populateSitios(select, list, placeholder='Piliin ang iyong sitio') {
  const selected=select.value;
  select.replaceChildren(new Option(placeholder,''), ...list.map(s=>new Option(s,s)));
  select.value=list.includes(selected)?selected:'';
}
