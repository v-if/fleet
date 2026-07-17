# Phase VD3-SOH — 완충(한도) 잔여 km 추이 체크리스트

관련: [requirements-vehicle-detail-soh.md](./requirements-vehicle-detail-soh.md)  
상태: **코드 ✅ · migrate ✅ · 실차 ☐**

---

## Phase ↔ ID

| ID | 내용 | 상태 |
|----|------|:----:|
| VD3-SOH-0 | 문서 승인 | ✅ |
| VD3-SOH-1 | `endRangeKm` 캡처 · migrate | ✅ |
| VD3-SOH-2 | 샘플 API · verify | ✅ |
| VD3-SOH-3 | VD3 UI 카드+차트 | ✅ |
| VD3-SOH-4 | 가상 시드 | ✅ |
| VD3-SOH-5 | 실차 검수 | ☐ |

---

## 구현 산출물

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | migrate `20260718080000_vd3_soh_end_range` | ✅ |
| 2 | FSM `rangeKm`/`chargeLimitSoc` · `sohSampleEligible` | ✅ |
| 3 | `GET /api/vehicles/[id]/soh` | ✅ |
| 4 | `VehicleSohCard` (ApexCharts) | ✅ |
| 5 | 가상 시드 10점 하락 곡선 | ✅ |
| 6 | `npm run vd3-soh:verify` | ✅ |

---

## 실차 검수 (SOH-5)

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | 한도 도달 충전 후 세션에 `endRangeKm`·eligible | ☐ |
| 2 | 상세 차트 3점 이상 시 표시 | ☐ |
| 3 | Empty 카피 · 추정 고지 | ☐ |

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-18 | SOH-0~4 코드 ✅ · SOH-5 실차 ☐ |
