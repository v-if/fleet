# Fleet Telemetry Config — 구독 필드·create 설정 (FMS)

| 항목 | 내용 |
|------|------|
| 목적 | Tesla `fleet_telemetry_config` **create 시 fields 목록**과 FMS 쪽 설정·흐름을 **현행 코드 기준**으로 문서화한다 |
| 핵심 원칙 | 차량은 **Config에 신청(구독)한 필드만** Telemetry로 보낸다. 미구독 필드는 Ingress에 오지 않는다 |
| SoT (코드) | `src/lib/tesla/telemetry/default-fields.ts` — `getDefaultTelemetryFields()` · `createFleetTelemetryConfig` |
| 관련 | [requirements-tesla-fleet-telemetry.md](./requirements-tesla-fleet-telemetry.md), [requirements-fleet-telemetry.md](./requirements-fleet-telemetry.md), [handoff-fms.md](./handoff-fms.md), [requirements-tesla-fleet-telemetry-disconnect.md](./requirements-tesla-fleet-telemetry-disconnect.md), [fleet-api/fleet-telemetry/available-data.csv](./fleet-api/fleet-telemetry/available-data.csv), [requirements-tesla-fleet-telemetry-config-add-field.md](./requirements-tesla-fleet-telemetry-config-add-field.md) (P0/P1 CAF) |
| 상태 | **CAF 반영 ✅** (44키 · `Version` 제외) · 실차 재구독 [CAF-6](./checklist-tesla-fleet-telemetry-config-add-field.md) ☐ |
| 작성일 | 2026-07-15 |

---

## 1. 배경 · 원칙

1. Fleet Telemetry는 **구독(config) 단위**로 스트림 필드를 고른다.  
2. FMS가 Proxy로 `POST .../fleet_telemetry_config` 할 때 `config.fields`에 넣은 키만 차량이 송신한다.  
3. 따라서 UI/Snapshot에 필요한 값이 Telemetry에 안 보이면 **파서 버그보다 먼저 “구독 여부·구독 시점”**을 확인한다.  
4. **이미 config가 있는 VIN**에 `subscribeVehicleTelemetry`를 다시 호출하면 create를 **건너뛴다** (`alreadyConfigured`).  
   → 필드 목록을 코드에서 늘려도 **DELETE 후 재구독(reconnect)** 하기 전에는 차량 config가 갱신되지 않을 수 있다.

```text
[FMS] createFleetTelemetryConfig
   fields = DEFAULT_TELEMETRY_FIELDS
        │
        ▼
[Vehicle Command Proxy] POST /api/1/vehicles/fleet_telemetry_config  (서명)
        │
        ▼
[Tesla] VIN별 config 저장 · synced 대기
        │
        ▼
[차량] mTLS → Telemetry 서버 → FMS webhook
   메시지 data 키 ⊆ 구독 fields
```

---

## 2. Create 요청 형태 (현행)

`createFleetTelemetryConfig` 바디:

```json
{
  "vins": ["<VIN>"],
  "config": {
    "hostname": "<TELEMETRY_PUBLIC_HOST>",
    "port": 443,
    "ca": "<TESLA_TELEMETRY_CA_PEM>",
    "fields": { "...": { "interval_seconds": N } },
    "prefer_typed": true
  }
}
```

| 항목 | 출처 | 비고 |
|------|------|------|
| API | Proxy `POST {TESLA_VEHICLE_COMMAND_PROXY_URL}/api/1/vehicles/fleet_telemetry_config` | 직접 Fleet API POST는 서명 필요로 Proxy 경유 |
| `hostname` | `TELEMETRY_PUBLIC_HOST` \| `TESLA_TELEMETRY_HOSTNAME` \| 기본 `telemetry.bori-fleet.shop` | **FMS 도메인 아님** |
| `port` | `443` | Telemetry 서버 mTLS |
| `ca` | `TESLA_TELEMETRY_CA_PEM` / `TELEMETRY_CA_PEM` | Telemetry 서버와 **동일본** |
| `fields` | `getDefaultTelemetryFields()` | CAF §4 · 아래 §3 |
| `prefer_typed` | `true` | typed value (`locationValue`, `doubleValue` 등) 우선 |

필수 env 없으면 create는 실패한다 (`Proxy URL` / `CA` 미설정 메시지).

