# Telemetry 검증 기간 REST Freeze · 이후 Baseline/Wake 재정의 (TRF)

| 항목 | 내용 |
|------|------|
| 목적 | **미졸업 Snapshot REST**를 막고, **재정의·졸업한 경로만** Freeze와 무관하게 허용한다. Telemetry SoT 검증과 온보딩 제원(Baseline)을 병행 |
| 배경 | wake/fallback REST가 Snapshot을 덮어 Ingress≠UI 혼선 (LN-R). Baseline은 TRF-B1 specs-only로 졸업해 Freeze 중에도 VIN당 1회 제원 REST 가능 |
| 관련 | [requirements-tesla-fleet-api-telemetry-webhook.md](./requirements-tesla-fleet-api-telemetry-webhook.md), [requirements-tesla-fleet-telemetry-config-add-field.md](./requirements-tesla-fleet-telemetry-config-add-field.md), [requirements-tesla-hybrid-data-model.md](./requirements-tesla-hybrid-data-model.md), [requirements-vehicle-location-null.md](./requirements-vehicle-location-null.md), [requirements-tesla-telemetry-rest-baseline-specs.md](./requirements-tesla-telemetry-rest-baseline-specs.md), [checklist-tesla-telemetry-rest-freeze.md](./checklist-tesla-telemetry-rest-freeze.md) |
| 상태 | **Freeze 코드 ✅ · Baseline 졸업 ✅ · Wake 등 미졸업 · Telemetry QA ☐ · B2 ☐** |
| 작성일 | 2026-07-15 |
| ID prefix | **TRF** (Telemetry REST Freeze) |

---

## 1. 정책 요약 — Freeze + 경로 졸업

```text
TESLA_REST_FREEZE=true (기본)
   → 미졸업 Snapshot REST STOP (Wake · gear · nearby · fallback …)
   → SoT(동적) = Telemetry webhook

졸업 예외 (Freeze와 무관 · 항상 허용)
   ✅ Baseline specs-only (TRF-B1) — 계정/VK 후 제원 1회 · Snapshot 미생성
   ☐ Wake 쿨다운 (TRF-B2 완료 후 졸업 예정)
   ☐ …

[경로별 재정의 완료] → 해당 경로만 Freeze 가드 제거 (= 졸업)
[전 경로 졸업 또는 레거시] → TESLA_REST_FREEZE=false 로 전면 허용 가능
```

**원칙:** Freeze는 “REST 전면 OFF”가 아니라 **아직 필드 재정의되지 않은 REST만 차단**.  
졸업한 경로는 kill-switch와 무관하게 운영 계약대로 호출된다.

---

## 2. Phase A — REST Freeze (미졸업 경로)

### 2.1 목표

| 목표 | 내용 |
|------|------|
| Snapshot SoT | 동적 상태는 **Telemetry** (졸업 경로가 Snapshot을 쓸 때만 예외·화이트리스트) |
| 오염 차단 | Wake/fallback 등 미재정의 REST가 Snapshot을 덮지 않음 |
| 온보딩 | Baseline(제원)은 졸업 — Freeze ON에서도 VK 후 제원 1회 가능 |

### 2.2 STOP 대상 (Freeze ON · 미졸업)

| # | 경로 | 진입점 | Freeze | Snapshot? |
|---|------|--------|:------:|:---------:|
| A1 | Wake 쿨다운 REST | `maybeRunWakeCooldownRestSync` | **차단** | ✅ |
| A2 | Gear correction | `maybeRunGearCorrectionRestSync` | **차단** | ✅ |
| A3 | 정차 nearby | `maybeRefreshNearbyOnPark` | **차단** | ✅ |
| A4/A5 | Baseline specs-only | `runBaselineForVehicle` · VK→Baseline | **졸업 · 허용** | ❌ |
| A6 | 수동 fallback | `?fallback=1` | **차단** | ✅ |
| A7 | full / auto REST | force full | **차단** | ✅ |

### 2.3 Freeze 중 허용

| 허용 | 이유 |
|------|------|
| Telemetry webhook · process | 동적 SoT |
| `fleet_telemetry_config` GET/POST/DELETE | 구독 |
| `listVehicles` + `fleet_status` (registry) | 목록·VK 메타 |
| OAuth / 토큰 | 위 API |
| **Baseline specs-only (졸업)** | Vehicle 제원 1회 · Snapshot 없음 — [B1](./requirements-tesla-telemetry-rest-baseline-specs.md) |

