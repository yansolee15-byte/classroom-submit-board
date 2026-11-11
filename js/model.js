export const NONE = 'none';
export const PROGRESS = 'progress';
export const DONE = 'done';
export const VALID = [NONE, PROGRESS, DONE];

export function nextStatus(status = NONE, allowProgress = false) {
  const order = allowProgress ? [NONE, PROGRESS, DONE] : [NONE, DONE];
  const index = order.indexOf(status);
  return order[(index < 0 ? 0 : index + 1) % order.length];
}

export function statusLabel(status) {
  return ({ none: '미완료', progress: '진행 중', done: '완료' })[status] ?? '미완료';
}

export function statusIcon(status) {
  return ({ none: '○', progress: '◐', done: '✓' })[status] ?? '○';
}

export function submissionId(itemId, studentId) {
  return `${itemId}__${studentId}`;
}

export function getStatus(data, itemId, studentId) {
  return data.submissions.find(s => s.id === submissionId(itemId, studentId))?.status ?? NONE;
}

export function stats(data, itemId) {
  const counts = { none: 0, progress: 0, done: 0 };
  for (const student of data.students) {
    const status = getStatus(data, itemId, student.id);
    counts[VALID.includes(status) ? status : NONE]++;
  }
  return counts;
}

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

export function orderedStudents(students) {
  return [...students].sort((a, b) => Number(a.number) - Number(b.number) || a.name.localeCompare(b.name, 'ko'));
}

export function orderedItems(items) {
  return [...items].sort((a, b) => Number(a.archived) - Number(b.archived) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.title.localeCompare(b.title, 'ko'));
}
