# 인근 충전소 카탈로그 DB · REST 실패 시 DB 폴백 (NCS)

| 항목 | 내용 |
|------|------|
| 목적 | `nearby_charging_sites` **성공 응답을 전국(누적) 충전소 카탈로그 테이블에 적재**하고, Gear=P 후 REST가 asleep/unavailable로 실패하면 **차량 GPS 기준 카탈로그 근접 조회**로 목록을 채운다 |
| 배경 | TRF-B2: Online→Gear=P 시 `maybeRefreshNearbyOnPark`. 간헐적 `vehicle unavailable: vehicle is offline or asleep` → UI 공백. 전국 DB를 일시에 채울 수 없어 **성공 응답을 씨드로 쌓고**, 실패 시 DB 폴백 |
| 관련 | [requirements-tesla-wake-telemetry-rest.md](./requirements-tesla-wake-telemetry-rest.md) (§3.4), [requirements-tesla-api-bugfix-0712.md](./requirements-tesla-api-bugfix-0712.md) (BF-B/C), [nearby_charging_sites.json](./fleet-api/endpoints/vehicle-endpoints/nearby_charging_sites.json), VD3 nearby empty UX |
| 적용 | `maybeRefreshNearbyOnPark` · mapper · Snapshot nearby JSON · (신규) 카탈로그 테이블 |
| 상태 | **문서 ✅ · 코드 NCS-2~4 ✅ · 실차 NCS-5 ☐ · NCS-6 ☐** |
| 작성일 | 2026-07-16 |
| ID | **NCS** (Nearby Charging Station catalog) |

---

## 1. 문제 정의

```text
Gear=P → nearby_charging_sites REST
  ├─ 성공 → Snapshot nearby JSON · UI 표시
  └─ 실패 (asleep / offline) → 현재: 빈 목록·공백 UI (간헐)
```

**제품 목표 (단기):** REST 없이도 **이미 적재된 충전소**가 차량 위치 근처에 있으면 보여 준다. 없으면 노출하지 않는다 (허위 목록 금지).

**제품 목표 (중기):** 카탈로그가 충분히 쌓이거나 공공/파트너 소스가 붙으면 Tesla 차량 REST 의존을 줄인다. **전국 일괄 적재는 본 Phase 범위 밖.**

---

## 2. 제안 분석 · 빈칸 보완

### 2.1 잘 짚은 점 (채택)

| 점 | 이유 |
|----|------|
| asleep와 REST의 구조적 충돌 | 차량 하드웨어 세션이 필요한 API — TRF-B2·실차와 일치 |
| REST 성공분을 DB에 쌓기 | 배치 없이도 **실제 운행 경로 주변**부터 커버리지 성장 |
| 실패 시 DB 폴백 · 없으면 비표시 | 잘못된 전국 랜덤 노출을 막음 |

### 2.2 반드시 채울 공백

| 공백 | 보완 요구 |
|------|-----------|
| **무엇을 Insert?** | 이름·좌표·type(`destination`/`supercharger`)·stalls 메타(선택). `distance_miles`는 **호출 시점 상대값** → 카탈로그에 **저장하지 않거나** last-seen만 |
| **중복** | 같은 충전소를 매 P마다 Insert하면 폭발 → **Upsert (자연키)** |
| **자연키** | `(source, type, roundedLat, roundedLng)` 또는 `name + lat/lng` 해시. Tesla site id 없음 → **이름+좌표(소수 4~5자리≈10m)** 권고 |
| **실시간 stalls** | `available_stalls`는 금방 stale → 카탈로그 **참고만** · UI에 “실시간 잔여”로 단정 금지. 폴백 UI는 **이름·거리** 중심 |
| **조회 반경** | 폴백 시 N km (권고 **기본 10km**, env `TESLA_NEARBY_CATALOG_RADIUS_KM`). UI는 거리순 **최대 8개**(현 mapper와 정합) |
| **좌표 SoT** | 폴백 거리 계산은 Snapshot/Telemetry **차량 lat/lng**. 카탈로그 site lat/lng |
| **REST 실패 시 Snapshot** | 현행 `getNearbyChargingSites`가 예외를 삼키고 `[]`를 주면 **성공처럼 빈 JSON으로 덮을 위험**. 폴백 도입과 함께 **실패≠빈 성공**으로 분리 필수 |
| **2km stale 클리어** | BF-B 유지. 폴백으로 채운 nearby도 envelope `capturedAt/Lat/Lng` 부여 → 이동 시 동일 클리어 |
| **출처 표시** | UI: 「Tesla 조회」vs 「저장된 충전소」(폴백) — 관리자 신뢰 |
| **커버리지 한계** | 씨드는 **주차·REST 성공한 지역만**. 신규만 다니는 신규은 약함 → 기대치 문서화 |
| **법/ToS** | Tesla 응답 재저장·재표시 — Fleet 계정 데이터로 내부 FMS 용. **외부 재판매·공개 API화 금지**. 장기 전국망은 공공 EV API 검토 |

