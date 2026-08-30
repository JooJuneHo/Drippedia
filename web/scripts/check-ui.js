/**
 * 비로그인으로도 구경은 되고, 쓰려는 순간에만 로그인을 물어보는지 확인한다.
 * 탭이나 쓰기 기능이 하나 늘 때 게이트를 빠뜨리기 쉬운 자리라 검사를 남겨 둔다.
 * 화면 코드는 frontend/ 에 있지만 npm이 여기에만 있어서 스크립트도 여기 둔다.
 *
 *   npm run check:ui
 */
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const read = file => readFileSync(new URL(`../../frontend/${file}`, import.meta.url), 'utf8');

/** 상세 화면을 그릴 만큼만. 비로그인이라 saved/liked/mine이 전부 false다. */
const DETAIL = {
  id: 7, title: '센터푸어', beanName: '게이샤', origin: '에티오피아', dripper: 'V60', serveType: 'ICE',
  coffeeAmount: 20, waterAmount: 200, waterTemp: 95, ratio: 10, author: '주준호',
  createdAt: '2026-08-29T17:18:09', steps: [{ stepOrder: 1, startTimeSeconds: 0, pourAmount: 40, note: '뜸' }],
  saved: false, saves: 0, liked: false, likes: 1, mine: false
};

function boot(me) {
  const { window } = new JSDOM(read('index.html'), { url: 'http://localhost/', runScripts: 'outside-only' });
  const calls = [];

  window.fetch = (url, options = {}) => {
    calls.push(String(url));
    const body = (status, json) => Promise.resolve({ ok: status < 400, status, json: async () => json });
    const u = String(url);
    if (u.endsWith('/api/me') && !options.method) return body(me ? 200 : 401, me);
    if (u.endsWith('/api/csrf')) return body(200, { token: 't' });
    if (u.endsWith('/api/recipes/7')) return body(200, DETAIL);
    if (u.includes('/api/recipes')) return body(200, []);
    return body(me ? 204 : 401, null);
  };

  // jsdom에 없는 것들. 검사 대상이 아니라 껍데기만 둔다.
  window.IntersectionObserver = class { observe() {} disconnect() {} };
  for (const form of window.document.querySelectorAll('form')) {
    for (const field of form.elements) {
      if (field.name) Object.defineProperty(form, field.name, { get: () => form.elements[field.name] });
    }
  }
  const dialog = window.document.getElementById('login-ask');
  dialog.showModal = function () { this.open = true; };
  dialog.close = function () { this.open = false; };

  // let/const는 eval 호출마다 스코프가 갈린다. 두 파일을 한 번에 돌리고 검사용 손잡이만 붙인다.
  window.eval([read('app.js'), read('index.js'),
    'window.__t = { send: (...a) => send(...a), loginUrl: p => loginUrl(p) };'
  ].join('\n'));

  return { window, dialog, calls, $: id => window.document.getElementById(id) };
}

const settle = () => new Promise(r => setTimeout(r, 30));
const hidden = (t, id) => t.$(id).classList.contains('hidden');

let failed = 0;
const check = (name, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failed++;
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${name}${pass ? '' : `  기대=${JSON.stringify(expected)} 실제=${JSON.stringify(actual)}`}`);
};

{ // 비로그인
  const t = boot(null);
  await settle();

  check('로그인 화면으로 안 튀고 홈이 열린다', [t.window.location.pathname, hidden(t, 'view-list')], ['/', false]);
  check('마이는 로그인 선택칸', [hidden(t, 'me-in'), hidden(t, 'me-out'), t.dialog.open], [true, false, false]);
  check('마이에서는 왼쪽 메뉴를 감춘다', hidden(t, 'side'), true);

  for (const [tab, message] of [['new', '레시피를 등록하려면'], ['mine', '저장한 레시피를 보려면'], ['manage', '내 레시피를 관리하려면']]) {
    t.dialog.close();
    t.window.location.hash = `#${tab}`;
    await settle();
    check(`#${tab}: 팝업으로 물어보고 홈으로 되돌린다`,
      [t.dialog.open, t.$('login-ask-msg').textContent.startsWith(message), t.window.location.hash],
      [true, true, '#home']);
  }

  t.dialog.close();
  const before = t.calls.length;
  await t.window.__t.send('/api/recipes/7/like', { method: 'POST' });
  check('쓰기: 서버까지 안 가고 팝업', [t.dialog.open, t.calls.length - before], [true, 0]);

  t.window.location.hash = '#recipe/7';
  await settle();
  check('로그인 뒤 보던 화면으로 돌아오게 next를 넘긴다',
    t.window.__t.loginUrl('kakao').endsWith('/oauth2/authorization/kakao?next=%23recipe%2F7'), true);
}

{ // 로그인
  const t = boot({ id: 1, nickname: '주준호', provider: 'KAKAO' });
  await settle();

  check('마이는 프로필', [hidden(t, 'me-in'), hidden(t, 'me-out'), t.$('nickname').textContent],
    [false, true, '주준호']);

  t.window.location.hash = '#new';
  await settle();
  check('등록 폼이 그냥 열린다', [hidden(t, 'view-new'), t.dialog.open], [false, false]);

  // 보는 동안 세션이 끊긴 경우
  t.window.fetch = async () => ({ ok: false, status: 401, json: async () => null });
  await t.window.__t.send('/api/recipes/7/like', { method: 'POST' });
  check('세션 끊김: 다시 로그인 안내 + 마이가 로그인칸으로',
    [t.dialog.open, hidden(t, 'me-in'), hidden(t, 'me-out')], [true, true, false]);
}

console.log(failed ? `\n실패 ${failed}건` : '\n전부 통과');
process.exit(failed ? 1 : 0);
