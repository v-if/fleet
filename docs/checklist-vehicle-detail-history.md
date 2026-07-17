# Phase VD3-H — 주행·충전 히스토리 체크리스트

관련: [requirements-vehicle-detail-history.md](./requirements-vehicle-detail-history.md)  
상태: **코드 ✅ · migrate ✅ · 실차 ☐**

---

## Phase ↔ ID

| ID | 내용 | 상태 |
|----|------|:----:|
| VD3-H-0 | 문서 승인 | ✅ |
| VD3-H-1 | FSM verify (`npm run vd3-h:verify`) | ✅ |
| VD3-H-2 | `VehicleActivitySession` · writer FSM | ✅ |
| VD3-H-3 | `GET .../activity` · VD3 1카드+필터 | ✅ |
| VD3-H-4 | 실차 검수 | ☐ |
| VD3-H-5 | 가상 시드 · 노이즈 필터 / retention 보류 | ✅ / ☐ |

---

## 구현 산출물

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | migrate `20260718070000_vd3_h_activity_session` | ✅ |
| 2 | `src/lib/vehicle-activity-session.ts` | ✅ |
| 3 | Telemetry / REST / ASLEEP FSM 훅 | ✅ |
| 4 | `GET /api/vehicles/[id]/activity` | ✅ |
| 5 | `VehicleActivityHistoryCard` · VD3 배치 | ✅ |
| 6 | 가상 차량 샘플 세션 시드 | ✅ |
| 7 | `npm run vd3-h:verify` | ✅ |

---

## 실차 검수 (H-4)

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | 주행 1회 → 상세 「최근 이력」에 주행 행 · 거리 근사 | ☐ |
| 2 | 충전 1회 → 충전 행 · SoC 시작→끝 · 완속/급속 | ☐ |
| 3 | 진행 중 주행/충전 시 「진행 중」뱃지 | ☐ |
| 4 | 필터 전체/주행/충전 | ☐ |
| 5 | Empty 카피 · Telemetry 추정 고지 | ☐ |

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-18 | 초안 — H-0~3·H-5 코드 완료 · H-4 실차 남음 |
