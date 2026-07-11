# 데이터베이스 요구사항 정의서

## 1. 문서 개요

| 항목 | 내용 |
|------|------|
| 목적 | 로컬·배포(Vercel) 환경의 DB 전략, Vercel 배포 오류 분석, Supabase PostgreSQL 전환(Phase 3.6) 요구사항 정의 |
| 관련 문서 | [requirements-tech-stack.md](./requirements-tech-stack.md), [development-checklist.md](./development-checklist.md), [setup-guide.md](./setup-guide.md), [requirements-tesla-api.md](./requirements-tesla-api.md), [requirements-user-db.md](./requirements-user-db.md) |
| 적용 범위 | Phase 1(로컬 SQLite) ~ Phase 3.6(배포 DB) ~ Phase 4(인증·안정화) |

---

## 2. 배경 — 기술스택과 현재 상태

### 2.1 원래 계획

| Phase | DB | 비고 |
|-------|-----|------|
| Phase 1~3 | **SQLite** (`prisma/dev.db`) | 1인 개발 속도 우선, 로컬 Mock·Tesla 연동 파이프라인 검증 |
| **Phase 3.6** | **Supabase PostgreSQL** | Vercel 배포 API 정상화·Tesla 배포 테스트 (DB만, Auth 제외) |
| Phase 4~5 | Supabase PostgreSQL (유지) | Phase 4: Supabase Auth / Phase 5: production 분리 |

기술스택 문서(`requirements-tech-stack.md`)의 최종 권장은 **Next.js + Supabase(PostgreSQL)** 이다.

### 2.2 현재 구현 (2026-07-07)

- Prisma `provider = "postgresql"`, Supabase dev `DATABASE_URL` + Session pooler `DIRECT_URL`
- 차량·스냅샷·이벤트·**TeslaAccount**(OAuth 토큰)·동기화 메타데이터를 **Supabase PostgreSQL**에 저장
- 로컬: `pnpm db:setup` + `pnpm dev` → `/api/vehicles` **200**, Mock 12대
- Vercel 배포(`https://bori-fleet.shop`): UI·API **200**, mock·tesla 연동 검증 완료 (커스텀 도메인)

---

## 3. Vercel 배포 오류 분석 (bori-fleet.shop)

### 3.1 증상

| 구분 | 로컬 (`localhost:3000`) | Vercel (`bori-fleet.shop`) |
|------|-------------------------|----------------------------------|
| 대시보드 HTML | ✅ 정상 | ✅ 정상 (레이아웃·사이드바 표시) |
| `GET /api/vehicles` | ✅ 200 + JSON | ✅ **200** + JSON (mock·tesla) |
| UI 메시지 | — | — (정상) |
| 지도·KPI·목록 | ✅ 데이터 표시 | ✅ 데이터 표시 (tesla 시 위치 `0,0`이면 지도 안내) |

### 3.2 오류 흐름

```
브라우저: GET /api/vehicles
    ↓
Next.js API Route (서버리스 함수)
    ↓
shouldAutoSync() / syncVehiclesFromProvider() / getVehiclesResponse()
    ↓
Prisma → SQLite (file:./dev.db)
    ↓
연결 실패 → 예외 미처리 → HTTP 500
    ↓
useVehicles: response.ok === false
    ↓
"차량 목록을 불러오지 못했습니다."
```

관련 코드:
- API: `src/app/api/vehicles/route.ts`
- 클라이언트: `src/hooks/use-vehicles.ts` (`!response.ok` 시 위 메시지 throw)
- DB: `prisma/schema.prisma` (`provider = "sqlite"`)

### 3.3 근본 원인

**Vercel 서버리스 환경에서 로컬 SQLite 파일 DB를 사용할 수 없다.**

| 제약 | 설명 |
|------|------|
| DB 파일 미배포 | `prisma/dev.db`는 `.gitignore` 대상 → **배포 아티팩트에 포함되지 않음** |
| 읽기 전용 FS | Vercel 함수의 파일 시스템은 **쓰기 불가** (일부 `/tmp` 예외 있으나 SQLite 운영에 부적합) |
| 인스턴스 분리 | 요청마다 cold start·인스턴스 분리 → 로컬 파일 DB 공유 불가 |
| `file:` URL | `DATABASE_URL=file:./dev.db`는 **단일 머신 로컬 디스크 전용** |

