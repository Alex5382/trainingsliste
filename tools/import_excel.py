"""
Liest die alte Excel-Trainingsliste und erzeugt supabase/seed.sql
sowie IMPORT-HINWEISE.md (was nicht eindeutig war).

Aufruf:  python3 tools/import_excel.py Trainingsliste_2026.xlsx
"""
import sys, re, uuid, datetime as dt
from collections import OrderedDict
import openpyxl

SRC = sys.argv[1] if len(sys.argv) > 1 else "Trainingsliste_2026.xlsx"
wb = openpyxl.load_workbook(SRC, data_only=True)

notes = []            # Hinweise für IMPORT-HINWEISE.md
persons = OrderedDict()   # key -> dict
STATUS_MAP = {"X": "X", "E": "E", "-": "-"}

def norm(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()

def key(vn, nn):
    vn = re.sub(r"\s*\(.*?\)", "", norm(vn))   # "Lilian (Lily)" -> "Lilian"
    return (vn.lower(), norm(nn).lower())

def to_date(v):
    if isinstance(v, dt.datetime): return v.date()
    if isinstance(v, dt.date): return v
    if isinstance(v, int) and 1990 < v < 2030: return None  # nur Jahr
    if isinstance(v, str):
        m = re.match(r"(\d{1,2})[.:,](\d{1,2})[.:,](\d{4})", v.strip())
        if m:
            d, mo, y = map(int, m.groups())
            try: return dt.date(y, mo, d)
            except ValueError: return None
    return None

def person(vn, nn, geb=None, rolle="turnerin", status=None, tel=None, mail=None, bem=None, letztes=None):
    vn, nn = norm(vn), norm(nn)
    if not vn and not nn: return None
    k = key(vn, nn)
    p = persons.get(k)
    if not p:
        p = dict(id=str(uuid.uuid4()), vorname=vn, nachname=nn, geburtsdatum=None,
                 rolle=rolle, status=status or "ehemalig", telefon=None, email=None,
                 bemerkung=[], letztes_training=None)
        persons[k] = p
    if geb and not p["geburtsdatum"]: p["geburtsdatum"] = geb
    if tel and not p["telefon"]: p["telefon"] = norm(tel).replace("\n", " / ")
    if mail and not p["email"]: p["email"] = norm(mail).replace("\xa0", "").strip()
    if bem: p["bemerkung"].append(norm(bem))
    if letztes and not p["letztes_training"]: p["letztes_training"] = norm(letztes) if not isinstance(letztes, dt.datetime) else letztes.strftime("%d.%m.%Y")
    if rolle == "trainerin": p["rolle"] = "trainerin"
    if status: p["status"] = status
    return p

# ---------------------------------------------------------------- Trainerinnen
TRAINER = {"ute": ("Ute", "Rückwaldt"), "alex": ("Alex", "Rauch-Adam"),
           "leni": ("Leni", "Wünsch"), "nadine": ("Nadine", "")}

def trainer(name):
    vn, nn = TRAINER[norm(name).lower()]
    status = "aktiv" if vn in ("Ute", "Alex") else "ehemalig"
    return person(vn, nn, rolle="trainerin", status=status)

# ---------------------------------------------------------------- Aktive 2026
ws = wb["Anwesenheit 2026"]
aktive_order = []
for r in range(6, 30):
    nn, vn, geb = ws.cell(r, 3).value, ws.cell(r, 4).value, ws.cell(r, 5).value
    if vn:
        p = person(vn, nn, to_date(geb), status="aktiv")
        aktive_order.append(p["id"])
# Zusagen-Block mit Telefonnummern (Zeilen 38+)
for r in range(38, 52):
    vn, nn, geb, tel, bem = (ws.cell(r, c).value for c in (3, 4, 5, 6, 10))
    if not vn: continue
    extra = ws.cell(r, 14).value
    bems = [b for b in (bem, extra) if b]
    k = key(vn, nn)
    if k in persons:
        person(vn, nn, to_date(geb), tel=tel, bem=" / ".join(bems) if bems else None)
    else:  # z.B. Kim Reutter – "kann nicht"
        person(vn, nn, to_date(geb), status="warteliste", tel=tel, bem=" / ".join(bems) if bems else None)
        notes.append(f"{vn} {nn}: stand im Zusagen-Block 2026, aber nicht in der Anwesenheitsliste → als Warteliste übernommen ({' / '.join(bems)}).")

# ---------------------------------------------------------------- Kontaktdaten
ws = wb["Kontaktdaten"]
for r in range(4, 22):
    a, b, c, d, e, f, g = (ws.cell(r, col).value for col in range(1, 8))
    if not (b or c): continue
    # Zeilen 20/21 haben Nachname/Vorname vertauscht
    if r in (20, 21): b, c = c, b
    person(b, c, to_date(d), tel=e, mail=f, bem=g)
for r in (30, 31, 32):
    vn, nn, tel, mail = (ws.cell(r, col).value for col in (2, 3, 5, 6))
    p = trainer(vn); p["telefon"] = p["telefon"] or norm(tel); p["email"] = p["email"] or norm(mail)
for r in range(36, 40):
    nn, vn, geb, tel, mail, g = (ws.cell(r, col).value for col in range(2, 8))
    if vn: person(vn, nn, to_date(geb), tel=tel, mail=mail, bem=f"Kontaktliste-Notiz: {g}" if g else None)

# ---------------------------------------------------------------- Ehemalige
ws = wb["Ehemalige"]
for r in range(3, 61):
    vals = [ws.cell(r, c).value for c in range(1, 11)]
    a, b, c, d, e, f, g, h, i, j = vals
    if not (b or c): continue
    if r >= 49:  # Block unten: Nachname, Vorname vertauscht
        b, c = c, b
    bem = " ".join(norm(x) for x in (e, h, i, j) if x and not isinstance(x, dt.datetime) and not re.match(r"^\d", str(x)))
    letztes = None
    if f and "letztes" in str(f).lower():
        letztes = g or h
    elif f and "weiß" in str(f).lower():
        bem = (bem + " " + norm(f)).strip()
    if isinstance(h, dt.datetime) and not letztes and i and "ausgeschieden" in str(i):
        letztes = h
    tel = e if (e and re.search(r"\d{4}", str(e)) and "Steffi" not in str(e)) else None
    p = person(b, c, to_date(d), tel=tel, mail=f if (f and "@" in str(f)) else None,
               bem=bem or None, letztes=letztes)
    if p["status"] == "aktiv":
        notes.append(f"{p['vorname']} {p['nachname']} steht in 'Ehemalige' UND in der aktiven Liste 2026 → aktiv gelassen.")

# ---------------------------------------------------------------- Warteliste
ws = wb["Warteliste usw"]
def wl(vn, nn, geb, tel=None, mail=None, bem=None):
    if not (vn or nn): return
    k = key(vn, nn)
    if k in persons:
        person(vn, nn, to_date(geb), tel=tel, mail=mail, bem=bem); return
    person(vn, nn, to_date(geb), status="warteliste", tel=tel, mail=mail, bem=bem)

wl(ws["A1"].value, ws["B1"].value, None, tel=ws["C1"].value, bem=f"{ws['E1'].value} (Eintrag {ws['D1'].value:%m/%Y})")
wl(ws["B11"].value, ws["C11"].value, ws["D11"].value, tel=ws["E11"].value)
wl(ws["B12"].value, ws["C12"].value, None, tel=ws["E12"].value, bem=f"Geb. {ws['D12'].value}; {ws['H12'].value}")
for r in range(14, 28):   # Warteliste 2023, Nachname in B, Vorname in C
    nn, vn, geb, tel, g, h = (ws.cell(r, c).value for c in (2, 3, 4, 5, 7, 8))
    if r >= 19: vn, nn = nn, vn   # ab Zeile 19 steht der Vorname vorne
    if not (vn or nn): continue
    bem = " ".join(norm(x) if not isinstance(x, dt.datetime) else x.strftime("%d.%m.%Y") for x in (g, h) if x)
    wl(vn, nn, geb, tel=tel, bem=f"Warteliste 2023: {bem}".strip(": "))
for r in range(28, 39):   # untere Liste: Vorname in B, Nachname in C, Kontakt in E, gemeldet in F
    vn, nn, geb, kontakt, seit = (ws.cell(r, c).value for c in (2, 3, 4, 5, 6))
    if not (vn or nn): continue
    tel = kontakt if kontakt and re.search(r"\d{4}", str(kontakt)) else None
    mail = kontakt if kontakt and "@" in str(kontakt) else None
    bem = None if (tel or mail) else (norm(kontakt) if kontakt else None)
    if isinstance(seit, dt.datetime): bem = (bem + "; " if bem else "") + f"gemeldet {seit.strftime('%m/%Y')}"
    if isinstance(geb, int): bem = (bem + "; " if bem else "") + f"Jahrgang {geb}"
    wl(vn, nn, geb, tel=tel, mail=mail, bem=bem)

# ---------------------------------------------------------------- Anwesenheit
trainingstage = OrderedDict()   # datum -> dict(id, ausgefallen, grund)
anwesenheit = []                # (tag_id, person_id, status)

def tag(datum, ausgefallen=False, grund=None):
    t = trainingstage.get(datum)
    if not t:
        t = dict(id=str(uuid.uuid4()), datum=datum, ausgefallen=False, grund=None)
        trainingstage[datum] = t
    if ausgefallen: t["ausgefallen"] = True
    if grund: t["grund"] = grund
    return t

def parse_dm(s):
    m = re.match(r"\s*(\d{1,2})[.,](\d{1,2})[.,]?", str(s))
    return (int(m.group(1)), int(m.group(2))) if m else None

def season_year(month, start_year, fixed=False):
    if fixed: return start_year
    return start_year if month >= 9 else start_year + 1

def import_sheet(sheetname, date_row, start_year, col_from, col_to, name_rows, trainer_rows, fixes=None, cancel_cells=None, fixed_year=False):
    """fixes: {colletter: (d,m,y)} ; cancel_cells: {colletter: grund}"""
    ws = wb[sheetname]
    fixes = fixes or {}; cancel_cells = cancel_cells or {}
    cols = {}
    for c in range(col_from, col_to + 1):
        letter = openpyxl.utils.get_column_letter(c)
        raw = ws.cell(date_row, c).value
        if letter in fixes:
            d, m, y = fixes[letter]
            cols[c] = dt.date(y, m, d); continue
        dm = parse_dm(raw) if raw else None
        if not dm: continue
        d, m = dm
        y = season_year(m, start_year, fixed_year)
        try: cols[c] = dt.date(y, m, d)
        except ValueError:
            notes.append(f"{sheetname}: Datum '{raw}' ungültig, Spalte übersprungen."); continue
        if cols[c].weekday() != 4 and not fixed_year:
            notes.append(f"{sheetname}: {cols[c].strftime('%d.%m.%Y')} ist kein Freitag (so in der Excel) – bitte prüfen.")
    for c, datum in cols.items():
        letter = openpyxl.utils.get_column_letter(c)
        tag(datum, ausgefallen=letter in cancel_cells, grund=cancel_cells.get(letter))
    def mark(row, pid):
        for c, datum in cols.items():
            v = norm(ws.cell(row, c).value).upper()
            if v in STATUS_MAP:
                anwesenheit.append((trainingstage[datum]["id"], pid, STATUS_MAP[v]))
    for r in name_rows:
        vn, nn, geb = ws.cell(r, 3).value, ws.cell(r, 4).value, ws.cell(r, 5).value
        if not vn or str(vn).strip() in ("?",): continue
        if nn and str(nn).strip() == "?": nn = ""
        if vn == "Lillith" and not nn:
            notes.append("Lillith (Nachname in der Excel '?') wurde ohne Nachnamen als ehemalig übernommen.")
        p = person(vn, nn, to_date(geb))
        mark(r, p["id"])
    for r in trainer_rows:
        name = ws.cell(r, 4).value or ws.cell(r, 3).value
        if name and norm(name).lower() in TRAINER:
            mark(r, trainer(name)["id"])

C = openpyxl.utils.column_index_from_string

# 2021 – Jahr eindeutig
import_sheet("2021", 4, 2021, C("F"), C("Z"), range(6, 33), (37, 38, 39), fixed_year=True)

# Saison 2022/23 – "02.11." zwischen 25.11. und 09.12. ist offensichtlich der 02.12.;
# "21.07." steht zwischen Dezember und Januar, gehört aber zum Saisonende Juli 2023.
import_sheet("Anwesenheit 2022-2023", 4, 2022, C("F"), C("AJ"), list(range(6, 28)) + [59, 60], (51, 52, 53),
             fixes={"O": (2, 12, 2022), "R": (21, 7, 2023)},
             cancel_cells={"AE": "Halle belegt", "AF": "ausgefallen"})
notes.append("Saison 2022/23: Spalte '02.11.' wurde als 02.12.2022 übernommen (Reihenfolge in der Excel), Spalte '21.07.' als 21.07.2023.")

# Saison 2023/24 – Blatt "Anwesenheit 2024". Spalten F–Q sind eine Kopie der Saison 2022/23
# (gleiche Daten, gleiche Kreuze) und werden übersprungen; die echte Saison steht ab Spalte R in Zeile 3.
import_sheet("Anwesenheit 2024", 3, 2023, C("R"), C("BP"), list(range(6, 29)) + [35, 36, 37], (31, 32, 33),
             fixes={"T": (29, 9, 2023), "BP": (13, 9, 2024)},
             cancel_cells={"AD": "ausgefallen"})
notes.append("Saison 2023/24 (Blatt 'Anwesenheit 2024'): Spalten F–Q waren eine Kopie von 2022/23 und wurden nicht doppelt übernommen. '29.10.' (ein Sonntag) wurde als 29.09.2023 übernommen; '01.12.' kommt in der Excel zweimal vor – beide Spalten wurden auf denselben Tag zusammengeführt. '13.09.' am Ende wurde als 13.09.2024 (Saisonstart 2024/25) übernommen.")
notes.append("Blatt 'Anwesenheit 2023-2024 leer' war ein unfertiger Zwischenstand und wurde nicht importiert.")

# 2026 – zwei Termine angelegt, 09.01. war 'H.bel.' (Halle belegt)
import_sheet("Anwesenheit 2026", 3, 2026, C("F"), C("G"), [], [], fixed_year=True, cancel_cells={"F": "Halle belegt"})
notes.append("2021 fand das Training donnerstags statt (Daten so übernommen).")
notes.append("Die Saison 2024/25 (Sept. 2024 – Juli 2025) ist in der Excel nicht enthalten – außer dem 13.09.2024.")

# ---------------------------------------------------------------- Vereinsmeisterschaften / P-Übungen
vms = []   # dict(id, jahr, bezeichnung, datum)
meldungen = []  # dict(vm_id, person_id, riege, wettkampf, sprung, reck, boden, balken, show, bemerkung)

def vm(jahr, bez):
    v = dict(id=str(uuid.uuid4()), jahr=jahr, bezeichnung=bez, datum=None); vms.append(v); return v

def flag(v):
    v = norm(v).upper()
    return True if v == "X" else (False if v == "-" else None)

def pu_sheet(sheetname, v, rows):
    ws = wb[sheetname]
    has_wk = ws["I3"].value == "Wettkampf"
    for r in rows:
        vn, nn, geb = ws.cell(r, 3).value, ws.cell(r, 4).value, ws.cell(r, 5).value
        if not vn: continue
        p = person(vn, nn, to_date(geb))
        boden, sprung, reck = (norm(ws.cell(r, c).value) or None for c in (6, 7, 8))
        if has_wk:
            wk, show, bem = flag(ws.cell(r, 9).value), flag(ws.cell(r, 10).value), ws.cell(r, 12).value
        else:
            wk, show, bem = None, flag(ws.cell(r, 9).value), None
        if not any([boden, sprung, reck, wk, show]): continue
        meldungen.append(dict(vm_id=v["id"], person_id=p["id"], riege=None,
                              wettkampf=("ja" if wk else ("nein" if wk is False else None)),
                              sprung=sprung, reck=reck, boden=boden, balken=None,
                              show=show, bemerkung=norm(bem) or None))

v22 = vm(2022, "Vereinsmeisterschaft 2022 (Jahr aus der Excel nicht eindeutig)")
pu_sheet("P-Übungen", v22, range(6, 22))
notes.append("Blatt 'P-Übungen' (ohne Jahr) wurde als 2022 übernommen – Namen passen zur Saison 2021/22. Bitte Jahr prüfen.")
v23 = vm(2023, "Vereinsmeisterschaft 2023")
pu_sheet("P-Übungen 2023", v23, range(6, 27))
v26 = vm(2026, "Vereinsmeisterschaft 2026")
ws = wb["VM Meldung 2026"]
for r in range(36, 46):
    nn, vn, geb, wk, sprung, reck, boden, balken, bem = (ws.cell(r, c).value for c in range(2, 11))
    if not vn: continue
    p = person(vn, nn, to_date(geb))
    meldungen.append(dict(vm_id=v26["id"], person_id=p["id"], riege=norm(ws.cell(r, 1).value) or "1",
                          wettkampf=norm(wk) or None, sprung=norm(sprung) or None, reck=norm(reck) or None,
                          boden=norm(boden) or None, balken=norm(balken) or None, show=None, bemerkung=norm(bem) or None))

# ---------------------------------------------------------------- SQL schreiben
def q(v):
    if v is None or v == "": return "null"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, (int, float)): return str(v)
    if isinstance(v, dt.date): return f"'{v.isoformat()}'"
    return "'" + str(v).replace("'", "''") + "'"

