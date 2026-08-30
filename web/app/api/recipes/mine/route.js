import { handle, requireUserId } from '../../../../lib/http.js';
import { search, summaries } from '../../../../lib/recipes.js';
import { page } from '../../../../lib/schema.js';

/** 내가 등록한 것만. 로그인 필수 - 아니면 userId가 비어 전체 목록이 나가 버린다. */
export const GET = handle(async request => {
  const userId = await requireUserId();
  const p = request.nextUrl.searchParams;
  return Response.json(await summaries(await search({
    authorId: userId,
    dripper: p.get('dripper'),
    q: p.get('q'),
    sort: p.get('sort'),
    page: page(p.get('page'))
  })));
});
