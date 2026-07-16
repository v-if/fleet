# Park Nearby 트리거 — 운행 후 Gear=P만 (TRF-B2e)

| 항목 | 내용 |
|------|------|
| 목적 | `nearby_charging_sites` REST를 **「운행(비-P) 후 주차(Gear→P)」시점만** 호출하도록 트리거를 재정의한다. 절전 주차 차량에 재탑승(변속은 계속 P)할 때는 **호출하지 않는다** |
| 배경 | 현행은 Telemetry에 `shiftState === "P"`가 **실리면** (쿨다운만 통과하면) `maybeRefreshNearbyOnPark`를 호출한다. 주차(절전) 차량에 탑승해 Online이 되면 Tesla가 다시 `ShiftState=P`를 보내는 경우가 있어, **운행 없이** 인근충전소 REST·목록이 갱신된다. 제품 의는 **운행 후 주차 위치** 기준 1회 |
| 관련 | [requirements-tesla-wake-telemetry-rest.md](./requirements-tesla-wake-telemetry-rest.md) (TRF-B2 §3.4), [requirements-nearby-charging-catalog.md](./requirements-nearby-charging-catalog.md) (NCS), [requirements-tesla-telemetry-rest-freeze.md](./requirements-tesla-telemetry-rest-freeze.md) |
| 적용 | `processor.ts` park 트리거 · (필요 시) SyncState 보조 플래그 · `maybeRefreshNearbyOnPark` 가드 |
| 상태 | **코드 ✅ (B2e-2·B2e-3) · 실차 B2e-4 ☐** |
| 작성일 | 2026-07-16 |
| ID | **TRF-B2e** |

---

## 1. As-Is 분석

### 1.1 현재 트리거 (코드)

`src/lib/tesla/telemetry/processor.ts` (TRF-B2):

```text
fields.shiftState != null && fields.shiftState === "P"
  → maybeRefreshNearbyOnPark(vehicleId)
```

| 가드 (함수 내부) | 역할 |
|------------------|------|
| Telemetry disconnect | 스킵 |
| `lastRestSyncAt` 쿨다운 (~30분, `TESLA_REST_WAKE_COOLDOWN_MINUTES`) | 스팸 완화 |
| Snapshot·좌표·Tesla 계정 | 호출 가능 여부 |

**없는 것:** 「이전에 비-P(운행)였는가」판정.

### 1.2 관측된 오동작 (요청 배경)

```text
차량: 이미 주차 · 변속 P · (절전)
탑승 → Online · Telemetry 재개
     → ShiftState=P 재수신 (운행 없음)
     → 쿨다운 만료 시 nearby REST 호출  ← 의도 밖
```

의도:

```text
운행 중 D/R/N (또는 비-P)
  → Gear → P (주차 정착)
  → nearby REST 1회
그 외 (재탑승·기상만 · 계속 P): 호출 안 함
```

### 1.3 TRF-B2 문서와의 관계

B2 §3.4는 이미 **「Online→P / 주차 정착」** · **「주행 중 재조회 금지」**를 말한다.  
구현은 **레벨 조건(`=== "P"`)** 이라 **엣지(전이)** 가 아니다 → 문서 의도보다 넓게 발화한다.

---

## 2. 「운행 후 주차」판정 — 가능한가?

### 2.1 결론: **가능** (Telemetry SoT로 충분)

| 방법 | 판정 | 장점 | 한계 |
|------|------|------|------|
| **A. 엣지 (권고)** | `previous.shiftState` ∈ {D,R,N,?} 이고 `current === "P"` | 단순 · 추가 REST 없음 · B2와 정합 | Telemetry 공백 중 D→P를 놓치면 **미호출** |
| **B. 세션 플래그** | 비-P 관측 시 `hadDriveShift=true` · P+플래그에서 nearby 후 clear | 짧은 공백에 강함 | SyncState/컬럼 또는 메모리 |
| **C. 이동 거리** | 마지막 nearby 좌표 대비 **≥ N m** (예: 200~500m) 후 P | 엣지 유실 보완 | 초단거리 주차·GPS 노이즈 |
| **D. 속도/ODO** | P 직전 speed>0 또는 odo 증가 | 직관적 | 키 누락·저속 주차 |

**권고 조합 (To-Be):**

```text
1차: A — previous.shiftState != null && previous !== "P" && current === "P"
2차(옵션·권고): C — A를 놓쳤을 때만, 좌표가 마지막 nearby capture 대비 ≥ threshold 이고 current===P
               + 쿨다운 (현행 유지)
금지: wasAsleep→Online 만으로 nearby
금지: current===P 만으로 nearby (현행)
```

### 2.2 「운행」정의 (제품)

| 포함 | 제외 |
|------|------|
| Snapshot/Telemetry에 **D / R / N** (또는 정규화 비-P)가 한 번이라도 찍힌 뒤 **P로 전이** | 처음부터 P만 유지 (재탑승·절전 기상) |
| (옵션 C) 주차 후 **유의미한 이동** 뒤 다시 P | 같은 자리에서 P 재통지 |

