/**
 * bhatkhande.io — Taal Data & Bol Dictionary
 * Complete database of Tabla Taals with Bhatkhande notation markers
 * and comprehensive Bol (syllable) Roman ↔ Devanagari mapping.
 */

const BUILT_IN_BOL_MAP = {
  'Na': 'ना', 'Ta': 'ता', 'Ti': 'ती', 'Tin': 'तिं', 'Tun': 'तुं', 'Tu': 'तू', 'Te': 'ते', 'Tay': 'टे', 'Tir': 'तिर', 'Tira': 'तिर', 'Kit': 'किट', 'Kita': 'किट', 'Re': 'रे', 'Ri': 'रि', 'Ra': 'र', 'Din': 'दिं', 'Tat': 'तत', 'Tit': 'तित', 'Ne': 'ने', 'Tak': 'तक', 'Tet': 'तेत',
  'Ge': 'गे', 'Ghe': 'घे', 'Ga': 'ग', 'Ka': 'क', 'Ke': 'के', 'Kat': 'कत', 'kat': 'कत', 'Gin': 'गिं', 'Ki': 'कि',
  'Dha': 'धा', 'Dhi': 'धी', 'Dhin': 'धिं', 'Dhet': 'धेत', 'Dhit': 'धित', 'Dhe': 'धे', 'Dhu': 'धु',

  'Krata': 'क्रता', 'krata': 'क्रता', 'Gina': 'गीना', 'gina': 'गीना', 'Nata': 'नाता', 'Nadha': 'नाधा', 'NaDha': 'नाधा', 'Dhagena': 'धागेना', 'dhagena': 'धागेना', 'takena': 'ताकेना', 'Kra': 'क्र', 'Digan': 'दिगन', 'Digana': 'दिगन', 'ghighi': 'घिघि',
  'DHAGHEDNAG': 'धाघेड़नग', 'DHINGHEDNAG': 'धिनघेड़नग', 'DHASTAK': 'धाऽतक', 'DHADHATAK': 'धाधातक', 'DHADHASTAK': 'धाधातक', 'DHADHADHA': 'धाधाधा', 'TAKTAKTAK': 'तकतकतक',
  'TINTINTIN': 'तिनतिनतिन', 'DHIGIDHIGIDHIGI': 'धिगधिगधिग', 'NAGENAGENAGE': 'नागेनागेनागे', 'TADHADHA': 'ताधाधा', 'DINDINDINA': 'दिनदिनदिना', 'KITADHAGHED': 'किटधाघेड़',
  'NAGTAKDHIN': 'नगतकधिन', 'DHAGETRAKDHIN': 'धागेत्रकधिं', 'GHEDNAGDIN': 'घेड़नगदिन', 'DINAKITATA': 'दिनाकिटता', 'DHADHADIN': 'धाधादिन', 'DINDINAKITA': 'दिनदिनाकिट',
  'TAKDHINDHAGE': 'तकधिनधागे', 'TRAKDHINGHED': 'त्रकधिनगेड़', 'NAGDINDINA': 'नगदिनदिना', 'KITATADHA': 'किटताधा', 'DHADINDIN': 'धादिनदिन', 'DINAKITADHA': 'दिनाकिटधा',
  'GHEDNAGTAK': 'घेड़नगतक', 'DHINDHAGETRAK': 'धिनधागेत्रक', 'TINTINAKITA': 'तिनतिनाकिट', 'DHINDHINAKITA': 'धिनधिनाकिट',
  'TAKEDNAK': 'ताकेड़नक', 'TINKEDNAK': 'तिनकेड़नक', 'TASTAK': 'ताऽतक', 'TATASTAK': 'तातातक', 'TATATA': 'ताताता',
  'S': 'ऽ', '-': '–'
};

const CUSTOM_BOL_MAP_STORAGE_KEY = 'bhatkhande_io_custom_bol_map';
const BOL_DICTIONARY_API_PATH = '/api/bol-dictionary';
let BOL_MAP = {};
let BOL_MAP_REVERSE = {};
let BOL_KEYS_SORTED = [];
const BOL_SEGMENT_CACHE = new Map();

function _isDevanagariText(text) {
  return /[\u0900-\u097F]/.test(String(text || ''));
}

