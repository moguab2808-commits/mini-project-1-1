# 개발자와 AI의 공통 작업 기준

## 문서 위치와 역할

| 위치 | 역할 |
| --- | --- |
| [README.md](README.md) | 소개, 문서 안내, 실행 방법 진입점 |
| [PRD.md](PRD.md) | 기존 제안서 원문. 요구사항과 확정·후보 표기의 근거 |
| [docs/PRD.md](docs/PRD.md) | 제품 범위 요약, 원문 참조, 미정 사항 구분 |
| [docs/DESIGN.md](docs/DESIGN.md) | 아키텍처·처리 흐름·API·데이터 모델의 합의된 명세 |
| [docs/DECISIONS.md](docs/DECISIONS.md) | 결정 색인. 중요한 결정은 [ADR 양식](docs/adr/TEMPLATE.md)으로 기록 |
| [docs/TASKS.md](docs/TASKS.md) | GitHub Issues 관리 원칙과 상위 Issue 링크 |
| [docs/PROGRESS.md](docs/PROGRESS.md) | 기준 브랜치의 구현 현황, 장애 요인, 다음 방향 |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | 두 개발자의 협업 흐름, 상태 정의, 계약 변경 규칙 |
| [.github/ISSUE_TEMPLATE/task.md](.github/ISSUE_TEMPLATE/task.md) | 작업 Issue 양식 |
| [.github/pull_request_template.md](.github/pull_request_template.md) | PR 양식 |

## 작업 전에 읽을 문서

모든 작업은 관련 Issue와 [협업 규칙](docs/CONTRIBUTING.md)을 먼저 확인한다.

- 요구사항·범위 변경: [요구사항 요약](docs/PRD.md) → 요약에서 연결한 원문 해당 절.
- 설계·구현·연동: 요구사항 요약 → [설계](docs/DESIGN.md) → [관련 결정](docs/DECISIONS.md).
- 리뷰·병합·현황 갱신: 관련 명세·결정 → [구현 현황](docs/PROGRESS.md) → PR의 검증 결과.

## 수정·검증·갱신

- 요구사항은 이 파일에 복사하지 않고 원문으로 연결한다. 기존 문서·설정을 확인하고 필요한 부분만 수정하며 다른 사람의 변경을 덮어쓰지 않는다.
- AI는 미정 사항을 임의로 확정하지 않는다. 확정·미정 구분은 [요구사항 요약](docs/PRD.md)을 따르고, 상충하거나 확인이 필요한 내용은 관련 Issue에 남긴다. 구조 준비와 독립적인 작업은 계속하되, 합의가 필요한 구현은 합의 후 진행한다.
- 변경 종류에 맞게 검증한다. 문서는 링크·중복·확정 근거를 확인하고, 코드는 실제 존재하는 명령과 관련 시나리오로 검증한다. 실행한 검증·결과·미검증 사유는 PR에 기록한다. 명령이나 통과 결과를 만들어내지 않는다.
- 요구사항·명세·결정·실행 방법이 바뀌면 해당 기준 문서를 같은 PR에서 갱신하고 나머지 문서는 링크한다. 현황 갱신 시점은 협업 규칙을 따른다. 환경변수 값과 비밀정보는 문서·Issue·PR에 복사하지 않는다.
