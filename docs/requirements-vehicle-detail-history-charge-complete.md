# 최근 이력 — 충전 완료인데 「진행 중」(VD3-Hc)

| 항목 | 내용 |
|------|------|
| 목적 | 충전 **완료** 후에도 「최근 이력」이 **진행 중**으로 남고 **종료 시각이 비는** UX 불일치를 해소한다 |
| 배경 | 충전 중 → Hero·충전 서브카드 「충전 중」. 한도 도달 후 서브카드·(관제)는 **충전 완료**인데, 하단 최근 이력만 **진행 중** · 종료 시각 미표시 |
| 관련 | [requirements-vehicle-detail-history.md](./requirements-vehicle-detail-history.md) (VD3-H §3.2 CHARGE 종료), [requirements-charging-card.md](./requirements-charging-card.md) (CC), [requirements-vehicle-detail-history-summary.md](./requirements-vehicle-detail-history-summary.md) (VD3-HS), [requirements-vehicle-detail-soh.md](./requirements-vehicle-detail-soh.md) (VD3-SOH) |
| 적용 | `VehicleActivitySession` CHARGE FSM · `planActivityTransitions` · verify · 이력 UI(데이터 정합으로 자동) |
| 비범위(1차) | STOPPED=종료로 취급 · UI-only soft 라벨 단독 · Snapshot raw를 이력 API에 혼재 · 과거 세션 일괄 백필 배치 |
| 상태 | **코드 완료** · 실차·가상 Hc-3 ☐ |
| 작성일 | 2026-07-19 |
| ID | **VD3-Hc** |

---

## 1. 요청 해석

| # | 요청 | 해석 |
|---|------|------|
| 1 | 충전 완료인데 이력「진행 중」 | Snapshot은 `COMPLETE`인데 ActivitySession은 `endedAt=null` |
| 2 | 충전 완료시간 미표시 | 이력 UI는 `endedAt`이 있을 때만 끝 시각을 그림 (`MM-DD HH:mm –`만 표시) |

재현:

```text
1) 충전 시작 → chargingStatus=CHARGING
   · Hero/서브카드: 충전 중
   · 최근 이력: CHARGE 행 · 진행 중 · startedAt –
2) 한도 도달 → chargingStatus=COMPLETE (케이블 유지 흔함)
   · 서브카드: 「충전 완료」 ✅
   · 최근 이력: 여전히 진행 중 · 끝 시각 없음 ❌
3) (나중) DISCONNECTED 또는 케이블 해제 시에야 세션 close → endedAt
```

---

## 2. As-Is 분석

### 2.1 두 SoT의 「끝」정의

| UI | SoT | 「충전 완료」의미 |
|----|-----|------------------|
| **충전 서브카드** (`ChargingSessionCard`) | 최신 Snapshot `chargingStatus` | `COMPLETE` → 제목「충전 완료」(에너지 공급 종료 · **케이블 연결 가능**) |
| **최근 이력** (`VehicleActivityHistoryCard`) | `VehicleActivitySession` | `endedAt == null` → Badge「진행 중」 |

동일 화면에서 **완료 vs 진행 중**이 동시에 보이면 운영자 신뢰가 깨진다.

### 2.2 CHARGE FSM (VD3-H 현행)

`src/lib/vehicle-activity-session.ts` — `planActivityTransitions`:

| 관측 | 결정 |
|------|------|
| open 없음 + `CHARGING` | `open_charge` |
| open + `CHARGING` / `COMPLETE` / `STOPPED` | **`update_charge`** (`endedAt` 유지 null) |
| open + **`DISCONNECTED`만** | `close_charge` → `endedAt` 기록 |

요구 원문 (VD3-H §3.2):

> 종료 → `DISCONNECTED` … `COMPLETE`/`STOPPED`는 **세션 유지·상태만 갱신** (CC와 동일 철학)

→ **버그라기보다 설계 의도**였으나, CC「완료」와 이력「진행 중」이 **사용자 언어에서 충돌**.  
실차에서는 한도 도달 후 케이블을 바로 빼지 않으면 `COMPLETE`에 오래 머무름 → 이력이 **무기한 진행 중**.

### 2.3 이력 UI 규칙

`VehicleActivityHistoryCard`:

| 항목 | 규칙 |
|------|------|
| 「진행 중」 | `item.inProgress` ≡ `endedAt == null` |
| 시각 | `formatRange(startedAt, endedAt)` — `endedAt` 없으면 끝 시각 공란 |
| Snapshot `COMPLETE` | **참조하지 않음** |

### 2.4 부수 영향

| 영역 | 영향 |
|------|------|
| **VD3-HS** | 오늘 충전 횟수에 **open CHARGE** 포함 → 완료 후에도 「충전 N회」에 잔존 open이 남을 수 있음 |
| **VD3-SOH** | 샘플은 `endedAt` 필요 → close가 `DISCONNECTED`까지 미뤄지면 SOH 포인트도 지연. 또한 close 시점 `sawComplete`는 DISCONNECTED close 시 **항상 false**에 가깝다 |

### 2.5 Verify 고정

`scripts/verify-vd3-h-activity.mjs`: `COMPLETE` → `update_charge` assert — 현 설계를 테스트로 고정 중. 수정 시 **assert 갱신 필수**.

---

## 3. To-Be 설계

### 3.1 세션 「끝」재정의 (제품)

| 개념 | 정의 (1차) |
|------|------------|
| **충전 세션 종료** | 에너지 공급이 끝났다고 관제에 보이는 시점 = Snapshot **`COMPLETE`** (또는 케이블 해제 **`DISCONNECTED`**) |
| **케이블 연결 유지** | 서브카드는 계속「충전 완료」표시 가능 · **이력 행은 이미 완료** |

