# Fleet Telemetry 서버 — FMS 인수인계 · 개발 완료 현황

> **대상**: 보리차 FMS (`bori-fleet`) 개발·운영 담당  
> **목적**: FMS에서 넘긴 요구사항 기준으로 구축한 **Fleet Telemetry 서버** 현황을 공유하고, FMS 측에서 이어갈 연동·검증 포인트를 정리  
> **작성일**: 2026-07-10  
> **Telemetry 저장소**: `fleet-telemetry` (별도 repo)  
> **원 요구사항**: [requirements-fleet-telemetry.md](./requirements-fleet-telemetry.md)  
> **FMS 개발 체크리스트**: [development-checklist.md](./development-checklist.md)  
> **FMS 운영 가이드**: [setup-guide.md](./setup-guide.md) §5.4.1  
> **도메인**: FMS `https://bori-fleet.shop` · Telemetry `https://telemetry.bori-fleet.shop`

---

## 1. 한 줄 요약

Tesla 차량 mTLS 수신 → 디코딩 → FMS webhook POST 를 **Fly.io 단일 앱**에서 처리하는 Telemetry 서버를 구축했습니다.  
FMS DB/UI는 건드리지 않으며, **§5 연동 계약**으로만 FMS와 통신합니다.

| 구분 | 상태 |
|------|------|
| M0~M2, M4 | ✅ 완료 (코드 + Fly 배포) |
| M3 | ⏳ **부분 완료** — 실차 WebSocket 연결까지 확인 / **`txtype=V` → FMS E2E 보류** |
| M5 | ⏸ Production 안정화·데모 시연 전 항목 — **추후** (V E2E 이후) |

---

## 2. 시스템 경계 (역할 분담)

| 구성요소 | 담당 | 비고 |
|----------|------|------|
| **Fly Telemetry** (`bori-telemetry`) | mTLS 수신, protobuf 디코딩, VIN allowlist, FMS POST, 재시도 | 본 프로젝트 |
| **FMS** (`bori-fleet.shop`) | OAuth, registry, webhook 수신·ingress·snapshot·UI, ASLEEP, unlink/`DELETE config` | FMS 기존 |
| **Vehicle Command Proxy** | `fleet_telemetry_config` 서명 호출 | 로컬 Docker 스크립트 준비됨 (FMS/운영에서 사용) |

```
Tesla 차량
   │ mTLS / WebSocket
   ▼
telemetry.bori-fleet.shop  (Fly.io · bori-telemetry)
   │  fleet-telemetry (공식) + Go relay
   │  POST /api/tesla/telemetry  (§5 JSON)
   ▼
bori-fleet.shop  (FMS · Vercel)
   │  TelemetryIngress → VehicleSnapshot → 대시보드
```

> 차량은 FMS URL로 직접 붙지 않습니다.  
> Fly **443은 TCP passthrough**(L7 TLS 종료 없음) — mTLS 유지.

---

## 3. Production 엔드포인트 · 앱 정보

| 항목 | 값 |
|------|------|
| Fly 앱 | `bori-telemetry` (region `nrt`) |
| Telemetry hostname | `telemetry.bori-fleet.shop` → shared IP `66.241.125.36` |
| Partner / FMS | `bori-fleet.shop` |
| FMS webhook (relay → FMS) | `https://bori-fleet.shop/api/tesla/telemetry` |
| FMS status (allowlist) | `https://bori-fleet.shop/api/internal/telemetry/status` |
| Relay health | Fly 내부 check `:8081/health` (HTTP) |
| 대시보드 | https://fly.io/apps/bori-telemetry/monitoring |

### 3.1 `/health` 응답 예시 (M4 배포 후 실측)

```json
{
  "status": "ok",
  "service": "bori-telemetry-relay",
  "allowlist": {
    "enabled": true,
    "size": 4,
    "lastRefreshAt": "2026-07-10T13:39:57Z"
  },
  "stats": {
    "ack": 0,
    "skip": 0,
    "retry": 0,
    "fail": 0
  }
}
```

- `allowlist.enabled=true` · `size=4` → FMS status API 연동·캐시 정상  
- `stats.*` → webhook ack / VIN skip / 재시도 / 최종 실패 카운터

---

## 4. 마일스톤별 완료 내용

### 4.1 ✅ M0 — 저장소·로컬

- Go 모듈 `github.com/v-if/fleet-telemetry`
- `cmd/relay` + `internal/{transform,fms,health}`
- Docker: `tesla/fleet-telemetry:v0.9.3` + relay 단일 컨테이너
- 로컬 TLS 스크립트 · Compose 검증

### 4.2 ✅ M1 — FMS webhook relay

- upstream 디코딩 JSON → FMS §5 payload transform
- `Authorization: Bearer` + `x-idempotency-key` (`{VIN}:{eventId}`)
- 로컬 mock + **Production FMS smoke 200** (idempotency 포함)
- `go test ./...` 통과

