import sql from '../../../lib/db.js';
import { fail, handle, noContent, requireUserId } from '../../../lib/http.js';
import { NicknameForm, parse } from '../../../lib/schema.js';

const me = row => ({ id: row.id, nickname: row.nickname, provider: row.provider });

/** 로그인 상태 확인용. 프론트가 첫 진입에 이걸 찔러보고 401이면 로그인 버튼을 보여준다. */
export const GET = handle(async () => {
  const userId = await requireUserId();
  const [user] = await sql`select id::int as id, nickname, provider from users where id = ${userId}`;
  // 탈퇴한 뒤에도 JWT는 남아 있다. 사용자가 없으면 로그인 안 된 것과 같게 본다.
  return user ? Response.json(me(user)) : fail(401, '로그인이 필요합니다.');
});

/** 회원 정보 수정. 닉네임만 고칠 수 있다 - provider/provider_id는 소셜 계정에 묶인 값이다. */
export const PATCH = handle(async request => {
  const userId = await requireUserId();
  const { nickname } = await parse(NicknameForm, request);

  // ponytail: 확인과 저장 사이 경합은 열어 둔다(부딪히면 unique 제약이 막는다).
  const taken = await sql`select 1 from users where nickname = ${nickname} and id <> ${userId}`;
  if (taken.length > 0) {
    return fail(409, '이미 쓰이는 닉네임입니다.');
  }

  const [updated] = await sql`
    update users set nickname = ${nickname} where id = ${userId}
    returning id::int as id, nickname, provider`;
  return updated ? Response.json(me(updated)) : fail(401, '로그인이 필요합니다.');
});

/**
 * 회원 탈퇴. 등록한 레시피는 남긴다 - 작성자 닉네임만 '알 수 없음'으로 표시된다.
 * JWT는 그대로 두지만 사용자가 사라지므로 다음 /api/me가 401이고, 프론트는 로그인 화면으로 넘어간다.
 */
export const DELETE = handle(async () => {
  const userId = await requireUserId();
  await sql.begin(tx => [
    tx`delete from recipe_save where user_id = ${userId}`,
    tx`delete from recipe_like where user_id = ${userId}`,
    tx`delete from users where id = ${userId}`
  ]);
  return noContent();
});
