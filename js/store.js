import { NONE, PROGRESS, DONE, submissionId, orderedStudents } from './model.js';
import { firebaseConfig, teacherUid } from './config.js';
import { checkFirebaseConfiguration } from './config-check.js';

const demoStudents = [
  '김하늘', '박서준', '이지우', '최도윤', '강민준',
  '윤서아', '정하린', '이준서', '최유진', '김도윤',
  '박하은', '한지우', '서민재', '장예린', '오시온'
].map((name, index) => ({ id: `s${index + 1}`, number: index + 1, name }));

function exampleData() {
  const students = demoStudents;
  const items = [
    { id: 'i1', title: '현장체험학습 신청서', dueDate: '', allowProgress: false, archived: false },
    { id: 'i2', title: '수학 익힘책 검사', dueDate: '', allowProgress: true, archived: false },
    { id: 'i3', title: '독서 기록장', dueDate: '', allowProgress: false, archived: false }
  ];
  const submissions = [];
  for (const item of items) for (const student of students) {
    const status = item.id === 'i1' ? (student.number <= 6 ? DONE : NONE)
      : item.id === 'i2' ? (student.number <= 3 ? DONE : student.number <= 8 ? PROGRESS : NONE)
      : (student.number % 3 === 0 ? DONE : NONE);
    if (status !== NONE) submissions.push({ id: submissionId(item.id, student.id), itemId: item.id, studentId: student.id, status });
  }
  return { students, items, submissions };
}

