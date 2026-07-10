# Tesla Fleet Telemetry 요구사항 정의서

## 1. 문서 개요

| 항목 | 내용 |
|------|------|
| 목적 | 기존 Tesla `vehicle_data` 폴링 구조를 **Fleet Telemetry(스트리밍/웹훅 수신)** 구조로 전환하기 위한 요구사항 정의 |
| 관련 문서 | [requirements.md](./requirements.md), [requirements-tesla-api.md](./requirements-tesla-api.md), [requirements-user-db.md](./requirements-user-db.md), [requirements-log-db.md](./requirements-log-db.md), [development-checklist.md](./development-checklist.md) |
| 적용 범위 | **Phase 4.2** 실시간성·비용 최적화·Telemetry 운영 안정화 |
| 현재 상태 | Phase 4.2 구현 완료 — webhook ingress + 비동기 처리 + ASLEEP 추론 + polling fallback (2026-07-10) |
| Telemetry 서버 | Fly.io `telemetry.bori-fleet.shop` — [requirements-fleet-telemetry-completed.md](./requirements-fleet-telemetry-completed.md) (**실차 V E2E 확인**, UI 리허설·로컬 secret 잔여) |
| FMS Production | `https://bori-fleet.shop` |

---

## 2. 배경

현재 FMS의 Tesla 데이터 수집은 아래 구조를 따른다.

- 프론트 조회 또는 수동 refresh
- `/api/vehicles` 또는 `/api/sync/vehicles`
- Tesla Fleet API REST 호출
  - `GET /api/1/vehicles`
  - `POST /api/1/vehicles/fleet_status`
  - `GET /api/1/vehicles/{vin}/vehicle_data`
  - `GET /api/1/vehicles/{vin}/recent_alerts`

이 방식은 MVP 단계에서는 구현이 단순하지만 다음 한계가 있다.

1. `vehicle_data` 반복 호출 비용이 커질 수 있다.
2. 온라인 차량 상태를 세밀하게 반영하려면 폴링 주기를 짧게 해야 한다.
3. 서버/배포 환경에서 불필요한 OUTBOUND 호출이 누적된다.
4. 차량이 잠들면 응답이 희소해지고, UI 상태 전환이 부자연스러울 수 있다.

Tesla Fleet Telemetry는 온라인 차량이 서버로 데이터를 **푸시**하는 모델이므로, 폴링 대비 더 실시간이고 비용 효율적인 구조로 전환할 수 있다.

---

## 3. 목표

### 3.1 기능 목표

- Tesla Fleet Telemetry 웹훅 수신 endpoint를 제공한다.
- 수신 payload를 **즉시 적재**하고 후속 처리는 비동기로 넘긴다.
- 온라인 차량 상태는 REST 폴링보다 **Telemetry 우선**으로 최신화한다.
- 차량이 `asleep` 상태일 때 텔레메트리 부재를 자연스럽게 해석할 수 있어야 한다.
- 기존 폴링 구조는 **fallback/보조 수단**으로만 유지한다.

### 3.2 운영 목표

- Tesla OUTBOUND REST 호출량을 줄인다.
- 온라인 차량의 상태·위치·배터리 반영 지연을 최소화한다.
- Telemetry 수신 실패/적체/구독 오류를 추적 가능하게 한다.

---

## 4. As-Is / To-Be

### 4.1 As-Is

- 수집 방식: REST Polling
- 최신화 기준: `TESLA_SYNC_POLL_INTERVAL_MINUTES` 기반
- 온라인/오프라인/취침 상태 판단: `vehicle_data` 응답과 마지막 스냅샷 시각 조합
- Telemetry 처리: unlink 시 구독 해제 **stub만 존재**

### 4.2 To-Be

- 수집 방식: Fleet Telemetry 웹훅 수신 + 비동기 후처리
- 최신화 기준: Telemetry 이벤트 기반
- 보조 수단: REST Polling은 초기 목록 동기화, 취침 보정, 오류 복구에 한정
- Telemetry 구독/해제/오류 추적까지 운영 경로 포함

---

## 5. 핵심 요구사항

### 5.1 Telemetry 수신 Endpoint

Tesla 서버가 FMS 백엔드 endpoint로 전송하는 Telemetry payload를 수신해야 한다.

요구사항:

1. 공개 HTTPS endpoint 제공
2. Tesla 송신 요청의 인증/서명/출처 검증 전략 정의
3. 요청 body를 원문 또는 정규화 형태로 저장할 수 있어야 함
4. 대량 이벤트 수신에도 route handler가 짧게 끝나야 함

예상 역할:

- `INBOUND` API 수신
- payload validation
- raw event ingress 저장
- background job enqueue
- 즉시 `200 OK` 반환

### 5.2 즉시 200 응답 + 비동기 처리

Telemetry 수신 endpoint는 Tesla 서버에 지연 없이 응답해야 한다.

요구사항:

