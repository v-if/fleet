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

> **실행 완료 (2026-07-06)** — Phase 1은 SQLite로 시작. **Phase 3.6 (2026-07-07)** 에 Supabase PostgreSQL로 전환 (Auth는 Phase 4).

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

Phase 1은 Supabase 없이 **SQLite**로 빠르게 시작한다. (Supabase PostgreSQL은 **Phase 3.6**, Auth는 Phase 4)

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

`src/lib/supabase/client.ts` — URL·키 미설정 시 `null` 반환 (Phase 4 Auth에서 연결).

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
- [Kakao Developers](https://developers.kakao.com)에서 앱 생성 → **JavaScript 키** 발급
- `.env` / Vercel에 `NEXT_PUBLIC_KAKAO_MAP_KEY` 설정
- **Web 플랫폼 사이트 도메인** 등록 (미등록 시 배포 환경에서 SDK `401 domain mismatched` → `script.onerror`)
  1. [내 애플리케이션](https://developers.kakao.com/console/app) → 앱 선택
  2. **앱 설정 → 플랫폼** → Web 플랫폼 추가
  3. 사이트 도메인에 아래를 등록 (scheme 제외, 도메인만)
     - `http://localhost:3000` (로컬)
     - `bori-fleet.shop` (Production 커스텀 도메인)
     - Preview 배포 URL을 쓸 경우 해당 `*.vercel.app` 도메인도 추가
  4. Vercel **Production·Preview** 환경변수에 동일 JavaScript 키 설정 후 **Redeploy**
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
| 목록 | 총 N건 배지, 차량·상태·충전·배터리·주행거리·갱신 컬럼, 페이지네이션 |
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
TESLA_TELEMETRY_ENABLED=true
TESLA_TELEMETRY_WEBHOOK_SECRET=
TESLA_TELEMETRY_STALE_AFTER_SECONDS=300
TESLA_TELEMETRY_FRESHNESS_SECONDS=120
TESLA_REST_AUTO_SYNC_ENABLED=false
TESLA_REST_WAKE_COOLDOWN_MINUTES=30
TESLA_BASELINE_ON_READY=true
TESLA_PARTNER_TOKEN=
NEXT_PUBLIC_APP_URL=https://bori-fleet.shop
```

> **Phase 4.4 하이브리드 env**
> | 변수 | 기본 | 의미 |
> |------|------|------|
> | `TESLA_REST_WAKE_COOLDOWN_MINUTES` | `30` | ASLEEP→ONLINE 시 `vehicle_data` 쿨다운(분) |
> | `TESLA_BASELINE_ON_READY` | `true` | VK/registry 후 Baseline `vehicle_data` 1회 시도 (실패 시 자동 wake 없음) |
>
> 상세: [checklist-tesla-hybrid-data.md](./checklist-tesla-hybrid-data.md) · [requirements-tesla-fleet-api-telemetry-webhook.md](./requirements-tesla-fleet-api-telemetry-webhook.md)

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
- 로컬: `GET /api/vehicles` 호출 시 `TESLA_SYNC_POLL_INTERVAL_MINUTES`(기본 3분) 경과하면 자동 sync — **Telemetry primary 모드에서는 비활성**
- 배포(Vercel Cron 예시): `POST /api/sync/vehicles` + `Authorization: Bearer $TESLA_SYNC_CRON_SECRET` — Telemetry primary 시 registry-only(차량 목록만)
- REST full sync(폴링 fallback): `POST /api/sync/vehicles?fallback=1` 또는 `TESLA_REST_AUTO_SYNC_ENABLED=true`
- Telemetry primary(`TESLA_TELEMETRY_ENABLED=true`, `TESLA_REST_AUTO_SYNC_ENABLED=false` 기본): `VehicleSnapshot`은 webhook `/api/tesla/telemetry` 수신으로만 갱신

### 5.4.2 하이브리드 온보딩 · 제원 (Phase 4.4)

| 단계 | 동작 |
|------|------|
| OAuth + 목록 sync | registry-only — Snapshot 미생성, `VehicleSyncState` lifecycle 힌트 |
| Virtual Key | 상세 **키 연결 확인** → `POST /api/vehicles/{id}/virtual-key/confirm` (`fleet_status`) |
| Baseline | 차량이 깨어 있을 때 `vehicle_data` 1회 → 제원(`carType` 등) + Snapshot. **실패 시 자동 wake 금지** · 상세 **Baseline 재시도** / **제원 재동기화** |
| 평시 | Telemetry만 Snapshot 갱신. 제원 컬럼 불변 |
| ASLEEP→ONLINE | 쿨다운(`TESLA_REST_WAKE_COOLDOWN_MINUTES`) 경과 시에만 `vehicle_data` 0~1회 |
| 수동 REST | 설정 **REST fallback 동기화** (`?fallback=1`) — 감사 로그 `MANUAL_FALLBACK` |
| unlink | Telemetry 구독 해제 + `VehicleSyncState` 삭제 + 구독 `active=false` |

정적 검증(실차 불필요):
```powershell
node --env-file=.env scripts/verify-hybrid-phase44.cjs
```

Webhook 스모크:
```powershell
pnpm telemetry:check
```

### 5.4.1 Fleet Telemetry (Phase 4.2)

| 항목 | 값 |
|------|-----|
| Webhook 수신 | `POST /api/tesla/telemetry` |
| 인증(선택) | `Authorization: Bearer $TESLA_TELEMETRY_WEBHOOK_SECRET` 또는 `x-telemetry-secret` 헤더 |
| 후처리 job | `POST /api/internal/telemetry/process` + `Authorization: Bearer $TESLA_SYNC_CRON_SECRET` |
| 구독 해제 | unlink/disconnect 시 `DELETE /api/1/vehicles/{vin}/fleet_telemetry_config` |
| 구독 재등록 | reconnect 시 Vehicle Command Proxy로 `POST .../fleet_telemetry_config` (`TESLA_VEHICLE_COMMAND_PROXY_URL` + `TESLA_TELEMETRY_CA_PEM`) |

#### 5.4.1.1 Webhook 호출 확인 (운영 점검)

**아키텍처 (As-Is, 2026-07-10)**

```
Tesla 차량 → telemetry.bori-fleet.shop (Fly.io · bori-telemetry)
           → POST https://bori-fleet.shop/api/tesla/telemetry
           → FMS TelemetryIngress → VehicleSnapshot
```

| 항목 | URL |
|------|-----|
| FMS (Production) | `https://bori-fleet.shop` |
| FMS webhook | `https://bori-fleet.shop/api/tesla/telemetry` |
| Telemetry hostname | `telemetry.bori-fleet.shop` |
| Telemetry 완료 현황 | [requirements-fleet-telemetry-completed.md](./requirements-fleet-telemetry-completed.md) |

**1) 스크립트로 점검 (권장)**

```powershell
# .env 의 NEXT_PUBLIC_APP_URL / secret 사용
pnpm telemetry:check

# 배포 URL + 실제 VIN 지정
pnpm telemetry:check -- -BaseUrl https://bori-fleet.shop -Vin YOUR17CHARVIN
```

성공 시:
- `POST /api/tesla/telemetry` → `{"ok":true,"ingressId":"...","duplicate":false}`
- `GET /api/internal/telemetry/status` → `lastReceivedAt` 갱신

**2) 수동 POST (PowerShell)**

