# 주행 · 목적지 카드 — 클리어 필드 잔상 정리 (VD3-DCf)

| 항목 | 내용 |
|------|------|
| 목적 | VD3-DC 테스트에서 **목적지·ETA는 클리어됐는데** 「속도」「도착 시 예상 SoC」가 남는 현상을 분석하고, **클리어 whitelist·카드 노출 조건**을 확정한다 |
| 배경 | 이전 주행의 Nav 데이터를 클리어한 뒤에도 「주행 · 목적지」카드에 **속도**, **도착 시 예상 SoC**가 계속 보인다 |
| 관련 | [requirements-vehicle-detail-vd3-destination-clear.md](./requirements-vehicle-detail-vd3-destination-clear.md) (VD3-DC), [requirements-vehicle-detail-vd3.md](./requirements-vehicle-detail-vd3.md) (VD3-3) |
| 적용 | Snapshot `clearTripDestinationFields` · (선택) `shouldShowDrivingTripCard` · V3 「주행 · 목적지」카드 |
| 상태 | **코드 ✅ (DCf-2·3·4) · 실차 DCf-5 ☐** |
| 작성일 | 2026-07-16 |
| ID | **VD3-DCf** |

---

## 1. As-Is 분석

### 1.1 UI (DCf-4 이후)

```text
mode === DRIVING
AND (destinationName OR ETA OR 도착 SoC)   ← 속도 단독 제외
```

| 요소 | 현재 |
|------|------|
| 카드 게이트 | Nav/ETA/도착 SoC 중 하나 필요 · **속도만으로 미표시** |
| 클리어 | destination* · ETA* · expectedEnergy* · **vehicleSpeedKmh · gpsHeading** |
| 주차(P) | Telemetry·REST 모두 trip coalesce 억제 + 명시 클리어 |

### 1.2 VD3-DC 클리어 whitelist (현행)

`clearTripDestinationFields` (`caf-fields.ts`):

| 필드 | DC 문서·코드 |
|------|:------------:|
| `destinationName` · lat/lng | ✅ 클리어 |
| `minutesToArrival` · `milesToArrival` | ✅ 클리어 |
| `expectedEnergyPercentAtArrival` | ✅ 클리어 |
| `vehicleSpeedKmh` · `gpsHeading` | ❌ **의도적 제외** |

트리거: 비-P→P · ASLEEP 진입 (DC-2·3 ✅).

### 1.3 테스트 현상 해석

| 잔상 항목 | 코드상 기대 | 해석 |
|-----------|-------------|------|
| **도착 시 예상 SoC** | P/절전 후 **null** | whitelist에 **이미 포함**. 노출되면 **클리어 미실행·후속 coalesce 복원·검수 타이밍** 중 하나 → **결함 후보** |
| **속도** | P/절전 후에도 **유지 가능** | DC가 **의도적으로 안 지움**. 주행 재개 시 coalesce로 이전 속도가 남으면 카드에 속도만/속도와 함께 노출 → **스펙 갭** |

요청의 「오류」는 사실상 두 갈래다.

1. SoC — **스펙상 사라져야 함** (버그/검수)
2. 속도 — **스펙상 남을 수 있음** (제품 재판단 필요)

---

## 2. 필드별 판단

### 2.1 도착 시 예상 SoC (`expectedEnergyPercentAtArrival`)

| 질문 | 답 |
|------|-----|
| 클리어 대상이 맞는가? | **예** — Nav/도착 계열 · DC whitelist ✅ |
| 지금처럼 노출이 맞는가? | **아니오** — 클리어 트리거 이후에는 나오면 안 됨 |

**잔상 가능 원인 (조사 체크리스트):**

1. 테스트가 **비-P→P / ASLEEP**를 안 탄 경우 (이미 P인 채 갱신만 등)
2. 클리어 Snapshot 직후 **다른 merge 경로**가 이전 값을 다시 씀 (REST CAF preserve 등 — 확인)
3. UI 캐시/폴링 전 스냅샷을 본 경우
4. 실제 DB 최신 Snapshot에 값이 남아 있는지 API로 확인

→ **제품 재정의 불필요**. **검수·버그픽스 GO**.

### 2.2 속도 (`vehicleSpeedKmh`)

| 질문 | 답 |
|------|-----|
| DC 원안 클리어 대상인가? | **아니오** (「잔상이 덜하다」가정) |
| 지금 노출이 「맞다」고 할 수 있는가? | **부분만** — 실시간 주행 속도면 OK · **이전 트립 잔속**이면 「주행 · 목적지」카드에 오해 소지 |

주차 직후·다음 주행 초기에 coalesce로 **옛 속도**가 남으면:

