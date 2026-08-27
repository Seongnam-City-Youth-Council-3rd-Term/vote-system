/** admin/login.html — 관리자 로그인 */
(function () {
  'use strict';

  var $ = UI.$;

  var els = {
    alert: $('#globalAlert'),
    form: $('#loginForm'),
    id: $('#adminId'),
    pw: $('#adminPw'),
    button: $('#loginBtn')
  };

  UI.guardConfig(els.alert);

  // 세션 만료로 되돌아온 경우 안내한다.
  if (location.search.indexOf('expired=1') !== -1) {
    UI.notify(els.alert, '세션이 만료되었습니다. 다시 로그인해 주세요.', 'warn');
  }

  // 이미 유효한 세션이 있으면 대시보드로 보낸다.
  if (API.getToken() && API.isConfigured()) {
    API.callAdmin('me')
      .then(function () { location.replace('dashboard.html'); })
      .catch(function () { API.setToken(''); });
  }

  els.form.addEventListener('submit', function (event) {
    event.preventDefault();

    var id = els.id.value.trim();
    var password = els.pw.value;

    if (!id || !password) {
      UI.notify(els.alert, '아이디와 비밀번호를 입력해 주세요.', 'warn');
      return;
    }

    UI.notify(els.alert, '');
    var restore = UI.busyButton(els.button, '로그인 중…');

    API.call('login', { id: id, password: password })
      .then(function (data) {
        API.setToken(data.token);
        location.replace('dashboard.html');
      })
      .catch(function (err) {
        UI.notify(els.alert, err.message, 'danger');
        els.pw.value = '';
        els.pw.focus();
        restore();
      });
  });

  els.id.focus();
})();
