# Tesla Fleet API / Telemetry — 동적 필드 매핑 (충전 출력·변속)

| 항목 | 내용 |
|------|------|
| 목적 | `vehicle_data`·Telemetry에서 **충전 출력·변속(Gear)** 을 FMS `VehicleSnapshot`에 저장·merge·화면에 쓸 수 있게 한다 |
| 근거 초안 | 본 문서 하단 초안 메모(컬럼 2 vs 3·명명) |
| 관련 | [requirements-tesla-fleet-api-model-mapping.md](./requirements-tesla-fleet-api-model-mapping.md) (정적 제원), [requirements-tesla-hybrid-data-model.md](./requirements-tesla-hybrid-data-model.md), [requirements-tesla-api-bugfix-0712.md](./requirements-tesla-api-bugfix-0712.md) (BF-C Gear) |
| 적용 API | `GET /api/1/vehicles/{vehicle_tag}/vehicle_data` · Fleet Telemetry 구독 필드 |
| 상태 | **MM2-A~B 구현 완료** · MM2-C 보류 · migrate·실차 검수 남음 |
| 작성일 | 2026-07-14 |

---

## 1. 배경

초안 요청:

1. `vehicle_data` 응답 중 Snapshot에 넣을 동적 항목 정의  
2. 컬럼 추가 후 REST·Telemetry 값을 매핑해 DB에 반영  
3. Telemetry 필드와의 대응표 확정  

대상 대응(초안):

| vehicle_data | Telemetry |
|--------------|-----------|
| `charge_state.charger_power` | `ACChargingPower` |
| `charge_state.charger_power` | `DCChargingPower` |
| `drive_state.shift_state` | `Gear` |

쟁점:

- REST는 **단일** `charger_power`, Telemetry는 **AC/DC 분리**  
- DB를 **2컬럼**(`charger_power` + `shift_state`) vs **3컬럼**(AC·DC·shift) 중 무엇으로 할지  
- 컬럼명을 vehicle_data / Telemetry / FMS 도메인 중 어디에 맞출지  

---

## 2. As-Is (코드 기준)

| 항목 | 상태 | 비고 |
|------|:----:|------|
| `VehicleSnapshot.chargerPowerKw` | ✅ | REST `charge_state.charger_power` → mapper; Telemetry `ACChargingPower`/`DCChargingPower` → **하나로 coalesce** (`DC>0` 우선, 아니면 AC) |
| 상세 UI 충전기 kW | ✅ | `chargerPowerKw` 표시 |
| Telemetry `Gear` → 파서 `shiftState` | ✅ | `ignitionOn` 유도 · BF-C 주차/주행 REST 트리거 |
| `VehicleSnapshot`에 **변속 컬럼** | ✅ | `shiftState` — MM2-A (정규화 P\|R\|N\|D) |
| AC/DC **별도** Snapshot 컬럼 | ❌ | 의도적으로 단일 `chargerPowerKw` |

즉 초안의 “충전 출력 insert”는 **이미 완료**(`chargerPowerKw`)이고, **`shiftState` Snapshot 영속·DTO·상세 노출은 MM2-A~B로 구현 완료**. AC/DC 분리는 **MM2-C 보류**.

---

## 3. 목표

1. REST·Telemetry 공통으로 **표시·merge 가능한 SoT**를 Snapshot에 둔다.  
2. Telemetry 희소 갱신에서도 기존 merge(`current ?? previous`)와 맞춘다.  
3. BF-C(Gear=P 정차 보정)와 모순되지 않게 **원문 변속값**을 남길 수 있게 한다.  
4. 스키마·명명은 기존 FMS 관례(`camelCase` + kW/% 단위 접미사)를 따른다.

범위 밖: 정적 제원(`car_type` 등) — [model-mapping](./requirements-tesla-fleet-api-model-mapping.md). Snapshot append→latest-only 전환.

---

## 4. 매핑 표 (확정)

| FMS (Prisma / DTO) | vehicle_data | Telemetry | 단위·값 | 쓰기 경로 |
|--------------------|--------------|-----------|---------|-----------|
| `chargerPowerKw` | `charge_state.charger_power` | `ACChargingPower`, `DCChargingPower` → **1값으로 coalesce** | kW (number) | REST Baseline/보정 · Telemetry merge — **As-Is 유지** |
| `shiftState` (**신규**) | `drive_state.shift_state` | `Gear` (및 typed `shiftStateValue`) | 원문 `ShiftStateP` 등 → 저장 시 `P`/`R`/`N`/`D` (§4.2) | REST sync 시 저장 · Telemetry 수신 시 merge — **본 Phase** |

