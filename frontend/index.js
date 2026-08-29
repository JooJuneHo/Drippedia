// 저장된 키(옛 enum 값)를 화면용 이름으로 바꾼다. 등록 폼 datalist의 추천 목록이기도 하다.
// ponytail: 목록을 API로 내려주지 않고 하드코딩. 도구가 자주 바뀌면 그때 엔드포인트로.
const DRIPPERS = {
  V60: 'V60', KALITA_WAVE: '칼리타 웨이브', ORIGAMI: '오리가미',
  CHEMEX: '케멕스', CLEVER: '클레버', APRIL: '에이프릴'
};

// 그라인더는 목록에 없어도 직접 타이핑할 수 있게 datalist로 둔다(자유 입력 + 추천 목록).
// ponytail: enum/테이블 없이 문자열 그대로 저장. 그라인더별 통계가 필요해지면 그때 정규화.
const GRINDERS = [
  '코만단테 C40', '1Zpresso JX-Pro', '1Zpresso K-Ultra', '1Zpresso ZP6',
  '타임모어 C2', '타임모어 C3', '타임모어 078S', '바라짜 엔코어', '바라짜 버츄오소',
  '펠로우 오드 Gen2', '니체 제로', '말코닉 EK43', '말코닉 X54', 'DF64', '킨그라인더 K6'
];

// 핫/아이스. 목록 카드와 상세가 같은 표기를 쓴다.
const SERVES = { HOT: '🔥 핫', ICE: '🧊 아이스' };

// 목록 한 페이지 크기. 서버(RecipeController.PAGE_SIZE)와 같아야 "마지막 페이지"를 알아본다.
const PAGE_SIZE = 20;

// 저장 아이콘. 이모지·문자 아이콘은 색을 못 바꿔서 SVG로 그리고 색은 CSS(currentColor)에 맡긴다.
const bookmark = filled => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path
  d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"
  fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;

const TABS = {
  home: { title: '전체 레시피', view: 'view-list', path: '' },
  new: { title: '레시피 등록', view: 'view-new' },
  mine: { title: '저장한 레시피', view: 'view-list', path: '/saved' },
  manage: { title: '내 레시피 관리', view: 'view-list', path: '/mine' },
  me: { title: '마이', view: 'view-me' }
};

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

// 로그인 안 돼 있으면 로그인 화면으로 넘긴다. CSRF 토큰도 같이 받아 둔다(쓰기 요청에 필요).
Promise.all([fetchMe(), loadCsrf()]).then(([me]) => {
  if (!me) {
    location.replace('login.html');
    return;
  }
  $('nickname').textContent = me.nickname;
  $('provider').textContent = me.provider === 'KAKAO' ? '카카오 로그인' : '구글 로그인';
  $('profile-form').nickname.value = me.nickname;
  $('app').style.visibility = 'visible';
  route();
});

// 드리퍼·그라인더 모두 추천 목록을 주되 직접 입력도 받는다(datalist).
$('drippers').innerHTML = Object.values(DRIPPERS).map(d => `<option value="${esc(d)}">`).join('');
$('grinders').innerHTML = GRINDERS.map(g => `<option value="${esc(g)}">`).join('');

/**
 * 화면 전환은 해시로만 한다. 뒤로가기가 그냥 동작하고, 상태 변수를 따로 들 필요가 없다.
 * 파라미터를 받는 건 상세(#recipe/12)와 수정(#edit/12)뿐이다.
 * ponytail: 라우터 라이브러리 없이 해시 스위치. 경로가 더 늘면 그때 다시.
 */
function route() {
  const [name, param] = location.hash.slice(1).split('/');

  if (name === 'recipe' && param) {
    show('view-detail', '', null); // 제목은 레시피를 받아온 뒤에 채운다
    loadDetail(param);
    return;
  }

  if (name === 'timer' && param) {
    show('view-timer', '', null);
    loadTimer(param);
    return;
  }

  if (name === 'edit' && param) {
    show('view-new', '레시피 수정', null);
    loadForEdit(param);
    return;
  }

  const tab = TABS[name] ? name : 'home';
  show(TABS[tab].view, TABS[tab].title, tab);
  if (TABS[tab].view === 'view-list') {
    listHash = `#${tab}`; // 상세에서 '목록으로'가 돌아올 곳
    loadRecipes(TABS[tab].path);
    loadPopular(tab === 'home'); // 인기 레시피는 홈에만
  }
  if (tab === 'new') {
    resetForm(); // 수정하다 나갔을 수 있으니 빈 폼으로 되돌린다
  }
}

