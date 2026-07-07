# Fleet FMS

차량 관제 시스템(FMS) MVP — Next.js + Prisma + Mock/Tesla 데이터 연동

## 빠른 시작

```powershell
$env:Path = "$env:LOCALAPPDATA\pnpm;$env:Path"
pnpm install
pnpm db:seed    # 최초 1회 또는 스키마 변경 후
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
Phase 3.5에서 Partner Register 완료 시 본인 Tesla 실차량 데이터 연동이 가능합니다 ([체크리스트](./docs/development-checklist.md#phase-35-tesla-partner-register-m35)).

## 주요 스크립트

| 명령 | 설명 |
|------|------|
| `pnpm dev` | 개발 서버 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm db:migrate` | Prisma 마이그레이션 |
| `pnpm db:seed` | Provider 기준 차량 데이터 시드/동기화 |

## 문서

기획·개발 문서는 [`docs/`](./docs/README.md) 참고.

## 환경 변수

`.env.example`을 참고해 `.env`를 구성한다. Phase 1 기본값:

- `DATABASE_URL=file:./dev.db` (SQLite, `prisma/dev.db`)
- `VEHICLE_DATA_PROVIDER=mock` (또는 `tesla`)
- Tesla 연동 시 `.env.example`의 `TESLA_FLEET_API_*` 참고 (한국 계정 리전: `na`)
