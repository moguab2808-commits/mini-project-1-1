// 화면이 떠 있는 동안 배경음악을 요청하는 훅(DEC-084). 화면이 사라지면 요청을 거둔다.
import { useEffect } from 'react';
import { audio, type TrackId } from './engine.ts';

/** 우선순위: 로비·설정 화면 0, 경기 화면 10(GameScreen이 직접 요청) */
export function useMusic(track: TrackId | null, priority = 0) {
  useEffect(() => {
    if (!track) return;
    return audio.requestMusic(track, priority);
  }, [track, priority]);
}
