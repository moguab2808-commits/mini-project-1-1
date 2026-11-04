# 작업

## 관리 원칙

작업별로 관련 PRD·설계 절과 worklog 검증 근거를 연결한다. 문서별 작성 경계는 [AGENTS](../AGENTS.md#작업-목적에-따라-읽을-문서)를 따른다.

[GitHub Issues](https://github.com/moguab2808-commits/mini-project-1-1/issues)는 토론·담당 조율·외부 연결에 사용할 수 있다. 상태와 수용 기준은 이 문서를 기준으로 하고, Issue에는 작업 ID와 해당 절 링크를 남긴다. [Issue 양식](templates/ISSUE_TASK.md)과 [협업 규칙](CONTRIBUTING.md)을 따른다.

## 상태·우선순위

| 상태 | 의미 |
| --- | --- |
| 예정 | 등록됐으나 착수하지 않음 |
| 진행 중 | 범위에 따라 수정·합의·검증 중 |
| 막힘 | 진행 불가 조건과 해소 조건을 해당 작업에 기록 |
| 리뷰 중 | 검증 근거와 변경을 PR로 제출하고 리뷰를 기다림 |
| 완료 | 수용 기준 충족, 검증 근거 연결, 리뷰 후 기준 브랜치 병합 |
| 취소 | 결정 철회 등으로 하지 않기로 함. 근거 DEC와 사유를 해당 작업에 기록 |

우선순위는 P0(현재 진행을 막는 작업), P1(다음 착수 대상), P2(이후 검토)로 표시한다. 우선순위·작업 등록은 미정 제품 정책·기술안을 승인하는 행위가 아니다.

현재 진행 순서([DEC-065](DECISIONS.md#결정-색인)): 로컬에서 할 수 있는 작업·확인(로컬 2인·AI 대전·하네스)을 먼저 한다. 온라인 관련(서버 Socket.IO 연결, `npm run test:db`·개발 DB 마이그레이션 적용, 온라인 두 계정 확인, 배포)은 뒤로 미루며, 해당 작업의 남은 확인·수용 기준에 남겨 둔다. 대상: [IMPL-013](#impl-013-배포) 배포, [IMPL-015](#impl-015-방-테마-구현) DB 테스트, [IMPL-018](#impl-018-사람-아바타-구현) DB 테스트·온라인 두 계정, [IMPL-017](#impl-017-감정표현-구현) 서버 중계·온라인 확인.

## 작업 목록

| ID | 작업 | 우선순위 | 의존성 | 상태 | 담당 | Issue·PR |
| --- | --- | --- | --- | --- | --- | --- |
| [DOC-001](#doc-001-문서-책임과-구조-재편) | 문서 책임과 구조 재편 | P0 | 없음 | 완료 | Codex — 사용자 요청 수행 | [PR #1](https://github.com/moguab2808-commits/mini-project-1-1/pull/1) |
| [DOC-002](#doc-002-문서-위치-정리와-단일-문서-통합) | 문서 위치 정리와 단일 문서 통합 | P0 | DOC-001 현재 작업 파일 | 완료 | Codex — 사용자 요청 수행 | [PR #1](https://github.com/moguab2808-commits/mini-project-1-1/pull/1) |
| [DOC-003](#doc-003-문서별-책임-중복-제거) | 문서별 책임 중복 제거 | P0 | DOC-002 현재 작업 파일 | 완료 | Claude — 사용자 요청 수행 | [PR #1](https://github.com/moguab2808-commits/mini-project-1-1/pull/1) |
| [UI-001](#ui-001-로비인게임-화면-프로토타입) | 로비·인게임 화면 프로토타입 | P1 | 없음 | 완료 | Claude — 사용자 요청 수행 | [PR #1](https://github.com/moguab2808-commits/mini-project-1-1/pull/1) |
| [DOC-004](#doc-004-개발-전-문서-충돌-정리) | 개발 전 문서 충돌 정리 | P0 | UI-001 현재 작업 파일 | 완료 | Claude — 사용자 요청 수행 | [PR #1](https://github.com/moguab2808-commits/mini-project-1-1/pull/1) |
| [DOC-005](#doc-005-개발-전-결정-반영) | 개발 전 결정 반영 | P0 | DOC-004 | 완료 | Claude — 사용자 요청 수행 | [PR #1](https://github.com/moguab2808-commits/mini-project-1-1/pull/1) |
| [DOC-006](#doc-006-증강을-방해요소로-대체) | 증강을 방해요소로 대체 | P0 | DOC-005 | 완료 | Claude — 사용자 요청 수행 | [PR #1](https://github.com/moguab2808-commits/mini-project-1-1/pull/1) |
| [DOC-007](#doc-007-보관장애규모-정책과-방해요소-지급-보완) | 보관·장애·규모 정책과 방해요소 지급 보완 | P0 | DOC-006 | 완료 | Claude — 사용자 요청 수행 | [PR #1](https://github.com/moguab2808-commits/mini-project-1-1/pull/1) |
| [DOC-008](#doc-008-prd-보완-의견과-상태-문구-최신화) | PRD 보완 의견과 상태 문구 최신화 | P1 | DOC-007 | 완료 | Claude — 사용자 요청 수행 | [PR #1](https://github.com/moguab2808-commits/mini-project-1-1/pull/1) |
| [DOC-009](#doc-009-prd-미정-항목-위임-결정) | PRD 미정 항목 위임 결정 | P0 | DOC-008 | 완료 | Claude — 사용자 요청 수행 | [PR #1](https://github.com/moguab2808-commits/mini-project-1-1/pull/1) |
| [DOC-010](#doc-010-기술-스택과-아키텍처-결정) | 기술 스택과 아키텍처 결정 | P0 | DOC-009 | 완료 | Claude — 사용자 요청 수행 | [PR #14](https://github.com/moguab2808-commits/mini-project-1-1/pull/14) |
| [GAME-001](#game-001-게임-처리-상세-설계-확정) | 게임 처리 상세 설계 확정 | P0 | DOC-010 | 완료 | 개발자 A (Codex) | [#2](https://github.com/moguab2808-commits/mini-project-1-1/issues/2)·[PR #15](https://github.com/moguab2808-commits/mini-project-1-1/pull/15) |
| [LOCAL-001](#local-001-로컬-2인-모드-설계-확정) | 로컬 2인 모드 설계 확정 | P0 | DOC-010 | 완료 | 개발자 A (Claude) | [#3](https://github.com/moguab2808-commits/mini-project-1-1/issues/3)·[PR #18](https://github.com/moguab2808-commits/mini-project-1-1/pull/18) |
| [GAME-002](#game-002-물리방해요소-수치-기본값-제안) | 물리·방해요소 수치 기본값 제안 | P1 | GAME-001 | 완료 | 개발자 A (Claude) | [#4](https://github.com/moguab2808-commits/mini-project-1-1/issues/4)·[PR #19](https://github.com/moguab2808-commits/mini-project-1-1/pull/19) |
| [UI-002](#ui-002-디자인-캔버스-현재-요구사항-반영) | 디자인 캔버스 현재 요구사항 반영 | P1 | 없음 | 완료 | 개발자 A | [#5](https://github.com/moguab2808-commits/mini-project-1-1/issues/5)·[PR #25](https://github.com/moguab2808-commits/mini-project-1-1/pull/25) |
| [ASSET-001](#asset-001-에셋-조달-계획) | 에셋 조달 계획 | P2 | DOC-010 | 완료 | 개발자 A | [#6](https://github.com/moguab2808-commits/mini-project-1-1/issues/6)·[PR #28](https://github.com/moguab2808-commits/mini-project-1-1/pull/28) |
| [VAL-001](#val-001-성능-측정-절차와-플레이-테스트-기록-양식) | 성능 측정 절차와 플레이 테스트 기록 양식 | P1 | 없음 | 완료 | 개발자 A | [#7](https://github.com/moguab2808-commits/mini-project-1-1/issues/7)·[PR #30](https://github.com/moguab2808-commits/mini-project-1-1/pull/30) |
| [VAL-002](#val-002-개발용-프레임-시간-기록) | 개발용 프레임 시간 기록 | P2 | IMPL-004 | 완료 | 개발자 A | [#34](https://github.com/moguab2808-commits/mini-project-1-1/issues/34)·[PR #65](https://github.com/moguab2808-commits/mini-project-1-1/pull/65) |
| [API-001](#api-001-api실시간-이벤트-계약-확정) | API·실시간 이벤트 계약 확정 | P0 | GAME-001 | 완료 | 개발자 B | [#8](https://github.com/moguab2808-commits/mini-project-1-1/issues/8)·[PR #22](https://github.com/moguab2808-commits/mini-project-1-1/pull/22) |
| [API-002](#api-002-api-이름식별자-확인과-private-뷰-필드-확정) | API 이름·식별자 확인과 private 뷰 필드 확정 | P1 | API-001 | 완료 | 개발자 A | [PR #33](https://github.com/moguab2808-commits/mini-project-1-1/pull/33) |
| [DB-001](#db-001-db-스키마-확정) | DB 스키마 확정 | P0 | DOC-010 | 완료 | 개발자 B | [#9](https://github.com/moguab2808-commits/mini-project-1-1/issues/9)·[PR #23](https://github.com/moguab2808-commits/mini-project-1-1/pull/23) |
| [AUTH-001](#auth-001-인증-상세-설계-확정) | 인증 상세 설계 확정 | P0 | DOC-010 | 완료 | 개발자 B | [#10](https://github.com/moguab2808-commits/mini-project-1-1/issues/10)·[PR #24](https://github.com/moguab2808-commits/mini-project-1-1/pull/24) |
| [OPS-001](#ops-001-운영-설계-확정) | 운영 설계 확정 | P1 | DOC-010 | 완료 | 개발자 B | [#11](https://github.com/moguab2808-commits/mini-project-1-1/issues/11)·[PR #26](https://github.com/moguab2808-commits/mini-project-1-1/pull/26) |
| [PLAN-001](#plan-001-구현-작업-등록) | 구현 작업 등록 | P0 | GAME-001, LOCAL-001, API-001, DB-001, AUTH-001 | 완료 | 개발자 B | [#12](https://github.com/moguab2808-commits/mini-project-1-1/issues/12)·[PR #32](https://github.com/moguab2808-commits/mini-project-1-1/pull/32) |
| [IMPL-001](#impl-001-프로젝트-골격) | 프로젝트 골격 | P0 | DOC-010 | 완료 | 개발자 A | [#35](https://github.com/moguab2808-commits/mini-project-1-1/issues/35)·[PR #51](https://github.com/moguab2808-commits/mini-project-1-1/pull/51) |
| [IMPL-014](#impl-014-패키지-의존-경계-린트와-envexample) | 패키지 의존 경계 린트와 `.env.example` | P1 | IMPL-001 | 완료 | 개발자 B | [#49](https://github.com/moguab2808-commits/mini-project-1-1/issues/49) |
| [IMPL-002](#impl-002-game-core) | `game-core` | P0 | GAME-001, GAME-002, IMPL-001 | 완료 | 개발자 A | [#36](https://github.com/moguab2808-commits/mini-project-1-1/issues/36)·[PR #53](https://github.com/moguab2808-commits/mini-project-1-1/pull/53) |
| [IMPL-003](#impl-003-game-runtime) | `game-runtime` | P0 | GAME-001, LOCAL-001, IMPL-001, IMPL-002 | 완료 | 개발자 A | [#37](https://github.com/moguab2808-commits/mini-project-1-1/issues/37)·[PR #57](https://github.com/moguab2808-commits/mini-project-1-1/pull/57) |
| [IMPL-004](#impl-004-로컬-2인-모드) | 로컬 2인 모드 | P0 | LOCAL-001, UI-002, IMPL-002, IMPL-003, ASSET-001 | 완료 | 개발자 A | [#38](https://github.com/moguab2808-commits/mini-project-1-1/issues/38) |
| [IMPL-005](#impl-005-ai-대전) | AI 대전 | P1 | LOCAL-001, IMPL-004 | 완료 | 개발자 A | [#39](https://github.com/moguab2808-commits/mini-project-1-1/issues/39)·[PR #62](https://github.com/moguab2808-commits/mini-project-1-1/pull/62) |
| [IMPL-006](#impl-006-db마이그레이션) | DB·마이그레이션 | P0 | DB-001, IMPL-001 | 완료 | 개발자 B | [#40](https://github.com/moguab2808-commits/mini-project-1-1/issues/40)·[PR #54](https://github.com/moguab2808-commits/mini-project-1-1/pull/54) |
| [IMPL-007](#impl-007-인증) | 인증 | P0 | AUTH-001, API-001, IMPL-006 | 완료 | 개발자 B | [#41](https://github.com/moguab2808-commits/mini-project-1-1/issues/41)·[PR #59](https://github.com/moguab2808-commits/mini-project-1-1/pull/59) |
| [IMPL-008](#impl-008-로비방-서버) | 로비·방 (서버) | P0 | API-001, DB-001, IMPL-007 | 완료 | 개발자 B | [#42](https://github.com/moguab2808-commits/mini-project-1-1/issues/42)·[PR #61](https://github.com/moguab2808-commits/mini-project-1-1/pull/61) |
| [IMPL-009](#impl-009-온라인-대전-서버) | 온라인 대전 (서버) | P0 | API-001, IMPL-003, IMPL-008 | 완료 | 개발자 B | [#43](https://github.com/moguab2808-commits/mini-project-1-1/issues/43)·[PR #63](https://github.com/moguab2808-commits/mini-project-1-1/pull/63) |
| [IMPL-010](#impl-010-온라인-대전-클라이언트) | 온라인 대전 (클라이언트) | P0 | API-001, IMPL-003, IMPL-004 | 완료 | 개발자 A | [#44](https://github.com/moguab2808-commits/mini-project-1-1/issues/44)·[PR #64](https://github.com/moguab2808-commits/mini-project-1-1/pull/64) |
| [IMPL-011](#impl-011-경기-종료-전적) | 경기 종료 전적 | P0 | DB-001, IMPL-009 | 완료 | 개발자 B | [#45](https://github.com/moguab2808-commits/mini-project-1-1/issues/45)·[PR #63](https://github.com/moguab2808-commits/mini-project-1-1/pull/63) |
| [IMPL-012](#impl-012-계정로비대기실결과-화면) | 계정·로비·대기실·결과 화면 | P0 | UI-002, API-001, IMPL-007, IMPL-008 | 완료 | 개발자 B | [#46](https://github.com/moguab2808-commits/mini-project-1-1/issues/46)·[PR #66](https://github.com/moguab2808-commits/mini-project-1-1/pull/66) |
| [IMPL-013](#impl-013-배포) | 배포 | P1 | OPS-001, IMPL-009, IMPL-011 | 진행 중 | 개발자 B | [#47](https://github.com/moguab2808-commits/mini-project-1-1/issues/47) |
| [CHAR-001](#char-001-사람-아바타-전환과-꾸미기-설계) | 사람 아바타 전환과 꾸미기 설계 | P1 | IMPL-012 | 완료 | Claude — 사용자 요청 수행 | [#69](https://github.com/moguab2808-commits/mini-project-1-1/issues/69)·[PR #79](https://github.com/moguab2808-commits/mini-project-1-1/pull/79) |
| [THEME-001](#theme-001-방-테마-선택-설계) | 방 테마 선택 설계 | P2 | IMPL-012 | 완료 | Claude — 사용자 요청 수행 | [#72](https://github.com/moguab2808-commits/mini-project-1-1/issues/72) |
| [IMPL-015](#impl-015-방-테마-구현) | 방 테마 구현 | P2 | THEME-001, IMPL-004, IMPL-005, IMPL-008, IMPL-012 | 진행 중 | Claude — 사용자 요청 수행 | [PR #74](https://github.com/moguab2808-commits/mini-project-1-1/pull/74)(1차) |
| [UI-003](#ui-003-사람-아바타-화풍-ui-적용-설계) | 사람 아바타 화풍 UI 적용 설계 | P2 | CHAR-001 | 취소 | 미정 | [#73](https://github.com/moguab2808-commits/mini-project-1-1/issues/73) |
| [HAZ-001](#haz-001-방해요소-10종-추가와-턴-교체-설계) | 방해요소 10종 추가와 턴 교체 설계 | P1 | IMPL-004, IMPL-005, IMPL-009 | 완료 | Claude — 사용자 요청 수행 | [PR #79](https://github.com/moguab2808-commits/mini-project-1-1/pull/79) |
| [IMPL-016](#impl-016-방해요소-10종-추가와-턴-교체) | 방해요소 10종 추가와 턴 교체 | P1 | HAZ-001 | 진행 중 | Claude — 사용자 요청 수행 | [PR #81](https://github.com/moguab2808-commits/mini-project-1-1/pull/81) |
| [EMOTE-001](#emote-001-감정표현-설계) | 감정표현 설계 | P2 | 없음 | 완료 | Claude — 사용자 요청 수행 | [PR #79](https://github.com/moguab2808-commits/mini-project-1-1/pull/79) |
| [IMPL-018](#impl-018-사람-아바타-구현) | 사람 아바타 구현 | P1 | CHAR-001, IMPL-012 | 진행 중 | Claude — 사용자 요청 수행 | [PR #82](https://github.com/moguab2808-commits/mini-project-1-1/pull/82) |
| [IMPL-017](#impl-017-감정표현-구현) | 감정표현 구현 | P2 | EMOTE-001, IMPL-018 | 진행 중 | Codex — 사용자 요청 수행 | 미생성 |
| [DOC-011](#doc-011-readme-설치실행-절차) | README 설치·실행 절차 | P2 | PLAN-001 이후 실행 구성 구현(IMPL-001·IMPL-013) | 진행 중 | 개발자 B·Codex(로컬) | [#13](https://github.com/moguab2808-commits/mini-project-1-1/issues/13) |
| [UI-004](#ui-004-디자인-참고-기준을-l-세트로-변경) | 디자인 참고 기준을 L 세트로 변경 | P1 | 없음 | 완료 | Claude — 사용자 요청 수행 | [PR #85](https://github.com/moguab2808-commits/mini-project-1-1/pull/85) |
| [IMPL-019](#impl-019-l-화풍-화면-적용) | L 화풍 화면 적용 | P1 | UI-004, IMPL-012 | 진행 중 | 개발자 B | [#86](https://github.com/moguab2808-commits/mini-project-1-1/issues/86) |
| [IMPL-020](#impl-020-중력-구역-화살표미끄럼-장판-설치형시선시점-조정) | 중력 구역 화살표·미끄럼 장판 설치형·시선·시점 조정 | P1 | IMPL-016 | 진행 중 | 개발자 A | [#87](https://github.com/moguab2808-commits/mini-project-1-1/issues/87) |
| [IMPL-021](#impl-021-인게임-hud결과-화풍) | 인게임 HUD·결과 화풍 | P1 | IMPL-019의 첫 PR(공통 기반) | 예정 | 개발자 A | [#87](https://github.com/moguab2808-commits/mini-project-1-1/issues/87) |

## DOC-001 문서 책임과 구조 재편

범위: 사용자 요청의 문서별 책임에 따라 AGENTS와 기준 문서·상세 문서를 재편하고 참조·협업 양식을 정리한다. 제품 기능 구현이나 미정 기술 채택은 포함하지 않는다.

- 요구사항 근거: 이번 사용자 요청, [AGENTS의 문서 책임](../AGENTS.md#작업-목적에-따라-읽을-문서)
- 설계 경계: [DESIGN](DESIGN.md#상태와-책임)
- 결정: [DEC-004](DECISIONS.md#결정-색인)
- 검증 근거: [2026-10-28 worklog](worklogs/2026-10-28.md#doc-001-문서-책임과-구조-재편)

수용 기준:

- [x] 당시 요청한 기준 문서를 루트에 배치하고 AGENTS에 책임·작성 경계를 안내했다. 현재 위치·통합 기준은 후속 DOC-002를 따른다.
- [x] 제품 규칙·구현 계약·결정 근거·작업 상태·검증 결과가 각 책임 문서로 연결되며 중복 관리 규칙이 없다.
- [x] 상대 Markdown 링크와 앵커가 이동 후에도 유효하고, 기존 증강 19종과 기술 미정 상태가 유지된다.
- [x] worklog에 검증 조건·결과·미검증 한계를 기록하고 PR에서 연결할 수 있다.
- [x] 변경이 리뷰 후 기준 브랜치에 병합됐다.

체크는 확인된 항목만 갱신한다. 문서 수정·검증이 끝나도 병합 전에는 완료 상태로 변경하지 않는다.

## 새 작업 등록 양식

```markdown
## <작업 ID> <작업명>

우선순위: P0/P1/P2
상태: 예정
담당: 미정
의존성: 없음 또는 선행 작업 ID
범위: 작업의 결과와 경계
관련 문서: PRD 절 / DESIGN 상세 절 / DEC ID
Issue·PR: 링크 또는 미생성

수용 기준:
- [ ] 확인할 사용자 동작·오류·경계와 관찰 가능한 결과

검증 근거: 날짜별 worklog의 해당 작업 절
막힘·해소 조건: 해당할 때 작성
```

## DOC-002 문서 위치 정리와 단일 문서 통합

우선순위: P0
상태: 완료
담당: Codex — 사용자 요청 수행
의존성: DOC-001의 현재 작업 파일
범위: 루트에는 AGENTS.md·CLAUDE.md·README.md만 유지하고 나머지 Markdown을 docs로 이동한다. PRD와 트러블슈팅을 각각 통합하고 archive를 삭제하며 참조를 갱신한다. 제품 규칙·기술 미정 상태는 유지한다.
관련 문서: AGENTS의 문서 구조 / DEC-005
Issue·PR: [PR #1](https://github.com/moguab2808-commits/mini-project-1-1/pull/1)

수용 기준:
- [x] 루트 Markdown은 지정한 세 파일뿐이며 나머지는 docs 아래에 있다.
- [x] PRD 상세·보완 의견과 트러블슈팅 양식이 각 단일 문서에 포함되고 중복 파일·archive가 없다.
- [x] 상대 링크·앵커가 유효하고 기존 증강 19종과 기술 미정 상태를 유지한다.
- [x] 변경·검증 조건과 한계를 worklog에 기록한다.
- [x] 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: [2026-10-28 worklog](worklogs/2026-10-28.md#doc-002-문서-위치-정리와-단일-문서-통합)

## DOC-003 문서별 책임 중복 제거

우선순위: P0
상태: 완료
담당: Claude — 사용자 요청 수행
의존성: DOC-002의 현재 작업 파일
범위: AGENTS의 문서별 책임 표를 다른 문서에서 반복한 설명을 제거하고 AGENTS 링크로 대체한다. 각 문서 고유의 내용·제품 규칙·결정·과거 기록(ADR·이전 worklog)은 변경하지 않는다.
관련 문서: [AGENTS의 문서 책임](../AGENTS.md#작업-목적에-따라-읽을-문서)
Issue·PR: [PR #1](https://github.com/moguab2808-commits/mini-project-1-1/pull/1)

수용 기준:
- [x] README·PRD·TASKS·PROGRESS·DESIGN·DECISIONS·TROUBLESHOOTING·ENGINEERING-VALIDATION·CHANGELOG·CONTRIBUTING에서 다른 문서들의 책임을 나열한 설명이 AGENTS 링크로 대체됐다.
- [x] 상대 링크·앵커가 유효하다.
- [x] 변경·검증 조건과 한계를 worklog에 기록한다.
- [x] 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: [2026-10-28 worklog](worklogs/2026-10-28.md#doc-003-문서별-책임-중복-제거)

## UI-001 로비·인게임 화면 프로토타입

우선순위: P1
상태: 완료
담당: Claude — 사용자 요청 수행
의존성: 없음
범위: 2026-10-29 사용자 요청의 계정·로비·게임 화면 변경을 PRD에 반영하고, `알까기 바 (2).html`을 기반으로 한 화면 시안을 claude.ai 디자인 캔버스에 만들어 사용자가 직접 수정할 수 있게 한다. 실제 서비스 구현·통신·저장은 포함하지 않는다.
관련 문서: [로그인](PRD.md#로그인)·[회원등록](PRD.md#회원등록)·[로비](PRD.md#로비)·[캐릭터 변경](PRD.md#캐릭터-변경)·[게임 화면](PRD.md#게임-화면) / [DEC-006](DECISIONS.md#결정-색인)
Issue·PR: [PR #1](https://github.com/moguab2808-commits/mini-project-1-1/pull/1)
시안: [claude.ai 디자인 캔버스](https://claude.ai/artifact/PFvjbTKVncmZLbfQAUEBVV)(2D 화면 흐름), [3D 인게임 시안](https://claude.ai/artifact/R7tW789HkwcAPn9oYZvGc8)(`알까기 바 (2).html` 기반). 둘 다 공유 범위는 소유자가 설정

수용 기준:
- [x] PRD에 닉네임·비밀번호 가입, 로비(프로필바·방 목록·방 생성·즉시 참가·코드 입력), 플로팅 캐릭터 변경, 게임 화면 프로필 배치·투명 배경, 재도전하기·나가기가 반영되고 정하지 않은 세부는 미정으로 표시됐다.
- [x] 시안에서 로그인·가입 → 로비 → 방 생성/코드 입력 창·캐릭터 변경 창 → 인게임 → 결과(재도전하기·나가기) 흐름을 눌러 볼 수 있다.
- [x] 사용자가 시안을 검토하고 화면 미정 항목(정보 배치·캐릭터 표현 등)의 반영 여부를 정했다. (방해요소 칸은 프로필 위쪽으로 변경, 나머지는 2D 시안으로 판단할 수 없어 UI-002에서 확정으로 넘김: [DEC-032](DECISIONS.md#결정-색인))
- [x] 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: [2026-10-29 worklog](worklogs/2026-10-29.md#ui-001-로비인게임-화면-프로토타입)

## DOC-004 개발 전 문서 충돌 정리

우선순위: P0
상태: 완료
담당: Claude — 사용자 요청 수행
의존성: UI-001의 현재 작업 파일
범위: 개발 전 검토에서 찾은 문서 간 충돌(C1~C10)과 규칙 내부 불일치(R1~R5)를 2026-10-29 사용자 결정대로 반영한다. 기준 화면 프로토타입 `알까기 바 (2).html`을 저장소에 커밋한다. 결정하지 않은 항목은 미정으로 유지한다.
관련 문서: [PRD](PRD.md) / [API](design/API.md)·[DATABASE](design/DATABASE.md)·[AUTH](design/AUTH.md)·[GAME](design/GAME.md)·[LOCAL](design/LOCAL.md) / [DEC-007·DEC-008](DECISIONS.md#결정-색인)
Issue·PR: [PR #1](https://github.com/moguab2808-commits/mini-project-1-1/pull/1)

수용 기준:
- [x] DB 후보에 `login_id`가 없고, API 후보에 닉네임 변경이 없으며, PRD에 닉네임 변경 불가가 명시됐다.
- [x] AI 봇 대전이 비목표·향후 확장에서 빠지고 목표·MVP 범위에 들어갔으며, 세부 사항은 미정으로 표시됐다.
- [x] 게임 화면이 3D로 확정되고 배치가 디자인 캔버스 기준으로 기술됐다. 판정 위치는 미정으로 남았다.
- [x] 랭킹 정렬에서 도달 시각이 빠지고 레이팅 반올림, 로그인 5회 실패 제한이 반영됐다.
- [x] 캐릭터 변경·즉시 참가·재도전이 API·DB 후보에 반영됐다.
- [x] R1~R4의 임시 기준이 PRD 한 곳에 통일되고 DEC-008에 임시 기준으로 기록됐다.
- [x] 링크·앵커 검사와 `git diff --check`를 통과했다.
- [x] 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: [2026-10-29 worklog](worklogs/2026-10-29.md#doc-004-개발-전-문서-충돌-정리)

## DOC-005 개발 전 결정 반영

우선순위: P0
상태: 완료
담당: Claude — 사용자 요청 수행
의존성: DOC-004
범위: 2026-10-29 사용자가 답한 개발 전 결정 항목(P0~P2)을 PRD·설계 문서에 반영한다. 답이 없는 항목(기술 스택·아키텍처, 랭킹·건의·상세 프로필·환경설정의 MVP 포함, 게임 내 단위, 레이팅 하한, 닉네임 중복 판정, 로비 진입 위치, 건의 확인 방법)은 미정으로 유지한다.
관련 문서: [PRD](PRD.md) / [GAME](design/GAME.md)·[LOCAL](design/LOCAL.md)·[API](design/API.md) / [DEC-009](DECISIONS.md#결정-색인)
Issue·PR: [PR #1](https://github.com/moguab2808-commits/mini-project-1-1/pull/1)

수용 기준:
- [x] 방해요소 10종과 동작 방식 분류가 PRD의 MVP 범위와 별도 절에 반영되고, 세부는 미정으로 표시됐다.
- [x] 동시 제거 무승부, 세기에 따른 알 떠오름, 이탈·동시 이탈 기권 규칙이 게임 규칙에 반영됐다.
- [x] 즉시 참가·재도전·캐릭터 해금·게임 화면 배치(턴 하이라이트, 상단 시간·라운드, 프로필 위 증강)가 화면 요구사항에 반영됐다.
- [x] 로컬 2인 모드 우선 개발과 물리 재검토·방해요소 처리 항목이 설계 문서에 반영됐다.
- [x] 링크·앵커 검사와 `git diff --check`를 통과했다.
- [x] 사용자가 해석이 필요한 항목(방해요소와 증강의 관계, 재도전 방 유지 해석)을 확인했다. ([DEC-010](DECISIONS.md#결정-색인)·[DEC-012](DECISIONS.md#결정-색인)로 해소)
- [x] 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: [2026-10-29 worklog](worklogs/2026-10-29.md#doc-005-개발-전-결정-반영)

## DOC-006 증강을 방해요소로 대체

우선순위: P0
상태: 완료
담당: Claude — 사용자 요청 수행
의존성: DOC-005
범위: 2026-10-29 사용자 지시에 따라 PRD의 증강 규칙·19종 목록을 제거하고 방해요소 규칙으로 대체한다. 최종 라운드 10, 2라운드마다 무작위 지급, 상대 비공개, 방해요소별 발동·유지 기한, 전등 깨기 제외를 반영하고 설계·검증·안내 문서의 증강 참조를 정리한다. 방해요소별 세부는 미정으로 유지한다.
관련 문서: [방해요소 규칙](PRD.md#방해요소-규칙) / [API](design/API.md)·[GAME](design/GAME.md)·[LOCAL](design/LOCAL.md)·[AUTH](design/AUTH.md) / [DEC-010](DECISIONS.md#결정-색인)
Issue·PR: [PR #1](https://github.com/moguab2808-commits/mini-project-1-1/pull/1)

수용 기준:
- [x] PRD에 증강 규칙·목록·증강 화면 요소가 없고, 방해요소 규칙(10라운드·2라운드마다 1개 무작위 지급·상대 비공개·방해요소별 발동/유지 기한·9종)이 있다.
- [x] 턴 제한·라운드·게임 화면·성공 기준·향후 확장이 방해요소 기준으로 바뀌었다.
- [x] 설계·검증 문서와 README·AGENTS의 증강 참조가 방해요소로 바뀌었고, 과거 기록(ADR·이전 worklog)은 그대로다.
- [x] DEC-010을 추가하고 DEC-001·002·008·009의 대체 관계를 기록했다.
- [x] 링크·앵커 검사와 `git diff --check`를 통과했다.
- [x] 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: [2026-10-29 worklog](worklogs/2026-10-29.md#doc-006-증강을-방해요소로-대체)

## DOC-007 보관·장애·규모 정책과 방해요소 지급 보완

우선순위: P0
상태: 완료
담당: Claude — 사용자 요청 수행
의존성: DOC-006
범위: 2026-10-29 사용자 답변의 정책 항목을 반영한다. 계정 탈퇴·삭제 미제공, 건의 기능 제외, 보관 기간 무제한, 서버 장애 미고려, 시작 직전 이탈의 로그 기준 처리, 동시 접속 10명, 첫 접속 대기 5초, 방해요소 시작 지급과 지속 시간이 대상이다. 게이지·쿨타임 수치는 미정으로 유지한다.
관련 문서: [PRD](PRD.md) / [DATABASE](design/DATABASE.md)·[API](design/API.md)·[OPERATIONS](design/OPERATIONS.md)·[AUTH](design/AUTH.md) / [DEC-011](DECISIONS.md#결정-색인)
Issue·PR: [PR #1](https://github.com/moguab2808-commits/mini-project-1-1/pull/1)

수용 기준:
- [x] PRD에 건의 화면이 없고, 건의는 비목표·향후 확장에만 있으며, 설계 후보의 `suggestions` 테이블과 건의 API가 제거됐다.
- [x] 보관 무제한·탈퇴 미제공·서버 장애 미고려·동시 접속 10명·첫 접속 대기 5초가 비기능 요구사항에 있고, 해당 미정 항목이 제거됐다.
- [x] 시작 직전 이탈의 서버 로그 기준 처리가 게임 규칙에 있다.
- [x] 방해요소가 게임 시작 시에도 지급되고, 벽·끈끈이 5초·기절 3초 지속 시간이 반영됐다.
- [x] 링크·앵커 검사와 `git diff --check`를 통과했다.
- [x] 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: [2026-10-29 worklog](worklogs/2026-10-29.md#doc-007-보관장애규모-정책과-방해요소-지급-보완)

## DOC-008 PRD 보완 의견과 상태 문구 최신화

우선순위: P1
상태: 완료
담당: Claude — 사용자 요청 수행
의존성: DOC-007
범위: PRD 보완 의견과 각 절의 상태 문구를 DEC-006~011 결정에 맞춘다. 새 제품 정책은 결정하지 않는다.
관련 문서: [PRD 보완 의견](PRD.md#prd-보완-의견) / [DEC-006~011](DECISIONS.md#결정-색인)
Issue·PR: [PR #1](https://github.com/moguab2808-commits/mini-project-1-1/pull/1)

수용 기준:
- [x] 보완 의견에 결정으로 해소된 항목과 근거가 구분되고, 남은 항목·가설·지표·수용 기준 예시·결정 순서에 증강·건의 기준 내용이 없다.
- [x] PRD 머리말과 게임·화면 절의 상태 문구가 "이관·충돌 시 미정" 같은 과거 설명이 아닌 현재 결정 기준으로 바뀌었다.
- [x] 링크·앵커 검사와 `git diff --check`를 통과했다.
- [x] 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: [2026-10-29 worklog](worklogs/2026-10-29.md#doc-008-prd-보완-의견과-상태-문구-최신화)

## DOC-009 PRD 미정 항목 위임 결정

우선순위: P0
상태: 완료
담당: Claude — 사용자 요청 수행
의존성: DOC-008
범위: 사용자 위임에 따라 PRD의 미정 제품 항목을 Claude가 결정해 PRD를 다시 쓰고, 영향을 받는 설계 문서의 미정 항목을 갱신한다. 사용자가 미룬 게이지·쿨타임·확률과 물리 수치, 기술 스택은 결정하지 않는다.
관련 문서: [PRD](PRD.md) / [AUTH](design/AUTH.md)·[DATABASE](design/DATABASE.md)·[API](design/API.md)·[GAME](design/GAME.md)·[LOCAL](design/LOCAL.md)·[OPERATIONS](design/OPERATIONS.md) / [DEC-012](DECISIONS.md#결정-색인)
Issue·PR: [PR #1](https://github.com/moguab2808-commits/mini-project-1-1/pull/1)

수용 기준:
- [x] PRD의 남은 미정 항목이 수치("이후 정함")와 에셋 조달만 남고, 나머지는 결정된 요구사항으로 바뀌었다.
- [x] 방해요소 9종마다 분류·효과·지속이 정해지고 지급·보유·사용·공개 범위의 공통 규칙이 있다.
- [x] 결정 내용이 DEC-012에 사용자 위임 결정으로 기록되고, 설계 문서의 관련 미정 항목이 갱신됐다.
- [x] 링크·앵커 검사와 `git diff --check`를 통과했다.
- [x] 사용자가 DEC-012 결정을 검토했다.
- [x] 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: [2026-10-29 worklog](worklogs/2026-10-29.md#doc-009-prd-미정-항목-위임-결정)

## DOC-010 기술 스택과 아키텍처 결정

우선순위: P0
상태: 완료
담당: Claude — 사용자 요청 수행
의존성: DOC-009
범위: 사용자가 승인한 추천안대로 기술 스택과 아키텍처를 ADR로 기록하고, DESIGN과 상세 설계의 "후보" 상태를 승인·초안·미정으로 나눈다. API 이벤트·DB 스키마·상태 전이의 상세 계약은 확정하지 않는다. PR #1 병합에 따라 DOC-001~009의 상태를 갱신한다.
관련 문서: [ADR-0003](adr/0003-tech-stack-and-architecture.md) / [DESIGN](DESIGN.md)·[TECH_STACK](design/TECH_STACK.md)·[GAME](design/GAME.md)·[LOCAL](design/LOCAL.md)·[API](design/API.md)·[AUTH](design/AUTH.md)·[DATABASE](design/DATABASE.md)·[OPERATIONS](design/OPERATIONS.md) / [DEC-013](DECISIONS.md#결정-색인)
Issue·PR: [PR #14](https://github.com/moguab2808-commits/mini-project-1-1/pull/14)

수용 기준:
- [x] ADR-0003에 배경·선택·대안·위험·재검토 조건과 무료 플랜 확인 근거가 있고, DEC-013이 이를 가리킨다.
- [x] DESIGN과 상세 설계의 상태 표가 승인된 범위(DEC-013)와 초안·미정 범위를 구분한다.
- [x] 무료 운영 조건(Render 절전 방지, Neon 유휴 연결)이 운영 설계에 반영됐다.
- [x] DOC-001~009의 병합 항목과 상태가 PR #1 병합에 맞게 갱신됐다.
- [x] 링크·앵커 검사와 `git diff --check`를 통과했다.
- [x] 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: [2026-10-29 worklog](worklogs/2026-10-29.md#doc-010-기술-스택과-아키텍처-결정)

## 설계·준비 작업 배분 (2026-10-29)

개발자 A는 게임·클라이언트, 개발자 B는 서버·데이터·운영을 맡는다. 실제 담당자 이름은 각 작업을 시작할 때 담당 칸에 적는다. GAME-001과 API-001은 상태 전이와 이벤트가 맞물리므로 초안 단계에서 서로 검토한다.

## GAME-001 게임 처리 상세 설계 확정

우선순위: P0
상태: 완료
담당: 개발자 A (Codex)
의존성: DOC-010
범위: 게임 단계·턴·시뮬레이션·종료·이탈의 상태 전이와 경합 처리, 충돌·판 이탈 훅 구조, 떠오름 계산, 초 단위 방해요소 효과와 시뮬레이션 시간의 연결, 피로도·쿨타임·랜덤 발동의 상태 위치, AI 봇 실행 위치를 확정한다. AI 봇 실행 위치는 DEC-021(브라우저)로 정했다. 수치 기본값은 GAME-002에서 다룬다.
관련 문서: [GAME](design/GAME.md) / [게임 규칙](PRD.md#게임-규칙)·[방해요소 규칙](PRD.md#방해요소-규칙) / [ADR-0003](adr/0003-tech-stack-and-architecture.md)
Issue·PR: [#2](https://github.com/moguab2808-commits/mini-project-1-1/issues/2)·[PR #15](https://github.com/moguab2808-commits/mini-project-1-1/pull/15)

수용 기준:
- [x] API-001 담당자가 상태 전이를 검토했다. (개발자 B의 PR #15 검토 의견에 대한 답변을 [DEC-026](DECISIONS.md#결정-색인)으로 반영. B 제안대로 질문 1·3·4·5 답변 후 체크)
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #15, `main` aa179d0)

수용 기준 중 "상태 전이·경합 정의"와 "방해요소 9종 처리 시점·상태 위치·플레이어별 뷰 필드" 2개는 2026-10-30 사용자 결정으로 삭제하고 완료 처리했다.

검증 근거: [2026-10-30 worklog](worklogs/2026-10-30.md#game-001-게임-처리-상세-설계-초안)·[완료 처리](worklogs/2026-10-30.md#game-001-완료-처리)

후속: DEC-014·015·017의 남은 효과 세부와 수치는 [GAME-002](#game-002-물리방해요소-수치-기본값-제안), 이벤트 이름·필드는 [API-001](#api-001-api실시간-이벤트-계약-확정)에서 다룬다. GAME 문서의 미정 표시는 그대로 둔다.

## LOCAL-001 로컬 2인 모드 설계 확정

우선순위: P0
상태: 완료
담당: 개발자 A (Claude)
의존성: DOC-010
범위: `GameSession` 명령·이벤트 시그니처, 한 PC에서 비공개 방해요소를 다루는 방식, 방해요소 사용 입력과 벽·끈끈이 위치 지정, AI 대전의 로컬 처리 여부를 확정한다. 화면 교대·숫자키 안은 DEC-020의 창 2개·E 키 방식으로 대체했다.
관련 문서: [LOCAL](design/LOCAL.md) / [방해요소 규칙](PRD.md#방해요소-규칙)·[AI 대전](PRD.md#ai-대전)
Issue·PR: [#3](https://github.com/moguab2808-commits/mini-project-1-1/issues/3)·[PR #18](https://github.com/moguab2808-commits/mini-project-1-1/pull/18)

수용 기준:
- [x] `GameSession` 명령·이벤트 목록이 API-001 초안과 같은 타입 이름으로 정리됐다. ([LOCAL](design/LOCAL.md#gamesession-시그니처)의 이벤트 7개와 명령 4개, 총 11개 이름이 [API](design/API.md#socketio-이벤트) 이벤트 이름과 같고, `CommandResult`는 API의 ack·오류 형식을 따른다. 개발자 B가 PR #18 검토에서 동의)
- [x] 로컬 모드에서 상대 방해요소를 가리는 방식과 방해요소 입력 방식이 정해졌다. ([DEC-020](DECISIONS.md#결정-색인)·[LOCAL](design/LOCAL.md#상세-계약-초안-local-001))
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #18, `main` 68340b3)

검증 근거: [2026-10-30 worklog](worklogs/2026-10-30.md#local-001-로컬-2인-모드-설계-초안)·[B 검토 반영](worklogs/2026-10-30.md#local-001-개발자-b-검토-반영)

후속: 방해요소 사용 거부 오류 코드는 개발자 B가 API-001에서 추가한 뒤 LOCAL에 연결한다. `game-runtime` 주입 인터페이스는 PLAN-001에서 정한다([DEC-030](DECISIONS.md#결정-색인)).

## GAME-002 물리·방해요소 수치 기본값 제안

우선순위: P1
상태: 완료
담당: 개발자 A (Claude)
의존성: GAME-001
범위: 마찰·반발·최대 발사 속도·떠오름 높이 등 물리 수치와 피로도 게이지·쿨타임·랜덤 발동 확률, 방해요소 효과 크기의 구현 시작용 기본값을 제안한다. 확정은 플레이 테스트 후 결정 기록으로 한다.
관련 문서: [GAME 기술 초기값](design/GAME.md#기술-초기값-조정-대상) / [PRD 미정 사항](PRD.md#7-미정-사항과-변경-관리)
Issue·PR: [#4](https://github.com/moguab2808-commits/mini-project-1-1/issues/4)·[PR #19](https://github.com/moguab2808-commits/mini-project-1-1/pull/19)

수용 기준:
- [x] PRD에서 "이후 정함"으로 표시한 수치마다 기본값과 근거가 GAME에 있다. ([GAME 기술 초기값](design/GAME.md#기술-초기값-조정-대상)의 물리·방해요소 수치·전송·AI 표. 수치 규칙 해석은 [DEC-031](DECISIONS.md#결정-색인))
- [x] 기본값을 바꾸는 절차(플레이 테스트 → DECISIONS)가 명시됐다. ([수치 변경 절차](design/GAME.md#수치-변경-절차))
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #19, `main` 93b9c88)

검증 근거: [2026-10-30 worklog](worklogs/2026-10-30.md#game-002-물리방해요소-수치-기본값-제안)·[완료 처리](worklogs/2026-10-30.md#game-002-완료-처리)

후속: 제안값은 미승인이며 플레이 테스트 후 DEC로 확정한다. 효과와 30초 마감의 관계는 사용자가 "턴 마감과 독립, 라운드 기준"으로 정했다(DEC-031).

## UI-002 디자인 캔버스 현재 요구사항 반영

우선순위: P1
상태: 완료
담당: 개발자 A
의존성: 없음
범위: UI-001 디자인 캔버스를 PRD v0.18 화면 요구사항에 맞춘다. 턴 프로필 하이라이트, 내 프로필 위쪽 방해요소 칸(E 키 표시)·피로도 게이지, 프로필바의 환경설정·로그아웃 버튼(레이팅·랭킹 제거), 로비의 새로고침 버튼·비공개 방 자물쇠·"게임 중" 표시·입장 버튼/더블클릭, 방 생성 창의 PvP/AI 선택·알 5·7·9개·비공개 코드 생성과 복사, 코드 입력·환경설정 플로팅 창, 대기실, 재도전 대기 표시, 로그인 화면의 인증 요청 제한 안내가 대상이다. PRD 화면 미정 사항(비공개 방 목록 입장 시 코드 입력, AI 선택 시 입력 항목)은 시안으로 제안한다.
관련 문서: [화면별 요구사항](PRD.md#화면별-요구사항) / [UI-001](#ui-001-로비인게임-화면-프로토타입)
Issue·PR: [#5](https://github.com/moguab2808-commits/mini-project-1-1/issues/5)·[PR #25](https://github.com/moguab2808-commits/mini-project-1-1/pull/25)

수용 기준:
- [x] 캔버스에서 로그인 → 로비 → 대기실 → 인게임 → 결과 흐름을 눌러 볼 수 있다. (2026-10-30 사용자가 캔버스를 직접 확인하고 통과로 알림)
- [x] 위 화면 요소가 PRD 배치대로 표시되고, PRD와 다른 부분은 worklog에 기록됐다. (사용자 확인, 차이는 worklog의 "PRD와 다른 부분")
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #25, `main` 85d0ec8)

검증 근거: [2026-10-30 worklog](worklogs/2026-10-30.md#ui-002-디자인-캔버스-현재-요구사항-반영)

## ASSET-001 에셋 조달 계획

우선순위: P2
상태: 완료
담당: 개발자 A
의존성: DOC-010
범위: 판·알·동물 캐릭터 6종 3D 모델·방해요소 아이콘·효과음의 출처와 제작 방법, 라이선스 기록 위치(docs/CREDITS.md 여부), 용량 한도를 정한다.
관련 문서: [TECH_STACK 에셋 후보](design/TECH_STACK.md#에셋-조달-계획) / [환경설정 효과음 목록](PRD.md#환경설정)
Issue·PR: [#6](https://github.com/moguab2808-commits/mini-project-1-1/issues/6)·[PR #28](https://github.com/moguab2808-commits/mini-project-1-1/pull/28)

수용 기준:
- [x] 에셋 종류마다 출처 또는 제작 방법과 라이선스 확인일이 정해졌다.
- [x] 출처·라이선스 기록 위치와 텍스처·오디오 용량 한도가 정해졌다.
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다.

1번 해석: 이용 조건 확인일이 "미확인"인 항목(Claude·jsfxr·ChipTone·Jua)은 사용자가 구현 단계(반입 시)로 미뤘고([DEC-033](DECISIONS.md#결정-색인)), 방식이 정해졌으면 충족으로 보았다. 미확인 항목은 TECH_STACK 미정에 남아 있다.

검증 근거: [2026-10-30 worklog](worklogs/2026-10-30.md#asset-001-에셋-조달-계획)

## VAL-001 성능 측정 절차와 플레이 테스트 기록 양식

우선순위: P1
상태: 완료
담당: 개발자 A
의존성: 없음
범위: PRD의 fps 목표(평균 60fps 근접, 하위 5% 30fps 이상) 측정 절차와 성공 기준 판정용 플레이 테스트 기록 양식을 만든다.
관련 문서: [ENGINEERING-VALIDATION](ENGINEERING-VALIDATION.md) / [성공 기준](PRD.md#5-성공-기준)·[비기능 요구사항](PRD.md#4-비기능-요구사항과-제약)
Issue·PR: [#7](https://github.com/moguab2808-commits/mini-project-1-1/issues/7)·[PR #30](https://github.com/moguab2808-commits/mini-project-1-1/pull/30)

수용 기준:
- [x] fps 측정 도구·구간·기록 형식이 정해졌다.
- [x] 성공 기준 5개마다 기록할 항목과 판정식이 있는 양식이 있다.
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: [2026-10-30 worklog](worklogs/2026-10-30.md#val-001-fps-측정-절차와-플레이-테스트-기록-양식)

## VAL-002 개발용 프레임 시간 기록

우선순위: P2
상태: 완료
담당: 개발자 A
의존성: IMPL-004 (게임 화면 구현. 기록 모듈은 화면 없이 먼저 만들었고, 화면 연결은 IMPL-004 이후)
범위: [fps 측정 절차](ENGINEERING-VALIDATION.md#fps-측정-절차-val-001)가 요구하는 판 전체의 프레임 간격(ms) 원자료를 개발 중에만 기록·내보내는 코드를 만든다. VAL-001 완료 때 남긴 후속이다. 기록 모듈(`packages/client/src/dev/frame-recorder.ts`)은 화면 없이 만들 수 있어 먼저 만들었고, 실제 화면에 붙이는 일과 운영 빌드 제외 확인은 게임 화면(IMPL-004)이 있어야 한다.
관련 문서: [ENGINEERING-VALIDATION](ENGINEERING-VALIDATION.md#fps-측정-절차-val-001) / [VAL-001](#val-001-성능-측정-절차와-플레이-테스트-기록-양식)
Issue·PR: [#34](https://github.com/moguab2808-commits/mini-project-1-1/issues/34)·[PR #65](https://github.com/moguab2808-commits/mini-project-1-1/pull/65)

수용 기준:
- [x] 개발 환경에서만 켜지고 운영 빌드에는 영향이 없다. (게임 화면의 `use-frame-recording.ts`가 `import.meta.env.DEV`일 때만 동적 import한다. 운영 빌드 `dist/`에 기록 코드·전역 함수가 없음을 확인했다)
- [x] 판 시작부터 결과 화면 직전까지 프레임 간격을 기록해 평균 fps·프레임 시간 95백분위·100ms 이상 멈춤 횟수를 계산할 수 있다. (실제 브라우저의 `/local` 경기에서 시작부터 기권 결과까지 기록하고 요약·원자료 JSON을 내려받았다. 결과 뒤에는 프레임이 늘지 않는다. 마지막 프레임부터 결과까지의 간격도 원자료에 넣는다)
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #65, 2026-11-03 병합)

검증 근거: [2026-10-31 worklog](worklogs/2026-10-31.md#val-002-개발용-프레임-시간-기록-모듈)·[2026-11-03 worklog](worklogs/2026-11-03.md#val-002-게임-화면-연결-확인과-운영-빌드-제외)

## API-001 API·실시간 이벤트 계약 확정

우선순위: P0
상태: 완료
담당: 개발자 B
의존성: GAME-001
범위: REST 경로와 Socket.IO 이벤트 이름·방향·필드·오류 형식, 이벤트 순서와 재전송·중복 처리, 플레이어별 공개 필드를 확정하고 `shared`의 Zod 스키마로 옮길 수 있게 정리한다. 이미 정한 것: AI 대전은 서버 이벤트가 없다(`ai:start` 삭제, DEC-021). 랭킹·최근 경기 조회 API는 없다(DEC-022). 방 목록은 로비 진입·새로고침 때 `GET /api/rooms`로 조회하고 구독 이벤트를 두지 않는다(DEC-024). 중복·재전송은 `commandId` 없이 발사는 gameId·turnId, 방해요소는 gameId·hazardInstanceId로 거르고 결과는 ack로 반환한다(DEC-026). 이 작업에서 정하는 것: 실시간 `game:state`가 대체하는 `sim:result` 삭제, 방 이벤트와 방 목록 응답의 필드, REST·ack 공통 오류 코드 목록, 이벤트 순서.
관련 문서: [API](design/API.md) / [GAME](design/GAME.md)·[AUTH](design/AUTH.md) / [DEC-021·022·024·026](DECISIONS.md#결정-색인)
Issue·PR: [#8](https://github.com/moguab2808-commits/mini-project-1-1/issues/8)·[PR #22](https://github.com/moguab2808-commits/mini-project-1-1/pull/22)

수용 기준:
- [x] API 초안의 모든 경로·이벤트에 요청·응답·오류 필드가 정의됐고, 삭제한 `ai:start`·`lobby:*`·`sim:result`·랭킹·최근 경기가 API에 없다. ([API](design/API.md#rest-api)의 REST 8개 표, [방 이벤트](design/API.md#방-이벤트-필드)·[경기 이벤트](design/API.md#경기-이벤트-필드) 필드 표. 삭제 대상은 "없다"는 설명으로만 남음)
- [x] 방 이벤트(`room:create`·`room:join`·`room:quickJoin`·`room:leave`·`room:start`)의 필드와 방 입장 오류(`INVALID_CODE`·`ROOM_FULL`·`ROOM_PLAYING`·`ROOM_NOT_FOUND`)가 정의되고, `GET /api/rooms` 응답에 비공개 방의 코드가 없다. (방 생성 거부 `CODE_TAKEN`·`ALREADY_IN_ROOM`, `room:start` 거부 `NOT_IN_ROOM`·`NOT_HOST`·`ROOM_NOT_READY` 추가. 이후 DEC-040으로 `room:start`·`ROOM_FULL`·`NOT_IN_ROOM`·`NOT_HOST`·`ROOM_NOT_READY` 삭제)
- [x] 인증 오류와 방·발사 오류가 REST·ack 공통의 오류 코드 목록 한 곳으로 합쳐졌고 AUTH-001과 일치한다. ([API 오류 코드 표](design/API.md#오류-형식과-코드) 한 곳에 인증·방·발사·방해요소 코드가 있고, [AUTH](design/AUTH.md#오류-형식)가 이 표를 참조하며 인증 코드 5종이 같음을 대조)
- [x] 이벤트 순서(방 생성 → 시작 → 턴 → 종료 → 재도전)가 순서도로 있다. ([API 이벤트 순서](design/API.md#이벤트-순서)의 sequenceDiagram과 순서 규칙 7개)
- [x] 상대에게 전송되는 이벤트에 상대 보유 방해요소 정보가 없음을 필드 단위로 확인했다. ([API 상대 비공개 필드 점검](design/API.md#상대-비공개-필드-점검). 계약 문서의 필드 목록 대조이며 구현 후 `getViewFor` 테스트로 다시 검증)
- [x] GAME-001 담당자가 이벤트 순서를 검토했다. (개발자 A가 [PR #22](https://github.com/moguab2808-commits/mini-project-1-1/pull/22) 리뷰에서 순서·교체 지급 순서를 GAME과 대조해 모순 없음을 확인하고, 사용자에게도 검토 완료를 전달)
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #22, `main` d39ce7d)

검증 근거: [2026-10-30 worklog](worklogs/2026-10-30.md#api-001-방해요소-거부-오류-코드-반영)·[필드·순서 확정안](worklogs/2026-10-30.md#api-001-필드순서도비공개-점검-추가)

후속: 새 오류 코드·식별자 이름 확인과 본인 private 뷰의 게이지·쿨타임 필드 이름은 [API-002](#api-002-api-이름식별자-확인과-private-뷰-필드-확정)에서 다룬다. `Seat` 값의 `…Id` 이름은 PLAN-001 묶음 2(`game-core`·`shared`)에서 스키마를 만들 때 정한다.

## API-002 API 이름·식별자 확인과 private 뷰 필드 확정

우선순위: P1
상태: 완료
담당: 개발자 A
의존성: API-001
범위: API-001 완료 때 남긴 후속이다. 개발자 B가 정하고 A가 확인하지 않은 이름을 확인하고, 본인 private 뷰의 게이지·쿨타임 필드 이름을 A가 GAME에서 정한 뒤 API에 반영한다. 새 제품 정책을 정하지 않는다.
관련 문서: [API](design/API.md) / [GAME](design/GAME.md#상태-위치와-플레이어별-뷰)·[LOCAL](design/LOCAL.md) / [API-001](#api-001-api실시간-이벤트-계약-확정)
Issue·PR: [PR #33](https://github.com/moguab2808-commits/mini-project-1-1/pull/33)

수용 기준:
- [x] 새 오류 코드 9종(`ALREADY_IN_ROOM`·`NOT_IN_ROOM`·`NOT_HOST`·`ROOM_NOT_READY`·`GAME_NOT_ACTIVE`·`NOT_YOUR_TURN`·`INVALID_STONE`·`PLAYER_STUNNED`·`REMATCH_NOT_AVAILABLE`)과 `HAZARD_*` 4종, `HazardKind`·`CharacterId`·`BoardId` 식별자, `game:over.reason` 값을 A가 확인하고 바꿀 이름이 있으면 API·LOCAL·GAME에 반영됐다. (바꿀 이름 없음. 이름·값이 API·GAME·LOCAL·OPERATIONS·PRD와 일치함을 worklog에 대조)
- [x] 본인 private 뷰의 게이지·쿨타임·사용 가능 여부 필드 이름이 GAME에 정해지고 API의 `GameView.private`에 반영됐다. ([GAME](design/GAME.md#상태-위치와-플레이어별-뷰)의 `fatigueGauge`·`overheated`·`cooldownEndsAtMs`·`usable`, [API](design/API.md#경기-이벤트-필드)의 `GameView.private`)
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #33, `main` a1fa237)

검증 근거: [2026-10-31 worklog](worklogs/2026-10-31.md#api-002-이름식별자-확인과-private-뷰-필드-확정)

## DB-001 DB 스키마 확정

우선순위: P0
상태: 완료
담당: 개발자 B
의존성: DOC-010
범위: users·rooms·세션 테이블의 컬럼·제약·인덱스를 확정한다. 닉네임 정규화 유니크, 캐릭터, 전적(판수·승·패) 1회 갱신, 방 정보와 상태 전이, 서버 재시작 후 남은 방 정리가 대상이다. 랭킹·레이팅·matches는 DEC-022로 제외했다. users는 닉네임(로그인 식별자)·비밀번호 해시·캐릭터·전체 게임 수·승·패만 저장하고 가입 시각·로그인 실패 컬럼을 두지 않는다(DEC-027). rooms는 제목·방장·참여자·공개 여부·비공개 코드·알 개수·판·상태(대기 중/게임 중)를 담는다(DEC-023·027). AI 대전은 어떤 정보도 저장하지 않는다(DEC-021).
관련 문서: [DATABASE](design/DATABASE.md) / [회원등록](PRD.md#회원등록)·[전적](PRD.md#전적) / [DEC-022·023·027](DECISIONS.md#결정-색인)
Issue·PR: [#9](https://github.com/moguab2808-commits/mini-project-1-1/issues/9)·[PR #23](https://github.com/moguab2808-commits/mini-project-1-1/pull/23)

수용 기준:
- [x] DATABASE의 초안 표시가 확정 스키마로 바뀌고 Drizzle 스키마로 옮길 수 있는 수준의 타입·제약이 있으며, `matches`·레이팅·랭킹·로그인 실패 컬럼이 없음이 명시됐다. ([DATABASE](design/DATABASE.md#users)의 `users`·`rooms` 타입·제약·`CHECK`·FK `ON DELETE`, [sessions](design/DATABASE.md#sessions) 스키마 방침, 31행의 제외 컬럼 명시. 이전의 `[제안]` 표시는 개발자 B가 확정해 제거)
- [x] `rooms`의 컬럼·FK·유니크·공개/비공개 제약, 입장 시 동시성 처리, 방 삭제 시점, 서버 시작 시 정리가 정의됐다. ([방 생명주기](design/DATABASE.md#방-생명주기)의 삭제 시점·서버 시작 정리·입장 조건부 갱신, 한 사람 한 방 제약)
- [x] 경기 종료 트랜잭션의 순서와 잠금, 중복 저장 방지 방법이 정해졌다. ([경기 종료 저장](design/DATABASE.md#경기-종료-저장)의 `id` 오름차순 `FOR UPDATE`, `finishOnce` 메모리 플래그)
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #23. 개발자 A 검토 반영 후 병합하는 PR이며, 병합 전에 체크했다)

검증 근거: [2026-10-30 worklog](worklogs/2026-10-30.md#db-001-스키마-보완과-api-001-완료-처리)

후속: 세션 테이블 컬럼·인덱스는 구현 때 connect-pg-simple 공식 문서의 기본 스키마와 대조하고, 마이그레이션 SQL의 `lower(nickname)` 유니크 인덱스와 `23505` 제약 이름 구분도 구현 때 확인한다.

## AUTH-001 인증 상세 설계 확정

우선순위: P0
상태: 완료
담당: 개발자 B
의존성: DOC-010
범위: 세션 만료, argon2id 파라미터, IP당 `/api/auth/*` 분당 20회 제한(DEC-025)의 저장·응답 형식, 그 밖의 요청 빈도 제한, Render 프록시 신뢰 설정, Socket.IO 연결 인증·중복 접속 처리, 인증 오류 형식을 확정한다. 세션은 브라우저 종료 시 만료하고 서버 기본 만료를 병행하며, 비밀번호를 바꾸면 다른 세션을 모두 끝낸다(DEC-028). 방해요소·턴·알 소유권 검증 경계는 GAME-001 확정 후 정했다.
관련 문서: [AUTH](design/AUTH.md) / [로그인](PRD.md#로그인)·[연결 끊김](PRD.md#연결-끊김과-중복-접속) / [DEC-025·028](DECISIONS.md#결정-색인)
Issue·PR: [#10](https://github.com/moguab2808-commits/mini-project-1-1/issues/10)·[PR #24](https://github.com/moguab2808-commits/mini-project-1-1/pull/24)

수용 기준:
- [x] AUTH의 세부 미정 항목이 모두 값이나 방식으로 정해졌다. ([AUTH](design/AUTH.md)의 `[제안]` 표시를 확정하고 [검증 경계](design/AUTH.md#검증-경계)·`room:join` 한도(연결당 분당 30회)를 정했다. 해시 시간 측정과 connect-pg-simple 기본값 확인은 구현 때 한다)
- [x] 로그인 연속 실패 제한이 없고 요청 빈도 제한의 한도·응답 형식이 API-001의 오류 코드와 일치한다. ([AUTH 빈도 제한](design/AUTH.md#인증-요청-빈도-제한)의 IP당 분당 20회·`429 RATE_LIMITED`가 [API 오류 코드](design/API.md#오류-형식과-코드)·REST 표의 `RATE_LIMITED` 429와 같다)
- [x] 중복 접속 시 기존 연결 종료와 기권 처리 흐름이 API-001과 일치한다. ([AUTH 중복 접속](design/AUTH.md#socketio-인증중복-접속)의 `session:replaced`·방 큐 기권 명령이 [API `session:replaced`](design/API.md#경기-이벤트-필드)(`new_connection`·`password_changed`)·`game:over.reason: forfeit`·[GAME](design/GAME.md#명령-경합과-시간)과 같다)
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #24. 개발자 A 검토를 반영했고, 병합 전에 체크했다)

검증 근거: [2026-10-30 worklog](worklogs/2026-10-30.md#auth-001-미충족-수용-기준-보완)

## OPS-001 운영 설계 확정

우선순위: P1
상태: 완료
담당: 개발자 B
의존성: DOC-010
범위: 외부 헬스체크 서비스 선정과 Render 이용 조건 재확인, SPA fallback, 배포·롤백, 이탈 판정용 서버 로그 항목, 사용량(Render 시간·Neon CU-hour) 확인 방법, 백업·복구 절차를 정한다. 헬스체크는 UptimeRobot 5분 간격, 배포는 자동 배포를 끄고 Render 대시보드에서 수동으로 하며, 백업은 Neon 기본 복구만 쓴다(DEC-029). 방 상태를 DB에서 관리해 늘 수 있는 Neon 사용량과 실시간 상태 전송의 서버 부하 측정 항목도 함께 정한다.
관련 문서: [OPERATIONS](design/OPERATIONS.md) / [ADR-0003](adr/0003-tech-stack-and-architecture.md) / [DEC-029](DECISIONS.md#결정-색인)
Issue·PR: [#11](https://github.com/moguab2808-commits/mini-project-1-1/issues/11)·[PR #26](https://github.com/moguab2808-commits/mini-project-1-1/pull/26)

수용 기준:
- [x] OPERATIONS의 미정 사항이 모두 방식으로 정해지고 무료 조건 재확인 날짜가 기록됐다. ([무료 조건 재확인](design/OPERATIONS.md#무료-조건-재확인-2026-10-30) 2026-10-30. `[제안]` 표시를 확정하고 `rooms` 정리·음량 저장·민감정보 제거·부하 측정 항목을 정했다. 지속 요청 사용 여부는 DEC-029대로 구현 단계 판단이며 운영 방식은 정해 두었다)
- [x] 동시 이탈·시작 직전 이탈 판정에 쓸 로그 항목이 GAME-001의 로그 필드와 맞춰 정해졌다. ([서버 로그](design/OPERATIONS.md#서버-로그)의 필드가 [GAME 명령 경합](design/GAME.md#명령-경합과-시간)과 같고, `start_commit`·`leave`의 `ingressSeq` 비교로 판정한다)
- [x] Neon 기본 복구의 가능 기간과 한계(보관 무제한 정책과의 차이), 수동 배포·롤백 방법이 공식 문서로 확인되어 기록됐다. ([백업·복구](design/OPERATIONS.md#백업복구) 6시간·1 GB 상한, [배포·롤백](design/OPERATIONS.md#배포롤백) Render 공식 문서 2026-10-30)
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #26. 개발자 A 검토를 반영했고, 병합 전에 체크했다)

검증 근거: [2026-10-30 worklog](worklogs/2026-10-30.md#ops-001-미충족-수용-기준-보완)

## PLAN-001 구현 작업 등록

우선순위: P0
상태: 완료
담당: 개발자 B
의존성: GAME-001, LOCAL-001, API-001, DB-001, AUTH-001
범위: 확정된 설계를 바탕으로 구현 작업을 기능 ID와 정상·오류·예외 수용 기준으로 TASKS에 등록하고 A·B에 배분한다. 로컬 2인 모드 작업을 먼저 둔다. 공통 실행 모듈 `game-runtime`과 로컬·AI 워커 연결을 별도 작업으로 나눈다([DEC-030](DECISIONS.md#결정-색인)). 담당은 2026-10-31에 [DEC-035](DECISIONS.md#결정-색인)로 재분배했다(둘 다 A). 모노레포 도구는 [ADR-0003](adr/0003-tech-stack-and-architecture.md)의 npm workspaces로 정해져 있어 별도 결정이 필요 없고, `game-runtime`을 패키지에 추가한다. 선행 설계(API-001·DB-001·AUTH-001·OPS-001)가 모두 완료돼 아래 작업 분해의 13묶음을 IMPL-001~013으로 등록했다. Issue는 착수할 때 하나씩 만든다.
관련 문서: [PRD 수용 기준 작성 예시](PRD.md#수용-기준-작성-예시) / [DESIGN](DESIGN.md) / [LOCAL 패키지 구성](design/LOCAL.md#패키지-구성-승인)·[GAME 구현 경계](design/GAME.md#구현-경계-ab) / [DEC-030](DECISIONS.md#결정-색인)
Issue·PR: [#12](https://github.com/moguab2808-commits/mini-project-1-1/issues/12)·[PR #32](https://github.com/moguab2808-commits/mini-project-1-1/pull/32)

작업 분해: 담당은 개발자 A가 PR #32에서 수락했다. 순서는 위에서 아래이며 선행 설계는 TASKS의 해당 작업을 가리킨다. 묶음 N은 [IMPL-00N](#impl-001-프로젝트-골격)(N은 세 자리로 0을 채움)로 등록했다.

| 묶음 | 내용 | 담당 | 선행 설계 |
| --- | --- | --- | --- |
| 1. 프로젝트 골격 | npm workspaces 5개 패키지(`client`·`server`·`shared`·`game-core`·`game-runtime`), 테스트·빌드·기본 린트 스크립트. 패키지 의존 경계 린트와 `.env.example`은 IMPL-014(B)로 분리 | A | DOC-010 |
| 2. `game-core` | 규칙·물리·상태 머신·`getViewFor` | A | GAME-001, GAME-002(수치 기본값) |
| 3. `game-runtime` | 명령 큐·고정 틱 스케줄러·뷰 배포, 시계·전송·로거·종료 콜백 주입 | A | GAME-001, LOCAL-001, 묶음 2 |
| 4. 로컬 2인 모드 | `LocalGameSession`, SharedWorker 연결, 3D 화면, 방해요소 입력 | A | LOCAL-001, UI-002, ASSET-001 |
| 5. AI 대전 | `AiGameSession`, AI 컨트롤러 | A | LOCAL-001 |
| 6. DB·마이그레이션 | Drizzle 스키마(users·rooms·세션), 마이그레이션, 연결 풀 | B | DB-001 |
| 7. 인증 | 가입·로그인·세션·요청 빈도 제한·비밀번호·캐릭터 변경 | B | AUTH-001, API-001 |
| 8. 로비·방 (서버) | 방 목록 조회, 방 이벤트, `rooms` 상태 갱신 | B | API-001, DB-001 |
| 9. 온라인 대전 (서버) | 서버 전송 연결, 이탈·중복 접속 처리 | B | API-001, 묶음 3 |
| 10. 온라인 대전 (클라이언트) | `RemoteGameSession`·`RoomClient` | A | API-001, 묶음 3 |
| 11. 경기 종료 전적 | `finishOnce`, 전적 갱신 트랜잭션 | B | DB-001, 묶음 3 |
| 12. 계정·로비·대기실·결과 화면 | 로그인·가입·로비·방 목록·방 생성·대기실·결과 화면 (PRD 화면 요구사항 구현. 방 관련 화면은 여기에 포함) | B | UI-002, API-001 |
| 13. 배포 | Render·Neon 설정, 헬스체크, 로그, 수동 배포·롤백 | B | OPS-001 |

의존성 순서는 골격 → `game-core`·`game-runtime` → 로컬 2인 모드·AI 대전 → 온라인 대전(서버·클라이언트) → 전적 → 배포이다. DB·인증·로비·방(서버)·계정 화면 줄(B)은 골격 이후 게임 줄(A)과 병행하며, 온라인 대전(서버, IMPL-009)에서 `game-runtime`(A)과 합류한다. 각 묶음의 정상·오류·예외 수용 기준은 별도 작업으로 등록할 때 PRD 수용 기준 예시(`ROOM-JOIN`·`HAZARD-GRANT`·`HAZARD-USE`·`TURN-TIMEOUT`·`LEAVE-FORFEIT`)에 맞춰 쓴다.

수용 기준:
- [x] 로컬 2인 모드부터 온라인 배포까지의 구현 작업이 의존성 순서로 등록됐다. (IMPL-001~013. [작업 목록](#작업-목록)의 순서가 의존성 순서이며 로컬 2인 모드(IMPL-004)가 온라인(IMPL-008~)보다 앞이다)
- [x] 각 작업에 검증 가능한 수용 기준과 담당이 있다. (IMPL-001~013 각 절에 정상·오류·예외 기준과 담당. A 몫 5건은 개발자 A가 PR #32에서 수락했다)
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #32. 개발자 A 검토를 반영하며, 병합 전에 체크했다. PR #20은 앞서 병합된 분해 초안 PR이다)

검증 근거: [2026-10-30 worklog](worklogs/2026-10-30.md#plan-001-구현-작업-등록-작업-분해-초안)·[구현 작업 등록](worklogs/2026-10-30.md#plan-001-구현-작업-13건-등록)

재분배(2026-10-31, [DEC-035](DECISIONS.md#결정-색인)): 두 개발자가 의존성을 줄이려고 IMPL-001을 A로 옮기며 둘로 나누고(경계 린트·`.env.example`은 B의 IMPL-014), `game-runtime`(IMPL-003)을 A로, 계정·로비·대기실·결과 화면(IMPL-012)을 B로 옮겼다. 그 결과 A는 게임 줄(001→002→003→004→005→010·VAL-002), B는 서버·계정 줄(014·006→007→008→012→009→011→013)을 맡는다.

결정: 개발자 A가 PR #32 재검토에서 A 몫 5건(IMPL-002·004·005·010·012)을 수락하고 B 몫 8건의 분량·우선순위·의존 순서에 동의했다. VAL-002의 "게임 화면 구현"은 IMPL-004로 본다(2026-10-31에 VAL-002 의존성에 연결했다). 각 IMPL의 수용 기준은 착수 전에 해당 PRD 절과 대조해 보완할 수 있다.

## IMPL-001 프로젝트 골격

우선순위: P0
상태: 완료
담당: 개발자 A (2026-10-31 [DEC-035](DECISIONS.md#결정-색인)로 B에서 변경)
의존성: DOC-010
범위: npm workspaces 5개 패키지(`client`·`server`·`shared`·`game-core`·`game-runtime`)와 공통 TypeScript·빌드·테스트·기본 린트 구성을 만든다. 라이브러리 버전은 이때 고정하고 lock 파일로 관리한다. 다른 작업을 막지 않는 패키지 의존 경계 린트와 `.env.example`은 [IMPL-014](#impl-014-패키지-의존-경계-린트와-envexample)로 분리했다.
관련 문서: [TECH_STACK](design/TECH_STACK.md#채택한-기술) / [LOCAL 패키지 구성](design/LOCAL.md#패키지-구성-승인) / [ADR-0003](adr/0003-tech-stack-and-architecture.md)·[DEC-030](DECISIONS.md#결정-색인)
Issue·PR: [#35](https://github.com/moguab2808-commits/mini-project-1-1/issues/35)·[PR #51](https://github.com/moguab2808-commits/mini-project-1-1/pull/51)

수용 기준:
- [x] (정상) 클론 직후 루트에서 설치·빌드·테스트·린트 명령이 오류 없이 끝난다. 실행한 명령과 결과를 worklog에 적는다.
- [x] (오류) 한 패키지의 TypeScript 오류나 실패하는 테스트가 루트 빌드·테스트 명령을 실패로 만든다. 위반 예시로 실패를 확인한다.
- [x] (예외) 패키지 간 참조가 workspaces 이름으로 해석되고, 라이브러리 버전이 고정돼 lock 파일이 저장소에 있다.
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #51, `main` 07675c5)

검증 근거: [2026-10-31 worklog](worklogs/2026-10-31.md#impl-001-프로젝트-골격)·[완료 처리](worklogs/2026-10-31.md#impl-001-완료-처리)

## IMPL-014 패키지 의존 경계 린트와 `.env.example`

우선순위: P1
상태: 완료
담당: 개발자 B
의존성: IMPL-001
범위: IMPL-001에서 분리한 작업이다. 패키지 의존 경계 린트(`client`↔`server` 상호 의존 금지, `game-core`의 네트워크·DB·DOM 참조 금지)와 `.env.example`을 만든다.
관련 문서: [TECH_STACK](design/TECH_STACK.md#채택한-기술) / [LOCAL 패키지 구성](design/LOCAL.md#패키지-구성-승인) / [DEC-035](DECISIONS.md#결정-색인)
Issue·PR: [#49](https://github.com/moguab2808-commits/mini-project-1-1/issues/49)

수용 기준:
- [x] (오류) 패키지 의존 경계 린트가 `client`↔`server` 상호 의존과 `game-core`의 네트워크·DB·DOM 참조를 실패로 잡는다. 위반 예시로 실패를 확인한다.
- [x] (정상) 경계를 지킨 현재 코드는 린트를 통과한다.
- [x] (예외) `.env.example`에는 변수 이름(`DATABASE_URL`·`SESSION_SECRET`·`PORT`·`NODE_ENV`)만 있고 값·비밀정보가 없다.
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: [2026-11-03 worklog IMPL-014 절](worklogs/2026-11-03.md#impl-014-패키지-의존-경계-린트와-envexample)

## IMPL-002 `game-core`

우선순위: P0
상태: 완료
담당: 개발자 A
의존성: GAME-001, GAME-002, IMPL-001
범위: 규칙·물리·상태 머신·방해요소 훅·시드 PRNG·`getViewFor`를 순수 TypeScript로 구현한다. 시간·명령·난수는 외부에서 주입받는다. 입력·출력 시그니처는 IMPL-003(같은 담당)과 서버 쪽 소비자인 IMPL-009(B)가 쓰므로 IMPL-003 완료 전에 공개한다. `shared`의 Zod 스키마·`Seat` 값의 `…Id` 이름도 여기서 정한다.
관련 문서: [GAME](design/GAME.md#상세-계약-초안-game-001)·[기술 초기값](design/GAME.md#기술-초기값-조정-대상) / [게임 규칙](PRD.md#게임-규칙)·[방해요소 규칙](PRD.md#방해요소-규칙) / [API 공통 타입](design/API.md#공통-타입)
Issue·PR: [#36](https://github.com/moguab2808-commits/mini-project-1-1/issues/36)·[PR #53](https://github.com/moguab2808-commits/mini-project-1-1/pull/53)

수용 기준:
- [x] (정상, `HAZARD-GRANT`) 게임 시작과 3·5·7·9라운드 시작에 각 플레이어의 보유 방해요소 1개가 새 것으로 교체되고 누적되지 않는다. 단위 테스트가 확인한다.
- [x] (정상, `TURN-TIMEOUT`) 주입한 시간으로 30초가 지나면 턴이 넘어가고, 같은 사용자의 연속 시간초과 3회에 기권패 결과가 나온다. 정확히 마감 시각의 발사는 시간초과가 우선이다.
- [x] (정상, 판정) 모든 알이 멈춘 뒤 승패를 판정하고, 동시 제거는 무승부이며 최종 라운드는 남은 알 수로 비교한다. 판 이탈·떠오름 착지 판정이 기술 초기값의 허용 오차 안에서 같은 입력에 같은 결과를 낸다(시드 고정).
- [x] (오류) 거부된 명령은 상태와 난수를 바꾸지 않고 [API 오류 코드](design/API.md#오류-형식과-코드)의 해당 코드를 돌려준다. 발사·방해요소의 검사 순서는 [AUTH 검증 경계](design/AUTH.md#검증-경계)와 같다.
- [x] (예외, 비공개) `getViewFor`가 만든 뷰에 상대 보유 방해요소·게이지·쿨타임·시드·`users.id`가 없다. 허용 목록 방식 테스트가 [API 비공개 점검표](design/API.md#상대-비공개-필드-점검)의 필드와 일치한다.
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #53, `main` 16b757c)

검증 근거: [2026-11-01 worklog](worklogs/2026-11-01.md#impl-002-game-core). 5개 기준은 단위 테스트로 확인했고 PR #53으로 병합했다. 구현자가 고른 해석은 worklog의 "사용자 확인 필요" 절에 있으며 승인된 결정이 아니다.

## IMPL-003 `game-runtime`

우선순위: P0
상태: 완료
담당: 개발자 A (2026-10-31 [DEC-035](DECISIONS.md#결정-색인)로 B에서 변경)
의존성: GAME-001, LOCAL-001, IMPL-001, IMPL-002
범위: 방별 단일 명령 큐(`ingressSeq`·`observedAtMs` 부여), 단조 시계 고정 틱 스케줄러, 플레이어별 뷰 배포를 구현하고 시계·전송·로거·종료 콜백을 주입받게 한다. 주입 인터페이스의 형태를 이 작업에서 정한다([DEC-030](DECISIONS.md#결정-색인)). 서버가 이 인터페이스에 Socket.IO 전송·서버 시계를 주입하므로(IMPL-009, B) 형태를 확정하기 전에 B와 합의하고 결과를 이 절에 남긴다.
관련 문서: [GAME 명령 경합과 시간](design/GAME.md#명령-경합과-시간)·[구현 경계](design/GAME.md#구현-경계-ab)·[전송과 표시](design/GAME.md#전송과-표시-초안) / [LOCAL](design/LOCAL.md#로컬온라인-모드-경계-승인)
Issue·PR: [#37](https://github.com/moguab2808-commits/mini-project-1-1/issues/37)·[PR #57](https://github.com/moguab2808-commits/mini-project-1-1/pull/57)

수용 기준:
- [x] (정상) 가짜 시계·가짜 전송을 주입해 틱 진행, 같은 틱 명령의 `ingressSeq` 순서 처리, 플레이어별 뷰 전송이 테스트로 확인된다. 서버·워커가 같은 코드를 쓰며 시계·전송만 다르다.
- [x] (정상) 알 이동 중 스냅샷은 volatile, 모든 알 정지 뒤 최종 스냅샷·`turn:change`·`hazard:triggered`·`game:over`는 신뢰 전송으로 나간다. `revision`이 오래된 상태를 만들지 않는다.
- [x] (오류) 틱이 지연되면 따라잡기 상한까지만 처리하고 넘긴 시간을 `tick_skipped`로 로거에 남긴다. 거부된 명령은 큐 순서만 소비하고 상태를 바꾸지 않는다.
- [x] (예외, `LEAVE-FORFEIT` 기반) 이탈·기권·접속 대체가 같은 큐의 기권 명령으로 처리되고, 동시 이탈은 `ingressSeq`가 작은 쪽을 기권패로 한다. 시작 커밋보다 앞선 이탈은 대기실 처리다.
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #57, `main` 5945490)

검증 근거: [2026-11-02 worklog](worklogs/2026-11-02.md#impl-003-game-runtime). 4개 기준은 가짜 시계·전송 단위 테스트로 확인했다.

인터페이스 합의 결과(2026-11-02, 개발자 A·B, [PR #57](https://github.com/moguab2808-commits/mini-project-1-1/pull/57)): 시그니처는 `packages/game-runtime/src/types.ts`가 기준이다. 책임 분담은 다음과 같다.
- 서버(B, IMPL-009): `RuntimeClock.now()`는 `Math.round(performance.timeOrigin + performance.now())`처럼 epoch에 맞춘 단조 시각, 타이머는 `setTimeout`으로 감싼다. `RuntimeTransport`는 좌석↔`users.id`↔소켓 매핑을 시작 커밋 때 메모리에 만들고 `volatile`은 `socket.volatile.emit`에 연결한다. `ts`·`roomId`·`userId`는 서버 로거가 덧붙인다. `onFinished`에서 `finishOnce`를 비동기로 부르고 오류는 서버가 자체 catch로 로그에 남기며 전적 반영을 포기한다(재시도 없음). `onError`는 오류 이름·메시지만 서버 로그로 보낸다. 사용자→좌석 변환, `gameId`·`seed` 생성(crypto 난수)과 시작 커밋 시점, `rematch:*` 성립 로직도 서버가 맡는다.
- 런타임(A): `LeaveReason`은 `disconnect`·`leave_button`·`session_replaced`(로그 `leave`의 `reason`과 같은 이름)다. 비밀번호 변경으로 끊긴 연결은 `session_replaced`, 연결 끊김·로그아웃은 `disconnect`, `room:leave`는 `leave_button`으로 넘긴다. `start_commit`과 `leave`는 같은 `ingressSeq` 순번 공간을 쓰고, 경기 없는 `leave`는 `gameId`가 null이다. `forfeit` 로그의 `reason`은 `leave`·`command`·`timeout`이다. 런타임은 `onFinished` 반환값을 기다리지 않고 `game:over`의 재도전 마감 시각만 채운다.
- 미정(IMPL-009에서 정함): 거부된 발사의 `shot` 기록 방식, `leave`·`forfeit` 이중 기록 정리.
- 이 합의는 두 담당자의 PR 코멘트 대화에 근거한다.

## IMPL-004 로컬 2인 모드

우선순위: P0
상태: 완료
담당: 개발자 A
의존성: LOCAL-001, UI-002, IMPL-002, IMPL-003, ASSET-001
범위: `LocalGameSession`, SharedWorker 로컬 권한 측(`game-runtime` + `game-core`), 개발용 `/local` 경로(창 2개, `seat` 0·1), 3D 인게임 화면, 방해요소 입력(E 키·벽·끈끈이 배치)을 구현한다. 2026-11-02에 기준 시안의 연출·조작(자유 시점, 기본 판 돌리기, 손 닿는 거리, 캐릭터 팔·표정·몸짓과 상대 중계, 후레쉬·물총 손 조준, 방해요소 강화)을 범위에 더했다([DEC-036](DECISIONS.md#결정-색인)). 서버·DB·로그인은 쓰지 않는다.
관련 문서: [LOCAL](design/LOCAL.md#상세-계약-초안-local-001) / [게임 화면](PRD.md#게임-화면)·[조준·발사 조작](PRD.md#조준발사-조작)·[방해요소 규칙](PRD.md#방해요소-규칙) / [DEC-020·036](DECISIONS.md#결정-색인)
Issue·PR: [#38](https://github.com/moguab2808-commits/mini-project-1-1/issues/38)

수용 기준:
- [x] (정상, `HAZARD-USE`) 두 창이 모두 연결되면 경기가 시작되고, 사용 제한을 충족한 방해요소를 쓰면 양쪽 화면에 발동 안내가 표시되고 효과가 적용된다. 알이 움직이는 중에도 쓸 수 있다.
- [x] (정상, `HAZARD-GRANT` 비공개) 받은 방해요소는 본인 창의 방해요소 칸에만 표시되고 상대 창·상대 창이 받는 메시지에는 없다.
- [x] (오류) 쿨타임·과열·잘못된 위치(빨간 후보)의 사용은 거부되고 사용 횟수·게이지·쿨타임이 바뀌지 않는다. 같은 좌석의 두 번째 연결은 거부된다.
- [x] (예외) 창을 닫거나 새로고침하면 그 좌석이 기권패이고, `SharedWorker` 미지원 브라우저에서는 `/local`이 미지원 안내를 표시한다.
- [x] (정상, 시안 연출) 기본 시점은 캐릭터 눈높이보다 조금 높고, 알을 조준·발사하는 동안만 1인칭이 된다. 오른쪽 드래그로 둘러보고 놓으면 기본 시점으로 돌아온다([DEC-038](DECISIONS.md#결정-색인)). 판·의자·책상·캐릭터가 3D이며, 조준·튕기기·판 돌리기·방해요소 들기의 팔·몸 움직임과 결과별 표정·몸짓이 양쪽 창에 보인다.
- [x] (정상, 판 돌리기·거리) 내 턴 조준 단계에서 A·D·←·→·버튼으로 판을 돌리면 양쪽 창의 판·알·설치물이 함께 돈다. 손이 닿지 않는 알은 발사가 거부되고(`OUT_OF_REACH`) 판을 돌려 가까이 오면 칠 수 있다. 먼 알일수록 화면·조준이 흔들린다. 상대 턴·알 이동 중·기절 중 돌리기는 거부된다.
- [x] (정상, 방해요소 강화) 후레쉬·물총은 손에 들고 조준·클릭해 발동하고, E를 누르는 동안 발동 영역이 상대 얼굴에 머물면 상대 화면 가림이 점점 커진다(후레쉬 최대 70%, 물총은 화면 전체 반투명 물막). 바람은 보유 중 상시 조준 방향을 끌고 화면을 흔들며, 기절은 머리 위 별과 기절한 쪽 화면 회전을 보인다([DEC-037~039](DECISIONS.md#결정-색인)). 수치는 [GAME 방해요소 수치](design/GAME.md#방해요소-수치)를 따른다.
- [x] (정상, 후속 조작) 드래그 발사, 조준 중 오른쪽 클릭 취소, 좌석별 흑·백 고정과 프로필 옆 알 표시, 상대 턴 판 돌리기 방해요소, 작은 창 배치가 [후속 수정 절](#impl-004-후속-조작-수정-2026-11-02)들의 근거대로 동작한다.
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #60. 개발자 B 리뷰 4건 반영: [worklog](worklogs/2026-11-02.md#impl-004-pr-60-리뷰-반영))

1차 구현(시안 연출 반영 전)의 구현·검증 근거는 [2026-11-02 worklog](worklogs/2026-11-02.md#impl-004-로컬-2인-모드-화면입력통합)에 있고, 시안 연출 반영(DEC-036)의 근거는 [2026-11-02 worklog](worklogs/2026-11-02.md#impl-004-시안-연출-반영-dec-036)에 있다. 새 API 이벤트(`board:rotate`·`hazard:aim`·`aim:update`/`aim:state`)와 오류 코드의 개발자 B 합의는 IMPL-009 착수 전에 한다(이 작업의 완료 조건이 아니다). 방해요소 수치·연출의 체감 조정은 플레이 테스트(GAME 수치는 제안값)에서 한다.

검증 근거: 작업 시 날짜별 worklog의 해당 작업 절

## IMPL-005 AI 대전

우선순위: P1
상태: 완료
담당: 개발자 A
의존성: LOCAL-001, IMPL-004
범위: `AiGameSession`(mode `ai`)과 전용 Web Worker, AI 컨트롤러를 구현한다. 서버 연결·저장은 없다. 로비 방 생성 창은 IMPL-012 범위이므로 이 작업은 개발용 `/ai` 설정 폼과 방 생성 창이 그대로 쓸 `AiSetupForm`·`startAiGame`까지 만든다([DEC-042](DECISIONS.md#결정-색인)).
관련 문서: [LOCAL AI 대전](design/LOCAL.md#ai-대전) / [AI 대전](PRD.md#ai-대전) / [GAME AI](design/GAME.md#ai-대전) / [DEC-021·040](DECISIONS.md#결정-색인)
Issue·PR: [#39](https://github.com/moguab2808-commits/mini-project-1-1/issues/39)·[PR #62](https://github.com/moguab2808-commits/mini-project-1-1/pull/62)

수용 기준:
- [x] (정상) 방 생성 창에서 AI·판·알 개수(5·7·9)를 고르면 서버 요청 없이 경기가 시작되고 끝까지 진행된다. (개발용 `/ai` 설정 폼으로 확인. 로비 방 생성 창 연결은 IMPL-012에서 같은 `AiSetupForm`·`startAiGame`을 쓴다)
- [x] (오류) AI 컨트롤러가 자기 `GameView`만 읽고 사람과 같은 명령 검증을 거친다. 검증에 걸린 명령은 상태를 바꾸지 않는다.
- [x] (예외) AI 대전 결과가 서버로 전송되지 않고 전적이 바뀌지 않으며 방 목록에 나타나지 않는다. 네트워크 요청이 없음을 확인한다.
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #62)

검증 근거: [2026-11-02 worklog](worklogs/2026-11-02.md#impl-005-ai-대전)

## IMPL-006 DB·마이그레이션

우선순위: P0
상태: 완료
담당: 개발자 B
의존성: DB-001, IMPL-001
범위: Drizzle 스키마(`users`·`rooms`), 세션 테이블, 마이그레이션 파일, 연결 풀을 구현한다.
관련 문서: [DATABASE](design/DATABASE.md) / [회원등록](PRD.md#회원등록) / [DEC-022·023·027](DECISIONS.md#결정-색인)
Issue·PR: [#40](https://github.com/moguab2808-commits/mini-project-1-1/issues/40)·[PR #54](https://github.com/moguab2808-commits/mini-project-1-1/pull/54)

수용 기준:
- [x] (정상) 빈 DB에 마이그레이션을 적용하면 `users`·`rooms`·세션 테이블이 [DATABASE](design/DATABASE.md)의 컬럼·제약대로 생긴다. 생성된 SQL의 `lower(nickname)` 유니크 인덱스를 확인했다.
- [x] (오류) 제약 위반(닉네임 대소문자 중복, 공개 방의 코드, 비공개 방의 코드 없음, 음수 전적, `wins + losses > total_games`, 자기 방 입장)이 DB에서 거부된다.
- [x] (예외) 마이그레이션을 두 번 적용해도 오류가 없고, 연결 풀의 유휴 시간이 [OPERATIONS](design/OPERATIONS.md#사용량부하-확인)대로 짧게 설정된다. 세션 테이블 스키마를 connect-pg-simple 공식 문서와 대조했다.
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #54, `main` 2770790)

검증 근거: [2026-11-02 worklog](worklogs/2026-11-02.md#impl-006-db마이그레이션)·[완료 처리](worklogs/2026-11-02.md#impl-006-완료-처리)

## IMPL-007 인증

우선순위: P0
상태: 완료
담당: 개발자 B
의존성: AUTH-001, API-001, IMPL-006
범위: 가입·로그인·로그아웃·`GET /api/me`·비밀번호 변경·캐릭터 변경 API, 세션, IP당 요청 빈도 제한, argon2id 해시, Socket.IO 연결 인증을 구현한다.
관련 문서: [AUTH](design/AUTH.md) / [API REST](design/API.md#rest-api) / [로그인](PRD.md#로그인)·[회원등록](PRD.md#회원등록)·[캐릭터 변경](PRD.md#캐릭터-변경) / [DEC-025·028](DECISIONS.md#결정-색인)
Issue·PR: [#41](https://github.com/moguab2808-commits/mini-project-1-1/issues/41)·[PR #59](https://github.com/moguab2808-commits/mini-project-1-1/pull/59)

수용 기준:
- [x] (정상) 가입은 세션을 만들지 않고 `201`만 응답하며, 로그인하면 세션 쿠키(`httpOnly`, 브라우저 종료 시 만료)와 `Me`가 돌아온다. 비밀번호 변경 뒤 현재 세션만 남고 다른 세션과 그 Socket.IO 연결이 끝난다.
- [x] (오류) 입력 오류 `INVALID_INPUT`, 닉네임 중복 `NICKNAME_TAKEN`(NFC·대소문자 무시), 닉네임 없음과 비밀번호 틀림이 같은 `INVALID_CREDENTIALS`, 세션 없음 `UNAUTHENTICATED`를 [API](design/API.md#rest-api)의 상태 코드로 돌려준다.
- [x] (예외) `/api/auth/*`가 IP당 분당 20회를 넘으면 `429 RATE_LIMITED`와 `Retry-After`가 응답되고, 로그인 연속 실패로는 잠기지 않는다. 같은 계정의 새 연결은 기존 연결에 `session:replaced`를 보내고 끊는다.
- [x] argon2id 해시 시간을 측정해 worklog에 남겼고(이 PC 기준. Render 무료 인스턴스 측정은 [IMPL-013](#impl-013-배포)으로 옮겼다), 만료·정리 기본값을 공식 문서로 확인했다.
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #59)

검증 근거: [2026-11-02 worklog](worklogs/2026-11-02.md#impl-007-인증)

## IMPL-008 로비·방 (서버)

우선순위: P0
상태: 완료
담당: 개발자 B
의존성: API-001, DB-001, IMPL-007
범위: `GET /api/rooms`, `room:create`·`room:join`·`room:quickJoin`·`room:leave` 이벤트, `room:state`·`room:closed`, 상대 입장 즉시 시작([DEC-040](DECISIONS.md#결정-색인))과 `rooms` 상태 갱신, 서버 시작 시 `rooms` 정리를 구현한다. 시작 버튼·`room:start`는 없다.
관련 문서: [API 방 이벤트](design/API.md#방-이벤트-필드) / [DATABASE 방 생명주기](design/DATABASE.md#방-생명주기) / [로비](PRD.md#로비)·[방 생성](PRD.md#방-생성)·[대기실](PRD.md#대기실)
Issue·PR: [#42](https://github.com/moguab2808-commits/mini-project-1-1/issues/42)·[PR #61](https://github.com/moguab2808-commits/mini-project-1-1/pull/61)

수용 기준:
- [x] (정상, `ROOM-JOIN`) 대기 중인 공개 방에 참여하면 양쪽에 `room:state`로 두 사용자가 담기고 별도 조작 없이 곧바로 시작(`status`가 `playing`)한다. 방장은 상대가 입장하기 전까지 `guest`가 `null`인 상태로 기다린다. 즉시 참가는 대기 중인 공개 방 중 하나를 고른다.
- [x] (정상) `GET /api/rooms`는 공개·비공개 방을 모두 `status`와 함께 돌려주고 비공개 방의 `code`·사용자 번호가 응답에 없다. `code`는 방장의 `room:state`에만 있다.
- [x] (오류) `INVALID_CODE`·`ROOM_PLAYING`(상대가 있는 방)·`ROOM_NOT_FOUND`·`CODE_TAKEN`·`ALREADY_IN_ROOM`이 [API](design/API.md#오류-형식과-코드)의 조건대로 ack로 응답된다. `room:join`이 사용자당 분당 30회를 넘으면 `RATE_LIMITED`다.
- [x] (예외) 두 사용자가 동시에 같은 방에 입장하면 한 명만 성공한다. 방장이 나가면 방이 삭제되고 `room:closed`가 가며(경기 중 포함), 참여자가 나가면 방은 유지돼 `guest_id`가 비워지고 `waiting`으로 돌아가며 다음 입장자가 오면 다시 바로 시작한다. 서버 시작 때 `rooms`가 전부 삭제된다.
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (병합과 함께 충족. PR #61)

검증 근거: [2026-11-02 worklog](worklogs/2026-11-02.md#impl-008-로비방-서버)

## IMPL-009 온라인 대전 (서버)

우선순위: P0
상태: 완료
담당: 개발자 B
의존성: API-001, IMPL-003, IMPL-008
범위: 서버가 `game-runtime`에 Socket.IO 전송·서버 시계·사용자↔좌석 맵을 주입해 경기를 진행한다. 이탈·중복 접속의 기권 명령 변환, 재도전 15초 처리, 서버 로그를 구현한다. IMPL-008이 남긴 두 자리를 이어받는다: 상대 입장 직후 경기를 여는 `RoomHooks.onStarted`와, 경기 중 이탈의 기권패 저장을 끼워 넣을 `RoomService.leave` 앞. 재도전 15초 만료는 재도전하기를 누르지 않은 쪽을 나가기와 같게 처리한다([DEC-041](DECISIONS.md#결정-색인)): 방장이 누르지 않았으면 방을 닫고(`room:closed`) 방장만 눌렀으면 상대만 내보내 방장에게 `room:state`(`waiting`)를 보낸다. 서버가 처리하며 누르지 않은 본인에게는 `room:closed`(`rematch_timeout`)를 보낸다. 방장이 누르지 않아 방이 닫힐 때 상대도 누르지 않았으면 상대에게도 `rematch_timeout`, 눌렀으면 `host_left`를 보낸다. `RoomService.leave`가 처리하되 본인에게 알리는 사유를 넘기도록 확장한다. 그 밖에 PR #61 리뷰에서 넘어온 것은 [DEC-043](DECISIONS.md#결정-색인)으로 정했다: ① 시작 커밋과 이탈의 순서는 방별 `RoomRuntime`이 `ingressSeq`를 대기실부터 이어 매겨 보장하고, 입장 직후 이탈은 경기 생성을 기다려 시작 뒤 이탈(기권패)로 처리한다. ② `onStarted` 실패는 입장을 되돌린다. ③ 소켓 ack의 `INTERNAL_ERROR`를 경기 명령 `CommandResult`(`ERROR_CODES`)에도 넣는다. 전적 저장(`finishOnce`·전적 갱신 트랜잭션)은 원래 [IMPL-011](#impl-011-경기-종료-전적) 범위였으나 이 PR에 포함하도록 조정했다([DEC-044](DECISIONS.md#결정-색인)). 이탈로 끝난 경기는 전적 저장을 끝낸 뒤 방을 정리한다. 경기 종료 뒤 `rooms`는 재도전이 `playing`을 유지하므로 따로 갱신하지 않는다.
관련 문서: [API 경기 이벤트](design/API.md#경기-이벤트-필드)·[이벤트 순서](design/API.md#이벤트-순서) / [AUTH 검증 경계](design/AUTH.md#검증-경계) / [OPERATIONS 서버 로그](design/OPERATIONS.md#서버-로그) / [연결 끊김과 중복 접속](PRD.md#연결-끊김과-중복-접속)
Issue·PR: [#43](https://github.com/moguab2808-commits/mini-project-1-1/issues/43)·[PR #63](https://github.com/moguab2808-commits/mini-project-1-1/pull/63)

수용 기준:
- [x] (정상, `HAZARD-GRANT`·`HAZARD-USE`) 게임 시작과 교체 라운드에 `hazard:granted`가 받은 플레이어에게만 가고, `hazard:use`는 조건을 충족하면 양쪽에 `hazard:triggered`가 간다. 이벤트 순서가 [순서 규칙](design/API.md#이벤트-순서)과 같다.
- [x] (정상, `TURN-TIMEOUT`) 30초 동안 발사하지 않으면 `turn:change`(`timeout`)가 가고 연속 3회에 `game:over`(`timeout_forfeit`)가 간다.
- [x] (오류) 사용자 번호를 입력으로 받지 않고 세션 사용자만 좌석으로 바꾼다. 경기 중이 아닌 사용자의 명령은 `GAME_NOT_ACTIVE`, 낡은 명령은 `STALE_TURN`·`STALE_HAZARD`다.
- [x] (예외, `LEAVE-FORFEIT`) 경기 중 연결이 끊기거나 `room:leave`·`session:replaced`가 일어나면 그 플레이어가 기권패다. 동시 이탈은 먼저 관찰된 쪽, 시작 커밋 전 이탈은 대기실 처리이며 `leave`·`start_commit` 로그의 `ingressSeq`로 판정할 수 있다. 로그에 세션·쿠키·상대 보유 방해요소가 없다.
- [x] (예외, 재도전 15초) 재도전하기를 누르지 않은 쪽은 나가기와 같게 처리된다. 방장만 눌렀으면 상대만 나가고 방장은 대기 상태가 되며, 방장이 누르지 않았으면(상대가 눌렀든 아니든) 방이 닫혀 상대에게 `room:closed`가 간다. 두 사람이 남은 채 `waiting`이 되는 일이 없다. 누르지 않은 본인은 `room:closed`(`rematch_timeout`)를 받는다.
- [x] (정상, 전적) 경기가 끝나면(정상 종료·기권·시간초과) 두 사용자의 전체 경기수·승·패가 경기마다 한 번씩 저장되고(무승부는 두 사람의 전체 경기수만), 프로필(`GET /api/me`)과 방 목록(`GET /api/rooms`)의 방장 정보에 전체·승·패·무가 보인다. 저장이 실패하면 오류 로그만 남기고 반영을 포기하며 방 정리는 계속된다.
- [x] (예외, 시작 직후 이탈) 입장 UPDATE 직후 방장이 나가도 시작 처리가 건너뛰어지지 않고 그 이탈이 기권패로 기록되며, `start_commit`·`leave` 로그의 `ingressSeq`로 순서를 판정할 수 있다. `onStarted` 실패 때의 입장 처리 정책이 정해져 있다.
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: [2026-11-02 worklog](worklogs/2026-11-02.md#impl-009-온라인-대전-서버). PR #63 리뷰 보정과 시작 중단 신호(PR #64 리뷰)는 [2026-11-03 worklog](worklogs/2026-11-03.md)에 있다. PR #63이 `main`에 병합돼(34a8d06) 완료했다.

## IMPL-010 온라인 대전 (클라이언트)

우선순위: P0
상태: 완료
담당: 개발자 A
의존성: API-001, IMPL-003, IMPL-004
범위: `RemoteGameSession`(이벤트 변환 없이 전달)과 `RoomClient`(`room:*`·`session:replaced`)를 구현해 `LocalGameSession`을 바꿔 끼울 수 있게 한다.
관련 문서: [LOCAL GameSession](design/LOCAL.md#gamesession-시그니처) / [API](design/API.md#socketio-이벤트) / [DEC-030](DECISIONS.md#결정-색인)
Issue·PR: [#44](https://github.com/moguab2808-commits/mini-project-1-1/issues/44)·[PR #64](https://github.com/moguab2808-commits/mini-project-1-1/pull/64)

수용 기준:
- [x] (정상) 화면 코드를 바꾸지 않고 `LocalGameSession` 대신 `RemoteGameSession`으로 경기가 진행된다. 재도전 경기를 같은 세션이 이어 간다.
- [x] (오류) ack 오류 코드를 `CommandResult`로 그대로 전달하고 `gameId`가 현재 경기와 다른 이벤트·`revision`이 오래된 `game:state`를 버린다.
- [x] (예외) `session:replaced`를 받으면 로그인 화면으로 이동하고, 연결이 끊기면 재접속을 시도하지 않고 로그인 화면으로 간다. `dispose()`는 `room:leave`를 보낸다.
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: [2026-11-03 worklog](worklogs/2026-11-03.md#impl-010-온라인-대전-클라이언트). 로그인 전환 콜백·경로는 검증했으며 실제 로그인 화면은 IMPL-012 범위다. PR #64 리뷰 승인 후 merge commit으로 `main`에 병합해 완료했다.

## IMPL-011 경기 종료 전적

우선순위: P0
상태: 완료
담당: 개발자 B
의존성: DB-001, IMPL-009
범위: `finishOnce`와 전적 갱신 트랜잭션, 경기 종료 뒤 `rooms` 상태 갱신을 구현한다. 구현과 검증은 [IMPL-009](#impl-009-온라인-대전-서버) PR에서 했다([DEC-044](DECISIONS.md#결정-색인)). 경기 종료 뒤 `rooms`는 재도전이 `playing`을 유지하므로 갱신할 것이 없다. 병합 기준은 IMPL-009 병합으로 충족한다.
관련 문서: [DATABASE 경기 종료 저장](design/DATABASE.md#경기-종료-저장) / [전적](PRD.md#전적) / [GAME 명령 경합](design/GAME.md#명령-경합과-시간)
Issue·PR: [#45](https://github.com/moguab2808-commits/mini-project-1-1/issues/45)·[PR #63](https://github.com/moguab2808-commits/mini-project-1-1/pull/63)

수용 기준:
- [x] (정상, `LEAVE-FORFEIT`) 정상 종료·기권 종료 뒤 양쪽 전적이 갱신된다. 승자는 `total_games`·`wins`, 패자는 `total_games`·`losses`가 오르고 무승부는 `total_games`만 오른다.
- [x] (오류) 트랜잭션이 실패하면 오류를 로그에 남기고 전적 반영을 포기하며 같은 경기가 두 번 반영되지 않는다. 방 정리는 계속된다.
- [x] (예외) 이탈·시간초과·정상 종료가 겹쳐도 `finishOnce`가 한 번만 실행된다. 두 `users` 행을 `id` 오름차순으로 잠가 동시 종료에서 교착이 나지 않는다. AI 대전과 시작 커밋 전 이탈은 전적을 바꾸지 않는다.
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: [2026-11-02 worklog IMPL-009 절](worklogs/2026-11-02.md#impl-009-온라인-대전-서버). IMPL-009와 함께 PR #63으로 `main`에 병합돼(34a8d06) 완료했다.

## IMPL-012 계정·로비·대기실·결과 화면

우선순위: P0
상태: 완료
담당: 개발자 B (2026-10-31 [DEC-035](DECISIONS.md#결정-색인)로 A에서 변경)
의존성: UI-002, API-001, IMPL-007, IMPL-008
범위: 로그인·가입·로비(방 목록·새로고침·방 생성·즉시 참가·코드 입력)·캐릭터 변경·환경설정·대기실·결과(재도전하기·나가기) 화면을 PRD 화면 요구사항대로 구현한다. IMPL-010의 개발용 `/online` 연결 확인 화면은 정식 화면으로 대체해 삭제한다(개발자 A 요청, PR #66 리뷰).
관련 문서: [화면별 요구사항](PRD.md#화면별-요구사항) / [UI-002](#ui-002-디자인-캔버스-현재-요구사항-반영) / [API](design/API.md)
Issue·PR: [#46](https://github.com/moguab2808-commits/mini-project-1-1/issues/46)·[PR #66](https://github.com/moguab2808-commits/mini-project-1-1/pull/66)

수용 기준:
- [x] (정상, `ROOM-JOIN`) 로그인 → 로비 → 방 생성 또는 참여 → 대기실 → 인게임 → 결과(재도전하기·나가기) 흐름이 두 계정으로 이어진다. 비공개 방은 자물쇠 표시와 코드 입력 뒤 입장한다. (headless Chrome 두 계정으로 확인했다. 공개·비공개 방, 기권 결과, 양쪽 전적 반영까지다. WebGL은 SwiftShader라 화면 성능은 판정하지 않는다)
- [x] (오류) API 오류 코드마다 PRD 안내 문구가 표시된다(닉네임 중복, 로그인 실패, 방이 가득 참, 이미 게임 중, 코드 오류 시 창 유지, 요청 제한 안내). (닉네임 중복·로그인 실패·코드 오류(창 유지)·요청 제한·게임 중인 방 입장은 브라우저에서, 모든 코드의 문구 대응은 단위 테스트로 확인했다. 방이 가득 찬 경우는 API에 별도 코드가 없어 `ROOM_PLAYING`("이미 게임이 시작된 방")으로 안내한다. 서버가 `ROOM_PLAYING`·`ALREADY_IN_ROOM`을 돌려주는 경로는 브라우저로 만들지 않았다)
- [x] (예외) 목록이 오래된 채 입장해도 서버 오류를 안내하고, 방장이 나가 방이 닫히면 로비로 이동한다. 재도전 15초가 지나면 누르지 않은 쪽은 나가기와 같게 처리돼, 방장이 누르지 않았으면 두 사람 모두 방 목록으로, 방장만 눌렀으면 상대만 방 목록으로 이동하고 방장은 "상대를 기다리는 중"이 된다([DEC-041](DECISIONS.md#결정-색인)). (오래된 목록·방장 이탈·상대 이탈·아무도 안 누른 15초·방장만 누른 15초를 브라우저에서 확인했다. 상대만 누르고 방장은 누르지 않은 경우는 브라우저로 돌리지 않았고 서버 쪽은 IMPL-009 DB 테스트가 확인한다)
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #66, `main` 5a537ad)

검증 근거: [2026-11-03 worklog IMPL-012 절](worklogs/2026-11-03.md#impl-012-계정로비대기실결과-화면)

## IMPL-013 배포

우선순위: P1
상태: 진행 중
담당: 개발자 B
의존성: OPS-001, IMPL-009, IMPL-011
범위: Render 웹 서비스·Neon 설정, 헬스체크(UptimeRobot), SPA fallback, 구조화 로그, 수동 배포·롤백 절차를 적용한다. 커밋·푸시·배포는 사용자 승인 뒤 단계별로 한다.
관련 문서: [OPERATIONS](design/OPERATIONS.md#세부-절차-확정안) / [ADR-0003](adr/0003-tech-stack-and-architecture.md) / [DEC-029](DECISIONS.md#결정-색인)
Issue·PR: [#47](https://github.com/moguab2808-commits/mini-project-1-1/issues/47)

수용 기준:
- [ ] (정상) 수동 배포 뒤 `/health`가 `200 { status: "ok" }`이고 정적 화면과 Socket.IO 연결이 동작한다. 자동 배포가 꺼져 있고 환경 변수 값이 문서·로그에 없다.
- [ ] (오류) `/api`·`/socket.io`·`/health` 밖 확장자 없는 GET은 `index.html`, 없는 정적 자산은 404를 돌려준다. 롤백 절차로 직전 배포를 복원해 확인했다.
- [x] (예외) 서버 시작 때 `rooms` 정리가 실패하면 서버가 시작하지 않는다. 절전 방지 요청 사용 여부와 Render 로그 보관 기간을 구현 단계에서 정해 기록했다.
- [ ] (예외) argon2id 해시 시간을 Render 무료 인스턴스에서 측정해 worklog에 남기고 목표(약 100~300ms)에 맞게 [AUTH](design/AUTH.md#해시프록시) 파라미터를 조정했다. (IMPL-007에서 옮겨 옴)
- [ ] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다.

진행: 코드 쪽(`/health`, 정적 파일·SPA fallback, `rooms` 정리 실패 시 종료, `render.yaml`)은 구현·검증했다. Render·Neon 서비스 생성, 수동 배포·롤백, UptimeRobot, argon2id 실측은 사용자 승인과 계정 작업이 필요해 남았다. 절전 방지 요청(10분 간격)과 로그 보관 7일은 [DEC-047](DECISIONS.md#결정-색인)로 정했다.

검증 근거: [2026-11-03 worklog IMPL-013 절](worklogs/2026-11-03.md#impl-013-배포)

## CHAR-001 사람 아바타 전환과 꾸미기 설계

우선순위: P1
상태: 완료
담당: Claude — 사용자 요청 수행
의존성: IMPL-012(지금의 캐릭터 변경 창·API)
범위: [DEC-048](DECISIONS.md#결정-색인)에 따라 동물 6종을 사람 아바타로 바꾸고 꾸미기(캐릭터·헤어스타일·이목구비·악세사리 등)를 추가하기 위한 미정 사항을 정하고, 시험용 머리로 화풍을 확인한 뒤 구현 작업을 등록한다. 구현 자체는 이 작업 뒤 등록하는 작업에서 한다.
관련 문서: [PRD 캐릭터 변경](PRD.md#캐릭터-변경)·[화면 미정 사항](PRD.md#화면-미정-사항) / [TECH_STACK 에셋](design/TECH_STACK.md#에셋-조달-계획) / [DATABASE](design/DATABASE.md#미정-사항) / [API 공통 타입](design/API.md#공통-타입) / [DEC-033](DECISIONS.md#결정-색인)·[DEC-048](DECISIONS.md#결정-색인)
Issue·PR: [#69](https://github.com/moguab2808-commits/mini-project-1-1/issues/69)·[PR #79](https://github.com/moguab2808-commits/mini-project-1-1/pull/79)

수용 기준:
- [x] (정상) [화면 미정 사항](PRD.md#화면-미정-사항)의 꾸미기 항목·선택지 수·꾸미기 시점·저장 시점·기본 외형·AI 상대 외형이 사용자 승인으로 정해져 PRD와 DECISIONS에 기록됐다. ([DEC-054](DECISIONS.md#결정-색인)·[DEC-059](DECISIONS.md#결정-색인))
- [x] (정상) 3D·2D 제작 방식(코드 도형 유지 여부, 이목구비 표현, 프로필·카드 2D 얼굴 방식)을 정해 TECH_STACK에 기록했고, DEC-033과 다르면 대체 관계를 남겼다. (DEC-033 안이라 대체 없음)
- [x] (정상) ~~시험용 머리를 개발용 화면에서 띄워 화풍을 확인받는다~~ → 사용자 요청("구현 전에 필요한 결정 전부 물어봐 바로 구현할 수 있게", 2026-11-03)에 따라 [IMPL-018](#impl-018-사람-아바타-구현)의 첫 수용 기준으로 옮겼다.
- [x] (예외) 외형 저장 형식(DATABASE)·API 타입과 기존 계정의 동물 캐릭터 값 처리 방식을 정했다. ([DATABASE users](design/DATABASE.md#users)·[API 공통 타입](design/API.md#공통-타입)) 외형은 상대에게도 보여야 하므로 방 목록·대기실·`game:start`로 전달되는 경로를 포함한다.
- [x] 구현 작업을 TASKS에 등록하고 변경·검증 결과를 worklog에 기록해 리뷰 후 기준 브랜치에 병합됐다. (PR #79, 2026-11-03 병합)

진행: 꾸미기 항목 7개와 선택지 5개([DEC-054](DECISIONS.md#결정-색인)), 나머지 사항([DEC-059](DECISIONS.md#결정-색인))을 정해 PRD·API·DATABASE·TECH_STACK에 반영하고 구현을 [IMPL-018](#impl-018-사람-아바타-구현)으로 등록했다. PR #79로 병합해 완료했다. API 계약은 [DEC-063](DECISIONS.md#결정-색인)으로 확정했다.

검증 근거: [2026-11-03 worklog CHAR-001 절](worklogs/2026-11-03.md#char-001-사람-아바타-전환과-꾸미기-설계)

## THEME-001 방 테마 선택 설계

우선순위: P2
상태: 완료
담당: Claude — 사용자 요청 수행
의존성: IMPL-012(지금의 방 생성 창)
범위: [DEC-049](DECISIONS.md#결정-색인)에 따라 방을 만들 때 방 테마를 고르는 기능의 미정 사항을 정하고 구현 작업을 등록한다. 구현 자체는 이 작업 뒤 등록하는 작업에서 한다.
관련 문서: [PRD 방 생성](PRD.md#방-생성)·[화면 미정 사항](PRD.md#화면-미정-사항) / [DATABASE](design/DATABASE.md#미정-사항) / [API 방 명령](design/API.md) / [TECH_STACK 에셋](design/TECH_STACK.md#에셋-조달-계획)
Issue·PR: [#72](https://github.com/moguab2808-commits/mini-project-1-1/issues/72)·[PR #74](https://github.com/moguab2808-commits/mini-project-1-1/pull/74)

수용 기준:
- [x] (정상) [화면 미정 사항](PRD.md#화면-미정-사항)의 테마 종류·바뀌는 범위·판 선택과의 관계·고르는 사람과 시점·표시 위치·기본 테마가 사용자 승인으로 정해져 PRD와 DECISIONS에 기록됐다.
- [x] (정상) 테마별 에셋 제작 방식과 용량이 [에셋 한도](design/TECH_STACK.md#에셋-조달-계획)(DEC-033) 안에 드는지 확인해 기록했다.
- [x] (예외) 테마를 `rooms`·`room:create`·`room:state`·`game:start`에 어떻게 싣는지와, 테마가 게임 규칙·물리·판정에 영향을 주지 않는지를 정했다. AI 대전·로컬 2인 적용 여부를 포함한다.
- [x] 구현 작업을 TASKS에 등록하고 변경·검증 결과를 worklog에 기록해 리뷰 후 기준 브랜치에 병합됐다. (PR #74, 2026-11-03 병합)

진행: [DEC-050](DECISIONS.md#결정-색인)에 이어 [DEC-052](DECISIONS.md#결정-색인)로 두 번째 테마(밤 옥상)·글자 라벨 표시·로컬 2인 URL 값·판과 같은 저장·전송 형식을 정했다. 구현은 [IMPL-015](#impl-015-방-테마-구현)로 등록했다. 이후 [DEC-053](DECISIONS.md#결정-색인)로 테마를 4개(교실·해변 추가)로 늘렸다. PR #74로 병합해 완료했다.

검증 근거: [2026-11-03 worklog THEME-001 절](worklogs/2026-11-03.md#theme-001-방-테마-선택-설계)

## IMPL-015 방 테마 구현

우선순위: P2
상태: 진행 중
담당: Claude — 사용자 요청 수행
의존성: THEME-001, IMPL-004(로컬 2인), IMPL-005(AI 대전), IMPL-008(방 서버), IMPL-012(방 생성 창·방 카드·대기실)
범위: [DEC-049](DECISIONS.md#결정-색인)·[DEC-050](DECISIONS.md#결정-색인)·[DEC-052](DECISIONS.md#결정-색인)·[DEC-053](DECISIONS.md#결정-색인)의 방 테마 4종(바·밤 옥상·교실·해변)을 저장·전송·선택·표시·장면에 구현한다. 판·알·의자·캐릭터 모양과 게임 규칙은 바꾸지 않는다.
관련 문서: [PRD 방 생성](PRD.md#방-생성)·[로비](PRD.md#로비)·[대기실](PRD.md#대기실) / [API 공통 타입](design/API.md#공통-타입) / [DATABASE rooms](design/DATABASE.md#rooms) / [LOCAL](design/LOCAL.md) / [TECH_STACK 에셋](design/TECH_STACK.md#에셋-조달-계획)
Issue·PR: [PR #84](https://github.com/moguab2808-commits/mini-project-1-1/pull/84)(중간 PR)

수용 기준:
- [ ] (정상) `shared`에 `ThemeId`(`bar`·`rooftop`·`classroom`·`beach`)와 스키마가 있고, `rooms.theme` 마이그레이션(기본 `bar`)이 기존 행이 있는 DB에 적용된다. `room:create`에 `theme`을 주면 저장되고 생략하면 `bar`다. 방 목록·`room:state`·`game:start`에 같은 값이 담긴다(서버 테스트).
- [ ] (예외, 서버 후속) 없는 테마 값의 `room:create`는 `INVALID_INPUT`이고 방이 만들어지지 않는다.
- [x] (예외, 로컬) `/local?theme=`에 없거나 잘못된 값이면 `bar`로 시작한다. (실제 SharedWorker 브라우저 확인)
- [x] (정상, 로컬) `/ai` 설정에서 4종 테마를 골라 시작할 수 있고 기본은 바 테마다. 먼저 연결한 로컬 창의 테마가 양쪽에 같다.
- [ ] (정상, 온라인 후속) 방 생성 창에서 사람·AI 모두 테마를 고를 수 있고 기본 선택은 바 테마다. 방 카드와 대기실에 테마 이름이 글자 라벨로 보인다.
- [x] (정상) 밤 옥상·교실·해변 테마는 배경·조명·책상이 바와 다르고, 바 테마 장면은 지금과 같다. 네 테마 스크린샷을 worklog에 남기고 사용자에게 확인받았다. 파일 에셋을 더하지 않았다(코드 도형·절차 텍스처).
- [x] (경계, 규칙) 테마는 `game-core`에 넘기지 않으며 `game-runtime`은 시작 표시 정보로만 전달한다. 같은 시드·명령의 경기 결과가 테마와 무관하게 같다(테스트).
- [ ] (경계, GPU 후속) 추가한 세 테마의 GPU 프레임 시간을 바와 같은 조건으로 기록해 비교했다([검증 계획](ENGINEERING-VALIDATION.md)). SwiftShader 하네스 4종 참고값은 기록했으나 GPU 비교로 판정하지 않는다.
- [ ] API·DATABASE·LOCAL의 "미구현" 표시를 현재 구현으로 고치고, 변경·검증 결과를 worklog에 기록해 리뷰 후 기준 브랜치에 병합됐다.

진행: 저장·전송·선택·표시·장면 4종을 구현했다. 실제 AI·로컬 브라우저 테마 선택·기본값·양쪽 표시 확인, 테마별 참고 프레임 측정, 사용자 화면 승인을 마쳤다([로컬·AI 마무리 검증](worklogs/2026-11-03.md#impl-015016017018-로컬ai-마무리)). 실제 DB·온라인 화면 확인, GPU 성능, 이번 변경 리뷰·병합은 남았다.

검증 근거: [2026-11-03 worklog IMPL-015 절](worklogs/2026-11-03.md#impl-015-방-테마-구현)

## UI-003 사람 아바타 화풍 UI 적용 설계

우선순위: P2
상태: 취소 ([DEC-060](DECISIONS.md#결정-색인)으로 [DEC-051](DECISIONS.md#결정-색인) 철회. UI는 지금 화풍 유지)
담당: 미정
의존성: CHAR-001(아바타 부품 구조·시험용 머리로 확인한 화풍)
범위: [DEC-051](DECISIONS.md#결정-색인)에 따라 사람 아바타와 어울리는 화풍을 로그인·회원가입·방 목록·환경설정·게임 화면을 **제외한** 나머지 화면에 적용하기 위한 미정 사항을 정하고 시안·구현 작업을 등록한다. 구현 자체는 이 작업 뒤 등록하는 작업에서 한다. 아바타 모델·꾸미기 기능 자체는 [CHAR-001](#char-001-사람-아바타-전환과-꾸미기-설계)이 맡는다.
관련 문서: [PRD 화면 미정 사항](PRD.md#화면-미정-사항)·[캐릭터 변경](PRD.md#캐릭터-변경) / [DEC-032](DECISIONS.md#결정-색인)·[DEC-048](DECISIONS.md#결정-색인)·[DEC-051](DECISIONS.md#결정-색인)
Issue·PR: [#73](https://github.com/moguab2808-commits/mini-project-1-1/issues/73)

수용 기준:
- [ ] (정상) 적용 대상 화면의 확정 목록(대기실·결과 화면·캐릭터 변경 창·방 생성·코드 입력 창·규칙 설명 카드 등)이 사용자 승인으로 정해져 PRD 화면 미정 사항과 DECISIONS에 기록됐다. 제외 화면(로그인·회원가입·방 목록·환경설정·게임 화면)은 바뀌지 않는다.
- [ ] (정상) 적용 화면에 쓸 공통 요소(색·글꼴·버튼·카드 규칙)를 정했고 제외 화면과 한 앱 안에서 섞여 보이는 문제의 허용 범위를 사용자에게 확인받았다.
- [ ] (예외) 참고 화면의 레이아웃·아이콘·부품 모양·로고를 그대로 옮기지 않고 이 프로젝트 화풍(Jua 글꼴·나무색 바 분위기)으로 새로 디자인했다.
- [ ] 시안으로 사용자 확인을 받은 뒤 구현 작업을 TASKS에 등록하고 변경·검증 결과를 worklog에 기록해 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: [2026-11-03 worklog UI-003 절](worklogs/2026-11-03.md#ui-003-사람-아바타-화풍-ui-적용-설계)

## HAZ-001 방해요소 10종 추가와 턴 교체 설계

우선순위: P1
상태: 완료
담당: Claude — 사용자 요청 수행
의존성: IMPL-004(방해요소 입력·연출), IMPL-005(AI 방해요소 사용), IMPL-009(서버 경기 진행)
범위: [DEC-055](DECISIONS.md#결정-색인)의 발사 턴마다 교체·직전 종류 제외·추가 10종을 제품 규칙으로 기록하고, 구현 전에 GAME·API 상세 계약(효과 상태 위치, 플레이어별 뷰에서 숨길 필드, 새 명령 대상 형식, 수치 제안값)을 정한다. 구현은 [IMPL-016](#impl-016-방해요소-10종-추가와-턴-교체)에서 한다.
관련 문서: [PRD 지급과 보유](PRD.md#지급과-보유)·[추가 방해요소 10종](PRD.md#추가-방해요소-10종-dec-055)·[방해요소 미정 사항](PRD.md#방해요소-미정-사항) / [GAME 방해요소](design/GAME.md#방해요소별-처리) / [API 경기 이벤트](design/API.md#경기-이벤트-필드) / [DEC-014](DECISIONS.md#결정-색인)·[DEC-031](DECISIONS.md#결정-색인)·[DEC-055](DECISIONS.md#결정-색인)
Issue·PR: [PR #79](https://github.com/moguab2808-commits/mini-project-1-1/pull/79)

수용 기준:
- [x] (정상) 교체 시점·대상·초기화, 후보 18종과 직전 종류 제외, 추가 10종의 효과·발동 방식·분류·지속, AI·로컬 적용, 속임수형 3종의 공개 범위가 사용자 승인으로 정해져 PRD와 DECISIONS에 기록됐다.
- [x] (정상) GAME에 10종의 적용 훅·상태 위치와 수치 제안값(범위·힘·무게 배율·허상 배치 거리 등)을, API에 `HazardKind` 추가 값과 `hazard:use` 대상 형식(위치·방향·알 id)을 정했다. ([GAME](design/GAME.md#추가-방해요소-10종과-턴-교체-haz-001)·[API](design/API.md#추가-방해요소-10종-필드-haz-001))
- [x] (예외) 가짜벽의 진짜 여부·분신술의 진짜 알·알 무게 효과가 상대 뷰·상대에게 가는 `hazard:triggered`에 담기지 않는 필드 경계를 [상대 비공개 필드 점검](design/API.md#상대-비공개-필드-점검)에 추가했다.
- [x] (예외) 분신술 허상에 내 알이 닿을 때·설치물 겹침 허용을 사용자 승인으로 정했다. ([DEC-057](DECISIONS.md#결정-색인): 내 알도 통과·소멸, 설치물 겹침 불가)
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #79, 2026-11-03 병합)

진행: 제품 규칙을 [DEC-055](DECISIONS.md#결정-색인)·[DEC-057](DECISIONS.md#결정-색인)으로 정해 PRD에 반영했다(PR 1차). GAME·API 상세 계약·수치 제안값·속임수형 뷰 경계를 제안했고, 사용자 검토로 가짜벽 양쪽 같은 데이터·분신술 원래 id 유지·공개 `stoneCounts`·중력 8방향을 [DEC-058](DECISIONS.md#결정-색인)로 정했다. PR #79로 병합해 완료했다. API 계약은 [DEC-063](DECISIONS.md#결정-색인)으로 확정했다.

검증 근거: [2026-11-03 worklog HAZ-001·EMOTE-001 절](worklogs/2026-11-03.md#haz-001emote-001-방해요소-10종감정표현-결정-기록)

## IMPL-016 방해요소 10종 추가와 턴 교체

우선순위: P1
상태: 진행 중
담당: Claude — 사용자 요청 수행
의존성: HAZ-001
범위: [DEC-055](DECISIONS.md#결정-색인)를 `shared`·`game-core`·서버·클라이언트·AI에 구현한다. 발사 턴마다 두 사람 교체와 직전 종류 제외, 추가 10종의 물리·배치·연출, 속임수형의 상대 뷰 숨김을 포함한다.
관련 문서: [PRD 추가 방해요소 10종](PRD.md#추가-방해요소-10종-dec-055) / [GAME](design/GAME.md) / [API](design/API.md)
Issue·PR: [PR #81](https://github.com/moguab2808-commits/mini-project-1-1/pull/81)(중간 PR)·[PR #84](https://github.com/moguab2808-commits/mini-project-1-1/pull/84)(중간 PR)

수용 기준:
- [x] (정상, `HAZARD-GRANT`) 턴이 바뀔 때마다(교체 시점은 [DEC-067](DECISIONS.md#결정-색인)로 라운드마다로 변경, 아래 후속 절) 두 사람이 새 방해요소를 받고 효과·게이지·쿨타임·설치물이 사라진다. 직전 종류는 나오지 않는다(`game-core` 테스트, 시드 고정).
- [x] (정상) 추가 10종이 각각 PRD 효과대로 동작하고 같은 시드·같은 명령이면 결과가 같다(테스트). 위치형은 미리보기·ESC 취소·불가 후보 빨간색이 동작한다. (`hazards-extra.test.ts`·`aim-controller.test.ts`, 미리보기는 장면 하네스 촬영)
- [x] (예외) 상대 뷰·이벤트에 가짜벽의 진짜 여부, 분신술의 진짜 알, 알 무게 효과가 없다(뷰 테스트). 분신술·알 무게는 상대에게 발동 안내가 없고 가짜벽은 "벽"으로 안내된다. (`game-runtime` 좌석 지정 전송 테스트 포함)
- [x] (예외) 사용 제한(쿨타임 20초·턴당 1회)을 넘는 요청과 다른 설치물과 겹치는 배치는 거부되고 상태와 난수를 바꾸지 않는다. 분신술 허상은 어느 알이 닿아도 사라진다.
- [x] (정상) AI 대전·로컬 2인에서 18종이 지급·사용되고 AI가 위치형을 배치 가능한 무작위 위치에 둔다. (실제 SharedWorker 47회 재도전에서 18종 전부 사용, 실패 0. 실제 AI Worker 4종 테마 경기의 발사·방해요소 사용과 단위 테스트를 함께 확인; [로컬·AI 마무리 검증](worklogs/2026-11-03.md#impl-015016017018-로컬ai-마무리))
- [ ] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다.

진행: `shared`(18종·`per_turn`·수치·`stoneCounts`·`decoys`·`hazard:granted.turnId`)·`game-core`(턴 교체, 10종 물리·배치·뷰 경계)·`game-runtime`(시전자 전용 안내 좌석 지정 전송)·클라이언트(입력·미리보기·장면 표시·HUD·AI)를 구현했다. 구현 해석과 가짜벽 변경은 [DEC-066](DECISIONS.md#결정-색인)으로 확정했다(지정한 진짜 벽 + 무작위 가짜 두 벽 동시 설치, 알 겹침 금지, 분신 벽·구멍 회피, 판 회전 일치). 수치는 제안값이며 플레이 테스트 전이다.

검증 근거: [기존 구현](worklogs/2026-11-03.md#impl-016-방해요소-10종-추가와-턴-교체), [로컬·AI 마무리 검증](worklogs/2026-11-03.md#impl-015016017018-로컬ai-마무리) (DEC-066·실제 경기). 기능 검증은 마쳤고 이번 변경의 PR·병합 후 완료 처리한다.

### IMPL-016 자석·중력 강화와 라운드 교체 (DEC-067)

상태: 완료(IMPL-016에 포함). 2026-11-03 사용자 요청.

- [x] 자석 가속 180 → 540, 중력 구역 가속 150 → 450 cm/s². 떠서 가는 알에도 적용하고 멈춘 지면 알은 제외한다.
- [x] 방해요소 교체를 발사 턴마다 → 라운드마다(두 좌석이 한 번씩 쏜 뒤). 라운드 첫 턴 종료 때는 보유·효과·쿨타임이 이어진다.
- [x] 설치형 지속 +5초(10 → 15초), 미끄럼 장판 8 → 13초. 쿨타임 20초는 유지.

검증: [자석·중력 강화·라운드 교체·설치형 지속](worklogs/2026-11-03.md#impl-016-자석중력-강화라운드-교체설치형-지속-dec-067). 사용자 직접 플레이 확인이며 자동 테스트는 이번 변경 뒤 실행하지 않았다. 수치 체감 조정은 플레이 테스트 후속이다.

### IMPL-016 자석 블랙홀식 흡입 (DEC-068)

상태: 완료(IMPL-016에 포함). 2026-11-04 사용자 요청.

- [x] 범위에 닿은 움직이는 지면 알·떠 있는 알을 중심으로 빨아들인다: 바깥 방향 속도 제거, 중심 쪽 가속 5400 cm/s², 중심과 수직인 속도 초당 12 비율 감쇠.
- [x] 이번 스텝에 중심을 지나칠 거리면 알을 중심에 세운다(속도 0). 멈춘 지면 알은 계속 제외한다.

검증: [2026-11-04 worklog](worklogs/2026-11-04.md#impl-016-자석-블랙홀식-흡입-dec-068). 사용자 요청으로 Claude는 테스트·빌드를 실행하지 않았고 사용자가 동작을 보고 "괜찮네"로 확인했다. 이전 자석 동작을 전제로 한 자동 테스트는 확인 필요다.

## EMOTE-001 감정표현 설계

우선순위: P2
상태: 완료
담당: Claude — 사용자 요청 수행
의존성: 없음(구현은 사람 아바타 이후)
범위: [DEC-056](DECISIONS.md#결정-색인)의 감정표현 6종을 제품 규칙으로 기록하고, 구현 전에 API 이벤트(보내기·중계·빈도 제한 오류)와 몸짓·말풍선·효과음 목록을 정한다. 구현은 [IMPL-017](#impl-017-감정표현-구현)에서 한다.
관련 문서: [PRD 감정표현](PRD.md#감정표현-dec-056)·[환경설정 효과음 목록](PRD.md#환경설정) / [API Socket.IO 이벤트](design/API.md#socketio-이벤트) / [DEC-048](DECISIONS.md#결정-색인)·[DEC-056](DECISIONS.md#결정-색인)
Issue·PR: [PR #79](https://github.com/moguab2808-commits/mini-project-1-1/pull/79)

수용 기준:
- [x] (정상) 종류 6개·사용 방법(숫자키 1~6·버튼 메뉴)·사용 시점(경기 중)·쿨타임 3초·표시(몸짓·말풍선·효과음)·끄기 설정 없음·AI 사용이 사용자 승인으로 정해져 PRD와 DECISIONS에 기록됐다.
- [x] (정상) API에 감정표현 보내기·받기 이벤트와 필드, 서버 빈도 제한과 거부 오류를 정했다. 로컬 2인·AI 경로를 포함한다. ([API 감정표현 필드](design/API.md#감정표현-필드-emote-001))
- [x] (예외) 사람 아바타 구조가 정해진 뒤 6종의 몸짓을 아바타 몸짓으로 정의했다([CHAR-001](#char-001-사람-아바타-전환과-꾸미기-설계) 이후). (상반신 [DEC-059](DECISIONS.md#결정-색인), 몸짓 [DEC-062](DECISIONS.md#결정-색인))
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #79, 2026-11-03 병합)

진행: 제품 규칙을 [DEC-056](DECISIONS.md#결정-색인)으로 정해 PRD에 반영했다. API 계약(`emote:send`·`emote:shown`, `game-runtime` 쿨타임 2.8초 검사, `EMOTE_COOLDOWN`)을 제안했다. 상반신 몸짓 6종을 [DEC-062](DECISIONS.md#결정-색인)로 정했다. PR #79로 병합해 완료했다. API 계약은 [DEC-063](DECISIONS.md#결정-색인)으로 확정했다.

검증 근거: [2026-11-03 worklog HAZ-001·EMOTE-001 절](worklogs/2026-11-03.md#haz-001emote-001-방해요소-10종감정표현-결정-기록)

## IMPL-018 사람 아바타 구현

우선순위: P1
상태: 진행 중
담당: Claude — 사용자 요청 수행
의존성: CHAR-001, IMPL-012(캐릭터 변경 창·API)
범위: [DEC-048](DECISIONS.md#결정-색인)·[DEC-054](DECISIONS.md#결정-색인)·[DEC-059](DECISIONS.md#결정-색인)의 사람 아바타를 `shared` 외형 타입·부품 데이터, DB 마이그레이션, API, 꾸미기 창, 2D SVG 얼굴, 3D 상반신, AI 외형에 구현하고 동물 6종을 없앤다. UI 꾸밈은 바꾸지 않는다([DEC-060](DECISIONS.md#결정-색인)).
관련 문서: [PRD 캐릭터 변경](PRD.md#캐릭터-변경) / [API 공통 타입](design/API.md#공통-타입) / [DATABASE users](design/DATABASE.md#users) / [TECH_STACK 에셋](design/TECH_STACK.md#에셋-조달-계획)
Issue·PR: [PR #82](https://github.com/moguab2808-commits/mini-project-1-1/pull/82)(중간 PR)·[PR #84](https://github.com/moguab2808-commits/mini-project-1-1/pull/84)(중간 PR)

수용 기준:
- [x] (정상, 첫 단계) 시험용 머리(이목구비 한 세트·머리카락 2종)를 개발용 화면에 띄운 스크린샷으로 화풍을 사용자에게 확인받은 뒤 나머지 선택지를 만든다. 참고 이미지의 부품 모양·실존 인물 얼굴을 옮기지 않았다.
- [ ] (정상) `shared`에 `Appearance`(7항목, 0~4)·기본 외형·부품 데이터가 있고, `users.appearance` 마이그레이션이 기존 행을 고정 기본 외형으로 채우고 `character_id`를 지운다(실제 DB 테스트). 신규 가입도 기본 외형이다. (구현·DB 테스트 작성 완료, `test:db` 실행 전)
- [x] (정상) 로비 프로필에서 연 꾸미기 창(왼쪽 3D 미리보기 + 오른쪽 항목 탭)에서 바꾼 값은 저장을 눌러야 `PATCH /api/me/appearance`로 한 번 저장되고, 닫으면 취소된다.
- [ ] (예외) 범위 밖 값·없는 항목·여분 필드는 `INVALID_INPUT`이고 저장되지 않는다. (스키마 단위 테스트 통과, 서버 DB 테스트는 실행 전)
- [ ] (정상) 프로필바·방 카드·대기실·결과 화면의 2D 얼굴과 게임 장면의 3D 상반신이 같은 외형으로 보이고, 상대에게도 방 목록·`room:state`·`game:start`로 같은 외형이 보인다(온라인 두 계정). AI는 경기마다 무작위이고 재도전에서 같다.
- [ ] (경계) 3D 아바타 두 명이 있는 게임 화면의 프레임 시간을 동물 캐릭터 때와 같은 조건으로 기록해 비교했다([검증 계획](ENGINEERING-VALIDATION.md)).
- [ ] 동물 6종 코드·`CharacterId`를 지우고 API·DATABASE·TECH_STACK의 "미구현" 표시를 고치며, 변경·검증 결과를 worklog에 기록해 리뷰 후 기준 브랜치에 병합됐다.

진행: 화풍을 시험용 머리로 사용자에게 확인받고(머리 1.1배) 7항목 × 5개 부품, DB 마이그레이션, `PATCH /api/me/appearance`, 꾸미기 창, 2D SVG 얼굴, 3D 상반신, AI·로컬 외형을 구현했고 동물 6종 코드를 지웠다. 전체 선택지는 스크린샷으로 사용자 확인을 받았다. 사용자 요청("남은 확인은 그냥 문서에 적어두고 병합하자")으로 중간 PR #82를 남은 확인 전에 병합했다.

로컬 확인: 실제 두 창에 같은 외형·좌석별 얼굴 표시, 실제 AI Worker 4종 테마 경기와 재도전의 외형 유지를 확인했다([로컬·AI 마무리 검증](worklogs/2026-11-03.md#impl-015016017018-로컬ai-마무리)).

남은 확인(병합 뒤):
- `npm run test:db`: `appearance-migration.db.test.ts`(기존 동물 값 행 → 기본 외형, `character_id` 삭제)와 `auth.db.test.ts`(외형 저장·잘못된 값 거부). 개발 DB에 `npm run db:migrate -w @alkkagi/server` 적용도 아직 안 했다.
- 온라인 두 계정: 방 목록·`room:state`·`game:start`로 상대에게 같은 외형이 보이는지, 실제 로비 꾸미기 창 저장.
- GPU 브라우저에서 동물 캐릭터(`main` 477803e)와 같은 조건의 프레임 시간 비교(SwiftShader 참고값은 6~17% 느림, 흔들림 큼).
- 위 확인 뒤 수용 기준 체크·완료 처리.

검증 근거: [2026-11-03 worklog IMPL-018 절](worklogs/2026-11-03.md#impl-018-사람-아바타-구현)

## IMPL-017 감정표현 구현

우선순위: P2
상태: 진행 중
담당: Codex — 사용자 요청 수행
의존성: EMOTE-001, [IMPL-018](#impl-018-사람-아바타-구현)(동물 캐릭터에 먼저 만들지 않는다, [DEC-056](DECISIONS.md#결정-색인))
범위: 감정표현 6종의 입력(숫자키·버튼 메뉴), 서버 중계·빈도 제한, 아바타 몸짓·말풍선·효과음, AI 사용을 구현한다.
관련 문서: [PRD 감정표현](PRD.md#감정표현-dec-056) / [API](design/API.md)
Issue·PR: [PR #84](https://github.com/moguab2808-commits/mini-project-1-1/pull/84)(중간 PR)

수용 기준:
- [x] (정상, 로컬) 숫자키·메뉴 감정표현이 실제 로컬 두 창에 전달되고 6종 몸짓·말풍선·합성 효과음을 구현했다. 6종 장면과 조준 중 손 유지·말풍선 잘림 회귀를 확인했다.
- [ ] (정상, 온라인 후속) 서버 Socket.IO 중계를 연결하고 두 계정에서 숫자키·메뉴·몸짓·말풍선·효과음을 확인한다.
- [x] (예외, 로컬) 3초 내 클라이언트 반복 입력과 2.8초 내 권한 측 조작 요청이 거부된다. 활성 단계 검사·결과 뒤 거부·재도전 초기화를 확인했다.
- [ ] (예외, 온라인 후속) 서버에서 세션 좌석에 묶어 같은 빈도 제한을 적용하고 대기실·결과 입력을 거부한다.
- [x] (정상) AI가 정한 상황에서 확률적으로 감정표현을 쓰고 3초 쿨타임을 지킨다.
- [x] (경계) 감정표현이 게임 상태·판정·전적을 바꾸지 않는다(테스트).
- [ ] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다.

로컬 우선 마무리 범위(2026-11-03 사용자 요청): `shared`·`game-runtime` 쿨타임·양쪽 중계, 로컬·AI Worker 전달, 숫자키·메뉴, 6종 몸짓·말풍선·효과음, AI 상황별 사용을 구현하고 단위·실제 브라우저로 확인한다. 서버 Socket.IO 연결·온라인 두 계정 확인은 DEC-065에 따라 후속으로 유지한다.

진행: 로컬·AI 구현·브라우저 검증·교차 리뷰를 마쳤다. 실제 AI 표현 5건 관찰, 게임 뷰·로그·종료 결과 불변 테스트 통과. 온라인 연결·확인과 이번 변경 PR·병합은 남았다.

검증 근거: [로컬·AI 마무리 검증](worklogs/2026-11-03.md#impl-015016017018-로컬ai-마무리)

## DOC-011 README 설치·실행 절차

우선순위: P2
상태: 진행 중
담당: 개발자 B·Codex(로컬)
의존성: PLAN-001 이후 실행 구성 구현(IMPL-001·IMPL-013)
범위: 실행 구성이 생긴 뒤 README에 준비 조건·설치·로컬 실행·테스트·배포 접속 절차를 실제 검증 결과와 함께 추가한다.
관련 문서: [README](../README.md) / [LOCAL](design/LOCAL.md)·[OPERATIONS](design/OPERATIONS.md)
Issue·PR: [#13](https://github.com/moguab2808-commits/mini-project-1-1/issues/13)·[PR #84](https://github.com/moguab2808-commits/mini-project-1-1/pull/84)(중간 PR)

수용 기준:
- [ ] README의 명령을 새 환경에서 그대로 따라 실행해 확인한 결과가 worklog에 있다.
- [ ] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다.

로컬 진행: README에 서버 없는 AI·로컬 2인 실행·테마·입력·재도전을 정리했다. 별도 임시 폴더에서 오프라인 `npm ci`·빌드·개발 서버 시작·AI 페이지 HTTP 200을 확인했다. 온라인·배포 절차의 새 환경 확인과 PR·병합은 후속이다.

검증 근거: [DOC-011 로컬 실행 안내 검증](worklogs/2026-11-03.md#doc-011-로컬-설치실행-안내-검증)

### IMPL-004 후속 조작 수정 (2026-11-02)

상태: 완료(IMPL-004에 포함). 사용자 요청에 따라 드래그 발사·알 오른쪽 클릭 취소, 좌석별 고정 색, E 유지 효과·피로도, 강제 1인칭·해제 시 흔들림 복귀, 방향 지정 판 돌리기를 수정한다.

- [x] 두 창에서 새 조작과 색 일치를 검증한다. ([추가 조작·시선·반응형 검증](worklogs/2026-11-02.md#impl-004-추가-조작시선반응형-검증)의 Chromium 두 창)
- [x] E 해제·포커스 이탈·빠른 해제 시 효과 종료와 피로도를 검증한다. (`aim-controller.test.ts` "E를 빠르게 떼어도 비동기 발동 응답 뒤 종료한다", `hazard-flow.test.ts`의 E 해제, `game.test.ts`의 유지 중 피로도. 포커스 이탈은 `GameScreen`의 `blur`가 같은 `releaseHazard`를 부른다)
- [x] 회귀 검증 및 리뷰를 마친다. (전체 테스트 통과, PR #60 리뷰)

검증 근거: [worklog](worklogs/2026-11-02.md#impl-004-후속-조작-수정).

### IMPL-004 추가 조작·시선·반응형 수정

상태: 완료(IMPL-004에 포함). 2026-11-02 추가 사용자 승인.

- [x] 오른쪽 클릭 취소, 좌석 색 프로필 표시, 기본 막대 2배 속도.
- [x] 막대 가속은 보유 중 상시 적용, 책상 흔들기 지급 제외, 판 돌리기는 상대 턴 사용 가능.
- [x] 오른쪽 드래그 시선 중계와 자동 고개 끄덕임 제거.
- [x] 작은 창에서도 HUD와 게임 화면이 창 크기에 맞는다.
- [x] 새 계약 회귀 검증과 이전 실패를 대조한다.

검증: [추가 조작·시선·반응형](worklogs/2026-11-02.md#impl-004-추가-조작시선반응형-검증).

### IMPL-004 화면·시점·바람·기절 수정 (DEC-038)

상태: 완료(IMPL-004에 포함). 2026-11-02 사용자 요청.

- [x] 알 위 무늬를 없애고 프로필 옆에 해당 색 알을 크게 그린다(흑·백 글자 제거).
- [x] 시점은 기본·1인칭만: 조준·발사 중에만 1인칭, 시점 버튼·숫자 키·휠 제거, 오른쪽 드래그 고개 돌리기는 놓으면 기본 복귀.
- [x] 왼쪽 버튼으로 조준하는 중에도 오른쪽 클릭으로 취소된다.
- [x] 바람은 보유 중 상시 적용, 방향이 2~4초마다 무작위로 바뀐다.
- [x] 기절 시 머리 위 별, 기절한 쪽 화면 360° 회전.
- [x] 장면을 더 밝게 한다.

검증: [화면·시점·바람·기절 수정](worklogs/2026-11-02.md#impl-004-화면시점바람기절-수정-dec-038). 바람 초당 30°·변경 간격의 체감 조정은 플레이 테스트 후속이다.

### IMPL-004 약한 방해요소 강화 (DEC-039)

상태: 완료(IMPL-004에 포함). 2026-11-02 사용자 요청.

- [x] 세기 막대 속도 배율 2 → 3.
- [x] 물총 효과를 화면 전체로 확장(전체 물막 + 고르게 퍼지는 물방울).
- [x] 판 돌리기 피로도 비용 50 → 25.

검증: [약한 방해요소 강화](worklogs/2026-11-02.md#impl-004-약한-방해요소-강화-dec-039). 체감 강도 조정은 플레이 테스트 후속이다.

## UI-004 디자인 참고 기준을 L 세트로 변경

우선순위: P1
상태: 완료
담당: Claude — 사용자 요청 수행
의존성: 없음
범위: 2026-11-04 사용자 요청에 따라 문서가 가리키는 화면 디자인 참고 기준을 `알까기 바 (2).html`·UI-001 초기 보드에서 claude.ai 디자인 캔버스의 [L 한밤의 마법 알까기](https://claude.ai/artifact/PFvjbTKVncmZLbfQAUEBVV) 세트(로그인·방 목록·방 생성)로 바꾼다([DEC-069](DECISIONS.md#결정-색인)). 세트와 PRD가 다른 배치·기능, 인게임 화풍 적용 범위, 로그인 일러스트 출처는 확정하지 않고 미정으로 둔다. 코드·화면 구현은 포함하지 않는다.
관련 문서: [PRD 화면별 요구사항](PRD.md#화면별-요구사항)·[화면 미정 사항](PRD.md#화면-미정-사항) / [LOCAL 미정 사항](design/LOCAL.md#미정-사항) / [TECH_STACK 에셋](design/TECH_STACK.md#에셋-종류별-방식)
Issue·PR: [PR #85](https://github.com/moguab2808-commits/mini-project-1-1/pull/85)

수용 기준:
- [x] (정상) PRD·LOCAL·TECH_STACK·PROGRESS에서 현재 디자인 참고 기준을 가리키는 문구가 L 세트로 바뀌었다. 과거 기록(worklog, 완료된 UI-001·002, DEC-032·036의 당시 근거)은 이력으로 두었다.
- [x] (정상) DEC-069를 추가하고 DEC-006·007·060에 대체 관계를 양쪽으로 적었다.
- [x] (예외) 세트와 PRD가 다른 배치·기능(프로필 위치, 지역 4열, 방 생성 캐릭터 창, 로그인 일러스트, 미포함 화면의 화풍)은 사용자 확정 전까지 PRD 화면 미정 사항에 남겼다.
- [x] 미정 항목의 반영 여부를 사용자와 정하고([DEC-070](DECISIONS.md#결정-색인)) PRD·LOCAL·TECH_STACK에 반영했으며 구현 작업 [IMPL-019](#impl-019-l-화풍-화면-적용)를 등록했다. 같은 날 확정한 인게임 조정([DEC-071](DECISIONS.md#결정-색인))은 [IMPL-020](#impl-020-중력-구역-화살표미끄럼-장판-설치형시선시점-조정)으로 등록했다.
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다(PR #85, 2026-11-04).

검증 근거: [2026-11-04 worklog UI-004 절](worklogs/2026-11-04.md#ui-004-디자인-참고-기준을-l-세트로-변경)

## IMPL-019 L 화풍 화면 적용

우선순위: P1
상태: 진행 중
담당: 개발자 B
의존성: UI-004, IMPL-012
범위: [DEC-070](DECISIONS.md#결정-색인)·[DEC-072](DECISIONS.md#결정-색인)·[DEC-074](DECISIONS.md#결정-색인)에 따라 [L 한밤의 마법 알까기](https://claude.ai/artifact/PFvjbTKVncmZLbfQAUEBVV) 세트의 화풍과 배치를 로그인·회원등록, 로비(오른쪽 위 프로필 명판·버튼, 방 테마별 지역 4열 방 목록), 방 생성 창(왼쪽 캐릭터 전신 창), 대기실, 플로팅 창(캐릭터 꾸미기·환경설정·코드 입력·규칙 카드), 토스트, 부팅·연결 중 화면에 적용한다. 첫 PR로 공통 기반(화풍 파일 `packages/client/src/ui/theme.css`·글꼴·일러스트 WebP)을 먼저 병합해 A·B가 나눠 진행하게 한다([DEC-073](DECISIONS.md#결정-색인)·[DEC-074](DECISIONS.md#결정-색인)). 방 생성 창의 캐릭터 전신은 B가 만든 3D 전신(`avatar-figure.ts`)을 쓰고 WebGL을 쓸 수 없으면 2D 얼굴로 대신한다([DEC-074](DECISIONS.md#결정-색인)). 인게임 HUD·결과창은 [IMPL-021](#impl-021-인게임-hud결과-화풍)이 맡는다. 방 참여 동작([DEC-024](DECISIONS.md#결정-색인))·서버 API는 바꾸지 않는다.
관련 문서: [PRD 화면별 요구사항](PRD.md#화면별-요구사항)·[화면 미정 사항](PRD.md#화면-미정-사항) / [TECH_STACK 에셋](design/TECH_STACK.md#에셋-종류별-방식)
Issue·PR: [#86](https://github.com/moguab2808-commits/mini-project-1-1/issues/86)

수용 기준:
- [ ] (정상) 첫 PR(공통 기반): `theme.css`의 변수·클래스(DEC-072 ②), Jua·Black Han Sans woff2 직접 제공과 CREDITS 기록, 일러스트 WebP(400KB 이하 목표) 교체가 병합됐다. `AvatarFullBody`는 만들지 않는다([DEC-074](DECISIONS.md#결정-색인)).
- [ ] (정상) 로그인 화면이 일러스트를 배경으로 쓰고, 로그인·회원등록 탭·입력·버튼이 그림 가운데를 가리지 않는다. 기존 검증·안내 문구는 그대로다.
- [ ] (정상) 로비가 오른쪽 위 프로필 명판(캐릭터·닉네임·전적·승률·환경설정·로그아웃)과 코드 입력·방 생성·즉시 참가 버튼, 새로고침, 방 테마별 지역 4열 방 목록(열마다 대기·전체 수, 열 안 스크롤)을 보인다. 대기 중만 보기 필터는 없다. 방 선택·입장·더블클릭·게임 중 표시·비공개 코드 입력 동작은 그대로다.
- [ ] (정상) 방 생성 창 왼쪽에 투명 창과 내 캐릭터 3D 전신(`avatar-figure.ts`)이 내 외형으로 보이고 오른쪽 설정·만들기 동작은 그대로다.
- [ ] (예외) WebGL을 쓸 수 없으면 방 생성 창 왼쪽에 2D 얼굴(`AvatarFace`)이 대신 보이고 방 만들기는 그대로 된다.
- [ ] (정상) 대기실·플로팅 창·토스트·부팅 화면이 같은 화풍이다.
- [ ] (예외) 방이 없는 지역 열은 빈 상태 문구를 보이고, 한 지역에 방이 많으면 그 열만 스크롤된다. 창 폭 1100px 미만이면 지역 열이 2×2로 접히고 버튼·명판이 겹치지 않는다.
- [ ] (정상) `npm run build`·`npm test`·린트가 통과하고 두 계정 브라우저로 로그인→로비→방 생성→대기실 흐름을 확인했다.
- [ ] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: [2026-11-04 worklog IMPL-019 공통 기반](worklogs/2026-11-04.md#impl-019-공통-기반-첫-pr-themecss글꼴일러스트)(첫 PR 진행 중, 나머지 기준은 미작성)

## IMPL-020 중력 구역 화살표·미끄럼 장판 설치형·시선·시점 조정

우선순위: P1
상태: 진행 중
담당: 개발자 A
의존성: IMPL-016
범위: [DEC-071](DECISIONS.md#결정-색인)에 따라 ① 중력 구역 방향 화살표를 판 평면 위에 평평하게 그리고 ② 미끄럼 장판을 끈끈이처럼 위치를 지정해 설치하는 원형 영역(지름 26.4cm)으로 바꾸며 ③ 인게임 캐릭터의 기본 얼굴 방향을 조금 위로 들고 ④ 정면을 볼 때 상대가 화면 가운데에 더 가깝게 보이도록 기본 시점을 살짝 낮춘다. `shared` 스키마(`ice_floor` target·params), `game-core` 효과, AI 배치, 클라이언트 입력·표시를 함께 바꾼다.
관련 문서: [PRD 추가 방해요소](PRD.md#추가-방해요소-10종-dec-055)·[게임 화면](PRD.md#게임-화면) / [GAME](design/GAME.md#추가-방해요소-10종과-턴-교체-haz-001)·[API](design/API.md)·[LOCAL](design/LOCAL.md)
Issue·PR: [#87](https://github.com/moguab2808-commits/mini-project-1-1/issues/87)

수용 기준:
- [x] (정상) 중력 구역의 배치 미리보기와 설치 뒤 화살표가 판 평면 위에 평평하게 보이고, 판 돌리기 뒤에도 같은 평면에서 방향이 맞다.
- [x] (정상) 미끄럼 장판은 E 뒤 판 위를 클릭해 설치하고 ESC·오른쪽 클릭으로 취소한다. 원 안을 지나는 지면 알만 감속 ×0.4가 적용되고 원 밖 알은 그대로다. 13초 뒤 사라진다.
- [x] (예외) 판 밖·다른 설치물과 겹치는 자리는 빨간 후보로 표시되고 `HAZARD_INVALID_TARGET`으로 거부되며 상태·난수를 바꾸지 않는다. `target` 누락은 `INVALID_INPUT`이다.
- [x] (정상) AI는 미끄럼 장판을 배치 가능한 후보 중 무작위 위치에 둔다.
- [x] (정상) 기본 자세에서 캐릭터 얼굴이 이전보다 위쪽(상대 쪽)을 향하고, 기본 시점에서 상대 캐릭터가 화면 가운데에 더 가깝게 보인다. 바꾼 각도·높이 값을 GAME 또는 LOCAL 설계에 적었다.
- [x] (정상) `game-core`·`shared` 단위 테스트와 로컬 2인·AI 경기로 확인했다.
- [ ] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: [2026-11-04 worklog IMPL-020](worklogs/2026-11-04.md#impl-020-중력-구역-화살표미끄럼-장판-설치형시선시점-조정)(리뷰·병합 전)

## IMPL-021 인게임 HUD·결과 화풍

우선순위: P1
상태: 예정
담당: 개발자 A
의존성: [IMPL-019](#impl-019-l-화풍-화면-적용)의 첫 PR(공통 기반, [DEC-073](DECISIONS.md#결정-색인))
범위: [DEC-070](DECISIONS.md#결정-색인)·[DEC-072](DECISIONS.md#결정-색인)에 따라 인게임 HUD(프로필·남은 시간·라운드·방해요소 칸·받음 카드·발동 안내·판 돌리기·감정표현·기권)와 결과창(재도전하기·나가기)에 L 화풍을 적용한다. 공통 기반은 IMPL-019 첫 PR이 만든다([DEC-073](DECISIONS.md#결정-색인)·[DEC-074](DECISIONS.md#결정-색인)). HUD 배치·동작과 3D 장면은 바꾸지 않는다(시선·시점은 IMPL-020).
관련 문서: [PRD 게임 화면](PRD.md#게임-화면) / [TECH_STACK 에셋](design/TECH_STACK.md#에셋-종류별-방식)
Issue·PR: [#87](https://github.com/moguab2808-commits/mini-project-1-1/issues/87)

수용 기준:
- [ ] (정상) HUD와 결과창이 `theme.css`의 화풍(반투명 원목·금빛 테두리·광택 버튼·글꼴)으로 보이고, 장면을 가리지 않도록 프로필은 지금처럼 배경 없이 둔다. 배치·동작·키는 그대로다.
- [ ] (예외) 작은 창(현재 반응형 기준)에서도 HUD 요소가 겹치지 않고 글자가 읽힌다.
- [ ] (정상) 로컬 2인·AI 경기로 경기 진행·결과·재도전 화면을 확인했다.
- [ ] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: 미작성
