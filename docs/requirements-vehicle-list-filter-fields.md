# 차량 목록 — 열·충전·필터 정리 (VL-F)

| 항목 | 내용 |
|------|------|
| 목적 | 목록 테이블 **열 라벨·충전 표시·상단 필터**를 관리자 스캔에 맞게 줄이고, VL/VD3 가동 언어와 맞춘다 |
| 배경 | 필터 10개가 겹치고(이상·이상상태·연결 끊김 등), 「주행거리」는 잔여 km와 혼동되며, 충전은 가동 모드에만 있어 **미연결 노이즈 없이 충전만** 보고 싶다는 요청 |
| 관련 | [requirements-vehicle-list-vd3-align.md](./requirements-vehicle-list-vd3-align.md) (VL), [requirements-vehicle-list-vd3-align-polish.md](./requirements-vehicle-list-vd3-align-polish.md) (VL-P), [requirements-vehicle-detail-vd3.md](./requirements-vehicle-detail-vd3.md) |
| 적용 | `/vehicles` — `FleetVehicleTable` · (URL) 대시보드 딥링크 `?filter=` 호환. `/fleet/vehicles` 데모는 비범위 |
| 상태 | **코드 ✅ (VL-F-1~3) · 딥링크 스모크 VL-F-4 ☐** |
| 작성일 | 2026-07-17 |
| ID | **VL-F** |

---

## 1. As-Is 분석

### 1.1 테이블 열

| 열 | 현재 |
|----|------|
| 차량 | plate · model·색 |
| 가동 | `OPS_MODE_LABEL` (+ WARNING/ALERT · lifecycle) |
| 배터리 | 바 + 잔여 km |
| **주행거리** | odometer (`formatOdometer`) |
| 갱신 | 상대시간 |

- 잔여 km는 배터리 아래, odometer는 「주행거리」→ **총량 vs 잔여** 혼동 가능.
- **충전 전용 열 없음** (VL-2에서 상태/충전 통합). 충전 중이면 가동=`충전 중`.

### 1.2 필터 (10개)

`전체 · 온라인·대기 · 충전 중 · 주의 · 이상 · 이상상태 · 연결 끊김 · 주차 (절전) · 실시간 연동 꺼짐 · 미운행`

| 중복·문제 | |
|-----------|--|
| 이상 vs 이상상태 | ALERT vs OFFLINE∪ASLEEP∪WARNING∪ALERT — 겹침 |
| 온라인·대기 vs 주차(절전) | 둘 다 「안 달림」 |
| 미운행 | 7일 idle — 일상 관제보다 장기 지표 |
| 개수 | 모바일에서 pill 과다 |

대시보드 딥링크: `?filter=charging|abnormal|idle|telemetry_disconnected` — **제거 시 매핑 필요**.

### 1.3 요청 해석

| # | 요청 | 해석 |
|---|------|------|
| 1 | 주행거리 → **총 주행거리** | 열 헤더(및 필요 시 aria)만 |
| 2 | 충전 필드 · **미연결 비표시** · 충전일 때만 | `chargingStatus === CHARGING`일 때만 값 |
| 3 | 필터 축소 | 사용자안: 전체·운행중·주차(절전+대기)·주의·이상(+연동꺼짐) |

---

## 2. 제안 분석

### 2.1 총 주행거리 — **GO**

| | |
|--|--|
| 이유 | 배터리 「잔여 N km」와 구분 · 상세 「누적」과 같은 개념 |
| 범위 | 컬럼 라벨만 (`주행거리` → `총 주행거리`). 값 포맷 유지 |

### 2.2 충전 필드 — **GO (조건부 설계)**

**겹침 주의:** 가동 모드가 이미 `충전 중`을 표시함.

| 옵션 | 내용 | 평가 |
|------|------|------|
| **A. 열 「충전」** | CHARGING일 때만 `충전중`(또는 VD3 톤 `충전 중`), 아니면 빈칸/`—` | 요청과 일치 · 스캔 열로 「누가 꽂혀 있나」 |
| B. 가동 아래 보조만 | 열 추가 없이 Badge | 밀도↓ · 요청「필드」와 약함 |
| C. AC/DC·kW | 충전 중일 때만 상세 | 가치↑ · 범위 확대 |

**권고: A (MVP)**  
- 열 위치: **가동 다음** (또는 배터리 앞).  
- 표시: `CHARGING` → `충전 중` · `DISCONNECTED`/`COMPLETE`/`STOPPED` → **공란**(미연결·기타 숨김).  
- 가동의 `충전 중`과 문구가 겹쳐도, **열 스캔** 가치로 허용. 이후 P1로 AC/DC 보강 가능.

**비표시:** `DISCONNECTED`(미연결) — 요청대로. COMPLETE/STOPPED도 MVP에서는 숨김(「충전일 때만」).

### 2.3 필터 — 사용자안 + 의견

#### 사용자안

```text
전체 · 운행중 · 주차(절전+대기) · 주의 · 이상(+실시간 연동 꺼짐)
```

방향 **동의**. 다만 **「충전 중」이 빠지면** 관제 핵심 질문이 빠짐.

#### 권고 To-Be (6개)

| value | 라벨 | 포함 조건 |
|-------|------|-----------|
| `ALL` | 전체 | — |
| `DRIVING` | 운행 중 | `resolveVehicleOpsMode` === `DRIVING` |
| `CHARGING` | 충전 중 | `chargingStatus === CHARGING` (또는 ops === CHARGING) |
| `PARKED` | 주차 | ops ∈ {`STANDBY`, `ASLEEP`} — **대기+절전** |
| `WARNING` | 주의 | `status === WARNING` |
| `ISSUE` | 이상 | `status ∈ {ALERT, OFFLINE}` **또는** lifecycle `TELEMETRY_DISCONNECTED` |

