# 실차 표시 데이터 버그 수정 요구사항 (2026-07-12)

## 1. 문서 개요

| 항목 | 내용 |
|------|------|
| 목적 | 실차 운행 중 FMS 차량 상세에 나타난 **도어/트렁크 고착·인근 충전소 고착** 이슈의 원인·해결 범위를 확정한다 |
| 근거 | 현장 검증 메모 [requirements-tesla-api-bug-report-0712.md](./requirements-tesla-api-bug-report-0712.md), 하이브리드 수집([requirements-tesla-fleet-api-telemetry-webhook.md](./requirements-tesla-fleet-api-telemetry-webhook.md)), VD-3 상세 UI |
| 검증 VIN | `LRWYGCFJ7SC214742` |
| 작성일 | 2026-07-12 |
| 상태 | **코드 완료** (2026-07-12) — 실차 수동 검수·Telemetry 재구독 잔여 |
| 체크리스트 | [checklist-tesla-api-bugfix-0712.md](./checklist-tesla-api-bugfix-0712.md) |

### 1.1 현장 시나리오 (재현)

1. 차량이 주차(ASLEEP) 상태에서 운전자 도착
2. 도어·트렁크 개방 후 모두 닫고 출발
3. **이동 중** 차량 상세에 다음이 계속 표시됨
   - 문(종합) 개방
   - 좌측 후 개방
   - 트렁크 개방
4. 인근 충전소도 **출발지 기준** 목록이 그대로 유지됨

Telemetry(위치·배터리 등)는 실시간으로 갱신되는 것으로 관찰됨.

### 1.2 관련 코드 (As-Is, 참고)

| 경로 | 역할 |
|------|------|
| `src/lib/tesla/telemetry/mapper.ts` | Telemetry `DoorState` → `doorsOpen` (현재 `readBoolean`) |
| `src/lib/tesla/telemetry/processor.ts` | `mergeSnapshotFields` — 누락 필드는 이전 Snapshot 보존 |
| `src/lib/tesla/hybrid/rest-sync.ts` | wake 쿨다운 후 `vehicle_data` 1회 + `nearby_charging_sites` |
| `src/lib/tesla/mapper.ts` | REST `df/dr/pf/pr/ft/rt` → 문·트렁크 컬럼 |
| `src/lib/tesla/telemetry/client.ts` | 구독 필드에 `DoorState` 포함 (interval 60s) |

---

## 2. 이슈 정리

현장 메모의 현상은 **서로 맞물린 3개 이슈**로 나눈다.

| ID | 이슈 | 화면 증상 | 심각도 |
|----|------|-----------|:------:|
| **BF-1** | 도어·트렁크 상태가 주행 중에도 개방으로 고착 | 문(종합)·개별 문·트렁크 경고 | P0 |
| **BF-2** | wake 직후 REST 스냅샷이 “문 연 순간”을 고정 | BF-1의 **초기 오염원** | P1 |
| **BF-3** | 인근 충전소가 출발지 스냅샷으로 고착 | 이동 중에도 출발지 충전소 표시 | P1 |

---

## 3. 원인 분석 — 현장 가설 vs 코드 대조

### 3.1 BF-1 (도어/트렁크 고착)

#### 현장 가설 (동의하는 부분)

- wake 시 REST `vehicle_data` **1회**로 받은 개방 상태가, 이후 화면의 “진실”처럼 남는다는 관찰은 맞다.
- Telemetry는 들어오는데 **도어 계열이 DB에 반영되지 않는** 쪽을 의심한 것도 맞다.

#### 보완·정정 (코드 기준 더 정확한 원인)

“REST 1회 정책”만의 문제가 아니다. **Telemetry가 도어를 덮어쓰지 못하는 구조**가 핵심이다.

1. **`DoorState` 타입 불일치**  
   Tesla Fleet Telemetry `DoorState`는 boolean이 아니다.
   - 문서/실측 형태: 열린 문을 나열한 **string** (예: `DriverFront|PassengerRear`) 또는 protobuf `Doors` 객체 (`DriverFront`, `TrunkFront`, `TrunkRear` 등)
   - As-Is: `readBoolean(DoorState)` → string/object면 **`undefined`**
2. **merge 보존 규칙**  
   `mergeSnapshotFields`는 `current.doorsOpen ?? previous.doorsOpen`  
   → Telemetry가 `undefined`를 주면 **wake REST의 `true`가 영구 보존**
