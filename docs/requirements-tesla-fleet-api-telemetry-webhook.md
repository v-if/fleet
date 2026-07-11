# Telemetry + Fleet API 하이브리드 호출 설계 요구사항

## 1. 문서 개요

| 항목 | 내용 |
|------|------|
| 목적 | 차량 **Telemetry(푸시)** 와 FMS **Fleet API(풀)** 를 언제·어떻게 쓸지 **이벤트 주도형 하이브리드**로 정의한다 |
| 질문 | 계정 연동·Virtual Key 이후, 어떤 기준으로 Fleet API vs Telemetry를 호출·수신할 것인가? |
| 관련 문서 | [requirements-tesla-fleet-telemetry.md](./requirements-tesla-fleet-telemetry.md), [requirements-fleet-telemetry.md](./requirements-fleet-telemetry.md), [requirements-tesla-fleet-api-display-data.md](./requirements-tesla-fleet-api-display-data.md), [requirements-tesla-api.md](./requirements-tesla-api.md) |
| 적용 범위 | OAuth 연동 이후 ~ 평시 관제 · ASLEEP/ONLINE 전환 · 수동 fallback |
| 작성일 | 2026-07-11 |

### 1.1 한 줄 원칙 (채택)

> **차량이 잠들어 있을 때(ASLEEP) FMS가 먼저 깨우지 않는다.**  
> **차량이 스스로 깨어 신호를 보낼 때만(Telemetry) 움직이고, Fleet API `vehicle_data`는 “이벤트 시점의 1회 스냅샷”에만 쓴다.**

이 원칙은 법인 플릿의 **Phantom Drain(주차 중 방전)** 과 Tesla **Rate Limit/비용**을 동시에 막는 것이 목적이다.

---

## 2. 초안 분석 (채택 / 수정)

### 2.1 잘 잡힌 점 (채택)

| 초안 내용 | 평가 |
|-----------|------|
| Asleep 시 서버 주도 `wake_up` / `vehicle_data` 금지 | **핵심 원칙으로 채택** |
| 평시 ONLINE은 Telemetry 100%, REST 폴링 0 | 현재 Telemetry primary와 일치 |
| ASLEEP→ONLINE 시 하이브리드 + **쿨다운**으로 `vehicle_data`  sparingly | 비용·배터리 균형에 적합 |
| 최초 1회 Baseline 스냅샷 필요 | 정적 제원·TPMS 등 Telemetry 공백 보완에 필요 |
| 상태 머신으로 호출 분기 | 구현·운영 가독성 좋음 |

### 2.2 수정·보완이 필요한 점

| 초안 | 이슈 | 최종 문서 반영 |
|------|------|----------------|
| “Virtual Key QR 승인 시 Tesla가 FMS 웹훅으로 완료 이벤트를 보낸다” | **공식 Fleet API에 VK 페어링 완료 → 3P 앱 웹훅은 표준이 아님**. 보통 앱/사용자가 페어링 후 FMS가 `fleet_status` 등으로 확인 | **온보딩 트리거를 “VK 준비 완료(감지 또는 사용자 확인)”로 재정의** |
| INIT / ONLINE / ASLEEP만 | 기존 FMS `VehicleStatus`는 `ONLINE/OFFLINE/ASLEEP/WARNING/ALERT` + Telemetry 구독 상태 | **수명주기(Lifecycle)** 와 **운행 상태(Operational)** 를 분리 |
| ASLEEP 판정 15분 | 현재 FMS 기본은 `TESLA_TELEMETRY_STALE_AFTER_SECONDS=300`(5분) | **설정값으로 통일**, 권장 기본 5~15분 범위 |
| Cool-down을 Redis로 조회 | FMS는 Supabase/Prisma 중심, Redis 미도입 | **`VehicleSnapshot.lastRestSyncAt` (또는 VIN별 메타)로 쿨다운** — Redis는 선택 |
| “깨어남 = ONLINE 알림 웹훅” | connectivity 레코드는 Telemetry 서버에서 올 수 있으나, FMS는 현재 **V 레코드 위주** 처리 | **첫 Telemetry V 수신** 또는 **connectivity(구현 시)** 를 wake 신호로 정의 |
| ONLINE 중 Fleet API 전면 0회 | `GET /vehicles`(목록)·`fleet_status`는 `vehicle_data`와 비용·wake 영향이 다름 | **금지 대상은 `vehicle_data`·`wake_up` 자동 호출**. registry sync는 허용(저빈도) |
| VK 직후 차량이 “무조건 깨어 있다” | 페어링 직후라도 asleep일 수 있음 | Baseline은 **가능하면 1회 `vehicle_data`**, 실패 시 Telemetry 대기 + **사용자 명시 wake/fallback만** |

