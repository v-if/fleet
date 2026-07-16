# VD3 인근 충전소 — 지도 마커 표시 (VD3-NM)

| 항목 | 내용 |
|------|------|
| 목적 | 차량상세 **위치** 카드에서 인근 충전소 **목록이 있을 때**, 동일 사이트를 **지도(해당 차량만 표시되는 맵) 위 마커**로 보여 거리·방향을 직관적으로 전달한다 |
| 배경 | 목록은 이름·거리(km)만 있어 **어느 방향인지** 한눈에 안 보인다. 상세 맵은 이미 해당 차량 1대만 표시하므로, 같은 뷰포트에 충전소 핀을 올리면 관제 효율이 오른다 |
| 관련 | [requirements-vehicle-detail-vd3-nearby-block.md](./requirements-vehicle-detail-vd3-nearby-block.md) (VD3-NB), [requirements-nearby-charging-catalog.md](./requirements-nearby-charging-catalog.md) (NCS), [nearby_charging_sites.json](./fleet-api/endpoints/vehicle-endpoints/nearby_charging_sites.json) |
| 적용 | 기본 상세 `FleetVehicleDetailViewV3` + `VehicleMap`(또는 상세 전용 overlay). `/map` 전체 플릿 맵·`/v2`는 **비범위** |
| 상태 | **코드 ✅ (NM-2·3) · 실차 NM-5 ☐ · NM-4 선택 미착수** |
| 작성일 | 2026-07-16 |
| ID | **VD3-NM** |

---

## 1. As-Is 분석

### 1.1 UI

| 요소 | 현재 |
|------|------|
| 상세 맵 | `VehicleMap` · `vehicles={[해당 차량]}` · `nearbySites` · `hideSelectionCard` · 높이 256 |
| 인근 충전소 리스트 | VD3-NB: `sites.length > 0`일 때만 · **최대 5건** 표시 |
| 맵 ↔ 리스트 | **동일 상위 5건** — 좌표 있는 site는 SC/DC 마커 + fitBounds |

### 1.2 좌표 파이프 (NM-2 ✅)

Tesla `nearby_charging_sites`·NCS 카탈로그의 lat/long·type을 Snapshot JSON·DTO에 보존한다.

| 단계 | 동작 |
|------|------|
| `mapNearbyChargingSites` | name · distanceKm · latitude · longitude · siteType |
| `queryNearbyFromCatalog` | 동일 필드 반환 |
| `NearbyChargingSite` / DTO | 좌표·siteType 포함 (구형 JSON은 null) |
| `parseNearbyChargingJson` | 하위호환 — 좌표 없으면 마커만 스킵 |

기존 Snapshot은 다음 park nearby 성공 시 좌표가 채워진다.

---

## 2. 제안 분석

### 2.1 채택

| 점 | 이유 |
|----|------|
| 목록 ∩ 맵 | 같은 데이터 SoT — 혼동 없음 |
| 상세 전용 | 플릿 `/map`에 충전소 전역 표시는 범위·성능 이슈 — 상세만 |
| VD3-NB 정합 | 목록 없으면 마커도 없음 (빈 맵 + 차량만) |

### 2.2 빈칸 보완

| 공백 | 보완 |
|------|------|
| 좌표 소스 | REST/카탈로그 매핑 시 `latitude`·`longitude`(·`siteType`)를 Snapshot JSON·DTO에 **포함** |
| 표시 개수 | **리스트와 동일** — UI `slice(0, 5)`와 맞춤 (맵도 상위 5). Snapshot 저장은 현행 최대 8 유지 가능 |
| 좌표 없는 site | 마커 생략 · 리스트에는 이름만 (희귀). 가능하면 매핑 단계에서 좌표 없는 건 씨드/목록에서 제외 유지 |
| 마커 스타일 | 차량 핀과 **구분**. Supercharger / Destination **색·아이콘 차별** (간단: ⚡ vs 플러그 또는 두 색) |
| 뷰포트 | 차량 + 표시 마커를 담도록 **bounds fit** (1대만이면 기존 zoom 유지) |
| 상호작용 (P1) | 목록 행 hover/클릭 ↔ 마커 강조 · 마커 클릭 시 InfoWindow(이름·거리). **MVP는 표시만** 허용 |
| 높이 | 마커가 늘면 256px가 답답할 수 있음 — MVP 유지 · 답답하면 `h-72`/`h-80` 선택 |
| SimpleMapFallback | Naver 실패 시 폴백에도 좌표 점 표시 가능하면 가점 · 없어도 GO 차단 아님 |
| 전체 맵 페이지 | 변경 없음 |