```powershell
$headers = @{ "Content-Type" = "application/json" }
# secret 설정 시: $headers["Authorization"] = "Bearer $env:TESLA_TELEMETRY_WEBHOOK_SECRET"

$body = @{
  vin = "YOUR17CHARVIN"
  createdAt = (Get-Date).ToUniversalTime().ToString("o")
  data = @{
    Soc = @{ doubleValue = 72 }
    Location = @{ locationValue = @{ latitude = 37.5665; longitude = 126.9780 } }
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "https://bori-fleet.shop/api/tesla/telemetry" -Method POST -Headers $headers -Body $body
```

| HTTP | 의미 |
|------|------|
| 200 | webhook 정상, `TelemetryIngress` 저장 |
| 401 | `TESLA_TELEMETRY_WEBHOOK_SECRET` 불일치 |
| 503 | `TESLA_TELEMETRY_ENABLED=false` |

**3) Supabase SQL**

`scripts/telemetry-status.sql` — ingress 건수, 최근 수신, `telemetrySource=TELEMETRY` 스냅샷 조회

**4) Vercel Logs**

Deployments → Logs → `/api/tesla/telemetry` 필터. Fly Telemetry 서버의 **POST 200** 반복 여부 확인.

**5) 설정 화면**

`/settings` → Fleet Telemetry 패널: 최근 수신/처리 시각, pending 건수

