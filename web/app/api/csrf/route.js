/**
 * 프론트가 첫 진입에 부르던 자리. 이제 할 일이 없다.
 * 프론트/백이 같은 오리진이고 세션 쿠키가 SameSite=Lax라 cross-site 쓰기 요청에는
 * 쿠키 자체가 안 실린다 = CSRF가 이미 막혀 있다.
 * 프론트를 안 고치려고 모양만 남겨 둔다(빈 토큰이면 헤더를 안 붙인다).
 */
export function GET() {
  return Response.json({ token: '' });
}
