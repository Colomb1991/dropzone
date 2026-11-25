// @ts-check
// Reads the addresses out of messy text: a scanned parcel label, a printed list, a dictated
// sentence. It keeps the street, the house number and the town and drops everything else: names,
// phone numbers, parcel codes and company names never leave this file. Pure: no DOM, no storage, no
// network.
import { normalizeAddress, parseCoords, PASTE_MAX_LINES, QUERY_MAX } from './address.js';
import { TOWNS, PROVINCES } from './towns.js';

/** Longer texts are cut: a whole printed list is a few thousand characters. */
export const READ_MAX_CHARS = 40000;
export const TOWN_MAX = 40;

/**
 * @typedef {{street:string, number:string, cap:string, town:string, prov:string, place:string,
 *   townFrom:'text'|'previous'|'default'|'', sender:boolean, text:string, key:string}} Found
 *   `number`: '12', '12/A', '12 bis', '12-14', 'km 3', 'snc' or ''; `place`: a hamlet named with the
 *   street; `townFrom`: where the town comes from; `sender`: the address stood under "Mittente";
 *   `text`: the one line searched and shown; `key`: its normalised spelling
 * @typedef {{kind:'address', id:string} & Found} AddressItem
 * @typedef {{kind:'coords', id:string, lat:number, lon:number, label:string}} CoordsItem
 */

/** @typedef {{k:'w'|'n'|'p', raw:string, low:string, gap:boolean, digits:string, tail:string}} Tok */

const WORD = 'A-Za-z\\u00c0-\\u00d6\\u00d8-\\u00f6\\u00f8-\\u00ff';
const TOKEN_RE = new RegExp(`([${WORD}]+(?:['.][${WORD}]+)*[.']?)|(\\d+)([${WORD}]*)|(\\S)`, 'g');
const fold = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const set = (words) => new Set(words.split(' '));

/* ---------- street types ---------- */

/** @typedef {{name:string, strong:boolean, place:boolean, dot:boolean}} TypeDef */
/** @type {Map<string, TypeDef>} */
const TYPES = new Map();
/** `flags`: s = also ends the street before it ("Via Roma Via Grande 10"), p = a place, valid without a
 *  house number. An alias ending in "!" is an abbreviation that counts only when written with a dot. */
function addType(name, aliases, flags = '') {
  for (const alias of aliases.split(' ')) {
    const dot = alias.endsWith('!');
    TYPES.set(dot ? alias.slice(0, -1) : alias, { name, strong: flags.includes('s'), place: flags.includes('p'), dot });
  }
}
addType('Via', 'via v!', 's');
addType('Viale', 'viale vle', 's');
addType('Vicolo', 'vicolo vic!', 's');
addType('Piazza', 'piazza pzza pza', 's');
addType('Piazzale', 'piazzale ple! pzale! pzle!', 's');
addType('Piazzetta', 'piazzetta ptta!', 's');
addType('Corso', 'corso cso', 's');
addType('Largo', 'largo lgo', 's');
addType('Strada', 'strada str! sda!');
addType('Località', 'localita loc locta!', 'p');
addType('Frazione', 'frazione fraz frne!', 'p');
addType('Contrada', 'contrada cda contr!', 'p');
addType('Borgo', 'borgo bgo!');
addType('Lungomare', 'lungomare lmare!');
addType('Traversa', 'traversa trav!');
addType('Circonvallazione', 'circonvallazione circne! circonv!');
addType('Vocabolo', 'vocabolo voc!', 'p');
for (const name of ['Scali', 'Salita', 'Discesa', 'Rampa', 'Scalinata', 'Gradinata', 'Calata', 'Vico', 'Vicoletto',
  'Viottolo', 'Viuzzo', 'Stradone', 'Stradella', 'Stradello', 'Galleria', 'Passeggiata', 'Rotonda', 'Banchina',
  'Riviera', 'Calle', 'Campiello', 'Fondamenta', 'Salizada', 'Sestiere', 'Chiasso', 'Sdrucciolo', 'Villaggio',
  'Alzaia', 'Bastioni', 'Supportico', 'Sottoportico']) addType(name, name.toLowerCase());
for (const name of ['Borgata', 'Podere', 'Cascina', 'Masseria']) addType(name, name.toLowerCase(), 'p');

const ZONE_KINDS = { industriale: 'Industriale', ind: 'Industriale', indle: 'Industriale',
  artigianale: 'Artigianale', art: 'Artigianale', artle: 'Artigianale' };
const ROAD_RE = /^S\.?[SPR]\.?$/;
/** "Lungarno", "Lungotevere", "Lungadige": one word, written in many ways. */
const LUNGO_RE = /^lung(?:o|a|ar)[a-z]{2,10}$/;

