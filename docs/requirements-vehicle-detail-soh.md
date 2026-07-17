# 차량 상세 — 완충 시 잔여 km 추이 (SOH 근사) (VD3-SOH)

| 항목 | 내용 |
|------|------|
| 목적 | 차량 상세에서 **완충(또는 충전 한도 도달) 시점의 주행 가능 거리(`rangeKm`)** 를 시계열로 보여, 배터리 건강·자산 가치 하락을 **근사** 모니터링한다 |
| 배경 | 관리자: 매일은 안 보지만 월간·자산·EV 특화 운영에서 무게가 큼. IR: 「단말기 없이 OEM API로 자산 가치까지」 스토리. v2·IR에도 SOH 관리가 명시됨 |
| 관련 | [requirements-vehicle-detail-history.md](./requirements-vehicle-detail-history.md) (VD3-H CHARGE 세션), [requirements-charging-card.md](./requirements-charging-card.md), [requirements-vehicle-detail-vd3.md](./requirements-vehicle-detail-vd3.md), [ir/requirements-bori-fleet-v2.md](./ir/requirements-bori-fleet-v2.md), [ir/orangeplanet.md](./ir/orangeplanet.md) |
| 적용 | `/vehicles/[id]` (VD3) — 최근 이력 **아래** 「배터리 건강(추정)」카드 1장 |
| 비범위(1차) | 제조사 BMS 공식 SOH% · 셀 단위 진단 · 플릿 전체 SOH 랭킹 · 국세청/보험 연동 · SoC 일일 곡선(별도 후보) |
| 상태 | **코드 ✅ (SOH-0~4 · verify) · 실차 SOH-5 ☐** |
| 작성일 | 2026-07-18 |
| ID | **VD3-SOH** |

---

## 1. 요청 해석

| # | 요청 | 해석 |
|---|------|------|
| 1 | 상세에 완충 시 잔여 km 추이 | 점(또는 선) 차트 + 최근값·변화량 요약 |
| 2 | SOH | **공식 SOH가 아님** — 완충 시 `EstBatteryRange`/`rangeKm` 시계열로 **열화 근사** |
| 3 | 관리자·IR 가치 | 월간 자산 시그널 · 발표용 차별 슬라이드 |

---

## 2. As-Is 분석

### 2.1 이미 있는 것

| 데이터 | 위치 | 비고 |
|--------|------|------|
| 실시간 `rangeKm` | `VehicleSnapshot` | 현재 잔여 km만 — **완충 시점 아님** |
| `batteryPercent` · `chargeLimitSoc` | Snapshot | 한도(예: 80%) 충전 관행 반영 가능 |
| `CHARGE` 세션 | `VehicleActivitySession` | 시작/끝 SoC · 완속/급속 · **`rangeKm` 미저장** |

### 2.2 핵심 갭

| 갭 | 영향 |
|----|------|
| CHARGE 세션에 **종료 시점 `rangeKm` 없음** | 추이 점을 만들 수 없음 |
| 「완충」정의 없음 | 80% 한도 충전 vs 100% 혼재 시 시계열이 왜곡 |
| 샘플 희소 | 완충이 주 1회면 월 4점 — 단기엔 빈 차트 |
| 공식 SOH와 혼동 | UI에 「추정」고지 필수 |

**결론:** VD3-H 세션만으로는 부족하다. **캡처 필드 + 샘플 규칙**이 선행되어야 한다.

---

## 3. 무엇을 보여 주고 · 무엇을 확인하나

| 표현 | 관리자가 확인하는 것 |
|------|----------------------|
| 시점별 「완충(한도) 시 예상 주행거리」점 | 같은 SoC 기준 잔여 km가 시간에 따라 줄어드는지 |
| 최근값 vs 30/90일 전 (또는 첫 샘플) | 열화 폭(km · %) |
| (선택) 완만 추세선 | IR·월간 리포트용 한눈 시그널 |
| Empty / 점 부족 | 「완충 샘플이 N회 쌓이면 표시」— 오판 방지 |

**확인하지 못하는 것(명시):** 셀 불량 위치, 제조사 SOH%, 보증 판정. 온도·타이어·공조·직전 운행에 따라 `rangeKm`이 출렁일 수 있음.

---

## 4. To-Be 설계

### 4.1 「샘플」정의 (1차 확정 권고)

한 번의 **SOH 샘플** = 아래를 **모두** 만족하는 CHARGE 세션(또는 세션 종료 순간 Snapshot):

| # | 조건 | 권고 |
|---|------|------|
| 1 | 세션 `kind = CHARGE` · `endedAt` 있음 | 진행 중 제외 |
| 2 | 종료 SoC가 **한도 근처** | `endBatteryPercent ≥ (chargeLimitSoc ?? 100) − 2` **또는** 종료 직전 `chargingStatus = COMPLETE` |
| 3 | 종료 시점 `rangeKm` 존재 | null이면 샘플 폐기 |
| 4 | (권고) 이상치 필터 | 직전 샘플 대비 ±25% 초과 시 제외 또는 표시만 하고 추세 계산에서 제외 |

> 법인이 80% 한도만 쓰는 경우가 많음 → **「100% 완충」만 고집하면 샘플이 거의 안 쌓임**.  
> 카피: **「충전 한도 도달 시 잔여 km」** (내부 ID는 SOH 근사 유지).

### 4.2 데이터 모델

**안 B 권고 (VD3-H와 동일 철학 — materialize):**

`VehicleActivitySession`(CHARGE)에 필드 추가:

