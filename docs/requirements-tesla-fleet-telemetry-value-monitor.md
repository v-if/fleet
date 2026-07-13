# Telemetry Value Monitor — 개발용 검증 UI 요구사항

| 항목 | 내용 |
|------|------|
| 목적 | 개발 단계에서 Telemetry 수신·매핑·출처를 차량 상세에서 바로 검증 |
| 적용 화면 | `FleetVehicleDetailView` (`/vehicles/[id]`) |
| 관련 | [requirements-tesla-fleet-telemetry.md](./requirements-tesla-fleet-telemetry.md), `TelemetryIngress.payload` |
| 상태 | **요구1 구현 완료** · 요구2 미착수 |
| 작성일 | 2026-07-13 |

---

## 요구사항1 — Telemetry payload 모니터

실시간 Telemetry 데이터를 프론트 차량상세 화면에서 payload 출력.  
이유는 **개발 단계 데이터 검증**.

위치: 「실시간 차량 정보」카드 **위**, 분할하지 않고 **카드 형태**.

### 원문 → 표시 예

(원문 json)

```json
payload: {"vin": "LRWYGCFJ7SC214742", "data": {"Gear": {"stringValue": "ShiftStateD"}}, "createdAt": "2026-07-13T01:24:04.000Z"}
```

(표시 예)

```text
07-13 10:24:04 Gear ShiftStateD
```

(원문 json)

```json
{"vin": "LRWYGCFJ7SC214742", "data": {"Locked": {"booleanValue": true}}, "createdAt": "2026-07-13T01:24:07.000Z"}
```

(표시 예)

```text
07-13 10:24:07 Locked true
```

(최종 예시) 최근 순 20개 표시

```text
07-13 10:24:20 ...
07-13 10:24:15 ...
07-13 10:24:10 ...
07-13 10:24:07 Locked true
07-13 10:24:04 Gear ShiftStateD
```

---

## 요구사항2 — 필드값 출처 색상

차량상세 화면의 데이터 필드가

- **REST 조회**로 채운 값인지
- **Telemetry**로 받은 실시간 값인지

를 value 출력 시 구분:

| 출처 | 글자색 |
|------|--------|
| REST 조회 | 파란색 |
| Telemetry | 빨간색 |

이것도 **개발 데이터 검증**용.  
더 좋은 의견 있으면 작성 (→ 아래 §의견).

---

## 의견·권고 (AI)

### 1. 총평

| 요구 | 판정 | 한 줄 |
|------|------|------|
| **요구1** payload 모니터 | **채택** | 이미 `TelemetryIngress`에 원문이 있으므로 조회 UI만으로 “들어왔는지”를 가장 빠르게 확인 가능 |
| **요구2** REST/Telemetry 색상 | **조건부 채택** | 취지는 좋음. 다만 현재 DB는 **스냅샷 단위** `telemetrySource`(TELEMETRY/REST/MIXED)만 있고 **필드별 출처는 없음** → MVP는 근사치, 정밀 검증은 스키마 확장 또는 모니터(요구1)와 병행 |

둘 다 **개발/검증 전용**이어야 하며, UX2(1차 화면 기술 용어·개발자 UI 금지)와 충돌하므로 프로덕션 관리자 기본 화면에는 넣지 않는 것을 권한다.

---

### 2. 요구1에 대한 의견

**방향 타당.** 실차 E2E·구독 필드·매퍼 버그를 가를 때 Snapshot만 보면 “반영 실패 vs 미수신”이 섞인다. Ingress 원문을 같은 화면에 두면 분리가 쉽다.

| 항목 | 권고 |
|------|------|
| 데이터 소스 | **`TelemetryIngress`** (해당 VIN/`vehicleId`, 최신순). `ApiCallLog`에는 차량 payload 원문이 없고 webhook 요약·응답만 있음 |
| 배치 | 원안 동의 — 「실시간 차량 정보」**위** full-width 카드. 2열(상황\|위치)과 시각 분리 |
| 타이틀 | 예: 「Telemetry 수신 로그 (개발)」 — 운영 지표로 오해 방지 |
| 노출 | feature flag / `NODE_ENV` / admin 전용. **프로덕션 기본 OFF** (VIN·위치 등 민감) |
| UX | 기본 **접힘**(`details`) 권장 — 평소 스크롤 비용↓ |
| 시각 | 원문 `createdAt` UTC → 표시 **Asia/Seoul** `MM-DD HH:mm:ss` (**확정·구현**) |
| “최근 N개” | **확정·구현:** 최근 ingress를 읽어 `data`를 **필드별 1줄로 펼친 뒤 최대 20줄** (ingress는 최대 40건 조회) |
| typed value | `stringValue` / `booleanValue` / `doubleValue` 등 **평문** · location 요약 (**구현**) |
| 노출 flag | `NEXT_PUBLIC_TELEMETRY_VALUE_MONITOR` / `TELEMETRY_VALUE_MONITOR` — true/1 ON, false/0 OFF, **미설정 시 non-production만 ON** |
| 구현 | `value-monitor.ts` · `getVehicleDetail.telemetryValueMonitor` · `TelemetryValueMonitorCard` (기본 접힘) |

**수용 기준 (요구1)**

