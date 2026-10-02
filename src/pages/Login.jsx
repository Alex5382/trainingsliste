import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw })
    if (error) setErr(error.message.includes('Invalid') ? 'E-Mail oder Passwort stimmt nicht.' : error.message)
    setBusy(false)
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img src="icons/wappen.png" alt="TSV Öschelbronn" width="88" style={{ height: 'auto' }} />
          <h1 style={{ marginTop: 8 }}>Trainingsliste</h1>
          <p className="muted small">TSV Öschelbronn · Abt. Turnen<br />Kinder- & Jugendturnen 2</p>
        </div>
        <label className="field"><span>E-Mail</span><input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label className="field"><span>Passwort</span><input type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} required /></label>
        {err && <p className="small" style={{ color: 'var(--bad)' }}>{err}</p>}
        <button className="btn block" disabled={busy}>{busy ? 'Anmelden…' : 'Anmelden'}</button>
        <p className="muted small" style={{ marginTop: 12 }}>Zugänge legt Alex an. Ohne Netz kannst du angemeldet bleiben und weiterarbeiten.</p>
      </form>
    </div>
  )
}