| 필드 | 설명 |
|------|------|
| `endRangeKm` | 세션 종료(또는 COMPLETE) 시점 Snapshot `rangeKm` |
| `endChargeLimitSoc` | 당시 한도 % (해석용) |
| `sohSampleEligible` | Boolean — §4.1 통과 여부 (쿼리 편의) |

또는 전용 테이블 `VehicleSohSample(vehicleId, sampledAt, rangeKm, batteryPercent, chargeLimitSoc, sessionId?)`.

| 안 | 장점 | 단점 | 1차 |
|----|------|------|:--:|
| A. 조회 시 Snapshot 리플레이 | 스키마 최소 | 비쌈·retention 의존 | 스파이크만 |
| **B. 세션/샘플 materialize** | 차트 빠름·IR 시드 가능 | migrate · FSM 확장 | **채택** |

FSM: CHARGE `update`/`close` 시 observation에 `rangeKm`을 넣어 `endRangeKm` 갱신.  
`ActivityObservation`에 `rangeKm` 추가 필요(현재 미포함).

### 4.3 UI (상세)

```text
┌─ 배터리 건강 (추정) ─────────────────────┐
│ 최근 한도 도달 시  392 km                 │
│ 90일 전 대비  −12 km (−3%)               │
│ [·······선/점 차트 · 최대 12개월]         │
│ Telemetry 추정 · 제조사 SOH와 다를 수 있음 │
└──────────────────────────────────────────┘
```

| 원칙 | |
|------|--|
| 위치 | 「최근 이력」**아래**, 운영 섹션 **위** |
| 최소 점 수 | **3점 미만** → 차트 대신 Empty: 「한도 도달 충전이 더 쌓이면 추이를 표시합니다」 |
| IR/데모 | 가상 시드에 6~12개월 샘플 곡선 생성 (H 시드와 동일 패턴) |
| Hero/관제 요약 | **넣지 않음** — 월간 자산 지표이지 “지금” 질문이 아님 (VD3-HS와 역할 분리) |

### 4.4 API

`GET /api/vehicles/[id]/soh?from=&to=`  
또는 activity 확장 `?include=soh`.

응답 예: `{ samples: [{ at, rangeKm, batteryPercent, chargeLimitSoc }], latest, delta90d, notice }`.

---

## 5. 요구사항 (기능)

| ID | 요구 | 우선 |
|----|------|:----:|
| **SOH-1** | CHARGE 경로에 `rangeKm`(및 한도) 캡처 · migrate | P0 |
| **SOH-2** | 샘플 적격 규칙(§4.1) · 목록/집계 API | P0 |
| **SOH-3** | 상세 카드 · 차트 · 추정 고지 · Empty | P0 |
| **SOH-4** | 가상 시드 샘플 곡선 (IR·데모) | P0 (발표 시) / P1 (운영만이면) |
| **SOH-5** | 이상치 필터 · 90일 delta | P1 |
| **SOH-6** | 플릿 SOH 목록/대시보드 | P2 (비1차) |

---

## 6. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **VD3-SOH-0** | 본 문서 승인 (진행 판단) | ✅ |
| **VD3-SOH-1** | Observation·FSM에 `rangeKm` · `endRangeKm` migrate | ✅ |
| **VD3-SOH-2** | 샘플 쿼리 · API · verify | ✅ |
| **VD3-SOH-3** | VD3 UI 카드+차트 | ✅ |
| **VD3-SOH-4** | 가상 시드 · IR 캡처 스모크 | ✅ 시드 / ☐ IR 캡처 |
| **VD3-SOH-5** | 실차 완충/한도 도달 1회 이상 검수 | ☐ |

체크리스트: [checklist-vehicle-detail-soh.md](./checklist-vehicle-detail-soh.md)

---

## 7. 리스크 · 완화

| 리스크 | 완화 |
|--------|------|
| `rangeKm`이 날씨·공조에 민감 | 「추정」고지 · 이상치 필터 · 단기 판정 금지 카피 |
| 한도 80% vs 100% 혼재 | 샘플에 `chargeLimitSoc` 저장 · 동일 한도끼리만 delta(1차) 또는 정규화 후순위 |
| 샘플 부족 | Empty UX · 시드로 IR · 최소 3점 |
| 「공식 SOH」오해 | UI·IR 문구: **추정 / 한도 도달 시 잔여 km** — SOH% 표기 금지(1차) |
| Snapshot retention | materialize로 분리 — 원시 Snapshot prune과 무관 |

---

## 8. 의견 · 진행 여부

### 판단: **GO (구현 완료 · 실차 검수 남음)**

| 축 | 평가 |
|----|------|
| 제품 | 관리자 월간·자산 · IR 차별 스토리 |
| 기술 | CHARGE `endRangeKm` 캡처 · 한도 도달 샘플 · 차트+시드 |
| 산출물 | migrate · FSM · `GET .../soh` · `VehicleSohCard` · 시드 10점 · `vd3-soh:verify` |

### 비GO / 보류

| 항목 | 이유 |
|------|------|
| Snapshot raw로만 차트 | 완충 시점 불명 · 행 폭주 |
| 1차에 공식 SOH%·셀 진단 | API에 없음 |
| Hero에 SOH 상시 노출 | “지금” 관제와 톤 불일치 |
| 플릿 랭킹·알림 “배터리 교체” | 샘플·신뢰도 부족 시 과잉 조치 |
| SoC 일일 곡선과 동일 Phase | 범위 비대화 — **후속** |

---

## 9. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-18 | 초안 — As-Is 갭(`endRangeKm`) · 한도 도달 정의 · UI·IR 고지 · **조건부 GO** |
| 2026-07-18 | SOH-0~4 코드 ✅ · migrate · verify · 실차 SOH-5 ☐ |