#### 5.4.1.2 Telemetry 서버 → FMS relay 설정 예시

Tesla `fleet_telemetry_config`의 `hostname`은 **`telemetry.bori-fleet.shop`** 입니다 (FMS URL 아님).
Fly relay가 수신한 이벤트를 FMS로 POST할 때 아래 endpoint를 사용합니다.

```
POST https://bori-fleet.shop/api/tesla/telemetry
Content-Type: application/json
Authorization: Bearer {TESLA_TELEMETRY_WEBHOOK_SECRET}   # 설정한 경우
x-idempotency-key: {vin}:{eventId}

{
  "vin": "5YJ...",
  "createdAt": "2026-07-10T04:30:00.000Z",
  "data": {
    "Soc": { "doubleValue": 72 },
    "Location": { "locationValue": { "latitude": 37.5665, "longitude": 126.9780 } }
  }
}
```

> Fly secrets(`FMS_WEBHOOK_*`, `FMS_STATUS_URL`, `FMS_CRON_SECRET`)는 FMS Vercel env와 **동일 값**이어야 합니다.  
> 실차 config 필드: **Gear** 사용 (`ShiftState` 아님).  
> 상세: [requirements-fleet-telemetry-completed.md](./requirements-fleet-telemetry-completed.md), [requirements-tesla-fleet-telemetry.md](./requirements-tesla-fleet-telemetry.md)

#### 5.4.1.3 P0 시연 전 — 사용자 작업 (필수)

**이미 확인된 것 (2026-07-10 Supabase 실측)**

- 실차 VIN `LRWYGCFJ7SC214742` → `TelemetryIngress` **PROCESSED** 다건
- `VehicleSnapshot.telemetrySource=TELEMETRY`, battery≈82%
- Fly → FMS Production webhook 인증 **정상**

**당신이 할 일**

1. **로컬 secret 동기화** — ✅ `TESLA_TELEMETRY_WEBHOOK_SECRET` 반영, `pnpm telemetry:check` 200 (2026-07-10)  
   - `TESLA_SYNC_CRON_SECRET` / Fly `FMS_CRON_SECRET`은 **원래 빈 값** → status API는 인증 없이 동작. 공개 보호가 필요하면 나중에 동일 난수 값을 양쪽에 넣으면 됨.

