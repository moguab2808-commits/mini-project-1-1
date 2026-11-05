import { createRoot } from 'react-dom/client';
import { App } from './app/app.tsx';
import { AiPage } from './ai/ai-page.tsx';
import { LocalPage } from './local/local-page.tsx';
import { audio } from './audio/engine.ts';

// 라우터 없이 URL로 화면을 고른다. `/local`·`/ai`는 개발용 화면이고 그 밖의 경로는 앱(로그인·로비·대기실·경기)이다.
// 소리는 첫 클릭·키 입력 때 열린다(브라우저 자동 재생 제한, DEC-084)
audio.install();

const path = window.location.pathname.replace(/\/$/, '');

createRoot(document.getElementById('root')!).render(
  path === '/local' ? <LocalPage /> : path === '/ai' ? <AiPage /> : <App />,
);
