/** admin/dashboard.html — 다중 투표 / 집계 / 계층형 투표 내용 / 코드 / 설정 / 로그 */
(function () {
  'use strict';

  var $ = UI.$;
  var $$ = UI.$$;
  var state = { role: '', adminId: '', polls: [], pollId: '', codes: [], lastCodes: [] };
  var alertBox = $('#globalAlert');
  var busy = $('#busy');

  function notify(message, type) {
    UI.notify(alertBox, message, type);
    if (message) window.scrollTo(0, 0);
  }

  function fail(err) {
    if (err.code !== 'UNAUTHORIZED' && err.code !== 'ACCOUNT_DISABLED') notify(err.message, 'danger');
  }

  function currentPoll() {
    return state.polls.filter(function (poll) { return poll.id === state.pollId; })[0] || null;
  }

  function pollPayload(extra) {
    var payload = { pollId: state.pollId };
    Object.keys(extra || {}).forEach(function (key) { payload[key] = extra[key]; });
    return payload;
  }

  function requirePoll() {
    if (state.pollId) return true;
    notify('먼저 투표를 만들어 주세요.', 'warn');
    activate('polls');
    return false;
  }

  // ==========================================================
  // 탭
  // ==========================================================

  var loaders = {
    polls: loadPolls,
    overview: loadOverview,
    candidates: loadCandidates,
    codes: loadCodes,
    settings: loadOverview,
    audit: loadAudit
  };

  $('#tabs').addEventListener('click', function (event) {
    var button = event.target.closest('.tab');
    if (button) activate(button.dataset.panel);
  });

  function activate(name) {
    $$('.tab').forEach(function (tab) { tab.classList.toggle('active', tab.dataset.panel === name); });
    $$('.panel').forEach(function (panel) { panel.hidden = panel.id !== 'panel-' + name; });
    notify('');
    if (loaders[name]) loaders[name]();
  }

  function activePanelName() {
    var active = $('.tab.active');
    return active ? active.dataset.panel : 'overview';
  }

  // ==========================================================
  // 투표 관리 / 선택
  // ==========================================================

  function loadPolls() {
    return API.callAdmin('adminListPolls')
      .then(function (data) {
        state.polls = data.items || [];
        state.role = data.admin.role;
        state.adminId = data.admin.adminId;
        $('#adminInfo').textContent = state.adminId + ' · ' + state.role;
        $('#pwAdminId').value = state.adminId;
        UI.show($('#dangerCard'), state.role === 'SUPER');

        if (!state.polls.some(function (poll) { return poll.id === state.pollId; })) {
          state.pollId = state.polls.length ? state.polls[0].id : '';
        }
        renderPollSelect();
        renderAdminPolls();
        syncPollContext();
      })
      .catch(fail);
  }

  function renderPollSelect() {
    var select = $('#pollSelect');
    UI.clear(select);
    if (state.polls.length === 0) {
      var empty = UI.el('option', null, '등록된 투표 없음');
      empty.value = '';
      select.appendChild(empty);
      select.disabled = true;
      return;
    }
    select.disabled = false;
    state.polls.forEach(function (poll) {
      var option = UI.el('option', null, poll.title + (poll.enabled ? '' : ' (비활성)'));
      option.value = poll.id;
      option.selected = poll.id === state.pollId;
      select.appendChild(option);
    });
  }

  function syncPollContext() {
    var poll = currentPoll();
    if (!poll) {
      $('#pollModeBadge').textContent = '-';
      $('#adminResultLink').href = '../result.html';
      return;
    }
    var badge = $('#pollModeBadge');
    badge.textContent = poll.requireCode ? '코드 사용' : '반복 투표 허용';
    badge.className = 'badge ' + (poll.requireCode ? 'badge-accent' : 'badge-warn');
    $('#adminResultLink').href = '../result.html?poll=' + encodeURIComponent(poll.id);
    UI.show($('#codeIssueCard'), poll.requireCode);
    UI.show($('#codeModeNotice'), !poll.requireCode);
  }

  function renderAdminPolls() {
    var list = $('#adminPollList');
    UI.clear(list);
    UI.show($('#pollEmpty'), state.polls.length === 0);

    state.polls.forEach(function (poll) {
      var card = UI.el('div', 'admin-poll-item' + (poll.id === state.pollId ? ' selected' : ''));
      var body = UI.el('div', 'grow');
      var head = UI.el('div', 'poll-item-head');
      head.appendChild(UI.el('strong', null, poll.title));
      head.appendChild(UI.el('span', 'badge ' + (poll.enabled ? 'badge-good' : ''), poll.enabled ? '표시' : '숨김'));
      body.appendChild(head);
      if (poll.description) body.appendChild(UI.el('p', 'poll-description', poll.description));
      body.appendChild(UI.el('div', 'small muted',
        '투표 항목 ' + poll.questionCount + ' · 참여 ' + poll.totalVotes + '명 · 코드 ' + poll.codeCount +
        ' · ' + (poll.requireCode ? '코드 사용' : '반복 허용')));

      var actions = UI.el('div', 'btn-row');
      var selectBtn = UI.el('button', 'btn btn-ghost btn-sm', poll.id === state.pollId ? '선택됨' : '관리');
      selectBtn.type = 'button';
      selectBtn.disabled = poll.id === state.pollId;
      selectBtn.addEventListener('click', function () {
        state.pollId = poll.id;
        renderPollSelect();
        syncPollContext();
        activate('overview');
      });

      var deleteBtn = UI.el('button', 'btn btn-ghost btn-sm', '삭제');
      deleteBtn.type = 'button';
      deleteBtn.style.color = 'var(--danger)';
      deleteBtn.addEventListener('click', function () {
        if (!window.confirm('"' + poll.title + '" 투표를 삭제할까요?\n데이터가 있는 투표는 삭제되지 않습니다.')) return;
        var restore = UI.busyButton(deleteBtn, '…');
        API.callAdmin('deletePoll', { pollId: poll.id })
          .then(function () {
            notify('투표를 삭제했습니다.', 'good');
            if (state.pollId === poll.id) state.pollId = '';
            return loadPolls();
          })
          .catch(fail)
          .then(restore);
      });

      actions.appendChild(selectBtn);
      actions.appendChild(deleteBtn);
      card.appendChild(body);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  $('#pollSelect').addEventListener('change', function () {
    state.pollId = this.value;
    state.codes = [];
    state.lastCodes = [];
    UI.show($('#codeResultBox'), false);
    syncPollContext();
    var name = activePanelName();
    if (name === 'polls' || name === 'audit') renderAdminPolls();
    else if (loaders[name]) loaders[name]();
  });

  $('#pollForm').addEventListener('submit', function (event) {
    event.preventDefault();
    var title = $('#pollTitle').value.trim();
    if (!title) return notify('투표 제목을 입력해 주세요.', 'warn');
    var restore = UI.busyButton($('#pollSubmit'), '만드는 중…');
    API.callAdmin('createPoll', {
      title: title,
      description: $('#pollDescription').value.trim(),
      requireCode: $('#pollRequireCode').checked
    })
      .then(function (data) {
        $('#pollForm').reset();
        $('#pollRequireCode').checked = true;
        state.pollId = data.id;
        notify('새 투표를 만들었습니다.', 'good');
        return loadPolls();
      })
      .catch(fail)
      .then(restore);
  });

  $('#pollRefresh').addEventListener('click', function () {
    var restore = UI.busyButton(this, '불러오는 중…');
    loadPolls().then(restore, restore);
  });

  // ==========================================================
  // 집계
  // ==========================================================

  function loadOverview() {
    if (!requirePoll()) return Promise.resolve();
    return API.callAdmin('adminOverview', { pollId: state.pollId })
      .then(function (data) {
        $('#ovTotal').textContent = UI.formatNumber(data.totalVotes);
        $('#ovCodesTotal').textContent = data.poll.requireCode ? UI.formatNumber(data.codes.total) : '-';
        $('#ovCodesUsed').textContent = data.poll.requireCode ? UI.formatNumber(data.codes.used) : '-';
        $('#ovCodesLeft').textContent = data.poll.requireCode ? UI.formatNumber(data.codes.remaining) : '-';

        var voteBadge = $('#ovVoteState');
        voteBadge.textContent = data.poll.voteOpen ? '투표 진행 중' : '투표 종료';
        voteBadge.className = 'badge ' + (data.poll.voteOpen ? 'badge-good' : 'badge-warn');
        var resultBadge = $('#ovResultState');
        resultBadge.textContent = data.poll.showResult ? '결과 공개' : '결과 비공개';
        resultBadge.className = 'badge ' + (data.poll.showResult ? 'badge-accent' : '');

        renderTally(data.items);
        $('#setTitle').value = data.poll.title || '';
        $('#setDescription').value = data.poll.description || '';
        $('#setOpen').checked = !!data.poll.voteOpen;
        $('#setShowResult').checked = !!data.poll.showResult;
        $('#setRequireCode').checked = !!data.poll.requireCode;
        $('#setEnabled').checked = !!data.poll.enabled;

        var local = currentPoll();
        if (local) Object.keys(data.poll).forEach(function (key) { local[key] = data.poll[key]; });
        syncPollContext();
      })
      .catch(fail);
  }

  function renderTally(items) {
    var list = $('#ovList');
    UI.clear(list);
    if (!items || items.length === 0) return list.appendChild(UI.el('div', 'empty', '등록된 투표 내용이 없습니다.'));
    items.forEach(function (item) {
      var row = UI.el('div', 'result-row');
      var head = UI.el('div', 'r-head');
      var name = UI.el('div', 'r-name', item.majorTopic + ' › ' + item.middleTopic + ' › ' + item.subTopic);
      if (!item.enabled) name.appendChild(UI.el('span', 'badge inline-badge', '비활성'));
      head.appendChild(name);
      var count = UI.el('div', 'r-count');
      count.appendChild(UI.el('b', null, '예 ' + UI.formatNumber(item.yesCount)));
      count.appendChild(document.createTextNode(' · 아니오 ' + UI.formatNumber(item.noCount) + ' · 예 ' + item.yesPercent + '%'));
      head.appendChild(count);
      var bar = UI.el('div', 'bar');
      var fill = UI.el('span');
      bar.appendChild(fill);
      row.appendChild(head);
      row.appendChild(bar);
      list.appendChild(row);
      requestAnimationFrame(function () { fill.style.width = (item.yesCount ? Math.max(item.yesPercent, 1.5) : 0) + '%'; });
    });
  }

  $('#ovRefresh').addEventListener('click', function () {
    var restore = UI.busyButton(this, '불러오는 중…');
    loadOverview().then(restore, restore);
  });

  // ==========================================================
  // 투표 내용 관리
  // ==========================================================

  function loadCandidates() {
    if (!requirePoll()) return Promise.resolve();
    return API.callAdmin('listQuestions', { pollId: state.pollId })
      .then(function (data) {
        var tbody = $('#candTbody');
        UI.clear(tbody);
        var items = data.items || [];
        UI.show($('#candEmpty'), items.length === 0);
        items.forEach(function (item) { tbody.appendChild(candidateRow(item)); });
      })
      .catch(fail);
  }

  function candidateRow(item) {
    var tr = document.createElement('tr');
    var nameCell = UI.el('td');
    nameCell.appendChild(UI.el('div', null, item.majorTopic + ' › ' + item.middleTopic));
    nameCell.appendChild(UI.el('div', 'small muted pre-wrap', item.subTopic));
    tr.appendChild(nameCell);
    tr.appendChild(UI.el('td', 'num', UI.formatNumber(item.yesCount) + ' / ' + UI.formatNumber(item.noCount)));
    var stateCell = UI.el('td');
    stateCell.appendChild(UI.el('span', 'badge ' + (item.enabled ? 'badge-good' : ''), item.enabled ? '활성' : '비활성'));
    tr.appendChild(stateCell);

    var actions = UI.el('td');
    var row = UI.el('div', 'btn-row');
    var editBtn = UI.el('button', 'btn btn-ghost btn-sm', '수정');
    editBtn.type = 'button';
    editBtn.addEventListener('click', function () { editCandidate(item); });
    var toggleBtn = UI.el('button', 'btn btn-ghost btn-sm', item.enabled ? '비활성' : '활성');
    toggleBtn.type = 'button';
    toggleBtn.addEventListener('click', function () {
      API.callAdmin('updateQuestion', pollPayload({ id: item.id, enabled: !item.enabled }))
        .then(function () { notify('투표 내용 상태를 변경했습니다.', 'good'); return loadCandidates(); })
        .catch(fail);
    });
    var deleteBtn = UI.el('button', 'btn btn-ghost btn-sm', '삭제');
    deleteBtn.type = 'button';
    deleteBtn.style.color = 'var(--danger)';
    deleteBtn.addEventListener('click', function () {
      if (!window.confirm('이 투표 내용을 삭제할까요?')) return;
      API.callAdmin('deleteQuestion', pollPayload({ id: item.id }))
        .then(function () { notify('투표 내용을 삭제했습니다.', 'good'); return loadCandidates(); })
        .catch(fail);
    });
    row.appendChild(editBtn); row.appendChild(toggleBtn); row.appendChild(deleteBtn);
    actions.appendChild(row); tr.appendChild(actions);
    return tr;
  }

  function editCandidate(item) {
    var major = window.prompt('대주제', item.majorTopic); if (major === null || !major.trim()) return;
    var middle = window.prompt('중주제', item.middleTopic); if (middle === null || !middle.trim()) return;
    var sub = window.prompt('소주제', item.subTopic); if (sub === null || !sub.trim()) return;
    UI.show(busy, true);
    API.callAdmin('updateQuestion', pollPayload({ id: item.id, majorTopic: major.trim(), middleTopic: middle.trim(), subTopic: sub.trim() }))
      .then(function () { notify('투표 내용을 수정했습니다.', 'good'); return loadCandidates(); })
      .catch(fail)
      .then(function () { UI.show(busy, false); });
  }

  $('#candidateForm').addEventListener('submit', function (event) {
    event.preventDefault();
    if (!requirePoll()) return;
    var major = $('#candName').value.trim(), middle = $('#candMiddle').value.trim(), sub = $('#candDesc').value.trim();
    if (!major || !middle || !sub) return notify('대주제, 중주제, 소주제를 모두 입력해 주세요.', 'warn');
    var restore = UI.busyButton($('#candSubmit'), '추가 중…');
    API.callAdmin('createQuestion', pollPayload({ majorTopic: major, middleTopic: middle, subTopic: sub }))
      .then(function () {
        $('#candidateForm').reset();
        notify('투표 내용을 추가했습니다.', 'good');
        return loadCandidates();
      })
      .catch(fail)
      .then(restore);
  });

  $('#seedQuestionsBtn').addEventListener('click', function () {
    if (!requirePoll() || !window.confirm('계획서의 테스트 투표 내용 30개를 추가할까요?\n현재 투표 내용이 비어 있을 때만 가능합니다.')) return;
    var restore = UI.busyButton(this, '추가 중…');
    API.callAdmin('seedQuestions', { pollId: state.pollId }).then(function (data) {
      notify(data.count + '개의 테스트 투표 내용을 추가했습니다.', 'good'); return loadCandidates();
    }).catch(fail).then(restore);
  });

  $('#candRefresh').addEventListener('click', function () {
    var restore = UI.busyButton(this, '불러오는 중…');
    loadCandidates().then(restore, restore);
  });

  // ==========================================================
  // 투표 코드
  // ==========================================================

  function loadCodes() {
    if (!requirePoll()) return Promise.resolve();
    syncPollContext();
    if (!currentPoll().requireCode) {
      state.codes = [];
      renderCodes();
      return Promise.resolve();
    }
    return API.callAdmin('listVoteCodes', { pollId: state.pollId })
      .then(function (data) { state.codes = data.items || []; renderCodes(); })
      .catch(fail);
  }

  function renderCodes() {
    var keyword = $('#codeSearch').value.trim().toUpperCase();
    var filter = $('#codeFilter').value;
    var rows = state.codes.filter(function (item) {
      if (filter === 'used' && !item.used) return false;
      if (filter === 'unused' && item.used) return false;
      return !keyword || item.code.indexOf(keyword) !== -1;
    });
    var tbody = $('#codeTbody');
    UI.clear(tbody);
    UI.show($('#codeEmpty'), rows.length === 0);
    rows.slice(0, 300).forEach(function (item) {
      var tr = document.createElement('tr');
      tr.appendChild(UI.el('td', 'mono', item.code));
      var stateCell = UI.el('td');
      stateCell.appendChild(UI.el('span', 'badge ' + (item.used ? '' : 'badge-good'), item.used ? '사용됨' : '미사용'));
      tr.appendChild(stateCell);
      tr.appendChild(UI.el('td', 'small muted', item.used ? UI.formatDateTime(item.usedAt) : '-'));
      tr.appendChild(UI.el('td', null, item.used ? UI.formatNumber(item.usedAnswerCount) + '개' : '-'));
      tbody.appendChild(tr);
    });
  }

  $('#codeSearch').addEventListener('input', renderCodes);
  $('#codeFilter').addEventListener('change', renderCodes);
  $('#codeRefresh').addEventListener('click', function () {
    var restore = UI.busyButton(this, '불러오는 중…');
    loadCodes().then(restore, restore);
  });

  $('#codeForm').addEventListener('submit', function (event) {
    event.preventDefault();
    if (!requirePoll()) return;
    var count = parseInt($('#codeCount').value, 10);
    var length = parseInt($('#codeLength').value, 10);
    if (isNaN(count) || count < 1 || count > 500) return notify('생성 개수는 1~500 사이여야 합니다.', 'warn');
    var restore = UI.busyButton($('#codeSubmit'), '발급 중…');
    API.callAdmin('generateVoteCodes', pollPayload({ count: count, length: length }))
      .then(function (data) {
        state.lastCodes = data.codes || [];
        $('#codeResultLabel').textContent = '방금 생성된 코드 (' + state.lastCodes.length + '개)';
        $('#codeResult').textContent = state.lastCodes.join('\n');
        UI.show($('#codeResultBox'), true);
        notify(state.lastCodes.length + '개의 코드를 발급했습니다.', 'good');
        return loadCodes();
      })
      .catch(fail)
      .then(restore);
  });

  $('#copyCodesBtn').addEventListener('click', function () {
    var text = state.lastCodes.join('\n');
    if (!text) return;
    var button = this;
    function done(ok) { button.textContent = ok ? '복사됨' : '복사 실패'; setTimeout(function () { button.textContent = '복사'; }, 1500); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      return;
    }
    var textarea = document.createElement('textarea');
    textarea.value = text; textarea.style.position = 'fixed'; textarea.style.opacity = '0';
    document.body.appendChild(textarea); textarea.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(textarea); done(ok);
  });

  $('#downloadCodesBtn').addEventListener('click', function () {
    if (!state.lastCodes.length) return;
    var blob = new Blob(['﻿code\n' + state.lastCodes.join('\n') + '\n'], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url; link.download = 'vote-codes-' + state.pollId + '.csv';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  // ==========================================================
  // 설정 / 비밀번호 / 초기화
  // ==========================================================

  $('#setSave').addEventListener('click', function () {
    if (!requirePoll()) return;
    var title = $('#setTitle').value.trim();
    if (!title) return notify('투표 제목을 입력해 주세요.', 'warn');
    var restore = UI.busyButton(this, '저장 중…');
    API.callAdmin('updatePoll', pollPayload({
      title: title,
      description: $('#setDescription').value.trim(),
      voteOpen: $('#setOpen').checked,
      showResult: $('#setShowResult').checked,
      requireCode: $('#setRequireCode').checked,
      enabled: $('#setEnabled').checked
    }))
      .then(function () {
        notify('투표 설정을 저장했습니다.', 'good');
        return loadPolls().then(loadOverview);
      })
      .catch(fail)
      .then(restore);
  });

  $('#pwForm').addEventListener('submit', function (event) {
    event.preventDefault();
    var current = $('#pwCurrent').value;
    var next = $('#pwNew').value;
    if (next.length < 8) return notify('새 비밀번호는 8자 이상이어야 합니다.', 'warn');
    if (next !== $('#pwConfirm').value) return notify('새 비밀번호가 서로 일치하지 않습니다.', 'warn');
    if (next === current) return notify('현재 비밀번호와 다른 값을 사용해 주세요.', 'warn');
    var restore = UI.busyButton($('#pwSubmit'), '변경 중…');
    API.callAdmin('changePassword', { currentPassword: current, newPassword: next })
      .then(function () { $('#pwForm').reset(); notify('비밀번호를 변경했습니다.', 'good'); })
      .catch(fail)
      .then(restore);
  });

  $('#resetBtn').addEventListener('click', function () {
    if (!requirePoll()) return;
    var poll = currentPoll();
    if (!window.confirm('"' + poll.title + '"의 투표 기록을 모두 초기화할까요?')) return;
    var input = window.prompt('확인을 위해 RESET 을 입력해 주세요.');
    if (input === null || input.trim().toUpperCase() !== 'RESET') return notify('확인 문구가 일치하지 않아 취소했습니다.', 'warn');
    UI.show(busy, true);
    API.callAdmin('resetVotes', pollPayload({ confirm: 'RESET' }))
      .then(function () {
        state.lastCodes = [];
        UI.show($('#codeResultBox'), false);
        notify('선택한 투표 기록을 초기화했습니다.', 'good');
        return loadPolls().then(loadOverview);
      })
      .catch(fail)
      .then(function () { UI.show(busy, false); });
  });

  // ==========================================================
  // 작업 로그 / 로그아웃 / 시작
  // ==========================================================

  function loadAudit() {
    return API.callAdmin('getAuditLog', { limit: 200 })
      .then(function (data) {
        var tbody = $('#auditTbody');
        UI.clear(tbody);
        var items = data.items || [];
        UI.show($('#auditEmpty'), items.length === 0);
        items.forEach(function (item) {
          var tr = document.createElement('tr');
          tr.appendChild(UI.el('td', 'small muted', UI.formatDateTime(item.at)));
          tr.appendChild(UI.el('td', null, item.admin));
          tr.appendChild(UI.el('td', 'mono small', item.action));
          tr.appendChild(UI.el('td', 'small', item.detail));
          tbody.appendChild(tr);
        });
      })
      .catch(fail);
  }

  $('#auditRefresh').addEventListener('click', function () {
    var restore = UI.busyButton(this, '불러오는 중…');
    loadAudit().then(restore, restore);
  });

  $('#logoutBtn').addEventListener('click', function () {
    API.callAdmin('logout').catch(function () {}).then(function () {
      API.setToken('');
      location.replace('login.html');
    });
  });

  function start() {
    if (!UI.guardConfig(alertBox)) return $('#adminInfo').textContent = '설정 필요';
    if (!API.getToken()) return API.redirectToLogin();
    loadPolls().then(function () {
      if (state.pollId) loadOverview();
      else activate('polls');
    });
  }

  start();
})();
