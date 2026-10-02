// Offline-first Datenhaltung.
//
// Idee: Alle Daten liegen als Kopie im Browser (localStorage). Änderungen werden
// sofort lokal übernommen und in eine Warteschlange ("outbox") gelegt. Sobald eine
// Verbindung besteht, wird die Warteschlange an Supabase geschickt und danach der
// aktuelle Stand neu geladen. Ohne Verbindung arbeitet die App einfach weiter.

import { useSyncExternalStore } from 'react'
import { supabase, configured } from './supabase'

export const TABLES = {
  personen: ['id'],
  trainingstage: ['id'],
  anwesenheit: ['trainingstag_id', 'person_id'],
  vereinsmeisterschaften: ['id'],
  vm_meldungen: ['vm_id', 'person_id'],
  vm_ergebnisse: ['vm_id', 'person_id'],
}

const KEY_DATA = 'trainingsliste:data:v1'
const KEY_OUTBOX = 'trainingsliste:outbox:v1'
const KEY_META = 'trainingsliste:meta:v1'

function read(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Speicher voll – ignorieren */ }
}

const emptyData = () => Object.fromEntries(Object.keys(TABLES).map(t => [t, []]))

let state = {
  data: { ...emptyData(), ...read(KEY_DATA, {}) },
  outbox: read(KEY_OUTBOX, []),
  failed: read(KEY_META, {}).failed || [],
  lastSync: read(KEY_META, {}).lastSync || null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  error: null,
}

const listeners = new Set()
function emit() { for (const l of listeners) l() }
function setState(patch) {
  state = { ...state, ...patch }
  if ('data' in patch) write(KEY_DATA, state.data)
  if ('outbox' in patch) write(KEY_OUTBOX, state.outbox)
  if ('failed' in patch || 'lastSync' in patch) write(KEY_META, { failed: state.failed, lastSync: state.lastSync })
  emit()
}

export function useStore() {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb) },
    () => state,
  )
}

export const keyOf = (table, row) => TABLES[table].map(k => row[k]).join('|')

export function newId() {
  return crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
}

// ------------------------------------------------------------ Schreiben

export function upsert(table, row) {
  const k = keyOf(table, row)
  const rows = state.data[table].filter(r => keyOf(table, r) !== k)
  const existing = state.data[table].find(r => keyOf(table, r) === k)
  const merged = { ...existing, ...row, updated_at: new Date().toISOString() }
  rows.push(merged)
  // Ältere Einträge für denselben Datensatz in der Warteschlange ersetzen
  const outbox = state.outbox.filter(e => !(e.table === table && e.key === k))
  outbox.push({ op: 'upsert', table, key: k, row: merged, at: Date.now() })
  setState({ data: { ...state.data, [table]: rows }, outbox })
  flush()
  return merged
}

export function remove(table, row) {
  const k = keyOf(table, row)
  const rows = state.data[table].filter(r => keyOf(table, r) !== k)
  const match = Object.fromEntries(TABLES[table].map(f => [f, row[f]]))
  const outbox = state.outbox.filter(e => !(e.table === table && e.key === k))
  outbox.push({ op: 'delete', table, key: k, match, at: Date.now() })
  // Abhängige Datensätze lokal mit entfernen (Server macht das per "on delete cascade")
  const data = { ...state.data, [table]: rows }
  if (table === 'personen') {
    data.anwesenheit = data.anwesenheit.filter(a => a.person_id !== row.id)
    data.vm_meldungen = data.vm_meldungen.filter(a => a.person_id !== row.id)
    data.vm_ergebnisse = data.vm_ergebnisse.filter(a => a.person_id !== row.id)
  }
  if (table === 'trainingstage') data.anwesenheit = data.anwesenheit.filter(a => a.trainingstag_id !== row.id)
  if (table === 'vereinsmeisterschaften') {
    data.vm_meldungen = data.vm_meldungen.filter(a => a.vm_id !== row.id)
    data.vm_ergebnisse = data.vm_ergebnisse.filter(a => a.vm_id !== row.id)
  }
  setState({ data, outbox })
  flush()
}

// ------------------------------------------------------------ Synchronisieren

let flushing = false

function isNetworkError(err) {
  const m = String(err?.message || err || '').toLowerCase()
  return !navigator.onLine || m.includes('fetch') || m.includes('network') || m.includes('load failed')
}

// Warteschlange abarbeiten. Reihenfolge bleibt erhalten.
export async function flush() {
  if (!configured || flushing || !state.online || state.outbox.length === 0) return
  flushing = true
  setState({ syncing: true, error: null })
  try {
    while (state.outbox.length) {
      const e = state.outbox[0]
      let res
      if (e.op === 'upsert') res = await supabase.from(e.table).upsert(e.row)
      else res = await supabase.from(e.table).delete().match(e.match)
      if (res.error) {
        if (isNetworkError(res.error)) { setState({ online: false }); break }
        // Fachlicher Fehler (z. B. ungültiger Wert): Eintrag beiseitelegen, damit die Warteschlange nicht blockiert
        setState({ outbox: state.outbox.slice(1), failed: [...state.failed, { ...e, fehler: res.error.message }].slice(-50) })
        continue
      }
      setState({ outbox: state.outbox.slice(1) })
    }
  } catch (err) {
    setState({ online: false, error: isNetworkError(err) ? null : String(err.message || err) })
  } finally {
    flushing = false
    setState({ syncing: false })
  }
}

// Alles vom Server laden (nachdem lokale Änderungen hochgeladen wurden).
export async function refresh() {
  if (!configured) return
  if (!state.online) return
  await flush()
  if (state.outbox.length) return // noch nicht alles oben → Server-Stand würde lokale Änderungen überschreiben
  setState({ syncing: true, error: null })
  try {
    const data = emptyData()
    for (const table of Object.keys(TABLES)) {
      const { data: rows, error } = await supabase.from(table).select('*').limit(20000)
      if (error) throw error
      data[table] = rows
    }
    setState({ data, lastSync: new Date().toISOString(), online: true })
  } catch (err) {
    if (isNetworkError(err)) setState({ online: false })
    else setState({ error: String(err.message || err) })
  } finally {
    setState({ syncing: false })
  }
}

export function discardFailed() { setState({ failed: [] }) }
export function retryFailed() {
  const items = state.failed.map(({ fehler, ...e }) => e)
  setState({ failed: [], outbox: [...state.outbox, ...items] })
  flush()
}

export function clearLocal() {
  localStorage.removeItem(KEY_DATA); localStorage.removeItem(KEY_OUTBOX); localStorage.removeItem(KEY_META)
  state = { ...state, data: emptyData(), outbox: [], failed: [], lastSync: null }
  emit()
}

// ------------------------------------------------------------ Verbindung beobachten

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { setState({ online: true }); refresh() })
  window.addEventListener('offline', () => setState({ online: false }))
  // Beim Zurückkehren in die App nachladen
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh() })
  // Falls der Browser "online" meldet, der Request aber scheiterte: regelmäßig erneut versuchen
  setInterval(() => { if (navigator.onLine && (!state.online || state.outbox.length)) { setState({ online: true }); flush() } }, 20000)
}
