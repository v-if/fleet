# 차량 목록 — VD3 언어·표시 통일 (VL)

| 항목 | 내용 |
|------|------|
| 목적 | 차량상세(VD3)에서 정립한 **데이터 표시 방법·디자인·톤·문구**를 **차량 목록**(`/vehicles`)에 맞춰, 목록↔상세 **관제 언어·시각 일관성**을 만든다 |
| 배경 | 상세만 Telemetry 시대 IA로 고도화했고, 목록은 이전 상태/충전 이원 뱃지·절대시각 갱신 등 **구 사전**이 남아 「같은 플릿인데 화면마다 말이 다르다」 |
| 관련 | [requirements-vehicle-detail-vd3.md](./requirements-vehicle-detail-vd3.md), [requirements-vehicle-detail-ops-copy.md](./requirements-vehicle-detail-ops-copy.md) (VD-OPS), [requirements-vehicle-detail-vd3-responsive-toolbar.md](./requirements-vehicle-detail-vd3-responsive-toolbar.md) (VD3-R), [requirements-vehicle-asleep-status.md](./requirements-vehicle-asleep-status.md) (AS), [requirements-front-design.md](./requirements-front-design.md) (구 VLS) |
| 적용 | **관리자** `/vehicles` — `FleetVehiclesListView` · `FleetVehicleTable`. (선택) 대시보드 `FleetRecentVehicles`. `/fleet/vehicles` 데모·`/v2` 상세는 **비범위** |
| 상태 | **코드 ✅ (VL-2·3·4) · VL-5 선택 ☐ · 실차 VL-6 ☐** |
| 작성일 | 2026-07-16 |
| ID | **VL** |

> **ID 주의:** `VD3-NL` = Nearby Labels. 본 Phase는 **VL** (Vehicle List). `VD3-L` 단독 표기는 혼동 금지.

---

## 1. As-Is 분석

### 1.1 목록 (`/vehicles`) — VL-2·3·4 이후

| 영역 | 현재 |
|------|------|
| 셸 | `FleetVehiclesListView` + `FleetToolbar layout="inline"` |
| 필터 | pill 라벨 VD3 톤 (온라인·대기 · 충전 중 · 주차 (절전) · 연결 끊김 …) · value 축 유지 |
| 테이블 | 차량 · **가동** · 배터리(+잔여 km) · 주행거리 · **갱신(상대)** |
| 상태 언어 | `OPS_MODE_LABEL` · WARNING/ALERT 시 보조 `STATUS_LABEL` · lifecycle 뱃지 |
| 신선도 | `freshness.lastTelemetryAt ?? lastUpdatedAt` · title 절대시각 |

### 1.2 상세 (VD3)

| 패턴 | 내용 |
|------|------|
| 가동 모드 | `resolveVehicleOpsMode` → `OPS_MODE_LABEL` (주행/충전/주차·대기/절전/연결끊김) |
| 신선도 | `formatRelativeTime` + title 절대시각 |
| 툴바 | `FleetToolbar layout="inline"` (모바일 제목·새로고침 한 행) |
| Lifecycle | 뱃지 + `lifecycleGuidance` · 재연동 CTA |
| 배터리 | 바 + 잔여 km 보조 |
| Tone | VD-OPS 「조용한 정상 · 문제만 말함」 |

### 1.3 갭 (요청 해석)

| 요청 | 해석 |
|------|------|
| 데이터 표시방법 | 상태/충전 이원 → **가동 모드** 중심 · 상대 신선도 · (선택) 잔여 km |
| 디자인 | rounded-2xl·Badge·BatteryProgressBar는 공유 중 · **툴바 inline·뱃지 색/축** 정합 |
| 톤·문구 | 필터「정상」↔ 뱃지「온라인」↔ 상세「주차 · 대기」**사전 충돌** 해소 |

