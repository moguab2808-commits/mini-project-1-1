# 데이터 모델·저장 계약

## 상태

| 구분 | 상태 |
| --- | --- |
| 승인된 미구현 설계 | PostgreSQL(Neon), Drizzle ORM + node-postgres, 세션 테이블은 connect-pg-simple ([DEC-013](../DECISIONS.md#결정-색인)). 랭킹·레이팅·`matches` 제외([DEC-022](../DECISIONS.md#결정-색인)), 방 정보는 `rooms`([DEC-023](../DECISIONS.md#결정-색인)), 사용자·방 컬럼과 입장·종료 처리([DEC-027](../DECISIONS.md#결정-색인)) |
| 현재 구현 | 없음 |
| 확정 (DB-001 완료) | 아래 [DB-001](../TASKS.md#db-001-db-스키마-확정) 스키마. 이전의 `[제안]` 표시는 개발자 B가 확정해 제거했다 |
| 미정 | 아래 미정 사항 |

상위 구조는 [DESIGN](../DESIGN.md)이다. 보관·삭제·열람 정책은 [PRD](../PRD.md), 선택 이유는 [결정 기록](../DECISIONS.md)을 따른다. 이 문서는 스키마·관계·제약·인덱스·트랜잭션·마이그레이션을 관리한다.

## 테이블

### users

회원 정보와 전적 누계다. 닉네임이 로그인 식별자이며 별도 아이디·가입 시각·로그인 실패 컬럼은 없다.

| 컬럼 | 타입·제약 | 비고 |
| --- | --- | --- |
| `id` | serial PK | |
| `nickname` | varchar(12) not null | 로그인 식별자, 변경 불가. 앱이 NFC로 정규화해 저장한다 |
| `password` | text not null | **argon2id 해시값을 저장한다(원문 아님).** 컬럼명이 원문처럼 보이므로 스키마에 주석으로 남긴다 |
| `character_id` | varchar(16) not null | 캐릭터 6종([API `CharacterId`](API.md#공통-타입)). 가입 시 무작위 기본값. 값은 앱(Zod)만 검사하고 DB `CHECK`는 두지 않는다. 캐릭터가 늘어도 마이그레이션이 필요 없다 |
| `total_games` | integer not null default 0 | CHECK >= 0. 승·패·무 모두 포함 |
| `wins` / `losses` | integer not null default 0 | CHECK >= 0, `wins + losses <= total_games`. 무 = `total_games - wins - losses` |

- 닉네임 대소문자 무시 중복은 `lower(nickname)`에 대한 **유니크 인덱스**로 막는다([회원등록](../PRD.md#회원등록)). Drizzle의 `uniqueIndex().on(sql\`lower(...)\`)` 형태로 쓰며, 생성된 마이그레이션 SQL이 의도대로인지 구현 때 확인한다.
- 그 밖의 인덱스는 두지 않는다(동시 접속 10명, 랭킹 없음).
- `matches`·레이팅·랭킹·배치 경기·로그인 실패 횟수·제한 시각 컬럼은 두지 않는다([DEC-022](../DECISIONS.md#결정-색인), [DEC-025](../DECISIONS.md#결정-색인)). 경기별 기록이 없으므로 누계가 맞는지 다시 계산해 검증할 수 없다. 경기 목록이 필요해지면 그때 테이블을 추가한다.

### rooms

방 상태를 DB가 직접 관리한다([DEC-023](../DECISIONS.md#결정-색인)). 방 목록 조회와 입장 동시성 처리에 쓰며 알 위치·턴·방해요소 같은 경기 진행 상태는 서버 메모리에 둔다.

| 컬럼 | 타입·제약 | 비고 |
| --- | --- | --- |
| `id` | serial PK | |
| `title` | varchar(20) not null | 방 제목([방 생성](../PRD.md#방-생성)) |
| `host_id` | integer not null, FK → `users.id` `ON DELETE RESTRICT`, unique | 방장. 한 사용자가 방을 둘 만들지 못한다 |
| `guest_id` | integer null, FK → `users.id` `ON DELETE RESTRICT`, unique | 참여자. 상대가 없으면 null(null은 여러 개 허용). 한 사용자가 두 방의 참여자가 되지 못한다 |
| `is_public` | boolean not null | true = 공개, false = 비공개 |
| `code` | varchar(6) unique null | 비공개 방 입장 코드. 공개 방은 null. 방장이 복사해 전달하므로 해시하지 않고 그대로 저장한다(사용자 비밀번호가 아닌 입장 코드) |
| `piece_count` | integer not null default 5 | `CHECK (piece_count IN (5, 7, 9))`. 5·7·9는 PRD 고정값이며 개수를 늘리면 마이그레이션이 필요하다 |
| `board` | varchar(16) not null | 방 생성 때 고른 판([API `BoardId`](API.md#공통-타입)). 판이 늘 수 있어 값은 앱(Zod)만 검사한다 |
| `status` | varchar(16) not null default 'waiting' | `waiting`(대기 중) / `playing`(게임 중). `CHECK (status IN ('waiting', 'playing'))` |

- 공개/비공개 제약: `CHECK ((is_public AND code IS NULL) OR (NOT is_public AND code IS NOT NULL))`. 비공개 방은 코드가 반드시 있고 공개 방은 없다. `code` 유니크로 같은 코드의 방이 둘 생기지 않는다(null은 여러 개 허용). 코드 중복 시 `CODE_TAKEN`을 돌려주어 다시 만들게 한다([API](API.md#오류-형식과-코드)).
- **코드 생성**: 방 생성 창의 코드 생성 버튼이 6자리 코드를 만든다. 영문 대문자·숫자에서 0/O·1/I를 뺀다([방 생성](../PRD.md#방-생성)). 생성은 `shared`의 함수가 `crypto` 난수로 한다.
- **한 사람 한 방**: 방장은 `host_id` 유니크로, 참여자는 `guest_id` 유니크로 한 방만 갖는다. 방장이면서 다른 방의 참여자가 되는 것은 서버가 방 생성·입장 전에 검사해 `ALREADY_IN_ROOM`으로 막는다. 한 계정은 연결이 하나뿐이라([AUTH](AUTH.md#socketio-인증중복-접속)) 이 검사 사이의 경합이 거의 없어 DB 제약은 두지 않는다.
- **자기 방 입장 금지**: `CHECK (guest_id IS NULL OR guest_id <> host_id)`.
- **타입 매핑**: Drizzle의 `serial`·`varchar({길이})`·`integer`·`boolean`·`check()`·`uniqueIndex()`로 그대로 옮긴다.

## 방 생명주기

| 시점 | 처리 |
| --- | --- |
| 방 생성(PvP) | 행 추가. AI 대전은 서버·DB에 아무것도 남기지 않는다([DEC-021](../DECISIONS.md#결정-색인)) |
| 입장 | 아래 동시성 처리. 성공하면 `guest_id`를 채운다 |
| 시작 커밋 | 방 큐의 시작 명령 처리로 `status`를 `waiting` → `playing`으로 바꾼다([GAME](GAME.md#상태-전이와-순서)) |
| 재도전 성립 | `status`는 `playing`을 유지하고 `guest_id`도 그대로 둔다(같은 방·같은 설정으로 새 경기). 상태 전이는 [GAME의 방 상태 표](GAME.md#상태-전이와-순서)를 따른다 |
| 재도전 만료 | 두 사람이 같은 방 대기실로 돌아가므로 `status`만 `waiting`으로 바꾸고 `guest_id`는 비우지 않는다([게임 화면](../PRD.md#게임-화면)) |
| 상대(참여자)가 나감 | `guest_id = null`로 비운다(방 유지, 다시 대기). 대기실·경기 중·결과 화면 어디서 나가도 같고, `status`가 `playing`이었다면 같은 UPDATE 한 문장에서 `waiting`으로 바꿔 중간 상태를 남기지 않는다. 경기 중 이탈이면 기권패 전적 저장(`finishOnce`)을 먼저 끝낸 뒤 이 UPDATE를 한다. 두 작업은 한 트랜잭션으로 묶지 않으며, 전적 저장이 실패해도 방 정리는 진행한다([경기 종료 저장](#경기-종료-저장)) |
| 방장이 나감 | 행 삭제(방 닫힘). 경기 중이면 기권패 전적 저장(`finishOnce`) 뒤에 행을 삭제한다. 방이 닫히면 이력을 남기지 않는다 |
| 서버 시작 | `rooms`를 전부 삭제한다. 배포·재시작으로 메모리의 연결·경기가 사라지는데 방만 남으면 유령 방이 목록에 보인다 |

- **방 삭제 시점**: 방은 ①방장이 나갈 때(나가기·연결 끊김·기권 이탈 포함)와 ②서버 시작 때만 삭제한다. 경기 종료·재도전 만료·참여자 이탈로는 삭제하지 않는다.
- **입장 동시성**: 두 사람이 같은 방에 동시에 들어와도 한 명만 성공하도록 조건부 갱신을 쓴다. `UPDATE rooms SET guest_id = $me WHERE id = $id AND guest_id IS NULL AND status = 'waiting' RETURNING *`가 0행이면 방 상태를 다시 읽어 `ROOM_FULL`·`ROOM_PLAYING`·`ROOM_NOT_FOUND`로 구분한다. 비공개 방은 입력한 코드가 `code`와 같을 때만 갱신한다. 즉시 참가는 공개·`guest_id IS NULL`·`status = 'waiting'`인 방 중 무작위 1개를 골라 같은 조건부 갱신을 한다. 이미 다른 방의 참여자인 사용자가 입장하면 조건부 UPDATE가 0행이 되는 대신 `guest_id` 유니크 위반(PostgreSQL `23505`)이 DB 오류로 난다. 서버는 위반한 제약 이름으로 구분해 `ALREADY_IN_ROOM`으로 매핑한다. 방 생성의 `host_id` 유니크 위반도 `ALREADY_IN_ROOM`, `code` 유니크 위반은 `CODE_TAKEN`으로 매핑한다.
- **DB 접속 최소화**: 방 목록은 폴링하지 않고 로비 진입·새로고침 때만 조회한다([DEC-024](../DECISIONS.md#결정-색인)). DB 접속이 계속 있으면 Neon이 중지되지 않아 월 100 CU-hour 한도([ADR-0003](../adr/0003-tech-stack-and-architecture.md))를 더 쓴다.

## 경기 종료 저장

- 종료 시 두 사용자의 `total_games`·`wins`·`losses`만 한 트랜잭션에서 갱신한다. 승자는 `total_games`와 `wins`, 패자는 `total_games`와 `losses`를 올리고, 무승부는 두 사람의 `total_games`만 올린다.
- 두 `users` 행을 **id 오름차순으로 `SELECT … FOR UPDATE`** 한 뒤 갱신한다. 잠금 순서를 고정해 교착을 막는다.
- 중복 처리는 서버의 `finishOnce`가 막는다([GAME](GAME.md#명령-경합과-시간)). `matches`가 없어 DB 제약으로는 막을 수 없으므로 게임 인스턴스의 메모리 플래그에 의존한다. MVP는 서버 장애를 고려하지 않으므로([비기능 요구사항](../PRD.md#4-비기능-요구사항과-제약)) 충분하다. 플래그는 종료를 확정하는 시점에 **저장 전에** 설정한다. 트랜잭션이 실패하면 오류를 서버 로그에 남기고 전적 반영을 포기한다(MVP). 재시도로 같은 경기가 두 번 반영되는 것이 한 판 누락보다 나쁘고, 서버 장애를 고려하지 않기 때문이다.
- 종료 사유는 저장하지 않고 서버 로그에 남긴다([운영](OPERATIONS.md)). 동시 이탈·시작 직전 이탈은 [게임 규칙](../PRD.md#게임-규칙)에 따라 먼저 확인된 쪽 기권패, 시작 처리 전이면 전적에 반영하지 않는다.
- AI 대전은 전적에 반영하지 않는다([AI 대전](../PRD.md#ai-대전)).

## sessions

connect-pg-simple이 쓰는 세션 테이블이다. 컬럼을 직접 정하지 않고 라이브러리 기본 스키마(테이블 `session`, 컬럼 `sid`·`sess`·`expire`, `expire` 인덱스)를 Drizzle 마이그레이션에 포함해 다른 테이블과 같은 방식으로 만든다. 라이브러리의 자동 테이블 생성 옵션은 켜지 않는다. 컬럼명·타입·인덱스는 구현 때 라이브러리 공식 문서의 기본 스키마와 대조한다. 만료 행 정리와 만료 시간은 [인증 설계](AUTH.md#세션)를 따른다. `users`와 FK로 묶지 않는다(비밀번호 변경 시 사용자의 다른 세션 행은 `sess`의 사용자 값으로 찾아 삭제한다).

## 마이그레이션

Drizzle 마이그레이션 파일을 저장소에 커밋하고 배포 시작 단계에서 자동 적용한다. 되돌림 스크립트 대신 "앞으로 호환되는 변경만" 원칙을 쓴다. 연결 풀의 유휴 시간 설정은 [운영](OPERATIONS.md)을 따른다.

---

## 미정 사항

- 생성된 마이그레이션 SQL이 `lower(nickname)` 유니크 인덱스를 의도대로 만드는지 구현 때 확인
- 백업·복구 절차는 [운영](OPERATIONS.md)

제품 정책이 바뀌면 스키마 편의로 정하지 말고 PRD와 결정 기록을 먼저 갱신한다.
