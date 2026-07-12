# 차량 상세 페이지 고도화 요구사항

## 1. 문서 개요

| 항목 | 내용 |
|------|------|
| 목적 | FMS **관리자**가 차량 한 대를 빠르게 파악·조치할 수 있도록, 차량 상세(`/vehicles/[id]`)의 **표시 데이터·배치·표현** 요구사항을 정의한다 |
| 근거 | [requirements-tesla-fleet-api-display-data.md](./requirements-tesla-fleet-api-display-data.md), Prisma 스키마, **실차 DB** `VIN LRWYGCFJ7SC214742` |
| 적용 화면 | `FleetVehicleDetailView` (`src/components/fms/FleetVehicleDetailView.tsx`) |
| 작성일 | 2026-07-12 |
| 상태 | **요구사항만** — 코드 구현 미착수 |

### 1.1 조사 원칙

1. **이미 DB/API에 있는 값**을 UI에 올리는 것을 1순위로 한다 (추가 Fleet 호출 최소화).
2. 관리자 관점의 질문 순서를 따른다: *지금 문제인가? → 어디에 있나? → 충전·보안은? → 연동은 건강한가? → 제원은?*
3. null / stale / 추론(ASLEEP)을 **숨기지 않고** 신뢰 가능하게 표현한다.
4. 개인 편의 기능(시트 히터·미디어 등)보다 **관제·보안·연동·유지보수**에 우선순위를 둔다.

### 1.2 관련 문서

| 문서 | 역할 |
|------|------|
| [requirements-tesla-fleet-api-display-data.md](./requirements-tesla-fleet-api-display-data.md) | 정적/동적 분류·Endpoint 후보 |
| [requirements-tesla-fleet-api-model-mapping.md](./requirements-tesla-fleet-api-model-mapping.md) | 모델·트림 표시명 |
| [requirements-tesla-hybrid-data-model.md](./requirements-tesla-hybrid-data-model.md) | Vehicle / Snapshot / SyncState |
| [requirements-tesla-fleet-telemetry-disconnect.md](./requirements-tesla-fleet-telemetry-disconnect.md) | 연동 끊기·재연결 |
| [requirements-tesla-api-bugfix-0712.md](./requirements-tesla-api-bugfix-0712.md) | 실차 표시 고착 (문/트렁크·nearby) — Phase BF |
| [checklist-tesla-api-bugfix-0712.md](./checklist-tesla-api-bugfix-0712.md) | BF 구현 체크리스트 |
| [requirements-front-design.md](./requirements-front-design.md) · [requirements-dashboard-design.md](./requirements-dashboard-design.md) | 톤·카드·밀도 |

---

## 2. 실차 스냅샷 분석 (`LRWYGCFJ7SC214742`)

조사 시점 기준(DB 조회). UI 고도화 시 **이 VIN을 수용 테스트 기준 차량**으로 사용한다.

### 2.1 Vehicle (정적·준정적)

| 필드 | 실값 | 상세 UI As-Is | 고도화 메모 |
|------|------|:-------------:|-------------|
| `plateNumber` | `TESLA-214742` | ✅ | 헤더 주 식별자 유지 |
| `model` | `Model Y · RWD` | ✅ | 표시 모델명 SoT |
| `year` | `2025` | ✅ | |
| `oemVehicleId` | `LRWYGCFJ7SC214742` | ✅ | 복사 버튼 권장 |
| `carType` | `modely` | ✅ | 라벨화 유지 |
| `trimBadging` | `50` | ✅ | RWD 등 트림 라벨 |
| `exteriorColor` | `StealthGrey` | ✅ | 색 칩/뱃지 강화 |
| `teslaDisplayName` | `""` (빈 문자열) | △ | 빈 값 → “미설정” / 숨김 |
| `specsSyncedAt` | `2026-07-11T03:22:54Z` | ✅ | 상대시각+절대시각 |

### 2.2 VehicleSnapshot (동적) — 채워짐 vs null

