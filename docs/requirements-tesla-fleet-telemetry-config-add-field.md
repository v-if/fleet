# Telemetry Config 필드 확장 — FMS 관제용 구독 정의 (CAF)

| 항목 | 내용 |
|------|------|
| 목적 | 대시보드·차량 상세에서 **실시간으로 보여줄 가치**가 있는 Telemetry 필드를 확정하고, **제원성(정적) 데이터는 REST 1회**로 분리한다 |
| 근거 | research Grok / Gemini / ChatGPT 취합 + available-data.csv 검증 + FMS 현행 UI·하이브리드 수집 |
| 관련 | [requirements-tesla-fleet-telemetry-config.md](./requirements-tesla-fleet-telemetry-config.md) (현행 create), [checklist-tesla-fleet-telemetry-config-add-field.md](./checklist-tesla-fleet-telemetry-config-add-field.md), [fleet-api/fleet-telemetry/available-data.csv](./fleet-api/fleet-telemetry/available-data.csv), [requirements-tesla-fleet-api-telemetry-webhook.md](./requirements-tesla-fleet-api-telemetry-webhook.md), [requirements-tesla-telemetry-rest-freeze.md](./requirements-tesla-telemetry-rest-freeze.md) (검증 REST Freeze), [research/](./research/) |
| 상태 | **CAF-2~4 코드 ✅ · CAF-6 실차 ☐** |
| 작성일 | 2026-07-15 |
| ID prefix | **CAF** (Config Add Field) |

---

## 1. 조사 취합 요약

| 출처 | 강조 | FMS에 맞는 점 | 과다·주의 |
|------|------|---------------|-----------|
| **Grok** | 대시보드 KPI + 상세 섹션(충전·배터리건강·ADAS·목적지) | Location/Soc/Speed/TPMS/Charge 우선순위 명확 | PackVoltage·크루즈·ADAS·미디어까지 넓음 → MVP 과다 |
| **Gemini** | 대시보드=이상 징후, 상세=충전·내비·도어 | GpsHeading·TimeToFullCharge·Destination·좌석 벨트 실무성 | Pedal/Brake는 관제보다 텔레매틱스 분석용 |
| **ChatGPT** | 관리 우선순위 1~4단 · AI Summary UX | Locked/Sentry/Valet/Service·충전 카드 구성이 현 FMS UI와 가깝음 | `BatteryLevel`·`GpsState`·`RouteLastUpdated` 등은 Soc/Location과 중복 또는 **CSV상 broken** |

### 1.1 3자 공통 (강한 합의)

`Location`, `Soc`, `Gear`, `VehicleSpeed`, `ChargeState`(또는 Detailed), `EstBatteryRange`, `Locked`, `SentryMode`, TPMS 4륜, `Odometer`, `InsideTemp`/`OutsideTemp`, `HvacPower`, 충전 출력(`AC`/`DC`), `ChargeLimitSoc`, `TimeToFullCharge`, `DoorState`, 창문 4개

### 1.2 본 문서(작성자) 의견 — 선정 원칙

1. **법인 관리자 행동**에 직결되는 것만 Telemetry 구독 (위치·잔량·충전·잠금·타이어·운행 여부).  
2. **이미 Snapshot/UI가 있는 필드**는 유지·보강 우선.  
3. available-data.csv에 **존재·정상**인 키만 (깨진 필드·잘못된 별칭 배제).  
4. 구독 수↑ = 차량 대역·비용·노이즈↑ → **P0/P1만 create 기본**, P2는 이후.  
5. **거의 안 바뀌는 제원**은 Telemetry에 넣지 않고 **계정 연동·VK/Baseline REST 1회** (§5).  
6. SoC는 **`Soc`(usable)** 만. `BatteryLevel` 이중 구독 금지.  
7. 변속은 **`Gear`만** (`ShiftState` config명 아님).

---

## 2. 필드명 정정 (조사 → CSV 확정)