### 4.3 ✅ M2 — Fly 배포

- `fly.toml`: `:443` TCP passthrough + `:8081` health
- `auto_stop_machines = off`, `min_machines_running = 1`
- TLS PEM을 Fly secrets(B64)로 주입
- 데모용 self-signed 서버 인증서 (실차 `config.ca`와 동일 CA 사용)

### 4.4 ⏳ M3 — 실차 연동 (부분)

**완료**

| 항목 | 결과 |
|------|------|
| Partner domain | `bori-fleet.shop` (apex 공개키 HTTP 200) |
| hostname | `telemetry.bori-fleet.shop` |
| TXT ownership | `_fly-ownership.telemetry` |
| `fleet_telemetry_config` | create · **`synced: true`** |
| Virtual Key | 페어링 완료 |
| 실차 WebSocket | `socket_connected` (VIN `LRWYGCFJ7SC214742`) |
| P0 필드 | Gear 사용 (ShiftState 아님 — Tesla config 제약) |

**보류 (추후 / 시연 전 재검증)**

| 항목 | 설명 |
|------|------|
| `txtype=V` record 수신 | connectivity 위주 로그는 확인, V 스트림 E2E 미완 |
| `fms post ack` | 실차 V → relay → FMS 200 반복 미검증 |
| FMS `TelemetryIngress` PROCESSED | 실차 기준 미확인 |
| `telemetrySource=TELEMETRY` · 대시보드 실시간 | V E2E 이후 |
| Fly 머신 재시작 억제 | 운영 관찰 필요 (billing 이슈로 한때 suspended) |

### 4.5 ✅ M4 — allowlist · 재시도 · 관측

| 기능 | 구현 |
|------|------|
| VIN allowlist | `GET FMS_STATUS_URL` + `Bearer FMS_CRON_SECRET` · 기본 300초 캐시 |
| 미등록 VIN | POST skip + stats `skip` |
| 재시도 | VIN별 in-process 큐 + exponential backoff |
| 재시도 금지 | 401 / 400 / 503 |
| 관측 | JSON slog · `/health` allowlist+stats |
| Fly 재배포 | 2026-07-10 billing 복구 후 배포 · checks **2/2 passing** |

### 4.6 ⏸ M5 — Production 안정화

신규 차량·unlink·장애 시나리오·데모 시연 체크리스트는 **추후**.  
완료 기준의 상당 부분이 **M3 V→FMS**에 의존합니다.

---

## 5. FMS 연동 계약 (구현 준수 현황)

요구사항 §5를 relay가 준수합니다. FMS 추가 수정 없이 webhook만 수신하면 됩니다.

### 5.1 요청

```
POST https://bori-fleet.shop/api/tesla/telemetry
Content-Type: application/json
Authorization: Bearer {TESLA_TELEMETRY_WEBHOOK_SECRET}
x-idempotency-key: {vin}:{eventId}
x-request-id: {uuid}
```

### 5.2 Body (단건)

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

- typed wrapper: `stringValue` / `intValue` / `doubleValue` / `booleanValue` / `locationValue`
- **connectivity** 등 비-V 레코드는 transform에서 **skip** (FMS로 보내지 않음)
- 로그만 있는 라인도 skip

### 5.3 응답에 따른 relay 동작

| FMS HTTP | Relay |
|----------|--------|
| 200 (`duplicate` true/false) | ack |
| 5xx / 네트워크 | 재시도 (backoff, VIN 순서 유지) |
| 401 | 재시도 금지 (secret 불일치) |
| 400 | 재시도 금지 |
| 503 | 재시도 금지 (Telemetry 비활성) |

### 5.4 Allowlist (FMS → Telemetry)

```
GET https://bori-fleet.shop/api/internal/telemetry/status
Authorization: Bearer {TESLA_SYNC_CRON_SECRET}   # Fly: FMS_CRON_SECRET
```

- 응답의 `vehicles.items[].vin` 을 캐시
- 미등록 VIN은 FMS에 POST하지 않음 → FMS `FAILED` ingress 방지
- unlink 후 FMS status에서 VIN이 빠지면, **다음 갱신 주기(최대 ~300초)** 에 allowlist 반영

---

## 6. Secrets 매핑 (FMS ↔ Fly)

| FMS 환경변수 | Fly secret | 용도 |
|--------------|------------|------|
| `TESLA_TELEMETRY_WEBHOOK_SECRET` | `FMS_WEBHOOK_SECRET` | webhook Bearer |
| `TESLA_SYNC_CRON_SECRET` | `FMS_CRON_SECRET` | status/allowlist Bearer |
| (FMS URL) | `FMS_WEBHOOK_URL` | `https://bori-fleet.shop/api/tesla/telemetry` |
| (FMS URL) | `FMS_STATUS_URL` | `https://bori-fleet.shop/api/internal/telemetry/status` |
| — | `TELEMETRY_PUBLIC_HOST` | `telemetry.bori-fleet.shop` |
| — | `TELEMETRY_TLS_CERT_PEM_B64` / `KEY` | 앱 종료 TLS |
| — | `RELAY_RETRY_*`, `VIN_ALLOWLIST_REFRESH_SECONDS` | 재시도·캐시 |

