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
    var sid = encodeURIComponent(s.id), graded = s.type !== "training";
    var film = { key: "film", icon: "🎥", title: "Filmer chaque arrivée (PhotoFinish)",
      text: "PhotoFinish s’ouvre sur la classe, avec ses groupes. Une course filmée par groupe et par course ; à la fin, valide qui est qui avec la photo d’arrivée.", href: "./video/?hub=film" };
    var control = { key: "control", icon: "🔎", title: "Contrôler les temps",
      text: (s.method === "paper" && s.type === "ccf" ? "Estimations fiche ↔ annoncées, puis " : "") + "temps de l’élève ↔ arrivée filmée, à 2 s près, avec la photo de chaque arrivée.", href: "./hub/controle.html?s=" + sid };
    var list = [];
    if (s.method === "chrono") {
      list.push({ key: "share", icon: "⏱️", title: "Donner le QR code de la séance",
        text: "Chrono Carnet s’ouvre en mode " + T.label + ". Règle la course puis « Afficher le QR code ». Les élèves le scannent, touchent leur nom, choisissent avec qui ils courent, puis courent et prennent les passages.", href: "./chrono/?hub=share" });
      if (s.video) list.push(film);
      list.push({ key: "scan", icon: "📷", title: "Scanner le QR de fin de chaque élève",
        text: "Tous les résultats arrivent dans la séance de la classe, dans Scan CCF.", href: "./scan/?hub=scan&ex=" + encodeURIComponent(s.scanExerciseId) });
      if (s.video) list.push(control);
      list.push({ key: "notes", icon: "🎯", title: graded ? "Voir les notes" : "Voir les résultats",
        text: graded ? "Élèves manquants, anomalies, puis la note de chaque élève." : "Temps, allures et progrès de chaque élève.", href: "./scan/?hub=results&ex=" + encodeURIComponent(s.scanExerciseId) });
    } else if (s.method === "paper") {
      list.push({ key: "print", icon: "🖨️", title: "Imprimer les fiches",
        text: "Une fiche par élève, avec son nom et son QR code. Classe" + (T.sheet ? " et fiche déjà choisies." : " déjà choisie : choisis la fiche."), href: "./docs/?hub=prep&class=" + cid + tpl });
      if (s.type === "ccf" && s.scanExerciseId) list.push({ key: "est", icon: "🗣️", title: "Noter les estimations annoncées",
        text: "Avant chaque 800, l’élève te donne son temps prévu : tu le notes (enregistré dans Scan CCF) pour le comparer à sa fiche.", href: "./hub/estimations.html?s=" + sid });
      if (s.video) list.push(film);
      list.push({ key: "photo", icon: "📷", title: "Photographier les fiches remplies",
        text: "Fiche entière, à plat. Elles sont lues et rangées automatiquement, les doutes restent à vérifier.", href: "./docs/?hub=batch&class=" + cid });
      if (s.video || (s.type === "ccf" && s.scanExerciseId)) list.push(control);
      list.push({ key: "notes", icon: "🎯", title: graded ? "Voir les notes" : "Voir les résultats",
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

  /* ---------- classe : liste + trombinoscope ---------- */
  var editing = null, draft = [], thenNew = false;
  var key = function (last, first) { return H.norm(last + " " + first); };
  function findDraft(last, first) {
    var k = key(last, first);
    var hit = draft.filter(function (d) { return key(d.last, d.first) === k; });
    if (hit.length) return hit[0];
    // PRONOTE écrit parfois « Prénom NOM » sous les photos
    var sw = draft.filter(function (d) { return key(d.first, d.last) === k || H.norm(d.last) === H.norm(first + " " + last); });
    return sw.length === 1 ? sw[0] : null;
  }
  function mergeList(list) {
    var added = 0;
    list.forEach(function (s) {
      var d = findDraft(s.last, s.first);
      if (d) { if (s.sex && !d.sex) d.sex = s.sex; if (s.cls && !d.cls) d.cls = s.cls; }
      else { draft.push({ last: s.last, first: s.first, sex: s.sex || "", cls: s.cls || "", photo: null }); added++; }
    });
    return added;
  }
  function renderRoster() {
    draft.sort(function (a, b) { return (a.last + " " + a.first).localeCompare(b.last + " " + b.first, "fr"); });
    var np = draft.filter(function (d) { return d.photo; }).length;
    $("cdCount").textContent = draft.length ? plural(draft.length, "élève") + " · " + np + " avec photo" : "Aucun élève pour l’instant";
    $("cdRoster").innerHTML = draft.map(function (d, i) {
      return '<div class="srow' + (d.check ? " check" : "") + '" data-i="' + i + '">' +
        (d.photo ? '<img src="' + d.photo + '" alt="">' : '<span class="nophoto" aria-hidden="true">' + esc((d.first || "?")[0] || "?") + "</span>") +
        '<input class="nm" value="' + esc(H.fullName(d)) + '" aria-label="Nom et prénom">' +
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
    d.last = sp.last.toUpperCase(); d.first = sp.first; d.check = false; renderRoster();
  });
  $("cdAddOne").onclick = function () {
    var v = prompt("NOM Prénom de l’élève :"); if (!v || !v.trim()) return;
    var sp = H.splitName(v.trim()); if (!sp.first) return alert("Écris le nom puis le prénom.");
    mergeList([{ last: sp.last.toUpperCase(), first: sp.first }]); renderRoster();
  };
  function status(t) { $("cdStatus").textContent = t || ""; }

  function openClass(id, afterNew) {
    var h = H.load(), c = id ? H.classById(h, id) : null;
    editing = c ? c.id : null; thenNew = !!afterNew;
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
    try { var n = mergeList(H.readRoster($("cdText").value)); $("cdText").value = ""; status(plural(n, "élève") + " ajouté" + (n > 1 ? "s" : "") + "."); renderRoster(); }
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
      // un CSV PRONOTE peut contenir plusieurs classes
      if (names.length > 1 && !editing && !draft.length && confirm("Ce fichier contient " + names.length + " classes : " + names.join(", ") + ".\n\nOK = créer une classe par classe PRONOTE\nAnnuler = un seul groupe avec tout le monde")) {
        var h = H.load(), made = names.map(function (n) { return H.upsertClass(h, n, list.filter(function (s) { return s.cls === n; })); });
        H.save(h);
        Promise.all(made.map(H.syncClass)).then(function () { $("classDlg").close(); render(); if (thenNew) openNew(); });
        return;
      }
      if (!$("cdName").value.trim() && names.length) $("cdName").value = names.join("-");
      var n = mergeList(list);
      status("Liste PRONOTE : " + plural(list.length, "élève") + (n < list.length ? " (" + (list.length - n) + " déjà présents)" : "") + ".");
      renderRoster();
    });
  });
  $("cdTrombi").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    if (!window.EPSTrombi) return status("Lecture du trombinoscope indisponible.");
    status("Découpage des photos…");
    var tiles;
    window.EPSTrombi.tiles(f).then(function (t) {
      tiles = t;
      return window.EPSTrombi.read(tiles, function (i) { status("Lecture des noms : " + i + " / " + tiles.length + "…"); });
    }).then(function () {
      var matched = 0, added = 0;
      tiles.forEach(function (t) {
        var sp = H.splitName(String(t.name || "").trim());
        var d = sp.first ? findDraft(sp.last, sp.first) : null;
        if (d) { d.photo = t.photo; matched++; }
        else { draft.push({ last: (sp.last || "?").toUpperCase(), first: sp.first || "", sex: "", cls: "", photo: t.photo, check: true }); added++; }
      });
      var without = draft.filter(function (d) { return !d.photo; }).length;
      status(plural(tiles.length, "photo") + " lue" + (tiles.length > 1 ? "s" : "") + " · " + matched + " associée" + (matched > 1 ? "s" : "") + " à la liste" +
        (added ? " · " + added + " nouvel" + (added > 1 ? "les" : "le") + " ligne" + (added > 1 ? "s" : "") + " à vérifier (en orange)" : "") +
        (without ? " · " + plural(without, "élève") + " sans photo" : "") + ".");
      renderRoster();
    }).catch(function (err) { status(err.message || "Capture non lue."); });
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
    var list = draft.filter(function (d) { return d.last && d.first; });
    if (!list.length) { $("cdErr").textContent = "Ajoute les élèves : liste PRONOTE, trombinoscope ou liste collée."; return; }
    var h = H.load();
    if (!editing && h.classes.some(function (x) { return H.norm(x.name) === H.norm(name); })) { $("cdErr").textContent = "Cette classe existe déjà."; return; }
    var c = H.upsertClass(h, name, list, editing);
    H.save(h);
    // photos : même ordre que la liste triée → retrouvées par nom
    var photos = {};
    c.students.forEach(function (s) { var d = list.find(function (x) { return (x.id && x.id === s.id) || key(x.last, x.first) === key(s.last, s.first); }); if (d && H.validPhoto(d.photo)) photos[s.id] = d.photo; });
    H.photosPut(photos).then(function () { return H.syncClass(c); }).then(function () { $("classDlg").close(); render(); if (thenNew) openNew(); });
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