GET 조회: Fleet API `GET /api/1/vehicles/{vin}/fleet_telemetry_config` (`getFleetTelemetryConfig`) — `synced` · `config` · `key_paired`.

DELETE: `DELETE /api/1/vehicles/{vin}/fleet_telemetry_config` (구독 해제 / disconnect).

---

## 3. `getDefaultTelemetryFields()` (현행 전체 · CAF)

소스: `src/lib/tesla/telemetry/default-fields.ts`  
전체 표·interval·선정 이유: [requirements-tesla-fleet-telemetry-config-add-field.md](./requirements-tesla-fleet-telemetry-config-add-field.md) §3~4  
검증: `npm run caf:verify` → **44 keys** · `Version`/`BatteryLevel`/`RouteLastUpdated` 없음

요약:

| Tier | 개수 | 예 |
|------|-----:|----|
| P0 | 23 | Location, Soc, Gear, Charge*, TPMS×4, Windows×4, Hvac… |
| P1 | 21 | VehicleSpeed, GpsHeading, Destination*, TimeToFullCharge, SoftwareUpdate*… |
| **합계** | **44** | create `fields` |
| REST-1 (비구독) | — | CarType, Trim, ExteriorColor, **Version** |

### 3.1 과거 스모크(참고)와의 차이

`handoff-fms.md` CREATE 스모크(2026-07-12)에 적힌 fields는 **초기 P0 9개**였다:

`Soc`, `Location`, `ChargeState`, `Gear`, `Locked`, `Odometer`, `InsideTemp`, `OutsideTemp`, `SentryMode`

이후 BF 확장(24키)을 거쳐 **CAF(44키)** 로 확장됐다.  
실차 GET config가 예전 목록이면 → **재구독(reconnect)** 필요 (CAF-6).

---

## 4. interval 선택 가이드 (현행 관례)

| 주기 | 대상 | 이유 |
|------|------|------|
| 60s | 위치·SoC·잠금·기어·도어·창문·충전 출력·공조 등 | 관제 실시간성 |
| 120s | 주행가능거리·충전 한도 | 상대적으로 덜 급함 |
| 300s | TPMS | 느리게 변함 · 대역 절약 |
| 600s | Version | 거의 불변 |

`interval_seconds`는 Tesla 쪽 **최소 보고 간격 힌트**에 가깝다. 변경 변화 시 더 자주 올 수 있고, 절전 중에는 거의 안 온다.

---

## 5. FMS 흐름 — 언제 config가 만들어지나

| 경로 | 동작 | Tesla config |
|------|------|----------------|
| OAuth 후 `ensureTelemetrySubscriptionsForAccount` | DB `TelemetrySubscription` upsert | **create 안 함** (수신 대기 메타만) |
| `subscribeVehicleTelemetry` | GET → 없으면 create | **create** (`DEFAULT_TELEMETRY_FIELDS`) |
| | GET → 이미 `config != null` | **create 스킵** (`alreadyConfigured`) · DB `configSynced`만 반영 |
| `reconnectVehicleTelemetry` (단절 해제) | subscribe 호출 | 위와 동일 — 이전에 DELETE 됐으면 create |
| `unsubscribeVehicleTelemetry` / disconnect | DELETE config | 구독 제거 |

운영 함의:

- **필드 목록을 코드에서 바꾼 뒤** 실차에 반영하려면: disconnect→reconnect, 또는 DELETE 후 `subscribeVehicleTelemetry`로 **강제 재create**.  
- “구독 DB active” ≠ “Tesla에 최신 fields”. 확인은 **GET fleet_telemetry_config**의 `config.fields`.

파서: `src/lib/tesla/telemetry/mapper.ts` — 구독 키(+별칭)를 Snapshot으로 매핑.  
구독이 없으면 mapper가 있어도 값이 영원히 안 온다.

---

## 6. 설정(env) 요약

| 변수 | 역할 |
|------|------|
| `TESLA_TELEMETRY_ENABLED` | Telemetry on/off (기본 on) |
| `TESLA_VEHICLE_COMMAND_PROXY_URL` | config **create** 필수 |
| `TESLA_TELEMETRY_CA_PEM` / `TELEMETRY_CA_PEM` | config **create** CA |
| `TELEMETRY_PUBLIC_HOST` / `TESLA_TELEMETRY_HOSTNAME` | config `hostname` |
| `TESLA_TELEMETRY_WEBHOOK_URL` / `NEXT_PUBLIC_APP_URL` | FMS webhook (config fields와 별개 · relay→FMS) |
| `TESLA_TELEMETRY_WEBHOOK_SECRET` | webhook 검증 |
| `TESLA_PARTNER_TOKEN` | unsubscribe 등 partner 토큰(선택) |