// 목록 화면을 떠날 때 어디였는지 기억해 둔다. 상세의 '목록으로'가 여기로 돌아온다.
let listHash = '#home';

// 뒤로가기 문구도 어디서 들어왔는지에 맞춰 준다.
const backLink = () =>
  `<a class="back" href="${listHash}">← ${listHash === '#manage' ? '내 레시피 목록으로' : '목록으로'}</a>`;

function show(view, title, tab) {
  if (view !== 'view-timer') {
    stopTicking(); // 화면을 떠나면 타이머도 멈춘다
  }

  $('title').textContent = title;
  document.querySelectorAll('#app section').forEach(s => s.classList.add('hidden'));
  $(view).classList.remove('hidden');

  // 왼쪽 메뉴는 마이 계열(계정 관리 / 내 레시피 관리)에서만 붙는다
  $('side').classList.toggle('hidden', tab !== 'me' && tab !== 'manage');
  document.querySelectorAll('#side a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === `#${tab}`));

  // 하단 탭바: 관리 화면은 마이의 하위 화면이라 마이를 켜 둔다
  const navTab = tab === 'manage' ? 'me' : tab;
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === navTab));
}

// 무한 스크롤 상태. 화면(경로)·검색어·정렬이 바뀌면 통째로 다시 시작한다.
const feed = { path: '', page: 0, done: true, loading: false }; // done: 목록 화면에 들어오기 전엔 안 받는다

function loadRecipes(path) {
  Object.assign(feed, { path, page: 0, done: false, loading: false });
  $('recipes').innerHTML = '';
  $('empty').textContent = $('q').value.trim() ? '검색 결과가 없습니다.'
    : path === '/saved' ? '저장한 레시피가 없습니다.' : '아직 등록된 레시피가 없습니다.';
  return loadMore();
}

/** 다음 페이지를 받아 목록 끝에 이어 붙인다. 서버가 한 페이지보다 적게 주면 거기서 끝. */
async function loadMore() {
  if (feed.loading || feed.done) {
    return;
  }
  feed.loading = true;

  const params = new URLSearchParams({ page: feed.page });
  if ($('q').value.trim()) params.set('q', $('q').value.trim());
  if ($('sort').value) params.set('sort', $('sort').value);

  const res = await fetch(`${API}/api/recipes${feed.path}?${params}`, { credentials: 'include' });
  const recipes = res.ok ? await res.json() : [];

  $('recipes').insertAdjacentHTML('beforeend', cards(recipes));
  $('empty').classList.toggle('hidden', $('recipes').children.length > 0);

  feed.done = recipes.length < PAGE_SIZE;
  feed.page += 1;
  feed.loading = false;

  // 첫 페이지가 화면을 다 못 채우면 스크롤이 안 생겨 다음 요청이 영영 안 온다.
  if (!feed.done && sentinelVisible()) {
    loadMore();
  }
}

const sentinelVisible = () => $('sentinel').getBoundingClientRect().top < window.innerHeight;

// 목록 끝의 빈 표식이 화면에 들어오면 다음 페이지를 부른다.
new IntersectionObserver(entries => {
  if (entries[0].isIntersecting && !$('view-list').classList.contains('hidden')) {
    loadMore();
  }
}).observe($('sentinel'));

/**
 * 이번 달 좋아요가 많은 세 개. 목록·검색과는 무관하게 홈에서 한 번만 받아온다.
 * 아직 아무도 좋아요를 안 눌렀으면 패널째 감춘다.
 */
async function loadPopular(show) {
  if (!show) {
    $('popular').classList.add('hidden');
    return;
  }

  const res = await fetch(`${API}/api/recipes/popular`, { credentials: 'include' });
  const top = res.ok ? await res.json() : [];
  $('popular').classList.toggle('hidden', top.length === 0);
  $('popular').innerHTML = `
    <h2>이번 달 인기 레시피!</h2>
    <ol>${top.map((r, i) => `
      <li>
        <a href="#recipe/${r.id}">
          <span class="rank r${i + 1}">${i + 1}</span>
          <span class="name">${esc(r.title)}</span>
          <span class="likes">♥ ${r.likes}</span>
        </a>
      </li>`).join('')}
    </ol>`;
}

