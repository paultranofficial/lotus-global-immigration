/* Lotus — form tư vấn 4 bước, gửi lead về OneStep CRM */
(function () {
  var CRM_ENDPOINT = 'https://onestep-ai-crm.onrender.com/api/v1/leads/intake';
  var CONSENT_VERSION = 'lotus-2026-09';
  var HOTLINE = '0879.769.569';
  try { HOTLINE = JSON.parse(document.getElementById('lotus-data').textContent).hotline || HOTLINE; HOTLINE = String(HOTLINE).replace(/[<>"'&]/g, ''); } catch (e) {}
  var TOTAL = 4;

  var section = document.getElementById('ket-noi');
  var form = document.getElementById('lotus-form');
  if (!section || !form) return;

  var steps = [].slice.call(form.querySelectorAll('.lf-step'));
  var petals = [].slice.call(section.querySelectorAll('.lf-petal'));
  var labels = [].slice.call(section.querySelectorAll('[data-step-label]'));
  var btnNext = document.getElementById('lf-next');
  var btnBack = document.getElementById('lf-back');
  var btnSubmit = document.getElementById('lf-submit');
  var hint = document.getElementById('lf-hint');
  var privacy = document.getElementById('lf-privacy');
  var errorBox = document.getElementById('lf-error');
  var stepNum = document.getElementById('lf-step-num');
  var consent = document.getElementById('lf-consent');
  var thanks = document.getElementById('lf-thanks');
  var top = document.getElementById('lf-top');
  var current = 1;

  function isEn() { return document.documentElement.lang === 'en'; }
  function t(vi, en) { return isEn() ? en : vi; }
  function checked(name) { return [].slice.call(form.querySelectorAll('input[name="' + name + '"]:checked')).map(function (i) { return i.value; }); }
  function one(name) { return checked(name)[0] || ''; }

  function showError(html) {
    if (!html) { errorBox.hidden = true; errorBox.innerHTML = ''; return; }
    errorBox.innerHTML = html;
    errorBox.hidden = false;
  }

  function scrollToTop() {
    var r = top.getBoundingClientRect();
    if (r.top < 0 || r.top > window.innerHeight * 0.6) {
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      top.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function render() {
    steps.forEach(function (s) { s.hidden = Number(s.dataset.step) !== current; });
    petals.forEach(function (p, i) { p.classList.toggle('is-on', i < current); });
    labels.forEach(function (l) {
      var n = Number(l.dataset.stepLabel);
      if (n === current) l.setAttribute('aria-current', 'step'); else l.removeAttribute('aria-current');
      l.classList.toggle('is-done', n < current);
    });
    stepNum.textContent = current;
    btnBack.hidden = current === 1;
    hint.hidden = current !== 1;
    btnNext.hidden = current === TOTAL;
    btnSubmit.hidden = current !== TOTAL;
    privacy.hidden = current !== TOTAL;
    btnSubmit.disabled = !consent.checked;
    if (current === TOTAL) renderSummary();
  }

  function renderSummary() {
    var parts = [one('field'), checked('destination').join(', '), one('timeframe')].filter(Boolean);
    var box = document.getElementById('lf-summary');
    box.textContent = '';
    box.append(t('Bạn đã chọn: ', 'Your choices: '));
    var b = document.createElement('b');
    b.textContent = parts.join(' · ');
    box.append(b);
  }

  function validateStep(n) {
    if (n === 1 && !one('field')) return t('Bạn chọn giúp Lotus một lĩnh vực nhé, hoặc chọn "Cần được định hướng".', 'Please choose a field, or "I would like guidance".');
    if (n === 2 && !checked('destination').length) return t('Bạn chọn ít nhất một điểm đến, hoặc "Tôi chưa quyết định".', 'Please choose at least one destination, or "I have not decided".');
    return '';
  }

  function go(n) {
    current = Math.max(1, Math.min(TOTAL, n));
    showError('');
    render();
    scrollToTop();
    var focusTarget = steps[current - 1].querySelector('legend');
    if (focusTarget) { focusTarget.setAttribute('tabindex', '-1'); focusTarget.focus({ preventScroll: true }); }
  }

  btnNext.addEventListener('click', function () {
    var err = validateStep(current);
    if (err) { showError(err); return; }
    go(current + 1);
  });
  btnBack.addEventListener('click', function () { go(current - 1); });

  // Chọn lĩnh vực xong thì tự sang bước 2 cho nhanh
  form.querySelectorAll('input[name="field"]').forEach(function (r) {
    r.addEventListener('change', function () { showError(''); setTimeout(function () { if (current === 1) go(2); }, 260); });
  });

  // "Chưa quyết định" loại trừ các điểm đến khác
  form.addEventListener('change', function (e) {
    var el = e.target;
    if (el.name !== 'destination') return;
    showError('');
    var boxes = form.querySelectorAll('input[name="destination"]');
    boxes.forEach(function (b) {
      if (!el.checked) return;
      if (el.dataset.exclusive && b !== el) b.checked = false;
      if (!el.dataset.exclusive && b.dataset.exclusive) b.checked = false;
    });
  });

  consent.addEventListener('change', function () { btnSubmit.disabled = !consent.checked; if (consent.checked) showError(''); });

  function normalizePhone(raw) {
    var p = String(raw || '').replace(/[\s.\-()]/g, '');
    if (p.indexOf('+84') === 0) p = '0' + p.slice(3);
    else if (p.indexOf('84') === 0 && p.length === 11) p = '0' + p.slice(2);
    return p;
  }
  var VN_MOBILE = /^(03[2-9]|05[25689]|07[06-9]|08[1-9]|09[0-9])[0-9]{7}$/;

  function setInvalid(input, bad) { if (bad) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }

  function validateContact() {
    var name = form.elements.name, phone = form.elements.phone, email = form.elements.email;
    var n = name.value.trim(), p = normalizePhone(phone.value), e = email.value.trim();
    setInvalid(name, false); setInvalid(phone, false); setInvalid(email, false);
    if (n.length < 2 || /^\d+$/.test(n)) { setInvalid(name, true); name.focus(); return t('Bạn nhập họ và tên giúp Lotus nhé.', 'Please enter your full name.'); }
    if (!VN_MOBILE.test(p)) { setInvalid(phone, true); phone.focus(); return t('Số điện thoại chưa đúng. Vui lòng nhập số di động Việt Nam 10 số, ví dụ 0912 345 678.', 'Please enter a valid 10-digit Vietnamese mobile number, e.g. 0912 345 678.'); }
    if (e && !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(e)) { setInvalid(email, true); email.focus(); return t('Email chưa đúng định dạng. Bạn có thể để trống ô này.', 'That email looks incomplete. You can leave it empty.'); }
    if (!consent.checked) { consent.focus(); return t('Bạn cần tích ô đồng ý để Lotus được liên hệ tư vấn.', 'Please tick the consent box so Lotus can contact you.'); }
    return '';
  }

  function utm(key) { try { return new URLSearchParams(location.search).get(key) || ''; } catch (_) { return ''; } }

  function buildPayload() {
    var field = one('field'), dests = checked('destination'), phone = normalizePhone(form.elements.phone.value);
    var summary = '[LOTUS] Lead từ lotusmigrate.com. Lĩnh vực: ' + field + '. Điểm đến: ' + dests.join(', ') + '.';
    return {
      brand: 'lotus',
      name: form.elements.name.value.trim(),
      phone: phone,
      email: form.elements.email.value.trim(),
      goal: 'Lotus · Du học & nghề nghiệp · ' + field,
      field_interest: field,
      country: dests.join(', '),
      education: one('education'),
      language: one('language'),
      timeframe: one('timeframe'),
      target_audience: one('for_whom') || 'Cho chính tôi',
      pain_point: summary,
      source_url: location.origin + location.pathname + '#ket-noi',
      utm_source: utm('utm_source'),
      utm_medium: utm('utm_medium'),
      utm_campaign: utm('utm_campaign'),
      consent: true,
      consent_version: CONSENT_VERSION,
      consent_at: new Date().toISOString()
    };
  }

  function leadCode(id) {
    var s = String(id || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return 'LT-' + (s ? s.slice(-4) : Date.now().toString(36).slice(-4).toUpperCase());
  }

  function showThanks(payload, id) {
    var first = payload.name.split(/\s+/).pop();
    var title = document.getElementById('lf-thanks-title');
    title.textContent = '';
    title.append(t('Cảm ơn ' + first + '! ', 'Thank you, ' + first + '! '));
    var em = document.createElement('em');
    em.textContent = t('Lotus đã nhận hành trình của bạn.', 'Lotus has received your journey.');
    title.append(em);
    document.getElementById('lf-code').textContent = leadCode(id);
    var recap = document.getElementById('lf-recap');
    recap.textContent = '';
    [payload.field_interest, payload.country, payload.timeframe].filter(Boolean).forEach(function (v) {
      var s = document.createElement('span'); s.textContent = v; recap.append(s);
    });
    document.getElementById('lf-masked-phone').textContent = payload.phone.slice(0, 4) + ' *** ' + payload.phone.slice(-3);
    form.hidden = true;
    top.hidden = true;
    thanks.hidden = false;
    thanks.focus({ preventScroll: true });
    scrollToTop();
    thanks.scrollIntoView({ block: 'start', behavior: 'auto' });
  }

  var sending = false;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    var err = validateContact();
    if (err) { showError(err); return; }
    showError('');
    var payload = buildPayload();

    // Bẫy bot: trường ẩn có dữ liệu thì giả vờ thành công, không gửi
    if (form.elements.website.value) { showThanks(payload, ''); return; }

    sending = true;
    btnSubmit.setAttribute('aria-busy', 'true');
    var label = btnSubmit.firstChild;
    var original = label.nodeValue;
    label.nodeValue = t('Đang gửi… ', 'Sending… ');
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 20000) : null;

    fetch(CRM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) { return { res: res, data: data }; });
    }).then(function (r) {
      if (r.res.ok && r.data && r.data.success !== false) {
        showThanks(payload, r.data.lead_id);
        if (window.dataLayer) window.dataLayer.push({ event: 'lotus_lead_submitted', field: payload.field_interest });
        return;
      }
      if (r.res.status === 429) throw new Error(t('Bạn đã gửi nhiều lần trong thời gian ngắn. Vui lòng thử lại sau ít phút.', 'Too many attempts. Please try again in a few minutes.'));
      if (r.res.status >= 400 && r.res.status < 500 && r.data && r.data.error) throw new Error(r.data.error);
      throw new Error('');
    }).catch(function (ex) {
      var msg = ex && ex.message ? ex.message : t('Chưa gửi được thông tin do lỗi kết nối.', 'We could not send your details due to a connection problem.');
      showError(msg + ' ' + t('Bạn có thể thử lại, hoặc gọi/Zalo Lotus: ', 'You can try again, or call/Zalo Lotus: ') + '<a href="tel:' + HOTLINE.replace(/[^0-9+]/g, '') + '">' + HOTLINE + '</a>.');
    }).then(function () {
      if (timer) clearTimeout(timer);
      sending = false;
      btnSubmit.removeAttribute('aria-busy');
      label.nodeValue = original;
    });
  });

  // Cho các nút khác trên trang chọn sẵn lĩnh vực / điểm đến
  var FIELD_VALUES = ['Chăm sóc sức khỏe (Healthcare)', 'Làm đẹp (Beauty & Wellness)', 'Cần được định hướng'];
  var DEST_KEYS = {};
  try {
    var LD = JSON.parse(document.getElementById('lotus-data').textContent).details || {};
    Object.keys(LD).forEach(function (k) { if (LD[k].destinationValue) DEST_KEYS[k] = LD[k].destinationValue; });
  } catch (e) {}
  window.lotusForm = {
    preset: function (opts) {
      opts = opts || {};
      if (!thanks.hidden) return;
      if (typeof opts.field === 'number' && FIELD_VALUES[opts.field]) {
        var r = form.querySelector('input[name="field"][value="' + FIELD_VALUES[opts.field] + '"]');
        if (r) r.checked = true;
      }
      var destVal = opts.destinationValue || DEST_KEYS[opts.destination];
      if (destVal) {
        form.querySelectorAll('input[name="destination"]').forEach(function (b) {
          if (b.value === destVal) b.checked = true;
          if (b.dataset.exclusive) b.checked = false;
        });
      }
      if (current === 1 && one('field')) go(destVal ? 3 : 2); else render();
    }
  };

  render();
})();
