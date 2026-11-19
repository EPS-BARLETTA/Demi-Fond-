/* Demi-fond EPS — une séance = un fichier.
   Enregistrer : tout ce qui concerne la séance (résultats Scan CCF, fiches lues, courses PhotoFinish
   avec leurs photos, corrections) dans un seul fichier HTML, à garder dans Fichiers sur l'iPad.
   Libérer : une fois enregistrée, retirer de l'appli les photos et courses de cette séance.
   Rouvrir : remettre une séance enregistrée dans l'appli. */
(function () {
  "use strict";
  var H = window.EPSHub;
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var pad = function (n) { return String(n).padStart(2, "0"); };
  function isoOf(ts) { var d = new Date(ts); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function norm(v) { return H.norm(v); }

  /* ---------- IndexedDB ---------- */
  function idb(name, store, opts) {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(name, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(store, opts); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }
  function idbGet(name, store, key, opts) {
    return idb(name, store, opts).then(function (db) { return new Promise(function (res) { var g = db.transaction(store).objectStore(store).get(key); g.onsuccess = function () { db.close(); res(g.result); }; g.onerror = function () { db.close(); res(undefined); }; }); }).catch(function () { return undefined; });
  }
  function idbPut(name, store, value, key, opts) {
    return idb(name, store, opts).then(function (db) { return new Promise(function (res) { var t = db.transaction(store, "readwrite"); if (key === undefined) t.objectStore(store).put(value); else t.objectStore(store).put(value, key); t.oncomplete = function () { db.close(); res(); }; t.onerror = function () { db.close(); res(); }; }); }).catch(function () {});
  }
  function idbDel(name, store, keys, opts) {
    return idb(name, store, opts).then(function (db) { return new Promise(function (res) { var t = db.transaction(store, "readwrite"); keys.forEach(function (k) { t.objectStore(store).delete(k); }); t.oncomplete = function () { db.close(); res(); }; t.onerror = function () { db.close(); res(); }; }); }).catch(function () {});
  }
  function blobToData(b) { return new Promise(function (res) { var f = new FileReader(); f.onload = function () { res(f.result); }; f.onerror = function () { res(null); }; f.readAsDataURL(b); }); }
  function dataToBlob(u) { return fetch(u).then(function (r) { return r.blob(); }); }

  /* ---------- ce qui appartient à une séance ---------- */
  // Les résultats Scan CCF de la séance, où qu'ils soient : la classe peut exister dans Scan CCF sous un autre
  // identifiant (créée avant l'appli, ou venue d'une sauvegarde Scan CCF importée). Même règle que le contrôle.
  function scanPart(s, c) {
    var db = H.readJSON("df-scan-ccf-v2", null);
    if (!db || !db.groups) return null;
    var groups = db.groups.filter(function (x) { return x.id === c.id || norm(x.name) === norm(c.name); });
    if (!groups.length) return null;
    var all = []; groups.forEach(function (g) { (g.sessions || []).forEach(function (x) { all.push({ g: g, x: x }); }); });
    var hasTraining = function (x) { return (db.trainingScans || []).some(function (t) { return t.sessionId === x.id; }); };
    var full = function (x) { return (x.students || []).length || hasTraining(x); };
    var ex = all.filter(function (o) { return o.x.id === s.scanExerciseId || (o.x.lessonDate === s.date && full(o.x)); });
    // aucun résultat ce jour-là : l'exercice que le contrôle utilise (le dernier avec des résultats)
    if (!ex.some(function (o) { return full(o.x); })) {
      var withData = all.filter(function (o) { return full(o.x); }).sort(function (a, b) { return String(a.x.lessonDate || "").localeCompare(String(b.x.lessonDate || "")) || (a.x.createdAt || 0) - (b.x.createdAt || 0); });
      if (withData.length) ex.push(withData[withData.length - 1]);
    }
    if (!ex.length) return null;
    var exIds = {}; ex.forEach(function (o) { exIds[o.x.id] = 1; });
    var main = groups.find(function (g) { return g.id === c.id; }) || groups[0];
    return {
      group: { id: main.id, name: main.name, classroom: main.classroom, rosterPronote: main.rosterPronote },
      exercises: ex.map(function (o) { return Object.assign({}, o.x, { _groupId: o.g.id, _groupName: o.g.name }); }),
      training: (db.trainingScans || []).filter(function (t) { return exIds[t.sessionId]; }),
      exam500Bareme: db.settings && db.settings.exam500Bareme
    };
  }
  // Ce que contient une séance (dans l'appli ou dans un fichier) : sert à vérifier l'enregistrement et la réouverture.
  function counts(d) {
    var n = { scan: 0, training: 0, sheets: 0, courses: 0, photos: 0, imported: 0 };
    if (d.scan) { d.scan.exercises.forEach(function (x) { n.scan += (x.students || []).length; }); n.training = (d.scan.training || []).length; }
    if (d.docs) n.sheets = d.docs.scans.length;
    if (d.video) { n.courses = d.video.courses.length; n.photos = Object.keys(d.video.photos || {}).length; }
    if (d.imported) n.imported = d.imported.length;
    return n;
  }
  function pfCourses(s, c) {
    var classes = H.readJSON("cc_classes", []) || [];
    var k = classes.find(function (x) { return x.id === c.id; }) || classes.find(function (x) { return norm(x.name) === norm(c.name); });
    return (H.readJSON("cc_history", []) || []).filter(function (h) {
      return h.meta && isoOf(h.meta.date) === s.date && ((k && h.meta.classId === k.id) || norm(h.meta.cls) === norm(c.name));
    });
  }
  function docsState() { return idbGet("scan-document-eps-v1", "state", "data"); }
  function docsPart(s, sd) {
    if (!sd) return null;
    var cid = s.docsId || s.classId;
    var scans = (sd.scans || []).filter(function (x) { return x.classId === cid && String(x.date || x.updated || "").slice(0, 10) === s.date; });
    if (!scans.length) return null;
    var tids = {}; scans.forEach(function (x) { tids[x.templateId] = 1; });
    var pf = {}; Object.keys(tids).forEach(function (t) { if (sd.pf && sd.pf[t]) pf[t] = sd.pf[t]; });
    return {
      klass: (sd.classes || []).find(function (x) { return x.id === cid; }),
      students: (sd.students || []).filter(function (x) { return x.classId === cid; }).map(function (x) { var o = Object.assign({}, x); delete o.portrait; return o; }),
      scans: scans, templates: (sd.templates || []).filter(function (t) { return tids[t.id]; }), pf: pf
    };
  }

  /* ---------- Enregistrer ---------- */
  function collect(sessionId) {
    var h = H.load(), s = h.sessions.find(function (x) { return x.id === sessionId; });
    var c = s && H.classById(h, s.classId);
    if (!s || !c) return Promise.reject(new Error("Séance introuvable."));
    var courses = pfCourses(s, c);
    var pids = []; courses.forEach(function (co) { (co.arrivals || []).forEach(function (a) { if (a.pid && pids.indexOf(a.pid) < 0) pids.push(a.pid); }); });
    return Promise.all([
      docsState(),
      H.photosGet(c.students.map(function (e) { return e.id; })),
      idbGet("eps-hub-pf", "s", s.id),
      Promise.all(pids.map(function (pid) { return idbGet("chrono-eps", "photos", pid, { keyPath: "id" }).then(function (r) { return r && r.blob ? blobToData(r.blob).then(function (u) { return [pid, u]; }) : [pid, null]; }); }))
    ]).then(function (r) {
      var photos = {}; r[3].forEach(function (p) { if (p[1]) photos[p[0]] = p[1]; });
      return {
        format: "demifond-seance", version: 1, exportedAt: new Date().toISOString(),
        session: s, klass: c, portraits: r[1],
        scan: scanPart(s, c), docs: docsPart(s, r[0]),
        video: courses.length ? { courses: courses, photos: photos } : null,
        imported: r[2] || null
      };
    });
  }
  function summary(d) {
    var parts = [];
    if (d.scan) { var n = 0; d.scan.exercises.forEach(function (x) { n += (x.students || []).length; }); n += (d.scan.training || []).length; if (n) parts.push(n + " résultat" + (n > 1 ? "s" : "") + " d’élèves (Scan CCF)"); }
    if (d.docs) parts.push(d.docs.scans.length + " fiche" + (d.docs.scans.length > 1 ? "s" : "") + " lue" + (d.docs.scans.length > 1 ? "s" : ""));
    if (d.video) parts.push(d.video.courses.length + " course" + (d.video.courses.length > 1 ? "s" : "") + " filmée" + (d.video.courses.length > 1 ? "s" : "") + ", " + (function (n) { return n + (n > 1 ? " photos d’arrivée" : " photo d’arrivée"); })(Object.keys(d.video.photos).length));
    if (d.imported && d.imported.length) parts.push(d.imported.length + " course" + (d.imported.length > 1 ? "s" : "") + " PhotoFinish importée" + (d.imported.length > 1 ? "s" : ""));
    return parts;
  }
  function fileName(d) {
    var safe = function (v) { return String(v).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, ""); };
    return "Demi-fond_" + safe(d.klass.name) + "_" + safe(d.session.plan ? H.planLabel(d.session.plan.distances) : H.TYPES[d.session.type].short) + "_" + d.session.date + ".html";
  }
  function toHTML(d) {
    var T = H.TYPES[d.session.type];
    var json = JSON.stringify(d).replace(/</g, "\\u003c");
    return "<!DOCTYPE html><html lang=\"fr\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + esc(d.klass.name + ", " + T.label + ", " + H.dayLabel(d.session.date)) + "</title>" +
      "<style>body{margin:0;background:#eef2f6;color:#13233f;font:17px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}main{max-width:760px;margin:0 auto;padding:32px 20px}h1{font-size:30px;margin:0 0 4px}p{margin:6px 0}.card{background:#fff;border:1px solid #d6dee7;border-radius:16px;padding:18px 20px;margin-top:18px}li{margin:4px 0}small{color:#5b6b80}</style></head><body><main>" +
      "<h1>" + esc(d.klass.name) + "</h1><p>" + esc(H.typeLabel(d.session)) + ", séance du " + esc(H.dayLabel(d.session.date)) + "</p>" +
      "<div class=\"card\"><strong>Ce fichier contient</strong><ul>" + summary(d).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "<li>La liste de la classe (" + d.klass.students.length + " élèves)</li></ul>" +
      "<p><small>Pour rouvrir la séance : Demi-fond EPS, onglet Outils, « Rouvrir une séance enregistrée », puis choisis ce fichier.</small></p></div>" +
      "<script type=\"application/json\" id=\"demifond-seance\">" + json + "</script></main></body></html>";
  }
  function deliver(name, html) {
    var file = new File([html], name, { type: "text/html" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: name }).then(function () { return true; }).catch(function (e) { if (e && e.name === "AbortError") return false; return download(name, html); });
    }
    return Promise.resolve(download(name, html));
  }
  function download(name, html) {
    var a = document.createElement("a"), url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    return true;
  }
  function same(a, b) { return Object.keys(a).every(function (k) { return a[k] === b[k]; }); }
  function save(sessionId) {
    return collect(sessionId).then(function (d) {
      var expect = counts(d), html = toHTML(d), back;
      // Vérification : on relit le fichier tel qu'il sera enregistré, et on compare à ce que l'appli contient.
      try {
        var m = html.match(/<script type="application\/json" id="demifond-seance">([\s\S]*?)<\/script>/);
        back = JSON.parse(m[1]);
      } catch (e) { throw new Error("Le fichier n’a pas pu être préparé correctement. Rien n’a été enregistré, réessaie."); }
      var got = counts(back);
      if (!same(expect, got)) throw new Error("Le fichier préparé ne contient pas tout ce qui est dans l’appli. Rien n’a été enregistré, réessaie.");
      if (d.session.method === "chrono" && !got.scan && !got.training)
        d._warn = "Aucun résultat d’élève (QR de fin) n’a été trouvé pour cette séance : le fichier ne contient que les vidéos et la classe.";
      return deliver(fileName(d), html).then(function (ok) {
        if (!ok) return null;
        var h = H.load(), s = h.sessions.find(function (x) { return x.id === sessionId; });
        if (s) { s.savedAt = Date.now(); s.savedName = fileName(d); s.savedCounts = got; H.save(h); }
        return { name: fileName(d), parts: summary(d), warn: d._warn || "" };
      });
    });
  }
  // Depuis l'enregistrement, quelque chose a-t-il été ajouté ? (alors il faut enregistrer à nouveau avant de libérer)
  function changedSince(sessionId) {
    var h = H.load(), s = h.sessions.find(function (x) { return x.id === sessionId; });
    if (!s || !s.savedAt) return Promise.resolve(true);
    if (!s.savedCounts) return Promise.resolve(false);
    return collect(sessionId).then(function (d) {
      var now = counts(d), was = s.savedCounts;
      return Object.keys(now).some(function (k) { return k !== "photos" && now[k] > (was[k] || 0); });
    });
  }

  /* ---------- Ce que la séance occupe, et libérer ---------- */
  function weight(sessionId) {
    var h = H.load(), s = h.sessions.find(function (x) { return x.id === sessionId; }), c = s && H.classById(h, s.classId);
    if (!s || !c) return Promise.resolve({ photos: 0, courses: 0, sheets: 0 });
    var courses = pfCourses(s, c), photos = 0;
    courses.forEach(function (co) { var seen = {}; (co.arrivals || []).forEach(function (a) { if (a.pid && !seen[a.pid]) { seen[a.pid] = 1; photos++; } }); });
    return Promise.all([docsState(), idbGet("eps-hub-pf", "s", s.id)]).then(function (r) {
      var dp = docsPart(s, r[0]);
      return { photos: photos, courses: courses.length, sheets: dp ? dp.scans.filter(function (x) { return x.photo; }).length : 0, imported: (r[1] || []).length };
    });
  }
  function free(sessionId) {
    var h = H.load(), s = h.sessions.find(function (x) { return x.id === sessionId; }), c = s && H.classById(h, s.classId);
    if (!s || !c) return Promise.reject(new Error("Séance introuvable."));
    if (!s.savedAt) return Promise.reject(new Error("Enregistre d’abord la séance sur l’iPad."));
    return changedSince(sessionId).then(function (changed) {
      if (changed) throw new Error("Des résultats ont été ajoutés depuis l’enregistrement. Enregistre à nouveau la séance avant de libérer la mémoire.");
      return freeNow(s, c, sessionId);
    });
  }
  function freeNow(s, c, sessionId) {
    // 1. PhotoFinish : courses de la séance et leurs photos d'arrivée
    var courses = pfCourses(s, c), ids = {}, pids = [];
    courses.forEach(function (co) { ids[co.id] = 1; (co.arrivals || []).forEach(function (a) { if (a.pid) pids.push(a.pid); }); });
    H.writeJSON("cc_history", (H.readJSON("cc_history", []) || []).filter(function (x) { return !ids[x.id]; }));
    return idbDel("chrono-eps", "photos", pids, { keyPath: "id" })
      // 2. courses PhotoFinish importées dans le contrôle
      .then(function () { return idbDel("eps-hub-pf", "s", [s.id]); })
      // 3. fiches papier : on garde les valeurs lues, on retire les photos des fiches
      .then(docsState).then(function (sd) {
        if (!sd) return;
        var cid = s.docsId || s.classId, n = 0;
        (sd.scans || []).forEach(function (x) { if (x.classId === cid && String(x.date || x.updated || "").slice(0, 10) === s.date && x.photo) { delete x.photo; n++; } });
        if (n) return idbPut("scan-document-eps-v1", "state", sd, "data");
      })
      .then(function () {
        var hh = H.load(), ss = hh.sessions.find(function (x) { return x.id === sessionId; });
        if (ss) { ss.freedAt = Date.now(); H.save(hh); }
      });
  }

  /* ---------- Rouvrir une séance enregistrée ---------- */
  function readFile(file) {
    return file.text().then(function (txt) {
      var m = txt.match(/<script type="application\/json" id="demifond-seance">([\s\S]*?)<\/script>/);
      if (!m) throw new Error("Ce fichier n’est pas une séance enregistrée par Demi-fond EPS.");
      var d = JSON.parse(m[1]);
      if (d.format !== "demifond-seance") throw new Error("Format de fichier inconnu.");
      return d;
    });
  }
  function restore(d) {
    var h = H.load();
    // classe et séance
    var c = H.classById(h, d.klass.id);
    if (!c) { h.classes.push(d.klass); c = d.klass; }
    var s = h.sessions.find(function (x) { return x.id === d.session.id; });
    if (!s) { s = d.session; h.sessions.unshift(s); }
    delete s.freedAt;
    H.save(h);
    var jobs = [H.photosPut(d.portraits || {}), H.syncClass(c)];
    // Scan CCF
    if (d.scan) {
      var db = H.readJSON("df-scan-ccf-v2", null) || { groups: [], history: [], trainingScans: [], settings: {} };
      var g = db.groups.find(function (x) { return x.id === d.scan.group.id; }) || db.groups.find(function (x) { return norm(x.name) === norm(d.scan.group.name); });
      if (!g) { g = Object.assign({ sessions: [], students: [], archived: false }, d.scan.group); db.groups.push(g); }
      d.scan.exercises.forEach(function (ex0) {
        var ex = Object.assign({}, ex0); delete ex._groupId; delete ex._groupName;
        // l'exercice existe déjà sur cet iPad (dans n'importe quel groupe) : on ne garde que la version la plus complète
        var host = null, i = -1;
        db.groups.some(function (gg) { var k = (gg.sessions || []).findIndex(function (x) { return x.id === ex.id; }); if (k >= 0) { host = gg; i = k; return true; } return false; });
        if (!host) g.sessions.push(ex);
        else if ((ex.students || []).length > (host.sessions[i].students || []).length) host.sessions[i] = ex;
      });
      if (d.scan.training && d.scan.training.length) { db.trainingScans = db.trainingScans || []; d.scan.training.forEach(function (t) { if (!db.trainingScans.some(function (y) { return String(y.id) === String(t.id) && y.sessionId === t.sessionId; })) db.trainingScans.push(t); }); }
      if (d.scan.exam500Bareme && !(db.settings && db.settings.exam500Bareme)) { db.settings = db.settings || {}; db.settings.exam500Bareme = d.scan.exam500Bareme; }
      H.writeJSON("df-scan-ccf-v2", db);
    }
    // PhotoFinish
    if (d.video) {
      var hist = H.readJSON("cc_history", []) || [];
      d.video.courses.forEach(function (co) { if (!hist.some(function (x) { return x.id === co.id; })) hist.push(co); });
      hist.sort(function (a, b) { return (b.meta && b.meta.date || 0) - (a.meta && a.meta.date || 0); });
      H.writeJSON("cc_history", hist.slice(0, 60));
      jobs.push(Object.keys(d.video.photos).reduce(function (ch, pid) {
        return ch.then(function () { return dataToBlob(d.video.photos[pid]).then(function (blob) { return idbPut("chrono-eps", "photos", { id: pid, blob: blob }, undefined, { keyPath: "id" }); }); });
      }, Promise.resolve()));
    }
    if (d.imported && d.imported.length) jobs.push(idbPut("eps-hub-pf", "s", d.imported, s.id));
    // Fiches papier
    if (d.docs) {
      jobs.push(docsState().then(function (sd) {
        sd = sd || { classes: [], students: [], scans: [], queue: [], templates: [] };
        ["classes", "students", "scans", "templates"].forEach(function (k) { sd[k] = sd[k] || []; });
        if (d.docs.klass && !sd.classes.some(function (x) { return x.id === d.docs.klass.id; })) sd.classes.push(d.docs.klass);
        d.docs.students.forEach(function (x) { if (!sd.students.some(function (y) { return y.id === x.id; })) sd.students.push(x); });
        d.docs.scans.forEach(function (x) { var i = sd.scans.findIndex(function (y) { return y.id === x.id; }); if (i < 0) sd.scans.push(x); else if (!sd.scans[i].photo && x.photo) sd.scans[i].photo = x.photo; });
        d.docs.templates.forEach(function (t) { if (!sd.templates.some(function (y) { return y.id === t.id; })) sd.templates.push(t); });
        sd.pf = sd.pf || {}; Object.keys(d.docs.pf || {}).forEach(function (t) { if (!sd.pf[t]) sd.pf[t] = d.docs.pf[t]; });
        return idbPut("scan-document-eps-v1", "state", sd, "data");
      }));
    }
    return Promise.all(jobs).then(function () {
      var hh = H.load(); hh.currentId = s.id; var ss = hh.sessions.find(function (x) { return x.id === s.id; }); if (ss) delete ss.closed; H.save(hh);
      return verifyRestore(d).then(function (miss) { return { klass: c.name, parts: summary(d), missing: miss, noScan: d.session.method === "chrono" && !counts(d).scan && !counts(d).training }; });
    });
  }
  // Après la réouverture, on relit l'appli : tout ce que le fichier contenait doit y être.
  function verifyRestore(d) {
    var want = counts(d);
    return collect(d.session.id).then(function (now) {
      var have = counts(now), miss = [];
      if (have.scan < want.scan) miss.push("résultats Scan CCF");
      if (have.training < want.training) miss.push("résultats d’entraînement");
      if (have.sheets < want.sheets) miss.push("fiches lues");
      if (have.courses < want.courses) miss.push("courses filmées");
      return miss;
    }).catch(function () { return []; });
  }

  window.EPSArchive = { save: save, counts: counts, changedSince: changedSince, weight: weight, free: free, readFile: readFile, restore: restore, summary: summary };
})();