- [x] 모니터에 `시각 + 필드 + 값` 최신순 (코드)
- [x] 소스 `TelemetryIngress` (코드)
- [x] flag OFF 시 카드·DTO 필드 미노출 (코드)
- [x] typed value 평문 (코드)
- [ ] 실차 VIN 수신 후 UI 대조 검수

---

### 3. 요구2에 대한 의견

**검증 목적에는 동의.** “파란/빨강”은 한눈에 REST 유산 vs 실시간 반영을 가르는 데 직관적이다.  
다만 **구현 난이도·정확도**를 요구사항에 미리 적는 것이 좋다.

#### 3.1 As-Is 제약

- `VehicleSnapshot.telemetrySource`는 스냅샷 **전체** 태그(TELEMETRY / REST / MIXED).
- TPMS·공조 등은 이미 「마지막 상세 조회 / 실시간」 **문구 힌트**가 있음 (필드별 색은 아님).
- merge 정책상 일부 필드는 Telemetry 수신 후에도 **이전 REST 값 유지** → 스냅샷 소스가 TELEMETRY여도 개별 값은 REST일 수 있음.  
  → **글자색만으로 “이 숫자 = Telemetry”라고 단정하면 오탐** 가능.

#### 3.2 권고 단계

| 단계 | 내용 | 평가 |
|------|------|------|
| **A. MVP (권고 착수)** | 스냅샷 `telemetrySource`로 **카드/섹션 단위** 톤 구분, 또는 기존 출처 문구를 더 눈에 띄게. 전 필드 개별 색은 보류 | 빠름, 오탐 적음 |
| **B. 개발 모드 근사** | `lastTelemetryAt` vs `lastRestSyncAt`·필드군(위치/SOC 등 Telemetry 가능군 vs nearby/service 등 REST-only) 휴리스틱으로 색 | 중간, 문서에 “근사” 명시 |
| **C. 정밀 (후속)** | 필드별 `*Source` 또는 JSON provenance 맵을 Snapshot/DTO에 저장 후 색칠 | 정확, 스키마·merge 변경 큼 |

원안(모든 value 파란/빨강)은 **C에 가깝다.** 개발 검증만이면 **요구1(모니터) + A/B**로 대부분 충분하고, C는 BF 계열 고착 이슈를 필드 단위로 추적할 때 검토.

#### 3.3 색·접근성

| 항목 | 권고 |
|------|------|
| 빨강/파랑만 | 색맹·다크모드에서 약함. **색 + 접미사/아이콘**(예: `·T` / `·R`) 병행 |
| 빨강 | 운영 UI에서 “오류”로 읽히기 쉬움. 개발 모드에서는 OK이나, 범례를 카드에 고정: `파랑=REST · 빨강=Telemetry` |
| UX2 본문 | 개발 flag OFF 시 **색 구분 없음**(현재 업무 카피만) |

#### 3.4 더 나은 대안 (요구2 보완)

1. **요구1과 연계:** 모니터에 방금 들어온 필드명 하이라이트 → Snapshot 같은 필드가 갱신됐는지 눈으로 대조 (색칠보다 원인 추적에 강함).
2. **섹션 배지:** 「실시간 차량 정보」헤더에 `실시간`/`상세조회`/`혼합` 한 줄 (기존 freshness와 통일).
3. **툴팁:** 값 hover 시 `출처 · 시각` (색만보다 정보량↑, 접근성↑).

**수용 기준(제안, MVP=A)**

- [ ] 개발 모드에서 REST-only 구간과 Telemetry 갱신 구간이 **범례와 함께** 구분됨
- [ ] flag OFF 시 일반 상세와 동일(색 특수 규칙 없음)
- [ ] (C 채택 시) 필드별 출처가 merge 후에도 실제 마지막 쓰기 경로와 일치

---

### 4. 구현 시 공통 주의

- 요구1: 상세 `GET /api/vehicles/[id]`에 `telemetryValueMonitor` 포함 (flag ON 시). Snapshot만으로 raw 재구성하지 않음.
- 폴링: 기존 상세 refresh 주기면 충분. 고주기 단독 폴링 비권장.
- 요구2 착수 시 동일 flag 재사용 권장.

---

### 5. 결론

| 항목 | 판정 |
|------|------|
| 요구1 목적·배치·표시 포맷 | **채택 · 구현 완료** |
| 요구1 데이터 | **`TelemetryIngress.payload`** |
| 요구1 “N개”·다필드·KST | **펼친 줄 20 · KST · 구현** |
| 요구2 색 구분 취지 | **채택(개발 전용) · 미착수** |
| 요구2 전 필드 정확 색 | **후속(C)** — MVP는 섹션/휴리스틱(A/B) + 요구1 |
| 프로덕션 상시 노출 | **비권고** — flag/역할 제한 |

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-13 | 초안 — 요구1(payload 모니터) · 요구2(출처 색상) |
| 2026-07-13 | 의견·권고 추가 (데이터 소스·다필드·필드별 출처 제약·MVP 단계) |
| 2026-07-13 | **요구1 구현** — Ingress 모니터 카드 · flag · 펼친 줄 10 · KST |
| 2026-07-13 | 모니터 표시 상한 10→**20줄** |