const MONTHS = set('gennaio febbraio marzo aprile maggio giugno luglio agosto settembre ottobre novembre dicembre');
const NUM_MARKS = set('n nr num numero civico civ nc');
const ROAD_KINDS = set('statale provinciale regionale comunale vicinale');
const SUFFIXES = set('bis ter quater');
/** A number followed by one of these counts something, it is not a house number. */
const UNITS = set('kg g gr colli collo pz pezzi cm mm mt ore ora h euro eur lt kw giorni gg min minuti volte x');
/** Words that end a street name: what follows is not part of the address. */
const NAME_STOPS = set('tel telefono cell cellulare fax email mail destinatario mittente');
/** After "Via", these make a way of sending, not a street ("via mail"), unless a number follows. */
const VIA_STOPS = set('mail email fax corriere aerea mare terra posta sms web pec telefono whatsapp espresso '
  + 'express nave camion internet lettera raccomandata');
/** Street types that are also everyday nouns: without a number, "corso di formazione" is not a street. */
const NOUN_TYPES = set('Corso Largo Strada Salita Discesa Calata Rampa Galleria Rotonda Riviera Passeggiata '
  + 'Traversa Villaggio Banchina Circonvallazione');
/** Headings of a printed list: after "Località" they are the next column, not a place. */
const HEADINGS = set('colli cap prov provincia comune citta indirizzo peso note data numero civico destinatario '
  + 'mittente via telefono tel');
/** Staircase, flat, floor: skipped with the value that follows. */
const UNIT_MARKS = set('int interno scala sc piano pal palazzina edificio ed lotto isolato fabbricato fabb blocco '
  + 'appartamento app apt');
/** Everything up to the next comma is a person or a company. */
const CARE_OF = set('presso citofono campanello');
const PLACE_MARKS = set('loc localita locta frazione fraz frne');
/** Words that end a town. */
const TOWN_STOPS = set('tel telefono cell cellulare mobile mob fax email mail italia italy colli collo peso kg '
  + 'note nota ordine ord rif riferimento cod codice contrassegno att attn sig sigra sigr spett spettle ditta '
  + 'presso citofono int interno scala piano destinatario mittente cap prov provincia tracking ldv n nr num tot '
  + 'totale data ore consegna ritiro pacco pacchi poi dopo quindi');
const SENDER_MARKS = set('mittente mitt mittte sender speditore');
const RECIPIENT_MARKS = set('destinatario dest destinazione recipient consegnare');
/** "Rif. mitt." is the sender's reference number, not the sender. */
const REF_MARKS = set('rif riferimento ns vs');

/** Lower case inside a street or a town name. */
const PARTICLES = set('di del dello della dei degli delle da dal dallo dalla dai dagli dalle a al allo alla ai agli '
  + 'alle in nel nello nella nei negli nelle su sul sullo sulla sui sugli sulle e ed con per');
const ELIDED = set('d dell all nell sull dall de');
const ROMAN_RE = /^(?=.)x{0,3}(?:ix|iv|v?i{0,3})$/;

/** How a town of two or more words goes on, when the reader does not know it by heart. */
const TOWN_HEADS = set('san santa santo sant s monte castel castello castiglione porto borgo villa torre rocca ponte '
  + 'bagni bagno marina lido casale civita citta isola sesto reggio ascoli vibo poggio colle pieve campo riva costa '
  + 'val valle la le lo il cava piano fara gioia mola motta nova novi palma passo pian quarto serra sasso selva '
  + 'terra vico casal cassano cesano corte grotte forte');
const TOWN_LINKS = set('di del dello della dei degli delle de in a al alla allo ai sul sulla sullo nel nella e ed con '
  + 'sopra sotto da dal');
const TOWN_TAILS = set('terme marittima marittimo ligure veneto veneta romano romana milanese torinese superiore '
  + 'inferiore alta alto bassa basso vecchio vecchia nuovo nuova mare monferrato calabro calabra salentino salentina '
  + 'irpino irpina umbro umbra laziale siculo sicula emilia romagna calabria brianza canavese pavese bresciano '
  + 'bergamasco veronese vicentino trentino friulano pugliese lucano sardo tirreno ionico jonico adriatico fiorentino '
  + 'fiorentina pisano pisana senese pistoiese lucchese aretino lombarda lombardo piemonte piemontese maggiore minore '
  + 'centro scalo stazione valdarno polesine mantovano cremonese novarese vercellese parmense piacentino modenese '
  + 'bolognese ferrarese campano');
const TOWN_ABBR = { mmo: 'marittimo', mma: 'marittima', tme: 'terme' };

/* ---------- text → lines of tokens ---------- */

