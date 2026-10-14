// Apply the last theme before the first paint (no white flash in dark mode).
// A file rather than inline code, so the Content-Security-Policy can forbid inline scripts.
try {
  var t = localStorage.getItem('cop-theme');
  if (t === 'sombre' || ((!t || t === 'auto') && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.dataset.theme = 'dark';
    document.querySelector('meta[name="theme-color"]').setAttribute('content', '#141311');
  }
} catch (e) {}
