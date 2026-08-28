/** result.html — 투표 목록 및 선택한 투표의 결과 표시 */
(function () {
  'use strict';

  var $ = UI.$;
  var els = {
    title: $('#resultTitle'), status: $('#resultStatus'), alert: $('#globalAlert'), voteLink: $('#voteLink'),
    pollListCard: $('#pollListCard'), pollList: $('#resultPollList'), card: $('#resultCard'),
    hiddenCard: $('#hiddenCard'), hiddenTitle: $('#hiddenTitle'), hiddenDetail: $('#hiddenDetail'),
    hiddenRefreshBtn: $('#hiddenRefreshBtn'), hiddenBackBtn: $('#hiddenBackBtn'), resultBackBtn: $('#resultBackBtn'),
    statTotal: $('#statTotal'), statCandidates: $('#statCandidates'), statTop: $('#statTop'),
    list: $('#resultList'), refreshBtn: $('#refreshBtn'), updatedAt: $('#updatedAt')
  };

  var state = { polls: [], pollId: '' };
  var timer = null;
  var loading = false;

  function showOnly(name) {
    UI.show(els.pollListCard, name === 'polls');
    UI.show(els.card, name === 'result');
    UI.show(els.hiddenCard, name === 'hidden');
  }

  function showPolls() {
    state.pollId = '';
    stopAutoRefresh();
    document.title = '투표 결과';
    els.title.textContent = '투표 결과';
    els.status.textContent = state.polls.length + '개의 투표';
    els.voteLink.href = 'index.html';
    UI.notify(els.alert, '');
    showOnly('polls');
    window.scrollTo(0, 0);
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
      var head = UI.el('div', 'poll-item-head');
      head.appendChild(UI.el('strong', null, poll.title));
      head.appendChild(UI.el('span', 'badge ' + (poll.showResult ? 'badge-accent' : ''), poll.showResult ? '결과 공개' : '비공개'));
      button.appendChild(head);
      if (poll.description) button.appendChild(UI.el('p', 'poll-description', poll.description));
      button.addEventListener('click', function () { selectPoll(poll.id); });
      els.pollList.appendChild(button);
    });
  }

  function render(data) {
    document.title = (data.title || '투표') + ' 결과';
    els.title.textContent = (data.title || '투표') + ' 결과';
    els.status.textContent = data.voteOpen ? '투표 진행 중 · 중간 집계' : '투표 종료 · 최종 집계';
    els.voteLink.href = 'index.html?poll=' + encodeURIComponent(state.pollId);

    var items = data.items || [];
    var total = data.totalVotes || 0;
    els.statTotal.textContent = UI.formatNumber(total);
    els.statCandidates.textContent = UI.formatNumber(items.length);

    els.statTop.textContent = UI.formatNumber(data.totalAnswers || 0);

    UI.clear(els.list);
    if (items.length === 0) els.list.appendChild(UI.el('div', 'empty', '등록된 투표 내용이 없습니다.'));
    items.forEach(function (item) {
      var row = UI.el('div', 'result-row');
      row.appendChild(UI.el('div', 'r-name', item.majorTopic + ' › ' + item.middleTopic + ' › ' + item.subTopic));
      (item.optionResults || []).forEach(function (result) {
        var head = UI.el('div', 'r-head option-result-head'); head.appendChild(UI.el('span', null, result.option));
        head.appendChild(UI.el('span', 'r-count', UI.formatNumber(result.count) + '표 · ' + result.percent + '%'));
        var bar = UI.el('div', 'bar'), fill = UI.el('span'); bar.appendChild(fill); row.appendChild(head); row.appendChild(bar);
        requestAnimationFrame(function () { fill.style.width = (result.count ? Math.max(result.percent, 1.5) : 0) + '%'; });
      });
      els.list.appendChild(row);
    });

    els.updatedAt.textContent = '갱신 ' + UI.formatDateTime(new Date().toISOString());
    showOnly('result');
  }

  function loadResult(silent) {
    if (!state.pollId || loading) return Promise.resolve();
    loading = true;
    if (!silent) UI.notify(els.alert, '');

    var payload = { pollId: state.pollId };
    var token = API.getToken();
    if (token) payload.token = token;

    return API.call('getResults', payload)
      .then(render)
      .catch(function (err) {
        if (err.code === 'RESULT_HIDDEN') {
          var poll = state.polls.filter(function (item) { return item.id === state.pollId; })[0];
          els.title.textContent = ((poll && poll.title) || '투표') + ' 결과';
          els.status.textContent = '비공개';
          showOnly('hidden');
          return;
        }
        UI.notify(els.alert, err.message, 'danger');
        if (err.code === 'POLL_NOT_FOUND') showPolls();
      })
      .then(function () { loading = false; });
  }

  function selectPoll(pollId) {
    state.pollId = String(pollId);
    els.voteLink.href = 'index.html?poll=' + encodeURIComponent(state.pollId);
    loadResult(false);
    startAutoRefresh();
    window.scrollTo(0, 0);
  }

  function startAutoRefresh() {
    var seconds = (window.VOTE_CONFIG && window.VOTE_CONFIG.RESULT_REFRESH_SECONDS) || 0;
    stopAutoRefresh();
    if (seconds <= 0) return;
    timer = setInterval(function () { if (!document.hidden) loadResult(true); }, seconds * 1000);
  }

  function stopAutoRefresh() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function refresh(button) {
    var restore = UI.busyButton(button, '불러오는 중…');
    loadResult(false).then(restore, restore);
  }

  els.refreshBtn.addEventListener('click', function () { refresh(els.refreshBtn); });
  els.hiddenRefreshBtn.addEventListener('click', function () { refresh(els.hiddenRefreshBtn); });
  els.resultBackBtn.addEventListener('click', showPolls);
  els.hiddenBackBtn.addEventListener('click', showPolls);

  function init() {
    if (!UI.guardConfig(els.alert)) {
      els.status.textContent = '설정 필요';
      return;
    }
    API.call('listPolls')
      .then(function (data) {
        state.polls = data.items || [];
        renderPolls();
        var requested = new URLSearchParams(location.search).get('poll');
        if (requested) selectPoll(requested);
        else showPolls();
      })
      .catch(function (err) {
        els.status.textContent = '연결 실패';
        UI.notify(els.alert, err.message, 'danger');
      });
  }

  init();
})();