상세의 지도·nearby·관제 요약 풀·표시명 연필·제원 `i`는 **목록에 이식하지 않음** (스캔 밀도·VD3-NB 철학).

---

## 2. 제안 분석

### 2.1 채택 (P0)

| 점 | 이유 |
|----|------|
| **가동 모드 열** | 상세 Hero와 동일 SoT — 목록에서 5초 판단의 핵심 |
| **상대 신선도** | Telemetry 시대에 절대시각만 있으면 「지금 살아 있나」판독 어려움 |
| **문구 사전 정렬** | 필터·뱃지·상세 라벨 매핑표를 문서화·코드 공유 |
| **툴바 inline** | VD3-R과 동일 모바일 패턴 |

### 2.2 채택 (P1 · 밀도 허용 시)

| 점 | 이유 |
|----|------|
| 배터리 옆 **잔여 km** | 상세와 동일 보조 시그널 |
| Lifecycle **한 줄 힌트** 또는 단절 강조 | 상세 guidance의 축소판 |
| 대시보드 최근차량 동기 | 목록과 같은 모드·신선도 언어 |

### 2.3 비범위 (명시)

- 목록에 지도 / nearby 리스트 / SC·DC / 목적지·ETA
- 행 인라인 표시명 편집 · Specs 모달
- `/fleet/vehicles` 데모 테이블 전면 개편
- 필터 축을 opsMode로 **전면 교체**하는 빅뱅 (P0는 **표시** 우선 · 필터는 매핑 유지 또는 점진)

### 2.4 리스크·보완

| 리스크 | 보완 |
|--------|------|
| OPS가 충전·절전을 흡수 → 「충전」열 중복 | **권고:** 「상태+충전」→ **「가동」** 단일 열. 충전 중이면 모드=충전으로 충분 |
| 필터「정상」≠ ONLINE 체감 | 필터 라벨을 「온라인」또는 「대기·온라인」으로 정리 · 매핑표 §3.3 |
| 행 높이 (모바일) | 모드+lifecycle+시간만 P0 · trim/색은 현행 유지 |
| `FleetRecentVehicles` 회귀 | VL-5에서 동일 뱃지 헬퍼 사용 |

---

## 3. To-Be 설계

### 3.1 원칙

1. **같은 사실은 같은 말** — opsMode / freshness / lifecycle 라벨은 `vehicle-detail-v3` · `vehicle-lifecycle` 헬퍼 재사용.
2. **목록 = 스캔** — 상세 = 판단·조치. 목록에 상세 카드를 복제하지 않는다.
3. **정상은 조용히** — 단절·이상·저배터리만 강조 (VD-OPS).

### 3.2 테이블 To-Be (권고)

| 열 | To-Be |
|----|--------|
| 차량 | 현행 (plate · model·year · trim/색) |
| **가동** | `OPS_MODE_LABEL` + `opsModeBadgeColor` · (선택) lifecycle 뱃지 병기 |
| ~~상태~~ ~~충전~~ | **통합 제거** (또는 1릴리스 동안 가동만 추가 후 충전열 deprecate) |
| 배터리 | `BatteryProgressBar` + **rangeKm** 보조 텍스트 |
| 주행거리 | 현행 odometer |
| 갱신 | `formatRelativeTime(freshness.lastTelemetryAt ?? lastUpdatedAt)` · title에 절대시각 |

### 3.3 필터·라벨 매핑 (빈칸 보완)

| 필터 value | 현 라벨 | To-Be 라벨 (권고) | 판정 로직 |
|------------|---------|-------------------|-----------|
| ONLINE | 정상 | **온라인·대기** 또는 「온라인」 | status ONLINE & not charging & not asleep — 문서에 명시 |
| CHARGING | 충전중 | 충전 중 | chargingStatus CHARGING (현행) |
| ASLEEP | 주차(절전) | 주차 (절전) | VD3와 동일 띄어쓰기 |
| OFFLINE | 오프라인 | 연결 끊김 | OPS_MODE OFFLINE 문구와 정합 검토 |
| TELEMETRY_DISCONNECTED | 실시간 연동 꺼짐 | 유지 (VD-OPS 톤) | 현행 |

