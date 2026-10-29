# 데이터 모델·저장 계약

## 상태

| 구분 | 상태 |
| --- | --- |
| 승인된 미구현 설계 | PostgreSQL(Neon), Drizzle ORM + node-postgres, 세션 테이블은 connect-pg-simple ([DEC-013](../DECISIONS.md#결정-색인)) |
| 현재 구현 | 없음 |
| 미정 | 아래 테이블·컬럼 (초안) |

상위 구조는 [DESIGN](../DESIGN.md)이다. 보관·삭제·열람 정책은 [PRD](../PRD.md), 선택 이유는 [결정 기록](../DECISIONS.md)을 따른다. 이 문서는 스키마·관계·제약·인덱스·트랜잭션·마이그레이션을 관리한다.

## 데이터 모델 초안

> 저장소·ORM은 승인됐다. 아래 테이블과 컬럼은 **초안이며** 상세 설계 작업에서 확정한다.

```
users
  id              serial PK
  nickname        varchar(12) unique not null   -- 로그인 식별자, 변경 불가
  password_hash   text not null
  character_id    varchar not null              -- 캐릭터 변경, 계정 저장 여부는 PRD 미정
  rating          integer not null default 1000 -- 경기마다 반올림한 정수
  wins            integer not null default 0
  losses          integer not null default 0
  draws           integer not null default 0
  created_at      timestamptz not null default now()

matches
  id              serial PK
  player1_id      FK → users.id
  player2_id      FK → users.id
  result          varchar   -- 'player1' | 'player2' | 'draw'
  player1_rating_change  integer
  player2_rating_change  integer
  board_id        varchar
  piece_count     integer
  end_reason      varchar   -- 'normal' | 'final_round' | 'forfeit' | 'disconnect' | 'timeout'
  played_at       timestamptz not null default now()

sessions
  (connect-pg-simple 등 세션 라이브러리가 관리)
```

- 승패·무승부를 `player1 / player2 + result`로 표현하는 후보안이다.
- 경기 종료 시 `matches` 삽입과 두 사용자의 `rating / wins / losses / draws` 갱신을 **하나의 트랜잭션**으로 처리한다.
- 방 정보(제목, 코드, 알 개수, 판, 공개 여부)는 DB에 저장하지 않는다.
- 회원·전적은 기간 제한 없이 보관하고 계정 삭제를 제공하지 않으므로 삭제·만료 처리가 필요 없다. 건의 기능은 MVP에서 제외되어 `suggestions` 후보를 지웠다([DEC-011](../DECISIONS.md#결정-색인)).

---

## 미정 사항

- 마이그레이션은 Drizzle 마이그레이션 파일로 관리한다. 연결 풀의 유휴 시간 설정은 [운영](OPERATIONS.md)을 따른다.
- 닉네임 중복 판정 기준(NFC 정규화·영문 대소문자 무시, [회원등록](../PRD.md#회원등록))을 강제할 정규화 컬럼·유니크 제약의 형태. 캐릭터는 계정에 저장한다([캐릭터 변경](../PRD.md#캐릭터-변경)).
- 랭킹 정렬(레이팅·승수) 인덱스, 레이팅 하한 0의 강제 위치
- AI 대전은 전적에 반영하지 않으므로 `matches`에 저장하지 않는다([AI 대전](../PRD.md#ai-대전)). 저장할 필요가 생기면 상대 표현을 다시 설계한다.
- 로그인 실패 횟수·제한 시각의 저장 위치([인증 설계](AUTH.md))
- 경기 결과 중복 저장 방지, 원자적 전적·레이팅 갱신, 행 잠금·잠금 순서
- 마이그레이션·백업·복구 절차

제품 정책이 바뀌면 스키마 편의로 정하지 말고 PRD와 결정 기록을 먼저 갱신한다.
