/* Chuyển ngôn ngữ: VI ở "/", EN ở "/en/". Nội dung mỗi bản do content.json dựng sẵn. */
(function () {
  var html = document.documentElement, cur = html.lang === 'en' ? 'en' : 'vi';
  var alt = { vi: html.dataset.altVi || '/', en: html.dataset.altEn || '/en/' };
  // Link cũ dạng ?lang=en vẫn đưa đúng về trang tiếng Anh
  try {
    var want = new URLSearchParams(location.search).get('lang');
    if ((want === 'en' || want === 'vi') && want !== cur) { location.replace(alt[want] + location.hash); return; }
  } catch (e) {}
  var picker = document.createElement('div');
  picker.className = 'language-switch';
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', 'Ngôn ngữ / Language');
  [['vi', 'VI', 'Tiếng Việt'], ['en', 'EN', 'English']].forEach(function (l) {
    var a = document.createElement('a');
    a.href = l[0] === cur ? '#' : alt[l[0]];
    a.lang = l[0]; a.hreflang = l[0]; a.textContent = l[1]; a.setAttribute('aria-label', l[2]);
    if (l[0] === cur) a.setAttribute('aria-current', 'true');
    a.addEventListener('click', function (e) {
      if (l[0] === cur) { e.preventDefault(); return; }
      try { localStorage.setItem('lotus-language', l[0]); } catch (err) {}
      a.href = alt[l[0]] + location.hash;
    });
    picker.appendChild(a);
  });
  var menu = document.querySelector('header .menu');
  if (menu) menu.before(picker);
})();
