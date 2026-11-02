import { createRoot } from 'react-dom/client';
import { LocalPage } from './local/local-page.tsx';

// 라우터는 계정·로비 화면(IMPL-012)이 들어올 때 정한다. 지금은 개발용 `/local`만 있다.
const isLocal = window.location.pathname.replace(/\/$/, '') === '/local';

createRoot(document.getElementById('root')!).render(isLocal ? <LocalPage /> : <p>알까기 바</p>);
