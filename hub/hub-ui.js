/* Demi-fond EPS — l'application : séance guidée, classes, outils ouverts dans la même fenêtre. */
(function () {
  "use strict";
  // Une page de l'appli chargée par erreur dans un outil : on revient à l'appli.
  try { if (window.parent !== window && window.parent.EPSShell) { window.parent.EPSShell.closeTool(); return; } } catch (e) {}

  var H = window.EPSHub, P = window.EPSPrenoms;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var plural = function (n, w, ws) { return n + " " + (n > 1 ? (ws || w + "s") : w); };
  try { localStorage.setItem("eps-hub-role", "prof"); } catch (e) {}

  var TOOL_NAMES = { chrono: "Chrono Carnet", video: "PhotoFinish", scan: "Scan CCF", docs: "Fiches papier", page: "" };
  var METHOD_TEXT = { chrono: "les élèves chronomètrent sur iPad", paper: "les élèves notent sur fiche", video: "tu filmes l’arrivée" };
  var DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  var MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  function longDate(iso) { var p = String(iso).split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]); return DAYS[d.getDay()].replace(/^./, function (c) { return c.toUpperCase(); }) + " " + d.getDate() + " " + MONTHS[d.getMonth()]; }

  /* =========================================================
     Étapes d'une séance
  ========================================================= */
  function steps(s) {
    var T = H.TYPES[s.type], cid = encodeURIComponent(s.docsId || s.classId), tplId = s.sheet || T.sheet, tpl = tplId ? "&tpl=" + encodeURIComponent(tplId) : "";
    var sid = encodeURIComponent(s.id), graded = s.type !== "training", ex = encodeURIComponent(s.scanExerciseId || "");
    var film = { key: "film", lane: "Vidéo", tool: "video", go: "film", url: "./video/?hub=film", cta: "Ouvrir PhotoFinish", title: "Filmer les arrivées",
      you: "La classe et ses groupes sont déjà chargés dans PhotoFinish. Une course filmée par groupe : DÉPART au signal, un appui sur ARRIVÉE par élève. Ensuite, associe chaque photo d’arrivée à un élève.",
      them: s.method === "chrono" ? "Ils te disent dans quel groupe ils courent. À l’arrivée, ils viennent te montrer leur iPad pour vérifier leur temps." : "Ils te disent dans quel groupe ils courent." };
    var control = { key: "control", lane: "Contrôle", tool: "page", url: "./hub/controle/?s=" + sid, cta: "Ouvrir le contrôle", title: "Contrôler les temps",
      you: ((s.method === "paper" && s.type === "ccf" ? "L’estimation écrite sur chaque fiche est comparée à celle que l’élève t’a annoncée. " : "") +
        (s.video ? "Le temps de chaque élève est comparé à son arrivée filmée, à 2 secondes près. Les écarts sont signalés, avec la photo de l’arrivée." : "")).trim() };
    var list = [];
    if (s.method === "chrono") {
      list.push({ key: "share", lane: "QR code", tool: "chrono", go: "share", plan: s.plan ? 1 : 0, url: "./chrono/?hub=share" + (s.plan ? "&plan=1" : ""), cta: "Ouvrir Chrono Carnet", title: "Donner le QR code de la séance",
        you: (s.plan ? "Chrono Carnet s’ouvre avec tes courses : " + H.planLabel(s.plan.distances) + (s.plan.split ? ", temps de passage tous les " + s.plan.split + " m" : "") + "."
          : s.type === "training" ? "Chrono Carnet s’ouvre en mode Entraînement : choisis l’outil (chrono libre, minuteur, VMA)." : "Chrono Carnet s’ouvre en mode " + T.label + ".") +
          " Vérifie la course, puis touche « Afficher le QR code » et montre-le aux élèves.",
        them: "Ils le scannent avec l’appareil photo de l’iPad, touchent leur nom dans la liste, choisissent avec qui ils courent, puis prennent leurs temps." });
      if (s.video) list.push(film);
      list.push({ key: "scan", lane: "Récupérer", tool: "scan", go: "scan", ex: s.scanExerciseId, url: "./scan/?hub=scan&ex=" + ex, cta: "Scanner les QR codes", title: "Récupérer les résultats",
        you: "À la fin, chaque élève affiche le QR code de ses résultats. Scanne-les un par un : ils arrivent dans la séance de la classe.",
        them: "Ils viennent un par un avec leur iPad ouvert sur le QR code de fin." });
      if (s.video) list.push(control);
      list.push({ key: "notes", lane: graded ? "Notes" : "Résultats", tool: "scan", go: "results", ex: s.scanExerciseId, url: "./scan/?hub=results&ex=" + ex, cta: graded ? "Voir les notes" : "Voir les résultats", title: graded ? "Voir les notes" : "Voir les résultats",
        you: graded ? "En haut, les élèves pas encore scannés et les anomalies. Touche un élève pour voir le détail et sa note." : "Temps, allures et progrès de chaque élève." });
    } else if (s.method === "paper") {
      var fiche = { cls: s.docsId || s.classId, tpl: tplId };
      list.push({ key: "print", lane: "Fiches", tool: "docs", go: "prep", cls: fiche.cls, tpl: fiche.tpl, url: "./docs/?hub=prep&class=" + cid + tpl, cta: "Préparer l’impression", title: "Imprimer les fiches",
        you: "Une fiche par élève, avec son nom et un QR code. La classe" + (T.sheet ? " et la fiche sont déjà choisies" : " est déjà choisie, choisis la fiche") + " : imprime ou télécharge le PDF." });
      if (graded) list.push({ key: "est", lane: "Estimations", tool: "docs", go: "ann", cls: fiche.cls, tpl: fiche.tpl, url: "./docs/?hub=ann&class=" + cid + tpl, cta: "Noter les estimations", title: "Noter les estimations annoncées",
        you: "Avant chaque course, chaque élève t’annonce son temps prévu : tape « 320 » pour 3:20, puis Entrée pour passer au suivant. Elles seront comparées à ce qui est écrit sur les fiches.",
        them: "Ils écrivent leur estimation sur la fiche et te l’annoncent." });
      if (s.video) list.push(film);
      list.push({ key: "photo", lane: "Photos", tool: "docs", go: "batch", cls: fiche.cls, url: "./docs/?hub=batch&class=" + cid, cta: "Photographier les fiches", title: "Photographier les fiches remplies",
        you: "Prends chaque fiche en entier, à plat, les quatre carrés visibles. Elles sont lues toutes seules ; celles qui posent question restent à vérifier." });
      list.push({ key: "notes", lane: graded ? "Contrôle et notes" : "Résultats", tool: "docs", go: "control", cls: fiche.cls, tpl: fiche.tpl, url: "./docs/?hub=control&class=" + cid + tpl,
        cta: graded ? "Contrôler et noter" : "Voir les résultats", title: graded ? "Contrôler les fiches et noter" : "Voir les résultats",
        you: (graded ? "Les résultats des fiches s’ouvrent avec le contrôle : sont signalées les estimations différentes de celles annoncées" + (s.video ? " et les temps à plus de 2 s de PhotoFinish, avec la photo d’arrivée" : "")
            : "Les temps lus sur les fiches, course par course" + (s.video ? ", comparés à PhotoFinish : un écart de plus de 2 s est signalé avec la photo d’arrivée" : "")) +
          (graded ? ". Pour chaque alerte, garde la fiche ou prends la bonne valeur, puis exporte les notes." : ". Pour chaque alerte, garde la fiche ou prends la valeur de PhotoFinish.") +
          (s.video ? " Les courses filmées sur cet iPad sont ajoutées toutes seules ; pour un autre iPad, « Importer PhotoFinish » avec les fichiers HTML exportés." : "") });
    } else {
      list.push(film);
      list.push({ key: "notes", lane: "Classement", tool: "video", url: "./video/", cta: "Ouvrir PhotoFinish", title: "Classement et fiche résultats",
        you: "Chaque course reste dans l’historique de PhotoFinish : classement, photos d’arrivée et fiche à imprimer." });
    }
    return list;
  }
  function nextIndex(s, list) { var i = list.findIndex(function (st) { return !s.done[st.key]; }); return i < 0 ? list.length - 1 : i; }
  function lanes(list, s, sel, clickable) {
    var tag = clickable ? "button" : "div";
    return list.map(function (st, i) {
      var done = s && s.done[st.key];
      return "<li><" + tag + (clickable ? ' type="button" data-i="' + i + '"' : "") + ' class="lane' + (done ? " done" : "") + '"' + (i === sel ? ' aria-current="step"' : "") + ">" +
        '<span class="n">' + (i + 1) + (done ? '<span class="tick" aria-label="fait">✓</span>' : "") + '</span><span class="l">' + esc(st.lane) + "</span></" + tag + "></li>";
    }).join("");
  }

  /* =========================================================
     Navigation
  ========================================================= */
  var tab = "seance", sel = null;
  var frames = {}, current = { tool: null, step: null };
  function route() {
    var h = (location.hash || "#seance").slice(1);
    if (h === "outil" && current.tool) return;
    if (current.tool) hideTool();
    tab = ["seance", "classes", "outils"].indexOf(h) >= 0 ? h : "seance";
    document.querySelectorAll(".tabs a").forEach(function (a) { a.setAttribute("aria-current", a.dataset.tab === tab ? "page" : "false"); });
    ["seance", "classes", "outils"].forEach(function (v) { $("v-" + v).hidden = v !== tab; });
    render();
  }
  window.addEventListener("hashchange", route);
  function render() {
    if (tab === "seance") renderSeance();
    else if (tab === "classes") renderClasses();
    else renderOutils();
  }

  /* =========================================================
     Vue Séance
  ========================================================= */
  function standalone() { return window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches; }
  function installHint() {
    if (standalone()) return "";
    return '<div class="install"><span class="ic" aria-hidden="true">📲</span><div><strong>Installe l’appli sur l’écran d’accueil de l’iPad</strong>' +
      "<p>Dans Safari, touche Partager puis « Sur l’écran d’accueil ». L’appli s’ouvre alors en plein écran et garde ses données à part de tes autres sites.</p></div></div>";
  }
  function renderSeance() {
    var h = H.load(), s = H.current(h), v = $("v-seance");
    if (!s) {
      var past = h.sessions.filter(function (x) { return x.closed || x.id !== h.currentId; }).slice(0, 40);
      if (!h.classes.length) {
        v.innerHTML = '<div class="welcome"><h1>Bienvenue</h1><p>Demi-fond EPS réunit Chrono Carnet, PhotoFinish, Scan CCF et les fiches papier. Tu crées ta classe une fois, puis chaque séance se déroule étape par étape, jusqu’à la note.</p>' +
          '<ol class="track">' +
          '<li><div class="lane"><span class="n">1</span><span class="l"><strong>Ta classe</strong><br>Liste PRONOTE et trombinoscope, une seule fois.</span></div></li>' +
          '<li><div class="lane"><span class="n">2</span><span class="l"><strong>Ta séance</strong><br>L’épreuve et qui prend les temps : trois questions.</span></div></li>' +
          '<li><div class="lane"><span class="n">3</span><span class="l"><strong>Les étapes</strong><br>Chaque outil s’ouvre au bon endroit, jusqu’aux notes.</span></div></li></ol>' +
          '<button type="button" class="btn cta" id="firstClass">Ajouter ma première classe</button></div>' + installHint();
        $("firstClass").onclick = function () { openClass(null, true); };
        return;
      }
      var unsaved = past.filter(function (x) { return !x.savedAt; });
      var byClass = {};
      past.forEach(function (x) { (byClass[x.classId] = byClass[x.classId] || []).push(x); });
      v.innerHTML = (unsaved.length ? '<div class="notice warn remind"><div><h3>' + plural(unsaved.length, "séance pas encore enregistrée", "séances pas encore enregistrées") + " sur l’iPad</h3>" +
          "<p>Enregistre-les pour garder une copie de leurs résultats et de leurs photos, puis libère la mémoire de l’appli.</p></div>" +
          '<button type="button" class="btn solid small" data-end="' + esc(unsaved[0].id) + '">Enregistrer la plus récente</button></div>' : "") +
        '<div class="view-head"><div><h1>Prêt pour une séance ?</h1><p>Choisis la classe, l’épreuve et qui prend les temps. Les étapes s’affichent ensuite dans l’ordre.</p></div>' +
        '<button type="button" class="btn cta" id="newSess">Nouvelle séance</button></div>' +
        (past.length ? '<h2 class="section-title">Séances précédentes</h2>' + sortClasses(h.classes.filter(function (c) { return byClass[c.id]; })).map(function (c) {
          return '<p class="past-class">' + esc(c.name) + '</p><div class="past">' + byClass[c.id].map(function (x) {
            var tag = x.savedAt ? '<span class="saved-tag ok">Enregistrée' + (x.freedAt ? ", mémoire libérée" : "") + "</span>" : '<span class="saved-tag todo">À enregistrer</span>';
            return '<div class="past-row"><span><strong>' + esc(H.typeLabel(x)) + "</strong>" + tag +
              "<small>" + esc(longDate(x.date)) + ", " + esc(METHOD_TEXT[x.method]) + '</small></span><span class="past-actions">' +
              (x.freedAt ? "" : '<button type="button" class="btn quiet small" data-end="' + esc(x.id) + '">' + (x.savedAt ? "Enregistrer à nouveau" : "Enregistrer") + "</button>") +
              '<button type="button" class="btn line small" data-open="' + esc(x.id) + '">Rouvrir</button></span></div>';
          }).join("") + "</div>";
        }).join("") : "") + installHint();
      $("newSess").onclick = openWizard;
      v.querySelectorAll("[data-open]").forEach(function (b) {
        b.onclick = function () {
          var hh = H.load(), x = hh.sessions.find(function (y) { return y.id === b.dataset.open; });
          if (!x) return; delete x.closed; hh.currentId = x.id; H.save(hh); sel = null; renderSeance(); window.scrollTo(0, 0);
        };
      });
      v.querySelectorAll("[data-end]").forEach(function (b) { b.onclick = function () { openEnd(b.dataset.end, false); }; });
      return;
    }
    var c = H.classById(h, s.classId) || { name: "Classe retirée", students: [] };
    var list = steps(s);
    if (sel == null || sel >= list.length) sel = nextIndex(s, list);
    var st = list[sel], done = !!s.done[st.key], last = sel === list.length - 1;
    v.innerHTML = '<div class="sess-head"><div><p class="date">' + esc(longDate(s.date)) + "</p><h1>" + esc(c.name) + "</h1>" +
      '<p class="what">' + esc(H.typeLabel(s)) + ", " + esc(METHOD_TEXT[s.method]) + (s.video && s.method !== "video" ? ", arrivée filmée" : "") + ".</p></div>" +
      '<button type="button" class="btn line small" id="endSess">Terminer la séance</button></div>' +
      '<ol class="track" aria-label="Étapes de la séance">' + lanes(list, s, sel, true) + "</ol>" +
      '<article class="stepcard"><p class="where">Étape ' + (sel + 1) + " sur " + list.length + "</p><h2>" + esc(st.title) + "</h2>" +
      '<div class="roles"><div><h3>Toi</h3><p>' + esc(st.you) + "</p></div>" + (st.them ? "<div><h3>Les élèves</h3><p>" + esc(st.them) + "</p></div>" : "") + "</div>" +
      '<div class="actions"><button type="button" class="btn cta" id="openStep">' + esc(st.cta) + "</button>" +
      (done ? '<span class="done-note">Étape faite</span>' + (last ? "" : '<button type="button" class="btn line" id="nextStep">Étape suivante</button>')
        : '<button type="button" class="btn line" id="doneStep">' + (last ? "C’est fait" : "C’est fait, étape suivante") + "</button>") +
      "</div></article>";
    v.querySelectorAll(".track .lane").forEach(function (b) { b.onclick = function () { sel = +b.dataset.i; renderSeance(); }; });
    $("openStep").onclick = function () { openStep(sel); };
    if ($("doneStep")) $("doneStep").onclick = function () { markDone(st.key); sel = Math.min(sel + 1, list.length - 1); renderSeance(); };
    if ($("nextStep")) $("nextStep").onclick = function () { sel++; renderSeance(); };
    $("endSess").onclick = function () { openEnd(s.id, true); };
  }
  function markDone(k) { var hh = H.load(), ss = H.current(hh); if (ss && !ss.done[k]) { ss.done[k] = Date.now(); H.save(hh); } }

  /* =========================================================
     Outils dans la même fenêtre
  ========================================================= */
  function openStep(i) {
    var s = H.current(); if (!s) return;
    var list = steps(s), st = list[i];
    openTool(st.tool, st.url, { kicker: "Étape " + (i + 1) + " sur " + list.length, title: st.title, step: i, total: list.length,
      order: st.go ? { go: st.go, ex: st.ex, cls: st.cls, tpl: st.tpl, plan: st.plan } : null, back: "Séance" });
  }
  function openTool(k, url, opt) {
    opt = opt || {};
    var box = $("frames"), f = frames[k];
    if (k === "page" || !f) {
      if (f) f.remove();
      f = document.createElement("iframe");
      f.title = opt.title || TOOL_NAMES[k] || "Outil";
      f.setAttribute("allow", "camera; microphone; fullscreen; autoplay; clipboard-read; clipboard-write; display-capture");
      f.setAttribute("allowfullscreen", "");
      f.src = url;
      box.appendChild(f);
      frames[k] = f;
    } else if (opt.order) {
      try { f.contentWindow.postMessage(Object.assign({ type: "eps-route" }, opt.order), location.origin); } catch (e) { f.src = url; }
    }
    Object.keys(frames).forEach(function (x) { frames[x].hidden = x !== k; });
    current = { tool: k, step: opt.step };
    $("homeBar").hidden = true; $("toolBar").hidden = false;
    $("toolBackLabel").textContent = opt.back || "Accueil";
    $("toolKicker").textContent = opt.kicker || "";
    $("toolTitle").textContent = opt.title || TOOL_NAMES[k];
    var s = H.current(), list = s ? steps(s) : [];
    $("toolNext").hidden = opt.step == null;
    $("toolNext").textContent = opt.step != null && opt.step >= opt.total - 1 ? "Terminer" : "Étape suivante";
    $("toolDots").innerHTML = opt.step == null || !s ? "" : list.map(function (x, j) { return '<i class="' + (j === opt.step ? "on" : s.done[x.key] ? "done" : "") + '"></i>'; }).join("");
    box.hidden = false; document.body.classList.add("in-tool");
    if (location.hash !== "#outil") history.pushState(null, "", "#outil");
  }
  function hideTool() {
    $("frames").hidden = true; document.body.classList.remove("in-tool");
    $("homeBar").hidden = false; $("toolBar").hidden = true;
    // Les pages simples sont rechargées à chaque fois ; les outils restent ouverts en arrière-plan (course en cours, caméra…).
    if (frames.page) { frames.page.remove(); delete frames.page; }
    current = { tool: null, step: null };
  }
  function closeTool() {
    var back = current.step != null ? "#seance" : "#" + tab;
    hideTool();
    if (location.hash === "#outil") history.replaceState(null, "", back);
    route();
  }
  $("toolBack").onclick = closeTool;
  $("toolNext").onclick = function () {
    var s = H.current();
    if (s && current.step != null) { var list = steps(s); markDone(list[current.step].key); sel = Math.min(current.step + 1, list.length - 1); }
    tab = "seance"; closeTool();
  };
  window.EPSShell = { closeTool: closeTool };

  /* =========================================================
     Nouvelle séance
  ========================================================= */
  var pane = 0;
  function sortClasses(list) { return list.slice().sort(function (a, b) { return a.name.localeCompare(b.name, "fr", { numeric: true }); }); }
  function openWizard() {
    var h = H.load();
    if (!h.classes.length) return openClass(null, true);
    $("wizForm").reset(); pane = 0; $("wizPlanText").value = ""; $("wizPlanSplit").value = ""; sheetKey = ""; $("wizSheetList").innerHTML = "";
    H.docsSheets().then(function (l) { ownSheets = l; if (!$("wizSheet").hidden) renderSheets(wizData()); });
    $("wizClasses").innerHTML = sortClasses(h.classes).map(function (c) {
      return '<label><input type="radio" name="classId" value="' + esc(c.id) + '"' + (h.classes.length === 1 ? " checked" : "") + '><span class="opt"><strong>' + esc(c.name) + "</strong><small>" + plural(c.students.length, "élève") + "</small></span></label>";
    }).join("");
    showPane(); $("wiz").showModal();
  }
  function sheetName(d) { if (d.sheet === "plan" && d.plan) return H.planSheet(d.plan, d.sheetEst).name; var i = document.querySelector('#wizSheetList input[name=sheet]:checked'); return i ? i.dataset.name : ""; }
  function wizData() {
    var f = $("wizForm");
    var txt = $("wizPlanText").value.trim(), dist = txt ? H.parsePlan(txt) : null, split = Math.max(0, Math.round(+$("wizPlanSplit").value || 0));
    return { classId: (f.querySelector("input[name=classId]:checked") || {}).value, type: (f.querySelector("input[name=type]:checked") || {}).value,
      method: (f.querySelector("input[name=method]:checked") || {}).value, video: f.video.checked,
      planText: txt, plan: dist ? { distances: dist, split: split } : null,
      sheet: (f.querySelector("input[name=sheet]:checked") || {}).value, sheetEst: f.sheetEst.checked };
  }
  /* Séance libre sur fiche : choix de la fiche, aperçu de celle faite avec les courses */
  var ownSheets = [], sheetKey = "", ficheLib = null;
  function loadFiche() {
    if (ficheLib) return ficheLib;
    var add = function (src) { return new Promise(function (res, rej) { var sc = document.createElement("script"); sc.src = src; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); }); };
    ficheLib = add("./docs/lib/qrcode.js").then(function () { return add("./docs/fiche.js"); }).catch(function () { ficheLib = null; });
    return ficheLib;
  }
  function sheetLayout(d) { return d.plan && window.Fiche ? window.Fiche.layoutFor(H.planSheet(d.plan, d.sheetEst)) : null; }
  function sheetProblem(d) {
    if (d.sheet !== "plan" || !d.plan) return "";
    if (Math.max.apply(null, d.plan.distances) > 2500) return "Sur fiche, un temps s’écrit jusqu’à 9:59 : pour plus de 2500 m, prends Chrono Carnet.";
    var l = sheetLayout(d);
    return l && !l.ok ? "Trop de lignes pour une seule fiche : enlève des temps de passage ou des courses." : "";
  }
  function renderSheets(d) {
    var list = [];
    if (d.plan) list.push({ id: "plan", name: "Une fiche faite avec tes courses", desc: H.planLabel(d.plan.distances) + (d.plan.split ? ", passages tous les " + d.plan.split + " m" : "") + "." });
    list = list.concat(H.SHEET_LIB, ownSheets.map(function (x) { return { id: x.id, name: x.name, desc: "Ta fiche · " + x.desc }; }));
    var key = JSON.stringify(list), cur = d.sheet;
    if (key !== sheetKey) {
      sheetKey = key;
      if (!cur || !list.some(function (x) { return x.id === cur; })) cur = H.suggestSheet(d.plan);
      $("wizSheetList").innerHTML = list.map(function (x) {
        return '<label><input type="radio" name="sheet" value="' + esc(x.id) + '"' + (x.id === cur ? " checked" : "") + ' data-name="' + esc(x.name) + '"><span class="opt"><strong>' + esc(x.name) + "</strong><small>" + esc(x.desc) + "</small></span></label>";
      }).join("");
      d = wizData();
    }
    var mine = d.sheet === "plan";
    $("wizSheetEst").hidden = !mine;
    var pb = sheetProblem(d), sug = H.suggestSheet(d.plan);
    $("wizSheetInfo").textContent = pb || (mine ? "Une partie par course. Les temps sont cumulés : le chrono ne s’arrête pas aux passages." :
      d.sheet && sug && sug === d.sheet ? "Cette fiche correspond déjà à tes courses." : d.sheet ? "Fiche de ScanDocument, déjà prête." : "Choisis la fiche que les élèves rempliront.");
    $("wizSheetPrev").hidden = !mine;
    if (mine) {
      if (!window.Fiche) { $("wizSheetPrev").innerHTML = ""; loadFiche() && loadFiche().then(function () { if (!$("wizSheet").hidden) renderSheets(wizData()); }); }
      else {
        var t = H.planSheet(d.plan, d.sheetEst), l = window.Fiche.layoutFor(t);
        $("wizSheetPrev").innerHTML = l.ok ? window.Fiche.ficheSVG({ tpl: t, name: "NOM Prénom", className: (H.classById(H.load(), d.classId) || {}).name || "Classe", payload: window.Fiche.studentPayload("apercu", t.id), layout: l }) : "";
      }
    }
  }
  function planInfo() {
    var d = wizData();
    document.querySelectorAll("#wizPlanChips button").forEach(function (b) { b.setAttribute("aria-pressed", String(H.norm(b.dataset.plan) === H.norm(d.planText))); });
    $("wizPlanInfo").textContent = !d.planText ? "Vide : chrono libre, sans distance fixée." : d.plan ? d.plan.distances.length + " course" + (d.plan.distances.length > 1 ? "s" : "") + " : " + H.planLabel(d.plan.distances) + (d.plan.split ? ", passages tous les " + d.plan.split + " m" : ", sans temps de passage") + "." : "Je ne comprends pas cette suite. Écris par exemple « 4x100 » ou « 500 1000 500 ».";
  }
  $("wizPlanChips").addEventListener("click", function (e) { var b = e.target.closest("button[data-plan]"); if (!b) return; $("wizPlanText").value = b.dataset.plan; planInfo(); });
  $("wizPlanText").addEventListener("input", planInfo);
  $("wizPlanSplit").addEventListener("input", planInfo);
  function showPane() {
    var d = wizData();
    document.querySelectorAll("#wiz .pane").forEach(function (p) { p.hidden = +p.dataset.pane !== pane; });
    document.querySelectorAll("#wizProgress i").forEach(function (b, i) { b.className = i <= pane ? "on" : ""; });
    $("wizPrev").hidden = pane === 0; $("wizNext").hidden = pane === 3; $("wizGo").hidden = pane !== 3;
    $("wizErr").textContent = "";
    var training = d.type === "training";
    $("wizPlan").hidden = !training; if (training) planInfo();
    $("wizVideoOnly").hidden = !training;
    if (!training && d.method === "video") { $("wizForm").querySelector("input[name=method][value=video]").checked = false; d.method = undefined; }
    $("wizVideoOpt").hidden = d.method === "video";
    var paperFree = training && d.method === "paper";
    $("wizSheet").hidden = !paperFree;
    if (paperFree && pane === 2) { renderSheets(d); d = wizData(); }
    if (pane === 3) {
      var c = H.classById(H.load(), d.classId);
      var fake = { id: "x", type: d.type, method: d.method, video: d.method !== "video" && d.video, classId: d.classId, plan: d.type === "training" ? d.plan : null,
        sheet: paperFree ? (d.sheet === "plan" && d.plan ? H.planSheet(d.plan, d.sheetEst).id : d.sheet) : null, sheetName: paperFree ? sheetName(d) : "",
        scanExerciseId: d.method === "chrono" ? "x" : null, done: {} };
      var list = steps(fake);
      $("recapTitle").textContent = c.name + ", " + H.typeLabel(fake);
      $("recapLead").textContent = "Voici les " + list.length + " étapes. Chacune ouvre le bon outil, déjà réglé pour cette classe.";
      $("recapTrack").innerHTML = lanes(list, null, -1, false);
      $("recapList").innerHTML = list.map(function (st) { return "<li><strong>" + esc(st.title) + "</strong></li>"; }).join("");
    }
  }
  $("wizForm").addEventListener("change", function () { if (pane >= 1) showPane(); });
  $("wizNext").onclick = function () {
    var d = wizData();
    if (pane === 0 && !d.classId) { $("wizErr").textContent = "Choisis une classe."; return; }
    if (pane === 1 && !d.type) { $("wizErr").textContent = "Choisis l’épreuve."; return; }
    if (pane === 1 && d.type === "training" && d.planText && !d.plan) { $("wizErr").textContent = "Écris les courses comme « 4x100 » ou « 500 1000 500 », ou laisse vide pour un chrono libre."; return; }
    if (pane === 2 && !d.method) { $("wizErr").textContent = "Choisis qui prend les temps."; return; }
    if (pane === 2 && d.type === "training" && d.method === "paper") {
      if (!d.sheet) { $("wizErr").textContent = "Choisis la fiche que les élèves rempliront."; return; }
      var pb = sheetProblem(d); if (pb) { $("wizErr").textContent = pb; return; }
    }
    pane++; showPane();
  };
  $("wizPrev").onclick = function () { pane = Math.max(0, pane - 1); showPane(); };
  $("wizCancel").onclick = function () { $("wiz").close(); };
  $("wizForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var d = wizData(), h = H.load(), c = H.classById(h, d.classId);
    var go = function () {
      var hh = H.load(), cc = H.classById(hh, d.classId);
      H.syncClass(cc).then(function () {
        H.startSession(hh, { classId: d.classId, type: d.type, method: d.method, video: d.video && d.method !== "video", plan: d.type === "training" ? d.plan : null,
          sheet: d.type === "training" && d.method === "paper" ? d.sheet : null, sheetEst: d.sheetEst, sheetName: sheetName(d) });
        $("wiz").close(); sel = null;
        if (location.hash !== "#seance") location.hash = "#seance"; else route();
      }).catch(function (err) { $("wizErr").textContent = err.message; });
    };
    var missing = c.students.filter(function (x) { return !x.sex; });
    if (missing.length && d.type !== "training") {
      $("wiz").close();
      askSex(missing.map(function (x) { return { ref: x, last: x.last, first: x.first, sex: "" }; }), "Pour la note, il faut savoir si l’élève est une fille ou un garçon.", function (answers) {
        var hh = H.load(), cc = H.classById(hh, c.id);
        answers.forEach(function (a) { var e2 = cc.students.find(function (x) { return x.id === a.ref.id; }); if (e2) e2.sex = a.sex; });
        H.save(hh); go();
      });
      return;
    }
    go();
  });

  /* =========================================================
     Vue Classes
  ========================================================= */
  function renderClasses() {
    var h = H.load(), v = $("v-classes");
    v.innerHTML = '<div class="view-head"><div><h1>Classes</h1><p>Chaque classe est créée une seule fois. Elle est aussitôt disponible dans Chrono Carnet, PhotoFinish, Scan CCF et les fiches papier.</p></div>' +
      '<button type="button" class="btn solid" id="addClass">Ajouter une classe</button></div>' +
      '<div class="class-grid">' + sortClasses(h.classes).map(function (c) {
        var nf = c.students.filter(function (x) { return x.sex === "F"; }).length, ng = c.students.filter(function (x) { return x.sex === "M"; }).length;
        var miss = c.students.length - nf - ng;
        return '<button type="button" class="class-card" data-id="' + esc(c.id) + '"><h3>' + esc(c.name) + '</h3><div class="faces" data-faces="' + esc(c.id) + '"></div>' +
          '<span class="meta">' + plural(c.students.length, "élève") + ", " + nf + " F, " + ng + " G" + (miss ? ", <strong>" + miss + " à compléter</strong>" : "") +
          (function () { var n = h.sessions.filter(function (x) { return x.classId === c.id; }).length; return n ? "<br>" + plural(n, "séance") : ""; })() + "</span></button>";
      }).join("") + '<button type="button" class="class-card add" id="addClass2">Ajouter une classe</button></div><div id="foundZone"></div>';
    $("addClass").onclick = $("addClass2").onclick = function () { openClass(null); };
    v.querySelectorAll(".class-card[data-id]").forEach(function (b) { b.onclick = function () { openClass(b.dataset.id); }; });
    h.classes.forEach(function (c) {
      H.photosGet(c.students.map(function (x) { return x.id; })).then(function (ph) {
        var box = v.querySelector('[data-faces="' + c.id + '"]'); if (!box) return;
        var withPh = c.students.filter(function (x) { return ph[x.id]; }).slice(0, 7);
        box.innerHTML = withPh.map(function (x) { return '<img src="' + ph[x.id] + '" alt="">'; }).join("") +
          (c.students.length > withPh.length ? "<span>+" + (c.students.length - withPh.length) + "</span>" : "");
      });
    });
    renderFound(h);
  }
  function renderFound(h) {
    var show = function (list) {
      var zone = $("foundZone"); if (!zone) return;
      if (!list.length) { zone.innerHTML = ""; return; }
      zone.innerHTML = '<div class="found"><p><strong>Classes trouvées dans les outils.</strong> Ajoute-les ici pour les retrouver partout.</p>' +
        list.map(function (f, i) { return '<button type="button" class="btn line small" data-i="' + i + '">' + esc(f.name) + " (" + plural(f.students.length, "élève") + ", " + esc(f.source) + ")</button>"; }).join("") + "</div>";
      zone.querySelectorAll("button[data-i]").forEach(function (b) {
        b.onclick = function () {
          var f = list[+b.dataset.i], hh = H.load();
          f.students.forEach(function (x) { if (!x.sex) { var g = P.guess(x.first); if (g.sure) x.sex = g.sex; } });
          var c = H.upsertClass(hh, f.name, f.students, null, f.id); H.save(hh);
          H.syncClass(c).then(renderClasses);
        };
      });
    };
    var fromTools = H.foundInTools(h); show(fromTools);
    H.foundInDocs(h).then(function (more) {
      var names = {}; fromTools.forEach(function (f) { names[H.norm(f.name)] = 1; });
      show(fromTools.concat(more.filter(function (f) { return !names[H.norm(f.name)]; })));
    });
  }

  /* ---------- édition d'une classe ---------- */
  var editing = null, draft = [], thenWizard = false;
  var key = function (last, first) { return H.norm(last + " " + first).split(" ").sort().join(" "); };
  function findDraft(last, first, pool) {
    var k = key(last, first);
    var hit = (pool || draft).filter(function (d) { return key(d.last, d.first) === k; });
    return hit.length === 1 ? hit[0] : null;
  }
  function fillSex(d) { if (!d.sex) { var g = P.guess(d.first); if (g.sure) d.sex = g.sex; } }
  function mergeList(list) {
    var added = 0;
    list.forEach(function (s) {
      var d = findDraft(s.last, s.first);
      if (d) { if (s.sex) d.sex = s.sex; if (s.cls && !d.cls) d.cls = s.cls; }
      else { d = { last: s.last, first: s.first, sex: s.sex || "", cls: s.cls || "", photo: null }; draft.push(d); added++; }
      fillSex(d);
    });
    return added;
  }
  function renderRoster() {
    draft.sort(function (a, b) { return (a.last + " " + a.first).localeCompare(b.last + " " + b.first, "fr"); });
    var np = draft.filter(function (d) { return d.photo; }).length, ns = draft.filter(function (d) { return !d.sex; }).length;
    $("cdCount").textContent = draft.length ? plural(draft.length, "élève") + ", " + np + " avec photo" + (ns ? ", " + ns + " sans fille ou garçon" : "") : "Aucun élève pour l’instant";
    $("cdRoster").innerHTML = draft.map(function (d, i) {
      return '<div class="srow' + (d.check ? " check" : "") + (!d.sex ? " nosex" : "") + '" data-i="' + i + '">' +
        (d.photo ? '<img src="' + d.photo + '" alt="">' : '<span class="nophoto" aria-hidden="true">' + esc((d.first || "?")[0] || "?") + "</span>") +
        '<input class="nm" value="' + esc(H.fullName(d)) + '" aria-label="Nom et prénom" placeholder="NOM Prénom">' +
        '<span class="sx" role="group" aria-label="Fille ou garçon">' +
          '<button type="button" data-sx="F" aria-pressed="' + (d.sex === "F") + '">F</button>' +
          '<button type="button" data-sx="M" aria-pressed="' + (d.sex === "M") + '">G</button></span>' +
        '<button type="button" class="del" aria-label="Retirer cet élève">✕</button></div>';
    }).join("");
  }
  $("cdRoster").addEventListener("click", function (e) {
    var row = e.target.closest(".srow"); if (!row) return;
    var d = draft[+row.dataset.i];
    if (e.target.dataset.sx) { d.sex = d.sex === e.target.dataset.sx ? "" : e.target.dataset.sx; renderRoster(); }
    else if (e.target.classList.contains("del")) { draft.splice(+row.dataset.i, 1); renderRoster(); }
  });
  $("cdRoster").addEventListener("change", function (e) {
    if (!e.target.classList.contains("nm")) return;
    var d = draft[+e.target.closest(".srow").dataset.i], sp = H.splitName(e.target.value.trim());
    d.last = sp.last.toUpperCase(); d.first = sp.first; d.check = false; fillSex(d); renderRoster();
  });
  $("cdAddOne").onclick = function () {
    var v = prompt("NOM Prénom de l’élève :"); if (!v || !v.trim()) return;
    var sp = H.splitName(v.trim()); if (!sp.first) return alert("Écris le nom puis le prénom.");
    mergeList([{ last: sp.last.toUpperCase(), first: sp.first }]); renderRoster();
  };
  function status(t) { $("cdStatus").textContent = t || ""; }
  function openClass(id, afterWizard) {
    var h = H.load(), c = id ? H.classById(h, id) : null;
    editing = c ? c.id : null; thenWizard = !!afterWizard;
    draft = c ? c.students.map(function (s) { return { id: s.id, last: s.last, first: s.first, sex: s.sex, cls: s.cls, photo: null }; }) : [];
    $("cdTitle").textContent = c ? c.name : "Ajouter une classe";
    $("cdName").value = c ? c.name : "";
    $("cdDelete").hidden = !c;
    $("cdErr").textContent = ""; $("cdFile").value = ""; $("cdTrombi").value = ""; $("cdText").value = ""; status("");
    renderRoster();
    $("classDlg").showModal();
    if (c) H.photosGet(c.students.map(function (s) { return s.id; })).then(function (ph) {
      draft.forEach(function (d) { if (d.id && ph[d.id]) d.photo = ph[d.id]; }); renderRoster();
    });
  }
  $("cdPasteBtn").onclick = function () {
    try { var n = mergeList(H.readRoster($("cdText").value)); $("cdText").value = ""; status(plural(n, "élève ajouté", "élèves ajoutés") + "."); renderRoster(); }
    catch (err) { status(err.message); }
  };
  $("cdFile").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    f.arrayBuffer().then(function (buf) {
      var text = new TextDecoder("utf-8").decode(buf);
      if (text.indexOf("�") >= 0) text = new TextDecoder("windows-1252").decode(buf);
      var list;
      try { list = H.readRoster(text.replace(/^﻿/, "")); } catch (err) { status(err.message); return; }
      var names = []; list.forEach(function (s) { if (s.cls && names.indexOf(s.cls) < 0) names.push(s.cls); });
      if (names.length > 1 && !editing && !draft.length && confirm("Ce fichier contient " + names.length + " classes : " + names.join(", ") + ".\n\nOK : une classe par classe PRONOTE\nAnnuler : un seul groupe avec tout le monde")) {
        list.forEach(function (x) { if (!x.sex) { var g = P.guess(x.first); if (g.sure) x.sex = g.sex; } });
        var h = H.load(), made = names.map(function (n) { return H.upsertClass(h, n, list.filter(function (s) { return s.cls === n; })); });
        H.save(h);
        Promise.all(made.map(H.syncClass)).then(function () { $("classDlg").close(); render(); });
        return;
      }
      if (!$("cdName").value.trim() && names.length) $("cdName").value = names.join("-");
      var n = mergeList(list);
      status("Liste PRONOTE : " + plural(list.length, "élève") + (n < list.length ? " (" + (list.length - n) + " déjà présents)" : "") + ".");
      renderRoster();
    });
    e.target.value = "";
  });

  /* ---------- trombinoscope : vérification photo par photo ---------- */
  var tilesPending = null;
  function readable(name) {
    var t = String(name || "").replace(/[^\p{L}\s'’-]/gu, " ").replace(/\s+/g, " ").trim();
    var words = t.split(" ").filter(function (w) { return w.replace(/[^\p{L}]/gu, "").length >= 2; });
    return words.length >= 2 ? words.join(" ") : "";
  }
  $("cdTrombi").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    if (!window.EPSTrombi) { status("Lecture du trombinoscope indisponible."); return; }
    status("Découpage des photos…");
    var tiles;
    window.EPSTrombi.tiles(f).then(function (t) {
      tiles = t;
      return window.EPSTrombi.read(tiles, function (i) { status("Lecture des noms : " + i + " sur " + tiles.length + "…"); }).catch(function () {});
    }).then(function () {
      status(plural(tiles.length, "photo trouvée", "photos trouvées") + ".");
      openPhotos(tiles);
    }).catch(function (err) { status(err.message || "Capture non lue."); });
    e.target.value = "";
  });
  function openPhotos(tiles) {
    var roster = draft.filter(function (d) { return d.last && d.first; });
    var used = {};
    // 1. par le nom lu sous la photo
    tiles.forEach(function (t) {
      t.read = readable(t.name); t.pick = ""; t.how = "";
      if (!t.read || !roster.length) return;
      var sp = H.splitName(t.read), d = findDraft(sp.last, sp.first, roster);
      var i = d ? roster.indexOf(d) : -1;
      if (i >= 0 && !used[i]) { used[i] = 1; t.pick = String(i); t.how = "name"; }
    });
    // 2. le trombinoscope PRONOTE suit l'ordre alphabétique : les photos restantes suivent la liste
    var freeStudents = roster.map(function (d, i) { return i; }).filter(function (i) { return !used[i]; });
    var freeTiles = tiles.filter(function (t) { return !t.pick; });
    var sameCount = freeTiles.length === freeStudents.length;
    if (roster.length && freeTiles.length) {
      freeTiles.forEach(function (t, j) { if (j < freeStudents.length) { t.pick = String(freeStudents[j]); t.how = "order"; } });
    }
    tilesPending = { tiles: tiles, roster: roster };
    var byName = tiles.filter(function (t) { return t.how === "name"; }).length, byOrder = tiles.filter(function (t) { return t.how === "order"; }).length;
    var unread = tiles.filter(function (t) { return !t.read; }).length;
    $("photoLead").textContent = roster.length
      ? plural(tiles.length, "photo") + " : " + byName + " reconnue" + (byName > 1 ? "s" : "") + " par le nom" +
        (byOrder ? ", " + byOrder + " placée" + (byOrder > 1 ? "s" : "") + " dans l’ordre alphabétique de ta liste (en orange : vérifie le visage)" : "") +
        ". Change l’élève sous une photo si besoin." +
        (byOrder && !sameCount ? " Attention : il n’y a pas autant de photos que d’élèves dans la liste, un décalage est possible." : "")
      : (unread ? "Les noms sous les photos n’ont pas pu être lus. " : "") + "Écris le nom et le prénom sous chaque photo. Plus rapide : annule, importe d’abord la liste PRONOTE, puis le trombinoscope : les photos s’y rattachent toutes seules.";
    var opts = '<option value="">Aucun élève</option>' + roster.map(function (d, i) { return '<option value="' + i + '">' + esc(H.fullName(d)) + "</option>"; }).join("") + '<option value="new">Nouvel élève…</option>';
    $("photoGrid").innerHTML = tiles.map(function (t, i) {
      return '<div class="pcard ' + (t.how === "order" ? "auto" : t.how === "name" ? "ok" : "") + '" data-i="' + i + '"><img src="' + t.photo + '" alt="">' +
        (roster.length ? '<select aria-label="Élève de la photo ' + (i + 1) + '">' + opts + "</select>" : "") +
        '<input placeholder="NOM Prénom" value="' + esc(t.read) + '" aria-label="Nom de l’élève photo ' + (i + 1) + '">' +
        (t.read && t.how !== "name" && roster.length ? "<small>Lu : " + esc(t.read) + "</small>" : "") + "</div>";
    }).join("");
    $("photoGrid").querySelectorAll(".pcard").forEach(function (card) {
      var t = tiles[+card.dataset.i], s = card.querySelector("select"), inp = card.querySelector("input");
      if (s) {
        s.value = t.pick || (t.read ? "new" : "");
        inp.hidden = s.value !== "new";
        s.onchange = function () { inp.hidden = s.value !== "new"; card.classList.remove("auto"); };
      }
    });
    $("photoErr").textContent = "";
    $("photoDlg").showModal();
  }
  $("photoCancel").onclick = function () { $("photoDlg").close(); tilesPending = null; };
  $("photoOk").onclick = function () {
    if (!tilesPending) return;
    var tiles = tilesPending.tiles, roster = tilesPending.roster, seen = {}, adds = [], err = "";
    $("photoGrid").querySelectorAll(".pcard").forEach(function (card) {
      var t = tiles[+card.dataset.i], s = card.querySelector("select"), inp = card.querySelector("input");
      var v = s ? s.value : "new";
      if (v === "") return;
      if (v === "new") {
        var raw = inp.value.trim(); if (!raw) return;
        var sp = H.splitName(raw);
        if (!sp.first) { err = "Sous chaque nouvelle photo, écris le NOM puis le prénom."; return; }
        adds.push({ last: sp.last.toUpperCase(), first: sp.first, photo: t.photo });
        return;
      }
      if (seen[v]) { err = H.fullName(roster[+v]) + " est choisi(e) pour deux photos."; return; }
      seen[v] = 1; roster[+v].photo = t.photo; roster[+v].check = false;
    });
    if (err) { $("photoErr").textContent = err; return; }
    adds.forEach(function (a) {
      var d = findDraft(a.last, a.first);
      if (d) d.photo = a.photo; else { d = { last: a.last, first: a.first, sex: "", cls: "", photo: a.photo }; draft.push(d); }
      fillSex(d);
    });
    $("photoDlg").close(); tilesPending = null;
    var np = draft.filter(function (d) { return d.photo; }).length;
    status(plural(np, "élève") + " avec photo. Les élèves sans photo restent dans la liste.");
    renderRoster();
  };

  /* ---------- fille ou garçon : on demande quand le prénom ne suffit pas ---------- */
  var sexCb = null, sexItems = [];
  function askSex(items, lead, cb) {
    sexItems = items; sexCb = cb;
    $("sexLead").textContent = lead || "Pour ces prénoms, je ne peux pas deviner : touche la bonne réponse.";
    $("sexErr").textContent = "";
    var photos = {};
    var draw = function () {
      $("sexList").innerHTML = items.map(function (it, i) {
        var g = P.guess(it.first), ph = it.photo || (it.ref && photos[it.ref.id]);
        return '<div class="ask-row" data-i="' + i + '">' + (ph ? '<img class="face" src="' + ph + '" alt="">' : '<span class="face nophoto">' + esc((it.first || "?")[0]) + "</span>") +
          "<span><strong>" + esc(it.last) + "</strong> " + esc(it.first) + (g.hint ? "<small>Prénom souvent " + (g.hint === "F" ? "féminin" : "masculin") + ", à confirmer</small>" : "<small>Prénom mixte ou peu courant</small>") + "</span>" +
          '<span class="sx"><button type="button" data-sx="F" aria-pressed="' + (it.sex === "F") + '">Fille</button><button type="button" data-sx="M" aria-pressed="' + (it.sex === "M") + '">Garçon</button></span></div>';
      }).join("");
    };
    draw();
    var ids = items.filter(function (x) { return x.ref && x.ref.id && !x.photo; }).map(function (x) { return x.ref.id; });
    if (ids.length) H.photosGet(ids).then(function (p) { photos = p; draw(); });
    $("sexDlg").showModal();
  }
  $("sexList").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-sx]"); if (!b) return;
    var row = b.closest(".ask-row"), it = sexItems[+row.dataset.i];
    it.sex = b.dataset.sx;
    row.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
  });
  $("sexDone").onclick = function () {
    var left = sexItems.filter(function (x) { return !x.sex; }).length;
    if (left) { $("sexErr").textContent = "Il reste " + plural(left, "élève") + " à compléter."; return; }
    $("sexDlg").close(); var cb = sexCb; sexCb = null; if (cb) cb(sexItems);
  };
  $("sexLater").onclick = function () { $("sexDlg").close(); sexCb = null; };

  $("cdCancel").onclick = function () { $("classDlg").close(); };
  $("cdDelete").onclick = function () {
    var h = H.load(), c = H.classById(h, editing); if (!c) return;
    if (!confirm("Retirer « " + c.name + " » de l’appli ?\n\nLes résultats déjà enregistrés dans les outils ne sont pas effacés.")) return;
    h.classes = h.classes.filter(function (x) { return x.id !== editing; });
    H.save(h); $("classDlg").close(); render();
  };
  function saveClass() {
    var name = $("cdName").value.trim();
    var list = draft.filter(function (d) { return d.last && d.first; });
    var h = H.load();
    var c = H.upsertClass(h, name, list, editing);
    H.save(h);
    var photos = {};
    c.students.forEach(function (s) { var d = list.find(function (x) { return (x.id && x.id === s.id) || key(x.last, x.first) === key(s.last, s.first); }); if (d && H.validPhoto(d.photo)) photos[s.id] = d.photo; });
    H.photosPut(photos).then(function () { return H.syncClass(c); }).then(function () {
      if ($("classDlg").open) $("classDlg").close();
      render();
      if (thenWizard) openWizard();
    });
  }
  $("classForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("cdName").value.trim();
    if (!name) { $("cdErr").textContent = "Donne un nom à la classe."; return; }
    var list = draft.filter(function (d) { return d.last && d.first; });
    if (!list.length) { $("cdErr").textContent = "Ajoute les élèves : liste PRONOTE, trombinoscope ou liste collée."; return; }
    var h = H.load();
    if (!editing && h.classes.some(function (x) { return H.norm(x.name) === H.norm(name); })) { $("cdErr").textContent = "Cette classe existe déjà."; return; }
    var missing = list.filter(function (d) { return !d.sex; });
    if (missing.length) {
      askSex(missing.map(function (d) { return { ref: d, last: d.last, first: d.first, sex: "", photo: d.photo }; }),
        plural(missing.length, "prénom") + (missing.length > 1 ? " ne permettent" : " ne permet") + " pas de savoir si c’est une fille ou un garçon. Le barème en dépend : touche la bonne réponse.",
        function (answers) { answers.forEach(function (a) { a.ref.sex = a.sex; }); renderRoster(); saveClass(); });
      return;
    }
    saveClass();
  });

  /* =========================================================
     Terminer : enregistrer la séance sur l'iPad, puis libérer la mémoire
  ========================================================= */
  var ending = null;
  function openEnd(id, closing) {
    ending = { id: id, closing: closing };
    var h = H.load(), x = h.sessions.find(function (y) { return y.id === id; }), c = x && H.classById(h, x.classId);
    if (!x) return;
    $("endDlg").querySelector("h2").textContent = closing ? "Terminer la séance" : "Enregistrer la séance";
    $("endLead").textContent = (c ? c.name + ", " : "") + H.typeLabel(x) + ", " + longDate(x.date) + ".";
    $("endOk").hidden = !closing; $("endCancel").textContent = closing ? "Revenir à la séance" : "Fermer";
    $("endErr").textContent = ""; $("endFreed").textContent = x.freedAt ? "Mémoire libérée." : "";
    $("endSaved").textContent = x.savedAt ? "Enregistrée le " + new Date(x.savedAt).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) + (x.savedName ? " (" + x.savedName + ")" : "") + "." : "";
    $("endSave").textContent = x.savedAt ? "Enregistrer à nouveau" : "Enregistrer la séance";
    $("endSave").disabled = !!x.freedAt;
    if (x.freedAt) $("endSaved").textContent += " Mémoire déjà libérée : pour l’enregistrer à nouveau avec ses photos, rouvre d’abord le fichier (Outils).";
    $("endFree").disabled = !x.savedAt || !!x.freedAt;
    $("endWeight").textContent = "Une fois la séance enregistrée, retire de l’appli ses photos et ses courses filmées. Les résultats et les notes restent ; le fichier enregistré permet de tout rouvrir.";
    window.EPSArchive.weight(id).then(function (w) {
      var bits = [];
      if (w.photos) bits.push(plural(w.photos, "photo d’arrivée", "photos d’arrivée") + " (" + plural(w.courses, "course filmée", "courses filmées") + ")");
      if (w.sheets) bits.push(plural(w.sheets, "photo de fiche", "photos de fiches"));
      if (w.imported) bits.push(plural(w.imported, "course PhotoFinish importée", "courses PhotoFinish importées"));
      if (bits.length) $("endWeight").textContent = "Cette séance occupe : " + bits.join(", ") + ". Une fois enregistrée, retire-les de l’appli : les résultats et les notes restent, et le fichier enregistré permet de tout rouvrir.";
      else if (!x.freedAt) { $("endWeight").textContent = "Rien de lourd à retirer pour cette séance (pas de photos ni de courses filmées)."; $("endFree").disabled = true; }
    });
    $("endDlg").showModal();
  }
  $("endSave").onclick = function () {
    if (!ending) return;
    $("endErr").textContent = ""; $("endSave").disabled = true;
    window.EPSArchive.save(ending.id).then(function (r) {
      $("endSave").disabled = false;
      if (!r) return;
      $("endSaved").textContent = "Enregistrée et vérifiée : " + r.name + " contient " + (r.parts.length ? r.parts.join(", ") : "la classe") + ".";
      if (r.warn) $("endErr").textContent = r.warn;
      $("endSave").textContent = "Enregistrer à nouveau";
      var x = H.load().sessions.find(function (y) { return y.id === ending.id; });
      $("endFree").disabled = !!(x && x.freedAt) || /Rien de lourd/.test($("endWeight").textContent);
    }).catch(function (err) { $("endSave").disabled = false; $("endErr").textContent = err.message; });
  };
  $("endFree").onclick = function () {
    if (!ending) return;
    if (!confirm("Retirer de l’appli les photos et les courses filmées de cette séance ?\n\nVérifie que le fichier est bien dans Fichiers : c’est lui qui permettra de les rouvrir.")) return;
    window.EPSArchive.free(ending.id).then(function () {
      $("endFreed").textContent = "Mémoire libérée. Pour revoir les photos : Outils, « Rouvrir une séance enregistrée ».";
      $("endFree").disabled = true;
    }).catch(function (err) { $("endErr").textContent = err.message; });
  };
  $("endCancel").onclick = function () { $("endDlg").close(); if (!ending.closing) renderSeance(); };
  $("endOk").onclick = function () {
    var hh = H.load(), ss = hh.sessions.find(function (y) { return y.id === ending.id; });
    if (ss && !ss.savedAt && !confirm("La séance n’est pas enregistrée sur l’iPad. La terminer quand même ?\nTu pourras l’enregistrer plus tard depuis les séances précédentes.")) return;
    if (ss) { ss.closed = Date.now(); if (hh.currentId === ss.id) hh.currentId = null; H.save(hh); }
    $("endDlg").close(); sel = null; renderSeance();
  };

  /* =========================================================
     Vue Outils
  ========================================================= */
  function storageUsage() {
    var total = 0, groups = {};
    var label = function (k) {
      if (/^df-scan-ccf/.test(k)) return "Scan CCF";
      if (/^cc_/.test(k)) return "PhotoFinish";
      if (/^chronoCarnetEPS/.test(k)) return "Chrono Carnet";
      if (/^eps-hub/.test(k)) return "Demi-fond EPS";
      return "Autres applis de cette adresse";
    };
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i), n = (k.length + (localStorage.getItem(k) || "").length) * 2;
        total += n; groups[label(k)] = (groups[label(k)] || 0) + n;
      }
    } catch (e) {}
    return { total: total, groups: groups };
  }
  function mo(n) { return (n / 1048576).toFixed(n > 1048576 ? 1 : 2).replace(".", ",") + " Mo"; }
  function tile(k, ic, name, txt) { return '<button type="button" class="tool-tile" data-tool="' + k + '"><span class="ic" aria-hidden="true">' + ic + "</span><span><strong>" + name + "</strong><small>" + txt + "</small></span></button>"; }
  function renderOutils() {
    var v = $("v-outils"), u = storageUsage(), max = 5 * 1048576, pct = Math.min(100, Math.round(u.total / max * 100));
    var shared = /github\.io$/.test(location.hostname) && !standalone();
    v.innerHTML = '<div class="view-head"><div><h1>Outils</h1><p>Chaque outil reste utilisable seul, en dehors d’une séance.</p></div></div>' +
      '<div class="tool-grid">' +
      tile("chrono", "⏱️", "Chrono Carnet", "Chronométrer, partager la séance aux élèves") +
      tile("video", "🎥", "PhotoFinish", "Filmer l’arrivée, photo de chaque passage") +
      tile("scan", "📷", "Scan CCF", "Classes, scan des QR codes, résultats et notes") +
      tile("docs", "📝", "Fiches papier", "Fiches à bulles, lecture des photos, barèmes") +
      '<button type="button" class="tool-tile" id="qrBtn"><span class="ic" aria-hidden="true">🏃</span><span><strong>Espace élève</strong><small>QR code à montrer aux élèves : Chrono Carnet et leur carnet de suivi</small></span></button>' +
      '<label class="tool-tile filebtn"><span class="ic" aria-hidden="true">📂</span><span><strong>Rouvrir une séance enregistrée</strong><small>Choisis le fichier « Demi-fond_… .html » dans Fichiers</small></span><input type="file" id="reopenFile" accept=".html,.htm,text/html"></label>' +
      "</div>" +
      '<h2 class="section-title">Mémoire de l’iPad</h2>' +
      '<div class="notice' + (pct > 85 || shared ? " warn" : "") + '"><h3>' + mo(u.total) + " utilisés sur environ 5 Mo</h3>" +
      '<div class="meter' + (pct > 85 ? " full" : "") + '"><i style="width:' + pct + '%"></i></div>' +
      '<ul class="usage">' + Object.keys(u.groups).sort(function (a, b) { return u.groups[b] - u.groups[a]; }).map(function (g) { return "<li><span>" + esc(g) + "</span><span>" + mo(u.groups[g]) + "</span></li>"; }).join("") + "</ul>" +
      (shared ? "<p><strong>Dans Safari, cette adresse partage ses 5 Mo avec toutes tes applis GitHub.</strong> Installe Demi-fond EPS sur l’écran d’accueil (Partager, puis « Sur l’écran d’accueil ») : l’appli installée a sa propre mémoire.</p>" : "") +
      '<p class="muted">Les copies de secours de Scan CCF sont rangées à part et ne comptent pas ici.</p><p class="muted" id="diskUse"></p>' +
      "<p>Pour faire de la place : à la fin de chaque séance, « Terminer la séance », enregistre-la sur l’iPad puis libère sa mémoire.</p></div>";
    v.querySelectorAll("[data-tool]").forEach(function (b) {
      b.onclick = function () { openTool(b.dataset.tool, "./" + b.dataset.tool + "/", { title: TOOL_NAMES[b.dataset.tool], back: "Outils" }); };
    });
    $("qrBtn").onclick = showStudentQR;
    $("reopenFile").onchange = function (e) {
      var f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
      window.EPSArchive.readFile(f).then(window.EPSArchive.restore).then(function (r) {
        var msg = "Séance rouverte : " + r.klass + "\n\n" + (r.parts.length ? r.parts.join("\n") : "La classe seulement.");
        if (r.missing && r.missing.length) msg += "\n\nAttention, pas retrouvés dans l’appli : " + r.missing.join(", ") + ". Réessaie de rouvrir le fichier.";
        else msg += "\n\nTout ce que contient le fichier est bien revenu dans l’appli.";
        if (r.noScan) msg += "\n\nCe fichier ne contient pas les résultats des élèves (QR de fin) : il a été enregistré avant une correction de l’appli. Si Scan CCF les a encore sur cet iPad, le contrôle les retrouve. Sinon, dans le contrôle, « Importer des fichiers » et choisis la sauvegarde Scan CCF de la classe (DemiFond_….html).";
        alert(msg);
        sel = null; location.hash = "#seance";
      }).catch(function (err) { alert(err.message); });
    };
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(function (est) {
      var el = $("diskUse"); if (!el || !est.usage) return;
      el.textContent = "Avec les photos (élèves, arrivées, fiches), l’appli occupe " + mo(est.usage) + " sur l’iPad.";
    });
  }
  function showStudentQR() {
    var box = $("qrBox"), url = new URL("./eleve/", location.href).href;
    box.innerHTML = ""; $("qrUrl").textContent = url;
    var size = Math.min(window.innerWidth - 100, window.innerHeight - 300, 420);
    if (window.QRCode) new QRCode(box, { text: url, width: size, height: size, correctLevel: QRCode.CorrectLevel.M });
    $("qrDialog").showModal();
  }
  $("qrClose").onclick = function () { $("qrDialog").close(); };

  /* =========================================================
     Démarrage
  ========================================================= */
  if (location.hash === "#outil") history.replaceState(null, "", "#seance");
  route();
  H.syncAll().catch(function () {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" }).catch(function () {});
  }
})();
