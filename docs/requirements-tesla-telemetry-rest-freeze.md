# Telemetry 검증 기간 REST Freeze · 이후 Baseline/Wake 재정의 (TRF)

| 항목 | 내용 |
|------|------|
| 목적 | **Telemetry 수신·구독(CAF) 확인이 끝날 때까지** Snapshot을 오염시키는 **모든 Fleet REST 경로를 중지**하고, 확인 이후 **① Baseline/VK · ② Wake 쿨다운**의 조회·갱신 필드를 현행 기준으로 **재정의**한다 |
| 배경 | Telemetry primary여도 wake/Baseline/fallback REST가 Snapshot을 덮어 Ingress≠UI 혼선을 만듦 (LN-R 등). 순수 Telemetry 검증이 선행돼야 CAF-6·구독 필드 검수가 성립한다 |
| 관련 | [requirements-tesla-fleet-api-telemetry-webhook.md](./requirements-tesla-fleet-api-telemetry-webhook.md), [requirements-tesla-fleet-telemetry-config-add-field.md](./requirements-tesla-fleet-telemetry-config-add-field.md), [requirements-tesla-hybrid-data-model.md](./requirements-tesla-hybrid-data-model.md), [requirements-vehicle-location-null.md](./requirements-vehicle-location-null.md), [checklist-tesla-telemetry-rest-freeze.md](./checklist-tesla-telemetry-rest-freeze.md) |
| 상태 | **요구·체크리스트 ✅ · Phase A Freeze 코드 ✅ · Telemetry QA(TRF-4) ☐ · 필드 재정의 ☐** |
| 작성일 | 2026-07-15 |
| ID prefix | **TRF** (Telemetry REST Freeze) |

---

## 1. 정책 요약 (2단계)

```text
[Phase A — FREEZE]  Telemetry 확인 완료 전
   → Snapshot/동적 상태를 만드는 Fleet REST 전부 STOP
   → SoT = Telemetry webhook (+ config 구독 API만 예외)

[Telemetry 확인 완료]  CAF-6 · Ingress/Snapshot 정합 · 운영자 승인

[Phase B — REDEFINE]  확인 이후
   → ① Baseline / VK 직후 REST
   → ② Wake 쿨다운 REST
   → 조회 필드 · Vehicle 갱신 · Snapshot 갱신(merge) 목록을 문서·코드로 재정의
```

**원칙:** Freeze 동안 “REST로 Telemetry를 보완한다”는 금지.  
확인 후에만, **역할이 다른 두 REST**를 좁게·필드로 명시해 다시 켠다.

---

## 2. Phase A — REST Freeze (Telemetry 확인 완료 전)

### 2.1 목표

| 목표 | 내용 |
|------|------|
| Snapshot SoT | **오직** Fleet Telemetry → Ingress → processor |
| 검증 가능성 | Ingress에 없는 값이 Snapshot/UI에 나타나면 **구독·파서 문제**로 단정 가능 |
| 오염 차단 | wake REST 직후 null 좌표·제원 덮어쓰기 등 재발 방지 |

### 2.2 STOP 대상 (현행 코드 경로)

모두 **Outbound Tesla Fleet / Proxy를 통해 vehicle·충전소·서비스 데이터를 가져와 Snapshot(또는 동일 SoT)을 쓰는 경로**.

| # | 경로 | 진입점 | API (대표) | Snapshot? |
|---|------|--------|------------|:---------:|
| A1 | Wake 쿨다운 REST | `maybeRunWakeCooldownRestSync` ← processor `wasAsleep` | `vehicle_data` (+ nearby/service) | ✅ |
| A2 | Gear correction REST | `maybeRunGearCorrectionRestSync` | `vehicle_data` | ✅ |
| A3 | 정차 nearby 갱신 | `maybeRefreshNearbyOnPark` | `nearby_charging_sites` | ✅ (nearby 컬럼) |
| A4 | Baseline | `runBaselineForVehicle` · `?baseline` · READY 자동 | `vehicle_data` + alerts 등 | ✅ + 제원 |
| A5 | VK confirm 후 Baseline | virtual-key confirm → baseline | 동일 | ✅ |
| A6 | 수동 fallback | 설정 `?fallback=1` · sync full | `vehicle_data` | ✅ |
| A7 | 레거시 full sync | `TESLA_REST_AUTO_SYNC` / force full | `vehicle_data` | ✅ |

