function i(name, amount, unit, optional=false, note='') { return { id: crypto.randomUUID(), name, amount, unit, optional, note }; }
function normalizeUnit(unit='') { const u = String(unit).trim().toLowerCase(); return UNIT_ALIASES[u] || u; }
function unitGroup(unit) { const normalized = normalizeUnit(unit); return Object.entries(UNIT_GROUPS).find(([,map]) => normalized in map)?.[0] || null; }
function convertAmount(amount, fromUnit, toUnit) {
  const f = normalizeUnit(fromUnit), t = normalizeUnit(toUnit); const g = unitGroup(f);
  if (!g || g !== unitGroup(t)) return null;
  return amount * UNIT_GROUPS[g][f] / UNIT_GROUPS[g][t];
}
function normalizeName(name='') {
  let n = name.toLowerCase().trim().replace(/\s+/g,' ');
  return NAME_ALIASES.get(n) || n;
}
function formatAmount(n) { if (n == null || Number.isNaN(n)) return '—'; return Number.isInteger(n) ? String(n) : String(Math.round(n*100)/100).replace('.', ','); }
function formatDuration(recipe) { return `${(recipe.prepMinutes||0)+(recipe.cookMinutes||0)} mnt`; }
function escapeHtml(s='') { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

class DB {
  constructor(){ this.db=null; }
  async open(){
    this.db = await new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{ const db=req.result; Object.values(STORE).forEach(s=>{ if(!db.objectStoreNames.contains(s)) db.createObjectStore(s,{keyPath:'id'}); }); };
      req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
    });
  }
  tx(store, mode='readonly'){ return this.db.transaction(store,mode).objectStore(store); }
  async all(store){ return new Promise((res,rej)=>{ const r=this.tx(store).getAll(); r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error); }); }
  async get(store,id){ return new Promise((res,rej)=>{ const r=this.tx(store).get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error); }); }
  async put(store,value){ return new Promise((res,rej)=>{ const r=this.tx(store,'readwrite').put(value);r.onsuccess=()=>res(value);r.onerror=()=>rej(r.error); }); }
  async delete(store,id){ return new Promise((res,rej)=>{ const r=this.tx(store,'readwrite').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error); }); }
}

const db = new DB();
const state = { recipes: [], stock: [], shopping: [], transactions: [], view:'home', recFilter:'all', selectedRecipeId:null };

async function init(){
  try {
    await db.open();
    const recipes = await db.all(STORE.recipes);
    if (!recipes.length) { for (const r of seedRecipes) await db.put(STORE.recipes, structuredClone(r)); }
    await refreshState(); bindStaticEvents(); renderAll();
  } catch (err) {
    document.querySelector('#main').innerHTML = `<div class="empty-state"><strong>Data lokal gagal dibuka</strong><p>${escapeHtml(err?.message || 'IndexedDB tidak tersedia.')}</p></div>`;
  }
}

async function refreshState(){
  [state.recipes,state.stock,state.shopping,state.transactions] = await Promise.all([
    db.all(STORE.recipes), db.all(STORE.stock), db.all(STORE.shopping), db.all(STORE.transactions)
  ]);
}

function ingredientNeed(recipe, ingredient, servings=recipe.servings){
  if (ingredient.amount == null) return { ...ingredient, scaledAmount:null };
  return { ...ingredient, scaledAmount: ingredient.amount * (servings / recipe.servings) };
}

function matchingStock(name){ const n=normalizeName(name); return state.stock.filter(s=>normalizeName(s.name)===n && s.amount>0); }
function matchIngredient(recipe, ing, servings=recipe.servings){
  const need=ingredientNeed(recipe,ing,servings); const matches=matchingStock(ing.name);
  if (need.scaledAmount == null) return { status:'check', need, available:null, shortage:null, reason:'Takaran resep belum tersedia.' };
  if (!matches.length) return { status: ing.optional ? 'optional-missing':'missing', need, available:0, shortage:need.scaledAmount, reason:'Belum ada di stok.' };
  let available=0, comparable=false;
  for(const s of matches){ const c=convertAmount(s.amount,s.unit,ing.unit); if(c!=null){ available+=c; comparable=true; } }
  if(!comparable) return { status:'check', need, available:null, shortage:null, reason:'Satuan stok tidak bisa dibandingkan otomatis.' };
  if(available+1e-9>=need.scaledAmount) return { status:'ready', need, available, shortage:0, reason:'Stok cukup.' };
  return { status: ing.optional?'optional-missing':'missing', need, available, shortage:Math.max(0,need.scaledAmount-available), reason:'Stok belum cukup.' };
}