Vercel Function 로그에 예상되는 메시지:
- `PrismaClientInitializationError`
- `Environment variable not found: DATABASE_URL` (미설정 시)
- `Error code 14: Unable to open the database file` (SQLite 파일 없음)

### 3.4 오류 종류 구분 (트러블슈팅)

| 오류 | 의미 | 본 이슈 해당 |
|------|------|-------------|
| Vercel `404: NOT_FOUND` | 배포 자체 없음 / 도메인 미연결 | ❌ (해결됨 — 페이지 로드 성공) |
| Next.js 앱 404 페이지 | 라우트 없음 | ❌ |
| **API HTTP 500** | 서버 런타임 예외 (DB 등) | ✅ **본 이슈** |
| Tesla `412 register` | Fleet API 앱 미등록 | 별도 (Phase 3.5) — API가 DB까지 도달해야 확인 가능 |

### 3.5 결론

- **UI 배포는 성공**했으나, **데이터 계층이 로컬 SQLite에 묶여** Vercel 프로덕션에서 API가 동작하지 않는다.
- Phase 3 Tesla OAuth·동기화 코드는 로컬에서 검증되었으나, **배포 환경 E2E 테스트를 위해 클라우드 DB 전환이 선행**되어야 한다.
- 이 문제는 Tesla 연동 버그가 아니라 **DB 인프라 미스매치**이다.

---

## 4. Phase 3.6 — Supabase PostgreSQL 전환 (요구사항)

### 4.1 도입 목적

| 목적 | 설명 |
|------|------|
| **Vercel 배포 API 정상화** | `/api/vehicles` 등 Prisma 의존 API가 프로덕션에서 동작 |
| **Phase 3 Tesla 연동 배포 테스트** | OAuth 토큰·동기화·Mock 폴백을 `bori-fleet.shop`에서 검증 |
| **기술스택 정합** | 문서상 권장 DB(PostgreSQL)로 조기 전환, Phase 4 인증과 분리 |

### 4.2 범위 (In / Out)

#### In Scope (Phase 3.6)

- Supabase **dev** 프로젝트 생성 (또는 기존 프로젝트 활용)
- Prisma `datasource`를 `postgresql`로 전환
- 기존 스키마 마이그레이션 적용 (`vehicles`, `vehicle_snapshots`, `vehicle_events`, `tesla_oauth_tokens`, `sync_metadata`, `users`)
- Vercel **Environment Variables**에 Supabase `DATABASE_URL` 등록
- 로컬·Vercel 공통으로 시드/동기화 경로 검증 (`pnpm db:seed`, `/api/sync/vehicles`)
- 배포 URL에서 대시보드·지도·차량 목록·설정 화면 데이터 로드 확인

#### Out of Scope (Phase 4로 유지)

- **Supabase Auth** (관리자 로그인·미인증 차단)
- RLS(Row Level Security) 정책
- production/staging 환경 분리 고도화
- Supabase Realtime

> Phase 3.6은 **DB만** 먼저 올린다. 인증은 Phase 4에서 별도 스프린트로 진행한다.

### 4.3 환경별 DB 전략

| 환경 | DB | 용도 |
|------|-----|------|
| **로컬 개발** | Supabase PostgreSQL (dev 프로젝트 Connection Pooling URL) 또는 병행 SQLite *(전환 기간)* | 일상 개발 |
| **Vercel Preview** | 동일 dev DB 또는 별도 preview DB | PR 배포 테스트 |
| **Vercel Production** | Supabase dev(초기) → 추후 production 프로젝트(Phase 5) | `bori-fleet.shop` |

초기 MVP에서는 **Supabase dev 프로젝트 1개**를 로컬·Vercel이 공유해도 된다. (데모·1인 개발 규모)

### 4.4 Prisma·스키마 요구사항

#### 4.4.1 datasource 변경

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

#### 4.4.2 SQLite → PostgreSQL 호환 점검

| 항목 | 현재 | PostgreSQL 전환 시 |
|------|------|-------------------|
| `String` ID (cuid) | ✅ | ✅ 변경 없음 |
| `enum` 타입 | SQLite에서 문자열 매핑 | PostgreSQL native enum 또는 Prisma enum 유지 |
| `nearbyChargingSites` (JSON 문자열) | SQLite Text | PostgreSQL Text 또는 `Json` 타입 검토 |
| 관계·인덱스 | 기존 스키마 유지 | 마이그레이션 재생성 |

#### 4.4.3 마이그레이션 전략

