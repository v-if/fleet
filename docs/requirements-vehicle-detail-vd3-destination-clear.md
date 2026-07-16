# 주행 목적지 — 주차·절전 시 Snapshot 클리어 (VD3-DC)

| 항목 | 내용 |
|------|------|
| 목적 | Telemetry로 들어온 **네비 목적지·ETA·도착 예상 SoC** 등을 **주행 종료(Gear→P) 또는 주차(절전) 진입 시 Snapshot에서 클리어**하여, 다음 주행에 **이전 트립 잔상**이 「주행 · 목적지」카드에 나오지 않게 한다 |
| 배경 | 어제 목적지를 「집」으로 설정·주행 → 도착·하차·절전. 아침 재탑승 후 주행 시, **새 목적지가 없는데도** 상세 「주행 · 목적지」에 어제 「집」이 남는다 |
| 관련 | [requirements-vehicle-detail-vd3.md](./requirements-vehicle-detail-vd3.md) (VD3-3 주행 카드), [requirements-tesla-fleet-telemetry-config-add-field.md](./requirements-tesla-fleet-telemetry-config-add-field.md) (CAF Destination*), [requirements-tesla-park-nearby-drive-edge.md](./requirements-tesla-park-nearby-drive-edge.md) (P 엣지 패턴) |
| 적용 | Telemetry Snapshot merge · (선택) ASLEEP 전이 · UI는 데이터 정합 후 자동 반영 (`FleetVehicleDetailViewV3`) |
| 상태 | **코드 ✅ (DC-2·DC-3) · 실차 DC-4 ☐** |
| 작성일 | 2026-07-16 |
| ID | **VD3-DC** |

---

## 1. As-Is 분석

### 1.1 UI

`shouldShowDrivingTripCard`: **모드가 주행**이고 (`DRIVING`) 아래 중 하나라도 있으면 카드 표시.

- `destinationName` · `minutesToArrival` · `milesToArrival` · `expectedEnergyPercentAtArrival` · `vehicleSpeedKmh`

절전·주차(STANDBY) 중에는 카드가 숨겨져 **당일에는 안 보일 수 있음**.  
문제: 값이 Snapshot에 **남아** 다음 **주행** 때 카드가 다시 열리며 **어제 목적지**가 노출.

### 1.2 근본 원인 — coalesce merge

`mergeCafSnapshotFields` (`caf-fields.ts`):

```text
destinationName: current ?? previous ?? null
minutesToArrival / milesToArrival / expectedEnergy… / destinationLat·Lng: 동일
```

이번 Ingress에 Destination*가 **없으면** (`undefined`/`null`) **이전 Snapshot 값을 유지**.  
트립 종료 후 Tesla가 Destination을 안 보내거나 빈 값만 보내면 FMS는 **영구 잔상**.

nearby의 2km stale clear · B2e 주차 엣지와 달리, **목적지 필드에는 클리어 경로가 없음**.

### 1.3 재현 (요청 시나리오)

```text
D1: Nav「집」→ DestinationName 저장
D1: 도착 · Gear=P · 절전 → 카드 숨김 but Snapshot에「집」유지
D2: 재탑승 · 주행(D) · (새 Nav 없음)
   → mode=DRIVING + destinationName=「집」 → 카드에 어제 목적지 ❌
```

---

## 2. 「클리어」판정 — 가능한가?

### 2.1 결론: **가능** (Telemetry 전이로 충분)

| 트리거 | 판정 | 평가 |
|--------|------|------|
| **A. Gear→P (권고 1순위)** | `isDriveThenParkTransition`와 동일 엣지 (비-P→P) | 주행 종료와 가장 일치 · B2e와 패턴 공유 |
| **B. 절전 진입** | `inferAsleep` / status→ASLEEP · wasOnline→asleep | 하차 후 심야 잔상 제거 · A 유실 보완 |
| **C. Destination 명시 클리어** | Tesla가 빈 문자열/`SNA` 등 전송 시 merge에서 null 강제 | 송신에 의존 · 보조 |
| **D. UI만 숨김** | 주차 모드면 필드 무시 | Snapshot 오염 유지 → **다음 주행에 재발** · **비채택** |

**권고 조합:**

```text
1) A: 비-P → P 전이 시 destination* · ETA* · expectedEnergy* 를 null로 쓴 Snapshot 행
2) B: ASLEEP 확정 시 동일 클리어 (아직 남아 있으면)
3) C: (선택) mapper가 빈 DestinationName을 「클리어 센티널」로 해석해 coalesce 우회
```

속도(`vehicleSpeedKmh`)·헤딩은 **트립 잔상이 덜함** (0/미수신이 흔함).  
본 Phase **클리어 대상은 네비/도착 계열만** (속도는 기존 coalesce 유지 또는 P 시 0/null — 선택, 기본은 **목적지 계열만**).

### 2.2 클리어 필드 (whitelist)