> Production Fly secrets는 **`bori-fleet.shop`** 기준으로 설정됨 (vercel.app 아님).  
> secret 값은 이 문서에 적지 않습니다. FMS Vercel env와 **동일 값**인지 주기적으로 맞추면 됩니다.

---

## 7. FMS 측에서 알아두면 좋은 운영 포인트

1. **Telemetry Primary**  
   FMS가 REST 폴링을 끄고 webhook만으로 snapshot을 갱신하는 전제와 맞습니다. V 스트림이 안 오면 `lastTelemetryAt`이 갱신되지 않습니다.

2. **실차 config**  
   - hostname = `telemetry.bori-fleet.shop`  
   - `ca` = Fly 서버 인증서와 **동일 CA** (현재 데모 self-signed)  
   - 필드: **Gear** (ShiftState 아님)

3. **Partner / 공개키**  
   apex `bori-fleet.shop` 에서 Tesla 공개키 **HTTP 200** (308→www 이면 partner register 실패).

4. **Vehicle Command Proxy**  
   Telemetry repo에 로컬 compose·`fleet-telemetry-config.ps1`·readiness 스크립트 있음.  
   OAuth token·EC private key·registry sync는 **FMS 운영** 영역.

5. **관측**  
   - `fly checks` / `/health` — allowlist·stats  
   - `fly logs` — fleet-telemetry + relay (entrypoint에서 `tee`)  
   - V record가 보이면 `fms post ack` 로그를 기대

6. **장애**  
   - FMS 5xx → Fly 메모리 큐 재시도 (데모, 영속 큐 없음)  
   - Fly down → 차량 재연결 시도 · FMS ASLEEP / REST fallback은 FMS 담당

---

## 8. FMS에 요청·확인이 필요한 항목 (추후 공동)

| # | 항목 | 담당 | 비고 |
|---|------|------|------|
| 1 | 실차 `txtype=V` → ingress PROCESSED | 공동 | M3 보류 — 시연 전 최우선 |
| 2 | `VehicleSnapshot.lastTelemetryAt` / `telemetrySource=TELEMETRY` | FMS 확인 | V 수신 후 |
| 3 | `/settings` Telemetry 패널 · 대시보드 반영 | FMS | 데모 시연 |
| 4 | `pnpm telemetry:check` 정기 | FMS | 선택 |
| 5 | unlink → `DELETE fleet_telemetry_config` | FMS | Telemetry는 allowlist만 갱신 |
| 6 | webhook/cron secret 동기화 | 공동 | Vercel ↔ Fly |
| 7 | 공인/파트너 TLS로 CA 교체 여부 | 공동 | 데모 self-signed 한계 |

---

## 9. 저장소에서 볼 주요 경로

| 경로 | 설명 |
|------|------|
| `cmd/relay/main.go` | stdin 디코딩 라인 → transform → queue → FMS |
| `internal/transform/` | §5 payload 변환 · connectivity skip |
| `internal/fms/client.go` | webhook POST · backoff |
| `internal/fms/allowlist.go` | status API 캐시 |
| `internal/fms/queue.go` | VIN별 순서·재시도 큐 |
| `internal/health/` | `/health` |
| `config/server_config.json` | upstream records → logger |
| `deploy/Dockerfile` · `entrypoint.sh` | 단일 컨테이너 파이프 |
| `fly.toml` | TCP 443 + health 8081 |
| `scripts/relay-smoke.ps1` | FMS webhook 직접 smoke |
| `scripts/fleet-telemetry-config.ps1` | config create/get |

---

## 10. 관련 문서

| 문서 | 용도 |
|------|------|
| [requirements-fleet-telemetry.md](./requirements-fleet-telemetry.md) | 원 요구사항·§5 계약·운영 시나리오 |
| [development-checklist.md](./development-checklist.md) | FMS Phase 체크리스트 (Phase 4.2·4.3) |
| [setup-guide.md](./setup-guide.md) | FMS 로컬·배포·Telemetry webhook 점검 (§5.4.1) |
| Telemetry repo `docs/` | Fly·Proxy·커스텀 도메인 상세 (별도 저장소) |

---

## 11. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-10 | 초안 — FMS 인수인계용 Telemetry 개발 완료·보류 현황 정리 |
| 2026-07-10 | FMS docs에 반영 — 커스텀 도메인 `bori-fleet.shop` / `telemetry.bori-fleet.shop` |
