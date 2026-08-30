import { signOut } from '../../auth.js';

/**
 * fetch로 부르는 엔드포인트라 리다이렉트를 주면 안 된다(스프링 쪽과 같은 이유).
 * 화면 전환은 프론트가 직접 한다.
 */
export async function POST() {
  await signOut({ redirect: false });
  return new Response(null, { status: 204 });
}