// 카드 한 묶음. 첫 페이지는 갈아 끼우고 다음 페이지부터는 뒤에 붙인다.
// 제목·원두명은 사용자 입력이라 innerHTML에 넣기 전에 반드시 이스케이프한다.
const cards = recipes => recipes.map(r => `
    <li class="card">
      <a href="#recipe/${r.id}">
        <h2>${esc(r.title)}${SERVES[r.serveType] ? `<span class="serve ${r.serveType.toLowerCase()}">${SERVES[r.serveType]}</span>` : ''}</h2>
        <p class="bean">${esc(r.beanName) || '원두 정보 없음'}</p>
      ${r.tags?.length ? `<p class="tags">${r.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</p>` : ''}
        <div class="bottom">
          <span class="spec">
            <span class="fig"><em>비율</em>1:${r.ratio.toFixed(1)}</span>
            <span class="fig"><em>원두</em>${r.coffeeAmount}g</span>
            <span class="fig"><em>물</em>${r.waterAmount}g</span>
            <span class="fig"><em>온도</em>${r.waterTemp}℃</span>
          </span>
          <span class="by">
            <span class="heart">♥ ${r.likes ?? 0}</span>
            <span class="mark">${bookmark(true)} ${r.saves ?? 0}</span>
            · ${esc(r.author)}
          </span>
        </div>
      </a>
    </li>`).join('');

const fetchRecipe = id => fetch(`${API}/api/recipes/${encodeURIComponent(id)}`, { credentials: 'include' })
  .then(res => res.ok ? res.json() : null);

async function loadDetail(id) {
  const r = await fetchRecipe(id);
  if (!r) {
    $('view-detail').innerHTML = `${backLink()}
      <p class="empty">레시피를 찾을 수 없습니다.</p>`;
    return;
  }
  renderDetail(r);
}

async function loadTimer(id) {
  const r = await fetchRecipe(id);
  if (!r) {
    location.hash = `#recipe/${id}`; // 없는 레시피면 상세가 알아서 안내한다
    return;
  }
  renderTimer(r);
}

// 타이머는 화면 하나뿐이라 상태도 변수 하나로 들고 있는다. base는 멈춰 있던 동안 쌓인 시간.
let brew = null;

const elapsedMs = () => brew.base + (brew.startedAt ? Date.now() - brew.startedAt : 0);

/** 경과 시간으로 정하는 단계 상태. 다음 단계 시작 시각을 넘겼으면 끝난 단계다. */
function stepState(steps, i, ms) {
  const at = steps[i].startTimeSeconds * 1000;
  const next = steps[i + 1] ? steps[i + 1].startTimeSeconds * 1000 : Infinity;
  return ms >= next ? 'done' : ms >= at ? 'now' : 'pending';
}

function renderTimer(r) {
  $('title').textContent = ''; // 제목은 아래 카드 안에서 그린다(상세와 같은 모양)

  // 부으면서 필요한 건 "이번에 몇 g"보다 "저울이 몇 g이어야 하나"라서 누적량을 같이 들고 간다.
  let poured = 0;
  const steps = r.steps.map(s => ({ ...s, total: poured += s.pourAmount }));

  $('view-timer').innerHTML = `
    <a class="back" href="#recipe/${r.id}">← 레시피로</a>
    <div class="detail">
      <h1 class="page-title">${esc(r.title)} 타이머</h1>
      <p class="method">원두 : ${r.coffeeAmount}g / 물 : ${r.waterAmount}g / 물 온도 : ${r.waterTemp}℃</p>

      <p class="clock" id="clock">0:00</p>
      <div class="actions">
        <button type="button" id="timer-toggle">시작</button>
        <button type="button" id="timer-reset">초기화</button>
      </div>

      <h2>푸어 단계 <span class="sum">총 ${poured}g</span></h2>
      <ol class="timeline">${steps.map(s => `
        <li>
          <span class="at">${mmss(s.startTimeSeconds)}</span>
          <span class="pour">${s.pourAmount}g</span>
          <span class="total">누적 ${s.total}g</span>
          <span class="note">${esc(s.note ?? '')}</span>
          <span class="left"></span>
        </li>`).join('')}
      </ol>
    </div>`;

  brew = { steps, base: 0, startedAt: null, handle: null };
  $('timer-toggle').addEventListener('click', toggleTimer);
  $('timer-reset').addEventListener('click', resetTimer);
  paint();
}

function toggleTimer() {
  if (brew.startedAt) {
    brew.base = elapsedMs();
    stopTicking();
  } else {
    brew.startedAt = Date.now();
    brew.handle = setInterval(paint, 200); // 1초보다 촘촘히 봐야 단계가 제때 넘어간다
  }
  paint();
}

function resetTimer() {
  stopTicking();
  brew.base = 0;
  paint();
}

function stopTicking() {
  if (!brew) {
    return;
  }
  clearInterval(brew.handle);
  brew.handle = null;
  brew.startedAt = null;
}

/** 시계와 단계 상태만 갈아 끼운다. 매 틱마다 화면을 다시 그리지 않는다. */
function paint() {
  const ms = elapsedMs();
  const running = Boolean(brew.startedAt);

  $('clock').textContent = mmss(Math.floor(ms / 1000));
  $('timer-toggle').textContent = running ? '중지' : brew.base ? '계속' : '시작';
  $('timer-toggle').classList.toggle('on', running);

  document.querySelectorAll('#view-timer .timeline li').forEach((li, i) => {
    li.className = stepState(brew.steps, i, ms);

    const next = brew.steps[i + 1];
    li.querySelector('.left').textContent = li.className === 'now' && next
      ? `다음까지 ${mmss(Math.ceil((next.startTimeSeconds * 1000 - ms) / 1000))}`
      : '';
  });
}

// 이미 이스케이프된 문자열에만 쓴다. 링크와 #태그를 한 번에 훑는 이유는,
// 따로 돌리면 주소 안의 #조각(https://x.com/a#b)까지 태그로 잡아먹기 때문.
const LINK_OR_TAG = /(https?:\/\/[^\s<]+)|(#[^\s#<]+)/g;

const formatted = html => html.replace(LINK_OR_TAG, (m, url, tag) => url
  ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
  : `<span class="tag">${tag}</span>`);

const mmss = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// 상세와 타이머가 같이 쓰는 단계 목록.
const stepsList = r => `<ol>${r.steps.map(s => `
  <li>
    <span class="at">${mmss(s.startTimeSeconds)}</span>
    <span class="pour">${s.pourAmount}g</span>
    <span class="note">${esc(s.note ?? '')}</span>
  </li>`).join('')}</ol>`;

function renderDetail(r) {
  $('title').textContent = ''; // 상세는 '목록으로' 아래에 제목을 직접 그린다(빈 h1은 CSS가 접는다)

  // 값이 없는 항목은 줄 자체를 안 그린다(원산지/분쇄도는 선택 입력).
  const rows = [
    ['핫/아이스', SERVES[r.serveType]],
    ['원두', r.beanName],
    ['원산지', r.origin],
    ['비율', `1:${r.ratio.toFixed(1)} (${r.coffeeAmount}g / ${r.waterAmount}g)`],
    ['물 온도', `${r.waterTemp}℃`],
    ['드리퍼', DRIPPERS[r.dripper] ?? r.dripper],
    ['그라인더', r.grinder],
    ['분쇄도', r.grindSize]
  ].filter(([, value]) => value);

  $('view-detail').innerHTML = `
    ${backLink()}
    <div class="detail">
      <h1 class="page-title">${esc(r.title)}</h1>
      <p class="by">${esc(r.author)} · ${esc(r.createdAt.slice(0, 10).replaceAll('-', '.'))}</p>
      <dl>${rows.map(([label, value]) => `<dt>${label}</dt><dd>${esc(value)}</dd>`).join('')}</dl>
      ${/^https?:\/\//.test(r.purchaseUrl ?? '') ? `<p class="buy"><a href="${esc(r.purchaseUrl)}" target="_blank" rel="noopener noreferrer">🛒 원두 구입 링크</a></p>` : ''}
      ${r.description ? `<h2>상세 설명</h2>
      <p class="desc">${formatted(esc(r.description))}</p>` : ''}

      <h2>푸어 단계</h2>
      ${stepsList(r)}

      <a class="timer" href="#timer/${r.id}">▶ 이 레시피로 브루잉 시작</a>

      <div class="actions">
        <button type="button" id="like-toggle" class="like ${r.liked ? 'on' : ''}">${r.liked ? '♥' : '♡'} 좋아요 ${r.likes ?? 0}</button>
        <button type="button" id="save-toggle" class="save ${r.saved ? 'on' : ''}">${bookmark(r.saved)} 저장 ${r.saves ?? 0}</button>
        ${r.mine ? `<a href="#edit/${r.id}">수정</a>
        <button type="button" id="delete-recipe" class="danger">삭제</button>` : ''}
      </div>

      <h2>댓글</h2>
      <div id="comment-box" class="comments">
        <div id="comments"></div>
        ${commentForm()}
      </div>
    </div>`;

  $('like-toggle').addEventListener('click', () => toggle(r.id, 'like', r.liked));
  $('save-toggle').addEventListener('click', () => toggle(r.id, 'save', r.saved));
  if (r.mine) {
    $('delete-recipe').addEventListener('click', () => removeRecipe(r.id));
  }

  // 댓글은 상세와 따로 받아온다. 좋아요처럼 글을 쓰고 나면 목록만 다시 그린다.
  // 원댓글칸·답글칸이 계속 생겼다 없어져서 리스너는 매번 새로 그려지는 바깥 상자에 한 번만 건다.
  $('comment-box').addEventListener('click', e => onCommentClick(e, r.id));
  $('comment-box').addEventListener('submit', e => submitComment(e, r.id));
  loadComments(r.id);
}

/** 원댓글 입력칸과 대댓글 입력칸이 같은 모양이라 한 군데서 만든다. parentId는 대댓글일 때만 붙는다. */
const commentForm = (parentId = null) => `
  <form class="comment-form"${parentId ? ` data-parent="${parentId}"` : ''}>
    <textarea name="content" maxlength="500" required
      placeholder="${parentId ? '답글을 남겨 보세요' : '댓글을 남겨 보세요'}"></textarea>
    <button type="submit">${parentId ? '답글 등록' : '댓글 등록'}</button>
  </form>`;

async function loadComments(recipeId) {
  const res = await fetch(`${API}/api/recipes/${recipeId}/comments`, { credentials: 'include' });
  const comments = res.ok ? await res.json() : [];

  $('comments').innerHTML = comments.length
    ? comments.map(c => commentItem(c)).join('')
    : '<p class="empty">첫 댓글을 남겨 보세요.</p>';
}

/** 대댓글은 replies에 담겨 오고 한 단계까지만이라, 답글 버튼도 원댓글에만 붙인다. */
function commentItem(c, reply = false) {
  return `
    <div class="comment${reply ? ' reply' : ''}" data-id="${c.id}">
      <p class="by">${esc(c.author)} · ${esc(c.createdAt.slice(0, 10).replaceAll('-', '.'))}</p>
      <p class="text">${formatted(esc(c.content))}</p>
      <p class="tools">
        ${reply ? '' : '<button type="button" class="reply-open">답글</button>'}
        ${c.mine ? `<button type="button" class="comment-edit">수정</button>
        <button type="button" class="comment-delete danger">삭제</button>` : ''}
      </p>
      ${(c.replies ?? []).map(child => commentItem(child, true)).join('')}
    </div>`;
}

function onCommentClick(e, recipeId) {
  const box = e.target.closest('.comment');
  if (!box) {
    return;
  }

  if (e.target.classList.contains('reply-open')) {
    const open = box.querySelector(':scope > .comment-form');
    open ? open.remove() : box.insertAdjacentHTML('beforeend', commentForm(box.dataset.id));
  }
  if (e.target.classList.contains('comment-edit')) {
    // 원문은 화면에 그대로 있으니 textContent로 되받는다(#태그·링크도 원래 글자로 돌아온다).
    const text = box.querySelector(':scope > .text');
    text.insertAdjacentHTML('afterend', editForm(box.dataset.id, text.textContent));
    text.remove();
  }
  if (e.target.classList.contains('edit-cancel')) {
    loadComments(recipeId); // 고치다 만 건 그냥 다시 받아서 되돌린다
  }
  if (e.target.classList.contains('comment-delete')) {
    removeComment(recipeId, box.dataset.id);
  }
}

/** 수정칸. 등록칸과 같은 comment-form이고, data-edit이 붙어 있으면 PUT으로 나간다. */
const editForm = (id, content) => `
  <form class="comment-form" data-edit="${id}">
    <textarea name="content" maxlength="500" required>${esc(content)}</textarea>
    <button type="submit">저장</button>
    <button type="button" class="edit-cancel">취소</button>
  </form>`;

async function submitComment(e, recipeId) {
  if (!e.target.classList.contains('comment-form')) {
    return;
  }
  e.preventDefault();

  const content = e.target.content.value.trim();
  if (!content) {
    return;
  }

  const editing = e.target.dataset.edit; // 있으면 수정, 없으면 새 댓글
  const res = await send(`${API}/api/recipes/${recipeId}/comments${editing ? `/${editing}` : ''}`, {
    method: editing ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, parentId: Number(e.target.dataset.parent) || null })
  });

  if (res) {
    e.target.reset();
    loadComments(recipeId); // 열려 있던 답글칸·수정칸은 같이 닫힌다
  }
}

