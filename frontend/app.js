// 화면 여러 개가 같이 쓰는 것만 모아 둔다. 화면별 로직은 index.js / login.html에 있다.
// ponytail: 번들러 없이 전역 스크립트 한 장. import가 필요할 만큼 커지면 그때 type="module"로.

// 백엔드는 별도 오리진이라 API 주소를 명시해야 하고, 세션 쿠키를 실으려면 credentials가 필요하다.
// ponytail: 환경 판별이 host 문자열 비교 한 줄. 배포 환경이 셋 이상 되면 빌드 타임 주입으로.
const API = location.hostname === 'localhost' ? 'http://localhost:8080' : 'https://api.drippedia.com';

/** 로그인 상태 확인. 200이면 사용자 정보, 401이면 null. 화면마다 null일 때 할 일이 다르다. */
const fetchMe = () => fetch(`${API}/api/me`, { credentials: 'include' })
  .then(res => res.ok ? res.json() : null)
  .catch(() => null);

/** POST는 CSRF 토큰을 헤더로 되돌려줘야 통과한다. 토큰은 백엔드가 내려준 쿠키에 들어 있다. */
const csrfHeader = () => {
  const token = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return token ? { 'X-XSRF-TOKEN': decodeURIComponent(token[1]) } : {};
};
