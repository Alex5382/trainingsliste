import { useMemo, useState } from 'react'
import { useStore, upsert, remove, newId } from '../lib/store'
import { byVorname, fullName, fmtDate, P_STUFEN, GERAETE, num, fmtNum } from '../lib/util'
import { Sheet, Field, Empty, confirmDialog } from '../components/ui'

export default function Vereinsmeisterschaft() {
  const { data } = useStore()
  const vms = useMemo(() => [...data.vereinsmeisterschaften].sort((a, b) => b.jahr - a.jahr), [data.vereinsmeisterschaften])
  const [vmId, setVmId] = useState(() => vms[0]?.id)
  const vm = vms.find(v => v.id === vmId) || vms[0]
  const [tab, setTab] = useState('meldung')
  const [edit, setEdit] = useState(null)      // person für Meldung
  const [editErg, setEditErg] = useState(null) // person für Ergebnis
  const [editVm, setEditVm] = useState(false)
  const [add, setAdd] = useState(false)

  const meldungen = useMemo(() => new Map(data.vm_meldungen.filter(m => m.vm_id === vm?.id).map(m => [m.person_id, m])), [data.vm_meldungen, vm])
  const ergebnisse = useMemo(() => new Map(data.vm_ergebnisse.filter(e => e.vm_id === vm?.id).map(e => [e.person_id, e])), [data.vm_ergebnisse, vm])
  const pById = useMemo(() => new Map(data.personen.map(p => [p.id, p])), [data.personen])

  const gemeldet = [...meldungen.keys()].map(id => pById.get(id)).filter(Boolean).sort(byVorname)
  const aktiveOhne = data.personen.filter(p => p.rolle === 'turnerin' && p.status === 'aktiv' && !meldungen.has(p.id)).sort(byVorname)

  const gesamt = e => e ? ['sprung_punkte', 'reck_punkte', 'boden_punkte', 'balken_punkte'].reduce((s, k) => s + (Number(e[k]) || 0), 0) : 0
  const ergList = [...gemeldet].sort((a, b) => {
    const ea = ergebnisse.get(a.id), eb = ergebnisse.get(b.id)
    const pa = ea?.platz ?? 999, pb = eb?.platz ?? 999
    return pa - pb || gesamt(eb) - gesamt(ea) || byVorname(a, b)
  })

  return (
    <>
      <div className="card">
        <div className="row">
          <div className="grow">
            {vm ? <><div className="muted small">{vm.datum ? fmtDate(vm.datum) : 'Datum offen'}</div><h1>Vereinsmeisterschaft {vm.jahr}</h1></> : <h1>Vereinsmeisterschaft</h1>}
            {vm?.bezeichnung && <div className="muted small">{vm.bezeichnung}</div>}
          </div>
          <button className="btn secondary" onClick={() => setAdd(true)}>Neu</button>
        </div>
        {vms.length > 0 && (
          <div className="row" style={{ marginTop: 12 }}>
            <select value={vm?.id || ''} onChange={e => setVmId(e.target.value)} aria-label="Vereinsmeisterschaft wählen">
              {vms.map(v => <option key={v.id} value={v.id}>{v.jahr}{v.datum ? ` – ${fmtDate(v.datum)}` : ''}</option>)}
            </select>
            <button className="btn ghost" onClick={() => setEditVm(true)}>Bearbeiten</button>
          </div>
        )}
        {vm && (
          <div className="chips" style={{ marginTop: 12 }}>
            <button className={`chip ${tab === 'meldung' ? 'on' : ''}`} onClick={() => setTab('meldung')}>P-Übungen / Meldung</button>
            <button className={`chip ${tab === 'ergebnis' ? 'on' : ''}`} onClick={() => setTab('ergebnis')}>Ergebnisse</button>
          </div>
        )}
      </div>

      {!vm && <Empty>Lege die erste Vereinsmeisterschaft an.</Empty>}

      {vm && tab === 'meldung' && (
        <>
          <div className="section-title">Gemeldet ({gemeldet.length})</div>
          <div className="list">
            {gemeldet.map(p => {
              const m = meldungen.get(p.id)
              return (
                <button key={p.id} className="item tappable" onClick={() => setEdit(p)}>
                  <div className="grow">
                    <div className="name">{fullName(p)}</div>
                    <div className="meta">
                      {GERAETE.map(([k, l]) => m[k] ? `${l} ${m[k]}` : null).filter(Boolean).join(' · ') || 'keine P-Übungen eingetragen'}
                      {m.wettkampf ? ` · ${m.wettkampf}` : ''}{m.riege ? ` · Riege ${m.riege}` : ''}{m.show ? ' · Show' : ''}
                    </div>
                  </div>
                  <span className="muted">›</span>
                </button>
              )
            })}
            {gemeldet.length === 0 && <div className="empty">Noch niemand gemeldet. Unten antippen.</div>}
          </div>
          {aktiveOhne.length > 0 && (
            <>
              <div className="section-title">Noch nicht gemeldet</div>
              <div className="list">
                {aktiveOhne.map(p => (
                  <button key={p.id} className="item tappable" onClick={() => setEdit(p)}>
                    <div className="grow"><div className="name">{fullName(p)}</div></div>
                    <span className="badge blue">melden</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {vm && tab === 'ergebnis' && (
        <div className="list">
          {ergList.map(p => {
            const m = meldungen.get(p.id), e = ergebnisse.get(p.id)
            const g = gesamt(e)
            return (
              <button key={p.id} className="item tappable" onClick={() => setEditErg(p)}>
                <div style={{ width: 40, textAlign: 'center', fontWeight: 800, fontSize: 20, color: e?.platz ? 'var(--accent)' : 'var(--line)' }}>
                  {e?.platz ?? '–'}
                </div>
                <div className="grow">
                  <div className="name">{fullName(p)}</div>
                  <div className="meta">
                    {GERAETE.map(([k, l]) => {
                      const pts = e?.[`${k}_punkte`]
                      return <span key={k} style={{ marginRight: 10 }}>{l} {m?.[k] || '?'}{pts != null ? `: ${fmtNum(pts)}` : ''}</span>
                    })}
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>{g ? fmtNum(g) : ''}</div>
              </button>
            )
          })}
          {ergList.length === 0 && <div className="empty">Erst Mädels melden, dann Ergebnisse eintragen.</div>}
        </div>
      )}

      {edit && vm && <MeldungSheet vm={vm} p={edit} m={meldungen.get(edit.id)} onClose={() => setEdit(null)} />}
      {editErg && vm && <ErgebnisSheet vm={vm} p={editErg} m={meldungen.get(editErg.id)} e={ergebnisse.get(editErg.id)} onClose={() => setEditErg(null)} />}
      {(add || (editVm && vm)) && (
        <VmSheet vm={add ? null : vm} onClose={() => { setAdd(false); setEditVm(false) }}
          onSaved={id => { setVmId(id); setAdd(false); setEditVm(false) }} />
      )}
    </>
  )
}

function MeldungSheet({ vm, p, m, onClose }) {
  const [f, setF] = useState({ riege: '', wettkampf: '', sprung: '', reck: '', boden: '', balken: '', show: null, bemerkung: '', ...m })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  function save() {
    upsert('vm_meldungen', { vm_id: vm.id, person_id: p.id, ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === '' ? null : v])) })
    onClose()
  }
  function del() {
    if (!confirmDialog(`Meldung von ${fullName(p)} entfernen?`)) return
    remove('vm_meldungen', { vm_id: vm.id, person_id: p.id })
    onClose()
  }
  return (
    <Sheet title={fullName(p)} onClose={onClose}
      footer={<div className="row"><button className="btn block grow" onClick={save}>Speichern</button>{m && <button className="btn danger" onClick={del}>Entfernen</button>}</div>}>
      <div className="grid4" style={{ marginBottom: 12 }}>
        {GERAETE.map(([k, l]) => (
          <label key={k} className="field" style={{ margin: 0 }}><span>{l}</span>
            <select value={f[k] || ''} onChange={e => set(k, e.target.value)}>
              <option value="">–</option>
              {P_STUFEN.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="grid2">
        <Field label="Wettkampf"><input list="wk" value={f.wettkampf || ''} onChange={e => set('wettkampf', e.target.value)} placeholder="z. B. 4-Kampf" />
          <datalist id="wk"><option value="4-Kampf" /><option value="3-Kampf" /><option value="ja" /><option value="nein" /></datalist></Field>
        <Field label="Riege"><input value={f.riege || ''} onChange={e => set('riege', e.target.value)} /></Field>
      </div>
      <Field label="Show-Auftritt">
        <div className="chips">
          <button className={`chip ${f.show === true ? 'on' : ''}`} onClick={() => set('show', f.show === true ? null : true)}>ja</button>
          <button className={`chip ${f.show === false ? 'on' : ''}`} onClick={() => set('show', f.show === false ? null : false)}>nein</button>
        </div>
      </Field>
      <Field label="Bemerkung"><input value={f.bemerkung || ''} onChange={e => set('bemerkung', e.target.value)} /></Field>
    </Sheet>
  )
}

function ErgebnisSheet({ vm, p, m, e, onClose }) {
  const [f, setF] = useState({
    sprung_punkte: e?.sprung_punkte ?? '', reck_punkte: e?.reck_punkte ?? '', boden_punkte: e?.boden_punkte ?? '',
    balken_punkte: e?.balken_punkte ?? '', platz: e?.platz ?? '', bemerkung: e?.bemerkung ?? '',
  })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const gesamt = ['sprung_punkte', 'reck_punkte', 'boden_punkte', 'balken_punkte'].reduce((s, k) => s + (num(f[k]) || 0), 0)
  function save() {
    upsert('vm_ergebnisse', {
      vm_id: vm.id, person_id: p.id,
      sprung_punkte: num(f.sprung_punkte), reck_punkte: num(f.reck_punkte), boden_punkte: num(f.boden_punkte), balken_punkte: num(f.balken_punkte),
      platz: f.platz === '' ? null : Number(f.platz), bemerkung: f.bemerkung || null,
    })
    onClose()
  }
  function del() {
    if (!e || !confirmDialog(`Ergebnis von ${fullName(p)} löschen?`)) return
    remove('vm_ergebnisse', { vm_id: vm.id, person_id: p.id }); onClose()
  }
  return (
    <Sheet title={`Ergebnis ${fullName(p)}`} onClose={onClose}
      footer={<div className="row"><button className="btn block grow" onClick={save}>Speichern</button>{e && <button className="btn danger" onClick={del}>Löschen</button>}</div>}>
      <div className="grid2">
        {GERAETE.map(([k, l]) => (
          <Field key={k} label={`${l} ${m?.[k] ? `(${m[k]})` : ''}`}>
            <input inputMode="decimal" value={f[`${k}_punkte`]} onChange={ev => set(`${k}_punkte`, ev.target.value)} placeholder="Punkte" />
          </Field>
        ))}
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="grow"><span className="muted small">Gesamt</span><div style={{ fontSize: 24, fontWeight: 800 }}>{fmtNum(gesamt)}</div></div>
        <Field label="Platz"><input inputMode="numeric" value={f.platz} onChange={ev => set('platz', ev.target.value)} style={{ width: 100 }} /></Field>
      </div>
      <Field label="Bemerkung"><input value={f.bemerkung} onChange={ev => set('bemerkung', ev.target.value)} /></Field>
    </Sheet>
  )
}

function VmSheet({ vm, onClose, onSaved }) {
  const [jahr, setJahr] = useState(vm?.jahr ?? new Date().getFullYear())
  const [datum, setDatum] = useState(vm?.datum ?? '')
  const [bez, setBez] = useState(vm?.bezeichnung ?? '')
  function save() {
    const row = upsert('vereinsmeisterschaften', { id: vm?.id ?? newId(), jahr: Number(jahr), datum: datum || null, bezeichnung: bez || null })
    onSaved(row.id)
  }
  function del() {
    if (!confirmDialog(`Vereinsmeisterschaft ${vm.jahr} mit allen Meldungen und Ergebnissen löschen?`)) return
    remove('vereinsmeisterschaften', vm); onClose()
  }
  return (
    <Sheet title={vm ? 'Vereinsmeisterschaft bearbeiten' : 'Neue Vereinsmeisterschaft'} onClose={onClose}
      footer={<div className="row"><button className="btn block grow" onClick={save}>Speichern</button>{vm && <button className="btn danger" onClick={del}>Löschen</button>}</div>}>
      <div className="grid2">
        <Field label="Jahr"><input inputMode="numeric" value={jahr} onChange={e => setJahr(e.target.value)} /></Field>
        <Field label="Datum"><input type="date" value={datum} onChange={e => setDatum(e.target.value)} /></Field>
      </div>
      <Field label="Bezeichnung"><input value={bez} onChange={e => setBez(e.target.value)} placeholder="optional" /></Field>
    </Sheet>
  )
}
