# Phase 4.4 → Fleet Telemetry 서버 전달 사항

> **작성일**: 2026-07-11  
> **대상**: `fleet-telemetry` (Fly.io `bori-telemetry`) 담당 · FMS 연동 담당  
> **결론 한 줄**: Phase 4.4는 **FMS 전용** 작업이다. Telemetry 서버 **코드·배포·secrets 변경은 없다.**  
> 다만 FMS가 V 수신 후 동작이 바뀌었으므로, 아래 **인지 사항·선택 과제**를 Telemetry 측에 전달한다.

---

## 1. 요약

| 구분 | Phase 4.4에서 |
|------|----------------|
| Telemetry 서버 배포 | **불필요** |
| Fly secrets / env 변경 | **없음** |
| FMS webhook URL·인증 | **변경 없음** (`POST /api/tesla/telemetry`, Bearer 동일) |
| V 레코드 payload 계약 (§5) | **변경 없음** |
| allowlist (`/api/internal/telemetry/status`) | **호환** — 응답에 SyncState 필드가 **추가**됨(하위 호환) |
| FMS 측 신규 동작 | ASLEEP 이후 **첫 V** 수신 시 쿨다운 검사 후 Fleet API `vehicle_data` 0~1회 |

---

## 2. 왜 Telemetry 배포가 없는가

Phase 4.4 범위는 FMS의 **하이브리드 데이터 모델·Sync·API·UI**이다.

| 레이어 | 담당 | Phase 4.4 |
|--------|------|-----------|
| mTLS 수신 · protobuf · relay | Telemetry 서버 | 미변경 |
| webhook ingress · Snapshot | FMS | 유지 (제원 미갱신 명시) |
| Baseline / wake 쿨다운 REST | FMS (Fleet API) | **신규** |
| Vehicle 제원 · VehicleSyncState | FMS DB | **신규** |

Tesla → `telemetry.bori-fleet.shop` → FMS webhook 경로는 Phase 4.2/4.3과 동일하다.

---

## 3. Telemetry 측에 전달할 인지 사항 (필수 아님 · 운영 이해용)

### 3.1 FMS가 V를 받은 뒤 하는 일 (변경점)

```
[기존] V → Snapshot merge → (stale 시 ASLEEP 추론)
[4.4]  V → Snapshot merge
       → 직전 Snapshot이 ASLEEP/추론취침이면 lastWakeDetectedAt 기록
       → SyncState.lastRestSyncAt 기준 쿨다운(기본 30분) 경과 시
            FMS가 Tesla Fleet API vehicle_data 1회 호출 (wake_up 없음)
```

**Telemetry 서버 영향**: 없음. 다만 실차 wake 직후 FMS 로그에 `VEHICLE_WAKE_REST_SYNC` / outbound `vehicle_data`가 보일 수 있다.  
이는 **FMS→Tesla** 호출이며 Telemetry relay와 무관하다.

### 3.2 제원(정적 데이터)은 Telemetry로 오지 않음

`car_type` / trim / color 등은 FMS가 **Baseline REST**로만 Vehicle에 저장한다.  
Telemetry V payload에 제원이 실려 와도 FMS는 **Vehicle 제원 컬럼을 갱신하지 않는다.**

### 3.3 allowlist status 응답 확장 (하위 호환)

`GET /api/internal/telemetry/status` 의 `vehicles.items[]`에 필드가 **추가**되었다.

| 필드 | 비고 |
|------|------|
| 기존 `id`, `plateNumber`, `vin`, `latestTelemetryAt`, `telemetrySource` | 유지 |
| 추가 `lifecycle`, `lastRestSyncAt`, `carType`, … | Telemetry allowlist는 **VIN만** 쓰면 됨 |

**Telemetry 조치**: 없음. VIN 캐시 로직 변경 불필요.

### 3.4 unlink

FMS unlink 시 Telemetry 구독 해제(기존) + SyncState 삭제(신규).  
allowlist에서 VIN이 빠지는 타이밍은 기존과 동일(최대 refresh 주기).

---

## 4. Telemetry 서버 선택 과제 (Phase 4.4 비범위 · 향후)

하이브리드 설계서([telemetry-webhook](./requirements-tesla-fleet-api-telemetry-webhook.md))는 wake 신호로 **첫 V** 또는 **connectivity**를 허용한다.

| 현재 (Telemetry As-Is) | 향후 선택 |
|------------------------|-----------|
| **connectivity 등 비-V는 transform에서 skip** — FMS로 미전송 ([completed §5.2](./requirements-fleet-telemetry-completed.md)) | connectivity(또는 동등)를 FMS로 relay하면 ASLEEP→ONLINE 감지를 V보다 빨리 할 수 있음 |
| FMS는 V만으로 wake 감지 | FMS processor에 connectivity 분기 추가 필요(별도 작업) |

**지금 당장 구현 요청은 하지 않는다.** Phase 4.4는 V 기반 wake로 완료되었다.

---

## 5. 계약 체크리스트 (Telemetry 담당 확인용)

복사해 `fleet-telemetry` README/이슈에 붙여도 된다.

```
[ ] Phase 4.4 — Telemetry 코드/배포 변경 없음 확인
[ ] FMS_WEBHOOK_URL / FMS_WEBHOOK_SECRET 변경 없음 확인
[ ] V payload §5 계약 유지 확인
[ ] (인지) FMS가 wake 후 vehicle_data를 쿨다운 단위로 호출할 수 있음
[ ] (선택·보류) connectivity → FMS relay 검토
```

---

## 6. 관련 문서

| 문서 | 용도 |
|------|------|
| [checklist-tesla-hybrid-data.md](./checklist-tesla-hybrid-data.md) | Phase 4.4 A~E 완료 체크리스트 |
| [requirements-tesla-hybrid-data-model.md](./requirements-tesla-hybrid-data-model.md) | FMS 스키마·쓰기 경로 |
| [requirements-tesla-fleet-api-telemetry-webhook.md](./requirements-tesla-fleet-api-telemetry-webhook.md) | 하이브리드 호출 정책 |
| [requirements-fleet-telemetry-completed.md](./requirements-fleet-telemetry-completed.md) | Telemetry 서버 As-Is · §5 계약 |
| [setup-guide.md](./setup-guide.md) §5.4.2 | FMS 온보딩·env |

---

## 7. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-11 | 초안 — Phase 4.4는 FMS 전용, Telemetry 배포 불필요·인지/선택 과제 정리 |
