# 데이터 모델·저장 계약

## 상태

| 구분 | 상태 |
| --- | --- |
| 승인된 미구현 설계 | 없음 |
| 현재 구현 | 없음 |
| 미정 | 아래 후보 전체. 합의·채택 전 구현 계약으로 사용하지 않는다. |

상위 구조는 [DESIGN](../DESIGN.md)이다. 보관·삭제·열람 정책은 [PRD](../PRD.md), 선택 이유는 [결정 기록](../DECISIONS.md)을 따른다. 이 문서는 스키마·관계·제약·인덱스·트랜잭션·마이그레이션을 관리한다.

## 기존 후보: 데이터 모델

> 아래 테이블과 컬럼은 **확정이 아니며** 구현 과정에서 변경될 수 있다.

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

suggestions
  id              serial PK
  user_id         FK → users.id
  title           varchar(100) not null
  content         text not null
  created_at      timestamptz not null default now()

sessions
  (connect-pg-simple 등 세션 라이브러리가 관리)
```

- 승패·무승부를 `player1 / player2 + result`로 표현하는 후보안이다.
- 경기 종료 시 `matches` 삽입과 두 사용자의 `rating / wins / losses / draws` 갱신을 **하나의 트랜잭션**으로 처리한다.
- 방 정보(제목, 코드, 알 개수, 판, 공개 여부)는 DB에 저장하지 않는다.

---

## 미정 사항

- DB·드라이버·ORM·세션 저장소: [기술 후보](TECH_STACK.md)
- 로그인 식별자인 닉네임의 정규화와 유니크 제약, 사용자별 캐릭터 저장 여부 ([회원등록](../PRD.md#회원등록)·[캐릭터 변경](../PRD.md#캐릭터-변경))
- 랭킹 정렬(레이팅·승수) 인덱스, 레이팅 하한의 표현
- AI 대전 경기의 저장 여부와 상대 표현([게임 미정 사항](../PRD.md#게임-미정-사항))
- 로그인 실패 횟수의 저장 위치([인증 설계](AUTH.md))
- 경기 결과 중복 저장 방지, 원자적 전적·레이팅 갱신, 행 잠금·잠금 순서
- 마이그레이션·백업·복구 절차, 승인된 삭제 정책의 저장소 반영

삭제·경기 무효·보관 기간이 미정이면 스키마 편의로 제품 정책을 확정하지 않는다.
