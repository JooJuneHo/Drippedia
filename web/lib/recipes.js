import sql from './db.js';

/** 목록 한 페이지 크기. 무한 스크롤이 이 단위로 이어 붙인다. */
export const PAGE_SIZE = 20;

/** 사용자를 못 찾았을 때 목록/상세가 통째로 깨지는 것보단 이렇게 표시하는 게 낫다. */
export const UNKNOWN_AUTHOR = '알 수 없음';

/**
 * 스프링은 LocalDateTime을 "2026-08-30T12:34:56" 모양 문자열로 내려줬고,
 * 프론트는 createdAt.slice(0, 10)으로 날짜만 잘라 쓴다.
 * 여기서 Date 객체를 주면 JSON이 UTC(Z)로 나가면서 날짜가 하루씩 밀린다. 문자열로 맞춘다.
 */
const AT = 'YYYY-MM-DD"T"HH24:MI:SS';

/**
 * id는 DB에서 bigint라 드라이버가 문자열로 준다. 프론트는 숫자를 기대하니 int로 캐스팅해서 받는다
 * (레시피 id가 20억을 넘길 일은 없다).
 */
export async function search({ dripper = null, authorId = null, savedBy = null, q = null, sort = null, page = 0 }) {
  // 빈 검색어는 조건 자체를 끄고, 아니면 대소문자 구분 없는 부분 일치로.
  const like = q && q.trim() ? `%${q.trim().toLowerCase()}%` : null;
  // 아는 정렬만 넘긴다. 이상한 값이 오면 최신순.
  const order = sort === 'popular' || sort === 'saves' ? sort : '';

  return sql`
    select r.id::int as id, r.author_id::int as author_id, r.title, r.bean_name, r.dripper, r.serve_type,
           r.coffee_amount, r.water_amount, r.water_temp, r.description,
           to_char(r.created_at, ${AT}::text) as created_at
    from recipe r
    where (${dripper}::text is null or r.dripper = ${dripper}::text)
      and (${authorId}::int is null or r.author_id = ${authorId}::int)
      and (${savedBy}::int is null
           or exists (select 1 from recipe_save s where s.recipe_id = r.id and s.user_id = ${savedBy}::int))
      and (${like}::text is null
           or lower(r.title) like ${like}::text
           or lower(r.bean_name) like ${like}::text
           or lower(r.description) like ${like}::text)
    order by
      case ${order}::text
        when 'popular' then (select count(*) from recipe_like l where l.recipe_id = r.id)
        when 'saves' then (select count(*) from recipe_save s2 where s2.recipe_id = r.id)
        else 0
      end desc,
      r.created_at desc, r.id desc
    limit ${PAGE_SIZE} offset ${Math.max(page, 0) * PAGE_SIZE}`;
}

/**
 * 작성자 닉네임과 좋아요/저장 수를 한 번에 채운다(레시피마다 세면 N+1).
 * 조회에 실패한 작성자는 표시용 기본값으로 둔다.
 */
export async function summaries(recipes) {
  if (recipes.length === 0) {
    return []; // 빈 목록에 in () 쿼리를 세 번 날릴 이유가 없다
  }

  const ids = recipes.map(r => r.id);
  const authorIds = [...new Set(recipes.map(r => r.author_id))];
  const [authors, likes, saves] = await Promise.all([
    sql`select id::int as id, nickname from users where id in ${sql(authorIds)}`,
    countByRecipeIds('recipe_like', ids),
    countByRecipeIds('recipe_save', ids)
  ]);

  const nicknames = new Map(authors.map(a => [a.id, a.nickname]));
  return recipes.map(r => ({
    id: r.id,
    title: r.title,
    beanName: r.bean_name,
    dripper: r.dripper,
    serveType: r.serve_type,
    coffeeAmount: r.coffee_amount,
    waterAmount: r.water_amount,
    waterTemp: r.water_temp,
    ratio: ratio(r),
    author: nicknames.get(r.author_id) ?? UNKNOWN_AUTHOR,
    createdAt: r.created_at,
    tags: tagsOf(r.description),
    likes: likes.get(r.id) ?? 0,
    saves: saves.get(r.id) ?? 0
  }));
}