async function removeComment(recipeId, commentId) {
  if (!confirm('이 댓글을 삭제할까요? 달린 답글도 같이 사라집니다.')) {
    return;
  }

  if (await send(`${API}/api/recipes/${recipeId}/comments/${commentId}`, { method: 'DELETE' })) {
    loadComments(recipeId);
  }
}

/**
 * 좋아요/저장 켜고 끄기. kind가 그대로 URL 조각이다(like / save).
 * 개수는 서버가 세니 응답 뒤에 상세를 다시 받아온다 - 화면에서 숫자를 따로 굴리지 않는다.
 */
async function toggle(id, kind, on) {
  if (await send(`${API}/api/recipes/${id}/${kind}`, { method: on ? 'DELETE' : 'POST' })) {
    loadDetail(id);
  }
}

/**
 * 쓰기 요청 한 군데. 401이면 로그인으로 보내고, 나머지 실패는 알려 준다.
 * 버튼을 눌렀는데 아무 일도 안 일어나는 게 제일 나쁘다(서버가 옛 버전이면 이렇게 보인다).
 */
async function send(url, options) {
  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: { ...csrfHeader(), ...(options.headers ?? {}) }
  });

  if (res.status === 401) {
    location.replace('login.html');
    return null;
  }
  if (!res.ok) {
    alert(`처리하지 못했습니다. (${res.status})`);
    return null;
  }
  return res;
}

