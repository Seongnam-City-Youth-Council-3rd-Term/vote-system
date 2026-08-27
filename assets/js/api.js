/**
 * Apps Script 웹 앱 호출 래퍼 + 공용 UI 헬퍼.
 * 다른 스크립트보다 먼저 로드되어야 한다 (config.js 다음).
 */
(function () {
  'use strict';

  var CONFIG = window.VOTE_CONFIG || {};

  // ==========================================================
  // API
  // ==========================================================

  function isConfigured() {
    return typeof CONFIG.API_URL === 'string' && CONFIG.API_URL.indexOf('http') === 0;
  }

  function getToken() {
    try {
      return sessionStorage.getItem(CONFIG.TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function setToken(token) {
    try {
      if (token) sessionStorage.setItem(CONFIG.TOKEN_KEY, token);
      else sessionStorage.removeItem(CONFIG.TOKEN_KEY);
    } catch (e) { /* 프라이빗 모드 등에서 실패할 수 있다 */ }
  }

  /**
   * 액션 호출.
   *
   * Content-Type 을 text/plain 으로 보내는 이유:
   * application/json 으로 보내면 브라우저가 CORS preflight(OPTIONS)를 먼저 보내는데
   * Apps Script 웹 앱은 OPTIONS 에 응답하지 못해 요청이 실패한다.
   *
   * @returns {Promise<Object>} 성공 시 data 객체. 실패 시 reject(Error) — err.code 에 서버 코드.
   */
  function call(action, payload) {
    if (!isConfigured()) {
      return Promise.reject(makeError(
        'API 주소가 설정되지 않았습니다. assets/js/config.js 의 API_URL 을 채워 주세요.',
        'NOT_CONFIGURED'
      ));
    }

    var body = { action: action };
    if (payload) {
      Object.keys(payload).forEach(function (k) { body[k] = payload[k]; });
    }

    return fetch(CONFIG.API_URL, {
      method: 'POST',
      // Apps Script 는 리디렉션을 거쳐 응답하므로 follow 가 필요하다.
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        if (!res.ok) throw makeError('서버 응답 오류 (' + res.status + ')', 'HTTP_' + res.status);
        return res.text();
      })
      .then(function (text) {
        var json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          // 로그인 요구 HTML 이 돌아오는 경우가 대표적이다.
          throw makeError('서버 응답을 해석할 수 없습니다. 웹 앱 배포 설정(액세스 권한: 모든 사용자)을 확인해 주세요.', 'BAD_RESPONSE');
        }
        if (!json || json.ok !== true) {
          throw makeError((json && json.error) || '요청이 실패했습니다.', (json && json.code) || 'ERROR');
        }
        return json.data || {};
      })
      .catch(function (err) {
        if (err && err.code) throw err;
        throw makeError('네트워크 오류가 발생했습니다. 연결 상태를 확인해 주세요.', 'NETWORK_ERROR');
      });
  }

  /** 토큰을 자동으로 붙이는 관리자 호출. 세션 만료 시 로그인 페이지로 보낸다. */
  function callAdmin(action, payload) {
    // 호출자가 넘긴 객체를 변경하지 않는다. 같은 객체를 재사용할 때 토큰이 남는 일을 막는다.
    var body = {};
    if (payload) {
      Object.keys(payload).forEach(function (key) { body[key] = payload[key]; });
    }
    body.token = getToken();

    return call(action, body).catch(function (err) {
      if (err.code === 'UNAUTHORIZED' || err.code === 'ACCOUNT_DISABLED') {
        setToken('');
        redirectToLogin();
      }
      throw err;
    });
  }

  function redirectToLogin() {
    // admin/ 하위에서 호출되므로 같은 디렉터리의 login.html 로 보낸다.
    if (location.pathname.indexOf('/login.html') === -1) {
      location.replace('login.html?expired=1');
    }
  }

  function makeError(message, code) {
    var err = new Error(message);
    err.code = code;
    return err;
  }

  window.API = {
    call: call,
    callAdmin: callAdmin,
    getToken: getToken,
    setToken: setToken,
    isConfigured: isConfigured,
    redirectToLogin: redirectToLogin
  };

  // ==========================================================
  // UI 헬퍼
  // ==========================================================

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  /** textContent 로만 값을 넣는다. innerHTML 을 쓰지 않아 XSS 여지를 없앤다. */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function show(node, visible) {
    if (node) node.hidden = !visible;
  }

  /**
   * 알림 표시.
   * @param {string} type good | warn | danger | info
   */
  function notify(node, message, type) {
    if (!node) return;
    if (!message) {
      node.hidden = true;
      node.textContent = '';
      return;
    }
    node.className = 'alert' + (type && type !== 'info' ? ' alert-' + type : '');
    node.textContent = message;
    node.hidden = false;
  }

  /** 버튼을 잠그고 라벨을 바꾼다. 반환된 함수를 호출하면 원상복구된다. */
  function busyButton(button, busyLabel) {
    if (!button) return function () {};
    var original = button.textContent;
    button.disabled = true;
    if (busyLabel) button.textContent = busyLabel;
    return function () {
      button.disabled = false;
      button.textContent = original;
    };
  }

  function formatDateTime(value) {
    if (!value) return '-';
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function formatNumber(n) {
    return Number(n || 0).toLocaleString('ko-KR');
  }

  /** API_URL 미설정 시 페이지 상단에 안내 배너를 띄운다. */
  function guardConfig(alertNode) {
    if (isConfigured()) return true;
    notify(
      alertNode,
      'API 주소가 설정되지 않았습니다. assets/js/config.js 의 API_URL 에 Apps Script 웹 앱 URL 을 입력해 주세요.',
      'warn'
    );
    return false;
  }

  window.UI = {
    $: $,
    $$: $$,
    el: el,
    clear: clear,
    show: show,
    notify: notify,
    busyButton: busyButton,
    formatDateTime: formatDateTime,
    formatNumber: formatNumber,
    guardConfig: guardConfig
  };
})();
