import { createRoot } from 'react-dom/client';
import { AiPage } from './ai/ai-page.tsx';
import { LocalPage } from './local/local-page.tsx';

// 라우터는 계정·로비 화면(IMPL-012)이 들어올 때 정한다. 지금은 개발용 `/local`·`/ai`만 있다.
const path = window.location.pathname.replace(/\/$/, '');

createRoot(document.getElementById('root')!).render(
  path === '/local' ? <LocalPage /> : path === '/ai' ? <AiPage /> : <p>알까기 바</p>,
);