function recipeMatch(recipe, servings=recipe.servings){
  const rows=recipe.ingredients.map(ing=>({ing, ...matchIngredient(recipe,ing,servings)}));
  const required=rows.filter(r=>!r.ing.optional); const checks=required.filter(r=>r.status==='check'); const missing=required.filter(r=>r.status==='missing');
  let status='ready';
  if(checks.length) status='check';
  else if(missing.length){ const ratio=missing.length/Math.max(1,required.length); status=ratio<=0.25 && missing.length<=3 ? 'close' : 'missing'; }
  const expiryBoost = recipe.ingredients.some(ing=>matchingStock(ing.name).some(s=>daysUntil(s.expiresAt)<=3));
  const score = required.reduce((sum,r)=>sum+(r.status==='ready'?1:0),0)/Math.max(1,required.length) + (expiryBoost?0.08:0);
  return { status, rows, missing, checks, expiryBoost, score };
}
function statusMeta(status){
  return {
    ready:['Bisa dimasak sekarang','status-ready'], close:['Kurang sedikit','status-close'], check:['Perlu cek takaran','status-check'], missing:['Belum cukup bahan','status-missing']
  }[status];
}
function daysUntil(date){ if(!date) return Infinity; const d=new Date(date+'T23:59:59'); return Math.ceil((d-Date.now())/86400000); }

