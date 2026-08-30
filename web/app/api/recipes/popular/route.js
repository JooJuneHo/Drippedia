import sql from '../../../../lib/db.js';
import { handle } from '../../../../lib/http.js';
import { findByIds, summaries } from '../../../../lib/recipes.js';

/** 홈에 보여줄 인기 레시피 개수. */
const POPULAR_SIZE = 3;

/**
 * 홈 오른쪽에 붙는 이번 달 인기 레시피. 이번 달 1일부터 지금까지 눌린 좋아요만 센다.
 * ponytail: 매 요청 집계. 레시피가 많아져 느려지면 그때 캐시하거나 집계 컬럼을 둔다.
 */
export const GET = handle(async () => {
  const top = await sql`
    select l.recipe_id::int as id from recipe_like l
    where l.created_at >= date_trunc('month', now() at time zone 'utc')
    group by l.recipe_id
    order by count(*) desc
    limit ${POPULAR_SIZE}`;
  if (top.length === 0) {
    return Response.json([]);
  }

  // in 절은 넘긴 순서를 안 지켜주니 좋아요 순서대로 다시 세운다.
  const byId = new Map((await findByIds(top.map(t => t.id))).map(r => [r.id, r]));
  const ordered = top.map(t => byId.get(t.id)).filter(Boolean);

  return Response.json(await summaries(ordered));
});