out = ["-- Automatisch erzeugt aus der alten Excel-Trainingsliste. Vor dem Ausführen: schema.sql einspielen.",
       "begin;"]
# Sortierreihenfolge: aktive wie in der Excel, Rest alphabetisch nach Vorname
for p in persons.values():
    bem = "; ".join(dict.fromkeys(b for b in p["bemerkung"] if b)) or None
    out.append("insert into personen (id, vorname, nachname, geburtsdatum, rolle, status, telefon, email, bemerkung, letztes_training) values ("
               + ", ".join([q(p["id"]), q(p["vorname"]), q(p["nachname"]) if p["nachname"] else "''"] + [q(x) for x in (p["geburtsdatum"], p["rolle"], p["status"],
                                           p["telefon"], p["email"], bem, p["letztes_training"])]) + ");")
for t in trainingstage.values():
    out.append(f"insert into trainingstage (id, datum, ausgefallen, grund) values ({q(t['id'])}, {q(t['datum'])}, {q(t['ausgefallen'])}, {q(t['grund'])});")
seen = set()
for tid, pid, st in anwesenheit:
    if (tid, pid) in seen: continue
    seen.add((tid, pid))
    out.append(f"insert into anwesenheit (trainingstag_id, person_id, status) values ({q(tid)}, {q(pid)}, {q(st)});")
