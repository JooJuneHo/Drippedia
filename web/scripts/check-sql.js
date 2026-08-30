/**
 * 라우트가 쓰는 SQL을 실제 DB에 한 번씩 돌려 본다.
 * 테이블은 스프링(Hibernate ddl-auto)이 만든 것을 그대로 쓰고, 컬럼 이름은 카멜케이스가
 * 스네이크케이스로 바뀐다는 전제(authorId -> author_id) 위에 짰다. 그게 틀리면 전부 런타임에 터진다.
 * 쓰기는 트랜잭션 안에서 돌리고 마지막에 롤백하므로 데이터는 안 남는다.
 *
 *   node --env-file=.env scripts/check-sql.js
 */
import sql from '../lib/db.js';
import { detail, findByIds, insertSteps, search, summaries } from '../lib/recipes.js';

const ok = (name, value) => console.log(`OK  ${name}`, JSON.stringify(value ?? null).slice(0, 80));

// --- 읽기: 목록 필터/정렬 조합을 한 번씩 ---
ok('search 전체', (await summaries(await search({}))).length);
ok('search dripper', (await search({ dripper: 'V60' })).length);
ok('search q', (await search({ q: '커피' })).length);
ok('search popular', (await search({ sort: 'popular' })).length);
ok('search saves', (await search({ sort: 'saves' })).length);
ok('search authorId', (await search({ authorId: 1 })).length);
ok('search savedBy', (await search({ savedBy: 1 })).length);
ok('search page=1', (await search({ page: 1 })).length);

const [any] = await search({});
if (any) {
  const view = await detail(any.id, any.author_id);
  // 프론트가 createdAt.slice(0, 10)으로 날짜를 자른다. Date로 나가면 UTC라 하루씩 밀린다.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(view.createdAt)) {
    throw new Error(`createdAt이 스프링과 다른 모양이다: ${view.createdAt}`);
  }
  if (view.mine !== true) {
    throw new Error('작성자 본인인데 mine이 false다 - id 타입이 어긋났을 가능성이 높다');
  }
  ok('detail', view.createdAt);
  ok('findByIds', (await findByIds([any.id])).length);
}

ok('popular 집계', await sql`
  select l.recipe_id::int as id from recipe_like l
  where l.created_at >= date_trunc('month', now() at time zone 'utc')
  group by l.recipe_id order by count(*) desc limit 3`);

ok('comments', await sql`
  select c.id::int as id, c.author_id::int as author_id, c.parent_id::int as parent_id, c.content,
         to_char(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SS') as created_at,
         coalesce(u.nickname, ${'알 수 없음'}) as author
  from recipe_comment c left join users u on u.id = c.author_id
  where c.recipe_id = ${any?.id ?? 0} order by c.created_at asc`);

// --- 쓰기: 전부 롤백된다 ---
await sql.begin(async tx => {
  const [created] = await tx`
    insert into recipe (author_id, title, bean_name, purchase_url, origin, dripper, serve_type,
                        coffee_amount, water_amount, water_temp, grind_size, grinder, description,
                        created_at, updated_at)
    values (${1}, ${'check-sql'}, ${'bean'}, ${null}, ${'KE'}, ${'V60'}, ${'HOT'},
            ${15}, ${240}, ${93}, ${null}, ${null}, ${'#태그'},
            now() at time zone 'utc', now() at time zone 'utc')
    returning id::int as id`;
  ok('insert recipe', created.id);

  await insertSteps(tx, created.id, [
    { startTimeSeconds: 0, pourAmount: 40, note: '뜸' },
    { startTimeSeconds: 30, pourAmount: 200, note: null }
  ]);
  ok('insert steps', (await tx`select count(*)::int as c from pour_step where recipe_id = ${created.id}`)[0].c);

  await tx`update recipe set title = ${'check-sql2'}, updated_at = now() at time zone 'utc' where id = ${created.id}`;

  // 두 번 눌러도 한 건이어야 한다(unique 제약 + on conflict).
  for (let i = 0; i < 2; i++) {
    await tx`insert into recipe_like (user_id, recipe_id, created_at)
             values (${1}, ${created.id}, now() at time zone 'utc') on conflict do nothing`;
  }
  const [{ c }] = await tx`select count(*)::int as c from recipe_like where recipe_id = ${created.id}`;
  if (c !== 1) {
    throw new Error(`좋아요를 두 번 눌렀는데 ${c}건이다 - 멱등이 깨졌다`);
  }
  ok('like 멱등', c);

  await tx`insert into recipe_comment (recipe_id, author_id, parent_id, content, created_at)
           values (${created.id}, ${1}, ${null}, ${'댓글'}, now() at time zone 'utc')`;
  await tx`insert into users (provider, provider_id, nickname, created_at)
           values (${'GOOGLE'}, ${'check-sql-id'}, ${'체크'}, now() at time zone 'utc')`;
  ok('insert comment/user', 'ok');

  throw new Error('__rollback__');
}).catch(e => {
  if (e.message !== '__rollback__') throw e;
  console.log('OK  쓰기 테스트 전부 롤백됨');
});

await sql.end();
