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
  total_games     integer not null default 0
  wins            integer not null default 0
  losses          integer not null default 0  -- 무 = total_games - wins - losses
  created_at      timestamptz not null default now()

rooms   -- 컬럼 형식은 DB-001에서 확정
  제목, 방장, 참여자, 공개 여부, 코드, piece_count(5·7·9), 판, status('waiting' | 'playing')

sessions
  (connect-pg-simple 등 세션 라이브러리가 관리)
```

- 랭킹·레이팅·경기별 기록(`matches`)은 두지 않는다([DEC-022](../DECISIONS.md#결정-색인)). 경기 종료 시 두 사용자의 `total_games / wins / losses`만 서버의 `finishOnce`로 1회 갱신한다. 종료 사유는 저장하지 않고 서버 로그에 남긴다.
- 방 정보는 `rooms`에 둔다([DEC-023](../DECISIONS.md#결정-색인)). 알 위치·턴·방해요소 등 경기 진행 상태는 서버 메모리에 두며 저장하지 않는다. 방 상태 전이는 [GAME 상태 전이](GAME.md#상태-전이와-순서)를 따른다.
- 회원·전적은 기간 제한 없이 보관하고 계정 삭제를 제공하지 않으므로 삭제·만료 처리가 필요 없다. 건의 기능은 MVP에서 제외되어 `suggestions` 후보를 지웠다([DEC-011](../DECISIONS.md#결정-색인)).

---

## 미정 사항

- 마이그레이션은 Drizzle 마이그레이션 파일로 관리한다. 연결 풀의 유휴 시간 설정은 [운영](OPERATIONS.md)을 따른다.
- 닉네임 중복 판정 기준(NFC 정규화·영문 대소문자 무시, [회원등록](../PRD.md#회원등록))을 강제할 정규화 컬럼·유니크 제약의 형태. 캐릭터는 계정에 저장한다([캐릭터 변경](../PRD.md#캐릭터-변경)).
- AI 대전은 브라우저에서 실행하며 `rooms`·전적에 아무것도 저장하지 않는다([AI 대전](../PRD.md#ai-대전)).
- 두 사용자 전적의 원자적 갱신, 행 잠금·잠금 순서
- `rooms`의 컬럼 형식·코드 유니크 제약, 방 닫힘 시 삭제 여부
- 서버 재시작 시 메모리의 경기는 사라지지만 `rooms`에는 waiting·playing 방이 남는다. 기동 시 남은 방을 정리하는 절차(OPS-001과 함께 결정)
- 마이그레이션·백업·복구 절차

제품 정책이 바뀌면 스키마 편의로 정하지 말고 PRD와 결정 기록을 먼저 갱신한다.
