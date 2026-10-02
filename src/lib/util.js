export const byVorname = (a, b) =>
  (a.vorname || '').localeCompare(b.vorname || '', 'de') ||
  (a.nachname || '').localeCompare(b.nachname || '', 'de')

export const fullName = p => [p.vorname, p.nachname].filter(Boolean).join(' ')

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fmtDate(iso, opts = {}) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', ...opts })
}
export const fmtShort = iso => iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.` : ''
export const weekday = iso => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'long' })
}

export function age(geb, atISO) {
  if (!geb) return null
  const [gy, gm, gd] = geb.split('-').map(Number)
  const [y, m, d] = (atISO || todayISO()).split('-').map(Number)
  let a = y - gy
  if (m < gm || (m === gm && d < gd)) a--
  return a
}

// Geburtstag innerhalb von ±3 Tagen um ein Datum?
export function birthdayNear(geb, atISO) {
  if (!geb || !atISO) return false
  const [, gm, gd] = geb.split('-').map(Number)
  const [y, m, d] = atISO.split('-').map(Number)
  const at = new Date(y, m - 1, d)
  for (const yy of [y - 1, y, y + 1]) {
    const diff = (new Date(yy, gm - 1, gd) - at) / 86400000
    if (Math.abs(diff) <= 3) return true
  }
  return false
}

// Saison = September bis August, benannt nach Startjahr: "2025/26"
export function seasonOf(iso) {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7))
  const start = m >= 9 ? y : y - 1
  return start
}
export const seasonLabel = start => `${start}/${String(start + 1).slice(2)}`

// Nächster Freitag (heute, falls Freitag)
export function nextFriday() {
  const d = new Date()
  const diff = (5 - d.getDay() + 7) % 7
  d.setDate(d.getDate() + diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const STATUS = {
  X: { label: 'da', kurz: 'X', cls: 'ok' },
  E: { label: 'entschuldigt', kurz: 'E', cls: 'warn' },
  '-': { label: 'fehlt', kurz: '–', cls: 'bad' },
}

export const P_STUFEN = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9']
export const GERAETE = [
  ['sprung', 'Sprung'], ['reck', 'Reck'], ['boden', 'Boden'], ['balken', 'Balken'],
]

export const num = v => (v === '' || v === null || v === undefined) ? null : Number(String(v).replace(',', '.'))
export const fmtNum = v => (v === null || v === undefined) ? '' : Number(v).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