| 조사에서 나온 표기 | 판정 | Telemetry 키 |
|--------------------|------|--------------|
| BatteryLevel | Soc와 역할 중복 · usable은 Soc | **`Soc`만** |
| GpsState | CSV 존재 · “online”과 다름(GPS lock) | P2 선택 · 연결성은 `lastTelemetryAt`/절전 추론으로 충분 |
| RouteLastUpdated | CSV: **broken, no data** | **구독 금지** |
| HvacFanSpeed / HvacFanStatus | 둘 다 존재 | 상세팬은 P2 · MVP는 `HvacPower` |
| ShiftState | config 키 아님 | **`Gear`** |
| Version | 제원성에 가깝고 OTA 시에만 변화 | **REST 1회** 기본 · OTA 진행은 `SoftwareUpdate*` (P1) |

---

## 3. 최종 Telemetry Config 정의

### 3.1 우선순위

| Tier | 의미 | create 기본 포함 |
|------|------|:----------------:|
| **P0** | 대시보드·상세 **필수** · 현행 구독 유지·정리 | ✅ |
| **P1** | 관리 가치 높음 · **추가 구독 권고** (이번 확장 범위) | ✅ 권고 |
| **P2** | 있으면 좋음 · 분석/고급 · **보류** | ☐ 기본 제외 |
| **REST-1** | Telemetry 비구독 · 연동/VK 시 REST 1회 | — |

### 3.2 P0 — 필수 (유지)

현행 FMS UI·Snapshot SoT. interval은 현행 create 관례.

| Field | interval_s | 화면 | 비고 |
|-------|----------:|------|------|
| `Location` | 60 | 지도·목록 | |
| `Soc` | 60 | KPI·상세 배터리 | usable % |
| `Gear` | 60 | 주차/주행 | |
| `ChargeState` | 60 | 충전 배지 | |
| `EstBatteryRange` | 120 | 주행가능거리 | |
| `Locked` | 60 | 보안 타일 | |
| `SentryMode` | 60 | 감시모드 | |
| `Odometer` | 60 | 주행누적 | |
| `InsideTemp` | 60 | 공조 | |
| `OutsideTemp` | 60 | 공조 | |
| `HvacPower` | 60 | 공조 ON | |
| `DoorState` | 60 | 도어·트렁크 | |
| `FdWindow` / `FpWindow` / `RdWindow` / `RpWindow` | 60 | 창문 | |
| `TpmsPressureFl` / `Fr` / `Rl` / `Rr` | 300 | TPMS | |
| `ChargeLimitSoc` | 120 | 충전 한도 | |
| `ACChargingPower` | 60 | 완속 kW | |
| `DCChargingPower` | 60 | 급속 kW | |

**P0 개수: 23** (창문4·TPMS4 포함).  
※ 현행 `Version`(600s)은 P0에서 **제외 → REST-1** (§5). OTA는 P1 `SoftwareUpdate*`.

### 3.3 P1 — 이번 확장 권고 (추가)

3사 합의 + 관리자 행동성이 큰 항목.

| Field | interval_s | 화면 | 선정 이유 |
|-------|----------:|------|-----------|
| `VehicleSpeed` | 30 | 대시보드·상세 주행 | 가동/과속 · 3사 공통 ★ |
| `GpsHeading` | 60 | 지도 마커 회전 | Grok·Gemini |
| `DetailedChargeState` | 60 | 충전 상세 | ChargeState 보완 (FW 2024.38+) |
| `TimeToFullCharge` | 60 | 충전 카드 | 배차·스케줄 · 3사 공통 |
| `ChargeAmps` | 60 | 충전 상세 | ChatGPT·Grok |
| `ChargePortDoorOpen` | 60 | 충전·차체 | ChatGPT·Grok |
| `ChargePortLatch` | 120 | 충전 연결 상태 | Grok |
| `FastChargerPresent` | 120 | 급속 여부 | Grok |
| `TpmsHardWarnings` | 60 | 대시보드 경고 | 3사 공통 · 푸시 후보 |
| `TpmsSoftWarnings` | 120 | TPMS 주의 | ChatGPT·Grok |
| `DestinationName` | 60 | 상세 경로 | Gemini·Grok |
| `DestinationLocation` | 60 | 지도 목적지 | Gemini |
| `MinutesToArrival` | 60 | 도착 ETA | Gemini·Grok |
| `MilesToArrival` | 120 | 잔여 거리 | Grok |
| `ExpectedEnergyPercentAtTripArrival` | 120 | 도착 시 SoC 예측 | Gemini |
| `PreconditioningEnabled` | 120 | 공조·에너지 | Gemini·Grok |
| `ValetModeEnabled` | 120 | 보안 | ChatGPT |
| `ServiceMode` | 120 | 정비/서비스 | ChatGPT |
| `SoftwareUpdateDownloadPercentComplete` | 300 | OTA 진행 | ChatGPT (Version 대체 축) |
| `SoftwareUpdateInstallationPercentComplete` | 300 | OTA 설치 | ChatGPT |
| `SoftwareUpdateVersion` | 600 | 대기 중 업데이트 버전 | ChatGPT |