### 4.1 Telemetry 충전 출력 coalesce (As-Is · 유지)

```
DCChargingPower > 0  → chargerPowerKw = DC
else ACChargingPower → chargerPowerKw = AC
else                 → undefined (merge 시 이전 값 유지)
```

REST의 `charger_power`는 차저 종류를 구분하지 않으므로 **동일 컬럼**에 넣는 것이 정합적이다.

### 4.2 변속 원문 값 · 정규화

실측·Telemetry/`vehicle_data`에서 `drive_state.shift_state` · `Gear`에 오는 **원문 enum** 예:

| 원문 (API/Telemetry) | 의미 | Snapshot `shiftState` (정규화) |
|----------------------|------|-------------------------------|
| `ShiftStateP` | Park | `P` |
| `ShiftStateR` | Reverse | `R` |
| `ShiftStateN` | Neutral (관측 시) | `N` |
| `ShiftStateD` | Drive | `D` |
| `P` / `R` / `N` / `D` | 짧은 토큰 (REST 일부) | 그대로 대문자 |
| `null` / 부재 | 미보고 | merge 시 이전 값 유지 |

규칙:

- 접두 `ShiftState`를 제거한 뒤 대문자 1글자(또는 동등 토큰)로 정규화 — 기존 Telemetry `readShiftState`와 동일.  
- **DB·DTO·BF-C 비교는 정규화 값** (`=== "P"` 등). 원문 `ShiftStateP`를 Snapshot에 그대로 넣지 않는다.  
- REST mapper도 `"P"`뿐 아니라 `ShiftStateP` 형태가 오면 동일 정규화를 적용해야 한다 (MM2-2).  
- `ignitionOn`은 `shiftState !== "P"` 파생 — SoT는 정규화된 `shiftState`.

---

## 5. 스키마 결정 (의견·채택)

### 5.1 컬럼 개수: **2슬롯 권고 (실효)**

| 안 | 내용 | 평가 |
|----|------|------|
| **A. 2슬롯** — `chargerPowerKw` + `shiftState` | REST·화면·merge가 단순. AC/DC는 ingest 시 합산 | **채택** |
| B. 3컬럼 — `acChargingPowerKw` + `dcChargingPowerKw` + `shiftState` | Telemetry 원형 보존 | REST는 한 값만 옴 → AC/DC 중 어디에 넣을지 모호. UI 요구 없으면 과설계 |
| C. charger만 2개 + shift 없음 | — | Gear 디버깅·상세 “P단” 표시·감사에 불리 (현재 갭) |

**채택: A.**  
- 충전: **기존 `chargerPowerKw` 유지** (신규 AC/DC 컬럼 **비권고**).  
- 변속: **`shiftState String?` 신규**.  

AC vs DC를 화면에 꼭 구분해야 하면 후속으로 `chargingPowerKind` (`AC`|`DC`|`UNKNOWN`) 정도의 **보조 enum 1개**만 검토 (풀 3컬럼보다 가벼움).

### 5.2 필드명: **FMS 도메인 (Prisma camelCase)**

| 후보 | 판정 |
|------|------|
| vehicle_data 그대로 (`charger_power`, `shift_state`) | DB·TS와 불일치. snake_case Prisma 관례와 맞지도 않음 |
| Telemetry 그대로 (`ACChargingPower`, `Gear`) | REST 단일 필드·기존 `chargerPowerKw`와 불일치 |
| **FMS 도메인** (`chargerPowerKw`, `shiftState`) | **채택** — 기존 Snapshot·DTO와 동일. 주석에 REST/Telemetry 경로 명시 |

표시 카피(한글)는 UX2 단계에서 “변속·충전기 출력” 등으로 — 본 Phase는 **저장·매핑**.

---

## 6. 요구사항 ID

