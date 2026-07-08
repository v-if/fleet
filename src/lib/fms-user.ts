/**
 * @deprecated Phase 3.9 이후 Tesla OAuth는 로그인 세션 userId에 귀속한다.
 * `admin@fleet.local` 기본 사용자는 더 이상 생성하지 않는다.
 * 계정은 `auth.users` + public `"User"`를 DB/관리 작업으로만 추가한다.
 */
export const DEFAULT_USER_EMAIL = "admin@fleet.local";
