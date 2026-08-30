import sql from '../../../../../../lib/db.js';
import { handle, noContent, requireUserId } from '../../../../../../lib/http.js';
import { CommentForm, id as parseId, parse } from '../../../../../../lib/schema.js';

/** 내가 쓴 댓글만 고친다. 내용만 바뀌고 대댓글은 그대로 붙어 있는다. */
export const PUT = handle(async (request, { params }) => {
  const userId = await requireUserId();
  const commentId = parseId((await params).commentId);
  await mustOwn(commentId, userId);
  const { content } = await parse(CommentForm, request);

  await sql`update recipe_comment set content = ${content} where id = ${commentId}`;
  return noContent();
});

/** 내가 쓴 댓글만 지운다. 원댓글을 지우면 달린 대댓글도 같이 사라진다(고아 댓글을 안 남긴다). */
export const DELETE = handle(async (_request, { params }) => {
  const userId = await requireUserId();
  const commentId = parseId((await params).commentId);
  await mustOwn(commentId, userId);

  await sql.begin(tx => [
    tx`delete from recipe_comment where parent_id = ${commentId}`,
    tx`delete from recipe_comment where id = ${commentId}`
  ]);
  return noContent();
});

/** 남의 댓글을 고치거나 지우지 못하게. 없으면 404, 남의 것이면 403. */
async function mustOwn(commentId, userId) {
  const [comment] = await sql`select author_id::int as author_id from recipe_comment where id = ${commentId}`;
  if (!comment) {
    throw Response.json({ message: '댓글을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (comment.author_id !== userId) {
    throw Response.json({ message: '내가 쓴 댓글만 고치거나 지울 수 있습니다.' }, { status: 403 });
  }
}
