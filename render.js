/*
 * Lotus — dựng trang từ content.json
 * Dùng chung cho: trang /admin (xem trước + xuất bản) và build.cjs (dựng trên máy).
 * renderSite(content) -> { 'index.html': ..., 'en/index.html': ..., 'chinh-sach-du-lieu.html': ... }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LotusRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SITE_URL = 'https://www.lotusmigrate.com/';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // *chữ* -> in nghiêng, xuống dòng -> <br>
  function md(s, tag) {
    tag = tag || 'em';
    return esc(s).replace(/\*([^*]+)\*/g, '<' + tag + '>$1</' + tag + '>').replace(/\r?\n/g, '<br>');
  }
  function plain(s) { return String(s == null ? '' : s).replace(/\*/g, '').replace(/\r?\n/g, ' '); }
  function safeUrl(u) {
    u = String(u || '').trim();
    if (/^(https?:|mailto:|tel:|#|\.\.?\/|[a-z0-9_\-\/]+\.[a-z]+|assets\/)/i.test(u) && !/^javascript:/i.test(u)) return u;
    return '#';
  }
  function asset(rootPath, src) {
    src = String(src || '');
    if (/^https?:\/\//i.test(src)) return src;
    return rootPath + src.replace(/^\/+/, '');
  }

  function makeT(lang) {
    return function (v) {
      if (v == null) return '';
      if (typeof v === 'string') return v;
      var x = v[lang];
      return (x == null || x === '') ? (v.vi || '') : x;
    };
  }

  var UI = {
    skip: { vi: 'Đến nội dung chính', en: 'Skip to main content' },
    home: { vi: 'Lotus Global Immigration — Trang chủ', en: 'Lotus Global Immigration — Home' },
    mainNav: { vi: 'Điều hướng chính', en: 'Main navigation' },
    openMenu: { vi: 'Mở menu', en: 'Open menu' },
    exploreDest: { vi: 'Khám phá điểm đến', en: 'Explore destinations' },
    filterLabel: { vi: 'Lọc nhóm nghề', en: 'Filter career fields' },
    all: { vi: 'Tất cả', en: 'All' },
    healthcare: { vi: 'Chăm sóc sức khỏe (Healthcare)', en: 'Healthcare' },
    beauty: { vi: 'Làm đẹp', en: 'Beauty' },
    paths: { vi: 'hướng nghề nghiệp', en: 'career paths' },
    backTop: { vi: 'Về đầu trang ↑', en: 'Back to top ↑' },
    closeDialog: { vi: 'Đóng cửa sổ', en: 'Close dialog' },
    hotline: { vi: 'Hotline / Zalo:', en: 'Hotline / Zalo:' }
  };

  /* ---------- Form tư vấn 4 bước ---------- */
  function formSection(c, lang, t, R) {
    var L = function (vi, en) { return lang === 'en' ? en : vi; };
    var hot = esc(c.site.hotline), tel = esc(String(c.site.hotline).replace(/[^0-9+]/g, '')), zalo = esc(c.site.zalo || String(c.site.hotline).replace(/\D/g, ''));
    var petal = '<path class="lf-petal" d="M32 38 C24 28 24 14 32 4 C40 14 40 28 32 38 Z" transform="rotate(ROT 32 38)"></path>';
    var petals = [-50, -17, 17, 50].map(function (r) { return petal.replace('ROT', r); }).join('');
    var bloomP = '<path d="M32 38 C24 28 24 14 32 4 C40 14 40 28 32 38 Z"';
    var fields = [
      ['Chăm sóc sức khỏe (Healthcare)', 'healthcare', L('✚ HEALTHCARE', '✚ HEALTHCARE'), L('Chăm sóc sức khỏe', 'Healthcare'), L('Điều dưỡng, chăm sóc người cao tuổi, hỗ trợ y tế', 'Nursing, aged care, healthcare support')],
      ['Làm đẹp (Beauty & Wellness)', 'beauty', L('✧ BEAUTY &amp; WELLNESS', '✧ BEAUTY &amp; WELLNESS'), L('Làm đẹp &amp; spa', 'Beauty &amp; spa'), L('Chăm sóc da, spa, wellness, dịch vụ làm đẹp', 'Skincare, spa, wellness, beauty services')],
      ['Cần được định hướng', 'guide', L('❀ CHƯA CHẮC', '❀ NOT SURE YET'), L('Cần được định hướng', 'I would like guidance'), L('Lotus giúp bạn chọn ngành hợp với mình', 'Lotus helps you find the right field')]
    ];
    var firstOf = function (g) {
      var hit = c.careers.items.filter(function (x) { return x.group === g; })[0];
      if (hit) return hit.image;
      hit = c.fields.items.filter(function (x) { return (x.theme || x.key) === g; })[0];
      return hit ? hit.image : null;
    };
    var fieldImgs = { healthcare: firstOf('healthcare'), beauty: firstOf('beauty') };
    var fieldHtml = fields.map(function (f) {
      var media = f[1] === 'guide'
        ? '<span class="lf-fc-mark"><img src="' + R + 'assets/lotus-mark.png" alt=""></span>'
        : '<img src="' + esc(asset(R, fieldImgs[f[1]] && fieldImgs[f[1]].src)) + '" alt="" loading="lazy">';
      return '<label class="lf-field-card"><input type="radio" name="field" value="' + esc(f[0]) + '"><span class="lf-tick" aria-hidden="true"></span>' + media +
        '<span class="lf-fc-body"><span class="lf-fc-kicker">' + f[2] + '</span><span class="lf-fc-title">' + f[3] + '</span><span class="lf-fc-desc">' + f[4] + '</span></span></label>';
    }).join('\n');
    var destHtml = c.destinations.items.map(function (d) {
      var nm = lang === 'en' ? t(d.name) : String(t(d.name)).split('·')[0].trim();
      return '<label class="lf-dest"><input type="checkbox" name="destination" value="' + esc(d.form_value || (d.name && d.name.vi)) + '"><img src="' + esc(asset(R, (d.image || {}).src)) + '" alt="" loading="lazy"><span class="lf-tick" aria-hidden="true"></span><span class="lf-dest-name">' + esc(nm) + '</span></label>';
    }).join('\n');
    function chips(name, id, label, opts, checkedIdx) {
      return '<div class="lf-group"><p class="lf-group-label" id="' + id + '">' + label + '</p><div class="lf-chips" role="radiogroup" aria-labelledby="' + id + '">' +
        opts.map(function (o, i) {
          return '<label class="lf-chip"><input type="radio" name="' + name + '" value="' + esc(o[0]) + '"' + (i === checkedIdx ? ' checked' : '') + '><span>' + o[1] + '</span></label>';
        }).join('') + '</div></div>';
    }
    return '<section class="lf-section" id="ket-noi" aria-labelledby="lf-heading">\n<div class="lf-card">\n' +
      '<aside class="lf-side">\n<img class="lf-side-img" src="' + R + 'assets/lotus-spirit-smile.jpg" alt="' + L('Người mẫu minh họa cầm hoa sen', 'Illustrative model holding a lotus') + '" loading="lazy">\n<div class="lf-side-copy">\n' +
      '<p class="lf-eyebrow lf-eyebrow-light">' + L('TƯ VẤN HÀNH TRÌNH', 'PLAN YOUR JOURNEY') + '</p>\n' +
      '<h2 id="lf-heading">' + L('Vẽ hành trình của bạn. <em>Chỉ 4 bước chạm.</em>', 'Map out your journey. <em>Just 4 quick steps.</em>') + '</h2>\n' +
      '<ul class="lf-trust">\n<li>' + L('Chuyên viên liên hệ bạn qua Zalo hoặc điện thoại', 'An adviser contacts you via Zalo or phone') + '</li>\n<li>' + L('Thông tin chỉ dùng để tư vấn cho bạn', 'Your details are used only to advise you') + '</li>\n<li>' + L('Không hứa hẹn, chỉ lộ trình phù hợp với bạn', 'No empty promises, just a pathway that fits you') + '</li>\n</ul>\n' +
      '<p class="lf-hotline">' + L('Cần gấp? Gọi hoặc Zalo', 'In a hurry? Call or Zalo') + ' <a href="tel:' + tel + '">' + hot + '</a></p>\n</div>\n</aside>\n\n' +
      '<div class="lf-main">\n<div class="lf-top" id="lf-top">\n<div class="lf-progress">\n<svg class="lf-petals" viewBox="0 0 64 40" aria-hidden="true">' + petals + '</svg>\n' +
      '<span class="lf-count" aria-live="polite">' + L('Bước', 'Step') + ' <b id="lf-step-num">1</b> / 4</span>\n</div>\n' +
      '<ol class="lf-steps" aria-label="' + L('Các bước', 'Steps') + '">\n<li data-step-label="1" aria-current="step">' + L('Lĩnh vực', 'Field') + '</li>\n<li data-step-label="2">' + L('Điểm đến', 'Destination') + '</li>\n<li data-step-label="3">' + L('Về bạn', 'About you') + '</li>\n<li data-step-label="4">' + L('Liên hệ', 'Contact') + '</li>\n</ol>\n</div>\n\n' +
      '<form id="lotus-form" novalidate>\n' +
      '<fieldset class="lf-step" data-step="1">\n<legend class="lf-q">' + L('Bạn muốn phát triển trong <em>lĩnh vực nào?</em>', 'Which field do you <em>want to grow in?</em>') + '</legend>\n' +
      '<p class="lf-help">' + L('Chọn điều gần với bạn nhất. Chưa chắc cũng không sao, Lotus sẽ cùng bạn tìm hiểu.', 'Pick what feels closest. Not sure yet? Lotus will explore it with you.') + '</p>\n' +
      '<div class="lf-fields">\n' + fieldHtml + '\n</div>\n</fieldset>\n\n' +
      '<fieldset class="lf-step" data-step="2" hidden>\n<legend class="lf-q">' + L('Bạn muốn <em>vươn tới đâu?</em>', 'Where do you want <em>to go?</em>') + '</legend>\n' +
      '<p class="lf-help">' + L('Chọn một hoặc nhiều nơi.', 'Choose one or more.') + '</p>\n<div class="lf-dests">\n' + destHtml + '\n</div>\n' +
      '<label class="lf-undecided"><input type="checkbox" name="destination" value="Chưa quyết định" data-exclusive="true"><span>' + L('Tôi chưa quyết định', 'I have not decided yet') + '</span></label>\n</fieldset>\n\n' +
      '<fieldset class="lf-step" data-step="3" hidden>\n<legend class="lf-q">' + L('Kể Lotus nghe <em>một chút về bạn</em>', 'Tell Lotus <em>a little about you</em>') + '</legend>\n' +
      '<p class="lf-help">' + L('Không bắt buộc, nhưng giúp chuyên viên chuẩn bị tốt hơn.', 'Optional, but it helps our advisers prepare.') + '</p>\n' +
      chips('education', 'lf-edu', L('Trình độ hiện tại', 'Current education'), [['Tốt nghiệp THPT', L('Tốt nghiệp THPT', 'High school graduate')], ['Cao đẳng / Đại học', L('Cao đẳng / Đại học', 'College / University')], ['Đang đi làm', L('Đang đi làm', 'Working')]], -1) + '\n' +
      chips('language', 'lf-lang', L('Tiếng Anh', 'English level'), [['Chưa có', L('Chưa có', 'None yet')], ['Giao tiếp cơ bản', L('Giao tiếp cơ bản', 'Basic conversation')], ['IELTS 5.0–6.0', 'IELTS 5.0–6.0'], ['IELTS 6.5+', 'IELTS 6.5+']], -1) + '\n' +
      chips('timeframe', 'lf-time', L('Bạn muốn bắt đầu khi nào?', 'When would you like to start?'), [['Trong 6 tháng', L('Trong 6 tháng', 'Within 6 months')], ['6–12 tháng tới', L('6–12 tháng tới', 'In 6–12 months')], ['Sau 1 năm', L('Sau 1 năm', 'After a year')], ['Đang tìm hiểu', L('Đang tìm hiểu', 'Just exploring')]], -1) + '\n' +
      chips('for_whom', 'lf-who', L('Hồ sơ này dành cho', 'This enquiry is for'), [['Cho chính tôi', L('Chính tôi', 'Myself')], ['Cho con / người thân', L('Con / người thân', 'My child / a relative')]], 0) + '\n</fieldset>\n\n' +
      '<fieldset class="lf-step" data-step="4" hidden>\n<legend class="lf-q">' + L('Lotus nên <em>liên hệ bạn thế nào?</em>', 'How should Lotus <em>contact you?</em>') + '</legend>\n<p class="lf-summary" id="lf-summary"></p>\n<div class="lf-inputs">\n' +
      '<div class="lf-input"><label for="lf-name">' + L('Họ và tên', 'Full name') + '</label><input id="lf-name" name="name" autocomplete="name" required></div>\n' +
      '<div class="lf-input"><label for="lf-phone">' + L('Số điện thoại / Zalo', 'Phone / Zalo') + '</label><input id="lf-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required aria-describedby="lf-phone-help"><span class="lf-input-help" id="lf-phone-help">' + L('Chuyên viên sẽ nhắn Zalo cho bạn qua số này.', 'An adviser will message you on Zalo at this number.') + '</span></div>\n' +
      '<div class="lf-input lf-input-full"><label for="lf-email">Email <span class="lf-optional">' + L('(không bắt buộc)', '(optional)') + '</span></label><input id="lf-email" name="email" type="email" autocomplete="email" placeholder="' + L('ban@email.com', 'you@email.com') + '"></div>\n</div>\n' +
      '<div class="lf-hp" aria-hidden="true"><label for="lf-website">Website</label><input id="lf-website" name="website" tabindex="-1" autocomplete="off"></div>\n' +
      '<label class="lf-consent" for="lf-consent"><input id="lf-consent" name="consent" type="checkbox"><span>' +
      L('Tôi đồng ý để Lotus Global Immigration và hệ thống tư vấn OneStep thu thập, xử lý thông tin tôi cung cấp nhằm liên hệ và tư vấn, theo <a href="' + R + 'chinh-sach-du-lieu.html" target="_blank" rel="noopener">Chính sách bảo vệ dữ liệu cá nhân</a>. Tôi có thể rút lại đồng ý bất cứ lúc nào.',
        'I agree that Lotus Global Immigration and the OneStep advisory system may collect and process the information I provide to contact and advise me, in line with the <a href="' + R + 'chinh-sach-du-lieu.html" target="_blank" rel="noopener">Personal Data Protection Policy</a>. I can withdraw my consent at any time.') +
      '</span></label>\n</fieldset>\n\n<p class="lf-error" id="lf-error" role="alert" hidden></p>\n\n' +
      '<div class="lf-actions">\n<button type="button" class="lf-back" id="lf-back" hidden>' + L('← Quay lại', '← Back') + '</button>\n' +
      '<span class="lf-hint" id="lf-hint">' + L('Bạn có thể quay lại đổi lựa chọn bất cứ lúc nào', 'You can go back and change your answers at any time') + '</span>\n' +
      '<button type="button" class="lf-next" id="lf-next">' + L('Tiếp tục', 'Continue') + ' <span aria-hidden="true">→</span></button>\n' +
      '<button type="submit" class="lf-next" id="lf-submit" hidden disabled>' + L('Gửi và nhận tư vấn', 'Send and get advice') + ' <span aria-hidden="true">↗</span></button>\n</div>\n' +
      '<p class="lf-privacy" id="lf-privacy" hidden>' + L('Không spam. Không chia sẻ cho bên thứ ba.', 'No spam. Never shared with third parties.') + '</p>\n</form>\n\n' +
      '<div class="lf-thanks" id="lf-thanks" hidden tabindex="-1">\n<svg class="lf-bloom" viewBox="0 0 64 40" aria-hidden="true">' +
      bloomP + ' fill="#fe73a4" transform="rotate(-72 32 38)"></path>' + bloomP + ' fill="#fe73a4" transform="rotate(72 32 38)"></path>' + bloomP + ' fill="#e03482" transform="rotate(-38 32 38)"></path>' + bloomP + ' fill="#e03482" transform="rotate(38 32 38)"></path>' + bloomP + ' fill="#c42569"></path></svg>\n' +
      '<p class="lf-eyebrow">' + L('ĐÓA SEN ĐÃ NỞ', 'THE LOTUS HAS BLOOMED') + '</p>\n' +
      '<h3 class="lf-q" id="lf-thanks-title">' + L('Cảm ơn bạn! <em>Lotus đã nhận hành trình của bạn.</em>', 'Thank you! <em>Lotus has received your journey.</em>') + '</h3>\n' +
      '<p class="lf-code">' + L('Mã hồ sơ:', 'Reference:') + ' <b id="lf-code"></b></p>\n<p class="lf-recap" id="lf-recap"></p>\n<ol class="lf-next-steps">\n' +
      '<li><b>' + L('Chuyên viên nhắn Zalo cho bạn', 'An adviser messages you on Zalo') + '</b><span>' + L('Trong giờ làm việc, qua số', 'During business hours, at') + ' <span id="lf-masked-phone"></span></span></li>\n' +
      '<li><b>' + L('Trò chuyện để hiểu bạn', 'A conversation to understand you') + '</b><span>' + L('Mục tiêu, bằng cấp, ngân sách và kế hoạch gia đình', 'Your goals, qualifications, budget and family plans') + '</span></li>\n' +
      '<li><b>' + L('Nhận lộ trình gợi ý', 'Receive a suggested pathway') + '</b><span>' + L('Dựa trên chương trình cụ thể, không phải lời hứa chung chung', 'Based on a specific programme, not vague promises') + '</span></li>\n</ol>\n' +
      '<div class="lf-prepare"><b>' + L('Trong lúc chờ, bạn có thể chuẩn bị', 'While you wait, you can prepare') + '</b><span>' + L('Bằng cấp, bảng điểm, chứng chỉ tiếng Anh (nếu có) và vài câu hỏi bạn muốn hỏi Lotus.', 'Your qualifications, transcripts, English certificates (if any) and a few questions for Lotus.') + '</span></div>\n' +
      '<div class="lf-thanks-actions">\n<a class="lf-next" href="https://zalo.me/' + zalo + '" target="_blank" rel="noopener">' + L('Nhắn Zalo Lotus: ', 'Message Lotus on Zalo: ') + hot + ' <span aria-hidden="true">↗</span></a>\n' +
      '<a class="lf-back" href="#main">' + L('Về đầu trang', 'Back to top') + '</a>\n</div>\n' +
      '<p class="lf-disclaimer">' + L('Lotus không cam kết kết quả thị thực hay định cư. Kết quả phụ thuộc hồ sơ và quy định từng nước.', 'Lotus does not guarantee visa or immigration outcomes. Results depend on your profile and each country’s rules.') + '</p>\n</div>\n</div>\n</div>\n</section>';
  }

  /* ---------- Trang chính ---------- */
  function renderPage(c, lang) {
    var t = makeT(lang), u = function (k) { return t(UI[k]); };
    var R = lang === 'en' ? '../' : '';
    var H = function (v, tag) { return md(t(v), tag); };
    var link = function (v) { return esc(t(v)); };
    var altVi = lang === 'en' ? '../' : './', altEn = lang === 'en' ? './' : 'en/';

    var details = {};
    c.fields.items.forEach(function (f) {
      if (!f.detail) return;
      details[f.key] = { label: t(f.detail.label), title: t(f.detail.title), description: t(f.detail.description), items: (f.detail.items || []).map(t), field: f.form_field };
    });
    c.destinations.items.forEach(function (d) {
      if (!d.detail) return;
      details[d.key] = { label: t(d.detail.label), title: t(d.detail.title), description: t(d.detail.description), items: (d.detail.items || []).map(t), destination: d.key, destinationValue: d.form_value || (d.name && d.name.vi) };
    });
    var data = { lang: lang, details: details, hotline: c.site.hotline, zalo: c.site.zalo };

    var h = [];
    h.push('<!doctype html>');
    h.push('<html lang="' + lang + '" data-alt-vi="' + altVi + '" data-alt-en="' + altEn + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#702b4c">' +
      '<title>' + esc(t(c.site.title)) + '</title><meta name="description" content="' + esc(t(c.site.description)) + '">' +
      '<link rel="canonical" href="' + SITE_URL + (lang === 'en' ? 'en/' : '') + '"><link rel="alternate" hreflang="vi" href="' + SITE_URL + '"><link rel="alternate" hreflang="en" href="' + SITE_URL + 'en/">' +
      '<meta property="og:type" content="website"><meta property="og:title" content="' + esc(t(c.site.title)) + '"><meta property="og:description" content="' + esc(t(c.site.description)) + '"><meta property="og:image" content="' + esc(/^https?:/.test((c.hero.image || {}).src) ? (c.hero.image || {}).src : SITE_URL + (c.hero.image || {}).src) + '">' +
      '<link rel="icon" href="' + esc(asset(R, c.site.icon)) + '">' +
      ['style.css', 'layout-v2.css', 'layout-v3.css', 'layout-v5.css', 'languages.css', 'lotus-spirit.css', 'lotus-form.css'].map(function (f) { return '<link rel="stylesheet" href="' + R + f + '">'; }).join('') +
      '</head>');
    h.push('<body><a class="skip" href="#main">' + u('skip') + '</a>' +
      (c.announcement && c.announcement.enabled && t(c.announcement.text) ? '<div class="announce"><p>' + H(c.announcement.text) + (c.announcement.link ? ' <a href="' + esc(safeUrl(c.announcement.link)) + '">' + link(c.announcement.link_label) + ' →</a>' : '') + '</p></div>' : '') +
      '<header><a class="brand" href="#" aria-label="' + u('home') + '"><img src="' + esc(asset(R, c.site.logo)) + '" alt="Lotus Global Immigration" width="170" height="106"></a>' +
      '<nav id="nav" aria-label="' + u('mainNav') + '"><a href="#ve-lotus">' + link(c.nav.about) + '</a><a href="#linh-vuc">' + link(c.nav.fields) + '</a><a href="#nghe-nghiep">' + link(c.nav.careers) + '</a><a href="#diem-den">' + link(c.nav.destinations) + '</a><a href="#hanh-trinh">' + link(c.nav.journey) + '</a></nav>' +
      '<a class="header-cta" href="#ket-noi">' + link(c.nav.cta) + ' <span>↗</span></a><button class="menu" aria-label="' + u('openMenu') + '" aria-expanded="false" aria-controls="nav">☰</button></header>');

    var hr = c.hero;
    h.push('<main id="main"><section class="hero"><div class="hero-copy"><p class="eyebrow"><span></span> ' + link(hr.eyebrow) + '</p><h1>' + H(hr.title) + '</h1>' +
      '<p class="hero-description">' + link(hr.description) + '</p><a class="button" href="#linh-vuc">' + link(hr.button) + ' <span>↗</span></a>' +
      '<div class="hero-bottom"><p>' + esc(t(hr.badge)).replace(' &amp; ', ' <span> &amp; </span> ') + '</p><small>' + link(hr.places) + '</small></div></div>' +
      '<div class="hero-visual"><img src="' + esc(asset(R, (hr.image || {}).src)) + '" alt="' + link((hr.image || {}).alt) + '" fetchpriority="high"><div class="image-shade"></div>' +
      '<div class="visual-top"><span>' + link(hr.image_top) + '</span><span>LOTUS</span></div>' +
      '<div class="visual-bottom"><p>' + H(hr.image_quote, 'i') + '</p><span>' + H(hr.image_caption) + '</span></div>' +
      '<a class="round-link" href="#diem-den" aria-label="' + u('exploreDest') + '">↓</a></div></section>');

    h.push('<div class="ribbon">' + c.ribbon.map(function (r) { return '<span>' + link(r) + '</span><b>✳</b>'; }).join('') + '</div>');

    var it = c.intro;
    h.push('<section class="intro wrap" id="ve-lotus"><div class="spirit-aside"><p class="eyebrow">' + link(it.eyebrow) + '</p><figure class="spirit-portrait"><img src="' + esc(asset(R, (it.image || {}).src)) + '" alt="' + link((it.image || {}).alt) + '" width="800" height="1000" loading="lazy"></figure></div>' +
      '<div class="intro-copy"><h2>' + H(it.title) + '</h2><div class="intro-grid">' + it.paragraphs.map(function (p) { return '<p>' + link(p) + '</p>'; }).join('') + '</div></div></section>');

    var lp = c.launchpad;
    var tracks = '<path class="route-track" d="M150 0 V16 Q150 29 136 29 H62 Q48 29 48 43 V62"/><path class="route-track" d="M150 0 V62"/><path class="route-track" d="M150 0 V16 Q150 29 164 29 H238 Q252 29 252 43 V62"/><path class="route-light route-left" pathLength="100" d="M150 0 V16 Q150 29 136 29 H62 Q48 29 48 43 V62"/><path class="route-light route-center" pathLength="100" d="M150 0 V62"/><path class="route-light route-right" pathLength="100" d="M150 0 V16 Q150 29 164 29 H238 Q252 29 252 43 V62"/>';
    h.push('<section class="launchpad wrap" id="be-phong"><div class="launch-copy"><p class="eyebrow">' + link(lp.eyebrow) + '</p><h2>' + H(lp.title) + '</h2>' +
      lp.paragraphs.map(function (p) { return '<p>' + link(p) + '</p>'; }).join('') +
      '<a class="button" href="#ket-noi">' + link(lp.button) + ' <span>↗</span></a></div>' +
      '<div class="launch-visual"><span class="route-kicker">' + link(lp.route_kicker) + '</span><div class="origin"><small>' + link(lp.origin_label) + '</small><strong>' + link(lp.origin) + '</strong><span>' + link(lp.origin_sub) + '</span></div>' +
      '<div class="route-connections" aria-hidden="true"><svg viewBox="0 0 300 62" preserveAspectRatio="none">' + tracks + '</svg></div>' +
      '<div class="route-targets">' + lp.targets.slice(0, 3).map(function (x, i) { return '<a href="#diem-den"><small>0' + (i + 1) + '</small><strong>' + link(x.name) + '</strong><span>' + link(x.sub) + '</span></a>'; }).join('') + '</div>' +
      '<p>' + link(lp.route_caption) + '</p></div>' +
      '<div class="pathway-note">' + link(lp.notice) + ' <details><summary>' + link(lp.links_title) + '</summary>' +
      lp.links.map(function (l) { return '<a href="' + esc(safeUrl(l.url)) + '" target="_blank" rel="noopener">' + link(l.label) + '</a>'; }).join(' · ') + '</details></div></section>');

    var fd = c.fields;
    h.push('<section class="fields wrap" id="linh-vuc"><div class="section-head"><div><p class="eyebrow">' + link(fd.eyebrow) + '</p><h2>' + H(fd.title) + '</h2></div><p>' + H(fd.subtitle) + '</p></div><div class="field-grid">' +
      fd.items.map(function (f) {
        return '<article class="field ' + esc(f.theme || f.key) + '"><div class="portrait"><img src="' + esc(asset(R, (f.image || {}).src)) + '" alt="' + link((f.image || {}).alt) + '"><span>' + link(f.image_label) + '</span></div>' +
          '<div class="field-top"><span>' + link(f.kicker) + '</span><span class="field-symbol" aria-hidden="true">' + esc(f.symbol || '') + '</span></div>' +
          '<h3>' + H(f.title) + '</h3><p>' + link(f.description) + '</p><div class="tags">' + (f.tags || []).map(function (g) { return '<span>' + link(g) + '</span>'; }).join('') + '</div>' +
          '<button data-detail="' + esc(f.key) + '">' + link(f.button) + ' <span>↗</span></button></article>';
      }).join('') + '</div></section>');

    var cr = c.careers;
    var nH = cr.items.filter(function (x) { return x.group === 'healthcare'; }).length;
    h.push('<section id="nghe-nghiep" class="career-section wrap"><div class="section-head"><div><p class="eyebrow">' + link(cr.eyebrow) + '</p><h2>' + H(cr.title) + '</h2></div><p>' + H(cr.subtitle) + '</p></div>' +
      '<div class="career-topline"><div class="career-filters" role="group" aria-label="' + u('filterLabel') + '"><button aria-pressed="true" data-filter="all">' + u('all') + '</button><button aria-pressed="false" data-filter="healthcare">' + u('healthcare') + '</button><button aria-pressed="false" data-filter="beauty">' + u('beauty') + '</button></div>' +
      '<small id="career-count" aria-live="polite" data-unit="' + u('paths') + '">' + cr.items.length + ' ' + u('paths') + '</small></div><div class="career-grid">' +
      cr.items.map(function (x) {
        return '<article class="career-card" data-group="' + esc(x.group) + '"><img src="' + esc(asset(R, (x.image || {}).src)) + '" alt="' + link((x.image || {}).alt) + '" loading="lazy"><div class="card-body"><small>' + link(x.kicker) + '</small><h3>' + link(x.title) + '</h3><p>' + link(x.description) + '</p>' +
          '<button data-career="' + (x.group === 'healthcare' ? 0 : 1) + '">' + link(cr.button) + '</button></div></article>';
      }).join('') + '</div><p class="career-note">' + link(cr.note) + '</p></section>');
    void nH;

    var ds = c.destinations;
    h.push('<section class="destinations wrap" id="diem-den"><div class="section-head"><div><p class="eyebrow">' + link(ds.eyebrow) + '</p><h2>' + H(ds.title) + '</h2></div><p>' + H(ds.subtitle) + '</p></div><div class="destination-grid">' +
      ds.items.map(function (d) {
        return '<button class="destination" data-detail="' + esc(d.key) + '"><img src="' + esc(asset(R, (d.image || {}).src)) + '" alt="' + link((d.image || {}).alt) + '" loading="lazy"><span class="destination-overlay"><small>' + link(d.kicker) + '</small><strong>' + link(d.name) + '</strong><span>' + link(ds.action) + ' <b>↗</b></span></span></button>';
      }).join('') + '</div></section>');

    var jn = c.journey;
    h.push('<section class="journey" id="hanh-trinh"><div class="wrap"><div class="section-head"><div><p class="eyebrow">' + link(jn.eyebrow) + '</p><h2>' + H(jn.title) + '</h2></div><p>' + H(jn.subtitle) + '</p></div><div class="steps">' +
      jn.steps.map(function (s, i) { return '<article><span>' + (i < 9 ? '0' : '') + (i + 1) + '</span><h3>' + link(s.title) + '</h3><p>' + link(s.text) + '</p></article>'; }).join('') + '</div></div></section>');

    h.push(formSection(c, lang, t, R));

    h.push('<section class="faq wrap"><p class="eyebrow">' + link(c.faq.eyebrow) + '</p>' +
      c.faq.items.map(function (f) { return '<details><summary>' + link(f.q) + '</summary><p>' + link(f.a) + '</p></details>'; }).join('') + '</section></main>');

    var tel = esc(String(c.site.hotline).replace(/[^0-9+]/g, ''));
    h.push('<footer><div class="footer-main wrap"><a class="brand" href="#"><img src="' + esc(asset(R, c.site.logo)) + '" alt="Lotus Global Immigration" width="180" height="112"></a><p>' + H(c.footer.tagline) + '</p><a href="#main">' + u('backTop') + '</a></div>' +
      '<div class="footer-bottom wrap"><span>' + link(c.footer.copyright) + '</span><span>' + u('hotline') + ' <a href="tel:' + tel + '" style="color:inherit">' + esc(c.site.hotline) + '</a></span><span>' + link(c.footer.places) + '</span></div></footer>' +
      '<dialog id="detail-dialog" aria-labelledby="dialog-title"><button class="dialog-close" aria-label="' + u('closeDialog') + '">×</button><p class="eyebrow" id="dialog-label"></p><h2 id="dialog-title"></h2><p id="dialog-description"></p><ul id="dialog-list"></ul><a class="button" href="#ket-noi" id="dialog-cta">' + link(c.dialog_cta) + '</a></dialog>');
    h.push('<script type="application/json" id="lotus-data">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script>');
    h.push(['app-v3.js', 'layout-v2.js', 'layout-v4.js', 'lotus-form.js', 'languages.js'].map(function (f) { return '<script src="' + R + f + '"></script>'; }).join('') + '</body></html>\n');
    return h.join('\n');
  }

  /* ---------- Chính sách dữ liệu ---------- */
  function renderPolicy(c) {
    var hot = esc(c.site.hotline), tel = esc(String(c.site.hotline).replace(/[^0-9+]/g, ''));
    return '<!doctype html>\n<html lang="vi">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="theme-color" content="#5f0845">\n' +
      '<title>Chính sách bảo vệ dữ liệu cá nhân — Lotus Global Immigration</title>\n<meta name="description" content="Cách Lotus Global Immigration thu thập, sử dụng và bảo vệ thông tin cá nhân bạn gửi qua website lotusmigrate.com.">\n' +
      '<link rel="icon" href="assets/lotus-mark.png">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600&family=Playfair+Display:ital,wght@0,500;1,500&display=swap">\n' +
      '<style>\n:root{--ink:#362936;--muted:#746774;--line:#f0dfe7;--tint:#fff0f6;--pink:#aa285e;--mud:#5f0845}\n*{box-sizing:border-box}\nbody{margin:0;background:#fffdfd;color:var(--ink);font:400 16px/1.8 \'Be Vietnam Pro\',Arial,sans-serif}\nheader{border-bottom:1px solid var(--line)}\n.bar,main,footer .wrap{max-width:820px;margin:0 auto;padding-inline:20px}\n.bar{display:flex;align-items:center;justify-content:space-between;gap:16px;height:72px}\n.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);font:500 20px/1 \'Playfair Display\',Georgia,serif}\n.brand img{width:40px}\n.bar a.back{color:var(--pink);font-size:14px;text-decoration:none;border-bottom:1px solid currentColor}\nmain{padding-block:48px 72px}\n.eyebrow{margin:0;font-size:12px;font-weight:600;letter-spacing:2px;color:var(--pink)}\nh1{margin:14px 0 8px;font:500 clamp(32px,5vw,44px)/1.2 \'Playfair Display\',Georgia,serif}\nh1 em{color:var(--pink)}\n.updated{margin:0 0 32px;color:var(--muted);font-size:14px}\nh2{margin:36px 0 10px;font:500 24px/1.3 \'Playfair Display\',Georgia,serif}\np,li{color:var(--ink)}\nul{padding-left:22px}\nli{margin-bottom:6px}\n.box{padding:18px 20px;border-radius:14px;background:var(--tint);margin-top:28px}\na{color:var(--pink)}\nfooter{background:var(--mud);color:#f3cddd;font-size:13px}\nfooter .wrap{padding-block:24px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}\nfooter a{color:#fff}\n</style>\n</head>\n<body>\n' +
      '<header><div class="bar"><a class="brand" href="./"><img src="assets/lotus-mark.png" alt="">Lotus</a><a class="back" href="./#ket-noi">← Quay lại form tư vấn</a></div></header>\n<main>\n' +
      (c.policy_html ? c.policy_html : POLICY_BODY) +
      '\n<div class="box">\n<b>Liên hệ về dữ liệu cá nhân</b><br>\nGọi hoặc nhắn Zalo hotline <a href="tel:' + tel + '">' + hot + '</a>, nói rõ yêu cầu và số điện thoại bạn đã dùng khi gửi form. Chúng tôi phản hồi trong thời gian pháp luật quy định.\n</div>\n</main>\n' +
      '<footer><div class="wrap"><span>© 2026 Lotus Global Immigration</span><span>Hotline / Zalo: <a href="tel:' + tel + '">' + hot + '</a></span></div></footer>\n</body>\n</html>\n';
  }

  var POLICY_BODY = [
    '<p class="eyebrow">MINH BẠCH LÀ CAM KẾT CỦA LOTUS</p>',
    '<h1>Chính sách <em>bảo vệ dữ liệu cá nhân</em></h1>',
    '<p class="updated">Cập nhật: 29/09/2026 · Phiên bản lotus-2026-09</p>',
    '<p>Chính sách này giải thích Lotus Global Immigration ("Lotus", "chúng tôi") thu thập, sử dụng và bảo vệ thông tin cá nhân bạn gửi qua website lotusmigrate.com như thế nào, theo quy định pháp luật Việt Nam về bảo vệ dữ liệu cá nhân.</p>',
    '<h2>1. Ai xử lý dữ liệu của bạn</h2>',
    '<p>Lotus Global Immigration là thành viên trong hệ thống tư vấn OneStep. Thông tin bạn gửi được lưu trên hệ thống quản lý khách hàng (CRM) do CÔNG TY TNHH ĐẦU TƯ ONESTEP vận hành, để đội ngũ tư vấn Lotus liên hệ và chăm sóc bạn.</p>',
    '<h2>2. Chúng tôi thu thập những gì</h2>',
    '<ul>\n<li><b>Thông tin liên hệ:</b> họ tên, số điện thoại/Zalo, email (nếu bạn cung cấp).</li>\n<li><b>Thông tin khảo sát:</b> lĩnh vực, điểm đến, trình độ, tiếng Anh, thời gian dự kiến và người được tư vấn.</li>\n<li><b>Thông tin kỹ thuật:</b> trang bạn gửi form và nguồn quảng cáo (nếu có), để chúng tôi biết kênh nào giúp bạn tìm đến Lotus.</li>\n</ul>',
    '<p>Chúng tôi không yêu cầu số giấy tờ tùy thân, tài khoản ngân hàng hay dữ liệu sức khỏe qua form này.</p>',
    '<h2>3. Chúng tôi dùng thông tin để làm gì</h2>',
    '<ul>\n<li>Liên hệ tư vấn theo yêu cầu của bạn, qua Zalo, điện thoại hoặc email.</li>\n<li>Phân công chuyên viên phù hợp và chuẩn bị nội dung trao đổi.</li>\n<li>Gửi thông tin về chương trình bạn quan tâm, chỉ khi bạn đồng ý nhận.</li>\n</ul>',
    '<p>Hệ thống có thể dùng công cụ trí tuệ nhân tạo để tóm tắt nhu cầu của bạn cho chuyên viên. Kết quả này chỉ dùng nội bộ, không thay thế trao đổi trực tiếp và không dùng để đưa ra quyết định về bạn.</p>',
    '<h2>4. Chia sẻ thông tin</h2>',
    '<p>Chúng tôi không bán hay cho thuê thông tin của bạn. Thông tin chỉ được chia sẻ với đội ngũ tư vấn trong hệ thống Lotus – OneStep và các nhà cung cấp dịch vụ kỹ thuật (lưu trữ, gửi email, nhắn tin) cần thiết để vận hành, hoặc khi pháp luật yêu cầu. Trường hợp cần chia sẻ với trường học hay đối tác ở nước ngoài để xử lý hồ sơ, chúng tôi sẽ hỏi ý kiến bạn trước.</p>',
    '<h2>5. Lưu trữ và bảo mật</h2>',
    '<p>Thông tin được lưu trong thời gian cần thiết để tư vấn và chăm sóc bạn, hoặc theo thời hạn pháp luật quy định. Quyền truy cập được giới hạn cho nhân sự phụ trách.</p>',
    '<h2>6. Quyền của bạn</h2>',
    '<ul>\n<li>Được biết, xem và yêu cầu sửa thông tin của mình.</li>\n<li>Rút lại sự đồng ý, yêu cầu ngừng liên hệ hoặc xóa thông tin.</li>\n<li>Khiếu nại nếu cho rằng thông tin của bạn bị xử lý sai.</li>\n</ul>',
    '<p>Việc rút lại đồng ý không ảnh hưởng tới các xử lý đã thực hiện trước đó.</p>'
  ].join('\n');

  function renderSite(c) {
    return {
      'index.html': renderPage(c, 'vi'),
      'en/index.html': renderPage(c, 'en'),
      'chinh-sach-du-lieu.html': renderPolicy(c)
    };
  }

  return { renderSite: renderSite, renderPage: renderPage, md: md, esc: esc, plain: plain };
});
