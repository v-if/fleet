# Phase 4 선행 — Supabase Auth ↔ FMS User 매핑 (설계 메모)

> **Phase 3.9**에서 `User` · `TeslaAccount` · `Vehicle` 계층을 구현했다. Phase 4 인증 연동 시 아래 방안을 따른다.

## 매핑 방안

| 항목 | 결정(안) |
|------|----------|
| FMS `User.id` | Supabase `auth.users.id`와 **동일 UUID** 사용 (`User.id` = `auth.users.id`) |
| 최초 로그인 | `auth.users` 생성 시 `User` 행 upsert (`email`, `name`) |
| TeslaAccount | `userId` = **현재 로그인 세션** FMS User — 멀티 계정은 User 1:N TeslaAccount 유지 |
| API 다테넌시 | 인증 미들웨어에서 `session.user.id` → 해당 User의 TeslaAccount·Vehicle만 조회 |

## Phase 3.9 과도기 (현재)

- `admin@fleet.local` / `getOrCreateDefaultUser()` **사용 중단** — seed·OAuth도 더 이상 기본 관리자를 만들지 않음
- 로그인은 `auth.users` + public `User` 조합으로 검증하고, 세션 쿠키(`fleet_session`)를 발급
- Tesla OAuth 시작 시 `tesla_oauth_user` + `tesla_oauth_return_to` 쿠키를 저장하고, callback에서 해당 User에 `TeslaAccount` upsert 후 원래 화면으로 복귀
- 차량 동기화·disconnect·status API는 **세션 User** 소속 계정만 사용
- `Vehicle.teslaAccountId`는 **`User.id`가 아니라 `TeslaAccount.id`** 를 가리키며, 실제 User 매핑은 `TeslaAccount.userId`를 통해 연결된다
- Phase 4에서 Supabase Auth 세션으로 교체·API 전체 다테넌시 강화

## 참고

- [requirements-user-db.md](./requirements-user-db.md) §4.1 UDB-USER-02
- [development-checklist.md](./development-checklist.md) Phase 4 인증