| 필드 | 실값 | 의미 | UI 시사점 |
|------|------|------|-----------|
| `batteryPercent` | ~60.6 | SoC | 소수 1자리·게이지 유지 |
| `rangeKm` | 258 | 주행가능거리 | 명확한 단위(km) |
| `odometerKm` | 12090 | 누적거리 | 천단위 구분 |
| `status` | `ASLEEP` | 취침 | **추론 메타와 함께** 표시 |
| `isAsleepInferred` | `true` | Telemetry 공백 추론 | **미표시 → P0 추가** |
| `sleepInferredAt` | `2026-07-11T18:10:07Z` | 추론 시각 | 신선도 블록에 포함 |
| `chargingStatus` | `DISCONNECTED` | 충전 미연결 | |
| `locked` / doors / windows | true / false / false | 보안 | |
| `insideTempC` / `outsideTempC` | ~29.6 / 27 | 공조 | 반올림 정책 |
| `climateOn` | false | | |
| `tpms*` | 2.9~2.95 atm | REST Baseline | PSI 환산 유지, 신선도 주의 |
| `softwareVersion` | `2026.8.6` | SW | 제원/소프트웨어 구역 |
| `sentryMode` | false | | |
| `telemetrySource` | `TELEMETRY` | 소스 | |
| `lastTelemetryAt` | `2026-07-11T18:03:24Z` | 마지막 스트림 | |
| **`latitude` / `longitude`** | **null** | 위치 없음 | **지도 빈 상태 UX P0** |
| `serviceStatus` | null | 정비 | “데이터 없음” vs 정상 구분 |
| `nearbyChargingSites` | `[]` | 미연동 | 파이프라인 보강 전 UI 숨김/비활성 |
| `lastRestSyncAt` (snapshot) | null | Snapshot 쪽 REST 시각 | SyncState 쪽 값과 혼동 주의 |

### 2.3 VehicleSyncState · TelemetrySubscription (운영)

| 필드 | 실값 | UI As-Is | 고도화 |
|------|------|:--------:|--------|
| `lifecycle` | `READY` | ✅ | 정상 시 배지 축소(노이즈↓) |
| `virtualKeyConfirmedAt` | 있음 | ❌ | 연동 타임라인에 표시 |
| `telemetryConfigSyncedAt` | 있음 | △ | |
| `baselineCompletedAt` | 있음 | △ | |
| `baselineLastError` | 과거 `408 vehicle unavailable` | ❌ | **최근 실패 이력**으로 노출(접힘) |
| `lastRestSyncAt` / `Reason` | WAKE_COOLDOWN | ✅ 일부 | Reason 한글 라벨 |
| `lastWakeDetectedAt` | 있음 | ❌ | 웨이크 감지 시각 |
| `subscription.active` | true | ✅ | |
| `configSynced` | **false** | △ | READY인데 false → **경고 톤** |
| `configCheckedAt` / `subscribedAt` | 있음 | ❌ | |
| `lastError` | null | ❌ | null이면 정상 표시 |
| `events[]` | **비어 있음** | 빈 목록 | Empty state 카피 |

### 2.4 실차에서 드러난 UX 리스크

1. **위치 null**인데 지도·“현재 위치” 섹션이 어색하게 남을 수 있음 → “위치 미수신” 명시 + 원인 힌트(Telemetry Location 미구독/취침/권한).
2. **ASLEEP + isAsleepInferred** — 단순 “취침”만 보이면 관리자가 “실측인지 추론인지”를 모름.
3. **`configSynced: false` + lifecycle READY** — 연동 건강도 모순을 한눈에 보여줘야 함.
4. **TPMS는 값이 있으나 REST Baseline 유산** — Telemetry만 돌면 노후될 수 있음 → “최종 동기화 출처/시각” 표기.
5. **이벤트 0건** — “이상 없음”과 “이벤트 미수집”을 구분하는 카피 필요.

---

## 3. As-Is 상세 UI (요약)

현재 `FleetVehicleDetailView` 대략 구조:

```
Toolbar (번호·모델·provider·갱신)
└ Lifecycle guidance (조건부)
└ Header card (상태·제원 뱃지·이슈 태그)
└ 제원 + 운영 액션
└ 데이터 신선도
└ 배터리·주행 | 지도
└ 잠금·개폐 | 공조
└ TPMS
└ 최근 이벤트
└ 모달 (끊기 / unlink)
```