`shiftState` null → P: **운행으로 보지 않음** (데이터 공백). 필요 시 C로만 보완.

### 2.3 놓치는 케이스 · 허용

| 케이스 | 동작 | 허용 여부 |
|--------|------|-----------|
| D→P Telemetry 정상 | nearby ✅ | 목표 |
| 주행 중 구독 끊김 → 이미 P로 Online | A 실패 · C로 보완 가능 | C 채택 시 완화 |
| 재탑승 · 계속 P | nearby ❌ | 목표 |
| 쿨다운 중 두 번째 주차 | 스킵 | 현행과 동일 |

목록이 비면 UI는 기존 empty / NCS 카탈로그 폴백 정책 유지 (본 Phase는 **호출 조건만**).

---

## 3. To-Be 설계

### 3.1 processor 트리거 (필수)

```text
before: fields.shiftState === "P"  → maybeRefreshNearbyOnPark
after:  isDriveThenParkTransition(previous, fields)  → maybeRefreshNearbyOnPark
```

`isDriveThenParkTransition`:

| 조건 | |
|------|--|
| `fields.shiftState === "P"` | 이번 수신에 P |
| `previous?.shiftState` 존재 | |
| `normalize(previous.shiftState) !== "P"` | 직전 스냅샷이 비-P |

병합(`mergeSnapshotFields`) **전**의 `previous` Snapshot과 **이번** `fields`를 비교 (이미 `applyTelemetryFields`에 `previous` 있음).

### 3.2 보조 (권고 · Phase e-2)

| 항목 | 내용 |
|------|------|
| 이동 보완 | `lastNearbyCapture` 좌표 대비 haversine ≥ `TESLA_PARK_NEARBY_MOVE_METERS` (기본 300) 이고 `fields.shiftState==="P"` 이며 A 미충족일 때만 허용 |
| Audit metadata | `trigger: "shift_edge" \| "moved_then_p"` |

### 3.3 유지

| 항목 | |
|------|--|
| `maybeRefreshNearbyOnPark` 본체 · NCS upsert/폴백 | 변경 최소 |
| 쿨다운 · disconnect 가드 | 유지 |
| Wake REST 금지 · Freeze 졸업 `park_nearby` | 유지 |
| 2km stale clear (주행 중 목록 클리어) | 유지 (별 로직) |

### 3.4 비범위

- nearby API 엔드포인트·카탈로그 스키마 변경  
- Wake 시 nearby 재도입  
- 수동 「인근충전소 새로고침」버튼 (후속 제품)  
- v2 상세 UI  

---

## 4. 수용 기준

1. **운행(D 등) → P** 실차/시뮬: `VEHICLE_NEARBY_REFRESH` · `mode: park_nearby` 1회 (쿨다운 내 중복 없음).
2. **주차 P 유지 · 재탑승/기상**만: nearby REST **미호출** (쿨다운 만료여도 A 미충족이면 스킵). Audit에 불필요 호출 없음.
3. Asleep→Online + 계속 P: nearby **없음** (TRF-B2 유지).
4. `trf-b2:verify` / 단위 테스트: 엣지 true/false 케이스.
5. NCS·UI empty 문구 회귀 없음.

---

## 5. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **TRF-B2e-1** | 본 문서 승인 (GO) | ✅ |
| **TRF-B2e-2** | `isDriveThenParkTransition` + processor 가드 · verify/테스트 | ✅ |
| **TRF-B2e-3** | (권고) 이동 거리 보완 트리거 | ✅ |
| **TRF-B2e-4** | 실차: 재탑승 무호출 · 운행→P 호출 | ☐ |

---

## 6. 의견 · 진행 여부

### 판단: **GO (즉시 권고)**

| 근거 | |
|------|--|
| 제품 | 현행은 B2 문서의 「주차 **진입**」과 불일치 · 재탑승 시 REST는 낭비·asleep 레이스만 키움 |
| 기술 | **previous.shiftState 엣지**로 판정 가능 — 추가 Fleet API 불필요 |
| 리스크 | 낮음. 엣지 유실 시 목록이 안 바뀌는 쪽(보수적)이 재탑승 오호출보다 낫고, 필요 시 e-3 거리 보완 |

### 주의

- 「P만 보면 주차」≠「운행 후 주차」. **레벨 → 엣지**로 바꾸는 것이 본 Phase의 핵심.
- `lastRestSyncAt` 쿨다운만으로는 재탑승 오호출을 **막지 못함** (30분 지나면 재발).

**추천:** e-1 승인 후 **e-2 우선** (엣지). e-3은 실차에서 D→P 패킷 유실이 보이면 추가.

---

## 7. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-16 | 초안 — 재탑승 P 오호출 분석 · 운행→P 엣지 판정 · GO |
| 2026-07-16 | 코드 — `park-nearby-trigger` · processor 엣지·이동 보완 · `trf-b2:verify` (B2e-2·3 ✅) |
