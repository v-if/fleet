# 차량 목록 — VD3 정렬 폴리시 (VL-P)

| 항목 | 내용 |
|------|------|
| 목적 | VL-2·3·4 이후에도 남은 **목록 전용 UI**를 상세(VD3 Hero)와 맞춰, 시각·문구 잔차를 제거한다 |
| 배경 | 가동 모드·상대 신선도는 맞췄으나, 아바타·부제·뱃지·툴바 메타가 상세에 없는 형태로 남아 「같은 차량인데 목록만 다름」 |
| 관련 | [requirements-vehicle-list-vd3-align.md](./requirements-vehicle-list-vd3-align.md) (VL), [requirements-vehicle-detail-vd3.md](./requirements-vehicle-detail-vd3.md) |
| 적용 | `/vehicles` — `FleetVehicleTable` · `FleetVehiclesListView` · (필요 시) `FleetToolbar` props만. 상세 Hero 변경은 **비범위**(단, 참고 SoT) |
| 상태 | **코드 ✅ (VL-P-2·3·4·5) · 검수 VL-P-6 ☐** |
| 작성일 | 2026-07-16 |
| ID | **VL-P** |

---

## 1. As-Is 분석 (요청 6건)

### 1.1 대조표

| # | 목록 As-Is | 상세(VD3) SoT | 요청 |
|---|------------|---------------|------|
| **1** | 행 앞 **이니셜 아바타** (`plateNumber[0]` → 「영」) | Hero에 아바타 **없음** | **삭제** |
| **2** | 부제 `model · year` (예: Model Y · RWD · **2025**) | Hero: `model` + ` · ` + **색** (예: Model Y · RWD · **StealthGrey**) | **상세 구조로 맞춤** |
| **3** | RWD·StealthGrey **light 뱃지** | Hero에 trim/색 **뱃지 없음** (부제 텍스트만) | **뱃지 삭제** |
| **4** | ASLEEP+READY 시 「관제준비·절전」소문 | Hero/가동 뱃지에 **없음** | **삭제** |
| **5** | 툴바 description 상대시간 + `갱신:` 절대시각 **이중** | 상세 툴바는 plate 제목·model·year description · **목록식 이중 시간 없음** · 행별 상대시간은 목록만 | **중복 제거** |
| **6** | `Tesla Fleet API` provider **뱃지** | 상세 툴바에 provider **미전달** | **삭제**(목록) |

### 1.2 코드 앵커

| 이슈 | 위치 |
|------|------|
| 1·2·3 | `FleetVehicleTable` 차량 셀 — avatar · `{model} · {year}` · trim/color Badge |
| 4 | 동일 파일 — `mode === "ASLEEP" && lifecycle === "READY"` 문구 |
| 5·6 | `FleetVehiclesListView` — `description` 상대시간 · `provider` · `lastUpdatedAt` |

### 1.3 상세 SoT 정밀화 (빈칸)

Hero 부제 (목록이 맞출 대상):

```tsx
{vehicle.model}
{formatColorBadge(vehicle) ? ` · ${formatColorBadge(vehicle)}` : ""}
```

- `model`은 이미 `buildDisplayModel` 등으로 **「Model Y · RWD」** 형태일 수 있음.
- 색은 `formatColorBadge` → `exteriorColor` (예: StealthGrey).
- **연식(year)은 Hero 부제에 없음** → Specs 모달·툴바 description에만 존재.

> 참고: 상세 **툴바** 식별(plate · model·year)은 **VL-P-5**에서 제거 — Hero만 SoT.

---

## 2. 제안 분석

### 2.1 채택 (전부 GO)

| # | 판단 | 이유 |
|---|------|------|
| 1 | **삭제 GO** | 스캔에 이득 적고 한글 표시명 첫 글자는 식별 가치 낮음 · 상세와 불일치 |
| 2 | **부제 = model · color GO** | Hero와 동일 헬퍼·동일 정보 계층 |
| 3 | **뱃지 삭제 GO** | #2로 색이 부제에 들어가면 trim/색 뱃지는 중복 · RWD는 보통 model에 포함 |
| 4 | **삭제 GO** | lifecycle 뱃지(READY 숨김)로 충분 · 「관제준비·절전」은 목록 only noise |
| 5 | **중복 제거 GO** | 행 「갱신」열이 SoT · 툴바 이중 시간은 혼란 |
| 6 | **provider 뱃지 제거 GO** | 목록 페이지 정체성에 필수 아님 · 상세와 불일치 |

