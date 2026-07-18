# 차량 목록 — 충전 열 제거 · 컬럼 중앙 정렬 (VL-A)

| 항목 | 내용 |
|------|------|
| 목적 | `/vehicles` 목록에서 **「충전 중」중복 표시**를 없애고, 테이블 컬럼을 **중앙 정렬**해 스캔·가독성을 개선한다 |
| 배경 | 목록 검수 중 (1) 가동·충전 열에 「충전 중」이 **이중 표시** (2) 전 열이 **좌측 정렬**이라 숫자·뱃지 열이 들쭉날쭉해 보임 |
| 관련 | [requirements-vehicle-list-filter-fields.md](./requirements-vehicle-list-filter-fields.md) (VL-F — 조건부 충전 열 도입), [requirements-vehicle-list-vd3-align.md](./requirements-vehicle-list-vd3-align.md) (VL), [requirements-vehicle-list-vd3-align-polish.md](./requirements-vehicle-list-vd3-align-polish.md) (VL-P) |
| 적용 | `/vehicles` — `FleetVehicleTable` (헤더·본문 셀). `/fleet/vehicles` 데모·대시보드 「최근 차량」은 **비범위(1차)** · 동일 패턴이면 후속 |
| 비범위(1차) | 필터 pill 변경 · 가동 모드 우선순위 변경 · AC/DC·kW 표시 · 대시보드 테이블 |
| 상태 | **코드 완료** · 스모크 VL-A-3 ☐ |
| 작성일 | 2026-07-18 |
| ID | **VL-A** |

---

## 1. 요청 해석

| # | 요청 | 해석 |
|---|------|------|
| 1 | **충전 컬럼 제거** | VL-F에서 넣은 「충전」열을 제거. 충전 여부는 **가동** 열의 `OPS_MODE_LABEL.CHARGING`(=「충전 중」)으로만 표시 |
| 2 | 전 컬럼 **align center** | 헤더·본문 모두 중앙. 대상: 차량 · 가동 · 배터리 · 총 주행거리 · 갱신 (충전 열 제거 후 5열) |

배경 재현:

```text
충전 중 차량 행
  가동 열: Badge「충전 중」
  충전 열: Badge「충전 중」  ← 동일 문구 중복 ❌
정렬: text-start / items-start → 좌측 쏠림
```

---

## 2. As-Is 분석

### 2.1 현재 열 (`FleetVehicleTable`)

| 열 | 내용 | 정렬 |
|----|------|:----:|
| 차량 | plate + model·색 | 좌 |
| 가동 | `resolveVehicleOpsMode` → `OPS_MODE_LABEL` (+ WARNING/ALERT · lifecycle) | 좌 (`items-start`) |
| **충전** | `chargingStatus === CHARGING`일 때만 Badge「충전 중」 | 좌 |
| 배터리 | 프로그레스 + 잔여 km | 좌 |
| 총 주행거리 | `formatOdometer` | 좌 |
| 갱신 | 상대시간 | 좌 |

코드 SoT: `src/components/fms/FleetVehicleTable.tsx` — `tableColumns` · 헤더 `text-start`.

### 2.2 「충전 중」이중 표시 원인

| 열 | 조건 | 문구 |
|----|------|------|
| 가동 | `resolveVehicleOpsMode` → `CHARGING` (OFFLINE·ASLEEP 다음 우선순위) | `충전 중` |
| 충전 | `snapshot.chargingStatus === "CHARGING"` | `충전 중` |

온라인·충전 중이면 **두 열에 같은 Badge**. VL-F는 「열 스캔으로 누가 꽂혀 있나」가치로 중복을 **의도적 허용**했으나, 실사용에서 **노이즈**로 재평가됨.

### 2.3 VL / VL-F와의 관계

| 문서 | 당시 결정 | 본 요청과의 관계 |
|------|-----------|------------------|
| **VL** | 상태·충전을 **가동 단일 열**로 통합 권고 | 본 요청과 **동일 방향** |
| **VL-F** | 조건부 「충전」열 **재추가** (스캔용) | 본 요청이 **VL-F-2 충전 열 부분 철회** |
| **VL-F 필터** | pill「충전 중」유지 | **유지** (열 제거와 무관) |

→ VL-F의 「총 주행거리 · 필터 6종」은 유지하고, **충전 열만 되돌린다**.

### 2.4 충전 열 제거 시 가시성 갭

`resolveVehicleOpsMode` 우선순위: **OFFLINE → ASLEEP → CHARGING → DRIVING → …**

| 스냅샷 | 가동 표시 | 충전 열(현행) | 열 제거 후 |
|--------|-----------|---------------|------------|
| 온라인 + CHARGING | 충전 중 | 충전 중 | ✅ 가동만으로 충분 |
| OFFLINE + CHARGING(잔상) | 연결 끊김 | 충전 중 | ⚠️ 행에서 충전 사실 소실 |
| ASLEEP + CHARGING | 절전(등) | 충전 중 | ⚠️ 동일 |
| COMPLETE/STOPPED | (해당 ops) | 공란 | 변화 없음 |

