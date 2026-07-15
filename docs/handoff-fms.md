# FMS 개발자 인수인계 — Vehicle Command Proxy

> **작성**: Command Proxy 담당 (`fleet-cmd-proxy`)  
> **대상**: FMS (Vercel / `bori-fleet.shop`) 개발자  
> **일자**: 2026-07-12  
> **목적**: Production Telemetry **재연동(config CREATE)** 차단 해제 — Proxy 배포·스모크 완료, **FMS Vercel env·E2E만 남음**

---

## 1. 한 줄 요약

Fly에 Vehicle Command Proxy를 올렸고, 실차 VIN으로 **서명 CREATE → GET `config != null`** 까지 확인했습니다.  
FMS는 Vercel에 Proxy URL(+ CA)을 넣고 「Telemetry 다시 연결」 E2E만 하면 됩니다. **FMS 코드 수정은 필요 없습니다** (기존 `createFleetTelemetryConfig` 클라이언트 그대로).

---

## 2. 바로 넣을 Vercel env

Production (및 필요 시 Preview)에 설정 후 **redeploy**:

```env
TESLA_VEHICLE_COMMAND_PROXY_URL=https://bori-cmd-proxy.fly.dev
TESLA_TELEMETRY_CA_PEM="-----BEGIN CERTIFICATE-----\n...(기존 Telemetry CA와 동일본)...\n-----END CERTIFICATE-----"
TELEMETRY_PUBLIC_HOST=telemetry.bori-fleet.shop
```

| 변수 | 필수 | 설명 |
|------|:----:|------|
| `TESLA_VEHICLE_COMMAND_PROXY_URL` | ✅ | 아래 **확정 origin** — path·trailing `/` **없음** |
| `TESLA_TELEMETRY_CA_PEM` | ✅ | create body `ca`. **새로 만들지 말 것**. Telemetry/`bori-telemetry`와 동일본. 이미 Vercel에 있으면 유지 |
| `TELEMETRY_PUBLIC_HOST` | 권장 | `telemetry.bori-fleet.shop` (config hostname과 동일) |

### 확정 origin

```text
https://bori-cmd-proxy.fly.dev
```

헬스 확인: `GET https://bori-cmd-proxy.fly.dev/healthz` → `ok`

### 넣으면 안 되는 값

| 잘못된 값 | 이유 |
|-----------|------|
| `https://localhost:4443` | Vercel에서 도달 불가 |
| `https://telemetry.bori-fleet.shop` | 차량 mTLS 수신 서버 — 서명 Proxy 아님 |
| `https://bori-fleet.shop` | FMS 자체 |
| `https://bori-cmd-proxy.fly.dev/api/1/...` | FMS 코드가 path를 붙임 |
| URL 끝 `/` | trailing slash 금지 |

---

## 3. Proxy가 이미 한 일 (완료)

| 항목 | 내용 |
|------|------|
| Fly 앱 | `bori-cmd-proxy` · region `nrt` |
| 상시 기동 | `min_machines_running=1`, `auto_stop=false` |
| 소프트웨어 | Tesla 공식 `tesla-http-proxy` (VK private key로 서명) |
| 공개 URL | `https://bori-cmd-proxy.fly.dev` |
| FMS 계약 path | `POST {origin}/api/1/vehicles/fleet_telemetry_config` |

### CREATE 스모크 (2026-07-12) — 증거

| 항목 | 결과 |
|------|------|
| VIN | `LRWYGCFJ7SC214742` |
| CREATE via Proxy | **HTTP 200** · `{"response":{"updated_vehicles":1}}` |
| GET (Fleet API `na`) | **HTTP 200** · **`config != null`** |
| `hostname` | `telemetry.bori-fleet.shop` |
| fields | 당시 P0 9개 (Soc…SentryMode). **현행 create 전체 목록:** [requirements-tesla-fleet-telemetry-config.md](./requirements-tesla-fleet-telemetry-config.md) §3 |
| `synced` | 당시 `false` (차량 sleep 가능 — wake 후 `true` 될 수 있음) |

→ Proxy·VK 키·CA·필드 관례는 Production create에 사용 가능한 상태입니다.

---

## 4. FMS가 할 일 (체크리스트)

### 4.1 설정

- [ ] Vercel Production에 `TESLA_VEHICLE_COMMAND_PROXY_URL=https://bori-cmd-proxy.fly.dev`
- [ ] `TESLA_TELEMETRY_CA_PEM` = Telemetry와 **동일본** (없거나 불확실하면 Telemetry 담당 확인 — **신규 CA 금지**)
- [ ] (권장) `TELEMETRY_PUBLIC_HOST=telemetry.bori-fleet.shop`
- [ ] Production **redeploy**

