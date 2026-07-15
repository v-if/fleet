# 온보딩 최초 REST — 정적 제원 Baseline 재정의 (TRF-B1)

| 항목 | 내용 |
|------|------|
| 목적 | FMS 유저가 **① Tesla 계정 연동 → ② Virtual Key(Telemetry) 확인** 이후 수행되는 **최초 1회 Fleet REST**를, 변동이 거의 없는 제원(`CarType` · `Trim` · `ExteriorColor` · `Version` 등)만 조회·저장하도록 **필드·쓰기 경계를 재정의**한다 |
| 배경 | As-is Baseline은 `vehicle_data` 응답으로 **Vehicle 제원과 Snapshot 동적 전량**을 함께 써서 Telemetry SoT를 오염시킨다. CAF REST-1·하이브리드 DB는 이미 “제원=Vehicle / 동적=Telemetry”로 설계됐으나 코드 Baseline이 후행하지 않는다 |
| 관련 | [requirements-tesla-telemetry-rest-freeze.md](./requirements-tesla-telemetry-rest-freeze.md) (TRF · Phase B①), [requirements-tesla-fleet-telemetry-config-add-field.md](./requirements-tesla-fleet-telemetry-config-add-field.md) (CAF §5 REST-1), [requirements-tesla-hybrid-data-model.md](./requirements-tesla-hybrid-data-model.md), [requirements-tesla-fleet-api-model-mapping.md](./requirements-tesla-fleet-api-model-mapping.md), [checklist-tesla-telemetry-rest-freeze.md](./checklist-tesla-telemetry-rest-freeze.md), 리서치: [research-fleet-api-gemini.md](./research/research-fleet-api-gemini.md) · [research-fleet-api-grok.md](./research/research-fleet-api-grok.md) · [research-fleet-api-chatgpt.md](./research/research-fleet-api-chatgpt.md), 스펙: [vehicle_data.json](./fleet-api/endpoints/vehicle-endpoints/vehicle_data.json) |
| 상태 | **코드 ✅ · Freeze 졸업 ✅ · `trf-b1:verify` ✅ · 실차 QA(TRF-B1-4) ☐** |
| 작성일 | 2026-07-15 |
| ID | **TRF-B1** / 상위 **TRF-5** (B1 필드 표 확정) |
| 범위 밖 | Wake 쿨다운 REST 재정의 → **TRF-B2** (별도 문서 · TRF-6). 본 문서는 온보딩 최초 1회만 |

---

## 1. 대상 시나리오 (최초 FMS 유저)

```text
[1] Tesla OAuth 계정 연동
      → listVehicles + fleet_status (registry)
      → Vehicle 행 생성 (VIN·표시명 수준) · Snapshot 없음
      → lifecycle: REGISTERED / KEY_PENDING …

[2] Virtual Key 발급·페어링 확인 (UI/confirm)
      → getFleetStatus 페어링 검사
      → SyncState: TELEMETRY_PENDING · virtualKeyConfirmedAt
      → TelemetrySubscription active
      → (선택) fleet_telemetry_config create — CAF 44키 · 제원 키 미구독

[3] ★ 본 문서 대상 — 최초 1회 REST (제원 Baseline)
      → As-is: vehicle_data(+nearby/service/alerts) → 제원+Snapshot 전량
      → To-be: 동일 트리거 · **쓰기 = 정적 제원만** · Snapshot 동적 미생성
```

| 단계 | REST 역할 | Snapshot? | SoT |
|------|-----------|:---------:|-----|
| (1) 계정 연동 | 차량 목록·VK 메타 등록 | ❌ | registry |
| (2) VK 확인 | pairing 확인 · Telemetry 구독 준비 | ❌ | SyncState + Subscription |
| (3) 제원 Baseline | **제원 1회 채움** | ❌ (To-be) | **Vehicle** |
| (이후) 관제 | Telemetry webhook | ✅ | Snapshot `TELEMETRY` |

**원칙:** (3)은 “차를 깨워 실시간 상태를 채운다”가 아니라 **표시·필터용 불변 제원을 DB에 고정**하는 단계다. 동적 관제는 (2) 이후 Telemetry가 담당한다.

---

## 2. 설계 원칙 (To-Be)

