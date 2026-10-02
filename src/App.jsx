import { useEffect, useState } from 'react'
import { supabase, configured } from './lib/supabase'
import { useStore, refresh } from './lib/store'
import Login from './pages/Login'
import Anwesenheit from './pages/Anwesenheit'
import Uebersicht from './pages/Uebersicht'
import Vereinsmeisterschaft from './pages/Vereinsmeisterschaft'
import Personen from './pages/Personen'
import Mehr from './pages/Mehr'

const TABS = [
  ['training', 'Training', 'M4 21h16M6 21V9m12 12V9M4 9h16l-2-4H6z'],
  ['uebersicht', 'Übersicht', 'M3 4h18v16H3zM3 10h18M9 4v16'],
  ['vm', 'Vereinsm.', 'M8 21h8m-4-4v4M6 3h12v4a6 6 0 0 1-12 0zM6 5H3v2a3 3 0 0 0 3 3m12-5h3v2a3 3 0 0 1-3 3'],
  ['personen', 'Mädels', 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m8-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 9v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8'],
  ['mehr', 'Mehr', 'M5 12h.01M12 12h.01M19 12h.01'],
]

export default function App() {
  const [session, setSession] = useState(undefined)
  const [tab, setTab] = useState('training')
  const { online, syncing, outbox } = useStore()

  useEffect(() => {
    if (!configured) { setSession({ user: { email: 'lokal' } }); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (session) refresh() }, [session])

  if (session === undefined) return null
  if (!session) return <Login />

  const Page = { training: Anwesenheit, uebersicht: Uebersicht, vm: Vereinsmeisterschaft, personen: Personen, mehr: Mehr }[tab]

  return (
    <div className="app">
      <div className="topbar row">
        <div className="grow">
          <h1 style={{ fontSize: 17 }}>Trainingsliste</h1>
          <div className="sub">Kinder- & Jugendturnen 2 · freitags 16:30–18:30</div>
        </div>
        <div className="small" title={online ? 'Verbunden' : 'Offline'} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="status-dot" style={{ background: !online ? '#F5B82E' : syncing ? '#9DBBE6' : '#6FD39A' }} />
          {outbox.length > 0 && <span>{outbox.length}</span>}
        </div>
      </div>
      <main className="content"><Page user={session.user} /></main>
      <nav className="tabbar" aria-label="Bereiche">
        {TABS.map(([k, label, d]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
