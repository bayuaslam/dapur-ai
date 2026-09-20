function bindRecipeCardEvents(root){
  root.querySelectorAll('[data-open-recipe]').forEach(b=>b.onclick=()=>openRecipeDetail(b.dataset.openRecipe));
  root.querySelectorAll('[data-favorite]').forEach(b=>b.onclick=async(e)=>{e.stopPropagation();const r=state.recipes.find(x=>x.id===b.dataset.favorite);r.favorite=!r.favorite;await db.put(STORE.recipes,r);await refreshState();renderAll();});
}

function renderModal(content, {wide=false, footer=''}={}){
  const root=document.getElementById('modalRoot'); root.innerHTML=`<div class="modal-backdrop" role="presentation"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true">${content}${footer?`<div class="modal-footer">${footer}</div>`:''}</section></div>`;
  root.querySelector('.modal-backdrop').addEventListener('click',e=>{if(e.target===e.currentTarget) closeModal();}); root.querySelectorAll('[data-close-modal]').forEach(b=>b.onclick=closeModal);
  setTimeout(()=>root.querySelector('button,input,select,textarea')?.focus(),0);
}
function closeModal(){ document.getElementById('modalRoot').innerHTML=''; }

function openRecipeDetail(id){
  const r=state.recipes.find(x=>x.id===id); if(!r)return; state.selectedRecipeId=id; const servings=r.servings; const match=recipeMatch(r,servings); const [label,cls]=statusMeta(match.status);
  const media=r.image?.url?`<img src="${escapeHtml(r.image.url)}" alt="${escapeHtml(r.image.alt||r.title)}" loading="lazy" onerror="this.outerHTML='<div class=\'image-fallback\'><strong>Foto gagal dimuat</strong><small>Gunakan unggahan sendiri atau sumber lain.</small></div>'">`:`<div class="image-fallback"><strong>Foto belum tersedia</strong><small>Belum ada aset spesifik yang diverifikasi.</small></div>`;
  renderModal(`<div class="modal-header"><div><p class="eyebrow">${escapeHtml(r.category)}</p><h2>${escapeHtml(r.title)}</h2></div><button class="close-button" data-close-modal aria-label="Tutup">×</button></div>
  <div class="modal-body detail-layout"><div><div class="detail-media">${media}</div><p class="source-note">${r.image?.sourcePageUrl?`Referensi foto berlisensi: <a href="${escapeHtml(r.image.sourcePageUrl)}" target="_blank" rel="noreferrer">Pixabay</a>. ${escapeHtml(r.image.note||'')}`:'Foto belum tersedia.'}</p><p>${escapeHtml(r.description||'')}</p><div class="detail-meta"><span class="status-label ${cls}">${label}</span><span class="meta-chip">${formatDuration(r)} ${r.timeEstimate?'· perkiraan':''}</span><span class="meta-chip">${r.servings} porsi ${r.servingsEstimate?'· perkiraan':''}</span></div><p><strong>Catatan</strong><br>${escapeHtml(r.notes||'Belum ada catatan.')}</p><button class="text-button" id="editCurrentRecipe">Edit resep</button></div>
  <div><div class="field-group"><label for="servingSelect">Porsi yang mau dimasak</label><input id="servingSelect" type="number" min="0.5" step="0.5" value="${servings}"></div><div id="ingredientMatchArea">${ingredientMatchTable(r,servings)}</div><h3>Langkah</h3><ol class="steps-list">${r.steps.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ol></div></div>`,{wide:true,footer:`<button class="secondary-button" id="addMissingBtn">Tambah kekurangan ke belanja</button><button class="primary-button" id="startCookingBtn">Mulai memasak</button>`});
  const serv=document.getElementById('servingSelect'); serv.oninput=()=>{const n=Math.max(.5,Number(serv.value)||r.servings);document.getElementById('ingredientMatchArea').innerHTML=ingredientMatchTable(r,n);};
  document.getElementById('editCurrentRecipe').onclick=()=>openRecipeEditor(r);
  document.getElementById('addMissingBtn').onclick=()=>addMissingToShopping(r,Math.max(.5,Number(serv.value)||r.servings));
  document.getElementById('startCookingBtn').onclick=()=>openCookingMode(r,Math.max(.5,Number(serv.value)||r.servings));
}
function ingredientMatchTable(r,servings){
  const match=recipeMatch(r,servings); return `<h3>Bahan & stok</h3><table class="ingredient-table"><thead><tr><th>Bahan</th><th>Butuh</th><th>Ada</th><th>Status</th></tr></thead><tbody>${match.rows.map(row=>`<tr><td>${escapeHtml(row.ing.name)}${row.ing.optional?' <small>(opsional)</small>':''}</td><td>${row.need.scaledAmount==null?'Takaran belum ada':`${formatAmount(row.need.scaledAmount)} ${escapeHtml(row.ing.unit||'')}`}</td><td>${row.available==null?'—':`${formatAmount(row.available)} ${escapeHtml(row.ing.unit||'')}`}</td><td>${row.status==='ready'?'Cukup':row.status==='check'?'Perlu cek':row.ing.optional?'Opsional tidak ada':`Kurang ${formatAmount(row.shortage)} ${escapeHtml(row.ing.unit||'')}`}</td></tr>`).join('')}</tbody></table>`;
}

