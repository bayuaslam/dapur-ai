function openRecipeEditor(existing=null, draft=null){
  const r=safeClone(existing||draft||{id:safeUUID(),title:'',category:'Lainnya',mainIngredient:'',description:'',servings:2,servingsEstimate:false,prepMinutes:null,cookMinutes:null,timeEstimate:false,favorite:false,image:{type:'placeholder',exactMatch:false,alt:'',sourcePageUrl:'',creator:'',...pixabayLicense},source:{type:'manual',label:'Input manual'},ingredients:[],steps:[],notes:''});
  renderModal(`<div class="modal-header"><div><p class="eyebrow">${existing?'Edit':'Resep baru'}</p><h2>${existing?'Edit resep':'Tambah resep'}</h2></div><button class="close-button" data-close-modal>×</button></div><form id="recipeForm" class="modal-body form-grid"><div class="field-group full"><label>Nama resep</label><input name="title" required value="${escapeHtml(r.title)}"></div><div class="field-group"><label>Kategori</label><input name="category" value="${escapeHtml(r.category||'')}"></div><div class="field-group"><label>Bahan utama</label><input name="mainIngredient" value="${escapeHtml(r.mainIngredient||'')}"></div><div class="field-group full"><label>Deskripsi</label><textarea name="description" rows="2">${escapeHtml(r.description||'')}</textarea></div><div class="field-group"><label>Porsi</label><input name="servings" type="number" min="0.5" step="0.5" value="${r.servings||''}"></div><div class="field-group"><label><input name="servingsEstimate" type="checkbox" ${r.servingsEstimate?'checked':''} style="width:auto"> Porsi ini perkiraan</label></div><div class="field-group"><label>Persiapan (menit)</label><input name="prepMinutes" type="number" min="0" value="${r.prepMinutes??''}"></div><div class="field-group"><label>Masak (menit)</label><input name="cookMinutes" type="number" min="0" value="${r.cookMinutes??''}"></div><div class="field-group full"><label><input name="timeEstimate" type="checkbox" ${r.timeEstimate?'checked':''} style="width:auto"> Waktu ini perkiraan</label></div><div class="field-group full"><label>URL foto langsung (opsional)</label><input name="imageUrl" type="url" value="${escapeHtml(r.image?.url||'')}" placeholder="https://…"><small class="helper">Kosongkan jika belum ada aset internet dengan lisensi yang sudah diverifikasi.</small></div><div class="field-group full"><label>Halaman sumber foto</label><input name="imageSource" type="url" value="${escapeHtml(r.image?.sourcePageUrl||'')}"></div><div class="field-group full"><label>Alt text foto</label><input name="imageAlt" value="${escapeHtml(r.image?.alt||'')}"></div><div class="field-group full"><label>Bahan</label><div id="ingredientEditor" class="dynamic-list">${r.ingredients.map(ingredientEditorRow).join('')}</div><button type="button" class="text-button" id="addIngredientRow">+ Tambah bahan</button></div><div class="field-group full"><label>Langkah</label><div id="stepEditor" class="dynamic-list">${r.steps.map(stepEditorRow).join('')}</div><button type="button" class="text-button" id="addStepRow">+ Tambah langkah</button></div><div class="field-group full"><label>Catatan pribadi</label><textarea name="notes" rows="3">${escapeHtml(r.notes||'')}</textarea></div></form>`,{wide:true,footer:`${existing?'<button class="danger-button" id="deleteRecipeBtn">Hapus resep</button>':''}<button class="secondary-button" data-close-modal>Batal</button><button class="primary-button" id="saveRecipeBtn">Simpan resep</button>`});
  document.getElementById('addIngredientRow').onclick=()=>document.getElementById('ingredientEditor').insertAdjacentHTML('beforeend',ingredientEditorRow(i('',null,'')));
  document.getElementById('addStepRow').onclick=()=>document.getElementById('stepEditor').insertAdjacentHTML('beforeend',stepEditorRow(''));
  document.getElementById('recipeForm').addEventListener('click',e=>{ if(e.target.matches('[data-remove-dynamic]')) e.target.closest('.dynamic-row').remove(); });
  document.getElementById('saveRecipeBtn').onclick=()=>document.getElementById('recipeForm').requestSubmit();
  document.getElementById('recipeForm').onsubmit=async e=>{e.preventDefault(); const fd=new FormData(e.currentTarget); r.title=String(fd.get('title')).trim();r.category=String(fd.get('category')).trim()||'Lainnya';r.mainIngredient=String(fd.get('mainIngredient')).trim();r.description=String(fd.get('description')).trim();r.servings=Number(fd.get('servings'))||1;r.servingsEstimate=fd.get('servingsEstimate')==='on';r.prepMinutes=fd.get('prepMinutes')===''?null:Number(fd.get('prepMinutes'));r.cookMinutes=fd.get('cookMinutes')===''?null:Number(fd.get('cookMinutes'));r.timeEstimate=fd.get('timeEstimate')==='on';r.notes=String(fd.get('notes')).trim();r.image={...r.image,type:fd.get('imageUrl')?'internet':'placeholder',url:String(fd.get('imageUrl')||'').trim()||undefined,sourcePageUrl:String(fd.get('imageSource')||'').trim(),alt:String(fd.get('imageAlt')||'').trim()||r.title};r.ingredients=[...document.querySelectorAll('#ingredientEditor .dynamic-row')].map(row=>({id:safeUUID(),name:row.querySelector('[data-ing-name]').value.trim(),amount:row.querySelector('[data-ing-amount]').value===''?null:Number(row.querySelector('[data-ing-amount]').value),unit:normalizeUnit(row.querySelector('[data-ing-unit]').value),optional:row.querySelector('[data-ing-optional]').checked,note:''})).filter(x=>x.name);r.steps=[...document.querySelectorAll('#stepEditor [data-step-text]')].map(x=>x.value.trim()).filter(Boolean);r.updatedAt=new Date().toISOString();r.createdAt=r.createdAt||r.updatedAt;await db.put(STORE.recipes,r);await refreshState();renderAll();closeModal();toast('Resep disimpan.');};
  if(existing) document.getElementById('deleteRecipeBtn').onclick=async()=>{if(confirm(`Hapus resep “${r.title}”?`)){await db.delete(STORE.recipes,r.id);await refreshState();renderAll();closeModal();toast('Resep dihapus.');}};
}
function ingredientEditorRow(ing){ return `<div class="dynamic-row"><input data-ing-name placeholder="Nama bahan" value="${escapeHtml(ing.name||'')}"><input data-ing-amount type="number" step="0.01" placeholder="Jumlah" value="${ing.amount??''}"><input data-ing-unit placeholder="Satuan" value="${escapeHtml(ing.unit||'')}"><label class="check-label"><input data-ing-optional type="checkbox" ${ing.optional?'checked':''}> Opsional</label><button type="button" class="small-icon" data-remove-dynamic>×</button></div>`; }
function stepEditorRow(step){ return `<div class="dynamic-row step"><textarea data-step-text rows="2" placeholder="Langkah memasak…">${escapeHtml(step||'')}</textarea><button type="button" class="small-icon" data-remove-dynamic>×</button></div>`; }