function _sanitizeBolMap(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};

  const cleaned = {};
  Object.entries(data).forEach(([roman, devanagari]) => {
    const cleanRoman = String(roman || '').trim();
    const cleanDevanagari = String(devanagari || '').trim();
    if (cleanRoman && cleanDevanagari) {
      cleaned[cleanRoman] = cleanDevanagari;
    }
  });
  return cleaned;
}

function _loadCustomBolMap() {
  if (typeof localStorage === 'undefined') return {};

  try {
    const raw = localStorage.getItem(CUSTOM_BOL_MAP_STORAGE_KEY);
    if (!raw) return {};

    return _sanitizeBolMap(JSON.parse(raw));
  } catch (err) {
    console.warn('Could not load custom bol dictionary:', err);
    return {};
  }
}

function _saveCustomBolMapToLocalStorage(customMap) {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(CUSTOM_BOL_MAP_STORAGE_KEY, JSON.stringify(_sanitizeBolMap(customMap)));
  } catch (err) {
    console.warn('Could not persist custom bol dictionary:', err);
  }
}

function _areBolMapsEqual(left, right) {
  const leftMap = _sanitizeBolMap(left);
  const rightMap = _sanitizeBolMap(right);
  const leftKeys = Object.keys(leftMap);
  const rightKeys = Object.keys(rightMap);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(key => rightMap[key] === leftMap[key]);
}

function _refreshBolDictionaryIndexes() {
  BOL_MAP_REVERSE = {};
  Object.entries(BOL_MAP).forEach(([roman, devanagari]) => {
    if (!BOL_MAP_REVERSE[devanagari]) BOL_MAP_REVERSE[devanagari] = roman;
  });
  BOL_KEYS_SORTED = Object.keys(BOL_MAP).sort((a, b) => b.length - a.length);
  BOL_SEGMENT_CACHE.clear();
}

function _rebuildBolDictionary() {
  BOL_MAP = {
    ...BUILT_IN_BOL_MAP,
    ..._loadCustomBolMap()
  };
  _refreshBolDictionaryIndexes();
}

function saveCustomBolMapping(romanBol, devanagariBol) {
  const cleanRoman = String(romanBol || '').trim();
  const cleanDevanagari = String(devanagariBol || '').trim();
  if (!cleanRoman || !cleanDevanagari) return null;

  const customMap = _loadCustomBolMap();
  if (customMap[cleanRoman] === cleanDevanagari) return cleanRoman;

  customMap[cleanRoman] = cleanDevanagari;
  _saveCustomBolMapToLocalStorage(customMap);
  _rebuildBolDictionary();
  void pushBolDictionaryToServer(customMap);
  return cleanRoman;
}

async function pushBolDictionaryToServer(customMap = _loadCustomBolMap()) {
  if (typeof fetch !== 'function') return false;

  try {
    const response = await fetch(BOL_DICTIONARY_API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_sanitizeBolMap(customMap)),
      signal: AbortSignal.timeout(2000)
    });
    return response.ok;
  } catch (err) {
    return false;
  }
}

async function syncBolDictionaryWithServer() {
  if (typeof fetch !== 'function') return false;

  const localMap = _loadCustomBolMap();

  try {
    const response = await fetch(BOL_DICTIONARY_API_PATH, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return false;

    const serverMap = _sanitizeBolMap(await response.json());
    const mergedMap = {
      ...serverMap,
      ...localMap
    };

    if (!_areBolMapsEqual(localMap, mergedMap)) {
      _saveCustomBolMapToLocalStorage(mergedMap);
    }

    _rebuildBolDictionary();

    if (!_areBolMapsEqual(serverMap, mergedMap)) {
      await pushBolDictionaryToServer(mergedMap);
    }

    return true;
  } catch (err) {
    return false;
  }
}

function parseCustomBolMappingToken(token) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken || !cleanToken.includes('=')) return null;

  const [left, right, ...rest] = cleanToken.split('=');
  if (rest.length > 0) return null;

  const cleanLeft = String(left || '').trim();
  const cleanRight = String(right || '').trim();
  if (!cleanLeft || !cleanRight) return null;

  const leftIsDevanagari = _isDevanagariText(cleanLeft);
  const rightIsDevanagari = _isDevanagariText(cleanRight);
  if (leftIsDevanagari === rightIsDevanagari) return null;

  return leftIsDevanagari
    ? { roman: cleanRight, devanagari: cleanLeft }
    : { roman: cleanLeft, devanagari: cleanRight };
}

