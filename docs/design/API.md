# API·실시간 통신 계약

## 상태

| 구분 | 상태 |
| --- | --- |
| 승인된 미구현 설계 | 전송 방식: 계정·조회는 REST, 방·대전은 Socket.IO, 세션 쿠키 공유 ([DEC-013](../DECISIONS.md#결정-색인)) |
| 현재 구현 | 없음 |
| 확정안 (B 결정, 리뷰 전) | REST 경로 8개, 방 목록 새로고침 조회, `sim:result` 삭제, 오류 형식·코드 ([API-001](../TASKS.md#api-001-api실시간-이벤트-계약-확정)) |
| 미정 | 아래 요청·응답 필드, 방해요소 거부 오류, 이벤트 순서 (초안) |

상위 구조는 [DESIGN](../DESIGN.md), 제품 동작은 [PRD](../PRD.md)를 따른다. 이 문서는 전송 방식·메시지·요청·응답·오류·검증 경계를 관리한다. 선택 이유는 [결정 기록](../DECISIONS.md)에 둔다.

## 인터페이스 초안

### REST API (초안)

> 전송 방식은 승인됐다. 아래 경로와 이벤트는 초안이며 상세 설계 작업에서 확정한다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/auth/signup` | 회원가입 |
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/me` | 내 정보 |
| PATCH | `/api/me/password` | 비밀번호 변경 (닉네임은 변경 불가) |
| PATCH | `/api/me/character` | 캐릭터 변경 |
| GET | `/api/rooms` | 방 목록 (로비 진입·새로고침 시 조회. 공개·비공개·게임 중 방 포함, [로비](../PRD.md#로비)) |
| GET | `/health` | 서버 상태 확인. DB를 조회하지 않는다 ([운영](OPERATIONS.md)) |

- 랭킹·최근 경기 조회 경로는 두지 않는다 ([DEC-022](../DECISIONS.md#결정-색인)).
- `GET /api/rooms`는 로그인한 사용자만 호출한다. 응답은 방 목록이며 방마다 방 id·제목·공개 여부·상태(`waiting` 대기 중 / `playing` 게임 중)·방장의 닉네임·캐릭터·전적(판수·승·패)을 담는다. **비공개 방의 코드는 응답에 포함하지 않는다.** 방 수가 적어 페이지를 나누지 않는다.
- API 버전 접두사는 두지 않는다 (제안, 클라이언트와 서버를 같은 출처로 함께 배포).

### 오류 형식과 코드

- REST 오류는 `{ error: { code, message } }`로 응답한다.
- Socket.IO 명령은 ack 콜백으로 `{ ok: true, … }` 또는 `{ ok: false, error: { code, message } }`를 돌려준다 (제안).

| 코드 | 사용처 |
| --- | --- |
| `INVALID_INPUT` | 요청·이벤트 입력이 스키마를 만족하지 않음 |
| `UNAUTHENTICATED` | 로그인하지 않았거나 세션이 만료됨 |
| `INVALID_CREDENTIALS` | 로그인·비밀번호 변경 실패. 닉네임 없음과 비밀번호 틀림을 구분하지 않는다 |
| `NICKNAME_TAKEN` | 가입 시 닉네임 중복 |
| `RATE_LIMITED` | 인증 요청 빈도 제한 초과 ([AUTH](AUTH.md#인증-요청-빈도-제한)) |
| `INVALID_CODE` | 비공개 방 코드가 맞지 않음 |
| `ROOM_FULL` | 이미 상대가 입장한 방 |
| `ROOM_PLAYING` | 게임이 시작된 방 |
| `ROOM_NOT_FOUND` | 없는 방, 즉시 참가할 수 있는 방이 없음 |
| `CODE_TAKEN` | 방 생성 시 코드가 다른 방과 겹침. 다시 생성해 요청한다 |
| `STALE_TURN` | 발사 명령의 gameId·turnId가 현재 경기·턴과 다름. 같은 턴의 두 번째 발사에는 쓰지 않는다 ([DEC-026](../DECISIONS.md#결정-색인)) |
| `SHOT_ALREADY_SUBMITTED` | 같은 턴에 이미 발사해 `shotCommitted`로 두 번째 발사가 거부됨 ([GAME](GAME.md#명령-경합과-시간), 제안). turnId가 맞는 요청이라 낡은 요청과 구분한다 |
| `STALE_HAZARD` | 방해요소 명령의 hazardInstanceId가 현재 보유와 다름 (제안) |

방해요소 사용 거부(쿨타임·게이지·진행 중 효과 제한 등)의 오류 코드는 이벤트 필드와 함께 정한다. 목록은 이 절 한 곳에서 관리한다.

### Socket.IO 이벤트 (초안)

- 연결 시 세션으로 사용자를 인증하며, 로그인하지 않은 사용자는 연결을 거부한다.
- 명령에 commandId를 두지 않고 결과는 ack 콜백으로 반환한다. 발사는 turnId, 방해요소는 hazardInstanceId로 오래된 명령을 거부한다 ([GAME](GAME.md#명령-경합과-시간), [DEC-026](../DECISIONS.md#결정-색인)). 조준 값 전송 이벤트는 두지 않는다.
- AI 대전은 브라우저에서 실행하므로 서버 이벤트가 없다 (`ai:start` 삭제, [DEC-021](../DECISIONS.md#결정-색인)).
- 같은 계정의 새 연결이 생기면 기존 연결에 `session:replaced`를 보내고 끊는다.

| 방향 | 이벤트 | 설명 |
|---|---|---|
| C → S | `room:create` | 방 생성 (PvP만. 필드는 아래 방 이벤트 필드) |
| C → S | `room:join` | 방 입장 (공개 방은 방 id, 비공개 방은 방 코드. 필드는 아래 방 이벤트 필드) |
| C → S | `room:quickJoin` | 즉시 참가 (대기 중인 공개 방 중 무작위, 없으면 `ROOM_NOT_FOUND`. [로비](../PRD.md#로비)) |
| C → S | `room:leave` | 방 나가기 |
| C → S | `room:start` | 게임 시작 (방장만, 상대 입장 시) |
| S → C | `room:state` | 대기실 상태 |
| S → C | `room:closed` | 방장 이탈 등으로 방이 닫힘 |
| S → C | `game:start` | 게임 시작 (판, 알 배치, 선공) |
| S → C | `hazard:granted` | 방해요소 지급·교체 (1·3·5·7·9라운드 시작, 받은 플레이어에게만 전송. 상대에게는 보내지 않는다) |
| C → S | `hazard:use` | 방해요소 사용 (현재 보유 1개의 instanceId, 벽·끈끈이는 위치 좌표. 입력 방식은 [LOCAL](LOCAL.md#방해요소-입력)). 직접 사용형은 내 턴·상대 턴과 알 이동 여부에 관계없이 제한 충족 시 허용. 랜덤형은 서버 자동 발동 (DEC-015·017) |
| S → C | `hazard:triggered` | 방해요소 발동·종료 알림 (양쪽 공개, 랜덤형은 턴과 관계없이 보유 중 상대에게 자동 발동) |
| S → C | `game:state` | 플레이어별 현재 게임 상태 (**플레이어별 뷰**: 상대 보유 방해요소 제외). 필드는 [GAME의 공개 GameView·본인 private](GAME.md#상태-위치와-플레이어별-뷰)를 따른다. 전송 주기는 물리와 분리하고 오래된 틱은 건너뛴다 ([GAME](GAME.md#전송과-표시-초안)) |
| C → S | `shot:submit` | 발사 (gameId, turnId, 알 id, 각도, 세기 0~100). 결과는 ack로 반환 ([DEC-026](../DECISIONS.md#결정-색인)) |
| S → C | `turn:change` | 턴 변경 (남은 시간 포함) |
| C → S | `game:forfeit` | 기권 |
| S → C | `game:over` | 게임 종료 (승 / 패 / 무, 종료 사유). 레이팅 없음 ([DEC-022](../DECISIONS.md#결정-색인)) |
| C → S | `rematch:request` | 재도전하기 |
| S → C | `rematch:state` | 재도전 진행 상태 (상호 동의 시 성립, 방 유지는 방장 기준. [게임 화면](../PRD.md#게임-화면)) |
| S → C | `session:replaced` | 다른 접속으로 대체되어 로그아웃됨 |

`sim:result`(일괄 기록 이벤트)는 두지 않는다. 실시간 진행은 `game:state`로, 방해요소 발동은 `hazard:triggered`로 전달한다 ([ADR-0004](../adr/0004-realtime-hazards.md), [DEC-016](../DECISIONS.md#결정-색인)).

### 방 이벤트 필드 (제안, B 확인·A 검토 전)

| 이벤트 | 요청 | 응답(ack) 또는 오류 |
| --- | --- | --- |
| `room:create` | 방 제목, 공개 여부, 알 개수(5·7·9), 판, 비공개 방이면 6자리 코드 (방 생성 창에서 만든 값) | `{ ok: true, roomId }`. 코드 중복 `CODE_TAKEN`, 이미 방이 있으면 거부(방장은 한 방만) |
| `room:join` | 공개 방은 방 id, 비공개 방은 코드 (방 id는 선택. 함께 보내면 코드와 같은 방이어야 한다) | `{ ok: true, roomId }`. `ROOM_NOT_FOUND`·`ROOM_FULL`·`ROOM_PLAYING`·`INVALID_CODE` |
| `room:quickJoin` | 없음 | `{ ok: true, roomId }` 또는 `ROOM_NOT_FOUND` |
| `room:leave` | 없음 | `{ ok: true }` |
| `room:start` | 없음 (방장만, 상대 입장 시) | `{ ok: true }` 또는 오류. 처리 순서는 [GAME의 시작 커밋](GAME.md#상태-전이와-순서) |

- 입장은 서버가 `rooms`의 조건부 갱신(참여자가 비어 있고 상태가 `waiting`)으로 처리해 동시 입장 중 한 명만 성공시킨다 ([DB-001](../TASKS.md#db-001-db-스키마-확정)). 목록이 오래된 채 입장해도 이 시점에 최신 상태로 다시 검사한다.
- 코드 틀림 횟수 제한은 두지 않는다. 대신 `room:join`에 연결당 빈도 제한을 둔다 (제안, 한도는 구현 시 정함).
- 비공개 방 코드는 방장에게만 보이며 `room:state`를 포함한 상대·목록 응답에는 넣지 않는다.

---

## 계약 확정 전 확인할 항목

- 인증 전달·실패 응답·권한 검사 위치: [인증 설계](AUTH.md)
- 요청·응답·오류 스키마, 이벤트 순서, 재전송·중복 요청 처리
- 발사·방해요소 요청과 턴 변경의 경합, 시간초과와 입력의 우선순위
- 플레이어별 공개·비공개 필드, 방 만료(서버 시작 시 `rooms` 정리는 [DATABASE](DATABASE.md)·[운영](OPERATIONS.md)). 방 목록 구독은 없다 ([DEC-024](../DECISIONS.md#결정-색인))
- 호환성·버전 변경, 속도 제한의 단위와 실패 형식
- 인증 요청 빈도 제한(IP당 `/api/auth/*` 분당 20회)의 응답 형식: [인증 설계](AUTH.md)
- `GameSession` 명령·이벤트 타입과 이름 맞춤: [LOCAL 시그니처 초안](LOCAL.md#gamesession-시그니처)
- 방해요소 이벤트의 상세 필드와 거부 오류 형식([방해요소 규칙](../PRD.md#방해요소-규칙))

이벤트명은 초안이다. 표에 있는 30초 등의 제품 값은 [게임 규칙](../PRD.md#게임-규칙)을 참조하며 여기서 새로 결정하지 않는다.
