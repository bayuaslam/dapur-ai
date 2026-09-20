/* Dapur AI boot helpers (app1) - tanpa dependensi, tidak boleh throw. */
function safeUUID(){try{if(typeof crypto!=="undefined"&&crypto&&typeof crypto.randomUUID==="function")return crypto.randomUUID();}catch(e){}try{if(typeof crypto!=="undefined"&&crypto&&typeof crypto.getRandomValues==="function"){var b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;var h=Array.prototype.map.call(b,function(x){return ("0"+x.toString(16)).slice(-2)}).join("");return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20)}}catch(e){}return "id-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10)+Math.random().toString(36).slice(2,6);}
function safeClone(o){try{if(typeof structuredClone!=="undefined")return structuredClone(o);}catch(e){}return JSON.parse(JSON.stringify(o));}
function i(name, amount, unit, optional, note){ if(optional===undefined)optional=false; if(note===undefined)note=''; var _id; try{ _id=safeUUID(); }catch(_e){ _id='id-'+Date.now()+'-'+Math.floor(Math.random()*1e9); } return { id:_id, name:name, amount:amount, unit:unit, optional:optional, note:note }; }

const DB_NAME = 'dapur-marlon-db';
const DB_VERSION = 1;
const STORE = { recipes: 'recipes', stock: 'stock', shopping: 'shopping', transactions: 'transactions', settings: 'settings' };

const UNIT_GROUPS = {
  mass: { g: 1, gram: 1, kg: 1000, kilogram: 1000 },
  volume: { ml: 1, mililiter: 1, l: 1000, liter: 1000 },
  each: { buah: 1 },
  egg: { butir: 1 },
  clove: { siung: 1 },
  stalk: { batang: 1 },
  leaf: { lembar: 1 },
  sachet: { sachet: 1 },
  pack: { bungkus: 1 },
  bunch: { ikat: 1 },
  tbsp: { sdm: 1 },
  tsp: { sdt: 1 },
  cm: { cm: 1 },
  plate: { piring: 1 }
};

const UNIT_ALIASES = {
  gr: 'g', gram: 'g', grams: 'g', kilogram: 'kg', kilograms: 'kg',
  mililiter: 'ml', milliliter: 'ml', liter: 'l', litres: 'l',
  pcs: 'buah', buah: 'buah', butir: 'butir', siung: 'siung', batang: 'batang', lembar: 'lembar',
  sachet: 'sachet', bungkus: 'bungkus', ikat: 'ikat', sdm: 'sdm', 'sendok makan': 'sdm',
  sdt: 'sdt', 'sendok teh': 'sdt', cm: 'cm', piring: 'piring'
};

const NAME_ALIASES = new Map([
  ['cabe', 'cabai'], ['cabe merah', 'cabai merah'], ['cabe hijau', 'cabai hijau'],
  ['cabe rawit', 'cabai rawit'], ['cabe rawit hijau', 'cabai rawit hijau'],
  ['kol', 'kubis'], ['daun jeruk purut', 'daun jeruk'], ['santan kara', 'santan instan'],
  ['sunkara', 'santan instan'], ['santan sunkara', 'santan instan'], ['indomie goreng', 'mie instan goreng']
]);

const pixabayLicense = {
  licenseName: 'Pixabay Content License',
  licenseUrl: 'https://pixabay.com/service/license-summary/',
  note: 'Sumber pencarian foto sudah disiapkan, tetapi seed tidak menampilkan foto acak sebelum aset spesifik dan URL stabil diverifikasi.'
};