| ID | 요구 | 우선 | 상태 |
|----|------|:----:|:----:|
| **MM2-1** | `VehicleSnapshot.shiftState`(`String?`) 추가 · 마이그레이션 | P1 | ✅ |
| **MM2-2** | REST `drive_state.shift_state` → Snapshot `shiftState` 정규화 저장 | P1 | ✅ |
| **MM2-3** | Telemetry `Gear` → merge 시 `shiftState` 갱신 (`ignitionOn`과 정합) | P1 | ✅ |
| **MM2-4** | DTO·상세(또는 기술 상세)에 `shiftState` 노출 (개발 검증용 최소) | P2 | ✅ |
| **MM2-5** | `chargerPowerKw` REST/Telemetry 매핑·coalesce **문서·회귀만 확인** (스키마 변경 없음) | P2 | ✅ As-Is |
| **MM2-6** | Snapshot `chargingPowerKind` (`AC`\|`DC`) — Telemetry coalesce · UI [charging-card CC-D](./requirements-charging-card.md) | P1 | ✅ |

데이터 모델·수집 “새 API”는 없음. **컬럼 1개 + 쓰기 경로 보강**이 핵심.

---

## 7. 수용 기준

- [x] Prisma에 `shiftState` 존재, 기존 row는 null 허용 (코드·migration)
- [x] `ShiftStateP`/`R`/`D`(및 `N`) 원문이 **정규화되어** `P`/`R`/`D`(/`N`)로 저장되도록 구현 (`normalizeShiftState`)
- [x] REST·Telemetry 쓰기·merge 경로에 `shiftState` 반영
- [x] `chargerPowerKw`는 스키마 변경 없이 유지
- [ ] DB migrate 적용 · 실차 수신 대조·BF-C 검수

---

## 8. 구현 시 주의 (착수 시)

- REST·Telemetry 모두 `ShiftStateP` 등 접두 enum과 짧은 `P`/`D`를 **동일 정규화 함수**로 처리.  
- `mergeSnapshotFields`에 `shiftState: current ?? previous` 추가.  
- REST mapper가 `shift_state`를 Snapshot create 경로에 넣는지 확인 (현재 ignition만 쓰는 부분 보강).  
- 가상 차량 시드·Mock provider 동일 필드.  
- 모니터(개발)는 이미 Gear 줄을 보여 줌 — Snapshot 영속과 별개.

---

## 9. Phase (제안)

| Phase | 범위 |
|-------|------|
| **MM2-A** | MM2-1~3 — 스키마·REST·Telemetry 쓰기 |
| **MM2-B** | MM2-4~5 — UI/DTO·충전기 회귀 |
| **MM2-C** | MM2-6 — `chargingPowerKind` · 충전 카드 완속/급속 — ✅ (CC-D) |

체크리스트는 착수 시 `checklist-…` 분리 또는 [development-checklist.md](./development-checklist.md)에 Phase 한 줄 추가.

---

## 10. 초안 대비 요약

| 초안 | 본 문서 |
|------|---------|
| charger_power ×2 + shift 매핑 | AC/DC는 **단일 `chargerPowerKw`로 이미 구현** · 문서화 |
| 2컬럼 vs 3컬럼 | **2슬롯 채택** (`chargerPowerKw` + **신규 `shiftState`**) |
| 명명 | **FMS camelCase** · 주석에 REST/Telemetry 경로 |
| DB update | Snapshot create/merge 경로에 반영 (append 정책 유지) |
| 작업 | **MM2-A~B 구현 완료** · migrate·실차 검수 남음 |

---

## 11. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-14 | 초안 메모(충전 출력·Gear·2 vs 3컬럼) → As-Is 대조·권고·MM2 ID 요구사항화 (**코드 미착수**) |
| 2026-07-14 | §4.2 — `shift_state` 원문 `ShiftStateP`/`R`/`D` 실측값·정규화표 추가 |
| 2026-07-14 | **MM2-A~B 구현** — `shiftState`·normalize·REST/Telemetry/DTO/UI · [checklist](./checklist-tesla-fleet-api-model-mapping2.md) |

---

## 부록 — 원문 초안

> Tesla - Vehicle Endpoints - vehicle_data  
> `charge_state.charger_power` / Telemetry `ACChargingPower`·`DCChargingPower`  
> `drive_state.shift_state` / Telemetry `Gear`  
> 컬럼 2개 vs 3개·필드명 기준 의견 요청 → 본문 §5에서 판정.