| # | 원칙 | 근거 |
|---|------|------|
| P1 | **변동 없음 ≈ Telemetry 비구독 ≈ REST 1회** | CAF REST-1 · available-data의 Vehicle Configuration |
| P2 | **쓰기 화이트리스트가 SoT** | Tesla `vehicle_data`는 정적·동기가 한 응답에 섞임. 조회는 전체를 받아도 **저장 필드만 허용** |
| P3 | **Baseline은 Snapshot을 만들지 않음** (옵션 A) | Freeze·LN-R·CAF 검증 목적과 일치. 동적 SoT = Telemetry |
| P4 | **Telemetry는 Vehicle 제원을 덮지 않음** | hybrid §1.1 · display-data |
| P5 | **wake_up 금지 유지** | Baseline 실패 시에도 wake로 제원을 “억지 채우지 않음” (현행 유지) |
| P6 | **재실행은 예외** | `baselineCompletedAt` 이후 기본 스킵. 수동 `SPECS_REFRESH`(제원만·동일 whitelist)만 허용 |
| P7 | **정규 컬럼(P0 UI) + JSON 보관(P1 확장)** | 리서치 3건 공통: UI·필터 핵심은 컬럼, 나머지 `vehicle_config`는 **필터된 JSON** 1회 저장 (스키마 churn 방지) |

---

## 2.1 Fleet API 리서치 종합 (2026-07-15)

Gemini · Grok · ChatGPT 3건 + 공식 `vehicle_data` 샘플을 교차 검토한 **최초 1회 REST 저장 후보** 정리.

### 리서치 공통 결론

| 구분 | 3건 공통 | FMS 적용 |
|------|----------|----------|
| **호출** | VK/Telemetry 이후 `GET vehicle_data` **1회** | To-Be 유지 · Snapshot 미생성 |
| **저장 대상** | `vehicle_config` 중심 + VIN/이름/Version | Vehicle + (선택) registry 메타 |
| **제외** | SoC·GPS·Speed·Lock·Climate·TPMS·충전·도어·Sentry | CAF P0/P1 Telemetry SoT |
| **확장** | wheel/roof/charge_port/AP HW 등 **UI 제원** | Tier B 정규 컬럼 + Tier C JSON |
| **Version** | `car_version` — OTA 때만 변함 · 1회 캐시 | Vehicle `firmwareVersion` (V-A) |
| **아키텍처** | ChatGPT: 필수 컬럼 + **`vehicle_config` JSON 보관** 권고 | **채택** — hybrid “정규 컬럼 우선”과 병행 |

### 리서치별 차이 · 본 문서 판단

| 항목 | Gemini | Grok | ChatGPT | **최종 판단** |
|------|--------|------|---------|---------------|
| `odometer` | (미언급) | 일 단위 갱신 가능 | **저장 제외** (Telemetry) | **제외** — CAF `Odometer` 구독 |
| `gui_settings` | (미언급) | (미언급) | 선택 · 낮은 우선순위 | **1차 제외** — UI 단위는 FMS 로케일 |
| `id` / `vehicle_id` | 저장 권고 | 저장 권고 | `vehicleId` 컬럼 | **registry** — `teslaVehicleId` (list/vehicle_data) |
| `access_type` | 저장 | (미언급) | `ownerType` | **registry** — `accessType` (준정적) |
| capability flags | 기능 지원 | (미언급) | Command UI 게이트 | **Tier C JSON** — 1회 캐시 |
| `homelink_device_count` | (미언급) | vehicle_state | (미언급) | **제외** — 운영 가치 낮음 |
| tokens | Grok 언급 | Grok 언급 | (미언급) | **저장 금지** — 보안 |

### Tier 정의 (본 문서 확정안)

```text
Tier A — 정규 Vehicle 컬럼 (UI·필터·CAF REST-1 핵심)
Tier B — 정규 Vehicle 컬럼 (리서치·CAF §5.1 확장 · 상세 제원 UI)
Tier C — Vehicle.vehicleConfigJson (필터된 vehicle_config + capability 키)
Registry — list/fleet_status (vehicle_data와 별도 · 연동 시 1회)
Ignore — Baseline에서 파싱·저장 금지 (Telemetry·동적·보안)
```

---

## 3. As-Is — 현행 최초 REST (코드 기준)

구현: `runBaselineForVehicle` · `confirmVirtualKeyForVehicle` → Baseline  
(`src/lib/tesla/hybrid/rest-sync.ts`, `writeRestSnapshot` + `updateSpecs: true`)

