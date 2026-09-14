// Archive loader 4/4. Same-origin static hosting required.
(() => {
  for (const n of [7, 8]) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `data/archive-${String(n).padStart(2, '0')}.part`, false);
    xhr.send(null);
    if (xhr.status !== 200 && xhr.status !== 0) throw new Error(`Archive part ${n} failed: ${xhr.status}`);
    window.OBS_ARCHIVE_B64 += xhr.responseText.trim();
  }
})();
