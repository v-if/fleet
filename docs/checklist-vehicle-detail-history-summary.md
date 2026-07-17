# Phase VD3-HS — 운행 요약 (히스토리·Hero) 체크리스트

관련: [requirements-vehicle-detail-history-summary.md](./requirements-vehicle-detail-history-summary.md)  
상태: **코드 ✅ · 스모크 ☐**

---

## Phase ↔ ID

| ID | 내용 | 상태 |
|----|------|:----:|
| VD3-HS-0 | 문서 승인 | ✅ |
| VD3-HS-1 | `summarizeVehicleActivity` · `vd3-h:verify` | ✅ |
| VD3-HS-2 | activity API `summary` · 히스토리 헤더 한 줄 | ✅ |
| VD3-HS-3 | detail `activitySummary` · Hero 관제 요약 | ✅ |
| VD3-HS-4 | 실차·가상 시드 스모크 | ☐ |

---

## 구현 산출물

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | `computeActivitySummaryFromSessions` · KST | ✅ |
| 2 | `GET .../activity` → `summary` | ✅ |
| 3 | `getVehicleDetail` → `activitySummary` | ✅ |
| 4 | `VehicleActivityHistoryCard` 헤더 한 줄 | ✅ |
| 5 | `buildOpsSummary` Hero 오늘/미운행 | ✅ |

---

## 스모크 (HS-4)

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | 가상 시드 차량 — 히스토리 헤더에 오늘 요약 | ☐ |
| 2 | Hero 관제 요약 — 오늘 km·시간 또는 미운행 N일 | ☐ |
| 3 | DRIVE 없는 차량 — Hero 줄 생략 | ☐ |

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-18 | 초안 |
| 2026-07-18 | HS-0~3 코드 ✅ · verify OK · HS-4 ☐ |
