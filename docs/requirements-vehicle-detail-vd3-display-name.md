# VD3 표시명 — Hero 인라인 편집 (VD3-N)

| 항목 | 내용 |
|------|------|
| 목적 | `/vehicles/[id]` Hero **첫 카드**에서 차량 표시명(`TESLA-214742` 등) 옆 **연필 아이콘**으로 관리자가 **번호판·팀명·별칭**을 즉시 수정할 수 있게 한다 |
| 배경 | Tesla Fleet API에는 FMS 관리자가 직관적으로 쓰는 `00가1234` 형식 번호판이 없다. 개발 편의상 `TESLA-{VIN 끝 6자}`로 표기 중이며, 운영자가 **식별하기 쉬운 이름**으로 바꿀 수 있으면 목록·상세·지도·검색 전반의 가독성이 올라간다 |
| 관련 | [requirements-vehicle-detail-vd3.md](./requirements-vehicle-detail-vd3.md), [requirements-tesla-telemetry-rest-baseline-specs.md](./requirements-tesla-telemetry-rest-baseline-specs.md) (TRF-B1), [requirements-tesla-hybrid-data-model.md](./requirements-tesla-hybrid-data-model.md) |
| 적용 | **기본 상세** (`FleetVehicleDetailViewV3` at `/vehicles/[id]`). 이전 화면은 `/v2` |
| 상태 | **코드 ✅ (VD3-N-2·N-3) · 실차 VD3-N-4 ☐** |
| 작성일 | 2026-07-16 |
| ID | **VD3-N** |

---

## 1. As-Is 분석 (코드·데이터)

### 1.1 현재 표시명이 어디서 오는가

| 계층 | 내용 |
|------|------|
| DB | `Vehicle.plateNumber` — `@unique`, 목록·상세·지도·툴바의 **1차 식별 문자열** |
| Tesla 원본 | `Vehicle.teslaDisplayName` — Fleet `display_name` / `vehicle_name` (Tesla 앱 표시명) |
| 자동 생성 | `derivePlateNumber(vin, displayName)` — Tesla 이름이 **한국 번호판 정규식**이면 채택, 아니면 `TESLA-{VIN[-6:]}` |

```text
온보딩·제원 Baseline (writeVehicleSpecs)
  → plateNumber = derivePlateNumber(...)
  → teslaDisplayName = Tesla display_name (별도 저장)

VD3 Hero h4
  → vehicle.plateNumber 표시 (예: TESLA-214742)
```

- 한국 번호판 정규식: `^\d{2,3}[가-힣]\d{4}$` (공백 제거 후 검사).
- 대부분 Tesla 차량은 `display_name`이 번호판 형식이 아니므로 **`TESLA-214742` 패턴**이 기본이다.

### 1.2 표시명이 쓰이는 곳 (저장 후 전파 필요)

`plateNumber`는 FK가 아니라 **표시·검색 키**로 광범위하게 사용된다.

| 영역 | 예 |
|------|-----|
| V3 Hero · 툴바 | `FleetVehicleDetailViewV3`, `FleetToolbar` title |
| 목록 | `FleetVehicleTable`, `FleetRecentVehicles` |
| 지도 | `vehicle-map`, `vehicle-marker-pin` (끝 4자리 축약) |
| 위젯 | abnormal / charging / idle 위젯 |
| 검색 | 목록 `haystack`에 `plateNumber` 포함 |

→ 저장 시 **detail + list 쿼리 invalidate**로 전 화면 정합을 맞춘다. (별도 broadcast 불필요)

### 1.3 API·편집 인프라

| 항목 | 현재 |
|------|------|
| `GET /api/vehicles/[id]` | ✅ |
| `PATCH /api/vehicles/[id]` (표시명 수정) | ❌ **없음** |
| 프론트 인라인 편집 UI | ❌ |
| AuditLog | ✅ 인프라 있음 — 수동 변경 기록 권고 |

### 1.4 핵심 리스크 — 제원 REST가 이름을 덮어씀

`writeVehicleSpecs`(Baseline · 「제원 다시 불러오기」)는 **매번** `plateNumber: specs.plateNumber`를 갱신한다.

```text
관리자가 「영업1팀」으로 저장
  → 이후 「제원 다시 불러오기」
  → plateNumber가 다시 TESLA-214742 로 되돌아갈 수 있음  ⚠️
```

**본 기능을 넣으려면 반드시 “수동 표시명 보호” 규칙이 동반되어야 한다.** (§3.2)

---

## 2. 제안 분석

### 2.1 채택 (요청과 정합)

