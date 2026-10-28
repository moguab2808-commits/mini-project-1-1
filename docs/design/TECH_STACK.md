# 기술·서비스·에셋 후보

## 상태

| 구분 | 상태 |
| --- | --- |
| 승인된 미구현 설계 | 없음 |
| 현재 구현 | 없음 |
| 미정 | 아래 후보 전체 |

이 문서는 재검토할 도구·서비스·조달 후보만 관리한다. 특정 조합·무료 한도·라이선스를 검증하거나 승인한 상태가 아니다. 채택 이유·대안·절충은 [DECISIONS](../DECISIONS.md)와 해당 ADR에 남기고, 구체적인 계약은 [DESIGN](../DESIGN.md)의 상세 문서에 둔다.

## 기존 기술 후보

| 영역 | 후보·검토 대상 | 관련 설계 |
| --- | --- | --- |
| 언어·화면 | TypeScript, React, Vite | [LOCAL](LOCAL.md) |
| 화면 보조 | React Router, TanStack Query, Zustand, Tailwind CSS | [LOCAL](LOCAL.md) |
| 렌더링 | Three.js, React Three Fiber, drei, 2D/3D 표현 | [GAME](GAME.md) |
| 런타임·통신 | Node.js, Express, Socket.IO | [API](API.md) |
| 물리 | 직접 구현, Matter.js, 물리 차원 | [GAME](GAME.md) |
| 검증·인증 | Zod, express-session, argon2, @node-rs/argon2, connect-pg-simple | [AUTH](AUTH.md) |
| 저장 | Postgres, Neon, Drizzle, pg | [DATABASE](DATABASE.md) |
| 배포 | Render 등 무료 운영 가능한 구성 | [OPERATIONS](OPERATIONS.md) |
| 저장소·품질 | npm workspaces, tsx, tsup, ESLint, Prettier, Vitest | [LOCAL](LOCAL.md)·[검증 계획](../ENGINEERING-VALIDATION.md) |
| 오디오 | Howler.js 등 재생 도구 | [OPERATIONS](OPERATIONS.md) |

## 기존 에셋 후보

- 판·알·배경·조명: 코드 기본 도형, Poly Haven, ambientCG
- UI: Kenney
- 증강 아이콘: AI 생성, game-icons.net
- 효과음: Freesound, Kenney, jsfxr, ChipTone, Pixabay

아트 방향과 필요한 효과음은 [화면 요구사항](../PRD.md#화면별-요구사항)에서 합의한다. 소스·도구의 이용 조건은 채택 시 확인한다. 출처·라이선스·AI 도구·약관 확인일을 docs/CREDITS.md에 기록하는 방안과 텍스처·아이콘 해상도·용량 제한은 미정이다. 배경음악의 MVP 제외 여부는 [PRD](../PRD.md)를 따른다.

기존 선정 이유·도구 조합·제작 시점의 과거 자료는 Git 이력에서 추적한다. 현행 채택 근거는 DECISIONS와 해당 ADR을 따른다.
