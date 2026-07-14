# Phase LN — Snapshot 위경도 null 체크리스트

관련 요구사항: [requirements-vehicle-location-null.md](./requirements-vehicle-location-null.md)  
상태: **LN-R 코드 ✅ · 실차 검수 ☐**  
관련: wake 쿨다운 REST · `writeRestSnapshot` · `mergeSnapshotCoordinates`

---

## 이슈 ↔ Phase

| ID | 요구 | Phase | 상태 |
|----|------|-------|:----:|
| LN-1 / 1b | 문서화 · LN-R 확정 | LN-Doc | ✅ |
| **LN-7** | `writeRestSnapshot` lat/lng `?? previous` | **LN-R** | ✅ |
| **LN-8** | REST 경로 픽스처/테스트 (`npm run ln:verify`) | **LN-R** | ✅ |
| LN-6 | 실차 검수 | LN-QA | ☐ |
| LN-2 | Location 파서 | LN-A | ☐ 선택 |
| LN-3 | Telemetry `lastUpdatedAt` | LN-B | ☐ 선택 |
| LN-4 | ASLEEP 좌표 fallback | LN-C | ☐ 선택 |

---

## LN-Doc — ✅

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | 요구사항 문서 | ✅ |
| 2 | Snapshot 타임라인으로 REST overwrite 확정 | ✅ |
| 3 | README / development-checklist | ✅ |

### 확정 타임라인 (회귀 기준)

- [x] `04:56:36` TELEMETRY · Location **있음**
- [x] `04:56:40` REST · Location **null** ← 유실 시작 (수정 전)
- [x] `04:57:33` TELEMETRY · Location null (merge 전파)

---

## LN-R — REST 좌표 merge ✅

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | `mergeSnapshotCoordinates` + `writeRestSnapshot` 적용 | ✅ |
| 2 | wake / gear / baseline / manual 등 전 호출 경로에 적용 | ✅ (`writeRestSnapshot` 공통) |
| 3 | REST에 usable GPS 있으면 갱신(덮어쓰기) 유지 | ✅ |
| 4 | `npm run ln:verify` (LN-8) | ✅ |
| 5 | previous 없을 때 vehicleId로 최신 Snapshot 재조회 | ✅ |

구현:

- `src/lib/tesla/hybrid/coordinates.ts`
- `src/lib/tesla/hybrid/rest-sync.ts`
- `scripts/verify-ln-rest-coordinates.mjs`

---

## LN-A / LN-B / LN-C — 선택 ☐

본 건 **비필수**. LN-R 후 잔여 증상 있으면.

| Phase | 항목 | 상태 |
|-------|------|:----:|
| LN-A | `readLocation` 보강 | ☐ |
| LN-B | Telemetry `lastUpdatedAt` B1 | ☐ |
| LN-C | ASLEEP non-null fallback | ☐ |

---

## LN-QA — 실차 검수 ☐

VIN: `LRWYGCFJ7SC214742`

- [ ] ASLEEP→ONLINE · wake REST 후에도 **최신 Snapshot** 위경도 유지
- [ ] SyncReason `WAKE_COOLDOWN` / Audit wake REST 성공 구간과 대조
- [ ] 이후 Telemetry(Location 없음)·ASLEEP에도 좌표 null 아님
- [ ] REST에 GPS 있으면 새 좌표로 갱신
- [ ] UI 위치·지도 일치

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-15 | 초안 (LN-A/B 가설) |
| 2026-07-15 | **LN-R 확정** · Phase LN-R(LN-7/8) 우선으로 개정 |
| 2026-07-15 | **LN-7·LN-8 구현 완료** · LN-QA 실차 남음 |
