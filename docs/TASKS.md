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

우선순위는 P0(현재 진행을 막는 작업), P1(다음 착수 대상), P2(이후 검토)로 표시한다. 우선순위·작업 등록은 미정 제품 정책·기술안을 승인하는 행위가 아니다.

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
| [UI-002](#ui-002-디자인-캔버스-현재-요구사항-반영) | 디자인 캔버스 현재 요구사항 반영 | P1 | 없음 | 완료 | 개발자 A | [#5](https://github.com/moguab2808-commits/mini-project-1-1/issues/5) |
| [ASSET-001](#asset-001-에셋-조달-계획) | 에셋 조달 계획 | P2 | DOC-010 | 완료 | 개발자 A | [#6](https://github.com/moguab2808-commits/mini-project-1-1/issues/6)·[PR #28](https://github.com/moguab2808-commits/mini-project-1-1/pull/28) |
| [VAL-001](#val-001-성능-측정-절차와-플레이-테스트-기록-양식) | 성능 측정 절차와 플레이 테스트 기록 양식 | P1 | 없음 | 예정 | 개발자 A | [#7](https://github.com/moguab2808-commits/mini-project-1-1/issues/7) |
| [API-001](#api-001-api실시간-이벤트-계약-확정) | API·실시간 이벤트 계약 확정 | P0 | GAME-001 | 완료 | 개발자 B | [#8](https://github.com/moguab2808-commits/mini-project-1-1/issues/8)·[PR #22](https://github.com/moguab2808-commits/mini-project-1-1/pull/22) |
| [API-002](#api-002-api-이름식별자-확인과-private-뷰-필드-확정) | API 이름·식별자 확인과 private 뷰 필드 확정 | P1 | API-001 | 예정 | 개발자 A | 미생성 |
| [DB-001](#db-001-db-스키마-확정) | DB 스키마 확정 | P0 | DOC-010 | 완료 | 개발자 B | [#9](https://github.com/moguab2808-commits/mini-project-1-1/issues/9)·[PR #23](https://github.com/moguab2808-commits/mini-project-1-1/pull/23) |
| [AUTH-001](#auth-001-인증-상세-설계-확정) | 인증 상세 설계 확정 | P0 | DOC-010 | 완료 | 개발자 B | [#10](https://github.com/moguab2808-commits/mini-project-1-1/issues/10)·[PR #24](https://github.com/moguab2808-commits/mini-project-1-1/pull/24) |
| [OPS-001](#ops-001-운영-설계-확정) | 운영 설계 확정 | P1 | DOC-010 | 완료 | 개발자 B | [#11](https://github.com/moguab2808-commits/mini-project-1-1/issues/11)·[PR #26](https://github.com/moguab2808-commits/mini-project-1-1/pull/26) |
| [PLAN-001](#plan-001-구현-작업-등록) | 구현 작업 등록 | P0 | GAME-001, LOCAL-001, API-001, DB-001, AUTH-001 | 진행 중 | 개발자 B | [#12](https://github.com/moguab2808-commits/mini-project-1-1/issues/12) |
| [DOC-011](#doc-011-readme-설치실행-절차) | README 설치·실행 절차 | P2 | PLAN-001 이후 실행 구성 구현 | 예정 | 개발자 B | [#13](https://github.com/moguab2808-commits/mini-project-1-1/issues/13) |

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
Issue·PR: [#5](https://github.com/moguab2808-commits/mini-project-1-1/issues/5)

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
Issue·PR: [#6](https://github.com/moguab2808-commits/mini-project-1-1/issues/6)

수용 기준:
- [x] 에셋 종류마다 출처 또는 제작 방법과 라이선스 확인일이 정해졌다.
- [x] 출처·라이선스 기록 위치와 텍스처·오디오 용량 한도가 정해졌다.
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다.

1번 해석: 이용 조건 확인일이 "미확인"인 항목(Claude·jsfxr·ChipTone·Jua)은 사용자가 구현 단계(반입 시)로 미뤘고([DEC-033](DECISIONS.md#결정-색인)), 방식이 정해졌으면 충족으로 보았다. 미확인 항목은 TECH_STACK 미정에 남아 있다.

검증 근거: [2026-10-30 worklog](worklogs/2026-10-30.md#asset-001-에셋-조달-계획)

## VAL-001 성능 측정 절차와 플레이 테스트 기록 양식

우선순위: P1
상태: 예정
담당: 개발자 A
의존성: 없음
범위: PRD의 fps 목표(평균 60fps 근접, 하위 5% 30fps 이상) 측정 절차와 성공 기준 판정용 플레이 테스트 기록 양식을 만든다.
관련 문서: [ENGINEERING-VALIDATION](ENGINEERING-VALIDATION.md) / [성공 기준](PRD.md#5-성공-기준)·[비기능 요구사항](PRD.md#4-비기능-요구사항과-제약)
Issue·PR: [#7](https://github.com/moguab2808-commits/mini-project-1-1/issues/7)

수용 기준:
- [ ] fps 측정 도구·구간·기록 형식이 정해졌다.
- [ ] 성공 기준 5개마다 기록할 항목과 판정식이 있는 양식이 있다.
- [ ] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: 작업 시 날짜별 worklog의 해당 작업 절

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
- [x] 방 이벤트(`room:create`·`room:join`·`room:quickJoin`·`room:leave`·`room:start`)의 필드와 방 입장 오류(`INVALID_CODE`·`ROOM_FULL`·`ROOM_PLAYING`·`ROOM_NOT_FOUND`)가 정의되고, `GET /api/rooms` 응답에 비공개 방의 코드가 없다. (방 생성 거부 `CODE_TAKEN`·`ALREADY_IN_ROOM`, `room:start` 거부 `NOT_IN_ROOM`·`NOT_HOST`·`ROOM_NOT_READY` 추가)
- [x] 인증 오류와 방·발사 오류가 REST·ack 공통의 오류 코드 목록 한 곳으로 합쳐졌고 AUTH-001과 일치한다. ([API 오류 코드 표](design/API.md#오류-형식과-코드) 한 곳에 인증·방·발사·방해요소 코드가 있고, [AUTH](design/AUTH.md#오류-형식)가 이 표를 참조하며 인증 코드 5종이 같음을 대조)
- [x] 이벤트 순서(방 생성 → 시작 → 턴 → 종료 → 재도전)가 순서도로 있다. ([API 이벤트 순서](design/API.md#이벤트-순서)의 sequenceDiagram과 순서 규칙 7개)
- [x] 상대에게 전송되는 이벤트에 상대 보유 방해요소 정보가 없음을 필드 단위로 확인했다. ([API 상대 비공개 필드 점검](design/API.md#상대-비공개-필드-점검). 계약 문서의 필드 목록 대조이며 구현 후 `getViewFor` 테스트로 다시 검증)
- [x] GAME-001 담당자가 이벤트 순서를 검토했다. (개발자 A가 [PR #22](https://github.com/moguab2808-commits/mini-project-1-1/pull/22) 리뷰에서 순서·교체 지급 순서를 GAME과 대조해 모순 없음을 확인하고, 사용자에게도 검토 완료를 전달)
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #22, `main` d39ce7d)

검증 근거: [2026-10-30 worklog](worklogs/2026-10-30.md#api-001-방해요소-거부-오류-코드-반영)·[필드·순서 확정안](worklogs/2026-10-30.md#api-001-필드순서도비공개-점검-추가)

후속: 새 오류 코드·식별자 이름 확인과 본인 private 뷰의 게이지·쿨타임 필드 이름은 [API-002](#api-002-api-이름식별자-확인과-private-뷰-필드-확정)에서 다룬다. `Seat` 값의 `…Id` 이름은 PLAN-001 묶음 2(`game-core`·`shared`)에서 스키마를 만들 때 정한다.

## API-002 API 이름·식별자 확인과 private 뷰 필드 확정

우선순위: P1
상태: 예정
담당: 개발자 A
의존성: API-001
범위: API-001 완료 때 남긴 후속이다. 개발자 B가 정하고 A가 확인하지 않은 이름을 확인하고, 본인 private 뷰의 게이지·쿨타임 필드 이름을 A가 GAME에서 정한 뒤 API에 반영한다. 새 제품 정책을 정하지 않는다.
관련 문서: [API](design/API.md) / [GAME](design/GAME.md#상태-위치와-플레이어별-뷰)·[LOCAL](design/LOCAL.md) / [API-001](#api-001-api실시간-이벤트-계약-확정)
Issue·PR: 미생성

수용 기준:
- [ ] 새 오류 코드 9종(`ALREADY_IN_ROOM`·`NOT_IN_ROOM`·`NOT_HOST`·`ROOM_NOT_READY`·`GAME_NOT_ACTIVE`·`NOT_YOUR_TURN`·`INVALID_STONE`·`PLAYER_STUNNED`·`REMATCH_NOT_AVAILABLE`)과 `HAZARD_*` 4종, `HazardKind`·`CharacterId`·`BoardId` 식별자, `game:over.reason` 값을 A가 확인하고 바꿀 이름이 있으면 API·LOCAL·GAME에 반영됐다.
- [ ] 본인 private 뷰의 게이지·쿨타임·사용 가능 여부 필드 이름이 GAME에 정해지고 API의 `GameView.private`에 반영됐다.
- [ ] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: 작업 시 날짜별 worklog의 해당 작업 절

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
Issue·PR: [#11](https://github.com/moguab2808-commits/mini-project-1-1/issues/11)

수용 기준:
- [x] OPERATIONS의 미정 사항이 모두 방식으로 정해지고 무료 조건 재확인 날짜가 기록됐다. ([무료 조건 재확인](design/OPERATIONS.md#무료-조건-재확인-2026-10-30) 2026-10-30. `[제안]` 표시를 확정하고 `rooms` 정리·음량 저장·민감정보 제거·부하 측정 항목을 정했다. 지속 요청 사용 여부는 DEC-029대로 구현 단계 판단이며 운영 방식은 정해 두었다)
- [x] 동시 이탈·시작 직전 이탈 판정에 쓸 로그 항목이 GAME-001의 로그 필드와 맞춰 정해졌다. ([서버 로그](design/OPERATIONS.md#서버-로그)의 필드가 [GAME 명령 경합](design/GAME.md#명령-경합과-시간)과 같고, `start_commit`·`leave`의 `ingressSeq` 비교로 판정한다)
- [x] Neon 기본 복구의 가능 기간과 한계(보관 무제한 정책과의 차이), 수동 배포·롤백 방법이 공식 문서로 확인되어 기록됐다. ([백업·복구](design/OPERATIONS.md#백업복구) 6시간·1 GB 상한, [배포·롤백](design/OPERATIONS.md#배포롤백) Render 공식 문서 2026-10-30)
- [x] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다. (PR #26. 개발자 A 검토를 반영했고, 병합 전에 체크했다)

검증 근거: [2026-10-30 worklog](worklogs/2026-10-30.md#ops-001-미충족-수용-기준-보완)

## PLAN-001 구현 작업 등록

우선순위: P0
상태: 진행 중
담당: 개발자 B
의존성: GAME-001, LOCAL-001, API-001, DB-001, AUTH-001
범위: 확정된 설계를 바탕으로 구현 작업을 기능 ID와 정상·오류·예외 수용 기준으로 TASKS에 등록하고 A·B에 배분한다. 로컬 2인 모드 작업을 먼저 둔다. 공통 실행 모듈 `game-runtime`(B)과 로컬·AI 워커 연결(A)을 별도 작업으로 나눈다([DEC-030](DECISIONS.md#결정-색인)). 모노레포 도구는 [ADR-0003](adr/0003-tech-stack-and-architecture.md)의 npm workspaces로 정해져 있어 별도 결정이 필요 없고, `game-runtime`을 패키지에 추가한다. 아래 작업 분해를 기준으로 하며, 별도 작업 항목과 Issue는 해당 설계가 확정된 뒤 이 분해에서 하나씩 등록한다.
관련 문서: [PRD 수용 기준 작성 예시](PRD.md#수용-기준-작성-예시) / [DESIGN](DESIGN.md) / [LOCAL 패키지 구성](design/LOCAL.md#패키지-구성-승인)·[GAME 구현 경계](design/GAME.md#구현-경계-ab) / [DEC-030](DECISIONS.md#결정-색인)
Issue·PR: [#12](https://github.com/moguab2808-commits/mini-project-1-1/issues/12)

작업 분해 (초안): 담당의 "(제안)"은 개발자 A 확인 전이다. 순서는 위에서 아래이며 선행 설계는 TASKS의 해당 작업을 가리킨다.

| 묶음 | 내용 | 담당 | 선행 설계 |
| --- | --- | --- | --- |
| 1. 프로젝트 골격 | npm workspaces 5개 패키지(`client`·`server`·`shared`·`game-core`·`game-runtime`), 패키지 의존 경계 린트, 테스트·빌드 스크립트, `.env.example` | B | DOC-010 |
| 2. `game-core` | 규칙·물리·상태 머신·`getViewFor` | A (제안) | GAME-001, GAME-002(수치 기본값) |
| 3. `game-runtime` | 명령 큐·고정 틱 스케줄러·뷰 배포, 시계·전송·로거·종료 콜백 주입 | B | GAME-001, LOCAL-001, 묶음 2의 입력·출력 시그니처 선공개 |
| 4. 로컬 2인 모드 | `LocalGameSession`, SharedWorker 연결, 3D 화면, 방해요소 입력 | A (제안) | LOCAL-001, UI-002, ASSET-001 |
| 5. AI 대전 | `AiGameSession`, AI 컨트롤러 | A (제안) | LOCAL-001 |
| 6. DB·마이그레이션 | Drizzle 스키마(users·rooms·세션), 마이그레이션, 연결 풀 | B | DB-001 |
| 7. 인증 | 가입·로그인·세션·요청 빈도 제한·비밀번호·캐릭터 변경 | B | AUTH-001, API-001 |
| 8. 로비·방 (서버) | 방 목록 조회, 방 이벤트, `rooms` 상태 갱신 | B | API-001, DB-001 |
| 9. 온라인 대전 (서버) | 서버 전송 연결, 이탈·중복 접속 처리 | B | API-001, 묶음 3 |
| 10. 온라인 대전 (클라이언트) | `RemoteGameSession`·`RoomClient` | A (제안) | API-001, 묶음 3 |
| 11. 경기 종료 전적 | `finishOnce`, 전적 갱신 트랜잭션 | B | DB-001, 묶음 3 |
| 12. 계정·로비·대기실·결과 화면 | 로그인·가입·로비·방 목록·방 생성·대기실·결과 화면 (PRD 화면 요구사항 구현. 방 관련 화면은 여기에 포함) | A (제안) | UI-002, API-001 |
| 13. 배포 | Render·Neon 설정, 헬스체크, 로그, 수동 배포·롤백 | B | OPS-001 |

의존성 순서는 골격 → `game-core`·`game-runtime`(묶음 3은 묶음 2의 입력·출력 시그니처를 먼저 공유한 뒤 병행) → 로컬 2인 모드·AI 대전 → DB·인증·로비·방(서버) → 온라인 대전(서버·클라이언트) → 전적 → 배포이다. 각 묶음의 정상·오류·예외 수용 기준은 별도 작업으로 등록할 때 PRD 수용 기준 예시(`ROOM-JOIN`·`HAZARD-GRANT`·`HAZARD-USE`·`TURN-TIMEOUT`·`LEAVE-FORFEIT`)에 맞춰 쓴다.

수용 기준:
- [ ] 로컬 2인 모드부터 온라인 배포까지의 구현 작업이 의존성 순서로 등록됐다.
- [ ] 각 작업에 검증 가능한 수용 기준과 담당이 있다.
- [ ] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: [2026-10-30 worklog](worklogs/2026-10-30.md#plan-001-구현-작업-등록-작업-분해-초안)

남은 조건: 담당 "(제안)" 항목과 B의 분량(묶음 1·3·6·7·8·9·11·13)은 개발자 A의 확인을 받는다. API-001·DB-001·AUTH-001이 확정되기 전이라 인증·로비·방·온라인 대전·전적 묶음의 상세는 설계 확정 후 정한다. 이 PR은 중간 PR이라 위 수용 기준은 체크하지 않는다.

## DOC-011 README 설치·실행 절차

우선순위: P2
상태: 예정
담당: 개발자 B
의존성: PLAN-001 이후 실행 구성 구현
범위: 실행 구성이 생긴 뒤 README에 준비 조건·설치·로컬 실행·테스트·배포 접속 절차를 실제 검증 결과와 함께 추가한다.
관련 문서: [README](../README.md) / [LOCAL](design/LOCAL.md)·[OPERATIONS](design/OPERATIONS.md)
Issue·PR: [#13](https://github.com/moguab2808-commits/mini-project-1-1/issues/13)

수용 기준:
- [ ] README의 명령을 새 환경에서 그대로 따라 실행해 확인한 결과가 worklog에 있다.
- [ ] 변경·검증 결과를 worklog에 기록하고 리뷰 후 기준 브랜치에 병합됐다.

검증 근거: 작업 시 날짜별 worklog의 해당 작업 절