/** 상세. 목록과 달리 푸어 단계까지 순서대로 딸려 나간다(브루잉 타이머가 이걸 그대로 쓴다). */
export async function detail(id, userId) {
  const [recipe] = await sql`
    select r.id::int as id, r.author_id::int as author_id, r.title, r.bean_name, r.purchase_url, r.origin,
           r.dripper, r.serve_type, r.coffee_amount, r.water_amount, r.water_temp,
           r.grind_size, r.grinder, r.description,
           to_char(r.created_at, ${AT}::text) as created_at
    from recipe r where r.id = ${id}`;
  if (!recipe) {
    return null;
  }

  // 로그인 없이도 보는 화면이라 userId가 null일 수 있다. 그땐 저장/좋아요가 false로 나간다.
  const [steps, author, saved, saves, liked, likes] = await Promise.all([
    sql`select step_order, start_time_seconds, pour_amount, note
        from pour_step where recipe_id = ${id} order by step_order asc`,
    nicknameOf(recipe.author_id),
    marked('recipe_save', userId, id),
    countOne('recipe_save', id),
    marked('recipe_like', userId, id),
    countOne('recipe_like', id)
  ]);

  return {
    id: recipe.id,
    title: recipe.title,
    beanName: recipe.bean_name,
    purchaseUrl: recipe.purchase_url,
    origin: recipe.origin,
    dripper: recipe.dripper,
    serveType: recipe.serve_type,
    coffeeAmount: recipe.coffee_amount,
    waterAmount: recipe.water_amount,
    waterTemp: recipe.water_temp,
    ratio: ratio(recipe),
    grindSize: recipe.grind_size,
    grinder: recipe.grinder,
    description: recipe.description,
    author,
    createdAt: recipe.created_at,
    steps: steps.map(s => ({
      stepOrder: s.step_order,
      startTimeSeconds: s.start_time_seconds,
      pourAmount: s.pour_amount,
      note: s.note
    })),
    saved,
    saves,
    liked,
    likes,
    mine: recipe.author_id === userId
  };
}

/** 남의 레시피를 고치거나 지우지 못하게. 없으면 404, 남의 것이면 403. */
export async function mustOwn(id, userId) {
  const [recipe] = await sql`select id::int as id, author_id::int as author_id from recipe where id = ${id}`;
  if (!recipe) {
    throw Response.json({ message: '레시피를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (recipe.author_id !== userId) {
    throw Response.json({ message: '내가 등록한 레시피만 수정/삭제할 수 있습니다.' }, { status: 403 });
  }
  return recipe;
}

export const exists = async id =>
  (await sql`select 1 from recipe where id = ${id}`).length > 0;

export const nicknameOf = async userId => {
  const [user] = await sql`select nickname from users where id = ${userId}`;
  return user?.nickname ?? UNKNOWN_AUTHOR;
};

const countByRecipeIds = async (table, ids) => new Map(
  (await sql`select recipe_id::int as recipe_id, count(*)::int as count
             from ${sql(table)} where recipe_id in ${sql(ids)} group by recipe_id`)
    .map(row => [row.recipe_id, row.count])
);

const countOne = async (table, recipeId) =>
  (await sql`select count(*)::int as count from ${sql(table)} where recipe_id = ${recipeId}`)[0].count;

const marked = async (table, userId, recipeId) => userId !== null
  && (await sql`select 1 from ${sql(table)} where user_id = ${userId} and recipe_id = ${recipeId}`).length > 0;

const ratio = r => (r.coffee_amount ? r.water_amount / r.coffee_amount : 0);

/**
 * 상세 설명에 섞여 있는 #태그. 목록 카드는 이것만 보여준다.
 * 공백/줄바꿈에서 끊고, 앞에 글자가 붙어 있으면(링크 뒤의 #조각 등) 태그로 안 친다. 앞의 다섯 개까지.
 */
const TAG = /(?<!\S)#[^\s#]+/g;
const tagsOf = description =>
  (description ? [...description.matchAll(TAG)].map(m => m[0]).slice(0, 5) : []);

/** stepOrder는 클라이언트가 보내는 값이 아니라 배열 순서 그대로 1부터 매긴다. */
export const insertSteps = (tx, recipeId, steps) => tx`
  insert into pour_step ${tx(steps.map((s, i) => ({
    recipe_id: recipeId,
    step_order: i + 1,
    start_time_seconds: s.startTimeSeconds,
    pour_amount: s.pourAmount,
    note: s.note
  })), 'recipe_id', 'step_order', 'start_time_seconds', 'pour_amount', 'note')}`;

/** 인기 목록처럼 id 몇 개만 집어 올 때. 순서는 부르는 쪽이 다시 세운다(in 절은 순서를 안 지킨다). */
export const findByIds = ids => sql`
  select r.id::int as id, r.author_id::int as author_id, r.title, r.bean_name, r.dripper, r.serve_type,
         r.coffee_amount, r.water_amount, r.water_temp, r.description,
         to_char(r.created_at, ${AT}::text) as created_at
  from recipe r where r.id in ${sql(ids)}`;