**강점:** 제원·신선도·배터리·보안·TPMS·연동 액션이 이미 한 페이지에 있음.  
**약점:** (1) 섹션이 세로로 길어 **한 화면에서 “지금 할 일”이 묻힘**, (2) DB에 있는 운영 메타(추론 취침·VK·wake·baseline 에러·configSynced) 활용 부족, (3) null/빈 데이터 표현이 관리자용으로 약함, (4) 위치 없을 때 지도 Hero 전략과 충돌.

---

## 4. 표시 가능 데이터 목록 (조사 결과)

### 4.1 지금 바로 UI에 올릴 수 있음 (DB·API 존재)

| 우선 | 데이터 | 소스 | 관리자 가치 |
|:----:|--------|------|-------------|
| P0 | 위치 null 상태·안내 | Snapshot lat/lng | “지도 안 뜸” 원인 즉시 이해 |
| P0 | ASLEEP 추론 여부·시각 | `isAsleepInferred`, `sleepInferredAt` | 오탐/실측 구분 |
| P0 | Telemetry configSynced 경고 | Subscription | 스트림/설정 불일치 |
| P0 | 이슈 요약 스트립 (기존 태그 강화) | Snapshot+events | 스크롤 없이 이상 인지 |
| P1 | VK 확인·Baseline·마지막 wake 시각 | SyncState | 온보딩/재연결 진단 |
| P1 | Baseline/구독 lastError | SyncState / Subscription | 장애 대응 |
| P1 | REST sync reason 한글화 | `lastRestSyncReason` | 왜 REST가 돌았는지 |
| P1 | 구독 시각·configCheckedAt | Subscription | 연동 타임라인 |
| P1 | SoC 소수점·신선도 결합 | Snapshot | “60% (3시간 전)” |
| P2 | 이벤트 resolvedAt | Event | 해소된 알람 구분 |
| P2 | 차량 등록·제원 동기 시각 | Vehicle | 감사·이력 |
| P2 | teslaDisplayName (빈 값 처리) | Vehicle | 혼동 방지 |

### 4.2 API에는 있으나 실차에서 비어 있음 → UI는 “비활성/안내”만

| 데이터 | 실차 | 조건 |
|--------|------|------|
| `nearbyChargingSites` | `[]` | Tesla mapper 미연동 — **섹션 숨김** 또는 “미지원” |
| `serviceStatus` | null | REST `service_data` 미연동 — “정보 없음” |
| `events` | [] | 수집 파이프 확인 전 empty state |

### 4.3 문서상 후보이나 **추가 수집 파이프** 필요 (상세 UI 2차)

[display-data](./requirements-tesla-fleet-api-display-data.md) §4 기준. **이번 상세 UX 1차 범위 밖**이나 로드맵에 명시.

| 후보 | 필요 작업 | 상세 가치 |
|------|-----------|-----------|
| `charge_limit_soc`, `charger_power` | Snapshot 컬럼 + REST/Telemetry | 충전 운영 |
| `speed`, `heading`, `shift_state` 상세 | drive_state / Telemetry | 주행 중 관제 |
| 문/트렁크 개별 | closures_state | 보안 디테일 |
| `wheel_type`, `roof_color` | Vehicle 정적 컬럼 | 제원 풍부화 |
| `recent_alerts` / `release_notes` | 전용 테이블 또는 Event 확장 | 정비·SW |
| Location 상시 | Telemetry 필드·취침 정책 | 지도 P0 품질 |
| TPMS Telemetry | 구독 필드 추가 | REST 의존 제거 |

---

## 5. 관리자 UX 원칙

### 5.1 관리자가 상세에 들어오는 목적 (우선순위)

1. **이상 여부** — 배터리·잠금·문·TPMS·이벤트·연동 오류  
2. **위치** — 어디 있는지 / 왜 없는지  
3. **에너지** — SoC·거리·충전 상태  
4. **연동 건강** — Telemetry / REST / VK / Baseline  
5. **제원·식별** — 모델·색·VIN (변경 빈도 낮음)

→ 레이아웃도 이 순서(위→아래, 좌 핵심 / 우 맥락)를 따른다.

### 5.2 정보 밀도

