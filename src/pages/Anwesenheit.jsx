import { useMemo, useState } from 'react'
import { useStore, upsert, remove, newId } from '../lib/store'
import { byVorname, fullName, fmtDate, weekday, nextFriday, birthdayNear, age, STATUS } from '../lib/util'
import { Sheet, Field, Empty, confirmDialog } from '../components/ui'

export default function Anwesenheit() {
  const { data } = useStore()
  const tage = useMemo(() => [...data.trainingstage].sort((a, b) => b.datum.localeCompare(a.datum)), [data.trainingstage])
  const [tagId, setTagId] = useState(() => tage[0]?.id ?? null)
  const [neu, setNeu] = useState(false)
  const [ausfall, setAusfall] = useState(false)

  const tag = tage.find(t => t.id === tagId) || tage[0]
  const marks = useMemo(() => {
    const m = new Map()
    if (tag) for (const a of data.anwesenheit) if (a.trainingstag_id === tag.id) m.set(a.person_id, a.status)
    return m
  }, [data.anwesenheit, tag])

  const turnerinnen = data.personen.filter(p => p.rolle === 'turnerin' && p.status === 'aktiv').sort(byVorname)
  const trainerinnen = data.personen.filter(p => p.rolle === 'trainerin' && p.status === 'aktiv').sort(byVorname)
  // Personen, die heute nicht aktiv sind, für diesen Tag aber einen Eintrag haben (ältere Tage)
  const weitere = data.personen.filter(p => marks.has(p.id) && !(p.status === 'aktiv')).sort(byVorname)

  const anwesend = turnerinnen.filter(p => marks.get(p.id) === 'X').length
    + weitere.filter(p => p.rolle === 'turnerin' && marks.get(p.id) === 'X').length
  const offen = turnerinnen.filter(p => !marks.has(p.id)).length

  function setStatus(pid, status) {
    if (!tag) return
    const current = marks.get(pid)
    if (current === status) remove('anwesenheit', { trainingstag_id: tag.id, person_id: pid })
    else upsert('anwesenheit', { trainingstag_id: tag.id, person_id: pid, status })
  }

  function createTag(datum) {
    const existing = data.trainingstage.find(t => t.datum === datum)
    if (existing) { setTagId(existing.id); setNeu(false); return }
    const t = upsert('trainingstage', { id: newId(), datum, ausgefallen: false, grund: null, notiz: null })
    setTagId(t.id); setNeu(false)
  }

  function deleteTag() {
    if (!tag) return
    if (!confirmDialog(`Trainingstag ${fmtDate(tag.datum)} samt Anwesenheit löschen?`)) return
    remove('trainingstage', tag)
    setTagId(null)
  }

  return (
    <>
      <div className="card">
        <div className="row">
          <div className="grow">
            {tag ? (
              <>
                <div className="muted small">{weekday(tag.datum)}</div>
                <h1>{fmtDate(tag.datum)}</h1>
              </>
            ) : <h1>Kein Trainingstag</h1>}
          </div>
          <button className="btn secondary" onClick={() => setNeu(true)}>Neuer Tag</button>
        </div>
        {tage.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <select value={tag?.id || ''} onChange={e => setTagId(e.target.value)} aria-label="Trainingstag wählen">
              {tage.map(t => (
                <option key={t.id} value={t.id}>
                  {fmtDate(t.datum)}{t.ausgefallen ? ' – ausgefallen' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        {tag && (
          <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <button className={`chip ${tag.ausgefallen ? 'on' : ''}`} onClick={() => setAusfall(true)}>
              {tag.ausgefallen ? `Ausgefallen: ${tag.grund || 'ohne Grund'}` : 'Training ausgefallen?'}
            </button>
            <button className="btn ghost small" onClick={deleteTag}>Tag löschen</button>
          </div>
        )}
      </div>

      {!tag && <Empty>Lege einen Trainingstag an, um die Anwesenheit einzutragen.</Empty>}

      {tag && (
        <>
          <div className="section-title">Mädels ({turnerinnen.length})</div>
          <div className="list">
            {turnerinnen.map(p => <Row key={p.id} p={p} tag={tag} status={marks.get(p.id)} onSet={setStatus} />)}
            {turnerinnen.length === 0 && <div className="empty">Noch keine aktiven Mädels. Unter „Mädels“ anlegen.</div>}
          </div>

          {weitere.length > 0 && (
            <>
              <div className="section-title">Weitere Einträge an diesem Tag</div>
              <div className="list">
                {weitere.map(p => <Row key={p.id} p={p} tag={tag} status={marks.get(p.id)} onSet={setStatus} />)}
              </div>
            </>
          )}

          <div className="section-title">Trainerteam</div>
          <div className="list">
            {trainerinnen.map(p => <Row key={p.id} p={p} tag={tag} status={marks.get(p.id)} onSet={setStatus} />)}
          </div>

          <div className="sumbar">
            <div>
              <span>{anwesend} da</span>
              {offen > 0 && <span style={{ opacity: .7 }}>{offen} offen</span>}
            </div>
          </div>
        </>
      )}

      {neu && <NeuerTag onClose={() => setNeu(false)} onCreate={createTag} />}
      {ausfall && tag && <Ausfall tag={tag} onClose={() => setAusfall(false)} />}
    </>
  )
}

function Row({ p, tag, status, onSet }) {
  const bday = birthdayNear(p.geburtsdatum, tag.datum)
  const a = age(p.geburtsdatum, tag.datum)
  return (
    <div className="item">
      <div className="grow">
        <div className="name ellipsis">{fullName(p)} {bday && <span title="Geburtstag" aria-label="Geburtstag">🎂</span>}</div>
        <div className="meta">
          {p.geburtsdatum ? `${fmtDate(p.geburtsdatum)} · ${a} J.` : (p.rolle === 'trainerin' ? 'Trainer/in' : '')}
        </div>
      </div>
      <div className="seg" role="group" aria-label={`Status ${fullName(p)}`}>
        {Object.entries(STATUS).map(([k, s]) => (
          <button key={k} className={`${s.cls} ${status === k ? 'on' : ''}`} onClick={() => onSet(p.id, k)}
            aria-pressed={status === k} title={s.label}>{s.kurz}</button>
        ))}
      </div>
    </div>
  )
}

function NeuerTag({ onClose, onCreate }) {
  const [datum, setDatum] = useState(nextFriday())
  return (
    <Sheet title="Neuer Trainingstag" onClose={onClose}
      footer={<button className="btn block" onClick={() => datum && onCreate(datum)}>Anlegen</button>}>
      <Field label="Datum"><input type="date" value={datum} onChange={e => setDatum(e.target.value)} /></Field>
      <p className="muted small">Vorbelegt ist der nächste Freitag. Gibt es den Tag schon, wird er geöffnet.</p>
    </Sheet>
  )
}

function Ausfall({ tag, onClose }) {
  const [aus, setAus] = useState(tag.ausgefallen)
  const [grund, setGrund] = useState(tag.grund || '')
  const [notiz, setNotiz] = useState(tag.notiz || '')
  function save() {
    upsert('trainingstage', { ...tag, ausgefallen: aus, grund: aus ? (grund || null) : null, notiz: notiz || null })
    onClose()
  }
  return (
    <Sheet title={`Training am ${fmtDate(tag.datum)}`} onClose={onClose}
      footer={<button className="btn block" onClick={save}>Speichern</button>}>
      <div className="chips" style={{ marginBottom: 14 }}>
        <button className={`chip ${!aus ? 'on' : ''}`} onClick={() => setAus(false)}>Hat stattgefunden</button>
        <button className={`chip ${aus ? 'on' : ''}`} onClick={() => setAus(true)}>Ausgefallen</button>
      </div>
      {aus && (
        <Field label="Grund">
          <input list="gruende" value={grund} onChange={e => setGrund(e.target.value)} placeholder="z. B. Halle belegt" />
          <datalist id="gruende">
            <option value="Halle belegt" /><option value="Ferien" /><option value="Feiertag" />
            <option value="Trainerin krank" /><option value="Wettkampf" />
          </datalist>
        </Field>
      )}
      <Field label="Notiz zum Tag"><textarea value={notiz} onChange={e => setNotiz(e.target.value)} /></Field>
    </Sheet>
  )
}
