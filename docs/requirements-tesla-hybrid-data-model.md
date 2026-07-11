# Telemetry + Fleet API 하이브리드 — 데이터 모델 · 구현 설계

## 1. 문서 개요

| 항목 | 내용 |
|------|------|
| 목적 | [하이브리드 호출](./requirements-tesla-fleet-api-telemetry-webhook.md) + [표시 데이터](./requirements-tesla-fleet-api-display-data.md) + [모델 매핑](./requirements-tesla-fleet-api-model-mapping.md)을 **DB·동기화·UI 구현**으로 연결하는 설계서 |
| 범위 | 스키마, 쓰기 경로, 온보딩/쿨다운 상태, 구현 Phase 체크리스트 |
| 코드 | **미착수** — 본 문서·체크리스트 확정 후 구현 |
| 작성일 | 2026-07-11 |

### 1.1 설계 목표

1. **정적 / 동적 분리** — Telemetry가 제원을 덮어쓰지 않음.
2. **하이브리드 상태 1곳에** — Lifecycle·쿨다운·Baseline을 Snapshot append와 분리.
3. **기존 테이블 최대 재사용** — `Vehicle` + `VehicleSnapshot` + `TelemetrySubscription` 확장 우선.
4. **조회 효율** — 목록/상세는 Vehicle(제원) ⋈ 최신 Snapshot(동적) 한 조회로 충분.

---

## 2. As-Is 문제

| 문제 | 영향 |
|------|------|
| `Vehicle`에 `car_type`/`trim`/`color` 없음 | 표시 모델명이 `model` 문자열에만 의존, 재매핑·필터 어려움 |
| Lifecycle이 DB에 없음 | VK/Telemetry ready/Baseline 진행을 코드·UI가 추적 못함 |
| `lastRestSyncAt`이 Snapshot 행에만 존재 | Snapshot이 append-only라 쿨다운 조회가 “최신 행 탐색”에 의존·불명확 |
| 정적/동적 쓰기 경계 미문서화 | registry/full sync가 제원·스냅샷을 섞을 위험 |

---

## 3. To-Be 데이터 레이어

```
┌─────────────────────────────────────────────────────────────┐
│ Vehicle                         【정적·준정적 제원】          │
│  plateNumber, model(표시용), year, oemVehicleId             │
│  carType, trimBadging, exteriorColor, specsSyncedAt         │
│  teslaDisplayName (선택)                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │ 1:1
┌──────────────────────▼──────────────────────────────────────┐
│ VehicleSyncState                【하이브리드 제어 상태】      │
│  lifecycle, VK/Telemetry/Baseline 시각                      │
│  lastRestSyncAt, lastRestSyncReason (쿨다운 SoT)            │
└──────────────────────┬──────────────────────────────────────┘
                       │ 1:N (append)
┌──────────────────────▼──────────────────────────────────────┐
│ VehicleSnapshot                 【동적 관제 스냅샷】          │
│  SoC, 위치, 충전, 잠금, TPMS, lastTelemetryAt, …            │
│  telemetrySource, isAsleepInferred                          │
└─────────────────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ TelemetrySubscription           【구독·allowlist】           │
│  active, synced 힌트(확장), lastError                       │
└─────────────────────────────────────────────────────────────┘
```

| 레이어 | 갱신 주체 | 갱신 빈도 |
|--------|-----------|-----------|
| Vehicle (제원) | Baseline / 수동 제원 재동기화만 | 거의 불변 |
| VehicleSyncState | 온보딩·wake sync·fallback | 이벤트 |
| VehicleSnapshot | Telemetry 상시 + REST 이벤트 시 | 초~분 |
| TelemetrySubscription | config/unlink | 드묾 |

---

## 4. 스키마 변경안 (확정 제안)

### 4.1 Enum 추가

```prisma
enum VehicleLifecycle {
  REGISTERED          // OAuth·Vehicle 생성
  KEY_PENDING         // VK 페어링 대기
  TELEMETRY_PENDING   // config 등록·synced 대기
  READY               // 관제 가능 (Telemetry 및/또는 Baseline)
}

enum RestSyncReason {
  BASELINE            // 온보딩 1회 vehicle_data
  WAKE_COOLDOWN       // ASLEEP→ONLINE 쿨다운 후 1회
  MANUAL_FALLBACK     // 사용자 ?fallback=1 / 제원 재동기화
  SPECS_REFRESH       // 정적 제원만 수동 갱신
}
```