- 소규모 플릿(1~10대)이므로 **한 차량을 깊게** 보여도 됨.
- 다만 Pleos식 “모든 필드 나열”은 피하고, **상태 한줄 + 3~4개 핵심 카드 + 접이식 운영 패널**로 나눈다.
- 정상 값은 조용히, **비정상·null·stale**만 색·아이콘으로 강조 ([front-design](./requirements-front-design.md) 차별화와 정합).

### 5.3 신뢰(Trust) 표현 — FMS 핵심

모든 동적 수치 옆에 가능하면:

| 표현 | 예 |
|------|-----|
| 상대 시각 | `3시간 전` |
| 소스 | `Telemetry` / `REST` / `추론` |
| 결측 | `위치 없음` (회색, 추측 좌표 금지) |
| 오래된 데이터 | SoC는 있어도 `lastTelemetryAt`이 stale이면 경고 톤 |

### 5.4 액션 vs 조회 분리

| 구역 | 내용 |
|------|------|
| **조회** | 상태·지도·배터리·보안·제원 |
| **운영 액션** | 새로고침, Baseline, Telemetry 재연결/끊기, 제원 재동기화, 플릿 제거 |

액션은 헤더/사이드에 모으고, 본문 카드 사이에 버튼을 흩뿌리지 않는다 (실수 클릭·인지 부하↓).

---

## 6. 제안 정보 구조 (IA) · 배치

### 6.1 와이어 (논리 레이아웃)

