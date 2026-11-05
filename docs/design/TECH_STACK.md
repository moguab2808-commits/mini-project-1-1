# 기술·서비스·에셋

## 상태

| 구분 | 상태 |
| --- | --- |
| 승인된 미구현 설계 | 기술 스택·배포 서비스 ([DEC-013](../DECISIONS.md#결정-색인), [ADR-0003](../adr/0003-tech-stack-and-architecture.md)) |
| 현재 구현 | 프로젝트 골격(npm workspaces 5개 패키지·빌드·테스트·린트, [IMPL-001](../TASKS.md#impl-001-프로젝트-골격)) |
| 승인된 에셋 조달 방식 | 종류별 방식·기록 위치·용량 한도([DEC-033](../DECISIONS.md#결정-색인)) |
| 미정 | 골격에 없는 라이브러리의 버전(쓰는 작업에서 고정), Claude·효과음 도구·글꼴 이용 조건 확인(구현 단계) |

이 문서는 채택한 도구·서비스와 에셋 조달 방식을 관리한다. 채택 이유·대안·절충은 [ADR-0003](../adr/0003-tech-stack-and-architecture.md)에 있고, 구체적인 계약은 [DESIGN](../DESIGN.md)의 상세 문서에 둔다.

## 채택한 기술

| 영역 | 채택 | 관련 설계 |
| --- | --- | --- |
| 언어·저장소 | TypeScript, npm workspaces 모노레포 (`client`, `server`, `game-core`, `game-runtime`, `shared`) | [LOCAL](LOCAL.md) |
| 클라이언트 | Vite, React, 일반 CSS(전역 CSS 파일). React Router·Zustand·CSS Modules는 쓰지 않고, 화면은 로그인·방 상태로 전환하며 상태는 React 상태와 `RoomClient` 구독으로 관리한다([DEC-045](../DECISIONS.md#결정-색인)) | [LOCAL](LOCAL.md) |
| 렌더링 | Three.js, React Three Fiber, drei | [GAME](GAME.md) |
| 오디오 | Web Audio 직접 사용(`packages/client/src/audio/`, 라이브러리 없음, [DEC-084](../DECISIONS.md#결정-색인)) | [OPERATIONS](OPERATIONS.md) |
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
| 판·알·조명·배경 | 코드 기본 도형(Three.js). 알 무늬는 도형·머티리얼로 표현 | 해당 없음(직접 제작) | 판 나무 질감이 필요하면 단색·절차 생성을 먼저 쓰고, 텍스처는 Poly Haven·ambientCG(둘 다 CC0, 2026-10-30 확인)만 후보. 방 테마 4종(바·밤 옥상·교실·해변, [DEC-052](../DECISIONS.md#결정-색인)·[DEC-053](../DECISIONS.md#결정-색인))의 배경·조명·책상도 같은 방식(코드 도형·캔버스 절차 텍스처)으로 만들어 파일 에셋을 더하지 않는다. 하늘·도시 불빛·바다·칠판 같은 배경은 캔버스 그림 또는 점·사각 도형으로 그린다. 테마마다 `client/src/game/scene/themes/`의 파일 하나가 배경·조명·책상(과 선택적으로 판 겉모양 `BoardStyle`, [DEC-079](../DECISIONS.md#결정-색인))을 만들고 경계 규칙은 `stage-kit.ts`의 `ThemeEnv`에 있다. 반복 소품은 `themes/toy-kit.ts`의 도형별 `InstancedMesh` 묶음(`Batch`)과 곰 인형·장난감 성·반짝이·깃발 도구로 그려 그리기 호출을 줄인다([DEC-083](../DECISIONS.md#결정-색인)). 카메라 `far`가 900이라 하늘·원경은 반경 약 700 안에 둔다 |
| 사람 아바타 3D 상반신 | 코드 도형 조합(두상·머리카락·몸통·팔) + 눈썹·눈·코·입술은 직접 그린 캔버스 텍스처(512px)를 얼굴 앞쪽 구 조각에 정면 투영으로 입힘. 표정이 바뀔 때만 다시 그린다 | 해당 없음(직접 제작) | [DEC-059](../DECISIONS.md#결정-색인). DEC-033의 코드 도형 방식 안이다. 부품 정의(`shared` `AVATAR_PARTS`)는 2D SVG와 함께 쓴다. 동물 6종을 대체했다([IMPL-018](../TASKS.md#impl-018-사람-아바타-구현)). 안경(얼굴 텍스처에 같은 알 경로로 그림)·모자(`avatar-head.ts`)·옷 장식(`avatar-outfit.ts`)([DEC-078](../DECISIONS.md#결정-색인))도 같은 코드 도형 안에서 만든다([IMPL-024](../TASKS.md#impl-024-아바타-꾸미기-항목-확장안경모자옷)). 코드는 `client/src/avatar/` |
| 프로필·방 카드 2D 얼굴, UI 아이콘 | 직접 제작 SVG(디자인 캔버스 Avatar 부품 기반) | 해당 없음(직접 제작) | 사람 아바타 2D 얼굴은 3D와 같은 부품 정의로 그린 SVG다([DEC-059](../DECISIONS.md#결정-색인)) |
| 방해요소 아이콘 9종 + 에어컨·바람 화살표 | **AI 생성(Claude), SVG 코드로 작성**(래스터 이미지 아님) | Claude 이용 약관 **미확인** | 9종이 한 스타일로 보이도록 같은 프롬프트 틀을 쓴다. 반입할 때 생성 도구(Claude)와 이용 조건 확인일을 CREDITS에 적는다 |
| 소리(배경음악 5곡·테마 배경 소리 4종·효과음, [DEC-084](../DECISIONS.md#결정-색인)·[DEC-086](../DECISIONS.md#결정-색인)) | 배경음악 5곡·테마 배경 소리 4종·알 소리 2종·감정표현 6종은 **CC0 녹음 MP3**(`packages/client/public/audio/`, 등록부 `audio/files.ts`, 합계 약 3.1MB). 나머지 효과음(발사·마법·알림·팡파레 등)은 **코드 합성**(Web Audio, `audio/sfx.ts`). 파일을 받지 못하면 같은 소리의 합성(`audio/music.ts`·`audio/ambience.ts`·`audio/sfx.ts`)으로 낸다 | 합성은 해당 없음(직접 제작). 녹음 파일은 모두 CC0, [CREDITS](../CREDITS.md)에 기록 | 효과음 파일은 소리를 처음 열 때, 음악·배경 소리는 그 화면이 요청할 때 받는다. 효과음 파일당 100KB 이하, 에셋 전체 5MB 한도 안(테스트로 확인) |
| 글꼴 | Jua·Black Han Sans(Google Fonts) woff2를 `packages/client/public/fonts/`에 두고 직접 제공 | SIL OFL 1.1(확인일 2026-11-04) | L 세트가 쓰는 글꼴이다([DEC-069](../DECISIONS.md#결정-색인)·[DEC-072](../DECISIONS.md#결정-색인)). 한글·영문 woff2 4개(약 590KB)와 라이선스 전문을 `packages/client/public/fonts/`에 두고 `packages/client/src/ui/theme.css`의 `@font-face`로 쓴다. [CREDITS](../CREDITS.md)에 기록했다 |
| 방 생성 창 캐릭터 전신 | 직접 제작 3D 전신 `packages/client/src/avatar/avatar-figure.ts`(코드 도형, 개발자 B가 만든 것, 손은 `avatar-hand.ts`). 화면에는 `AvatarFigureView.tsx`가 투명 캔버스로 그린다(방 생성 창과 캐릭터 꾸미기 창 왼쪽, [DEC-076](../DECISIONS.md#결정-색인)). WebGL을 쓸 수 없으면 2D 얼굴 `AvatarFace`로 대신 | 해당 없음(직접 제작) | [DEC-074](../DECISIONS.md#결정-색인)(DEC-072 ④·DEC-073의 2D `AvatarFullBody` 대체), [IMPL-019](../TASKS.md#impl-019-l-화풍-화면-적용). 인게임 장면은 상반신 유지([DEC-059](../DECISIONS.md#결정-색인)) |
| 로그인·로비·방 생성 배경 일러스트(L 세트) | 사용자가 직접 만든 이미지. `packages/client/public/images/login-bg.webp`(1536×864, 약 188KB, 사용자가 2026-11-04에 교체한 그림의 PNG에서 변환) | 해당 없음(직접 제작) | [DEC-070](../DECISIONS.md#결정-색인)·[DEC-072](../DECISIONS.md#결정-색인). 직접 제작이라 CREDITS에 적지 않는다. 400KB 이하 목표를 지켰다([IMPL-019](../TASKS.md#impl-019-l-화풍-화면-적용) 첫 PR) |
| 로그인 배경 영상(L 세트 일러스트를 움직이게 만든 것) | 사용자가 준 영상. `packages/client/public/videos/login-bg.mp4`(1280×720, 24fps, H.264, 소리 없음, 약 690KB)와 첫 장면 포스터 `packages/client/public/images/login-bg-poster.webp`(약 110KB) | 해당 없음(사용자 제공, 직접 제작 일러스트 기반) | [DEC-088](../DECISIONS.md#결정-색인). 로그인 화면만 쓴다. 영상 1MB 이하와 `public/` 전체 5MB 한도를 `client/src/app/assets.test.ts`로 확인한다(반입 시 합계 약 4.7MB) |

### 라이선스 기록

- 위치: [docs/CREDITS.md](../CREDITS.md) 한 곳. 직접 제작한 에셋은 적지 않고, AI·생성 도구·외부 출처를 쓴 에셋만 적는다.
- 기록 항목: 에셋 이름, 파일 경로, 출처 또는 도구, 이용 조건(라이선스·약관), 확인일, 변경 여부.

### 용량 한도

| 대상 | 한도 |
| --- | --- |
| 텍스처 이미지 | 개당 최대 1024px |
| SVG 아이콘 | 개당 10KB |
| 효과음 | 파일당 100KB, 전체 1MB |
| 배경음악·테마 배경 소리 | 파일별 한도 없음. 에셋 전체 5MB 안에서 관리(2026-11-05 기준 배경음악 5곡 약 2.2MB, 배경 소리 4종 약 0.7MB) |
| 로그인 배경 영상 | 1MB([DEC-088](../DECISIONS.md#결정-색인)) |
| 에셋 전체 | 5MB. `packages/client/public` 아래 모든 파일(소리·글꼴·이미지·영상)의 합이다 |

용량 단위는 십진법이다(1KB = 1,000B, 1MB = 1,000,000B). 테스트도 같은 값으로 검사한다. 2026-11-05 기준 `public` 합계는 4,690,433B(약 4.69MB)로 여유가 약 310KB다. 효과음 한도는 `audio/audio.test.ts`가, 로그인 영상 한도와 에셋 전체 한도는 `app/assets.test.ts`가 확인한다. 에셋을 더 넣으려면 기존 파일을 줄이거나 한도를 다시 정해야 한다(미정).

근거는 [비기능 요구사항](../PRD.md#4-비기능-요구사항과-제약)의 Render 무료 서비스·월 비용 0원·모바일 로딩이다. 수치는 측정값이 아니라 보수적으로 잡은 한도이며 실제 로드 시간은 [VAL-001](../TASKS.md#val-001-성능-측정-절차와-플레이-테스트-기록-양식)에서 재면서 조정한다.

### 미정

- Claude 이용 약관, jsfxr·ChipTone·Jua의 이용 조건 확인: 사용자가 구현 단계(에셋 반입 시)에 해도 된다고 했다.
