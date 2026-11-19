/* Repères de notes : ligne rouge sous 10/20, ligne verte à partir de 15/20.
   Marche pour tous les tableaux de Scan CCF qui ont une colonne « /20 » (2 × 800, 3 × 500, saisie rapide AFL)
   et pour les cartes « synthèse des notes /20 ». */
(function () {
  "use strict";
  var css = document.createElement("style");
  css.textContent =
    "tr.note-low>td{background:#fdeaea!important}tr.note-low>td:first-child{box-shadow:inset 5px 0 0 #d64545}" +
    "tr.note-high>td{background:#e5f5ea!important}tr.note-high>td:first-child{box-shadow:inset 5px 0 0 #2f9e55}" +
    "td.note-cell-low{color:#b42323!important;font-weight:900}td.note-cell-high{color:#1d7a3e!important;font-weight:900}" +
    "details.note-low{border-color:#d64545!important;background:#fdeaea!important}details.note-high{border-color:#2f9e55!important;background:#e5f5ea!important}" +
    "details.note-low>summary b{color:#b42323}details.note-high>summary b{color:#1d7a3e}";
  document.head.appendChild(css);

  function num(t) {
    var m = String(t || "").replace(/\s/g, "").match(/^(\d+(?:[.,]\d+)?)(?:\/20)?$/);
    return m ? Number(m[1].replace(",", ".")) : null;
  }
  function tone(el, n) {
    el.classList.toggle("note-low", n != null && n < 10);
    el.classList.toggle("note-high", n != null && n >= 15);
  }
  function apply() {
    document.querySelectorAll("table").forEach(function (table) {
      var heads = table.querySelectorAll("thead th, tr:first-child th"), col = -1;
      heads.forEach(function (th, i) { if (col < 0 && /\/\s*20/.test(th.textContent) && !/Points|barème/i.test(th.textContent)) col = i; });
      if (col < 0) return;
      table.querySelectorAll("tbody tr").forEach(function (tr) {
        var td = tr.querySelector(".ccf-quick-final") || tr.children[col];
        var n = td ? num(td.textContent) : null;
        tone(tr, n);
        if (td) { td.classList.toggle("note-cell-low", n != null && n < 10); td.classList.toggle("note-cell-high", n != null && n >= 15); }
      });
    });
    document.querySelectorAll("details.exam500-summary-student").forEach(function (d) {
      var b = d.querySelector("summary b");
      tone(d, b ? num(b.textContent) : null);
    });
  }
  var t = null;
  new MutationObserver(function () { clearTimeout(t); t = setTimeout(apply, 60); })
    .observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  document.addEventListener("DOMContentLoaded", apply);
})();