---

## 3. 목표

1. Telemetry를 **동적 데이터의 Source of Truth**로 둔다.
2. Fleet API `vehicle_data`는 **Baseline·갭 보정·수동 복구**에만 사용한다.
3. ASLEEP 구간에서 **자동 wake / 자동 vehicle_data 금지**.
4. 정적 제원(`vehicle_config` 등)은 등록 시 1회 저장 후 Telemetry로 덮지 않는다 — [display-data](./requirements-tesla-fleet-api-display-data.md).
5. 기존 Phase 4.2 구현(Telemetry primary, `?fallback=1`)과 모순 없이 확장한다.

---

## 4. 상태 모델

### 4.1 수명주기 (Lifecycle) — 온보딩

차량·구독이 “관제 준비”가 되었는지. DB는 `TelemetrySubscription` + 플래그/컬럼으로 표현 가능.

| 상태 | 의미 | 진입 조건 (현실적) |
|------|------|-------------------|
| `UNLINKED` | 계정/차량 없음 | — |
| `REGISTERED` | OAuth·`Vehicle` 등록됨, VK/Telemetry 미완 | OAuth callback + registry sync |
| `KEY_PENDING` | VK 페어링 대기 | 사용자에게 QR/페어링 안내 노출 |
| `TELEMETRY_PENDING` | VK 있음 · `fleet_telemetry_config` 미동기 또는 미수신 | config create, `synced` 대기 |
| `READY` | Telemetry 수신 가능 · Baseline 완료(또는 대기 중) | 첫 V 수신 또는 Baseline REST 성공 |

> 초안의 **INIT** ≈ `REGISTERED` ~ `TELEMETRY_PENDING` 구간.

**Virtual Key 완료 감지 (웹훅 대체)**

1. **권장**: 설정 UI에서 사용자가 “키 연결 완료” 확인 → FMS가 `POST fleet_status`로 키/프로토콜 확인 → Telemetry config 등록.
2. **보조**: 주기적(저빈도) `fleet_status`로 `total_number_of_keys` 변화 감지 (자동 wake 아님).
3. Tesla가 향후 공식 pairing webhook을 제공하면 그때 트리거만 교체.

### 4.2 운행 상태 (Operational) — 관제 표시

기존 `VehicleStatus` / `isAsleepInferred`와 정합.

| 상태 | 의미 | 판정 |
|------|------|------|
| `ONLINE` | 깨어 있음 · Telemetry 활성 | 최근 Telemetry 수신 &lt; stale 임계 |
| `ASLEEP` | 취침 추론 | 마지막 Telemetry 이후 **N초** 무신호 (`TESLA_TELEMETRY_STALE_AFTER_SECONDS`, 기본 300, 운영 권장 300~900) |
| `OFFLINE` / `WARNING` / `ALERT` | 기존 규칙 | 배터리 임계·연동 오류 등 |

초안의 ONLINE/ASLEEP는 이 **운행 상태**에 해당한다.

---

## 5. 호출 기준 알고리즘 (최종)

### 5.0 호출 유형 구분

| 호출 | 자동 허용? | 비고 |
|------|:----------:|------|
| Telemetry 수신 (inbound) | ✅ 상시 | 비용·배터리 유리 |
| `GET /vehicles`, `POST fleet_status` | ✅ 저빈도 | registry / 온보딩. 차량 wake와 무관하거나 영향 적음 |
| `GET .../vehicle_data` | ⚠️ **이벤트만** | 본 문서 핵심 제한 대상 |
| `POST .../wake_up` | ❌ 자동 금지 | **사용자 명시 액션** 또는 데모 fallback만 |
| `?fallback=1` full sync | ❌ 자동 금지 | 운영자/설정 화면 수동 |

### 5.1 파이프라인 요약

```
[OAuth] → REGISTERED (registry sync: list + fleet_status)
    → KEY_PENDING (VK QR 안내)
    → VK 준비 확인 → TELEMETRY_PENDING (fleet_telemetry_config)
    → Baseline 시도 (vehicle_data 1회, 차량 online일 때만)
    → READY

[READY + ONLINE]
    → Telemetry만으로 Snapshot 갱신
    → 자동 vehicle_data / wake_up 금지

[ONLINE → ASLEEP]
    → lastTelemetryAt + stale 임계 초과 → ASLEEP 추론
    → 자동 REST/wake 금지

[ASLEEP → ONLINE]
    → Telemetry 재개(첫 V 또는 connectivity) 감지
    → ONLINE 전환
    → Cool-down 검사 후 vehicle_data 0~1회 (하이브리드)
```

