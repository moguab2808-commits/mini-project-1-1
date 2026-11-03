// 요청이 오래 걸릴 때 "서버를 깨우는 중이에요" 안내를 보이기 위한 지연 플래그(PRD 로그인).
import { useEffect, useState } from 'react';

/** 첫 요청이 이 시간 안에 끝나지 않으면 대기 안내를 보인다. PRD가 허용 대기 5초를 정했고 안내 시점은 구현에서 정했다. */
export const WAKE_NOTICE_DELAY_MS = 2000;

export function usePendingNotice(pending: boolean, delayMs = WAKE_NOTICE_DELAY_MS): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!pending) {
      setShow(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setShow(true);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [pending, delayMs]);
  return show;
}