1. route handler 내부에서 무거운 DB upsert·집계·후속 계산을 직접 오래 수행하지 않는다.
2. 들어온 payload는 우선 **append-only ingress 테이블/큐**에 적재한다.
3. 스냅샷 반영, 이벤트 생성, 상태 계산은 background worker/job로 넘긴다.
4. 중복 payload 재전송 가능성을 고려해 **idempotency key** 또는 event key 기준 중복 제거 정책이 필요하다.

권장 구조:

1. `/api/tesla/telemetry`
2. request 검증
3. `TelemetryIngress` 저장
4. 처리 상태 `PENDING`
5. worker가 읽어 `VehicleSnapshot`/`VehicleEvent` 반영
6. `PROCESSED` 또는 `FAILED`

### 5.3 취침(Asleep) 상태 전환

Tesla Fleet Telemetry는 차량이 온라인일 때 주로 푸시되며, 차량이 잠들면 이벤트가 오지 않을 수 있다.

요구사항:

1. Telemetry 이벤트가 일정 시간 이상 없을 경우 차량을 자연스럽게 `취침 중(Asleep)` 또는 동등 상태로 해석할 수 있어야 한다.
2. 단순 `OFFLINE`과 `ASLEEP`를 구분할 수 있도록 내부 플래그 또는 파생 상태가 필요하다.
3. UI는 `오프라인`과 `취침 중`을 구분 표기할 수 있어야 한다.
4. 취침 상태에서도 마지막 유효 위치·배터리·스냅샷은 유지해야 한다.

권장 데이터:

- `lastTelemetryAt`
- `lastTelemetryStatus`
- `telemetryStaleAfterSeconds`
- `sleepInferredAt`
- `isAsleepInferred`

### 5.4 폴링과 공존 전략

Telemetry 도입 후에도 REST Polling을 즉시 완전히 제거하지 않는다.

요구사항:

1. 초기 차량 목록 확보용 `GET /api/1/vehicles`는 유지 가능
2. `fleet_status`는 펌웨어·버전·연결성 점검 용도로 제한적 유지 가능
3. `vehicle_data` 고빈도 호출은 중단 또는 최소화
4. Telemetry 공백/실패 시 fallback polling 경로 제공
5. feature flag 또는 provider mode로 단계 전환 가능해야 함

---

## 6. 데이터 모델 요구사항

### 6.1 신규 저장 모델

Telemetry 도입 시 아래와 같은 모델이 필요할 수 있다.

| 모델 | 목적 |
|------|------|
| `TelemetryIngress` | 원본 수신 payload 저장, 재처리, 디버깅 |
| `TelemetryCursor` 또는 유사 메타 | 차량별 마지막 처리 시각/시퀀스 |
| `VehicleSnapshot` 확장 필드 | `lastTelemetryAt`, `isAsleepInferred` 등 |
| `TelemetrySubscription` (선택) | 차량별 구독 상태·설정·오류 추적 |

### 6.2 기존 모델과의 관계

- `Vehicle`는 Telemetry 수신의 기본 단위다.
- `VehicleSnapshot`은 최신 파생 상태를 저장한다.
- `VehicleEvent`는 Telemetry 기반 경고/상태 변화 이벤트를 저장할 수 있다.
- `AuditLog` / `ApiCallLog`는 Telemetry 수신 및 구독 변경 작업 추적에 활용한다.

### 6.3 상태 필드 요구

추가 또는 파생 관리가 필요한 상태:

- `ONLINE`
- `OFFLINE`
- `ASLEEP` 또는 동등 내부 상태
- `lastTelemetryAt`
- `lastRestSyncAt`
- `telemetrySource` / `restSource`

> 현재 enum이 `ONLINE/OFFLINE/WARNING/ALERT`만 가진다면, `ASLEEP`를 enum에 추가할지 파생 상태로만 처리할지 설계 결정이 필요하다.

---

## 7. API / 백엔드 요구사항

### 7.1 수신 API

- Tesla Telemetry webhook endpoint
- 인증/검증 실패 시 명확한 에러 코드
- 성공 시 지연 없이 `200 OK`

### 7.2 백그라운드 처리

- queue 또는 job runner 필요
- 재시도 정책 필요
- poison message/실패 event 격리 필요

### 7.3 운영 API

필요 시 아래 운영용 endpoint 또는 internal job이 필요하다.

- Telemetry 구독 등록
- Telemetry 구독 해제
- Telemetry 최근 오류 조회
- Telemetry ingest 재처리
- Telemetry health check

---

## 8. UI / UX 요구사항

### 8.1 차량 목록/상세/지도

- 온라인 차량은 Telemetry 최신 시각 기준으로 반영
- 데이터 미수신 시간이 길어지면 `취침 중(Asleep)` 표기
- 마지막 Telemetry 수신 시각을 표시할 수 있으면 좋음
- REST polling fallback 상태와 Telemetry 실시간 상태를 혼동하지 않도록 해야 함

### 8.2 설정 화면

- Telemetry 사용 여부
- 최근 수신 시각
- 최근 수신 오류
- 현재 구독 상태

---

## 9. 로그 / 감사 요구사항

Telemetry는 비용·운영 영향이 있으므로 감사 로그 대상이다.

기록 대상:

- Telemetry 수신 성공/실패
- 구독 등록/변경/해제
- 처리 실패 payload
- 중복 수신 discard
- fallback polling 전환

관련 문서: [requirements-log-db.md](./requirements-log-db.md)

---

## 10. 비기능 요구사항

### 10.1 성능

- Tesla webhook 응답은 최대한 짧아야 한다.
- route handler는 대량 payload에서도 빠르게 `200 OK`를 반환해야 한다.
- 후속 처리 지연은 별도 queue/worker에서 흡수해야 한다.

### 10.2 안정성

- 중복 수신에도 idempotent 해야 한다.
- 일시적 장애 시 재처리 가능해야 한다.
- Telemetry 장애 시 polling fallback으로 최소 기능 유지가 가능해야 한다.

### 10.3 비용

- 불필요한 `vehicle_data` polling을 줄여야 한다.
- Telemetry 구독 수를 활성 차량 수와 일치하게 관리해야 한다.
- unlink 시 구독 해제가 누락되면 안 된다.

### 10.4 보안

- 수신 endpoint는 출처 검증이 필요하다.
- payload 저장 시 민감 데이터 보존 범위를 최소화한다.
- 로그에 원문 전체를 무제한 저장하지 않는다.

---

## 11. 범위와 제외

### In Scope

- Telemetry 요구사항 정의
- webhook 수신 구조
- 비동기 처리 구조
- 취침 상태 판단 플래그
- polling fallback 정책

### Out of Scope

- queue 인프라 최종 선정 (현재는 DB ingress + `after()`/internal job)
- Telemetry payload 전체 스키마 정규화 완성
- 실시간 WebSocket UI 반영 고도화
- Vehicle Command Proxy 기반 구독 등록 자동화 (unlink 해제는 구현)

---

## 12. 완료 기준

- [x] Fleet Telemetry 전환 배경과 목표 정의
- [x] webhook 수신 구조 요구사항 정의
- [x] 즉시 `200 OK` + 비동기 처리 요구사항 정의
- [x] `Asleep` 상태 처리 요구사항 정의
- [x] polling fallback 공존 전략 정의
- [x] 데이터 모델/로그/운영 요구사항 정의
- [x] 구현 체크리스트 연결

### 구현 요약 (2026-07-10)

| 항목 | 구현 |
|------|------|
| Webhook | `POST /api/tesla/telemetry` — ingress 저장 후 즉시 `200 OK`, `after()` 비동기 처리 |
| Ingress | `TelemetryIngress` (idempotency key, PENDING→PROCESSED/FAILED/DUPLICATE) |
| 후처리 job | `POST /api/internal/telemetry/process` (cron secret) |
| Snapshot 확장 | `lastTelemetryAt`, `lastRestSyncAt`, `telemetrySource`, `isAsleepInferred`, `sleepInferredAt` |
| 상태 | `VehicleStatus.ASLEEP` enum 추가, Telemetry 공백 시 추론 |
| Polling fallback | Telemetry primary 시 REST 자동 폴링 중지(`TESLA_REST_AUTO_SYNC_ENABLED=false` 기본), 수동 `?fallback=1`만 full REST |
| Registry sync | Telemetry primary에서 `listVehicles`+`fleet_status`만 — **VehicleSnapshot 미생성** |
| 환경변수 | `TESLA_TELEMETRY_ENABLED`, `TESLA_REST_AUTO_SYNC_ENABLED`, `NEXT_PUBLIC_APP_URL`, `TESLA_TELEMETRY_WEBHOOK_SECRET`, `TESLA_PARTNER_TOKEN`(선택) |

---

## 13. 참고 문서

- [Tesla Fleet Telemetry](https://developer.tesla.com/docs/fleet-api/fleet-telemetry)
- [Tesla Fleet Telemetry Available Data](https://developer.tesla.com/docs/fleet-api/fleet-telemetry/available-data)
- [requirements-tesla-api.md](./requirements-tesla-api.md)
- [requirements-user-db.md](./requirements-user-db.md)
- [requirements-log-db.md](./requirements-log-db.md)
- [requirements-fleet-telemetry.md](./requirements-fleet-telemetry.md) — Telemetry 서버 요구사항·§5 계약
- [requirements-fleet-telemetry-completed.md](./requirements-fleet-telemetry-completed.md) — Telemetry 서버 개발 완료·인수인계

---

## 14. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-09 | 초안 메모를 정식 요구사항 문서로 확장 — Fleet Telemetry 전환 배경, webhook/비동기 처리, Asleep 상태, polling fallback 요구사항 정리 |
| 2026-07-10 | Phase 4.2 구현 반영 — ingress/비동기 처리/ASLEEP 추론/polling fallback/unlink 해제/설정 UI |
| 2026-07-10 | Telemetry 서버 연동·커스텀 도메인 반영 — `bori-fleet.shop` / `telemetry.bori-fleet.shop` |
| 2026-07-10 | P0 E2E 실측 — 실차 V→PROCESSED·TELEMETRY 스냅샷 확인 |
| 2026-07-10 | Telemetry primary 운영 — REST 자동 폴링 중지, registry sync, webhook 전용 VehicleSnapshot |