> `VehicleStatus`(ONLINE/ASLEEP/…)는 **운행 표시**용으로 유지. Lifecycle과 섞지 않음.

### 4.2 `Vehicle` 컬럼 추가 (정적)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `carType` | `String?` | `vehicle_config.car_type` (예: `modely`) |
| `trimBadging` | `String?` | `vehicle_config.trim_badging` (예: `50`) |
| `exteriorColor` | `String?` | `vehicle_config.exterior_color` |
| `teslaDisplayName` | `String?` | Fleet `display_name` (준정적) |
| `specsSyncedAt` | `DateTime?` | 제원 마지막 저장 시각 |
| `model` | 기존 | `carType`+`trimBadging` 매핑 결과 표시 문자열 ([model-mapping](./requirements-tesla-fleet-api-model-mapping.md)) |

**쓰지 않는 것**: `wheel_type`/`roof_color`는 P1 이후. JSON blob 제원 테이블은 조회·인덱스에 불리해 **정규 컬럼 우선**.

### 4.3 신규 `VehicleSyncState` (1:1) — 권장

쿨다운·Lifecycle을 Snapshot과 분리하는 것이 append-only 모델에서 가장 효율적이다.

```prisma
model VehicleSyncState {
  vehicleId              String          @id
  vehicle                Vehicle         @relation(...)
  lifecycle              VehicleLifecycle @default(REGISTERED)
  virtualKeyConfirmedAt  DateTime?
  telemetryConfigSyncedAt DateTime?
  baselineCompletedAt    DateTime?
  baselineLastError      String?
  lastRestSyncAt         DateTime?       // 쿨다운 SoT
  lastRestSyncReason     RestSyncReason?
  lastWakeDetectedAt     DateTime?       // ASLEEP→ONLINE 감지
  updatedAt              DateTime        @updatedAt

  @@index([lifecycle])
  @@index([lastRestSyncAt])
}
```

| 필드 | 용도 |
|------|------|
| `lifecycle` | 온보딩 UI·API 가드 |
| `lastRestSyncAt` | `TESLA_REST_WAKE_COOLDOWN_MINUTES` 판정 |
| `lastRestSyncReason` | 감사·디버그 |
| `baselineCompletedAt` | Baseline 성공 여부 (READY와 독립 가능) |

**대안(비권장)**: Snapshot에만 `lastRestSyncAt` 유지 — 최신 행 조회 비용·레이스 증가.

### 4.4 `TelemetrySubscription` 확장 (준정적)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `configSynced` | `Boolean` | `fleet_telemetry_config.synced` 캐시 |
| `configCheckedAt` | `DateTime?` | 마지막 config 조회 |

### 4.5 `VehicleSnapshot` — 유지 + 정리

| 결정 | 내용 |
|------|------|
| 유지 | 동적 필드 전부, append 정책, `lastTelemetryAt`, `isAsleepInferred` |
| 유지 | `lastRestSyncAt` 컬럼은 **호환용으로 남겨도 됨** — 쓰기는 `VehicleSyncState`가 SoT, Snapshot에는 REST 성공 시 미러링 가능 |
| 변경 없음(P0) | TPMS·공조 등 기존 컬럼. Telemetry 미지원 필드는 REST 이벤트 시에만 채움 |

### 4.6 만들지 않는 것 (의도적)

| 후보 | 이유 |
|------|------|
| `VehicleSpecs` 별도 테이블 | 1:1이면 Vehicle 컬럼이 단순 |
| Redis 쿨다운 | Supabase로 충분 ([webhook 문서](./requirements-tesla-fleet-api-telemetry-webhook.md) §5.5) |
| 필드별 EAV | 쿼리·타입 불리 |
| Snapshot을 “latest only”로 전환 | 이력·감사에 append가 유리. 필요 시 이후 `VehicleLatest` 뷰 |

---

## 5. 쓰기 경로 규칙 (구현 계약)

