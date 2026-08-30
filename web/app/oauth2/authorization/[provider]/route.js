import { signIn } from '../../../../auth.js';

/**
 * 스프링이 쓰던 로그인 시작 주소를 그대로 유지한다(login.html이 이 주소를 링크로 건다).
 * 실제 처리는 Auth.js가 하고, 끝나면 홈으로 돌려보낸다.
 */
export async function GET(_request, { params }) {
  const { provider } = await params;
  if (provider !== 'google' && provider !== 'kakao') {
    return new Response(null, { status: 404 });
  }
  return signIn(provider, { redirectTo: '/' });
}