### 2.4 env

```text
TESLA_REST_FREEZE=true   # 기본 · 미졸업 Snapshot REST 차단
# Baseline은 REST_FREEZE_GRADUATED_PATHS — env와 무관
```

- 설정 UI: fallback 비활성 · Freeze 안내(Baseline 예외 문구)
- status: `restFreeze: true`
- 코드: `REST_FREEZE_GRADUATED_PATHS` (`config.ts`)

### 2.5 수용 기준

- [x] A1~A3·A6~A7 Freeze 가드
- [x] A4/A5 Baseline **졸업** (Freeze ON에서도 실행)
- [x] fallback UI · `restFreeze` 상태
- [ ] 실차: Wake REST/Audit **없음** · Baseline 제원 **있음** (TRF-4 / B1-4)
- [ ] CAF-6 재구독 정상

---

## 3. Telemetry 확인 완료 조건 (Freeze 해제 게이트)

운영자 체크(권장 VIN `LRWYGCFJ7SC214742`):

| # | 조건 |
|---|------|
| T1 | CAF-6: 재구독 후 GET config ⊇ CAF §4 (44키) · Version 미구독 |
| T2 | Ingress에 P0/P1 샘플 키 수신 (주차·충전·주행 가능 범위) |
| T3 | Snapshot/UI가 **동일 구간** Ingress·mapper와 모순 없음 (REST 행 개입 없음) |
| T4 | value-monitor(개발) 또는 Ingress 샘플로 미파싱 키 목록 정리 |
| T5 | 본 문서 Phase A Freeze가 켜진 상태로 T1~T4 수행했음을 기록 |

→ **T1~T5 통과 = Telemetry 확인 완료** → Phase A 해제 가능 → Phase B 착수.

---

## 4. Phase B — Freeze 해제 후 REST 재정의 (예정)

확인 이후에만 수행. **현행 동작을 그대로 켜지 말고**, 아래 두 경로를 **필드·쓰기 규칙까지 문서로 확정한 뒤** 구현한다.

현행 CAF 분리 축을 출발점으로 함:

| 축 | 출처 | 용도 |
|----|------|------|
| Telemetry P0+P1 | CAF §3~4 | 동적 SoT |
| REST-1 제원 | CAF §5 | CarType · Trim · ExteriorColor · Version 등 |

### 4.1 ① Baseline / VK 직후 REST

**상세 요구(As-Is/To-Be·필드 표·Version 정책):**  
→ [requirements-tesla-telemetry-rest-baseline-specs.md](./requirements-tesla-telemetry-rest-baseline-specs.md) (**TRF-B1** · 코드 ✅ · 실차 ☐)

| 항목 | 현행(As-Is) | To-Be (구현됨) |
|------|-------------|----------------|
| 트리거 | VK confirm · READY · 수동 baseline | 동일 · **Freeze 졸업(항상 허용)** |
| 조회 | `vehicle_data` + nearby + service + alerts | `list` + `fleet_status` + `vehicle_data` only |
| Vehicle 갱신 | `updateSpecs` 제원 | Tier A/B/C + `firmwareVersion` · `writeVehicleSpecs` |
| Snapshot 갱신 | 동적 전부 write | **미생성** |
| wake | 금지 유지 | 유지 |

**산출물:** TRF-5 ✅ · TRF-B1-3 ✅ · `npm run trf-b1:verify`

### 4.2 ② Wake 쿨다운 REST

| 항목 | 현행(As-Is) | To-Be (재정의 · TBD) |
|------|-------------|----------------------|
| 트리거 | ASLEEP→Telemetry · `TESLA_REST_WAKE_COOLDOWN_MINUTES` | 유지 여부·분 재검토 |
| 조회 | `vehicle_data` + nearby + service | **갭 보정 화이트리스트만** (예: TPMS·odometer·nearby — Telemetry에 이미 있는 Soc/Location은 조회해도 **Snapshot에 안 쓰거나 merge only**) |
| Vehicle 제원 | `updateSpecs: false` | 유지 (제원 덮지 않음) |
| Snapshot | 전 필드 기록 → LN-R로 좌표 merge 추가됨 | **허용 갱신 필드 목록** + 그 외 `?? previous` 의무 |
| 목적 | Telemetry 공백 보정 | “Telemetry SoT를 깨지 않는 보정”으로 재정의 |

