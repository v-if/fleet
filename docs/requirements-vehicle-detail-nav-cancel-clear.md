# 주행 중 「안내 종료」— 목적지 잔상 클리어 (VD3-DCn)

| 항목 | 내용 |
|------|------|
| 목적 | 차량에서 **내비 안내 종료** 후에도 FMS 「주행 · 목적지」에 **이전 목적지·ETA·도착 SoC**가 남는 잔상을 제거하고, 운영자 혼란을 막는다 |
| 배경 | 목적지 입력 후 주행 중 → 차량 **「안내 종료」** → FMS에는 목적지가 그대로 남고 **속도만** 갱신됨. 운전자는 내비를 껐는데 관제 화면은 아직 목적지가 있어 보임 |
| 관련 | [requirements-vehicle-detail-vd3-destination-clear.md](./requirements-vehicle-detail-vd3-destination-clear.md) (VD3-DC — **주차 P·절전**), [requirements-vehicle-detail-vd3-trip-clear-fields.md](./requirements-vehicle-detail-vd3-trip-clear-fields.md) (VD3-DCf), [requirements-tesla-fleet-telemetry-config-add-field.md](./requirements-tesla-fleet-telemetry-config-add-field.md) (Destination* Invalid), [requirements-vehicle-detail-vd3.md](./requirements-vehicle-detail-vd3.md) |
| 적용 | Telemetry mapper · CAF trip coalesce · Snapshot 쓰기 · V3 「주행 · 목적지」카드(데이터 정합으로 자동) |
| 비범위(1차) | 원격으로 내비 취소 Command · Trip 히스토리 보관 UI · 속도 잔상(실시간 갱신 유지) |
| 상태 | **코드 완료** · 실차 DCn-4 ☐ |
| 작성일 | 2026-07-18 |
| ID | **VD3-DCn** |

---

## 1. 요청 해석

| # | 요청 | 해석 |
|---|------|------|
| 1 | 안내 종료 시 목적지 클리어 방법 있는가 | **있다** — Tesla가 Destination*에 **Invalid**를내며, FMS coalesce가 이를 “없음”으로 오해해 잔상 유지 |
| 2 | 진행 여부 | **조건부 GO** — DC(P/절전)와 **다른 트리거**(주행 중 Nav 해제) |

VD3-DC와 구분:

| | VD3-DC / DCf | **VD3-DCn (본 문서)** |
|--|--------------|----------------------|
| 상황 | 하차·주차(P)·절전 | **계속 주행** + 내비만 끔 |
| 트리거 | Gear→P · ASLEEP | Destination* **Invalid/빈 값 명시 수신** |
| 속도 | 클리어(DCf) | **유지**(실시간 갱신 중) |

---

## 2. As-Is 분석

### 2.1 재현 (요청)

```text
1) Nav 목적지 설정 → DestinationName 등 Snapshot 저장
2) 주행 중 (Gear≠P) · 「주행 · 목적지」카드 표시
3) 차량 「안내 종료」
4) VehicleSpeed만 계속 옴 → 속도 숫자만 변함
5) destinationName · ETA · 도착 SoC → Snapshot에 그대로 → 카드 잔상 ❌
```

### 2.2 Tesla 계약 (공식 Available Data)

| 필드 | 내비 없을 때 |
|------|----------------|
| `DestinationName` | **Invalid** |
| `DestinationLocation` | **Invalid** |
| `MinutesToArrival` / `MilesToArrival` | **Invalid** |
| `ExpectedEnergyPercentAtTripArrival` | **Invalid** |

CAF 문서에도 「내비 미설정 시 Invalid — UI empty」가 있으나, **Snapshot coalesce 우회는 미완**.

### 2.3 FMS 코드 경로 (잔상 원인)

```text
Tesla Invalid
  → mapper readUsableString: "Invalid" → undefined
  → parse 결과 destinationName: null  (또는 키 자체가 다음 패킷에 없음)
  → mergeTripAwareField: current ?? previous
       null ?? "집"  →  "집"  유지  ← 잔상
```

