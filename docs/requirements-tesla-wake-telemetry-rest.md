# 주차(절전) → Online — Telemetry SoT · Wake REST 재정의 (TRF-B2)

| 항목 | 내용 |
|------|------|
| 목적 | 차량이 **주차(절전/ASLEEP)에서 Online으로 깨어날 때** (1) Telemetry로 채울 정보와 (2) 필요할 때만 REST로 보정할 정보를 분리하고, 현행 wake 전량 REST를 **갭 전용**으로 재정의한다 |
| 배경 | Telemetry primary + CAF 44키 이후 SoC·위치·문·TPMS 등은 스트림으로 충분. 옛 `maybeRunWakeCooldownRestSync` 전량 Snapshot write는 LN-R 위험 → **폐기**. nearby는 Online→P로 이전·Freeze 졸업 |
| 관련 | [requirements-tesla-telemetry-rest-freeze.md](./requirements-tesla-telemetry-rest-freeze.md) (§4.2), [requirements-tesla-telemetry-rest-baseline-specs.md](./requirements-tesla-telemetry-rest-baseline-specs.md) (B1), [requirements-tesla-fleet-telemetry-config-add-field.md](./requirements-tesla-fleet-telemetry-config-add-field.md), [requirements-vehicle-location-null.md](./requirements-vehicle-location-null.md), [requirements-tesla-api-bugfix-0712.md](./requirements-tesla-api-bugfix-0712.md) (BF-C), [requirements-tesla-hybrid-data-model.md](./requirements-tesla-hybrid-data-model.md), [checklist-tesla-telemetry-rest-freeze.md](./checklist-tesla-telemetry-rest-freeze.md) |
| 상태 | **코드 ✅ · 실차 QA ☐** |
| 작성일 | 2026-07-15 |
| ID | **TRF-B2** / 상위 **TRF-6** ✅ · **TRF-7** (B2 코드 ✅) |
| 범위 밖 | 온보딩 제원 Baseline → B1. 주기 full REST · `wake_up` 자동 호출 — **계속 금지** |

---

## 1. 시나리오 (운영자 관점)

```text
[절전] Snapshot status=ASLEEP 또는 isAsleepInferred=true
   · UI: 「주차 (절전)」 · 마지막 신호 시각

[깨어남 감지] Telemetry Ingress 수신 → processor
   · wasAsleep=true
   · 새 Snapshot: ONLINE · TELEMETRY merge · isAsleepInferred=false
   · SyncState.lastWakeDetectedAt 기록

[관제 데이터] Telemetry CAF 필드로 SoC·위치·도어·TPMS 등 갱신
   · REST 없어도 기본 관제 가능해야 함 (목표)

[갭 보정] Wake 시점 REST — **기본 없음** (Telemetry만)
   · 인근충전소는 Wake가 아니라 **주차/절전 진입**에서 (§3.4)
   · (선택) service_data 저빈도 — 시점 별도
   · vehicle_data 전량 Snapshot 덮어쓰기 금지
```

**원칙:** 깨어남 = **Telemetry가 SoT**. REST는 “없으면 공백인 것만” 좁게. 없으면 **호출 안 해도 됨**.  
**Nearby 시점:** Online→주차(절전) 쪽이 Wake보다 운영·데이터 모두 유리 (§3.4 채택 권고).

---

## 2. As-Is → 구현 후 (TRF-B2-3 ✅)

### 2.1 깨어남 감지

| 항목 | 구현 |
|------|------|
| 진입점 | `applyTelemetryFields` (`processor.ts`) |
| 조건 | `previous.isAsleepInferred` 또는 `previous.status === ASLEEP` |
| Snapshot | TELEMETRY merge · ONLINE · `isAsleepInferred: false` |
| SyncState | `lastWakeDetectedAt` |
| 후속 | **REST 없음** · (별도) Gear=P 시 `maybeRefreshNearbyOnPark` |

### 2.2 Wake / Gear / Park nearby

