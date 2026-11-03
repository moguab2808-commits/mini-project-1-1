# 증강 알까기 (Augmented Alkkagi)

알까기에 방해요소 시스템을 더한 데스크톱 웹 브라우저용 1:1 온라인 대전 미니프로젝트다.

## 설치·실행

Node.js 24 이상과 npm을 사용한다.

```bash
npm ci
npm test
npm run lint
npm run format
npm run build
```

클라이언트 개발 서버는 `npm run dev -w @alkkagi/client`로 실행한다. `/local?seat=0`·`/local?seat=1`은 같은 브라우저의 두 창, `/ai`는 AI 대전, `/online`은 인증된 계정의 온라인 연결 확인 경로다. 로그인·로비·대기실·경기를 잇는 실제 화면은 `/`다. 개발 서버의 `/api`·`/socket.io`는 `127.0.0.1:3000`으로 전달한다.

온라인 서버는 PostgreSQL 연결 설정 `DATABASE_URL`과 32자 이상인 `SESSION_SECRET`이 필요하다. 환경에 값을 설정한 뒤 `npm run db:migrate -w @alkkagi/server`, `npm run dev -w @alkkagi/server`를 실행한다. 마이그레이션 명령은 루트 `.env`도 읽지만 개발 서버 명령은 프로세스 환경을 읽는다. `/`(로그인·로비·대기실)는 서버를 띄운 뒤 개발 서버로 연다. `/online`은 같은 출처의 인증 API로 로그인한 세션 쿠키가 필요하다.

DB 테스트는 `DATABASE_URL`이 설정된 환경에서 `npm run test:db`로 실행한다. 연결 계정에 임시 DB 생성·삭제 권한이 필요하고, 테스트는 임시 DB를 만들었다가 지운다. 환경변수 실제 값과 비밀정보는 문서에 적지 않는다.

현재 브랜치의 [검증 조건·한계](docs/worklogs/2026-11-03.md#impl-010-온라인-대전-클라이언트)를 확인한다. 새 환경 전체 설치·개발 서버 watch·배포 검증은 [DOC-011](docs/TASKS.md#doc-011-readme-설치실행-절차)에서 마무리한다.

## 문서 안내

작업 목적별 기준 문서와 각 문서의 책임은 [AGENTS](AGENTS.md#작업-목적에-따라-읽을-문서)에서 확인한다.
