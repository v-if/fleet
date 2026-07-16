# Phase VD3 — 차량 상세 Telemetry 시대 IA 체크리스트

관련: [requirements-vehicle-detail-vd3.md](./requirements-vehicle-detail-vd3.md)  
상태: **문서 ✅ · 기본 상세 = VD3 (`/vehicles/[id]`) · v2 보존 · 실차 ☐**

---

## Phase ↔ ID

| ID | 내용 | 상태 |
|----|------|:----:|
| VD3-1 | 요구 문서 · 병렬 URL 전략 | ✅ |
| VD3-1b | `/vehicles/[id]` 기본 · `/vehicles/[id]/v2` 이전 | ✅ |
| VD3-2 | Hero · 가동모드 · 관제 요약 | ✅ |
| VD3-3 | CAF 조건부 (충전·주행 목적지·공조 Precondition·OTA) | ✅ |
| VD3-4 | nearby 신뢰 empty 문구 | ✅ |
| VD3-5 | 운행 요약·이벤트 | ☐ 후속 |
| VD3-6 | 실차 비교 검수 (기본 vs v2) | ☐ |
| VD3-7 | 컷오버 — 기본 URL VD3 · v2 보존 · `/v3`→기본 리다이렉트 | ✅ |
| **VD3-S** | Hero `i` 제원 모달 ([요구](./requirements-vehicle-detail-vd3-specs-popover.md)) | ✅ 코드 · ☐ 실차 |
| **VD3-N** | Hero 표시명 연필 편집 ([요구](./requirements-vehicle-detail-vd3-display-name.md)) | ✅ 코드 · ☐ 실차 |
| **VD3-R** | PC·모바일 툴바 통일 · v2 링크 제거 ([요구](./requirements-vehicle-detail-vd3-responsive-toolbar.md)) | ✅ 코드 · ☐ 검수 |
| **VD3-NB** | 인근충전소 목록 있을 때만 ([요구](./requirements-vehicle-detail-vd3-nearby-block.md)) | ✅ |
| **VD3-DC** | 주행 목적지 주차·절전 클리어 ([요구](./requirements-vehicle-detail-vd3-destination-clear.md)) | ✅ 코드 · ☐ 실차 |
| **VD3-DCf** | 속도·도착 SoC 클리어 범위 ([요구](./requirements-vehicle-detail-vd3-trip-clear-fields.md)) | ✅ 코드 · ☐ 실차 |
| **VD3-NM** | 인근충전소 지도 마커 ([요구](./requirements-vehicle-detail-vd3-nearby-map.md)) | ✅ 코드 · ☐ 실차 |
| **VD3-NL** | 목록·맵 A–E 기호 ([요구](./requirements-vehicle-detail-vd3-nearby-labels.md)) | ✅ 코드 · ☐ 실차 |

---

## 구현 산출물

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | `FleetVehicleDetailViewV3` · `vehicle-detail-v3.ts` | ✅ |
| 2 | admin 라우트 `src/app/(admin)/vehicles/[id]/page.tsx` (VD3) | ✅ |
| 2b | 이전 상세 `src/app/(admin)/vehicles/[id]/v2/page.tsx` | ✅ |
| 3 | v2 「현재 상세」· 기본 「이전 상세 (v2)」상호 링크 | ✅ |
| 4 | 목록·위젯 링크 `/vehicles/{id}` (기본 VD3) | ✅ |
| 5 | 구 `/v3` URL → `/vehicles/{id}` 리다이렉트 | ✅ |
| 6 | Hero `i` · Specs Modal · 하단 제원 카드 제거 (VD3-S) | ✅ |
| 7 | Hero 연필 · 표시명 인라인 편집 · PATCH API (VD3-N) | ✅ |
| 8 | `FleetToolbar layout="inline"` · v2 UI 링크 제거 (VD3-R) | ✅ |
| 9 | 인근충전소: sites>0일 때만 블록 (VD3-NB) | ✅ |
| 10 | 목적지·ETA: P/절전 시 Snapshot 클리어 (VD3-DC) | ✅ |
| 11 | nearby 좌표 보존 · 맵 마커·fitBounds (VD3-NM) | ✅ |
| 12 | 목록·맵 A–E 기호 매칭 · 목록 SC/DC 뱃지 (VD3-NL) | ✅ |
| 13 | 트립 클리어 확장: speed·SoC 잔상 · 카드 게이트 (VD3-DCf) | ✅ |

---

## 실차 비교 (VD3-6 · VD3-S-4) ☐

VIN: `LRWYGCFJ7SC214742`

- [ ] 동일 차량 기본 `/vehicles/{id}` · 이전 `/vehicles/{id}/v2` 나란히
- [ ] 가동모드 · SoC · 지도 · nearby empty/목록
- [ ] 충전 중 Dynamic 카드 · 주행 중 목적지 카드
- [ ] 재연동/제원 CTA · Hero `i`로 제원 모달
- [ ] 관제 요약 문구가 업무 언어인지
- [ ] Hero `i` · 제원 모달(연식·휠·루프·포트·AP HW) · 하단 제원 카드 없음
- [ ] Hero 연필 · 표시명 저장/취소 · 제원 재조회 후 이름 유지

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-15 | 체크리스트 작성 · VD3-1b~4 코드 ✅ |
| 2026-07-16 | VD3-S 제원 `i` 모달 요구 링크 |
| 2026-07-16 | VD3-S-2·S-3 코드 ✅ · 실차 S-4 ☐ |
| 2026-07-16 | VD3-N-2·N-3 코드 ✅ · 실차 N-4 ☐ |
| 2026-07-16 | VD3-7 컷오버 — `/vehicles/[id]` 기본 VD3 · v2 보존 · `/v3` 리다이렉트 |
| 2026-07-16 | VD3-R 상단 툴바 PC·모바일 통일 · v2 링크 제거 요구 링크 |
| 2026-07-16 | VD3-R-2 코드 ✅ · 검수 R-3 ☐ |
| 2026-07-16 | VD3-NB 인근충전소 조건부 블록 요구 링크 |
| 2026-07-16 | VD3-NB-2·3 코드 ✅ — empty 숨김 · `nearbyEmptyReason` 삭제 |
| 2026-07-16 | VD3-DC 목적지 클리어 요구 링크 |
| 2026-07-16 | VD3-DC-2·3 코드 ✅ · 실차 DC-4 ☐ |
| 2026-07-16 | VD3-DCf 속도·도착 SoC 클리어 범위 요구 링크 |
| 2026-07-16 | VD3-DCf-2·3·4 코드 ✅ — speed 클리어 · P coalesce · 카드 게이트 |
| 2026-07-16 | VD3-NM 인근충전소 지도 마커 요구 링크 |
| 2026-07-16 | VD3-NM-2·3 코드 ✅ — 좌표 보존 · 맵 핀 · 실차 NM-5 ☐ |
| 2026-07-16 | VD3-NL 목록·맵 A–E 기호 매칭 요구 링크 |
| 2026-07-16 | VD3-NL-2·3 코드 ✅ — 리스트 뱃지 · 마커 label |
| 2026-07-16 | VD3-NL-5 코드 ✅ — 목록 SC/DC 보조 뱃지 |
| 2026-07-16 | VD3-N 표시명 연필 편집 요구 링크 |
|
