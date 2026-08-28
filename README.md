# 투표 시스템 (GitHub Pages + Apps Script + Google Sheets)

서버 없이 운영하는 모바일 우선 소규모 다중 투표 플랫폼.
프론트엔드는 순수 HTML/CSS/바닐라 JS이며, 백엔드는 Google Apps Script, 데이터 저장소는 Google Sheets다.

```
GitHub Pages (정적 UI)  →  Apps Script Web App (API/인증/검증)  →  Google Spreadsheet (DB)
```

## 화면

| 경로 | 설명 |
|---|---|
| `index.html` | 대주제 → 중주제 → 소주제 선택 → 해당 항목 예/아니오 투표 |
| `result.html` | 투표별 결과 집계 (관리자가 공개했을 때) |
| `admin/login.html` | 관리자 로그인 |
| `admin/dashboard.html` | 집계 · 투표 내용 관리 · 코드 발급 · 설정 · 작업 로그 |

## 시작하기

1. **백엔드 배포** — [`appscript/SETUP.md`](appscript/SETUP.md) 를 순서대로 따라 한다.
2. **API 주소 연결** — 발급받은 웹 앱 URL을 `assets/js/config.js` 의 `API_URL` 에 넣는다.
3. **GitHub Pages 배포** — 저장소 Settings → Pages → Source를 `main` 브랜치 루트로 지정한다.

빌드 과정이 없으므로 파일을 그대로 올리면 된다. 로컬에서는 `index.html` 을 브라우저로 직접 열어도 동작한다.

## 운영 순서

1. 관리자 로그인 후 **비밀번호를 먼저 변경**한다.
2. 투표를 만들거나 기본 투표를 선택한다.
3. **투표 관리**에서 대주제를 만들고, **투표 내용 관리**에서 그 아래 중주제와 독립 소주제 투표를 등록한다.
   계획서 데이터가 필요하면 Apps Script에서 `addTestData()`를 별도로 실행한다.
4. 코드 사용 투표라면 참가자 수만큼 코드를 발급한다. 코드 사용을 끄면 반복 투표가 허용된다.
5. 설정에서 **투표 진행**을 켠다.
6. 종료 시 **투표 진행**을 끄고 **결과 공개**를 켠다.

## 보안 관련 참고

- Apps Script 웹 앱 URL은 비밀값이 아니다. 프론트엔드 코드에 노출되는 것이 정상이다.
- 관리자 페이지 주소를 숨기는 것은 보안이 아니다. `admin/dashboard.html` 에 직접 접근할 수 있어도, 유효한 세션 토큰 없이는 어떤 관리자 API도 동작하지 않는다.
- 관리자 비밀번호는 시트에 `sha256:<salt>:<hash>` 형식으로만 저장된다.
- Spreadsheet ID는 `appscript/Code.gs` 안에만 존재하며 프론트엔드에는 없다.

**적합한 범위:** 사내 투표, 정책 설문, 동아리·커뮤니티 행사, 팀 의사결정.
**적합하지 않은 범위:** 금전적 이해관계가 크거나 법적 효력이 필요한 공식 선거.

## 문서

- [`CLAUDE.md`](CLAUDE.md) — 개발 규칙, API 규약, 시트 스키마
- [`appscript/SETUP.md`](appscript/SETUP.md) — 백엔드 설치 및 문제 해결
- [`github-pages-appscript-voting-system-design.html`](github-pages-appscript-voting-system-design.html) — 원본 설계서
