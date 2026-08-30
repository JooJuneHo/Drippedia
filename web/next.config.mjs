/**
 * 화면은 전부 public/(= frontend/ 복사본)의 정적 파일이다. 페이지 컴포넌트는 없고 API 라우트만 있다.
 * Next는 public/index.html을 "/"가 아니라 "/index.html"로만 주기 때문에 루트만 이어 준다.
 */
export default {
  async rewrites() {
    return [{ source: '/', destination: '/index.html' }];
  }
};
