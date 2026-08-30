import sql from '../../../../lib/db.js';
import { fail, handle, noContent, currentUserId, requireUserId } from '../../../../lib/http.js';
import { detail, findByIds, insertSteps, mustOwn, summaries } from '../../../../lib/recipes.js';
import { RecipeForm, id as parseId, parse } from '../../../../lib/schema.js';

/** 상세. 로그인 없이도 보는 화면이라 userId가 null일 수 있다 - 그땐 저장/수정 버튼이 안 뜬다. */
export const GET = handle(async (_request, { params }) => {
  const id = parseId((await params).id);
  const view = await detail(id, await currentUserId());
  return view ? Response.json(view) : fail(404, '레시피를 찾을 수 없습니다.');
});

/** 수정. 푸어 단계는 개수가 바뀌니 지우고 다시 넣는다(순서도 그때 다시 매겨진다). */
export const PUT = handle(async (request, { params }) => {
  const userId = await requireUserId();
  const id = parseId((await params).id);
  await mustOwn(id, userId);
  const form = await parse(RecipeForm, request);

  await sql.begin(async tx => {
    await tx`
      update recipe set
        title = ${form.title}, bean_name = ${form.beanName}, purchase_url = ${form.purchaseUrl},
        origin = ${form.origin}, dripper = ${form.dripper}, serve_type = ${form.serveType},
        coffee_amount = ${form.coffeeAmount}, water_amount = ${form.waterAmount},
        water_temp = ${form.waterTemp}, grind_size = ${form.grindSize}, grinder = ${form.grinder},
        description = ${form.description}, updated_at = now() at time zone 'utc'
      where id = ${id}`;
    await tx`delete from pour_step where recipe_id = ${id}`;
    await insertSteps(tx, id, form.steps);
  });

  return Response.json((await summaries(await findByIds([id])))[0]);
});

/** 삭제. 연관관계가 없으니 딸린 것들을 직접 지운다. */
export const DELETE = handle(async (_request, { params }) => {
  const userId = await requireUserId();
  const id = parseId((await params).id);
  await mustOwn(id, userId);

  await sql.begin(tx => [
    tx`delete from pour_step where recipe_id = ${id}`,
    tx`delete from recipe_save where recipe_id = ${id}`,
    tx`delete from recipe_like where recipe_id = ${id}`,
    tx`delete from recipe_comment where recipe_id = ${id}`,
    tx`delete from recipe where id = ${id}`
  ]);

  return noContent();
});