async function removeRecipe(id) {
  if (!confirm('이 레시피를 삭제할까요? 되돌릴 수 없습니다.')) {
    return;
  }

  if (await send(`${API}/api/recipes/${id}`, { method: 'DELETE' })) {
    location.hash = '#manage';
  }
}

// 푸어 단계는 개수가 정해져 있지 않아 행을 그때그때 붙인다. stepOrder는 서버가 배열 순서대로 매긴다.
function addStep(startTimeSeconds = '', pourAmount = '', note = '') {
  $('steps').insertAdjacentHTML('beforeend', `
    <div class="step">
      <label><span>시작(초)</span><input type="number" name="startTimeSeconds" min="0" max="3600" value="${startTimeSeconds}" required></label>
      <label><span>붓는 양(g)</span><input type="number" name="pourAmount" min="1" max="5000" value="${pourAmount}" required></label>
      <label class="note"><span>메모</span><input name="note" maxlength="100" placeholder="뜸들이기" value="${esc(note)}"></label>
      <button type="button" class="remove" title="이 단계 삭제">×</button>
    </div>`);
}

function resetSteps() {
  $('steps').innerHTML = '';
  addStep(0, 50); // 첫 단계는 보통 뜸들이기라 기본값을 채워 둔다
}

resetSteps();
$('add-step').addEventListener('click', () => addStep());
$('steps').addEventListener('click', e => {
  // 마지막 한 줄은 남긴다. 단계 0개는 어차피 서버가 400으로 막는다.
  if (e.target.classList.contains('remove') && $('steps').children.length > 1) {
    e.target.closest('.step').remove();
  }
});

