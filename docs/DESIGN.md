# 설계

## 상태와 책임

전체 구조·경계·핵심 흐름의 진입점이다. 상세 계약은 [아래 상세 설계](#상세-설계-선택)에서 관리하며, 다른 문서와의 작성 경계는 [AGENTS](../AGENTS.md#작업-목적에-따라-읽을-문서)를 따른다.

| 구분 | 상태 |
| --- | --- |
| 승인된 미구현 설계 | 기술 스택과 아키텍처 ([DEC-013](DECISIONS.md#결정-색인), [ADR-0003](adr/0003-tech-stack-and-architecture.md)). 방 정보 DB 보관([DEC-023](DECISIONS.md#결정-색인)) |
| 현재 구현 | 없음. 구현 현황은 [PROGRESS](PROGRESS.md), 근거는 연결된 worklog 참조 |
| 미정 | API 이벤트·필드, DB 스키마, 상태 전이 등 상세 계약 (각 상세 설계에서 확정) |

선택 이유와 대안은 [ADR-0003](adr/0003-tech-stack-and-architecture.md)에 있다. 제품 요구사항의 승인과 구현 설계의 승인을 구분한다.

## 전체 구성과 경계

하나의 웹 서비스가 정적 클라이언트, REST API, Socket.IO 실시간 연결을 함께 제공한다. 게임 판정은 서버만 하고, 규칙·물리는 브라우저(로컬 모드)와 서버가 같은 `game-core` 패키지를 쓴다.

```text
브라우저 (client: React + R3F)
  ├─ 로컬 2인: 창 2개의 LocalGameSession → SharedWorker의 game-runtime + game-core
  ├─ AI 대전: AiGameSession → Web Worker의 game-runtime + game-core (서버 미사용)
  └─ 온라인: RemoteGameSession ──REST·Socket.IO──┐
                                                  ▼
서버 (server: Express + Socket.IO, Render 웹 서비스 1개)
  ├─ 인증·세션 (express-session, argon2id)
  ├─ 방(DB rooms)·대전 진행(메모리) → game-runtime(큐·틱·뷰 배포)이 game-core로 판정
  └─ 영구 데이터 (Drizzle) ──→ PostgreSQL (Neon)
공용: shared (타입·Zod 스키마·방해요소/판 데이터), game-core (순수 TypeScript), game-runtime (시계·전송 주입, DEC-030)
```

| 책임 | 위치 | 상세 |
| --- | --- | --- |
| 사용자 화면·입력 | `client`. 입력을 명령으로 바꾸고 받은 뷰를 3D로 표시. 실시간 상태 보간은 ADR-0004 승인 | [게임](design/GAME.md)·[API](design/API.md) |
| 방·대전 진행 | 방 정보는 DB `rooms`, 경기 진행 상태는 `server` 메모리. 판정은 `game-core` | [게임](design/GAME.md) |
| 인증·권한 | `server`의 세션 미들웨어와 Socket.IO 연결 인증, 입력은 `shared`의 Zod 스키마로 검증 | [인증](design/AUTH.md) |
| 영구 데이터 | `server` → PostgreSQL(Neon): 회원·전적·방·세션 | [DB](design/DATABASE.md) |
| 실행·배포 | 모노레포 로컬 실행, Render 배포 | [로컬](design/LOCAL.md)·[운영](design/OPERATIONS.md) |

## 핵심 데이터 흐름

1. 사용자가 REST로 로그인하면 세션 쿠키를 받고, 같은 세션으로 Socket.IO에 연결한다.
2. 방 목록은 REST로 조회하고, 방 생성·참여·시작은 Socket.IO 이벤트로 처리한다. 방 정보는 DB `rooms`, 경기 상태는 서버 메모리에 둔다.
3. 발사·방해요소 사용 입력을 서버가 검증한다. `game-core`로 판정한다. DEC-015에 맞춘 실시간 계산·플레이어별 상태 전송은 [ADR-0004](adr/0004-realtime-hazards.md)에 따라 진행한다.
4. 경기가 끝나면 서버가 두 사용자의 전적(판수·승·패)을 한 번만 갱신한다. 경기별 기록·레이팅은 저장하지 않는다([DEC-022](DECISIONS.md#결정-색인)).

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