function openImportRecipe(){
  renderModal(`<div class="modal-header"><div><p class="eyebrow">Impor resep</p><h2>Tempel teks atau percakapan</h2></div><button class="close-button" data-close-modal>×</button></div><div class="modal-body"><div class="warning-box"><strong>AI belum terhubung.</strong> Versi ini memakai ekstraksi lokal sederhana dan tidak mengarang takaran atau waktu yang tidak ada.</div><label for="importText"><strong>Teks resep</strong></label><textarea id="importText" rows="14" placeholder="Tempel resep di sini…"></textarea></div>`,{footer:`<button class="secondary-button" data-close-modal>Batal</button><button class="primary-button" id="extractRecipeBtn">Tinjau hasil ekstraksi</button>`});
  document.getElementById('extractRecipeBtn').onclick=()=>{const text=document.getElementById('importText').value.trim();if(!text){toast('Tempel teks resep dulu.');return;}const draft=parseRecipeText(text);openRecipeEditor(null,draft);};
}

function parseIdNumber(s){
  s = String(s == null ? '' : s).trim().replace(/\s+/g, ' ');
  var m = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (m) { var b = Number(m[3]); if (b > 0) return Number(m[1]) + Number(m[2]) / b; }
  m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) { var d = Number(m[2]); if (d > 0) return Number(m[1]) / d; }
  var v = parseFloat(s.replace(',', '.'));
  return isNaN(v) ? null : v;
}
function isKnownUnit(u){
  try {
    u = String(u || '').trim().toLowerCase();
    if (!u) return false;
    if (typeof UNIT_GROUPS !== 'undefined') {
      var keys = Object.keys(UNIT_GROUPS).map(function (g) { return Object.keys(UNIT_GROUPS[g]); });
      var flat = []; keys.forEach(function (k) { flat = flat.concat(k); });
      if (flat.indexOf(u) >= 0) return true;
    }
    if (typeof UNIT_ALIASES !== 'undefined' && UNIT_ALIASES[u]) return true;
    return false;
  } catch (e) { return false; }
}
function parseIdIngredient(line){
  var raw = String(line == null ? '' : line).replace(/^(?:[-*•]\s*|\d+[.)]\s+)/, '').trim();
  if (!raw) return null;
  var m = raw.match(/^(secukupnya|seperlunya)\s+(.+)$/i);
  if (m) return { id: safeUUID(), name: m[2].trim(), amount: null, unit: '', optional: /sesuai selera/i.test(raw), note: 'Takaran ' + m[1].toLowerCase() + ' — koreksi' };
  m = raw.match(/^(.+?)\s+secukupnya$/i);
  if (m && m[1].trim()) return { id: safeUUID(), name: m[1].trim(), amount: null, unit: '', optional: /sesuai selera/i.test(raw), note: 'Takaran secukupnya — koreksi' };
  m = raw.match(/^([\d.,\/\s]+?)\s*([A-Za-z]+)\s*(.*)$/);
  if (m) {
    var amount = parseIdNumber(m[1]);
    var unitRaw = m[2].toLowerCase();
    var rest = (m[3] || '').trim();
    if (amount != null && rest) {
      if (isKnownUnit(unitRaw)) {
        var u = unitRaw; try { u = normalizeUnit(unitRaw); } catch (e) {}
        return { id: safeUUID(), name: rest, amount: amount, unit: u, optional: /opsional|sesuai selera/i.test(raw), note: '' };
      }
      return { id: safeUUID(), name: (m[2] + ' ' + rest).trim(), amount: amount, unit: '', optional: /opsional|sesuai selera/i.test(raw), note: 'Satuan tidak tertulis — periksa' };
    }
  }
  var oldRx = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(kg|ons|g|gram|ml|cc|l|liter|buah|butir|siung|batang|lembar|sachet|bungkus|ikat|sdm|sdt|cm|piring|ruas|ekor|gelas|genggam)\b/i;
  var m2 = raw.match(oldRx);
  if (m2) {
    var uu = m2[3]; try { uu = normalizeUnit(m2[3]); } catch (e) {}
    return { id: safeUUID(), name: m2[1].replace(/^[-*•]\s*/, '').trim(), amount: Number(String(m2[2]).replace(',', '.')), unit: uu, optional: /opsional|sesuai selera/i.test(raw), note: '' };
  }
  return { id: safeUUID(), name: raw, amount: null, unit: '', optional: /sesuai selera/i.test(raw), note: 'Takaran belum terdeteksi' };
}
try { if (typeof window !== 'undefined') { window.parseIdNumber = parseIdNumber; window.parseIdIngredient = parseIdIngredient; } } catch (e) {}

