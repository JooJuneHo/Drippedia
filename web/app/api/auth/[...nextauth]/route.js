import { handlers } from '../../../../auth.js';

// /api/auth/callback/google, /api/auth/callback/kakao 등 Auth.js가 쓰는 경로 전부.
export const { GET, POST } = handlers;
