/* Root page: send the visitor to /en/ or /es/ — saved choice first, then the browser language. */
(function () {
  var lang = null;
  try { lang = window.localStorage.getItem("acg-lang"); } catch (e) { /* storage blocked */ }
  if (lang !== "en" && lang !== "es") {
    lang = "en";
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i]).toLowerCase();
      if (code.indexOf("es") === 0) { lang = "es"; break; }
      if (code.indexOf("en") === 0) { lang = "en"; break; }
    }
  }
  window.location.replace("/" + lang + "/" + window.location.hash);
})();
