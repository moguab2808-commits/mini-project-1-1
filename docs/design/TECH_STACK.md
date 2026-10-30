# 기술·서비스·에셋

## 상태

| 구분 | 상태 |
| --- | --- |
| 승인된 미구현 설계 | 기술 스택·배포 서비스 ([DEC-013](../DECISIONS.md#결정-색인), [ADR-0003](../adr/0003-tech-stack-and-architecture.md)) |
| 현재 구현 | 없음 |
| 미정 | 라이브러리 세부 버전, 에셋 출처·라이선스 기록 방식 |

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

## 에셋 후보

- 판·알·배경·조명: 코드 기본 도형, Poly Haven, ambientCG
- 캐릭터 3D 모델(동물 6종): 코드 기본 도형 조합(로우폴리), Kenney, Quaternius
- UI: Kenney
- 방해요소 아이콘: AI 생성, game-icons.net
- 효과음: Freesound, Kenney, jsfxr, ChipTone, Pixabay

필요한 화면 표현과 효과음 목록은 [화면 요구사항](../PRD.md#화면별-요구사항)을 따른다. 소스·도구의 이용 조건은 채택 시 확인한다. 출처·라이선스·AI 도구·약관 확인일을 docs/CREDITS.md에 기록하는 방안과 텍스처·아이콘 해상도·용량 제한은 미정이다.
