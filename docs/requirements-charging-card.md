# 차량 상세 — 충전 중 서브카드 (CC)

| 항목 | 내용 |
|------|------|
| 목적 | 「실시간 차량 정보」에서 **충전 중**을 배지 한 줄이 아니라 전용 서브카드로 직관·상세 노출 |
| 적용 화면 | `FleetVehicleDetailView` — 「실시간 차량 정보」카드 내부 |
| 관련 | [requirements-vehicle-detail-ui2.md](./requirements-vehicle-detail-ui2.md) (§4.8~4.9 Summary), [requirements-tesla-fleet-api-model-mapping2.md](./requirements-tesla-fleet-api-model-mapping2.md) (`chargerPowerKw`) |
| 데이터 | 기존 Snapshot + **(CC-D) AC/DC 종류** — §5.4 · 연계 [model-mapping2 MM2-6](./requirements-tesla-fleet-api-model-mapping2.md) |
| 상태 | **CC-A~D 구현 완료** · 실차 검수·migrate 남음 |
| 체크리스트 | [checklist-charging-card.md](./checklist-charging-card.md) |
| 작성일 | 2026-07-14 |

---

## 1. 배경 (초안)

- As-Is: 배터리 프로그레스바 옆에 **「충전중」뱃지**만 표시 (초안 표기: 중전충 → 충전중).  
- To-Be: **마지막 신호 / 데이터 신선도** 문구와 **3×2 퀵타일** 사이에 **충전 전용 서브카드** 1장.  
- 평소 비노출, **충전 중일 때만** 노출. 분할(2열)하지 않고 **full-width 1장**.  
- Telemetry로 오는 충전 관련 값을 카드에 함께 보여 직관성을 높인다.

### 1.1 초안이 거론한 수신 예

| Telemetry / 상태 | Snapshot / FMS | 비고 |
|------------------|----------------|------|
| `Soc` | `batteryPercent` | 이미 상단 프로그레스 |
| `EstBatteryRange` | `rangeKm` | 이미 SOC 옆 「주행 가능 N km」 |
| `ACChargingPower` / `DCChargingPower` | `chargerPowerKw` (coalesce) | MM2 As-Is |
| `ChargeState` 등 | `chargingStatus` | `CHARGING` · `COMPLETE` · `STOPPED` · `DISCONNECTED` |

스키마 추가 없이 **표시·배치·노출 조건**만 본 Phase 범위.

---

## 2. As-Is

```
[상태] [██ SOC %] [주행 km] [충전중 뱃지] [이상 없음] [데이터 N분 전]
마지막 신호… (절전 시)
┌ 잠금 │ 문 │ 트렁크 ┐
│ 공조 │ 실내│ 실외  │
└ TPMS …
```

문제:

- 충전 중이어도 **뱃지 한 조각**이라 눈에 덜 띔.  
- 출력(kW)·상태가 SOC 줄과 섞여 **충전 맥락이 한곳에 모이지 않음**.  
- 하단 「충전기 출력」은 스크롤 아래·상시 그리드라 **충전 순간에 약함**.

---

## 3. 목표

1. 충전 중임을 **한 블록**으로 즉시 인식.  
2. 관련 수치(출력·SOC·주행가능·상태)를 **그 블록 안**에서 읽게 함.  
3. 미연결·비충전 시에는 영역을 **완전히 숨겨** UX2 밀도 유지.  
4. UX2 원칙 준수 — Telemetry 필드명·영문 enum을 1차 카피에 쓰지 않음.

---

## 4. 의견·권고 (AI)

### 4.1 방향 — **채택**

위치(신선도 ↔ 퀵타일 사이)·1장 full-width·조건부 노출은 **타당**.  
충전은 “상시 타일 6개”와 성격이 다르므로 **이벤트성 배너형 서브카드**가 맞다.

### 4.2 노출 조건 — 확정 권고

| `chargingStatus` | 서브카드 | 상단 SOC 옆 뱃지 |
|------------------|:--------:|:----------------:|
| `CHARGING` | **표시** | **제거** (카드가 대체) |
| `COMPLETE` | **표시** (톤 down: 「충전 완료」) | 제거 |
| `STOPPED` | **표시** (「충전 중지」— 아직 연결된 신호로 해석) | 제거 |
| `DISCONNECTED` / null | **숨김** | 숨김 (현 UX2-13과 동일) |