**Freeze = 위 A1~A7 전부 실행 금지** (스킵·가드·UI 비활성).

### 2.3 Freeze 중 허용 (예외 · 최소화)

Telemetry **확인 자체**와 계정 메타에만 필요.

| 허용 | 이유 |
|------|------|
| Telemetry webhook 수신 · process | 검증 대상 |
| `fleet_telemetry_config` GET / POST(create) / DELETE | CAF-6 재구독 · 구독 확인 |
| `listVehicles` + `fleet_status` (registry-only) | 목록·VK 페어링 메타 · **Snapshot 미생성** 유지 |
| OAuth / 토큰 갱신 | 위 API에 필요 |

**금지에 포함:** Baseline을 “제원만”이라도 Freeze 중에는 **하지 않음** (vehicle_data 한 방이 동적 필드를 같이 가져옴). 제원 REST-1은 Phase B①에서 재개.

### 2.4 구현 방향 (코드 착수 시 · 본 문서는 요구만)

권고 kill-switch (이름 예시):

```text
TESLA_REST_FREEZE=true   # 또는 TESLA_REST_SNAPSHOT_SYNC_ENABLED=false
```

- `true`일 때 A1~A7 early return (`skipped: rest_freeze`)
- 설정 UI: 「REST fallback 동기화」버튼 비활성 + Freeze 안내
- Audit: skip 사유 `TRF_FREEZE` 기록(선택)
- 로그/상태 API에 `restFreeze: true` 노출 (운영 가시성)

해제: **Telemetry 확인 완료(§4)** 후 env/`false` + 배포. Phase B 필드 재정의 문서 승인 전에도 Freeze 해제는 가능하나, **B 재정의 전 wake/Baseline을 옛 코드로 재가동하지 말 것** 권고.

### 2.5 Freeze 수용 기준

- [x] A1~A7 코드 경로에 Freeze 가드 (`TESLA_REST_FREEZE`, 기본 ON)
- [x] 설정 fallback UI 비활성(또는 가드) · status `restFreeze`
- [ ] 실차: ASLEEP→ONLINE 후 **REST Snapshot / WAKE_COOLDOWN Audit 없음** (TRF-4)
- [ ] Ingress PROCESSED → Snapshot `telemetrySource=TELEMETRY`만 증가(해당 구간) (TRF-4)
- [ ] CAF-6 재구독(config)은 정상 동작 (TRF-4 / CAF-6)

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

| 항목 | 현행(As-Is) | To-Be (재정의 · TBD) |
|------|-------------|----------------------|
| 트리거 | VK confirm · READY · 수동 baseline | 동일 계열 유지 예정 · **Freeze 후 재활성** |
| 조회 | `vehicle_data` 전체 + nearby + service + alerts | **조회 필드 화이트리스트** 확정 예정 |
| Vehicle 갱신 | `updateSpecs`: carType, trim, color, displayName… | CAF REST-1 목록에 맞춘 **제원만** (동적 컬럼 금지) |
| Snapshot 갱신 | 동적 전부 write (GPS 포함) | **옵션 A:** 제원 전용 API/파싱만 · Snapshot 미생성<br>**옵션 B:** Snapshot은 Telemetry 미수신 키만 merge · 좌표 등 P0는 previous/`??` |
| wake | 금지 유지 | 유지 |

**재정의 산출물 (B1):** `docs` 표 — REST response 경로 → Vehicle 컬럼 / (선택) Snapshot 컬럼 / ignore.

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
| **TRF-5** | B1 Baseline/VK 조회·갱신 필드 표 확정 | B Doc | ☐ |
| **TRF-6** | B2 Wake 쿨다운 조회·갱신 필드 표 확정 | B Doc | ☐ |
| **TRF-7** | B1·B2 코드 반영 · Freeze 해제 | B Code | ☐ |
| **TRF-8** | 해제 후 실차: Telemetry SoT + 허용 REST만 Audit | B QA | ☐ |

---

## 6. Phase

| Phase | 범위 | 상태 |
|-------|------|:----:|
| **TRF-Doc** | 요구·체크리스트 · 인덱스 | ✅ |
| **TRF-A** | Freeze 구현 ✅ · Telemetry 확인(TRF-4) ☐ | 코드 ✅ / QA ☐ |
| **TRF-B-Doc** | Baseline/VK · Wake 필드 재정의 표 | ☐ |
| **TRF-B** | 재정의 구현 · Freeze 해제 | ☐ |

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