| 제거 | 이유 |
|------|------|
| 온라인·대기 | → `PARKED` |
| 주차(절전) 단독 | → `PARKED`에 흡수 |
| 이상상태 | → `ISSUE` / `WARNING`로 분해 |
| 연결 끊김 · 실시간 연동 꺼짐 | → `ISSUE` |
| 미운행 | 일상 필터에서 제외 · 대시보드 idle 링크는 `PARKED`로 폴백 또는 idle 유지(숨은 값) |

**「주차」라벨:** UI는 **「주차」** 한 단어 권고(절전·대기 구분는 행의 가동 뱃지가 담당). 툴팁/도움말에 「대기·절전 포함」.

**운행 vs 충전:** 충전 중 주차는 `CHARGING` 필터에만 넣고 `DRIVING`에는 넣지 않음(기어 P+충전).

### 2.4 URL 호환 (빈칸 필수)

| 기존 `?filter=` | To-Be 매핑 |
|-----------------|------------|
| `charging` | `CHARGING` |
| `abnormal` | `ISSUE` (또는 WARNING∪ISSUE — 권고 **ISSUE**만, WARNING은 별도) |
| `telemetry_disconnected` | `ISSUE` |
| `idle` | **유지(숨은 필터)** 또는 `PARKED`로 완화 — 권고: 로직은 `isIdle` 유지, **pill UI에서는 숨김** · 딥링크만 동작 |

`FleetAttentionPanel` / `FleetChargingPanel` / `FleetMetrics` 링크 **회귀 없음**.

### 2.5 비범위

- `/fleet/vehicles` 데모 테이블  
- 미운행 전용 관리 UI 신설  
- COMPLETE/STOPPED 충전 열 표시 (후속)  
- 필터를 서버 조회로 이전  

---

## 3. To-Be 설계

### 3.1 열

```text
차량 | 가동 | 충전 | 배터리 | 총 주행거리 | 갱신
```

| 충전 셀 | |
|---------|--|
| CHARGING | Badge `충전 중` (info) |
| 그 외 | 빈칸 또는 `—` (미연결 문구 **금지**) |

### 3.2 필터 pill (UI)

```text
전체 | 운행 중 | 충전 중 | 주차 | 주의 | 이상
```

### 3.3 수용 기준

1. 열 헤더가 **총 주행거리**.
2. 충전 열: CHARGING만 라벨 표시 · DISCONNECTED일 때 「미연결」**없음**.
3. 상단 pill이 **6개 이하**(권고 6) · 구 10개 제거.
4. `주차` = STANDBY∪ASLEEP · `운행 중` = DRIVING · `충전 중` = CHARGING.
5. `이상`에 OFFLINE·ALERT·TELEMETRY_DISCONNECTED 포함.
6. `?filter=charging|abnormal|idle|telemetry_disconnected` 딥링크 **깨지지 않음**.
7. 가동·상대 신선도·VL-P 차량 셀 **회귀 없음**.

---

## 4. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **VL-F-1** | 본 문서 승인 (GO) | ✅ |
| **VL-F-2** | 열: 총 주행거리 · 충전(조건부) | ✅ |
| **VL-F-3** | 필터 6종 · URL 매핑 | ✅ |
| **VL-F-4** | 대시보드 딥링크 스모크 | ☐ |

구현: `src/components/fms/FleetVehicleTable.tsx`  
체크리스트: [checklist-vehicle-detail-vd3.md](./checklist-vehicle-detail-vd3.md) · [development-checklist.md](./development-checklist.md)

---

## 5. 의견 · 진행 여부

### 판단: **GO**

| 근거 | |
|------|--|
| 제품 | 필터 과다·라벨 혼동은 VL 직후 체감 갭 · 총 주행거리/충전 조건부는 작은 비용 |
| 기술 | `FleetVehicleTable` UI·필터 함수 · 스키마 불필요 |
| 리스크 | 낮음 — URL 매핑만 챙기면 대시보드 회귀 방지 |

### 사용자안 대비 내 추가

1. **「충전 중」필터 유지** — 운행/주차와 다른 축의 핵심 관제 질문.  
2. **주차 = 대기+절전** — 동의 · 라벨은 「주차」로 단순화.  
3. **이상 = ALERT+OFFLINE+연동꺼짐** — 동의 · 「이상상태」합성 pill 폐기.  
4. **미운행** — 일상 pill에서 제거 · `?filter=idle`만 유지.

### 비GO

- 충전 열에 미연결 「미연결」 재노출  
- 필터를 다시 8개 이상으로 늘리기  

**구현:** VL-F-2·F-3 반영 완료 · VL-F-4 스모크 남음.  
**후속:** 충전 **열** 중복 재평가 → [VL-A](./requirements-vehicle-list-align-charge.md)에서 **제거 완료**(필터·총 주행거리는 유지).

---

## 6. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-17 | 초안 — 총 주행거리 · 조건부 충전 열 · 필터 6종(충전 유지) · GO |
| 2026-07-17 | VL-F-1~3 코드 ✅ — `FleetVehicleTable` 열·필터·URL 매핑 |
| 2026-07-18 | 충전 열 부분 철회 — [VL-A](./requirements-vehicle-list-align-charge.md) 코드 ✅ |
