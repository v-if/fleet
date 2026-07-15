# Phase TRF — Telemetry 검증 REST Freeze 체크리스트

관련 요구사항: [requirements-tesla-telemetry-rest-freeze.md](./requirements-tesla-telemetry-rest-freeze.md)  
관련 CAF: [checklist-tesla-fleet-telemetry-config-add-field.md](./checklist-tesla-fleet-telemetry-config-add-field.md) (CAF-6과 게이트 연계)  
상태: **문서 ✅ · Freeze 코드 ✅ · Telemetry 확인 QA ☐ · 필드 재정의 ☐**

---

## 이슈 ↔ Phase

| ID | 요구 | Phase | 상태 |
|----|------|-------|:----:|
| TRF-1 | 정책 문서화 | TRF-Doc | ✅ |
| TRF-2 | A1~A7 Freeze 가드 · env | TRF-A | ✅ |
| TRF-3 | fallback UI 비활성 · 상태 표시 | TRF-A | ✅ |
| TRF-4 | Freeze 하 Telemetry 확인 게이트 | TRF-A QA | ☐ |
| TRF-5 | B1 Baseline/VK 필드 표 | TRF-B-Doc | ☐ |
| TRF-6 | B2 Wake 쿨다운 필드 표 | TRF-B-Doc | ☐ |
| TRF-7 | B 코드 · Freeze 해제 | TRF-B | ☐ |
| TRF-8 | 해제 후 실차 | TRF-B QA | ☐ |

---

## TRF-Doc — ✅

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | `requirements-tesla-telemetry-rest-freeze.md` | ✅ |
| 2 | 본 체크리스트 | ✅ |
| 3 | README · development-checklist 링크 | ✅ |

---

## TRF-A — REST Freeze 구현 ✅

### STOP 경로 (가드)

| # | 경로 | 상태 |
|---|------|:----:|
| A1 | Wake 쿨다운 `maybeRunWakeCooldownRestSync` | ✅ |
| A2 | Gear correction | ✅ |
| A3 | Nearby on park | ✅ |
| A4 | Baseline `runBaselineForVehicle` | ✅ |
| A5 | VK confirm → Baseline · `tryBaselinesForAccount` | ✅ |
| A6 | 수동 `?fallback=1` (403) | ✅ |
| A7 | full / auto REST sync Snapshot (`resolveVehicleSyncMode` → registry) | ✅ |

### 공통

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | `isRestFreezeEnabled()` · `TESLA_REST_FREEZE` (기본 ON) | ✅ |
| 2 | skip 시 Snapshot 미생성 · `error: rest_freeze` · Audit 요약 | ✅ |
| 3 | 설정 「REST fallback」비활성 + Freeze 안내 | ✅ |
| 4 | status API · telemetry status `restFreeze` | ✅ |
| 5 | `npm run trf:verify` · `.env.example` | ✅ |

### 예외 (Freeze 중에도 허용)

- [x] Telemetry webhook / process
- [x] `fleet_telemetry_config` GET/POST/DELETE
- [x] registry-only `listVehicles` + `fleet_status` (Snapshot 없음)

---

## TRF-A QA — Telemetry 확인 게이트 ☐

VIN: `LRWYGCFJ7SC214742` · **Freeze ON** 상태에서

- [ ] T1 CAF-6: 재구독 · GET config ⊇ 44키 · Version 없음
- [ ] T2 Ingress P0/P1 샘플 수신
- [ ] T3 Snapshot에 REST 오염 없음 (`telemetrySource` / Audit)
- [ ] T4 ASLEEP→ONLINE 후 WAKE_COOLDOWN Snapshot/Audit **없음**
- [ ] T5 운영자: Telemetry 확인 완료 기록 → Freeze 해제 가능

---

## TRF-B-Doc — 필드 재정의 ☐

Telemetry 확인 **이후** 작성·승인.

### B1 — Baseline / VK

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | 조회 API·응답 경로 화이트리스트 | ☐ |
| 2 | Vehicle 갱신 컬럼 (= REST-1 제원) | ☐ |
| 3 | Snapshot: 미생성 vs 제한 merge 결정 | ☐ |
| 4 | wake_up 계속 금지 명시 | ☐ |

### B2 — Wake 쿨다운

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | 조회 화이트리스트 | ☐ |
| 2 | Snapshot **쓰기 허용** 필드 · 그 외 `?? previous` | ☐ |
| 3 | 제원 `updateSpecs: false` 유지 | ☐ |
| 4 | 쿨다운 분·Gear/nearby 유지 여부 | ☐ |

산출물은 요구사항 문서 §4 표로 추가하거나 하위 절 링크.

---

## TRF-B — 구현 · Freeze 해제 ☐

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | B1·B2 문서 승인 후 코드 | ☐ |
| 2 | Freeze env OFF (또는 경로별 재활성) | ☐ |
| 3 | 주기 full REST / 자동 wake_up 여전히 OFF | ☐ |
| 4 | 실차: Telemetry SoT + 허용 REST만 | ☐ |

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-15 | TRF 체크리스트 작성 (코드 미착수) |
| 2026-07-15 | TRF-A 코드 ✅ (TRF-2·3) · `TESLA_REST_FREEZE` · QA(TRF-4)·B ☐ |
|
