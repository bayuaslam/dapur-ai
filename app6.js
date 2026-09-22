/* Dapur AI — Pustaka Indonesia (13.500+ resep, Bahasa Indonesia).
   Sumber: arsip resep Cookpad Indonesia via dataset publik
   (github.com/ricotandrio/indonesian-food-recipes, dari Kaggle).
   - File diunduh LANGSUNG dari upstream saat dicari (tidak dibundel di repo).
   - Tiap hasil dibuka sebagai DRAFT review: sumber + link Cookpad dicatat,
     takaran "secukupnya"/tak jelas ditandai, porsi selalu perkiraan.
   - Classic script, tanpa dependensi. Gagal unduh = pesan jujur, app tetap jalan.
*/
(function () {
  var RAW = 'https://raw.githubusercontent.com/ricotandrio/indonesian-food-recipes/master/dataset/kaggle/';
  var PACKS = [
    { id: 'ayam', label: 'Ayam' }, { id: 'ikan', label: 'Ikan' },
    { id: 'kambing', label: 'Kambing' }, { id: 'sapi', label: 'Sapi' },
    { id: 'tahu', label: 'Tahu' }, { id: 'telur', label: 'Telur' },
    { id: 'tempe', label: 'Tempe' }, { id: 'udang', label: 'Udang' }
  ];
  var SYN = { daging: ['sapi', 'kambing'], seafood: ['ikan', 'udang'], boga: [], sayur: [], bebek: [], cumi: [] };
  var cache = {};

  function parseCSV(text) {
    var rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else {
        if (ch === '"') q = true;
        else if (ch === ',') { row.push(cur); cur = ''; }
        else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
        else if (ch === '\r') {}
        else cur += ch;
      }
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  async function loadPack(id) {
    if (cache[id]) return cache[id];
    var res = await fetch(RAW + 'dataset-' + id + '.csv', { cache: 'force-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' saat mengunduh pack ' + id);
    var text = await res.text();
    var rows = parseCSV(text);
    var out = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r || r.length < 3 || !String(r[0] || '').trim()) continue;
      out.push({
        t: String(r[0]).trim(),
        i: String(r[1] || '').split('--').map(function (s) { return s.trim(); }).filter(Boolean),
        s: String(r[2] || '').split('--').map(function (s) { return s.trim(); }).filter(Boolean),
        u: String(r[4] || '').trim(),
        pack: id
      });
    }
    cache[id] = out;
    return out;
  }

  function packsForQuery(q) {
    var low = String(q || '').toLowerCase();
    var found = [];
    PACKS.forEach(function (p) { if (low.indexOf(p.id) >= 0 && found.indexOf(p.id) < 0) found.push(p.id); });
    Object.keys(SYN).forEach(function (k) {
      if (low.indexOf(k) >= 0) SYN[k].forEach(function (p) { if (found.indexOf(p) < 0) found.push(p); });
    });
    return found;
  }

  function searchRows(rows, q) {
    var toks = String(q || '').toLowerCase().split(/[^a-z]+/).filter(function (t) { return t.length > 2; });
    if (!toks.length) return [];
    var scored = [];
    rows.forEach(function (r, idx) {
      var hay = (r.t + ' ' + r.i.join(' ')).toLowerCase();
      var hit = 0, titleHit = 0;
      toks.forEach(function (t) {
        if (hay.indexOf(t) >= 0) hit++;
        if (r.t.toLowerCase().indexOf(t) >= 0) titleHit++;
      });
      if (hit === toks.length) scored.push({ r: r, idx: idx, titleHit: titleHit });
    });
    scored.sort(function (a, b) { return b.titleHit - a.titleHit; });
    return scored.slice(0, 30);
  }

  function packRowToDraft(row, catLabel) {
    var ings = [];
    row.i.forEach(function (line) {
      try {
        var p = (typeof parseIdIngredient === 'function') ? parseIdIngredient(line) : null;
        if (p) ings.push({ id: (typeof safeUUID === 'function' ? safeUUID() : 'id-' + Date.now() + Math.random()), name: p.name, amount: p.amount, unit: p.unit, optional: !!p.optional, note: p.note || '' });
        else ings.push({ id: 'id-' + Date.now() + Math.random(), name: line, amount: null, unit: '', optional: false, note: 'Takaran belum terdeteksi' });
      } catch (e) {}
    });
    var steps = row.s.length ? row.s : ['Langkah belum tersedia di arsip — periksa di sumber.'];
    var url = row.u ? ('https://cookpad.com' + (row.u.charAt(0) === '/' ? row.u : '/' + row.u)) : '';
    return {
      id: (typeof safeUUID === 'function' ? safeUUID() : 'id-' + Date.now()),
      title: row.t.slice(0, 100),
      category: catLabel || 'Lainnya',
      mainIngredient: '',
      description: 'Arsip resep Indonesia — periksa sebelum menyimpan. Takaran "secukupnya" wajib dikoreksi.',
      servings: 2, servingsEstimate: true,
      prepMinutes: null, cookMinutes: null, timeEstimate: false,
      favorite: false,
      image: { type: 'placeholder', exactMatch: false, alt: row.t.slice(0, 100), sourcePageUrl: url, creator: '', licenseName: '', licenseUrl: '', note: 'Arsip tidak menyertakan foto. Jangan pakai foto acak.' },
      source: { type: 'pack', label: 'Pustaka Indonesia — Cookpad via dataset publik' + (catLabel ? ' (' + catLabel + ')' : '') },
      sourceUrl: url,
      ingredients: ings,
      steps: steps,
      notes: 'Sumber: ' + (url || 'arsip Cookpad Indonesia') + '. Jumlah porsi & waktu perkiraan.'
    };
  }

  function catLabel(id) {
    var p = PACKS.filter(function (x) { return x.id === id; })[0];
    return p ? p.label : id;
  }

  function openPustaka() {
    var chips = PACKS.map(function (p) { return '<button class="segment" data-pack-chip="' + p.id + '">' + p.label + '</button>'; }).join('');
    renderModal('<div class="modal-header"><div><p class="eyebrow">13.500+ resep Indonesia</p><h2>Pustaka Indonesia</h2></div><button class="close-button" data-close-modal>×</button></div><div class="modal-body"><div class="warning-box">Sumber: arsip <strong>Cookpad Indonesia</strong> via dataset publik. File diunduh saat dicari (butuh internet). Hasil dibuka sebagai <strong>draft review</strong> — takaran "secukupnya" wajib dikoreksi, foto tidak tersedia.</div><div class="inline-actions" style="margin:12px 0"><input id="pustakaQuery" placeholder="cth: ayam woku, telur balado…" style="flex:1"><button class="primary-button" id="pustakaGoBtn">Cari</button></div><div class="segmented" role="group" aria-label="Kategori pustaka" style="margin-bottom:12px">' + chips + '</div><div id="pustakaResults"><p class="helper">Pilih kategori atau ketik kata kunci.</p></div></div>', { footer: '<button class="secondary-button" data-close-modal>Tutup</button>' });
    document.getElementById('pustakaGoBtn').onclick = function () { searchPustaka(document.getElementById('pustakaQuery').value.trim(), null); };
    document.getElementById('pustakaQuery').addEventListener('keydown', function (e) { if (e.key === 'Enter') searchPustaka(document.getElementById('pustakaQuery').value.trim(), null); });
    var root = document.getElementById('modalRoot');
    root.querySelectorAll('[data-pack-chip]').forEach(function (b) {
      b.onclick = function () { searchPustaka(document.getElementById('pustakaQuery').value.trim(), b.getAttribute('data-pack-chip')); };
    });
  }

  async function searchPustaka(q, forcePack) {
    var root = document.getElementById('pustakaResults');
    if (typeof fetch === 'undefined') { root.innerHTML = '<p class="helper">Browser tidak mendukung fetch.</p>'; return; }
    var packs = forcePack ? [forcePack] : packsForQuery(q);
    if (!packs.length) { root.innerHTML = '<div class="empty-state"><strong>Pilih kategori dulu</strong><p>Kata kunci tidak menunjuk kategori mana pun. Ketuk salah satu chip kategori di atas, misal Telur atau Ayam.</p></div>'; return; }
    root.innerHTML = '<p class="helper">Mengunduh pack ' + packs.map(catLabel).join(', ') + '… (sekali unduh, tersimpan sesi ini)</p>';
    var all = [];
    try {
      for (var k = 0; k < packs.length; k++) {
        var rows = await loadPack(packs[k]);
        var hits = searchRows(rows, q || packs[k]);
        hits.forEach(function (h) { all.push(h); });
        if (all.length >= 30) break;
      }
    } catch (e) {
      root.innerHTML = '<div class="empty-state"><strong>Unduhan gagal</strong><p>' + escapeHtml((e && e.message) || e) + '. Cek koneksi lalu coba lagi.</p></div>';
      return;
    }
    if (!all.length) { root.innerHTML = '<div class="empty-state"><strong>Tidak ketemu</strong><p>Coba kata kunci lain atau kategori lain.</p></div>'; return; }
    root.innerHTML = '<p class="helper">' + all.length + ' hasil dari ' + packs.map(catLabel).join(', ') + ' — ketuk Pratinjau untuk review.</p>' + all.slice(0, 30).map(function (h, n) {
      return '<div class="shopping-item"><div aria-hidden="true">📖</div><div><strong>' + escapeHtml(h.r.t) + '</strong><small>' + escapeHtml(h.r.i.slice(0, 3).join(', ')) + (h.r.i.length > 3 ? '…' : '') + '</small></div><button class="text-button" data-pack-preview="' + n + '">Pratinjau</button></div>';
    }).join('');
    var list = all.slice(0, 30);
    root.querySelectorAll('[data-pack-preview]').forEach(function (b) {
      b.onclick = function () {
        var h = list[Number(b.getAttribute('data-pack-preview'))];
        if (!h) return;
        try { openRecipeEditor(null, packRowToDraft(h.r, catLabel(h.r.pack))); } catch (e) { toast('Gagal membuka pratinjau.'); }
      };
    });
  }

  try {
    if (typeof window !== 'undefined') {
      window.openPustaka = openPustaka;
      window.searchPustaka = searchPustaka;
      window.packRowToDraft = packRowToDraft;
      window.loadPack = loadPack;
    }
  } catch (e) {}
})();