**P1 개수: 21**  
**권고 create 합계 (P0+P1): 44 fields**

### 3.4 P2 — 보류 (기본 config 제외)

| Field | 이유 |
|-------|------|
| `PackVoltage` / `PackCurrent` / `BatteryHeaterOn` / `BMSState` / `EnergyRemaining` / `IsolationResistance` | 배터리 전문가·분석용 · 화면 과밀 |
| `PedalPosition` / `BrakePedal` / `LateralAcceleration` / `LongitudinalAcceleration` | 난폭운전 AI · 관제 MVP 비필수 |
| `DriverSeatOccupied` / `DriverSeatBelt` | 안전 정책 도입 시 | 
| `RatedRange` | Est와 중복 · Est 유지 |
| `ChargeRateMilePerHour` / `ChargerVoltage` | 노이즈·중복 (Voltage는 CSV상 변동 심함) |
| `ScheduledChargingMode` / `ScheduledChargingPending` | 충전 스케줄 UI 이후 |
| `FastChargerType` | Present만으로 MVP 충분 |
| `RouteTrafficMinutesDelay` | 내비 고도화 시 |
| `CabinOverheatProtectionMode` | 계절 운영 고도화 시 |
| `HvacFanStatus` / `HvacFanSpeed` / `HvacAutoMode` | HvacPower로 MVP 충분 |
| `GpsState` | 연결성≠GPS lock · 절전 추론으로 충분 |
| 크루즈·충돌경고·좌석히터·미디어·Powershare 등 | Grok 확장분 · 데모 범위 밖 |

### 3.5 구독 금지

| Field | 이유 |
|-------|------|
| `RouteLastUpdated` | CSV: **broken** |
| `BatteryLevel` | `Soc`와 이중 |
| `CarType` / `ExteriorColor` / `Trim` / … | §5 REST-1 |
| (미존재) `ShiftState` as config key | `Gear` 사용 |

---

## 4. 권고 `fields` 객체 (P0+P1 · create용)

구현 시 `DEFAULT_TELEMETRY_FIELDS`를 아래로 교체(또는 P1만 append)한다.  
`prefer_typed: true` 유지.

```json
{
  "Location": { "interval_seconds": 60 },
  "GpsHeading": { "interval_seconds": 60 },
  "Soc": { "interval_seconds": 60 },
  "EstBatteryRange": { "interval_seconds": 120 },
  "Gear": { "interval_seconds": 60 },
  "VehicleSpeed": { "interval_seconds": 30 },
  "ChargeState": { "interval_seconds": 60 },
  "DetailedChargeState": { "interval_seconds": 60 },
  "TimeToFullCharge": { "interval_seconds": 60 },
  "ChargeLimitSoc": { "interval_seconds": 120 },
  "ACChargingPower": { "interval_seconds": 60 },
  "DCChargingPower": { "interval_seconds": 60 },
  "ChargeAmps": { "interval_seconds": 60 },
  "ChargePortDoorOpen": { "interval_seconds": 60 },
  "ChargePortLatch": { "interval_seconds": 120 },
  "FastChargerPresent": { "interval_seconds": 120 },
  "Locked": { "interval_seconds": 60 },
  "SentryMode": { "interval_seconds": 60 },
  "ValetModeEnabled": { "interval_seconds": 120 },
  "ServiceMode": { "interval_seconds": 120 },
  "Odometer": { "interval_seconds": 60 },
  "InsideTemp": { "interval_seconds": 60 },
  "OutsideTemp": { "interval_seconds": 60 },
  "HvacPower": { "interval_seconds": 60 },
  "PreconditioningEnabled": { "interval_seconds": 120 },
  "DoorState": { "interval_seconds": 60 },
  "FdWindow": { "interval_seconds": 60 },
  "FpWindow": { "interval_seconds": 60 },
  "RdWindow": { "interval_seconds": 60 },
  "RpWindow": { "interval_seconds": 60 },
  "TpmsPressureFl": { "interval_seconds": 300 },
  "TpmsPressureFr": { "interval_seconds": 300 },
  "TpmsPressureRl": { "interval_seconds": 300 },
  "TpmsPressureRr": { "interval_seconds": 300 },
  "TpmsHardWarnings": { "interval_seconds": 60 },
  "TpmsSoftWarnings": { "interval_seconds": 120 },
  "DestinationName": { "interval_seconds": 60 },
  "DestinationLocation": { "interval_seconds": 60 },
  "MinutesToArrival": { "interval_seconds": 60 },
  "MilesToArrival": { "interval_seconds": 120 },
  "ExpectedEnergyPercentAtTripArrival": { "interval_seconds": 120 },
  "SoftwareUpdateDownloadPercentComplete": { "interval_seconds": 300 },
  "SoftwareUpdateInstallationPercentComplete": { "interval_seconds": 300 },
  "SoftwareUpdateVersion": { "interval_seconds": 600 }
}
```