| 경로 | 구현 |
|------|------|
| Wake REST | **폐기** · `maybeRunWakeCooldownRestSync` → `wake_no_rest` (processor 미호출) |
| Gear REST | **폐기** · `gear_rest_removed` |
| Park nearby | **졸업** · ONLINE+Gear=P · `PARK_NEARBY` · Audit `mode: park_nearby` |
| `wake_up` / 제원 | 호출 안 함 |

### 2.3 해소된 문제 (구 As-Is)

| 문제 | B2 후 |
|------|------|
| Wake `vehicle_data` 전량 Snapshot | 경로 제거 |
| Freeze로 nearby도 막힘 | park nearby 졸업 |
| Gear 전량 REST | 폐기 |
| 「기상 후 상세 조회」오해 | `PARK_NEARBY` 「주차 후 인근충전소」 |

---

## 3. To-Be — 데이터 출처 분리

### 3.1 Telemetry만으로 충분한 것 (REST 불필요 · 기본)

CAF 구독(P0+P1) · 실샘플(`teemetry.json` 등)과 정렬.

| 영역 | Telemetry 키 (대표) | Snapshot |
|------|---------------------|----------|
| 배터리 | Soc, EstBatteryRange, ChargeState, ChargeLimitSoc, AC/DC… | batteryPercent, rangeKm, charging* |
| 위치·주행 | Location, GpsHeading, Gear, VehicleSpeed, Odometer | lat/lng, shiftState, speed, odo |
| 보안·차체 | Locked, DoorState, Windows, SentryMode, Valet… | locked, doors*, windows*, sentry |
| 공조 | InsideTemp, OutsideTemp, HvacPower, Preconditioning… | temps, climate |
| TPMS | TpmsPressure×4, Hard/SoftWarnings | tpms*, warnings |
| 충전 포트·OTA | ChargePort*, SoftwareUpdate* | CAF 컬럼 |
| 상태 표시 | (추론 해제) | ONLINE · 절전 배지 해제 |

→ **운영:** 절전 해제 후 수 분 내 위 필드가 Ingress/Snapshot에 오면 정상. REST 없이 관제 가능해야 함.

### 3.2 REST가 필요할 수 있는 갭 (Telemetry 목록 밖)

| 갭 | REST API | Snapshot 쓰기 | 기본안 · **시점** |
|----|----------|---------------|-------------------|
| **인근 충전소** | `nearby_charging_sites` | nearby 컬럼만 | **Online→주차(절전)** (§3.4) · Wake에서는 **호출 안 함** |
| **정비/서비스 메타** | `service_data` / service status | serviceStatus만 | **선택·저빈도** — UI 뱃지 필요 시 (Wake 필수 아님) |
| vehicle_data 동적 전량 | `vehicle_data` | — | **금지** |
| 제원 | — | — | **금지** (B1만) |
| wake_up | command | — | **금지** |

**없으면 REST 안 함:** Telemetry로 관제 목표가 충족되면 nearby/service도 **미호출·미표시 stale 허용** 가능 (정책 선택).

### 3.3 To-Be Wake 경로 (REST 최소화)

```text
트리거: wasAsleep → Snapshot ONLINE · TELEMETRY
REST: 기본 스킵 (nearby도 Wake에 묶지 않음)
조회 금지: vehicle_data 전량 · wake_up · 제원
졸업 범위: “Wake full REST 제거”가 핵심 · 갭 nearby는 §3.4 주차 경로로 이전
```

Wake에서 남는 일: Telemetry merge · 절전 배지 해제 · (선택) Telemetry 품질 게이트.  
nearby는 **§3.4 주차 진입**이 SoT 타이밍.

### 3.4 인근충전소 — 호출 시점 권고: Wake ✕ · 주차(절전) 진입 ○

**운영·제품 의견 (채택 권고):**  
「Online으로 깨어날 때」보다 「Online에서 주차(절전)으로 들어갈 때」에 `nearby_charging_sites`를 치는 편이 낫다.