실차에서 OFFLINE/ASLEEP와 CHARGING이 **동시에 참**인 빈도는 낮고, 관제 우선은 보통 **연결·절전**.  
필터「충전 중」은 `chargingStatus === CHARGING`이라 **열과 무관하게** 해당 차량을 걸러 볼 수 있음.

---

## 3. To-Be 설계

### 3.1 열 구성

```text
차량 | 가동 | 배터리 | 총 주행거리 | 갱신
```

- `tableColumns`에서 `{ label: "충전", … }` 및 해당 `TableCell` 제거.
- 필터 pill「충전 중」·URL `?filter=charging` **변경 없음**.

### 3.2 정렬

| 적용 | 방법 |
|------|------|
| 헤더 | `text-start` → **`text-center`** |
| 본문 셀 | **`text-center`** (숫자·상대시간) |
| 가동·차량 내부 flex | `items-start` → **`items-center`** · 필요 시 `justify-center` |
| 배터리 블록 | 내부 `space-y` 유지 · 컨테이너 중앙 (`items-center` / `mx-auto` 등) |

**차량 열:** plate + 부제 2줄이어도 중앙 정렬. truncate는 유지(폭 `w-[180px]` 등 현행 유지·미세 조정 가능).

### 3.3 카피·데이터

- 가동「충전 중」문구·Badge color **변경 없음**.
- 충전 전용 열 제거로 **새 API/DTO 불필요**.

### 3.4 검수 포인트

1. 충전 중 차량: 가동에만 「충전 중」·충전 열 **없음**.
2. 비충전: 가동은 기존 ops · 빈 충전 칸 없음.
3. 필터「충전 중」동작 유지.
4. 5열 모두 헤더·본문 **중앙**.
5. 모바일 가로 스크롤·truncate 회귀 없음.

---

## 4. 리스크 · 완화

| 리스크 | 완화 |
|--------|------|
| OFFLINE/ASLEEP + CHARGING 행에서 충전 스캔 소실 | 1차 **수용**. 필터「충전 중」으로 보완. 빈도 높으면 후속: 가동 아래 보조 한 줄 또는 ops 우선순위 재검토(본 Phase 비범위) |
| VL-F 문서와 충돌 | VL-F에 「충전 열 → VL-A에서 제거」이력·링크. 필터·총 주행거리는 VL-F 유지 |
| 대시보드 최근 차량과 열 불일치 | 1차 비범위 · 후속 정렬 시 맞춤 |
| 중앙 정렬 + 긴 plate | truncate 유지 · 폭 클래스 유지 |

---

## 5. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **VL-A-0** | 본 문서 승인 | ✅ |
| **VL-A-1** | 충전 열 제거 (`FleetVehicleTable`) | ✅ |
| **VL-A-2** | 5열 헤더·본문 center 정렬 | ✅ |
| **VL-A-3** | `/vehicles` 스모크 (충전 중·필터·정렬) | ☐ |

---

## 6. 의견 · 진행 여부

### 판단: **GO**

| 축 | 평가 |
|----|------|
| 제품 | 동일 Badge 이중 표시는 실사용 노이즈. VL 원안(가동 단일)으로 회귀가 자연스러움 |
| 기술 | UI-only · 회귀면 좁음 · 필터로 충전 조회 유지 |
| VL-F와의 정합 | 충전 **열**만 철회. 총 주행거리·필터 6종은 유지 → 부분 개정으로 충분 |
| 정렬 | 숫자·뱃지 열 중앙은 목록 가독성 개선. 차량 2줄도 center로 통일 가능 |
| 엣지 갭 | OFFLINE/ASLEEP+CHARGING은 드묾 · 1차 수용 가능 |

### GO 조건

1. 충전 **필터**는 유지한다 (열 ≠ 필터).
2. 가동 모드 우선순위(OFFLINE/ASLEEP > CHARGING)는 **이번 Phase에서 바꾸지 않는다**.
3. 대시보드·데모 목록은 1차 비범위(원하면 VL-A 후속).

### 비GO / 보류

| 항목 | 이유 |
|------|------|
| 충전 열 유지 + 가동에서 CHARGING 문구 숨김 | 요청과 반대 · 열 스캔만 남기고 가동을 비우는 건 VD3 언어와 어긋남 |
| AC/DC·kW를 충전 열에 넣어 정당화 | 범위 확대 · 본 요청은 **제거** |
| 정렬만 하고 충전 열 유지 | 중복 문제 미해결 |

### 한 줄 결론

**진행한다.** 충전 열은 VL-F 스캔용 실험이었으나 가동과 **문구가 완전 중복**되어 제거가 맞고, 전 열 중앙 정렬은 저비용·고체감 개선이다.  
남은 엣지(절전/오프라인+충전)는 필터로 보완하고, 필요 시 후속에서 가동 보조 표시만 검토하면 된다.

---

## 7. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-18 | 초안 — 충전 열 제거 · 5열 center · VL-F 부분 철회 · **GO** |
| 2026-07-18 | 구현 — `FleetVehicleTable` 충전 열 제거 · text-center · 필터 유지 · VL-A-3 스모크 남음 |
