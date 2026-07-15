# Phase NCS — 인근충전소 카탈로그 · asleep 폴백 체크리스트

관련: [requirements-nearby-charging-catalog.md](./requirements-nearby-charging-catalog.md)  
상태: **문서 ✅ · 코드 NCS-2~4 ✅ · 실차 ☐ · 공공 시드 ☐**

---

## Phase ↔ ID

| ID | 내용 | 상태 |
|----|------|:----:|
| NCS-1 | 요구 문서 승인 | ✅ |
| NCS-2 | ChargingStation · Upsert · REST 성공 적재 | ✅ |
| NCS-3 | REST 실패 → 카탈로그 폴백 · 빈 덮어쓰기 금지 | ✅ |
| NCS-4 | UI 출처 · mapper 좌표 · envelope `source` | ✅ |
| NCS-5 | 실차 검수 | ☐ |
| NCS-6 | 공공 EV / 전국 시드 | ☐ 후속 |

---

## 구현 산출물

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | Prisma `ChargingStation` · migrate `20260716040000_ncs_charging_station` | ✅ |
| 2 | `charging-station-catalog.ts` Upsert · query | ✅ |
| 3 | `extractNearbyCatalogSeeds` · `getNearbyChargingSitesResult` (실패 throw) | ✅ |
| 4 | `maybeRefreshNearbyOnPark` Tesla / catalog_fallback / empty | ✅ |
| 5 | nearby JSON `source` · UI 「Tesla 조회」/「저장된 충전소」 | ✅ |
| 6 | `npm run ncs:verify` · `.env.example` | ✅ |

---

## 실차 (NCS-5) ☐

VIN: `LRWYGCFJ7SC214742`

- [ ] Gear=P · REST 성공 → `ChargingStation` row · Snapshot `source=TESLA_REST`
- [ ] asleep 실패 · 동일 지역 재주차 → `source=CATALOG` 또는 empty(이전 유지)
- [ ] 미적재 신규 지역 · 실패 → 목록 없음 · 빈 Snapshot 덮어쓰기 없음
- [ ] Audit `source: tesla_rest | catalog_fallback | empty`
- [ ] 2km 이동 시 nearby 클리어 유지

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-16 | 체크리스트 · NCS-2~4 코드 ✅ |
|