### 5.2 1단계 — 온보딩 Baseline (`KEY_PENDING`/`TELEMETRY_PENDING` → `READY`)

| 항목 | 요구사항 |
|------|----------|
| 트리거 | VK 준비 확인 **후** (또는 Telemetry config `synced=true` 직후) |
| 동작 | 가능하면 `GET vehicle_data` **VIN당 1회** → Snapshot + 정적 제원(`Vehicle`) |
| 실패 시 | 차량 asleep 등으로 실패해도 **자동 wake 금지**. UI에 “차량이 깨어 있을 때 재시도 / REST fallback” 안내. Telemetry 첫 수신으로 동적 데이터 채움 |
| 상태 | Baseline 성공 또는 “Telemetry만으로 READY 허용” 정책 중 택1 (권장: Telemetry 수신 시작 = READY, Baseline은 best-effort) |

**초안 대비**: “VK 웹훅”이 아니라 **FMS가 확인한 온보딩 완료 시점**이 트리거.

### 5.3 2단계 — 평시 ONLINE (Telemetry 전용)

| 항목 | 요구사항 |
|------|----------|
| 조건 | Operational = ONLINE |
| 동적 데이터 | **Telemetry webhook만** Snapshot 갱신 |
| `vehicle_data` | **자동 호출 0회** |
| registry | 계정 단위 목록 sync는 허용 (스냅샷 미생성, 기존 registry-only) |
| 이유 | 위치·SoC·충전·기어 등은 Telemetry로 충분. Rate Limit·비용 절감 |

### 5.4 3단계 — ONLINE → ASLEEP

| 항목 | 요구사항 |
|------|----------|
| 조건 | `now - lastTelemetryAt >= TESLA_TELEMETRY_STALE_AFTER_SECONDS` |
| 동작 | `isAsleepInferred=true`, 표시 상태 ASLEEP |
| **절대 금지** | 서버 크론/폴링이 `vehicle_data` 또는 `wake_up`을 호출해 “상태 확인” |
| 허용 | UI 조회(DB만), 사용자 수동 fallback |

초안의 “15분”은 **설정으로 흡수**. 데모는 5분(현행), 법인 배터리 민감 시 10~15분 권장.

### 5.5 4단계 — ASLEEP → ONLINE (하이브리드 + 쿨다운) ★

| 항목 | 요구사항 |
|------|----------|
| 조건 | ASLEEP 이후 **Telemetry 재수신** (첫 `txtype=V` 또는 connectivity→V) |
| 즉시 | Operational = ONLINE, ASLEEP 추론 해제 |
| Cool-down | `lastRestSyncAt`(또는 동등 메타) 기준 **T분 이내**이면 `vehicle_data` **Skip** |
| Cool-down 초과 | `GET vehicle_data` **VIN당 1회** → Snapshot 갭 보정 (odometer·TPMS 등 Telemetry 미포함 필드) |
| T 기본값 | **30분** (`TESLA_REST_WAKE_COOLDOWN_MINUTES`, 설정 가능) |
| 저장소 | **1차: DB `lastRestSyncAt`**. Redis는 스케일아웃 시 선택 |
| 실패 | asleep 재진입·타임아웃 시 재시도 루프 금지. 다음 wake 이벤트까지 대기 |

```
onTelemetryReceived(vin):
  if wasAsleep(vin):
    markOnline(vin)
    if minutesSince(lastRestSyncAt) >= COOLDOWN:
      try vehicle_data once  // no wake_up
      update lastRestSyncAt
    // else: telemetry-only
  else:
    applyTelemetryToSnapshot(vin)
```

### 5.6 예외 — 사람만 깨울 수 있다

| 예외 | 조건 |
|------|------|
| 설정 “REST fallback 동기화” | 운영자 명시 클릭 → `?fallback=1` |
| 상세 “차량 깨우기” (향후) | 사용자 확인 모달 후 `wake_up` → 이어서 `vehicle_data` |
| 데모/장애 복구 | 동일, 감사 로그 필수 |

---

## 6. 데이터 역할 분담

| 데이터 | Source of Truth | REST `vehicle_data` |
|--------|-----------------|---------------------|
| 위치, SoC, 충전, 기어, 잠금, 온도 등 | **Telemetry** | wake 후 갭 보정 시에만 |
| TPMS, 일부 closures 상세 | REST (Telemetry 미매핑 시) | Baseline + cool-down wake sync |
| `car_type`, trim, color | 등록 시 REST 1회 → `Vehicle` | 이후 덮지 않음 |
| 차량 목록·연동 메타 | `GET /vehicles`, `fleet_status` | registry |

---

## 7. 환경변수 · 설정

