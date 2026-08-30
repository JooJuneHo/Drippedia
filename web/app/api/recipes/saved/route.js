import { handle, requireUserId } from '../../../../lib/http.js';
import { search, summaries } from '../../../../lib/recipes.js';
import { page } from '../../../../lib/schema.js';

/** 내가 저장(북마크)한 것만. /mine과 같은 이유로 로그인 필수. */
export const GET = handle(async request => {
  const userId = await requireUserId();
  const p = request.nextUrl.searchParams;
  return Response.json(await summaries(await search({
    savedBy: userId,
    dripper: p.get('dripper'),
    q: p.get('q'),
    sort: p.get('sort'),
    page: page(p.get('page'))
  })));
});