### 2.3 비범위

- `/map` · 대시보드 맵에 충전소 레이어  
- 충전소 내비 딥링크·원격 Nav 전송  
- 실시간 stall 가용 애니메이션  
- `/v2` 상세  

---

## 3. To-Be 설계

### 3.1 데이터

`NearbyChargingSite` / `NearbyChargingSiteDto`:

```ts
{
  name: string;
  distanceKm: number;
  latitude?: number | null;
  longitude?: number | null;
  siteType?: "destination" | "supercharger" | null;
}
```

| 변경 포인트 | |
|-------------|--|
| `mapNearbyChargingSites` | location.lat/long · type 보존 |
| `queryNearbyFromCatalog` | row lat/lng · siteType 포함 |
| `parseNearbyChargingJson` | 구형(좌표 없는) JSON **하위호환** — 마커만 스킵 |
| vehicles serialize | DTO에 좌표 노출 |

**마이그레이션:** 스키마 컬럼 추가 없음 (Snapshot JSON 확장). 기존 JSON은 다음 park nearby 성공 시 좌표 포함으로 갱신.

### 3.2 UI

```text
[위치]
  Map
    · 차량 마커 (기존)
    · 인근 충전소 마커 (sites with coords, max 5)  ← 목록과 동일 집합
  [인근 충전소] 리스트 (VD3-NB, max 5)
```

| 규칙 | |
|------|--|
| `nearbySites.length === 0` | 차량만 (현행) |
| 목록 있음 · 좌표 있음 | 마커 표시 |
| fitBounds | 차량 + 유효 충전소 좌표 |

### 3.3 `VehicleMap` API (권고)

```ts
nearbySites?: Array<{
  id: string; // name+lat+lng 등
  name: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  siteType?: "destination" | "supercharger" | null;
}>;
```

상세만 prop 전달. 목록/`/map`은 prop 미전달 → 회귀 없음.

---

## 4. 수용 기준

1. park nearby(또는 카탈로그) 후 목록이 보이면, **같은 사이트**가 맵에 핀으로 보인다 (좌표 있는 건).
2. 목록 상위 5와 맵 마커 집합이 **일치**한다.
3. 목록 없으면 충전소 마커 **없음**.
4. 차량 마커·선택 카드 숨김 등 기존 상세 맵 동작 유지.
5. 플릿 `/map`·목록 맵 **회귀 없음**.
6. 구형 nearby JSON(좌표 없음): 리스트만 · 마커 0 · 크래시 없음.
7. Supercharger / Destination 시각 구분 가능.

---

## 5. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **VD3-NM-1** | 본 문서 승인 (GO) | ✅ |
| **VD3-NM-2** | Site/DTO·mapper·catalog에 좌표·siteType 보존 · API 노출 | ✅ |
| **VD3-NM-3** | `VehicleMap` nearby 마커 + bounds · V3 연결 (리스트와 동일 5건) | ✅ |
| **VD3-NM-4** | (선택) 목록↔마커 연동 · InfoWindow | ☐ |
| **VD3-NM-5** | 실차: REST/카탈로그 각각 맵 핀 검수 | ☐ |

체크리스트: [checklist-vehicle-detail-vd3.md](./checklist-vehicle-detail-vd3.md)

---

## 6. 의견 · 진행 여부

### 판단: **GO → 코드 반영 (NM-2·3 ✅)**

| 근거 | |
|------|--|
| 제품 | 「목록만 km」→「맵에서 방향」은 관제 가치가 명확 |
| 기술 | Naver Marker + fitBounds · 좌표 보존 선행 완료 |
| 리스크 | 낮음 — 구형 JSON 하위호환 · `/map` prop 미전달 |

### 주의

- 기존 Snapshot nearby는 좌표가 비어 있을 수 있음 → **한 번 park nearby(또는 폴백) 갱신** 후 핀이 생김.
- 마커는 리스트와 동일 **상위 5개** · Supercharger=`SC`(빨강) / Destination=`DC`(틸).

---

## 7. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-16 | 초안 — 상세 맵 충전소 마커 · 좌표 파이프 갭 · GO(조건부) |
| 2026-07-16 | NM-2·3 코드 ✅ — 좌표 보존 · VehicleMap 마커·fitBounds · V3 연결 |
