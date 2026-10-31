# 기술·서비스·에셋

## 상태

| 구분 | 상태 |
| --- | --- |
| 승인된 미구현 설계 | 기술 스택·배포 서비스 ([DEC-013](../DECISIONS.md#결정-색인), [ADR-0003](../adr/0003-tech-stack-and-architecture.md)) |
| 현재 구현 | 프로젝트 골격(npm workspaces 5개 패키지·빌드·테스트·린트, [IMPL-001](../TASKS.md#impl-001-프로젝트-골격)). 병합 전 |
| 승인된 에셋 조달 방식 | 종류별 방식·기록 위치·용량 한도([DEC-033](../DECISIONS.md#결정-색인)) |
| 미정 | 골격에 없는 라이브러리의 버전(쓰는 작업에서 고정), Claude·효과음 도구·글꼴 이용 조건 확인(구현 단계) |

이 문서는 채택한 도구·서비스와 에셋 조달 방식을 관리한다. 채택 이유·대안·절충은 [ADR-0003](../adr/0003-tech-stack-and-architecture.md)에 있고, 구체적인 계약은 [DESIGN](../DESIGN.md)의 상세 문서에 둔다.

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

## 에셋 조달 계획

상태: [ASSET-001](../TASKS.md#asset-001-에셋-조달-계획)에서 사용자가 방식을 정했다([DEC-033](../DECISIONS.md#결정-색인)). 라이선스 확인일은 공식 페이지를 직접 읽은 날이며 읽지 못한 항목은 "미확인"으로 둔다.

원칙: ① 직접 만들 수 있는 것은 직접 만든다. ② 외부 에셋을 반입할 때는 CC0를 우선하고 CC BY-NC·약관 미확인 출처는 쓰지 않는다. ③ 도구·외부 출처를 쓴 에셋은 같은 PR에서 [CREDITS](../CREDITS.md)에 기록한다.

### 에셋 종류별 방식

| 에셋 | 방식 | 라이선스·확인 | 비고 |
| --- | --- | --- | --- |
| 판·알·조명·배경 | 코드 기본 도형(Three.js). 알 무늬는 도형·머티리얼로 표현 | 해당 없음(직접 제작) | 판 나무 질감이 필요하면 단색·절차 생성을 먼저 쓰고, 텍스처는 Poly Haven·ambientCG(둘 다 CC0, 2026-10-30 확인)만 후보 |
| 동물 캐릭터 3D 6종(곰·고양이·여우·토끼·부엉이·개구리) | 코드 도형 조합 로우폴리 | 해당 없음(직접 제작) | 외부 모델 팩은 쓰지 않는다. 6종의 모양 구분은 구현 시 정한다 |
| 프로필·방 카드 2D 얼굴, UI 아이콘 | 직접 제작 SVG(디자인 캔버스 Avatar 부품 기반) | 해당 없음(직접 제작) | |
| 방해요소 아이콘 9종 + 에어컨·바람 화살표 | **AI 생성(Claude), SVG 코드로 작성**(래스터 이미지 아님) | Claude 이용 약관 **미확인** | 9종이 한 스타일로 보이도록 같은 프롬프트 틀을 쓴다. 반입할 때 생성 도구(Claude)와 이용 조건 확인일을 CREDITS에 적는다 |
| 효과음 10종(발사, 알 충돌, 알 떨어짐, 내 턴 시작, 시간 5초 남음, 방해요소 받음, 방해요소 발동, 승리, 패배, 무승부) | jsfxr·ChipTone **전부 자체 생성** | 도구 이용 약관 **미확인**(sfxr.me 접속 실패) | 외부 음원은 쓰지 않는다. 승패 소리가 어색하면 별도 결정으로 보완한다 |
| 글꼴 | Jua(Google Fonts) | **미확인** | 시안이 쓰는 글꼴이다. 반입 전에 확인하고 CREDITS에 적는다 |

### 라이선스 기록

- 위치: [docs/CREDITS.md](../CREDITS.md) 한 곳. 직접 제작한 에셋은 적지 않고, AI·생성 도구·외부 출처를 쓴 에셋만 적는다.
- 기록 항목: 에셋 이름, 파일 경로, 출처 또는 도구, 이용 조건(라이선스·약관), 확인일, 변경 여부.

### 용량 한도

| 대상 | 한도 |
| --- | --- |
| 텍스처 이미지 | 개당 최대 1024px |
| SVG 아이콘 | 개당 10KB |
| 효과음 | 파일당 100KB, 전체 1MB |
| 에셋 전체 | 5MB |

근거는 [비기능 요구사항](../PRD.md#4-비기능-요구사항과-제약)의 Render 무료 서비스·월 비용 0원·모바일 로딩이다. 수치는 측정값이 아니라 보수적으로 잡은 한도이며 실제 로드 시간은 [VAL-001](../TASKS.md#val-001-성능-측정-절차와-플레이-테스트-기록-양식)에서 재면서 조정한다.

### 미정

- Claude 이용 약관, jsfxr·ChipTone·Jua의 이용 조건 확인: 사용자가 구현 단계(에셋 반입 시)에 해도 된다고 했다.