**재정의 산출물 (B2):** wake REST **읽기 필드** / **Snapshot 쓰기 필드** / **무시 필드** 표.

### 4.3 Phase B에서 다시 켜지 않는 것 (기본)

| 경로 | Freeze 후 |
|------|-----------|
| 주기 full REST 폴링 | **계속 OFF** (Telemetry primary) |
| 자동 wake_up | **계속 금지** |
| 수동 fallback | 별도 정책 · Audit 필수 · 화이트리스트 동일 적용 권고 |
| Gear correction | Phase B에서 **유지/폐기/축소** 재결정 (기본안: Freeze와 같이 재검토) |

### 4.4 Phase B 착수 전 필수

- [ ] Phase A Freeze 해제 게이트(§3) 충족
- [ ] B1·B2 필드 표 문서 승인
- [ ] LN-R merge 유지 (좌표 등)
- [ ] CAF 구독 필드와 “wake가 Snapshot에 써도 되는 필드”가 모순 없는지 교차 검토

---

## 5. 요구사항 ID

| ID | 요구 | Phase | 상태 |
|----|------|-------|:----:|
| **TRF-1** | 본 문서 · REST Freeze / 이후 재정의 정책 | Doc | ✅ |
| **TRF-2** | A1~A7 Freeze 가드 · env kill-switch | A Code | ✅ |
| **TRF-3** | 설정 fallback UI 비활성 · 상태 표시 | A Code | ✅ |
| **TRF-4** | Freeze 상태에서 CAF-6·Telemetry 확인 (게이트 §3) | A QA | ☐ |
| **TRF-5** | B1 Baseline/VK 조회·갱신 필드 표 확정 | B Doc | ✅ |
| **TRF-6** | B2 Wake 쿨다운 조회·갱신 필드 표 확정 | B Doc | ☐ |
| **TRF-7** | B1 코드 ✅ · B2·Freeze 해제 ☐ | B Code | 부분 ✅ |
| **TRF-8** | 해제 후 실차: Telemetry SoT + 허용 REST만 Audit | B QA | ☐ |

---

## 6. Phase

| Phase | 범위 | 상태 |
|-------|------|:----:|
| **TRF-Doc** | 요구·체크리스트 · 인덱스 | ✅ |
| **TRF-A** | Freeze 구현 ✅ · Telemetry 확인(TRF-4) ☐ | 코드 ✅ / QA ☐ |
| **TRF-B-Doc** | B1 ✅ · Wake(B2) ☐ | B1 ✅ / B2 ☐ |
| **TRF-B** | B1 코드 ✅ · B2·Freeze 해제 ☐ | 부분 ✅ |

---

## 7. 리스크

| 항목 | 내용 |
|------|------|
| Freeze 중 제원 공백 | 신규 연동 차량 Model/색 미표시 가능 → 확인 후 B1 우선 또는 임시 UI “제원 대기” |
| Freeze 중 nearby 공백 | 인근충전소 미갱신 — 검증 우선 |
| Freeze 안 끄고 B 재정의만 | wake가 옛 전량 write로 재오염 — **가드 유지하며 B 배포** 권고 |
| alreadyConfigured | Freeze와 무관 · CAF 재구독은 예외 허용 |

---

## 8. 구현 메모 (착수 시)

| 모듈 | Freeze 포인트 |
|------|----------------|
| `processor.ts` | wake / gear / nearby 호출 전 |
| `hybrid/rest-sync.ts` | `runBaseline*` · `maybeRunWake*` · gear · nearby |
| `vehicle-sync.ts` / sync API | full · `fallback=1` |
| `FleetSettingsView` | fallback 버튼 |
| `telemetry/config.ts` | `isRestFreezeEnabled()` |

Phase B 표는 CAF add-field §5 · hybrid 문서에 링크해 확장.

---

## 9. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-15 | TRF — Freeze 전면 중지 · Telemetry 게이트 · B①② 필드 재정의 예정 문서화 |
| 2026-07-15 | Phase A 코드 반영 — `TESLA_REST_FREEZE` · A1~A7 · UI/status · `trf:verify` |
| 2026-07-15 | TRF-B1 상세 요구 링크 — `requirements-tesla-telemetry-rest-baseline-specs.md` |
| 2026-07-15 | TRF-B1-3 specs-only Baseline 코드 · TRF-5 ✅ |
| 2026-07-15 | Freeze **졸업 모델** — Baseline specs-only는 Freeze 예외 · Wake 등은 차단 유지 |