| 비교 | Wake (ASLEEP→Online) | 주차/절전 진입 (Online→P / 절전) |
|------|----------------------|----------------------------------|
| 좌표 의미 | 곧 이동할 수 있음 · 목록이 바로 stale | **최종 주차 위치** 기준 — 목록이 관제·고객에게 유효 |
| UX | 기상 직후 「근처 충전소」는 출발 직전엔 덜 씀 | 절전 중·다음 기상 전까지 「여기 근처」로 고정 표시 |
| API·차량 | 기상 직후 트래픽 집중·쿨다운과 경합 | 정차 후 1회 · 이미 BF-C 패턴과 일치 |
| Asleep 심화 | — | **주의:** 이미 깊은 ASLEEP이면 REST 실패·거부 가능 → **ONLINE + Gear=P** 시점(절전 직전)이 안전 |

**권고 트리거 (To-Be):**

```text
1순위: Gear→P (또는 정차 확정) + status=ONLINE + 좌표 유효 + 쿨다운
       → maybeRefreshNearbyOnPark (현행 BF-C) 를 **정식 SoT**로 승격·Freeze 졸업 후보
2순위(옵션): 절전 추론 직전(still ONLINE) 1회 — 1과 쿨다운으로 중복 방지
비채택: wasAsleep Wake REST 안에서의 nearby (초안 §3.3에서 제거)
```

**Wake와의 역할 분리**

| 이벤트 | Telemetry | nearby REST |
|--------|-----------|-------------|
| 절전→Online | SoC·위치·문·TPMS… | **안 함** |
| Online→P / 주차 정착 | Gear·Location 유지 | **1회 (갭)** |
| 주행 중 위치 이동 | Location | 목록 **클리어** (BF-B 거리) · 재조회는 다음 주차 |

**기존 코드와의 관계:** `maybeRefreshNearbyOnPark`가 이미 “P 정차 시 nearby만”을 한다. B2는 Wake 전량 REST에서 nearby를 **빼서** 이쪽에 모으고, `maybeRunWakeCooldownRestSync`의 nearby/`vehicle_data`는 폐기·축소한다.

---

## 4. 현행 코드에서 바꿔야 할 사항

| # | 모듈 · 함수 | 변경 | 상태 |
|---|-------------|------|:----:|
| C1 | `maybeRunWakeCooldownRestSync` | `wake_no_rest` no-op | ✅ |
| C2 | `maybeRefreshNearbyOnPark` | Freeze 가드 제거 · `PARK_NEARBY` | ✅ |
| C3 | (선택) 절전 추론 직전 nearby | 미구현 (C2로 충분) | — |
| C4 | Freeze | `park_nearby` 졸업 · Wake 재가동 안 함 | ✅ |
| C5 | Gear correction | `gear_rest_removed` no-op | ✅ |
| C6 | REST 사유 라벨 | `PARK_NEARBY` 「주차 후 인근충전소」 | ✅ |
| C7 | VD-OPS 연계 | 기존 empty 「주차 후 갱신」유지 | ✅ |
| C8 | Audit | `VEHICLE_NEARBY_REFRESH` · `mode: park_nearby` | ✅ |
| — | `processor.ts` | Wake/Gear 호출 제거 · P→nearby만 | ✅ |
| — | migrate · `trf-b2:verify` | `RestSyncReason.PARK_NEARBY` | ✅ |

---

## 5. FMS 운영 관점 — 추가 의견 · 넣으면 좋은 로직

### 5.1 제품 우선순위

| 우선 | 내용 |
|------|------|
| P0 | 절전 해제 후 **5~15분 내** SoC·위치·잠금이 Telemetry로 갱신되는 것을 성공 기준으로 |
| P1 | 인근충전소 — **주차(P) 진입 시 1회**. Wake에서는 기대하지 않음. 없으면 「주차 후 갱신」 |
| P2 | service 뱃지 — 관제 핵심 아님 · 저빈도 |

### 5.2 넣으면 좋은 로직