const DEMO_KEY = 'classroom-submission-board-v1';
const id = () => globalThis.crypto?.randomUUID?.().replaceAll('-', '').slice(0, 20) || `id${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
const clone = value => JSON.parse(JSON.stringify(value));

export async function createStore(onChange, onError) {
  const configStatus = checkFirebaseConfiguration(firebaseConfig, teacherUid);
  if (configStatus.mode === 'demo') return createDemoStore(onChange);
  if (configStatus.mode === 'invalid') throw new Error(configStatus.message);
  try { return await createFirebaseStore(onChange, onError); }
  catch (error) { onError(`Firebase 연결 실패: ${error.message}`); throw error; }
}

function createDemoStore(onChange) {
  let data;
  try { data = JSON.parse(localStorage.getItem(DEMO_KEY)) || exampleData(); }
  catch { data = exampleData(); }
  let teacher = false;
  function sync() {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(data)); } catch { /* 사생활 보호 모드에서는 저장 불가할 수 있음 */ }
    onChange({ data: clone(data), teacher });
  }
  const store = {
    mode: 'demo',
    async start() { sync(); },
    async loginTeacher() { teacher = true; sync(); },
    async logoutTeacher() { teacher = false; sync(); },
    async saveSubmissions(itemId, changes) {
      for (const [studentId, status] of Object.entries(changes)) {
        const sid = submissionId(itemId, studentId);
        data.submissions = data.submissions.filter(row => row.id !== sid);
        data.submissions.push({ id: sid, itemId, studentId, status });
      }
      sync();
    },
    async addStudent(student) {
      data.students.push({ ...student, id: id() }); sync();
    },
    async addStudents(students) {
      data.students.push(...students.map(student => ({...student, id: id()}))); sync();
    },
    async updateStudent(studentId, updates) {
      data.students = data.students.map(student => student.id === studentId ? {...student, ...updates} : student); sync();
    },
    async deleteStudent(studentId) {
      data.students = data.students.filter(s => s.id !== studentId);
      data.submissions = data.submissions.filter(s => s.studentId !== studentId); sync();
    },
    async addItem(item) {
      data.items.push({...item, id: id(), archived: false}); sync();
    },
    async updateItem(itemId, updates) {
      const wasProgress = data.items.find(item => item.id === itemId)?.allowProgress;
      data.items = data.items.map(item => item.id === itemId ? {...item, ...updates} : item);
      if (wasProgress && updates.allowProgress === false) {
        data.submissions = data.submissions.map(s => s.itemId === itemId && s.status === PROGRESS ? {...s, status: NONE} : s);
      }
      sync();
    },
    async deleteItem(itemId) {
      data.items = data.items.filter(item => item.id !== itemId);
      data.submissions = data.submissions.filter(s => s.itemId !== itemId); sync();
    },
    resetDemo() { data = exampleData(); teacher = false; sync(); }
  };
  return store;
}

async function createFirebaseStore(onChange, onError) {
  // GitHub Pages에서 별도 빌드 도구 없이 실행하기 위한 공식 ESM CDN 사용.
  const BASE = 'https://www.gstatic.com/firebasejs/13.2.0/';
  const [{initializeApp}, authSdk, dbSdk] = await Promise.all([
    import(`${BASE}firebase-app.js`),
    import(`${BASE}firebase-auth.js`),
    import(`${BASE}firebase-firestore.js`)
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = authSdk.getAuth(app);
  const db = dbSdk.getFirestore(app);
  let teacher = false;
  let unsubscribe = [];
  const data = { students: [], items: [], submissions: [] };
  const readyParts = new Set();
  let authInit;
  const authReady = new Promise(resolve => {authInit = resolve;});

  function publish() {
    if (readyParts.size === 3) onChange({data: clone(data), teacher});
  }
  function subscribe() {
    unsubscribe.forEach(fn => fn());
    unsubscribe = [];
    readyParts.clear();
    const collections = ['students', 'items', 'submissions'];
    for (const name of collections) {
      const stop = dbSdk.onSnapshot(dbSdk.collection(db, name), snapshot => {
        data[name] = snapshot.docs.map(d => ({...d.data(), id: d.id}));
        readyParts.add(name);
        publish();
      }, error => onError(`${name} 데이터 접근 오류: ${error.message}`));
      unsubscribe.push(stop);
    }
  }

  authSdk.onAuthStateChanged(auth, async user => {
    try {
      if (!user) {
        await authSdk.signInAnonymously(auth);
        return;
      }
      teacher = Boolean(teacherUid) && user.uid === teacherUid && !user.isAnonymous;
      subscribe();
      authInit();
    } catch (error) { onError(`인증 오류: ${error.message}`); authInit(); }
  }, error => { onError(`인증 오류: ${error.message}`); authInit(); });

  const ref = (name, docId) => dbSdk.doc(db, name, docId);
  const stamp = () => dbSdk.serverTimestamp();
  function teacherOnly() { if (!teacher) throw new Error('교사 인증이 필요해.'); }
  function batch() { return dbSdk.writeBatch(db); }

  return {
    mode: 'firebase',
    async start() { await authReady; },
    async loginTeacher(email, password) {
      if (!teacherUid) throw new Error('js/config.js에 교사 UID를 먼저 설정해야 해.');
      const result = await authSdk.signInWithEmailAndPassword(auth, email, password);
      if (result.user.uid !== teacherUid) {
        await authSdk.signOut(auth);
        throw new Error('등록된 교사 계정이 아니야.');
      }
      teacher = true;
      subscribe();
      publish();
    },
    async logoutTeacher() {
      await authSdk.signOut(auth); // auth observer가 익명 계정으로 자동 전환
      teacher = false;
    },
    async saveSubmissions(itemId, changes, expected = null) {
      const entries = Object.entries(changes);
      if (entries.length === 0) return;
      if (entries.length > 400) throw new Error('한 번에 수정할 수 있는 기록이 너무 많아.');
      // 학생 팝업은 스냅샷을 받은 뒤 같은 학생의 기록이 외부에서 바뀌었는지도 검사한다.
      // 화면에 보이는 데이터만 검사하면 읽기와 쓰기 사이의 경쟁 상태가 생길 수 있다.
      if (expected && !teacher) {
        await dbSdk.runTransaction(db, async tx => {
          const records = entries.map(([studentId]) => ref('submissions', submissionId(itemId, studentId)));
          const snapshots = [];
          // Firestore 트랜잭션에서는 모든 읽기를 쓰기보다 먼저 수행해야 한다.
          for (const recordRef of records) snapshots.push(await tx.get(recordRef));
          entries.forEach(([studentId, status], index) => {
            const current = snapshots[index].exists() ? snapshots[index].data().status : NONE;
            if (current !== (expected[studentId] ?? NONE)) {
              throw new Error('다른 기기에서 같은 학생의 상태가 먼저 변경되었어. 팝업을 닫았다가 다시 열어 확인해 줘.');
            }
          });
          entries.forEach(([studentId, status], index) => {
            tx.set(records[index], {itemId, studentId, status, updatedAt: stamp()}, {merge: true});
          });
        });
        return;
      }
      // 교사 관리화면의 일괄 변경은 명시적인 관리 작업이므로 최신 값으로 덮어쓴다.
      const w = batch();
      for (const [studentId, status] of entries) {
        w.set(ref('submissions', submissionId(itemId, studentId)),
          {itemId, studentId, status, updatedAt: stamp()}, {merge: true});
      }
      await w.commit();
    },
    async addStudent(student) {
      teacherOnly();
      await dbSdk.addDoc(dbSdk.collection(db, 'students'), {...student, createdAt: stamp()});
    },
    async addStudents(students) {
      teacherOnly();
      if (students.length > 450) throw new Error('한 번에 등록할 학생은 450명 이하로 해 줘.');
      const w = batch();
      for (const student of students) w.set(dbSdk.doc(dbSdk.collection(db, 'students')), {...student, createdAt: stamp()});
      await w.commit();
    },
    async updateStudent(studentId, updates) {
      teacherOnly();
      await dbSdk.updateDoc(ref('students', studentId), updates);
    },
    async deleteStudent(studentId) {
      teacherOnly();
      const w = batch();
      w.delete(ref('students', studentId));
      for (const record of data.submissions.filter(s => s.studentId === studentId)) w.delete(ref('submissions', record.id));
      await w.commit();
    },
    async addItem(item) {
      teacherOnly();
      await dbSdk.addDoc(dbSdk.collection(db, 'items'), {...item, archived: false, createdAt: stamp()});
    },
    async updateItem(itemId, updates) {
      teacherOnly();
      const oldItem = data.items.find(i => i.id === itemId);
      const w = batch();
      w.update(ref('items', itemId), updates);
      if (oldItem?.allowProgress && updates.allowProgress === false) {
        for (const record of data.submissions.filter(s => s.itemId === itemId && s.status === PROGRESS)) {
          w.update(ref('submissions', record.id), {status: NONE, updatedAt: stamp()});
        }
      }
      await w.commit();
    },
    async deleteItem(itemId) {
      teacherOnly();
      const w = batch();
      w.delete(ref('items', itemId));
      for (const record of data.submissions.filter(s => s.itemId === itemId)) w.delete(ref('submissions', record.id));
      await w.commit();
    }
  };
}
