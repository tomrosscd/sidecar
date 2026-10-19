// Sets data-cui-theme from the browser's colour scheme and follows changes.
// Loaded from the head as a file (Manifest V3 forbids inline scripts).
;(function () {
  var query = window.matchMedia('(prefers-color-scheme: dark)')
  function apply() {
    document.documentElement.setAttribute('data-cui-theme', query.matches ? 'dark' : 'light')
  }
  apply()
  query.addEventListener('change', apply)
})()