### 4.2 E2E 검증 (권장 VIN `LRWYGCFJ7SC214742`)

> FMS docs 반영: Phase 4.6 Proxy 배포 완료 · 아래는 **FMS 잔여** 작업.

1. 차량 상세 → 「Telemetry 다시 연결」(또는 동등 reconnect API)
2. `ApiCallLog` / 서버 로그에  
   `TESLA_VEHICLE_COMMAND_PROXY_URL 미설정` **없음**
3. Tesla `GET .../fleet_telemetry_config` → `config != null`
4. (가능하면) 차량 wake 후 ingress / `telemetrySource=TELEMETRY`

FMS 쪽 기존 흐름 (참고):

```text
POST /api/vehicles/{id}/telemetry/reconnect
  → createFleetTelemetryConfig()
  → POST {TESLA_VEHICLE_COMMAND_PROXY_URL}/api/1/vehicles/fleet_telemetry_config
     Authorization: Bearer <사용자 OAuth access_token>
```

코드 위치 (FMS repo): `src/lib/tesla/telemetry/client.ts`

---

## 5. URL 세 개 — 혼동 금지

| URL | 누가 붙나 | 용도 |
|-----|-----------|------|
| `https://bori-fleet.shop` | 사용자·FMS | FMS 웹·API |
| `https://telemetry.bori-fleet.shop` | **차량** | Telemetry mTLS 수신 (`config.hostname`) |
| `https://bori-cmd-proxy.fly.dev` | **FMS 서버** | config CREATE 서명 Proxy ← **이번 env** |

`fleet_telemetry_config` body의 **`hostname`은 항상 `telemetry.bori-fleet.shop`** 입니다. Proxy URL을 hostname에 넣지 마세요.

---

## 6. 장애 시 (FMS 관점)

| 증상 | 조치 |
|------|------|
| `TESLA_VEHICLE_COMMAND_PROXY_URL 미설정` | Vercel env·redeploy 확인 |
| Proxy timeout / 연결 실패 | `https://bori-cmd-proxy.fly.dev/healthz` → `ok` 인지. Proxy 담당에 `fly status` / `fly logs` 요청 |
| create 4xx/5xx | 사용자 OAuth 만료·스코프, Proxy 로그. Partner token만 쓰지 말 것 |
| create 성공인데 스트림 없음 | (1) CA/hostname 불일치 (2) 차량 sleep → wake (3) `bori-telemetry` (4) FMS 구독/allowlist — Telemetry·Proxy와 함께 확인 |
| `synced: false` | 다음 차량 백엔드 연결 때 적용. wake 후 GET 재확인 |

Proxy 담당 점검 명령:

```bash
fly status -a bori-cmd-proxy
fly logs -a bori-cmd-proxy
curl -sS https://bori-cmd-proxy.fly.dev/healthz
```

---

## 7. 운영 좌표

| 항목 | 값 |
|------|-----|
| Fly 앱 | `bori-cmd-proxy` |
| Region | `nrt` |
| Org | personal (Telemetry `bori-telemetry`와 동일) |
| Proxy 저장소 | `fleet-cmd-proxy` |
| 상세 현황 | [ops-status.md](./ops-status.md) |
| 요구사항 | [requirements-tesla-vehicle-command-proxy.md](./requirements-tesla-vehicle-command-proxy.md) |

---

## 8. 슬랙/메일 복사용 (짧은 버전)

```text
[Command Proxy 인수인계]

TESLA_VEHICLE_COMMAND_PROXY_URL=https://bori-cmd-proxy.fly.dev
( path·trailing slash 없이 origin만 )

- Fly 앱: bori-cmd-proxy / nrt / 상시 on
- healthz: https://bori-cmd-proxy.fly.dev/healthz → ok
- 스모크: VIN LRWYGCFJ7SC214742 CREATE 200 updated_vehicles:1
          GET config != null, hostname=telemetry.bori-fleet.shop, Gear 포함

FMS 할 일:
1) Vercel에 위 URL + TESLA_TELEMETRY_CA_PEM(기존 Telemetry 동일본) 설정 후 redeploy
2) 「Telemetry 다시 연결」 E2E
   - ApiCallLog에 URL 미설정 오류 없을 것
   - config != null / 가능하면 ingress TELEMETRY

FMS 코드 변경 불필요. hostname은 telemetry.bori-fleet.shop 유지.
```

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-12 | 초안 — Proxy 배포·CREATE 스모크 완료 후 FMS 전달용 |
| 2026-07-12 | FMS docs 인덱스·Phase 4.6·setup-guide·요구사항 문서에 반영 (Vercel/E2E는 FMS 잔여) |
