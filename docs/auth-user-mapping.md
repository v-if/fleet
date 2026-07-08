# Phase 4 선행 — Supabase Auth ↔ FMS User 매핑 (설계 메모)

> **Phase 3.9**에서 `User` · `TeslaAccount` · `Vehicle` 계층을 구현했다. Phase 4 인증 연동 시 아래 방안을 따른다.

## 매핑 방안

| 항목 | 결정(안) |
|------|----------|
| FMS `User.id` | Supabase `auth.users.id`와 **동일 UUID** 사용 (`User.id` = `auth.users.id`) |
| 최초 로그인 | `auth.users` 생성 시 `User` 행 upsert (`email`, `name`) |
| TeslaAccount | `userId` = 로그인한 FMS User — 멀티 계정은 User 1:N TeslaAccount 유지 |
| API 다테넌시 | 인증 미들웨어에서 `session.user.id` → 해당 User의 TeslaAccount·Vehicle만 조회 |

## Phase 3.9 과도기 (현재)

- `getOrCreateDefaultUser()` — `admin@fleet.local` 단일 관리자 (데모)
- 로그인은 `auth.users` + public `User` 조합으로 검증하고, 세션 쿠키를 발급
- Tesla OAuth·sync·unlink는 현재 로그인한 단일 테스트 사용자 흐름을 기준으로 동작
- Phase 4에서 세션 기반 User로 교체

## 참고

- [requirements-user-db.md](./requirements-user-db.md) §4.1 UDB-USER-02
- [development-checklist.md](./development-checklist.md) Phase 4 인증