1. Supabase 프로젝트에서 Connection String 확보 (Transaction pooler 권장 — serverless)
2. `prisma migrate dev` 또는 `prisma db push`로 PostgreSQL에 스키마 반영
3. `pnpm db:seed`로 Mock 12대 + 이벤트 주입
4. Vercel 재배포 후 `/api/vehicles` 200 확인

#### 4.4.4 DateTime / Timezone 정책

PostgreSQL `DateTime` 컬럼은 기본 `timestamp without time zone`으로 두지 않고, **`timestamptz(3)` 기준**으로 관리한다.

이유:

- 애플리케이션은 `new Date()` 기반으로 절대 시각(UTC instant)을 생성한다.
- `timestamp without time zone`은 이 값을 지역 시각 정보 없이 저장하므로, DB 콘솔에서 **UTC처럼 보이는 9시간 차이**가 발생할 수 있다.
- 차량 스냅샷, 로그, 동기화 시각은 **정렬·비교·추적**이 중요하므로 절대 시각 보존이 필요하다.

운영 원칙:

1. Prisma `DateTime`은 PostgreSQL에서 `@db.Timestamptz(3)`로 매핑한다.
2. DB 기본 timezone은 **`Asia/Seoul`** 로 맞춘다.
3. 기존 `timestamp` 데이터는 과거 저장값이 UTC 기준으로 들어간 것으로 보고 `AT TIME ZONE 'UTC'` 방식으로 `timestamptz`로 변환한다.
4. UI/API 표시는 계속 `ko-KR` locale 기반으로 렌더링한다.

### 4.5 환경 변수 요구사항

#### Vercel (Production / Preview)

| 변수 | 필수 | 예시·설명 |
|------|------|-----------|
| `DATABASE_URL` | **✅** | `postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | 권장 | Prisma migrate용 direct connection (pooler 외) |
| `VEHICLE_DATA_PROVIDER` | ✅ | `mock` 또는 `tesla` |
| `TESLA_FLEET_API_*` | Tesla 테스트 시 | Phase 3·3.5와 동일, redirect는 배포 URL |
| `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` | 지도용 | NCP Web 서비스 URL에 `https://bori-fleet.shop` 등록 |

#### 로컬 `.env`

- `DATABASE_URL`을 Supabase dev URL로 교체 (SQLite `file:./dev.db` 대체)
- 기존 Tesla·Naver Maps 변수 유지

> **주의**: `DATABASE_URL=file:./dev.db`를 Vercel에 설정해도 **해결되지 않는다**.

### 4.6 Tesla 연동 테스트 시나리오 (Phase 3 + 3.5 + 3.6)

Phase 3.6 완료 후, 배포 URL에서 아래 순서로 검증한다.

| 단계 | 작업 | 기대 결과 |
|------|------|-----------|
| 1 | Vercel + Supabase DB 연결 | `GET /api/vehicles` → **200**, Mock 12대 |
| 2 | 대시보드·지도·목록 | KPI·마커·테이블 표시 |
| 3 | `/settings` Tesla OAuth (배포 redirect URI) | 계정 연결됨 |
| 4 | Phase 3.5 Partner Register | 412 없이 sync 성공 |
| 5 | `POST /api/sync/vehicles` | `usedFallback: false`, 실차량 데이터 |

DB(3.6) 없이는 3·4·5 단계 API가 500으로 실패한다.

### 4.7 비기능 요구사항

| 항목 | 요구 |
|------|------|
| 비용 | Supabase Free tier ($0) — MVP·데모 규모 |
| 연결 | Serverless(Vercel) → **Connection Pooling URL** 사용 (직접 연결 5432는 연결 수 제한) |
| SSL | `?sslmode=require` (Supabase 기본) |
| 시크릿 | `DATABASE_URL`·Service Role은 git 제외, Vercel Environment Variables만 |
| 마이그레이션 | 로컬에서 migrate 후 Vercel은 `prisma generate` + 기존 마이그레이션 적용 |

### 4.8 리스크·대응

| 리스크 | 대응 |
|--------|------|
| SQLite→PostgreSQL enum/타입 차이 | 마이그레이션 후 `pnpm db:seed`·API smoke test |
| Connection pool 고갈 | Supabase pooler URL + Prisma `directUrl` 패턴 |
| 로컬·배포 DB 데이터 불일치 | 시드·sync API로 재주입, 데모는 Mock 폴백 유지 |
| Phase 4 Auth와 혼동 | 3.6은 DB만, Auth는 체크리스트 Phase 4에 명시 유지 |
| DateTime 9시간 오차 혼선 | `timestamptz(3)` + DB timezone `Asia/Seoul`로 통일 |

