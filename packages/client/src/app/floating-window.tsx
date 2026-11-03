// 로비 위에 뜨는 플로팅 창(PRD 로비: 환경설정·방 생성·코드 입력·캐릭터 변경). 로비를 어둡게 덮지 않는다.
import { useEffect } from 'react';
import type { ReactNode } from 'react';

export function FloatingWindow({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div className="float-layer">
      <section
        className={wide ? 'float-window float-window-wide' : 'float-window'}
        role="dialog"
        aria-label={title}
      >
        <header className="float-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="float-body">{children}</div>
      </section>
    </div>
  );
}