| 이벤트 | Vehicle 제원 | SyncState | Snapshot |
|--------|:------------:|:---------:|:--------:|
| OAuth + registry (`list`+`fleet_status`) | VIN·displayName만 | → `REGISTERED`/`KEY_PENDING` | **생성 안 함** |
| VK 확인 | — | → `TELEMETRY_PENDING`, `virtualKeyConfirmedAt` | — |
| Telemetry config synced | — | `telemetryConfigSyncedAt`, → `READY` 가능 | — |
| Baseline `vehicle_data` 성공 | **제원 upsert** + `model` 매핑 | `baselineCompletedAt`, `lastRestSyncAt=BASELINE` | 동적 1행 |
| Telemetry V 수신 | **금지** | ASLEEP→ONLINE 시 `lastWakeDetectedAt`; 쿨다운 시 REST 트리거 | 동적 merge/create |
| Wake 쿨다운 `vehicle_data` | 제원 **덮지 않음** (SPECS_REFRESH 제외) | `lastRestSyncAt=WAKE_COOLDOWN` | 동적 갱신(TPMS 등) |
| 수동 fallback | 정책에 따라 제원 갱신 가능 | `MANUAL_FALLBACK` | 동적 |
| 자동 wake_up | — | — | **금지** |

매핑 함수: `buildDisplayModel(carType, trimBadging)` → `Vehicle.model` ([model-mapping](./requirements-tesla-fleet-api-model-mapping.md)).

---

## 6. 조회 패턴

```
목록/대시보드:
  Vehicle
  + VehicleSyncState (lifecycle 배지)
  + 최신 VehicleSnapshot (orderBy lastUpdatedAt desc take 1)
  WHERE unlinkedAt IS NULL AND isDeleted = false

상세:
  동일 + TelemetrySubscription
```

인덱스: 기존 `VehicleSnapshot(vehicleId, lastUpdatedAt)` 유지. SyncState는 `vehicleId` PK로 충분.

---

## 7. 환경변수 (구현 시)

| 변수 | 기본 | 문서 |
|------|------|------|
| `TESLA_REST_WAKE_COOLDOWN_MINUTES` | `30` | webhook §7 |
| `TESLA_BASELINE_ON_READY` | `true` | webhook §7 |
| 기존 Telemetry/stale/primary | 유지 | Phase 4.2 |

---

## 8. 구현 Phase (체크리스트 본문)

상세 체크 항목은 [checklist-tesla-hybrid-data.md](./checklist-tesla-hybrid-data.md) 및 [development-checklist.md](./development-checklist.md) **Phase 4.4**.

| Phase | 내용 | 코드 |
|-------|------|------|
| **4.4.A** | 스키마·마이그레이션·시드 | ✅ `20260711120000_phase44a_hybrid_data_model` (2026-07-11) |
| **4.4.B** | Sync 로직 (Baseline·쿨다운·제원 분리) | 미착수 |
| **4.4.C** | Telemetry processor ↔ SyncState | 미착수 |
| **4.4.D** | API/UI (lifecycle·제원 카드·모델 표시) | 미착수 |
| **4.4.E** | 검증·감사 로그·문서 마감 | 미착수 |

---

## 9. 관련 문서

| 문서 | 역할 |
|------|------|
| [requirements-tesla-fleet-api-telemetry-webhook.md](./requirements-tesla-fleet-api-telemetry-webhook.md) | 호출 알고리즘 |
| [requirements-tesla-fleet-api-display-data.md](./requirements-tesla-fleet-api-display-data.md) | 정적/동적·화면 후보 |
| [requirements-tesla-fleet-api-model-mapping.md](./requirements-tesla-fleet-api-model-mapping.md) | car_type/trim 매핑 |
| [checklist-tesla-hybrid-data.md](./checklist-tesla-hybrid-data.md) | 작업 체크리스트 |
| [requirements-db.md](./requirements-db.md) | DB/Supabase 운영 |

---

## 10. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-11 | 초안 — Vehicle 제원 컬럼 + VehicleSyncState 1:1, 쓰기 경로, Phase 4.4 설계 (코드 미착수) |
| 2026-07-11 | 4.4.A 적용 — Prisma enum/컬럼/VehicleSyncState, Supabase migrate·backfill 완료 |