// 등록 폼을 수정 화면으로도 쓴다. null이면 등록, id가 있으면 그 레시피 수정.
let editingId = null;

async function loadForEdit(id) {
  const res = await fetch(`${API}/api/recipes/${encodeURIComponent(id)}`, { credentials: 'include' });
  if (!res.ok) {
    location.hash = '#manage';
    return;
  }

  const r = await res.json();
  const form = $('recipe-form');
  ['title', 'beanName', 'purchaseUrl', 'origin', 'dripper', 'serveType', 'coffeeAmount',
    'waterAmount', 'waterTemp', 'grindSize', 'grinder', 'description']
    .forEach(key => form.elements[key].value = r[key] ?? '');

  // 예전 레시피는 드리퍼가 enum 키(KALITA_WAVE)로 저장돼 있어 사람이 읽는 이름으로 바꿔 채운다.
  form.elements.dripper.value = DRIPPERS[r.dripper] ?? r.dripper ?? '';

  $('steps').innerHTML = '';
  r.steps.forEach(s => addStep(s.startTimeSeconds, s.pourAmount, s.note ?? ''));

  editingId = r.id;
  $('form-error').classList.add('hidden');
  $('submit-recipe').textContent = '수정 저장';
}

function resetForm() {
  editingId = null;
  $('recipe-form').reset();
  resetSteps();
  $('form-error').classList.add('hidden');
  $('submit-recipe').textContent = '등록하기';
}

