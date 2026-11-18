/* Chrono Carnet × Demi-fond EPS
   - iPad du professeur : la liste de la classe de la séance est ajoutée au QR « Partager aux élèves ».
   - iPad de l'élève : il touche son nom dans la liste au lieu de taper nom, prénom, classe et sexe.
   Chargé AVANT js/app.js (qui efface l'adresse après lecture). */
(function () {
  "use strict";
  var H = window.EPSHub;
  var STORE = "eps-hub-roster";
  var params = new URLSearchParams(location.search);

  // Côté professeur : liste de la séance en cours
  try {
    var s = H && H.current();
    var c = s && H.classById(H.load(), s.classId);
    if (c && c.students.length) window.__hubRosterParam = H.encodeRoster(c);
  } catch (e) {}

  // Côté élève : liste reçue par le QR (gardée pour toute la séance sur cet iPad)
  var roster = null;
  try {
    if (params.get("r") && H) {
      roster = H.decodeRoster(params.get("r"));
      sessionStorage.setItem(STORE, JSON.stringify(roster));
      localStorage.setItem("eps-hub-role", "eleve");
    } else {
      roster = JSON.parse(sessionStorage.getItem(STORE) || "null");
    }
  } catch (e) { roster = null; }
  if (!roster || !roster.students || !roster.students.length) return;

  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); };
  var label = function (s) { return s.last + " " + s.first; };
  var options = '<option value="">— Touche pour choisir ton nom —</option>' + roster.students.map(function (s, i) {
    return '<option value="' + i + '">' + esc(label(s)) + (s.cls && s.cls !== roster.name ? " (" + esc(s.cls) + ")" : "") + "</option>";
  }).join("") + '<option value="other">Mon nom n’est pas dans la liste</option>';

  function setVal(id, v) {
    var el = document.getElementById(id); if (!el) return;
    el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function fieldOf(id) { var el = document.getElementById(id); return el && el.closest("label"); }
  function showAll(grid) { [].forEach.call(grid.children, function (l) { l.style.display = ""; }); }
  // nom connu, sexe absent de la liste : seul le choix Fille / Garçon reste à faire
  function onlySex(grid, i) {
    grid.style.display = "grid";
    ["sharedLast", "sharedFirst", "sharedClass"].forEach(function (k) { var l = fieldOf(k + i); if (l) l.style.display = "none"; });
    var sx = fieldOf("sharedSex" + i); if (sx) sx.style.display = "";
  }
  function picker(id, onPick, title) {
    var wrap = document.createElement("label");
    wrap.className = "field";
    wrap.style.cssText = "display:block;margin:0 0 12px;font-weight:800";
    wrap.innerHTML = (title || "Ton nom") + " (" + esc(roster.name) + ')<select id="' + id + '" style="width:100%;min-height:52px;font-size:1.1rem;margin-top:6px">' + options + "</select>";
    wrap.querySelector("select").addEventListener("change", function (e) { onPick(e.target.value); });
    return wrap;
  }
  function inject() {
    var panel = document.getElementById("sharedStudentWelcome");
    if (!panel || panel.dataset.hubRoster) return;
    panel.dataset.hubRoster = "1";
    [1, 2].forEach(function (i) {
      var card = document.getElementById("sharedRunnerCard" + i);
      var grid = card && card.querySelector("div");
      if (!grid) return;
      card.insertBefore(picker("hubPick" + i, function (v) {
        var manual = v === "other" || v === "";
        grid.style.display = manual ? "grid" : "none";
        showAll(grid);
        if (manual) { ["sharedLast", "sharedFirst"].forEach(function (k) { setVal(k + i, ""); }); setVal("sharedClass" + i, roster.name); return; }
        var s = roster.students[+v];
        setVal("sharedLast" + i, s.last); setVal("sharedFirst" + i, s.first);
        setVal("sharedClass" + i, s.cls || roster.name);
        if (s.sex) { setVal("sharedSex" + i, s.sex); grid.style.display = "none"; }
        else { setVal("sharedSex" + i, ""); onlySex(grid, i); }
      }), grid);
      grid.style.display = "none";
      setVal("sharedClass" + i, roster.name);
    });
    var obs = document.getElementById("sharedObserverCard");
    var og = obs && obs.querySelector("div");
    if (og) {
      obs.insertBefore(picker("hubPickObs", function (v) {
        var manual = v === "other" || v === "";
        og.style.display = manual ? "grid" : "none";
        if (manual) return;
        var s = roster.students[+v];
        setVal("sharedObserverLast", s.last); setVal("sharedObserverFirst", s.first);
      }, "Nom de l’observateur"), og);
      og.style.display = "none";
    }
  }
  new MutationObserver(inject).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", inject);
})();
