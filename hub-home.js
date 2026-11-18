/* Bouton « Accueil » ajouté dans chaque outil de l'appli Demi-fond EPS. */
(function () {
  if (window.__epsHubHome) return;
  window.__epsHubHome = true;

  var isChrono = /\/chrono\//.test(location.pathname);
  var role = null;
  try { role = localStorage.getItem("eps-hub-role"); } catch (e) {}
  // Un élève arrivé par le QR de séance (?c=) ou depuis l'espace élève revient à l'espace élève.
  var toEleve = isChrono && (role === "eleve" || (role !== "prof" && /[?&]c=/.test(location.search)));
  var target = toEleve ? "../eleve/" : "../";

  function add() {
    if (document.getElementById("epsHubHome")) return;
    var a = document.createElement("a");
    a.id = "epsHubHome";
    a.href = target;
    a.setAttribute("aria-label", toEleve ? "Retour à l’espace élève" : "Retour à l’accueil Demi-fond EPS");
    a.title = toEleve ? "Espace élève" : "Accueil";
    a.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5M5.5 9.8V20h4.8v-5.6h3.4V20h4.8V9.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var s = a.style;
    s.position = "fixed";
    s.left = "max(10px, env(safe-area-inset-left))";
    s.bottom = "max(10px, env(safe-area-inset-bottom))";
    s.zIndex = "2147483000";
    s.width = "40px";
    s.height = "40px";
    s.display = "flex";
    s.alignItems = "center";
    s.justifyContent = "center";
    s.borderRadius = "50%";
    s.background = "rgba(15,23,42,.72)";
    s.color = "#fff";
    s.boxShadow = "0 2px 8px rgba(0,0,0,.25)";
    s.textDecoration = "none";
    s.opacity = ".8";
    s.webkitTapHighlightColor = "transparent";
    document.body.appendChild(a);
  }

  if (document.body) add();
  else document.addEventListener("DOMContentLoaded", add);
})();
