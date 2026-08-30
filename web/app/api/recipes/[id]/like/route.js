import sql from '../../../../../lib/db.js';
import { fail, handle, noContent, requireUserId } from '../../../../../lib/http.js';
import { exists } from '../../../../../lib/recipes.js';
import { id as parseId } from '../../../../../lib/schema.js';

/** 이미 있으면 아무 일도 안 한다 - 두 번 눌러도 안전하게(unique 제약이 있어 insert가 터진다). */
export const POST = handle(async (_request, { params }) => {
  const userId = await requireUserId();
  const id = parseId((await params).id);
  if (!(await exists(id))) {
    return fail(404, '레시피를 찾을 수 없습니다.');
  }

  await sql`
    insert into recipe_like (user_id, recipe_id, created_at)
    values (${userId}, ${id}, now() at time zone 'utc')
    on conflict do nothing`;

  return noContent();
});

/** 취소. 없던 것을 지워도 그냥 0건이다. */
export const DELETE = handle(async (_request, { params }) => {
  const userId = await requireUserId();
  const id = parseId((await params).id);
  await sql`delete from recipe_like where user_id = ${userId} and recipe_id = ${id}`;

  return noContent();
});