### 2.3 비범위 (지금 하지 않음)

- 전국 CSV 일괄 임포트 / 크롤링
- `wake_up`으로 nearby 재시도 (TRF 금지)
- REST 대체용 Partner 전용 nearby (미검증)
- Destination만 또는 Supercharger만 정책 강제 (둘 다 적재·둘 다 표시 — 현 UI와 동일)

---

## 3. To-Be 흐름

```text
[Gear=P · 쿨다운 OK · 좌표 유효]
        │
        ▼
 nearby_charging_sites REST
        │
   ┌────┴────┐
   │ 성공    │ 실패 (asleep/offline/5xx…)
   ▼         ▼
 (A) 사이트 Upsert → 카탈로그
 (B) Snapshot nearby = Tesla 목록
     source=TESLA_REST
             │
             ▼
      (C) 카탈로그에서
          차량 GPS ± R km 조회
             │
        ┌────┴────┐
        │ 있음    │ 없음
        ▼         ▼
 Snapshot nearby  Snapshot nearby 유지/비움
 = DB 목록         (덮어쓰기 금지 또는 null)
 source=CATALOG    UI empty
```

**원칙:** REST 성공이 SoT. 폴백은 **갭 채움**. 카탈로그가 비어 있으면 **노출하지 않음**.

---

## 4. 데이터 모델 (초안)

### 4.1 `ChargingStation` (카탈로그)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | cuid | PK |
| `source` | enum/`TESLA_NEARBY` | 출처 |
| `siteType` | `destination` \| `supercharger` | |
| `name` | string | |
| `latitude` / `longitude` | float | 필수 |
| `nameKey` | string | 정규화 이름(중복 보조) |
| `geoKey` | string | 예: `lat.round(5):lng.round(5):type` unique |
| `totalStalls` | int? | last-seen |
| `lastAvailableStalls` | int? | last-seen · UI 비강조 |
| `siteClosed` | bool? | last-seen |
| `lastSeenAt` | timestamptz | REST 성공 시 갱신 |
| `hitCount` | int | 관측 횟수 |
| `createdAt` / `updatedAt` | | |

인덱스: `geoKey` UNIQUE · `(latitude, longitude)` 조회용 · (후속) PostGIS는 규모 커지면.

### 4.2 Snapshot nearby JSON (현행 envelope 확장)

```json
{
  "sites": [{ "name": "...", "distanceKm": 1.2 }],
  "capturedAt": "...",
  "capturedLat": 37.48,
  "capturedLng": 126.88,
  "source": "TESLA_REST" | "CATALOG"
}
```

`source`는 UI 뱃지용. 구 JSON은 `source` 없으면 Tesla로 간주 가능.

### 4.3 API 타입 보강

현 `TeslaNearbyChargingSite`에 `location.lat/long`, `type`, `site_closed`가 JSON에 있으나 타입이 빈약함. **Upsert 전에 mapper가 좌표를 파싱**해야 함 (지금 UI 매핑은 name+거리만).

---

## 5. 코드 변경 포인트 (구현 시)