- 목적지는 없는데 카드가 **속도 때문에** 열림
- 관제상 「아직 그 트립」처럼 보임

속도는 **네비 잔상은 아니지만 트립 카드 잔상**이다.

**권고:** P/절전 클리어 시 `vehicleSpeedKmh`도 **null** (선택: `gpsHeading` 동시).  
다음 Telemetry에 실제 속도가 오면 다시 채움 → 주행 중 표시는 유지.

### 2.3 카드 게이트 (보완 · 권고)

클리어와 별도로, 「주행 · 목적지」카드 의미를 좁힌다.

| 옵션 | 내용 | 평가 |
|------|------|------|
| **A. 속도만으로 카드 금지** | 표시 조건에서 `vehicleSpeedKmh` 단독 제거 · 목적지/ETA/도착SoC 중 하나 필요 | 카드 제목과 정합 · **권고** |
| B. 속도는 Hero/관제 요약에만 | 카드 밖 표시 | 후속 가능 |
| C. 현행 유지 | 속도만으로도 카드 | 잔상 재발 · **비권고** |

Hero 관제 요약의 `· N km/h`는 별개 — 본 Phase는 **트립 카드** 중심.

---

## 3. To-Be 설계

### 3.1 클리어 whitelist 개정

`clearTripDestinationFields`:

| 필드 | To-Be |
|------|:-----:|
| destination* · minutes/miles · expectedEnergy* | ✅ (현행) |
| **`vehicleSpeedKmh`** | ✅ **추가** |
| `gpsHeading` | ✅ 권고 (속도 mid-trip 잔상 대칭) |
| 충전·TPMS·공조 | ❌ |

### 3.2 UI

| 규칙 | |
|------|--|
| `shouldShowDrivingTripCard` | **목적지 또는 ETA(분/거리) 또는 도착 SoC** 중 하나 + `DRIVING`. 속도 **단독으로는 미표시** |
| Metric 「속도」 | 카드가 열렸을 때만 · 값이 있을 때 표시 (클리어 후 null이면 숨김) |

### 3.3 비범위

- Tesla Nav 원격 취소 Command  
- Trip 히스토리 UI  
- 속도 게이지를 Hero에 상시 배치하는 작업 (별 Phase)

---

## 4. 수용 기준

1. Gear→P 또는 ASLEEP 후 Snapshot: destination* · ETA* · **expectedEnergy*** · **vehicleSpeedKmh**(개정 시) = null.
2. 클리어 직후 API/상세에서 **도착 시 예상 SoC 미노출**.
3. 재주행·새 Nav 없음: 「주행 · 목적지」에 **이전 목적지·ETA·도착 SoC 없음**.
4. (개정 시) 속도만 남은 Snapshot으로 카드가 **열리지 않음**.
5. 주행 중 새 속도·새 Nav 수신 시 정상 표시 (회귀 없음).
6. DC-2·3 트리거 외 coalesce 동작 회귀 없음.

---

## 5. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **VD3-DCf-1** | 본 문서 승인 (필드별 판정) | ✅ |
| **VD3-DCf-2** | 도착 SoC 잔상 — P 시 coalesce 억제·명시 클리어 | ✅ |
| **VD3-DCf-3** | `clearTripDestinationFields`에 `vehicleSpeedKmh`·`gpsHeading` 추가 | ✅ |
| **VD3-DCf-4** | `shouldShowDrivingTripCard`에서 속도 단독 게이트 제거 | ✅ |
| **VD3-DCf-5** | 실차: P 후 카드 잔상 없음 · 주행 중 표시 유지 | ☐ |

체크리스트: [checklist-vehicle-detail-vd3.md](./checklist-vehicle-detail-vd3.md)  
부모: [requirements-vehicle-detail-vd3-destination-clear.md](./requirements-vehicle-detail-vd3-destination-clear.md)

---

## 6. 의견 · 진행 여부

### 판단: **GO → 코드 반영 (DCf-2·3·4 ✅)**

### 구현 메모

- `clearTripDestinationFields`: speed·heading 추가
- `mergeCafSnapshotFields({ suppressTripCoalesce })`: shift=P 시 trip 필드 이전값 복원 금지
- `processor`: P 상태 매 패킷 trip 클리어 (stale Tesla Nav 차단)
- `rest-sync`: P 시 trip coalesce 억제
- `shouldShowDrivingTripCard`: 속도 단독 오픈 제거

---

## 7. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-16 | 초안 — SoC=클리어 대상(노출은 버그) · 속도=whitelist 확장 GO · 카드 게이트 보완 |
| 2026-07-16 | DCf-2·3·4 코드 ✅ — speed·heading 클리어 · P coalesce 억제 · 카드 게이트 |
