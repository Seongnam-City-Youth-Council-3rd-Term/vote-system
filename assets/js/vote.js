/** 투표 목록 → 코드 확인 → 소주제별 예/아니오 응답 → 일괄 제출 */
(function () {
  'use strict';
  var $ = UI.$;
  var state = { polls: [], poll: null, questions: [], code: '', answers: {} };
  var els = { title: $('#voteTitle'), status: $('#voteStatus'), alert: $('#globalAlert'), busy: $('#busy'), resultLink: $('#resultLink'),
    stepPolls: $('#stepPolls'), stepCode: $('#stepCode'), stepSelect: $('#stepSelect'), stepDone: $('#stepDone'), stepClosed: $('#stepClosed'),
    pollList: $('#pollList'), codeForm: $('#codeForm'), codeInput: $('#voteCode'), codeSubmit: $('#codeSubmit'), codePollBack: $('#codePollBack'),
    selectBackBtn: $('#selectBackBtn'), selectHint: $('#selectHint'), list: $('#candidateList'), submitBtn: $('#submitBtn'), doneDetail: $('#doneDetail'),
    doneResultLink: $('#doneResultLink'), againBtn: $('#againBtn'), donePollsBtn: $('#donePollsBtn'), closedTitle: $('#closedTitle'),
    closedDetail: $('#closedDetail'), closedBackBtn: $('#closedBackBtn') };
  function step(name) { ['Polls', 'Code', 'Select', 'Done', 'Closed'].forEach(function (key) { UI.show(els['step' + key], name === key.toLowerCase()); }); }
  function top() { window.scrollTo(0, 0); }
  function showPolls() {
    state.poll = null; state.questions = []; state.code = ''; state.answers = {};
    document.title = '투표 목록'; els.title.textContent = '투표 목록'; els.status.textContent = state.polls.length + '개의 투표';
    els.resultLink.href = 'result.html'; UI.notify(els.alert, ''); step('polls'); top();
  }
  function showClosed(title, detail) { els.closedTitle.textContent = title; els.closedDetail.textContent = detail; step('closed'); top(); }
  function renderPolls() {
    UI.clear(els.pollList);
    if (!state.polls.length) return els.pollList.appendChild(UI.el('div', 'empty', '등록된 투표가 없습니다.'));
    state.polls.forEach(function (poll) {
      var button = UI.el('button', 'poll-item'); button.type = 'button'; var head = UI.el('div', 'poll-item-head');
      head.appendChild(UI.el('strong', null, poll.title)); head.appendChild(UI.el('span', 'badge ' + (poll.voteOpen ? 'badge-good' : 'badge-warn'), poll.voteOpen ? '진행 중' : '종료'));
      button.appendChild(head); if (poll.description) button.appendChild(UI.el('p', 'poll-description', poll.description));
      button.appendChild(UI.el('span', 'small muted', poll.requireCode ? '투표 코드 필요' : '코드 없이 반복 참여 가능'));
      button.addEventListener('click', function () { selectPoll(poll.id); }); els.pollList.appendChild(button);
    });
  }
  function loadPolls() {
    if (!UI.guardConfig(els.alert)) { els.status.textContent = '설정 필요'; return Promise.resolve(); }
    return API.call('listPolls').then(function (data) {
      state.polls = data.items || []; renderPolls(); showPolls(); var requested = new URLSearchParams(location.search).get('poll');
      if (requested && state.polls.some(function (poll) { return poll.id === requested; })) selectPoll(requested);
    }).catch(function (err) { els.status.textContent = '연결 실패'; UI.notify(els.alert, err.message, 'danger'); });
  }
  function selectPoll(id) {
    UI.notify(els.alert, ''); UI.show(els.busy, true);
    API.call('getPublicState', { pollId: id }).then(function (data) {
      state.poll = data.poll; state.questions = data.questions || []; state.answers = {}; state.code = '';
      document.title = data.title || '투표'; els.title.textContent = data.title || '투표'; els.status.textContent = data.voteOpen ? '투표 진행 중' : '투표 종료';
      els.resultLink.href = els.doneResultLink.href = 'result.html?poll=' + encodeURIComponent(state.poll.id);
      if (!data.voteOpen) return showClosed('투표가 진행 중이 아닙니다', '다른 투표를 선택하거나 투표 시작 후 다시 확인해 주세요.');
      if (!state.questions.length) return showClosed('등록된 투표 내용이 없습니다', '관리자가 투표 내용을 등록하면 참여할 수 있습니다.');
      renderQuestions(); if (data.requireCode) { els.codeInput.value = ''; step('code'); setTimeout(function () { els.codeInput.focus(); }, 0); } else step('select'); top();
    }).catch(function (err) { UI.notify(els.alert, err.message, 'danger'); }).then(function () { UI.show(els.busy, false); });
  }
  function renderQuestions() {
    UI.clear(els.list); state.answers = {}; els.submitBtn.disabled = true; var lastMajor = '', lastMiddle = '';
    state.questions.forEach(function (q) {
      if (q.majorTopic !== lastMajor) { els.list.appendChild(UI.el('h3', 'topic-major', q.majorTopic)); lastMajor = q.majorTopic; lastMiddle = ''; }
      if (q.middleTopic !== lastMiddle) { els.list.appendChild(UI.el('h4', 'topic-middle', q.middleTopic)); lastMiddle = q.middleTopic; }
      var card = UI.el('fieldset', 'question-card'); card.appendChild(UI.el('legend', null, q.subTopic)); var choices = UI.el('div', 'answer-choices');
      ['예', '아니오'].forEach(function (answer) { var label = UI.el('label', 'answer-choice'), radio = document.createElement('input');
        radio.type = 'radio'; radio.name = 'question-' + q.id; radio.value = answer; label.appendChild(radio); label.appendChild(document.createTextNode(answer));
        radio.addEventListener('change', function () { state.answers[q.id] = answer; updateProgress(); }); choices.appendChild(label); });
      card.appendChild(choices); els.list.appendChild(card);
    }); updateProgress();
  }
  function updateProgress() { var done = Object.keys(state.answers).length; els.selectHint.textContent = done + ' / ' + state.questions.length + '개 응답 완료'; els.submitBtn.disabled = done !== state.questions.length; }
  els.codeInput.addEventListener('input', function () { this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  els.codeForm.addEventListener('submit', function (event) { event.preventDefault(); var code = els.codeInput.value.trim().toUpperCase();
    if (!code) return UI.notify(els.alert, '투표 코드를 입력해 주세요.', 'warn'); var restore = UI.busyButton(els.codeSubmit, '확인 중…');
    API.call('checkVoteCode', { pollId: state.poll.id, voteCode: code }).then(function () { state.code = code; renderQuestions(); step('select'); top(); })
      .catch(function (err) { UI.notify(els.alert, err.message, 'danger'); els.codeInput.select(); }).then(restore); });
  els.submitBtn.addEventListener('click', function () {
    if (Object.keys(state.answers).length !== state.questions.length || !window.confirm('모든 응답을 제출할까요?')) return;
    var answers = state.questions.map(function (q) { return { questionId: q.id, answer: state.answers[q.id] }; }); UI.show(els.busy, true); els.submitBtn.disabled = true;
    API.call('vote', { pollId: state.poll.id, voteCode: state.code, answers: answers }).then(function (data) {
      els.doneDetail.textContent = data.answerCount + '개 항목 응답 · ' + UI.formatDateTime(data.votedAt); step('done'); top();
    }).catch(function (err) { UI.notify(els.alert, err.message, 'danger'); els.submitBtn.disabled = false;
      if (err.code === 'CODE_ALREADY_USED' || err.code === 'CODE_NOT_FOUND') { state.code = ''; els.codeInput.value = ''; step('code'); }
    }).then(function () { UI.show(els.busy, false); });
  });
  els.codePollBack.addEventListener('click', showPolls); els.closedBackBtn.addEventListener('click', showPolls); els.donePollsBtn.addEventListener('click', showPolls);
  els.selectBackBtn.addEventListener('click', function () { if (state.poll.requireCode) step('code'); else showPolls(); top(); });
  els.againBtn.addEventListener('click', function () { state.code = ''; els.codeInput.value = ''; renderQuestions(); step(state.poll.requireCode ? 'code' : 'select'); top(); });
  loadPolls();
})();
