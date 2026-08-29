// 화면 여러 개가 같이 쓰는 것만 모아 둔다. 화면별 로직은 index.js / login.html에 있다.
// ponytail: 번들러 없이 전역 스크립트 한 장. import가 필요할 만큼 커지면 그때 type="module"로.

// 백엔드는 별도 오리진이라 API 주소를 명시해야 하고, 세션 쿠키를 실으려면 credentials가 필요하다.
// ponytail: 환경 판별이 host 문자열 비교 한 줄. 배포 환경이 셋 이상 되면 빌드 타임 주입으로.
const API = location.hostname === 'localhost' ? 'http://localhost:8080' : 'https://drippedia.onrender.com';

/** 로그인 상태 확인. 200이면 사용자 정보, 401이면 null. 화면마다 null일 때 할 일이 다르다. */
const fetchMe = () => fetch(`${API}/api/me`, { credentials: 'include' })
  .then(res => res.ok ? res.json() : null)
  .catch(() => null);

/**
 * CSRF 토큰. 쓰기 요청은 이 값을 헤더로 되돌려줘야 통과한다.
 * 배포에서는 프론트(vercel.app)와 백엔드(onrender.com)가 다른 도메인이라 JS가 XSRF-TOKEN 쿠키를
 * 못 읽는다(쿠키는 도메인별로 격리된다). 그래서 값만 따로 받아 둔다 - 쿠키 자체는 브라우저가 실어 보낸다.
 * 로컬은 둘 다 localhost라 쿠키가 그대로 읽히고, 그땐 이 요청이 실패해도 아래 쿠키 폴백이 받아 준다.
 */
let csrfToken = null;

const loadCsrf = () => fetch(`${API}/api/csrf`, { credentials: 'include' })
  .then(res => res.ok ? res.json() : null)
  .then(body => csrfToken = body?.token ?? null)
  .catch(() => null);

const csrfHeader = () => {
  const cookie = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  const token = csrfToken ?? (cookie && decodeURIComponent(cookie[1]));
  return token ? { 'X-XSRF-TOKEN': token } : {};
};
