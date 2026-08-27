/** index.html — 투표 목록 → 코드(선택) → 후보 선택 → 제출 */
(function () {
  'use strict';

  var $ = UI.$;
  var state = { polls: [], poll: null, candidates: [], code: '', selectedId: null };

  var els = {
    title: $('#voteTitle'), status: $('#voteStatus'), alert: $('#globalAlert'), busy: $('#busy'),
    resultLink: $('#resultLink'),
    stepPolls: $('#stepPolls'), stepCode: $('#stepCode'), stepSelect: $('#stepSelect'),
    stepDone: $('#stepDone'), stepClosed: $('#stepClosed'), pollList: $('#pollList'),
    codeForm: $('#codeForm'), codeInput: $('#voteCode'), codeSubmit: $('#codeSubmit'),
    codePollBack: $('#codePollBack'), selectBackBtn: $('#selectBackBtn'), selectHint: $('#selectHint'),
    list: $('#candidateList'), submitBtn: $('#submitBtn'), doneDetail: $('#doneDetail'),
    doneResultLink: $('#doneResultLink'), againBtn: $('#againBtn'), donePollsBtn: $('#donePollsBtn'),
    closedTitle: $('#closedTitle'), closedDetail: $('#closedDetail'), closedBackBtn: $('#closedBackBtn')
  };

  function step(name) {
    UI.show(els.stepPolls, name === 'polls');
    UI.show(els.stepCode, name === 'code');
    UI.show(els.stepSelect, name === 'select');
    UI.show(els.stepDone, name === 'done');
    UI.show(els.stepClosed, name === 'closed');
  }

  function scrollTop() { window.scrollTo(0, 0); }

  function showPolls() {
    state.poll = null;
    state.candidates = [];
    state.code = '';
    state.selectedId = null;
    document.title = '투표 목록';
    els.title.textContent = '투표 목록';
    els.status.textContent = state.polls.length + '개의 투표';
    els.resultLink.href = 'result.html';
    UI.notify(els.alert, '');
    step('polls');
    scrollTop();
  }

  function showClosed(title, detail) {
    els.closedTitle.textContent = title;
    els.closedDetail.textContent = detail;
    step('closed');
    scrollTop();
  }

  function renderPolls() {
    UI.clear(els.pollList);
    if (state.polls.length === 0) {
      els.pollList.appendChild(UI.el('div', 'empty', '등록된 투표가 없습니다.'));
      return;
    }

    state.polls.forEach(function (poll) {
      var button = UI.el('button', 'poll-item');
      button.type = 'button';

      var top = UI.el('div', 'poll-item-head');
      top.appendChild(UI.el('strong', null, poll.title));
      var badge = UI.el('span', 'badge ' + (poll.voteOpen ? 'badge-good' : 'badge-warn'), poll.voteOpen ? '진행 중' : '종료');
      top.appendChild(badge);
      button.appendChild(top);

      if (poll.description) button.appendChild(UI.el('p', 'poll-description', poll.description));
      var meta = poll.requireCode ? '투표 코드 필요' : '코드 없이 반복 참여 가능';
      button.appendChild(UI.el('span', 'small muted', meta));
      button.addEventListener('click', function () { selectPoll(poll.id); });
      els.pollList.appendChild(button);
    });
  }

  function loadPolls() {
    if (!UI.guardConfig(els.alert)) {
      els.status.textContent = '설정 필요';
      return Promise.resolve();
    }
    els.status.textContent = '불러오는 중…';
    return API.call('listPolls')
      .then(function (data) {
        state.polls = data.items || [];
        renderPolls();
        showPolls();

        var params = new URLSearchParams(location.search);
        var requested = params.get('poll');
        if (requested && state.polls.some(function (poll) { return poll.id === requested; })) {
          selectPoll(requested);
        }
      })
      .catch(function (err) {
        els.status.textContent = '연결 실패';
        UI.notify(els.alert, err.message, 'danger');
      });
  }

  function selectPoll(pollId) {
    UI.notify(els.alert, '');
    UI.show(els.busy, true);
    API.call('getPublicState', { pollId: pollId })
      .then(function (data) {
        state.poll = data.poll;
        state.candidates = data.candidates || [];
        state.code = '';
        state.selectedId = null;

        document.title = data.title || '투표';
        els.title.textContent = data.title || '투표';
        els.status.textContent = data.voteOpen ? '투표 진행 중' : '투표 종료';
        els.resultLink.href = 'result.html?poll=' + encodeURIComponent(state.poll.id);
        els.doneResultLink.href = els.resultLink.href;

        if (!data.voteOpen) {
          showClosed('투표가 진행 중이 아닙니다', '다른 투표를 선택하거나 투표 시작 후 다시 확인해 주세요.');
          return;
        }
        if (state.candidates.length === 0) {
          showClosed('등록된 후보가 없습니다', '관리자가 후보를 등록하면 참여할 수 있습니다.');
          return;
        }

        renderCandidates();
        if (data.requireCode) {
          els.codeInput.value = '';
          step('code');
          setTimeout(function () { els.codeInput.focus(); }, 0);
        } else {
          prepareSelection();
          step('select');
        }
        scrollTop();
      })
      .catch(function (err) { UI.notify(els.alert, err.message, 'danger'); })
      .then(function () { UI.show(els.busy, false); });
  }

  function renderCandidates() {
    UI.clear(els.list);
    state.candidates.forEach(function (candidate) {
      var label = UI.el('label', 'candidate');
      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'candidate';
      radio.value = candidate.id;

      var body = UI.el('div');
      body.appendChild(UI.el('div', 'c-name', candidate.name));
      if (candidate.description) body.appendChild(UI.el('div', 'c-desc', candidate.description));
      label.appendChild(radio);
      label.appendChild(body);

      radio.addEventListener('change', function () {
        state.selectedId = candidate.id;
        UI.$$('.candidate', els.list).forEach(function (node) { node.classList.remove('selected'); });
        label.classList.add('selected');
        els.submitBtn.disabled = false;
      });
      els.list.appendChild(label);
    });
  }

  function prepareSelection() {
    state.selectedId = null;
    els.submitBtn.disabled = true;
    UI.$$('.candidate', els.list).forEach(function (node) {
      node.classList.remove('selected');
      var radio = node.querySelector('input');
      if (radio) radio.checked = false;
    });
    els.selectHint.textContent = state.poll.requireCode
      ? '코드 확인 완료 · 한 명만 선택할 수 있습니다.'
      : '코드 없이 참여하는 투표입니다. 한 명을 선택해 주세요.';
  }

  els.codeInput.addEventListener('input', function () {
    var cleaned = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned !== this.value) this.value = cleaned;
  });

  els.codeForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var code = els.codeInput.value.trim().toUpperCase();
    if (!code) return UI.notify(els.alert, '투표 코드를 입력해 주세요.', 'warn');

    UI.notify(els.alert, '');
    var restore = UI.busyButton(els.codeSubmit, '확인 중…');
    API.call('checkVoteCode', { pollId: state.poll.id, voteCode: code })
      .then(function () {
        state.code = code;
        prepareSelection();
        step('select');
        scrollTop();
      })
      .catch(function (err) {
        UI.notify(els.alert, err.message, 'danger');
        els.codeInput.select();
      })
      .then(restore);
  });

  els.submitBtn.addEventListener('click', function () {
    if (!state.poll || !state.selectedId) return;
    var candidate = state.candidates.filter(function (item) { return item.id === state.selectedId; })[0];
    if (!candidate || !window.confirm('"' + candidate.name + '"에 투표할까요?')) return;

    UI.notify(els.alert, '');
    UI.show(els.busy, true);
    els.submitBtn.disabled = true;
    API.call('vote', { pollId: state.poll.id, voteCode: state.code, candidateId: state.selectedId })
      .then(function (data) {
        els.doneDetail.textContent = (data.candidateName || candidate.name) + ' · ' + UI.formatDateTime(data.votedAt);
        els.againBtn.textContent = state.poll.requireCode ? '다른 코드로 투표' : '한 번 더 투표';
        step('done');
        scrollTop();
      })
      .catch(function (err) {
        UI.notify(els.alert, err.message, 'danger');
        els.submitBtn.disabled = false;
        if (err.code === 'CODE_ALREADY_USED' || err.code === 'CODE_NOT_FOUND') {
          state.code = '';
          els.codeInput.value = '';
          step('code');
        } else if (err.code === 'VOTE_CLOSED' || err.code === 'POLL_NOT_FOUND') {
          showPolls();
        }
      })
      .then(function () { UI.show(els.busy, false); });
  });

  function returnFromSelection() {
    UI.notify(els.alert, '');
    if (state.poll && state.poll.requireCode) step('code');
    else showPolls();
    scrollTop();
  }

  els.codePollBack.addEventListener('click', showPolls);
  els.selectBackBtn.addEventListener('click', returnFromSelection);
  els.closedBackBtn.addEventListener('click', showPolls);
  els.donePollsBtn.addEventListener('click', showPolls);
  els.againBtn.addEventListener('click', function () {
    if (!state.poll) return showPolls();
    state.code = '';
    els.codeInput.value = '';
    prepareSelection();
    step(state.poll.requireCode ? 'code' : 'select');
    scrollTop();
  });

  loadPolls();
})();