function renderAll(){ renderRecipes(); renderStock(); renderUsageHistory(); renderShopping(); renderRecommendations(); renderExpiry(); updateCounts(); }
function switchView(view){ state.view=view; document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${view}`)); document.querySelectorAll('.nav-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===view)); window.scrollTo({top:0,behavior:'smooth'}); }

function recipeCard(recipe){
  const m=recipeMatch(recipe), [label,cls]=statusMeta(m.status); const media = recipe.image?.url
    ? `<img src="${escapeHtml(recipe.image.url)}" alt="${escapeHtml(recipe.image.alt||recipe.title)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'image-fallback',innerHTML:'<strong>Foto gagal dimuat</strong><small>Gunakan unggahan sendiri atau sumber lain.</small>'}))">`
    : `<div class="image-fallback"><strong>Foto belum tersedia</strong><small>${recipe.image?.sourcePageUrl?'Sumber berlisensi sudah dicatat':'Unggah foto sendiri'}</small></div>`;
  return `<article class="recipe-card" data-recipe-id="${recipe.id}">
    <div class="recipe-media">${media}<button class="favorite-button ${recipe.favorite?'active':''}" data-favorite="${recipe.id}" aria-label="${recipe.favorite?'Hapus dari':'Tambah ke'} favorit" title="Favorit">${recipe.favorite?'♥':'♡'}</button></div>
    <div class="recipe-body"><span class="status-label ${cls}">${label}</span>
      <div class="recipe-topline"><button class="recipe-title-button" data-open-recipe="${recipe.id}">${escapeHtml(recipe.title)}</button></div>
      <p class="recipe-description">${escapeHtml(recipe.description||'')}</p>
      <div class="meta-row"><span>${formatDuration(recipe)} ${recipe.timeEstimate?'<em class="badge-estimate">perkiraan</em>':''}</span><span>${recipe.servings} porsi ${recipe.servingsEstimate?'<em class="badge-estimate">perkiraan</em>':''}</span><span>${escapeHtml(recipe.category)}</span></div>
    </div></article>`;
}

function renderRecipes(){
  const grid=document.getElementById('recipeGrid'); if(!grid) return;
  const q=(document.getElementById('recipeSearch')?.value||'').toLowerCase(); const cat=document.getElementById('categoryFilter')?.value||'all'; const fav=document.getElementById('favoriteOnly')?.checked||false;
  const recipes=state.recipes.filter(r=>(!q || r.title.toLowerCase().includes(q)||r.ingredients.some(i=>i.name.toLowerCase().includes(q)))&&(cat==='all'||r.category===cat)&&(!fav||r.favorite));
  grid.innerHTML=recipes.length?recipes.map(recipeCard).join(''):`<div class="empty-state"><strong>Tidak ada resep yang cocok</strong><p>Coba kata kunci atau filter lain.</p></div>`;
  bindRecipeCardEvents(grid);
  const sel=document.getElementById('categoryFilter'); if(sel && sel.options.length===1){ [...new Set(state.recipes.map(r=>r.category))].sort().forEach(c=>sel.add(new Option(c,c))); }
}

function renderRecommendations(){
  const root=document.getElementById('homeRecommendations'); if(!root) return;
  let list=state.recipes.map(r=>({r,m:recipeMatch(r)})).sort((a,b)=>(b.m.expiryBoost-a.m.expiryBoost)||(b.m.score-a.m.score));
  if(state.recFilter==='ready') list=list.filter(x=>x.m.status==='ready'); if(state.recFilter==='close') list=list.filter(x=>x.m.status==='close');
  root.innerHTML=list.length?list.slice(0,6).map(x=>recipeCard(x.r)).join(''):`<div class="empty-state"><strong>Belum ada resep di kelompok ini</strong><p>Tambah atau koreksi stok untuk memperbarui rekomendasi.</p></div>`;
  bindRecipeCardEvents(root);
}

function renderExpiry(){
  const root=document.getElementById('expiringList'); const soon=state.stock.filter(s=>daysUntil(s.expiresAt)<=5).sort((a,b)=>daysUntil(a.expiresAt)-daysUntil(b.expiresAt)).slice(0,6);
  root.innerHTML=soon.length?soon.map(s=>`<div class="compact-item"><strong>${escapeHtml(s.name)}</strong><small>${formatAmount(s.amount)} ${escapeHtml(s.unit)} · ${daysUntil(s.expiresAt)<0?'melewati tanggal':daysUntil(s.expiresAt)===0?'hari ini':`${daysUntil(s.expiresAt)} hari lagi`}</small></div>`).join(''):'Belum ada bahan dengan tanggal kedaluwarsa dekat.';
}

function renderStock(){
  const wrap=document.getElementById('stockTableWrap'); if(!wrap) return; const q=(document.getElementById('stockSearch')?.value||'').toLowerCase(); const loc=document.getElementById('stockLocationFilter')?.value||'all';
  const rows=state.stock.filter(s=>(!q||s.name.toLowerCase().includes(q))&&(loc==='all'||s.location===loc)).sort((a,b)=>a.name.localeCompare(b.name));
  if(!rows.length){ wrap.innerHTML=`<div class="empty-state"><strong>Belum ada stok tercatat</strong><p>Tambah bahan satu per satu atau gunakan input cepat di atas.</p></div>`; return; }
  wrap.innerHTML=`<table class="stock-table"><thead><tr><th>Bahan</th><th>Jumlah</th><th>Simpan</th><th>Kedaluwarsa</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(s=>{
    const low=s.lowStockThreshold!=null && s.amount<=s.lowStockThreshold; const d=daysUntil(s.expiresAt); const status=d<=3?'Pakai dulu':low?'Menipis':'Aman';
    return `<tr><td data-label="Bahan"><span class="stock-name">${escapeHtml(s.name)}</span>${s.note?`<span class="stock-sub">${escapeHtml(s.note)}</span>`:''}</td><td data-label="Jumlah">${formatAmount(s.amount)} ${escapeHtml(s.unit)}</td><td data-label="Simpan">${escapeHtml(cap(s.location))}</td><td data-label="Kedaluwarsa">${s.expiresAt?formatDate(s.expiresAt):'—'}</td><td data-label="Status">${status}</td><td><div class="row-actions"><button data-edit-stock="${s.id}">Edit</button><button data-delete-stock="${s.id}">Hapus</button></div></td></tr>`;
  }).join('')}</tbody></table>`;
  wrap.querySelectorAll('[data-edit-stock]').forEach(b=>b.onclick=()=>openStockModal(state.stock.find(s=>s.id===b.dataset.editStock)));
  wrap.querySelectorAll('[data-delete-stock]').forEach(b=>b.onclick=async()=>{ if(confirm('Hapus stok ini?')){await db.delete(STORE.stock,b.dataset.deleteStock);await refreshState();renderAll();toast('Stok dihapus.');} });
}


function renderUsageHistory(){
  const root=document.getElementById('usageHistory'); if(!root)return;
  const items=[...state.transactions].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,8);
  if(!items.length){ root.innerHTML=`<div class="empty-state"><strong>Belum ada pemakaian stok</strong><p>Riwayat muncul setelah tombol “Selesai masak” dikonfirmasi.</p></div>`; return; }
  root.innerHTML=items.map(t=>`<div class="shopping-item"><div aria-hidden="true">${t.status==='reverted'?'↶':'✓'}</div><div><strong>${escapeHtml(t.recipeTitle||'Pemakaian stok')}</strong><small>${formatDateTime(t.createdAt)} · ${t.servings||'—'} porsi · ${t.status==='reverted'?'dibatalkan':'stok dikurangi'}</small></div>${t.status==='confirmed'?`<button class="text-button" data-revert-usage="${t.id}">Batalkan transaksi</button>`:'<span class="helper">Sudah dibatalkan</span>'}</div>`).join('');
  root.querySelectorAll('[data-revert-usage]').forEach(b=>b.onclick=()=>revertUsage(b.dataset.revertUsage));
}
async function revertUsage(id){
  const t=state.transactions.find(x=>x.id===id); if(!t||t.status!=='confirmed')return;
  if(!confirm(`Batalkan pemakaian stok untuk “${t.recipeTitle}”?`)) return;
  for(const d of (t.decrements||[])){ const s=await db.get(STORE.stock,d.stockId); if(s) await db.put(STORE.stock,{...s,amount:s.amount+d.take,updatedAt:new Date().toISOString()}); }
  await db.put(STORE.transactions,{...t,status:'reverted',revertedAt:new Date().toISOString()}); await refreshState();renderAll();toast('Transaksi dibatalkan dan stok dikembalikan.');
}

function renderShopping(){
  const root=document.getElementById('shoppingList'); if(!root)return;
  if(!state.shopping.length){ root.innerHTML=`<div class="empty-state"><strong>Daftar belanja masih kosong</strong><p>Tambahkan kekurangan dari detail resep atau masukkan item manual.</p></div>`; return; }
  root.innerHTML=state.shopping.sort((a,b)=>a.checked-b.checked).map(x=>`<div class="shopping-item"><input type="checkbox" ${x.checked?'checked':''} data-shopping-check="${x.id}" aria-label="Tandai ${escapeHtml(x.name)} terbeli"><div><strong>${escapeHtml(x.name)}</strong><small>${x.amount!=null?`${formatAmount(x.amount)} ${escapeHtml(x.unit||'')}`:'Jumlah belum ditentukan'}${x.recipeTitle?` · dari ${escapeHtml(x.recipeTitle)}`:''}</small></div><button class="text-button" data-shopping-delete="${x.id}">Hapus</button></div>`).join('');
  root.querySelectorAll('[data-shopping-check]').forEach(c=>c.onchange=()=>{ const item=state.shopping.find(x=>x.id===c.dataset.shoppingCheck); if(c.checked) openPurchaseModal(item); else updateShopping(item.id,{checked:false}); });
  root.querySelectorAll('[data-shopping-delete]').forEach(b=>b.onclick=async()=>{await db.delete(STORE.shopping,b.dataset.shoppingDelete);await refreshState();renderAll();});
}
function updateCounts(){ const n=state.shopping.filter(x=>!x.checked).length; const badge=document.getElementById('shoppingCount'); badge.hidden=!n; badge.textContent=n; }

function bindStaticEvents(){
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  document.querySelectorAll('[data-rec-filter]').forEach(b=>b.addEventListener('click',()=>{state.recFilter=b.dataset.recFilter;document.querySelectorAll('[data-rec-filter]').forEach(x=>x.classList.toggle('active',x===b));renderRecommendations();}));
  document.getElementById('findFromStockBtn').onclick=()=>{document.getElementById('readyTitle').scrollIntoView({behavior:'smooth'});};
  document.getElementById('recipeSearch').oninput=renderRecipes; document.getElementById('categoryFilter').onchange=renderRecipes; document.getElementById('favoriteOnly').onchange=renderRecipes;
  document.getElementById('stockSearch').oninput=renderStock; document.getElementById('stockLocationFilter').onchange=renderStock;
  document.getElementById('manualStockBtn').onclick=()=>openStockModal(); document.getElementById('parseStockBtn').onclick=parseStockInput;
  document.getElementById('addRecipeBtn').onclick=()=>openRecipeEditor(); document.getElementById('importRecipeBtn').onclick=openImportRecipe;
  document.getElementById('addShoppingBtn').onclick=()=>openShoppingModal(); document.getElementById('exportBtn').onclick=exportData;
}