| 필드 | 클리어 |
|------|:------:|
| `destinationName` | ✅ |
| `destinationLatitude` · `destinationLongitude` | ✅ |
| `minutesToArrival` · `milesToArrival` | ✅ |
| `expectedEnergyPercentAtArrival` | ✅ |
| `vehicleSpeedKmh` · `gpsHeading` | ✅ ([VD3-DCf](./requirements-vehicle-detail-vd3-trip-clear-fields.md)) |
| 충전·TPMS·공조 CAF | ❌ |

---

## 3. To-Be 설계

### 3.1 Snapshot 쓰기

`applyTelemetryFields` / asleep 경로에서:

```text
if (driveThenPark || enteredAsleep) {
  nextSnapshot = {
    ...merged,
    destinationName: null,
    destinationLatitude: null,
    destinationLongitude: null,
    minutesToArrival: null,
    milesToArrival: null,
    expectedEnergyPercentAtArrival: null,
  }
}
```

헬퍼 예: `clearTripDestinationFields(merged)`.

### 3.2 merge 정책 (보조 · 권고)

목적지 6필드에 한해:

| 옵션 | 내용 |
|------|------|
| **유지+명시 클리어** (권고) | coalesce 유지 · **A/B 트리거에서만** null 덮기 — 구현 단순 · 주행 중 키 누락에도 ETA 유지 |
| 전면 non-coalesce | 매 패킷에 Destination 없으면 즉시 null → 주행 중 카드 깜빡임 위험 · **비권고** |

### 3.3 UI

데이터 클리어 후:

- 주차/절전: 카드 미표시 (현행)
- 다음 주행·Nav 없음: `destination*` null → 속도만 있으면 속도만, **「집」미표시**
- 다음 주행·새 Nav: 새 Destination* 수신 → 정상 표시

`shouldShowDrivingTripCard` 변경 필수는 아님 (데이터 정합으로 충분).

### 3.4 비범위

- Tesla Nav에 목적지 **원격 설정/취소** Command  
- Trip 히스토리 DB (어제 「집」보관 UI)  
- `/v2` 상세 전용 로직 (같은 Snapshot이면 자동 정합)  
- nearby 클리어 (이미 2km / B2e)  

---

## 4. 수용 기준

1. 주행 중 목적지 설정 → 카드에 목적지/ETA 표시 (회귀 없음).
2. **Gear→P** 후 Snapshot에서 destination*·ETA*·expectedEnergy* = null.
3. 절전 진입 후에도 위 필드 null (A를 놓친 경우 B로 정리).
4. 재탑승·재주행·**새 Nav 없음** → 「주행 · 목적지」에 **이전 목적지명 없음**.
5. 새 Nav 설정 시 새 이름/ETA 표시.
6. nearby / 제원 / 충전 CAF coalesce **회귀 없음**.

---

## 5. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **VD3-DC-1** | 본 문서 승인 (GO) | ✅ |
| **VD3-DC-2** | `clearTripDestinationFields` · 비-P→P 시 Snapshot 클리어 | ✅ |
| **VD3-DC-3** | ASLEEP 진입 시 동일 클리어 (보완) | ✅ |
| **VD3-DC-4** | 실차: 어제 목적지 잔상 없음 · 주행 중 표시 유지 | ☐ |
| **VD3-DCf** | 속도·도착 SoC 잔상 — [trip-clear-fields](./requirements-vehicle-detail-vd3-trip-clear-fields.md) | ✅ 코드 · ☐ 실차 |

체크리스트: [checklist-vehicle-detail-vd3.md](./checklist-vehicle-detail-vd3.md)

---

## 6. 의견 · 진행 여부

### 판단: **GO**

| 근거 | |
|------|--|
| 제품 | 잔상 목적지는 **관제 오판**(아직 그곳으로 가는 줄) — 우선 수정 가치 큼 |
| 원인 | coalesce merge의 전형적 함정 · nearby stale clear와 대칭 해결 가능 |
| 리스크 | 낮음. 클리어 whitelist가 좁고, 주행 중 coalesce는 유지 |

### 주의

- UI만 가리면 **재발**. Snapshot 클리어가 필수.
- 주행 중 Destination 키 일시 누락에 coalesce를 끄면 카드가 깜빡임 → **트리거 클리어**가 안전.
- B2e `isDriveThenParkTransition` 재사용 권고 (중복 엣지 로직 방지).

**추천:** DC-1 승인 후 **DC-2+DC-3 한 PR**.

---

## 7. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-16 | 초안 — 목적지 coalesce 잔상 · P/절전 클리어 · GO |
| 2026-07-16 | 코드 — `clearTripDestinationFields` · P 엣지·ASLEEP · verify (DC-2·3 ✅) |
| 2026-07-16 | VD3-DCf 링크 — 속도·도착 SoC 클리어 범위 재정의 |
| 2026-07-16 | VD3-DCf-2·3·4 코드 — speed·heading · P coalesce · 카드 게이트 |