2. **화면 리허설** (https://bori-fleet.shop)
   - [ ] 로그인
   - [ ] `/` 대시보드 — `TESLA-214742` 배터리·상태 표시
   - [ ] `/map` — 좌표 있으면 마커 (없으면 “위치 데이터 없음” 정상일 수 있음)
   - [ ] `/settings` — Fleet Telemetry 패널: 최근 수신/처리 시각, Telemetry 활성·primary
   - [ ] 차량이 잠들면 ASLEEP로 바뀔 수 있음 — 시연 전 차량 wake 또는 REST fallback:
     ```
     POST /api/sync/vehicles?fallback=1
     ```
     (설정 화면 “REST fallback 동기화” 버튼)

3. **시연 직전 Fly 상태**
   ```powershell
   fly status -a bori-telemetry
   fly checks list -a bori-telemetry
   ```
   `min_machines_running=1`, suspended 아님 확인.

### 5.5 Tesla Partner Register (Phase 3.5) — 412 해결

Phase 3에서 OAuth “계정 연결됨”이어도, Fleet API 조회 시 아래 오류가 나면 **Partner Register**가 필요하다.

```
412: Account ... must be registered in the current region https://fleet-api.prd.na.vn.cloud.tesla.com
```

> OAuth(사용자 동의)와 Register(앱 등록)는 **별개**다. Register 없이는 Mock 폴백만 동작한다.

#### 5.5.1 사전 준비
1. **Vercel 등에 배포**해 공개 HTTPS 도메인 확보 (예: `bori-fleet.shop`)
2. Tesla 포털에 배포 도메인 추가
   - 출처: `https://bori-fleet.shop`
   - 리디렉션 URI: `https://bori-fleet.shop/api/auth/tesla/callback`
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

> 진행 상태 (2026-07-07): 프로젝트에 `public/.well-known/appspecific/com.tesla.3p.public-key.pem` 파일 배치 완료,  
> `https://bori-fleet.shop/.well-known/appspecific/com.tesla.3p.public-key.pem` 접근 확인 완료.

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
$domain = "bori-fleet.shop"   # scheme 없이 도메인만
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

> 진행 상태 (2026-07-07): `bori-fleet.shop` 기준 Partner token 발급, `POST /api/1/partner_accounts`,  
> `GET /api/1/partner_accounts/public_key?domain=bori-fleet.shop` 확인까지 완료.

#### 5.5.5 연동 재검증
1. 배포 URL `/settings` → Tesla 계정 연결
2. **지금 동기화** 또는 `POST /api/sync/vehicles`
3. 설정 화면: `usedFallback` 없음, 412 오류 없음
4. 대시보드에 본인 차량 실데이터 표시

> 진행 상태 (2026-07-07): 로컬 기준 `POST /api/sync/vehicles` 성공, `usedFallback=false`, `provider=tesla` 확인.  
> 추가 수정: Tesla `fleet_status` 응답이 배열이 아닐 때도 파싱되도록 보강했고, `/api/vehicles`, `/api/auth/tesla/status`는 동적 응답으로 전환해 stale mock 응답을 방지했다.
> 추가 UI 보정: Tesla `display_name` 대신 VIN suffix 기반 식별명(`TESLA-xxxxxx`)을 기본 표기로 사용하고, 좌표 `0,0`은 `위치 데이터 없음`으로 처리해 카카오맵 미표시 원인을 사용자에게 안내한다.
> TPMS 표시 보정: Tesla `tpmsFrontLeft` 등은 atm(≈bar) 기준으로 보고, 차량 상세 화면에서는 `1 atm ≒ 14.7 PSI`를 곱한 PSI 값으로 표시한다.

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

### 5.7 Supabase PostgreSQL (Phase 3.6)

> 근거: [requirements-db.md](./requirements-db.md) — Vercel 배포 시 SQLite API 500 해결·Tesla 배포 테스트

Phase 3.6은 **DB만** 전환한다. Supabase Auth는 Phase 4.

**코드 상태 (2026-07-07)**: Prisma `postgresql` 전환·마이그레이션·`pnpm db:setup` 반영 완료.

**로컬 실행 완료 (2026-07-07)**: Supabase dev 연결, migrate·시드(Mock 12대), `localhost/api/vehicles` 200.

**Vercel 배포 완료 (2026-07-07)**: env 등록·재배포, `bori-fleet.shop/api/vehicles` 200, mock·tesla 대시보드 확인.

#### 5.7.1 Supabase 프로젝트 생성 (처음부터)

**1단계 — 계정·프로젝트**
1. https://supabase.com 접속 → GitHub로 로그인
2. **New project** 클릭
3. 설정:
   - **Name**: `fleet-dev` (임의)
   - **Database Password**: 강한 비밀번호 생성 → **반드시 메모** (복구 불가)
   - **Region**: `Northeast Asia (Seoul)` 권장
4. **Create new project** → 프로비저닝 1~2분 대기

**2단계 — Connection String 복사**
1. 좌측 **Project Settings** (톱니바퀴) → **Database**
2. **Connection string** 탭 → **URI** 선택
3. 아래 두 가지를 각각 복사한다.

| 용도 | Supabase UI에서 선택 | `.env` 변수 | 포트 |
|------|---------------------|-------------|------|
| 앱 런타임·Vercel | **Transaction pooler** + Mode: **Transaction** | `DATABASE_URL` | 6543 |
| Prisma migrate | **Session pooler** (pooler 호스트, 포트 5432) — Direct 차단 시 | `DIRECT_URL` | 5432 |

4. `[YOUR-PASSWORD]`를 1단계에서 만든 DB 비밀번호로 교체. 비밀번호에 `@` 등 특수문자가 있으면 URL 인코딩 (`@` → `%40`).

> **P1001 연결 실패 시**: `db.xxx.supabase.co:5432`(Direct)는 일부 네트워크에서 **5432 포트가 차단**된다.  
> 이 경우 `DIRECT_URL`도 **pooler 호스트 + 5432(Session mode)** 로 설정한다. 사용자명은 `postgres.[project-ref]`.

예시 (프로젝트마다 `ref`·호스트가 다름):
```env
DATABASE_URL="postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres"
```

**3단계 — 로컬 `.env` 수정**

기존 SQLite 줄을 **삭제 또는 주석 처리**하고 위 두 줄을 추가한다.
```env
# DATABASE_URL="file:./dev.db"   ← 삭제
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
```

**4단계 — DB 초기화 (로컬)**
```powershell
$env:Path = "$env:LOCALAPPDATA\pnpm;$env:Path"
# dev 서버가 켜져 있으면 먼저 중지 (Ctrl+C)
pnpm db:setup
pnpm dev
Invoke-RestMethod http://localhost:3000/api/vehicles   # 200 + JSON 확인 ✅ (2026-07-07)
```

> Vercel 배포 검증 완료 (2026-07-07): `https://bori-fleet.shop/api/vehicles` → HTTP 200, mock·tesla 연동 확인.

#### 5.7.2 Prisma (코드 반영 완료)

`prisma/schema.prisma`는 이미 `postgresql` + `directUrl`로 전환되어 있다.  
마이그레이션 파일: `prisma/migrations/20260707143000_init_postgresql/`

수동 migrate가 필요하면:
```powershell
pnpm db:deploy   # migrate deploy만
pnpm db:seed     # 시드만
```

#### 5.7.3 Vercel 환경 변수

Vercel 대시보드 → **bori-fleet** 프로젝트 → **Settings → Environment Variables**:

| 변수 | Environment | 값 |
|------|-------------|-----|
| `DATABASE_URL` | Production, Preview | Supabase **pooler** URL (6543) |
| `DIRECT_URL` | Production, Preview | Supabase **direct** URL (5432) |
| `VEHICLE_DATA_PROVIDER` | Production, Preview | `mock` 또는 `tesla` |
| `TESLA_FLEET_API_*` | Production, Preview | Phase 3와 동일 |
| `NEXT_PUBLIC_APP_URL` | Production | `https://bori-fleet.shop` |
| `TESLA_FLEET_API_REDIRECT_URI` | Production | `https://bori-fleet.shop/api/auth/tesla/callback` |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | Production, Preview | Kakao **JavaScript** 키 — Web 플랫폼에 `bori-fleet.shop` 등록 필수 |
| `TESLA_TELEMETRY_WEBHOOK_SECRET` | Production | Fly `FMS_WEBHOOK_SECRET`과 동일 |
| `TESLA_SYNC_CRON_SECRET` | Production | Fly `FMS_CRON_SECRET`과 동일 |

1. 변수 저장 후 **Deployments → Redeploy** (최신 main)
2. 빌드 로그에서 `prisma migrate deploy` 성공 확인
3. 배포 후 시드 (최초 1회): 로컬에서 `pnpm db:setup`을 실행하면 **같은 Supabase DB**에 데이터가 들어간다 (로컬·Vercel이 dev DB 공유)

재배포 후 확인:
```
https://bori-fleet.shop/api/vehicles  → HTTP 200
```

> **주의**: `DATABASE_URL=file:./dev.db`를 Vercel에 넣어도 해결되지 않는다.

#### 5.7.4 Phase 3.6 검증
```powershell
pnpm db:setup    # migrate deploy + seed
pnpm lint
pnpm build
pnpm dev
Invoke-RestMethod http://localhost:3000/api/vehicles
# 배포 API (Vercel env 설정·재배포 후)
Invoke-RestMethod https://bori-fleet.shop/api/vehicles   # 200 + JSON 확인 ✅ (2026-07-07)
```

> Windows에서 `prisma generate` EPERM 오류 시 `pnpm dev`를 중지한 뒤 재시도하세요.

---

## §5.8. TailAdmin 템플릿 전면 적용 (Phase 3.8)

> **완료 (2026-07-08)** — [TailAdmin free-nextjs-admin-dashboard](https://github.com/TailAdmin/free-nextjs-admin-dashboard) v2.3.0 소스를 프로젝트에 통합. 루트 `/`는 템플릿 E-commerce 데모, 기존 FMS 화면은 `/fleet/*`에 격리.

### 5.8.1 의존성 (템플릿 필수)

```powershell
pnpm add apexcharts react-apexcharts flatpickr @tailwindcss/forms swiper `
  @fullcalendar/core @fullcalendar/daygrid @fullcalendar/interaction `
  @fullcalendar/list @fullcalendar/react @fullcalendar/timegrid `
  react-dropzone react-dnd react-dnd-html5-backend `
  @react-jvectormap/core @react-jvectormap/world
pnpm add -D @svgr/webpack postcss autoprefixer @types/react-transition-group
```

### 5.8.2 빌드 설정

- `next.config.ts`: SVG를 React 컴포넌트로 로드 (`@svgr/webpack`)
- `src/app/layout.tsx`: Outfit 폰트 + TailAdmin `ThemeProvider`·`SidebarProvider`
- `src/app/globals.css`: TailAdmin 원본 CSS (753줄 `@theme` 토큰)
- `public/images/`: TailAdmin 데모 이미지 에셋

### 5.8.3 라우트 구조

| 경로 | 내용 |
|------|------|
| `/` | **FMS 대시보드** — 상단 KPI 6카드(전체=Fleet 배지, 나머지=% 배지) + 실시간 지도 **1:1 가로 배치** |
| `/vehicles`, `/vehicles/[id]` | 차량 목록·상세 (차량·상태·충전·배터리·주행거리·갱신) |
| `/map`, `/settings` | 플릿 지도·Tesla 연동 설정 |
| `/demo` | TailAdmin E-commerce **원본 데모** (참고용) |
| `/calendar`, `/profile`, UI Elements 등 | TailAdmin 샘플 페이지 (URL 직접 접근) |
| `/fleet/*` | → 위 경로로 **리다이렉트** (레거시) |
| `/api/*` | 변경 없음 |

> **Phase 3.8 P1 (2026-07-08)**: FMS 기능 연동 완료. 컴포넌트는 `src/components/fms/`.

### 5.8.4 검증

```powershell
pnpm lint
pnpm exec next build
pnpm dev
# 브라우저: http://localhost:3000/ (FMS 대시보드)
#          http://localhost:3000/vehicles
#          http://localhost:3000/demo (TailAdmin E-commerce 원본)
```

> FMS 기능 연동은 Phase 3.8 P1에서 완료 (`src/components/fms/`).

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
| 3.6 | Supabase dev 프로젝트, Prisma PostgreSQL 전환, `pnpm db:setup` ([§5.7](./setup-guide.md)) |
| 3.7 | (설치 없음) TailAdmin 벤치마킹 디자인 토큰·컴포넌트 개선 — **완료** ([requirements-dashboard-design.md](./requirements-dashboard-design.md)) |
| 3.8 | ApexCharts·Flatpickr·FullCalendar·Swiper·jvectormap·@svgr/webpack — **완료** ([§5.8](./setup-guide.md)) |
| 4 | Vitest, Playwright, (Sentry) |
| 5 | (선택) Vercel CLI / Vercel·Supabase 설정 |

---

## 문제 해결 팁

- `pnpm` 인식 안 됨 → PowerShell 재시작 또는 `corepack enable`, 권한 이슈면 사용자 로컬 경로(`$env:LOCALAPPDATA\pnpm\pnpm.cmd`)로 실행
- `winget` 없음 → Microsoft Store에서 "앱 설치 관리자" 설치
- Prisma 연결 실패 → Supabase Connection String의 `?sslmode=require`·비밀번호 확인
- Vercel "차량 목록을 불러오지 못했습니다" → `GET /api/vehicles` 500, SQLite 미지원 — [requirements-db.md](./requirements-db.md), Phase 3.6 Supabase 전환
- Kakao 지도 안 뜸 → 도메인(localhost·배포 URL) 등록 및 JS 키 확인

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
| 2026-07-07 | Phase 3.6 추가 — Supabase PostgreSQL 전환 절차(§5.7), Vercel SQLite 트러블슈팅 |
| 2026-07-07 | Phase 3.6 로컬 완료 반영 — Session pooler DIRECT_URL, P1001·setup-db.ps1 수정 |
| 2026-07-07 | Phase 3.5·3.6 Vercel 배포 검증 완료 — env·재배포, API 200, mock·tesla 연동 |
| 2026-07-07 | Phase 3.7 추가 — TailAdmin 디자인 개선 (설치 없음, P2 차트 시 ApexCharts 검토) |
| 2026-07-07 | Phase 3.7 구현 완료 — TailAdmin 토큰·light 배지·다크모드·3화면 UI 개선 반영 |
| 2026-07-08 | Phase 3.8 추가·완료 — TailAdmin 템플릿 전면 적용, §5.8 설치·라우트 가이드 |
| 2026-07-08 | Phase 3.8 P1 완료 — FMS 데이터 연동, 라우트·검증 명령 업데이트 |
| 2026-07-08 | Phase 3.8 P1 대시보드 — KPI 6카드·지도 1:1 Hero 레이아웃 반영 |
| 2026-07-08 | Phase 3.8 P1 KPI 카드 — 아이콘·라벨 가로, % 배지(전체 차량 Fleet 배지) |
| 2026-07-08 | Phase 3.8 P1 KPI — 전체 차량 Fleet 아이콘 배지 복구 |
| 2026-07-08 | Phase 3.8 P1 사이드바 — TailAdmin → Fleet, `fleet-car-icon.svg` |
| 2026-07-08 | Phase 3.8 P1 배터리 — Demographic 프로그래스바 + 정수 % (`BatteryProgressBar`) |
| 2026-07-08 | Phase 3.8 P1 최근 차량 — 목록 테이블 컬럼(차량·상태·충전·배터리) 통일 |
| 2026-07-08 | Phase 3.8 P1 충전 현황 — 차량 모델 nowrap, 배터리 `120px` |
| 2026-07-08 | Phase 3.8 P1 컬럼 폭 — 충전 축소·배터리 expanded 프로그래스바 |
| 2026-07-08 | Phase 3.8 P1 최근 차량 — nowrap·배터리 max-width로 배지 줄바꿈 해소 |
| 2026-07-08 | Phase 3.9 — User·TeslaAccount·Vehicle DB 요구사항 [requirements-user-db.md](./requirements-user-db.md) (코드 미착수) |
| 2026-07-08 | Phase 3.9 완료 — TeslaAccount 마이그레이션, `DELETE /api/vehicles/[id]/unlink` |
| 2026-07-08 | Phase 4 선행 — API 로그·감사 DB 요구사항 [requirements-log-db.md](./requirements-log-db.md) 추가 |
| 2026-07-07 | Tesla 연동 검증 반영 — `fleet_status` 파싱 오류·API 캐시 수정, `usedFallback=false` 확인 |
| 2026-07-07 | Tesla UI 보정 반영 — 식별명/위치 데이터 없음 처리, 좌표 0 안내 |
| 2026-07-07 | Tesla TPMS 보정 반영 — 차량 상세에 PSI 환산 표시 적용 |
| 2026-07-10 | 커스텀 도메인 — FMS `bori-fleet.shop`, Telemetry `telemetry.bori-fleet.shop` |
| 2026-07-10 | §5.4.1 Telemetry 서버 연동·완료 현황 문서 링크 반영 |
| 2026-07-10 | §5.4.1.3 P0 사용자 작업 — secret 동기화·화면 리허설·Fly 상태 점검 |
| 2026-07-11 | Phase 4.4 — `TESLA_REST_WAKE_COOLDOWN_MINUTES`/`TESLA_BASELINE_ON_READY` env · §5.4.2 하이브리드 온보딩 |
