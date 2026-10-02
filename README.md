# Trainingsliste – Kinder- & Jugendturnen 2

Ersetzt die Excel-Trainingsliste. Läuft als Web-App auf dem Handy (zum Startbildschirm hinzufügen), auch ohne Netz. Änderungen werden gesammelt und hochgeladen, sobald wieder Verbindung besteht. Alle Trainer/innen arbeiten auf demselben Datenstand.

Technik wie beim Familienkalender: React (Vite), Supabase (Datenbank + Anmeldung), GitHub Pages (Hosting).

## Was die App kann

- **Training** – Trainingstag anlegen (vorbelegt: nächster Freitag), pro Mädel antippen: X da, E entschuldigt, – gefehlt. Summe unten eingeblendet. Trainerinnen werden mitgeführt. Training als „ausgefallen“ mit Grund markieren. Geburtstagstorte, wenn ein Mädel in den Tagen ums Training Geburtstag hat.
- **Übersicht** – die gewohnte Jahresmatrix pro Saison (September–August) oder über alle Jahre, mit Summen je Mädel und je Tag. Dazu die **Zusammenfassung**: pro Mädel wie oft da / entschuldigt / gefehlt, Anwesenheitsquote, seit wann dabei, zuletzt da – sortierbar.
- **Vereinsmeisterschaft** – pro Jahr: Meldung mit P-Übung je Gerät (Sprung, Reck, Boden, Balken), Wettkampf, Riege, Show. Ergebnisse mit Punkten je Gerät, Gesamt und Platz; sortiert nach Platz.
- **Mädels** – Kontaktliste mit Status aktiv / Warteliste / ehemalig sowie Trainerteam; Telefon, Notfallkontakt und Adresse (optional); direkt anrufbar; Suche.
- **Mehr** – Sync-Status, Abmelden.

## Ordnerinhalt

| Pfad | Inhalt |
|---|---|
| `src/` | die App |
| `supabase/schema.sql` | Tabellen und Rechte – einmal in Supabase ausführen |
| `supabase/seed.sql` | alle Daten aus der alten Excel – danach ausführen |
| `IMPORT-HINWEISE.md` | was bei der Übernahme nicht eindeutig war – bitte einmal durchlesen |
| `tools/import_excel.py` | das Skript, das seed.sql aus der Excel erzeugt (falls nochmal nötig) |
| `.github/workflows/deploy.yml` | veröffentlicht automatisch auf GitHub Pages |

## Einrichtung (einmalig, ca. 20 Minuten)

### 1. Supabase-Projekt anlegen
1. Auf supabase.com ein **neues Projekt** anlegen (eigenes Projekt, nicht das vom Kalender – hier stehen Daten fremder Kinder). Region Frankfurt, Passwort merken.
2. **SQL Editor** → Inhalt von `supabase/schema.sql` einfügen → Run.
3. **SQL Editor** → Inhalt von `supabase/seed.sql` einfügen → Run. (Dauert ein paar Sekunden.)
4. **Authentication → Providers → Email**: „Confirm email“ ausschalten (sonst muss jede Trainerin erst einen Link klicken). „Allow new users to sign up“ ausschalten – Zugänge legst nur du an.
5. **Authentication → Users → Add user**: für jede Trainerin E-Mail + Passwort anlegen („Auto Confirm User“ anhaken).
6. **Project Settings → API**: `Project URL` und `anon public`-Key kopieren – die braucht Schritt 2.

### 2. GitHub-Repository
1. Neues Repository anlegen (z. B. `trainingsliste`), diesen Ordner hochladen bzw. pushen.
2. **Settings → Secrets and variables → Actions → New repository secret**:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon-Key
3. **Settings → Pages → Source: GitHub Actions**.
4. Beim nächsten Push auf `main` baut der Workflow die App; die Adresse lautet `https://<dein-name>.github.io/trainingsliste/`.

Der anon-Key darf in der App stehen – ohne Anmeldung lässt die Datenbank keinen Zugriff zu (Row Level Security in `schema.sql`).

### 3. Auf dem Handy
Adresse im Browser öffnen, anmelden, dann **Zum Home-Bildschirm** (iPhone: Teilen-Symbol; Android: Browser-Menü). Ab dann startet sie wie eine App und funktioniert auch ohne Empfang in der Halle.

## Lokal entwickeln

```bash
npm install
cp .env.example .env     # URL und Key eintragen
npm run dev
```

Ohne `.env` startet die App im reinen Lokalmodus (keine Anmeldung, Daten nur im Browser) – praktisch zum Ausprobieren der Oberfläche.

## Wie das Offline-Prinzip funktioniert

Alle Daten liegen als Kopie im Browser. Jede Änderung wird sofort lokal übernommen und in eine Warteschlange gelegt. Besteht Verbindung, wird die Warteschlange an Supabase gesendet und danach der aktuelle Stand geladen. Ohne Verbindung sammelt die App weiter; der Zähler oben rechts zeigt, wie viele Änderungen noch warten. Bei zwei Trainerinnen gleichzeitig gewinnt die spätere Änderung. Legen zwei Trainerinnen offline denselben Trainingstag an, lehnt der Server den zweiten ab – das taucht unter **Mehr** auf und lässt sich dort verwerfen.

## Was noch nicht drin ist

- Aufwärm-Übungsliste aus der Excel
- Export (z. B. Jahresliste als PDF/Excel) – lässt sich aus der Übersicht nachrüsten
- Mehrere Gruppen – die Datenbank ist dafür vorbereitet (einfach eine `gruppe`-Spalte ergänzen), die App zeigt derzeit eine Gruppe
