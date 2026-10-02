import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { byVorname, fullName, fmtShort, fmtDate, seasonOf, seasonLabel } from '../lib/util'
import { Empty } from '../components/ui'

const ALLE = 'alle'
const rolleFirst = (a, b) => (a.rolle === b.rolle ? 0 : a.rolle === 'turnerin' ? -1 : 1)

export default function Uebersicht() {
  const { data } = useStore()
  const seasons = useMemo(() => {
    const s = new Set(data.trainingstage.map(t => seasonOf(t.datum)))
    return [...s].sort((a, b) => b - a)
  }, [data.trainingstage])
  const [season, setSeason] = useState(() => seasons[0])
  const [view, setView] = useState('matrix')
  const [sort, setSort] = useState('name')
  const sel = season === ALLE ? ALLE : (seasons.includes(season) ? season : seasons[0])

  const tage = useMemo(() => data.trainingstage
    .filter(t => sel === ALLE || seasonOf(t.datum) === sel)
    .sort((a, b) => a.datum.localeCompare(b.datum)), [data.trainingstage, sel])
  const tagById = useMemo(() => new Map(tage.map(t => [t.id, t])), [tage])

  // person -> Map(tagId -> status), nur Tage im gewählten Zeitraum
  const marks = useMemo(() => {
    const m = new Map()
    for (const a of data.anwesenheit) {
      if (!tagById.has(a.trainingstag_id)) continue
      if (!m.has(a.person_id)) m.set(a.person_id, new Map())
      m.get(a.person_id).set(a.trainingstag_id, a.status)
    }
    return m
  }, [data.anwesenheit, tagById])

  // Kennzahlen je Person: da / entschuldigt / gefehlt / Quote / erster & letzter Eintrag
  const stats = useMemo(() => {
    const out = new Map()
    for (const [pid, mm] of marks) {
      let x = 0, e = 0, f = 0, first = null, last = null, lastX = null
      for (const [tid, st] of mm) {
        const d = tagById.get(tid).datum
        if (st === 'X') x++; else if (st === 'E') e++; else f++
        if (!first || d < first) first = d
        if (!last || d > last) last = d
        if (st === 'X' && (!lastX || d > lastX)) lastX = d
      }
      const n = x + e + f
      out.set(pid, { x, e, f, n, quote: n ? Math.round(100 * x / n) : null, first, last, lastX })
    }
    return out
  }, [marks, tagById])

  const personen = useMemo(() => data.personen
    .filter(p => marks.has(p.id) || (p.status === 'aktiv' && sel === seasons[0]))
    .sort((a, b) => rolleFirst(a, b) || byVorname(a, b)), [data.personen, marks, sel, seasons])

  const sorted = useMemo(() => {
    const g = p => stats.get(p.id) || { x: 0, e: 0, f: 0, quote: -1, first: '' }
    const cmp = {
      name: byVorname,
      da: (a, b) => g(b).x - g(a).x || byVorname(a, b),
      quote: (a, b) => g(b).quote - g(a).quote || byVorname(a, b),
      fehlt: (a, b) => g(b).f - g(a).f || g(b).e - g(a).e || byVorname(a, b),
      seit: (a, b) => (g(b).first || '').localeCompare(g(a).first || '') || byVorname(a, b),
    }[sort]
    return [...personen].sort((a, b) => rolleFirst(a, b) || cmp(a, b))
  }, [personen, stats, sort])

  if (seasons.length === 0) return <Empty>Noch keine Trainingstage vorhanden.</Empty>

  const sumTag = tid => data.personen.filter(p => p.rolle === 'turnerin' && marks.get(p.id)?.get(tid) === 'X').length
  const stattgefunden = tage.filter(t => !t.ausgefallen).length
  const ausgefallen = tage.length - stattgefunden

  return (
    <>
      <div className="card">
        <div className="row">
          <div className="grow">
            <h1>{sel === ALLE ? 'Alle Jahre' : `Saison ${seasonLabel(sel)}`}</h1>
            <div className="muted small">{stattgefunden} Trainings{ausgefallen ? `, ${ausgefallen} ausgefallen` : ''}</div>
          </div>
          <select value={sel} onChange={e => setSeason(e.target.value === ALLE ? ALLE : Number(e.target.value))} style={{ width: 'auto' }} aria-label="Zeitraum">
            {seasons.map(s => <option key={s} value={s}>{seasonLabel(s)}</option>)}
            <option value={ALLE}>Alle Jahre</option>
          </select>
        </div>
        <div className="chips" style={{ marginTop: 12 }}>
          <button className={`chip ${view === 'matrix' ? 'on' : ''}`} onClick={() => setView('matrix')}>Liste</button>
          <button className={`chip ${view === 'summe' ? 'on' : ''}`} onClick={() => setView('summe')}>Zusammenfassung</button>
        </div>
      </div>

      {view === 'matrix' && (
        <div className="matrix-wrap" style={{ marginTop: 12 }}>
          <table className="matrix">
            <thead>
              <tr>
                <th className="name">Name</th>
                <th>X</th><th>E</th><th>–</th>
                {tage.map(t => <th key={t.id} className={t.ausgefallen ? 'aus' : ''} title={t.ausgefallen ? `Ausgefallen: ${t.grund || ''}` : fmtDate(t.datum)}>{fmtShort(t.datum)}</th>)}
              </tr>
            </thead>
            <tbody>
              {personen.map(p => {
                const s = stats.get(p.id) || { x: 0, e: 0, f: 0 }
                return (
                  <tr key={p.id}>
                    <td className="name">{fullName(p)}{p.rolle === 'trainerin' ? ' ·T' : ''}</td>
                    <td>{s.x}</td><td>{s.e}</td><td>{s.f}</td>
                    {tage.map(t => {
                      const v = marks.get(p.id)?.get(t.id)
                      return <td key={t.id} className={`c ${v === '-' ? 'F' : (v || '')}`}>{v === '-' ? '–' : (v || '')}</td>
                    })}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="name">Mädels da</td><td colSpan={3}></td>
                {tage.map(t => <td key={t.id}>{t.ausgefallen ? '×' : sumTag(t.id)}</td>)}
              </tr>
            </tfoot>
          </table>
          <p className="muted small" style={{ padding: '8px 12px', margin: 0 }}>X da · E entschuldigt · – gefehlt · × ausgefallen · T Trainer/in</p>
        </div>
      )}

      {view === 'summe' && (
        <>
          <div className="chips" style={{ margin: '12px 4px 8px' }}>
            {[['name', 'Name'], ['da', 'Am häufigsten da'], ['quote', 'Quote'], ['fehlt', 'Am häufigsten gefehlt'], ['seit', 'Zuletzt dazugekommen']].map(([k, l]) => (
              <button key={k} className={`chip ${sort === k ? 'on' : ''}`} onClick={() => setSort(k)}>{l}</button>
            ))}
          </div>
          <div className="list">
            {sorted.map(p => {
              const s = stats.get(p.id)
              return (
                <div key={p.id} className="item">
                  <div className="grow">
                    <div className="name">
                      {fullName(p)}
                      {p.rolle === 'trainerin' && <span className="badge blue" style={{ marginLeft: 6 }}>Trainer/in</span>}
                      {p.status !== 'aktiv' && <span className="badge warn" style={{ marginLeft: 6 }}>{p.status}</span>}
                    </div>
                    <div className="meta">
                      {s ? <>dabei seit {fmtDate(s.first)} · zuletzt da {s.lastX ? fmtDate(s.lastX) : '–'}</> : 'noch kein Eintrag'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className="badge ok" title="da">{s?.x ?? 0}</span>
                    <span className="badge warn" title="entschuldigt">{s?.e ?? 0}</span>
                    <span className="badge bad" title="gefehlt">{s?.f ?? 0}</span>
                    <span style={{ width: 44, textAlign: 'right', fontWeight: 700 }}>{s?.quote != null ? `${s.quote}%` : ''}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="muted small" style={{ padding: '8px 4px' }}>
            Grün da, gelb entschuldigt, rot gefehlt. Quote = Anteil „da“ an allen Einträgen des Mädels. „Dabei seit“ ist der erste Eintrag im gewählten Zeitraum.
          </p>
        </>
      )}
    </>
  )
}