$('recipe-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = new FormData(e.target);
  const text = key => (form.get(key) || '').trim() || null;
  const number = key => Number(form.get(key));

  const body = {
    title: text('title'), beanName: text('beanName'), purchaseUrl: text('purchaseUrl'),
    origin: text('origin'), grindSize: text('grindSize'),
    grinder: text('grinder'),
    description: text('description'),
    dripper: form.get('dripper'),
    serveType: form.get('serveType'),
    coffeeAmount: number('coffeeAmount'), waterAmount: number('waterAmount'), waterTemp: number('waterTemp'),
    steps: [...$('steps').children].map(row => ({
      startTimeSeconds: Number(row.querySelector('[name=startTimeSeconds]').value),
      pourAmount: Number(row.querySelector('[name=pourAmount]').value),
      note: row.querySelector('[name=note]').value.trim() || null
    }))
  };

  const res = await fetch(`${API}/api/recipes${editingId ? `/${editingId}` : ''}`, {
    method: editingId ? 'PUT' : 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...csrfHeader() },
    body: JSON.stringify(body)
  });

  if (res.status === 401) {
    location.replace('login.html');
    return;
  }
  if (!res.ok) {
    $('form-error').textContent = '저장에 실패했습니다. 입력값을 확인해주세요.';
    $('form-error').classList.remove('hidden');
    return;
  }

  const saved = await res.json();
  const goTo = editingId ? `#recipe/${saved.id}` : '#manage'; // 수정은 방금 고친 화면, 등록은 내 레시피 관리로
  resetForm();
  location.hash = goTo;
});

addEventListener('hashchange', route);
$('sort').addEventListener('change', route);

// 타이핑마다 요청하지 않게 잠깐 모았다 보낸다.
let searchTimer;
$('q').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(route, 250);
});

// 회원 정보 수정. 지금 고칠 수 있는 건 닉네임뿐이라 PATCH 한 방으로 끝난다.
$('profile-form').addEventListener('submit', async e => {
  e.preventDefault();
  const res = await fetch(`${API}/api/me`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...csrfHeader() },
    body: JSON.stringify({ nickname: e.target.nickname.value.trim() })
  });

  if (res.status === 401) {
    location.replace('login.html');
    return;
  }
  if (!res.ok) {
    $('profile-error').textContent = res.status === 409 ? '이미 쓰이는 닉네임입니다.' : '저장에 실패했습니다.';
    $('profile-error').classList.remove('hidden');
    return;
  }

  $('nickname').textContent = (await res.json()).nickname; // 저장됐다는 표시는 위 인사말이 바뀌는 걸로 충분하다
  $('profile-error').classList.add('hidden');
});

// 탈퇴. 등록한 레시피는 남기고 계정과 저장 목록만 지운다(서버도 같은 규칙).
$('withdraw').addEventListener('click', async () => {
  if (!confirm('정말 탈퇴할까요? 저장 목록이 사라집니다. 등록한 레시피는 남고 작성자만 지워집니다.')) {
    return;
  }

  await fetch(`${API}/api/me`, { method: 'DELETE', credentials: 'include', headers: csrfHeader() });
  location.replace('login.html');
});

$('logout').addEventListener('click', async () => {
  await fetch(`${API}/logout`, { method: 'POST', credentials: 'include', headers: csrfHeader() });
  location.replace('login.html');
});
