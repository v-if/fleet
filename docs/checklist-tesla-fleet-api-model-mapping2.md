# Phase MM2 — Snapshot 변속·충전기 출력 매핑 체크리스트

관련 요구사항: [requirements-tesla-fleet-api-model-mapping2.md](./requirements-tesla-fleet-api-model-mapping2.md)  
상태: **MM2-A~B 구현 완료** · MM2-C(AC/DC 분리) 보류 · DB migrate·실차 검수 남음

---

## 이슈 ↔ Phase

| ID | 요구 | Phase | 상태 |
|----|------|-------|:----:|
| MM2-1 | `VehicleSnapshot.shiftState` 마이그레이션 | MM2-A | ✅ |
| MM2-2 | REST `shift_state` → 정규화 저장 | MM2-A | ✅ |
| MM2-3 | Telemetry `Gear` → merge `shiftState` | MM2-A | ✅ |
| MM2-4 | DTO·상세 「변속」 노출 | MM2-B | ✅ |
| MM2-5 | `chargerPowerKw` 회귀(변경 없음) | MM2-B | ✅ As-Is |
| MM2-6 | AC/DC 분리·`chargingPowerKind` | MM2-C | ☐ 보류 |

---

## MM2-A — 스키마·쓰기

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| 1 | Prisma `shiftState String?` + migration `20260714150000_mm2_snapshot_shift_state` | ✅ | |
| 2 | 공유 `normalizeShiftState` (`ShiftStateP`→`P` 등) | ✅ | `src/lib/tesla/shift-state.ts` |
| 3 | REST mapper → `shiftState` + `ignitionOn` 정합 | ✅ | |
| 4 | Telemetry merge `shiftState: current ?? previous` | ✅ | |
| 5 | rest-sync·asleep/wake Snapshot copy에 `shiftState` | ✅ | |

---

## MM2-B — DTO·UI

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| 1 | `VehicleSnapshotDto.shiftState` | ✅ | |
| 2 | 상세 요약 「변속」 | ✅ | `FleetVehicleDetailView` |
| 3 | Mock·가상 차량 시드 | ✅ | |

---

## 수동 검수

- [ ] `npx prisma migrate deploy` (또는 dev) 로 컬럼 적용
- [ ] REST Baseline 후 Snapshot `shiftState`가 `P`/`D` 등으로 저장
- [ ] Telemetry `Gear: ShiftStateD` ingress → 최신 Snapshot `D`, 다른 필드 희소 merge
- [ ] BF-C `=== "P"` 트리거 정상
- [ ] 상세 화면 「변속」·「충전기 출력」 표시

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-14 | MM2-A~B 체크리스트 · 구현 완료 반영 |