function openCookingMode(r,servings){
  const cookingSessionId = safeUUID();
  const usage=recipeMatch(r,servings).rows.filter(x=>!x.ing.optional && x.need.scaledAmount!=null).map(x=>({name:x.ing.name, amount:x.need.scaledAmount, unit:x.ing.unit}));
  renderModal(`<div class="modal-header"><div><p class="eyebrow">Mode memasak</p><h2>${escapeHtml(r.title)}</h2></div><button class="close-button" data-close-modal>×</button></div><div class="modal-body"><p>${servings} porsi. Centang langkah saat selesai.</p>${r.steps.map((s,idx)=>`<label class="cook-step"><input type="checkbox"><p><strong>Langkah ${idx+1}</strong><br>${escapeHtml(s)}</p></label>`).join('')}<div class="warning-box">Membuka mode ini belum mengurangi stok. Stok baru berkurang setelah ringkasan pemakaian dikonfirmasi.</div></div>`,{footer:`<button class="secondary-button" data-close-modal>Batal</button><button class="primary-button" id="finishCookingBtn">Selesai masak</button>`});
  document.querySelectorAll('.cook-step input').forEach(c=>c.onchange=()=>c.closest('.cook-step').classList.toggle('done',c.checked));
  document.getElementById('finishCookingBtn').onclick=()=>openUsageSummary(r,servings,usage,cookingSessionId);
}
function openUsageSummary(r,servings,usage,cookingSessionId){
  const rows=usage.map((u,idx)=>`<div class="parse-grid"><div class="field-group"><label>Bahan</label><input value="${escapeHtml(u.name)}" data-use-name="${idx}" readonly></div><div class="field-group"><label>Jumlah aktual</label><input type="number" min="0" step="0.01" value="${u.amount}" data-use-amount="${idx}"></div><div class="field-group"><label>Satuan</label><input value="${escapeHtml(u.unit||'')}" data-use-unit="${idx}" readonly></div></div>`).join('');
  renderModal(`<div class="modal-header"><div><p class="eyebrow">Konfirmasi pemakaian</p><h2>${escapeHtml(r.title)}</h2></div><button class="close-button" data-close-modal>×</button></div><div class="modal-body"><p>Koreksi jumlah yang benar-benar dipakai. Sistem tidak akan membuat stok negatif.</p>${rows}</div>`,{footer:`<button class="secondary-button" data-close-modal>Batal</button><button class="primary-button" id="confirmUsageBtn">Konfirmasi kurangi stok</button>`});
  document.getElementById('confirmUsageBtn').onclick=async()=>{
    const btn=document.getElementById('confirmUsageBtn'); if(btn.disabled) return; btn.disabled=true; btn.textContent='Menyimpan…';
    const actual=usage.map((u,idx)=>({...u,amount:Number(document.querySelector(`[data-use-amount="${idx}"]`).value)||0}));
    try { await confirmUsage(r,servings,actual,cookingSessionId); closeModal(); toast('Stok diperbarui. Bisa dibatalkan dari riwayat pemakaian.'); }
    catch(e){ btn.disabled=false; btn.textContent='Konfirmasi kurangi stok'; toast(e.message||'Stok belum bisa dikurangi.'); }
  };
}
async function confirmUsage(recipe,servings,actual,idempotencyKey){
  const existing=await db.get(STORE.transactions,idempotencyKey); if(existing?.status==='confirmed') return;
  const decrements=[];
  for(const use of actual){
    let left=use.amount; if(left<=0)continue; const batches=matchingStock(use.name).filter(s=>convertAmount(s.amount,s.unit,use.unit)!=null).sort((a,b)=>daysUntil(a.expiresAt)-daysUntil(b.expiresAt));
    const total=batches.reduce((sum,s)=>sum+convertAmount(s.amount,s.unit,use.unit),0); if(total+1e-9<left) throw new Error(`${use.name}: stok tidak cukup untuk ${formatAmount(use.amount)} ${use.unit}.`);
    for(const batch of batches){ if(left<=0)break; const availableInUse=convertAmount(batch.amount,batch.unit,use.unit); const take=Math.min(left,availableInUse); const takeInBatch=convertAmount(take,use.unit,batch.unit); decrements.push({stockId:batch.id,before:batch.amount,take:takeInBatch,unit:batch.unit,name:batch.name}); left-=take; }
  }
  for(const d of decrements){ const s=state.stock.find(x=>x.id===d.stockId); const next=Math.max(0,s.amount-d.take); await db.put(STORE.stock,{...s,amount:next,updatedAt:new Date().toISOString()}); }
  await db.put(STORE.transactions,{id:idempotencyKey,idempotencyKey,recipeId:recipe.id,recipeTitle:recipe.title,servings,actual,decrements,status:'confirmed',createdAt:new Date().toISOString()}); await refreshState(); renderAll();
}

async function addMissingToShopping(r,servings){
  const match=recipeMatch(r,servings); const missing=match.rows.filter(x=>!x.ing.optional && x.status==='missing' && x.shortage>0);
  if(!missing.length){toast('Tidak ada kekurangan terukur untuk ditambahkan.');return;}
  for(const row of missing) await mergeShopping({name:row.ing.name,amount:row.shortage,unit:row.ing.unit,recipeTitle:r.title});
  await refreshState();renderAll();toast(`${missing.length} bahan ditambahkan ke daftar belanja.`);
}
async function mergeShopping(item){
  const same=state.shopping.find(x=>!x.checked && normalizeName(x.name)===normalizeName(item.name) && unitGroup(x.unit) && unitGroup(x.unit)===unitGroup(item.unit));
  if(same){ const converted=convertAmount(item.amount,item.unit,same.unit); await db.put(STORE.shopping,{...same,amount:same.amount+converted,updatedAt:new Date().toISOString()}); }
  else await db.put(STORE.shopping,{id:safeUUID(),checked:false,createdAt:new Date().toISOString(),...item});
}