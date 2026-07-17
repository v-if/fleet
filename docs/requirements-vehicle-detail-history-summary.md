# 차량 상세 — 운행 요약 (히스토리 한 줄 · Hero 관제) (VD3-HS)

| 항목 | 내용 |
|------|------|
| 목적 | `VehicleActivitySession` 집계로 **오늘 운행·충전 요약**을 보여주고, Hero 관제 요약에는 **오늘 운행 또는 미운행**만 시그널로 노출한다 |
| 배경 | VD3-H 리스트만으로는 “오늘 얼마나?”가 한눈에 안 들어온다. 관제 요약은 *지금* 질문, 히스토리는 *실적* 질문 — 역할을 나눠 배치한다 |
| 관련 | [requirements-vehicle-detail-history.md](./requirements-vehicle-detail-history.md) (VD3-H), [requirements-vehicle-detail-vd3.md](./requirements-vehicle-detail-vd3.md) (§5.5·관제 요약) |
| 적용 | `/vehicles/[id]` — (1) 「최근 이력」카드 헤더 한 줄 (2) Hero 「관제 요약」1줄 |
| 비범위(1차) | 주간 Top·플릿 KPI·대시보드 위젯 · 충전 패턴 상세 · Snapshot retention |
| 상태 | **코드 ✅ (HS-0~3 · verify) · 스모크 HS-4 ☐** |
| 작성일 | 2026-07-18 |
| ID | **VD3-HS** |

---

## 1. 요청 해석

| # | 요청 | 해석 |
|---|------|------|
| 1 | 히스토리 카드 위 한 줄 요약 | `오늘 주행 18.2 km · 1시간 20분 · 충전 1회` |
| 2 | Hero 관제 요약에 표시 | **오늘 운행** 또는 **미운행 N일**만 — 주간·충전 횟수 복제 금지 |

---

## 2. 배치 · 역할

| 구역 | 질문 | 표시 |
|------|------|------|
| **히스토리 카드 헤더** | 오늘 실적 요약 | 주행 km · 시간 · 충전 횟수 |
| **Hero 관제 요약** | 지금 썼나 / 방치인가 | 운행 시 오늘 km·시간 / 미운행 시 N일 |

주간·충전 상세·세션 리스트는 히스토리 본문(VD3-H)이 SoT.

---

## 3. 집계 규칙 (KST)

기준 타임존: **Asia/Seoul** 자정.

### 3.1 오늘 주행

| 지표 | 정의 |
|------|------|
| `todayDistanceKm` | 오늘 구간과 겹치는 `DRIVE` 세션의 `distanceKm` 합 (진행 중은 현재까지의 값) |
| `todayDriveDurationMs` | 각 DRIVE의 `(endedAt ?? now) − max(startedAt, todayStart)` 합 |
| 운행 있음 | 거리 &gt; 0 또는 진행 중 DRIVE 또는 duration &gt; 0 |

### 3.2 오늘 충전 (히스토리 한 줄만)

| 지표 | 정의 |
|------|------|
| `todayChargeCount` | 오늘 시작한 `CHARGE` + 진행 중 CHARGE 건수 |

### 3.3 미운행

| | |
|--|--|
| 정의 | **DRIVE 세션이 없는** 연속 일수 (KST). **충전만 한 날은 미운행으로 유지** |
| 계산 | 마지막 DRIVE의 `endedAt ?? startedAt`이 속한 KST 일자 → 오늘과의 일수 차. 오늘 운행 있으면 `0` |
| 이력 없음 | 세션 0건 → `idleDays = null` (카피: 숨김 또는 「운행 이력 없음」— 1차는 **관제 요약 줄 생략**) |

---

## 4. UI 카피

### 4.1 히스토리 카드 헤더 (HS-A)

```text
오늘 주행 18.2 km · 1시간 20분 · 충전 1회
```

| 조건 | 카피 |
|------|------|
| 오늘 운행·충전 모두 0 | `오늘 주행 없음 · 충전 없음` |
| 운행만 | `오늘 주행 12.4 km · 45분 · 충전 없음` |
| 충전만 | `오늘 주행 없음 · 충전 1회` |
| 로딩/실패 | 헤더 숫자 생략 · 「최근 7일」만 유지 |

시간 포맷: `H시간 M분` (1시간 미만이면 `M분`만).

### 4.2 Hero 관제 요약 1줄 (HS-B)

| 조건 | 카피 | tone |
|------|------|------|
| 오늘 운행 있음 | `오늘 18.2 km · 1시간 20분` | info |
| 미운행 1–2일 | `미운행 N일` | info |
| 미운행 ≥3일 | `미운행 N일` | **warn** |
| idleDays null | **줄 생략** | — |

**넣지 않음:** 충전 횟수 · 이번 주 합계 · 세션 리스트.

위치: `buildOpsSummary` 목록에서 **모드 다음**(배터리·이상보다 앞뒤는 기존 이상 우선 — **이상 warn이 있으면 그 아래**, 없으면 모드 직후 1줄).  
권고 순서: 모드 → (있으면) 오늘/미운행 → 배터리 → 잠금/문/TPMS…

`slice(0, 6)` 유지 — 오늘/미운행이 이상을 밀어내지 않도록, **warn 항목이 많으면 오늘/미운행을 생략 가능**하지 말고, 이상 우선으로 정렬하되 오늘/미운행은 info로 모드 직후 고정(최대 6이 넘치면 말단 ok 줄이 잘림).

---

## 5. 데이터 · API

| | |
|--|--|
| 원천 | `VehicleActivitySession` |
| 헬퍼 | `summarizeVehicleActivity(vehicleId)` — 순수 집계 + DB 조회 |
| 노출 | (1) `GET .../activity` 응답에 `summary` (2) `getVehicleDetail`에 `activitySummary` (Hero) |

스키마 변경 없음.

---

## 6. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **VD3-HS-0** | 본 문서 승인 | ✅ |
| **VD3-HS-1** | `summarizeVehicleActivity` · verify | ✅ |
| **VD3-HS-2** | activity API `summary` · 히스토리 헤더 한 줄 | ✅ |
| **VD3-HS-3** | detail DTO · Hero 관제 요약 1줄 | ✅ |
| **VD3-HS-4** | 실차·가상 시드 스모크 | ☐ |

체크리스트: [checklist-vehicle-detail-history-summary.md](./checklist-vehicle-detail-history-summary.md)

---

## 7. 의견 · 진행 여부

### 판단: **GO (구현 완료 · 스모크 남음)**

| | |
|--|--|
| 히스토리 한 줄 | 실적 SoT · 체감 큼 |
| Hero | 오늘 운행 **또는** 미운행만 — 관제 “지금/방치” 질문과 정합 |
| 비GO | Hero에 충전 횟수·주간 요약 상시 복제 |

### 구현 요약

| 산출물 | 경로 |
|--------|------|
| 집계 | `summarizeVehicleActivity` · `computeActivitySummaryFromSessions` |
| API | `GET .../activity` → `summary` · detail → `activitySummary` |
| UI | 히스토리 헤더 · `buildOpsSummary` Hero 줄 |
| Verify | `npm run vd3-h:verify` (HS 케이스 포함) |

---

## 8. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-18 | 초안 — 히스토리 헤더 · Hero 오늘/미운행 · GO |
| 2026-07-18 | HS-0~3 코드 ✅ · verify · HS-4 스모크 ☐ |
