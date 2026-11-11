import { createStore } from './store.js';
import { NONE, PROGRESS, DONE, nextStatus, statusLabel, statusIcon,
  getStatus, stats, escapeHTML as h, orderedStudents, orderedItems } from './model.js';

const $app = document.getElementById('app');
let store;
let state = {data: {students:[], items:[], submissions:[]}, teacher:false};
const adminEntry = new URLSearchParams(window.location.search).has('admin');
let view = adminEntry ? 'login' : 'student';
let teacherTab = 'overview';
let teacherMode = 'item';
let activeItemId = null;
let activeStudentId = null;
let editingItemId = null;
let editingStudentId = null;
let modal = null; // {itemId, initial, draft, touched:Set}
let selectedForBulk = new Set();
let busy = false;
let toastTimer;
let errorText = '';

function toast(message, error = false) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'toast'; el.className = `toast ${error ? 'error' : ''}`;
  el.textContent = message;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 4600);
}
function showError(message) { errorText = message; toast(message, true); }
function activeItems() { return orderedItems(state.data.items.filter(item => !item.archived)); }
function students() { return orderedStudents(state.data.students); }
function itemById(itemId) { return state.data.items.find(i => i.id === itemId); }
function choiceClass(status) { return ` ${status === DONE ? 'done' : status === PROGRESS ? 'progress' : 'none'}`; }
function itemCounts(itemId) { return stats(state.data, itemId); }
function numberGrid(item) {
  return `<div class="number-grid">${students().map(s => {
    const status = getStatus(state.data, item.id, s.id);
    return `<div class="number-tile${choiceClass(status)}" title="${h(s.number)}번: ${h(statusLabel(status))}" aria-label="${h(s.number)}번 ${h(statusLabel(status))}"><span>${h(s.number)}</span><span class="number-icon">${statusIcon(status)}</span></div>`;
  }).join('')}</div>`;
}
function header() {
  return `<header class="site-header"><div class="header-content">
    <div class="brand"><span class="logo">✓</span> 우리 반 제출 현황판</div>
    <div class="header-actions">
      ${view === 'teacher' ? `<span class="hint">교사 관리</span><button class="btn small" data-action="sign-out">학생 화면으로</button>`
        : view === 'login' ? `<button class="btn small" data-action="go-student">돌아가기</button>`
        : ''}
    </div></div></header>`;
}
function demoBanner() {
  return store?.mode === 'demo' ? `<div class="banner"><strong>가상 데이터 체험 모드</strong> · Firebase에 연결되지 않았어. 이 기기 브라우저에만 예시 기록이 저장돼. 실제 학생 정보는 입력하지 마.
    <button class="btn small" style="margin-left:8px" data-action="reset-demo">예시 초기화</button></div>` : '';
}
function renderStudent() {
  const items = activeItems();
  return `<main class="container">${demoBanner()}
    <div class="lead"><div><h1>우리 반 제출 현황</h1></div>
    <div class="count">${students().length}명 · ${items.length}개 항목</div></div>
    ${!items.length ? '<div class="panel empty">아직 등록된 제출 항목이 없어. 선생님이 항목을 추가하면 여기에 나타나.</div>' : ''}
    <div class="cards">${items.map(item => {
      const counts = itemCounts(item.id);
      return `<button class="card click-card" data-action="open-modal" data-id="${h(item.id)}" aria-label="${h(item.title)} 제출 상태 체크하기">
        <div class="card-head"><div><div class="item-name">${h(item.title)}</div><div class="item-meta">${item.dueDate ? `제출 기한: ${h(item.dueDate)}` : '제출 기한 없음'}</div></div>
        ${item.allowProgress ? '<span class="pill">진행 중 사용</span>' : ''}</div>
        ${numberGrid(item)}
        <div class="card-foot"><span class="summary">완료 ${counts.done}/${students().length}명${item.allowProgress ? ` · 진행 중 ${counts.progress}명` : ''}</span></div>
      </button>`;
    }).join('')}</div>
    <div class="legend"><span><i class="dot"></i>미완료</span><span><i class="dot progress"></i>진행 중</span><span><i class="dot done"></i>완료</span></div>
  </main>`;
}
function renderModal() {
  if (!modal) return '';
  const item = itemById(modal.itemId);
  if (!item) { modal = null; return ''; }
  return `<div class="modal-backdrop" role="presentation"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-top"><div><h2 id="modal-title">${h(item.title)}</h2></div>
      <button class="btn small ghost" aria-label="닫기" data-action="close-modal">✕</button></div>
    <div class="modal-body"><div class="student-grid">${students().map(student => {
      const status = modal.draft[student.id] ?? NONE;
      return `<button class="student-choice${choiceClass(status)}" data-action="toggle-student" data-id="${h(student.id)}" aria-label="${h(student.number)}번 ${h(student.name)} ${h(statusLabel(status))}">
        <span class="student-n">${h(student.number)}번 ${h(student.name)}</span>
        <span class="choice-state">${statusIcon(status)} ${statusLabel(status)}</span></button>`;
    }).join('')}</div></div>
    <div class="modal-bottom"><button class="btn" data-action="close-modal">취소</button>
      <button class="btn primary" data-action="save-modal" ${busy ? 'disabled' : ''}>${busy ? '저장 중…' : '저장'}</button></div>
  </section></div>`;
}
function renderLogin() {
  return `<main class="container">${demoBanner()}
    <div class="panel" style="max-width:450px;margin:30px auto"><h1>선생님 로그인</h1>
      <p class="muted">등록된 교사 계정으로 로그인해 학급을 관리해.</p>
      <form data-form="login" class="field" style="gap:14px;margin-top:20px">
        <div class="field"><label for="teacher-email">이메일</label><input type="email" id="teacher-email" name="email" required autocomplete="username" /></div>
        <div class="field"><label for="teacher-password">비밀번호</label><input type="password" id="teacher-password" name="password" required autocomplete="current-password" /></div>
        <button type="submit" class="btn primary" ${busy ? 'disabled' : ''}>로그인</button>
      </form></div></main>`;
}
function teacherNav() {
  return `<div class="tabs">${[
    ['overview','제출 현황'], ['items','제출 항목 관리'], ['students','학생 관리']
  ].map(([key,name]) => `<button class="btn${teacherTab === key ? ' active' : ''}" data-action="teacher-tab" data-id="${key}">${name}</button>`).join('')}</div>`;
}
function renderTeacher() {
  return `<main class="container">${demoBanner()}<h1>교사용 관리 화면</h1><p class="muted">항목과 명단을 관리하고 제출 현황을 확인해.</p>
    ${teacherNav()}${teacherTab === 'overview' ? renderOverview() : teacherTab === 'items' ? renderItems() : renderStudents()}
  </main>`;
}
function renderOverview() {
  const allItems = activeItems();
  const selectedItem = itemById(activeItemId) && !itemById(activeItemId).archived ? itemById(activeItemId) : allItems[0];
  const chosenStudent = state.data.students.find(s => s.id === activeStudentId) || students()[0];
  const pending = allItems.reduce((sum, item) => sum + itemCounts(item.id).progress, 0);
  const missing = allItems.reduce((sum, item) => sum + itemCounts(item.id).none, 0);
  return `<div class="stat-row">
    <div class="stat-box"><div class="big">${students().length}</div><div class="caption">등록 학생</div></div>
    <div class="stat-box"><div class="big">${pending}</div><div class="caption">진행 중 건수</div></div>
    <div class="stat-box"><div class="big">${missing}</div><div class="caption">미완료 건수</div></div>
  </div><section class="panel">
    <div class="row space"><h2>제출 현황 상세</h2><div class="tabs" style="margin:0">
      <button class="btn small${teacherMode === 'item' ? ' active' : ''}" data-action="teacher-mode" data-id="item">항목별 보기</button>
      <button class="btn small${teacherMode === 'student' ? ' active' : ''}" data-action="teacher-mode" data-id="student">학생별 보기</button>
    </div></div>
    ${teacherMode === 'item' ? `
      <div class="field"><label for="teacher-item-selector">제출 항목 선택</label>
      <select id="teacher-item-selector" data-select="item"><option value="">항목 선택</option>${allItems.map(item => `<option value="${h(item.id)}" ${item.id === selectedItem?.id ? 'selected' : ''}>${h(item.title)}</option>`).join('')}</select></div>
      ${selectedItem ? renderTeacherItemTable(selectedItem) : '<p class="empty">등록된 항목이 없어.</p>'}
    ` : `
      <div class="field"><label for="teacher-student-selector">학생 선택</label>
      <select id="teacher-student-selector" data-select="student"><option value="">학생 선택</option>${students().map(s => `<option value="${h(s.id)}" ${s.id === chosenStudent?.id ? 'selected' : ''}>${h(s.number)}번 ${h(s.name)}</option>`).join('')}</select></div>
      ${chosenStudent ? `<div class="table-wrap"><table><thead><tr><th>제출 항목</th><th>제출 상태</th><th>변경</th></tr></thead><tbody>${allItems.map(item => {
        const status = getStatus(state.data, item.id, chosenStudent.id);
        return `<tr><td>${h(item.title)}</td><td>${statusIcon(status)} ${statusLabel(status)}</td><td><button class="teacher-row-btn${choiceClass(status)}" data-action="teacher-status" data-item="${h(item.id)}" data-student="${h(chosenStudent.id)}">상태 변경 ↻</button></td></tr>`;
      }).join('')}</tbody></table></div>` : '<p class="empty">등록된 학생이 없어.</p>'}
    `}</section>`;
}
function renderTeacherItemTable(item) {
  const counts = itemCounts(item.id);
  return `<div class="row space" style="margin:16px 0 10px"><p class="help">완료 ${counts.done}명 · 진행 중 ${counts.progress}명 · 미완료 ${counts.none}명</p>
    <div class="row"><button class="btn small" data-action="bulk-done" ${!selectedForBulk.size ? 'disabled' : ''}>선택한 학생 완료</button><button class="btn small" data-action="bulk-none" ${!selectedForBulk.size ? 'disabled' : ''}>선택한 학생 미완료</button></div></div>
    <div class="table-wrap"><table><thead><tr><th><input type="checkbox" data-select-all="yes" aria-label="학생 전체 선택" /></th><th>번호</th><th>이름</th><th>상태</th><th>교사 변경</th></tr></thead><tbody>
    ${students().map(student => {
      const status = getStatus(state.data, item.id, student.id);
      return `<tr><td><input type="checkbox" data-select-student="${h(student.id)}" ${selectedForBulk.has(student.id) ? 'checked' : ''} aria-label="${h(student.number)}번 선택" /></td>
        <td>${h(student.number)}</td><td>${h(student.name)}</td><td>${statusIcon(status)} ${statusLabel(status)}</td>
        <td><button class="teacher-row-btn${choiceClass(status)}" data-action="teacher-status" data-item="${h(item.id)}" data-student="${h(student.id)}">상태 변경 ↻</button></td></tr>`;
    }).join('')}</tbody></table></div>`;
}
function renderItems() {
  const item = itemById(editingItemId);
  return `<section class="panel"><h2>${item ? '제출 항목 수정' : '새 제출 항목 추가'}</h2>
  <form data-form="item" class="form-grid">
    <div class="field"><label for="item-title">제출 항목명 *</label><input id="item-title" name="title" maxlength="100" value="${h(item?.title ?? '')}" placeholder="예: 현장체험학습 신청서" required /></div>
    <div class="field"><label for="item-due">제출 기한 (선택)</label><input type="date" id="item-due" name="dueDate" value="${h(item?.dueDate ?? '')}" /></div>
    <label class="checkbox-line"><input type="checkbox" name="allowProgress" ${item?.allowProgress ? 'checked' : ''} /> 진행 중 허용 (미완료 → 진행 중 → 완료)</label>
    <div class="row"><button class="btn primary" type="submit" ${busy ? 'disabled' : ''}>${item ? '수정 저장' : '항목 추가'}</button>${item ? '<button type="button" class="btn" data-action="cancel-edit-item">수정 취소</button>' : ''}</div>
  </form></section>
  <section class="panel"><h2>등록된 항목 ${state.data.items.length}개</h2><div class="table-wrap"><table>
    <thead><tr><th>항목명</th><th>방식</th><th>상태</th><th>관리</th></tr></thead><tbody>
    ${orderedItems(state.data.items).map(i => `<tr><td><strong>${h(i.title)}</strong><div class="help">${i.dueDate ? h(i.dueDate) : '기한 없음'}</div></td>
      <td>${i.allowProgress ? '진행 중 허용' : '완료 체크'}</td><td>${i.archived ? '보관됨' : '사용 중'}</td>
      <td><div class="table-actions"><button class="btn small" data-action="edit-item" data-id="${h(i.id)}">수정</button>
      <button class="btn small" data-action="archive-item" data-id="${h(i.id)}">${i.archived ? '복원' : '보관'}</button>
      <button class="btn small danger" data-action="delete-item" data-id="${h(i.id)}">삭제</button></div></td></tr>`).join('')}
    </tbody></table></div></section>`;
}
function renderStudents() {
  const student = state.data.students.find(s => s.id === editingStudentId);
  return `<section class="panel"><h2>${student ? '학생 정보 수정' : '학생 추가'}</h2>
    <form data-form="student" class="form-grid"><div class="field"><label for="student-name">이름 *</label>
      <input id="student-name" name="name" maxlength="40" required value="${h(student?.name ?? '')}" placeholder="학생 이름" /></div>
      <div class="field"><label for="student-number">출석번호 *</label><input type="number" min="1" max="999" id="student-number" name="number" required value="${h(student?.number ?? '')}" /></div>
      <div class="row"><button class="btn primary" type="submit" ${busy ? 'disabled' : ''}>${student ? '수정 저장' : '학생 추가'}</button>
        ${student ? '<button type="button" class="btn" data-action="cancel-edit-student">수정 취소</button>' : ''}</div>
    </form></section>
    <section class="panel"><h2>학생 일괄 등록</h2><p class="help">한 줄에 <strong>번호,이름</strong>을 입력해. 예: 1,김하늘 (중복 출석번호는 등록되지 않아.)</p>
      <form data-form="bulk-students"><div class="field"><label for="bulk-list">여러 학생 추가</label><textarea id="bulk-list" name="students" rows="4" placeholder="1,김하늘&#10;2,박서준" required></textarea></div>
      <button class="btn" type="submit" style="margin-top:10px">명단 일괄 등록</button></form></section>
    <section class="panel"><h2>등록 학생 ${students().length}명</h2><div class="table-wrap"><table><thead><tr><th>번호</th><th>이름</th><th>관리</th></tr></thead><tbody>
    ${students().map(s => `<tr><td>${h(s.number)}</td><td>${h(s.name)}</td><td class="table-actions">
      <button class="btn small" data-action="edit-student" data-id="${h(s.id)}">수정</button>
      <button class="btn small danger" data-action="delete-student" data-id="${h(s.id)}">삭제</button></td></tr>`).join('')}
    </tbody></table></div></section>`;
}
function render() {
  $app.innerHTML = header() + (view === 'teacher' && state.teacher ? renderTeacher() : view === 'login' ? renderLogin() : renderStudent()) + renderModal();
}
async function withBusy(operation, successMessage) {
  if (busy) return;
  busy = true; render();
  try { await operation(); if (successMessage) toast(successMessage); }
  catch (e) { showError(e.message || '처리 중 오류가 발생했어.'); }
  finally { busy = false; render(); }
}
function openModal(itemId) {
  const item = itemById(itemId); if (!item) return;
  const initial = Object.fromEntries(students().map(s => [s.id, getStatus(state.data, itemId, s.id)]));
  modal = {itemId, initial, draft: {...initial}, touched: new Set()};
  render();
}
async function saveModal() {
  if (!modal) return;
  const draft = modal;
  const changes = {};
  for (const studentId of draft.touched) {
    if (draft.draft[studentId] === draft.initial[studentId]) continue;
    // 팝업이 열려 있는 동안 다른 태블릿이 같은 학생을 수정했다면 덮어쓰지 않는다.
    const latest = getStatus(state.data, draft.itemId, studentId);
    if (latest !== draft.initial[studentId]) {
      showError('다른 기기에서 같은 학생의 상태가 바뀌었어. 팝업을 다시 열어 확인해 줘.');
      return;
    }
    changes[studentId] = draft.draft[studentId];
  }
  if (Object.keys(changes).length === 0) { modal = null; render(); return; }
  await withBusy(async () => { await store.saveSubmissions(draft.itemId, changes, draft.initial); modal = null; }, '변경 사항을 저장했어.');
}
function uniqueNumber(number, exceptId = null) {
  return state.data.students.some(s => Number(s.number) === number && s.id !== exceptId);
}
async function handleClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button || busy) return;
  const action = button.dataset.action, targetId = button.dataset.id;
  if (action === 'go-teacher') {
    if (store.mode === 'demo') {
      await store.loginTeacher(); view = 'teacher'; render();
    } else { view = 'login'; render(); }
  }
  if (action === 'go-student') { view = 'student'; render(); }
  if (action === 'sign-out') { await withBusy(() => store.logoutTeacher(), '학생 화면으로 돌아왔어.'); view = 'student'; render(); }
  if (action === 'open-modal') openModal(targetId);
  if (action === 'close-modal') { modal = null; render(); }
  if (action === 'toggle-student' && modal) {
    const item = itemById(modal.itemId);
    modal.draft[targetId] = nextStatus(modal.draft[targetId], item.allowProgress);
    modal.touched.add(targetId); render();
  }
  if (action === 'save-modal') await saveModal();
  if (action === 'reset-demo' && store.mode === 'demo' && confirm('가상 데이터를 처음 상태로 돌릴까?')) {
    store.resetDemo(); view = 'student'; modal = null; render();
  }
  if (action === 'teacher-tab') { teacherTab = targetId; editingItemId = null; editingStudentId = null; selectedForBulk.clear(); render(); }
  if (action === 'teacher-mode') { teacherMode = targetId; selectedForBulk.clear(); render(); }
  if (action === 'teacher-status') {
    const item = itemById(button.dataset.item), studentId = button.dataset.student;
    await withBusy(() => store.saveSubmissions(item.id, {[studentId]: nextStatus(getStatus(state.data, item.id, studentId), item.allowProgress)}), '제출 상태를 수정했어.');
  }
  if (action === 'bulk-done' || action === 'bulk-none') {
    const itemId = activeItemId && activeItems().some(i=>i.id===activeItemId) ? activeItemId : activeItems()[0]?.id;
    if (!itemId || selectedForBulk.size===0) return;
    const updates = Object.fromEntries([...selectedForBulk].map(id => [id, action === 'bulk-done' ? DONE : NONE]));
    await withBusy(() => store.saveSubmissions(itemId, updates), '선택한 학생의 상태를 변경했어.');
    selectedForBulk.clear(); render();
  }
  if (action === 'edit-item') { editingItemId = targetId; render(); window.scrollTo({top:0,behavior:'smooth'}); }
  if (action === 'cancel-edit-item') { editingItemId = null; render(); }
  if (action === 'archive-item') {
    const item = itemById(targetId);
    await withBusy(() => store.updateItem(targetId, {archived: !item.archived}), item.archived ? '항목을 복원했어.' : '항목을 보관했어.');
  }
  if (action === 'delete-item') {
    const item = itemById(targetId);
    if (confirm(`'${item.title}' 항목과 관련 제출 기록을 모두 삭제할까? 되돌릴 수 없어.`)) {
      await withBusy(() => store.deleteItem(targetId), '항목을 삭제했어.');
      if (editingItemId === targetId) editingItemId = null;
    }
  }
  if (action === 'edit-student') { editingStudentId = targetId; render(); window.scrollTo({top:0,behavior:'smooth'}); }
  if (action === 'cancel-edit-student') { editingStudentId = null; render(); }
  if (action === 'delete-student') {
    const student = state.data.students.find(s => s.id === targetId);
    if (confirm(`${student.number}번 ${student.name} 학생과 모든 제출 기록을 삭제할까? 되돌릴 수 없어.`)) {
      await withBusy(() => store.deleteStudent(targetId), '학생을 삭제했어.');
      if (editingStudentId === targetId) editingStudentId = null;
    }
  }
}
async function handleSubmit(event) {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  const values = new FormData(form);
  if (form.dataset.form === 'login') {
    await withBusy(async () => {await store.loginTeacher(values.get('email'), values.get('password')); view = 'teacher';}, '선생님 계정으로 로그인했어.');
  }
  if (form.dataset.form === 'student') {
    const number = Number(values.get('number')), name = String(values.get('name')).trim();
    if (!Number.isInteger(number) || number <= 0 || !name) return showError('출석번호와 이름을 올바르게 입력해 줘.');
    if (uniqueNumber(number, editingStudentId)) return showError('이미 등록된 출석번호야.');
    await withBusy(async () => {
      if (editingStudentId) await store.updateStudent(editingStudentId, {number,name});
      else await store.addStudent({number,name});
      editingStudentId = null;
    }, '학생 정보를 저장했어.');
  }
  if (form.dataset.form === 'bulk-students') {
    const lines = String(values.get('students') ?? '').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const entries = [];
    for (const line of lines) {
      const match = line.match(/^(\d+)\s*[,\t]\s*(.+)$/);
      if (!match) return showError(`'${line}' 줄은 '번호,이름' 형식으로 작성해 줘.`);
      const number = Number(match[1]), name = match[2].trim();
      if (number <= 0 || !name || uniqueNumber(number) || entries.some(s => s.number === number)) return showError(`중복되거나 잘못된 번호가 있어: ${line}`);
      entries.push({number,name});
    }
    await withBusy(() => store.addStudents(entries), `${entries.length}명을 추가했어.`);
  }
  if (form.dataset.form === 'item') {
    const title = String(values.get('title')).trim();
    const dueDate = String(values.get('dueDate') || '');
    const allowProgress = values.get('allowProgress') === 'on';
    if (!title) return showError('제출 항목명을 입력해 줘.');
    const oldItem = itemById(editingItemId);
    if (oldItem?.allowProgress && !allowProgress && state.data.submissions.some(s => s.itemId === oldItem.id && s.status === PROGRESS)) {
      if (!confirm('진행 중 허용을 끄면 기존 진행 중 상태는 모두 미완료로 돌아가. 계속할까?')) return;
    }
    await withBusy(async () => {
      if (editingItemId) await store.updateItem(editingItemId, {title,dueDate,allowProgress});
      else await store.addItem({title,dueDate,allowProgress});
      editingItemId = null;
    }, '제출 항목을 저장했어.');
  }
}
function handleChange(event) {
  const select = event.target.dataset.select;
  if (select === 'item') { activeItemId = event.target.value; selectedForBulk.clear(); render(); }
  if (select === 'student') { activeStudentId = event.target.value; render(); }
  if (event.target.hasAttribute('data-select-student')) {
    const id = event.target.dataset.selectStudent;
    if (event.target.checked) selectedForBulk.add(id); else selectedForBulk.delete(id);
    render();
  }
  if (event.target.hasAttribute('data-select-all')) {
    selectedForBulk = event.target.checked ? new Set(students().map(s => s.id)) : new Set();
    render();
  }
}
$app.addEventListener('click', event => { handleClick(event).catch(e=>showError(e.message)); });
$app.addEventListener('submit', event => { handleSubmit(event).catch(e=>showError(e.message)); });
$app.addEventListener('change', handleChange);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && modal && !busy) { modal = null; render(); }
});
try {
  store = await createStore(({data,teacher}) => {
    state = {data,teacher};
    if (!teacher && view==='teacher') view='student';
    render();
  }, showError);
  await store.start();
  // Keep student homepage clean; teachers enter via ?admin=1.
  if (adminEntry && store.mode === 'demo') {
    await store.loginTeacher();
    view = 'teacher';
  }
  render();
} catch (error) {
  $app.innerHTML = `<main class="container"><div class="panel"><h1>연결할 수 없어</h1><p class="muted">Firebase 설정이나 네트워크를 확인해 줘.</p><p>${h(error.message)}</p></div></main>`;
}
