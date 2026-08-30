# drippedia web (Next.js / Vercel)

`backend/`(Spring Boot)와 **같은 DB, 같은 API 계약**을 쓰는 Next.js 버전.
스프링 쪽은 그대로 두고 이쪽만 Vercel에 올리면 된다.

## 스프링과 달라진 것

| | Spring | 여기 |
|---|---|---|
| 세션 | 인메모리 `HttpSession` | JWT 쿠키 (Auth.js) - 서버리스라 인메모리를 못 쓴다. 재배포해도 로그인이 안 풀린다 |
| CSRF | 토큰 쿠키 + `X-XSRF-TOKEN` 왕복 | 없음 - 같은 오리진이고 세션 쿠키가 SameSite=Lax라 cross-site 쓰기에 안 실린다 |
| CORS | 오리진 하나 허용 | 없음 - 프론트/백이 같은 오리진 |
| 화면 | `frontend/` 정적 배포 | 빌드할 때 `frontend/` -> `public/` 복사 (원본은 안 건드린다) |

DB 스키마는 하나도 안 바꿨다. 스프링이 `ddl-auto: update`로 만든 테이블을 그대로 읽고 쓴다.
그래서 두 백엔드를 동시에 띄워도 데이터가 갈리지 않는다.

## 로컬

```bash
cd web
npm install
cp .env.example .env      # 값 채우기
npm run check             # 라우트 SQL을 실제 DB에 돌려 본다 (쓰기는 롤백)
npm run dev               # http://localhost:3000
```

## Vercel 배포

1. **새 프로젝트**로 만들고 Root Directory를 `web` 으로 지정한다
   (기존 정적 프론트 프로젝트는 그대로 두면 스프링 버전이 계속 산다).
2. `.env.example`의 환경변수를 전부 등록. `DATABASE_URL`은 반드시 Supabase
   **transaction pooler(6543)** 주소로 - 서버리스가 커넥션을 자주 열어서 직결(5432)은 금방 한도를 넘는다.
3. OAuth 리다이렉트 URI를 추가한다 (스프링 것은 지우지 말고 **추가**):
   - Google: `https://<배포주소>/api/auth/callback/google`
   - Kakao: `https://<배포주소>/api/auth/callback/kakao`
