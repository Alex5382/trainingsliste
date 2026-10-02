-- Trainingsliste – Datenbankschema für Supabase
-- Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen. Danach seed.sql.

create extension if not exists pgcrypto;

-- Personen: Turnerinnen und Trainerinnen in einer Tabelle
create table if not exists personen (
  id              uuid primary key default gen_random_uuid(),
  vorname         text not null,
  nachname        text not null default '',
  geburtsdatum    date,
  rolle           text not null default 'turnerin' check (rolle in ('turnerin', 'trainerin')),
  status          text not null default 'aktiv'    check (status in ('aktiv', 'ehemalig', 'warteliste')),
  telefon         text,
  email           text,
  bemerkung       text,
  letztes_training text,
  notfallkontakt  text,           -- Name + Nummer, z. B. "Mama Sabine 0171 …"
  adresse         text,
  updated_at      timestamptz not null default now()
);
-- Nachrüsten, falls die Tabelle schon ohne diese Spalten existiert:
alter table personen add column if not exists notfallkontakt text;
alter table personen add column if not exists adresse text;

-- Ein Trainingstag (Datum eindeutig)
create table if not exists trainingstage (
  id          uuid primary key default gen_random_uuid(),
  datum       date not null unique,
  ausgefallen boolean not null default false,
  grund       text,
  notiz       text,
  updated_at  timestamptz not null default now()
);

-- Anwesenheit: X = da, E = entschuldigt, - = unentschuldigt gefehlt
create table if not exists anwesenheit (
  trainingstag_id uuid not null references trainingstage(id) on delete cascade,
  person_id       uuid not null references personen(id) on delete cascade,
  status          text not null check (status in ('X', 'E', '-')),
  updated_at      timestamptz not null default now(),
  primary key (trainingstag_id, person_id)
);

-- Vereinsmeisterschaft (eine pro Jahr)
create table if not exists vereinsmeisterschaften (
  id          uuid primary key default gen_random_uuid(),
  jahr        integer not null,
  datum       date,
  bezeichnung text,
  updated_at  timestamptz not null default now()
);

-- Meldung: welche P-Übung je Gerät
create table if not exists vm_meldungen (
  vm_id      uuid not null references vereinsmeisterschaften(id) on delete cascade,
  person_id  uuid not null references personen(id) on delete cascade,
  riege      text,
  wettkampf  text,          -- z. B. "4-Kampf", "ja", "nein"
  sprung     text,          -- z. B. "P5"
  reck       text,
  boden      text,
  balken     text,
  show       boolean,
  bemerkung  text,
  updated_at timestamptz not null default now(),
  primary key (vm_id, person_id)
);

-- Ergebnis: Punkte je Gerät, Gesamt und Platz
create table if not exists vm_ergebnisse (
  vm_id         uuid not null references vereinsmeisterschaften(id) on delete cascade,
  person_id     uuid not null references personen(id) on delete cascade,
  sprung_punkte numeric(6,3),
  reck_punkte   numeric(6,3),
  boden_punkte  numeric(6,3),
  balken_punkte numeric(6,3),
  platz         integer,
  bemerkung     text,
  updated_at    timestamptz not null default now(),
  primary key (vm_id, person_id)
);

-- updated_at automatisch setzen
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ declare t text;
begin
  foreach t in array array['personen','trainingstage','anwesenheit','vereinsmeisterschaften','vm_meldungen','vm_ergebnisse'] loop
    execute format('drop trigger if exists trg_updated_at on %I', t);
    execute format('create trigger trg_updated_at before update on %I for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- Zugriff: nur angemeldete Trainerinnen, die dürfen alles.
-- Benutzer werden im Supabase-Dashboard unter Authentication → Users angelegt.
do $$ declare t text;
begin
  foreach t in array array['personen','trainingstage','anwesenheit','vereinsmeisterschaften','vm_meldungen','vm_ergebnisse'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists trainerinnen on %I', t);
    execute format('create policy trainerinnen on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