| 계층 | 동작 | 문제 |
|------|------|------|
| `readUsableString` | Invalid → `undefined` | “클리어”와 “미수신” 구분 실패 |
| `parseTelemetryMessage` | `destinationName ?? null`로 **항상** 키 채움 | 패킷에 Destination 없어도 null → coalesce 복원 |
| `mergeTripAwareField` | `null ?? previous` = previous | **명시 null도 이전값 복원** |
| VD3-DC | 비-P→P · ASLEEP만 클리어 | **주행 중 안내 종료는 트리거 안 됨** |

DoorState는 `doorStatePresent`로 “이번 패킷에 있음”을 구분한다. Destination*에는 **동등한 presence/clear 센티널이 없다**.

### 2.4 왜 속도만 변하나

`VehicleSpeed`는 주행 중 자주 수신 → coalesce와 무관하게 갱신.  
Destination*는 interval ~60s이고, Invalid를 null로만 넣으면 **이전 목적지명이 덮이지 않음**.

---

## 3. 「클리어」가능한가?

### 3.1 결론: **가능** (Telemetry만으로 충분 · Command 불필요)

| 안 | 내용 | 평가 |
|----|------|------|
| **A. Invalid/빈 Destination* = 명시 클리어** (권고) | 패킷에 Destination* **키가 있고** 값이 Invalid/빈/비가용 → Nav 스위트 null, coalesce 금지 | Tesla 계약과 정합 · 주행 중에도 동작 |
| **B. 시간 stale** (보조) | 주행 중 N분 동안 Destination* 미수신이면 클리어 | 키 누락과 혼동 · 깜빡임 위험 · **1차 비권고** |
| **C. UI만 숨김** | Snapshot은 두고 카드만 숨김 | 다음 패킷/재진입에 재발 · **비채택** |
| **D. P까지 대기** | 현 VD3-DC만 | 본 시나리오 **미해결** |

**권고:** **A**를 VD3-DC의 「옵션 C」를 실제로 구현하는 Phase로 승격.

### 3.2 클리어 필드 (whitelist)

안내 종료 시 (속도 제외):

| 필드 | 클리어 |
|------|:------:|
| `destinationName` | ✅ |
| `destinationLatitude` · `destinationLongitude` | ✅ |
| `minutesToArrival` · `milesToArrival` | ✅ |
| `expectedEnergyPercentAtArrival` | ✅ |
| `vehicleSpeedKmh` · `gpsHeading` | ❌ (실시간 유지) |

한 필드라도 **명시 Invalid**면 Nav 스위트 **일괄 클리어** 권고 (부분 잔상 방지).

### 3.3 구현 계약 (undefined vs null)

| 의미 | 파서 | merge |
|------|------|-------|
| 이번 패킷에 Destination* **키 없음** | 필드 `undefined` (omit) | **coalesce** (이전 유지) |
| 키 있음 + Invalid/빈/비가용 | 필드 `null` + `tripNavCleared=true` (또는 presence) | **null 확정** · previous 무시 |
| 키 있음 + 유효 값 | 문자열/숫자 | 새 값 |

DoorState `doorStatePresent`와 동일 패턴.

---

## 4. To-Be 설계

### 4.1 Mapper

1. `hasDataField(data, DestinationName|…)`로 **키 presence** 판정.  
2. presence + Invalid/비가용 → `destinationName: null`, `tripNavCleared: true`.  
3. presence 없음 → Destination 필드를 Parsed에 **넣지 않음** (`undefined`).  
4. Location Invalid도 좌표 null + cleared.

### 4.2 Merge (`caf-fields`)

```text
if (current.tripNavCleared) {
  → clearTripDestinationFields 중 Nav/ETA/도착SoC만 (속도 제외)
} else {
  → 기존 mergeTripAwareField (undefined만 coalesce)
}
```

`null ?? previous` 복원 경로를 Destination*에서 제거하려면 **presence/cleared 플래그 필수**.

### 4.3 Processor

추가 Gear 트리거 불필요. cleared 시 Snapshot에 null 기록 → `shouldShowDrivingTripCard`가 목적지/ETA 없어지면 **카드 숨김**(속도만으로는 미표시 — DCf-4).