### 4.1 현행(24) → To-Be(44) 델타

| 변경 | Fields |
|------|--------|
| **유지** | Location, Soc, ChargeState, Gear, Locked, Odometer, InsideTemp, OutsideTemp, SentryMode, EstBatteryRange, DoorState, Fd/Fp/Rd/RpWindow, Tpms×4, ChargeLimitSoc, AC/DCChargingPower, HvacPower |
| **제거(구독)** | `Version` → REST-1 |
| **추가 P1** | VehicleSpeed, GpsHeading, DetailedChargeState, TimeToFullCharge, ChargeAmps, ChargePortDoorOpen, ChargePortLatch, FastChargerPresent, TpmsHard/SoftWarnings, DestinationName/Location, Minutes/MilesToArrival, ExpectedEnergyPercentAtTripArrival, PreconditioningEnabled, ValetModeEnabled, ServiceMode, SoftwareUpdate×3 |

구현 SoT: `src/lib/tesla/telemetry/default-fields.ts` · `npm run caf:verify`

---

## 5. REST 1회 — 정적·제원 (Telemetry 제외)

**대상 시점:** Tesla 계정 연동, Virtual Key 확인, Baseline `vehicle_data` 1회 (기존 Phase 4.4 `updateSpecs` 경로와 정렬).

목적: 스트림 낭비 없이 `Vehicle` 제원 컬럼·표시명 채움. 이후 Telemetry/주기 REST로 **덮지 않음**(스펙 리프레시 수동 제외).

### 5.1 Telemetry available-data 중 Vehicle Configuration → REST-1

| Telemetry 필드명 (참고) | REST/Vehicle 매핑 (현행·예정) | 비고 |
|-------------------------|-------------------------------|------|
| `CarType` | `vehicle_config.car_type` → `Vehicle.carType` | 모델 (Model Y 등) |
| `Trim` | `trim_badging` → `Vehicle.trimBadging` | |
| `ExteriorColor` | `exterior_color` → `Vehicle.exteriorColor` | |
| `RoofColor` | (확장 시) | |
| `WheelType` | (확장 시) | |
| `EfficiencyPackage` | (확장 시) | |
| `EuropeVehicle` | (확장 시) | |
| `RightHandDrive` | (확장 시) | |
| `SunroofInstalled` | (확장 시) | |
| `RearSeatHeaters` | (확장 시) | |
| `ChargePort` (포트 **타입**) | charge_port_type | **문 열림** `ChargePortDoorOpen`과 다름 |
| `VehicleName` | `teslaDisplayName` | 닉네임 — 목록 API에서도 가능 |
| `Version` | `car_version` / Snapshot `softwareVersion` | **연동 시점 SW** · OTA 중에는 P1 SoftwareUpdate* |
| `OffroadLightbarPresent` | 필요 시 | |

### 5.2 REST 전용(Telemetry 목록 밖) — 연동 1회에 같이 받기 좋은 항목

| 항목 | 출처 | 저장 |
|------|------|------|
| VIN / `oemVehicleId` | vehicles list · vehicle_data | Vehicle |
| 연식( VIN 추정 또는 API) | 현행 mapper | Vehicle.year |
| fleet_status / VK pairing | fleet_status | SyncState |
| 인근충전소 메타 | nearby_charging_sites | Snapshot (동적·쿨다운 REST와 역할 분리) |
| service_status | service API | Snapshot |

