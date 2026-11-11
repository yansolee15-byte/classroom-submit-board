# 개발 계획 — v0.5

## 목표

3학년 한 학급 전용 제출 현황판. 학생은 로그인 입력 없이 현황판(번호만)을 보고 항목 카드를 누르면 이름+번호 선택 팝업에서 제출 상태를 저장한다. 교사는 별도 진입 주소에서 계정으로 로그인해 학급 자료를 관리한다. **확정된 v0.4 화면은 변경하지 않는다.**

## 기술

HTML/CSS/JavaScript → GitHub Pages. Firebase 웹 SDK v13.2.0 → Authentication(교사는 이메일/비밀번호, 학생 화면은 내부적으로 익명 인증) + Cloud Firestore. 별도 서버 없이 Spark 요금제 우선.

## Firestore 컬렉션

- `students/{autoId}`: `{number, name, createdAt}`
- `items/{autoId}`: `{title, dueDate, allowProgress, archived, createdAt}`
- `submissions/{itemId}__{studentId}`: `{itemId, studentId, status, updatedAt}`

상태: `none`/`progress`/`done`. 진행 중 OFF면 `none`/`done`만, ON이면 세 상태 순환. 저장은 학생·항목별 개별 문서로 처리하여 다른 학생의 기존 기록을 대량 덮어쓰지 않도록 한다. 같은 학생의 경합은 클라이언트 트랜잭션에서 기존 상태 비교 후 저장.

## 현재 단계

1. ✅ v0.4 학생용 화면/교사 관리 UI 코드
2. ✅ Firebase SDK 연결 코드와 Firestore 규칙 **초안**
3. ✅ 설정 일부 누락 시 명확한 오류 표시, 학생 동일 기록 동시 변경 감지 코드
4. ✅ 단위 테스트 13개
5. ☐ Firebase 콘솔에서 실제 프로젝트 생성 및 웹 앱 등록
6. ☐ 교사·익명 인증 설정, 규칙 UID 반영·게시 및 보안 테스트
7. ☐ 실제 Firestore 읽기·쓰기·동시 접속·새로고침 테스트
8. ☐ GitHub Pages 배포, 승인 도메인 및 리퍼러 제한 반영·재테스트
9. ☐ 실제 학생 정보를 사용하기 전 접근 보호·학교 정책 확인
10. ☐ 최종 과제 링크, 개발 의도, 주요 프롬프트 정리
