# Fleet FMS

차량 관제 시스템(FMS) MVP — Next.js + Prisma + Mock/Tesla 데이터 연동

## 빠른 시작

```powershell
$env:Path = "$env:LOCALAPPDATA\pnpm;$env:Path"
pnpm install
# Phase 3.6: .env에 Supabase DATABASE_URL·DIRECT_URL 설정 후
pnpm db:setup   # migrate + seed (최초 1회)
pnpm dev
```

- 대시보드: http://localhost:3000
- 차량 목록: http://localhost:3000/vehicles
- 지도: http://localhost:3000/map
- 연동 설정: http://localhost:3000/settings
- API: http://localhost:3000/api/vehicles

Phase 2.1부터 충전·TPMS·센트리 등 Tesla API §5.2 필드가 Mock으로 표시됩니다.
Phase 2.2부터 지도 Hero·커스텀 마커·Tesla EV 테마·탭/위젯 UI가 적용됩니다.
Phase 3부터 Tesla Fleet API OAuth 연동·동기화 파이프라인(Mock 폴백)이 지원됩니다.
Phase 3.6에서 Supabase PostgreSQL로 전환했습니다. 로컬은 `pnpm db:setup` 완료·API 200 확인됨 ([가이드](./docs/setup-guide.md#57-supabase-postgresql-phase-36)).
Phase 3.5에서 Partner Register와 Tesla sync 검증을 진행했습니다. 현재 로컬 기준 `provider=tesla`, `usedFallback=false`가 확인됩니다 ([체크리스트](./docs/development-checklist.md#phase-35-tesla-partner-register-m35)).

**배포 URL**: https://fleet-tau.vercel.app/ — Vercel에 `DATABASE_URL`·`DIRECT_URL`(Session pooler) 등록 및 재배포 필요 (현재 API 500)

## 주요 스크립트

| 명령 | 설명 |
|------|------|
| `pnpm dev` | 개발 서버 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm db:migrate` | Prisma 마이그레이션 |
| `pnpm db:setup` | Supabase 마이그레이션 + 시드 (Phase 3.6) |
| `pnpm db:deploy` | 프로덕션 마이그레이션만 적용 |

## 문서

기획·개발 문서는 [`docs/`](./docs/README.md) 참고.

## 환경 변수

`.env.example`을 참고해 `.env`를 구성한다.

- `DATABASE_URL` — Supabase **Transaction pooler** URL (포트 6543)
- `DIRECT_URL` — Supabase **Session pooler** URL (포트 5432, migrate용). Direct `db.xxx` 차단 시 pooler 호스트 사용
- `VEHICLE_DATA_PROVIDER=mock` (또는 `tesla`)
- Tesla 연동 시 `.env.example`의 `TESLA_FLEET_API_*` 참고 (한국 계정 리전: `na`)