for v in vms:
    out.append(f"insert into vereinsmeisterschaften (id, jahr, bezeichnung, datum) values ({q(v['id'])}, {v['jahr']}, {q(v['bezeichnung'])}, {q(v['datum'])});")
seenm = set()
for m in meldungen:
    if (m["vm_id"], m["person_id"]) in seenm: continue
    seenm.add((m["vm_id"], m["person_id"]))
    out.append("insert into vm_meldungen (vm_id, person_id, riege, wettkampf, sprung, reck, boden, balken, show, bemerkung) values ("
               + ", ".join(q(m[k]) for k in ("vm_id","person_id","riege","wettkampf","sprung","reck","boden","balken","show","bemerkung")) + ");")
out.append("commit;")
open("supabase/seed.sql", "w").write("\n".join(out) + "\n")

stat = {}
for p in persons.values(): stat[(p["rolle"], p["status"])] = stat.get((p["rolle"], p["status"]), 0) + 1
md = ["# Hinweise zum Import aus der Excel", "",
      f"Quelle: `{SRC}` · Personen: {len(persons)} · Trainingstage: {len(trainingstage)} · Anwesenheitseinträge: {len(seen)} · Vereinsmeisterschaften: {len(vms)} · Meldungen: {len(seenm)}", "",
      "## Personen nach Rolle und Status", ""]
for (r, s), n in sorted(stat.items()): md.append(f"- {r} / {s}: {n}")
md += ["", "## Was nicht eindeutig war", ""] + [f"- {n}" for n in dict.fromkeys(notes)]
md += ["", "## Nicht übernommen", "", "- Blatt 'Aufwärmen' (Übungsliste) – kann später als Notiz in die App.",
       "- Die Spalte 'w' (Geschlecht) – die Gruppe besteht nur aus Mädchen.", ""]
open("IMPORT-HINWEISE.md", "w").write("\n".join(md))
print("\n".join(md))
