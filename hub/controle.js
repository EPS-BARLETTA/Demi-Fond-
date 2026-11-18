/* Contrôle croisé d'une séance :
   - temps relevés par l'élève (QR Chrono Carnet ou fiche papier) ↔ temps PhotoFinish, à 2 s près ;
   - estimation écrite sur la fiche ↔ estimation annoncée au professeur (Scan CCF). */
(function () {
  "use strict";
  var TOL = 2000;
  var H = window.EPSHub, $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var params = new URLSearchParams(location.search);
  var h = H.load();
  var s = h.sessions.find(function (x) { return x.id === params.get("s"); }) || H.current(h);
  var c = s && H.classById(h, s.classId);
  if (!s || !c) { $("table").innerHTML = '<p class="empty">Aucune séance en cours.</p>'; return; }
  var T = H.TYPES[s.type];
  $("kicker").textContent = c.name + " · " + T.label + " · " + H.dayLabel(s.date);
  var filter = "all";

  /* ---------- temps ---------- */
  function ms(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") return isFinite(v) && v > 0 ? v : null;
    var t = String(v).trim().replace(/[’′']/g, ":").replace(",", ".").replace(/\s/g, "");
    var m = t.match(/^(?:(\d+):)?(\d{1,2})(?:\.(\d{1,3}))?$/);
    if (!m) return null;
    return ((+m[1] || 0) * 60 + +m[2]) * 1000 + (m[3] ? Math.round(+("0." + m[3]) * 1000) : 0);
  }
  function fmt(v, dec) {
    if (v == null) return "—";
    var t = Math.round(v / 10) / 100, mn = Math.floor(t / 60), sc = t - mn * 60;
    var ss = dec ? sc.toFixed(1) : String(Math.floor(sc));
    if (sc < 10) ss = "0" + ss;
    return mn + ":" + ss.replace(".", ",");
  }
  function sameDay(ts, iso) { var d = new Date(ts); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") === iso; }
  // Noms écrits différemment selon les outils : accents, apostrophes, tirets, majuscules, nom tronqué « Mary-… »
  function flat(name) {
    return String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[’'`´]/g, "").replace(/[-_.,]/g, " ").replace(/\s+/g, " ").trim();
  }
  function keyOf(name) { return flat(name).replace(/…/g, "").split(" ").filter(Boolean).sort().join(" "); }

  /* ---------- élèves ---------- */
  var byKey = {};
  c.students.forEach(function (e) { byKey[keyOf(e.last + " " + e.first)] = e; });
  c.aliases = c.aliases || {};
  function matchStudent(name) {
    var k = keyOf(name);
    if (c.aliases[k]) { var al = c.students.find(function (e) { return e.id === c.aliases[k]; }); if (al) return al; }
    if (byKey[k]) return byKey[k];
    // nom tronqué par PhotoFinish : « ABESSOLO ABESSOLO Mary-… »
    if (/…|\.\.\.$/.test(name)) {
      var pre = flat(name).replace(/…|\.\.\.$/g, "").trim();
      var hits = c.students.filter(function (e) { return flat(e.last + " " + e.first).indexOf(pre) === 0; });
      if (hits.length === 1) return hits[0];
    }
    // même nom sans les espaces (« CHEVASSUS- MARCHE »)
    var tight = flat(name).replace(/ /g, "");
    var t2 = c.students.filter(function (e) { return flat(e.last + " " + e.first).replace(/ /g, "") === tight || flat(e.first + " " + e.last).replace(/ /g, "") === tight; });
    return t2.length === 1 ? t2[0] : null;
  }

  /* ---------- PhotoFinish ----------
     Deux sources, mises dans le même format { date, title, group, arrivals: [{ name, t, pid | src }] } :
     - les courses filmées sur cet iPad (historique PhotoFinish) ;
     - les fiches HTML exportées par PhotoFinish depuis un autre iPad, importées ici. */
  var pfClasses = H.readJSON("cc_classes", []) || [];
  var pfClass = pfClasses.find(function (k) { return k.id === c.id; }) || pfClasses.find(function (k) { return H.norm(k.name) === H.norm(c.name); });
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var minuteKey = function (ts) { var d = new Date(ts); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes()); };
  var localCourses = (H.readJSON("cc_history", []) || []).filter(function (x) {
    return x.meta && sameDay(x.meta.date, s.date) && ((pfClass && x.meta.classId === pfClass.id) || H.norm(x.meta.cls) === H.norm(c.name));
  }).map(function (co) {
    return { date: co.meta.date, key: minuteKey(co.meta.date), title: co.meta.title, group: co.meta.group, source: "cet iPad",
      arrivals: co.arrivals.map(function (a) { var r = (co.runners || []).find(function (x) { return x.id === a.runnerId; }); return { name: r ? r.name : a.freeName, t: a.t, pid: a.pid }; }) };
  });
  var imported = [], courses = [], allCourses = [], video = {}, unknown = [], arrivalsIdx = {};
  function buildVideo() {
    var keys = {}; localCourses.forEach(function (co) { keys[co.key] = 1; });
    allCourses = localCourses.concat(imported.filter(function (co) { return !keys[co.key]; })).sort(function (x, y) { return x.date - y.date; });
    var off = s.pfOff || {};
    courses = allCourses.filter(function (co) { return !off[co.key + "|" + (co.group || "")]; });
    video = {}; unknown = []; arrivalsIdx = {};
    var fixes = s.pfFix || {};
    courses.forEach(function (co, ci) {
      co.arrivals.forEach(function (a, ai) {
        var fk = co.key + "|" + (co.group || "") + "|" + ai, fix = fixes[fk];
        var idx = arrivalsIdx[fk] = { fk: fk, co: co, a: a, ai: ai, owner: null, excluded: fix === "none" };
        // L'élève noté dans PhotoFinish garde la place de cette course, même si l'arrivée est écartée ou donnée à un autre.
        var orig = fix && a.name && !/^non nomm/i.test(a.name) ? matchStudent(a.name) : null;
        var hole = function (why, to) { if (orig) (video[orig.id] = video[orig.id] || []).push({ hole: true, why: why, to: to, t: a.t, course: ci, fix: fk }); };
        if (fix === "none") { hole("retirée"); return; }                       // arrivée écartée à la main
        if (!fix && (!a.name || /^non nomm/i.test(a.name))) return;
        var fixSid = fix ? String(fix).split("@")[0] : null, fixRace = fix && String(fix).indexOf("@") > 0 ? +String(fix).split("@")[1] : null;
        var e = fix ? c.students.find(function (x) { return x.id === fixSid; }) : matchStudent(a.name);
        idx.owner = e || null;
        if (orig && e && orig.id !== e.id) hole("donnée", e);
        var rec = { t: a.t, pid: a.pid, src: a.src, course: ci, rank: ai + 1, title: co.title, group: co.group, fix: fk, pfName: a.name || "", manual: !!fix, race: fixRace };
        if (!e) { unknown.push(Object.assign({ name: a.name }, rec)); return; }
        (video[e.id] = video[e.id] || []).push(rec);
      });
    });
  }
  // Fiche HTML « course_AAAA-MM-JJ_HHhMM_Classe.html » exportée par PhotoFinish
  function parsePF(html, fname) {
    var d = new DOMParser().parseFromString(html, "text/html");
    var title = (d.querySelector("h1") || {}).textContent || fname, meta = ((d.querySelector(".m") || {}).textContent || "").trim();
    var fm = String(fname).match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})h(\d{2})/);
    var date = fm ? new Date(+fm[1], +fm[2] - 1, +fm[3], +fm[4], +fm[5]).getTime() : Date.now();
    var arrivals = [], last = null, lastSrc = null;
    d.querySelectorAll("tbody tr").forEach(function (tr) {
      var tds = [].slice.call(tr.children), tcell = tr.querySelector("td.t");
      var ncell = tds.find(function (td) { return !td.className && td.textContent.trim(); });
      if (tcell) {
        last = ms(tcell.textContent.trim());
        var img = tr.querySelector("td.ph img"), src = img ? img.getAttribute("src") || "" : "";
        lastSrc = /^data:image\//.test(src) ? src : null;
      }
      if (ncell) arrivals.push({ name: ncell.textContent.trim(), t: last, src: lastSrc });
    });
    return { date: date, key: minuteKey(date), title: title.trim(), group: meta, source: fname, arrivals: arrivals.filter(function (a) { return a.t != null; }) };
  }
  // Courses importées gardées sur l'appareil pour cette séance
  var IMP_DB = "eps-hub-pf";
  function impDB() { return new Promise(function (res, rej) { var r = indexedDB.open(IMP_DB, 1); r.onupgradeneeded = function () { r.result.createObjectStore("s"); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function loadImported() {
    return impDB().then(function (db) { return new Promise(function (res) { var g = db.transaction("s").objectStore("s").get(s.id); g.onsuccess = function () { db.close(); res(g.result || []); }; g.onerror = function () { db.close(); res([]); }; }); }).catch(function () { return []; });
  }
  function saveImported() {
    return impDB().then(function (db) { return new Promise(function (res) { var t = db.transaction("s", "readwrite"); t.objectStore("s").put(imported, s.id); t.oncomplete = function () { db.close(); res(); }; t.onerror = function () { db.close(); res(); }; }); }).catch(function () {});
  }
  function shrink(src) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () { try { var k = Math.min(1, 320 / im.naturalWidth), cv = document.createElement("canvas"); cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); res(cv.toDataURL("image/jpeg", 0.72)); } catch (e) { res(src); } };
      im.onerror = function () { res(null); }; im.src = src;
    });
  }
  $("pfFiles").addEventListener("change", function (e) {
    var files = [].slice.call(e.target.files || []); e.target.value = "";
    var n = 0, scanFiles = 0, scanAdded = 0;
    files.reduce(function (ch, f) {
      return ch.then(function () { return f.text(); }).then(function (txt) {
        var bk = txt.match(/<script id="demifond-archive-data" type="application\/json">([\s\S]*?)<\/script>/);
        if (bk) { try { scanAdded += mergeScanBackup(JSON.parse(bk[1])); scanFiles++; } catch (err) {} return; }
        var co = parsePF(txt, f.name); if (!co.arrivals.length) return;
        var cache = {};
        return co.arrivals.reduce(function (c2, a) {
          return c2.then(function () { if (!a.src) return; if (cache[a.src]) { a.src = cache[a.src]; return; } var orig = a.src; return shrink(orig).then(function (sm) { cache[orig] = sm; a.src = sm; }); });
        }, Promise.resolve()).then(function () {
          var dup = imported.some(function (x) { return x.key === co.key && x.group === co.group; });
          imported = imported.filter(function (x) { return x.key !== co.key || x.group !== co.group; });
          imported.push(co); if (!dup) n++;
        });
      }).catch(function () {});
    }, Promise.resolve()).then(function () {
      saveImported();
      if (scanFiles) loadScan();
      var msg = [];
      if (scanFiles) msg.push("Sauvegarde Scan CCF importée : " + (scanAdded ? scanAdded + " résultats d’élèves ajoutés." : "ces résultats étaient déjà là."));
      if (msg.length && !n) { $("pfStatus").textContent = msg.join(" "); refresh(); return; }
      $("pfStatus").textContent = (msg.length ? msg.join(" ") + " " : "") + (n ? n + " course" + (n > 1 ? "s" : "") + " PhotoFinish importée" + (n > 1 ? "s" : "") + "." : files.length ? "Ces courses étaient déjà importées." : "Aucune course reconnue : choisis les fichiers HTML exportés par PhotoFinish (course_….html).");
      refresh();
    });
  });

  /* ---------- Scan CCF (QR Chrono Carnet, estimations annoncées) ---------- */
  // La classe peut exister dans Scan CCF sous un autre identifiant (créée avant, ou venue d'une sauvegarde) :
  // on prend tous les groupes Scan CCF de même identifiant ou de même nom.
  var ex = null;
  function loadScan() {
    var scan = H.readJSON("df-scan-ccf-v2", null), all = [];
    (scan && scan.groups || []).forEach(function (g) {
      if (g.id === c.id || H.norm(g.name) === H.norm(c.name)) (g.sessions || []).forEach(function (x) { all.push(x); });
    });
    ex = s.scanExerciseId ? all.find(function (x) { return x.id === s.scanExerciseId; }) : null;
    var withData = all.filter(function (x) { return (x.students || []).length; });
    var sameDay = withData.filter(function (x) { return x.lessonDate === s.date; });
    var pool = (sameDay.length ? sameDay : withData).sort(function (a2, b2) { return String(a2.lessonDate || "").localeCompare(String(b2.lessonDate || "")) || (a2.createdAt || 0) - (b2.createdAt || 0); });
    if ((!ex || !(ex.students || []).length) && pool.length) ex = pool[pool.length - 1];
  }
  loadScan();
  // Sauvegarde HTML de Scan CCF (fichier « DemiFond_Classe_date.html ») : les résultats sont ajoutés à Scan CCF
  function mergeScanBackup(data) {
    var db = H.readJSON("df-scan-ccf-v2", null) || { groups: [], activeGroupId: null, activeSessionId: null, history: [], trainingScans: [], settings: {} };
    var n = 0;
    (data.groups || []).forEach(function (bg) {
      var g = db.groups.find(function (x) { return x.id === bg.id; }) || db.groups.find(function (x) { return H.norm(x.name) === H.norm(bg.name); });
      if (!g) { db.groups.push(bg); (bg.sessions || []).forEach(function (x) { n += (x.students || []).length; }); return; }
      (bg.sessions || []).forEach(function (x) {
        var i = g.sessions.findIndex(function (y) { return y.id === x.id; });
        if (i < 0) { g.sessions.push(x); n += (x.students || []).length; }
        else if ((x.students || []).length > (g.sessions[i].students || []).length) { g.sessions[i] = x; n += x.students.length; }
      });
      if (!g.rosterPronote && bg.rosterPronote) g.rosterPronote = bg.rosterPronote;
    });
    if (data.settings && data.settings.exam500Bareme) { db.settings = db.settings || {}; if (!db.settings.exam500Bareme) db.settings.exam500Bareme = data.settings.exam500Bareme; }
    H.writeJSON("df-scan-ccf-v2", db);
    return n;
  }
  function scanStudent(e) {
    if (!ex) return null;
    var id = H.stdId(e.last, e.first, e.cls || c.name);
    return ex.students.find(function (x) { return x.id === id || x.externalId === id; }) ||
      ex.students.find(function (x) { return keyOf(x.last + " " + x.first) === keyOf(e.last + " " + e.first); }) ||
      ex.students.find(function (x) { return matchStudent(x.last + " " + x.first) === e; });
  }

  /* ---------- ScanDocument (fiches papier) ---------- */
  function docsState() {
    if (s.method !== "paper") return Promise.resolve(null);
    return H.sdOpen().then(function (db) {
      return new Promise(function (res) {
        var g = db.transaction("state").objectStore("state").get("data");
        g.onsuccess = function () { db.close(); res(g.result || null); };
        g.onerror = function () { db.close(); res(null); };
      });
    }).catch(function () { return null; });
  }

  function races() { return s.type === "ccf" ? 2 : s.type === "exam500" ? 3 : 0; }

  function build(sd) {
    var N = races();
    var tpl = T.sheet;
    return c.students.map(function (e) {
      var row = { e: e, races: [], warn: 0, ok: 0, missing: 0 };
      var st = scanStudent(e);
      var sheet = null;
      if (sd) {
        var sdStu = sd.students.find(function (x) { return x.id === e.id; }) ||
          sd.students.find(function (x) { return x.classId === (s.docsId || c.id) && keyOf(x.name) === keyOf(e.last + " " + e.first); });
        if (sdStu) sheet = sd.scans.filter(function (x) { return x.studentId === sdStu.id && (!tpl || x.templateId === tpl); })
          .sort(function (a, b) { return String(b.updated).localeCompare(String(a.updated)); })[0] || null;
      }
      // vidéos de l'élève : celles corrigées pour une course précise d'abord, les autres dans l'ordre de la journée
      var raw = video[e.id] || [], vids = [];
      raw = raw.slice().sort(function (x, y) { return x.course - y.course || (x.t || 0) - (y.t || 0); });
      raw.forEach(function (v) { if (v.race && !vids[v.race - 1]) vids[v.race - 1] = v; });
      raw.forEach(function (v) { if (v.race && vids[v.race - 1] === v) return; var i = 0; while (vids[i]) i++; vids[i] = v; });
      var holes = vids.map(function (v) { return v && v.hole ? v : null; });
      vids = vids.map(function (v) { return v && v.hole ? null : v; });
      var n = Math.max(N, vids.length);
      for (var k = 1; k <= n; k++) {
        var r = { k: k, sid: e.id, v: vids[k - 1] || null, hole: holes[k - 1] || null, own: null, ownSrc: "", est: null, said: null };
        if (s.method === "chrono" && st) {
          if (s.type === "ccf" && st.races && st.races[k]) { r.own = ms(st.races[k].totalMs); r.est = st.races[k].project || null; }
          if (s.type === "exam500" && st.exam500 && st.exam500.races) {
            var x = st.exam500.races.find(function (y) { return +y.race === k; });
            if (x) { r.own = ms(x.total500Ms); r.est = x.project || null; }
          }
          r.ownSrc = "QR";
        }
        if (s.method === "paper" && sheet) {
          var v = sheet.values || {};
          r.own = ms(v["c" + k + (s.type === "ccf" ? "d" : "b")]);
          r.est = v["c" + k + "e"] || null;
          r.ownSrc = "fiche";
          if (s.type === "ccf" && st) r.said = st["project" + k] || null;
        }
        // contrôles
        r.timeOk = r.own != null && r.v ? Math.abs(r.own - r.v.t) <= TOL : null;
        r.delta = r.own != null && r.v ? r.own - r.v.t : null;
        r.estOk = r.est && r.said ? Math.abs(ms(r.est) - ms(r.said)) < 1000 : null;
        [r.timeOk, r.estOk].forEach(function (b) { if (b === true) row.ok++; else if (b === false) row.warn++; });
        if (k <= N && r.own == null && !r.v) row.missing++;
        row.races.push(r);
      }
      return row;
    });
  }

  function cell(r) {
    var parts = [];
    var v = r.v;
    var fixAttrs = v ? ' data-fix="' + esc(v.fix) + '" data-k="' + r.k + '" data-sid="' + esc(r.sid) + '" data-pf="' + esc(v.pfName) + '" data-txt="' + esc("Course " + r.k + ", arrivée n° " + v.rank + ", " + fmt(v.t, true)) + '"' : "";
    if (v) parts.push('<button type="button" class="thumb" data-pid="' + esc(v.pid || "") + '" data-src="' + esc(v.src || "") + '"' + fixAttrs + ' aria-label="Photo d’arrivée, corriger l’élève"><img alt=""></button>');
    var lines = [];
    if (r.own != null || v) {
      var cls = r.timeOk === true ? "ok" : r.timeOk === false ? "bad" : "";
      lines.push('<span class="' + cls + '">' + (r.ownSrc ? (r.ownSrc === "QR" ? "Élève " : "Fiche ") + fmt(r.own, true) : "") +
        (v ? (r.ownSrc ? " · " : "") + "Vidéo " + fmt(v.t, true) + (v.manual ? " (corrigé)" : "") + ((s.pfOk || {})[v.fix] ? " (vérifiée)" : "") : "") +
        (r.delta != null ? " <b>" + (r.timeOk ? "✓" : "⚠ " + (r.delta > 0 ? "+" : "−") + (Math.abs(r.delta) / 1000).toFixed(1).replace(".", ",") + " s") + "</b>" : "") + "</span>");
    }
    if (r.est || r.said) {
      var ec = r.estOk === true ? "ok" : r.estOk === false ? "bad" : "";
      var fe = function (v) { var m = ms(v); return m == null ? esc(v || "—") : fmt(m); };
      lines.push('<span class="' + ec + '">Estim. ' + (r.said ? "fiche " + fe(r.est) + " · annoncée " + fe(r.said) : fe(r.est)) +
        (r.estOk != null ? " <b>" + (r.estOk ? "✓" : "⚠ différente") + "</b>" : "") + "</span>");
    }
    if (!v && r.hole) lines.push('<span class="muted">Vidéo ' + (r.hole.why === "retirée" ? "retirée" : "donnée à " + esc(r.hole.to.first + " " + r.hole.to.last)) + '</span><button type="button" class="fixbtn" data-unfix="' + esc(r.hole.fix) + '">Annuler</button>');
    if (v) lines.push('<button type="button" class="fixbtn"' + fixAttrs + ">Vérifier ou corriger</button>");
    else if (courses.length) lines.push('<button type="button" class="fixbtn pick" data-sid="' + esc(r.sid) + '" data-k="' + r.k + '" data-own="' + (r.own == null ? "" : r.own) + '">Associer une vidéo</button>');
    if (!lines.length) lines.push('<span class="muted">—</span>');
    return '<td><div class="rc">' + parts.join("") + '<div class="rl">' + lines.join("") + "</div></div></td>";
  }

  var photos = {};
  function render(rows) {
    var N = Math.max(races(), Math.max.apply(null, rows.map(function (x) { return x.races.length; }).concat([0])));
    var nWarn = rows.filter(function (x) { return x.warn; }).length, nOk = rows.filter(function (x) { return !x.warn && x.ok; }).length;
    var nMiss = rows.filter(function (x) { return !x.warn && !x.ok; }).length;
    $("sum").innerHTML = '<span class="pill ok">✓ ' + nOk + " conforme" + (nOk > 1 ? "s" : "") + '</span><span class="pill bad">⚠ ' + nWarn + " à vérifier</span>" +
      '<span class="pill">' + nMiss + " sans donnée à comparer</span>" + '<span class="pill">' + courses.length + " course" + (courses.length > 1 ? "s" : "") + " PhotoFinish</span>";
    var list = rows.filter(function (x) { return filter === "all" || x.warn; });
    var head = "<tr><th>Élève</th>";
    for (var k = 1; k <= N; k++) head += "<th>" + (s.type === "ccf" ? (k === 1 ? "1er" : "2e") + " 800 m" : "Course " + k) + "</th>";
    $("table").innerHTML = list.length ? '<div class="tablewrap"><table class="ctl"><thead>' + head + "</tr></thead><tbody>" + list.map(function (x) {
      var cells = "";
      for (var k = 0; k < N; k++) cells += x.races[k] ? cell(x.races[k]) : '<td><span class="muted">—</span></td>';
      return '<tr class="' + (x.warn ? "warn" : "") + '"><th scope="row"><span class="who">' +
        (photos[x.e.id] ? '<img src="' + photos[x.e.id] + '" alt="">' : '<span class="nophoto">' + esc(x.e.first[0] || "?") + "</span>") +
        "<span><strong>" + esc(x.e.last) + "</strong> " + esc(x.e.first) + "</span></span></th>" + cells + "</tr>";
    }).join("") + "</tbody></table></div>" : '<p class="empty">' + (filter === "warn" ? "Rien à vérifier." : "Aucun élève.") + "</p>";
    var off = s.pfOff || {};
    $("courses").innerHTML = (allCourses.length ? "<p>Décoche une course filmée pour rien (essai, faux départ) : elle n’est plus comptée et les suivantes reprennent leur numéro.</p>" + allCourses.map(function (co) {
      var d = new Date(co.date), k = co.key + "|" + (co.group || "");
      var grpLabel = (String(co.group || "").match(/Groupe\s*\S+/i) || [co.group || ""])[0];
      var src = co.source === "cet iPad" ? "filmée sur cet iPad" : "fichier importé";
      return '<label class="course-row"><input type="checkbox" data-course="' + esc(k) + '"' + (off[k] ? "" : " checked") + "> <span><strong>" + d.getHours() + "h" + pad(d.getMinutes()) + "</strong>" + (grpLabel ? ", " + esc(grpLabel) : "") + (co.title && !/^course$/i.test(co.title) ? ", " + esc(co.title) : "") + ", " + co.arrivals.length + " arrivées <small>(" + src + ")</small></span></label>";
    }).join("") : "<p>Aucune course PhotoFinish pour cette classe ce jour-là.</p>");
    $("courses").querySelectorAll("input[data-course]").forEach(function (cb) {
      cb.onchange = function () {
        var hh = H.load(), ss = hh.sessions.find(function (x) { return x.id === s.id; }); if (!ss) return;
        ss.pfOff = ss.pfOff || {};
        if (cb.checked) delete ss.pfOff[cb.dataset.course]; else ss.pfOff[cb.dataset.course] = 1;
        H.save(hh); s.pfOff = ss.pfOff; refresh();
      };
    });
    // Plus de courses filmées que prévu pour un élève : sans doute une course d'essai à décocher
    var extra = races() && rows.some(function (x) { return x.races.length > races(); });
    if (extra) $("coursesBox").open = true;
    $("coursesBox").classList.toggle("notice", !!extra);
    $("coursesBox").classList.toggle("warn", !!extra);
    // Rien à comparer : on dit pourquoi
    var anyOwn = rows.some(function (x) { return x.races.some(function (r) { return r.own != null; }); });
    var anyVid = rows.some(function (x) { return x.races.some(function (r) { return r.v; }); });
    var why = "";
    if (!anyOwn && s.method === "chrono") why = "<h3>Pas encore de résultats d’élèves à comparer</h3><p>Seules les vidéos sont affichées. Les temps des élèves arrivent quand tu scannes leurs QR codes de fin (étape « Récupérer les résultats »). Résultats scannés sur un autre iPad : touche « Importer des fichiers » ci-dessous et choisis la sauvegarde Scan CCF de la classe (fichier « DemiFond_… .html »).</p>";
    else if (!anyOwn && s.method === "paper") why = "<h3>Pas encore de fiches lues</h3><p>Photographie les fiches remplies pour comparer leurs temps aux vidéos.</p>";
    else if (anyOwn && !anyVid) why = "<h3>Pas encore de vidéo à comparer</h3><p>Filme les arrivées avec PhotoFinish sur cet iPad, ou importe les fichiers HTML des courses filmées sur un autre iPad.</p>";
    $("why").innerHTML = why ? '<div class="notice">' + why + "</div>" : "";
    renderUnknown();
    renderFixes();
    loadThumbs();
  }

  /* Noms PhotoFinish non reconnus : le professeur choisit l'élève (gardé pour les prochaines fois) */
  // Élève avec des temps (QR ou fiche) mais sans vidéo, et vidéo sans temps sous un autre nom :
  // si les temps concordent à 2 s près, c'est sûrement le même coureur, mal nommé dans PhotoFinish.
  function swaps() {
    var noVid = rows.filter(function (x) { return x.races.some(function (r) { return r.own != null; }) && !x.races.some(function (r) { return r.v; }); });
    var noOwn = rows.filter(function (x) { return x.races.some(function (r) { return r.v; }) && !x.races.some(function (r) { return r.own != null; }); });
    var out = [];
    noVid.forEach(function (a) {
      noOwn.forEach(function (b) {
        var n = 0, ok = true;
        a.races.forEach(function (r, i) { var v = b.races[i] && b.races[i].v; if (r.own != null && v) { n++; if (Math.abs(r.own - v.t) > TOL) ok = false; } });
        if (ok && n >= 1) out.push({ student: a.e, pfStudent: b.e, n: n });
      });
    });
    return out;
  }
  function pfNamesOf(student) {
    var names = [];
    courses.forEach(function (co) { co.arrivals.forEach(function (a) { if (a.name && matchStudent(a.name) === student && names.indexOf(a.name) < 0) names.push(a.name); }); });
    return names;
  }
  function renderUnknown() {
    var box = $("unknown"); if (!box) return;
    var names = []; unknown.forEach(function (u) { if (names.indexOf(u.name) < 0) names.push(u.name); });
    var sw = swaps();
    if (!names.length && !sw.length) { box.innerHTML = ""; return; }
    var opts = '<option value="">Choisir l’élève…</option>' + c.students.slice().sort(function (a, b) { return (a.last + a.first).localeCompare(b.last + b.first, "fr"); })
      .map(function (e) { return '<option value="' + esc(e.id) + '">' + esc(e.last + " " + e.first) + "</option>"; }).join("");
    box.innerHTML = sw.map(function (x, i) {
      return '<div class="notice warn swap"><h3>Même coureur ?</h3><p>Dans PhotoFinish, les arrivées notées <strong>' + esc(x.pfStudent.last + " " + x.pfStudent.first) +
        "</strong> ont les mêmes temps que <strong>" + esc(x.student.last + " " + x.student.first) + "</strong> (" + x.n + " course" + (x.n > 1 ? "s" : "") + " à moins de 2 s), qui n’a aucune vidéo. " +
        "Le nom a sûrement été mal choisi à l’arrivée.</p>" +
        '<button type="button" class="btn solid small" data-swap="' + i + '">Ces vidéos sont celles de ' + esc(x.student.first + " " + x.student.last) + "</button></div>";
    }).join("") + (names.length ? '<div class="notice warn"><h3>' + names.length + " nom" + (names.length > 1 ? "s" : "") + " de PhotoFinish à rattacher</h3>" +
      "<p>Ces noms ne correspondent à aucun élève de la classe. Choisis le bon élève : ce sera retenu pour les prochaines fois.</p>" +
      names.map(function (n) { return '<label class="alias"><span>' + esc(n) + '</span><select data-name="' + esc(n) + '">' + opts + "</select></label>"; }).join("") + "</div>" : "");
    var setAlias = function (pfName, sid) {
      var hh = H.load(), cc = H.classById(hh, c.id); if (!cc) return;
      cc.aliases = cc.aliases || {}; cc.aliases[keyOf(pfName)] = sid; H.save(hh);
      c.aliases[keyOf(pfName)] = sid;
    };
    box.querySelectorAll("[data-swap]").forEach(function (bt) {
      bt.onclick = function () { var x = sw[+bt.dataset.swap]; pfNamesOf(x.pfStudent).forEach(function (n) { setAlias(n, x.student.id); }); refresh(); };
    });
    box.querySelectorAll("select[data-name]").forEach(function (sel) {
      sel.onchange = function () { if (sel.value) { setAlias(sel.dataset.name, sel.value); refresh(); } };
    });
  }

  /* photos d'arrivée PhotoFinish (IndexedDB « chrono-eps ») */
  var pfdb = null, urls = {};
  function pfPhoto(pid) {
    if (urls[pid]) return Promise.resolve(urls[pid]);
    pfdb = pfdb || new Promise(function (res, rej) {
      var r = indexedDB.open("chrono-eps", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("photos", { keyPath: "id" }); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
    return pfdb.then(function (db) {
      return new Promise(function (res) {
        var g = db.transaction("photos").objectStore("photos").get(pid);
        g.onsuccess = function () { res(g.result && g.result.blob ? (urls[pid] = URL.createObjectURL(g.result.blob)) : null); };
        g.onerror = function () { res(null); };
      });
    }).catch(function () { return null; });
  }
  function loadThumbs() {
    document.querySelectorAll(".thumb[data-pid]").forEach(function (b) {
      if (b.dataset.src) { b.querySelector("img").src = b.dataset.src; return; }
      if (!b.dataset.pid) { b.remove(); return; }
      pfPhoto(b.dataset.pid).then(function (u) { if (u) b.querySelector("img").src = u; else b.remove(); });
    });
  }
  /* Vérifier une arrivée filmée : c'est bien cet élève (valider), ce n'est personne (retirer), ou un autre élève */
  var fixing = null, fixingRace = null, fixingSid = null;
  $("table").addEventListener("click", function (e) {
    var pk = e.target.closest(".fixbtn.pick"); if (pk) { openPick(pk.dataset.sid, +pk.dataset.k, pk.dataset.own === "" ? null : +pk.dataset.own); return; }
    var un = e.target.closest("[data-unfix]"); if (un) { fixing = un.dataset.unfix; saveFix(""); return; }
    var b = e.target.closest(".thumb, .fixbtn"); if (!b || !b.dataset.fix) return;
    var cellEl = b.closest(".rc"), th = cellEl && cellEl.querySelector(".thumb img");
    fixing = b.dataset.fix; fixingRace = +b.dataset.k || null; fixingSid = b.dataset.sid;
    var st = c.students.find(function (x) { return x.id === fixingSid; });
    var x = arrivalsIdx[fixing];
    $("zoomImg").hidden = !(th && th.src); if (th && th.src) $("zoomImg").src = th.src;
    $("zoomTitle").textContent = (x ? "Arrivée n° " + (x.ai + 1) + ", " : "") + (x ? fmt(x.a.t, true) : "");
    $("zoomTxt").textContent = (x ? arrivalLabel(x) + ". " : "") + (b.dataset.pf ? "Nom dans PhotoFinish : " + b.dataset.pf + ". " : "") +
      (st ? "Comptée pour " + st.first + " " + st.last + (fixingRace ? ", course " + fixingRace : "") + "." : "");
    $("zoomOk").textContent = st ? "C’est bien " + st.first + " " + st.last : "Valider";
    $("zoomOk").hidden = !st;
    var ok = (s.pfOk || {})[fixing];
    $("zoomOk").setAttribute("aria-pressed", ok ? "true" : "false");
    $("zoomOkNote").textContent = ok ? "Déjà vérifiée." : "";
    $("zoomReset").hidden = !(s.pfFix && s.pfFix[fixing]);
    $("zoomFind").value = "";
    drawWho();
    $("zoom").showModal();
  });
  var classPhotos = null;
  function drawWho() {
    var q = keyOf($("zoomFind").value).split(" ").filter(Boolean);
    var list = c.students.slice().sort(function (x, y) { return (x.last + x.first).localeCompare(y.last + y.first, "fr"); })
      .filter(function (x) { var k = keyOf(x.last + " " + x.first); return x.id !== fixingSid && q.every(function (w) { return k.indexOf(w) >= 0; }); });
    $("zoomWho").innerHTML = list.map(function (x) {
      var ph = classPhotos && classPhotos[x.id];
      return '<button type="button" class="who-btn" data-sid="' + esc(x.id) + '">' + (ph ? '<img src="' + ph + '" alt="">' : '<span class="nophoto">' + esc((x.first || "?")[0]) + "</span>") +
        "<span><strong>" + esc(x.last) + "</strong> " + esc(x.first) + "</span></button>";
    }).join("") || '<p class="empty">Aucun élève trouvé.</p>';
  }
  $("zoomFind").addEventListener("input", drawWho);
  $("zoomWho").addEventListener("click", function (e) { var b = e.target.closest(".who-btn"); if (b) saveFix(b.dataset.sid); });
  $("zoomOk").onclick = function () {
    var hh = H.load(), ss = hh.sessions.find(function (x) { return x.id === s.id; }); if (!ss) return;
    ss.pfOk = ss.pfOk || {}; ss.pfOk[fixing] = Date.now(); s.pfOk = ss.pfOk; H.save(hh);
    $("zoom").close(); refresh();
  };
  $("zoomRemove").onclick = function () { saveFix("none"); };
  /* Associer une vidéo à un élève depuis sa ligne : toutes les arrivées filmées, les plus proches de son temps d'abord */
  var picking = null, pickRace = null;
  function arrivalLabel(x) {
    var d = new Date(x.co.date), g = (String(x.co.group || "").match(/Groupe\s*\S+/i) || [x.co.group || ""])[0];
    return d.getHours() + "h" + pad(d.getMinutes()) + (g ? ", " + g : "") + ", arrivée n° " + (x.ai + 1);
  }
  function openPick(sid, k, own) {
    var st = c.students.find(function (x) { return x.id === sid; }); if (!st) return;
    picking = sid; pickRace = k || null;
    var list = Object.keys(arrivalsIdx).map(function (fk) { return arrivalsIdx[fk]; }).filter(function (x) { return x.a.t != null; });
    list.sort(function (x, y) { return own != null ? Math.abs(x.a.t - own) - Math.abs(y.a.t - own) : x.co.date - y.co.date || x.ai - y.ai; });
    $("pickTitle").textContent = "Vidéo de " + st.first + " " + st.last + (k ? ", course " + k : "");
    $("pickLead").textContent = own != null ? "Son temps : " + fmt(own, true) + ". Les arrivées les plus proches sont en haut. Touche la bonne." : "Touche l’arrivée qui est la sienne.";
    $("pickList").innerHTML = list.slice(0, 40).map(function (x) {
      var who = x.excluded ? "écartée" : x.owner ? x.owner.last + " " + x.owner.first : (x.a.name ? "« " + x.a.name + " », non reconnu" : "sans nom");
      var gap = own != null ? " (" + (x.a.t - own > 0 ? "+" : "−") + (Math.abs(x.a.t - own) / 1000).toFixed(1).replace(".", ",") + " s)" : "";
      return '<button type="button" class="pick-row" data-fk="' + esc(x.fk) + '">' +
        '<span class="thumb"><img alt="" data-src="' + esc(x.a.src || "") + '" data-pid="' + esc(x.a.pid || "") + '"></span>' +
        "<span><strong>" + fmt(x.a.t, true) + gap + "</strong><small>" + esc(arrivalLabel(x)) + ", actuellement : " + esc(who) + "</small></span></button>";
    }).join("") || '<p class="empty">Aucune arrivée filmée.</p>';
    $("pickList").querySelectorAll("img").forEach(function (im) {
      if (im.dataset.src) im.src = im.dataset.src; else if (im.dataset.pid) pfPhoto(im.dataset.pid).then(function (u) { if (u) im.src = u; });
    });
    $("pickDlg").showModal();
  }
  $("pickList").addEventListener("click", function (e) {
    var b = e.target.closest(".pick-row"); if (!b || !picking) return;
    fixing = b.dataset.fk; fixingRace = pickRace; $("pickDlg").close(); saveFix(picking);
  });
  $("pickClose").onclick = function () { $("pickDlg").close(); };

  /* Toutes les corrections faites à la main, chacune annulable */
  function renderFixes() {
    var box = $("fixes"); if (!box) return;
    var items = [];
    Object.keys(s.pfFix || {}).forEach(function (fk) {
      var x = arrivalsIdx[fk], raw = String(s.pfFix[fk]), v = raw.split("@")[0], rk = raw.split("@")[1], st = c.students.find(function (y) { return y.id === v; });
      items.push({ kind: "fix", key: fk, text: (x ? fmt(x.a.t, true) + ", " + arrivalLabel(x) + (x.a.name ? " (« " + x.a.name + " » dans PhotoFinish)" : "") : "Arrivée") + " : " + (v === "none" ? "écartée" : st ? "donnée à " + st.first + " " + st.last + (rk ? ", course " + rk : "") : "élève retiré de la classe") });
    });
    Object.keys(c.aliases || {}).forEach(function (k) {
      var st = c.students.find(function (y) { return y.id === c.aliases[k]; });
      items.push({ kind: "alias", key: k, text: "Nom PhotoFinish « " + k + " » : toujours " + (st ? st.first + " " + st.last : "?") });
    });
    if (!items.length) { box.innerHTML = ""; return; }
    box.innerHTML = '<details class="ctl-courses fixes-box"' + (box.dataset.open ? " open" : "") + "><summary>Mes corrections (" + items.length + ")</summary>" +
      items.map(function (it, i) { return '<div class="fix-row"><span>' + esc(it.text) + '</span><button type="button" class="btn quiet small" data-undo="' + i + '">Annuler</button></div>'; }).join("") + "</details>";
    box.querySelector("details").ontoggle = function () { box.dataset.open = this.open ? "1" : ""; };
    box.querySelectorAll("[data-undo]").forEach(function (bt) {
      bt.onclick = function () {
        var it = items[+bt.dataset.undo], hh = H.load();
        if (it.kind === "fix") { var ss = hh.sessions.find(function (x) { return x.id === s.id; }); if (ss && ss.pfFix) { delete ss.pfFix[it.key]; s.pfFix = ss.pfFix; } }
        else { var cc = H.classById(hh, c.id); if (cc && cc.aliases) delete cc.aliases[it.key]; delete c.aliases[it.key]; }
        H.save(hh); refresh();
      };
    });
  }

  function saveFix(v) {
    var hh = H.load(), ss = hh.sessions.find(function (x) { return x.id === s.id; }); if (!ss) return;
    ss.pfFix = ss.pfFix || {};
    if (v) ss.pfFix[fixing] = v === "none" || !fixingRace ? v : v + "@" + fixingRace; else delete ss.pfFix[fixing];
    if (ss.pfOk) { delete ss.pfOk[fixing]; s.pfOk = ss.pfOk; }
    H.save(hh); s.pfFix = ss.pfFix; if ($("zoom").open) $("zoom").close(); refresh();
  }
  $("zoomReset").onclick = function () { saveFix(""); };
  $("zoomClose").onclick = function () { $("zoom").close(); };
  document.querySelector(".seg").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    filter = b.dataset.f;
    document.querySelectorAll(".seg button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    render(rows);
  });

  var how = [];
  if (s.method === "chrono") how.push("temps du QR de l’élève (Chrono Carnet)");
  if (s.method === "paper") how.push("temps écrit sur la fiche");
  $("explain").textContent = "Chaque " + (how[0] || "temps relevé") + " est comparé à l’arrivée filmée avec PhotoFinish : conforme à 2 secondes près." +
    (s.method === "paper" && s.type === "ccf" ? " L’estimation écrite sur la fiche est comparée à celle annoncée et notée dans Scan CCF." : "") +
    " Les courses PhotoFinish du jour sont prises dans l’ordre : la 1re course filmée d’un élève est sa course 1. Une arrivée attribuée au mauvais élève ? Touche sa photo pour la corriger. « Importer des fichiers » accepte les courses PhotoFinish (course_….html) et la sauvegarde Scan CCF de la classe (DemiFond_….html).";

  var rows = [], sd = null;
  function refresh() { buildVideo(); rows = build(sd); render(rows); }
  Promise.all([docsState(), H.photosGet(c.students.map(function (e) { return e.id; })), loadImported()]).then(function (r) {
    sd = r[0]; photos = r[1]; classPhotos = r[1]; imported = r[2] || [];
    refresh();
  });
})();
