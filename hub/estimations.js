/* Saisie rapide des estimations annoncées (2 × 800, fiches papier) → Scan CCF (project1 / project2). */
(function () {
  "use strict";
  var H = window.EPSHub, $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var params = new URLSearchParams(location.search);
  var h = H.load();
  var s = h.sessions.find(function (x) { return x.id === params.get("s"); }) || H.current(h);
  var c = s && H.classById(h, s.classId);
  if (!s || !c || !s.scanExerciseId) { $("list").innerHTML = '<p class="empty">Aucune séance 2 × 800 sur fiches en cours.</p>'; return; }
  $("kicker").textContent = c.name + " · " + H.dayLabel(s.date);
  var race = 1, photos = {};

  // « 330 », « 3.30 », « 3'30 » → « 3:30 »
  function clean(v) {
    v = String(v || "").trim().replace(/[’′'.,h]/g, ":").replace(/\s/g, "");
    if (!v) return "";
    if (/^\d{3,4}$/.test(v)) v = v.slice(0, -2) + ":" + v.slice(-2);
    var m = v.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!m || +m[2] > 59) return null;
    return +m[1] + ":" + String(+m[2]).padStart(2, "0");
  }
  function scanDB() { return H.readJSON("df-scan-ccf-v2", null); }
  function exercise(db) {
    var g = db && db.groups.find(function (x) { return x.id === c.id; });
    return g && g.sessions.find(function (x) { return x.id === s.scanExerciseId; });
  }
  function studentIn(ex, e) {
    var id = H.stdId(e.last, e.first, e.cls || c.name);
    return ex.students.find(function (x) { return x.id === id || x.externalId === id; }) ||
      ex.students.find(function (x) { return H.norm(x.last + " " + x.first) === H.norm(e.last + " " + e.first); });
  }
  function save(e, value) {
    var db = scanDB(), ex = exercise(db);
    if (!ex) return false;
    var st = studentIn(ex, e);
    if (!st) {
      var id = H.stdId(e.last, e.first, e.cls || c.name);
      st = { id: id, externalId: id, last: e.last, first: e.first, classroom: String(e.cls || c.name).toUpperCase(), sex: e.sex || "", project1: "", project2: "", races: {}, afl2: "", afl3: "" };
      ex.students.push(st);
    }
    st["project" + race] = value;
    return H.writeJSON("df-scan-ccf-v2", db);
  }
  function render() {
    var ex = exercise(scanDB()) || { students: [] }, q = H.norm($("find").value);
    $("list").innerHTML = c.students.filter(function (e) { return !q || H.norm(e.last + " " + e.first).indexOf(q) >= 0; }).map(function (e) {
      var st = studentIn(ex, e), v = st ? st["project" + race] || "" : "";
      return '<label class="est-row" data-id="' + esc(e.id) + '">' +
        (photos[e.id] ? '<img src="' + photos[e.id] + '" alt="">' : '<span class="nophoto">' + esc(e.first[0] || "?") + "</span>") +
        '<span class="nm"><strong>' + esc(e.last) + "</strong> " + esc(e.first) + '</span>' +
        '<input inputmode="decimal" autocomplete="off" placeholder="m:ss" value="' + esc(v) + '" aria-label="Estimation ' + esc(e.last + " " + e.first) + '">' +
        '<span class="ok" aria-hidden="true">' + (v ? "✓" : "") + "</span></label>";
    }).join("") || '<p class="empty">Aucun élève.</p>';
  }
  $("list").addEventListener("change", function (ev) {
    var row = ev.target.closest(".est-row"); if (!row) return;
    var e = c.students.find(function (x) { return x.id === row.dataset.id; });
    var v = clean(ev.target.value);
    if (v === null) { ev.target.classList.add("bad"); row.querySelector(".ok").textContent = "?"; return; }
    ev.target.classList.remove("bad"); ev.target.value = v;
    save(e, v); row.querySelector(".ok").textContent = v ? "✓" : "";
  });
  $("list").addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    var inputs = [].slice.call($("list").querySelectorAll("input")), i = inputs.indexOf(ev.target);
    ev.target.blur(); if (inputs[i + 1]) inputs[i + 1].focus();
  });
  document.querySelector(".seg").addEventListener("click", function (ev) {
    var b = ev.target.closest("button"); if (!b) return;
    race = +b.dataset.r;
    document.querySelectorAll(".seg button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    render();
  });
  $("find").addEventListener("input", render);
  render();
  H.photosGet(c.students.map(function (e) { return e.id; })).then(function (p) { photos = p; render(); });
})();