function prepare(text) {
  return String(text ?? '').slice(0, READ_MAX_CHARS)
    .replace(/\r\n?|[\u000b\u000c\u2028\u2029]/g, '\n')
    .replace(/[\u00a0\u2000-\u200b\u202f]/g, ' ')
    .replace(/[\u0000-\u0009\u000e-\u001f\u007f]/g, ' ')
    .replace(/[\u2018\u2019\u02bc`\u00b4]/g, "'")
    // Columns, bullets and spaced dashes separate the parts of an address like a comma does.
    .replace(/[;|\u2022\u00b7]/g, ', ')
    .replace(/ +[-\u2013\u2014] +|[\u2013\u2014]/g, ', ')
    // "V.Garibaldi" → "V. Garibaldi"; "V.le" stays.
    .replace(new RegExp(`(^|[^${WORD}.])([vV])\\.(?=[${WORD}]{4})`, 'g'), '$1$2. ');
}

/** @param {string} line @returns {Tok[]} */
function tokenize(line) {
  /** @type {Tok[]} */
  const out = [];
  let end = -1;
  for (const m of line.matchAll(TOKEN_RE)) {
    const gap = m.index !== end;
    end = m.index + m[0].length;
    if (m[1]) out.push({ k: 'w', raw: m[1], low: fold(m[1]).replace(/[.']+$/, ''), gap, digits: '', tail: '' });
    else if (m[2]) out.push({ k: 'n', raw: m[0], low: '', gap, digits: m[2], tail: fold(m[3]) });
    else out.push({ k: 'p', raw: m[0], low: '', gap, digits: '', tail: '' });
  }
  return out;
}

const key = (tok) => tok.low.replace(/\./g, '');
const isWord = (tok) => Boolean(tok) && tok.k === 'w';
const isCap = (tok) => Boolean(tok) && tok.k === 'n' && tok.digits.length === 5 && !tok.tail;
const isSep = (tok) => Boolean(tok) && tok.k === 'p' && ',.-:'.includes(tok.raw);

/* ---------- casing ---------- */

/** One word of a name, written the way a street sign writes it. */
function caseWord(raw, first = false) {
  return raw.split('-').map((part, at) => {
    const low = part.toLowerCase();
    const bare = fold(low).replace(/[.']+$/, '');
    const head = first && at === 0;
    if (!head && PARTICLES.has(bare) && !low.includes('.')) return low;
    if (low.includes("'")) {
      const cut = low.indexOf("'");
      const left = low.slice(0, cut);
      const right = low.slice(cut + 1);
      return `${!head && ELIDED.has(fold(left)) ? left : cap(left)}'${right ? cap(right) : ''}`;
    }
    if (low.includes('.')) return bare.replace(/\./g, '').length <= 2 ? part.toUpperCase() : cap(low);
    if (ROMAN_RE.test(bare)) return part.toUpperCase();
    return cap(low);
  }).join('-');
}

/** A town as it is written: every word capitalised but the particles. */
const caseTown = (words) => words.map((w, i) => caseWord(w, i === 0)).join(' ');

/**
 * The town of today as the courier types it: letters only, one line, at most 40 characters.
 * @param {string} text @returns {string}
 */
export function cleanTown(text) {
  const words = String(text ?? '').replace(new RegExp(`[^${WORD}'. -]+`, 'g'), ' ').replace(/\s+/g, ' ').trim()
    .slice(0, TOWN_MAX).trim();
  return words ? caseTown(words.split(' ')) : '';
}

/* ---------- towns ---------- */