상세 설치: [setup-guide.md](./setup-guide.md) Telemetry·Proxy 절.

---

## 7. 필드 추가 절차 (운영)

1. Tesla 공식 available data / [available-data.csv](./fleet-api/fleet-telemetry/available-data.csv)에서 **정확한 필드명** 확인 (`Gear` vs `ShiftState` 등).  
2. `DEFAULT_TELEMETRY_FIELDS`에 `{ interval_seconds }` 추가.  
3. `mapper.ts`에 읽기·Snapshot 매핑 추가.  
4. (필요 시) UI·요구사항 문서 갱신.  
5. **실차: DELETE + 재구독** 또는 reconnect로 config 재발행.  
6. GET config에 새 키 존재 · Ingress에 해당 키 수신 · Snapshot 반영 확인.  
7. value-monitor(개발)로 수신 키 교차 검증.

구독만 하고 mapper가 없으면 Ingress에는 보이지만 Snapshot은 비어 보인다.  
mapper만 있고 구독이 없으면 둘 다 비어 보인다.

---

## 8. synced · 절전과의 관계

| 상태 | 의미 |
|------|------|
| `config != null` | Tesla에 구독 등록됨 |
| `synced: true` | 차량이 config를 받아 적용한 것으로 봄 (wake 후 true인 경우 많음) |
| `synced: false` | sleep 등으로 미적용 가능 — **fields는 등록돼 있어도** 스트림이 조용할 수 있음 |

FMS는 스트림 수신 시 `configSynced` / `telemetryConfigSyncedAt`을 보조 마킹하기도 한다 (processor).  
표시: 상세 UI Telemetry 연동·config 경고.

---

## 9. REST vs Telemetry (역할 분담 요약)

구독 fields = Telemetry SoT 후보.  
미구독·미매핑 갭은 하이브리드 REST(Baseline / wake 쿨다운 등)로 보완한다.

| 데이터 | 1차 | 비고 |
|--------|-----|------|
| 위치·SoC·충전상태·기어·잠금·온도·센트리·도어·창문·TPMS·충전출력·공조·버전 | Telemetry (구독 시) | §3 |
| 인근 충전소·일부 서비스 | REST | Telemetry fields 없음 |
| 제원 (`car_type` 등) | REST Baseline → `Vehicle` | Telemetry 비대상 |

---

## 10. 수용·점검 체크 (필드/config)

- [ ] Create 바디 `fields`가 §3와 동일 (`ApiCallLog` requestBody · CA redact)  
- [ ] 실차 `GET .../fleet_telemetry_config` → §3 키가 config에 존재  
- [ ] BF 이후 확장 필드가 없으면 reconnect로 재발행했는지 확인  
- [ ] Ingress sample에 기대 키 존재 (구독⊇수신)  
- [ ] Snapshot 해당 컬럼 갱신 (구독 ∩ mapper)  
- [ ] `prefer_typed: true` 유지 · typed 파서와 정합  

---

## 11. 구현 파일 맵

| 파일 | 역할 |
|------|------|
| `src/lib/tesla/telemetry/client.ts` | `DEFAULT_TELEMETRY_FIELDS` · create/get/delete |
| `src/lib/tesla/telemetry/subscription.ts` | subscribe / unsubscribe / ensure(DB) |
| `src/lib/tesla/telemetry/disconnect.ts` | reconnect → subscribe |
| `src/lib/tesla/telemetry/config.ts` | hostname · CA · Proxy URL · feature flags |
| `src/lib/tesla/telemetry/mapper.ts` | fields → Snapshot |
| `src/lib/tesla/charging-power.ts` | AC/DC → kind |

---

## 12. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-15 | 현행 `DEFAULT_TELEMETRY_FIELDS` 24키 · create/구독 흐름 · 재구독 주의 문서화 |
| 2026-07-15 | CAF 확장 요구·체크리스트 링크 (To-Be 43키 · 코드 미반영) |
| 2026-07-15 | **CAF 반영** — default-fields 44키 · Version REST-1 · §3 개정 |