function parseRecipeText(text){
  const lines=text.split('\n').map(x=>x.trim()).filter(Boolean); const title=(lines[0]||'Resep impor').replace(/^#+\s*/,'').slice(0,100); let mode=''; const ingredients=[],steps=[]; const amountRx=/^(?:[-*•]\s*)?(.+?)\s+(\d+(?:[.,]\d+)?)\s*(kg|ons|g|gram|ml|cc|l|liter|buah|butir|siung|batang|lembar|sachet|bungkus|ikat|sdm|sdt|cm)\b/i;
  for(const line of lines.slice(1)){ if(/bahan/i.test(line)&&line.length<40){mode='ingredients';continue;} if(/cara|langkah/i.test(line)&&line.length<60){mode='steps';continue;} if(mode==='ingredients'){var pi=parseIdIngredient(line); if(pi) ingredients.push(pi);} else if(mode==='steps') steps.push(line.replace(/^\d+[.)]\s*/,'')); }
  return {id:safeUUID(),title,category:'Lainnya',mainIngredient:'',description:'Hasil impor teks — periksa sebelum menyimpan.',servings:2,servingsEstimate:true,prepMinutes:null,cookMinutes:null,timeEstimate:false,favorite:false,image:{type:'placeholder',exactMatch:false,alt:title,sourcePageUrl:'',creator:'',...pixabayLicense},source:{type:'import',label:'Teks impor'},ingredients,steps,notes:'Periksa kembali hasil ekstraksi lokal sebelum disimpan.'};
}

