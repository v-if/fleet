# Phase BF — 실차 표시 데이터 버그 수정 체크리스트

관련 요구사항: [requirements-tesla-api-bugfix-0712.md](./requirements-tesla-api-bugfix-0712.md)  
현장 메모: [requirements-tesla-api-bug-report-0712.md](./requirements-tesla-api-bug-report-0712.md)  
수용 테스트 VIN: `LRWYGCFJ7SC214742`  
상태: **코드 완료** (2026-07-12) — 실차 수동 검수 잔여

---

## 이슈 ↔ Phase 매핑

| 이슈 | 증상 | Phase | 우선 |
|------|------|-------|:----:|
| BF-1 | 주행 중 문/트렁크 개방 고착 | BF-A (+ A2) | P0 |
| BF-2 | wake REST가 문 연 순간을 고정 | BF-A 필수 · BF-C/E 선택 | P1 |
| BF-3 | 인근 충전소 출발지 고착 | BF-B · BF-C | P1 |
| (전수) | Sentry/Gear/ChargeState typed 고착 · 창문/TPMS 등 | BF-A2 · BF-D | P0~P1 |

---

## BF-A (P0) — DoorState 파서 + per-door/trunk merge — ✅

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| 1 | `DoorState` string / `Doors` object / typed `door_value` 파서 | ✅ | `mapper.ts` `parseDoorState` |
| 2 | 토큰 → `doorDf/Dr/Pf/PrOpen` · `front/rearTrunkOpen` 매핑 | ✅ | TrunkFront/Rear 포함 |
| 3 | `doorsOpen` = 네 문 중 하나 open | ✅ | |
| 4 | 전부 닫힘 시 각 컬럼에 `false` **명시 기록** | ✅ | `doorStatePresent` |
| 5 | `mergeSnapshotFields`가 per-door/trunk를 current로 갱신 | ✅ | `processor.ts` |
| 6 | 구독 config에 `DoorState` 포함 확인 (재연결 시) | ✅ | `client.ts` |

### BF-A 수동 검수 (실차)

- [ ] 문·트렁크 개방 → 상세 개방 표시
- [ ] 닫은 뒤 Telemetry만으로 닫힘 반영 (REST 재호출 없이)
- [ ] 주행 중 위치/SoC는 갱신되고 도어만 고착되지 않음

---

## BF-A2 (P0) — typed/enum 리더 + 동급 (a) 고착 제거 — ✅

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| 1 | `TelemetryFieldValue`에 proto oneof 대응 | ✅ | `types.ts` |
| 2 | `SentryMode` enum → `sentryMode` bool | ✅ | |
| 3 | `Gear` typed → `ignitionOn` (P 여부) | ✅ | `shiftState`도 보존 |
| 4 | `ChargeState` typed → `chargingStatus` | ✅ | |
| 5 | `batteryPercent` 키에서 `ChargeState` 제거 | ✅ | SoC/`BatteryLevel`만 |

### BF-A2 수동 검수 (실차)

- [ ] 센트리 On/Off가 Telemetry로 바뀜 (REST 없이)
- [ ] P↔D 전환 시 `ignitionOn`/주행 표시 갱신
- [ ] 충전 상태 전환이 Telemetry로 반영

---

## BF-B (P1) — 인근 충전소 stale 클리어 · UI — ✅

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| 1 | 수집 메타 (`capturedAt` ± lat/lng) 스키마/JSON | ✅ | envelope JSON · `nearby-charging.ts` |
| 2 | Telemetry GPS 거리 > 임계(기본 2 km) → 목록 클리어 | ✅ | `TESLA_NEARBY_STALE_DISTANCE_KM` |
| 3 | UI: “수집 지점 기준 · N분 전” | ✅ | `FleetVehicleDetailView` |
| 4 | UI: 클리어 후 “주행 중 — 주차 후 갱신” | ✅ | |

### BF-B 수동 검수 (실차)

- [ ] 출발지에서 2 km 이상 이동 시 출발지 충전소 목록 사라짐
- [ ] 목록이 있을 때 수집 시각(또는 기준 위치) 표시

---

## BF-C (P1) — 정차 시 nearby 재조회 · (선택) Gear 보정 REST — ✅

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| 1 | Gear=P + ONLINE + 쿨다운 경과 → `nearby_charging_sites` 1회 | ✅ | `maybeRefreshNearbyOnPark` |
| 2 | (선택) P→비가동 후 쿨다운 허용 시 동적 보정 REST 1회 | ✅ | `maybeRunGearCorrectionRestSync` |
| 3 | ONLINE 후 무조건 30~60초 지연 REST — **도입하지 않음** | — | 준수 |

### BF-C 수동 검수 (실차)

- [ ] 주차·ONLINE·쿨다운 후 새 위치 기준 충전소 표시
- [ ] ASLEEP만으로 충전소 조회를 위해 wake하지 않음

---

## BF-D (P1) — 창문·TPMS·충전 한도/kW·공조 구독/매핑 — ✅

> **재구독 필요**: Telemetry disconnect→reconnect 또는 config create로 새 필드 반영

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| 1 | `Fd/Fp/Rd/RpWindow` 구독·파서 → `windowsOpen` | ✅ | |
| 2 | `TpmsPressureFl/Fr/Rl/Rr` 구독·파서·merge | ✅ | bar 그대로(기존 환산) |
| 3 | `ChargeLimitSoc` → `chargeLimitSoc` | ✅ | |
| 4 | `ACChargingPower`/`DCChargingPower` → `chargerPowerKw` | ✅ | DC 우선 |
| 5 | `HvacPower` 구독·enum → `climateOn` | ✅ | |
| 6 | (P2) `Version` 구독 | ✅ | interval 600s |

### BF-D 수동 검수 (실차)

- [ ] 창문 개폐가 Telemetry로 반영
- [ ] TPMS가 wake REST 이후에도 갱신(또는 갱신 주기 문서화)
- [ ] 충전 한도·kW·공조가 stale로 남지 않음
- [ ] 재연결 후 새 필드가 config에 포함됨

---

## BF-E (P2) — UI 소스/시각 · 펌웨어 보정 — ✅ (부분)

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| 1 | 문/트렁크 타일에 소스(`REST`/`TELEMETRY`)·시각 표시 | ✅ | security tile hint |
| 2 | FW `< 2024.44.32` PF↔DR 스왑 보정(필요 시) | ☐ | P2 보류 — 공식 매핑 유지 |

---

## 관련 문서

| 문서 | 역할 |
|------|------|
| [requirements-tesla-api-bugfix-0712.md](./requirements-tesla-api-bugfix-0712.md) | 원인·요구·§3.1.1 전수 조사 |
| [checklist-vehicle-detail-ui.md](./checklist-vehicle-detail-ui.md) | VD-3 완료 후 **표시 고착**은 본 BF로 이관 |
| [requirements-tesla-fleet-api-telemetry-webhook.md](./requirements-tesla-fleet-api-telemetry-webhook.md) | 하이브리드·wake 쿨다운·wake 금지 |
| [requirements-tesla-hybrid-data-model.md](./requirements-tesla-hybrid-data-model.md) | Snapshot merge 경로 |
| [development-checklist.md](./development-checklist.md) | Phase BF 요약 |

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-12 | BF-A~E 체크리스트 작성 (미착수) — bugfix 요구사항 반영 |
| 2026-07-12 | BF-A~D·E(부분) 코드 완료 — 실차 검수·PF/DR 보정 잔여 |
