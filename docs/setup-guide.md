# FMS 개발 설치 가이드 (단계별)

이 가이드는 **한 번에 모든 것을 설치하지 않고**, 개발 Phase에 맞춰 필요한 시점에 도구를 설치하는 방식이다. 각 섹션은 [development-checklist.md](./development-checklist.md)의 Phase와 대응한다.

- 환경: **Windows / PowerShell** 기준
- 패키지 매니저: **pnpm**
- 기술스택 상세: [requirements-tech-stack.md](./requirements-tech-stack.md)

> 원칙: "지금 필요한 것만 설치한다." 다음 Phase 도구는 해당 Phase에 진입할 때 설치한다.

---

## §1. 사전 준비 — 필수 기본 도구 (Phase 0)

가장 먼저 개발에 반드시 필요한 것만 설치한다.

### 1.1 Git
```powershell
winget install --id Git.Git -e
git --version
```

### 1.2 Node.js (LTS)
```powershell
winget install --id OpenJS.NodeJS.LTS -e
node -v
npm -v
```
> 여러 Node 버전을 관리하려면 `nvm-windows`(`winget install CoreyButler.NVMforWindows`)를 대신 사용해도 된다.

### 1.3 pnpm
```powershell
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
```
> `corepack`이 권한 문제로 실패하면, Windows에서는 사용자 로컬 경로에 설치할 수 있다.
```powershell
npm install --global pnpm --prefix "$env:LOCALAPPDATA\pnpm"
& "$env:LOCALAPPDATA\pnpm\pnpm.cmd" -v
```
> 이 경우 현재 PowerShell 세션에서는 `pnpm` 대신 `"$env:LOCALAPPDATA\pnpm\pnpm.cmd"` 경로로 실행하거나, 이후 PATH에 사용자 로컬 경로를 추가한다.

### 1.4 Cursor 에디터 확장 (권장)
- ESLint / Prettier / Prisma / Tailwind CSS IntelliSense

**여기까지가 개발 시작 전 최소 준비다. 아래는 각 Phase 진입 시 설치한다.**

---

## §2. 저장소 초기화 (Phase 0)

```powershell
cd c:\CursorProject\fleet
git init
```
`.gitignore`에 아래가 포함되어야 한다. (Phase 1에서 프로젝트 생성 시 대부분 자동 추가됨)
```
node_modules/
.next/
.env*.local
.env
```

---

## §3. 프로젝트 기반 구축 (Phase 1)

> **실행 완료 (2026-07-06)** — 로컬 DB는 SQLite(`prisma/dev.db`). Supabase PostgreSQL은 Phase 4에서 전환.

### 3.1 Next.js + TypeScript + Tailwind 생성

루트에 `docs/`, `benchmarking/` 등이 있으면 빈 폴더가 아니므로, 임시 폴더에 생성 후 루트로 이동한다.

```powershell
$env:Path = "$env:LOCALAPPDATA\pnpm;$env:Path"
pnpm dlx create-next-app@latest web-temp --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --yes
# web-temp 내용을 프로젝트 루트로 이동 후 web-temp 삭제
```

실행 확인:
```powershell
pnpm dev
```

### 3.2 Prettier
```powershell
pnpm add -D prettier eslint-config-prettier
```

### 3.3 shadcn/ui
```powershell
pnpm dlx shadcn@latest init -y -d
pnpm dlx shadcn@latest add button card table badge -y
```

### 3.4 Prisma + 로컬 DB (SQLite)

Phase 1은 Supabase 없이 **SQLite**로 빠르게 시작한다. (Supabase는 Phase 4)

```powershell
pnpm add @prisma/client@6 dotenv
pnpm add -D prisma@6 tsx
pnpm approve-builds @prisma/client @prisma/engines prisma
```

`.env` (Prisma CLI용, git 제외):
```
DATABASE_URL="file:./dev.db"
VEHICLE_DATA_PROVIDER=mock
```

> `file:./dev.db` 경로는 `prisma/schema.prisma` 기준 상대경로 → 실제 파일은 `prisma/dev.db`

