# Phase VD3 — 차량 상세 Telemetry 시대 IA 체크리스트

관련: [requirements-vehicle-detail-vd3.md](./requirements-vehicle-detail-vd3.md)  
상태: **문서 ✅ · `/v3` 코드 ✅ · 실차 비교 ☐ · 컷오버 ☐**

---

## Phase ↔ ID

| ID | 내용 | 상태 |
|----|------|:----:|
| VD3-1 | 요구 문서 · 병렬 URL 전략 | ✅ |
| VD3-1b | `/vehicles/[id]/v3` · As-Is↔To-Be 상호 링크 | ✅ |
| VD3-2 | Hero · 가동모드 · 관제 요약 | ✅ |
| VD3-3 | CAF 조건부 (충전·주행 목적지·공조 Precondition·OTA) | ✅ |
| VD3-4 | nearby 신뢰 empty 문구 | ✅ |
| VD3-5 | 운행 요약·이벤트 | ☐ 후속 |
| VD3-6 | 실차 As-Is vs `/v3` 비교 | ☐ |
| VD3-7 | 컷오버 결정 | ☐ |

---

## 구현 산출물

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | `FleetVehicleDetailViewV3` · `vehicle-detail-v3.ts` | ✅ |
| 2 | admin 라우트 `src/app/(admin)/vehicles/[id]/v3/page.tsx` | ✅ |
| 3 | As-Is 「새 상세 (VD3)」링크 | ✅ |
| 4 | 동일 `useVehicleDetail` (fetch 공유) | ✅ |
| 5 | 목록 기본 링크는 As-Is 유지 | ✅ |

---

## 실차 비교 (VD3-6) ☐

VIN: `LRWYGCFJ7SC214742`

- [ ] 동일 차량 As-Is `/vehicles/{id}` · To-Be `/vehicles/{id}/v3` 나란히
- [ ] 가동모드 · SoC · 지도 · nearby empty/목록
- [ ] 충전 중 Dynamic 카드 · 주행 중 목적지 카드
- [ ] 제원 접힘 · 재연동/제원 CTA
- [ ] 관제 요약 문구가 업무 언어인지

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-15 | 체크리스트 작성 · VD3-1b~4 코드 ✅ |
|
