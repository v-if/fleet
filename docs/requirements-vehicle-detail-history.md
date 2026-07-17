# 차량 상세 — 주행·충전 히스토리 (VD3-H)

| 항목 | 내용 |
|------|------|
| 목적 | 차량 상세에 **주행·충전 기록 리스트**를 표시해, 관리자가 “이 차가 언제 달렸고·언제 충전했는지”를 최근 이력으로 확인할 수 있게 한다 |
| 배경 | Snapshot에 쌓이는 `shiftState`·`chargingStatus`·`odometerKm`·`batteryPercent` 등을 원천으로 히스토리를 만들 수 있다고 판단함. 다만 **Snapshot ≠ 세션 레코드**이므로 세션화(집계)가 선행되어야 한다 |
| 관련 | [requirements-vehicle-detail-vd3.md](./requirements-vehicle-detail-vd3.md) (§5.5 후순위·운행 요약), [requirements-vehicle-detail-history-summary.md](./requirements-vehicle-detail-history-summary.md) (VD3-HS), [requirements-charging-card.md](./requirements-charging-card.md) (CC — *실시간* 충전), [requirements-tesla-fleet-telemetry.md](./requirements-tesla-fleet-telemetry.md), [requirements-user-db.md](./requirements-user-db.md) |
| 적용 | `/vehicles/[id]` (VD3) — 관제 블록·운영 구역 **아래** 히스토리 섹션. `/fleet/*` 레거시·대시보드 집계는 비범위(1차) |
| 비범위(1차) | 국세청 운행일지·운전자 귀속·경로 재생·법인카드 대조·SOH·플릿 전체 통계 (→ Fleet v2 / IR) · 원격 제어 이력 |
| 상태 | **코드 ✅ (H-0~H-3·H-5 시드·verify) · 실차 검수 H-4 ☐** |
| 작성일 | 2026-07-18 |
| ID | **VD3-H** |

---

## 1. 요청 해석

| # | 요청 | 해석 |
|---|------|------|
| 1 | 상세에 주행·충전 기록 리스트 | 최근 N건(또는 기간)의 **완료·진행 중 세션** 목록 |
| 2 | UI 후보 A: 주행 카드 + 충전 카드 2장 | 가능하나 VD3 「카드 나열감」 갭과 충돌 |
| 3 | UI 후보 B: 1카드 + 필터(전체/주행/충전) | **권고** — 한 구역·한 목적 |
| 4 | Snapshot을 원천으로 | **부분 동의** — 원천 후보는 맞으나, 그대로 리스트하면 안 됨 (§2) |

---

## 2. As-Is 분석 (데이터·화면)

### 2.1 Snapshot — 무엇이 쌓이는가

| 사실 | 코드/스키마 |
|------|-------------|
| Telemetry·REST 반영 시 `vehicleSnapshot.create`로 **행 append** | `processor.ts` · `rest-sync.ts` |
| 행 = **시점 상태** (위치·SOC·충전상태·변속·odometer …) | `VehicleSnapshot` |
| 차량당 최신 1행만 쓰는 조회가 관제 UI SoT | `findFirst` + `orderBy lastUpdatedAt desc` |
| Snapshot 보존·삭제(retention) 정책 **없음** | prune 코드 미확인 |

**핵심:** Snapshot에는 “주행 기록 1건”, “충전 기록 1건” 컬럼/테이블이 **없다**.  
`chargingStatus=CHARGING`인 스냅샷 100행 ≠ 충전 세션 100건.

### 2.2 VehicleEvent — 히스토리로 쓸 수 있는가

| | |
|--|--|
| 타입 | `ALERT` · `WARNING` · `IDLE` · `OFFLINE` |
| 용도 | 이상·유휴·오프라인 이벤트 |
| 결론 | **주행/충전 세션 원천 아님** |

### 2.3 상세 UI As-Is

| 있음 | 없음 |
|------|------|
| 실시간 가동·SOC·충전 중 카드(CC)·주행 중 목적지(CAF) | 완료된 트립/충전 **목록** |
| 운영·연동 타임라인(VD-OPS) | “오늘 운행 km·세션” 집계 |
| VD3 §5.5에 **운행 요약·이벤트 = 후순위(VD3-D)** 로 이미 표기 | 세션 API |

### 2.4 배경 가설의 정정

| 가설 | 판정 | 보정 |
|------|:----:|------|
| Snapshot에 주행·충전 “기록이 있다” | △ | **상태 시계열**은 있다. **세션 레코드**는 없다 |
| 그대로 리스트 표시 가능 | ❌ | `shiftState`/`chargingStatus` **전이**로 세션 경계를 잡아야 함 |
| odometer·SOC 변화로 거리·충전량 산출 가능 | ○ | 세션 시작/끝 스냅샷의 delta로 **근사** 가능 (공백·절전 시 오차) |

---

## 3. To-Be 설계

### 3.1 UI — **1카드 + 필터 (확정 권고)**

