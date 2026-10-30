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

[UI-001](TASKS.md#ui-001-로비인게임-화면-프로토타입)의 디자인 캔버스는 현재 화면 요구사항(턴 하이라이트, 방해요소 영역, 프로필바 버튼, AI 대전)을 반영하지 않았다.

개발자 A는 [PR #15](https://github.com/moguab2808-commits/mini-project-1-1/pull/15)의 `docs/game-001`에서 [GAME-001](TASKS.md#game-001-게임-처리-상세-설계-확정) 상세 계약 초안을 작성했다. DEC-014·015의 단일 보유·교체·상시 사용을 반영했다. DEC-017의 추가 효과 규칙과 승인된 실시간 방식(DEC-016·ADR-0004)을 반영했다. 효과 세부와 API-001 이벤트 계약은 검토 전이다. 구현은 없다. 근거는 [2026-10-30 worklog](worklogs/2026-10-30.md#game-001-게임-처리-상세-설계-초안)를 따른다.

GAME-001에 대한 개발자 B의 검토를 반영했다. 명령·종료·전송 계약은 [DEC-026](DECISIONS.md#결정-색인)으로 정했다. 사용자가 B의 의견대로 랭킹·레이팅 제외, 방 정보 DB 보관, 방 생성 창의 PvP/AI·알 5·7·9개·로비 새로고침, IP당 인증 요청 제한을 결정했다([DEC-022~025](DECISIONS.md#결정-색인), PRD v0.17). B의 답변 동의 확인과 커밋·PR 반영은 남았다. 근거는 [2026-10-30 worklog](worklogs/2026-10-30.md#game-001-개발자-b-검토-반영)를 따른다.

## 남은 일과 한계

- 상세 계약 확정: 게임 상태 전이·물리([GAME](design/GAME.md)), API 이벤트·필드([API](design/API.md)), DB 스키마([DATABASE](design/DATABASE.md)), 인증 세부([AUTH](design/AUTH.md)), 운영 세부([OPERATIONS](design/OPERATIONS.md))
- 구현 작업 등록과 로컬 2인 모드 개발, 디자인 캔버스 갱신
