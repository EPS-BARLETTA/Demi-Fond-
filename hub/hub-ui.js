/* Demi-fond EPS — accueil : classes, séance guidée, étapes. */
(function () {
  "use strict";
  var H = window.EPSHub;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var plural = function (n, w) { return n + " " + w + (n > 1 ? "s" : ""); };
  try { localStorage.setItem("eps-hub-role", "prof"); } catch (e) {}

  /* ---------- étapes d'une séance ---------- */
  function steps(s) {
    var T = H.TYPES[s.type], cid = encodeURIComponent(s.docsId || s.classId), tpl = T.sheet ? "&tpl=" + T.sheet : "";
    var film = { key: "film", icon: "🎥", title: "Filmer l’arrivée", text: "PhotoFinish s’ouvre sur la classe de la séance. Un appui sur ARRIVÉE par élève.", href: "./video/?hub=film" };
    var list = [];
    if (s.method === "chrono") {
      list.push({ key: "share", icon: "⏱️", title: "Projeter le QR code de la séance",
        text: "Chrono Carnet s’ouvre en mode " + T.label + ". Règle la course puis « Afficher le QR code ». Les élèves le scannent et choisissent leur nom dans la liste.", href: "./chrono/?hub=share" });
      if (s.video) list.push(film);
      list.push({ key: "scan", icon: "📷", title: "Récupérer les résultats",
        text: "À la fin de chaque course, scanne le QR code affiché sur l’iPad de chaque élève. Tout arrive dans cette séance.", href: "./scan/?hub=scan&ex=" + encodeURIComponent(s.scanExerciseId) });
      list.push({ key: "notes", icon: "🎯", title: s.type === "training" ? "Voir les résultats" : "Voir les notes",
        text: s.type === "training" ? "Temps, allures et progrès de chaque élève." : "Élèves manquants, anomalies, puis la note de chaque élève.", href: "./scan/?hub=results&ex=" + encodeURIComponent(s.scanExerciseId) });
    } else if (s.method === "paper") {
      list.push({ key: "print", icon: "🖨️", title: "Imprimer les fiches",
        text: "Une fiche par élève, avec son nom et son QR code. Classe" + (T.sheet ? " et fiche déjà choisies." : " déjà choisie : choisis la fiche."), href: "./docs/?hub=prep&class=" + cid + tpl });
      if (s.video) list.push(film);
      list.push({ key: "photo", icon: "📷", title: "Photographier les fiches remplies",
        text: "Fiche entière, à plat. Elles sont lues et rangées automatiquement, les doutes restent à vérifier.", href: "./docs/?hub=batch&class=" + cid });
      list.push({ key: "notes", icon: "🎯", title: s.type === "training" ? "Voir les résultats" : "Voir les notes",
        text: "Vérifie les fiches signalées, valide, puis exporte les notes.", href: "./docs/?hub=results&class=" + cid + tpl });
    } else {
      list.push(film);
      list.push({ key: "notes", icon: "🏁", title: "Classement et fiche résultats",
        text: "Dans PhotoFinish, la course est gardée dans l’historique : classement, photos d’arrivée, fiche à imprimer.", href: "./video/" });
    }
    return list;
  }

  /* ---------- rendu ---------- */
  function renderSession() {
    var h = H.load(), s = H.current(h), zone = $("sessionZone");
    if (!s) {
      zone.innerHTML = '<button type="button" class="start" id="startBtn"><span class="ico" aria-hidden="true">▶</span><span><strong>Nouvelle séance</strong><small>Choisis la classe et l’épreuve : les étapes s’enchaînent ensuite toutes seules.</small></span></button>';
      $("startBtn").onclick = openNew;
      return;
    }
    var c = H.classById(h, s.classId) || { name: "Classe supprimée", students: [] };
    var list = steps(s);
    var next = list.findIndex(function (st) { return !s.done[st.key]; });
    zone.innerHTML = '<div class="session"><div class="session-head"><div><span class="kicker">Séance en cours · ' + esc(H.dayLabel(s.date)) + '</span>' +
      '<h2>' + esc(c.name) + ' · ' + esc(H.TYPES[s.type].label) + '</h2><p>' + esc(H.METHODS[s.method].short) + (s.video && s.method !== "video" ? " + vidéo" : "") + " · " + plural(c.students.length, "élève") + '</p></div>' +
      '<button type="button" class="ghost small" id="endBtn">Terminer</button></div><ol class="steps">' +
      list.map(function (st, i) {
        var done = !!s.done[st.key], isNext = i === next;
        return '<li class="step' + (done ? " done" : "") + (isNext ? " next" : "") + '"><span class="dot" aria-hidden="true">' + (done ? "✓" : i + 1) + '</span>' +
          '<div class="step-body"><strong>' + esc(st.title) + '</strong><p>' + esc(st.text) + '</p></div>' +
          '<a class="go' + (isNext ? " primary" : "") + '" href="' + esc(st.href) + '" data-key="' + st.key + '">' + (done ? "Rouvrir" : "Ouvrir") + ' <span aria-hidden="true">→</span></a></li>';
      }).join("") + "</ol></div>";
    zone.querySelectorAll("a.go").forEach(function (a) {
      a.addEventListener("click", function () {
        var hh = H.load(), ss = H.current(hh); if (!ss) return;
        ss.done[a.dataset.key] = Date.now(); H.save(hh);
      });
    });
    $("endBtn").onclick = function () {
      var hh = H.load(), ss = H.current(hh);
      if (ss) { ss.closed = Date.now(); hh.currentId = null; H.save(hh); }
      render();
    };
  }

  function renderClasses() {
    var h = H.load(), box = $("classList");
    box.innerHTML = h.classes.length ? h.classes.slice().sort(function (a, b) { return a.name.localeCompare(b.name, "fr", { numeric: true }); }).map(function (c) {
      return '<button type="button" class="chip" data-id="' + esc(c.id) + '"><strong>' + esc(c.name) + '</strong><small>' + plural(c.students.length, "élève") + "</small></button>";
    }).join("") : '<p class="empty">Aucune classe pour l’instant. Commence par « + Ajouter une classe » avec ta liste PRONOTE.</p>';
    box.querySelectorAll(".chip").forEach(function (b) { b.onclick = function () { openClass(b.dataset.id); }; });
    renderFound(h);
  }

  function renderFound(h) {
    var zone = $("foundZone");
    var show = function (list) {
      if (!list.length) { zone.innerHTML = ""; return; }
      zone.innerHTML = '<div class="found"><strong>Classes déjà présentes dans les outils</strong><p class="hint">Ajoute-les ici pour les retrouver partout.</p>' +
        list.map(function (f, i) { return '<button type="button" class="chip add" data-i="' + i + '"><strong>+ ' + esc(f.name) + '</strong><small>' + plural(f.students.length, "élève") + " · " + esc(f.source) + "</small></button>"; }).join("") + "</div>";
      zone.querySelectorAll(".chip.add").forEach(function (b) {
        b.onclick = function () {
          var f = list[+b.dataset.i], hh = H.load();
          var c = H.upsertClass(hh, f.name, f.students, null, f.id); H.save(hh);
          H.syncClass(c).then(render);
        };
      });
    };
    var fromTools = H.foundInTools(h);
    show(fromTools);
    H.foundInDocs(h).then(function (more) {
      var names = {}; fromTools.forEach(function (f) { names[H.norm(f.name)] = 1; });
      show(fromTools.concat(more.filter(function (f) { return !names[H.norm(f.name)]; })));
    });
  }

  function renderPast() {
    var h = H.load(), past = h.sessions.filter(function (s) { return s.id !== h.currentId || s.closed; }).slice(0, 6);
    $("pastZone").hidden = !past.length;
    $("pastList").innerHTML = past.map(function (s) {
      var c = H.classById(h, s.classId);
      return '<button type="button" class="past-row" data-id="' + esc(s.id) + '"><span><strong>' + esc(c ? c.name : "Classe supprimée") + " · " + esc(H.TYPES[s.type].label) + '</strong><small>' + esc(H.dayLabel(s.date)) + " · " + esc(H.METHODS[s.method].short) + '</small></span><span aria-hidden="true">Reprendre →</span></button>';
    }).join("");
    $("pastList").querySelectorAll(".past-row").forEach(function (b) {
      b.onclick = function () {
        var hh = H.load(), s = hh.sessions.find(function (x) { return x.id === b.dataset.id; });
        if (!s) return; delete s.closed; hh.currentId = s.id; H.save(hh); render(); window.scrollTo({ top: 0, behavior: "smooth" });
      };
    });
  }

  function render() { renderSession(); renderClasses(); renderPast(); }

  /* ---------- nouvelle séance ---------- */
  function openNew() {
    var h = H.load();
    if (!h.classes.length) { openClass(null, true); return; }
    $("nfClasses").innerHTML = h.classes.slice().sort(function (a, b) { return a.name.localeCompare(b.name, "fr", { numeric: true }); }).map(function (c, i) {
      return '<label><input type="radio" name="classId" value="' + esc(c.id) + '" required' + (h.classes.length === 1 ? " checked" : "") + '><span><strong>' + esc(c.name) + "</strong><small>" + plural(c.students.length, "élève") + "</small></span></label>";
    }).join("") + '<button type="button" class="link" id="nfAddClass">+ Autre classe</button>';
    $("nfAddClass").onclick = function () { $("newDlg").close(); openClass(null, true); };
    $("nfErr").textContent = "";
    syncMethod();
    $("newDlg").showModal();
  }
  function syncMethod() {
    var f = $("newForm"), type = f.type.value;
    var training = type === "training" || !type;
    $("nfVideoOnly").hidden = !training;
    if (!training && f.method.value === "video") f.querySelector('input[name=method][value=chrono]').checked = true;
    $("nfVideoOpt").hidden = f.method.value === "video";
  }
  $("newForm").addEventListener("change", syncMethod);
  $("nfCancel").onclick = function () { $("newDlg").close(); };
  $("newForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = $("newForm");
    var classId = (f.querySelector("input[name=classId]:checked") || {}).value;
    if (!classId || !f.type.value || !f.method.value) { $("nfErr").textContent = "Réponds aux trois questions."; return; }
    var h = H.load(), c = H.classById(h, classId);
    H.syncClass(c).then(function () {
      H.startSession(h, { classId: classId, type: f.type.value, method: f.method.value, video: f.video.checked && f.method.value !== "video" });
      $("newDlg").close(); f.reset(); render(); window.scrollTo({ top: 0, behavior: "smooth" });
    }).catch(function (err) { $("nfErr").textContent = err.message; });
  });

  /* ---------- classe ---------- */
  var editing = null, pending = null, thenNew = false;
  function openClass(id, afterNew) {
    var h = H.load(), c = id ? H.classById(h, id) : null;
    editing = c ? c.id : null; pending = null; thenNew = !!afterNew;
    $("cdTitle").textContent = c ? c.name : "Ajouter une classe";
    $("cdName").value = c ? c.name : "";
    $("cdText").value = c ? c.students.map(function (s) { return H.fullName(s) + (s.sex ? " " + (s.sex === "M" ? "G" : "F") : ""); }).join("\n") : "";
    $("cdDelete").hidden = !c;
    $("cdErr").textContent = ""; $("cdFile").value = "";
    preview();
    $("classDlg").showModal();
  }
  function preview() {
    var txt = $("cdText").value.trim();
    pending = null;
    if (!txt) { $("cdPreview").textContent = ""; $("cdStudents").innerHTML = ""; return; }
    try {
      pending = H.readRoster(txt);
      var classes = {}; pending.forEach(function (s) { if (s.cls) classes[s.cls] = 1; });
      var names = Object.keys(classes);
      var nf = pending.filter(function (s) { return s.sex === "F"; }).length, ng = pending.filter(function (s) { return s.sex === "M"; }).length;
      $("cdPreview").textContent = plural(pending.length, "élève") + " · " + nf + " F · " + ng + " G" + (pending.length - nf - ng ? " · " + (pending.length - nf - ng) + " sans sexe (à choisir par l’élève)" : "") + (names.length > 1 ? " · classes d’origine : " + names.join(", ") : "");
      $("cdStudents").innerHTML = pending.slice(0, 60).map(function (s) { return "<span>" + esc(H.fullName(s)) + "</span>"; }).join("");
      if (!$("cdName").value.trim() && names.length) $("cdName").value = names.join("-");
    } catch (err) { $("cdPreview").textContent = err.message; $("cdStudents").innerHTML = ""; }
  }
  $("cdText").addEventListener("input", preview);
  $("cdFile").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    f.arrayBuffer().then(function (buf) {
      var text = new TextDecoder("utf-8").decode(buf);
      if (text.indexOf("�") >= 0) text = new TextDecoder("windows-1252").decode(buf);
      $("cdText").value = text.replace(/^﻿/, "");
      preview();
      // un CSV PRONOTE peut contenir plusieurs classes
      if (pending && !editing) {
        var names = []; pending.forEach(function (s) { if (s.cls && names.indexOf(s.cls) < 0) names.push(s.cls); });
        if (names.length > 1 && confirm("Ce fichier contient " + names.length + " classes : " + names.join(", ") + ".\n\nOK = créer une classe par classe PRONOTE\nAnnuler = un seul groupe avec tout le monde")) {
          var h = H.load(), made = names.map(function (n) { return H.upsertClass(h, n, pending.filter(function (s) { return s.cls === n; })); });
          H.save(h);
          Promise.all(made.map(H.syncClass)).then(function () { $("classDlg").close(); render(); if (thenNew) openNew(); });
        }
      }
    });
  });
  $("cdCancel").onclick = function () { $("classDlg").close(); };
  $("cdDelete").onclick = function () {
    var h = H.load(), c = H.classById(h, editing); if (!c) return;
    if (!confirm("Retirer « " + c.name + " » de l’accueil ?\n\nLes résultats déjà enregistrés dans les outils ne sont pas effacés.")) return;
    h.classes = h.classes.filter(function (x) { return x.id !== editing; });
    H.save(h); $("classDlg").close(); render();
  };
  $("classForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("cdName").value.trim();
    if (!name) { $("cdErr").textContent = "Donne un nom à la classe."; return; }
    if (!pending || !pending.length) { $("cdErr").textContent = "Ajoute la liste des élèves (fichier PRONOTE ou liste collée)."; return; }
    var h = H.load();
    if (!editing && h.classes.some(function (x) { return H.norm(x.name) === H.norm(name); })) { $("cdErr").textContent = "Cette classe existe déjà."; return; }
    var c = H.upsertClass(h, name, pending, editing);
    H.save(h);
    H.syncClass(c).then(function () { $("classDlg").close(); render(); if (thenNew) openNew(); });
  });
  $("addClassBtn").onclick = function () { openClass(null); };

  /* ---------- QR espace élève ---------- */
  $("qrBtn").addEventListener("click", function () {
    var box = $("qrBox"), url = new URL("./eleve/", location.href).href;
    box.innerHTML = ""; $("qrUrl").textContent = url;
    var size = Math.min(window.innerWidth - 80, window.innerHeight - 240, 420);
    if (window.QRCode) new QRCode(box, { text: url, width: size, height: size, correctLevel: QRCode.CorrectLevel.M });
    $("qrDialog").showModal();
  });
  $("qrClose").onclick = function () { $("qrDialog").close(); };

  // retour depuis un outil (bouton « Précédent » de Safari, ou application installée)
  window.addEventListener("pageshow", render);
  render();
  // les classes de l'accueil sont recopiées à chaque ouverture (si un outil a été réinitialisé)
  H.syncAll().catch(function () {});

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" }).catch(function () {});
  }
})();
