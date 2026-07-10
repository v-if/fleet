# Fleet Telemetry 서버 요구사항 · FMS 연동 인수인계서

> **대상 독자**: 신규 Fleet Telemetry 서버 프로젝트 개발자 · FMS 연동 담당  
> **목적**: Tesla 공식 [fleet-telemetry](https://github.com/teslamotors/fleet-telemetry) 기반 별도 서버를 구축하고, 기존 **보리차 FMS**(`bori-fleet`)와 즉시 연동 가능하도록 인수인계  
> **작성일**: 2026-07-10  
> **FMS 저장소**: `fleet` (Next.js + Prisma + Supabase)  
> **FMS 배포 URL**: `https://bori-fleet.shop`  
> **Telemetry hostname**: `https://telemetry.bori-fleet.shop` (Fly.io `bori-telemetry`)  
> **권장 Telemetry 배포**: **Fly.io 단독** (mTLS 수신 + relay — 단순 데모)  
> **개발 완료 현황**: [requirements-fleet-telemetry-completed.md](./requirements-fleet-telemetry-completed.md) — M0~M2·M4 완료, M3 실차 V→FMS E2E 보류

---

## 1. 문서 개요

| 항목 | 내용 |
|------|------|
| 이 문서의 역할 | Fleet Telemetry **서버 프로젝트** 요구사항 + FMS 연동 계약(Contract) 정의 |
| **데모 플랫폼** | **Fly.io** — mTLS 수신·디코딩·FMS relay를 **한 앱**에서 처리 |
| **커스텀 도메인** | FMS `bori-fleet.shop` · Telemetry `telemetry.bori-fleet.shop` |
| FMS 측 상세 | [requirements-tesla-fleet-telemetry.md](./requirements-tesla-fleet-telemetry.md) (FMS webhook/ingress 구현) |
| Telemetry 완료 인수인계 | [requirements-fleet-telemetry-completed.md](./requirements-fleet-telemetry-completed.md) |
| Tesla API 상세 | [requirements-tesla-api.md](./requirements-tesla-api.md) |
| 운영 가이드 | [setup-guide.md](./setup-guide.md) §5.4.1 |

### 1.1 시스템 경계

| 구성요소 | 담당 | 비고 |
|----------|------|------|
| **Fleet Telemetry 서버** (신규) | Tesla mTLS 수신, 디코딩, FMS relay | **Fly.io 1앱** — 본 문서 범위 |
| **Vehicle Command Proxy** | Tesla `fleet_telemetry_config` 서명·전달 | 로컬 Docker 또는 Fly sidecar |
| **FMS** (기존) | webhook 수신, DB 적재(Supabase), UI, ASLEEP 추론 | Vercel — 구현 완료 (Phase 4.2) |
| **Tesla Fleet API** | OAuth, 차량 목록, 구독 해제 | FMS가 담당 |

> Telemetry 프로젝트에 **별도 Vercel·Supabase는 두지 않는다.**  
> DB·UI는 FMS(Supabase + Vercel)가 담당하고, Telemetry는 **Fly.io → FMS webhook**만 수행한다.

---

## 2. 전체 아키텍처 (To-Be)

### 2.0 데모 시연용 권장 구성 (Fly.io 단독)

```
┌─────────────┐   mTLS/WebSocket    ┌─────────────────────────────────────┐
│ Tesla 차량   │ ─────────────────► │ Fly.io — telemetry.bori-fleet.shop  │
│             │                     │  (앱: bori-telemetry, region nrt)   │
│             │                     │  fleet-telemetry (공식 Go 이미지)    │
│             │                     │  + relay (디코딩 → FMS POST)         │
│             │                     │  + /health :8081                    │
└─────────────┘                     └──────────────┬──────────────────────┘
                                                 │ HTTP POST (§5 계약)
                                                 ▼
                              ┌──────────────────────────────────────────┐
                              │ FMS — bori-fleet.shop (Vercel)            │
                              │  POST /api/tesla/telemetry                │
                              │  → TelemetryIngress (Supabase)            │
                              │  → VehicleSnapshot → 대시보드             │
                              └──────────────────────────────────────────┘
```

#### Fly.io 한 앱에 포함되는 것

| 구성요소 | Fly.io | 설명 |
|----------|--------|------|
| mTLS WebSocket 수신 (`:443`) | ✅ | Tesla 차량 직접 연결 |
| protobuf 디코딩 | ✅ | `transmit_decoded_records: true` |
| FMS webhook relay | ✅ | 수신 즉시 `POST /api/tesla/telemetry` |
| 재시도·백오프 | ✅ | 프로세스 내 메모리 큐 (데모) |
| VIN allowlist 캐시 | ✅ | FMS status API 주기 조회 |
| `/health` 상태 API | ✅ (선택) | `fly logs` / HTTP 헬스 |

#### Fly.io에 두지 않는 것 (FMS 담당)

| 구성요소 | 담당 |
|----------|------|
| OAuth / 차량 등록 | FMS (Vercel) |
| `TelemetryIngress` / `VehicleSnapshot` DB | FMS (Supabase) |
| 대시보드·지도·설정 UI | FMS (Vercel) |
| ASLEEP 추론 | FMS |

> **데모 MVP 최소 구성**: Fly.io 앱 1개 + FMS(기존).  
> Kubernetes·별도 relay DB는 데모 이후 스케일업 옵션(§4.4).

### 2.1 기본 데이터 흐름

1. **구독 등록** (최초 1회/차량): FMS OAuth → Vehicle Command Proxy → `POST fleet_telemetry_config` → 차량이 Fly hostname으로 연결
2. **스트리밍**: 차량 → Fly.io mTLS → protobuf 디코딩
3. **Relay**: Fly relay → FMS `POST /api/tesla/telemetry` (JSON, §5)
4. **FMS 처리**: Supabase `TelemetryIngress` 저장 → 비동기 processor → `VehicleSnapshot` 갱신
5. **취침 추론**: Telemetry 공백 N초 → FMS가 `ASLEEP` 추론
6. **구독 해제**: FMS unlink → `DELETE fleet_telemetry_config`

### 2.2 중요: hostname vs webhook URL

| URL 종류 | 예시 | 용도 |
|----------|------|------|
| Telemetry mTLS FQDN | `telemetry.bori-fleet.shop` (포트 443) | `fleet_telemetry_config.hostname` — **차량이 직접 연결** |
| FMS webhook | `https://bori-fleet.shop/api/tesla/telemetry` | Fly relay가 **HTTP POST** |
| FMS status (allowlist) | `https://bori-fleet.shop/api/internal/telemetry/status` | Fly가 주기 조회 |

> Tesla 차량은 FMS URL로 직접 연결하지 않습니다.  
> Fly **443은 TCP passthrough**(L7 TLS 종료 없음) — mTLS 유지. L7 reverse proxy로 WebSocket(mTLS) 경로를 깨뜨리지 않도록 주의 ([Tesla 이슈 참고](https://github.com/teslamotors/fleet-telemetry/issues/284)).

---

## 3. FMS 측 구현 현황 (인수인계)

신규 Telemetry 서버는 아래 FMS 구현을 **전제**로 연동합니다. Fly 프로젝트는 FMS DB에 **직접 쓰지 않습니다.**

### 3.1 Telemetry Primary 모드 (현재 운영 정책)

| 환경변수 | 기본값 | 의미 |
|----------|--------|------|
| `TESLA_TELEMETRY_ENABLED` | `true` | webhook 수신 활성 |
| `TESLA_REST_AUTO_SYNC_ENABLED` | `false` | REST 주기 폴링 **중지** |
| `NEXT_PUBLIC_APP_URL` | `https://bori-fleet.shop` | webhook URL 생성 기준 |

- `VehicleSnapshot`은 **webhook 수신으로만** 갱신됩니다.
- 차량 **등록만** 필요할 때: `POST /api/sync/vehicles` (registry-only).
- REST 복구: `POST /api/sync/vehicles?fallback=1`.

### 3.2 FMS API 엔드포인트

| Method | Path | 역할 | Fly 연동 |
|--------|------|------|----------|
| `POST` | `/api/tesla/telemetry` | **Telemetry ingress 수신** | relay **최종 목적지** |
| `GET` | `/api/internal/telemetry/status` | 운영 상태·VIN 목록 | allowlist 동기화 |
| `POST` | `/api/internal/telemetry/process` | pending ingress 후처리 | FMS 장애 복구 시 |
| `POST` | `/api/sync/vehicles` | 차량 registry sync | FMS OAuth 후 |

**구현 파일 (FMS)**:

| 경로 | 설명 |
|------|------|
| `src/app/api/tesla/telemetry/route.ts` | webhook 수신, 즉시 200, `after()` 비동기 처리 |
| `src/lib/tesla/telemetry/ingress.ts` | `TelemetryIngress` append-only 저장 |
| `src/lib/tesla/telemetry/processor.ts` | ingress → `VehicleSnapshot` 매핑, ASLEEP 추론 |
| `src/lib/tesla/telemetry/mapper.ts` | payload → 필드 파싱 |
| `src/lib/vehicle-sync.ts` | registry-only / full sync 분기 |

### 3.3 FMS DB 모델 (Prisma — Supabase)

Fly는 이 테이블에 **쓰지 않음**. FMS webhook 경유로만 적재됩니다.

#### TelemetryIngress

| 필드 | 타입 | 설명 |
|------|------|------|
| `idempotencyKey` | string (unique) | 중복 수신 제거 |
| `vin` | string? | payload에서 추출 |
| `vehicleId` | string? | 처리 후 매핑 |
| `payload` | JSON | 원본 저장 |
| `status` | enum | `PENDING` → `PROCESSED` / `FAILED` / `DUPLICATE` |
| `receivedAt` | timestamptz | 수신 시각 |

#### VehicleSnapshot (Telemetry 관련)

| 필드 | 설명 |
|------|------|
| `lastTelemetryAt` | 마지막 Telemetry 이벤트 시각 |
| `telemetrySource` | `TELEMETRY` / `REST` / `MIXED` |
| `isAsleepInferred` | Telemetry 공백 기반 취침 추론 |

#### Vehicle 매칭 규칙

- `vin` ↔ `Vehicle.oemVehicleId` (대소문자 무시)
- `unlinkedAt IS NULL`, `isDeleted = false`
- 매칭 실패 → ingress `FAILED` (`vehicle_not_found`)

### 3.4 FMS mapper 필드 (relay 시 포함 권장)

| FMS 필드 | Tesla 필드 키 | 비고 |
|----------|---------------|------|
| `batteryPercent` | `Soc`, `BatteryLevel` | double |
| `latitude` / `longitude` | `Location` | locationValue |
| `chargingStatus` | `ChargeState` | string |
| `ignitionOn` | `Gear`, `ShiftState` | `P` 외 true (실차 config는 **Gear**) |
| `locked` | `Locked` | boolean |
| `odometerKm` | `Odometer` | mile → km |
| `insideTempC` / `outsideTempC` | `InsideTemp`, `OutsideTemp` | |
| `sentryMode` | `SentryMode` | |

전체 매핑: `src/lib/tesla/telemetry/mapper.ts`

---

## 4. Fleet Telemetry 서버 요구사항 (신규 프로젝트)

### 4.1 핵심 책임 (Fly.io)

1. Tesla 차량 **mTLS WebSocket** 수신 ([fleet-telemetry](https://github.com/teslamotors/fleet-telemetry))
2. protobuf 수신·디코딩 (`transmit_decoded_records: true`)
3. VIN allowlist 필터 (FMS status API)
4. FMS webhook **직접 POST** (§5 계약)
5. 실패 시 **in-process 재시도** (exponential backoff)
6. 구조화 로그 (`fly logs`)
7. (선택) `/health` HTTP 엔드포인트

### 4.2 비책임 (FMS가 담당)

- OAuth / TeslaAccount / Supabase DB
- UI / 대시보드 / ASLEEP 추론
- `DELETE fleet_telemetry_config` on unlink

### 4.3 추천 기술 스택 (Fly.io 단독)

| 레이어 | 기술 | 근거 |
|--------|------|------|
| **수신 코어** | Go — [fleet-telemetry](https://github.com/teslamotors/fleet-telemetry) 공식 이미지 | mTLS·프로토콜 공식 지원 |
| **Relay** | Go sidecar 또는 커스텀 HTTP dispatcher | 수신 직후 FMS POST |
| **배포** | **Fly.io** | 상시 컨테이너, 443, 자동 TLS |
| **재시도 큐 (데모)** | 프로세스 내 메모리 + backoff | 별도 DB 불필요 |
| **재시도 큐 (스케일업)** | Upstash Redis / Fly Postgres | §4.4 |
| **로컬 개발** | Docker Compose | upstream `docker-compose.yml` |
| **관측** | `fly logs`, Fly metrics, (선택) Prometheus | |

### 4.4 배포 토폴로지

#### 4.4.1 데모 (Fly.io 단독 — 권장)

```
Internet
   │
   ▼
[Fly.io] telemetry.bori-fleet.shop :443
   │
   ├── fleet-telemetry (mTLS 수신·디코딩)
   │
   └── relay worker
           │ POST + x-idempotency-key
           │ Authorization: Bearer {FMS_WEBHOOK_SECRET}
           ▼
    [FMS Vercel] /api/tesla/telemetry
           │
           ▼
    [Supabase] TelemetryIngress → VehicleSnapshot
```

**환경 분리**:

| 환경 | Fly 앱 | FMS webhook |
|------|--------|-------------|
| Production | `bori-telemetry` → `telemetry.bori-fleet.shop` | `https://bori-fleet.shop/api/tesla/telemetry` |
| Staging | `bori-telemetry-stg` (선택) | FMS Preview 또는 Production |
| Local | Docker + `fly proxy` / ngrok | `http://localhost:3000/api/tesla/telemetry` |

#### 4.4.2 스케일업 (데모 이후 — 선택)

| 단계 | 구성 |
|------|------|
| 다차량·HA | Fly.io 다중 리전 또는 Kubernetes + Helm |
| 영속 큐 | Redis / Kafka dispatcher |
| 관측 | Prometheus + Grafana (upstream 샘플) |

### 4.5 Fly.io 구현 상세 (데모 시연)

#### 4.5.1 저장소 구조

```
fleet-telemetry/                   # 신규 repo
├── cmd/
│   └── relay/                     # FMS POST relay (Go)
├── internal/
│   ├── transform/                 # protobuf JSON → §5 계약
│   ├── fms/                       # webhook client, retry, allowlist
│   └── health/                    # HTTP /health
├── config/
│   └── server_config.json         # upstream fleet-telemetry 설정
├── deploy/
│   ├── fly.toml
│   ├── Dockerfile                 # fleet-telemetry + relay
│   └── docker-compose.yml         # 로컬 mTLS
├── scripts/
│   ├── relay-smoke.ps1            # FMS webhook 직접 smoke test
│   └── check_server_cert.sh       # upstream 제공
├── .env.example
└── docs/
    └── requirements-fleet-telemetry.md
```

#### 4.5.2 Relay 구현 방식 (3가지 중 택 1)

| 방식 | 복잡도 | 데모 권장 |
|------|--------|-----------|
| **A. Sidecar** — `fleet-telemetry` stdout/파이프 → relay Go 프로세스 | 중 | ◎ |
| **B. 커스텀 dispatcher** — upstream `records.V: ["http_fms"]` | 높음 | △ |
| **C. 단일 컨테이너** — 수신 후 goroutine에서 즉시 FMS POST | 낮음 | ◎ **MVP 최우선** |

**MVP 권장 (C)**: 디코딩된 record 1건 수신 → transform → FMS POST → 실패 시 메모리 큐 재시도.

#### 4.5.3 fly.toml 요약

```toml
app = "bori-telemetry"
primary_region = "nrt"   # Tokyo — 한국 차량 지연 최소화

[build]
  dockerfile = "deploy/Dockerfile"

# :443 TCP passthrough (L7 TLS 종료 없음 — mTLS 유지)
# :8081 HTTP health (relay /health)
# auto_stop_machines = off, min_machines_running = 1
```

- `fleet_telemetry_config.hostname` = `telemetry.bori-fleet.shop`
- TLS: 앱 종료 self-signed PEM (Fly secrets B64) — 실차 `config.ca`와 **동일 CA**
- `auto_stop_machines = false` — 차량 연결 끊김 방지
- DNS: `telemetry.bori-fleet.shop` → Fly shared IP + `_fly-ownership.telemetry`

#### 4.5.4 server_config.json (핵심)

```json
{
  "host": "0.0.0.0",
  "port": 443,
  "log_level": "info",
  "json_log_enable": true,
  "namespace": "bori",
  "transmit_decoded_records": true,
  "tls": {
    "server_cert": "/etc/certs/server.crt",
    "server_key": "/etc/certs/server.key"
  },
  "records": {
    "V": ["logger"],
    "connectivity": ["logger"],
    "alerts": ["logger"],
    "errors": ["logger"]
  },
  "rate_limit": {
    "enabled": true,
    "message_limit": 1000
  }
}
```

MVP: `logger` + relay가 stdout/파이프를 읽어 FMS POST.  
이후: `records.V`에 커스텀 `http_fms` dispatcher 추가.

#### 4.5.5 환경변수 (.env / fly secrets)

```bash
# Fly 앱
TELEMETRY_PUBLIC_HOST=telemetry.bori-fleet.shop

# FMS 연동 (필수)
FMS_WEBHOOK_URL=https://bori-fleet.shop/api/tesla/telemetry
FMS_WEBHOOK_SECRET=                    # = FMS TESLA_TELEMETRY_WEBHOOK_SECRET
FMS_STATUS_URL=https://bori-fleet.shop/api/internal/telemetry/status
FMS_CRON_SECRET=                       # = FMS TESLA_SYNC_CRON_SECRET

# Relay 동작
RELAY_RETRY_MAX=5
RELAY_RETRY_BASE_MS=1000
VIN_ALLOWLIST_REFRESH_SECONDS=300
RELAY_HTTP_TIMEOUT_MS=30000

# TLS (Fly 자동 TLS 사용 시 생략 가능)
TELEMETRY_TLS_CERT=/etc/certs/server.crt
TELEMETRY_TLS_KEY=/etc/certs/server.key
```

Fly secrets 등록:

```powershell
fly secrets set FMS_WEBHOOK_URL=https://bori-fleet.shop/api/tesla/telemetry
fly secrets set FMS_WEBHOOK_SECRET=your-secret
fly secrets set FMS_STATUS_URL=https://bori-fleet.shop/api/internal/telemetry/status
fly secrets set FMS_CRON_SECRET=your-cron-secret
```

#### 4.5.6 Fly.io 배포 체크리스트

1. [fly.io](https://fly.io) 가입 · `flyctl` 설치
2. `fly launch` — 앱명 `bori-telemetry`, region `nrt`
3. `deploy/Dockerfile` — 공식 `fleet-telemetry` 베이스 + relay
4. `fly secrets set` — §4.5.5 환경변수
5. `fly deploy`
6. `check_server_cert.sh` — mTLS 인증서 검증
7. `fleet_telemetry_config.hostname` = `telemetry.bori-fleet.shop`
8. `scripts/relay-smoke.ps1` → FMS `pnpm telemetry:check` 연쇄 검증

#### 4.5.7 데모 시연 시나리오

| 확인 항목 | 방법 |
|-----------|------|
| Fly 수신 | `fly logs` — `V` record 수신 로그 |
| FMS 적재 | Supabase `TelemetryIngress` PROCESSED |
| 대시보드 | `https://bori-fleet.shop` — 배터리·위치 갱신 |
| Telemetry 패널 | FMS `/settings` — 최근 수신 시각 |
| 연동 smoke | FMS `pnpm telemetry:check` |
| Relay health | Fly 내부 `:8081/health` |

---

## 5. FMS 연동 계약 (Integration Contract) — **필수 준수**

Fly relay는 아래 스펙으로 FMS에 POST하면 **추가 FMS 수정 없이** 연동됩니다.

### 5.1 HTTP 요청

```
POST https://bori-fleet.shop/api/tesla/telemetry
Content-Type: application/json
Authorization: Bearer {TESLA_TELEMETRY_WEBHOOK_SECRET}
x-idempotency-key: {vin}:{eventId}
x-request-id: {uuid}
```

| 항목 | 규칙 |
|------|------|
| Method | `POST` only |
| Content-Type | `application/json` |
| 인증 | `Authorization: Bearer` 또는 `x-telemetry-secret` |
| 타임아웃 | relay 10~30s |
| 재시도 | 5xx/네트워크 → exponential backoff. 401 → 재시도 금지 |
| 동시성 | VIN 단위 순서 보장 권장 |

### 5.2 응답

```json
{ "ok": true, "ingressId": "clxxxxx", "duplicate": false }
```

| HTTP | Relay 동작 |
|------|------------|
| 200 `duplicate: false` | ack |
| 200 `duplicate: true` | ack (재전송 불필요) |
| 401 | secret 오류 — 알림, 재시도 금지 |
| 400 | payload 수정 |
| 503 | FMS Telemetry 비활성 |

### 5.3 Payload 스키마 (단건)

```json
{
  "vin": "5YJ3E1EA1KF000001",
  "createdAt": "2026-07-10T04:30:00.000Z",
  "data": {
    "Soc": { "doubleValue": 72 },
    "Location": {
      "locationValue": { "latitude": 37.5665, "longitude": 126.9780 }
    },
    "ChargeState": { "stringValue": "Disconnected" },
    "ShiftState": { "stringValue": "P" },
    "Locked": { "booleanValue": true }
  }
}
```

### 5.4 필드 값 타입

FMS typed wrapper 우선:

```typescript
{ stringValue?, intValue?, doubleValue?, booleanValue?,
  locationValue?: { latitude?, longitude? } }
```

### 5.5 Idempotency

- `x-idempotency-key`: `{VIN}:{telemetryEventId}` 권장
- FMS 중복 시 200 + `duplicate: true`

### 5.6 VIN allowlist

Fly relay가 POST 전 검증:

```
GET https://bori-fleet.shop/api/internal/telemetry/status
Authorization: Bearer {FMS_CRON_SECRET}
→ vehicles.items[].vin 목록 캐시 (300초 갱신)
```

미등록 VIN → relay skip + `fly logs` 카운트 (FMS `FAILED` 방지).

---

## 6. Tesla upstream 설정

### 6.1 사전 준비 (FMS와 공유)

| # | 작업 | 상태 |
|---|------|------|
| 1 | Tesla Developer App | FMS 완료 |
| 2 | EC key pair | FMS 완료 |
| 3 | 공개키 `bori-fleet.shop/.well-known/...` (apex HTTP 200, www 308 금지) | 완료 |
| 4 | Partner Register (`na`) — domain `bori-fleet.shop` | FMS 완료 |
| 5 | Virtual Key 페어링 | 차량별 (실차 1대 완료) |
| 6 | Vehicle Command Proxy | Telemetry repo 로컬 compose·스크립트 준비 |

### 6.2 fleet_telemetry_config

```
POST /api/1/vehicles/fleet_telemetry_config
```

- `config.hostname` = **`telemetry.bori-fleet.shop`**
- `config.port` = `443`
- `config.ca` = Fly 서버 인증서와 **동일 CA** (데모 self-signed)

P0 필드: `Soc`, `Location`, `ChargeState`, **`Gear`** (Tesla config 제약 — `ShiftState` 아님), `Locked`, `Odometer`, `InsideTemp`, `OutsideTemp`, `SentryMode`

확인:

```
GET /api/1/vehicles/{vin}/fleet_telemetry_config  → synced: true
GET /api/1/vehicles/{vin}/fleet_telemetry_errors   → 오류 없음
```

### 6.3 펌웨어

- **2023.20.6+**
- `fleet_status.fleet_telemetry_version` non-null

---

## 7. 환경변수 매트릭스

### 7.1 Fly.io Telemetry 앱

| 변수 | 예시 | 설명 |
|------|------|------|
| `TELEMETRY_PUBLIC_HOST` | `telemetry.bori-fleet.shop` | `fleet_telemetry_config.hostname` |
| `FMS_WEBHOOK_URL` | `https://bori-fleet.shop/api/tesla/telemetry` | relay 목적지 |
| `FMS_WEBHOOK_SECRET` | (FMS와 동일) | `TESLA_TELEMETRY_WEBHOOK_SECRET` |
| `FMS_STATUS_URL` | `.../api/internal/telemetry/status` | VIN allowlist |
| `FMS_CRON_SECRET` | (FMS와 동일) | status API 인증 |
| `RELAY_RETRY_MAX` | `5` | FMS POST 재시도 |
| `RELAY_RETRY_BASE_MS` | `1000` | backoff 시작 |
| `VIN_ALLOWLIST_REFRESH_SECONDS` | `300` | allowlist 갱신 |
| `RELAY_HTTP_TIMEOUT_MS` | `30000` | HTTP 타임아웃 |

### 7.2 FMS (기존 — 참고)

| 변수 | Production 값 |
|------|---------------|
| `NEXT_PUBLIC_APP_URL` | `https://bori-fleet.shop` |
| `TESLA_TELEMETRY_ENABLED` | `true` |
| `TESLA_REST_AUTO_SYNC_ENABLED` | `false` |
| `TESLA_TELEMETRY_WEBHOOK_SECRET` | Fly `FMS_WEBHOOK_SECRET`과 동일 |
| `TESLA_SYNC_CRON_SECRET` | Fly `FMS_CRON_SECRET`과 동일 |

---

## 8. 운영 시나리오

### 8.1 신규 차량 연결

```
1. FMS OAuth → registry sync → TelemetrySubscription active
2. Fly allowlist 캐시 갱신 (FMS status API)
3. fleet_telemetry_config 등록 (hostname = Fly FQDN)
4. 차량 → Fly mTLS → relay → FMS 200
5. VehicleSnapshot.telemetrySource = TELEMETRY
```

### 8.2 차량 unlink

```
1. FMS unlink → DELETE fleet_telemetry_config
2. Fly allowlist에서 VIN 제거 (다음 갱신 주기)
```

### 8.3 FMS 장애 시

- Fly: 메모리 재시도 큐에 보관 (데모 — 최대 15~60분)
- FMS 복구 후 자동 drain
- 영속 큐 필요 시 §4.4.2 Redis 도입
- FMS `POST /api/internal/telemetry/process` — ingress 후처리 (필요 시)

### 8.4 Fly 장애 시

- 차량은 mTLS 재연결 시도 (Tesla 측 동작)
- FMS는 `lastTelemetryAt` 공백 → ASLEEP 추론
- 수동 복구: `POST /api/sync/vehicles?fallback=1` (FMS REST fallback)

---

## 9. MVP 마일스톤 (Fly.io 단독)

| 단계 | 목표 | 공수 (1인) | FMS 검증 | 상태 (2026-07-10) |
|------|------|------------|----------|-------------------|
| M0 | repo + Docker Compose 로컬 기동 | 1일 | — | ✅ 완료 |
| M1 | relay smoke → FMS webhook 직접 POST | 1일 | `pnpm telemetry:check` 200 | ✅ 완료 |
| M2 | Fly 배포 + TLS 검증 | 1~2일 | — | ✅ 완료 |
| M3 | `fleet_telemetry_config` + 실차 1대 | 2~4일 | `TelemetryIngress` PROCESSED | ⏳ 부분 — WS 연결·synced / **V→FMS E2E 보류** |
| M4 | allowlist + 재시도 + `/health` | 1일 | allowlist size·stats | ✅ 완료 |
| M5 | Production 안정화·데모 시연 | 1일 | 대시보드 실시간 반영 | ⏸ 추후 (V E2E 이후) |

**합계: 약 5~8일** (M3 실차 변수 제외 시 7~10일)

> 상세 완료·보류 항목: [requirements-fleet-telemetry-completed.md](./requirements-fleet-telemetry-completed.md)  
> M1은 **Fly 없이** 로컬에서 FMS webhook만 검증 가능.

---

## 10. 연동 검증 체크리스트

### 10.1 Relay smoke (M1, Fly 없이)

- [x] `relay-smoke.ps1` → FMS 200
- [x] FMS `pnpm telemetry:check` 통과 (Production smoke)
- [ ] `TelemetryIngress` PROCESSED — **실차 V 기준 미확인** (수동 smoke는 가능)

### 10.2 Fly + mTLS (M2~M3)

- [x] `fly deploy` 성공 (`bori-telemetry`, checks 2/2)
- [x] TLS / DNS (`telemetry.bori-fleet.shop`, ownership TXT)
- [x] `fleet_telemetry_config` synced=true
- [x] 실차 WebSocket `socket_connected`
- [ ] `fly logs` — `txtype=V` record 수신 (connectivity 위주만 확인)
- [ ] FMS webhook POST 200 반복 (`fms post ack`) — **보류**

### 10.3 FMS end-to-end

- [ ] `VehicleSnapshot.lastTelemetryAt` 갱신 — V E2E 이후
- [ ] `telemetrySource = TELEMETRY`
- [ ] FMS `/settings` Telemetry 패널 갱신
- [ ] 대시보드·지도 반영

### 10.4 운영

- [x] VIN allowlist (FMS status API, size 확인)
- [x] 재시도·401/400/503 재시도 금지
- [x] `/health` allowlist+stats
- [ ] unlink → config 삭제 + allowlist 제거 (시연 전)
- [ ] FMS 5xx 시 Fly 재시도 실측

---

## 11. 보안

| 항목 | 요구사항 |
|------|----------|
| mTLS | Tesla 차량 인증 — upstream 기본 |
| webhook secret | Fly `FMS_WEBHOOK_SECRET` ↔ FMS 동기화 |
| VIN allowlist | 미등록 VIN relay 금지 |
| Fly secrets | `fly secrets` — env 파일 커밋 금지 |
| TLS | Fly 443 — L7 proxy로 mTLS 경로 깨뜨리지 않기 |
| 로그 | 위치·운전 패턴 민감 — 최소 수집 |

---

## 12. 범위 (In / Out of Scope)

### In Scope

- Fly.io 단독 Telemetry 앱 (mTLS + relay)
- FMS webhook relay (§5)
- VIN allowlist / 재시도 / health
- Vehicle Command Proxy 연동

### Out of Scope

- 별도 Vercel·Supabase Telemetry 프로젝트
- FMS UI/DB 변경
- Tesla OAuth (FMS)
- Kubernetes (데모 이후)

---

## 13. 참고 링크

| 리소스 | URL |
|--------|-----|
| Tesla fleet-telemetry | https://github.com/teslamotors/fleet-telemetry |
| Tesla Fleet Telemetry 문서 | https://developer.tesla.com/docs/fleet-api/fleet-telemetry |
| Fly.io Docs | https://fly.io/docs |
| FMS setup §5.4.1 | [setup-guide.md](./setup-guide.md) |
| FMS telemetry 점검 | `scripts/telemetry-webhook-check.ps1` |
| FMS Supabase 점검 | `scripts/telemetry-status.sql` |
| Telemetry 개발 완료 인수인계 | [requirements-fleet-telemetry-completed.md](./requirements-fleet-telemetry-completed.md) |

---

## 14. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-10 | 초안 — FMS Phase 4.2 기반 인수인계서 |
| 2026-07-10 | Vercel + Supabase 하이브리드안 (폐기) |
| 2026-07-10 | **Fly.io 단독 (권장 — 단순 데모)** 으로 전면 개편 — mTLS·relay·재시도를 Fly 1앱에 통합 |
| 2026-07-10 | 커스텀 도메인 반영 — FMS `bori-fleet.shop`, Telemetry `telemetry.bori-fleet.shop` |
| 2026-07-10 | Telemetry 서버 개발 완료 현황 반영 — [requirements-fleet-telemetry-completed.md](./requirements-fleet-telemetry-completed.md) |