| 점 | 이유 |
|----|------|
| Hero 첫 카드 · 연필 → 인라인 edit | 관리자 1차 질문「이게 어떤 차?」에 바로 답 · VD3「식별은 Hero, 제원은 `i`」와 역할 분리 |
| ✓ 저장 · ✕ 취소 | 실수 비용 낮음 · 모달 없이 빠른 편집 |
| `00가1234` · `영업1팀` · `대표님` | 운영 언어에 맞는 별칭 — FMS 가치 명확 |
| V3만 | As-Is 병렬 비교·컷오버 전략 유지 |

### 2.2 빈칸 보완 (요청에 없던 설계)

| 공백 | 보완 |
|------|------|
| 어떤 DB 필드를 수정? | **MVP: `Vehicle.plateNumber` 직접 수정** — 이미 전 UI가 이 값을 표시. 별도 `displayLabel` 컬럼은 장기 옵션(§3.1) |
| Tesla sync와 충돌 | `plateNumberEditedAt`(또는 `plateNumberManual`) 도입 · **수동 설정 후 REST가 plateNumber 미갱신** |
| 유일성 | `plateNumber` `@unique` — 동일 이름 중복 시 **409** + 「이미 사용 중인 이름」 |
| 입력 규칙 | 번호판 전용 regex **강제하지 않음** (영업1팀·대표님 허용). trim · 길이 1~32 · 제어문자 금지 |
| 권한 | 현행 `requireApiSession` (로그인 FMS 관리자). 별도 RBAC는 후속 |
| 저장 API | `PATCH /api/vehicles/[id]` body `{ plateNumber: string }` |
| 감사 | `AuditLog` — `action: vehicle.display_name_update`, before/after metadata |
| 아이콘 | 기존 `PencilIcon` · `CheckLineIcon` · `CloseLineIcon` (`src/icons`) |
| a11y | 연필 `aria-label="표시명 수정"` · 편집 input `aria-label="차량 표시명"` · 저장/취소 버튼 라벨 |
| Tesla 표시명 | `teslaDisplayName`은 **읽기 전용 참고** — VD3-S 제원 모달에 선택 표시(후속 가능). 본 기능은 FMS 표시명만 편집 |

### 2.3 보류·비권고

| 항목 | 이유 |
|------|------|
| Tesla API로 차량명 원격 변경 | Fleet API에 FMS 표시명 개념 없음 · 범위 밖 |
| 목록에서 일괄 편집 | 1차는 상세 Hero만 — 필요 시 후속 |
| As-Is 상세 동시 적용 | VD3 병렬 정책 — 컷오버 후 통합 검토 |
| 별도 `displayLabel` 1차 도입 | UI·DTO 전면 교체 비용 큼 — 수동 lock + `plateNumber` 편집이 MVP에 적합 |

---

## 3. To-Be 설계

### 3.1 데이터 모델 (권고)

**Phase N-2 (MVP)**

| 필드 | 타입 | 설명 |
|------|------|------|
| `plateNumber` | `String @unique` | FMS 표시명 (기존) — 관리자가 편집하는 값 |
| `plateNumberEditedAt` | `DateTime?` | **최초 수동 저장 시각**. null이면 Tesla derive 규칙 적용 가능 |

`writeVehicleSpecs` 수정:

```text
if (vehicle.plateNumberEditedAt == null) {
  plateNumber ← derivePlateNumber(...)
} else {
  plateNumber 유지 (teslaDisplayName 등 다른 제원만 갱신)
}
```

**장기 옵션 (비범위):** `displayLabel` 분리 + `plateNumber`는 내부 식별자 전용 — 컷오버·다중 테넌트 시 검토.

### 3.2 API

`PATCH /api/vehicles/[id]`

| 항목 | 내용 |
|------|------|
| Auth | `requireApiSession` |
| Body | `{ "plateNumber": "영업1팀" }` |
| 검증 | trim · 1~32자 · 빈 문자열 거부 · fleet 내 unique |
| 성공 | `200` + 갱신된 `vehicle` DTO |
| 충돌 | `409` — duplicate plateNumber |
| 부수효과 | `plateNumberEditedAt = now()` · AuditLog 기록 |

### 3.3 UI — Hero 첫 카드 (표시명 줄)

**위치:** 현재 `h4`의 `{vehicle.plateNumber}` 줄 (모델 라인·`i` 제원 버튼 **위**).

#### 읽기 모드

```text
TESLA-214742  [연필]
```

#### 편집 모드 (연필 클릭)

```text
[ input: TESLA-214742        ]  [✓]  [✕]
```

