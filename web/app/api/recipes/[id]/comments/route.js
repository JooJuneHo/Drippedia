import sql from '../../../../../lib/db.js';
import { fail, handle, currentUserId, requireUserId } from '../../../../../lib/http.js';
import { UNKNOWN_AUTHOR, exists } from '../../../../../lib/recipes.js';
import { CommentForm, id as parseId, parse } from '../../../../../lib/schema.js';

/** 원댓글에 대댓글을 물려서 내려준다. 로그인 없이도 볼 수 있다(그땐 mine이 다 false). */
export const GET = handle(async (_request, { params }) => {
  const recipeId = parseId((await params).id);
  const userId = await currentUserId();

  // 원댓글과 대댓글을 한 번에 가져오고 묶는 건 메모리에서 한다(쿼리 1번).
  const all = await sql`
    select c.id::int as id, c.author_id::int as author_id, c.parent_id::int as parent_id, c.content,
           to_char(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SS') as created_at,
           coalesce(u.nickname, ${UNKNOWN_AUTHOR}) as author
    from recipe_comment c
    left join users u on u.id = c.author_id
    where c.recipe_id = ${recipeId}
    order by c.created_at asc`;

  const view = c => ({
    id: c.id,
    content: c.content,
    author: c.author,
    createdAt: c.created_at,
    mine: c.author_id === userId,
    replies: all.filter(r => r.parent_id === c.id).map(r => ({ ...view(r), replies: [] }))
  });

  return Response.json(all.filter(c => c.parent_id === null).map(view));
});

/** 댓글 등록. parentId를 주면 그 댓글의 대댓글이 된다. 깊이는 한 단계까지만. */
export const POST = handle(async (request, { params }) => {
  const userId = await requireUserId();
  const recipeId = parseId((await params).id);
  const form = await parse(CommentForm, request);

  if (!(await exists(recipeId))) {
    return fail(404, '레시피를 찾을 수 없습니다.');
  }
  if (form.parentId !== null) {
    const [parent] = await sql`
      select parent_id::int as parent_id, recipe_id::int as recipe_id
      from recipe_comment where id = ${form.parentId}`;
    if (!parent) {
      return fail(404, '댓글을 찾을 수 없습니다.');
    }
    // 화면이 한 단계까지만 그린다. 대댓글의 대댓글이나 남의 레시피 댓글에 물리는 건 막는다.
    if (parent.parent_id !== null || parent.recipe_id !== recipeId) {
      return fail(400, '대댓글에는 답글을 달 수 없습니다.');
    }
  }

  await sql`
    insert into recipe_comment (recipe_id, author_id, parent_id, content, created_at)
    values (${recipeId}, ${userId}, ${form.parentId}, ${form.content}, now() at time zone 'utc')`;

  return new Response(null, { status: 201 });
});