function normalizeBolToken(bol) {
  const cleanBol = String(bol || '').trim();
  if (!cleanBol) return cleanBol;

  const customMapping = parseCustomBolMappingToken(cleanBol);
  if (customMapping) {
    const savedRoman = saveCustomBolMapping(customMapping.roman, customMapping.devanagari);
    if (savedRoman) return savedRoman;
  }

  const romanMatch = BOL_KEYS_SORTED.find(key => key.toLowerCase() === cleanBol.toLowerCase());
  if (romanMatch) return romanMatch;

  if (BOL_MAP_REVERSE[cleanBol]) return BOL_MAP_REVERSE[cleanBol];

  return cleanBol;
}

_rebuildBolDictionary();

// Smart detection for single syllables
const SINGLE_BOLS = new Set([
  'na', 'ta', 'ti', 'tin', 'tun', 'tu', 'te', 'tay', 're', 'ri', 'ra', 'din', 'tat', 'tit', 'ne', 'tak', 'tet',
  'ge', 'ghe', 'ga', 'ka', 'ke', 'kat', 'gin', 'ki',
  'dha', 'dhi', 'dhin', 'dhet', 'dhit', 'dhe', 'dhu',
  's', '-'
]);
const FORCED_GROUPED_BOLS = new Set([
  'kat'
]);

function isCompoundBol(bol) {
  if (!bol) return false;
  if (bol.includes(' ')) return true;
  const clean = bol.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return false;
  if (FORCED_GROUPED_BOLS.has(clean)) return true;
  return !SINGLE_BOLS.has(clean);
}

function splitRomanBolIntoKnownParts(romanBol) {
  const source = (romanBol || '').trim();
  if (!source) return null;

  const cacheKey = source.toLowerCase();
  if (BOL_SEGMENT_CACHE.has(cacheKey)) {
    return BOL_SEGMENT_CACHE.get(cacheKey);
  }

  const lower = source.toLowerCase();
  const memo = new Map();

  function segmentFrom(index) {
    if (index >= lower.length) return [];
    if (memo.has(index)) return memo.get(index);

    let match = null;
    for (const key of BOL_KEYS_SORTED) {
      if (!lower.startsWith(key.toLowerCase(), index)) continue;
      const remainder = segmentFrom(index + key.length);
      if (remainder) {
        match = [key, ...remainder];
        break;
      }
    }

    memo.set(index, match);
    return match;
  }

  const segments = segmentFrom(0);
  BOL_SEGMENT_CACHE.set(cacheKey, segments);
  return segments;
}

const COMPOSITION_CATEGORIES = [
  { id: 'expandable', name: 'Expandable', nameDevanagari: 'विस्तारशील' },
  { id: 'non_expandable', name: 'Non-expandable', nameDevanagari: 'अविस्तारशील' },
  { id: 'utility', name: 'Utility', nameDevanagari: 'सहायक' }
];

const COMPOSITION_TYPES = [
  { id: 'theka', name: 'Theka', nameDevanagari: 'ठेका', category: 'utility' },
  { id: 'kayda', name: 'Kayda', nameDevanagari: 'कायदा', category: 'expandable' },
  { id: 'rela', name: 'Rela', nameDevanagari: 'रेला', category: 'expandable' },
  { id: 'peshkar', name: 'Peshkar', nameDevanagari: 'पेशकार', category: 'expandable' },
  { id: 'tukda', name: 'Tukda', nameDevanagari: 'टुकड़ा', category: 'non_expandable' },
  { id: 'chakradhar', name: 'Chakradhar', nameDevanagari: 'चक्रधार', category: 'non_expandable' },
  { id: 'mohra', name: 'Mohra', nameDevanagari: 'मोहरा', category: 'non_expandable' },
  { id: 'gat', name: 'Gat', nameDevanagari: 'गत', category: 'non_expandable' },
  { id: 'fard', name: 'Fard', nameDevanagari: 'फ़र्द', category: 'non_expandable' },
  { id: 'paran', name: 'Paran', nameDevanagari: 'परण', category: 'non_expandable' },
  { id: 'tihai', name: 'Tihai', nameDevanagari: 'तिहाई', category: 'utility' },
  { id: 'custom', name: 'Custom', nameDevanagari: 'अन्य', category: 'utility' }
];

const LEGACY_COMPOSITION_TYPE_MAP = {
  palta: 'kayda'
};