| 변수 | 기본(안) | 의미 |
|------|----------|------|
| `TESLA_TELEMETRY_ENABLED` | `true` | Telemetry 수신 |
| `TESLA_REST_AUTO_SYNC_ENABLED` | `false` | 주기 full REST 금지 (현행) |
| `TESLA_TELEMETRY_STALE_AFTER_SECONDS` | `300` | ASLEEP 추론 (5~900 권장) |
| `TESLA_REST_WAKE_COOLDOWN_MINUTES` | `30` | ASLEEP→ONLINE 시 `vehicle_data` 쿨다운 (**신규**) |
| `TESLA_BASELINE_ON_READY` | `true` | 온보딩 시 Baseline 1회 시도 (**신규 정책**) |

---

## 8. As-Is → To-Be

| 항목 | As-Is (Phase 4.2) | To-Be (본 문서) |
|------|-------------------|-----------------|
| 평시 동적 데이터 | Telemetry primary | 동일 유지 |
| ASLEEP | stale 초 기반 추론 | 동일 + 자동 wake 금지 명문화 |
| `vehicle_data` 시점 | 수동 fallback 위주 | **온보딩 Baseline + wake 쿨다운 1회** 자동화 |
| VK 완료 | 운영 수동 | 감지/확인 플로우 명시 (웹훅 가정 제거) |
| 쿨다운 저장 | 없음 | `lastRestSyncAt` 활용 |

---

## 9. 비기능 · 리스크

| 리스크 | 대응 |
|--------|------|
| Phantom Drain | 자동 `wake_up`/`vehicle_data` 폴링 금지 |
| Telemetry 공백인데 ONLINE으로 오인 | stale 임계 + connectivity(선택) |
| Baseline 실패로 빈 상세 | UI 안내 + Telemetry 부분 채움 + 수동 fallback |
| Cool-down 중 TPMS 오래됨 | 상세에 “마지막 REST 시각” 표시, 수동 갱신 |
| 다차량 동시 wake sync | VIN 단위 직렬화·rate limit 백오프 |

---

## 10. 구현 체크리스트

> 상세·진척: [checklist-tesla-hybrid-data.md](./checklist-tesla-hybrid-data.md)  
> 스키마: [requirements-tesla-hybrid-data-model.md](./requirements-tesla-hybrid-data-model.md)

- [x] Lifecycle 상태(또는 동등 플래그)와 Operational ASLEEP/ONLINE 문서·코드 정합
- [x] VK/Telemetry ready 트리거 UI·`fleet_status` 확인 경로 — API `POST .../virtual-key/confirm` (UI는 Phase D)
- [x] 온보딩 Baseline `vehicle_data` 1회 (실패 시 wake 금지)
- [x] ASLEEP→ONLINE 시 `lastRestSyncAt` + 쿨다운 후 `vehicle_data` 0~1회
- [x] 자동 `wake_up` 경로 없음 회귀 테스트 — src 검색 0건
- [x] 감사 로그: Baseline / wake-sync / 수동 fallback 구분
- [ ] (선택) Telemetry connectivity → ONLINE 전환 보강
- [x] 설정값 `TESLA_REST_WAKE_COOLDOWN_MINUTES` 추가

---

## 11. 결정 요약

| # | 결정 |
|---|------|
| 1 | **이벤트 주도형 하이브리드** — Telemetry 상시, `vehicle_data`는 온보딩·wake 쿨다운·수동만 |
| 2 | **ASLEEP에서 서버가 먼저 깨우지 않음** |
| 3 | VK 완료는 **웹훅이 아니라 FMS 확인/감지** |
| 4 | 쿨다운은 **DB `lastRestSyncAt`**, 기본 30분 |
| 5 | ASLEEP 임계는 **기존 env**, 운영에서 5~15분 조정 |
| 6 | registry(`vehicles`/`fleet_status`)는 `vehicle_data` 금지와 별개로 저빈도 허용 |

**구현 문서**: [checklist-tesla-hybrid-data.md](./checklist-tesla-hybrid-data.md) · [requirements-tesla-hybrid-data-model.md](./requirements-tesla-hybrid-data-model.md) · development-checklist Phase 4.4

---

## 12. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-11 | 초안(고민·솔루션) 분석 후 최종 요구사항화 — VK 웹훅 가정 수정, Lifecycle/Operational 분리, DB 쿨다운, As-Is 정합 |
| 2026-07-11 | 하이브리드 데이터 모델·Phase 4.4 체크리스트 링크 추가 |
| 2026-07-11 | Phase 4.4.A 스키마·migrate 완료 반영 |
| 2026-07-11 | Phase 4.4.B Sync 로직 반영 — 구현 체크리스트 §10 갱신 |