function openShoppingModal(){
  renderModal(`<div class="modal-header"><div><p class="eyebrow">Belanja manual</p><h2>Tambah item</h2></div><button class="close-button" data-close-modal>×</button></div><div class="modal-body form-grid"><div class="field-group full"><label>Nama bahan</label><input id="shopName"></div><div class="field-group"><label>Jumlah</label><input id="shopAmount" type="number" step="0.01" min="0"></div><div class="field-group"><label>Satuan</label><input id="shopUnit"></div></div>`,{footer:`<button class="secondary-button" data-close-modal>Batal</button><button class="primary-button" id="saveShoppingBtn">Tambahkan</button>`});
  document.getElementById('saveShoppingBtn').onclick=async()=>{const name=document.getElementById('shopName').value.trim();if(!name){toast('Nama bahan belum diisi.');return;}const amount=document.getElementById('shopAmount').value===''?null:Number(document.getElementById('shopAmount').value);const unit=normalizeUnit(document.getElementById('shopUnit').value);await mergeShopping({name,amount,unit,recipeTitle:''});await refreshState();renderAll();closeModal();toast('Ditambahkan ke daftar belanja.');};
}

async function exportData(){ const data={version:1,exportedAt:new Date().toISOString(),recipes:state.recipes,stock:state.stock,shopping:state.shopping,transactions:state.transactions}; const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`dapur-marlon-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500); }
function toast(message){ const el=document.createElement('div');el.className='toast';el.textContent=message;document.getElementById('toastRegion').append(el);setTimeout(()=>el.remove(),3200); }
function cap(s=''){ return s.charAt(0).toUpperCase()+s.slice(1); }
function formatDate(date){ return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(date+'T12:00:00')); }
function formatDateTime(date){ return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(date)); }



/* ---- Perbanyak database resep dengan jujur: online (TheMealDB, gratis, tanpa key) + JSON ---- */
function parseMeasureOnline(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return { amount: null, unit: '' };
  var m = s.match(/^([\d.,\/\s]+)\s*(.*)$/);
  if (!m) return { amount: null, unit: '' };
  var num = m[1].trim(), rest = (m[2] || '').trim().toLowerCase();
  var amount = null;
  try {
    if (/\//.test(num)) {
      var parts = num.split(/\s+/);
      var total = 0, ok = false;
      for (var k = 0; k < parts.length; k++) {
        var p = parts[k];
        if (p.indexOf('/') >= 0) { var fr = p.split('/'); var a = parseFloat(String(fr[0]).replace(',', '.')); var b = parseFloat(String(fr[1]).replace(',', '.')); if (a >= 0 && b > 0) { total += a / b; ok = true; } }
        else { var v = parseFloat(p.replace(',', '.')); if (!isNaN(v)) { total += v; ok = true; } }
      }
      if (ok) amount = total;
    } else { var v2 = parseFloat(num.replace(',', '.')); if (!isNaN(v2)) amount = v2; }
  } catch (e) { amount = null; }
  if (amount == null) return { amount: null, unit: '' };
  var known = ['kg','kilogram','ons','on','g','gr','gram','l','liter','ml','mililiter','cc','buah','butir','siung','batang','lembar','sachet','bungkus','ikat','sdm','sdt','cm','piring','ruas','ekor','gelas','genggam','pcs'];
  var unit = '';
  if (rest) {
    var low = rest.replace(/\./g, '');
    if (known.indexOf(low) >= 0) { try { unit = normalizeUnit(low); } catch (e) { unit = low; } }
    else if (known.indexOf(low.replace(/s$/, '')) >= 0) { try { unit = normalizeUnit(low.replace(/s$/, '')); } catch (e) { unit = low; } }
    else { unit = rest.split(/\s+/).slice(0, 2).join(' '); }
  }
  return { amount: amount, unit: unit };
}


/* ---- Indonesia dulu: kamus deterministik (bukan AI, bukan karangan) ---- */
var ID_EN_QUERY = {ayam:'chicken',sapi:'beef',kambing:'goat',domba:'lamb',babi:'pork',bebek:'duck',ikan:'fish',udang:'shrimp',cumi:'squid',kepiting:'crab',telur:'egg',tahu:'tofu',tempe:'tempeh',mie:'noodle',bihun:'vermicelli',nasi:'rice',beras:'rice',sup:'soup',soto:'soup',sayur:'vegetable',jamur:'mushroom',kentang:'potato',tomat:'tomato',bawang:'onion',cabai:'chili',cabe:'chili',santan:'coconut',kelapa:'coconut',gula:'sugar',garam:'salt',pedas:'spicy',manis:'sweet',asam:'sour',goreng:'fried',rebus:'boiled',bakar:'grilled',panggang:'roasted',kukus:'steamed',kacang:'peanut',jagung:'corn',bayam:'spinach',wortel:'carrot',kubis:'cabbage',jahe:'ginger',kunyit:'turmeric',serai:'lemongrass',santan2:'coconut'};
var EN_ID_PHRASE = {'chicken breast':'dada ayam','chicken thigh':'paha ayam','chicken wing':'sayap ayam','black pepper':'lada hitam','white pepper':'merica','red onion':'bawang merah','spring onion':'daun bawang','coconut milk':'santan','soy sauce':'kecap asin','oyster sauce':'saus tiram','fish sauce':'kecap ikan','palm sugar':'gula aren','brown sugar':'gula palem','coconut sugar':'gula kelapa','bay leaf':'daun salam','lime leaf':'daun jeruk','peanut oil':'minyak kacang','olive oil':'minyak zaitun','green bean':'buncis','long bean':'kacang panjang'};
var EN_ID_WORD = {chicken:'ayam',beef:'daging sapi',pork:'daging babi',duck:'bebek',goat:'kambing',fish:'ikan',shrimp:'udang',prawn:'udang',squid:'cumi',crab:'kepiting',egg:'telur',eggs:'telur',tofu:'tahu',tempeh:'tempe',garlic:'bawang putih',shallot:'bawang merah',onion:'bawang bombai',chili:'cabai',chilli:'cabai',pepper:'merica',salt:'garam',sugar:'gula',oil:'minyak',flour:'tepung terigu',rice:'beras',noodle:'mie',noodles:'mie',milk:'susu',coconut:'kelapa',tomato:'tomat',potato:'kentang',carrot:'wortel',cabbage:'kubis',spinach:'bayam',mushroom:'jamur',ginger:'jahe',turmeric:'kunyit',lemongrass:'serai',galangal:'lengkuas',lime:'jeruk nipis',cinnamon:'kayu manis',clove:'cengkeh',nutmeg:'pala',coriander:'ketumbar',cumin:'jintan',candlenut:'kemiri',tamarind:'asam jawa',vinegar:'cuka',honey:'madu',butter:'mentega',margarine:'margarin',cheese:'keju',cream:'krim',bread:'roti',cake:'kue',soup:'sup',fried:'goreng',grilled:'bakar',boiled:'rebus',steamed:'kukus',roasted:'panggang',spicy:'pedas',sweet:'manis',sour:'asam',black:'hitam',white:'putih',red:'merah',green:'hijau',large:'besar',small:'kecil',dried:'kering',fresh:'segar',ground:'bubuk',powdered:'bubuk',minced:'cincang',sliced:'iris',chopped:'cincang',water:'air',ice:'es',bean:'kacang',peanut:'kacang tanah',corn:'jagung',eggplant:'terong',cucumber:'timun',basil:'kemangi',celery:'seledri',carrot2:'wortel'};
function translateQueryIdEn(q){
  var tokens=String(q||'').toLowerCase().split(/[^a-z]+/).filter(Boolean);
  var mapped=tokens.map(function(t){return ID_EN_QUERY[t]||t;});
  return { translated: mapped.join(' '), tokens: mapped.filter(function(t,i){return t.length>2 && mapped.indexOf(t)===i;}) };
}
function translateFoodId(name){
  var low=String(name||'').toLowerCase().trim().replace(/\s+/g,' ');
  if(!low) return { text: String(name||''), full: false };
  if(EN_ID_PHRASE[low]) { var ph = EN_ID_PHRASE[low]; return { text: ph.charAt(0).toUpperCase()+ph.slice(1), full: true }; }
  var words=low.split(' ');
  var out=[], allOk=true;
  for(var k=0;k<words.length;k++){ var w=EN_ID_WORD[words[k]]; if(w){out.push(w);} else {out.push(words[k]); allOk=false;} }
  // coba gabungan frasa di dalam nama panjang
  var joined=out.join(' ');
  for(var ph in EN_ID_PHRASE){ if((' '+low+' ').indexOf(' '+ph+' ')>=0){ joined=joined.split(' ').join(' '); } }
  return { text: joined.charAt(0).toUpperCase()+joined.slice(1), full: allOk };
}
try { if (typeof window !== 'undefined') { window.translateQueryIdEn = translateQueryIdEn; window.translateFoodId = translateFoodId; } } catch (e) {}

function mealToDraft(meal) {
  meal = meal || {};
  var rawTitle = String(meal.strMeal || 'Resep online').slice(0, 100);
  var tTitle = translateFoodId(rawTitle);
  var title = tTitle.text;
  var ingredients = [];
  for (var k = 1; k <= 20; k++) {
    var nm = String(meal['strIngredient' + k] || '').trim();
    if (!nm) continue;
    var pm = parseMeasureOnline(meal['strMeasure' + k]);
    var tNm = translateFoodId(nm);
    ingredients.push({
      id: safeUUID(),
      name: tNm.text,
      amount: pm.amount,
      unit: pm.unit || '',
      optional: false,
      note: (pm.amount == null ? 'Takaran belum terdeteksi. ' : '') + (!tNm.full ? 'Asli: "'+nm+'" — periksa terjemahan.' : '')
    });
  }
  var steps = String(meal.strInstructions || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
  var area = String(meal.strArea || '').trim(), cat = String(meal.strCategory || '').trim();
  return {
    id: safeUUID(),
    title: title,
    category: cat || 'Lainnya',
    mainIngredient: '',
    description: 'Impor dari TheMealDB (sumber Inggris, diterjemahkan otomatis sebagian) — periksa sebelum menyimpan.' + (tTitle.full ? '' : ' Judul asli: "'+rawTitle+'".') + (area ? ' Area: ' + area + '.' : ''),
    servings: 2, servingsEstimate: true,
    prepMinutes: null, cookMinutes: null, timeEstimate: false,
    favorite: false,
    image: { type: meal.strMealThumb ? 'internet' : 'placeholder', exactMatch: false, url: meal.strMealThumb || undefined, alt: title, sourcePageUrl: meal.idMeal ? ('https://www.themealdb.com/meal/' + meal.idMeal) : '', creator: 'TheMealDB', licenseName: '', licenseUrl: '', note: 'Foto dari TheMealDB, bukan foto masakan sendiri.' },
    source: { type: 'online', label: 'TheMealDB' + (area || cat ? ' (' + [area, cat].filter(Boolean).join(', ') + ')' : '') },
    ingredients: ingredients,
    steps: steps.length ? steps : ['Belum ada langkah terdeteksi — periksa di sumber.'],
    notes: 'Hasil impor online. Takaran tanpa angka jelas ditandai; langkah masih bahasa Inggris — terjemahkan saat review.'
  };
}

function openOnlineSearch() {
  renderModal('<div class="modal-header"><div><p class="eyebrow">Database online</p><h2>Cari resep online</h2></div><button class="close-button" data-close-modal>×</button></div><div class="modal-body"><div class="warning-box">Sumber: <strong>TheMealDB</strong> (gratis, tanpa key). Hasil dibuka sebagai <strong>draft untuk direview</strong> — boleh cari pakai bahasa Indonesia (otomatis dicari dalam bahasa Inggris), bahan diterjemahkan otomatis sebagian, langkah masih Inggris dan wajib diterjemahkan saat review.</div><div class="inline-actions" style="margin:12px 0"><input id="onlineQuery" placeholder="cth: ayam, ikan, sup…" style="flex:1"><button class="primary-button" id="onlineGoBtn">Cari</button></div><div id="onlineResults"><p class="helper">Ketik kata kunci lalu Cari.</p></div></div>', { footer: '<button class="secondary-button" data-close-modal>Tutup</button>' });
  var go = function () {
    var q = document.getElementById('onlineQuery').value.trim();
    if (!q) { toast('Ketik kata kunci dulu.'); return; }
    searchOnlineRecipes(q);
  };
  document.getElementById('onlineGoBtn').onclick = go;
  document.getElementById('onlineQuery').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
}

async function searchOnlineRecipes(q) {
  var root = document.getElementById('onlineResults');
  if (typeof fetch === 'undefined') { root.innerHTML = '<p class="helper">Browser tidak mendukung fetch. Gunakan impor teks/JSON.</p>'; return; }
  root.innerHTML = '<p class="helper">Mencari…</p>';
  var tq = (typeof translateQueryIdEn === 'function') ? translateQueryIdEn(q) : { translated: q, tokens: [] };
  var attempts = [];
  if (tq.translated && tq.translated.toLowerCase() !== q.toLowerCase()) attempts.push(tq.translated);
  (tq.tokens || []).forEach(function (t) { if (attempts.indexOf(t) < 0) attempts.push(t); });
  if (attempts.indexOf(q) < 0) attempts.push(q);
  var meals = [], usedKw = q;
  try {
    for (var qi = 0; qi < attempts.length; qi++) {
      var r = await fetch('https://www.themealdb.com/api/json/v1/1/search.php?s=' + encodeURIComponent(attempts[qi]));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var j = await r.json();
      if (j && j.meals && j.meals.length) { meals = j.meals; usedKw = attempts[qi]; break; }
    }
    if (!meals.length) { root.innerHTML = '<div class="empty-state"><strong>Tidak ketemu</strong><p>Coba kata kunci lain, Indonesia atau Inggris.</p></div>'; return; }
    var kwInfo = (usedKw.toLowerCase() !== q.toLowerCase()) ? '<p class="helper">Mencari “'+escapeHtml(q)+'” sebagai “'+escapeHtml(usedKw)+'”. Hasil dibuka sebagai draft terjemahan.</p>' : '<p class="helper">Hasil dibuka sebagai draft — periksa terjemahan sebelum menyimpan.</p>';
    root.innerHTML = kwInfo + meals.slice(0, 12).map(function (m) {
      return '<div class="shopping-item"><div aria-hidden="true">🍲</div><div><strong>' + escapeHtml(m.strMeal || '') + '</strong><small>' + escapeHtml([m.strArea, m.strCategory].filter(Boolean).join(' · ') || 'TheMealDB') + '</small></div><button class="text-button" data-online-preview="' + escapeHtml(m.idMeal || '') + '">Pratinjau</button></div>';
    }).join('');
    root.querySelectorAll('[data-online-preview]').forEach(function (b) {
      b.onclick = function () { previewOnlineRecipe(b.getAttribute('data-online-preview')); };
    });
  } catch (e) {
    root.innerHTML = '<div class="empty-state"><strong>Online gagal</strong><p>' + escapeHtml((e && e.message) || e) + '. Cek koneksi atau gunakan impor teks/JSON.</p></div>';
  }
}

async function previewOnlineRecipe(id) {
  try { toast('Mengambil detail resep…'); } catch (e) {}
  try {
    var r = await fetch('https://www.themealdb.com/api/json/v1/1/lookup.php?i=' + encodeURIComponent(id));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var j = await r.json();
    var meal = j && j.meals && j.meals[0];
    if (!meal) throw new Error('Detail tidak ditemukan.');
    var draft = mealToDraft(meal);
    openRecipeEditor(null, draft);
  } catch (e) {
    try { toast('Gagal ambil detail: ' + ((e && e.message) || e)); } catch (_) {}
  }
}

function openJsonImport() {
  var inp = document.getElementById('importJsonFile');
  if (!inp) { toast('Input file tidak tersedia.'); return; }
  inp.value = '';
  inp.onchange = importJsonFile;
  inp.click();
}

async function importJsonFile(ev) {
  var f = ev && ev.target && ev.target.files && ev.target.files[0];
  if (!f) return;
  try {
    var text = await f.text();
    var parsed = JSON.parse(text);
    var list = Array.isArray(parsed) ? parsed : (parsed.recipes || []);
    if (!Array.isArray(list) || !list.length) { toast('File JSON tidak berisi daftar resep.'); return; }
    var added = 0, skipped = 0, bad = 0;
    for (var k = 0; k < list.length; k++) {
      (function (r) {
        try {
          if (!r || !r.id || !r.title || !Array.isArray(r.ingredients) || !Array.isArray(r.steps)) { bad++; return; }
          var exists = state.recipes.some(function (x) { return x.id === r.id; });
          if (exists) { skipped++; return; }
          if (!r.source) r.source = { type: 'import', label: 'File JSON' };
          db.put(STORE.recipes, r).then(function () { added++; }).catch(function () { bad++; });
        } catch (e) { bad++; }
      })(list[k]);
    }
    setTimeout(async function () {
      try { await refreshState(); renderAll(); } catch (e) {}
      try { toast('Impor JSON: ' + added + ' ditambah, ' + skipped + ' sudah ada, ' + bad + ' rusak.'); } catch (e) {}
    }, 300);
  } catch (e) {
    try { toast('Gagal baca JSON: ' + ((e && e.message) || e)); } catch (_) {}
  }
}
try { if (typeof window !== 'undefined') { window.mealToDraft = mealToDraft; window.parseMeasureOnline = parseMeasureOnline; } } catch (e) {}


/* ---- Impor Mustika Rasa: transkripsi jujur dari kitab 1967 ---- */
function openMustikaImport(){
  renderModal('<div class="modal-header"><div><p class="eyebrow">Kitab 1967</p><h2>Impor Mustika Rasa</h2></div><button class="close-button" data-close-modal>×</button></div><div class="modal-body"><div class="warning-box">Transkripsi dari buku <strong>Mustika Rasa (1967)</strong>. Tulis nomor halaman + daerah asal agar sumbernya jelas. Takaran memakai satuan Indonesia (ons, gram, liter, sdm, …). Yang tidak terbaca ditandai dan wajib dikoreksi.</div><div class="form-grid" style="margin-top:12px"><div class="field-group"><label>Judul resep</label><input id="mustikaTitle" placeholder="cth: Rawon"></div><div class="field-group"><label>Daerah asal</label><input id="mustikaArea" placeholder="cth: Jawa Timur"></div><div class="field-group"><label>Halaman buku</label><input id="mustikaPage" inputmode="numeric" placeholder="cth: 152"></div><div class="field-group"><label>Kategori</label><input id="mustikaCat" placeholder="cth: Sup"></div></div><label for="mustikaText" style="margin-top:12px"><strong>Tempel teks halaman buku</strong></label><textarea id="mustikaText" rows="12" placeholder="Tempel bahan + cara dari buku di sini…"></textarea></div>',{footer:'<button class="secondary-button" data-close-modal>Batal</button><button class="primary-button" id="mustikaGoBtn">Tinjau hasil</button>'});
  document.getElementById('mustikaGoBtn').onclick=function(){
    var text=document.getElementById('mustikaText').value.trim();
    if(!text){toast('Tempel teks halaman buku dulu.');return;}
    var draft=parseRecipeText(text);
    var title=document.getElementById('mustikaTitle').value.trim();
    var area=document.getElementById('mustikaArea').value.trim();
    var page=document.getElementById('mustikaPage').value.trim();
    var cat=document.getElementById('mustikaCat').value.trim();
    if(title) draft.title=title.slice(0,100);
    if(cat) draft.category=cat;
    var label='Mustika Rasa (1967)';
    if(page) label+=', hal. '+page;
    if(area) label+=' — '+area;
    draft.source={type:'book',label:label};
    draft.description='Transkripsi Mustika Rasa — periksa sebelum menyimpan.';
    draft.notes='Sumber: '+label+'. '+(draft.notes||'');
    openRecipeEditor(null,draft);
  };
}
try { if (typeof window !== 'undefined') window.openMustikaImport = openMustikaImport; } catch (e) {}

(function bootDapur(){ try{ if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', function(){ try{ init(); }catch(e){ console.warn(e); } }, { once:true }); } else { init(); } }catch(e){ try{ init(); }catch(_){} } })();