# 기술·서비스·에셋

## 상태

| 구분 | 상태 |
| --- | --- |
| 승인된 미구현 설계 | 기술 스택·배포 서비스 ([DEC-013](../DECISIONS.md#결정-색인), [ADR-0003](../adr/0003-tech-stack-and-architecture.md)) |
| 현재 구현 | 없음 |
| 미정 | 라이브러리 세부 버전, 에셋 조달 방식·한도(ASSET-001 제안, 승인 전) |

이 문서는 채택한 도구·서비스와 에셋 조달 후보를 관리한다. 채택 이유·대안·절충은 [ADR-0003](../adr/0003-tech-stack-and-architecture.md)에 있고, 구체적인 계약은 [DESIGN](../DESIGN.md)의 상세 문서에 둔다.

## 채택한 기술

| 영역 | 채택 | 관련 설계 |
| --- | --- | --- |
| 언어·저장소 | TypeScript, npm workspaces 모노레포 (`client`, `server`, `game-core`, `game-runtime`, `shared`) | [LOCAL](LOCAL.md) |
| 클라이언트 | Vite, React, React Router, Zustand, 일반 CSS(CSS Modules) | [LOCAL](LOCAL.md) |
| 렌더링 | Three.js, React Three Fiber, drei | [GAME](GAME.md) |
| 오디오 | Howler.js | [OPERATIONS](OPERATIONS.md) |
| 서버·통신 | Node.js 24 LTS, Express, Socket.IO | [API](API.md) |
| 물리 | 직접 구현 (2D 원 충돌 + 높이), `game-core`에 포함 | [GAME](GAME.md) |
| 검증·인증 | Zod, express-session, connect-pg-simple, @node-rs/argon2 (argon2id) | [AUTH](AUTH.md) |
| 저장 | PostgreSQL (Neon 무료 플랜), Drizzle ORM, node-postgres(pg) | [DATABASE](DATABASE.md) |
| 배포 | Render 무료 웹 서비스 1개 + 외부 헬스체크 요청, 싱가포르 리전 | [OPERATIONS](OPERATIONS.md) |
| 품질 | Vitest, ESLint, Prettier, tsx, tsup | [LOCAL](LOCAL.md)·[검증 계획](../ENGINEERING-VALIDATION.md) |

`game-runtime`은 서버·로컬 2인·AI 대전이 함께 쓰는 경기 실행 패키지로 [DEC-030](../DECISIONS.md#결정-색인)에서 추가했다. ADR-0003의 패키지 목록은 결정 당시 기록이라 고치지 않았다.

라이브러리 버전은 구현을 시작할 때 고정하고 lock 파일로 관리한다.

## 에셋 조달 계획 (ASSET-001 제안)

상태: [ASSET-001](../TASKS.md#asset-001-에셋-조달-계획) 제안이며 승인 전이다. 아래 방식·한도는 리뷰 후 확정하고, 확정되면 DECISIONS에 기록한다. 라이선스 확인일은 공식 페이지를 직접 읽은 날이며, 읽지 못한 항목은 "미확인"으로 둔다.

원칙: ① 직접 만들 수 있는 것은 직접 만든다(코드 도형·SVG·효과음 생성 도구). ② 외부 에셋은 **CC0**를 우선하고 CC BY는 직접 제작이 어려울 때만 쓴다. ③ **CC BY-NC·약관 미확인 출처**는 쓰지 않는다. ④ 외부 에셋을 저장소에 넣을 때는 같은 PR에서 CREDITS에 기록한다.

### 에셋 종류별 방식

| 에셋 | 1순위 방식 | 보조 출처 | 라이선스·확인일 | 비고 |
| --- | --- | --- | --- | --- |
| 판·알·조명 | 코드 기본 도형(Three.js). 알 무늬(테두리)는 도형·머티리얼로 표현 | — | 해당 없음(직접 제작) | 알 색·무늬 구분 요구는 [비기능](../PRD.md#4-비기능-요구사항과-제약) |
| 판 나무 텍스처 | 단색·절차 생성 우선 | Poly Haven, ambientCG | 둘 다 CC0·2026-10-30 확인(출처 표기 불필요) | 쓰면 1K 이하로 줄여 반입 |
| 동물 캐릭터 3D 6종(곰·고양이·여우·토끼·부엉이·개구리) | 코드 도형 조합 로우폴리 | Quaternius, Kenney | Quaternius CC0·Kenney CC0, 2026-10-30 확인 | 6종이 모두 있는 팩이 있는지는 미확인. 없으면 도형 조합으로 간다 |
| 프로필·방 카드 2D 얼굴 | 직접 제작 SVG(디자인 캔버스 Avatar 부품 기반) | — | 해당 없음(직접 제작) | 캔버스 시안의 SVG를 그대로 쓸 수 있다 |
| UI 아이콘(자물쇠·톱니·새로고침 등) | 직접 제작 SVG | Kenney UI | Kenney CC0·2026-10-30 확인 | |
| 방해요소 아이콘 9종 + 에어컨·바람 화살표 | 직접 제작 SVG | game-icons.net | game-icons.net은 **CC BY 3.0, 저자 표기 필수**·2026-10-30 확인 | 쓰면 CREDITS에 저자·아이콘 이름을 적고 크레딧 표시 위치를 PRD에서 정해야 한다(미정). AI 생성 이미지는 약관·권리를 확인하지 못해 채택하지 않는다 |
| 효과음 10종(발사, 알 충돌, 알 떨어짐, 내 턴 시작, 시간 5초 남음, 방해요소 받음, 방해요소 발동, 승리, 패배, 무승부) | jsfxr·ChipTone으로 직접 생성 | Kenney 오디오, Freesound(CC0만) | Kenney CC0·Freesound 개별 라이선스 3종(CC0·CC BY·CC BY-NC)·2026-10-30 확인. jsfxr·ChipTone 이용 약관은 **미확인** | Freesound는 CC0 음원만 쓰고 CC BY-NC는 금지한다. Pixabay는 오디오 약관을 확인하지 못해 후보에서 뺀다 |
| 글꼴 | Jua(Google Fonts) | — | 라이선스 **미확인** | 시안이 쓰는 글꼴이다. 반입 전에 확인하고 CREDITS에 적는다 |

### 라이선스 기록

- 위치: 저장소 루트의 `docs/CREDITS.md`를 **외부 에셋을 처음 반입하는 PR에서 만든다**. 지금은 만들지 않는다. 만들 때 [AGENTS](../../AGENTS.md)의 문서 표를 같은 변경에서 갱신한다.
- 기록 항목: 에셋 이름, 파일 경로, 출처 URL, 라이선스, 저자(CC BY일 때), 확인일, 변경 여부.
- 직접 제작한 에셋은 기록하지 않는다. 도구(jsfxr 등)로 만든 효과음은 생성 도구와 이용 약관 확인일을 적는다.

### 용량 한도 (제안)

| 대상 | 한도 | 형식 |
| --- | --- | --- |
| 텍스처 | 개당 1024px 이하, 300KB 이하 | WebP 또는 JPEG |
| 3D 모델 | 캐릭터 개당 200KB 이하, 모델 전체 1.5MB 이하 | GLB |
| 효과음 | 개당 50KB 이하, 전체 500KB 이하 | OGG 또는 MP3 |
| SVG 아이콘 | 개당 10KB 이하 | SVG |
| 첫 로드 에셋 합계 | 3MB 이하(압축 전송 기준) | — |

한도의 근거는 [비기능 요구사항](../PRD.md#4-비기능-요구사항과-제약)의 첫 접속 대기 5초와 월 운영 비용 0원이다. 수치는 측정으로 얻은 값이 아닌 추정이며, 실제 로드 시간은 [VAL-001](../TASKS.md#val-001-성능-측정-절차와-플레이-테스트-기록-양식)에서 재면서 조정한다.

### 미정

- game-icons.net 등 CC BY 에셋을 쓸 때 크레딧을 표시할 화면 위치(PRD 화면 요구사항 변경 필요).
- Quaternius·Kenney에 동물 6종이 있는지, 있다면 한도 안에 드는지.
- Jua·jsfxr·ChipTone의 이용 조건.
