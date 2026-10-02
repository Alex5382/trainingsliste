import { useStore, refresh, retryFailed, discardFailed, clearLocal } from '../lib/store'
import { supabase, configured } from '../lib/supabase'
import { confirmDialog } from '../components/ui'

export default function Mehr({ user }) {
  const { online, syncing, outbox, failed, lastSync, error, data } = useStore()

  async function logout() {
    if (outbox.length && !confirmDialog(`${outbox.length} Änderungen sind noch nicht hochgeladen. Trotzdem abmelden?`)) return
    await supabase?.auth.signOut()
    clearLocal()
  }

  return (
    <>
      <div className="card">
        <h1>Mehr</h1>
        <p className="muted small" style={{ margin: '4px 0 0' }}>Angemeldet als {user?.email || 'unbekannt'}</p>
      </div>

      <div className="card">
        <h2>Synchronisation</h2>
        <div className="row" style={{ marginTop: 8 }}>
          <span className="status-dot" style={{ background: online ? 'var(--ok)' : 'var(--warn)' }} />
          <span>{online ? 'Verbunden' : 'Offline – Änderungen werden gesammelt'}</span>
        </div>
        <p className="muted small">
          {outbox.length === 0 ? 'Alles hochgeladen.' : `${outbox.length} Änderung(en) warten auf Upload.`}
          {lastSync ? ` Zuletzt geladen: ${new Date(lastSync).toLocaleString('de-DE')}.` : ''}
        </p>
        {!configured && <p className="small" style={{ color: 'var(--bad)' }}>Keine Supabase-Zugangsdaten hinterlegt – die App läuft nur lokal auf diesem Gerät.</p>}
        {error && <p className="small" style={{ color: 'var(--bad)' }}>Fehler: {error}</p>}
        <button className="btn secondary block" onClick={refresh} disabled={syncing || !online}>{syncing ? 'Lädt…' : 'Jetzt synchronisieren'}</button>
        {failed.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <p className="small" style={{ color: 'var(--bad)' }}>{failed.length} Änderung(en) wurden vom Server abgelehnt:</p>
            <ul className="small muted">
              {failed.slice(0, 5).map((f, i) => <li key={i}>{f.table}: {f.fehler}</li>)}
            </ul>
            <div className="row">
              <button className="btn secondary grow" onClick={retryFailed}>Erneut versuchen</button>
              <button className="btn danger" onClick={discardFailed}>Verwerfen</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Bestand</h2>
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          {data.personen.length} Personen · {data.trainingstage.length} Trainingstage · {data.anwesenheit.length} Anwesenheitseinträge · {data.vereinsmeisterschaften.length} Vereinsmeisterschaften
        </p>
      </div>

      <div className="card">
        <h2>Hilfe</h2>
        <p className="small muted" style={{ margin: '6px 0 0' }}>
          X = da, E = entschuldigt, – = unentschuldigt gefehlt. Nochmal antippen löscht den Eintrag.
          Die App funktioniert auch ohne Netz; sobald wieder Verbindung besteht, wird automatisch hochgeladen.
          Zum Startbildschirm hinzufügen: im Browser-Menü „Zum Home-Bildschirm“.
        </p>
      </div>

      <button className="btn ghost block" onClick={logout}>Abmelden</button>
    </>
  )
}
