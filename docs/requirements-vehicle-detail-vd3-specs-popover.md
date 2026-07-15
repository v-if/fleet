# VD3 제원 — Hero `i` 팝업 · 필드 확장 (VD3-S)

| 항목 | 내용 |
|------|------|
| 목적 | `/vehicles/[id]/v3`에서 **제원 카드를 스크롤에서 제거하고**, Hero 모델 라인 옆 **`i` 아이콘 → 닫을 수 있는 제원 패널**로 옮긴다. 패널에 **연식·휠·루프·충전 포트·Autopilot HW** 등을 표시한다 |
| 배경 | 제원은 조회 빈도가 낮아 카드로 상시 자리를 차지할 필요가 없음. 관제(SoC·모드·지도) 밀도를 우선하고 제원은 필요 시만 |
| 관련 | [requirements-vehicle-detail-vd3.md](./requirements-vehicle-detail-vd3.md), [requirements-tesla-telemetry-rest-baseline-specs.md](./requirements-tesla-telemetry-rest-baseline-specs.md) (Tier A/B), [requirements-vehicle-detail-ops-copy.md](./requirements-vehicle-detail-ops-copy.md) |
| 적용 | **To-Be만** (`FleetVehicleDetailViewV3`). As-Is `/vehicles/[id]`는 변경하지 않음 (병렬 비교 유지) |
| 상태 | **코드 ✅ (VD3-S-2·S-3) · 실차 VD3-S-4 ☐** |
| 작성일 | 2026-07-16 |
| ID | **VD3-S** |

---

## 1. 제안 분석

### 1.1 채택

| 점 | 이유 |
|----|------|
| 제원 ≠ 관제 1차 | VD3 원칙「질문이 레이아웃」·정상은 조용히와 일치 |
| `i` + 일시 표시 | 공간 절약 · 실수 클릭 비용 낮음 |
| Tier B 필드(휠·루프·포트·AP HW) | TRF-B1에 이미 Vehicle 컬럼·DTO 존재 — **추가 REST 불필요** |

### 1.2 빈칸 보완

| 공백 | 보완 |
|------|------|
| 표시 컴포넌트 | **Toast만**은 필드 5개+VIN에 좁음. **Modal / 바텀시트형 패널** 권고 (기존 `Modal` 재사용). 토스트는 짧은 알림용으로 부적합 |
| `i` 위치 | plate 아래 **모델 라인** 우측: `Model Y · RWD · StealthGrey` `[i]` (요청과 동일). 번호줄은 그대로 |
| 열기/닫기 | `i` 또는 「제원」클릭 → 열림 · **닫기 버튼** · 오버레이 클릭 · `Esc`(가능 시) → 닫힘 |
| 빈 값 | null → `—` 또는 행 숨김(권고: **행은 두고 `—`**) · 전부 없으면 「제원 없음 · 제원 다시 불러오기」안내 |
| VIN | 패널에 유지 + 복사(As-Is와 동일 UX면 가점) |
| SW / 제원 동기화 | 패널에 포함(준정적). OTA **진행률**은 패널 밖(기존 OTA 섹션) 유지 |
| 「제원 다시 불러오기」 | **운영 섹션에만** 유지. 패널 안에 소형 링크 허용(선택) — 관제 CTA와 혼동 방지 |
| 접힘 카드 제거 | 하단 `<제원>` accordion **삭제** (역할이 `i` 패널로 이전) |
| a11y | `aria-label="제원 보기"` · 포커스 트랩(모달) · 아이콘만 쓰지 말고 sr-only 텍스트 |
| 모바일 | 모달이 뷰포트 대부분을 차지해도 OK · 스크롤 가능 |

---

## 2. To-Be UI

### 2.1 Hero (첫 카드) — 모델 라인

```text
{plateNumber}

Model Y · RWD · StealthGrey   (i)
         └─ format: model (+ trim if not in model) · exteriorColor
            i → SpecsModal
```

- `vehicle.model`이 이미 `Model Y · RWD`면 중복 trim 생략.
- 색은 `formatColorBadge` / `exteriorColor`.

### 2.2 Specs 패널 필드 (순서)

| # | 라벨 | 소스 (Vehicle) | Tier |
|---|------|----------------|------|
| 1 | 모델 | `model` | 표시 |
| 2 | 연식 | `year` | A |
| 3 | 색상 | `exteriorColor` | A |
| 4 | 휠 | `wheelType` | B |
| 5 | 루프 | `roofColor` | B |
| 6 | 충전 포트 | `chargePortType` | B |
| 7 | Autopilot HW | `driverAssist` | B |
| 8 | VIN | `oemVehicleId` | — |
| 9 | 소프트웨어 | `firmwareVersion` ?? Snapshot `softwareVersion` | A |
| 10 | 제원 동기화 | `specsSyncedAt` (상대시각) | — |

선택(공간 여유 시): `exteriorTrim` · `carType` 라벨.

**데이터:** 기존 detail API / `useVehicleDetail` — **스키마·migrate 없음**.

### 2.3 레이아웃 변화

| As-Is (현재 V3) | To-Be |
|-----------------|-------|
| 하단 접힘 「제원」카드 | **제거** |
| Hero에 모델·색만 | 모델 라인 + **`i`** |
| — | Modal로 §2.2 표 |

운영·재연동·제원 REST 버튼은 기존 운영 섹션 유지.

---

## 3. 비범위

- As-Is `/vehicles/[id]` 제원 UI 변경  
- 새 Fleet REST / Baseline 필드 추가 (이미 있으면 표시만)  
- 원격 제어·제원을 Hero 주 정보로 승격  
- 목록(`/vehicles`)에 동일 `i`  

---

## 4. 수용 기준

1. V3 Hero 모델 라인에 `i` 노출 · 클릭 시 패널.  
2. 패널에 연식·휠·루프·충전 포트·AP HW(값 있으면) 표시.  
3. 닫기/오버레이로 패널 사라짐 · 하단 제원 카드 없음.  
4. 제원 null이어도 페이지·모달 깨지지 않음.  
5. As-Is URL 동작 불변.

---

## 5. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **VD3-S-1** | 본 문서 승인 (GO) | ✅ |
| **VD3-S-2** | SpecsModal + Hero `i` · 필드 §2.2 | ✅ |
| **VD3-S-3** | 하단 제원 accordion 제거 · a11y | ✅ |
| **VD3-S-4** | 실차/빈제원 VIN 검수 | ☐ |

---

## 6. 의견 · 진행 여부

### 판단: **GO**

- 제품 이유가 명확하고, **데이터·API 리스크가 거의 없음** (Tier B 컬럼 이미 있음).  
- 카드 제거 → Hero 요약 공간에 유리 — VD3 목표와 정합.  
- Toast보다 **Modal**이 제원 밀도에 맞음 — 구현도 기존 컴포넌트로 단순.

### 주의

- `driverAssist` 원문이 기계값이면 그대로 두거나 짧은 라벨 맵(있으면) — 없으면 원문/`—`.  
- Baseline 미실행 차량은 패널이 비어 보일 수 있음 → 한 줄 안내 + 운영의 「제원 다시 불러오기」로 유도.

**추천:** VD3-S-1 승인 후 바로 S-2~3 구현 (As-Is 비교 가능).

---

## 7. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-16 | 초안 — Hero `i` 제원 모달 · Tier B 필드 · GO |
| 2026-07-16 | 코드 — `FleetVehicleDetailViewV3` Hero `i` + Specs Modal · 하단 제원 카드 제거 (S-2·S-3 ✅) |
|
