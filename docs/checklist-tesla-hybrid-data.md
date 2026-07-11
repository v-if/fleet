# 체크리스트 — Telemetry + Fleet API 하이브리드 데이터 (Phase 4.4)

> **상태**: **A·B 완료** (2026-07-11) / C~E 미착수  
> **설계서**: [requirements-tesla-hybrid-data-model.md](./requirements-tesla-hybrid-data-model.md)  
> **호출 정책**: [requirements-tesla-fleet-api-telemetry-webhook.md](./requirements-tesla-fleet-api-telemetry-webhook.md)  
> **표시·매핑**: [requirements-tesla-fleet-api-display-data.md](./requirements-tesla-fleet-api-display-data.md), [requirements-tesla-fleet-api-model-mapping.md](./requirements-tesla-fleet-api-model-mapping.md)

---

## 0. 선행 (문서) — ✅

- [x] 하이브리드 호출 요구사항 확정
- [x] 정적/동적 표시 데이터 조사 문서화
- [x] 모델·트림 매핑 표 문서화
- [x] 데이터 모델·쓰기 경로 설계서 작성
- [x] development-checklist Phase 4.4 항목 연결

---

## A. 스키마 · 마이그레이션 — ✅

- [x] Prisma enum `VehicleLifecycle`, `RestSyncReason` 추가
- [x] `Vehicle` 컬럼: `carType`, `trimBadging`, `exteriorColor`, `teslaDisplayName`, `specsSyncedAt`
- [x] 신규 `VehicleSyncState` 1:1 모델 (lifecycle, baseline/쿨다운 시각, `lastRestSyncAt`)
- [x] `TelemetrySubscription`: `configSynced`, `configCheckedAt` (선택·권장)
- [x] 마이그레이션 파일 작성 · `prisma migrate` (로컬·Supabase) — `20260711120000_phase44a_hybrid_data_model`
- [x] 기존 Vehicle 행에 `VehicleSyncState` backfill (`REGISTERED` 또는 구독 있으면 `READY` 추정 규칙 문서화)
- [x] 가상 차량 시드에 제원 컬럼·SyncState 반영
- [x] `.env.example`: `TESLA_REST_WAKE_COOLDOWN_MINUTES`, `TESLA_BASELINE_ON_READY`

**완료 기준**: migrate 성공, 기존 로그인·빈 플릿 상태에서 앱 기동 가능 — **충족 (2026-07-11)**

**Backfill 규칙** (migration SQL):
- 활성 `TelemetrySubscription` 있으면 `lifecycle=READY`, `telemetryConfigSyncedAt=now`, 구독 `configSynced=true`
- 없으면 `REGISTERED`
- Snapshot에 `lastRestSyncAt` 있으면 SyncState에 미러 + `lastRestSyncReason=MANUAL_FALLBACK` (이력 추정)

---

## B. 도메인 로직 · Sync — ✅

- [x] `buildDisplayModel(carType, trimBadging)` 유틸 — `src/lib/tesla/display-model.ts`
- [x] registry-only sync: Snapshot 미생성, SyncState lifecycle 힌트 (`fleet_status` key paired/unpaired)
- [x] Baseline 서비스: `runBaselineForVehicle` — 제원+Snapshot+`BASELINE`, **실패 시 wake 금지**
- [x] VK 확인: `POST /api/vehicles/[id]/virtual-key/confirm` → `TELEMETRY_PENDING` + 구독 ensure + 선택 Baseline
- [x] ASLEEP→ONLINE: Telemetry processor → `lastWakeDetectedAt` + 쿨다운 후 `WAKE_COOLDOWN` REST 0~1회
- [x] REST 경로: 제원 덮어쓰기 금지 (Baseline / 수동 `?fallback=1`만 `updateSpecs`)
- [x] Telemetry processor: Vehicle 제원 미갱신, Snapshot만 (+ lifecycle READY 승격)
- [x] 수동 `?fallback=1`: `MANUAL_FALLBACK` + audit metadata
- [x] 자동 `wake_up` 호출 경로 없음 (src 전역 검색 0건)

**완료 기준**: 코드·타입체크 완료. 실차 Baseline·쿨다운 Skip/Call 실측은 **E**에서 마감.

**주요 모듈**
| 모듈 | 역할 |
|------|------|
| `src/lib/tesla/display-model.ts` | 표시 model 매핑 |
| `src/lib/tesla/hybrid/sync-state.ts` | SyncState patch · 쿨다운 판정 |
| `src/lib/tesla/hybrid/rest-sync.ts` | Baseline · wake REST · VK confirm · writeRestSnapshot |
| `src/lib/vehicle-sync.ts` | registry/full/fallback 오케스트레이션 |
| `src/lib/tesla/telemetry/processor.ts` | wake 감지 · 쿨다운 트리거 |

---

## C. API · 응답 계약

- [ ] `/api/vehicles`, `/api/vehicles/[id]`에 제원·lifecycle·`lastRestSyncAt`·신선도 필드 노출
- [ ] 설정/온보딩: VK 확인·Baseline 재시도 엔드포인트(또는 기존 sync 확장)
- [ ] Telemetry status에 SyncState 요약(선택)
- [ ] 타입(`MapVehicle` 등) 및 Zod/공유 타입 갱신

**완료 기준**: API JSON에 `carType`/`model`/`lifecycle` 확인

---

## D. UI

- [ ] 목록: 매핑된 `model`·트림/색 뱃지(P0~P1)
- [ ] 상세: 제원 카드 (VIN, carType, trim, color, specsSyncedAt)
- [ ] 상세/설정: lifecycle 안내 (KEY_PENDING → QR, TELEMETRY_PENDING → 대기)
- [ ] 신선도: 마지막 Telemetry / 마지막 REST 시각
- [ ] ASLEEP 배지와 lifecycle READY 동시 표시 규칙
- [ ] (P1) 제원 수동 재동기화 버튼

**완료 기준**: 빈 DB → 가상 차량 / 실차 연동 플로우에서 제원·상태가 화면에 보임

---

## E. 검증 · 문서 마감

- [ ] `pnpm telemetry:check` + 실차 V 수신 후 Snapshot만 갱신·제원 불변 확인
- [ ] 쿨다운 내 재wake 시 `vehicle_data` 미호출 로그 확인
- [ ] 쿨다운 경과 후 1회 호출·`lastRestSyncAt` 갱신
- [ ] unlink 시 SyncState/Subscription 정리
- [ ] development-checklist Phase 4.4 체크 완료
- [ ] setup-guide에 env·온보딩 절 보강
- [ ] 본 체크리스트 완료일 기록

---

## 우선순위 요약

| 순서 | 작업 | 의존 |
|------|------|------|
| 1 | A 스키마 | 없음 — ✅ |
| 2 | B Baseline + 제원 쓰기 | A — ✅ |
| 3 | B 쿨다운 wake sync | A, Telemetry 수신 — ✅ |
| 4 | C API | B |
| 5 | D UI | C |
| 6 | E 검증 | D |

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-11 | **B 완료** — display-model, Baseline/wake REST, VK confirm API, processor 쿨다운, fallback 감사 |
| 2026-07-11 | **A 완료** — migrate `20260711120000_phase44a_hybrid_data_model`, SyncState backfill, 시드·env |
| 2026-07-11 | 초안 — Phase 4.4 A~E 체크리스트 (코드 미착수) |
