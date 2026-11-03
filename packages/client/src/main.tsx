import { createRoot } from 'react-dom/client';
import { App } from './app/app.tsx';
import { AiPage } from './ai/ai-page.tsx';
import { LocalPage } from './local/local-page.tsx';
import { OnlinePage } from './online/online-page.tsx';

// 라우터 없이 URL로 화면을 고른다. `/local`·`/ai`·`/online`은 개발용 화면이고 그 밖의 경로는 앱(로그인·로비·대기실·경기)이다.
const path = window.location.pathname.replace(/\/$/, '');

createRoot(document.getElementById('root')!).render(
  path === '/local' ? (
    <LocalPage />
  ) : path === '/ai' ? (
    <AiPage />
  ) : path === '/online' ? (
    <OnlinePage />
  ) : (
    <App />
  ),
);
