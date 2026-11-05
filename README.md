# 증강 알까기 (Augmented Alkkagi)

알까기에 방해요소 시스템을 더한 데스크톱 웹 브라우저용 1:1 온라인 대전 미니프로젝트다.

## 기술 스택

| 영역 | 사용 |
| --- | --- |
| 클라이언트 | TypeScript, Vite, React, Three.js(React Three Fiber) |
| 서버 | Node.js 24, Express, Socket.IO |
| 인증·검증 | express-session(세션을 DB에 저장), argon2id, Zod |
| 저장 | PostgreSQL(Neon 무료 플랜), Drizzle ORM |
| 배포 | Render 무료 웹 서비스 1개, 싱가포르 리전 |

npm workspaces 모노레포이며 패키지는 `client`·`server`·`game-core`·`game-runtime`·`shared` 다섯 개다. 채택 이유와 대안은 [TECH_STACK](docs/design/TECH_STACK.md)과 [ADR-0003](docs/adr/0003-tech-stack-and-architecture.md)에 있다.

## 설치·실행

Node.js 24 이상과 npm을 사용한다.

```bash
npm ci
npm test
npm run lint
npm run format
npm run build
```

Windows에서 Git이 줄바꿈을 CRLF로 바꿔 받으면(`core.autocrlf=true`) `npm run format`이 대부분의 파일에서 경고를 내며 실패한다. 처음 내려받을 때 `git clone -c core.autocrlf=false <저장소 주소>`를 쓰면 피할 수 있다. 이미 받은 저장소는 `git config core.autocrlf false`만으로는 작업 폴더의 파일이 그대로이므로, 변경 사항을 커밋하거나 `git stash`한 뒤 `git rm --cached -r .`와 `git reset --hard`로 작업 폴더를 다시 만든다(저장하지 않은 변경은 사라진다). 줄바꿈만 무시하고 확인하려면 `npx prettier --config config/prettier.json --ignore-path config/prettier.ignore --end-of-line auto --check .`를 쓴다.

클라이언트 개발 서버는 `npm run dev -w @alkkagi/client`로 실행한다. `/local?seat=0`·`/local?seat=1`은 같은 브라우저의 두 창, `/ai`는 AI 대전이고, 로그인·로비·대기실·경기를 잇는 실제 화면은 `/`다. 개발 서버의 `/api`·`/socket.io`는 `127.0.0.1:3000`으로 전달한다.

### 서버 없이 AI·로컬 2인 실행

```bash
npm run dev -w @alkkagi/client -- --host 127.0.0.1
```

터미널에 표시된 주소의 `/ai`에서 판·알 개수·방 테마를 고른 뒤 시작한다. 로컬 2인은 같은 브라우저 프로필에서 `/local?seat=0`과 `/local?seat=1`을 각각 열면 시작한다. 두 창의 `theme=bar|rooftop|classroom|beach`가 다르면 먼저 접속한 창의 값을 쓰며, 생략하거나 잘못된 값이면 바 테마다. 서로 다른 브라우저나 시크릿 프로필은 SharedWorker를 공유하지 않는다. 두 모드는 계정·DB·온라인 서버 없이 실행한다.

- 내 알을 왼쪽 버튼으로 끌어 발사하고, 조준 중 오른쪽 클릭으로 취소한다.
- E로 방해요소를 사용한다. 위치형은 클릭으로 배치하며 ESC로 취소한다. R로 벽 방향을 바꾼다.
- A·D 또는 ←·→를 누르는 동안 판을 돌리고, 오른쪽 드래그로 고개를 돌린다.
- 숫자키 1~6 또는 감정표현 메뉴로 하품·도발·졸기·인사·웃기·놀람을 사용한다. 공통 쿨타임은 3초이고 경기 중에만 사용할 수 있다.
- 결과 화면에서 재도전한다. 로컬 2인은 두 창 모두 15초 안에 눌러야 하고, AI는 한 번 누르면 다시 시작한다.

로컬 창을 닫거나 새로고침하면 이탈로 처리한다. 새 로컬 경기를 만들려면 두 창을 모두 닫고 다시 연다. 오래 가려진 탭의 타이머 제한은 [로컬 실행의 한계](docs/design/LOCAL.md#로컬-2인-구성-창-2개)를 확인한다.

온라인 서버는 PostgreSQL 연결 설정 `DATABASE_URL`(운영은 Neon 무료 플랜의 연결 문자열)과 32자 이상인 `SESSION_SECRET`이 필요하다. 변수 이름은 [.env.example](.env.example)에 있으며 복사해 `.env`로 만들고 값을 채운다. 환경에 값을 설정한 뒤 `npm run db:migrate -w @alkkagi/server`, `npm run dev -w @alkkagi/server`를 실행한다. 마이그레이션 명령은 루트 `.env`도 읽지만 개발 서버 명령은 프로세스 환경을 읽는다. `/`(로그인·로비·대기실)는 서버를 띄운 뒤 개발 서버로 연다.

DB 테스트는 `DATABASE_URL`이 설정된 환경에서 `npm run test:db`로 실행한다. 연결 계정에 임시 DB 생성·삭제 권한이 필요하고, 테스트는 임시 DB를 만들었다가 지운다. 환경변수 실제 값과 비밀정보는 문서에 적지 않는다.

새 환경에서 처음부터 실행해 확인한 조건·결과는 [DOC-011 worklog](docs/worklogs/2026-11-05.md#doc-011-readme-새-환경-검증)에 있다. 온라인 대전 클라이언트의 검증 조건·한계는 [IMPL-010 worklog](docs/worklogs/2026-11-03.md#impl-010-온라인-대전-클라이언트)에 있다.

## 배포 접속

운영 서비스는 https://alkkagi-6q64.onrender.com 이다. 웹 서비스는 Render 무료 플랜, DB는 Neon PostgreSQL 무료 플랜이고 둘 다 싱가포르 리전이다. `/health`가 `{ "status": "ok" }`를 돌려주며, 가입한 뒤 로비에서 방을 만들거나 `/ai`에서 AI와 대전한다. 무료 서비스는 15분 동안 요청이 없으면 절전해 첫 접속이 약 1분 걸릴 수 있고, 외부 헬스체크가 10분마다 요청해 이를 줄인다. 배포·롤백·무료 한도 절차는 [OPERATIONS](docs/design/OPERATIONS.md)를 따른다.

## 문서 안내

작업 목적별 기준 문서와 각 문서의 책임은 [AGENTS](AGENTS.md#작업-목적에-따라-읽을-문서)에서 확인한다.
