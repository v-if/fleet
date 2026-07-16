# VD3 인근 충전소 — 목록 있을 때만 블록 표시 (VD3-NB)

| 항목 | 내용 |
|------|------|
| 목적 | 차량상세 **위치 카드**에서 「인근 충전소」**타이틀·메타·리스트를 하나의 블록**으로 묶고, **사이트가 1건 이상일 때만** 표시한다. 목록이 없으면 타이틀·안내문구까지 **전부 숨긴다** |
| 배경 | 지도 아래 「인근 충전소」제목 + empty 안내(「주차 후 갱신됩니다」등)가 **리스트 없이** 남아 고객·운영자에게 「고장/미연동」처럼 읽힐 수 있다. 데이터 없을 때는 **조용히** 두는 편이 VD3 원칙(정상은 조용히)과 맞다 |
| 관련 | [requirements-vehicle-detail-vd3.md](./requirements-vehicle-detail-vd3.md) (VD3-4 nearby), [requirements-tesla-wake-telemetry-rest.md](./requirements-tesla-wake-telemetry-rest.md) (§3.4), [requirements-tesla-park-nearby-drive-edge.md](./requirements-tesla-park-nearby-drive-edge.md), [requirements-nearby-charging-catalog.md](./requirements-nearby-charging-catalog.md) |
| 적용 | **기본 상세** `FleetVehicleDetailViewV3` (`/vehicles/[id]`). `/v2`는 비범위(선택 후속) |
| 상태 | **코드 ✅ (NB-2·NB-3) · 검수 ☐** |
| 작성일 | 2026-07-16 |
| ID | **VD3-NB** |

---

## 1. As-Is 분석

### 1.1 현재 UI (`FleetVehicleDetailViewV3`)

위치 카드 구조:

```text
[위치]
  지도 (또는 「위치 신호 없음」)
  ── 항상 표시 ──
  「인근 충전소」 제목 + (선택) 출처·수집 시각
  ├─ sites.length > 0 → 리스트 (최대 5)
  └─ else → nearbyEmptyReason(...) 안내문구
```

`nearbyEmptyReason` 예:

| 상황 | 문구 |
|------|------|
| 좌표 없음 | 위치가 없어 인근 충전소를… |
| 주행 | 주행 중 — 주차 후 갱신됩니다. |
| 절전 | 주차(절전) — … |
| 기타 | 주차 후 갱신됩니다. … |

→ **제목은 항상 노출** · empty일 때 **설명만 바뀜** = 요청 배경의 혼란 지점.

### 1.2 데이터·수집 (변경 없음)

| 경로 | 역할 |
|------|------|
| TRF-B2e | 운행→P 시 `nearby_charging_sites` |
| NCS | REST 실패 시 카탈로그 폴백 |
| 2km stale | 이동 시 Snapshot nearby clear |

본 Phase는 **표시 조건만** 바꾼다. REST·카탈로그·트리거 로직은 그대로.

### 1.3 VD3-4와의 관계

VD3-4는 empty 시 「주차 후 갱신」**신뢰 문구**를 넣었다.  
제품 피드백: 그 문구+빈 타이틀이 **혼란** → **숨김**으로 재정의.  
수집 실패·미갱신은 관제 요약/운영·Audit로  sufficent; 위치 카드에 empty 교육 문구를 두지 않는다.

---

## 2. 제안 분석

### 2.1 채택

| 점 | 이유 |
|----|------|
| 타이틀↔리스트 묶음 | 하나가 없으면 둘 다 없음 — 시각적 한 블록 |
| empty 전면 숨김 | 「왜 비었지?」보다 「있으면 보여줌」이 FMS 관제에 단순 |
| 지도는 유지 | 위치 SoT와 nearby는 분리 — 좌표만 있어도 맵은 표시 |

### 2.2 빈칸 보완

| 공공 | 보완 |
|------|------|
| 표시 조건 | `nearbySites.length > 0` (Snapshot `nearbyChargingSites`) |
| 메타(출처·수집) | 리스트와 **같은 블록 안** · 목록 있을 때만 |
| 좌표 없음 | nearby 블록 숨김. 지도 자리는 기존 「위치 신호 없음」유지 |
| `nearbyEmptyReason` | UI에서 **호출 제거**. 헬퍼는 dead code면 삭제 또는 주석/후속 유지(권고: **미사용이면 함수 삭제**로 단순화) |
| v2 상세 | 비범위. 컷오버 후 기본만 손봄 |
| 관제 요약 | nearby empty를 요약에 넣지 않음 (현행 유지) |
| 접근성 | 숨김 = DOM에서 블록 자체 미렌더 (`display:none`만 남기지 않음) |

### 2.3 비범위

- park nearby / NCS / B2e 트리거 변경  
- 수동 「인근충전소 새로고침」버튼  
- 지도 UX 변경  
- `/v2` 인근충전소 UI  

---

## 3. To-Be UI

### 3.1 위치 카드

```text
[위치]
  지도 | 「위치 신호 없음」

  if nearbySites.length > 0:
    [인근 충전소]  (+ 출처 · 수집 시각)
    · 사이트 1
    · 사이트 2 …
  else:
    (아무것도 렌더하지 않음)
```

### 3.2 수용 기준

1. 사이트가 있으면: 제목 + (메타) + 리스트가 **한 덩어리**로 보임.
2. 사이트가 0이면: 「인근 충전소」문자·empty 안내·메타 **화면상 전무**.
3. 지도/위치 없음 플레이스홀더는 nearby와 무관하게 기존 동작.
4. REST·Telemetry·NCS 동작 회귀 없음 (UI만).
5. As-Is `/v2` 불변.

---

## 4. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **VD3-NB-1** | 본 문서 승인 (GO) | ✅ |
| **VD3-NB-2** | V3 위치 카드: `sites.length > 0`일 때만 nearby 블록 · empty 문구 제거 | ✅ |
| **VD3-NB-3** | (정리) `nearbyEmptyReason` 미사용 삭제 · 문서 VD3-4 empty 문구 정합 | ✅ |

체크리스트: [checklist-vehicle-detail-vd3.md](./checklist-vehicle-detail-vd3.md)

---

## 5. 의견 · 진행 여부

### 판단: **GO**

| 근거 | |
|------|--|
| 제품 | empty 교육 문구가 오히려 불안·혼란 — **데이터 있을 때만 노출**이 명확 |
| 구현 | 조건부 렌더 한 곳 · API/스키마 없음 · 리스크 极低 |
| 원칙 | VD3「정상은 조용히」· nearby는 park 후 부가정보 |

### 주의

- 운영자가 「왜 목록이 없지?」를 UI에서 못 볼 수 있음 → 필요하면 **운영/Audit·실차 체크리스트**로만 추적. 상세 위치 카드에 empty CTA를 다시 넣지 말 것.
- VD3 §5.2「empty + 주차 후 갱신」서술은 본 문서로 **폐기(표시 정책)** — 수집 정책은 TRF/NCS 유지.

**추천:** NB-1 승인 후 NB-2 즉시 구현 (수분~수십 분 규모).

---

## 6. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-16 | 초안 — nearby 블록 조건부 표시 · empty 숨김 · GO |
| 2026-07-16 | 코드 — V3 조건부 렌더 · `nearbyEmptyReason` 삭제 (NB-2·3 ✅) |