| # | 항목 |
|---|------|
| N1 | Prisma `ChargingStation` + migrate |
| N2 | `mapNearbyChargingSites` → 좌표·type 포함 DTO (카탈로그용) |
| N3 | `upsertChargingStationsFromTeslaNearby(response)` |
| N4 | `queryNearbyFromCatalog(lat, lng, radiusKm, limit)` |
| N5 | `maybeRefreshNearbyOnPark`: 성공→upsert+Snapshot; **실패→catalog 폴백** (실패를 `[]` 성공으로 취급 금지) |
| N6 | Audit: `VEHICLE_NEARBY_REFRESH` metadata `source: tesla_rest \| catalog_fallback \| empty` |
| N7 | UI: 폴백 시 「저장된 충전소」힌트 (As-Is + VD3) |
| N8 | env: `TESLA_NEARBY_CATALOG_RADIUS_KM` (기본 10) · feature `TESLA_NEARBY_CATALOG_FALLBACK` (기본 ON 권고) |

---

## 6. 수용 기준

1. REST 성공 1회 → 카탈로그에 supercharger/destination row Upsert (중복 호출해도 row 폭증 없음).  
2. 동일 좌표 인근에서 REST asleep 실패 → Snapshot에 카탈로그 기반 목록(또는 반경 내 0건이면 empty).  
3. 실패 시 이전 양호 nearby를 **빈 배열로 덮지 않음** (또는 명시적 catalog empty만).  
4. 차량이 2km 이동하면 BF-B와 같이 nearby 클리어.  
5. `wake_up` 호출 없음.  
6. UI에 출처 구분 가능.

---

## 7. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **NCS-1** | 본 문서 승인 | ✅ |
| **NCS-2** | 스키마 · Upsert · REST 성공 적재 | ✅ |
| **NCS-3** | REST 실패 → 카탈로그 폴백 · Snapshot/Audit | ✅ |
| **NCS-4** | UI 출처 · empty 정책 · mapper 좌표 | ✅ |
| **NCS-5** | 실차: 성공 적재 · asleep 폴백 · 미적재 지역 empty | ☐ |
| **NCS-6** | (후속) 공공 EV API / 전국 시드 — 별도 문서 | ☐ |

체크리스트: [checklist-nearby-charging-catalog.md](./checklist-nearby-charging-catalog.md)

---

## 8. 의견 · 진행 여부 판단

### 8.1 판단: **조건부 GO (NCS-1~5)**

단기 FMS 가치와 구현 비용이 맞다.

- asleep 공백을 **이미 방문·성공한 핫스팟**에서 완화할 수 있다.  
- TRF 계약(`wake_up` 금지 · Telemetry SoT)을 깨지 않는다.  
- “당분간 씨드”로 전국망을 기대하면 실패한다 → **기대치를 명시하면 GO**.

### 8.2 GO 조건

1. Upsert + 실패/`[]` 분리 (빈 성공 덮어쓰기 수정 포함).  
2. 폴백 = **이름·거리만** 강조, stalls 실시간 단정 금지.  
3. 커버리지 = 운행 누적. 데모·첫 주차 빈 지역은 empty 허용.  
4. 전국 완전판은 **NCS-6(공공 API 등)** 로 분리 — Tesla nearby만으로 전국 채우기 약속하지 않음.

### 8.3 NO-GO에 가까운 오해

| 오해 | 실제 |
|------|------|
| “Insert만 하면 곧 전국” | 주차·성공 지점만 채워짐 |
| “DB 있으면 REST 바로 폐기” | 신선도·신규 사이트·혼잡도는 REST/공공이 계속 유리 |
| “실패 시 아무 충전소나” | 반경·없으면 비표시 — 필수 |

### 8.4 대안 대비

| 대안 | vs NCS |
|------|--------|
| P 후 3~5초 delay·재시도 | 보조 가능(별도). wake 없이 성공률↑ 여지. **카탈로그와 병행 가능** |
| 공공 EV 충전소 API | 전국성↑ · NCS-6 본선 |
| Snapshot에만 의존(적재 없음) | 폴백 지역 확장 불가 |

**추천 순서:** NCS-2~4 구현 → 실차 NCS-5 → 커버리지 모니터링 → 필요 시 delay 재시도(소) + NCS-6 공공 시드.

---

## 9. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-16 | 초안 — REST 씨드 Upsert · asleep 시 카탈로그 폴백 · 조건부 GO |
| 2026-07-16 | 코드 — ChargingStation · park nearby Upsert/폴백 · `ncs:verify` · NCS-2~4 ✅ |
|