| 동작 | 설명 |
|------|------|
| 연필 클릭 | 읽기 → 편집 · input에 현재값 · focus |
| ✓ (저장) | PATCH 호출 · 성공 시 읽기 모드 · `["vehicles"]`, `["vehicles", id]` invalidate |
| ✕ (취소) | 변경 폐기 · 읽기 모드 |
| Enter | 저장 (✓와 동일) |
| Esc | 취소 (✕와 동일) |
| 저장 중 | ✓ 비활성 · input readonly |
| 실패 | input 유지 · 토스트/인라인 메시지 (중복·네트워크) |

**시각:** 연필·✓·✕는 기존 Hero `i` 버튼과 톤 맞춤 (작은 아이콘 버튼 · border circle 또는 line icon).

### 3.4 표시·검색 규칙 (변경 없음 + 명시)

- 목록·지도·위젯은 저장 직후 **새 `plateNumber`** 를 사용.
- 지도 핀 축약(끝 4자리)은 별칭에 따라 달라짐 — 허용.
- `teslaDisplayName`과 다를 수 있음 — 정상 (FMS 운영명 ≠ Tesla 앱명).

---

## 4. 비범위

- As-Is `/vehicles/[id]` 표시명 편집
- Tesla Fleet API 원격 차량명 변경
- 팀·부서·태그 등 메타데이터 (별칭 문자열만)
- 다중 사용자 동시 편집 락 (last-write-wins)
- 목록 행 인라인 편집
- 번호판 형식 강제·자동 하이픈

---

## 5. 수용 기준

1. V3 Hero 표시명 옆 연필 노출 · 클릭 시 input + ✓/✕.
2. ✓ 저장 시 DB·화면·목록에 반영 · ✕/Esc는 변경 없음.
3. `영업1팀`, `00가1234`, `대표님` 등 저장 가능 (번호판 regex 미강제).
4. fleet 내 중복 이름 시 저장 거부 + 안내.
5. 수동 저장 후 「제원 다시 불러오기」해도 **표시명 유지**.
6. As-Is URL·동작 불변.
7. AuditLog에 변경 이력 1건 이상 남음.

---

## 6. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **VD3-N-1** | 본 문서 승인 (GO) | ✅ |
| **VD3-N-2** | `plateNumberEditedAt` migrate · `writeVehicleSpecs` 보호 · `PATCH` API · Audit | ✅ |
| **VD3-N-3** | V3 Hero 인라인 편집 UI (연필·✓·✕) · 쿼리 invalidate | ✅ |
| **VD3-N-4** | 실차 QA — 저장·취소·중복·제원 재조회 후 이름 유지 | ☐ |

체크리스트: [checklist-vehicle-detail-vd3.md](./checklist-vehicle-detail-vd3.md) (VD3-N 행 추가 예정)

---

## 7. 의견 · 진행 여부

### 판단: **GO (조건부 즉시 진행 권고)**

| 근거 | 설명 |
|------|------|
| 제품 가치 | Tesla 연동 FMS의 **일상 불편**을 직접 해소. 목록·지도·검색 가독성 즉시 개선 |
| 구현 난이도 | UI는 Hero 한 줄 + 기존 아이콘. API 1개. **난이도 낮음~중간** |
| 데이터 리스크 | 낮음 — `vehicleId` FK 구조라 표시 문자열 변경이 스냅샷·이벤트를 깨지 않음 |
| 필수 선행 조건 | §1.4 **제원 REST 덮어쓰기 방지** 없이 UI만 넣으면 **운영 신뢰 붕괴** — N-2와 N-3 **동시 배포** |

### 주의

- `plateNumber` 이름이 “번호판”이지만 실제로는 **FMS fleet 별칭** 역할 — 문서·UI 문구는 **「표시명」** 으로 통일 권고 (연필 aria-label 등).
- unique 제약으로 `영업1팀` 중복 불가 — 소규모 fleet에서는 오히려 유리. 다수 동명 필요 시 장기 `displayLabel` 검토.
- VD3-S `i`(제원)와 같은 Hero 카드에 아이콘이 2개 — **표시명 줄(연필)** vs **모델 줄(`i`)** 로 분리해 혼동 최소화 (본 문서 §3.3).

### 비GO 조건 (아래면 보류)

- 제원 REST 보호(N-2)를 이번 스코프에서 제외할 경우 → **NO-GO**
- 전사 RBAC·승인 워크플로가 먼저 필요하다고 판단될 경우 → Phase 분리

**추천:** VD3-N-1 승인 후 **N-2·N-3를 한 PR**로 구현 → N-4 실차(`LRWYGCFJ7SC214742`) 검수.

---

## 8. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-16 | 초안 — Hero 연필 인라인 표시명 · REST 덮어쓰기 분석 · GO 판단 |
| 2026-07-16 | 코드 — `plateNumberEditedAt` · PATCH API · Hero 연필 UI · REST 보호 (N-2·N-3 ✅) |