var seedRecipes = safeBuildSeed([
  {
    id: 'sop-bening', title: 'Sop Bening Sederhana', category: 'Sayur', mainIngredient: 'Kentang & wortel',
    description: 'Sop rumahan ringan dengan kentang, wortel, kubis, daun bawang, dan seledri.',
    servings: 3, servingsEstimate: true, prepMinutes: 10, cookMinutes: 20, timeEstimate: true, favorite: false,
    image: { type: 'placeholder', exactMatch: false, alt: 'Sop bening berisi wortel, kentang, dan kubis', sourcePageUrl: 'https://pixabay.com/photos/search/vegetable%20soup/', creator: 'Koleksi kontributor Pixabay', ...pixabayLicense },
    source: { type: 'chat', label: 'Percakapan resep pribadi' },
    ingredients: [
      i('kentang',2,'buah'), i('wortel',2,'buah'), i('kubis',150,'g'), i('daun bawang',1,'batang'), i('seledri',2,'batang'),
      i('bawang putih',3,'siung'), i('bawang merah',4,'buah'), i('merica',0.5,'sdt'), i('pala bubuk',0.5,'sdt',true),
      i('garam',0.75,'sdt'), i('gula',0.5,'sdt'), i('kaldu bubuk',0.5,'sdt'), i('air',800,'ml')
    ],
    steps: [
      'Potong kentang dan wortel. Iris daun bawang dan seledri, lalu potong kubis agak lebar sekitar 2–3 cm.',
      'Haluskan bawang merah, bawang putih, dan merica. Tumis sampai harum dan agak kecokelatan.',
      'Tambahkan air, kentang, dan wortel. Rebus sekitar 10–15 menit sampai mulai empuk.',
      'Masukkan kubis, garam, kaldu, gula, dan pala bila dipakai. Masak 2–4 menit.',
      'Masukkan daun bawang dan seledri selama 30–60 detik, lalu matikan api dan koreksi rasa.'
    ], notes: 'Kubis, daun bawang, dan seledri masuk belakangan supaya tidak terlalu layu.'
  },
  {
    id: 'magelangan-indomie', title: 'Magelangan Indomie', category: 'Nasi & mie', mainIngredient: 'Nasi & mie instan',
    description: 'Nasi goreng mawut dengan Indomie, telur, kubis, dan bumbu tumis.',
    servings: 2, servingsEstimate: true, prepMinutes: 10, cookMinutes: 10, timeEstimate: true, favorite: false,
    image: { type: 'placeholder', exactMatch: false, alt: 'Nasi goreng mawut bercampur mie', sourcePageUrl: 'https://pixabay.com/images/search/fried%20rice%20noodles/', creator: 'Koleksi kontributor Pixabay', ...pixabayLicense },
    source: { type: 'chat', label: 'Percakapan resep pribadi' },
    ingredients: [
      i('nasi putih',2,'piring'), i('mie instan goreng',1,'bungkus'), i('telur',2,'butir'), i('bawang putih',3,'siung'),
      i('bawang merah',4,'buah'), i('cabai rawit',4,'buah',true), i('daun bawang',1,'batang'), i('kubis',100,'g'),
      i('kecap manis',1,'sdm'), i('saus sambal',1,'sdm',true), i('kecap asin',0.5,'sdt',true), i('merica',0.25,'sdt'), i('minyak',2,'sdm')
    ],
    steps: [
      'Rebus mie setengah matang lalu tiriskan. Haluskan kasar bawang merah, bawang putih, dan cabai.',
      'Tumis bumbu sampai matang dan harum. Geser ke pinggir, orak-arik telur sampai agak kering.',
      'Masukkan kubis, kemudian nasi. Besarkan api dan aduk sampai nasi tidak menggumpal.',
      'Masukkan mie, seluruh bumbu sachet Indomie, kecap manis, saus sambal, kecap asin bila dipakai, dan merica.',
      'Aduk cepat 2–3 menit sampai agak kering. Masukkan daun bawang di akhir.'
    ], notes: 'Gunakan bumbu Indomie sebagai seasoning utama; tambahan kecap/kaldu jangan berlebihan.'
  },
  {
    id: 'ayam-paniki-mod', title: 'Ayam Paniki Modifikasi', category: 'Ayam', mainIngredient: 'Ayam',
    description: 'Ayam santan pedas-rempah versi rumahan, untuk sekitar sepertiga ekor ayam dan Sunkara 65 ml.',
    servings: 2, servingsEstimate: true, prepMinutes: 10, cookMinutes: 25, timeEstimate: true, favorite: true,
    image: { type: 'placeholder', exactMatch: false, alt: 'Ayam berbumbu santan pedas', sourcePageUrl: 'https://pixabay.com/images/search/chicken%20curry/', creator: 'Koleksi kontributor Pixabay', ...pixabayLicense },
    source: { type: 'chat', label: 'Adaptasi percakapan; terinspirasi Ayam Paniki' },
    ingredients: [
      i('ayam',500,'g'), i('santan instan',65,'ml'), i('air',125,'ml'), i('minyak',2,'sdt'), i('cabai merah',4,'buah'),
      i('bawang merah',4,'buah'), i('bawang putih',2,'siung'), i('jahe',1,'cm'), i('kemiri',1,'buah'), i('kunyit',0.5,'cm'),
      i('serai',1,'batang'), i('daun jeruk',2,'lembar'), i('garam',0.5,'sdt'), i('gula',0.5,'sdt'), i('kaldu bubuk',0.375,'sdt'), i('merica',0.25,'sdt')
    ],
    steps: [
      'Haluskan cabai merah, bawang merah, bawang putih, jahe, kemiri, dan kunyit.',
      'Panaskan minyak lalu tumis bumbu sampai benar-benar harum dan matang. Masukkan serai dan daun jeruk.',
      'Masukkan ayam dan aduk sampai permukaannya berubah warna serta terbalut bumbu.',
      'Campur santan instan dengan air lalu tuang. Masukkan garam, gula, kaldu, dan merica.',
      'Tutup panci 10–15 menit dengan api kecil–sedang. Sesekali buka dan aduk pelan.',
      'Buka tutupnya dan lanjutkan 5–10 menit sampai ayam empuk dan kuah mengental.'
    ], notes: 'Versi final tanpa jeruk nipis. Untuk kuah lebih medok gunakan 100 ml air; lebih banyak kuah gunakan 150 ml.'
  },
  {
    id: 'tumis-kangkung', title: 'Cah Kangkung Saus Tiram', category: 'Sayur', mainIngredient: 'Kangkung',
    description: 'Tumis kangkung cepat, ringan, dan tetap renyah.',
    servings: 2, servingsEstimate: true, prepMinutes: 5, cookMinutes: 5, timeEstimate: true, favorite: false,
    image: { type: 'placeholder', exactMatch: false, alt: 'Tumis kangkung hijau', sourcePageUrl: 'https://pixabay.com/images/search/water%20spinach/', creator: 'Koleksi kontributor Pixabay', ...pixabayLicense },
    source: { type: 'chat', label: 'Percakapan resep pribadi' },
    ingredients: [
      i('kangkung',1,'ikat'), i('bawang merah',3,'buah'), i('bawang putih',2,'siung'), i('cabai',3,'buah',true), i('saus tiram',1,'sdm'),
      i('garam',0.25,'sdt'), i('gula',0.25,'sdt'), i('air',2.5,'sdm'), i('minyak',1,'sdm')
    ],
    steps: [
      'Petik kangkung. Buang akar dan batang bawah yang keras; potong batang muda 4–6 cm.',
      'Tumis bawang merah, bawang putih, dan cabai sampai harum.',
      'Masukkan batang kangkung sekitar 20–30 detik lebih dulu, kemudian daunnya.',
      'Tambahkan saus tiram, garam, gula, dan air. Masak api besar 1–2 menit lalu angkat.'
    ], notes: 'Jangan terlalu lama supaya kangkung tetap hijau dan tidak berair.'
  },
  {
    id: 'tahu-santan-pedas', title: 'Tahu Santan Pedas Gurih', category: 'Tahu & tempe', mainIngredient: 'Tahu putih',
    description: 'Tahu putih dalam kuah santan pedas dengan serai dan daun jeruk.',
    servings: 3, servingsEstimate: true, prepMinutes: 10, cookMinutes: 15, timeEstimate: true, favorite: false,
    image: { type: 'placeholder', exactMatch: false, alt: 'Tahu putih dalam kuah santan pedas', sourcePageUrl: 'https://pixabay.com/photos/search/tofu/', creator: 'Koleksi kontributor Pixabay', ...pixabayLicense },
    source: { type: 'chat', label: 'Percakapan resep pribadi' },
    ingredients: [
      i('tahu putih',6,'buah'), i('santan instan',65,'ml'), i('air',225,'ml'), i('bawang merah',4,'buah'), i('bawang putih',2,'siung'),
      i('cabai',4,'buah'), i('kemiri',1,'buah',true), i('serai',1,'batang'), i('daun jeruk',2,'lembar'), i('daun salam',1,'lembar',true),
      i('garam',0.5,'sdt'), i('gula',0.5,'sdt'), i('kaldu bubuk',0.375,'sdt'), i('minyak',1,'sdm')
    ],
    steps: [
      'Potong tahu dan goreng sebentar sampai permukaan agak kokoh, lalu sisihkan.',
      'Haluskan bawang merah, bawang putih, cabai, dan kemiri bila dipakai. Tumis sampai matang.',
      'Masukkan serai, daun jeruk, dan daun salam bila ada.',
      'Tuang santan yang sudah dicampur air. Masukkan garam, gula, dan kaldu.',
      'Masukkan tahu dan masak api kecil–sedang 8–10 menit sampai kuah agak menyusut.'
    ], notes: 'Bisa ditambah telur rebus, labu siam, kacang panjang, atau terong sesuai stok.'
  },
  {
    id: 'sayur-cabe-ijo-tahu', title: 'Sayur Cabe Ijo Tahu Putih', category: 'Sayur', mainIngredient: 'Tahu putih & cabai hijau',
    description: 'Sayur santan sederhana dengan tahu putih dan cabai hijau.',
    servings: 3, servingsEstimate: true, prepMinutes: 10, cookMinutes: 15, timeEstimate: true, favorite: false,
    image: { type: 'placeholder', exactMatch: false, alt: 'Tahu putih dengan cabai hijau dan kuah santan', sourcePageUrl: 'https://pixabay.com/images/search/tofu%20food/', creator: 'Koleksi kontributor Pixabay', ...pixabayLicense },
    source: { type: 'chat', label: 'Percakapan resep pribadi' },
    ingredients: [
      i('tahu putih',5,'buah'), i('cabai hijau',7,'buah'), i('cabai rawit hijau',4,'buah',true), i('bawang merah',4,'buah'), i('bawang putih',2,'siung'),
      i('santan instan',65,'ml'), i('air',250,'ml'), i('serai',1,'batang'), i('daun salam',2,'lembar'), i('lengkuas',2,'cm'),
      i('garam',0.5,'sdt'), i('gula',0.5,'sdt'), i('kaldu bubuk',0.375,'sdt'), i('minyak',1,'sdm')
    ],
    steps: [
      'Iris bawang merah, bawang putih, dan cabai hijau. Geprek serai dan lengkuas.',
      'Tumis bawang sampai harum lalu masukkan cabai hijau, serai, daun salam, dan lengkuas.',
      'Campur santan dengan air lalu tuang perlahan.',
      'Masukkan garam, gula, kaldu, dan tahu putih.',
      'Masak api kecil–sedang sekitar 8–10 menit. Aduk pelan supaya tahu tidak hancur.'
    ], notes: 'Tempe atau petai bisa ditambahkan jika tersedia, tetapi tidak diasumsikan ada.'
  },
  {
    id: 'telur-ceplok-kecap', title: 'Telur Ceplok Kecap', category: 'Telur', mainIngredient: 'Telur',
    description: 'Telur ceplok dengan kuah kecap bawang yang manis-gurih.',
    servings: 2, servingsEstimate: true, prepMinutes: 5, cookMinutes: 10, timeEstimate: true, favorite: false,
    image: { type: 'placeholder', exactMatch: false, alt: 'Telur ceplok dengan saus kecap', sourcePageUrl: 'https://pixabay.com/photos/search/fried%20egg/', creator: 'Koleksi kontributor Pixabay', ...pixabayLicense },
    source: { type: 'chat', label: 'Percakapan resep pribadi' },
    ingredients: [
      i('telur',3,'butir'), i('bawang merah',3,'buah'), i('bawang putih',2,'siung'), i('cabai',3,'buah',true), i('kecap manis',2,'sdm'),
      i('saus tiram',0.5,'sdt',true), i('merica',0.25,'sdt'), i('garam',0.25,'sdt'), i('air',90,'ml'), i('tomat',0.5,'buah',true), i('minyak',1,'sdm')
    ],
    steps: [
      'Ceplok telur sesuai kematangan yang diinginkan lalu sisihkan.',
      'Tumis bawang merah, bawang putih, dan cabai sampai harum.',
      'Masukkan kecap manis, saus tiram bila dipakai, merica, garam, dan air.',
      'Setelah mendidih, masukkan telur. Masak 2–4 menit sambil kuah disiramkan ke telur.',
      'Masukkan tomat pada menit terakhir bila dipakai.'
    ], notes: 'Tomat opsional untuk memberi rasa segar agar kecap tidak terasa terlalu berat.'
  },
  {
    id: 'tumis-kubis-kecap', title: 'Tumis Kubis Kecap', category: 'Sayur', mainIngredient: 'Kubis',
    description: 'Tumis kubis sederhana tanpa bawang merah, cocok saat bahan dapur terbatas.',
    servings: 2, servingsEstimate: true, prepMinutes: 5, cookMinutes: 7, timeEstimate: true, favorite: false,
    image: { type: 'placeholder', exactMatch: false, alt: 'Tumis kubis sederhana', sourcePageUrl: 'https://pixabay.com/images/search/cabbage%20food/', creator: 'Koleksi kontributor Pixabay', ...pixabayLicense },
    source: { type: 'chat', label: 'Percakapan resep pribadi' },
    ingredients: [
      i('kubis',250,'g'), i('bawang putih',2,'siung',true), i('cabai',2,'buah',true), i('kecap manis',1,'sdm'), i('garam',0.25,'sdt'),
      i('merica',0.25,'sdt',true), i('air',2.5,'sdm'), i('tomat',1,'buah',true), i('minyak',1,'sdm')
    ],
    steps: [
      'Iris kubis agak kasar. Iris bawang putih dan cabai bila tersedia.',
      'Tumis bawang putih dan cabai bila dipakai, lalu masukkan kubis.',
      'Tambahkan kecap manis, garam, merica bila ada, dan sedikit air.',
      'Masak 2–3 menit. Jika memakai tomat, masukkan di 1–2 menit terakhir.'
    ], notes: 'Bawang putih dan tomat bersifat opsional; versi paling minimal tetap bisa dibuat dari kubis, kecap, garam, air, dan minyak.'
  },
  {
    id: 'mie-nyemek-kubis', title: 'Mie Nyemek Kubis & Tomat', category: 'Nasi & mie', mainIngredient: 'Mie instan',
    description: 'Indomie nyemek dengan kubis, tomat, bawang putih, dan cabai.',
    servings: 1, servingsEstimate: true, prepMinutes: 5, cookMinutes: 7, timeEstimate: true, favorite: true,
    image: { type: 'placeholder', exactMatch: false, alt: 'Mie nyemek dengan kubis dan tomat', sourcePageUrl: 'https://pixabay.com/photos/search/noodles/', creator: 'Koleksi kontributor Pixabay', ...pixabayLicense },
    source: { type: 'chat', label: 'Percakapan resep pribadi' },
    ingredients: [
      i('mie instan goreng',1,'bungkus'), i('kubis',80,'g'), i('tomat',0.5,'buah'), i('bawang putih',1,'siung'), i('cabai',2,'buah',true),
      i('merica',0.25,'sdt'), i('air',200,'ml'), i('minyak',1,'sdt'), i('kecap manis',0.5,'sdm',true), i('saus sambal',0.5,'sdm',true)
    ],
    steps: [
      'Tumis bawang putih dan cabai dengan sedikit minyak sampai harum.',
      'Tuang sekitar 200 ml air lalu masukkan mie.',
      'Saat mie mulai lunak, masukkan kubis dan seluruh bumbu sachet mie.',
      'Tambahkan merica, tomat, serta kecap/saus sambal bila diinginkan.',
      'Masak sampai kuah tinggal sedikit dan agak kental; jangan sampai kering total.'
    ], notes: 'Air 180–220 ml sesuai tingkat nyemek yang diinginkan.'
  },
  {
    id: 'tahu-saus-tiram', title: 'Tahu Saus Tiram Pedas', category: 'Tahu & tempe', mainIngredient: 'Tahu putih',
    description: 'Tahu goreng ringan dengan saus tiram pedas dan kuah sedikit mengental.',
    servings: 2, servingsEstimate: true, prepMinutes: 10, cookMinutes: 10, timeEstimate: true, favorite: false,
    image: { type: 'placeholder', exactMatch: false, alt: 'Tahu saus tiram pedas', sourcePageUrl: 'https://pixabay.com/photos/search/tofu/', creator: 'Koleksi kontributor Pixabay', ...pixabayLicense },
    source: { type: 'chat', label: 'Percakapan resep pribadi' },
    ingredients: [
      i('tahu putih',5,'buah'), i('bawang merah',3,'buah'), i('bawang putih',2,'siung'), i('cabai',3,'buah',true), i('saus tiram',1,'sdm'),
      i('kecap manis',1,'sdt'), i('kecap asin',0.5,'sdt',true), i('gula',0.5,'sdt'), i('merica',0.25,'sdt'), i('air',90,'ml'),
      i('daun bawang',1,'batang',true), i('minyak',2,'sdm')
    ],
    steps: [
      'Potong tahu lalu goreng sebentar sampai permukaannya agak kecokelatan. Sisihkan.',
      'Tumis bawang merah, bawang putih, dan cabai sampai harum.',
      'Masukkan saus tiram, kecap manis, kecap asin bila dipakai, gula, merica, dan air.',
      'Masukkan tahu lalu masak 3–5 menit sampai saus sedikit menyusut dan meresap.',
      'Masukkan daun bawang di akhir bila tersedia.'
    ], notes: 'Tidak perlu kaldu tambahan jika saus tiram sudah cukup asin dan gurih.'
  }
]);
function safeBuildSeed(list){ var out=[]; for(var k=0;k<list.length;k++){ try{ var r=list[k]; if(r&&r.id&&r.title&&Array.isArray(r.ingredients)&&Array.isArray(r.steps)) out.push(r); }catch(e){ try{ if(typeof console!=="undefined") console.warn("seed rusak, dilewati", e); }catch(_){} } } return out; }
try{ if(!Array.isArray(seedRecipes)) seedRecipes=[]; }catch(_e){ try{ seedRecipes=[]; }catch(_){} }
try{ if(typeof window!=="undefined"){ window.seedRecipes=seedRecipes; window.safeUUID=safeUUID; window.safeClone=safeClone; } }catch(e){}
try{ if(typeof globalThis!=="undefined"){ globalThis.seedRecipes=seedRecipes; } }catch(e){}