| 아이디어 | 설명 |
|----------|------|
| **Wake Telemetry 품질 게이트** | `wasAsleep` 후 P0 키(N개) 수신되면 `wakeTelemetryReadyAt` 기록 · UI 「관제 준비」 |
| **Park nearby 단일화** | Wake nearby 제거 · BF-C `maybeRefreshNearbyOnPark`만 (§3.4) |
| **불필요 REST 스킵 Audit** | Wake: `skipped: wake_no_rest`. Park: `gap_not_needed` / cooldown |
| **절전 중 Ingress** | 절전에서도 간헐 키가 오면 lastTelemetryAt만 갱신 · status ASLEEP 유지 규칙 재확인 |
| **운영 알림(후속)** | 깨어난 지 N분인데 Location/Soc 미수신 → 「구독·차량 Online 확인」뱃지 (재연동 CTA) |
| **쿨다운 UX** | Park nearby·기타 REST가 `lastRestSyncAt` 공유 — 이중 호출 방지 |

### 5.3 하지 말 것

| 금지 | 이유 |
|------|------|
| 기상 시 자동 `wake_up` | 배터·정책·기존 Phase 계약 |
| Wake에서 제원·nearby·vehicle_data | B1·§3.4와 역할 충돌 · 오염 |
| 깊은 ASLEEP **이후**만 nearby 시도 | REST 거부·실패 가능 — **ONLINE+P**에서 |
| Freeze 끄고 옛 wake 전량 write 재가동 | LN-R·TRF 목적 붕괴 |
| 신호 없음에 「제원 다시 불러오기」유도 | VD-OPS — 제원은 동적 해결책 아님 |

### 5.4 운영 체크리스트 (실차)

VIN 예: `LRWYGCFJ7SC214742`

1. 절전(주차) 확인 — UI 「주차 (절전)」· nearby는 **이전 주차 시점** 목록(또는 empty)
2. 도어/앱으로 기상 유도
3. Ingress PROCESSED · Snapshot `TELEMETRY` · ONLINE · **Wake REST Audit 없음**
4. 주행 후 Gear=P 정차 — nearby Audit `park_nearby` · 좌표≈현재 주차 위치
5. 다시 절전 — 목록 유지 · 기상 시 Telemetry만 갱신 · nearby 재호출 없음(쿨다운·미이동)

---

## 6. As-Is vs To-Be 요약

| 항목 | As-Is | To-Be |
|------|-------|-------|
| 깨어남 감지 | Telemetry `wasAsleep` | 유지 |
| 동적 SoT | Telemetry + (시도) REST 전량 | **Telemetry만** (Wake REST 없음) |
| nearby 시점 | Wake REST에 포함 + BF-C Park | **Park(Online→P)만** · Wake에서 제거 |
| Wake REST | vehicle_data+nearby+service (Freeze skip) | **폐기/no-op** |
| Freeze | Wake·nearby 차단 | nearby-on-park **졸업** · Wake full 재가동 안 함 |
| Gear REST | Freeze 차단 | 폐기/축소 권고 |
| 제원 | 안 건드림 | 유지 |

---

## 7. 요구사항 ID · Phase

| ID | 내용 | 상태 |
|----|------|:----:|
| **TRF-B2-1** | 본 문서 — Telemetry vs REST 갭 · nearby=주차 진입 · 운영 의견 | ✅ |
| **TRF-B2-2** | 문서 승인 (§3~5 · 특히 §3.4) | ✅ |
| **TRF-B2-3** | 코드: Wake full REST 제거 · park nearby 졸업 · 라벨 | ✅ |
| **TRF-B2-4** | 실차: 절전→Online Telemetry only · P 정차 시 nearby | ☐ |

상위: TRF-6 ✅ · TRF-7 B2 코드 ✅.

---

## 8. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-15 | 초안 — 절전→Online Telemetry SoT · Wake REST 갭 재정의 · 운영 의견 |
| 2026-07-15 | §3.4 — nearby 시점: Wake ✕ · Online→주차(절전) ○ (채택 권고) |
| 2026-07-15 | **코드 반영** — Wake/Gear no-op · park nearby 졸업 · `PARK_NEARBY` · `trf-b2:verify` |
|
