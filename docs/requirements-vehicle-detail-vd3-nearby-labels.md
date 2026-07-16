# VD3 인근 충전소 — 목록·맵 기호 매칭 (VD3-NL)

| 항목 | 내용 |
|------|------|
| 목적 | 차량상세 **위치** 카드에서 인근 충전소 **목록이 있을 때**, 리스트 이름 앞과 지도 마커에 **동일한 기호(A, B, C…)** 를 붙여 목록↔맵을 **한눈에 대응**시킨다 |
| 배경 | VD3-NM으로 맵에 충전소 핀이 생겼으나, 마커 문구가 **SC/DC**(유형 코드)라 **어느 목록 행인지** 직관적으로 매칭되지 않는다 |
| 관련 | [requirements-vehicle-detail-vd3-nearby-map.md](./requirements-vehicle-detail-vd3-nearby-map.md) (VD3-NM), [requirements-vehicle-detail-vd3-nearby-block.md](./requirements-vehicle-detail-vd3-nearby-block.md) (VD3-NB) |
| 적용 | 기본 상세 `FleetVehicleDetailViewV3` + `VehicleMap` nearby 마커. `/map`·`/v2`는 **비범위** |
| 상태 | **코드 ✅ (NL-2·3·5) · 실차 NL-4 ☐** |
| 작성일 | 2026-07-16 |
| ID | **VD3-NL** |

---

## 1. As-Is 분석

### 1.1 UI (NL-2·3 이후)

```text
[위치]
  Map
    · 차량 마커
    · 충전소 마커 — 기호 A–E · siteType 색 · title에 이름·거리
  [인근 충전소]
    [A] [SC] 이름 · km
    [B] [DC] 이름 · km
```

| 요소 | 현재 |
|------|------|
| 목록 | `slice(0, 5)` · **A–E** + **SC/DC 보조 뱃지** + 이름 + km |
| 마커 | `label` (A–E) · siteType 색 · title에 이름·거리 |
| 대응 | **동일 index·동일 기호** · 유형은 목록 SC/DC + 맵 색 |

### 1.2 요청 해석

| 요청 | 해석 |
|------|------|
| 이름 앞 A, B, C, D | 표시 순서 기반 **알파벳 기호** |
| 마커에도 A, B, C, D | **동일 기호**를 마커 본문으로 |

요청 예시는 A–D이나, 목록 상한은 **5건**(VD3-NB/NM)이므로 **A–E**까지 정의한다 (4건이면 A–D만 사용).

### 1.3 관련 공백 (NM-4와의 관계)

VD3-NM-4(선택)는 hover/클릭·InfoWindow 연동이다.  
본 Phase는 **정적 기호만**으로 매칭을 해결하는 **가벼운 MVP**이며, NM-4를 대체하지 않는다(여유 시 병행 가능).

---

## 2. 제안 분석

### 2.1 채택

| 점 | 이유 |
|----|------|
| 기호 SoT = 목록 표시 순서 | 거리 정렬 상위 N과 동일 인덱스 → 혼동 없음 |
| 마커 본문 = 기호 | SC/DC보다 **행 대응**이 우선 과제 |
| UI만 변경 | Snapshot/API 스키마 불필요 · 회귀 범위 좁음 |

### 2.2 빈칸 보완

| 공백 | 보완 |
|------|------|
| A–D vs max 5 | **A=1번째 … E=5번째**. 표시 건수만큼만 할당 |
| 기호 문자셋 | 라틴 **A–E** (요청과 동일). 한글 가/나/다는 맵 핀 가독성·국제 관례상 비권고 |
| 좌표 없는 행 | 목록에는 기호 유지 · **마커만 없음** (희귀). 기호 건너뛰기 금지(인덱스 어긋남 방지) |
| siteType(SC/DC) | 마커 **문구는 기호**. 목록에는 A와 이름 사이 **SC/DC 보조 뱃지** (outline) · 맵은 **색**으로 유형 유지 |
| 목록 UI | `[A] [SC] 이름` · 거리 우측 · siteType null이면 SC/DC 생략 |
| 거리 뱃지(맵) | MVP: 기호 핀 위주. 거리 서브뱃지는 **유지 또는 제거 선택** — 좁은 맵에서 겹치면 기호만 남겨도 됨(권고: **기호만**, title/툴팁에 이름·거리) |
| 지도 없을 때 | 위치 신호 없음 → 목록만(기호 포함). 맵 없으면 매칭 불필요하나 목록 일관성은 유지 |
| `/map` | `nearbySites` 미전달 → 변경 없음 |

### 2.3 비범위

