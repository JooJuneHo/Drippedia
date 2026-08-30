import { auth } from '../auth.js';

export const noContent = () => new Response(null, { status: 204 });
export const fail = (status, message) => Response.json({ message }, { status });

/** 로그인한 사용자의 User.id. 안 했으면 null (스프링의 @CurrentUserId와 같은 자리). */
export async function currentUserId() {
  const session = await auth();
  return session?.userId ?? null;
}

/**
 * 스프링에서는 SecurityConfig가 막던 자리. 여기선 라우트마다 직접 확인한다.
 * 프론트는 401을 보면 로그인 화면으로 넘어간다.
 */
export async function requireUserId() {
  const userId = await currentUserId();
  if (userId === null) {
    throw fail(401, '로그인이 필요합니다.');
  }
  return userId;
}

/** 위에서 던진 Response를 그대로 응답으로 돌려준다. 그 외 예외는 500. */
export function handle(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof Response) {
        return e;
      }
      // NEXT_REDIRECT 등 Next가 직접 처리해야 하는 예외는 넘긴다.
      if (e?.digest?.startsWith?.('NEXT_')) {
        throw e;
      }
      console.error(e);
      return fail(500, '서버 오류');
    }
  };
}