### 2.2 #5 빈칸 — 무엇을 남길까

| 옵션 | 내용 | 평가 |
|------|------|------|
| **A. 툴바 시간·provider 모두 제거** | 제목「차량 목록」+ 액션·새로고침만 | **권고** — 행별 상대시간이 충분 |
| B. 상대시간만 하나 | description만 · absolute `갱신:` 제거 | 수용 가능 |
| C. absolute만 | description 제거 · `갱신:` 유지 | 행과 또 중복 · 비권고 |

**권고: A** — `provider` / `lastUpdatedAt` / 시간 description **미전달**.

### 2.3 #2+#3 결합 To-Be

```text
영업1팀
Model Y · RWD · StealthGrey
```

- 아바타 없음  
- trim/색 Badge 없음  
- 색 없으면 `model`만 (Hero와 동일)

검색 haystack에는 trim/color 필드 **유지**(뱃지 UI만 제거).

### 2.4 비범위

- 상세 Hero / Specs 모달 변경 (툴바 식별 제거는 VL-P-5)  
- 대시보드 `FleetRecentVehicles` (VL-5와 묶을 수 있음)  
- 가동 모드·필터·배터리 열 재설계  
- 목록 타이틀「차량 목록」제거 (유지)  

---

## 3. To-Be 설계

### 3.1 차량 셀

```text
[링크]
  plateNumber          ← 제목만 (아바타 삭제)
  model · color?       ← formatColorBadge, year 제거
  (뱃지 행 없음)
```

### 3.2 가동 셀

- OPS_MODE · (WARNING/ALERT 보조) · lifecycle 뱃지 **유지**
- 「관제준비·절전」**삭제**

### 3.3 목록 툴바

```text
차량 목록
[차량 추가…] [새로고침]
```

- `provider` · `lastUpdatedAt` · 시간 `description` **없음**

---

## 4. 수용 기준

1. 목록 행에 이니셜 아바타가 **없다**.
2. 부제가 Hero와 같이 `model`(+ ` · ` + 색)이며 **year가 부제에 없다**.
3. RWD/색 **Badge 행이 없다**.
4. ASLEEP+READY여도 「관제준비·절전」문구가 **없다**.
5. 툴바에 「목록 기준 N…」과 「갱신: 절대시각」이 **동시에 없다**(권고: 둘 다 없음).
6. 「Tesla Fleet API」뱃지가 목록 툴바에 **없다**.
7. 가동·배터리·상대 신선도·필터 URL **회귀 없음**.

---

## 5. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **VL-P-1** | 본 문서 승인 (GO) | ✅ |
| **VL-P-2** | 아바타 삭제 · 부제 model·color · trim/색 뱃지 삭제 | ✅ |
| **VL-P-3** | 「관제준비·절전」삭제 | ✅ |
| **VL-P-4** | 툴바 provider·이중 시간 제거 | ✅ |
| **VL-P-5** | 상세 툴바 식별 제거 (Hero SoT) · 「목록으로」툴바 액션 | ✅ |
| **VL-P-6** | 목록↔Hero 스모크 검수 | ☐ |

부모: [requirements-vehicle-list-vd3-align.md](./requirements-vehicle-list-vd3-align.md)

---

## 6. 의견 · 진행 여부

### 판단: **GO → 코드 반영 (VL-P-2·3·4·5 ✅)**

### 구현 메모

- 차량 셀: 아바타·trim/색 Badge 제거 · 부제 `model · color`
- 가동: 「관제준비·절전」제거
- 툴바(목록): provider · lastUpdatedAt · 시간 description 미전달
- 툴바(상세 VL-P-5): title/description 제거 · `FleetToolbar` title optional · 「목록으로」+새로고침만 · 식별은 Hero

---

## 7. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-16 | 초안 — 아바타·부제·뱃지·관제준비·툴바 이중시간·provider · GO |
| 2026-07-16 | VL-P-2·3·4 코드 ✅ — Hero 정렬 폴리시 |
| 2026-07-16 | VL-P-5 코드 ✅ — 상세 툴바 식별 제거 · Hero SoT |
