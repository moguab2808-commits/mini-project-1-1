// 로그인·회원등록 화면. 같은 화면의 탭으로 전환하고, 가입하면 로그인 탭으로 이동한다(PRD 로그인·회원등록).
// 배경은 L 세트 일러스트를 움직이게 만든 영상을 반복 재생한다. 움직임 줄이기 설정이면 첫 장면 그림만 둔다.
import { useEffect, useRef, useState } from 'react';
import { SoundButton } from './sound-button.tsx';
import type { FormEvent } from 'react';
import { NICKNAME_MAX, NICKNAME_MIN, PASSWORD_MAX, PASSWORD_MIN, type Me } from '@alkkagi/shared';
import { describeApiError, type Api } from './api.ts';
import { validateLogin, validateSignup } from './logic.ts';
import { WAKING_SERVER_MESSAGE } from './messages.ts';
import { usePendingNotice } from './use-pending-notice.ts';

type Tab = 'login' | 'signup';

const BG_VIDEO = '/videos/login-bg.mp4';
const BG_POSTER = '/images/login-bg-poster.webp';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 화면을 가득 덮는 반복 배경 영상. 재생이 막혀도 포스터(첫 장면)가 그대로 보인다. */
function AuthBackground() {
  const ref = useRef<HTMLVideoElement>(null);
  const [still] = useState(prefersReducedMotion);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // React가 muted를 속성으로 쓰지 않는 경우가 있어 자동 재생 조건(음소거)을 직접 맞춘다.
    v.muted = true;
    v.play().catch(() => undefined);
  }, []);
  return (
    <div className="auth-bg" aria-hidden="true">
      {!still && (
        <video
          ref={ref}
          className="auth-bg-video"
          src={BG_VIDEO}
          poster={BG_POSTER}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
        />
      )}
    </div>
  );
}

const canFullscreen = () => typeof document !== 'undefined' && document.fullscreenEnabled === true;

/** 오른쪽 위 전체 화면 버튼(소리 버튼 왼쪽). 지원하지 않는 브라우저에서는 숨긴다. */
function FullscreenButton() {
  const [on, setOn] = useState(
    () => typeof document !== 'undefined' && !!document.fullscreenElement,
  );
  useEffect(() => {
    const sync = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  if (!canFullscreen()) return null;
  const label = on ? '전체 화면 끝내기' : '전체 화면';
  return (
    <button
      type="button"
      className="auth-fullscreen"
      aria-label={label}
      title={label}
      onClick={() => {
        const req = on ? document.exitFullscreen() : document.documentElement.requestFullscreen();
        req.catch(() => undefined);
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d={
            on ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'
          }
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export interface AuthScreenProps {
  api: Api;
  /** 끊김·중복 접속 등으로 이 화면에 온 사유 */
  notice?: string;
  onLoggedIn: (me: Me) => void;
}

export function AuthScreen({ api, notice, onLoggedIn }: AuthScreenProps) {
  const [tab, setTab] = useState<Tab>('login');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(notice ?? null);
  const [busy, setBusy] = useState(false);
  const waking = usePendingNotice(busy);

  const switchTab = (next: Tab) => {
    setTab(next);
    setError(null);
    setInfo(null);
    setPassword('');
    setPasswordConfirm('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setInfo(null);
    const loginNickname = nickname.trim();
    const invalid =
      tab === 'login'
        ? validateLogin(loginNickname, password)
        : validateSignup({ nickname, password, passwordConfirm });
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    try {
      if (tab === 'login') {
        onLoggedIn(await api.login({ nickname: loginNickname, password }));
        return;
      }
      await api.signup({ nickname, password });
      setTab('login');
      setPassword('');
      setPasswordConfirm('');
      setInfo('가입이 완료됐어요. 로그인해 주세요.');
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <AuthBackground />
      <div className="auth-corner">
        <SoundButton />
        <FullscreenButton />
      </div>
      <header className="auth-hero">
        <h1 className="l-logo auth-logo">증강 알까기</h1>
        <p className="l-ribbon auth-tagline">✦ 장난감 왕국에서 벌어지는 알까기 대결 ✦</p>
      </header>
      <section className="auth-card l-tray" aria-label={tab === 'login' ? '로그인' : '회원등록'}>
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'login'}
            className={tab === 'login' ? 'auth-tab auth-tab-on' : 'auth-tab'}
            onClick={() => {
              switchTab('login');
            }}
          >
            로그인
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'signup'}
            className={tab === 'signup' ? 'auth-tab auth-tab-on' : 'auth-tab'}
            onClick={() => {
              switchTab('signup');
            }}
          >
            회원등록
          </button>
        </div>
        <form
          className={tab === 'signup' ? 'auth-form auth-form-signup' : 'auth-form'}
          onSubmit={(e) => {
            void submit(e);
          }}
        >
          <div className="auth-fields">
            <label className="auth-field">
              <span>닉네임</span>
              <input
                className="l-input"
                value={nickname}
                maxLength={NICKNAME_MAX}
                autoComplete="username"
                autoFocus
                onChange={(e) => {
                  setNickname(e.target.value);
                }}
              />
            </label>
            <label className="auth-field">
              <span>비밀번호</span>
              <input
                className="l-input"
                type="password"
                value={password}
                maxLength={PASSWORD_MAX}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
              />
            </label>
            {tab === 'signup' && (
              <label className="auth-field">
                <span>비밀번호 확인</span>
                <input
                  className="l-input"
                  type="password"
                  value={passwordConfirm}
                  maxLength={PASSWORD_MAX}
                  autoComplete="new-password"
                  onChange={(e) => {
                    setPasswordConfirm(e.target.value);
                  }}
                />
              </label>
            )}
          </div>
          <button type="submit" className="l-btn l-btn-primary auth-submit" disabled={busy}>
            {busy ? (
              '잠시만요…'
            ) : tab === 'login' ? (
              <>
                입장하기
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />
                </svg>
              </>
            ) : (
              '회원등록'
            )}
          </button>
        </form>
      </section>
      {/* 안내·오류는 창 밖 아래 한 줄에 둬서 창 두께가 바뀌지 않게 한다. 안내·오류가 있으면 입력 규칙 대신 보인다. */}
      <div className="auth-below">
        {error ? (
          <p className="msg msg-error" role="alert">
            {error}
          </p>
        ) : waking ? (
          <p className="msg msg-info" role="status">
            {WAKING_SERVER_MESSAGE}
          </p>
        ) : info ? (
          <p className="msg msg-info" role="status">
            {info}
          </p>
        ) : (
          <p className="auth-hint">
            {tab === 'login' ? (
              <>
                닉네임은 한글·영문·숫자 {NICKNAME_MIN}~{NICKNAME_MAX}자예요.
              </>
            ) : (
              <>
                닉네임은 한글·영문·숫자 {NICKNAME_MIN}~{NICKNAME_MAX}자, 비밀번호는 {PASSWORD_MIN}~
                {PASSWORD_MAX}자예요.
              </>
            )}
          </p>
        )}
      </div>
    </main>
  );
}
