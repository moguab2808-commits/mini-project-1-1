# 로컬 구성·개발 모드 설계

## 상태

| 구분 | 상태 |
| --- | --- |
| 승인된 미구현 설계 | 모노레포 패키지 경계와 `GameSession` 교체 구조 ([DEC-013](../DECISIONS.md#결정-색인)), 로컬 2인의 창 2개 진행·방해요소 입력([DEC-020](../DECISIONS.md#결정-색인)), AI 대전의 클라이언트 실행([DEC-021](../DECISIONS.md#결정-색인)), 공통 실행 모듈 `game-runtime`·좌석 PlayerId·세션 수명·`RoomClient` 분리([DEC-030](../DECISIONS.md#결정-색인)) |
| 현재 구현 | 없음 |
| 검토 초안 | LOCAL-001의 아래 `GameSession` 시그니처와 로컬 권한 측 구성. 이벤트 이름·명령 필드·ack 형식은 [API](API.md)와 맞음을 개발자 B가 확인(PR #18 검토) |
| 미정 | 아래 미정 사항 |

설치·실행 명령은 [README](../../README.md) 한 곳에서 관리한다. 이 문서는 프로세스·패키지 경계, 로컬/온라인 대체 구성, 개발용 설정 범위를 다룬다.

## 패키지 구성 (승인)

| 패키지 | 역할 | 의존 |
| --- | --- | --- |
| `shared` | 타입, Zod 스키마, 방해요소·판 데이터 | 없음 |
| `game-core` | 규칙·물리·상태 머신 (순수 TypeScript) | `shared` |
| `game-runtime` | 경기 실행: 단일 명령 큐(ingressSeq), 고정 틱 스케줄러, 플레이어별 뷰 배포. 시계와 전송(MessagePort / Socket.IO)을 주입받는다 ([DEC-030](../DECISIONS.md#결정-색인)) | `shared`, `game-core` |
| `client` | Vite + React + R3F 화면, 로컬·원격 게임 세션, 로컬·AI 워커 | `shared`, `game-core`, `game-runtime` |
| `server` | Express + Socket.IO, 인증·방·대전 진행, DB | `shared`, `game-core`, `game-runtime` |

`client`와 `server`는 서로 의존하지 않는다. 서버 방 실행, 로컬 2인 SharedWorker, AI 대전 Web Worker는 같은 `game-runtime`을 쓰고 시계·전송만 다르게 주입해 틱·큐 순서를 한 구현으로 맞춘다. `game-core`는 순수 규칙·물리로 유지한다. 개발 실행은 Vite 개발 서버와 tsx로 띄운 서버를 함께 쓰고, 배포 시에는 서버가 빌드된 클라이언트를 정적 파일로 제공한다.

## 로컬·온라인 모드 경계 (승인)

로컬에서 먼저 게임을 완성하고 온라인으로 넘어가는 순서를 위해, **UI가 "게임을 진행하는 방법"을 인터페이스 뒤에 숨긴다.**

```
        ┌──── UI (3D 장면, 투명 프로필·상단 턴 정보, 방해요소 칸) ───┐
        │          GameSession 인터페이스에만 의존                    │
        └───────────────┬──────────────────────┬───────────────────┘
                        │                      │
              LocalGameSession          RemoteGameSession
              (M1: 브라우저 안에서       (M2: Socket.IO로
               game-core 직접 호출)       서버와 통신)
                        │                      │
                        └──── game-core ───────┘  ← 서버도 같은 코드를 호출
```

- **`GameSession` 인터페이스**: 명령을 보내고 이벤트를 구독한다. 명령·이벤트 모양은 [API](API.md)와 **같은 타입**을 쓴다. M2에서는 `LocalGameSession`을 `RemoteGameSession`으로 바꾸는 것이 전환의 전부가 되도록 한다. 시그니처는 아래 [상세 계약 초안](#상세-계약-초안-local-001)을 따른다.
- **M1 로컬 모드**: 한 PC에서 **브라우저 창 2개**를 띄워 각 창이 한 플레이어를 맡고 실제 온라인처럼 진행한다 (개발용 `/local` 경로, [DEC-020](../DECISIONS.md#결정-색인)). 서버, DB, 로그인이 필요 없다.
- **비공개 정보**: 각 창은 권한 측이 `getViewFor(playerId)`로 만든 자기 뷰만 받는다. 방해요소 칸은 내 프로필 옆에 있고 내 방해요소 아이콘만 표시한다. 상대 프로필에는 방해요소 칸이 없다. 한 화면을 같이 보는 문제가 없으므로 화면 교대·가리기 화면은 두지 않는다.
- **게임 상태 머신**은 `game-core`에 둔다: 턴 → 시뮬레이션 → 판정 → (1·3·5·7·9라운드 시작 시 보유 1개 교체) → 종료. 턴 타이머(30초)는 `game-core`가 시계를 직접 읽지 않고 **외부에서 시간을 주입**받는다 (로컬은 아래 권한 측 워커의 타이머, 서버는 서버 타이머).

## 상세 계약 초안 (LOCAL-001)

아래는 개발자 A의 검토안이다. 창 2개 진행·입력 방식·AI 실행 위치는 DEC-020·021로 승인됐고, 이벤트 이름과 명령 결과 형식은 API-001 확정안([API](API.md))을 따르고, 남은 필드는 API-001에서 개발자 B와 함께 확정한다. 게임 상태·명령 경합은 [GAME 상세 계약 초안](GAME.md#상세-계약-초안-game-001)을 따른다.

### `GameSession` 시그니처

이벤트 키는 [API](API.md#socketio-이벤트)의 Socket.IO 이벤트 이름을 그대로 쓴다. `RemoteGameSession`은 받은 이벤트를 변환 없이 전달하고, 로컬 구현은 같은 타입을 만들어 보낸다. 타입은 `shared`에 Zod 스키마로 둔다.

```ts
type GameMode = 'local' | 'ai' | 'online';

interface GameSession {
  readonly mode: GameMode;
  readonly playerId: PlayerId;            // 이 창이 맡은 좌석
  submitShot(cmd: ShotSubmit): Promise<CommandResult>;  // shot:submit
  useHazard(cmd: HazardUse): Promise<CommandResult>;    // hazard:use
  forfeit(): Promise<CommandResult>;      // game:forfeit
  requestRematch(): Promise<CommandResult>; // rematch:request
  on<K extends keyof GameEventMap>(type: K, handler: (e: GameEventMap[K]) => void): () => void;
  dispose(): void;                        // 창 닫기·이동. 진행 중이면 이탈로 처리
}

type PlayerId = 0 | 1;                    // 경기 안 좌석 값. users.id가 아님

interface GameEventMap {
  'game:start': GameStart;
  'hazard:granted': HazardGranted;        // 받은 플레이어에게만
  'game:state': GameView;                 // 플레이어별 뷰
  'hazard:triggered': HazardTriggered;    // 양쪽 공개
  'turn:change': TurnChange;
  'game:over': GameOver;
  'rematch:state': RematchState;
}
```

| 타입 | 필드 초안 | 비고 |
| --- | --- | --- |
| ShotSubmit | gameId, turnId, stoneId, angle(판 좌표계 라디안), power(0 초과 100 이하. 0은 미발사) | 바람·세기 막대 효과가 반영된 최종 조준값 |
| HazardUse | gameId, hazardInstanceId, target?(x, y, 벽 방향) | turnId 없음(상대 턴에도 사용). target은 벽·끈끈이에만 필수. 판 좌표계 기준. Zod 범위는 API-001에서 확정 |
| CommandResult | `{ ok: true }` 또는 `{ ok: false, error: { code, message } }` | Socket.IO ack와 같은 형식. code는 [API 오류 코드 표](API.md#오류-형식과-코드)(`STALE_TURN`·`SHOT_ALREADY_SUBMITTED`·`STALE_HAZARD` 등)를 로컬 권한 측도 그대로 쓴다. 거부된 명령은 상태·난수를 바꾸지 않음 |
| GameView | [GAME 플레이어별 뷰](GAME.md#상태-위치와-플레이어별-뷰)의 공개 GameView + 본인 private | 상대 보유 방해요소 없음 |

- 명령 4개는 모두 `CommandResult`를 돌려준다. API가 모든 명령에 ack를 돌려주는 것과 맞춘다.
- commandId는 두지 않는다 ([DEC-026](../DECISIONS.md#결정-색인), [GAME](GAME.md#명령-경합과-시간)). 명령 메서드는 수락·거부만 `CommandResult`로 돌려준다. 원격은 Socket.IO ack, 로컬은 워커 응답으로 짝짓는다. 로컬의 MessagePort 메시지 짝짓기용 번호는 `LocalGameSession` 내부 구현이며 계약에 넣지 않는다. 적용 결과는 `game:state`·`hazard:triggered`로 받는다.
- 조준 중인 각도·세기 막대 값은 클라이언트 입력 상태이며 명령으로 보내지 않는다. 바람·세기 막대 속도 조절의 발동 시작·만료 시각은 뷰로 받아 클라이언트 조준 입력에 반영하고, 반영한 최종값을 `shot:submit`으로 보낸다. 권한 측은 값 범위·기절·마감·알 소유·turnId를 검증하고, 바람 편향을 따랐는지는 검증하지 않는다 (DEC-026).
- **PlayerId**: 경기 안의 좌석 값 0·1이다. 알의 `ownerId`·`activePlayerId`도 같은 값을 쓴다. 로컬에는 `users.id`가 없고, 온라인에서 상대에게 사용자 번호를 보내지 않기 위해서다. 서버만 좌석과 `users.id`를 매핑해 전적을 저장한다 ([DEC-030](../DECISIONS.md#결정-색인)).
- **세션 수명**: `GameSession` 하나가 같은 방의 재도전 경기까지 이어 간다. `game:over` 뒤 같은 세션으로 `requestRematch()`를 보내고, 성립하면 새 gameId의 `game:start`를 받는다. 이벤트의 gameId로 경기를 구분하고, 새 `game:start`에서 화면 상태를 초기화한다. 재도전이 만료되거나 방을 나가면 `dispose()`한다 ([DEC-030](../DECISIONS.md#결정-색인)).
- **방·접속 이벤트**: `room:*` 명령·이벤트와 `session:replaced`는 `GameSession`에 넣지 않고 온라인 전용 `RoomClient`가 처리한다(로비·대기실). `GameSession`은 경기만 맡는다. 온라인 `dispose()`는 `RoomClient`를 통해 `room:leave`를 보내고, 경기 중이면 서버가 이탈 기권패로 처리한다. 로컬·AI는 방이 없으므로 `RoomClient`를 쓰지 않는다 ([DEC-030](../DECISIONS.md#결정-색인)).

### 로컬 2인 구성 (창 2개)

```
  창 1 (/local?seat=0)          창 2 (/local?seat=1)
  LocalGameSession(0)           LocalGameSession(1)
          │ MessagePort                 │ MessagePort
          └──────────┬──────────────────┘
               SharedWorker (로컬 권한 측)
               game-runtime(큐·틱·뷰 배포) + game-core
```

- 권한 측은 같은 출처의 `SharedWorker` 1개다. 서버와 같은 `game-runtime`을 워커 시계·MessagePort 전송으로 실행해 고정 틱 진행, 단일 명령 큐, 플레이어별 뷰 생성, 턴 타이머를 맡는다. 두 창은 서로 직접 통신하지 않는다. 창이 백그라운드여도 진행이 창 렌더링에 묶이지 않도록 권한 측을 창 밖에 둔다.
- 좌석은 URL의 `seat`(0·1)로 정하며 그 값이 PlayerId다. 두 좌석이 모두 연결되면 경기를 시작하고, 같은 좌석의 두 번째 연결은 거부한다. 선공 추첨·시드는 권한 측이 정한다.
- 창을 닫거나 새로고침하면 그 좌석의 이탈로 보고 PRD대로 기권패 처리한다. 모든 창이 닫혀 워커가 종료되면 경기 상태도 사라진다. 저장·복구는 없다.
- `SharedWorker`를 지원하지 않는 브라우저에서는 `/local`이 미지원 안내를 표시한다. 개발용이므로 다른 대체 구성을 두지 않는다. 대상 브라우저는 데스크톱 Chrome·Edge·Firefox다.
- 개발 편의 기능(같은 시드 재시작, 상대 뷰 미리보기 등)은 개발 화면에만 두고 `GameSession` 계약에 넣지 않는다.

### 방해요소 입력

온라인과 로컬에서 같은 입력을 쓴다 ([DEC-020](../DECISIONS.md#결정-색인)). 각 창에서 각자 입력하므로 입력이 겹치지 않는다.

| 입력 | 동작 |
| --- | --- |
| `E` 키 또는 방해요소 칸 클릭 | 보유한 방해요소 사용. 즉시형은 바로 `hazard:use`를 보냄. 랜덤형은 직접 사용할 수 없으므로 무시 |
| 벽·끈끈이 사용 후 마우스 이동 | 배치 모드. 판 위 마우스 위치를 따라 효과 범위를 미리 표시. 벽은 격자 후보에 스냅하고 초록·빨강으로 가능 여부 표시 |
| 배치 모드에서 왼쪽 클릭 | 그 위치로 `hazard:use` 전송. 빨간 후보에서는 보내지 않음 |
| 배치 모드에서 마우스 휠 또는 `R` 키 | 벽 방향을 가로·세로로 전환. 기본은 내 화면 기준 가로 ([DEC-031](../DECISIONS.md#결정-색인)) |
| 배치 모드에서 ESC·오른쪽 클릭 | 배치 취소. 사용 횟수·게이지·쿨타임 변화 없음 |

- `Alt`는 브라우저 메뉴·포커스 이동과 겹쳐 쓰지 않는다. `E`는 키 입력 기본 동작이 없어 `preventDefault` 없이 처리할 수 있다.
- 배치 모드에서는 왼쪽 클릭이 알 선택·세기 충전으로 전달되지 않는다. 세기 막대를 누르고 있는 중에는 벽·끈끈이 배치 모드로 들어가지 않고, 즉시형은 충전을 끊지 않고 사용한다.
- 사용 불가 상태(쿨타임·피로도 과열)는 칸을 흐리게 표시하고 입력을 보내지 않는다. 표시와 별개로 권한 측이 다시 검증한다.

### AI 대전

- AI 대전은 브라우저에서 실행한다 ([DEC-021](../DECISIONS.md#결정-색인)). `AiGameSession`(mode `ai`)이 전용 Web Worker에서 `game-runtime`·`game-core`와 AI 컨트롤러를 진행한다. 서버 연결·`ai:start`는 쓰지 않는다. 전적에 반영하지 않으므로 서버 권한이 필요하지 않다.
- AI 컨트롤러는 자기 플레이어의 `GameView`만 읽고 사람과 같은 명령 타입·검증을 거친다. 조준 무작위 오차와 방해요소 사용 시점은 컨트롤러의 시드 난수로 정한다.
- 방 생성 창에서 대전 상대를 AI로 고르고 판·알 개수(5·7·9)를 정해 시작한다 ([DEC-024](../DECISIONS.md#결정-색인)). 방 목록·`rooms`에 올리지 않는다. 로그인한 사용자 정보는 화면 표시에만 쓰고 결과는 서버로 보내지 않는다.

## 개발 순서

한 PC에서 두 사용자가 플레이하는 로컬 모드를 온라인보다 먼저 만든다([DEC-009](../DECISIONS.md#결정-색인)). 창 2개 구성으로 비공개 방해요소와 화면 가림을 플레이어별로 확인한다.

## 미정 사항

- 방해요소 사용 거부(쿨타임·피로도 과열·잘못된 위치) 오류 코드: 개발자 B가 API-001에서 [API 오류 코드 표](API.md#오류-형식과-코드)에 추가하면 연결한다
- 화면 배치는 [게임 화면](../PRD.md#게임-화면)과 UI-001 디자인 캔버스를 따른다
- 온라인 개발 시 로컬 DB(로컬 PostgreSQL / Neon 개발 브랜치) 선택
- 개발용 설정·환경변수 이름과 안전한 예제 관리: [운영 설계](OPERATIONS.md)

실제 설치 명령과 접속 주소는 구성 후 README에 추가하고 검증 결과는 worklog에 기록한다.