**원칙:** 필터는 **질의 축**, 행 뱃지는 **가동 모드**. 둘을 억지로 1:1로 만들지 않되, 사용자에게 설명 가능한 매핑표를 UI 근처 또는 본 문서에 둔다.

### 3.4 툴바

- `layout="inline"` (VD3-R)
- 제목「차량 목록」유지
- provider 뱃지·일괄 갱신 시각은 **상대시간** 우선 검토 (또는 「목록 기준 · 행별 갱신 참고」짧은 힌트)

### 3.5 공유 모듈

```text
vehicle-detail-v3.ts  → resolveVehicleOpsMode, OPS_MODE_LABEL, opsModeBadgeColor
vehicle-status.ts     → formatRelativeTime
vehicle-lifecycle.ts  → 현행 뱃지 (+ 선택 guidance 한 줄)
```

목록 전용 복제 라벨 금지.

---

## 4. 수용 기준

1. 목록 행의 **가동 모드** 문구·색이 동일 차량 상세 Hero와 **일치**한다 (동일 Snapshot 기준).
2. 갱신 열이 **상대 시간**으로 보이고, hover/title로 절대시각 확인 가능.
3. 「상태」「충전」이중 열이 제거되었거나, 문서에 명시한 과도기 규칙대로만 존재.
4. 필터 동작(URL `?filter=`) **회귀 없음**.
5. `/vehicles/[id]` 링크·가상추가·Tesla 연결 **회귀 없음**.
6. (P1) 배터리에 잔여 km가 있으면 상세와 같은 단위·반올림.
7. (선택 VL-5) 대시보드 최근차량이 같은 모드 언어를 쓴다.
8. 플릿 `/map`·nearby 목록 비표시 유지.

---

## 5. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **VL-1** | 본 문서 승인 (GO) | ✅ |
| **VL-2** | 행: OPS_MODE 뱃지 · 상태/충전 열 통합 | ✅ |
| **VL-3** | 행: 상대 신선도 · rangeKm | ✅ |
| **VL-4** | 툴바 inline · 필터/카피 사전 정렬 | ✅ |
| **VL-5** | (선택) `FleetRecentVehicles` 동기 | ☐ |
| **VL-6** | 실차/시드: 목록↔상세 모드·시간 일치 검수 | ☐ |
| **VL-P** | 목록 폴리시 · 상세 툴바 식별 제거 — [align-polish](./requirements-vehicle-list-vd3-align-polish.md) | ✅ 코드 · ☐ 검수 |

체크리스트: [checklist-vehicle-detail-vd3.md](./checklist-vehicle-detail-vd3.md) · [development-checklist.md](./development-checklist.md)

---

## 6. 의견 · 진행 여부

### 판단: **GO → 코드 반영 (VL-2·3·4 ✅)**

### 구현 메모

- `FleetVehicleTable`: 가동=`OPS_MODE` · WARNING/ALERT 보조 뱃지 · 상대 신선도 · 잔여 km
- `FleetVehiclesListView`: `layout="inline"` · description에 목록 기준 상대시간
- 필터 value/URL `?filter=` 회귀 없음 · 라벨만 VD3 톤

---

## 7. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-16 | 초안 — 목록↔VD3 통일 · OPS_MODE·상대신선도·비범위 · GO(단계적) |
| 2026-07-16 | VL-2·3·4 코드 ✅ — 가동 열 · 상대 신선도 · inline 툴바 · 필터 카피 |
| 2026-07-16 | VL-P 링크 — 목록 폴리시(아바타·부제·툴바) |
| 2026-07-16 | VL-P-2·3·4 코드 ✅ |
| 2026-07-16 | VL-P-5 — 상세 툴바 식별 제거 |
