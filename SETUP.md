# Firebase · GitHub 단계별 설정

**2026-11-11 현재 실제 Firebase에 연결되지 않았습니다. 프로젝트를 만들고 설정값을 입력한 다음 아래 순서로 테스트하세요.**

**설정값 중 `apiKey`, `authDomain`, `projectId`, `appId`, `teacherUid`가 빠지면 오류가 나도록 했습니다. 코드를 비워 두면 체험 모드이며 Firebase 기록이 아닙니다.**

## A. Firebase 프로젝트 만들기

1. https://console.firebase.google.com/ 접속 → **프로젝트 만들기**.
2. 원하는 프로젝트 이름 입력. Google Analytics는 이 과제에 필수가 아니므로 필요 없으면 선택 해제.
3. **Spark(무료) 요금제**를 유지.
4. 프로젝트 내 앱 추가에서 **웹(</>)** 선택 → 앱 별명 지정 → 등록.
5. 웹 앱 설정 객체의 `apiKey`, `authDomain`, `projectId`, `appId`를 `js/config.js`에 복사. `apiKey`는 Firebase 웹 설정 식별자이지 교사 비밀번호가 아님.

## B. Firestore 데이터베이스

1. Firebase 콘솔 → **빌드/Build > Firestore Database > 데이터베이스 만들기**. (콘솔 메뉴 이름은 변경될 수 있어요.)
2. 데이터베이스 위치 선택 (한 번 정하면 변경이 어려움).
3. **테스트 모드로 공개하지 말고 잠금/프로덕션 모드**에서 시작.
4. 실제 규칙을 게시하기 전까지 앱에서 DB를 읽을 수 없는 것이 정상.

## C. Authentication 설정

1. Firebase 콘솔 → **Authentication > 시작하기 > Sign-in method**.
2. **이메일/비밀번호** 공급자 활성화.
3. **익명(Anonymous)** 공급자 활성화. 학생 로그인 UI는 없고 기술적으로는 이 공급자를 사용.
4. Authentication > **사용자**에서 교사 계정을 하나 등록(이메일+비밀번호). **비밀번호를 코드에 쓰거나 채팅에 보내지 말기.**
5. 생성된 교사의 **UID**를 복사해 `js/config.js`의 `teacherUid`에 넣기.
6. `firestore.rules`의 `REPLACE_WITH_TEACHER_UID`도 똑같은 UID로 교체.

## D. Firestore 규칙 게시 및 검증

1. Firestore Database > **규칙** 탭에서 `firestore.rules` 내용을 붙여 넣어 **게시**.
2. 규칙 시뮬레이터로 교사 UID의 읽기·쓰기, 익명 방문자의 학생/항목 수정 거부 및 제출 상태의 허용된 수정 여부를 확인.
3. **중요:** 게시 전에 반드시 UID를 교체할 것. 임의로 모든 읽기·쓰기를 공개하는 `allow read, write: if true` 같은 규칙은 금지.
4. 테스트에 사용할 가상 학생 정보는 앱 교사 화면에서 등록.

## E. 로컬 테스트

**주의:** 보안 규칙은 콘솔에 게시된 뒤에만 실제 앱에 적용됩니다. 익명 인증은 학생 로그인 화면을 생략할 수 있지만, 방문자가 실재 학생인지 확인하지 않습니다. **실제 학생 이름은 아직 등록하지 말고 가상 정보로 먼저 테스트하세요.**


1. 프로젝트 폴더에서 `python -m http.server 8000` 실행.
2. `http://localhost:8000`에서 Firebase 로그인 및 저장 확인.
3. 학생 화면에서 항목 클릭 → 번호 체크 → 저장 → 새로고침 후 유지되는지 확인.
4. 서로 다른 브라우저 또는 기기에서 데이터가 반영되는지 확인. **같은 학생을 두 기기에서 동시에 수정했을 때 이전 상태를 덮어쓰지 않는지**도 확인.
5. Authentication > Settings > Authorized domains에서 로컬/배포 도메인을 확인. 로컬이 허용되지 않으면 필요한 도메인을 등록.

## F. GitHub Pages 배포

1. GitHub에서 공개 저장소 새로 생성 (예: `classroom-submission-board`).
2. 압축을 풀어 나온 파일을 저장소 **최상위 경로**에 올리기 (`index.html` 포함).
3. 저장소 **Settings > Pages** → `Deploy from a branch` → `main` / `(root)` → Save.
4. 배포된 주소(`https://사용자명.github.io/저장소명/`)로 접속해 정상 동작 확인.
5. Firebase Authentication > **Settings > Authorized domains**에 `사용자명.github.io`가 없으면 추가.

## G. API 키 HTTP 리퍼러 제한

과제 지침에서 요구하는 별도 작업이며 **Firestore 보안 규칙의 대체물이 아닙니다.** GitHub Pages 배포 주소가 확정된 뒤에 적용하세요. 잘못 제한하면 학생 익명 인증·교사 로그인에 오류가 날 수 있습니다.

1. https://console.cloud.google.com/apis/credentials 에서 해당 프로젝트의 **브라우저용 Firebase API 키**를 선택.
2. 애플리케이션 제한사항에서 **HTTP 리퍼러(웹사이트)** 허용 목록에 배포 주소를 반영. 필요시 로컬 테스트 주소도 추가.
3. API 제한에는 Firebase에 필요한 API들이 허용되어 있는지 확인. 임의로 필요한 API를 제거하면 인증이 실패할 수 있음.
4. 변경 후 **학생 익명 연결, 교사 로그인, Firestore 읽기/쓰기**를 모두 실제 배포 주소에서 다시 테스트.
5. Firebase 공식 문서: https://firebase.google.com/docs/projects/api-keys

## H. 교수님 과제 제출

- GitHub Pages에서 실제로 열리는 **웹앱 링크**
- **개발 의도**: 서류/과제 제출 체크를 태블릿으로 간소화
- **실제 사용한 주요 프롬프트**: `PROMPT_LOG.md`에 기록

## 경고

이 설정은 학생 이름 공개 및 누구나 체크를 바꿀 수 있는 문제를 해결하지 않습니다. **현재의 로그인 없는 학생 공동 현황판 구조를 실제 실명 데이터로 운영해도 안전하다고 판단하지 마세요.**