```text
┌─ 최근 이력 ──────────────────────────────┐
│ [전체] [주행] [충전]     최근 7일 · N건   │
│                                          │
│ ● 주행  07-17 14:02–15:18  12.4 km       │
│ ● 충전  07-17 15:40–16:55  42%→78%  AC   │
│ ● 주행  07-17 09:10–09:45   3.1 km       │
│ …                                        │
│ (더 보기 / 페이지)                        │
└──────────────────────────────────────────┘
```

| 원칙 | |
|------|--|
| 위치 | 관제 블록(충전 CC·퀵타일·TPMS) **아래**, 운영·연동 **위 또는 접힌 아래** — “지금” 다음에 “최근” |
| 카드 수 | **1장**. 2장 분리는 1차 비권고 (스크롤·중복 빈 상태) |
| 필터 | `전체` · `주행` · `충전` — 클라이언트 또는 API `?kind=` |
| Empty | 「최근 7일 이력이 없습니다」— Telemetry 공백·신규 등록 차량 대비 |
| 진행 중 | 현재 `운행`/`충전 중`이면 리스트 **맨 위**에 「진행 중」행 (종료 시각·거리 미확정) |

**2카드안을 쓰지 않는 이유:** VD3 갭 「카드 나열감」·CC와 역할 중복 위험(실시간 vs 이력). 필터 한 줄로 동일 정보량.

### 3.2 세션 정의 (비즈니스)

#### 주행 세션 (`DRIVE`)

| | 규칙(1차) |
|--|-----------|
| 시작 | `shiftState`가 비주행(`P`/null) → 주행(`D`/`R`/`N` 중 이동 신호) 전이. 보조: `status` DRIVING / `vehicleSpeedKmh`>0 |
| 종료 | 주행 → `P`(주차) 또는 `ASLEEP`/장시간 Offline. 목적지는 VD3-DC와 동일하게 종료 시 잔상 무시 |
| 표시 | 시작~종료 시각 · **거리** ≈ `odometerKm_end − odometerKm_start` · (선택) 시작/종료 SOC |
| 제외 | 30초 미만·거리 &lt; 0.1 km → 노이즈로 숨김 또는 병합 |

#### 충전 세션 (`CHARGE`)

| | 규칙(1차) |
|--|-----------|
| 시작 | `chargingStatus` → `CHARGING` (또는 `STOPPED`/`COMPLETE`에서 재개 시 새 세션 vs 연속 — **연속 권고**) |
| 종료 | → `DISCONNECTED` 또는 케이블 해제 추론. `COMPLETE`/`STOPPED`는 **세션 유지·상태만 갱신** (CC와 동일 철학) |
| 표시 | 시작~종료 · SOC 시작→끝 · (있으면) `chargingPowerKind` 완속/급속 · 평균/최대 kW |
| 제외 | SOC 변화 &lt; 1%p 이고 5분 미만 |

> 절전·신호 공백이 있으면 세션이 쪼개지거나 거리/충전량이 과소 추정될 수 있다. UI에 **「Telemetry 기반 추정」** 한 줄 고지(운영 접힘 또는 섹션 캡션).

### 3.3 데이터 아키텍처 — 2안

| 안 | 내용 | 장점 | 단점 | 1차 |
|----|------|------|------|:--:|
| **A. 조회 시 세션화** | API가 최근 Snapshot N일을 읽어 전이 세션 생성 | 스키마 없음·빠른 착수 | 쿼리·CPU 비용 · retention 없으면 테이블 비대 | 스파이크 |
| **B. 세션 테이블 materialize** | `VehicleDriveSession` / `VehicleChargeSession` (또는 통합 `VehicleActivitySession`) — Telemetry write 경로에서 개폐 | 리스트 빠름·정확도 개선 여지 | migrate·writer 복잡도 | **본구현 권고** |

**권고:** 스파이크(A)로 전이 규칙·오차 확인 → **B로 확정**. Snapshot만으로 永久 히스토리 UI를 붙이지 말 것.

#### B 스키마 스케치 (통합 테이블 권고)

```text
VehicleActivitySession
  id, vehicleId
  kind: DRIVE | CHARGE
  startedAt, endedAt?          -- null = 진행 중
  startOdometerKm, endOdometerKm?
  distanceKm?                  -- DRIVE
  startBatteryPercent, endBatteryPercent?
  energyAddedPercent?          -- CHARGE (끝−시작, clamp)
  chargingPowerKind?           -- AC|DC
  peakChargerPowerKw?
  source: TELEMETRY | DERIVED
  createdAt, updatedAt
  @@index([vehicleId, startedAt])
  @@index([vehicleId, kind, startedAt])
```

Snapshot append 경로에 **경량 FSM**(이전 최신 세션 open 여부 + 현재 shift/charge)만 추가. 매 패킷마다 풀 리플레이 금지.

### 3.4 API · 표시 필드 (1차)

`GET /api/vehicles/[id]/activity?kind=all|drive|charge&from=&to=&limit=`

