/* Dapur AI — Cloud sync opsional (Opsi B: Supabase gratis, offline-first).
   - Tanpa config: aplikasi 100% lokal, status jujur "Cloud belum terhubung".
   - Dengan config: pull saat boot (last-write-wins), push debounced setelah perubahan lokal.
   - Gagal cloud TIDAK PERNAH mematikan aplikasi. Satu tabel gagal tidak menggagalkan yang lain.
   - Classic script, tanpa dependensi build. Lib Supabase JS dimuat malas dari CDN hanya bila dibutuhkan.
*/
(function () {
  var LS_KEY = 'dapur-ai-supabase-v1';
  var CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  var status = { mode: 'off', message: 'Cloud belum terhubung. Data tersimpan di perangkat ini.' };
  var client = null;
  var pushTimer = null;
  var syncing = false;
  var wrapped = false;

  function lsGet() {
    try {
      if (typeof localStorage === 'undefined') return null;
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (o && o.url && o.anonKey) return o;
      return null;
    } catch (e) { return null; }
  }
  function lsSet(cfg) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(LS_KEY, JSON.stringify(cfg));
    } catch (e) {}
  }
  function lsClear() {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(LS_KEY);
    } catch (e) {}
  }

  function setStatus(mode, message) {
    status.mode = mode;
    status.message = message;
    try { updateCloudStatusUI(); } catch (e) {}
  }

  function updateCloudStatusUI() {
    try {
      var dot = document.getElementById('cloudStatusDot');
      var txt = document.getElementById('cloudStatusText');
      var sub = document.getElementById('cloudStatusSub');
      if (!dot && !txt) return;
      var color = '#777';
      if (status.mode === 'on') color = 'var(--ok)';
      else if (status.mode === 'connecting') color = 'var(--warn)';
      else if (status.mode === 'error') color = 'var(--danger)';
      if (dot) dot.style.background = color;
      if (txt) {
        txt.textContent = status.mode === 'on' ? 'Cloud tersambung'
          : status.mode === 'connecting' ? 'Menghubungkan cloud…'
          : status.mode === 'error' ? 'Cloud gagal — mode lokal' : 'Cloud belum terhubung';
      }
      if (sub) sub.textContent = status.message;
    } catch (e) {}
  }

  function ensureLib() {
    return new Promise(function (resolve) {
      try {
        if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') { resolve(true); return; }
        var existing = document.querySelector('script[data-supabase-umd]');
        if (existing) {
          var waited = 0;
          var iv = setInterval(function () {
            waited += 200;
            if (window.supabase && typeof window.supabase.createClient === 'function') { clearInterval(iv); resolve(true); }
            else if (waited > 8000) { clearInterval(iv); resolve(false); }
          }, 200);
          return;
        }
        var s = document.createElement('script');
        s.src = CDN;
        s.async = true;
        s.setAttribute('data-supabase-umd', '1');
        var done = false;
        s.onload = function () { if (!done) { done = true; resolve(!!(window.supabase && window.supabase.createClient)); } };
        s.onerror = function () { if (!done) { done = true; resolve(false); } };
        document.head.appendChild(s);
        setTimeout(function () { if (!done) { done = true; resolve(!!(window.supabase && window.supabase.createClient)); } }, 9000);
      } catch (e) { resolve(false); }
    });
  }

  function getClient() {
    try {
      var cfg = lsGet();
      if (!cfg) return null;
      if (client) return client;
      if (!(window.supabase && window.supabase.createClient)) return null;
      client = window.supabase.createClient(cfg.url, cfg.anonKey);
      return client;
    } catch (e) { return null; }
  }

  function tsOf(row) {
    try {
      var d = row && (row.updatedAt || row.updated_at || (row.data && row.data.updatedAt) || row.createdAt);
      var t = d ? new Date(d).getTime() : 0;
      return isNaN(t) ? 0 : t;
    } catch (e) { return 0; }
  }

  async function pullTable(sb, table, localRows, putLocal) {
    var remote;
    try {
      var res = await sb.from(table).select('id,data,updated_at');
      if (res.error) throw res.error;
      remote = res.data || [];
    } catch (e) {
      throw e;
    }
    var localById = {};
    (localRows || []).forEach(function (r) { if (r && r.id) localById[r.id] = r; });
    var merged = 0;
    for (var k = 0; k < remote.length; k++) {
      (function (row) {
        try {
          var ent = row.data || {};
          ent.id = ent.id || row.id;
          ent.updatedAt = ent.updatedAt || row.updated_at;
          var local = localById[ent.id];
          if (!local || tsOf(ent) > tsOf(local)) {
            putLocal(ent);
            merged++;
          }
        } catch (e) {}
      })(remote[k]);
    }
    return merged;
  }

  async function pushTable(sb, table, rows) {
    var payload = (rows || []).filter(function (r) { return r && r.id; }).map(function (r) {
      var upd = r.updatedAt || r.updated_at || r.createdAt || new Date().toISOString();
      return { id: r.id, data: r, updated_at: upd };
    });
    var step = 100;
    for (var i = 0; i < payload.length; i += step) {
      var chunk = payload.slice(i, i + step);
      try {
        var res = await sb.from(table).upsert(chunk, { onConflict: 'id' });
        if (res.error) throw res.error;
      } catch (e) {
        throw e;
      }
    }
    return payload.length;
  }

  async function pullFromCloud() {
    var cfg = lsGet();
    if (!cfg) { setStatus('off', 'Cloud belum terhubung. Data tersimpan di perangkat ini.'); return { ok: false, reason: 'no-config' }; }
    var hasLib = await ensureLib();
    if (!hasLib) { setStatus('error', 'Pustaka cloud gagal dimuat (offline?). Tetap mode lokal.'); return { ok: false, reason: 'no-lib' }; }
    var sb = getClient();
    if (!sb) { setStatus('error', 'Konfigurasi cloud tidak valid. Periksa URL dan anon key.'); return { ok: false, reason: 'no-client' }; }
    setStatus('connecting', 'Menarik data cloud…');
    var total = 0;
    try {
      var putRecipe = async function (r) { try { await db.put(STORE.recipes, r); } catch (e) {} };
      var putStock = async function (r) { try { await db.put(STORE.stock, r); } catch (e) {} };
      var putShop = async function (r) { try { await db.put(STORE.shopping, r); } catch (e) {} };
      var putTx = async function (r) { try { await db.put(STORE.transactions, r); } catch (e) {} };
      // serial per tabel, masing-masing terisolasi
      try { total += await pullTable(sb, 'recipes', state.recipes, function (r) { putRecipe(r); }); } catch (e) {}
      try { total += await pullTable(sb, 'stock_items', state.stock, function (r) { putStock(r); }); } catch (e) {}
      try { total += await pullTable(sb, 'shopping_items', state.shopping, function (r) { putShop(r); }); } catch (e) {}
      try { total += await pullTable(sb, 'usage_transactions', state.transactions, function (r) { putTx(r); }); } catch (e) {}
      try { await refreshState(); } catch (e) {}
      try { renderAll(); } catch (e) {}
      setStatus('on', 'Tersambung ke cloud. Terakhir sinkron: ' + new Date().toLocaleString('id-ID') + '.');
      return { ok: true, merged: total };
    } catch (e) {
      setStatus('error', 'Tarik cloud gagal: ' + ((e && e.message) || e) + '. Tetap mode lokal.');
      return { ok: false, reason: String((e && e.message) || e) };
    }
  }

  async function pushToCloud() {
    var cfg = lsGet();
    if (!cfg) return { ok: false, reason: 'no-config' };
    var hasLib = await ensureLib();
    if (!hasLib) return { ok: false, reason: 'no-lib' };
    var sb = getClient();
    if (!sb) return { ok: false, reason: 'no-client' };
    try { await refreshState(); } catch (e) {}
    var done = { recipes: 0, stock: 0, shopping: 0, tx: 0 };
    try { done.recipes = await pushTable(sb, 'recipes', state.recipes); } catch (e) {}
    try { done.stock = await pushTable(sb, 'stock_items', state.stock); } catch (e) {}
    try { done.shopping = await pushTable(sb, 'shopping_items', state.shopping); } catch (e) {}
    try { done.tx = await pushTable(sb, 'usage_transactions', state.transactions); } catch (e) {}
    setStatus('on', 'Tersambung ke cloud. Terakhir sinkron: ' + new Date().toLocaleString('id-ID') + '.');
    return { ok: true, done: done };
  }

  function queueCloudPush() {
    try {
      if (!lsGet()) return;
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(function () {
        try { pushToCloud(); } catch (e) {}
      }, 2000);
    } catch (e) {}
  }

  function wrapDb() {
    try {
      if (wrapped) return;
      if (typeof db === 'undefined' || !db) return;
      wrapped = true;
      var origPut = db.put.bind(db);
      var origDel = db.delete.bind(db);
      db.put = async function (s, v) { var r = await origPut(s, v); queueCloudPush(); return r; };
      db.delete = async function (s, id) { var r = await origDel(s, id); queueCloudPush(); return r; };
    } catch (e) {}
  }

  async function maybeSyncCloud() {
    try {
      wrapDb();
      updateCloudStatusUI();
      var cfg = lsGet();
      if (!cfg) { setStatus('off', 'Cloud belum terhubung. Data tersimpan di perangkat ini.'); return; }
      if (syncing) return;
      syncing = true;
      try { await pullFromCloud(); } catch (e) {}
      try { await pushToCloud(); } catch (e) {}
      syncing = false;
    } catch (e) {
      syncing = false;
    }
  }

  function openCloudSettings() {
    try {
      var cfg = lsGet() || { url: '', anonKey: '' };
      var esc = (typeof escapeHtml === 'function') ? escapeHtml : function (s) { return String(s == null ? '' : s); };
      var body = '<div class="modal-header"><div><p class="eyebrow">Cloud gratis</p><h2>Pengaturan cloud</h2></div><button class="close-button" data-close-modal>×</button></div>'
        + '<div class="modal-body form-grid">'
        + '<div class="field-group full"><label>Supabase URL</label><input id="cloudUrl" placeholder="https://xyz.supabase.co" value="' + esc(cfg.url) + '"></div>'
        + '<div class="field-group full"><label>Anon key</label><input id="cloudKey" type="password" placeholder="eyJ…" value="' + esc(cfg.anonKey) + '"></div>'
        + '<p class="helper full">Gratis, tanpa kartu. Buat project di supabase.com > jalankan file <code>supabase-schema.sql</code> di SQL Editor > paste URL + anon key ke sini. Tanpa config, aplikasi tetap jalan lokal 100%.</p>'
        + '<div class="helper full" id="cloudTestResult">Status: ' + esc(status.message) + '</div>'
        + '</div>';
      var foot = '<button class="secondary-button" data-close-modal>Batal</button>'
        + '<button class="secondary-button" id="cloudDisconnectBtn">Putuskan</button>'
        + '<button class="secondary-button" id="cloudTestBtn">Tes koneksi</button>'
        + '<button class="primary-button" id="cloudSaveBtn">Simpan & sinkron</button>';
      renderModal(body, { footer: foot });
      document.getElementById('cloudSaveBtn').onclick = async function () {
        var url = document.getElementById('cloudUrl').value.trim().replace(/\/$/, '');
        var key = document.getElementById('cloudKey').value.trim();
        if (!url || !key) { document.getElementById('cloudTestResult').textContent = 'Isi URL dan anon key dulu.'; return; }
        lsSet({ url: url, anonKey: key });
        client = null;
        document.getElementById('cloudTestResult').textContent = 'Menyimpan & mencoba sinkron…';
        try { await maybeSyncCloud(); } catch (e) {}
        document.getElementById('cloudTestResult').textContent = 'Status: ' + status.message;
        try { toast('Pengaturan cloud disimpan.'); } catch (e) {}
      };
      document.getElementById('cloudTestBtn').onclick = async function () {
        var url = document.getElementById('cloudUrl').value.trim().replace(/\/$/, '');
        var key = document.getElementById('cloudKey').value.trim();
        if (!url || !key) { document.getElementById('cloudTestResult').textContent = 'Isi URL dan anon key dulu.'; return; }
        lsSet({ url: url, anonKey: key });
        client = null;
        document.getElementById('cloudTestResult').textContent = 'Mengetes koneksi…';
        try {
          var hasLib = await ensureLib();
          if (!hasLib) { document.getElementById('cloudTestResult').textContent = 'Gagal: pustaka cloud tidak bisa dimuat (offline?).'; return; }
          var sb = getClient();
          var res = await sb.from('recipes').select('id', { count: 'exact', head: true });
          if (res.error) throw res.error;
          document.getElementById('cloudTestResult').textContent = 'Koneksi OK. Jalankan schema SQL kalau tabel belum ada.';
        } catch (e) {
          document.getElementById('cloudTestResult').textContent = 'Gagal: ' + ((e && e.message) || e);
        }
      };
      document.getElementById('cloudDisconnectBtn').onclick = function () {
        lsClear();
        client = null;
        setStatus('off', 'Cloud diputus. Data lokal tetap aman di perangkat ini.');
        try { closeModal(); } catch (e) {}
        try { toast('Cloud diputus. Mode lokal aktif.'); } catch (e) {}
      };
    } catch (e) {
      try { alert('Pengaturan cloud gagal dibuka: ' + ((e && e.message) || e)); } catch (_) {}
    }
  }

  function bindCloudUI() {
    try {
      var b = document.getElementById('cloudSettingsBtn');
      if (b && !b.dataset.bound) { b.dataset.bound = '1'; b.addEventListener('click', openCloudSettings); }
      var s = document.getElementById('cloudSyncBtn');
      if (s && !s.dataset.bound) {
        s.dataset.bound = '1';
        s.addEventListener('click', async function () {
          var cfg = lsGet();
          if (!cfg) { openCloudSettings(); return; }
          try { toast('Sinkronisasi cloud dimulai…'); } catch (e) {}
          try { await pullFromCloud(); await pushToCloud(); } catch (e) {}
          try { toast('Sinkronisasi selesai: ' + status.message); } catch (e) {}
        });
      }
      updateCloudStatusUI();
    } catch (e) {}
  }

  // expose
  try {
    window.cloudSync = {
      status: status,
      getConfig: lsGet,
      maybeSyncCloud: maybeSyncCloud,
      pullFromCloud: pullFromCloud,
      pushToCloud: pushToCloud,
      openCloudSettings: openCloudSettings,
      bindCloudUI: bindCloudUI
    };
    window.maybeSyncCloud = maybeSyncCloud;
    window.openCloudSettings = openCloudSettings;
  } catch (e) {}

  // hook ke boot: coba bind sekarang + berkala singkat (karena init() jalan duluan)
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { bindCloudUI(); maybeSyncCloud(); });
    } else {
      bindCloudUI();
      maybeSyncCloud();
    }
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      try { bindCloudUI(); wrapDb(); } catch (e) {}
      if (tries > 20) clearInterval(iv);
    }, 1000);
  } catch (e) {}
})();