### 3.1 트리거

| 트리거 | 동작 |
|--------|------|
| VK confirm 성공 + `TESLA_BASELINE_ON_READY` | `runBaselineForVehicle` 자동 |
| READY 전 `tryBaselinesForAccount` | 계정 sync 시 Baseline 미완 차량 best-effort |
| 수동 `POST /api/vehicles/[id]/baseline` | 동일 full Baseline |
| `TESLA_REST_FREEZE=true` | 전부 skip (`rest_freeze`) — Phase A |

### 3.2 호출 API (As-Is)

| 순서 | API | 목적 (현행) |
|------|-----|-------------|
| 1 | `listVehicles` | display_name · state · VIN 매칭 |
| 1 | `getFleetStatus` | firmware → `softwareVersion` 후보 |
| 2 | `getVehicleData` | **제원+충전+주행+공조+차체 전부** 매핑 |
| 3 | `getNearbyChargingSites` | Snapshot nearby |
| 3 | `getVehicleServiceData` / service | Snapshot `serviceStatus` |
| 4 | `getRecentAlerts` (best-effort) | `VehicleEvent` ALERT/WARNING 교체 |

### 3.3 Vehicle에 쓰는 필드 (As-Is · `updateSpecs`)

| DB 컬럼 | REST 출처 | 성격 |
|---------|-----------|------|
| `carType` | `vehicle_config.car_type` | 정적 ✅ |
| `trimBadging` | `vehicle_config.trim_badging` | 정적 ✅ |
| `exteriorColor` | `vehicle_config.exterior_color` | 정적 ✅ |
| `teslaDisplayName` | `display_name` / list | 준정적 ✅ |
| `model` | `buildDisplayModel(carType, trim)` | 표시용 파생 ✅ |
| `specsSyncedAt` | 서버 now | 메타 ✅ |
| `plateNumber` · `year` · `oemVehicleId` | VIN / mapper | registry (연동 시에도 있음) |

### 3.4 Snapshot에 쓰는 필드 (As-Is · 문제 핵심)

`mapTeslaVehicleToSnapshot` + nearby/service 결과가 **새 Snapshot 행**으로 들어가며 `telemetrySource=REST`.

| 범주 | 예시 컬럼 | Telemetry 담당 여부 |
|------|-----------|:-------------------:|
| 위치 | latitude, longitude | CAF P0 |
| 배터리·충전 | batteryPercent, rangeKm, chargeLimitSoc, chargerPowerKw, chargingStatus | CAF P0/P1 |
| 주행 | shiftState, ignitionOn, odometerKm, status | CAF P0/P1 |
| 보안·차체 | locked, doors*, windows*, trunks, sentryMode | CAF P0 |
| 공조 | insideTempC, outsideTempC, climateOn | CAF P0 |
| TPMS | tpms* ×4 | CAF P0 |
| SW | `softwareVersion` (`car_version` / firmware) | CAF는 **Version 비구독**(REST-1) |
| 기타 REST | nearbyChargingSites, serviceStatus | Telemetry 밖 · **동적·이벤트성** |
| 메타 | lastRestSyncAt, telemetrySource=REST | — |

CAF P1 전용 컬럼(속도·ETA·상세충전 등)은 REST mapper가 비우므로 `mergeCafSnapshotFields`로 previous 유지 — **그러나 P0급 동적 필드는 REST 값으로 덮임**.

### 3.5 SyncState / Event (As-Is)

| 대상 | 갱신 |
|------|------|
| SyncState | `baselineCompletedAt`, `lifecycle=READY`, `lastRestSyncAt=BASELINE` |
| VehicleEvent | recent_alerts로 ALERT/WARNING 교체 |

### 3.6 As-Is 문제 요약

| 문제 | 영향 |
|------|------|
| Snapshot 동적 전량 write | Telemetry 수신 전·직후 UI가 REST 잔여값/null로 오염 (LN-R 등) |
| nearby · service · alerts 동반 | “제원 1회”와 무관한 부가 REST·쓰기 |
| CAF REST-1과 불일치 | 문서는 CarType/Trim/Color/Version만 연동 REST인데 코드는 full sync |
| Version 위치가 Snapshot | 제원성인데 append Snapshot에만 존재 → 최신 행이 Telemetry면 **유실·덮어쓰기** 위험 |
| hybrid 계약 반쪽 | Vehicle 제원 upsert는 맞지만 Snapshot “동적 1행”이 Telemetry primary와 충돌 |