function normalizeCompositionTypeId(typeId) {
  const requested = (typeId || 'theka').toString().trim();
  const normalized = LEGACY_COMPOSITION_TYPE_MAP[requested] || requested;
  return COMPOSITION_TYPES.some(type => type.id === normalized) ? normalized : 'custom';
}

function getCompositionTypeInfo(typeId) {
  const normalized = normalizeCompositionTypeId(typeId);
  return COMPOSITION_TYPES.find(type => type.id === normalized) || COMPOSITION_TYPES[0];
}

function isExpandableCompositionType(typeId) {
  return getCompositionTypeInfo(typeId).category === 'expandable';
}

function getDefaultSectionBlueprintForCompositionType(typeId) {
  const typeInfo = getCompositionTypeInfo(typeId);
  if (typeInfo.category === 'expandable') {
    return { type: 'mukh', label: 'Main' };
  }
  if (typeInfo.id === 'tihai') {
    return { type: 'tihai', label: 'Tihai' };
  }
  if (typeInfo.id === 'custom') {
    return { type: 'custom', label: 'Custom' };
  }
  return { type: 'custom', label: typeInfo.name };
}

const SECTION_TYPES = [
  { id: 'mukh', name: 'Mukh (Theme)', nameDevanagari: 'मुख' },
  { id: 'palta', name: 'Palta (Variation)', nameDevanagari: 'पलटा' },
  { id: 'dohra', name: 'Dohra', nameDevanagari: 'दोहरा' },
  { id: 'tihai', name: 'Tihai (Ending)', nameDevanagari: 'तिहाई' },
  { id: 'custom', name: 'Custom Section', nameDevanagari: 'अन्य' }
];

const LAYA_TYPES = [
  { id: 'vilambit', name: 'Vilambit', nameDevanagari: 'विलंबित' },
  { id: 'madhya', name: 'Madhya', nameDevanagari: 'मध्य' },
  { id: 'drut', name: 'Drut', nameDevanagari: 'द्रुत' },
  { id: 'ati_drut', name: 'Ati Drut', nameDevanagari: 'अति द्रुत' }
];