초안 「충전중일 때만」을 글자 그대로면 `CHARGING`만 해당.  
다만 `COMPLETE`/`STOPPED`도 케이블 연결 상황에서 자주 오며, **숨기면 다시 뱃지만 필요**해져 어중간해짐.  
→ **권고: `CHARGING` + `COMPLETE` + `STOPPED`에 카드 표시**, 카피·색만 상태별로 구분.  
(`DISCONNECTED`만 완전 숨김.)

MVP를 더 좁히면 **`CHARGING`만**으로 시작하고, COMPLETE/STOPPED는 후속(CC-B)으로 둬도 됨. 본 문서는 **권고안 = 세 상태 표시**.

### 4.3 상단 뱃지

카드가 생기면 SOC 줄의charging`뱃지는 **중복**.  
**표시 중에는 뱃지 비표시**를 권고 (한 자리 원칙, UX2-20과 동일).

### 4.4 부족한 점 보완

| 공백 | 보완 |
|------|------|
| 「충전중」정의 | §4.2 상태표 |
| AC vs DC 원문 | UI에 `ACChargingPower` 금지 → 출력은 kW, **종류는 「완속」「급속」** (§5.4) |
| Soc/Range 중복 | 카드에 다시 넣되 **요약형**(큰 SOC % · 주행 km). 상단 프로그레스는 **유지**(전체 요약 줄). 카드는 “충전 세션” 초점 |
| 충전 한도 | 있으면 `한도 N%` 한 줄 — Baseline/REST·Telemetry `ChargeLimitSoc` |
| empty | 출력·한도 null이면 `-` 또는 해당 메트릭 생략 (카드 자체는 상태만으로도 성립) |
| 접근성 | 색만으로 “충전 중”·완속/급속 구분 금지 — **제목·종류 텍스트 필수** |
| 절전 | ASLEEP + DISCONNECTED면 카드 없음. (드물게 CHARGING+신선도 오래됨 → 카드 + 기존 신선도 줄로 충분) |

CC-A~B 시점에는 스키마 추가 없음. **완속/급속 표시(CC-D)는 Snapshot에 종류 값 필요** — §5.4.

---

## 5. To-Be 레이아웃 (가이드)

### 5.1 자리

「실시간 차량 정보」카드 내부 세로 순서:

```
① 제목
② 상태 · SOC 프로그레스 · 주행 km · 이슈 · (절전 아니면) 데이터 N분 전
③ 절전 시: 마지막 신호 …
④ 【충전 서브카드】 ← 조건부, full-width          ★ 본 Phase
⑤ 3×2 퀵타일 (잠금·변속·감시모드 · 공조·실내·실외) — CI-D
⑥ 타이어 · 차체 (TPMS)
```

퀵타일을 밀지 않고 **사이에 삽입**. 우측 「현재 위치」와 분할하지 않음.

### 5.2 서브카드 내부 구성 (권고)

```
┌─────────────────────────────────────────────┐
│ 충전 중 · 완속                    (또는 급속) │  ← 제목 + AC/DC 한글 (§5.4)
│ ████████░░  96%     주행 가능 404 km           │  ← SOC · range (Snapshot)
│ 출력 6.3 kW          한도 90%                 │  ← kW · chargeLimitSoc
└─────────────────────────────────────────────┘
```

| 구역 | 내용 | 출처 | 표시 |
|------|------|------|------|
| **헤더** | `충전 중` / `충전 완료` / `충전 중지` | `chargingStatus` | 필수 |
| **헤더 보조** | `완속` / `급속` (AC/DC) | `chargingPowerKind` (§5.4) | 종류 알 때만 · 없으면 생략 |
| **1행** | SOC % · 주행 가능 km | `batteryPercent`, `rangeKm` | 값 있을 때 |
| **2행** | 출력 kW · (선택) 충전 한도 % | `chargerPowerKw`, `chargeLimitSoc` | 값 있을 때 · 없으면 칸 생략 |

톤:

- `CHARGING`: 강조(예: success/warning 경계·좌측 액센트).  
- `COMPLETE`: 중립·성공.  
- `STOPPED`: 경고 톤 가능.

수치 포맷: SOC·한도 반올림 정수 %, kW는 **소수 1자리**, km 정수.  
필드명(`Soc`, `ACChargingPower`, `DCChargingPower`) **화면 금지**.

### 5.3 비표시 예시

`DISCONNECTED` → ④ 자리 자체가 없어 ②→⑤로 바로 이어짐 (As-Is 밀도).

### 5.4 AC(완속) / DC(급속) 표시 — ✅ CC-D

#### 5.4.1 As-Is → To-Be

| 경로 | 내용 |
|------|------|
| Telemetry | `ACChargingPower`/`DCChargingPower` → `resolveChargingPowerFromTelemetry` |
| Snapshot | `chargerPowerKw` + **`chargingPowerKind`** (`AC`\|`DC`\|null) |
| REST | kW만 · kind는 Baseline 시 null, Telemetry 유지 merge 시 이전 kind 보존 |
| UI | `ChargingSessionCard` 헤더 옆 「완속」/「급속」 뱃지 |
#### 5.4.2 표시 카피 (확정 권고)

| 내부 값 | 화면 (한글) | 비노출 |
|---------|-------------|--------|
| `AC` | **완속** | `AC`, `ACChargingPower` |
| `DC` | **급속** | `DC`, `DCChargingPower`, `Supercharger` 등 브랜드어 강제 금지 |
| `UNKNOWN` / null | **종류 문구 생략** (제목·kW만) | “알 수 없음” 뱃지 남발 비권고 |

「AC(완속)」「DC(급속)」처럼 영문+한글 병기는 **비권고** — UX2 1차 화면은 한글만.

#### 5.4.3 카드 안 위치 (권고)

| 안 | 내용 | 평가 |
|----|------|------|
| **A. 헤더 보조** `충전 중 · 완속` | 한눈에 종류+상태 | **채택** — 제목 옆 또는 바로 아래 작은 뱃지 |
| B. 출력 줄 `완속 · 출력 6.3 kW` | 수치와 묶임 | 가능. 헤더보다 덜 눈에 띔 |
| C. 색만 (파랑=완속/주황=급속) | 공간 절약 | **비채택 단독** — 색맹·다크모드·접근성. A와 **병행만** 허용 |

**채택: A (+ 선택적으로 B 병기 금지, 톤 차별은 약하게).**

와이어:

```
│ 충전 중  [완속]                              │
│ … SOC …                                     │
│ 출력 6.3 kW · 한도 90%                      │
```

또는

```
│ 충전 중 · 급속                               │
│ …                                           │
│ 출력 48.2 kW · 한도 90%                     │
```

`COMPLETE`/`STOPPED`에서도 종류가 남아 있으면 동일 규칙(`충전 완료 · 급속`). 종류 모르면 제목만.

#### 5.4.4 판정 규칙 (ingest — Telemetry)

merge 시 `chargingPowerKind` 갱신 권고:

```
DCChargingPower > 0     → kind = DC,  chargerPowerKw = DC
else ACChargingPower 있음 → kind = AC, chargerPowerKw = AC  (0 포함 여부는 실측: 충전중이면 보통 >0)
else                     → kind·kW 미갱신 (희소 merge → 이전 유지)
```

REST Baseline/`vehicle_data`:

- `charger_power`만 있음 → **`kind = UNKNOWN`(또는 null)** · kW만 갱신.  
- 추정(예: kW≥20 → DC) **비권고** — 오류율 높음.

#### 5.4.5 데이터 선행 (스키마)

| 방식 | 내용 | 평가 |
|------|------|------|
| **권고** | Snapshot `chargingPowerKind` `String?` (`AC`\|`DC`) 또는 enum | MM2-6과 동일 취지 · 카드/DTO 단순 |
| 대안 | AC·DC kW 두 컬럼 | Telemetry 원형 보존. REST는 여전히 애매 · UI는 max만 씀 → **과함** |
| 비권고 | UI에서 coalesce 규칙 재실행 | Snapshot만 보면 재현 불가 |

DTO·`ChargingSessionCard`에 `chargingPowerKind` 전달 → §5.4.3 표시.  
**CC-D 구현 완료** (`charging-power.ts` · migration `20260714180000_cc_d_charging_power_kind`).

---

## 6. 요구사항 ID

| ID | 요구 | 우선 | 상태 |
|----|------|:----:|:----:|
| **CC-1** | 신선도/마지막 신호와 퀵타일 **사이**에 full-width 충전 서브카드 슬롯 | P1 | ✅ |
| **CC-2** | `DISCONNECTED`(및 null)일 때 카드 **비노출** | P0 | ✅ |
| **CC-3** | `CHARGING`일 때 카드 노출 · 제목 「충전 중」 | P0 | ✅ |
| **CC-4** | (권고) `COMPLETE`/`STOPPED`도 카드 노출 · 제목 구분 | P1 | ✅ |
| **CC-5** | 카드에 SOC% · 주행 km · 출력 kW · (있으면) 한도 % — §5.2 | P1 | ✅ |
| **CC-6** | 카드 표시 중에는 SOC 줄 **충전 뱃지 숨김** | P1 | ✅ |
| **CC-7** | 카피에 Telemetry/영문 enum 미사용 · 기존 한글 라벨 사전 | P1 | ✅ |
| **CC-8** | 충전 카드에 **완속/급속** 표시 (§5.4) — kind 저장·헤더 보조 | P1 | ✅ |
---

## 7. 수용 기준

- [x] `CHARGING` 시 퀵타일 위 충전 카드 · 「충전 중」 (코드)
- [x] `DISCONNECTED` 시 카드 없음 · SOC 옆 충전 뱃지 없음 (코드)
- [x] Snapshot kW/SOC 등 · Telemetry 필드명 미노출 (코드)
- [x] `COMPLETE`/`STOPPED` 카드·제목 구분 (코드, CC-B)
- [ ] 실차 충전 세션 UI 대조
- [x] (CC-8) Telemetry AC/DC → 「완속」/「급속」 · REST-only는 종류 생략 (코드)
- [ ] 실차 충전 세션 UI 대조 · `prisma migrate`

---

## 8. Phase

| Phase | 범위 |
|-------|------|
| **CC-A** | CC-1~3, CC-5~7 — ✅ |
| **CC-B** | CC-4 — ✅ |
| **CC-C** (후속) | 애니메이션·예상 완료 시각 등 (데이터 없으면 보류) |
| **CC-D** | CC-8 — 완속/급속 · `chargingPowerKind` — ✅ |

작업 체크: [checklist-charging-card.md](./checklist-charging-card.md)

---

## 9. 초안 대비 요약

| 초안 | 본 문서 |
|------|---------|
| 뱃지 → 서브카드, 퀵타일 위, 1장 | **채택 · 구현** |
| 충전중만 노출 | **구현: CHARGING+COMPLETE+STOPPED** (`DISCONNECTED`만 숨김) |
| Soc·Range·Power·status 노출 | Snapshot · §5.2 |
| (암묵) 스키마 | CC-D: `chargingPowerKind` |
| AC/DC 표시 | §5.4 — **완속/급속** · **CC-D 구현** |

---

## 10. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-14 | 초안(충전 UX)·의견·레이아웃·CC ID 요구사항화 (**코드 미착수**) |
| 2026-07-14 | **CC-A~B 구현** — `ChargingSessionCard` · [checklist](./checklist-charging-card.md) |
| 2026-07-14 | §5.4·CC-8 — AC 완속 / DC 급속 표시 방법·데이터 선행 (미착수) |
| 2026-07-14 | **CC-D 구현** — `chargingPowerKind` · 헤더 「완속」/「급속」 |
| 2026-07-14 | §5.1 순서 메모 — CI 후 퀵타일 2×2 · 「타이어 · 차체」 |
| 2026-07-14 | §5.1 — CI-D 3×2 퀵타일(잠금·감시모드·공조·변속·실내·실외) |
| 2026-07-14 | §5.1 — CI-D 순서 잠금·변속·감시모드·공조·실내·실외 |

---

## 부록 — 원문 초안

> 실시간 차량 정보 · 충전중 UI — 뱃지 → 신선도와 6퀵타일 사이 서브카드.  
> 평소 비노출·충전중만·1장. Soc / EstBatteryRange / ACChargingPower / chargingStatus.
