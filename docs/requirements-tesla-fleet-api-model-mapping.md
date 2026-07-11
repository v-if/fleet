# Tesla Fleet API — 차량 모델·트림 표시 매핑

> 관련: [requirements-tesla-fleet-api-display-data.md](./requirements-tesla-fleet-api-display-data.md) · 구현 스키마: [requirements-tesla-hybrid-data-model.md](./requirements-tesla-hybrid-data-model.md) §4.2

## 1. 목적

`GET /api/1/vehicles/{vin}/vehicle_data` 의 `vehicle_config` 값을 FMS 화면에 읽기 쉬운 **모델·트림 문자열**로 매핑한다.  
해당 필드는 **정적 데이터**로 취급한다 — 최초 차량 등록(또는 제원 재동기화) 시 1회 저장하고, Telemetry/주기 sync로 덮어쓰지 않는다.

## 2. Vehicle 테이블 컬럼 (확정안 — hybrid-data-model)

| 컬럼 (Prisma) | 샘플 | 출처 | 비고 |
|---------------|------|------|------|
| `carType` | `modely` | `vehicle_config.car_type` | 원본 코드 |
| `trimBadging` | `50` | `vehicle_config.trim_badging` | 원본 코드 |
| `exteriorColor` | `StealthGrey` | `vehicle_config.exterior_color` | 원본 |
| `teslaDisplayName` | (앱 표시명) | `vehicles.display_name` | 준정적 |
| `specsSyncedAt` | timestamptz | FMS | 제원 저장 시각 |
| `model` (기존) | `Model Y · RWD` | 매핑 결과 | 화면 표시용 |

등록·Baseline 시 `vehicle_data` 조회 후 저장. Telemetry/일반 sync는 덮지 않음.  
쿨다운·Lifecycle은 `VehicleSyncState` — [hybrid-data-model](./requirements-tesla-hybrid-data-model.md).

## 3. `car_type` → 표시명

| `car_type` | 표시 |
|------------|------|
| `model3` | Model 3 |
| `modely` | Model Y |
| `models` | Model S |
| `modelx` | Model X |
| `cybertruck` | Cybertruck |

## 4. `trim_badging` → 표시명

| `trim_badging` | 표시 |
|----------------|------|
| `50` | RWD |
| `74` | Long Range RWD |
| `74d` | Long Range AWD |
| `p74d` | Performance |
| `long_range` | Long Range |
| `performance` | Performance |
| `plaid` | Plaid |

> 실차 응답에 없는 코드가 오면 원본 문자열을 그대로 표시하고, 매핑표를 보강한다.

## 5. 표시 조합 예

| car_type | trim_badging | `model` 표시 예 |
|----------|--------------|-----------------|
| `modely` | `50` | Model Y · RWD |
| `modely` | `74d` | Model Y · Long Range AWD |
| `model3` | `p74d` | Model 3 · Performance |

## 6. 구현 시 주의

- 기존 `Vehicle.model`만 쓰는 UI는 매핑 결과 문자열을 쓰도록 통일한다.
- sync 경로: **registry/등록**에서만 정적 컬럼·`model` 갱신. Telemetry processor는 Snapshot만 갱신.
- 가상 차량 시드는 동일 컬럼을 Mock 값으로 채운다.

## 7. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-11 | 초안 메모를 매핑 요구사항으로 정리 — 정적 저장 정책·표시 조합·구현 주의 |
| 2026-07-11 | Prisma 컬럼명·VehicleSyncState 연계 (hybrid-data-model) |
