// 저장된 키(옛 enum 값)를 화면용 이름으로 바꾼다. 등록 폼 datalist의 추천 목록이기도 하다.
// ponytail: 목록을 API로 내려주지 않고 하드코딩. 도구가 자주 바뀌면 그때 엔드포인트로.
const METHODS = {
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

const TABS = {
  home: { title: '전체 레시피', view: 'view-list', path: '' },
  new: { title: '레시피 등록', view: 'view-new' },
  mine: { title: '저장한 레시피', view: 'view-list', path: '/saved' },
  manage: { title: '내 레시피 관리', view: 'view-list', path: '/mine' },
  me: { title: '마이', view: 'view-me' }
};

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

// 로그인 안 돼 있으면 로그인 화면으로 넘긴다.
fetchMe().then(me => {
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

const options = Object.entries(METHODS)
  .map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
$('grinders').innerHTML = GRINDERS.map(g => `<option value="${esc(g)}">`).join('');

$('brewMethod').insertAdjacentHTML('beforeend', options);   // 필터: "전체 도구" 뒤에 붙인다
document.querySelector('[name=brewMethod]').innerHTML = options; // 등록 폼: 하나는 반드시 고른다

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

async function loadRecipes(path) {
  const params = new URLSearchParams();
  if ($('brewMethod').value) params.set('brewMethod', $('brewMethod').value);
  if ($('q').value.trim()) params.set('q', $('q').value.trim());

  const query = params.toString();
  const res = await fetch(`${API}/api/recipes${path}${query ? `?${query}` : ''}`, { credentials: 'include' });

  $('empty').textContent = params.has('q') ? '검색 결과가 없습니다.'
    : path === '/saved' ? '저장한 레시피가 없습니다.' : '아직 등록된 레시피가 없습니다.';
  render(res.ok ? await res.json() : []);
}

function render(recipes) {
  // 제목/원두명은 사용자 입력이라 innerHTML에 넣기 전에 반드시 이스케이프한다.
  $('recipes').innerHTML = recipes.map(r => `
    <li class="card">
      <a href="#recipe/${r.id}">
        <div class="top">
          <h2>${esc(r.title)}</h2>
          <span class="method">${esc(METHODS[r.brewMethod] ?? r.brewMethod)}</span>
        </div>
        <p class="bean">${esc([r.beanName, r.roaster].filter(Boolean).join(' · ')) || '원두 정보 없음'}</p>
      ${r.tags?.length ? `<p class="tags">${r.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</p>` : ''}
        <div class="bottom">
          <span class="spec">1:${r.ratio.toFixed(1)} · ${r.coffeeAmount}g / ${r.waterAmount}g · ${r.waterTemp}℃</span>
          <span class="by">${esc(r.author)}</span>
        </div>
      </a>
    </li>`).join('');
  $('empty').classList.toggle('hidden', recipes.length > 0);
}

async function loadDetail(id) {
  const res = await fetch(`${API}/api/recipes/${encodeURIComponent(id)}`, { credentials: 'include' });
  if (!res.ok) {
    $('view-detail').innerHTML = `${backLink()}
      <p class="empty">레시피를 찾을 수 없습니다.</p>`;
    return;
  }
  renderDetail(await res.json());
}

// 이미 이스케이프된 문자열에만 쓴다 — #태그만 강조하고 나머지는 그대로 둔다.
const tagged = html => html.replace(/#[^\s#]+/g, m => `<span class="tag">${m}</span>`);

const mmss = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

function renderDetail(r) {
  $('title').textContent = r.title;

  // 값이 없는 항목은 줄 자체를 안 그린다(원산지/분쇄도는 선택 입력).
  const rows = [
    ['원두', [r.beanName, r.roaster].filter(Boolean).join(' · ')],
    ['원산지', r.origin],
    ['로스팅', r.roastLevel],
    ['비율', `1:${r.ratio.toFixed(1)} (${r.coffeeAmount}g / ${r.waterAmount}g)`],
    ['물 온도', `${r.waterTemp}℃`],
    ['그라인더', r.grinder],
    ['분쇄도', r.grindSize]
  ].filter(([, value]) => value);

  $('view-detail').innerHTML = `
    ${backLink()}
    <div class="detail">
      <p class="method">${esc(METHODS[r.brewMethod] ?? r.brewMethod)}</p>
      <p class="by">${esc(r.author)} · ${esc(r.createdAt.slice(0, 10).replaceAll('-', '.'))}</p>
      <dl>${rows.map(([label, value]) => `<dt>${label}</dt><dd>${esc(value)}</dd>`).join('')}</dl>
      ${r.description ? `<p class="desc">${tagged(esc(r.description))}</p>` : ''}

      <h2>푸어 단계</h2>
      <ol>${r.steps.map(s => `
        <li>
          <span class="at">${mmss(s.startTimeSeconds)}</span>
          <span class="pour">${s.pourAmount}g</span>
          <span class="note">${esc(s.note ?? '')}</span>
        </li>`).join('')}
      </ol>

      <div class="actions">
        <button type="button" id="save-toggle" class="${r.saved ? 'on' : ''}">${r.saved ? '★ 저장됨' : '☆ 저장하기'}</button>
        ${r.mine ? `<a href="#edit/${r.id}">수정</a>
        <button type="button" id="delete-recipe" class="danger">삭제</button>` : ''}
      </div>
    </div>`;

  $('save-toggle').addEventListener('click', () => toggleSave(r));
  if (r.mine) {
    $('delete-recipe').addEventListener('click', () => removeRecipe(r.id));
  }
}

/** 저장/저장 취소. 버튼 상태만 바뀌니 응답을 기다렸다가 그대로 다시 그린다. */
async function toggleSave(r) {
  const res = await fetch(`${API}/api/recipes/${r.id}/save`, {
    method: r.saved ? 'DELETE' : 'POST',
    credentials: 'include',
    headers: csrfHeader()
  });

  if (res.status === 401) {
    location.replace('login.html');
    return;
  }
  if (!res.ok) {
    return;
  }

  renderDetail({ ...r, saved: !r.saved });
}

async function removeRecipe(id) {
  if (!confirm('이 레시피를 삭제할까요? 되돌릴 수 없습니다.')) {
    return;
  }

  const res = await fetch(`${API}/api/recipes/${id}`, {
    method: 'DELETE', credentials: 'include', headers: csrfHeader()
  });

  if (res.status === 401) {
    location.replace('login.html');
    return;
  }
  location.hash = '#manage';
}

// 푸어 단계는 개수가 정해져 있지 않아 행을 그때그때 붙인다. stepOrder는 서버가 배열 순서대로 매긴다.
function addStep(startTimeSeconds = '', pourAmount = '', note = '') {
  $('steps').insertAdjacentHTML('beforeend', `
    <div class="step">
      <label>시작(초) <input type="number" name="startTimeSeconds" min="0" max="3600" value="${startTimeSeconds}" required></label>
      <label>붓는 양(g) <input type="number" name="pourAmount" min="1" max="5000" value="${pourAmount}" required></label>
      <label class="note">메모 <input name="note" maxlength="100" placeholder="뜸들이기" value="${esc(note)}"></label>
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
  ['title', 'beanName', 'roaster', 'origin', 'roastLevel', 'brewMethod', 'coffeeAmount',
    'waterAmount', 'waterTemp', 'grindSize', 'grinder', 'description']
    .forEach(key => form.elements[key].value = r[key] ?? '');

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
    title: text('title'), beanName: text('beanName'), roaster: text('roaster'),
    origin: text('origin'), roastLevel: text('roastLevel'), grindSize: text('grindSize'),
    grinder: text('grinder'),
    description: text('description'),
    brewMethod: form.get('brewMethod'),
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
$('brewMethod').addEventListener('change', route);

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