※ 인근충전소·서비스는 **실시간 Telemetry 필드가 아님** — wake/park REST 정책 유지.

### 5.3 REST-1에 넣지 말 것

동적 운행·충전·위치·잠금·TPMS 등은 §3 Telemetry.  
Baseline에서 받아 Snapshot에 넣더라도, **이후 SoT는 Telemetry**(하이브리드 문서).

---

## 6. 화면별 매핑 (요약)

| 화면 | 주로 쓰는 Tier | 대표 필드 |
|------|----------------|-----------|
| 대시보드·지도 | P0 + Speed/Heading/TPMS Hard | Location, GpsHeading, Soc, Gear, VehicleSpeed, ChargeState, TpmsHardWarnings |
| 상세 상단·퀵타일 | P0 | Locked, Sentry, Hvac, Gear, temps, Soc |
| 충전 카드 | P0+P1 | ChargeState, DetailedChargeState, AC/DC kW, TimeToFullCharge, ChargeLimitSoc, ChargePort* |
| 타이어·차체 | P0+P1 | TPMS×4, Hard/SoftWarnings, DoorState, Windows |
| 위치·경로 | P0+P1 | Location, Destination*, Minutes/MilesToArrival, ExpectedEnergy… |
| OTA | P1 | SoftwareUpdate* |
| 제원 헤더 (Model Y · 색) | **REST-1** | carType, color, trim |

---

## 7. 구현 Phase (요구 ID)

| ID | 요구 | 상태 |
|----|------|:----:|
| **CAF-1** | 본 문서 — P0/P1/P2·REST-1 필드 정의 | ✅ |
| **CAF-2** | `DEFAULT_TELEMETRY_FIELDS` ← §4 (P0+P1) · `Version` 제거 | ✅ |
| **CAF-3** | mapper · Snapshot 컬럼 — P1 신규 키 파싱/저장 | ✅ |
| **CAF-4** | UI — Speed/Heading/ETA/충전 보강·경고 (범위 협의) | ✅ |
| **CAF-5** | REST-1 제원 목록 §5를 Baseline/연동 체크리스트에 명시 | ✅ 문서 |
| **CAF-6** | 실차 DELETE+재구독 후 GET config = §4 · Ingress 샘플 | ☐ |

체크리스트: [checklist-tesla-fleet-telemetry-config-add-field.md](./checklist-tesla-fleet-telemetry-config-add-field.md)

의존: [requirements-tesla-fleet-telemetry-config.md](./requirements-tesla-fleet-telemetry-config.md) §7 절차(재구독 필수).

---

## 8. 수용 기준

- [x] create `fields`가 §4와 동일 (`caf:verify` · 44키)
- [x] `Version`·CarType·ExteriorColor·Trim 등이 **Telemetry fields에 없음**
- [x] P1 신규 중 MVP UI 키 = mapper+Snapshot+화면 (충전·속도·목적지·TPMS Hard·OTA)
- [x] `RouteLastUpdated`·`BatteryLevel` 미구독
- [ ] 연동/Baseline REST로 제원 저장 · 실차 재구독 후 GET ⊇ §4 (CAF-6)

---

## 9. 리스크

| 항목 | 내용 |
|------|------|
| 필드 수 43 | 대역·비용↑ — 필요 시 **P0만 운영 config**, P1은 플래그/2단 create |
| DetailedChargeState | 구 FW 미지원 → ChargeState fallback 유지 |
| Destination* | 내비 미설정 시 Invalid — UI empty 처리 |
| alreadyConfigured | 코드만 바꾸고 재구독 안 하면 실차에 미반영 |
| ChargerVoltage 미채택 | 충전 전압 UI는 이후 minimum_delta와 함께 P2 |

---

## 10. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-15 | Grok·Gemini·ChatGPT 취합 · CSV 검증 · P0/P1/P2·REST-1 확정 · §4 create 초안 |
| 2026-07-15 | 체크리스트·hybrid/setup/개발 체크리스트 연결 · CAF-5 문서 완료 |
| 2026-07-15 | **CAF-2~4 구현** · 44 fields · migrate · UI · caf:verify |