CC(연결 상태 카드)와 이력(세션 구간)의 「끝」을 **COMPLETE에서 맞춤**.

### 3.2 FSM 변경 (권고 · 옵션 A)

```text
open CHARGE + COMPLETE  →  close_charge  (endedAt = 관측 시각)
open CHARGE + DISCONNECTED → close_charge  (기존)
open CHARGE + STOPPED   → update_charge   (1차 유지 · 일시 중지)
open CHARGE + CHARGING  → update_charge
무 open + CHARGING      → open_charge
무 open + COMPLETE      → no-op (세션 없이 완료만 보이는 잔상 — 이력 행 없음)
COMPLETE 이후 재개 CHARGING → 새 open_charge
```

| 옵션 | 내용 | 평가 |
|------|------|------|
| **A. COMPLETE에서 close** | 사용자 기대·끝 시각·HS/SOH 정합 | **권고 GO** |
| B. UI만 soft「충전 완료」 | DB는 open 유지 | **NO(단독)** — API/HS/SOH 불일치 |
| C. 카피만 「연결 중」 | 끝 시각 미해결 | **NO(단독)** |
| D. STOPPED도 close | 재개 시 세션 쪼개짐 | **1차 NO** |

### 3.3 SOH 정렬 (부수)

COMPLETE에서 close하면 `observation.chargingStatus === "COMPLETE"` → `sawComplete: true`가 **자연히 참**.  
한도 근접 SoC 규칙은 기존 `evaluateSohSampleEligible` 유지.

### 3.4 잔여 open 세션

이미 DB에 남은 `endedAt=null` CHARGE는 **다음 Telemetry/REST**에서 `COMPLETE` 또는 `DISCONNECTED`를 받으면 close.  
별도 배치 백필은 1차 비범위(스모크에서 실차 1대 확인으로 충분).

### 3.5 UI

데이터 정합만. 「진행 중」Badge·`formatRange` 변경 불필요.  
(선택·비1차) open + Snapshot COMPLETE soft 라벨 — FSM 수정 전 방어용, **본 Phase에서는 A만**.

### 3.6 문서 정정

VD3-H §3.2 CHARGE 종료 행을 본 문서대로 **개정**:

> 종료: `COMPLETE` **또는** `DISCONNECTED`. `STOPPED`는 세션 유지·갱신.

---

## 4. 리스크 · 완화

| 리스크 | 완화 |
|--------|------|
| COMPLETE↔CHARGING 토글(일시 재개)로 세션 다수 생성 | 실차 드묾 · 재개=새 세션이 제품적으로 타당. 노이즈 규칙(5분·&lt;1%p) 유지 |
| STOPPED를 완료로 오인 | 1차는 update만 · 별도 티켓 |
| verify/문서와 불일치 | `vd3-h:verify` assert 갱신 · VD3-H §3.2 개정 |
| 과거 open 잔상 | 다음 COMPLETE/DISCONNECTED로 close · 필요 시 후속 백필 |

---

## 5. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **VD3-Hc-0** | 본 문서 승인 · VD3-H §3.2 개정 합의 | ✅ |
| **VD3-Hc-1** | FSM: `COMPLETE` → `close_charge` | ✅ |
| **VD3-Hc-2** | `vd3-h:verify` / SOH 관련 assert 갱신 | ✅ |
| **VD3-Hc-3** | 실차·가상: COMPLETE 후 이력 완료·끝 시각 · 서브카드「충전 완료」공존 | ☐ |

---

## 6. 의견 · 진행 여부

### 판단: **GO**

| 축 | 평가 |
|----|------|
| 제품 | 같은 상세에서 「충전 완료」와 「진행 중」병존은 **결함으로 인지됨**. 수정 타당 |
| 원인 | Snapshot COMPLETE vs 세션 close=`DISCONNECTED` **정의 불일치** (VD3-H가 문서화한 의도) |
| 기술 | FSM 한 분기 + verify · UI/스키마 변경 최소 · SOH `sawComplete`도 개선 |
| 범위 | STOPPED·UI soft·백필은 제외해 작게 유지 |

### GO 조건

1. **COMPLETE → close** (옵션 A). DISCONNECTED close는 유지.
2. **STOPPED는 1차 update 유지**.
3. verify·VD3-H §3.2를 새 계약에 맞게 갱신.
4. 수용: COMPLETE 유지(케이블 꽂힘) 중에도 이력은 **완료**·끝 시각 표시 · 서브카드는「충전 완료」유지.

### 비GO / 보류

| 항목 | 이유 |
|------|------|
| 「설계대로니 버그 아님」방치 | 사용자 언어·화면 정합 실패 |
| UI-only 라벨 | endedAt·HS·SOH 미해결 |
| STOPPED=종료 (1차) | 일시 중지와 충돌 |

### 한 줄 결론

**진행한다.** 원인은 Tesla/`COMPLETE` 부재가 아니라, 이력이 **케이블 해제(`DISCONNECTED`)만 세션 종료**로 본 설계와, 카드의 **「충전 완료」(`COMPLETE`)**가 어긋난 것이다.  
`COMPLETE`에서 세션을 닫으면 진행 중 잔상·종료 시각 누락이 함께 해결된다.

---

## 7. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-19 | 초안 — COMPLETE vs DISCONNECTED 불일치 · 옵션 A GO · VD3-Hc |
| 2026-07-19 | 구현 — `shouldCloseChargeSession` · COMPLETE/DISCONNECTED close · STOPPED update · verify · §3.2 개정 · Hc-3 남음 |
