import { signIn } from '../../../../auth.js';

/**
 * 스프링이 쓰던 로그인 시작 주소를 그대로 유지한다(프론트가 이 주소로 브라우저를 넘긴다).
 * 실제 처리는 Auth.js가 하고, 끝나면 보던 화면으로 돌려보낸다.
 */
export async function GET(request, { params }) {
  const { provider } = await params;
  if (provider !== 'google' && provider !== 'kakao') {
    return new Response(null, { status: 404 });
  }
  return signIn(provider, { redirectTo: `/${next(request)}` });
}

/**
 * 로그인 뒤 돌아갈 곳. 프론트가 지금 해시(#recipe/12)를 넘겨준다.
 * 해시 조각만 받으므로 바깥 주소로 튈 여지가 없다 - 모양이 어긋나면 그냥 홈.
 */
function next(request) {
  const value = request.nextUrl.searchParams.get('next') ?? '';
  return /^#[\w/-]*$/.test(value) ? value : '';
}