const TAAL_DATABASE = {
  teentaal: {
    id: 'teentaal', name: 'Teentaal', nameDevanagari: 'तीनताल', matras: 16, wrapAfter: 8,
    vibhaagStructure: [4, 4, 4, 4],
    markers: [{ position: 0, type: 'sam', label: 'X' }, { position: 4, type: 'taali', label: '2' }, { position: 8, type: 'khali', label: '0' }, { position: 12, type: 'taali', label: '3' }],
    theka: ['Dha', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Tin', 'Tin', 'Ta', 'Ta', 'Dhin', 'Dhin', 'Dha']
  },
  rupak: {
    id: 'rupak', name: 'Roopak', nameDevanagari: 'रूपक', matras: 7, wrapAfter: 7,
    vibhaagStructure: [3, 2, 2], samIsKhali: true,
    markers: [{ position: 0, type: 'sam', label: 'X' }, { position: 3, type: 'taali', label: '1' }, { position: 5, type: 'taali', label: '2' }],
    theka: ['Ti', 'Ti', 'Na', 'Dhi', 'Na', 'Dhi', 'Na']
  },
  jhaptaal: {
    id: 'jhaptaal', name: 'Jhaptaal', nameDevanagari: 'झपताल', matras: 10, wrapAfter: 5,
    vibhaagStructure: [2, 3, 2, 3],
    markers: [{ position: 0, type: 'sam', label: 'X' }, { position: 2, type: 'taali', label: '2' }, { position: 5, type: 'khali', label: '0' }, { position: 7, type: 'taali', label: '3' }],
    theka: ['Dhi', 'Na', 'Dhi', 'Dhi', 'Na', 'Ti', 'Na', 'Dhi', 'Dhi', 'Na']
  },
  ektaal: {
    id: 'ektaal', name: 'Ektaal', nameDevanagari: 'एकताल', matras: 12, wrapAfter: 6,
    vibhaagStructure: [2, 2, 2, 2, 2, 2],
    markers: [{ position: 0, type: 'sam', label: 'X' }, { position: 2, type: 'khali', label: '0' }, { position: 4, type: 'taali', label: '2' }, { position: 6, type: 'khali', label: '0' }, { position: 8, type: 'taali', label: '3' }, { position: 10, type: 'taali', label: '4' }],
    theka: ['Dhin', 'Dhin', 'DhaGe', 'Tirakita', 'Tu', 'Na', 'Kat', 'Ta', 'DhaGe', 'Tirakita', 'Dhin', 'Na']
  },
  dhamar: {
    id: 'dhamar', name: 'Dhamar', nameDevanagari: 'धमार', matras: 14, wrapAfter: 7,
    vibhaagStructure: [5, 2, 3, 4],
    markers: [{ position: 0, type: 'sam', label: 'X' }, { position: 5, type: 'taali', label: '2' }, { position: 7, type: 'khali', label: '0' }, { position: 10, type: 'taali', label: '3' }],
    theka: ['Ka', 'Dhi', 'Tay', 'Dhi', 'Tay', 'Dha', 'S', 'Ga', 'Ti', 'Tay', 'Ti', 'Tay', 'Ta', 'S']
  },
  adachautaal: {
    id: 'adachautaal', name: 'Ada Chautaal', nameDevanagari: 'आड़ा चौताल', matras: 14, wrapAfter: 7,
    vibhaagStructure: [2, 2, 2, 2, 2, 2, 2],
    markers: [{ position: 0, type: 'sam', label: 'X' }, { position: 2, type: 'taali', label: '2' }, { position: 4, type: 'khali', label: '0' }, { position: 6, type: 'taali', label: '3' }, { position: 8, type: 'khali', label: '0' }, { position: 10, type: 'taali', label: '4' }, { position: 12, type: 'khali', label: '0' }],
    theka: ['Dhin', 'Tirakita', 'Dhi', 'Na', 'Tu', 'Na', 'Kat', 'Ta', 'Tirakita', 'Dhi', 'Na', 'Dhi', 'Dhi', 'Na']
  },
  dadra: {
    id: 'dadra', name: 'Dadra', nameDevanagari: 'दादरा', matras: 6, wrapAfter: 6,
    vibhaagStructure: [3, 3],
    markers: [{ position: 0, type: 'sam', label: 'X' }, { position: 3, type: 'khali', label: '0' }],
    theka: ['Dha', 'Dhi', 'Na', 'Dha', 'Tu', 'Na']
  },
  keherwa: {
    id: 'keherwa', name: 'Keherwa', nameDevanagari: 'कहरवा', matras: 8, wrapAfter: 8,
    vibhaagStructure: [4, 4],
    markers: [{ position: 0, type: 'sam', label: 'X' }, { position: 4, type: 'khali', label: '0' }],
    theka: ['Dha', 'Ge', 'Na', 'Ti', 'Na', 'Ka', 'Dhi', 'Na']
  },
  chautaal: {
    id: 'chautaal', name: 'Chautaal', nameDevanagari: 'चौताल', matras: 12, wrapAfter: 6,
    vibhaagStructure: [2, 2, 2, 2, 2, 2],
    markers: [{ position: 0, type: 'sam', label: 'X' }, { position: 2, type: 'khali', label: '0' }, { position: 4, type: 'taali', label: '2' }, { position: 6, type: 'khali', label: '0' }, { position: 8, type: 'taali', label: '3' }, { position: 10, type: 'taali', label: '4' }],
    theka: ['Dha', 'Dha', 'Din', 'Ta', 'Kita', 'Dha', 'Din', 'Ta', 'TeTe', 'KaTa', 'GaDi', 'GaNa']
  },
  sooltaal: {
    id: 'sooltaal', name: 'Sooltaal', nameDevanagari: 'सूलताल', matras: 10, wrapAfter: 10,
    vibhaagStructure: [2, 2, 2, 2, 2],
    markers: [{ position: 0, type: 'sam', label: 'X' }, { position: 2, type: 'taali', label: '2' }, { position: 4, type: 'khali', label: '0' }, { position: 6, type: 'taali', label: '3' }, { position: 8, type: 'taali', label: '4' }],
    theka: ['Dha', 'Dha', 'Din', 'Ta', 'Kita', 'Dha', 'TeTe', 'KaTa', 'GaDi', 'GaNa']
  },
  jhoomra: {
    id: 'jhoomra', name: 'Jhoomra', nameDevanagari: 'झूमरा', matras: 14, wrapAfter: 7,
    vibhaagStructure: [3, 4, 3, 4],
    markers: [{ position: 0, type: 'sam', label: 'X' }, { position: 3, type: 'taali', label: '2' }, { position: 7, type: 'khali', label: '0' }, { position: 10, type: 'taali', label: '3' }],
    theka: ['Dhin', 'S', 'Dha', 'Tirakita', 'Dhin', 'Dhin', 'DhaGe', 'Tirakita', 'Tin', 'S', 'Ta', 'Tirakita', 'Dhin', 'Dhin']
  },
  tilwada: {
    id: 'tilwada', name: 'Tilwada', nameDevanagari: 'तिलवाड़ा', matras: 16, wrapAfter: 8,
    vibhaagStructure: [4, 4, 4, 4],
    markers: [{ position: 0, type: 'sam', label: 'X' }, { position: 4, type: 'taali', label: '2' }, { position: 8, type: 'khali', label: '0' }, { position: 12, type: 'taali', label: '3' }],
    theka: ['Dha', 'TirKit', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Tin', 'Tin', 'Ta', 'TirKit', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Dhin', 'Dhin']
  },
  deepchandi: {
    id: 'deepchandi', name: 'Deepchandi', nameDevanagari: 'दीपचंदी', matras: 14, wrapAfter: 7,
    vibhaagStructure: [3, 4, 3, 4],
    markers: [{ position: 0, type: 'sam', label: 'X' }, { position: 3, type: 'taali', label: '2' }, { position: 7, type: 'khali', label: '0' }, { position: 10, type: 'taali', label: '3' }],
    theka: ['Dha', 'Dhin', 'S', 'Dha', 'Dha', 'Tin', 'S', 'Ta', 'Tin', 'S', 'Dha', 'Dha', 'Dhin', 'S']
  },
  panchamsawari: {
    id: 'panchamsawari', name: 'Pancham Sawari', nameDevanagari: 'पंचम सवारी', matras: 15, wrapAfter: 15,
    vibhaagStructure: [3, 4, 4, 4],
    markers: [{ position: 0, type: 'sam', label: 'X' }, { position: 3, type: 'taali', label: '2' }, { position: 7, type: 'khali', label: '0' }, { position: 11, type: 'taali', label: '3' }],
    theka: ['Dhi', 'Na', 'Dhi Dhi', 'Kat', 'Dhi Dhi', 'Na Dhi', 'Dhi Na', 'Ti Kra', 'Tin Na', 'Tirakita', 'Tu Na', 'Kat Ta', 'Dhi Dhi', 'Na Dhi', 'Dhi Na']
  }
};

function getMarkerForMatra(taal, matraIndex) { return taal.markers.find(m => m.position === matraIndex) || null; }
function isVibhaagStart(taal, matraIndex) {
  let pos = 0;
  for (let i = 0; i < taal.vibhaagStructure.length; i++) {
    if (pos === matraIndex && i > 0) return true;
    pos += taal.vibhaagStructure[i];
  }
  return false;
}
function getVibhaagIndex(taal, matraIndex) {
  let pos = 0;
  for (let i = 0; i < taal.vibhaagStructure.length; i++) {
    if (matraIndex < pos + taal.vibhaagStructure[i]) return i;
    pos += taal.vibhaagStructure[i];
  }
  return taal.vibhaagStructure.length - 1;
}

function bolToDevanagari(romanBol) {
  if (BOL_MAP[romanBol]) return BOL_MAP[romanBol];
  const key = BOL_KEYS_SORTED.find(k => k.toLowerCase() === romanBol.toLowerCase());
  if (key) return BOL_MAP[key];

  const segments = splitRomanBolIntoKnownParts(romanBol);
  if (segments && segments.length > 1) {
    return segments.map(segment => BOL_MAP[segment] || segment).join('');
  }

  return romanBol;
}
function bolToRoman(devBol) { return BOL_MAP_REVERSE[devBol] || devBol; }

function getBolDisplay(romanBol, script) {
  if (!romanBol) return '';
  if (script === 'devanagari') {
    return romanBol.split(' ').map(b => bolToDevanagari(b)).join('');
  }
  return romanBol.split(' ').join('');
}

function createEmptyAvartan(taal) {
  const matras = [];
  for (let i = 0; i < taal.matras; i++) matras.push({ bols: [] });
  return { matras };
}
function createThekaAvartan(taal) {
  const matras = taal.theka.map(bol => ({ bols: [bol] }));
  return { matras };
}
