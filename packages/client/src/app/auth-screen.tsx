// 로그인·회원등록 화면. 같은 화면의 탭으로 전환하고, 가입하면 로그인 탭으로 이동한다(PRD 로그인·회원등록).
import { useState } from 'react';
import type { FormEvent } from 'react';
import { NICKNAME_MAX, NICKNAME_MIN, PASSWORD_MAX, PASSWORD_MIN, type Me } from '@alkkagi/shared';
import { describeApiError, type Api } from './api.ts';
import { validateLogin, validateSignup } from './logic.ts';
import { WAKING_SERVER_MESSAGE } from './messages.ts';
import { usePendingNotice } from './use-pending-notice.ts';

type Tab = 'login' | 'signup';

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
      <section className="auth-card">
        <h1 className="logo">알까기 바</h1>
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'login'}
            className={tab === 'login' ? 'tab tab-on' : 'tab'}
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
            className={tab === 'signup' ? 'tab tab-on' : 'tab'}
            onClick={() => {
              switchTab('signup');
            }}
          >
            회원등록
          </button>
        </div>
        <form
          className="form"
          onSubmit={(e) => {
            void submit(e);
          }}
        >
          <label className="field">
            <span>닉네임</span>
            <input
              value={nickname}
              maxLength={NICKNAME_MAX}
              autoComplete="username"
              autoFocus
              onChange={(e) => {
                setNickname(e.target.value);
              }}
            />
          </label>
          <label className="field">
            <span>비밀번호</span>
            <input
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
            <label className="field">
              <span>비밀번호 확인</span>
              <input
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
          {tab === 'signup' && (
            <p className="hint">
              닉네임은 한글·영문·숫자 {NICKNAME_MIN}~{NICKNAME_MAX}자, 비밀번호는 {PASSWORD_MIN}~
              {PASSWORD_MAX}자예요.
            </p>
          )}
          {error && (
            <p className="msg msg-error" role="alert">
              {error}
            </p>
          )}
          {info && (
            <p className="msg msg-info" role="status">
              {info}
            </p>
          )}
          {waking && (
            <p className="msg msg-info" role="status">
              {WAKING_SERVER_MESSAGE}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? '잠시만요…' : tab === 'login' ? '로그인' : '회원등록'}
          </button>
        </form>
      </section>
    </main>
  );
}
