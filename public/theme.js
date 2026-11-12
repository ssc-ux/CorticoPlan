// Thème mémorisé, appliqué avant l'affichage (évite un éclair de thème clair).
try {
  var t = localStorage.getItem('theme');
  if (t === 'sombre') document.documentElement.dataset.theme = 'dark';
  else if (t === 'auto') delete document.documentElement.dataset.theme;
} catch (e) {}