const townKey = (text) => fold(text).replace(/['\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
/** @type {Map<string, string>|null} */
let baseTowns = null;

/** Known towns: the list the reader ships with, plus the ones the courier works in. */
function knownTowns(extra) {
  baseTowns ??= new Map(TOWNS.map((name) => [townKey(name), name]));
  /** @type {Map<string, string>} */
  const mine = new Map();
  for (const name of extra) {
    const clean = cleanTown(name);
    const k = townKey(clean);
    if (k.length >= 2 && !baseTowns.has(k)) mine.set(k, clean);
  }
  return { get: (k) => mine.get(k) ?? baseTowns?.get(k), add: (name) => mine.set(townKey(name), name) };
}

/** The longest known town written by the first words. @param {Tok[]} words */
function knownPrefix(words, known) {
  for (let n = Math.min(words.length, 7); n >= 1; n--) {
    const parts = words.slice(0, n).map((w) => TOWN_ABBR[key(w)] && w.raw.includes('.') ? TOWN_ABBR[key(w)] : w.low);
    const tries = [parts.join(' ')];
    // "S. Vincenzo", "S. Croce sull'Arno".
    if (key(words[0]) === 's' && n > 1) for (const san of ['san', 'santa', 'santo']) tries.push([san, ...parts.slice(1)].join(' '));
    for (const text of tries) {
      const name = known.get(townKey(text));
      if (name) return { n, name };
    }
  }
  return null;
}

/** How many of the words make a town the reader does not know: "Sesto San Giovanni", "Abano Terme". */
function townRun(words) {
  let n = 1;
  while (n < words.length && n < 7) {
    const cur = key(words[n]);
    if (/^(?:d|dell|nell|sull|all|dall)'./.test(words[n].low)) n += 1;
    else if (TOWN_LINKS.has(cur) && words[n + 1]) n += 2;
    else if (TOWN_HEADS.has(key(words[n - 1])) || TOWN_TAILS.has(cur)) n += 1;
    else break;
  }
  return Math.min(n, words.length);
}

/** "(LI)", ", LI", "LI" at `i`, when nothing but the end of the address follows. */
function provAt(toks, i) {
  let j = i;
  while (isSep(toks[j])) j++;
  if (toks[j]?.raw === '(' && isWord(toks[j + 1]) && toks[j + 2]?.raw === ')'
    && PROVINCES.has(toks[j + 1].raw.toUpperCase())) return { prov: toks[j + 1].raw.toUpperCase(), next: j + 3 };
  return isProvWord(toks, j) ? { prov: toks[j].raw, next: j + 1 } : null;
}

function isProvWord(toks, i) {
  const t = toks[i];
  if (!isWord(t) || t.raw.length !== 2 || t.raw !== t.raw.toUpperCase() || !PROVINCES.has(t.raw)) return false;
  const next = toks[i + 1];
  // "TORRE LE NOCELLE": a code followed by one more word of the town is a word, not a code.
  return !isWord(next) || TOWN_STOPS.has(key(next)) || next.raw === 'IT';
}

/**
 * The town that starts at `i`. A town is believed only when something says where it ends: the
 * province after it, a known name, or the postal code before it. A word that merely follows an
 * address may be a surname, and is dropped.
 * @param {Tok[]} toks @param {number} i @param {{get:(k:string)=>string|undefined}} known
 * @param {boolean} afterCap @returns {{town:string, prov:string, next:number}|null}
 */
function readTown(toks, i, known, afterCap) {
  let j = i;
  // Dictated: "via Roma 12 a Livorno".
  if (!afterCap && isWord(toks[j]) && ['a', 'ad', 'in'].includes(toks[j].low) && isWord(toks[j + 1])) j++;
  /** @type {Tok[]} */
  const words = [];
  let k = j;
  while (k < toks.length && words.length < 7) {
    const t = toks[k];
    if (isWord(t)) {
      const first = words.length === 0;
      if (!first && isProvWord(toks, k)) break;
      if (!(first && afterCap)) {
        if (TOWN_STOPS.has(key(t)) || t.raw === 'IT') break;
        if (typeAt(toks, k) && !(first && knownPrefix(wordsFrom(toks, k), known))) break;
      }
      words.push(t);
      k++;
    } else if (t.raw === '-' && !t.gap && words.length && isWord(toks[k + 1]) && !toks[k + 1].gap) {
      k++;
    } else break;
  }
  if (words.length === 0) return null;
  const closed = provAt(toks, k);
  let n = words.length;
  let town = '';
  const hit = knownPrefix(words, known);
  if (closed) {
    town = hit && hit.n === n ? hit.name : caseTown(words.map((w) => w.raw));
  } else if (hit) {
    n = hit.n;
    town = hit.name;
    // "Massa Lombarda" is not Massa.
    if (words[n] && TOWN_TAILS.has(key(words[n]))) town = `${town} ${caseWord(words[n++].raw)}`;
  } else if (afterCap) {
    n = townRun(words);
    town = caseTown(words.slice(0, n).map((w) => w.raw));
  } else return null;
  // Past the words kept, hyphens included.
  let next = j;
  for (let left = n; left > 0; next++) if (isWord(toks[next])) left--;
  const prov = n === words.length ? provAt(toks, next) : null;
  return { town: town.slice(0, TOWN_MAX), prov: prov?.prov ?? '', next: prov?.next ?? next };
}

const wordsFrom = (toks, i) => {
  const out = [];
  for (let k = i; k < toks.length && out.length < 7 && isWord(toks[k]); k++) out.push(toks[k]);
  return out;
};

/* ---------- street ---------- */

/** The street type that starts at `i`, when a name follows it. @returns {(TypeDef & {len:number})|null} */
function typeAt(toks, i) {
  const t = toks[i];
  if (!isWord(t)) return null;
  const k = key(t);
  const next = toks[i + 1];
  if (k === 'zona' && isWord(next) && ZONE_KINDS[key(next)] && isWord(toks[i + 2])) {
    return { name: `Zona ${ZONE_KINDS[key(next)]}`, strong: false, place: true, dot: false, len: 2 };
  }
  if ((k === 'zi' || k === 'za') && t.raw.includes('.') && isWord(next)) {
    return { name: k === 'zi' ? 'Zona Industriale' : 'Zona Artigianale', strong: false, place: true, dot: true, len: 1 };
  }
  if (ROAD_RE.test(t.raw)) {
    const at = isWord(next) && NUM_MARKS.has(key(next)) ? i + 2 : i + 1;
    const num = toks[at];
    if (num?.k === 'n' && num.digits.length <= 3 && !num.tail) {
      return { name: `${t.raw.replace(/\./g, '')} ${Number(num.digits)}`, strong: false, place: false, dot: false,
        len: at - i + 1 };
    }
    return null;
  }
  const def = TYPES.get(k) ?? (LUNGO_RE.test(k) ? { name: cap(k), strong: false, place: false, dot: false } : null);
  if (!def || (def.dot && !t.raw.includes('.'))) return null;
  if (!next || (next.k !== 'w' && next.k !== 'n')) return null;
  return { ...def, len: 1 };
}

/** Index of the number announced by "n.", "n°", "civico" at `i`, or -1. */
function numberAfterMark(toks, i) {
  let j = i + 1;
  while (toks[j] && toks[j].k === 'p' && '.°º:'.includes(toks[j].raw)) j++;
  return toks[j]?.k === 'n' ? j : -1;
}

/**
 * The house number at `i`: "12", "12a", "12/A", "12 bis", "12/2", "12-14", "12 rosso".
 * Null when the number is something else: a phone, a postal code, a weight, a count.
 * @returns {{text:string, next:number}|null}
 */
function readNumber(toks, i) {
  const t = toks[i];
  if (t.digits.length > 4) return null;
  let text = String(Number(t.digits));
  let next = i + 1;
  if (t.tail) {
    if (SUFFIXES.has(t.tail)) text += ` ${t.tail}`;
    else if (t.tail.length === 1 && !(t.tail === 'h' && ['24', '48', '72'].includes(t.digits))) text += `/${t.tail.toUpperCase()}`;
    else return null;
  } else {
    const a = toks[next];
    const b = toks[next + 1];
    if (a && (a.raw === '/' || (a.raw === '-' && !a.gap)) && b) {
      if (isWord(b) && b.low.length === 1) {
        text += `/${b.low.toUpperCase()}`;
        next += 2;
      } else if (isWord(b) && SUFFIXES.has(b.low)) {
        text += ` ${b.low}`;
        next += 2;
      } else if (b.k === 'n' && b.digits.length <= 3 && b.tail.length <= 1) {
        text += `${a.raw}${Number(b.digits)}${b.tail ? `/${b.tail.toUpperCase()}` : ''}`;
        next += 2;
      }
    } else if (isWord(a) && SUFFIXES.has(a.low)) {
      text += ` ${a.low}`;
      next++;
    } else if (isWord(a) && (a.low === 'rosso' || a.low === 'rossa')) {
      text += '/R';
      next++;
    } else if (isWord(a) && a.raw.length === 1) {
      // "12 B Livorno" and "12 A LIVORNO" are 12/B and 12/A; "12 a Livorno" (dictated) is number 12
      // "in" Livorno.
      const after = toks[next + 1];
      const closes = !after || after.raw === ',' || isCap(after);
      const letter = a.raw !== a.low || !'aeio'.includes(a.low);
      if (closes || (letter && isWord(after))) {
        text += `/${a.low.toUpperCase()}`;
        next++;
      }
    }
  }
  const z = toks[next];
  if (isWord(z) && UNITS.has(key(z))) return null;
  // "Via Roma 333 1234567", "Via Roma 0586 123456": the street has no number, that is a phone.
  if (z?.k === 'n' && z.digits.length >= 5 && !isCap(z) && /^(?:3[0-9][0-9]|0[0-9]+)$/.test(t.digits)) return null;
  if (z && ':€%'.includes(z.raw)) return null;
  return { text, next };
}

/** "km 312", "km 3,5", "km 3+200" at `i` (the word "km"). */
function readKm(toks, i) {
  const n = toks[i + 1]?.k === 'p' && toks[i + 1].raw === '.' ? i + 2 : i + 1;
  const a = toks[n];
  if (!a || a.k !== 'n' || a.tail || a.digits.length > 4) return null;
  const p = toks[n + 1];
  const b = toks[n + 2];
  if (p && ',.+'.includes(p.raw) && !p.gap && b?.k === 'n' && !b.gap && b.digits.length <= 3 && !b.tail) {
    return { text: `km ${a.digits}${p.raw}${b.digits}`, next: n + 3 };
  }
  return { text: `km ${a.digits}`, next: n + 1 };
}

/**
 * Street name and house number from the token after the type.
 * @returns {{name:string, words:Tok[], number:string, next:number, stop:'num'|'comma'|'eol'|'type'|'other'}}
 */
function readStreet(toks, i, type) {
  let name = '';
  /** @type {Tok[]} */
  const words = [];
  let number = '';
  /** @type {'num'|'comma'|'eol'|'type'|'other'} */
  let stop = 'eol';
  let j = i;
  const add = (text, glue = false) => {
    name += glue || !name ? text : ` ${text}`;
  };
  while (j < toks.length) {
    const t = toks[j];
    if (t.k === 'w') {
      const k = key(t);
      if (NUM_MARKS.has(k) && numberAfterMark(toks, j) >= 0 && words.length) {
        j = numberAfterMark(toks, j);
        continue;
      }
      if (words.length && (k === 'snc' || (k === 'sn' && t.raw.includes('.')))) {
        number = 'snc';
        j++;
        stop = 'num';
        break;
      }
      // "SS 1 km 312": a numbered road needs no name before its kilometre.
      if ((words.length || /^S[SPR] /.test(type.name)) && k === 'km') {
        const km = readKm(toks, j);
        if (km) {
          number = km.text;
          j = km.next;
          stop = 'num';
          break;
        }
      }
      if (NAME_STOPS.has(k) || words.length >= 8) {
        stop = 'other';
        break;
      }
      if (words.length && typeAt(toks, j)?.strong && !PARTICLES.has(key(words[words.length - 1]))) {
        stop = 'type';
        break;
      }
      words.push(t);
      add(caseWord(t.raw));
      j++;
    } else if (t.k === 'n') {
      const after = toks[j + 1];
      const ordinal = after && '°º'.includes(after.raw);
      const month = toks[ordinal ? j + 2 : j + 1];
      if (!t.tail && t.digits.length <= 2 && isWord(month) && MONTHS.has(key(month))) {
        // "Via 4 Novembre", "Via 1° Maggio": the number is the name.
        add(`${Number(t.digits)}${ordinal ? '°' : ''}`);
        j += ordinal ? 2 : 1;
        continue;
      }
      if (!t.tail && t.digits.length <= 3 && words.length && type.name === 'Strada'
        && ROAD_KINDS.has(key(words[words.length - 1]))) {
        add(String(Number(t.digits)));
        j++;
        continue;
      }
      const num = words.length ? readNumber(toks, j) : null;
      if (num) {
        number = num.text;
        j = num.next;
        stop = 'num';
      } else stop = 'other';
      break;
    } else if (t.raw === ',') {
      const mark = isWord(toks[j + 1]) && NUM_MARKS.has(key(toks[j + 1])) && numberAfterMark(toks, j + 1) >= 0;
      if (mark || (toks[j + 1]?.k === 'n' && !isCap(toks[j + 1]))) {
        j++;
        continue;
      }
      j++;
      stop = 'comma';
      break;
    } else if (t.raw === '-' && !t.gap && words.length && isWord(toks[j + 1]) && !toks[j + 1].gap) {
      // "Via Tosco-Romagnola".
      add(`-${caseWord(toks[j + 1].raw)}`, true);
      words.push(toks[j + 1]);
      j += 2;
    } else if (t.raw === '.') {
      j++;
    } else {
      stop = 'other';
      break;
    }
  }
  return { name, words, number, next: j, stop };
}

/**
 * What follows the house number: staircase and flat (skipped), a hamlet, postal code, town, province.
 * @returns {{cap:string, town:string, prov:string, place:string, next:number}}
 */
function readTail(toks, i, known) {
  let j = i;
  let capCode = '';
  let place = '';
  const skip = () => {
    while (isSep(toks[j])) j++;
  };
  const toComma = () => {
    while (j < toks.length && toks[j].raw !== ',') j++;
  };
  for (;;) {
    skip();
    const t = toks[j];
    if (!isWord(t)) break;
    const k = key(t);
    const value = toks[j + 1];
    if (k === 'c' && toks[j + 1]?.raw === '/' && toks[j + 2]?.low === 'o') toComma();
    else if (k === 'co' && t.raw.includes('.')) toComma();
    else if (CARE_OF.has(k)) toComma();
    else if (UNIT_MARKS.has(k) && value && (value.k === 'n' ? !isCap(value) : isWord(value) && value.raw.length <= 3)) j += 2;
    else break;
  }
  skip();
  if (isWord(toks[j]) && PLACE_MARKS.has(key(toks[j])) && isWord(toks[j + 1])) {
    const words = [];
    for (j++; isWord(toks[j]) && words.length < 4 && !isProvWord(toks, j); j++) words.push(toks[j].raw);
    place = caseTown(words);
    skip();
  }
  if (isCap(toks[j])) {
    capCode = toks[j].digits;
    j++;
    skip();
  }
  const town = readTown(toks, j, known, Boolean(capCode));
  if (town) j = town.next;
  skip();
  if (!capCode && town && isCap(toks[j])) {
    capCode = toks[j].digits;
    j++;
  }
  return { cap: capCode, town: town?.town ?? '', prov: town?.prov ?? '', place, next: j };
}

/** Index of the first token that is not a list mark ("1.", "2)", "-") or a label ("Indirizzo:"). */
function lineStart(toks) {
  let i = 0;
  while (toks[i] && toks[i].k === 'p') i++;
  if (toks[i]?.k === 'n' && !toks[i].tail && toks[i].digits.length <= 3 && toks[i + 1] && '.)'.includes(toks[i + 1].raw)) i += 2;
  for (let n = 1; n <= 2; n++) {
    if (toks.slice(i, i + n).every(isWord) && toks[i + n]?.raw === ':') {
      i += n + 1;
      break;
    }
  }
  while (toks[i] && toks[i].k === 'p') i++;
  return i;
}

const restIsEmpty = (toks, i) => toks.slice(i).every((t) => t.k === 'p');

/**
 * Every address in the text, in the order it is written, repeats included.
 * @param {string} text
 * @param {{town?:string, towns?:string[]}} [opts] `town`: the town of today, for the addresses that
 *   name none; `towns`: towns the courier already works in (they are recognised without a postal code)
 * @returns {Found[]}
 */
export function extractAddresses(text, opts = {}) {
  return scan(prepare(text).split('\n'), opts).found;
}

/**
 * @param {string[]} rawLines
 * @returns {{found:Found[], lineOf:number[], used:Set<number>}} `lineOf`: the line each address starts
 *   on; `used`: the lines an address was read from
 */
function scan(rawLines, opts) {
  const today = cleanTown(opts.town ?? '');
  const known = knownTowns([today, ...(opts.towns ?? [])]);
  const lines = rawLines.map(tokenize);
  /** @type {Set<number>} */
  const used = new Set();
  /** @type {any[]} */
  const list = [];
  // "Mittente" marks the address that follows it, on the same line or within the next three.
  let senderAt = -9;
  const hasType = (row, from) => row.some((x, n) => n >= from && typeAt(row, n));

  for (let li = 0; li < lines.length; li++) {
    if (used.has(li)) continue;
    const toks = lines[li];
    const first = lineStart(toks);
    let i = 0;
    while (i < toks.length) {
      const t = toks[i];
      if (isWord(t) && SENDER_MARKS.has(key(t)) && !REF_MARKS.has(key(toks[i - 1] ?? t))) senderAt = li;
      else if (isWord(t) && RECIPIENT_MARKS.has(key(t))) senderAt = -9;
      const type = typeAt(toks, i);
      if (!type) {
        i++;
        continue;
      }
      const street = readStreet(toks, i + type.len, type);
      // "Ristorante La Strada Via Verdi 3": the street is the second one. Only a "Traversa" is named
      // after another street.
      const inner = type.name !== 'Traversa' && Boolean(typeAt(toks, i + type.len)?.strong);
      if (inner || (street.words.length === 0 && !/^S[SPR] /.test(type.name))) {
        i += type.len;
        continue;
      }
      let end = street.next;
      /** @type {{cap:string, town:string, prov:string, place:string, next:number}} */
      let tail = { cap: '', town: '', prov: '', place: '', next: end };
      if (street.stop !== 'type') {
        tail = readTail(toks, end, known);
        end = tail.next;
      }
      let name = street.name;
      const whole = i === first && restIsEmpty(toks, end);
      // "via roma livorno", dictated without a number: the last known words are the town.
      if (!street.number && !tail.town && whole && street.stop === 'eol' && !type.place) {
        for (let n = Math.min(street.words.length - 1, 6); n >= 1 && !tail.town; n--) {
          const hit = knownPrefix(street.words.slice(-n), known);
          if (hit && hit.n === n) {
            tail.town = hit.name;
            name = street.words.slice(0, -n).map((w) => caseWord(w.raw)).join(' ');
          }
        }
      }
      // The town on a line below ("57125 LIVORNO LI"), also past one line of something else. A line that
      // is only a hamlet ("LOC. STAGNO") belongs to the street above it.
      /** @type {number[]} */
      let below = [];
      if (!tail.town && !tail.cap && street.stop !== 'type' && !hasType(toks, end)) {
        /** @type {number[]} */
        const maybe = [];
        let place = '';
        for (let at = li + 1, seen = 0; at < lines.length && seen < 2 && !used.has(at); at++) {
          const row = lines[at];
          if (row.length === 0) continue;
          const more = readTail(row, lineStart(row), known);
          const anchored = Boolean(more.cap || more.prov) || !more.place;
          if (more.town && anchored && !hasType(row, more.next)) {
            below = [...maybe, at];
            tail = { ...tail, cap: more.cap, town: more.town, prov: more.prov, place: tail.place || more.place || place };
            break;
          }
          if (more.place && !more.town && !more.cap && !place && seen === 0 && restIsEmpty(row, more.next)) {
            place = more.place;
            maybe.push(at);
            continue;
          }
          if (hasType(row, 0)) break;
          seen++;
        }
        if (below.length === 0 && place && !tail.place) {
          below = maybe;
          tail = { ...tail, place };
        }
      }
      const bare = !street.number;
      // A line that is only a street ("Piazza Cavour") is an address; "via mail" and "corso di
      // formazione" are not.
      const lead = key(street.words[0] ?? { low: '' });
      const phrase = type.name === 'Via' ? VIA_STOPS.has(lead) : NOUN_TYPES.has(type.name) && PARTICLES.has(lead);
      // "Indirizzo  Località  Colli": the heading of a column, not a hamlet.
      const hamlet = type.place && street.words.length <= 5 && !HEADINGS.has(lead);
      const ok = !bare || hamlet || Boolean(tail.cap) || (whole && !phrase && street.words.length <= 6);
      if (!ok) {
        i += type.len;
        continue;
      }
      for (const at of below) used.add(at);
      used.add(li);
      const streetName = [type.name, name].filter(Boolean).join(' ');
      list.push({
        street: streetName, name, number: street.number, cap: tail.cap, town: tail.town, prov: tail.prov, place: tail.place,
        sender: li - senderAt <= 3, placeOnly: type.place && bare, line: li, from: i, to: end,
        gave: Boolean(tail.town || tail.cap || tail.place),
      });
      if (tail.town) known.add(tail.town);
      senderAt = -9;
      i = Math.max(end, i + type.len);
    }
  }
  const done = finish(list, lines, today);
  return { found: done.map((d) => d.found), lineOf: done.map((d) => d.line), used };
}

/**
 * Hamlets joined to their street, towns filled in, the one line written.
 * @returns {{found:Found, line:number}[]}
 */
function finish(list, lines, today) {
  /** @type {any[]} */
  const merged = [];
  for (const cur of list) {
    const prev = merged[merged.length - 1];
    // "Loc. Stagno, Via Aurelia 5": one address, the hamlet tells where the street is.
    const next = prev && cur.line === prev.line && lines[cur.line].slice(prev.to, cur.from).every((t) => t.k === 'p');
    if (next && prev.placeOnly && !prev.gave && !cur.placeOnly && !cur.place) {
      merged.pop();
      merged.push({ ...cur, place: prev.name, sender: prev.sender || cur.sender });
    } else if (next && cur.placeOnly && !prev.placeOnly && !prev.gave) {
      // "Via dell'Artigianato 4, Z.I. Picchianti" and the town under it: the same, the other way round.
      merged.pop();
      merged.push({ ...prev, place: cur.name, cap: cur.cap, town: cur.town, prov: cur.prov });
    } else merged.push(cur);
  }
  let last = '';
  let lastIsToday = false;
  return merged.map((a) => {
    let town = a.town;
    let place = a.place;
    /** @type {Found['townFrom']} */
    let townFrom = town ? 'text' : '';
    if (!town && place) {
      town = place;
      place = '';
      townFrom = 'text';
    } else if (!town && last) {
      town = last;
      // A list without towns is all in the town of today, not "in the town of the line above".
      townFrom = lastIsToday ? 'default' : 'previous';
    } else if (!town && today) {
      town = today;
      townFrom = 'default';
    }
    // The town of the sender says nothing about where the next parcel goes.
    if (town && !a.sender) {
      last = town;
      lastIsToday = townFrom === 'default';
    }
    const number = a.number && a.number !== 'snc' ? ` ${a.number}` : '';
    const text = [`${a.street}${number}`, place, town].filter(Boolean).join(', ').slice(0, QUERY_MAX).trim();
    return { line: a.line, found: { street: a.street, number: a.number, cap: a.cap, town, prov: a.prov, place,
      townFrom, sender: a.sender, text, key: normalizeAddress(text) } };
  });
}

/**
 * A scanned label, a dictated sentence or a pasted list → the stops to look for. Lines that are
 * coordinates ("43.5519, 10.3080 cancello") stay points; the addresses are read out of the rest;
 * what is neither is dropped. Repeats are counted once and the list is cut at 150.
 * @param {string} text @param {{town?:string, towns?:string[], max?:number}} [opts]
 * @returns {{items:(AddressItem|CoordsItem)[], repeated:number, over:number, ignored:number}}
 *   `ignored`: lines with text in which no address was found
 */
export function readStops(text, opts = {}) {
  const max = opts.max ?? PASTE_MAX_LINES;
  const lines = prepare(text).split('\n');
  /** @type {Map<number, CoordsItem>} */
  const points = new Map();
  lines.forEach((line, at) => {
    const point = parseCoords(line.replace(/^\s*(?:\d{1,3}[.)]\s+|[-*,]\s*)+/, ''));
    if (!point) return;
    points.set(at, { kind: 'coords', id: `@${point.lat},${point.lon}`, ...point });
    lines[at] = '';
  });
  const { found, lineOf, used } = scan(lines, opts);
  /** @type {(AddressItem|CoordsItem)[]} */
  const items = [];
  const seen = new Set();
  let repeated = 0;
  let over = 0;
  const push = (item) => {
    if (!item.id) return;
    if (seen.has(item.id)) repeated++;
    else if (items.length >= max) over++;
    else {
      seen.add(item.id);
      items.push(item);
    }
  };
  let f = 0;
  for (let at = 0; at < lines.length; at++) {
    const point = points.get(at);
    if (point) push(point);
    for (; f < found.length && lineOf[f] <= at; f++) push({ kind: 'address', id: found[f].key, ...found[f] });
  }
  const ignored = lines.filter((line, at) => line.trim().length > 1 && !used.has(at)).length;
  return { items, repeated, over, ignored };
}
