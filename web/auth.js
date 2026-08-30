import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Kakao from 'next-auth/providers/kakao';
import sql from './lib/db.js';

/**
 * 스프링의 OAuth2LoginService와 같은 일을 한다.
 * (provider, provider_id)로 찾아보고 없으면 만든다 = 회원가입 절차가 따로 없음.
 * 다만 세션은 서버 메모리가 아니라 JWT 쿠키다 - 서버리스는 인스턴스가 매번 달라서
 * HttpSession 같은 걸 못 쓴다. 덤으로 재배포해도 로그인이 안 풀린다.
 *
 * 세션 쿠키가 SameSite=Lax라 cross-site POST에는 안 실린다 = CSRF는 이걸로 막힌다.
 * 프론트/백이 같은 오리진이라 스프링 쪽 CSRF 토큰 왕복이 통째로 필요 없어졌다.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  // 카카오는 기본 scope가 비어 있다. 스프링과 같이 닉네임 동의를 받아야 rawNickname이 값을 얻는다.
  providers: [Google, Kakao({ authorization: { url: 'https://kauth.kakao.com/oauth/authorize', params: { scope: 'profile_nickname' } } })],
  session: { strategy: 'jwt' },
  callbacks: {
    // 로그인 직후 한 번만 account가 들어온다. 그때 우리 User.id를 토큰에 박아 둔다.
    async jwt({ token, account, profile }) {
      if (account) {
        token.userId = await upsertUser(account.provider, profile);
      }
      return token;
    },
    async session({ session, token }) {
      session.userId = token.userId;
      return session;
    }
  }
});

async function upsertUser(registrationId, profile) {
  const provider = registrationId.toUpperCase(); // DB에는 GOOGLE / KAKAO로 들어가 있다
  const providerId = String(provider === 'GOOGLE' ? profile.sub : profile.id);
  if (!providerId || providerId === 'undefined') {
    throw new Error(`${provider} 응답에 사용자 식별자가 없습니다: ${Object.keys(profile ?? {})}`);
  }

  const [found] = await sql`
    select id::int as id from users where provider = ${provider} and provider_id = ${providerId}`;
  if (found) {
    return found.id;
  }

  const [created] = await sql`
    insert into users (provider, provider_id, nickname, created_at)
    values (${provider}, ${providerId}, ${await uniqueNickname(rawNickname(provider, profile))},
            now() at time zone 'utc')
    returning id::int as id`;
  return created.id;
}

/** 카카오는 닉네임이 kakao_account.profile.nickname 안에 중첩돼 있고, 동의 안 하면 아예 없다. */
function rawNickname(provider, profile) {
  const name = provider === 'GOOGLE'
    ? profile?.name
    : profile?.kakao_account?.profile?.nickname;
  return String(name ?? '').trim() || '드리퍼';
}

/**
 * nickname은 unique라 겹치면 뒤에 -1, -2를 붙인다.
 * ponytail: 순차 스캔이라 같은 닉네임이 수천 개면 느려진다. 그때 랜덤 suffix로.
 */
async function uniqueNickname(base) {
  const trimmed = base.slice(0, 30);
  let candidate = trimmed;
  for (let i = 1; await nicknameTaken(candidate); i++) {
    const suffix = `-${i}`;
    candidate = trimmed.slice(0, 30 - suffix.length) + suffix;
  }
  return candidate;
}

const nicknameTaken = async nickname =>
  (await sql`select 1 from users where nickname = ${nickname}`).length > 0;