---

## 5. Phase 로드맵 (DB 관점)

```
Phase 1~3   SQLite (로컬)     — 개발·OAuth 파이프라인 ✅
     ↓
Phase 3.6   Supabase PostgreSQL — Vercel API·배포 Tesla 테스트 (본 문서)
     ↓
Phase 3.5   Partner Register    — Tesla 실데이터 (DB 선행 필요)
     ↓
Phase 4     Supabase Auth       — 관리자 로그인·API 보호
     ↓
Phase 3.9   User·TeslaAccount·Vehicle — 멀티 계정·연동 해제 스키마 ([requirements-user-db.md](./requirements-user-db.md))
     ↓
Phase 4     AuditLog·ApiCallLog — 감사·추적 로그 DB ([requirements-log-db.md](./requirements-log-db.md))
     ↓
Phase 5     Production DB 분리  — 데모데이·운영
```

**Phase 3.6은 Phase 3.5(Tesla Register)보다 먼저** 진행하는 것이 합리적이다. Register·OAuth 배포 테스트 모두 API→DB 경로가 필요하다.

---

## 6. 완료 기준 (Phase 3.6)

### 코드·인프라 (완료)
- [x] Prisma `postgresql` 전환 및 `directUrl` 설정
- [x] PostgreSQL 마이그레이션 `20260707143000_init_postgresql`
- [x] `build` 스크립트: `prisma generate` + `prisma migrate deploy` + `next build`
- [x] `pnpm db:setup` 스크립트 (migrate + seed)

### 운영 (Supabase·Vercel 설정 후)
- [x] Supabase dev 프로젝트 생성 및 Connection String 확보 (로컬, 2026-07-07)
- [x] 로컬 migrate·시드 (`pnpm db:setup`, Mock 12대)
- [x] 로컬 `GET /api/vehicles` → HTTP 200
- [x] Vercel `DATABASE_URL`(pooler)·`DIRECT_URL`(Session pooler) 등록 및 재배포 (2026-07-07)
- [x] `https://bori-fleet.shop/api/vehicles` → **HTTP 200** + 차량 JSON (2026-07-07)
- [x] 배포 대시보드에서 지도·KPI·목록 정상 표시 (mock·tesla, 2026-07-07)
- [x] (Tesla 테스트 시) OAuth·sync가 DB에 토큰·스냅샷 저장 가능 (2026-07-07)
- [x] Phase 3.9 — `TeslaAccount`·Vehicle soft-delete·마이그레이션 `20260708160000` (2026-07-08)

---

## 7. 참고 링크

- [Supabase — Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Prisma — Supabase guide](https://www.prisma.io/docs/guides/database/supabase)
- [Vercel — Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [development-checklist.md — Phase 3.6](./development-checklist.md)
- [setup-guide.md — §5.7](./setup-guide.md)

---

## 8. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-07 | 초안 — Vercel SQLite 500 분석, Phase 3.6 Supabase PostgreSQL 요구사항 정의 |
| 2026-07-07 | 코드 반영 — Prisma postgresql, 마이그레이션, build/deploy/db:setup (Supabase 연결 대기) |
| 2026-07-07 | 로컬 완료 — Supabase dev 연결, migrate·시드, API 200 / Vercel env·재배포 대기 |
| 2026-07-07 | Vercel 배포 검증 완료 — env 등록·재배포, API 200, mock·tesla 연동 |
| 2026-07-08 | Phase 3.9 연계 — User·TeslaAccount·Vehicle 계층 요구사항은 [requirements-user-db.md](./requirements-user-db.md) 참고 |
| 2026-07-08 | Phase 3.9 구현 — `TeslaAccount` 테이블, `TeslaOAuthToken` 제거, unlink API |
| 2026-07-08 | Phase 4 선행 — API 로그·감사 DB 요구사항 [requirements-log-db.md](./requirements-log-db.md) 연계 |
| 2026-07-08 | Phase 4 P0 로그 구현 — `AuditLog`·`ApiCallLog` 테이블, 감사 로그 마이그레이션 반영 |
| 2026-07-10 | Production 도메인 — `bori-fleet.shop` (커스텀 도메인) |
