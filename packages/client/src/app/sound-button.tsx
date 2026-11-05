// 어느 화면에서나 소리를 켜고 설정하는 둥근 버튼(DEC-087). 로그인·경기·AI·로컬 화면의 오른쪽 위에 둔다.
// 브라우저는 첫 클릭 전에는 소리를 막으므로, 그 전에는 "소리 켜기"를 보여 첫 클릭을 이끈다.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { audio } from '../audio/engine.ts';
import { loadSoundOn } from './settings.ts';
import { SoundControls } from './sound-controls.tsx';

/** 스피커 아이콘(글꼴에 이모지가 없어도 보이도록 SVG로 그린다). 꺼짐이면 ✕, 아니면 소리 물결 */
function SpeakerIcon({ off }: { off: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 9h4l5-4v14l-5-4H4z"
        fill="#ffa431"
        stroke="#5a2408"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {off ? (
        <path d="M16 9l5 6M21 9l-5 6" stroke="#5a2408" strokeWidth="2.2" strokeLinecap="round" />
      ) : (
        <path
          d="M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10"
          fill="none"
          stroke="#5a2408"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

const allOff = () => !loadSoundOn('music') && !loadSoundOn('ambience') && !loadSoundOn('sfx');

export function SoundButton() {
  const unlocked = useSyncExternalStore(audio.subscribe, () => audio.unlocked);
  const muted = useSyncExternalStore(audio.subscribe, allOff);
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // 바깥을 누르면 닫는다(게임 장면 조작은 그대로 이어진다)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={unlocked ? 'sound-fab' : 'sound-fab locked'}
        aria-label="소리 설정"
        aria-expanded={open}
        title="소리 설정"
        onClick={() => {
          audio.unlock();
          setOpen((v) => !v);
        }}
      >
        <SpeakerIcon off={unlocked && muted} />
        {!unlocked && <span>소리 켜기</span>}
      </button>
      {open && (
        <section ref={popRef} className="sound-pop l-tray" role="dialog" aria-label="소리 설정">
          <div className="sound-pop-head">
            <span>소리 설정</span>
            <button
              type="button"
              className="sound-pop-close"
              aria-label="닫기"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>
          <SoundControls />
        </section>
      )}
    </>
  );
}
