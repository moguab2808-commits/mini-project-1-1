# 배포·데이터 운영 설계

## 상태

| 구분 | 상태 |
| --- | --- |
| 승인된 미구현 설계 | 아래 배포 구성 ([DEC-013](../DECISIONS.md#결정-색인), [ADR-0003](../adr/0003-tech-stack-and-architecture.md)). 헬스체크 서비스·수동 배포·백업 방식([DEC-029](../DECISIONS.md#결정-색인)) |
| 현재 구현 | 없음 |
| 확정안 (B 결정, 리뷰 전) | 아래 [OPS-001](../TASKS.md#ops-001-운영-설계-확정) 세부 절차와 [무료 조건 확인](#무료-조건-재확인-2026-10-30). 개발자 A 검토 전 |
| 미정 | 아래 미정 사항 |

비용·보관·삭제·장애 시 제품 약속은 [PRD](../PRD.md), 실행 절차는 [README](../../README.md), 성능·실패 실험 방법은 [ENGINEERING-VALIDATION](../ENGINEERING-VALIDATION.md)을 따른다.

## 배포 구성 (승인)

- **Render 무료 웹 서비스 1개**가 빌드된 정적 클라이언트, REST API, Socket.IO를 함께 제공한다. 같은 워크스페이스에 다른 무료 서비스를 두지 않는다(월 750 무료 시간 안에서 상시 실행).
- **절전 방지**: Render 무료 서비스는 15분 동안 요청이 없으면 절전하고 깨어나는 데 약 1분이 걸린다. 첫 접속 5초 요구를 지키기 위해 외부 모니터링 서비스가 `/health`를 요청하는 방식을 검토한다. `/health`는 DB를 조회하지 않는다. 서비스와 간격, 지속 요청의 실제 사용 여부는 아래 [헬스체크](#헬스체크)를 따른다.
- **DB**: Neon 무료 플랜 PostgreSQL. 5분 동안 활동이 없으면 컴퓨트가 중지되도록 서버의 연결 풀은 유휴 연결을 짧게 닫는다(월 100 CU-hour 한도 보호).
- **리전**: Render와 Neon 모두 싱가포르.
- 진행 중 경기 상태는 서버 메모리, 방 정보(`rooms`)·회원·전적·세션은 DB에 보관한다([DEC-023](../DECISIONS.md#결정-색인)).
- 환경 설정 이름: `DATABASE_URL`, `SESSION_SECRET`, `PORT`, `NODE_ENV`. 로컬은 `.env`와 값이 없는 `.env.example`을 쓰고, 배포 환경은 Render의 환경 변수로 주입한다. 값과 비밀정보는 문서에 기록하지 않는다.
- 기존 시뮬레이션 기록 30fps 샘플링은 기록 후 재생 기준이었다. 이동 중 방해요소 입력을 위한 실시간 방식은 [ADR-0004](../adr/0004-realtime-hazards.md)로 승인됐다. 전송 주기는 물리와 분리하며 부하 측정으로 정한다(아래 사용량·부하).
- 오디오는 브라우저 입력 후 활성화한다.

무료 조건은 2026-10-29에 확인했고([ADR-0003](../adr/0003-tech-stack-and-architecture.md#관련-기준과-근거)) 2026-10-30에 공식 문서로 다시 확인했다. 조건이 바뀌면 ADR의 재검토 조건을 따른다.

## 무료 조건 재확인 (2026-10-30)

| 대상 | 확인한 내용 | 공식 문서 |
| --- | --- | --- |
| Render 무료 웹 서비스 | 워크스페이스당 월 750 무료 인스턴스 시간(소진하면 다음 달까지 무료 웹 서비스 정지). 15분 동안 들어오는 트래픽(HTTP 요청, 기존 WebSocket 연결의 메시지 포함)이 없으면 절전. 요청이나 새 WebSocket 연결로 깨어나며 약 1분. 로컬 파일은 재배포·재시작·절전 때 사라지고 Render가 언제든 재시작할 수 있다. 서비스 1개만 상시 실행하면 월 744시간(31일)이라 750시간 안이다 | [Free instances](https://render.com/docs/free) |
| Render 배포 | 자동 배포 끄기: 서비스 Settings의 Auto-Deploy를 Off. 수동 배포: Deploys 페이지의 Manual Deploy → Deploy latest commit. 대시보드·deploy hook으로 특정 커밋을 배포하면 자동 배포가 꺼진다 | [Deploys](https://render.com/docs/deploys) |
| Render 롤백 | Deploys 페이지에서 성공한 배포의 Rollback → 확인 화면의 "Rollback to this deploy". 이전 배포의 빌드 결과물을 재사용하는 새 배포가 시작된다. 대시보드 롤백은 자동 배포를 끈다. 워크스페이스 플랜에 따라 보관하는 빌드 결과물 수가 정해져 있어 결과물이 남은 배포로만 돌아갈 수 있다. 이 문서는 무료 인스턴스에 대한 별도 제한을 적지 않는다 | [Rollbacks](https://render.com/docs/rollbacks) |
| Neon 무료 플랜 | 프로젝트당 월 100 CU-hour. 비활성 5분 뒤 컴퓨트 중지(무료 플랜에서는 끌 수 없음). 복구용 변경 이력(history window) 기본·최대 6시간, 이력 1 GB 상한 | [Plans](https://neon.com/docs/introduction/plans), [History window](https://neon.com/docs/postgres/backup-restore/history-window) |
| UptimeRobot 무료 플랜 | 모니터 50개, 확인 간격 5분. 이용약관은 "any use, including commercial and business use"라고 적어 비상업적 용도 제한이 없다. 요금 페이지도 개인·상업 프로젝트에 쓸 수 있다고 한다. 약관에서 인용하지 못한 공정 사용 정책(Fair Use Policy)에 한도가 있을 수 있어 구현 때 확인한다 | [Terms](https://uptimerobot.com/terms/), [Pricing](https://uptimerobot.com/pricing/) |

다음 확인일은 2026-11-30이며 이후 월 1회 재확인한다([TASKS2](../TASKS2.md)의 위험 대응과 같다).

## 세부 절차 (확정안)

### 헬스체크

- 외부 헬스체크 서비스는 **UptimeRobot**이다. 무료 플랜의 확인 간격이 5분이라 **5분 간격**으로 `/health`를 요청하도록 설정한다([DEC-029](../DECISIONS.md#결정-색인)). 5분은 Render의 15분 절전 기준보다 짧아 요청이 계속되는 동안 서비스가 절전하지 않는다. cron-job.org(무료, 최소 1분)가 대안이다.
- 비상업적 용도 제한은 공식 이용약관에 없다(2026-10-30 확인, 위 표).
- 서버 절전 방지를 위해 계속 요청을 보내는 방식을 실제로 쓸지는 DEC-029에 따라 구현 단계에서 다시 정한다. 쓰기로 하면 위 설정을 적용하고, 쓰지 않으면 절전 후 첫 접속에 약 1분이 걸려 [첫 접속 대기 5초](../PRD.md#4-비기능-요구사항과-제약) 요구를 만족하지 못하므로 PRD의 요구를 조정할지 정해야 한다. 어느 쪽이든 운영 방식은 위와 같이 정해져 있다.

### SPA fallback

`/api`·`/socket.io`·`/health`를 제외한 GET 요청은 `index.html`을 반환한다. 이 경로 밖에서 파일 확장자가 있는 요청(정적 자산)이 없으면 404를 반환하고 `index.html`로 대체하지 않는다.

### 배포·롤백

- **자동 배포를 끄고 Render 대시보드에서 수동으로 배포한다**([DEC-029](../DECISIONS.md#결정-색인)). 코드·문서 작업이 끝나도 커밋·푸시·배포를 단계별로 확인한 뒤 진행한다. 자동 배포를 켜 두면 `main`에 푸시하는 순간 배포되어 이 결정과 맞지 않는다. 배포는 서버를 재시작해 진행 중인 경기와 연결이 끊기므로 사용자가 없을 때 한다.
- **자동 배포 끄기**: 서비스 Settings → Auto-Deploy → Off. 서비스를 만들 때 한 번 설정하고, 대시보드 롤백 뒤에는 자동으로 꺼져 있으므로 다시 켜지 않는다.
- **수동 배포**: Deploys 페이지 → Manual Deploy → Deploy latest commit. 배포 전에 `main`에 병합된 커밋인지 확인한다.
- **롤백**: Deploys 페이지에서 직전의 성공한 배포 → Rollback → "Rollback to this deploy". 보관된 빌드 결과물로 새 배포가 시작되며 환경 변수는 그 배포 당시 값을 쓴다. 대시보드 롤백은 자동 배포를 끄므로 이 프로젝트의 설정과 충돌하지 않는다. 롤백할 결과물이 남아 있지 않으면 문제를 고친 커밋을 수동 배포한다.
- 롤백은 DB를 되돌리지 않는다(Rollbacks 문서는 DB·마이그레이션을 다루지 않는다). 마이그레이션은 되돌림 스크립트 대신 "앞으로 호환되는 변경만" 원칙을 쓴다([DATABASE](DATABASE.md#마이그레이션)). 새 버전이 스키마를 바꾼 뒤 이전 버전으로 롤백해도 이전 코드가 동작해야 한다.

### 서버 로그

[GAME의 명령 경합과 시간](GAME.md#명령-경합과-시간)이 정한 필드를 그대로 쓰고 운영에 필요한 항목을 더한다. 구조화 JSON 한 줄 로그를 stdout으로 내보내 Render 로그에서 본다.

| 항목 | 내용 | GAME 필드 |
| --- | --- | --- |
| 시각 | `ts`(UTC), `mono`(단조 시각 ms) | UTC·단조 시각 |
| 식별 | `roomId`, `gameId`, `turnId`, `userId` | 경기·턴 ID, userId·roomId |
| 순서 | `ingressSeq`, `serverTick` | ingressSeq, serverTick |
| 이벤트 `event` | `start_commit`, `turn_start`, `shot`, `hazard_use`, `hazard_trigger`, `leave`, `forfeit`, `session_replaced`, `tick_skipped`, `game_over` | 턴 시작·발사·방해요소 사용/발동·이탈·종료 |
| 결과 | `result`(명령 판정 결과, API 오류 코드와 같은 이름), `reason`(종료 사유) | 명령 종류·판정 결과, 종료 사유 |

- `leave`는 연결 끊김·나가기·접속 대체로 이탈이 큐에서 관찰된 시점이며 `reason`에 `disconnect`·`leave_button`·`session_replaced`를 적는다. `forfeit`는 `leave`나 시간초과 누적으로 기권패가 확정된 시점이고, `game_over`는 `finishOnce` 실행 결과(`reason`: [API `game:over`](API.md#경기-이벤트-필드)의 `all_stones_out`·`final_round`·`forfeit`·`timeout_forfeit`)다.
- `tick_skipped`는 [틱 따라잡기 상한](GAME.md#전송실행)을 넘어 버린 지연 시간을 `result`에 적는다.
- 이 로그가 동시 이탈과 시작 직전 이탈의 판정 근거다([게임 규칙](../PRD.md#게임-규칙)). 경기 종료 사유는 DB에 저장하지 않고 여기에만 남는다([DATABASE](DATABASE.md#경기-종료-저장)).

판정 방법(같은 방의 로그를 `ingressSeq` 순으로 본다):

| 상황 | 판정 |
| --- | --- |
| 동시 이탈 | 두 사람의 `leave` 중 `ingressSeq`가 작은 쪽(먼저 관찰된 쪽)을 기권패로 본다. 같은 시각이어도 `ingressSeq`가 서로 다르다 |
| 시작 직전 이탈 | `leave`의 `ingressSeq`가 `start_commit`보다 작으면 대기실 이탈로 전적에 남기지 않고, 크면 기권패다. `start_commit`이 로그에 없으면 시작 처리 전이다 |

- 틱마다 로그를 남기지 않는다. 비밀번호·세션·쿠키·상대의 비공개 보유 상태는 기록하지 않는다. 재접속 복구가 없어 재접속 이벤트는 두지 않는다.
- **민감정보 제거 방식**: 위 표의 필드만 직렬화하는 허용 목록 방식이다. 로거 함수는 정해진 키만 받고 요청·소켓·세션 객체 전체를 넘기지 않는다. 오류 로그에는 메시지와 코드만 남기고 요청 본문·헤더·쿠키·`DATABASE_URL`을 넣지 않는다. 방해요소 보유 상태는 `hazard_use`·`hazard_trigger`가 일어난 뒤 공개된 사실만 적는다.
- Render 로그의 보관 기간은 이 설계가 보장하지 않는다. 판정이 필요한 문제는 발생 후 바로 대시보드에서 확인하며, 보관 기간이 필요하면 구현 때 Render 문서로 확인한다.

### 사용량·부하 확인

- Render 대시보드의 월 사용 시간(상한 750시간)과 Neon 콘솔의 CU-hour(상한 100)를 월 1회 확인해 worklog에 기록한다. 80%를 넘으면 원인을 확인한다.
- 방 상태를 DB에서 관리해 Neon 접속이 늘 수 있다. 방 목록은 새로고침으로만 조회하고 연결 풀 유휴 시간을 짧게 유지해 5분 비활성 중지를 막지 않는다. 사용량으로 확인한다.
- **상태 전송 부하 측정 항목**: 변수는 동시 방 수(1·3·5방, 목표 동시 접속 10명 = 5방)와 알 이동 중 스냅샷 주기(초당 10·20·30회, 기본 30회는 [GAME](GAME.md#전송실행))다. 한 번에 한 변수만 바꾼다. 지표는 서버 CPU 사용률, 이벤트 루프 지연, 틱 지연(`tick_skipped` 횟수), 스냅샷 전송 지연(서버 전송 시각 대비 클라이언트 수신 시각), 서버 송신 대역폭이다. 항목은 [ENGINEERING-VALIDATION](../ENGINEERING-VALIDATION.md)의 서비스 부하 행에 반영한다. 합격 목표값은 정하지 않고 첫 측정을 기준선으로 보관한다.

### 서버 시작 시 `rooms` 정리

서버는 연결을 받기 전에 `rooms`를 전부 삭제한다([DATABASE](DATABASE.md#방-생명주기)). 배포·재시작으로 메모리의 연결·경기가 사라지기 때문이다. 삭제가 실패하면 서버를 시작하지 않고 오류로 종료한다. 서버 장애 중의 경기 처리는 MVP에서 고려하지 않는다.

### 클라이언트 음량 설정 저장

음량은 브라우저 `localStorage`에 저장한다([환경설정](../PRD.md#환경설정)의 브라우저 저장 범위). 읽기·쓰기는 예외를 처리하고, 저장소를 쓸 수 없으면 기본값으로 동작한다. 서버·DB에는 보내지 않는다.

### 백업·복구

Neon 기본 복구(시점 복구)만 쓰며 별도 백업을 만들지 않는다([DEC-029](../DECISIONS.md#결정-색인)).

- **가능 기간(2026-10-30 확인)**: 무료 플랜의 history window는 기본·최대 6시간이고 이력은 1 GB가 상한이다. 기간 밖의 변경은 즉시 복구(instant restore)·Time Travel·과거 시점 브랜치로 되돌릴 수 없다([History window](https://neon.com/docs/postgres/backup-restore/history-window)).
- **절차**([Instant restore](https://neon.com/docs/introduction/branch-restore)): 콘솔에서 브랜치 → Postgres database → Backup & Restore → Restore from history에서 시각이나 LSN을 골라 복구한다. 복구 전에 Time Travel Assist로 읽기 전용 질의를 해 시점을 확인한다. CLI(`neon branches restore`)와 API로도 할 수 있다.
- **복구 때 일어나는 일**: 선택한 시점 이후의 모든 변경이 사라지고 브랜치의 모든 데이터베이스가 대체된다(병합 아님). 기존 연결은 잠시 끊기고 접속 정보는 그대로다. 복구 전 상태는 `{브랜치명}_old_{시각}` 백업 브랜치로 남는다.
- **한계(위험)**: PRD의 전적 보관 기간은 무제한이지만 복구는 최근 6시간까지만 된다. 6시간보다 오래된 잘못된 삭제·수정은 복구할 수 없다. 별도 백업을 만들지 않기로 한 결정([DEC-029](../DECISIONS.md#결정-색인))의 수용된 위험이며, 운영 중 데이터를 직접 수정할 때는 먼저 이 한계를 확인한다. 복구는 마이그레이션 직후나 잘못된 쿼리를 발견한 직후처럼 6시간 안에만 의미가 있다.

## 남은 미정·구현 단계 확인

- 지속 요청(절전 방지)을 실제로 쓸지: [DEC-029](../DECISIONS.md#결정-색인)에 따라 구현 단계에서 정한다. 운영 방식은 [헬스체크](#헬스체크)에 정해 두었다.
- UptimeRobot 공정 사용 정책의 한도: 구현 때 확인한다.
- Render 로그 보관 기간: 구현 때 확인한다.
- 측정 합격 목표값: 첫 측정 뒤 정한다([ENGINEERING-VALIDATION](../ENGINEERING-VALIDATION.md)).

제품 정책이 미정인 항목은 구현 편의로 결정하지 않는다. 실제 장애 사례는 [TROUBLESHOOTING](../TROUBLESHOOTING.md), 날짜별 실행·결과는 worklog에서 관리한다.
