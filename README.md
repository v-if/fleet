# Fleet FMS

차량 관제 시스템(FMS) MVP — Next.js + Prisma + Mock/Tesla 데이터 연동

## 빠른 시작

```powershell
$env:Path = "$env:LOCALAPPDATA\pnpm;$env:Path"
pnpm install
pnpm db:seed    # 최초 1회
pnpm dev
```

- 대시보드: http://localhost:3000
- 차량 목록: http://localhost:3000/vehicles
- 지도: http://localhost:3000/map
- API: http://localhost:3000/api/vehicles

## 주요 스크립트

| 명령 | 설명 |
|------|------|
| `pnpm dev` | 개발 서버 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm db:migrate` | Prisma 마이그레이션 |
| `pnpm db:seed` | Mock 차량 데이터 시드 |

## 문서

기획·개발 문서는 [`docs/`](./docs/README.md) 참고.

## 환경 변수

`.env.example`을 참고해 `.env`를 구성한다. Phase 1 기본값:

- `DATABASE_URL=file:./dev.db` (SQLite, `prisma/dev.db`)
- `VEHICLE_DATA_PROVIDER=mock`