3. **개별 문·트렁크는 Telemetry 경로에서 아예 미갱신**  
   `doorDfOpen` / `doorDrOpen` / … / `frontTrunkOpen` / `rearTrunkOpen`은 merge 시 **항상 `previous`만 복사**  
   → 설령 `doorsOpen` 종합만 고쳐도 **상세 타일(좌측 후·트렁크)은 계속 개방**으로 남을 수 있음

정리: 현장의 “필드명 매핑 방치” 가설은 **방향이 맞고**, 실제로는 **(a) 파서 타입 오류 + (b) per-door/trunk merge 미구현**이 동시에 있다.

#### 3.1.1 Telemetry 전수 조사 (2026-07-12) — 동일 패턴이 다른 필드에도 있는지

BF-1의 (a)(b)가 **도어 전용인지** 확인하기 위해, 아래 3축을 대조했다.

| 축 | 근거 |
|----|------|
| 구독 | `DEFAULT_TELEMETRY_FIELDS` (`src/lib/tesla/telemetry/client.ts`), `prefer_typed: true` |
| 파서 | `parseTelemetryMessage` + `readNumber` / `readBoolean` / `readString` / `readLocation` (`mapper.ts`) · `TelemetryFieldValue` 타입 (`types.ts`) |
| merge | `mergeSnapshotFields` (`processor.ts`) vs `VehicleSnapshot` 컬럼 |
| 공식 필드 | [Fleet Telemetry Available Data](https://developer.tesla.com/docs/fleet-api/fleet-telemetry/available-data) · fleet-telemetry `Value` oneof (proto) |

**판정 범례**

| 코드 | 의미 |
|------|------|
| OK | 구독·파서·merge가 Snapshot까지 연결됨 (정상 갱신 기대) |
| (a) | 구독/매핑은 있으나 **타입·리더 불일치**로 값이 버려짐 → merge가 REST 값을 보존 (BF-1과 동일 패턴) |
| (b) | Snapshot 컬럼은 있으나 Telemetry 경로에서 **merge가 previous만 복사** (파서 미구현 포함) |
| (c) | 코드에 별칭/매핑은 있으나 **구독 목록에 없음** → 실차에서는 사실상 미수신 |
| (d) | Tesla에 필드 있고 FMS Snapshot/UI에도 쓰이나 **구독·파서 모두 없음** (버리거나 REST-only 고착) |
| SKIP | MVP 관제 우선순위 밖 (시트·파워트레인 내부 등) — 본 조사에서 “미사용”으로만 기록 |

##### A. 현재 구독 필드 (`DEFAULT_TELEMETRY_FIELDS`) × 파서 × merge

| Telemetry 필드 | 공식 타입 | Snapshot 대상 | 파서 As-Is | merge | 판정 | 비고 |
|----------------|-----------|---------------|------------|-------|:----:|------|
| `Soc` | real | `batteryPercent` | `readNumber` | current??previous | **OK** | |
| `Location` | Location | lat/lng | `readLocation` | 동일 | **OK** | `prefer_typed` 시 `locationValue` 지원됨 |
| `ChargeState` | string / ChargingState enum | `chargingStatus` | `readString` → `mapChargingStatus` | 동일 | **(a) 위험** | `prefer_typed`면 `charging_value` oneof. `TelemetryFieldValue`·`readString`이 미지원이면 **충전 상태 고착**. 또한 `batteryPercent` 키 후보에 `ChargeState`가 포함되어 있어 SoC와 **키 충돌 냄새** (string이면 `readNumber` 실패로 우연히 무해) |
| `Gear` | ShiftState enum | `ignitionOn` (P 여부) | `readString` | 동일 | **(a) 위험** | typed 시 `shift_state_value`. 미파싱 시 `ignitionOn`이 wake REST 값에 고착 → 주차/주행 오표시 가능 |
| `Locked` | boolean | `locked` | `readBoolean` | 동일 | **OK** | |
| `Odometer` | real (miles) | `odometerKm` | `readNumber` ×1.60934 | 동일 | **OK** | |
| `InsideTemp` / `OutsideTemp` | real (°C) | `insideTempC` / `outsideTempC` | `readNumber` | 동일 | **OK** | |
| `SentryMode` | **SentryModeState enum** | `sentryMode` (bool) | `readBoolean` | 동일 | **(a)** | 공식은 enum(Off/Idle/Armed…). boolean 리더면 `undefined` → **센트리 고착**. Armed 등 → `true` 매핑 필요 |
| `EstBatteryRange` | real (miles) | `rangeKm` | `readNumber` ×1.60934 | 동일 | **OK** | 구독 있음. 재구독 전 구형 config면 (c) |
| `DoorState` | string / Doors | `doorsOpen` + per-door/trunk | `readBoolean` | doors: ?? / **per-door: previous only** | **(a)+(b)** | BF-1 본체 |

##### B. 코드에 매핑·별칭은 있으나 구독하지 않는 필드 (c)

| 코드가 찾는 키 | 공식 Telemetry 필드 | Snapshot | 판정 | 영향 |
|----------------|---------------------|----------|:----:|------|
| `WindowState` / `WindowsOpen` | **없음**. 실제는 `FdWindow`·`FpWindow`·`RdWindow`·`RpWindow` (WindowState enum) | `windowsOpen` | **(c)+필드명 오류** | 창문 개방이 REST 스냅샷에 고착. DoorState와 **같은 부류의 설계 실수** |
| `HvacPower` / `ClimateOn` | `HvacPower` (**HvacPowerState enum**, boolean 아님) | `climateOn` | **(c)+(a 예비)** | 미구독. 구독해도 `readBoolean`이면 실패 |
| `SoftwareVersion` / `Version` | `Version` (string) | `softwareVersion` | **(c)** | 미구독 → SW 버전은 Baseline/wake REST에만 의존 |

##### C. Snapshot에 있고 관제 가치가 있으나 Telemetry로 안 들어오는 필드 (b)(d)

| Snapshot 컬럼 | Tesla Telemetry 후보 | 구독 | 파서 | merge | 판정 | FMS 영향 |
|---------------|----------------------|:----:|:----:|-------|:----:|----------|
| `doorDf/Dr/Pf/PrOpen`, `front/rearTrunkOpen` | `DoorState` (위 A) | ✅ | ❌ | previous only | **(a)(b)** | BF-1 |
| `windowsOpen` | `Fd/Fp/Rd/RpWindow` | ❌ | ❌ (잘못된 키) | ??previous | **(b)(c)(d)** | 창문 고착 |
| `tpmsFrontLeft` 등 4휠 | `TpmsPressureFl/Fr/Rl/Rr` (bar) | ❌ | ❌ | previous only | **(b)(d)** | 공기압이 wake REST 이후 **수시간~일** 고착 (상세 UI에 표시 중) |
| `chargeLimitSoc` | `ChargeLimitSoc` | ❌ | ❌ | previous only | **(b)(d)** | 충전 한도 % stale |
| `chargerPowerKw` | `ACChargingPower` / `DCChargingPower` | ❌ | ❌ | previous only | **(b)(d)** | 충전 중 kW가 REST 시점 값에 고정 |
| `climateOn` | `HvacPower` | ❌ | (별칭만) | ??= | **(c)** | 공조 On/Off stale |
| `nearbyChargingSites` | (Telemetry 없음) | — | — | previous only | **의도적 REST** | BF-3 |
| `serviceStatus` | (Telemetry 없음, REST `service_data`) | — | — | previous only | **의도적 REST** | OK(범위) |

##### D. Tesla에 있으나 현재 FMS Snapshot에 없고 MVP에서 SKIP한 예 (참고)

관제 확장 시 후보이나 **이번 BF 범위 밖**: `VehicleSpeed`, `GpsHeading`, `DetailedChargeState`, `ChargePortDoorOpen`, `EnergyRemaining`, `DestinationName`/`DestinationLocation`, `DriverSeatOccupied`, 시트/ADAS 전반, 드라이브 인버터 온도·토크 등.

##### E. 전수 조사 결론

1. **BF-1과 동일 패턴은 도어만이 아니다.**  
   - **확정 (a)**: `DoorState`, `SentryMode` (enum을 boolean으로 읽음)  
   - **확정 (a) 위험 (`prefer_typed: true`)**: `Gear`, `ChargeState` — proto oneof를 `TelemetryFieldValue`가 아직 모름  
   - **동일 부류 설계 결함 (창문)**: 존재하지 않는 `WindowState` 키 + 미구독 + merge 보존  
2. **(b) merge previous-only**는 per-door/trunk뿐 아니라 **TPMS·충전 한도·충전기 전력·인근 충전소·serviceStatus**에도 적용된다. 뒤 둘은 REST 전용이 맞고, 앞셋은 Telemetry로 살릴 수 있는데 **버리고 있다**.  
3. **실차에서 “위치·SoC는 도는데 보안/개폐/센트리만 이상”**이 보이면, 구독 필드는 들어오지만 **typed/enum 파서 실패 → merge 고착** 가설이 DoorState와 일치한다.  
4. 수정 시 BF-1만 고치면 同類가 남는다. **BF-A 범위에 typed/enum 리더 공통화 + 동급 필드 점검을 포함**하는 것을 권장한다.

##### F. BF-A 확장 권고 (구현 시, 본 문서 승인 후)

| 우선 | 항목 | 이유 |
|:----:|------|------|
| P0 | `DoorState` 파서 + per-door/trunk merge + 닫힘 `false` | BF-1 |
| P0 | `TelemetryFieldValue`에 proto oneof 대응 (`door_value`, `shift_state_value`, `charging_value`, `sentry_mode_state_value`, `hvac_power_value`, `window_state_value`) | `prefer_typed: true`와 정합 |
| P0 | `SentryMode` enum → bool, `Gear` typed → `ignitionOn` | 동일 (a) 고착 방지 |
| P1 | `Fd/Fp/Rd/RpWindow` 구독·파서 → `windowsOpen` | 창문 고착 |
| P1 | `TpmsPressure*` 구독·파서·merge | 타이어 상세 stale |
| P1 | `ChargeLimitSoc`, `AC/DCChargingPower` → Snapshot | 충전 카드 stale |
| P1 | `HvacPower` 구독·enum→`climateOn` | 공조 stale |
| P2 | `Version` 구독 (또는 REST만 유지 명시) | SW 표시 정책 |
| — | `nearby` / `serviceStatus` | Telemetry로 넣지 않음 (BF-3·REST) |

### 3.2 BF-2 (wake 스냅샷 타이밍)

#### 현장 가설 (동의하는 부분)

- 문 열고 탑승하는 순간 ONLINE/wake REST가 돌면 **문이 열린 스냅샷이 찍히는 것**은 정상 동작에 가깝다.
- 사람 탑승·출발까지 30초~2분이 걸리는 점도도 타당하다.

#### 보완·정정

| 현장 제안 | 평가 |
|-----------|------|
| ONLINE 직후 즉시 REST 대신 30초~1분 지연 | **완화책**으로는 유효. 다만 “문이 항상 닫힌 스냅샷”을 보장하지는 않음(탑승 지연·짐칸 사용 등) |
| 지연만으로 BF-1 해결 | **불충분**. Telemetry 매핑이 깨져 있으면 지연 REST 이후에도 개방 상태가 다시 고착될 수 있음 |
| Gear=D / 안정화 후 REST | 좋은 **2차 보정 트리거** 후보. 1차 수정은 BF-1 Telemetry 반영 |

권장 우선순위:

1. **P0**: Telemetry `DoorState` → 종합·개별·트렁크 DB 반영 (닫힘=`false` 명시 기록)
2. **P1**: wake REST는 유지하되(보안·관제 가치), UI에 **수집 시각·소스**를 분명히 하거나 / Gear≠P 등에서 **선택적 재스냅샷**
3. 지연-only는 **단독 해결책으로 채택하지 않음**

참고: 기존 `TESLA_REST_WAKE_COOLDOWN_MINUTES`(기본 30)는 “연속 REST 남용 방지”용이다. **첫 wake 스냅샷을 늦추는 것**과는 별개 축이다.

### 3.3 BF-3 (인근 충전소 고착)

#### 현장 가설 (동의)

- 인근 충전소는 REST(`nearby_charging_sites`)로만 채워지고, Telemetry merge 시 **이전 JSON을 그대로 보존**한다.
- 출발지에서 찍힌 목록이 이동 중에도 노출되는 것은 정책·표현 버그에 가깝다.

#### 보완·권장

| 현장 제안 | 평가 |
|-----------|------|
| GPS가 출발지에서 일정 거리 이상이면 목록 삭제 | **채택** — 혼동 제거에 가장 단순·명확 |
| 목적 도착·주차 시 재조회 | **채택(조건부)** — 차량 ONLINE + REST 예산(쿨다운) 내에서만 |
| (추가) 목록에 “수집 위치·시각” 표시 | **권장** — 삭제 전에도 “지금 위치 기준이 아님”을 알림 |
| Telemetry로 충전소 실시간 갱신 | **비현실적** — Telemetry에 해당 스트림 없음. REST 전용 유지 |

거리 임계값 초안: **2 km** (설정 가능). 초과 시 Snapshot의 `nearbyChargingSites`를 `null`/`[]`로 기록하고 UI는 빈 상태(“주행 중 · 주차 후 갱신”).

재조회 트리거 초안 (OR):

- `Gear`/`ShiftState`가 **P로 복귀** 후 N분 정차
- 또는 ASLEEP 추론 직전 ONLINE 정차
- 그리고 wake/REST 쿨다운 경과

---

## 4. 해결 요구사항

### 4.1 BF-1 — Telemetry 도어/트렁크 반영 (P0)

#### 목표

주행·정차 중 문이 닫히면 FMS 상세의 **문(종합)·개별 문·프렁크·트렁크**가 수 분 이내(구독 interval 이내)에 **닫힘으로 갱신**된다.

#### 요구

1. `DoorState` 파서 구현
   - string (`DriverFront|…`) / object(`Doors`) / 향후 변형을 수용
   - 매핑표(초안):

| Telemetry 토큰 / 필드 | Snapshot 컬럼 |
|----------------------|---------------|
| `DriverFront` | `doorDfOpen` |
| `DriverRear` | `doorDrOpen` |
| `PassengerFront` | `doorPfOpen` |
| `PassengerRear` | `doorPrOpen` |
| `TrunkFront` | `frontTrunkOpen` |
| `TrunkRear` | `rearTrunkOpen` |

2. `doorsOpen` = 네 문 중 하나라도 open
3. **모든 문이 닫힘**이면 각 컬럼에 `false`를 **명시 기록** (`null`로 두지 않음 — merge가 이전 `true`를 보존하지 못하게)
4. 펌웨어 `< 2024.44.32`의 PF↔DR 스왑은 문서화·로그. MVP는 공식 매핑 유지, 필요 시 VIN SW 버전 보정은 P2
5. 구독 설정에 `DoorState`가 실제로 create/config에 포함되는지 점검(이미 `client.ts`에 있으면 파서만으로 충분)

#### 수용 기준

- [ ] 문 개방 → 상세에 개방 표시
- [ ] 문·트렁크 닫은 뒤 Telemetry 수신 후, 상세가 닫힘으로 바뀜 (REST 재호출 없이)
- [ ] 주행 중 위치/배터리는 기존처럼 갱신되고, 도어만 고착되지 않음

### 4.2 BF-2 — wake REST 타이밍·표현 (P1)

#### 목표

탑승 직후 열린 문 스냅샷이 **영구 진실이 되지 않게** 하고, 필요 시 주행 초기에 한 번 더 보정한다.

#### 요구 (우선순위 순)

1. **필수**: BF-1 완료로 실시간 덮어쓰기 보장 (BF-2 단독 지연에 의존하지 않음)
2. **권장**: UI에 문/트렁크 타일 **데이터 소스·시각** (`REST` vs `TELEMETRY`, `lastUpdatedAt`) 표시 — “방금 연 문”과 “고착 버그”를 구분
3. **선택**: Telemetry `Gear`/`ShiftState`가 P→비가동(D/R/N)으로 바뀐 뒤, 쿨다운 허용 시 **보정 REST 1회** (제원 제외, 도어·충전 한도 등 동적만)
4. **비권장(단독)**: ONLINE 웹훅 후 무조건 30~60초 sleep 후 첫 REST — BF-1 없이 도입하지 않음. 도입 시에도 보안 관제(문 연 채 방치) 알림 지연 부작용을 명시

#### 수용 기준

- [ ] 문을 연 채 서 있으면 개방이 보이거나, 최소한 “스냅샷 시각”으로 오해가 없음
- [ ] 문을 닫고 출발하면 BF-1에 의해 닫힘으로 수렴 (보정 REST 없이도)

### 4.3 BF-3 — 인근 충전소 stale 정책 (P1)

#### 목표

인근 충전소는 **“수집 시점의 차량 위치 기준”**임을 UI·데이터 모두에서 명확히 하고, 차량이 멀리 떠나면 목록을 비운다.

#### 요구

1. Snapshot에 충전소 수집 메타 보관 (최소 하나)
   - 예: `nearbyChargingSitesCapturedAt`, 또는 JSON에 `{ sites, capturedAt, capturedLat, capturedLng }`
2. Telemetry 위치 갱신 시 Haversine 거리 > **임계(기본 2 km)** 이면 목록 클리어
3. UI
   - 목록 있을 때: “출발/수집 지점 기준 · N분 전” 문구
   - 클리어 후: “주행 중 — 주차 후 갱신” 빈 상태 (가짜 0거리 숨김)
4. 재조회: 정차(P) + ONLINE + REST 쿨다운 경과 시 `nearby_charging_sites` 1회
5. ASLEEP 깨우기만으로 충전소를 위해 wake하지 않음 (기존 하이브리드 정책 준수)

#### 수용 기준

- [ ] 출발지에서 2 km 이상 이동하면 상세에서 출발지 충전소가 사라짐
- [ ] 주차·ONLINE·쿨다운 후 재수집 시 새 위치 기준 목록 표시
- [ ] 목록이 있을 때 수집 시각(또는 “기준 위치”)이 보임

---

## 5. 구현 Phase (제안)

| Phase | 범위 | 의존 |
|-------|------|------|
| **BF-A** | DoorState 파서 + merge에서 문/트렁크 컬럼 갱신 + 닫힘 false 기록 | 없음 (P0) |
| **BF-A2** | typed/enum 리더 공통화 + `SentryMode`·`Gear`·`ChargeState` (a) 고착 제거 (§3.1.1 F) | BF-A와 동일 스프린트 권장 |
| **BF-B** | 인근 충전소 메타·거리 클리어·UI 문구 | BF-A와 병렬 가능 |
| **BF-C** | 정차 시 nearby 재조회 + (선택) Gear 기반 보정 REST | BF-A/B, 쿨다운 정책 |
| **BF-D** | 창문(`Fd/Fp/Rd/RpWindow`)·TPMS·ChargeLimitSoc·충전기 kW·HvacPower 구독/매핑 (§3.1.1 F P1) | 재구독(config create) 필요 |
| **BF-E** | UI 소스/시각 표시, PF/DR 펌웨어 보정(필요 시) | P2 |

코드 작업은 [checklist-tesla-api-bugfix-0712.md](./checklist-tesla-api-bugfix-0712.md) · [development-checklist.md](./development-checklist.md) Phase BF 기준 **구현 완료**(2026-07-12). 실차 검수·재구독은 잔여.

---

## 6. 현장 메모 대비 요약

| 현장 제안 | 본 문서 결론 |
|-----------|--------------|
| REST 1회라서 개방 상태가 남는다 | **부분 동의** — 초기 오염원은 REST, **지속 원인은 Telemetry 미반영** |
| Telemetry 도어 필드 매핑 누락 | **동의·강화** — boolean 파서 오류 + per-door/trunk merge 미구현 |
| (전수 조사) 다른 필드도? | **예** — `SentryMode`·(`prefer_typed`) `Gear`/`ChargeState` 동일 (a); 창문·TPMS·충전한도·kW는 (b)(d); 자세한 표는 §3.1.1 |
| wake 후 30초~1분 지연 REST | **완화만** — 단독 채택 금지, BF-1 우선 |
| 거리 벗어나면 충전소 삭제 + 주차 시 갱신 | **동의** + 수집 메타·쿨다운·wake 금지 조건 추가 |

---

## 7. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-12 | 실차 검증 메모 분석 → BF-1~3 원인·해결·Phase 요구사항 작성 (코드 미착수) |
| 2026-07-12 | §3.1.1 Telemetry 전수 조사 — 구독×파서×merge×공식 필드 대조, BF-A2/D Phase 추가 |
| 2026-07-12 | 체크리스트·관련 문서 링크 (checklist / development-checklist / VD·hybrid·webhook·display-data) |
| 2026-07-12 | **BF 코드 완료** — DoorState/typed·nearby stale·구독 확장 · 실차 검수 잔여 |
