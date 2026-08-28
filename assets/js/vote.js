/** 대주제(투표) → 중주제 → 소주제 → 예/아니오 단건 투표 */
(function () {
  'use strict';
  var $ = UI.$;
  var state = { polls: [], poll: null, questions: [], code: '', middle: '', question: null, answer: '', completed: false };
  var els = { title: $('#voteTitle'), status: $('#voteStatus'), alert: $('#globalAlert'), busy: $('#busy'), resultLink: $('#resultLink'),
    stepPolls: $('#stepPolls'), stepCode: $('#stepCode'), stepSelect: $('#stepSelect'), stepDone: $('#stepDone'), stepClosed: $('#stepClosed'),
    pollList: $('#pollList'), codeForm: $('#codeForm'), codeInput: $('#voteCode'), codeSubmit: $('#codeSubmit'), codePollBack: $('#codePollBack'),
    selectBackBtn: $('#selectBackBtn'), selectHint: $('#selectHint'), list: $('#candidateList'), submitBtn: $('#submitBtn'), doneDetail: $('#doneDetail'),
    doneResultLink: $('#doneResultLink'), againBtn: $('#againBtn'), donePollsBtn: $('#donePollsBtn'), closedTitle: $('#closedTitle'),
    closedDetail: $('#closedDetail'), closedBackBtn: $('#closedBackBtn') };
  function step(name) { ['Polls', 'Code', 'Select', 'Done', 'Closed'].forEach(function (key) { UI.show(els['step' + key], name === key.toLowerCase()); }); }
  function top() { window.scrollTo(0, 0); }
  function showPolls() {
    state.poll = null; state.questions = []; state.code = ''; state.middle = ''; state.question = null; state.answer = '';
    document.title = '투표 선택'; els.title.textContent = '투표 선택'; els.status.textContent = state.polls.length + '개의 투표';
    els.resultLink.href = 'result.html'; UI.notify(els.alert, ''); step('polls'); top();
  }
  function showClosed(title, detail) { els.closedTitle.textContent = title; els.closedDetail.textContent = detail; step('closed'); top(); }
  function itemButton(title, detail, click) {
    var button = UI.el('button', 'poll-item'); button.type = 'button'; button.appendChild(UI.el('strong', null, title));
    if (detail) button.appendChild(UI.el('p', 'poll-description', detail)); button.addEventListener('click', click); return button;
  }
  function renderPolls() {
    UI.clear(els.pollList); if (!state.polls.length) return els.pollList.appendChild(UI.el('div', 'empty', '등록된 투표가 없습니다.'));
    state.polls.forEach(function (poll) {
      var button = itemButton(poll.title, poll.description, function () { selectPoll(poll.id); });
      var badge = UI.el('span', 'badge ' + (poll.voteOpen ? 'badge-good' : 'badge-warn'), poll.voteOpen ? '진행 중' : '종료');
      button.insertBefore(badge, button.firstChild); els.pollList.appendChild(button);
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
      state.poll = data.poll; state.questions = data.questions || []; state.code = ''; state.middle = ''; state.question = null;
      document.title = data.title || '투표'; els.title.textContent = data.title || '투표'; els.status.textContent = data.voteOpen ? '중주제를 선택하세요' : '투표 종료';
      els.resultLink.href = els.doneResultLink.href = 'result.html?poll=' + encodeURIComponent(state.poll.id);
      if (!data.voteOpen) return showClosed('투표가 진행 중이 아닙니다', '다른 투표를 선택하거나 투표 시작 후 다시 확인해 주세요.');
      if (!state.questions.length) return showClosed('등록된 소주제 투표가 없습니다', '관리자가 중주제와 소주제를 등록하면 참여할 수 있습니다.');
      if (data.requireCode) { els.codeInput.value = ''; step('code'); setTimeout(function () { els.codeInput.focus(); }, 0); }
      else { renderMiddles(); step('select'); } top();
    }).catch(function (err) { UI.notify(els.alert, err.message, 'danger'); }).then(function () { UI.show(els.busy, false); });
  }
  function renderMiddles() {
    state.middle = ''; state.question = null; state.answer = ''; UI.clear(els.list); UI.show(els.submitBtn, false);
    els.selectHint.textContent = state.poll.title + '의 항목을 선택하세요.'; els.selectBackBtn.textContent = '← 투표 선택';
    var seen = {};
    state.questions.forEach(function (q) { if (seen[q.middleTopic]) return; seen[q.middleTopic] = true;
      els.list.appendChild(itemButton(q.middleTopic, '', function () { renderSubs(q.middleTopic); })); });
  }
  function renderSubs(middle) {
    state.middle = middle; state.question = null; state.answer = ''; UI.clear(els.list); UI.show(els.submitBtn, false);
    els.selectHint.textContent = state.poll.title + ' › ' + middle; els.selectBackBtn.textContent = '← 중주제 선택';
    state.questions.filter(function (q) { return q.middleTopic === middle; }).forEach(function (q) {
      els.list.appendChild(itemButton(q.subTopic, '이 항목에 투표하기', function () { renderAnswer(q); }));
    }); top();
  }
  function renderAnswer(question) {
    state.question = question; state.answer = ''; UI.clear(els.list); UI.show(els.submitBtn, true); els.submitBtn.disabled = true;
    els.selectBackBtn.textContent = '← 소주제 선택'; els.selectHint.textContent = state.poll.title + ' › ' + question.middleTopic;
    var card = UI.el('fieldset', 'question-card'); card.appendChild(UI.el('legend', null, question.subTopic)); var choices = UI.el('div', 'answer-choices');
    (question.options || []).forEach(function (answer) { var label = UI.el('label', 'answer-choice'), radio = document.createElement('input');
      radio.type = 'radio'; radio.name = 'answer'; radio.value = answer; label.appendChild(radio); label.appendChild(document.createTextNode(answer));
      radio.addEventListener('change', function () { state.answer = answer; els.submitBtn.disabled = false; }); choices.appendChild(label); });
    card.appendChild(choices); els.list.appendChild(card); top();
  }
  els.codeInput.addEventListener('input', function () { this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  els.codeForm.addEventListener('submit', function (event) { event.preventDefault(); var code = els.codeInput.value.trim().toUpperCase();
    if (!code) return UI.notify(els.alert, '투표 코드를 입력해 주세요.', 'warn'); var restore = UI.busyButton(els.codeSubmit, '확인 중…');
    API.call('checkVoteCode', { pollId: state.poll.id, voteCode: code }).then(function () { state.code = code; renderMiddles(); step('select'); top(); })
      .catch(function (err) { UI.notify(els.alert, err.message, 'danger'); els.codeInput.select(); }).then(restore); });
  els.submitBtn.addEventListener('click', function () {
    if (!state.question || !state.answer || !window.confirm('"' + state.answer + '"로 투표할까요?')) return;
    UI.show(els.busy, true); els.submitBtn.disabled = true;
    API.call('vote', { pollId: state.poll.id, voteCode: state.code, questionId: state.question.id, answer: state.answer }).then(function (data) {
      state.completed = !!data.completed; els.doneDetail.textContent = data.middleTopic + ' › ' + data.subTopic + ' · ' + data.answer;
      els.againBtn.textContent = state.completed ? '다른 코드로 투표' : '다른 소주제 투표'; step('done'); top();
    }).catch(function (err) { UI.notify(els.alert, err.message, 'danger'); els.submitBtn.disabled = false;
      if (err.code === 'CODE_ALREADY_USED' || err.code === 'CODE_NOT_FOUND') { state.code = ''; els.codeInput.value = ''; step('code'); }
    }).then(function () { UI.show(els.busy, false); });
  });
  els.selectBackBtn.addEventListener('click', function () { if (state.question) renderSubs(state.middle); else if (state.middle) renderMiddles(); else showPolls(); });
  els.codePollBack.addEventListener('click', showPolls); els.closedBackBtn.addEventListener('click', showPolls); els.donePollsBtn.addEventListener('click', showPolls);
  els.againBtn.addEventListener('click', function () { if (state.completed) { state.code = ''; els.codeInput.value = ''; step('code'); } else { renderMiddles(); step('select'); } top(); });
  loadPolls();
})();