마이그레이션·시드:
```powershell
pnpm exec prisma migrate dev --name init
pnpm db:seed
```

### 3.5 환경 변수

`.env.example` (git 포함) — Supabase·Tesla·Kakao 키는 이후 Phase에서 채운다.

### 3.6 Supabase 클라이언트 (스텁)

```powershell
pnpm add @supabase/supabase-js
```

`src/lib/supabase/client.ts` — URL·키 미설정 시 `null` 반환 (Phase 4에서 연결).

### 3.7 Phase 1 검증

```powershell
pnpm lint
pnpm build
pnpm dev
# 다른 터미널에서
Invoke-RestMethod http://localhost:3000/api/vehicles
```

**Phase 1 완료 후 다음 Phase 전까지 추가 설치 불필요.**

---

## §4. 핵심 화면 (Phase 2)

> **실행 완료 (2026-07-06)** — 대시보드·목록·지도·상세 화면 구현

### 4.1 TanStack Query
```powershell
pnpm add @tanstack/react-query
```
- `src/components/providers/query-provider.tsx` — 60초 폴링
- `src/hooks/use-vehicles.ts` — `/api/vehicles`, `/api/vehicles/[id]`

### 4.2 Kakao Maps
- [Kakao Developers](https://developers.kakao.com)에서 앱 생성 → JavaScript 키 발급
- `.env`에 `NEXT_PUBLIC_KAKAO_MAP_KEY` 설정
- **키가 없으면** `SimpleMapFallback` 간이 지도로 자동 전환 (데모 가능)

### 4.3 주요 페이지
| 경로 | 설명 |
|------|------|
| `/` | 대시보드 (KPI, 알림 패널, 지도, 목록) |
| `/vehicles` | 차량 목록 (검색·필터) |
| `/map` | 전체 지도 (마커 클릭 → 요약) |
| `/vehicles/[id]` | 차량 상세 (상태 + 지도 + 이벤트) |

### 4.4 Phase 2 검증
```powershell
pnpm lint
pnpm build
pnpm dev
Invoke-RestMethod http://localhost:3000/api/vehicles
```

---

## §4.5. 조회 데이터 화면 매핑 (Phase 2.1)

> **실행 완료 (2026-07-07)** — [requirements-tesla-api.md §5.2](./requirements-tesla-api.md) 기준 Mock 데이터 화면 반영

### 4.5.1 스키마 확장
`VehicleSnapshot`에 충전·주행거리·잠금/개폐·공조·TPMS·센트리·서비스·펌웨어·인근 충전소 필드 추가.

```powershell
pnpm db:push
pnpm db:seed
```

### 4.5.2 화면 반영
| 화면 | 추가 항목 |
|------|-----------|
| 대시보드 KPI | 충전중 |
| 대시보드 알림 | 경고·센트리·TPMS·보안 이상 |
| 차량 목록 | 충전 상태, 주행거리(odometer) |
| 차량 상세 | 잠금/개폐, 공조, TPMS, 정비·펌웨어, 인근 충전소, 이벤트 |

### 4.5.3 Phase 2.1 검증
```powershell
pnpm lint
pnpm build
pnpm db:seed
pnpm dev
Invoke-RestMethod http://localhost:3000/api/vehicles | ConvertTo-Json -Depth 6
```

---

## §4.6. 프론트 UI/UX 개선 (Phase 2.2)

> **실행 완료 (2026-07-07)** — [requirements-front-design.md](./requirements-front-design.md) 기준 Pleos 벤치마킹 + Tesla EV 감성

### 4.6.1 주요 변경
| 영역 | 내용 |
|------|------|
| 테마 | 딥 사이드바 + Tesla 레드 포인트 (`globals.css`) |
| 공통 | `PageHeader`, `Breadcrumb`, `RefreshButton` |
| 대시보드 | 지도 Hero, 커스텀 마커, 이상/미운행/충전 위젯 |
| 목록 | 총 N건 배지, 위치 컬럼, 페이지네이션 |
| 상세 | 요약 헤더, 홈/이벤트 탭, TPMS 도식, 배터리 게이지 |

### 4.6.2 Phase 2.2 검증
```powershell
pnpm lint
pnpm build
pnpm dev
```

---

## §5. 데이터 연동 (Phase 3)

이 단계에서는 **Tesla Fleet API OAuth**와 **Provider 동기화**가 핵심이다.

### 5.1 테슬라 Fleet API 앱 등록
1. [Tesla Developer](https://developer.tesla.com)에서 애플리케이션 등록
2. 스코프: `openid`, `offline_access`, `vehicle_device_data`, `vehicle_location`
3. URL 등록 (로컬 개발):
   - 출처: `http://localhost:3000`
   - 리디렉션 URI: `http://localhost:3000/api/auth/tesla/callback`
   - 반환 URL: `http://localhost:3000/settings`
4. `.env`에 인증 정보 추가:

```
VEHICLE_DATA_PROVIDER=tesla
TESLA_FLEET_API_CLIENT_ID=
TESLA_FLEET_API_CLIENT_SECRET=
TESLA_FLEET_API_REDIRECT_URI=http://localhost:3000/api/auth/tesla/callback
TESLA_FLEET_API_REGION=na
TESLA_SYNC_POLL_INTERVAL_MINUTES=3
TESLA_SYNC_CRON_SECRET=
```

> **리전(`TESLA_FLEET_API_REGION`)** — OAuth `audience`와 Fleet API base URL에 사용된다.
>
> | 값 | 대상 | audience URL |
> |----|------|--------------|
> | `na` | **한국(KR)·일본·호주 등 아시아태평양(중국 제외)**, 북미 | `https://fleet-api.prd.na.vn.cloud.tesla.com` |
> | `eu` | 유럽·중동·아프리카 | `https://fleet-api.prd.eu.vn.cloud.tesla.com` |
> | `cn` | 중국(별도 developer.tesla.cn 앱) | `https://fleet-api.prd.cn.vn.cloud.tesla.cn` |
>
> 한국 계정은 **`na`** 를 사용한다. `ap` 등 비공식 URL은 `Invalid audience` 오류가 난다.

### 5.2 OAuth 연결
1. `pnpm dev` 실행 후 http://localhost:3000/settings 접속
2. **Tesla 계정 연결** 클릭 → Tesla 로그인·동의
3. 콜백 성공 시 자동 동기화 후 대시보드에서 실데이터 확인

**트러블슈팅 — `Invalid audience`**
- 원인: `TESLA_FLEET_API_REGION`이 Tesla 공식 리전과 불일치 (예: 잘못된 `ap`)
- 해결: 한국 계정은 `TESLA_FLEET_API_REGION=na` 로 설정 후 dev 서버 재시작

**트러블슈팅 — `412 must be registered`**
- 원인: OAuth는 성공했으나 앱이 Fleet API 리전에 Partner Register 되지 않음
- 증상: `/settings` “계정 연결됨” + “최근 오류: 412 …” + Mock 폴백
- 해결: [§5.5 Partner Register](./setup-guide.md) (공개 HTTPS 도메인 + 공개키 + `POST /partner_accounts`)

수동 동기화:
```powershell
Invoke-RestMethod -Method POST http://localhost:3000/api/sync/vehicles
```

### 5.3 Provider 전환·폴백
| `VEHICLE_DATA_PROVIDER` | 동작 |
|-------------------------|------|
| `mock` | Mock 12대 데이터 |
| `tesla` | OAuth 연결 후 Fleet API 조회, 실패 시 Mock 자동 폴백 |

전환 후 서버 재시작 → `pnpm db:seed` 또는 설정 화면에서 **지금 동기화**.

### 5.4 주기 폴링
- 로컬: `GET /api/vehicles` 호출 시 `TESLA_SYNC_POLL_INTERVAL_MINUTES`(기본 3분) 경과하면 자동 sync
- 배포(Vercel Cron 예시): `POST /api/sync/vehicles` + `Authorization: Bearer $TESLA_SYNC_CRON_SECRET`

### 5.5 Tesla Partner Register (Phase 3.5) — 412 해결

Phase 3에서 OAuth “계정 연결됨”이어도, Fleet API 조회 시 아래 오류가 나면 **Partner Register**가 필요하다.

```
412: Account ... must be registered in the current region https://fleet-api.prd.na.vn.cloud.tesla.com
```

> OAuth(사용자 동의)와 Register(앱 등록)는 **별개**다. Register 없이는 Mock 폴백만 동작한다.

#### 5.5.1 사전 준비
1. **Vercel 등에 배포**해 공개 HTTPS 도메인 확보 (예: `fleet-xxx.vercel.app`)
2. Tesla 포털에 배포 도메인 추가
   - 출처: `https://fleet-xxx.vercel.app`
   - 리디렉션 URI: `https://fleet-xxx.vercel.app/api/auth/tesla/callback`
3. 배포 환경변수에 `TESLA_FLEET_API_*`, `VEHICLE_DATA_PROVIDER=tesla` 설정

#### 5.5.2 EC 키 쌍 생성
```powershell
openssl ecparam -name prime256v1 -genkey -noout -out private-key.pem
openssl ec -in private-key.pem -pubout -out public-key.pem
```
- `private-key.pem` — 비밀 보관 (git 제외)
- `public-key.pem` — 도메인에 호스팅

#### 5.5.3 공개키 호스팅
배포 도메인에 아래 경로로 공개키를 제공한다.

```
https://{domain}/.well-known/appspecific/com.tesla.3p.public-key.pem
```

Vercel 예: `public/.well-known/appspecific/com.tesla.3p.public-key.pem` 에 파일 배치 후 배포.

#### 5.5.4 Partner 토큰 발급 + Register (한국 → `na`)

**1) Partner 토큰** (`client_credentials` — OAuth 사용자 토큰과 다름)

```powershell
$body = @{
  grant_type    = "client_credentials"
  client_id     = $env:TESLA_FLEET_API_CLIENT_ID
  client_secret = $env:TESLA_FLEET_API_CLIENT_SECRET
  audience      = "https://fleet-api.prd.na.vn.cloud.tesla.com"
  scope         = "openid offline_access vehicle_device_data vehicle_location"
}
$token = Invoke-RestMethod -Method POST `
  -Uri "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token" `
  -ContentType "application/x-www-form-urlencoded" `
  -Body $body
$partnerToken = $token.access_token
```

**2) Register**

```powershell
$domain = "fleet-xxx.vercel.app"   # scheme 없이 도메인만
Invoke-RestMethod -Method POST `
  -Uri "https://fleet-api.prd.na.vn.cloud.tesla.com/api/1/partner_accounts" `
  -Headers @{ Authorization = "Bearer $partnerToken" } `
  -ContentType "application/json" `
  -Body (@{ domain = $domain } | ConvertTo-Json)
```

**3) 등록 확인**

```powershell
Invoke-RestMethod `
  -Uri "https://fleet-api.prd.na.vn.cloud.tesla.com/api/1/partner_accounts/public_key?domain=$domain" `
  -Headers @{ Authorization = "Bearer $partnerToken" }
```

#### 5.5.5 연동 재검증
1. 배포 URL `/settings` → Tesla 계정 연결
2. **지금 동기화** 또는 `POST /api/sync/vehicles`
3. 설정 화면: `usedFallback` 없음, 412 오류 없음
4. 대시보드에 본인 차량 실데이터 표시

**트러블슈팅 요약**

| 오류 | 원인 | 해결 |
|------|------|------|
| `Invalid audience` | 잘못된 리전 (`ap` 등) | `TESLA_FLEET_API_REGION=na` |
| `412 must be registered` | Partner Register 미완료 | §5.5 절차 |
| Register 실패 | localhost·공개키 미호스팅 | HTTPS 도메인 + `.well-known/...` 확인 |
| Third-party 토큰으로 register 시도 | 토큰 종류 오류 | `client_credentials` Partner 토큰 사용 |

### 5.6 Phase 3 검증
```powershell
pnpm lint
pnpm build
pnpm dev
# /settings → Tesla 연결 → 대시보드 새로고침
```

---

## §6. 안정화 · 테스트 (Phase 4)

### 6.1 Vitest (단위 테스트)
```powershell
pnpm add -D vitest @vitejs/plugin-react
```

### 6.2 Playwright (E2E)
```powershell
pnpm create playwright
```
> 브라우저 바이너리 설치를 함께 진행한다. 데모 시나리오 1~2종만 우선 작성.

### 6.3 로깅 (선택)
```powershell
pnpm add @sentry/nextjs
```

---

## §7. 배포 (Phase 5)

### 7.1 Vercel
- 권장: GitHub 저장소를 Vercel에 연결(자동 배포). 별도 CLI 설치 불필요
- CLI를 쓰려면:
```powershell
pnpm add -g vercel
vercel
```
- Vercel 대시보드에 `.env.local`의 값들을 Environment Variables로 등록 (Service Role 키는 서버 전용)

### 7.2 Vercel Cron
- `vercel.json`에 cron 설정 추가 → 주기적 데이터 동기화 API 호출

### 7.3 Supabase production
- production 프로젝트/스키마 분리, 접근 정책(RLS) 점검

---

## 설치 요약 (Phase별 신규 설치)

| Phase | 새로 설치하는 것 |
|-------|------------------|
| 0 | Git, Node.js, pnpm |
| 1 | Next.js, Prettier, shadcn/ui, Prisma, @supabase/supabase-js |
| 2 | @tanstack/react-query, (recharts) / Kakao 키 발급 |
| 2.1 | (설치 없음) Prisma 스키마 확장 + Mock 시드 재실행 |
| 2.2 | (설치 없음) UI 컴포넌트·테마·지도 Hero 개선 |
| 3 | (설치 없음) Tesla Fleet API 등록·키 발급 |
| 4 | Vitest, Playwright, (Sentry) |
| 5 | (선택) Vercel CLI / Vercel·Supabase 설정 |

---

## 문제 해결 팁

- `pnpm` 인식 안 됨 → PowerShell 재시작 또는 `corepack enable`, 권한 이슈면 사용자 로컬 경로(`$env:LOCALAPPDATA\pnpm\pnpm.cmd`)로 실행
- `winget` 없음 → Microsoft Store에서 "앱 설치 관리자" 설치
- Prisma 연결 실패 → Supabase Connection String의 `?sslmode=require`·비밀번호 확인
- Kakao 지도 안 뜸 → 도메인(localhost) 등록 및 JS 키 확인

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-06 | 단계별 설치 가이드 초안 작성 (Windows/PowerShell 기준) |
| 2026-07-06 | Phase 0 실행 결과 반영 — Windows 권한 이슈 시 pnpm 사용자 로컬 설치 경로 추가 |
| 2026-07-06 | Phase 1 실행 결과 반영 — 임시 폴더 스캐폴딩, Prisma 6 + SQLite, 검증 명령 추가 |
| 2026-07-06 | Phase 2 실행 결과 반영 — TanStack Query, 페이지 경로, Kakao Maps 폴백 |
| 2026-07-07 | Phase 2.1 실행 결과 반영 — §5.2 Mock 데이터 화면 매핑, 스키마 확장 |
| 2026-07-07 | Phase 2.2 실행 결과 반영 — 지도 Hero, 커스텀 마커, PageHeader, 탭·위젯 |
| 2026-07-07 | Phase 3 실행 결과 반영 — Tesla OAuth, 동기화 API, 설정 화면 |
| 2026-07-07 | Tesla 리전 정정 — 한국 `na`, `Invalid audience` 트러블슈팅 추가 |
| 2026-07-07 | Phase 3.5 추가 — Partner Register(412) 절차, PowerShell 예시 |