- 목록↔마커 hover/클릭 하이라이트 · InfoWindow (→ NM-4)
- 유형 아이콘(⚡) 재도입을 기호와 병기 (공간 부족)
- 영구 라벨을 DB에 저장
- `/v2` · 플릿 `/map`

---

## 3. To-Be 설계

### 3.1 기호 규칙

표시 배열 = `nearbySites.slice(0, 5)` (현행과 동일).

| index | 기호 |
|------:|:----:|
| 0 | A |
| 1 | B |
| 2 | C |
| 3 | D |
| 4 | E |

```ts
function nearbySiteLabel(index: number): string {
  return String.fromCharCode(65 + index); // 0→A … 4→E
}
```

동일 `index`를 리스트 행과 `mapNearbySites` / `MapNearbySite`에 전달한다.

### 3.2 UI

```text
[위치]
  Map
    · 차량 마커 (기존)
    · 충전소 마커: [A] [B] …  (색=siteType, 문구=기호)
  [인근 충전소]
    A  [SC] 이름₁          0.8 km
    B  [DC] 이름₂          1.2 km
    …
```

### 3.3 `MapNearbySite` 확장 (권고)

```ts
nearbySites?: Array<{
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  siteType?: "destination" | "supercharger" | null;
  label: string; // "A" | "B" | …
}>;
```

V3에서 `slice(0,5)` map 시 `label: nearbySiteLabel(i)` 부여.  
좌표 없는 행은 리스트만 렌더(동일 label).

### 3.4 마커 스타일

| 항목 | To-Be |
|------|--------|
| 본문 | `label` (A–E) |
| 배경색 | Supercharger `#e82127` · Destination `#0d9488` · type null 시 중립(예: zinc) |
| title | `A · {name} · {km} km` |
| 거리 서브뱃지 | **제거 권고**(기호 가독성) · 유지해도 수용 |

목록 기호 뱃지는 마커와 **같은 색**. SC/DC는 **작은 outline 보조 뱃지** (맵에는 미표시).

### 3.5 목록 SC/DC 보조 뱃지 (NL-5)

| 항목 | 규칙 |
|------|------|
| 위치 | A 뱃지와 이름 **사이** |
| 문구 | `SC` · `DC` (`nearbySiteTypeBadgeLabel`) |
| 스타일 | outline · siteType 색 · A보다 작게 |
| siteType null | 뱃지 생략 |
| 맵 | 변경 없음 (A + 색) |

---

## 4. 수용 기준

1. 인근 목록 N건(1≤N≤5)일 때 각 행 이름 앞에 **A…** 기호가 순서대로 붙는다.
2. 좌표 있는 사이트의 맵 마커 본문이 **같은 기호**이다 (SC/DC 문구 없음).
3. 목록 순서와 마커 기호가 **어긋나지 않는다** (같은 slice·같은 index).
4. 목록 없으면 기호·충전소 마커 모두 없음 (VD3-NB/NM 유지).
5. 플릿 `/map`·차량만 있는 맵 **회귀 없음**.
6. siteType 색 구분(또는 동등한 시각 단서)이 유지되거나, 의도적으로 통일한 경우 문서에 명시.
7. 목록에 siteType이 있으면 A와 이름 사이 **SC/DC 보조 뱃지**가 보인다.

---

## 5. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **VD3-NL-1** | 본 문서 승인 (GO) | ✅ |
| **VD3-NL-2** | 리스트 기호(A–E) · `label`을 맵 prop에 전달 | ✅ |
| **VD3-NL-3** | `VehicleMap` 마커 문구 SC/DC → `label` · 거리 뱃지 제거 | ✅ |
| **VD3-NL-4** | 실차/시드: 목록↔핀 기호 일치 검수 | ☐ |
| **VD3-NL-5** | 목록 A–이름 사이 SC/DC 보조 뱃지 | ✅ |

체크리스트: [checklist-vehicle-detail-vd3.md](./checklist-vehicle-detail-vd3.md)

---

## 6. 의견 · 진행 여부

### 판단: **GO → 코드 반영 (NL-2·3·5 ✅)**

| 근거 | |
|------|--|
| 제품 | A–E 매칭 + 목록에서 유형(SC/DC) 명시 |
| 기술 | `nearbySiteTypeBadgeLabel` · 목록 outline 뱃지 |
| 리스크 | 매우 낮음 · 맵 비변경 |

---

## 7. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-16 | 초안 — 목록·맵 A–E 기호 매칭 · GO |
| 2026-07-16 | NL-2·3 코드 ✅ — 리스트 뱃지 · 마커 label · title |
| 2026-07-16 | NL-5 코드 ✅ — 목록 SC/DC 보조 뱃지 |