```
┌─────────────────────────────────────────────────────────────┐
│ A. 상단 고정 요약 (Summary strip)                            │
│  번호 | 상태칩 | SoC | 충전 | 잠금 | 이슈N | 데이터 나이      │
│  [새로고침]  …운영 액션은 ⋮ 또는 우측 패널                    │
├──────────────────────────────┬──────────────────────────────┤
│ B. 상황 (Situation) — 좌     │ C. 위치 (Location) — 우       │
│  · 배터리 게이지 + 거리      │  · 지도 Hero                   │
│  · 충전 상태                 │  · 좌표 / “위치 미수신”         │
│  · 취침·추론 배지            │  · 마지막 유효 위치 시각(있으면)│
├──────────────────────────────┴──────────────────────────────┤
│ D. 보안·차체 (Security)                                       │
│  잠금 · 문 · 창문 · 센트리  (아이콘 그리드, 이상만 강조)       │
├──────────────────────────────┬──────────────────────────────┤
│ E. 공조                      │ F. 타이어(TPMS)               │
│  실내/외 · HVAC              │  다이어그램 + 출처/시각        │
├──────────────────────────────┴──────────────────────────────┤
│ G. 연동·운영 (Connectivity) — 기본 접힘 / 문제 시 자동 펼침  │
│  lifecycle · configSynced · lastTelemetry · REST reason      │
│  VK/Baseline/wake 타임라인 · lastError · 운영 버튼           │
├─────────────────────────────────────────────────────────────┤
│ H. 제원 (Specs) — 접힘 가능                                   │
│  모델·트림·색·VIN·SW·제원동기화                               │
├─────────────────────────────────────────────────────────────┤
│ I. 이벤트 타임라인                                            │
│  최근 N건 · 해소 여부 · empty state                           │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 섹션별 요구

#### A. Summary strip (신규·강화) — P0

- **항상 보이며** 스크롤과 무관하게 “이 차 괜찮은가?”에 답한다.
- 포함: 상태, SoC(%), 충전 라벨, 잠금, 이슈 개수(클릭 시 D/I로 스크롤), `데이터 n분 전`.
- 이슈 0이면 “이상 없음” 조용한 텍스트.

#### B. Situation — P0

- 기존 BatteryHealthGauge 유지.
- `rangeKm`, `odometerKm`, `chargingStatus`, `ignitionOn`/`isIdle`.
- `status=ASLEEP`이고 `isAsleepInferred`이면 배지: **「취침 (추론)」** + `sleepInferredAt`.

#### C. Location — P0

| 좌표 상태 | 표현 |
|-----------|------|
| lat/lng 유효 | Naver 지도 + 좌표 요약 + (선택) 외부 지도 링크 |
| null | 지도 자리 **플레이스홀더**: “위치 데이터 없음” / Telemetry Location·취침 안내. **가짜 서울 좌표 금지** |
| stale | 마지막 위치 + “마지막 수신 n시간 전” (위치가 있을 때만) |

#### D. Security — P0 (표현 개선)

- 4~5개 아이콘 타일. 정상=muted, 이상=warning/error.
- 이슈 태그와 동일 규칙으로 중복 최소화(스트립에만 요약, 상세는 D).

#### E·F. Climate / TPMS — P1

- 수치 + **출처 힌트** (“Baseline REST · n일 전” 가능하면).
- TPMS 임계 미만만 error.

#### G. Connectivity — P0 (정보) / P1 (타임라인)

- `configSynced === false` → 경고 카드 (실차에서 관측됨).
- `baselineLastError` / `lastError` → 접이식 “최근 오류”.
- 타임라인: 구독 시작 → VK 확인 → Baseline → 마지막 Telemetry → 마지막 REST → 마지막 wake.
- 운영 버튼은 이 섹션 하단에 그룹.

#### H. Specs — P1

- 기존 제원 필드 유지. 평소 접힘, “제원·식별” 토글.
- VIN 복사. `teslaDisplayName` 공백이면 미표시.
- `softwareVersion`은 제원 또는 별도 “소프트웨어” 한 줄.

#### I. Events — P1

- 최대 10~20건. `resolvedAt` 있으면 취소선/“해소됨”.
- Empty: “기록된 이벤트가 없습니다.” (정상으로 단정하지 않음).

---

## 7. 표현 방법 가이드

### 7.1 상태·뱃지

| 개념 | 표현 |
|------|------|
| ONLINE | 성공(녹) |
| ASLEEP | 중립(청/회) + 추론이면 점선/보조 라벨 |
| OFFLINE / WARNING / ALERT | 경고·에러 |
| CHARGING | 강조(충전 중만) |
| DISCONNECTED | 평문 |

### 7.2 숫자

| 필드 | 표기 |
|------|------|
| SoC | 정수 또는 소수 1자리 `%` |
| range / odometer | 천단위 구분 + `km` |
| 온도 | 소수 1자리 `°C` |
| TPMS | PSI (기존 atm×14.7), 임계 미만 강조 |

### 7.3 시각

- 절대: `YYYY-MM-DD HH:mm` (KST 명시 또는 브라우저 로컬 통일)
- 상대: `n분 전` / `n시간 전` (툴팁에 절대시각)

### 7.4 Null · 로딩 · 오류

| 상태 | UI |
|------|-----|
| 필드 null | `—` 또는 “정보 없음” (필드 숨김보다 자리 유지가 비교에 유리한 경우 유지) |
| 섹션 전체 불가 (위치) | 전용 empty 컴포넌트 |
| API 실패 | 페이지 에러 + 재시도 (기존) |
| 부분 stale | 섹션 헤더에 “데이터 오래됨” |

### 7.5 다크모드

- 지도: 라이트 타일 유지 가능, **카드 프레임만** 테마 따름 ([dashboard-design](./requirements-dashboard-design.md)과 동일 정책).

---

## 8. 범위 · 우선순위 (구현 단계 — 코드는 후속)

### Phase VD-1 (P0) — “신뢰 + 한눈에” — ✅ 2026-07-12

구현: `FleetVehicleDetailView` · 체크리스트 [checklist-vehicle-detail-ui.md](./checklist-vehicle-detail-ui.md)

- [x] Summary strip
- [x] ASLEEP 추론 표시
- [x] 위치 null empty UX
- [x] configSynced 경고
- [x] 이슈 스트립과 보안 섹션 정렬
- [x] 운영 액션 그룹화(배치만)
- [x] VIN 복사 · TPMS 이슈 PSI 환산

### Phase VD-2 (P1) — “운영 진단” — ✅ 2026-07-12

구현: `FleetVehicleDetailView` · [checklist-vehicle-detail-ui.md](./checklist-vehicle-detail-ui.md)

- [x] Connectivity 타임라인 (VK / Baseline / wake / REST reason)
- [x] lastError · baselineLastError 노출
- [x] TPMS/공조 출처·시각
- [x] 이벤트 empty/resolved
- [x] 제원 접기

### Phase VD-3 (P2) — “데이터 파이프 확장 연동” — ✅ 2026-07-12

구현: Prisma migrate `20260712080000_phase_vd3_snapshot_detail` · REST/Telemetry · `FleetVehicleDetailView`  
체크리스트: [checklist-vehicle-detail-ui.md](./checklist-vehicle-detail-ui.md)

- [x] Location 상시(구독 유지·empty UX) · charge 상세 스키마·동기화
- [x] nearby charging · service_data 수집·UI
- [x] 개별 도어/트렁크 · Baseline alerts

---

## 9. 비범위 (이번 상세 고도화에서 하지 않음)

- 차량 원격 제어 버튼 확장 (unlock 등) — Command Proxy·권한 별도
- 대시보드/목록 전면 개편 (상세에서 검증 후 반영)
- Energy / User API
- Kakao 복귀 — Naver Maps 유지
- 스키마 대규모 변경 (VD-3에서 처리 — charge/doors/trunk 컬럼 추가 완료)

---

## 10. 수용 기준 (실차 `LRWYGCFJ7SC214742`)

VD-1 완료 시 관리자가 상세에서 **스크롤 없이 또는 최소 스크롤로** 다음을 답할 수 있어야 한다.

1. 지금 상태(취침)가 **실측인가 추론인가?**
2. **지도에 차가 안 보이는 이유**(위치 null)가 明示되는가?
3. SoC·거리·잠금·TPMS가 보이고, **데이터가 얼마나 신선한가?**
4. Telemetry **configSynced false**가 경고로 보이는가?
5. 제원(Model Y RWD, StealthGrey, VIN, SW 2026.8.6)을 막힘없이 확인·VIN 복사 가능한가?

---

## 11. 미결정 · 후속 조사

| ID | 질문 | 제안 |
|----|------|------|
| Q1 | Summary strip을 sticky로 할지 | 데모 1대 기준 sticky 권장 |
| Q2 | `configSynced false`가 READY에서 정상인지 | Telemetry/FMS 정합 조사 후 경고 문구 확정 |
| Q3 | 위치 null이 Telemetry 필드 미포함인지 / 취침 정책인지 | Telemetry 구독 필드·실차 wake 시 재확인 |
| Q4 | TPMS 단위를 처음부터 PSI로 저장할지 | 표시만 환산 유지(단기) |
| Q5 | 이벤트 소스를 `recent_alerts`로 채울지 | VD-3 |

---

## 12. 산출물 · 다음 액션

| 산출물 | 상태 |
|--------|------|
| 본 요구사항 | ✅ |
| UI 와이어(Figma/스케치) | 생략 — VD-1은 코드로 직접 반영 |
| 구현 체크리스트 | ✅ [checklist-vehicle-detail-ui.md](./checklist-vehicle-detail-ui.md) |
| VD-1 코드 | ✅ `FleetVehicleDetailView` (2026-07-12) |
| VD-2 코드 | ✅ 타임라인·오류·출처·제원 접기·이벤트 resolved (2026-07-12) |
| VD-3 코드 | ✅ charge/doors/trunk · nearby/service/alerts · UI (2026-07-12) |

**추천 다음 단계:** Phase BF 실차 검수 + Telemetry 재연결(새 구독 필드).  
**Phase BF (2026-07-12 코드 완료):** 문/트렁크·인근충전소 고착 수정 — [checklist-tesla-api-bugfix-0712.md](./checklist-tesla-api-bugfix-0712.md)

---

## 13. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-12 | 초안 — display-data·As-Is UI·실차 `LRWYGCFJ7SC214742` DB 대조, 관리자 IA/표현/Phase 정의 |
| 2026-07-12 | **VD-1 구현 완료** — Summary/추론/위치 empty/configSynced/보안 타일/운영 액션 · 체크리스트 추가 |
| 2026-07-12 | **VD-2 구현 완료** — 연동 타임라인·오류 접이·TPMS/공조 출처·제원 접기·이벤트 resolved |
| 2026-07-12 | **VD-3 구현 완료** — Snapshot 확장·nearby/service/alerts·상세 UI |
| 2026-07-12 | 후속 — 실차 표시 고착 Phase BF 링크 |
| 2026-07-12 | **Phase BF 코드 완료** — Telemetry 파서/merge·nearby stale |
