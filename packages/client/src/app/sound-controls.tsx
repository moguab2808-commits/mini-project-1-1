// 소리 설정 칸(DEC-084·DEC-085·DEC-087): 배경음악·배경 소리·효과음마다 켜기 스위치와 음량 막대.
// 로비 환경설정 창과 어디서나 여는 소리 버튼 창이 같이 쓴다. 바꾸면 바로 저장·적용한다.
import { useState } from 'react';
import { audio } from '../audio/engine.ts';
import '../ui/theme.css';
import './sound-controls.css';
import {
  clampVolume,
  loadSoundOn,
  loadVolumeOf,
  saveSoundOn,
  saveVolumeOf,
  type VolumeKind,
} from './settings.ts';

const KINDS = [
  ['music', '배경음악'],
  ['ambience', '배경 소리'],
  ['sfx', '효과음'],
] as const;

export function SoundControls() {
  const [soundOn, setSoundOn] = useState<Record<VolumeKind, boolean>>(() => ({
    music: loadSoundOn('music'),
    ambience: loadSoundOn('ambience'),
    sfx: loadSoundOn('sfx'),
  }));
  const [volumes, setVolumes] = useState<Record<VolumeKind, number>>(() => ({
    music: loadVolumeOf('music'),
    ambience: loadVolumeOf('ambience'),
    sfx: loadVolumeOf('sfx'),
  }));
  return (
    <div className="sound-controls">
      {KINDS.map(([kind, label]) => (
        <div key={kind} className="sound-field">
          <div className="sound-row">
            <span>
              {label} {soundOn[kind] ? `음량 ${volumes[kind]}` : '꺼짐'}
            </span>
            <label className="sound-toggle">
              <input
                type="checkbox"
                checked={soundOn[kind]}
                aria-label={`${label} 켜기`}
                onChange={(e) => {
                  const on = e.target.checked;
                  setSoundOn((v) => ({ ...v, [kind]: on }));
                  saveSoundOn(kind, on);
                  audio.applySettings(kind);
                }}
              />
              켜기
            </label>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={volumes[kind]}
            disabled={!soundOn[kind]}
            aria-label={`${label} 음량`}
            onChange={(e) => {
              const value = clampVolume(Number(e.target.value));
              setVolumes((v) => ({ ...v, [kind]: value }));
              saveVolumeOf(kind, value);
              audio.applySettings(kind);
            }}
          />
        </div>
      ))}
      <p className="sound-hint">이 브라우저에만 저장돼요.</p>
    </div>
  );
}
