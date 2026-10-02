import { useMemo, useState } from 'react'
import { useStore, upsert, remove, newId } from '../lib/store'
import { byVorname, fullName, fmtDate, age } from '../lib/util'
import { Sheet, Field, confirmDialog } from '../components/ui'

// aus "Mama Sabine 0171 123 4567 / 07032…" die erste Nummer herausziehen
export const telHref = s => (String(s).match(/\+?[\d][\d\s\-/()]{5,}/) || [''])[0].split('/')[0].replace(/[^\d+]/g, '')

const FILTER = [
  ['aktiv', 'Aktiv'], ['warteliste', 'Warteliste'], ['ehemalig', 'Ehemalige'], ['trainerin', 'Trainerteam'],
]

export default function Personen() {
  const { data } = useStore()
  const [filter, setFilter] = useState('aktiv')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return data.personen
      .filter(p => filter === 'trainerin' ? p.rolle === 'trainerin' : (p.rolle === 'turnerin' && p.status === filter))
      .filter(p => !s || fullName(p).toLowerCase().includes(s) || (p.telefon || '').includes(s))
      .sort(byVorname)
  }, [data.personen, filter, q])

  const counts = Object.fromEntries(FILTER.map(([k]) => [k,
    data.personen.filter(p => k === 'trainerin' ? p.rolle === 'trainerin' : (p.rolle === 'turnerin' && p.status === k)).length]))

  return (
    <>
      <div className="card">
        <div className="row">
          <h1 className="grow">Mädels</h1>
          <button className="btn secondary" onClick={() => setEdit({ id: null, rolle: filter === 'trainerin' ? 'trainerin' : 'turnerin', status: filter === 'trainerin' ? 'aktiv' : filter })}>Neu</button>
        </div>
        <div className="chips" style={{ marginTop: 12 }}>
          {FILTER.map(([k, l]) => (
            <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l} {counts[k]}</button>
          ))}
        </div>
        <input style={{ marginTop: 12 }} type="search" placeholder="Suchen…" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <div className="list" style={{ marginTop: 12 }}>
        {list.map(p => (
          <button key={p.id} className="item tappable" onClick={() => setEdit(p)}>
            <div className="grow">
              <div className="name">{fullName(p)}</div>
              <div className="meta ellipsis">
                {p.geburtsdatum ? `${fmtDate(p.geburtsdatum)} (${age(p.geburtsdatum)}) · ` : ''}
                {p.telefon || (p.email ? p.email : 'keine Kontaktdaten')}{p.notfallkontakt ? ' · Notfall ✓' : ''}
              </div>
            </div>
            {p.telefon && (
              <a className="iconbtn" style={{ background: 'var(--soft-ok)', color: 'var(--ok)' }}
                href={`tel:${telHref(p.telefon)}`} onClick={e => e.stopPropagation()} aria-label={`${fullName(p)} anrufen`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>
              </a>
            )}
          </button>
        ))}
        {list.length === 0 && <div className="empty">Niemand gefunden.</div>}
      </div>

      {edit && <PersonSheet p={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function PersonSheet({ p, onClose }) {
  const [f, setF] = useState({
    vorname: '', nachname: '', geburtsdatum: '', rolle: 'turnerin', status: 'aktiv',
    telefon: '', email: '', notfallkontakt: '', adresse: '', bemerkung: '', letztes_training: '', ...p,
  })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const isNew = !p.id
  function save() {
    if (!f.vorname.trim()) return
    upsert('personen', {
      id: p.id || newId(), vorname: f.vorname.trim(), nachname: (f.nachname || '').trim(),
      geburtsdatum: f.geburtsdatum || null, rolle: f.rolle, status: f.status,
      telefon: f.telefon || null, email: f.email || null, notfallkontakt: f.notfallkontakt || null, adresse: f.adresse || null,
      bemerkung: f.bemerkung || null, letztes_training: f.letztes_training || null,
    })
    onClose()
  }
  function del() {
    if (!confirmDialog(`${fullName(p)} endgültig löschen? Auch Anwesenheit und Meldungen gehen verloren. Besser: Status auf „ehemalig“ setzen.`)) return
    remove('personen', p); onClose()
  }
  return (
    <Sheet title={isNew ? 'Neue Person' : fullName(p)} onClose={onClose}
      footer={<div className="row"><button className="btn block grow" onClick={save} disabled={!f.vorname.trim()}>Speichern</button>{!isNew && <button className="btn danger" onClick={del}>Löschen</button>}</div>}>
      <div className="grid2">
        <Field label="Vorname"><input value={f.vorname} onChange={e => set('vorname', e.target.value)} autoFocus={isNew} /></Field>
        <Field label="Nachname"><input value={f.nachname || ''} onChange={e => set('nachname', e.target.value)} /></Field>
      </div>
      <Field label="Geburtsdatum"><input type="date" value={f.geburtsdatum || ''} onChange={e => set('geburtsdatum', e.target.value)} /></Field>
      <Field label="Rolle">
        <div className="chips">
          <button className={`chip ${f.rolle === 'turnerin' ? 'on' : ''}`} onClick={() => set('rolle', 'turnerin')}>Turnerin</button>
          <button className={`chip ${f.rolle === 'trainerin' ? 'on' : ''}`} onClick={() => set('rolle', 'trainerin')}>Trainer/in</button>
        </div>
      </Field>
      <Field label="Status">
        <div className="chips">
          {[['aktiv', 'Aktiv'], ['warteliste', 'Warteliste'], ['ehemalig', 'Ehemalig']].map(([k, l]) => (
            <button key={k} className={`chip ${f.status === k ? 'on' : ''}`} onClick={() => set('status', k)}>{l}</button>
          ))}
        </div>
      </Field>
      <Field label="Telefon"><input type="tel" value={f.telefon || ''} onChange={e => set('telefon', e.target.value)} /></Field>
      <Field label="E-Mail"><input type="email" value={f.email || ''} onChange={e => set('email', e.target.value)} /></Field>
      <Field label="Notfallkontakt (Name + Nummer)"><input type="tel" value={f.notfallkontakt || ''} onChange={e => set('notfallkontakt', e.target.value)} placeholder="z. B. Mama Sabine 0171 1234567" /></Field>
      <Field label="Adresse (optional)"><input value={f.adresse || ''} onChange={e => set('adresse', e.target.value)} /></Field>
      {f.notfallkontakt && /\d{4}/.test(f.notfallkontakt) && <p className="small"><a href={`tel:${telHref(f.notfallkontakt)}`}>Notfallkontakt anrufen</a></p>}
      {f.status === 'ehemalig' && <Field label="Letztes Training"><input value={f.letztes_training || ''} onChange={e => set('letztes_training', e.target.value)} placeholder="z. B. Juli 2025" /></Field>}
      <Field label="Bemerkung"><textarea value={f.bemerkung || ''} onChange={e => set('bemerkung', e.target.value)} /></Field>
      {f.email && <p className="small"><a href={`mailto:${f.email}`}>E-Mail schreiben</a></p>}
    </Sheet>
  )
}
