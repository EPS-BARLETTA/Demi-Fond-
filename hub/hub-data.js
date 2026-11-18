/* Demi-fond EPS — données partagées de l'accueil.
   Une classe est créée une seule fois ici, puis recopiée automatiquement dans
   Scan CCF, PhotoFinish et ScanDocument (même appareil, même adresse). */
(function (global) {
  "use strict";

  var KEY = "eps-hub-v1";
  var SCAN_KEY = "df-scan-ccf-v2";
  var PF_CLASSES = "cc_classes";
  var PF_SETUP = "cc_setup";
  var SD_DB = "scan-document-eps-v1";

  var TYPES = {
    training: { label: "Entraînement", short: "Entraînement", chronoMode: "training" },
    ccf: { label: "CCF 2 × 800 m", short: "2 × 800", chronoMode: "ccf", sheet: "t2x800" },
    exam500: { label: "Examen 3 × 500 m", short: "3 × 500", chronoMode: "exam500", sheet: "t3x500" }
  };
  var METHODS = {
    chrono: { label: "Les élèves chronomètrent (Chrono Carnet)", short: "Chrono Carnet" },
    paper: { label: "Fiches papier (ScanDocument)", short: "Fiches papier" },
    video: { label: "Je filme l’arrivée (PhotoFinish)", short: "Vidéo" }
  };

  function uid(p) {
    return (p || "") + (global.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  }
  function readJSON(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  function load() {
    var h = readJSON(KEY, null) || {};
    h.classes = Array.isArray(h.classes) ? h.classes : [];
    h.sessions = Array.isArray(h.sessions) ? h.sessions : [];
    return h;
  }
  function save(h) { return writeJSON(KEY, h); }
  function current(h) {
    h = h || load();
    return h.sessions.find(function (s) { return s.id === h.currentId && !s.closed; }) || null;
  }
  function classById(h, id) { return h.classes.find(function (c) { return c.id === id; }) || null; }

  /* ---------- noms ---------- */
  function norm(v) {
    return String(v == null ? "" : v).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ")
      .replace(/[^a-zA-Z0-9 -]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  }
  function fullName(s) { return (String(s.last || "").toUpperCase() + " " + (s.first || "")).trim(); }
  function sexOf(v) {
    v = norm(v);
    if (/^(f|fille|feminin|femme)/.test(v)) return "F";
    if (/^(m|g|garcon|masculin|h|homme)/.test(v)) return "M";
    return "";
  }
  // « DUPONT Marie-Anne » → nom en majuscules puis prénom
  function splitName(full) {
    var parts = String(full || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return { last: parts[0] || "", first: "" };
    var i = 0;
    while (i < parts.length - 1 && /\p{Lu}/u.test(parts[i]) && parts[i] === parts[i].toLocaleUpperCase("fr")) i++;
    if (i === 0) i = 1;
    return { last: parts.slice(0, i).join(" "), first: parts.slice(i).join(" ") };
  }

  /* ---------- CSV PRONOTE ou liste collée ---------- */
  function parseCSV(text) {
    text = String(text).replace(/^﻿/, "");
    var first = text.split(/\r?\n/, 1)[0];
    var sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",";
    if ((first.match(/\t/g) || []).length > (first.match(new RegExp(sep === ";" ? ";" : ",", "g")) || []).length) sep = "\t";
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (c === '"') { if (q && text[i + 1] === '"') { cell += '"'; i++; } else q = !q; }
      else if (c === sep && !q) { row.push(cell); cell = ""; }
      else if ((c === "\n" || c === "\r") && !q) {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); if (row.some(function (x) { return x.trim(); })) rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    row.push(cell); if (row.some(function (x) { return x.trim(); })) rows.push(row);
    return rows;
  }
  /* Renvoie [{ last, first, sex, cls }] */
  function readRoster(text) {
    var rows = parseCSV(text);
    if (!rows.length) throw new Error("Liste vide.");
    var h = rows[0].map(norm);
    var col = function () { var names = [].slice.call(arguments); return h.findIndex(function (x) { return names.indexOf(x) >= 0; }); };
    var combined = col("eleves", "eleve", "nom prenom", "nom et prenom", "nom prenoms");
    var last = col("nom", "nom de famille"), firstC = col("prenom", "prenoms");
    var sex = col("sexe", "genre", "sex", "f/g");
    var cls = col("classe", "classes", "division", "classe de rattachement");
    var hasHeader = combined >= 0 || (last >= 0 && firstC >= 0);
    var data = hasHeader ? rows.slice(1) : rows;
    if (!hasHeader) {
      // liste collée : une ligne = « NOM Prénom » (éventuellement suivi de F/G)
      combined = 0;
      if (rows[0].length > 1 && rows.every(function (r) { return !r[1] || sexOf(r[1]) || r[1].trim().length > 1; })) {
        var allSex = rows.filter(function (r) { return r[1]; }).every(function (r) { return sexOf(r[1]); });
        if (allSex) sex = 1;
        else { combined = -1; last = 0; firstC = 1; }
      }
    }
    var out = [], seen = {};
    data.forEach(function (r) {
      var l = "", f = "";
      if (combined >= 0) {
        var raw = (r[combined] || "").trim();
        var m = raw.match(/^(.*?)\s+([FMG])$/i);
        if (m && sex < 0) { raw = m[1]; }
        var sp = splitName(raw); l = sp.last; f = sp.first;
        if (m && sex < 0) r.__sex = m[2];
      } else { l = (r[last] || "").trim(); f = (r[firstC] || "").trim(); }
      if (!l || !f) return;
      var k = norm(l + " " + f);
      if (seen[k]) return; seen[k] = 1;
      out.push({ last: l.toUpperCase(), first: f, sex: sexOf(sex >= 0 ? r[sex] : r.__sex), cls: cls >= 0 ? (r[cls] || "").trim() : "" });
    });
    if (!out.length) throw new Error("Aucun élève reconnu. Il faut une colonne « Élèves » (ou « Nom » et « Prénom »), ou une ligne par élève : NOM Prénom.");
    return out;
  }

  /* Ajoute / met à jour une classe à partir d'une liste. Garde les identifiants des élèves déjà présents. */
  function upsertClass(h, name, list, id, newId) {
    var c = id ? classById(h, id) : h.classes.find(function (x) { return norm(x.name) === norm(name); });
    if (!c) { c = { id: newId || uid("cl-"), name: name.trim(), students: [], createdAt: Date.now() }; h.classes.push(c); }
    c.name = name.trim() || c.name;
    var old = c.students || [];
    c.students = list.map(function (s) {
      var prev = (s.id && old.find(function (o) { return o.id === s.id; })) || old.find(function (o) { return norm(o.last + " " + o.first) === norm(s.last + " " + s.first); });
      return { id: prev ? prev.id : uid("el-"), last: s.last, first: s.first, sex: s.sex || (prev && prev.sex) || "", cls: s.cls || (prev && prev.cls) || "" };
    }).sort(function (a, b) { return (a.last + a.first).localeCompare(b.last + b.first, "fr"); });
    c.updatedAt = Date.now();
    return c;
  }

  /* ---------- recopie dans les outils ---------- */
  function syncScan(c) {
    var db = readJSON(SCAN_KEY, null) || { groups: [], activeGroupId: null, activeSessionId: null, history: [], trainingScans: [], settings: {} };
    db.groups = db.groups || [];
    var g = db.groups.find(function (x) { return x.id === c.id; });
    if (!g) { g = { id: c.id, name: c.name, classroom: c.name.toUpperCase(), sessions: [], students: [], archived: false, uiColor: db.groups.length % 8 }; db.groups.push(g); }
    g.name = c.name;
    g.rosterPronote = c.students.map(function (s) { return { last: s.last, first: s.first, sex: s.sex, classroom: s.cls || c.name }; });
    writeJSON(SCAN_KEY, db);
    return db;
  }
  function syncVideo(c, photos) {
    var classes = readJSON(PF_CLASSES, null) || [];
    var k = classes.find(function (x) { return x.id === c.id; }) || classes.find(function (x) { return norm(x.name) === norm(c.name); });
    if (!k) { k = { id: c.id, name: c.name, items: [] }; classes.push(k); }
    var prev = k.items || [];
    k.name = c.name;
    k.items = c.students.map(function (s) {
      var line = fullName(s);
      var p = prev.find(function (it) { return norm(String(it.line).replace(/^\d{1,4}[\s.,;:\-–]+/, "")) === norm(line); });
      var item = { line: p ? p.line : line, g: p ? p.g || 0 : 0 };
      var ph = photos && photos[s.id];
      if (validPhoto(ph)) item.portrait = ph; else if (p && p.portrait) item.portrait = p.portrait;
      return item;
    });
    writeJSON(PF_CLASSES, classes);
    return k.id;
  }
  function sdOpen() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(SD_DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("state"); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function sdYear() { var d = new Date(), y = d.getFullYear(); return d.getMonth() >= 7 ? y + "-" + (y + 1) : (y - 1) + "-" + y; }
  function syncDocs(c, photos) {
    return sdOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction("state", "readwrite"), st = t.objectStore("state"), g = st.get("data");
        g.onsuccess = function () {
          var s = g.result || { classes: [], students: [], scans: [], queue: [], templates: [] };
          s.classes = s.classes || []; s.students = s.students || [];
          var k = s.classes.find(function (x) { return x.id === c.id; }) || s.classes.find(function (x) { return norm(x.name) === norm(c.name); });
          if (!k) { k = { id: c.id, name: c.name, folder: sdYear() }; s.classes.push(k); }
          k.name = c.name;
          c.docsId = k.id;
          c.students.forEach(function (e) {
            var name = fullName(e), sx = e.sex === "M" ? "G" : e.sex === "F" ? "F" : undefined;
            var ex = s.students.find(function (x) { return x.id === e.id || (x.classId === k.id && norm(x.name) === norm(name)); });
            var ph = photos && photos[e.id];
            if (ex) { ex.name = name; if (sx) ex.sex = sx; if (validPhoto(ph)) ex.portrait = ph; }
            else { var o = { id: e.id, classId: k.id, name: name }; if (sx) o.sex = sx; if (e.cls && norm(e.cls) !== norm(c.name)) o.cls = e.cls; if (validPhoto(ph)) o.portrait = ph; s.students.push(o); }
          });
          st.put(s, "data");
        };
        t.oncomplete = function () { db.close(); res(); };
        t.onerror = function () { db.close(); rej(t.error); };
      });
    });
  }
  function syncClass(c) {
    return photosGet(c.students.map(function (s) { return s.id; })).then(function (photos) {
      syncScan(c); syncVideo(c, photos);
      return syncDocs(c, photos).catch(function (e) { console.warn("ScanDocument : classe non recopiée", e); });
    });
  }
  function syncAll(h) { return Promise.all((h || load()).classes.map(syncClass)); }

  /* Classes déjà présentes dans les outils (créées avant le regroupement) */
  function foundInTools(h) {
    h = h || load();
    var known = {}; h.classes.forEach(function (c) { known[c.id] = 1; known["n:" + norm(c.name)] = 1; });
    var out = [];
    var add = function (src, name, list, id) {
      if (!name || known["n:" + norm(name)] || !list.length) return;
      known["n:" + norm(name)] = 1; out.push({ source: src, name: name, students: list, id: id });
    };
    var db = readJSON(SCAN_KEY, null);
    (db && db.groups || []).forEach(function (g) {
      if (known[g.id]) return;
      var list = (g.rosterPronote && g.rosterPronote.length ? g.rosterPronote : g.students || []).map(function (s) { return { last: String(s.last || "").toUpperCase(), first: s.first || "", sex: s.sex === "F" ? "F" : s.sex === "M" ? "M" : "", cls: s.classroom || "" }; }).filter(function (s) { return s.last && s.first; });
      add("Scan CCF", g.name, list, g.id);
    });
    (readJSON(PF_CLASSES, null) || []).forEach(function (k) {
      if (known[k.id]) return;
      add("PhotoFinish", k.name, (k.items || []).map(function (it) { var sp = splitName(String(it.line).replace(/^\d{1,4}[\s.,;:\-–]+/, "")); return { last: sp.last.toUpperCase(), first: sp.first, sex: "", cls: "" }; }).filter(function (s) { return s.last && s.first; }), k.id);
    });
    return out;
  }
  function foundInDocs(h) {
    h = h || load();
    return sdOpen().then(function (db) {
      return new Promise(function (res) {
        var g = db.transaction("state").objectStore("state").get("data");
        g.onsuccess = function () {
          var s = g.result; db.close();
          if (!s) return res([]);
          var known = {}; h.classes.forEach(function (c) { known[c.id] = 1; known["n:" + norm(c.name)] = 1; });
          res((s.classes || []).filter(function (c) { return !known[c.id] && !known["n:" + norm(c.name)]; }).map(function (c) {
            return { source: "ScanDocument", id: c.id, name: c.name, students: (s.students || []).filter(function (e) { return e.classId === c.id; }).map(function (e) { var sp = splitName(e.name); return { last: sp.last.toUpperCase(), first: sp.first, sex: e.sex === "G" ? "M" : e.sex || "", cls: e.cls || "" }; }) };
          }).filter(function (c) { return c.students.length; }));
        };
        g.onerror = function () { db.close(); res([]); };
      });
    }).catch(function () { return []; });
  }

  /* ---------- portraits (trombinoscope) : gardés dans IndexedDB, pas dans localStorage ---------- */
  var PHOTO_DB = "eps-hub-photos";
  function photoDB() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(PHOTO_DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("p"); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }
  function photosGet(ids) {
    return photoDB().then(function (db) {
      return new Promise(function (res) {
        var out = {}, t = db.transaction("p"), st = t.objectStore("p");
        ids.forEach(function (id) { var g = st.get(id); g.onsuccess = function () { if (g.result) out[id] = g.result; }; });
        t.oncomplete = function () { db.close(); res(out); };
        t.onerror = function () { db.close(); res(out); };
      });
    }).catch(function () { return {}; });
  }
  function photosPut(map) {
    return photoDB().then(function (db) {
      return new Promise(function (res) {
        var t = db.transaction("p", "readwrite"), st = t.objectStore("p");
        Object.keys(map).forEach(function (id) { if (map[id]) st.put(map[id], id); else st.delete(id); });
        t.oncomplete = function () { db.close(); res(); };
        t.onerror = function () { db.close(); res(); };
      });
    }).catch(function () {});
  }
  function validPhoto(v) { return typeof v === "string" && v.length <= 30000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(v); }

  /* Même identifiant que Chrono Carnet (QR élève), pour que tout se rejoigne dans Scan CCF */
  function stdId(last, first, cls) {
    var s = String(last).trim().toUpperCase() + "|" + String(first).trim().toUpperCase() + "|" + String(cls).trim().toUpperCase();
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return "STD-" + (h >>> 0).toString(16).padStart(8, "0");
  }

  /* ---------- séance libre : « 4×100 », « 500-1000-500 », « 1000 » ---------- */
  function parsePlan(text) {
    var t = String(text || "").toLowerCase().replace(/[×*]/g, "x").replace(/\s*x\s*/g, "x").replace(/[–—→>+,;\/]/g, " ").replace(/-/g, " ").replace(/\bm\b/g, " ").replace(/(\d)\s*m\b/g, "$1");
    var out = [], ok = true;
    t.split(/\s+/).filter(Boolean).forEach(function (tok) {
      var m = tok.match(/^(\d{1,2})x(\d{2,5})$/), d = tok.match(/^(\d{2,5})$/);
      if (m) { for (var i = 0; i < +m[1]; i++) out.push(+m[2]); }
      else if (d) out.push(+d[1]);
      else ok = false;
    });
    if (!ok || !out.length || out.length > 30 || out.some(function (x) { return x < 20 || x > 10000; })) return null;
    return out;
  }
  function planLabel(list) {
    if (!list || !list.length) return "";
    var parts = [], i = 0;
    while (i < list.length) { var j = i; while (j + 1 < list.length && list[j + 1] === list[i]) j++; var n = j - i + 1; parts.push(n > 1 ? n + " × " + list[i] : String(list[i])); i = j + 1; }
    return parts.join(" – ") + " m";
  }
  function typeLabel(s) {
    if (s.type !== "training") return TYPES[s.type].label;
    if (s.plan && s.plan.distances) return "Entraînement " + planLabel(s.plan.distances);
    return s.sheetName ? "Entraînement · " + s.sheetName : TYPES[s.type].label;
  }

  /* ---------- fiches papier de la séance libre ---------- */
  // Fiches toutes prêtes de ScanDocument (mêmes identifiants que sa bibliothèque)
  var SHEET_LIB = [
    { id: "tm1000s", name: "Mission 1000 · 1000 m (S5 · S6)", desc: "Passage à 500 m et arrivée à 1000 m, grandes lignes, aide pour compter les tours." },
    { id: "tm1000", name: "Mission 1000 · piste de 100 m", desc: "Tours faits, temps à 500 m et à 1000 m." },
    { id: "t3x500", name: "Demi-fond 3 × 500 m", desc: "3 courses, estimation, passages à 250 et 500 m." },
    { id: "t2x800", name: "Demi-fond 2 × 800 m", desc: "2 courses, estimation, passages tous les 200 m." }
  ];
  function hash(str) { var x = 2166136261; for (var i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); }
  // Fiche construite à partir des courses : une partie par course, une ligne par passage (temps cumulés) et l'arrivée.
  function planSheet(plan, est) {
    var dl = plan.distances, sp = +plan.split || 0, n = dl.length, longest = Math.max.apply(null, dl), rows = 0;
    var blocks = dl.map(function (d, i) {
      var r = [];
      if (est) r.push({ id: "c" + (i + 1) + "e", label: "Estimation", type: "time" });
      if (sp && sp < d) for (var k = sp; k < d; k += sp) r.push({ id: "c" + (i + 1) + "p" + k, label: k + " m", type: "time" });
      r.push({ id: "c" + (i + 1) + "f", label: d + " m", type: "time" });
      rows += r.length;
      return { title: (n > 1 ? "Course " + (i + 1) + " · " : "") + d + " m", rows: r };
    });
    var name = "Entraînement " + planLabel(dl) + (sp ? " · passages " + sp + " m" : "") + (est ? " · estimation" : "");
    return { id: "th-" + hash(dl.join(",") + "|" + sp + "|" + (est ? 1 : 0)), name: name, format: "auto", minutesMax: longest >= 1000 ? 9 : 5, cumulative: true,
      roomy: rows <= 4 || undefined, lay: 2, blocks: blocks, fromHub: true };
  }
  function planRows(plan, est) { var sp = +plan.split || 0; return plan.distances.reduce(function (a, d) { return a + 1 + (est ? 1 : 0) + (sp && sp < d ? Math.ceil(d / sp) - 1 : 0); }, 0); }
  // La fiche toute prête qui correspond déjà aux courses (1000 m avec passage à 500 m → Mission 1000)
  function suggestSheet(plan) {
    if (!plan) return null;
    var d = plan.distances;
    if (d.length === 1 && d[0] === 1000 && (+plan.split === 500)) return "tm1000s";
    if (d.length === 3 && d.every(function (x) { return x === 500; }) && (+plan.split === 250)) return "t3x500";
    if (d.length === 2 && d.every(function (x) { return x === 800; }) && (+plan.split === 200)) return "t2x800";
    return "plan";
  }
  // Fiches créées par l'enseignant dans ScanDocument
  function docsSheets() {
    return sdOpen().then(function (db) {
      return new Promise(function (res) {
        var g = db.transaction("state").objectStore("state").get("data");
        g.onsuccess = function () {
          var t = (g.result && g.result.templates) || [];
          res(t.filter(function (x) { return x && x.id && !SHEET_LIB.some(function (l) { return l.id === x.id; }) && !x.fromHub && (x.blocks || []).length; })
            .map(function (x) { return { id: x.id, name: x.name, desc: x.blocks.length + " partie" + (x.blocks.length > 1 ? "s" : "") + " : " + x.blocks.map(function (b) { return b.title; }).join(", ") }; }));
        };
        g.onerror = function () { res([]); };
      });
    }).catch(function () { return []; });
  }

  /* ---------- séance ---------- */
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function dayLabel(iso) { var p = String(iso || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso; }

  function startSession(h, opts) {
    var c = classById(h, opts.classId);
    if (!c) throw new Error("Classe introuvable.");
    var s = { id: uid("se-"), classId: c.id, docsId: c.docsId || c.id, type: opts.type, method: opts.method, video: !!opts.video, date: today(), createdAt: Date.now(), done: {} };
    if (opts.type === "training" && opts.plan && opts.plan.distances && opts.plan.distances.length) s.plan = { distances: opts.plan.distances.slice(), split: +opts.plan.split || 0 };
    // Séance libre sur fiche : la fiche choisie, ou celle construite avec les courses
    if (opts.type === "training" && opts.method === "paper" && opts.sheet) {
      if (opts.sheet === "plan" && s.plan) { var def = planSheet(s.plan, !!opts.sheetEst); s.sheet = def.id; s.sheetName = def.name; s.sheetDef = def; }
      else { s.sheet = opts.sheet; s.sheetName = opts.sheetName || ""; }
    }
    // Une séance et un exercice prêts dans Scan CCF, pour scanner les QR au bon endroit
    if (opts.method === "chrono") {
      var db = syncScan(c);
      var g = db.groups.find(function (x) { return x.id === c.id; });
      var lessonId = uid(), exId = uid();
      g.sessions.push({ id: exId, createdAt: Date.now(), lessonId: lessonId, lessonDate: s.date, lessonLabel: "Séance du " + dayLabel(s.date),
        label: TYPES[opts.type].label + (opts.method === "paper" ? " · fiches papier" : ""), type: opts.type === "exam500" ? "exam500" : opts.type === "ccf" ? "ccf" : "", status: "open", students: [] });
      db.activeGroupId = c.id; db.activeSessionId = exId;
      writeJSON(SCAN_KEY, db);
      s.scanExerciseId = exId;
    }
    // PhotoFinish ouvre directement sur la bonne classe
    if (opts.method === "video" || opts.video) {
      var pfId = syncVideo(c);
      var setup = readJSON(PF_SETUP, {}) || {};
      setup.classId = pfId; setup.title = TYPES[opts.type].label; setup.run = "all";
      writeJSON(PF_SETUP, setup);
    }
    // Chrono Carnet (iPad du professeur) dans le bon mode
    if (opts.method === "chrono") {
      var ck = readJSON("chronoCarnetEPS_v4", null);
      if (!ck || typeof ck !== "object") ck = {};
      ck.mode = TYPES[opts.type].chronoMode; ck.view = "setup";
      if (s.plan) {
        // séance libre : Chrono Carnet en chronomètre, une course ou une série de courses
        var dl = s.plan.distances, sp = s.plan.split;
        ck.trainingTool = "chrono";
        if (dl.length === 1) { ck.chronoPlanMode = "single"; ck.totalDistance = dl[0]; ck.chronoSingleWithSplits = !!sp; }
        else { ck.chronoPlanMode = "series"; ck.chronoSeriesDistances = dl.slice(); ck.chronoSeriesText = dl.join(" "); ck.chronoSeriesWithSplits = !!sp; }
        if (sp) ck.splitDistance = sp;
      }
      writeJSON("chronoCarnetEPS_v4", ck);
    }
    h.sessions.unshift(s);
    h.sessions = h.sessions.slice(0, 80);
    h.currentId = s.id;
    save(h);
    return s;
  }

  /* Liste d'élèves dans l'adresse du QR de séance : chaque élève choisit son nom au lieu de le taper. */
  function b64url(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function unb64url(s) {
    s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function encodeRoster(c) {
    var clean = function (v) { return String(v || "").replace(/[|;~]/g, " ").trim(); };
    return b64url(clean(c.name) + "~" + c.students.map(function (s) {
      return clean(s.last) + "|" + clean(s.first) + "|" + (s.sex || "") + (s.cls && norm(s.cls) !== norm(c.name) ? "|" + clean(s.cls) : "");
    }).join(";"));
  }
  function decodeRoster(param) {
    var txt = unb64url(param), i = txt.indexOf("~");
    var name = txt.slice(0, i);
    return { name: name, students: txt.slice(i + 1).split(";").filter(Boolean).map(function (r) {
      var p = r.split("|"); return { last: p[0] || "", first: p[1] || "", sex: p[2] || "", cls: p[3] || name };
    }) };
  }

  global.EPSHub = {
    TYPES: TYPES, METHODS: METHODS, parsePlan: parsePlan, planLabel: planLabel, typeLabel: typeLabel, SHEET_LIB: SHEET_LIB, planSheet: planSheet, planRows: planRows, suggestSheet: suggestSheet, docsSheets: docsSheets, load: load, save: save, current: current, classById: classById,
    readRoster: readRoster, upsertClass: upsertClass, syncClass: syncClass, syncAll: syncAll,
    foundInTools: foundInTools, foundInDocs: foundInDocs, startSession: startSession,
    encodeRoster: encodeRoster, decodeRoster: decodeRoster, photosGet: photosGet, photosPut: photosPut, validPhoto: validPhoto,
    stdId: stdId, readJSON: readJSON, writeJSON: writeJSON, splitName: splitName, sdOpen: sdOpen, fullName: fullName, norm: norm, dayLabel: dayLabel, uid: uid
  };
})(window);
