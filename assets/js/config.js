/**
 * 배포 환경 설정.
 *
 * Apps Script 를 "웹 앱"으로 배포하면 아래와 같은 URL 이 발급된다.
 *   https://script.google.com/macros/s/AKfycb.................../exec
 * 그 값을 API_URL 에 그대로 붙여넣는다.
 *
 * 이 URL 은 비밀값이 아니다. 공개되어도 관리자 기능은 토큰 없이는 동작하지 않는다.
 */
window.VOTE_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwjJXSssvMPEH6PoI33NbGgyp212MhHiVkQnOSXPRLUQ4knyt84iM15OUn2b5NUo9nb/exec',

  /** 관리자 세션 토큰을 보관할 sessionStorage 키 */
  TOKEN_KEY: 'vote_admin_token',

  /** 결과 페이지 자동 새로고침 간격(초). 0 이면 사용하지 않음. */
  RESULT_REFRESH_SECONDS: 20
};
