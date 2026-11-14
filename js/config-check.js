// Firebase 프로젝트 설정이 일부만 입력되었을 때 조용히 데모로 돌아가지 않도록 한다.
export function checkFirebaseConfiguration(config, teacherUid) {
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const provided = required.filter(key => String(config?.[key] ?? '').trim());
  if (provided.length === 0) return {mode: 'demo'};
  const missing = required.filter(key => !String(config?.[key] ?? '').trim());
  if (missing.length) {
    return {mode: 'invalid', message: `Firebase 웹 앱 설정이 누락되었습니다. js/config.js의 ${missing.join(', ')} 항목을 확인해 주세요.`};
  }
  if (!String(teacherUid ?? '').trim()) {
    return {mode: 'invalid', message: '교사 UID가 입력되지 않았습니다. Firebase Authentication에서 교사 계정의 UID를 확인한 뒤 js/config.js에 입력해 주세요.'};
  }
  return {mode: 'firebase'};
}
