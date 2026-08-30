/**
 * frontend/ 를 public/ 으로 통째로 복사한다.
 * frontend/ 는 Render + 정적 Vercel 배포가 계속 쓰는 원본이라 손대지 않는다.
 * 여기선 API가 같은 오리진에 있으니 절대주소 한 줄만 빈 문자열로 바꿔 넣는다.
 */
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const SRC = new URL('../../frontend/', import.meta.url);
const DEST = new URL('../public/', import.meta.url);

rmSync(DEST, { recursive: true, force: true });
cpSync(SRC, DEST, { recursive: true });

const appJs = new URL('app.js', DEST);
const before = readFileSync(appJs, 'utf8');
const after = before.replace(
  /^const API = .*$/m,
  "const API = ''; // sync-frontend.js가 바꿔 넣는다 - Next 배포는 API가 같은 오리진이라 상대 경로면 된다"
);

// 조용히 실패하면 배포된 화면이 예전 백엔드를 부른다. 빌드에서 터뜨리는 편이 낫다.
if (after === before) {
  throw new Error('frontend/app.js에서 `const API = ...` 줄을 못 찾았다. sync-frontend.js의 정규식을 고쳐라.');
}
writeFileSync(appJs, after);
console.log('frontend/ -> web/public/ 복사 완료 (API 주소는 같은 오리진으로 교체)');
