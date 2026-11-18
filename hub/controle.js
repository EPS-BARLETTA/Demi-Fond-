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
  function keyOf(name) { return H.norm(name).split(" ").sort().join(" "); }

  /* ---------- élèves ---------- */
  var byKey = {};
  c.students.forEach(function (e) { byKey[keyOf(e.last + " " + e.first)] = e; });

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
  var imported = [], courses = [], video = {}, unknown = [];
  function buildVideo() {
    var keys = {}; localCourses.forEach(function (co) { keys[co.key] = 1; });
    courses = localCourses.concat(imported.filter(function (co) { return !keys[co.key]; })).sort(function (x, y) { return x.date - y.date; });
    video = {}; unknown = [];
    courses.forEach(function (co, ci) {
      co.arrivals.forEach(function (a, ai) {
        if (!a.name || /^non nomm/i.test(a.name)) return;
        var e = byKey[keyOf(a.name)];
        var rec = { t: a.t, pid: a.pid, src: a.src, course: ci, rank: ai + 1, title: co.title, group: co.group };
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
    var n = 0;
    files.reduce(function (ch, f) {
      return ch.then(function () { return f.text(); }).then(function (txt) {
        var co = parsePF(txt, f.name); if (!co.arrivals.length) return;
        var cache = {};
        return co.arrivals.reduce(function (c2, a) {
          return c2.then(function () { if (!a.src) return; if (cache[a.src]) { a.src = cache[a.src]; return; } var orig = a.src; return shrink(orig).then(function (sm) { cache[orig] = sm; a.src = sm; }); });
        }, Promise.resolve()).then(function () {
          imported = imported.filter(function (x) { return x.key !== co.key || x.group !== co.group; });
          imported.push(co); n++;
        });
      }).catch(function () {});
    }, Promise.resolve()).then(function () {
      saveImported();
      $("pfStatus").textContent = n ? n + " course" + (n > 1 ? "s" : "") + " PhotoFinish importée" + (n > 1 ? "s" : "") + "." : "Aucune course reconnue : choisis les fichiers HTML exportés par PhotoFinish (course_….html).";
      refresh();
    });
  });

  /* ---------- Scan CCF (QR Chrono Carnet, estimations annoncées) ---------- */
  var scan = H.readJSON("df-scan-ccf-v2", null);
  var grp = scan && scan.groups.find(function (g) { return g.id === c.id; });
  var ex = grp && s.scanExerciseId && grp.sessions.find(function (x) { return x.id === s.scanExerciseId; });
  function scanStudent(e) {
    if (!ex) return null;
    var id = H.stdId(e.last, e.first, e.cls || c.name);
    return ex.students.find(function (x) { return x.id === id || x.externalId === id; }) ||
      ex.students.find(function (x) { return keyOf(x.last + " " + x.first) === keyOf(e.last + " " + e.first); });
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
      var vids = video[e.id] || [];
      var n = Math.max(N, vids.length);
      for (var k = 1; k <= n; k++) {
        var r = { k: k, v: vids[k - 1] || null, own: null, ownSrc: "", est: null, said: null };
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
    if (v) parts.push('<button type="button" class="thumb" data-pid="' + esc(v.pid || "") + '" data-src="' + esc(v.src || "") + '" data-txt="' + esc("Course " + r.k + " · arrivée n°" + v.rank + " · " + fmt(v.t, true)) + '" aria-label="Photo d’arrivée"><img alt=""></button>');
    var lines = [];
    if (r.own != null || v) {
      var cls = r.timeOk === true ? "ok" : r.timeOk === false ? "bad" : "";
      lines.push('<span class="' + cls + '">' + (r.ownSrc ? (r.ownSrc === "QR" ? "Élève " : "Fiche ") + fmt(r.own, true) : "") +
        (v ? (r.ownSrc ? " · " : "") + "Vidéo " + fmt(v.t, true) : "") +
        (r.delta != null ? " <b>" + (r.timeOk ? "✓" : "⚠ " + (r.delta > 0 ? "+" : "−") + (Math.abs(r.delta) / 1000).toFixed(1).replace(".", ",") + " s") + "</b>" : "") + "</span>");
    }
    if (r.est || r.said) {
      var ec = r.estOk === true ? "ok" : r.estOk === false ? "bad" : "";
      lines.push('<span class="' + ec + '">Estim. ' + (r.said ? "fiche " + esc(r.est || "—") + " · annoncée " + esc(r.said) : esc(r.est)) +
        (r.estOk != null ? " <b>" + (r.estOk ? "✓" : "⚠ différente") + "</b>" : "") + "</span>");
    }
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
    $("courses").innerHTML = (courses.length ? "<ol>" + courses.map(function (co) {
      var d = new Date(co.date);
      return "<li>" + esc(co.title || "Course") + (co.group ? ", " + esc(co.group) : "") + ", " + d.getHours() + "h" + pad(d.getMinutes()) + ", " + co.arrivals.length + " arrivées (" + esc(co.source) + ")</li>";
    }).join("") + "</ol>" : "<p>Aucune course PhotoFinish pour cette classe ce jour-là.</p>") +
      (unknown.length ? "<p><strong>Arrivées sans élève reconnu :</strong> " + unknown.map(function (u) { return esc(u.name) + " (" + fmt(u.t, true) + ")"; }).join(", ") + "</p>" : "");
    loadThumbs();
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
  $("table").addEventListener("click", function (e) {
    var b = e.target.closest(".thumb"); if (!b) return;
    var img = b.querySelector("img"); if (!img.src) return;
    $("zoomImg").src = img.src; $("zoomTxt").textContent = b.dataset.txt + " · " + b.closest("tr").querySelector(".who").textContent.trim();
    $("zoom").showModal();
  });
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
    " Les courses PhotoFinish du jour sont prises dans l’ordre : la 1re course filmée d’un élève est sa course 1. Filmé sur un autre iPad ? Importe ses fichiers HTML.";

  var rows = [], sd = null;
  function refresh() { buildVideo(); rows = build(sd); render(rows); }
  Promise.all([docsState(), H.photosGet(c.students.map(function (e) { return e.id; })), loadImported()]).then(function (r) {
    sd = r[0]; photos = r[1]; imported = r[2] || [];
    refresh();
  });
})();
