# 진행 상황

## 기준과 확인 범위

기준 브랜치: `main`. 확인일: 2026-11-03. 작업 상태는 [TASKS](TASKS.md), 상세 검증은 [2026-10-28](worklogs/2026-10-28.md)·[2026-10-29](worklogs/2026-10-29.md)·[2026-10-30](worklogs/2026-10-30.md)·[2026-10-31](worklogs/2026-10-31.md)·[2026-11-02](worklogs/2026-11-02.md)·[2026-11-03](worklogs/2026-11-03.md) worklog를 따른다.

## 기준 브랜치에 반영된 범위

`main`(PR #53·#54·#57 병합)까지 반영된 내용은 문서, 기준 화면 프로토타입 `알까기 바 (2).html`, 프로젝트 골격(npm workspaces 5개 패키지·빌드·테스트·린트), VAL-002 기록 모듈, `game-core`·`shared` 스키마, DB 스키마·마이그레이션·연결 풀(`packages/server/src/db`), `game-runtime`(명령 큐·틱 스케줄러·뷰 배포), 인증 API·세션·Socket.IO 연결 인증(`packages/server/src/auth`·`realtime`)이다. PR #60·#61·#62로 로컬·AI 경기 화면과 방 서버가 추가됐다. 온라인 서버·전적은 PR #63에서 리뷰 중이다. 실제 GPU 성능·배포는 검증하지 않았다.

- 문서 책임·위치 재편 ([DOC-001~003](TASKS.md#작업-목록))
- 제품 요구사항: 계정·로비·게임 화면, 방해요소 시스템, 보관·장애·규모 정책, 위임 결정 ([DOC-004~009](TASKS.md#작업-목록), [DEC-006~012](DECISIONS.md#결정-색인))
- 기술 스택·아키텍처 ([DOC-010](TASKS.md#doc-010-기술-스택과-아키텍처-결정), [DEC-013](DECISIONS.md#결정-색인), [ADR-0003](adr/0003-tech-stack-and-architecture.md))
- 상세 설계: 게임·수치 기본값([GAME-001·002](TASKS.md#game-001-게임-처리-상세-설계-확정)), 로컬 2인([LOCAL-001](TASKS.md#local-001-로컬-2인-모드-설계-확정)), API([API-001](TASKS.md#api-001-api실시간-이벤트-계약-확정)), DB([DB-001](TASKS.md#db-001-db-스키마-확정)), 인증([AUTH-001](TASKS.md#auth-001-인증-상세-설계-확정)), 운영([OPS-001](TASKS.md#ops-001-운영-설계-확정))
- 디자인 캔버스([UI-001·002](TASKS.md#ui-002-디자인-캔버스-현재-요구사항-반영)), 에셋 조달 방식([ASSET-001](TASKS.md#asset-001-에셋-조달-계획)), fps 측정 절차·플레이 테스트 양식([VAL-001](TASKS.md#val-001-성능-측정-절차와-플레이-테스트-기록-양식))
- 프로젝트 골격([IMPL-001](TASKS.md#impl-001-프로젝트-골격), PR #51)
- `game-core`·`shared` 스키마: 규칙·물리·상태 머신·방해요소·`getViewFor`([IMPL-002](TASKS.md#impl-002-game-core), PR #53). 단위 테스트로 확인했고 플레이 테스트·성능 측정은 없다
- DB 스키마·마이그레이션·연결 풀([IMPL-006](TASKS.md#impl-006-db마이그레이션), PR #54). 마이그레이션은 임시 DB에서 검증했고 개발 DB에는 아직 적용하지 않았다
- `game-runtime`: 방별 명령 큐·120Hz 틱 스케줄러·플레이어별 뷰 배포와 시계·전송·로거·종료 콜백 주입 인터페이스([IMPL-003](TASKS.md#impl-003-game-runtime), PR #57, B와 합의). 가짜 시계 테스트와 실제 시계 한 건으로 확인했고 Socket.IO·워커 연결과 부하 측정은 없다
- 인증 API·세션·IP당 빈도 제한·Socket.IO 연결 인증과 중복 접속 대체([IMPL-007](TASKS.md#impl-007-인증), PR #59). argon2id 해시 시간은 이 PC에서만 측정했고 Render 측정은 [IMPL-013](TASKS.md#impl-013-배포)으로 옮겼다
- 로비·방 서버([IMPL-008](TASKS.md#impl-008-로비방-서버), PR #61): `GET /api/rooms`, `room:create`·`join`·`quickJoin`·`leave`, `room:state`·`room:closed`, 상대 입장 즉시 시작(DEC-040), 동시 입장 조건부 갱신, `room:join` 빈도 제한, 서버 시작 때 `rooms` 정리. 임시 DB와 실제 Socket.IO 클라이언트로 확인했다. 시작 뒤 경기 연결과 경기 중 이탈의 기권패는 [IMPL-009](TASKS.md#impl-009-온라인-대전-서버)다
- [IMPL-009](TASKS.md#impl-009-온라인-대전-서버): 완료(PR #63, `main` 34a8d06). 방별 `RoomRuntime`에 Socket.IO 전송·서버 시계·사용자↔좌석 맵을 주입해 온라인 경기를 진행한다. 이탈·접속 대체의 기권패 변환, 입장 직후 이탈 처리, 재도전 15초 만료(DEC-041), 서버 로그를 구현했고 `onStarted` 실패·INTERNAL_ERROR 정책을 정했다([DEC-043](DECISIONS.md#결정-색인)). 임시 DB와 실제 Socket.IO 클라이언트로 확인했다. 경기 종료 전적(전체·승·패, 무승부=전체−승−패) 저장과 프로필·방 목록 표시도 이 작업에 포함했다([DEC-044](DECISIONS.md#결정-색인), [IMPL-011](TASKS.md#impl-011-경기-종료-전적)).
- 구현 작업 13건 등록([PLAN-001](TASKS.md#plan-001-구현-작업-등록), [IMPL-001~013](TASKS.md#impl-001-프로젝트-골격))

## 현재 작업 범위

- 구현 작업 [VAL-002](TASKS.md#val-002-개발용-프레임-시간-기록)·[IMPL-001~013](TASKS.md#impl-001-프로젝트-골격)은 Issue [#34~#47](https://github.com/moguab2808-commits/mini-project-1-1/issues)로 등록했다.
- [API-002](TASKS.md#api-002-api-이름식별자-확인과-private-뷰-필드-확정): 이름 확인과 본인 private 뷰의 게이지·쿨타임 필드를 정해 GAME·API에 반영했다. 수용 기준을 충족하고 PR #33으로 병합돼 완료했다.
- [VAL-002](TASKS.md#val-002-개발용-프레임-시간-기록): 기록 모듈을 게임 화면에 연결하고(IMPL-004), 실제 브라우저에서 판 시작부터 결과까지의 기록·내려받기와 운영 빌드 제외를 확인했다. 결과 직전 간격을 원자료에 넣도록 보정했다. 리뷰·병합이 남았다. 실제 GPU 기기의 fps 측정은 하지 않았다.
- 구현 담당 재분배([DEC-035](DECISIONS.md#결정-색인)): A는 게임 줄(IMPL-001·002·003·004·005·010), B는 서버·계정 줄(IMPL-014·006~009·011~013). 경계 린트·`.env.example`은 [IMPL-014](TASKS.md#impl-014-패키지-의존-경계-린트와-envexample)로 분리했다.
- [IMPL-004](TASKS.md#impl-004-로컬-2인-모드): PR #60으로 완료 처리했다(리뷰 4건 반영). `/local` 두 창 경기에 시안 연출(DEC-036)과 후속 조작·화면 수정(DEC-037~039: 드래그 발사·조준 중 오른쪽 취소, 기본/1인칭 시점, 바람 상시·기절 연출, 방해요소 강화)을 반영했다. 새 API 이벤트는 개발자 B 합의 전 제안(IMPL-009 전 합의)이다. fps 측정·실제 GPU·사람의 실플레이 체감은 확인하지 않았다
- [IMPL-005](TASKS.md#impl-005-ai-대전): PR #62가 `main`에 병합돼 완료했다. AI 전용 Worker·컨트롤러와 개발용 `/ai`를 제공하며 로비 방 생성 창 연결은 IMPL-012다.
- [IMPL-009](TASKS.md#impl-009-온라인-대전-서버)·[IMPL-011](TASKS.md#impl-011-경기-종료-전적): PR #63이 `main`에 병합돼(34a8d06) 완료했다. 시작 지연·실패와 동시 이탈 경합, 이탈 결과의 재도전 마감, 최종 뷰 순서, 시작 커밋 뒤 사용자 조회 실패의 시작 중단 신호는 PR #64에서 보정했다.
- [IMPL-010](TASKS.md#impl-010-온라인-대전-클라이언트): 작업 브랜치에 `RoomClient`·`RemoteGameSession`과 기존 `GameScreen`을 쓰는 `/online` 연결 확인 화면을 구현했다. 실제 Socket.IO·임시 PostgreSQL에서 두 계정 입장·발사·재도전·새 참여자·이탈·중복 접속·시작 실패를 확인했다. PR #64가 `main`에 병합돼 완료했다. 정식 계정·로비 화면은 IMPL-012다.
- 2026-10-31 문서 교차 검증(Claude·Codex)에서 찾은 불일치를 정리했다([worklog](worklogs/2026-10-31.md#문서-정합성-교차-검증과-불일치-정리)).

## 남은 일과 한계

- 다음 구현: [IMPL-012](TASKS.md#impl-012-계정로비대기실결과-화면) 계정·로비 연결과 [IMPL-014](TASKS.md#impl-014-패키지-의존-경계-린트와-envexample). PR #63·#64는 리뷰·병합이 남았다.
- 물리·방해요소 수치는 제안값이며 플레이 테스트 후 [DECISIONS](DECISIONS.md)로 확정한다.
- 에셋 도구·글꼴 이용 조건 확인은 반입 시(구현 단계)로 남았다([DEC-033](DECISIONS.md#결정-색인)).
- 발사 각도 범위는 승인 전이다. IMPL-002가 제안 (−π, π]를 임시로 따랐다([API](design/API.md)).
- README 설치·실행 절차는 구현 뒤 작성한다([DOC-011](TASKS.md#doc-011-readme-설치실행-절차)).
- 로컬 2인은 창을 오래 가리면 브라우저 타이머 제한으로 하트비트가 늦어 기권패될 수 있다([LOCAL](design/LOCAL.md)). 필요해지면 ping을 전용 워커에서 보내는 방법을 검토한다.