| 필드 | 주행 | 충전 |
|------|:----:|:----:|
| 시각 구간 | ✅ | ✅ |
| 거리 km | ✅ | — |
| SOC 시작→끝 | 선택 | ✅ |
| 완속/급속 | — | ✅ |
| 진행 중 뱃지 | ✅ | ✅ |

기본: **최근 7일 · 최대 50건**. 「더 보기」로 연장.

### 3.5 화면 배치와 기존 CC 역할 분리

| | 실시간 (CC / CAF) | 히스토리 (VD3-H) |
|--|-------------------|------------------|
| 질문 | *지금* 충전/주행 중인가? | *최근에* 언제·얼마나? |
| 데이터 | 최신 Snapshot 1행 | 세션 테이블/집계 |
| 노출 | 조건부(충전 중 등) | 상시(빈 목록 허용) |

---

## 4. 요구사항 (기능)

| ID | 요구 | 우선 |
|----|------|:----:|
| **H-1** | 상세에 「최근 이력」1카드 · 필터 전체/주행/충전 | P0 |
| **H-2** | 주행·충전 세션 정의(§3.2)에 따른 목록 API | P0 |
| **H-3** | 진행 중 세션 상단 표시 | P0 |
| **H-4** | Empty·추정 고지 카피 | P0 |
| **H-5** | Snapshot→세션 materialize (안 B) 또는 스파이크 후 확정 | P0 |
| **H-6** | 노이즈 세션 필터(짧은 주행/미소 충전) | P1 |
| **H-7** | Snapshot retention(예: 원시 14~30일) — 세션 테이블과 분리 | P1 |
| **H-8** | 가상 차량 시드에 샘플 세션 | P1 (데모) |
| **H-9** | 대시보드 「오늘 운행」위젯·플릿 통계 | P2 (비1차) |

---

## 5. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **VD3-H-0** | 본 문서 승인 (진행 판단) | ✅ |
| **VD3-H-1** | 스파이크: FSM 순수 로직 verify (`npm run vd3-h:verify`) | ✅ |
| **VD3-H-2** | `VehicleActivitySession`(+migrate) · writer FSM | ✅ |
| **VD3-H-3** | `GET .../activity` · VD3 UI 1카드+필터 | ✅ |
| **VD3-H-4** | 실차 검수(주행 1회·충전 1회)·카피 | ☐ |
| **VD3-H-5** | (P1) 가상 시드 샘플 세션 · 노이즈 필터(코드 포함) · retention 보류 | ✅ 시드·노이즈 / ☐ retention |

체크리스트: [checklist-vehicle-detail-history.md](./checklist-vehicle-detail-history.md) · [checklist-vehicle-detail-vd3.md](./checklist-vehicle-detail-vd3.md) · [development-checklist.md](./development-checklist.md)

---

## 6. 의견 · 진행 여부

### 판단: **GO (구현 완료 · 실차 검수 남음)**

| 축 | 평가 |
|----|------|
| 제품 | 관리자 질문(「언제 달렸나/충전했나」)은 타당. VD3 §5.5·v2 운행내역과도 정합. CC와 역할만 분리하면 ROI 있음 |
| 기술 | Snapshot append는 **원천 후보**로 충분. 리스트 SoT는 **`VehicleActivitySession`** |
| UX | **1카드+필터 GO** · **2카드 NO(1차)** |
| 구현 | Telemetry·REST·ASLEEP 추론 경로에 FSM 훅 · API · VD3 카드 · 가상 시드 · `vd3-h:verify` |

### 구현 요약

| 산출물 | 경로 |
|--------|------|
| 스키마·migrate | `prisma/schema.prisma` · `20260718070000_vd3_h_activity_session` |
| FSM · list API 로직 | `src/lib/vehicle-activity-session.ts` |
| Writer 훅 | `telemetry/processor.ts` · `hybrid/rest-sync.ts` |
| HTTP | `GET /api/vehicles/[id]/activity` |
| UI | `VehicleActivityHistoryCard` → `FleetVehicleDetailViewV3` |
| Verify | `npm run vd3-h:verify` |

### 비GO / 보류

| 항목 | 이유 |
|------|------|
| Snapshot raw를 그대로 리스트 | 세션이 아님 · 성능·가독성 붕괴 |
| 1차에 주행+충전 **2카드** | 밀도·빈 상태 중복 |
| Snapshot retention | P1 보류 (세션 테이블과 분리) |
| 경로 폴리라인·지도 재생 | 저장량·개인정보·비MVP |
| 운전자/부서/국세청 양식 | Fleet v2 |
| 「오늘 운행」대시보드 KPI | H-9 · 세션 API 안정 후 |

---

## 7. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-18 | 초안 — As-Is 정정 · 1카드+필터 · 세션 정의 · 안 A/B · **조건부 GO** |
| 2026-07-18 | H-0~H-3·H-5(시드·노이즈) 코드 ✅ · migrate 적용 · 실차 H-4 ☐ |
