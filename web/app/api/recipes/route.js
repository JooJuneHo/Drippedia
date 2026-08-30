import sql from '../../../lib/db.js';
import { handle, requireUserId } from '../../../lib/http.js';
import { insertSteps, search, summaries } from '../../../lib/recipes.js';
import { RecipeForm, page, parse } from '../../../lib/schema.js';

/** 메인 화면 목록. 로그인 없이도 볼 수 있다. 무한 스크롤이라 page를 0부터 하나씩 올려 가며 부른다. */
export const GET = handle(async request => {
  const p = request.nextUrl.searchParams;
  return Response.json(await summaries(await search({
    dripper: p.get('dripper'),
    q: p.get('q'),
    sort: p.get('sort'),
    page: page(p.get('page'))
  })));
});

/**
 * 레시피 + 푸어 단계 저장. 중간에 터지면 레시피만 남는 걸 막으려고 트랜잭션으로 묶는다.
 * stepOrder는 클라이언트가 보내는 값이 아니라 배열 순서 그대로 1부터 매긴다.
 */
export const POST = handle(async request => {
  const userId = await requireUserId();
  const form = await parse(RecipeForm, request);

  const recipe = await sql.begin(async tx => {
    const [created] = await tx`
      insert into recipe (author_id, title, bean_name, purchase_url, origin, dripper, serve_type,
                          coffee_amount, water_amount, water_temp, grind_size, grinder, description,
                          created_at, updated_at)
      values (${userId}, ${form.title}, ${form.beanName}, ${form.purchaseUrl}, ${form.origin},
              ${form.dripper}, ${form.serveType}, ${form.coffeeAmount}, ${form.waterAmount},
              ${form.waterTemp}, ${form.grindSize}, ${form.grinder}, ${form.description},
              now() at time zone 'utc', now() at time zone 'utc')
      returning id::int as id, author_id::int as author_id, title, bean_name, dripper, serve_type,
                coffee_amount, water_amount, water_temp, description,
                to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') as created_at`;
    await insertSteps(tx, created.id, form.steps);
    return created;
  });

  return Response.json((await summaries([recipe]))[0], { status: 201 });
});
