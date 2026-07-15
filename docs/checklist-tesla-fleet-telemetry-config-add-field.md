# Phase CAF — Telemetry Config 필드 확장 체크리스트

관련 요구사항: [requirements-tesla-fleet-telemetry-config-add-field.md](./requirements-tesla-fleet-telemetry-config-add-field.md)  
현행 create: [requirements-tesla-fleet-telemetry-config.md](./requirements-tesla-fleet-telemetry-config.md)  
상태: **CAF-2~4 코드 ✅ · CAF-6 실차 ☐**  
검증: `npm run caf:verify`

---

## 이슈 ↔ Phase

| ID | 요구 | Phase | 상태 |
|----|------|-------|:----:|
| **CAF-1** | P0/P1/P2·REST-1 필드 정의 | CAF-Doc | ✅ |
| **CAF-2** | `DEFAULT_TELEMETRY_FIELDS` ← §4 · `Version` 제거 | CAF-Config | ✅ |
| **CAF-3** | mapper · Snapshot — P1 신규 파싱/저장 | CAF-Mapper | ✅ |
| **CAF-4** | UI Speed/Heading/ETA/충전·경고 | CAF-UI | ✅ |
| **CAF-5** | REST-1 제원을 Baseline/연동 문서·체크리스트에 명시 | CAF-REST | ✅ 문서 |
| **CAF-6** | 실차 DELETE+재구독 · GET config ⊇ §4 | CAF-QA | ☐ |

---

## CAF-Doc — ✅

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | 요구사항 | ✅ |
| 2 | 본 체크리스트 | ✅ |
| 3 | README · development-checklist | ✅ |

---

## CAF-Config — ✅

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | `src/lib/tesla/telemetry/default-fields.ts` — **44키** P0+P1 | ✅ |
| 2 | `Version` 제거 → REST-1 | ✅ |
| 3 | 금지 키 미포함 | ✅ |
| 4 | `createFleetTelemetryConfig` → `getDefaultTelemetryFields()` | ✅ |
| 5 | `npm run caf:verify` | ✅ |
| 6 | 현행 config 문서 §3 To-Be 동기화 | ✅ |

---

## CAF-Mapper — ✅

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | Prisma migrate `20260715120000_caf_telemetry_p1_fields` | ✅ |
| 2 | `mapper.ts` P1 파싱 · Invalid 필터 | ✅ |
| 3 | `mergeCafSnapshotFields` · processor / REST / ASLEEP 복사 | ✅ |
| 4 | DTO `VehicleSnapshotDto` · `serializeSnapshot` | ✅ |

---

## CAF-UI — ✅

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | 충전 카드 — ETA·A·포트·급속·Detailed | ✅ |
| 2 | 상세 — 속도/방위 · TPMS Hard 경고 | ✅ |
| 3 | 상세 — 목적지/ETA · OTA 요약 | ✅ |
| 4 | 제원 헤더는 REST-1 (Telemetry Version 미구독) | ✅ |

지도 마커 Heading 회전·대시보드 Speed KPI는 후속 가능.

---

## CAF-REST — ✅ 문서

| # | 항목 | 상태 |
|---|------|:----:|
| 1~4 | §5 명시 · hybrid/setup | ✅ |
| 5 | Telemetry 제원 미포함 실차 교차 | ☐ CAF-6 |

---

## CAF-QA — 실차 ☐

VIN: `LRWYGCFJ7SC214742`

- [ ] disconnect → reconnect 로 config **재발행**
- [ ] GET fields ⊇ §4 (44키) · `Version` 없음
- [ ] Ingress P1 샘플 · Snapshot/UI 반영
- [ ] `prisma migrate deploy` (Production)

---

## 구현 파일

- `src/lib/tesla/telemetry/default-fields.ts`
- `src/lib/tesla/telemetry/caf-fields.ts`
- `src/lib/tesla/telemetry/mapper.ts` · `processor.ts` · `client.ts`
- `src/lib/tesla/hybrid/rest-sync.ts`
- `prisma/schema.prisma` · `migrations/20260715120000_caf_telemetry_p1_fields`
- `ChargingSessionCard.tsx` · `FleetVehicleDetailView.tsx`
- `scripts/verify-caf-telemetry-fields.mjs`

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-15 | CAF 체크리스트 작성 (코드 미착수) |
| 2026-07-15 | **CAF-2~4 구현** · caf:verify · 실차 CAF-6 남음 |
