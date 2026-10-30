# 진행 상황

## 기준과 확인 범위

기준 브랜치: `main`. 확인일: 2026-10-29. 작업 상태는 [TASKS](TASKS.md), 상세 검증은 [2026-10-28](worklogs/2026-10-28.md)·[2026-10-29](worklogs/2026-10-29.md) worklog를 따른다.

## 기준 브랜치에 반영된 범위

`main`의 `ef4e3d4`(PR #1 병합)까지 반영된 내용은 문서뿐이다. 구현 코드와 실행·테스트 구성은 없고, 완료된 제품 기능도 없다. 실제 동작·성능·배포 검증 범위도 없다.

- 문서 책임·위치 재편 ([DOC-001~003](TASKS.md#작업-목록))
- 제품 요구사항: 계정·로비·게임 화면, 방해요소 시스템, 보관·장애·규모 정책, 남은 미정 항목의 위임 결정 ([DOC-004~009](TASKS.md#작업-목록), [DEC-006~012](DECISIONS.md#결정-색인)). 제품 쪽에 남은 것은 플레이 테스트로 정할 수치와 에셋 조달이다.
- 기준 화면 프로토타입 `알까기 바 (2).html`

## 현재 작업 범위

[DOC-010](TASKS.md#doc-010-기술-스택과-아키텍처-결정)의 기술 스택과 아키텍처는 [PR #14](https://github.com/moguab2808-commits/mini-project-1-1/pull/14)로 main에 병합됐다([DEC-013](DECISIONS.md#결정-색인), [ADR-0003](adr/0003-tech-stack-and-architecture.md)).

[UI-001](TASKS.md#ui-001-로비인게임-화면-프로토타입)의 디자인 캔버스는 [UI-002](TASKS.md#ui-002-디자인-캔버스-현재-요구사항-반영)에서 현재 화면 요구사항(턴 하이라이트, 방해요소 칸, 프로필바 버튼, 방 생성 AI 선택, 대기실, 재도전 대기)을 반영했다. UI-001의 화면 미정 항목은 사용자가 검토해 방해요소 칸을 내 프로필 위쪽으로 바꾸고 나머지는 UI-002에서 확정으로 넘겼다([DEC-032](DECISIONS.md#결정-색인), 해석은 사용자 확인 완료). 사용자가 캔버스를 직접 확인해 흐름·배치 기준을 통과로 알렸다. 병합이 남았다([worklog](worklogs/2026-10-30.md#ui-002-디자인-캔버스-현재-요구사항-반영)).

개발자 A는 [PR #15](https://github.com/moguab2808-commits/mini-project-1-1/pull/15)의 `docs/game-001`에서 [GAME-001](TASKS.md#game-001-게임-처리-상세-설계-확정) 상세 계약 초안을 작성했다. DEC-014·015의 단일 보유·교체·상시 사용을 반영했다. DEC-017의 추가 효과 규칙과 승인된 실시간 방식(DEC-016·ADR-0004)을 반영했다. 효과 세부와 API-001 이벤트 계약은 검토 전이다. 구현은 없다. 근거는 [2026-10-30 worklog](worklogs/2026-10-30.md#game-001-게임-처리-상세-설계-초안)를 따른다.

GAME-001에 대한 개발자 B의 검토를 반영했다. 명령·종료·전송 계약은 [DEC-026](DECISIONS.md#결정-색인)으로 정했다. 사용자가 B의 의견대로 랭킹·레이팅 제외, 방 정보 DB 보관, 방 생성 창의 PvP/AI·알 5·7·9개·로비 새로고침, IP당 인증 요청 제한을 결정했다([DEC-022~025](DECISIONS.md#결정-색인), PRD v0.17). PR #15가 `main`에 병합되어 GAME-001을 완료 처리했다(남은 수용 기준 2개는 사용자 결정으로 삭제). 남은 효과 세부와 수치는 GAME-002, 이벤트 필드는 API-001에서 다룬다. 근거는 [2026-10-30 worklog](worklogs/2026-10-30.md#game-001-개발자-b-검토-반영)를 따른다.

개발자 B는 [API-001](TASKS.md#api-001-api실시간-이벤트-계약-확정)·[DB-001](TASKS.md#db-001-db-스키마-확정)·[AUTH-001](TASKS.md#auth-001-인증-상세-설계-확정)·[OPS-001](TASKS.md#ops-001-운영-설계-확정)의 확정안을 [API](design/API.md)·[DATABASE](design/DATABASE.md)·[AUTH](design/AUTH.md)·[OPERATIONS](design/OPERATIONS.md)에 작성했다([DEC-027~029](DECISIONS.md#결정-색인)). 네 작업 모두 진행 중이며 확정안은 개발자 A의 검토와 제안 항목의 B 확인을 기다린다. 실제 구현·무료 조건 재확인·측정은 하지 않았다. 상세는 [2026-10-30 worklog](worklogs/2026-10-30.md#api-001db-001auth-001ops-001-개발자-b-설계-확정안)를 따른다.
개발자 A는 `docs/local-001`에서 [LOCAL-001](TASKS.md#local-001-로컬-2인-모드-설계-확정) 초안을 작성했다. 로컬 2인은 브라우저 창 2개와 로컬 권한 측 SharedWorker로 진행하고, 방해요소는 내 프로필 칸·E 키로 쓰며(칸 위치는 DEC-032에서 프로필 위쪽으로 변경), AI 대전은 브라우저 Web Worker에서 실행한다([DEC-020·021](DECISIONS.md#결정-색인), PRD v0.18). `GameSession` 이름·명령 필드는 개발자 B가 API-001과 맞음을 확인했다. B 검토에 따라 경기 실행을 공통 패키지 `game-runtime`으로 묶고, PlayerId를 좌석 값 0/1로, 방·접속 이벤트를 `RoomClient`로 분리했다([DEC-030](DECISIONS.md#결정-색인)). PR #18이 `main`에 병합되어 LOCAL-001을 완료했다.

개발자 A는 [PR #19](https://github.com/moguab2808-commits/mini-project-1-1/pull/19)의 `docs/game-002`에서 [GAME-002](TASKS.md#game-002-물리방해요소-수치-기본값-제안) 수치 기본값을 [GAME 기술 초기값](design/GAME.md#기술-초기값-조정-대상)에 제안했다(물리·방해요소·전송·AI, 미승인). 쿨타임 초 단위, 피로도 과열 방식, 랜덤형 15초마다 1회, 벽 가로·세로 전환은 사용자가 정했다([DEC-031](DECISIONS.md#결정-색인), PRD v0.19). PR #19가 `main`에 병합되어 GAME-002를 완료했다. 제안값은 미승인이며 플레이 테스트 후 DEC로 확정한다. 근거는 [2026-10-30 worklog](worklogs/2026-10-30.md#game-002-물리방해요소-수치-기본값-제안)·[완료 처리](worklogs/2026-10-30.md#game-002-완료-처리)를 따른다.

개발자 B는 `docs/api-001`에서 [API-001](TASKS.md#api-001-api실시간-이벤트-계약-확정)의 방해요소 거부 오류 코드를 반영하고, REST·Socket.IO 필드, 방·경기 오류 코드, 이벤트 순서도, 상대 비공개 필드 점검표를 [API](design/API.md)에 추가했다. 수용 기준 7개를 모두 충족하고 PR #22가 `main`에 병합되어 API-001을 완료했다(개발자 A가 이벤트 순서를 검토). 본인 private 뷰의 게이지·쿨타임 필드 이름은 A가 정한 뒤 반영한다. 근거는 [2026-10-30 worklog](worklogs/2026-10-30.md#api-001-필드순서도비공개-점검-추가)를 따른다.

개발자 B는 `docs/db-001`에서 [DB-001](TASKS.md#db-001-db-스키마-확정)의 `[제안]` 항목을 확정하고 `rooms` 제약(FK 삭제 동작, 참여자 유니크, 자기 방 입장 금지, 값 범위 `CHECK`), 방 삭제 시점, 세션 테이블 방침을 [DATABASE](design/DATABASE.md)에 보완했다. 개발자 A의 PR 검토를 반영해 수용 기준 4개를 모두 충족했고 DB-001을 완료로 처리했다(PR #23, 병합 전에 체크). 근거는 [2026-10-30 worklog](worklogs/2026-10-30.md#db-001-스키마-보완과-api-001-완료-처리)를 따른다.

개발자 B는 [PLAN-001](TASKS.md#plan-001-구현-작업-등록)에서 구현 작업을 13묶음으로 나눈 초안과 담당 제안을 작성했다. 모노레포 도구는 ADR-0003의 npm workspaces로 확인했고 `game-runtime` 패키지를 TECH_STACK에 추가했다. 별도 작업 등록은 API-001·DB-001·AUTH-001 확정 후이며 PLAN-001은 진행 중이다. 근거는 [2026-10-30 worklog](worklogs/2026-10-30.md#plan-001-구현-작업-등록-작업-분해-초안)를 따른다.

개발자 B는 `docs/auth-001`에서 [AUTH-001](TASKS.md#auth-001-인증-상세-설계-확정)의 `[제안]` 항목을 확정하고 검증 경계(연결·입력 / 사용자→좌석 변환 / 경기 규칙 3단계와 검사 순서), 인증 요청 빈도 제한의 한도·응답 형식, `room:join` 연결 빈도 제한을 [AUTH](design/AUTH.md)에 정했다. 수용 기준 4개를 모두 충족했고 개발자 A의 검토(PR #24)를 반영해 AUTH-001을 완료로 처리했다(병합 전에 체크). 검사 순서와 발사 각도 범위는 A가 확정해 GAME·API에 반영한다. 근거는 [2026-10-30 worklog](worklogs/2026-10-30.md#auth-001-미충족-수용-기준-보완)를 따른다.

개발자 B는 `docs/ops-001`에서 [OPS-001](TASKS.md#ops-001-운영-설계-확정)의 `[제안]` 항목을 확정하고, Render·Neon·UptimeRobot 무료 조건과 수동 배포·롤백·Neon 복구 기간(6시간)을 공식 문서로 다시 확인해 [OPERATIONS](design/OPERATIONS.md#무료-조건-재확인-2026-10-30)에 기록했다. 이탈 판정용 서버 로그 이벤트와 `ingressSeq` 판정 방법, 상태 전송 부하 측정 항목도 정했다. 개발자 A의 검토(PR #26)를 반영해 수용 기준 4개를 모두 충족했고 OPS-001을 완료로 처리했다(병합 전에 체크). 지속 요청 사용 여부는 DEC-029대로 구현 단계에서 정한다. 근거는 [2026-10-30 worklog](worklogs/2026-10-30.md#ops-001-미충족-수용-기준-보완)를 따른다.

## 남은 일과 한계

- 상세 계약 확정: 게임 상태 전이·물리([GAME](design/GAME.md)), API 이벤트·필드([API](design/API.md)), DB 스키마([DATABASE](design/DATABASE.md)), 인증 세부([AUTH](design/AUTH.md)), 운영 세부([OPERATIONS](design/OPERATIONS.md))
- 구현 작업 등록과 로컬 2인 모드 개발, 디자인 캔버스 갱신
