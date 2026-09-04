chrome.storage.local.get('sonAktarim', ({ sonAktarim }) => {
  if (!sonAktarim) return;
  const n = Object.values(sonAktarim.birimler || {}).reduce((t, s) => t + s.length, 0);
  document.getElementById('son').textContent =
    'Son aktarım: ' + sonAktarim.tip + ' / ' + (sonAktarim.donem || 'dönem okunamadı') + ' / ' + n + ' satır / '
    + new Date(sonAktarim.okumaZamani).toLocaleString('tr-TR');
});
