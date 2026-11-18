/* Demi-fond EPS — lien entre l'accueil et chaque outil.
   1. Bouton en bas à gauche : retour à la séance en cours (ou à l'espace élève).
   2. Ouverture directe au bon écran quand l'accueil le demande (?hub=…). */
(function () {
  "use strict";
  if (window.__epsHubHome) return;
  window.__epsHubHome = true;

  var path = location.pathname;
  var framed = false;
  try { framed = window.parent !== window && !!window.parent.EPSShell; } catch (e) {}
  var tool = /\/scan\//.test(path) ? "scan" : /\/video\//.test(path) ? "video" : /\/chrono\//.test(path) ? "chrono" : /\/docs\//.test(path) ? "docs" : "";
  var params = new URLSearchParams(location.search);
  // L'ordre de l'accueil est gardé quelques secondes : certains outils se rechargent une fois
  // à la première ouverture (mise en place du mode hors ligne).
  var ROUTE = "eps-hub-route", order = null;
  try {
    if (params.get("hub")) {
      order = { tool: tool, go: params.get("hub"), ex: params.get("ex"), cls: params.get("class"), tpl: params.get("tpl"), at: Date.now() };
      sessionStorage.setItem(ROUTE, JSON.stringify(order));
    } else {
      order = JSON.parse(sessionStorage.getItem(ROUTE) || "null");
      if (!order || order.tool !== tool || Date.now() - order.at > 20000) order = null;
    }
  } catch (e) { order = null; }
  var go = order && order.go;

  var role = null, hub = null, session = null, klass = null;
  try { role = localStorage.getItem("eps-hub-role"); } catch (e) {}
  try {
    hub = JSON.parse(localStorage.getItem("eps-hub-v1") || "null");
    session = hub && hub.sessions && hub.sessions.find(function (s) { return s.id === hub.currentId && !s.closed; });
    klass = session && hub.classes.find(function (c) { return c.id === session.classId; });
  } catch (e) {}

  var student = tool === "chrono" && (role === "eleve" || (role !== "prof" && /[?&](c|r)=/.test(location.search)));
  var target = student ? "../eleve/" : "../";
  var TYPE = { training: "Entraînement", ccf: "2 × 800", exam500: "3 × 500" };

  function pill() {
    if (framed || document.getElementById("epsHubHome")) return;
    var a = document.createElement("a");
    a.id = "epsHubHome";
    a.href = target;
    var text = !student && session && klass ? klass.name + " · " + (TYPE[session.type] || "") : "";
    a.setAttribute("aria-label", student ? "Retour à l’espace élève" : text ? "Retour à la séance " + text : "Retour à l’accueil Demi-fond EPS");
    a.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="flex:none"><path d="M3 11.5 12 4l9 7.5M5.5 9.8V20h4.8v-5.6h3.4V20h4.8V9.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      (text ? '<span style="font:600 13px/1 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;white-space:nowrap;max-width:46vw;overflow:hidden;text-overflow:ellipsis">' + text.replace(/[&<>]/g, "") + " · Étapes</span>" : "");
    var s = a.style;
    s.position = "fixed";
    s.left = "max(10px, env(safe-area-inset-left))";
    s.bottom = "max(10px, env(safe-area-inset-bottom))";
    s.zIndex = "2147483000";
    s.height = "40px";
    s.minWidth = "40px";
    s.padding = text ? "0 14px 0 10px" : "0";
    s.gap = "8px";
    s.display = "flex";
    s.alignItems = "center";
    s.justifyContent = "center";
    s.borderRadius = "20px";
    s.background = text ? "rgba(29,95,174,.92)" : "rgba(15,23,42,.72)";
    s.color = "#fff";
    s.boxShadow = "0 2px 10px rgba(0,0,0,.25)";
    s.textDecoration = "none";
    s.opacity = text ? "1" : ".8";
    s.webkitTapHighlightColor = "transparent";
    document.body.appendChild(a);
  }

  function toast(msg) {
    var t = document.createElement("div");
    t.textContent = msg;
    t.setAttribute("role", "status");
    t.style.cssText = "position:fixed;left:50%;top:max(14px,env(safe-area-inset-top));transform:translateX(-50%);z-index:2147483001;background:#0f172a;color:#fff;padding:12px 18px;border-radius:14px;font:600 15px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:min(92vw,560px);text-align:center";
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = "opacity .4s"; t.style.opacity = "0"; setTimeout(function () { t.remove(); }, 450); }, 4200);
  }
  function waitFor(test, cb, ms) {
    var t0 = Date.now();
    (function loop() {
      var ok = false; try { ok = test(); } catch (e) {}
      if (ok) return cb();
      if (Date.now() - t0 > (ms || 6000)) return;
      setTimeout(loop, 120);
    })();
  }
  function clean() {
    try { params.delete("hub"); params.delete("ex"); params.delete("class"); params.delete("tpl"); var q = params.toString(); history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash); } catch (e) {}
  }
  function fire(action, id) {
    var b = document.createElement("button");
    b.type = "button"; b.hidden = true; b.dataset.action = action; if (id) b.dataset.id = id;
    document.body.appendChild(b); b.click(); b.remove();
  }

  /* Fiches papier : les courses PhotoFinish filmées sur cet iPad sont ajoutées au contrôle,
     comme si leurs fiches HTML avaient été importées (même format que l'import de ScanDocument). */
  function pfSyncLocal(tid, cls) {
    try {
      if (typeof pfData !== "function" || typeof persist !== "function") return Promise.resolve(0);
      var hist = JSON.parse(localStorage.getItem("cc_history") || "[]");
      var cname = typeof className === "function" && cls ? className(cls) : "";
      var norm = function (v) { return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); };
      var pfClasses = JSON.parse(localStorage.getItem("cc_classes") || "[]");
      var pfc = pfClasses.find(function (k) { return k.id === cls; }) || pfClasses.find(function (k) { return norm(k.name) === norm(cname); });
      var list = hist.filter(function (h) { return h.meta && ((pfc && h.meta.classId === pfc.id) || (cname && norm(h.meta.cls) === norm(cname))); });
      if (!list.length) return Promise.resolve(0);
      var P = pfData(tid), pad = function (n) { return String(n).padStart(2, "0"); };
      var getPhoto = (function () {
        var dbp = null;
        return function (pid) {
          if (!pid) return Promise.resolve(null);
          dbp = dbp || new Promise(function (res, rej) { var r = indexedDB.open("chrono-eps", 1); r.onupgradeneeded = function () { r.result.createObjectStore("photos", { keyPath: "id" }); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; });
          return dbp.then(function (db) { return new Promise(function (res) { var g = db.transaction("photos").objectStore("photos").get(pid); g.onsuccess = function () { res(g.result && g.result.blob || null); }; g.onerror = function () { res(null); }; }); })
            .then(function (blob) { if (!blob) return null; return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { res(null); }; fr.readAsDataURL(blob); }); })
            .then(function (url) { return url && typeof pfShrink === "function" ? pfShrink(url) : url; }).catch(function () { return null; });
        };
      })();
      var added = 0;
      return list.reduce(function (chain, h) {
        return chain.then(function () {
          var d = new Date(h.meta.date), key = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes());
          var meta = (h.meta.cls || cname) + (h.meta.group ? ", " + h.meta.group : "") + ", " + d.getHours() + "h" + pad(d.getMinutes());
          if (P.files.some(function (f) { return f.key === key && f.meta === meta; })) return;
          var runners = h.runners || [], rows = [], photos = [], pidIndex = {}, seen = {};
          var jobs = (h.arrivals || []).reduce(function (ch, a) {
            return ch.then(function () {
              var r = runners.find(function (x) { return x.id === a.runnerId; }), name = r ? r.name : a.freeName;
              if (r) seen[r.id] = 1;
              if (!name) return;
              var row = { name: name, time: Math.round(a.t / 10) / 100, ph: null };
              rows.push(row);
              if (!a.pid) return;
              if (pidIndex[a.pid] !== undefined) { row.ph = pidIndex[a.pid]; return; }
              return getPhoto(a.pid).then(function (src) { pidIndex[a.pid] = src ? photos.push(src) - 1 : null; row.ph = pidIndex[a.pid]; });
            });
          }, Promise.resolve());
          return jobs.then(function () {
            runners.forEach(function (r) { if (!seen[r.id] && r.name) rows.push({ name: r.name, time: null, dnf: true }); });
            if (!rows.length) return;
            P.files.push({ name: "PhotoFinish (cet iPad)", title: h.meta.title || "Course", meta: meta, key: key, course: "auto", rows: rows, photos: photos });
            added++;
          });
        });
      }, Promise.resolve()).then(function () {
        if (!added) return 0;
        P.files.sort(function (a, b) { return a.key.localeCompare(b.key); });
        return Promise.resolve(persist()).then(function () { return added; });
      });
    } catch (e) { return Promise.resolve(0); }
  }

  function route(o) {
    o = o || order;
    if (!o || !o.go) return;
    go = o.go;
    var ex = o.ex, cls = o.cls, tpl = o.tpl;
    clean();
    setTimeout(function () { try { sessionStorage.removeItem(ROUTE); } catch (e) {} }, 4000);
    if (tool === "scan") {
      waitFor(function () { return typeof db !== "undefined" && db.groups && window.DFClassFlow; }, function () {
        setTimeout(function () {
          var grp = ex && db.groups.find(function (g) { return (g.sessions || []).some(function (x) { return String(x.id) === String(ex); }); });
          if (grp) fire("open-class", grp.id);
          if (go === "scan" && ex) { fire("scan-exercise", ex); toast("Scanne les QR codes des élèves : ils arrivent directement dans cette séance."); }
          else if (go === "results" && ex) { fire("exercise-results", ex); toast("Touche un élève pour voir le détail et la note."); }
          else if (go === "classes") { var c = document.querySelector('[data-flow="classes"]'); if (c) c.click(); }
        }, 250);
      });
    } else if (tool === "docs") {
      waitFor(function () { return typeof state !== "undefined" && state.templates && state.templates.length && typeof view === "function"; }, function () {
        setTimeout(function () {
          // la fenêtre « Estimations annoncées » d'une étape précédente ne reste pas ouverte par-dessus
          if (go !== "ann" && typeof annRender === "function") { try { ann = null; annRender(); } catch (e) {} }
          if (go === "prep" && typeof openEval === "function") { openEval({ classId: cls || undefined, tplId: tpl || undefined }); toast("Classe et fiche déjà choisies : imprime ou télécharge les fiches."); }
          else if (go === "batch") { view("batch"); var sel = document.getElementById("batchClass"); if (sel && cls) { sel.value = cls; if (typeof renderBatch === "function") renderBatch(); } toast("Photographie les fiches remplies : elles sont lues et rangées automatiquement."); }
          else if (go === "results" && typeof goResults === "function") { var t = tpl && state.templates.some(function (x) { return x.id === tpl; }) ? tpl : state.templates[0].id; goResults(t, cls || "*"); }
          else if (go === "classes") view("classes");
          else if (go === "ann" && typeof annOpen === "function") { annOpen(tpl || undefined, cls || undefined); }
          else if (go === "control" && typeof goResults === "function") {
            var tc = tpl && state.templates.some(function (x) { return x.id === tpl; }) ? tpl : state.templates[0].id;
            goResults(tc, cls || "*");
            pfSyncLocal(tc, cls).then(function (n) {
              if (n) { if (typeof renderResults === "function") renderResults(); toast(n + " course" + (n > 1 ? "s" : "") + " PhotoFinish de cet iPad ajoutée" + (n > 1 ? "s" : "") + " au contrôle."); }
            });
          }
        }, 200);
      });
    } else if (tool === "video") {
      waitFor(function () { return document.getElementById("cvStart"); }, function () {
        var cover = document.getElementById("cover");
        if (go === "film" && (!cover || !cover.classList.contains("hidden"))) { setTimeout(function () { document.getElementById("cvStart").click(); toast("La classe de la séance est déjà choisie. Vérifie « Qui court ? » puis ouvre la caméra."); }, 200); }
      });
    } else if (tool === "chrono") {
      if (go === "share") setTimeout(function () { toast("Règle la course, puis touche « Afficher le QR code » : la liste de la classe est jointe au QR code."); }, 600);
    }
  }

  function start() {
    if (framed) document.documentElement.classList.add("framed");
    pill(); route();
  }
  // Ordre envoyé par l'application quand l'outil est déjà ouvert : on change d'écran sans recharger.
  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== "eps-route") return;
    var o = { tool: tool, go: e.data.go, ex: e.data.ex, cls: e.data.cls, tpl: e.data.tpl, at: Date.now() };
    route(o);
  });
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
