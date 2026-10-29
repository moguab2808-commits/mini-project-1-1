# 설계

## 상태와 책임

전체 구조·경계·핵심 흐름의 진입점이다. 상세 계약은 [아래 상세 설계](#상세-설계-선택)에서 관리하며, 다른 문서와의 작성 경계는 [AGENTS](../AGENTS.md#작업-목적에-따라-읽을-문서)를 따른다.

| 구분 | 상태 |
| --- | --- |
| 승인된 미구현 설계 | 기술 스택과 아키텍처 ([DEC-013](DECISIONS.md#결정-색인), [ADR-0003](adr/0003-tech-stack-and-architecture.md)) |
| 현재 구현 | 없음. 구현 현황은 [PROGRESS](PROGRESS.md), 근거는 연결된 worklog 참조 |
| 미정 | API 이벤트·필드, DB 스키마, 상태 전이 등 상세 계약 (각 상세 설계에서 확정) |

선택 이유와 대안은 [ADR-0003](adr/0003-tech-stack-and-architecture.md)에 있다. 제품 요구사항의 승인과 구현 설계의 승인을 구분한다.

## 전체 구성과 경계

하나의 웹 서비스가 정적 클라이언트, REST API, Socket.IO 실시간 연결을 함께 제공한다. 게임 판정은 서버만 하고, 규칙·물리는 브라우저(로컬 모드)와 서버가 같은 `game-core` 패키지를 쓴다.

```text
브라우저 (client: React + R3F)
  ├─ 로컬 모드: LocalGameSession → game-core 직접 호출
  └─ 온라인: RemoteGameSession ──REST·Socket.IO──┐
                                                  ▼
서버 (server: Express + Socket.IO, Render 웹 서비스 1개)
  ├─ 인증·세션 (express-session, argon2id)
  ├─ 방·대전 진행 (메모리) → game-core로 판정, 플레이어별 뷰 생성
  └─ 영구 데이터 (Drizzle) ──→ PostgreSQL (Neon)
공용: shared (타입·Zod 스키마·방해요소/판 데이터), game-core (순수 TypeScript)
```

| 책임 | 위치 | 상세 |
| --- | --- | --- |
| 사용자 화면·입력 | `client`. 입력을 명령으로 바꾸고 받은 뷰·시뮬레이션 기록을 3D로 재생 | [게임](design/GAME.md)·[API](design/API.md) |
| 방·대전 진행 | `server` 메모리의 방·경기 상태, 판정은 `game-core` | [게임](design/GAME.md) |
| 인증·권한 | `server`의 세션 미들웨어와 Socket.IO 연결 인증, 입력은 `shared`의 Zod 스키마로 검증 | [인증](design/AUTH.md) |
| 영구 데이터 | `server` → PostgreSQL(Neon): 회원·경기 결과·세션 | [DB](design/DATABASE.md) |
| 실행·배포 | 모노레포 로컬 실행, Render 배포 | [로컬](design/LOCAL.md)·[운영](design/OPERATIONS.md) |

## 핵심 데이터 흐름

1. 사용자가 REST로 로그인하면 세션 쿠키를 받고, 같은 세션으로 Socket.IO에 연결한다.
2. 방 생성·참여·시작은 Socket.IO 이벤트로 처리하고, 서버가 메모리에 방과 경기 상태를 둔다.
3. 발사·방해요소 사용 입력을 서버가 검증한다. `game-core`로 판정·시뮬레이션한 뒤 플레이어별 뷰와 시뮬레이션 기록을 보낸다.
4. 경기가 끝나면 경기 결과 저장과 두 사용자의 전적·레이팅 갱신을 하나의 트랜잭션으로 처리한다.

경합 처리(시간초과와 입력, 동시 이탈)와 상세 이벤트 순서는 [게임](design/GAME.md)·[API](design/API.md)에서 확정한다. 제품 동작·예외는 PRD를 따른다.

## 상세 설계 선택

| 확인하려는 내용 | 읽을 문서 |
| --- | --- |
| API 필드·오류·이벤트·동기화 계약 | [API](design/API.md) |
| 테이블·관계·제약·인덱스·트랜잭션 | [DATABASE](design/DATABASE.md) |
| 인증·세션·인가·입력 검증 | [AUTH](design/AUTH.md) |
| 게임 처리·물리·상태 전이·비공개 뷰 | [GAME](design/GAME.md) |
| 로컬 모드·코드 경계·대체 구성 | [LOCAL](design/LOCAL.md) |
| 배포·비밀 설정·로그·복구 | [OPERATIONS](design/OPERATIONS.md) |
| 채택 기술·서비스·에셋 후보 | [TECH_STACK](design/TECH_STACK.md) |

## 상세 설계 갱신 규칙

- 각 상세 문서는 승인된 미구현 설계·현재 구현·미정 사항을 구분한다. 승인 시 DEC ID를 연결한다.
- 구현과 승인 설계가 다르면 차이와 영향을 명시하고, 작업·검증 근거는 TASKS와 worklog로 연결한다.
- 연동 계약은 구현 전에 합의한다. 계약 변경 시 관련 문서·코드를 함께 갱신한다.