### 4.4 UI

데이터 정합만. 별도 버튼·카피 불필요.  
Empty: 주행 중이어도 Nav 없으면 「주행 · 목적지」블록 없음(현행 게이트).

### 4.5 실차 검수 포인트

1. Nav 설정 → 카드에 목적지.  
2. **안내 종료** (주행 유지) → **60s 내**(Destination interval) 목적지·ETA·도착 SoC 사라짐 · 속도는 갱신.  
3. 재설정 → 새 목적지 표시.  
4. 키 없는 중간 Speed 전용 패킷에서는 **목적지 유지**(깜빡임 없음).  
5. P/절전 클리어(DC) 회귀 없음.

Ingress 모니터로 `DestinationName=Invalid` 수신 여부 확인(개발 모니터).

---

## 5. 리스크 · 완화

| 리스크 | 완화 |
|--------|------|
| Invalid를 “키 없음”과 동일 취급 | presence + cleared 플래그 |
| Destination interval 지연(최대 ~60s) | 수용 · 카피로 약속하지 않음 · 실차 측정 |
| Tesla가 Invalid를 안 보냄 | 실차 실패 시 B(stale) 검토 · 1차는 A만 |
| typed Invalid (string 아님) | mapper에서 invalid oneof/빈 location 처리 보강 |
| 과클리어(일시 누락) | **키가 있을 때만** clear — 누락은 coalesce |

---

## 6. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **VD3-DCn-0** | 본 문서 승인 | ✅ |
| **VD3-DCn-1** | Mapper: Destination* presence · Invalid→cleared | ✅ |
| **VD3-DCn-2** | CAF merge: cleared 시 Nav 스위트 null (속도 제외) | ✅ |
| **VD3-DCn-3** | verify 단위 테스트 (Invalid / 키없음 / 유효) | ✅ `npm run vd3-dcn:verify` |
| **VD3-DCn-4** | 실차: 안내 종료 → 잔상 제거 · 깜빡임 없음 | ☐ |

---

## 7. 의견 · 진행 여부

### 판단: **GO (단계 분할)** — 제품·기술 모두 타당

| 축 | 평가 |
|----|------|
| 제품 | 운영자 혼란이 실재. DC만으로는 **주행 중 안내 종료** 미해결 |
| 기술 | Tesla가 Invalid를 주도록 문서화됨. 잔상은 **FMS coalesce 버그/갭**에 가깝음 |
| 범위 | Command·UI 개편 불필요. mapper+merge만 · VD3-DC와 **보완 관계** |
| 일정 | VS/SOH와 독립 · 작음 · 실차 DCn-4가 성패 가름 |

### GO 조건

1. **undefined(미수신) ≠ null(클리어)** 계약 고정.  
2. 속도는 클리어하지 않음.  
3. 실차에서 Invalid 수신을 Ingress로 확인. Invalid가 안 오면 **문서 개정 후 stale 보조** 검토(1차 범위 밖).

### 비GO / 보류

| 항목 | 이유 |
|------|------|
| N분 무수신이면 무조건 클리어 (1차) | 패킷 누락 깜빡임 |
| 원격 내비 취소 Command | 비범위 · Virtual Key/권한 |
| UI만 가리기 | Snapshot 오염 유지 |
| VD3-DC 폐기 | P/절전 잔상은 계속 필요 — **유지** |

### 한 줄 결론

**진행한다.** 「안내 종료」클리어는 **가능**하고, 방법은 Tesla **Destination* Invalid를 “명시 클리어”로 취급**해 coalesce를 끊는 것이다.  
지금 잔상은 차량이 안 알려서가 아니라, **Invalid를 이전값 유지로 해석하는 FMS merge** 때문이다.

---

## 8. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-18 | 초안 — 안내 종료 시나리오 · Invalid/coalesce 원인 · DoorState형 presence · **GO** |
| 2026-07-18 | 구현 — mapper `tripNavCleared` · CAF Nav-only clear · `vd3-dcn:verify` · 실차 DCn-4 남음 |