---

## 4. To-Be — 제원 전용 최초 REST

### 4.1 목표 한 줄

**계정 연동·VK 이후 VIN당 1회:** Tesla에서 정적 제원만 뽑아 `Vehicle`(+SyncState)에 저장하고, **VehicleSnapshot 행을 생성하지 않는다.**

### 4.2 트리거 (유지 · Freeze 졸업)

| 트리거 | To-Be |
|--------|--------|
| VK confirm 후 자동 Baseline | **제원 전용** · **Freeze와 무관(졸업)** |
| `tryBaselinesForAccount` | 동일 whitelist · Snapshot 없음 · Freeze 예외 |
| 수동 Baseline / `SPECS_REFRESH` | 동일 whitelist · Freeze 예외 |
| Wake / fallback 등 | **Freeze 차단 유지** (B2 등 졸업 전까지) |

### 4.3 호출 API (To-Be)

| API | 판정 | 이유 |
|-----|:----:|------|
| `listVehicles` | **유지** | VIN 소속·`display_name`(VehicleName) |
| `getFleetStatus` | **유지** | VK 페어링(confirm과 중복 가능) · firmware를 Version 후보로 사용 가능 |
| `getVehicleData` | **유지 · 쓰기 필터** | `vehicle_config`·`display_name`·`car_version` 추출. charge/drive/climate/**쓰지 않음** |
| `getNearbyChargingSites` | **제거** | 동적·위치 의존 · wake/park(B2) 또는 별도 정책 |
| service status | **제거** | Snapshot·동적 성격 · Telemetry `ServiceMode`와 역할 분리 |
| `getRecentAlerts` | **제거** | Event SoT를 최초 제원 단계에 묶지 않음. 필요 시 별도 Phase |

> Tesla가 “제원 only” 전용 endpoint를 주지 않으므로 **호출은 `vehicle_data`를 유지**해도 된다.  
> **수용 기준은 응답 파싱이 아니라 DB 쓰기 화이트리스트**다.

### 4.4 Vehicle 쓰기 화이트리스트 (To-Be · 확정안)

출처: CAF §5.1 · 리서치 3건 · [vehicle_data.json](./fleet-api/endpoints/vehicle-endpoints/vehicle_data.json).  
**`charge_state` · `climate_state` · `drive_state` 및 `vehicle_state` 동적 키는 전부 Ignore.**

#### Tier A — 정규 컬럼 (필수 · B1 코드)

| # | CAF / Telemetry | REST 경로 | Vehicle 컬럼 | 근거 |
|---|-----------------|-----------|--------------|------|
| A1 | CarType | `vehicle_config.car_type` | `carType` | 3/3 리서치 · UI 헤더 |
| A2 | Trim | `vehicle_config.trim_badging` | `trimBadging` | 3/3 |
| A3 | ExteriorColor | `vehicle_config.exterior_color` | `exteriorColor` | 3/3 |
| A4 | VehicleName | `display_name` / `vehicle_state.vehicle_name` / list | `teslaDisplayName` | 준정적 · SPECS_REFRESH만 |
| A5 | (파생) | A1+A2 → `buildDisplayModel` | `model` | model-mapping 계약 |
| A6 | Version | `vehicle_state.car_version` · fallback `fleet_status.firmware_version` | `firmwareVersion` | REST-1 · §4.5 V-A |
| A7 | VIN | `vin` | `oemVehicleId` | registry 재확인 |
| A8 | 연식 | VIN 추정 | `year` | 기존 mapper |
| A9 | (메타) | — | `specsSyncedAt` | 제원 동기화 시각 |

#### Tier B — 정규 컬럼 (권고 · B1 코드 · 상세 제원 UI)

리서치 3건 + CAF §5.1 “확장 시” 항목 중 **화면 가치가 큰 것**만 컬럼화.

| # | CAF / Telemetry | REST 경로 | Vehicle 컬럼 (신규) | 근거 |
|---|-----------------|-----------|---------------------|------|
| B1 | RoofColor | `vehicle_config.roof_color` | `roofColor` | Gemini/Grok/ChatGPT · 카드 UI |
| B2 | WheelType | `vehicle_config.wheel_type` | `wheelType` | 3/3 · “19\" Apollo” 표기 |
| B3 | ChargePort (타입) | `vehicle_config.charge_port_type` | `chargePortType` | 3/3 · `ChargePortDoorOpen`과 분리 |
| B4 | (AP HW) | `vehicle_config.driver_assist` | `driverAssist` | Gemini/ChatGPT · FMS 기능·표시 |
| B5 | (외장 트림) | `vehicle_config.exterior_trim` | `exteriorTrim` | Grok/ChatGPT · 크롬/블랙 등 |

#### Tier C — `vehicleConfigJson` (권고 · B1 코드)

ChatGPT 권고 채택: Tesla 필드 추가에 **마이그레이션 없이** 대응.  
Baseline 1회 시 아래 키만 **필터링해 JSON** 저장 (`vehicle_config` 서브셋 + capability). **동적 블록은 넣지 않음.**

| JSON 키 (snake_case) | REST 경로 | 비고 |
|----------------------|-----------|------|
| `efficiency_package` | vehicle_config | CAF REST-1 |
| `motorized_charge_port` | vehicle_config | 옵션 |
| `has_air_suspension` | vehicle_config | ChatGPT §3 |
| `has_seat_cooling` | vehicle_config | |
| `has_ludicrous_mode` | vehicle_config | |
| `rear_seat_heaters` | vehicle_config | CAF REST-1 |
| `third_row_seats` | vehicle_config | 7인승 |
| `interior_trim_type` | vehicle_config | ChatGPT §4 |
| `spoiler_type` | vehicle_config | |
| `sun_roof_installed` | vehicle_config | CAF REST-1 |
| `rhd` | vehicle_config | CAF RightHandDrive |
| `eu_vehicle` | vehicle_config | CAF EuropeVehicle |
| `plg` | vehicle_config | 파워 리프트게이트 |
| `pws` | vehicle_config | 보행자 경고 |
| `can_accept_navigation_requests` | vehicle_config | Command/UI 게이트 |
| `can_actuate_trunks` | vehicle_config | |
| `dashcam_clip_save_supported` | vehicle_config | |
| `webcam_supported` | vehicle_config | |
| `webcam_selfie_supported` | vehicle_config | |
| `supports_qr_pairing` | vehicle_config | |
| `performance_package` | vehicle_config | |
| `rear_drive_unit` | vehicle_config | 배터리/구동 추론용 |
| `headlamp_type` | vehicle_config | |
| `exterior_trim_override` | vehicle_config | |
| `paint_color_override` | vehicle_config | wrap 등 |
| `use_range_badging` | vehicle_config | 표시 힌트 |
| `utc_offset` | vehicle_config | ChatGPT §5 · TZ (준정적) |

**Prisma (B1):** `Vehicle.vehicleConfigJson Json?` · `Vehicle.firmwareVersion String?` · Tier B 5컬럼.

#### Registry — list / fleet_status (Baseline과 동시·선행)

`vehicle_data`와 별도로 **계정 연동·Baseline 직전** list에서 1회 확정.

| REST | Vehicle 컬럼 (신규·기존) | 비고 |
|------|-------------------------|------|
| `id_s` / `id` | `teslaVehicleId` | Fleet API 호출용 · Gemini/Grok/ChatGPT |
| `access_type` | `accessType` | OWNER/DRIVER · ChatGPT ownerType |
| `display_name` (list) | `teslaDisplayName` | vehicle_data 없을 때 fallback |

#### Ignore — Baseline 저장 금지 (리서치 “저장 불필요” + CAF Telemetry)

| 블록 / 필드 | 이유 |
|-------------|------|
| `charge_state.*` | SoC·충전 · CAF P0/P1 |
| `climate_state.*` | 온도·HVAC · CAF |
| `drive_state.*` (location, speed, heading, shift) | CAF Location/Gear/Speed/GpsHeading |
| `vehicle_state`: locked, doors, windows, trunks, tpms*, sentry*, odometer, media*, software_update, valet*, service_mode* | 동적 · CAF 또는 B2 |
| `gui_settings.*` | FMS 로케일 · 운영 가치 낮음 |
| `tokens`, `backseat_token*` | **보안** · 저장 금지 |
| `state`, `in_service`, `calendar_enabled` | 실시간 상태 |
| nearby · service · alerts API | §4.3 제거 유지 |

**허용 부가:** `plateNumber` — 기존 VIN 유도 규칙 유지.

### 4.5 Version · OTA 정책 (V-A 확정)

리서치 3건 모두 `car_version`을 **1회 캐시·OTA 시에만 재조회** 대상으로 분류. Grok의 “주 1회”는 **Baseline/SPECS_REFRESH 외 주기 REST를 두지 않음**으로 해석해 **채택하지 않음**.

| 옵션 | 판정 | 비고 |
|------|:----:|------|
| **V-A** | **채택** | `Vehicle.firmwareVersion` |
| V-B | 기각 | Snapshot 1행 필요 → P3 위배 |
| V-C | 기각 | 연동 시점 SW 라벨 공백 |

**갱신:** OTA 완료 후 수동 `SPECS_REFRESH` 또는 (후속) Telemetry `SoftwareUpdateVersion` 안정화 이벤트 — **자동 주기 REST 없음**.

```text
Vehicle.firmwareVersion     ← REST-1 Version (연동 1회 · SPECS_REFRESH)
Snapshot.softwareUpdate*    ← Telemetry OTA (진행)
Snapshot.softwareVersion    ← 레거시 · 신규 Baseline 미기록
```

### 4.6 Snapshot / Event / SyncState (To-Be)

| 대상 | To-Be |
|------|--------|
| **VehicleSnapshot** | **생성하지 않음** (옵션 A). 동적 값은 최초 Telemetry PROCESSED부터 |
| VehicleEvent (alerts) | Baseline 경로에서 **호출·쓰기 제거** |
| SyncState | `baselineCompletedAt` · `lifecycle → READY`(또는 기존 규칙 유지) · `lastRestSyncReason=BASELINE` 또는 신규 `SPECS_REFRESH`와 구분 문서화 |
| Audit | `VEHICLE_BASELINE_SYNC` metadata에 `mode: "specs_only"`, 기록 필드 목록 |

### 4.7 CAF §5.1 · 리서치 대비 — 1차 제외 (Ignore)

아래는 Telemetry available-data 또는 리서치에 있으나 **B1에서 컬럼·JSON whitelist에도 넣지 않음**.

| 항목 | 이유 |
|------|------|
| `OffroadLightbarPresent` | 희귀 · 요구 발생 시 Tier C 추가 |
| `ChargePort` (문 상태) | CAF `ChargePortDoorOpen` · 동적 |
| `homelink_device_count` | 운영·UI 가치 낮음 |
| `api_version` (root/state) | Fleet 클라이언트 호환용 · FMS 제원 아님 |
| `badge_version`, `key_version`, `car_special_type` | 내부/마케팅 · UI 미사용 |
| `ece_restrictions`, `cop_user_set_temp_supported` | 지역 규제 플래그 · 1차 불필요 |

CAF §5.1 “확장 시” 중 **Tier B/C로 흡수한 항목:** RoofColor, WheelType, ChargePort type, RearSeatHeaters, EuropeVehicle, RightHandDrive, SunroofInstalled — **ignore 아님**.

---

## 5. As-Is vs To-Be 비교표

### 5.1 API · 사이드이펙트

| 항목 | As-Is | To-Be | 변경 이유 |
|------|-------|-------|-----------|
| `vehicle_data` | 전 필드 → Vehicle+Snapshot | 호출 유지 · **제원 whitelist만 write** | 응답 혼합 → 쓰기 경계로 분리 |
| nearby | 호출·Snapshot | **제거** | 제원 아님 · Telemetry 검증·위치 SoT와 충돌 |
| service | 호출·Snapshot | **제거** | 동적/정비 상태 · `ServiceMode` Telemetry와 계층 분리 |
| alerts | Event 교체 | **제거** | 온보딩 제원과 무관 · 실패해도 Baseline 성공하던 불명확성 제거 |
| wake_up | 금지 | 금지 유지 | 절전 차량 깨우기 방지 |
| Snapshot 행 | REST 전량 append | **미생성** | Telemetry SoT · LN/CAF 오염 차단 |
| Vehicle 제원 | 갱신 | 갱신 (동일+Version 정책) | 핵심 목적 유지 |
| `baselineCompletedAt` | 설정 | 설정 유지 | 온보딩 완료 마커 |

### 5.2 필드별 — 유지 / 이동 / 제거

#### Vehicle (유지·강화 — Tier A/B)

| 필드 | As-Is | To-Be | Tier |
|------|:-----:|:-----:|:----:|
| carType · trimBadging · exteriorColor | ✅ | ✅ | A |
| teslaDisplayName · model · specsSyncedAt | ✅ | ✅ | A |
| firmwareVersion | ❌ | ✅ | A |
| wheelType · roofColor · chargePortType | ❌ | ✅ | B |
| driverAssist · exteriorTrim | ❌ | ✅ | B |
| vehicleConfigJson | ❌ | ✅ | C |
| teslaVehicleId · accessType | ❌ | ✅ | Registry |
| year · oemVehicleId | ✅ | ✅ | A |

#### Snapshot (Baseline 경로에서 제거)

| 필드 그룹 | As-Is Baseline | To-Be Baseline | 이후 SoT |
|-----------|:--------------:|:--------------:|----------|
| Location / Soc / Gear / Lock / TPMS / Climate / Charge… | REST write | **쓰지 않음** | Telemetry CAF P0/P1 |
| nearby / serviceStatus | REST write | **쓰지 않음** | B2 또는 별도 |
| softwareVersion | REST write | **Vehicle로 이동(V-A)** | OTA는 SoftwareUpdate* |
| CAF P1 전용 | previous 유지 | 해당 없음(행 없음) | Telemetry |

#### 제거하는 이유 (동적 쪽)

| 제거 대상 | 이유 |
|-----------|------|
| SoC·위치·변속·잠금·TPMS·공조·충전 상태 | **초~분 단위 변동** · CAF 구독 대상 · REST 1회 값이 곧 거짓이 됨 |
| nearby | 위치·시각 의존 · “제원” 아님 |
| serviceStatus | 정비/서비스 상태는 준동적이며 Snapshot REST 오염원이 됨 |
| alerts Event 동기화 | 제원 Baseline 성공 조건과 독립이어야 함 |

#### 유지·추가하는 이유 (정적 쪽)

| 유지/추가 | 이유 |
|-----------|------|
| CarType · Trim · ExteriorColor | 3/3 리서치 P0 · CAF REST-1 · Telemetry 비구독 |
| wheelType · roofColor | 카드 UI “Model Y · Midnight Silver · 19\" Apollo” (ChatGPT §2) |
| chargePortType · driverAssist | 충전 규격·AP HW — Fleet 운영·기능 표시 (Gemini/ChatGPT §3) |
| vehicleConfigJson | Tesla 신규 옵션 대응 · 마이그레이션 최소 (ChatGPT §추천 구조) |
| Version → firmwareVersion | 연동 SW 라벨 · OTA는 SoftwareUpdate* (Grok “OTA 후만 재조회” = SPECS_REFRESH) |
| teslaVehicleId | Fleet API path용 · list 1회 (Grok/Gemini) |
| Ignore: odometer | Grok “일 단위” 제안 **기각** — CAF Odometer Telemetry SoT |

### 5.3 온보딩 데이터 흐름 비교

```text
As-Is:
  OAuth → VK → Baseline(vehicle_data+nearby+service+alerts)
           ├─ Vehicle 제원 ✅
           └─ Snapshot(REST 동적) ✅  ← Telemetry와 경쟁

To-Be:
  OAuth → VK → Specs Baseline(vehicle_data → Tier A/B/C + Registry)
           ├─ Vehicle 제원 (+ firmwareVersion, wheel, roof, JSON) ✅
           └─ Snapshot ❌
       → Telemetry webhook → Snapshot(TELEMETRY) ✅ 유일한 동적 SoT
```

### 5.4 리서치 → Tier 매핑 요약

| 리서치 분류 | 대표 필드 | 본 문서 Tier |
|-------------|-----------|:------------:|
| Gemini §1 식별 | vin, id, access_type | Registry |
| Gemini/ChatGPT §2 외관 | car_type, color, wheel, roof, trim | A / B |
| ChatGPT §3 HW | driver_assist, charge_port, air suspension | B / C |
| ChatGPT §4 옵션 | third_row, seat heaters, interior_trim | C |
| ChatGPT §5 지역 | rhd, eu_vehicle, utc_offset | C |
| ChatGPT §6 capability | trunk/nav/dashcam/webcam/QR | C |
| ChatGPT §7 SW | car_version | A (`firmwareVersion`) |
| ChatGPT §8 GUI | gui_* | Ignore |
| ChatGPT §“저장 불필” | Soc, GPS, Lock, TPMS… | Ignore |

---

## 6. 코드 구현 계약 (완료)

| 모듈 | 상태 |
|------|:----:|
| `extractVehicleSpecs` / `writeVehicleSpecs` · `vehicle-specs.ts` | ✅ |
| `runBaselineForVehicle` — nearby/service/alerts 제거 · Snapshot 미생성 | ✅ |
| Prisma migrate `20260715140000_trf_b1_vehicle_specs` | ✅ |
| DTO · 상세 UI 제원 (wheel/roof/port/AP/SW) | ✅ |
| registry `teslaVehicleId` · `accessType` | ✅ |
| `npm run trf-b1:verify` | ✅ |
| Freeze | **졸업** — `TESLA_REST_FREEZE`와 무관 · Wake 등은 차단 유지 |

---

## 7. 수용 기준

### 7.1 문서 · 필드 확정

- [x] §2.1 리서치 종합 · Tier A/B/C/Registry/Ignore
- [x] §4.4 Tier A/B/C · Version V-A
- [x] Snapshot 미생성 · nearby/service/alerts 제거
- [x] `vehicleConfigJson` whitelist · tokens 금지
- [x] TRF-B2(Wake)는 별도

### 7.2 코드 완료 후 (실차 · VIN 예: `LRWYGCFJ7SC214742`)

> Freeze ON 유지 · VK 후 Baseline(졸업) 실행 시

- [ ] Tier A: `carType` · `trimBadging` · `exteriorColor` · `firmwareVersion` non-null
- [ ] Tier B: `wheelType` · `roofColor` · `chargePortType` (존재 시)
- [ ] Tier C: `vehicleConfigJson` 최소 1키
- [ ] Registry: `teslaVehicleId`
- [ ] Baseline 직후 **신규 Snapshot 없음**
- [ ] Audit `mode: specs_only`
- [ ] Telemetry Ingress → Snapshot만 증가 · 제원 불변
- [ ] CAF fields에 CarType/Trim/ExteriorColor/Version **없음**

---

## 8. 리스크 · 개방 이슈

| 항목 | 내용 | 완화 |
|------|------|------|
| 제원 REST 전 Snapshots 공백 | 목록/상세 동적 필드 공백 시간 | UI “Telemetry 대기” · TRF-4 후 Telemetry 확인 |
| 절전 차량 `vehicle_data` 실패 | 제원 미채움 | 현행처럼 wake 금지 · 수동 재시도 · 오류 SyncState |
| display_name만 바뀐 경우 | 준정적 | `SPECS_REFRESH` 수동만 |
| V-A 마이그레이션 | 배포 순서 | Freeze 해제와 같은 릴리스에 스키마+코드 |
| hybrid 문서 §5 “Snapshot 동적 1행” | 구계약 | 본 문서 승인 시 hybrid §5 Baseline 행을 **제원만**으로 정정 |

---

## 9. 요구사항 ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **TRF-B1-1** | 본 문서 — As-Is/To-Be · Tier · 리서치 | ✅ |
| **TRF-B1-2** | 필드 확정 (§7.1) | ✅ |
| **TRF-B1-3** | 코드: specs-only Baseline · Snapshot 미생성 · V-A 스키마 | ✅ |
| **TRF-B1-4** | 실차 수용 (§7.2) | ☐ |

상위 추적: TRF-5 = B1 표 확정(본 문서 승인으로 ✅), TRF-7에 코드 포함.

---

## 10. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-15 | 초안 — 온보딩 최초 REST 제원 전용 To-Be · As-Is 전량 Snapshot 대비 · CAF REST-1 정렬 · Version V-A 권고 |
| 2026-07-15 | Fleet API 리서치 3건 반영 — Tier A/B/C · vehicleConfigJson · Tier B 컬럼 · Ignore 명시 |
| 2026-07-15 | TRF-B1-3 코드 — `writeVehicleSpecs` · migrate · `trf-b1:verify` · UI |
| 2026-07-15 | Freeze 졸업 — Baseline이 `TESLA_REST_FREEZE`와 무관하게 항상 실행 |
