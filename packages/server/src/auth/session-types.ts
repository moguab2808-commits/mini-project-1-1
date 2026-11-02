// express-session의 세션 데이터에 로그인한 사용자 번호를 둔다. 사용자 번호는 서버 안에서만 쓴다.
declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

export {};
