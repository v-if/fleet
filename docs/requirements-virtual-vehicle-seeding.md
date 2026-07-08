# 가상 차량 추가(Seed) 요구사항 정의서

## 1. 문서 개요

| 항목 | 내용 |
|------|------|
| 목적 | Tesla 실연동 차량이 `sleep` 상태이거나 실데이터가 부족한 상황에서도, `/vehicles` 화면에서 **데모용 차량을 즉시 추가**할 수 있는 가상 차량 등록 기능 요구사항 정의 |
| 관련 문서 | [requirements.md](./requirements.md), [requirements-user-db.md](./requirements-user-db.md), [requirements-log-db.md](./requirements-log-db.md), [requirements-tesla-api.md](./requirements-tesla-api.md), [requirements-tesla-fleet-api-sample-response.md](./requirements-tesla-fleet-api-sample-response.md), [development-checklist.md](./development-checklist.md) |
| 적용 범위 | **Phase 4.1** 데모 안정화용 기능. 실제 Tesla OAuth/동기화 흐름과 공존 |
| 구현 상태 | 구현 완료 (2026-07-08) |

---

## 2. 배경

현재 실제 Tesla 계정으로 차량을 연동하더라도, 차량이 `sleep` 상태이거나 일부 API 응답이 비어 있어 화면 시연에 필요한 데이터가 충분히 들어오지 않을 수 있다.

데모데이 및 QA 단계에서는 다음이 필요하다.

1. **실제 Tesla 연동 없이도** 차량 목록에 차량을 빠르게 추가할 수 있어야 한다.
2. 기존 DB 구조(`User → TeslaAccount → Vehicle`)를 그대로 따르면서도 **가상 계정/가상 차량**을 만들 수 있어야 한다.
3. 데이터는 임의 생성하되, **Tesla 공식 API 응답 구조를 근거로 한 값 범위/형식**을 따라야 한다.

따라서 `/vehicles` 화면에 **`차량 추가(가상)`** 버튼을 두고, 버튼 클릭 시 실제 OAuth를 건너뛴 뒤 callback이 돌아온 것처럼 DB에 가상 계정과 차량을 생성하는 기능을 정의한다.

---

## 3. 목표

### 3.1 기능 목표

- `/vehicles` 차량 목록 화면에서 `차량 추가(가상)` 버튼 제공
- 실제 Tesla OAuth/Partner/Register/API 호출 없이 가상 차량 등록
- 기존 실연동과 동일하게 `TeslaAccount` 생성 후 그 하위에 `Vehicle`/`VehicleSnapshot`/필요 시 `VehicleEvent` 생성
- 버튼 1회 클릭 시 **1~5대 랜덤** 생성
- 계정당 차량은 **1:N 관계** 유지

### 3.2 데모 목표

- 실제 차량이 sleep 상태여도 차량 목록/상세/지도/이상 상태 시연 가능
- 실연동과 가상 데이터를 **동일 UI 구조**에서 함께 검증 가능
- 실 API 실패가 있어도 데모 시나리오를 지속할 수 있음

---

## 4. UX 요구사항

### 4.1 차량 목록 화면

대상 화면: `/vehicles`

요구사항:

1. 기존 `차량 추가` 버튼 옆에 **`차량 추가(가상)`** 버튼 추가
2. 버튼 문구는 실제 연동 버튼과 구분 가능해야 함
3. `차량 추가(가상)`은 **실제 Tesla OAuth 화면으로 이동하지 않음**
4. 클릭 즉시 또는 확인 모달 이후, 내부 가상 등록 로직만 수행
5. 등록 완료 후 기존 차량 목록 화면으로 유지되며, 새 차량이 목록에 보여야 함

### 4.2 callback 가정

- 실제 요구 흐름은 “OAuth callback으로 돌아왔다고 가정”
- 하지만 구현상 외부 redirect는 생략 가능
- 핵심은 **callback 이후 DB가 채워진 상태와 동일한 결과**를 만드는 것

---

## 5. 데이터 모델 요구사항

## 5.1 TeslaAccount

가상 차량 추가 시에도 기존 실데이터 구조와 동일하게 `TeslaAccount`를 생성한다.

| 항목 | 요구 |
|------|------|
| `userId` | 현재 로그인한 사용자 |
| `teslaEmail` | 가상 계정용 이메일 랜덤 생성 |
| `accessToken` / `refreshToken` | 실제 토큰이 아니므로 가상용 placeholder 또는 식별 문자열 사용 |
| `scope` | Tesla OAuth 스코프 형식 참고 가능하나, 가상 데이터임을 구분 가능해야 함 |
| `region` | 데모 기본값 (`na`) 사용 가능 |
| `role` | `OWNER` 기본 |
| 구분자 | 필요 시 metadata 또는 email 규칙으로 “가상 계정” 식별 가능해야 함 |

가상 `teslaEmail` 예시:

- `demo-owner-1@virtual.tesla.local`
- `seed-20260708-01@virtual.tesla.local`

> 실제 Tesla 응답에는 `teslaEmail`이 항상 오지 않으므로, 이 기능은 **가상 생성 기능에 한해 명시적 랜덤 값 사용**을 허용한다.

### 5.2 Vehicle

`Vehicle`는 생성된 `TeslaAccount` 하위에 1~5대 랜덤 생성한다.

| 필드 | 요구 |
|------|------|
| `teslaAccountId` | 생성된 가상 `TeslaAccount.id` 참조 |
| `oemVehicleId` | Tesla `vehicle_id` 또는 `vin` 성격의 랜덤 OEM 식별자 |
| `plateNumber` | 한국 차량번호 형식 또는 Tesla 식별명 기반 랜덤 생성 |
| `model` | Tesla 모델 계열 랜덤 (`Model 3`, `Model Y` 등) |
| `year` | 최근 연식 범위 내 랜덤 |

### 5.3 VehicleSnapshot

가상 Snapshot 값은 Tesla 공식 응답 샘플 문서의 필드에 맞춰 생성한다.

우선 채워야 할 항목:

- `batteryPercent`
- `rangeKm`
- `chargingStatus`
- `status`
- `latitude` / `longitude`
- `odometerKm`
- `locked`
- `doorsOpen`
- `windowsOpen`
- `insideTempC`
- `outsideTempC`
- `climateOn`
- `tpmsFrontLeft`
- `tpmsFrontRight`
- `tpmsRearLeft`
- `tpmsRearRight`
- `sentryMode`
- `softwareVersion`

선택 항목:

- `serviceStatus`
- `nearbyChargingSites`

### 5.4 VehicleEvent

필수는 아니지만, 상세 화면/이상 상태 시연을 위해 최근 경고 이벤트를 0~2개 랜덤 생성할 수 있다.

예시:

- 배터리 부족
- 창문 열림
- 오프라인
- TPMS 경고

---

## 6. 샘플 응답 기반 생성 원칙

기준 문서: [requirements-tesla-fleet-api-sample-response.md](./requirements-tesla-fleet-api-sample-response.md)

### 6.1 `GET /api/1/vehicles` 기반

가상 차량의 기본 메타는 아래 성격을 따른다.

- `vin`
- `vehicle_id`
- `display_name`
- `state`
- `access_type`
- `in_service`

### 6.2 `GET /api/1/vehicles/{vin}/vehicle_data` 기반

실제 랜덤 값은 아래 응답 블록의 구조/범위에 맞춰 생성한다.

| 응답 블록 | 사용 예 |
|----------|---------|
| `charge_state` | 배터리 %, 충전 상태, 주행 가능 거리 |
| `climate_state` | 실내/실외 온도, 공조 여부 |
| `drive_state` | 위도/경도, shift_state |
| `vehicle_config` | 차종, trim, 색상 |
| `vehicle_state` | 잠금, 문/창문, odometer, sentry, TPMS, SW 버전 |

### 6.3 `recent_alerts` 기반

가상 이벤트 메시지는 `recent_alerts.response.recent_alerts[]` 형식을 따른다.

- `name`
- `time`
- `user_text`

---

## 7. 랜덤 생성 규칙

### 7.1 생성 수

- 버튼 1회 클릭 시 **1~5대 랜덤**
- 모든 차량은 **동일 가상 TeslaAccount**에 속함

### 7.2 모델 랜덤 범위

예시:

- Tesla Model 3
- Tesla Model Y

필요 시 향후 확장:

- Model S
- Model X

### 7.3 상태 랜덤 범위

예시:

- `ONLINE`
- `OFFLINE`
- `WARNING`
- `ALERT`

충전 상태 예시:

- `CHARGING`
- `COMPLETE`
- `DISCONNECTED`
- `STOPPED`

### 7.4 배터리/거리/위치/TPMS

예시 범위:

- 배터리: `10 ~ 95`
- 주행가능거리: 배터리와 비례한 적정 범위
- 위치: 한국 시연 기준 유효 좌표 범위
- TPMS: 정상값 중심 + 일부 낮은 값 허용

### 7.5 이상 상태 시연용 분포

모든 차량이 정상만 나오지 않도록 일부는 아래 조합을 포함할 수 있어야 한다.

- 저배터리
- 오프라인
- 문 열림
- 잠금 해제
- TPMS 낮음
- 센트리 모드 활성

---

## 8. 실연동과의 관계

### 8.1 공존 원칙

- `차량 추가` = 실제 Tesla OAuth 연동
- `차량 추가(가상)` = 실연동 skip + 가상 계정/차량 생성

### 8.2 데이터 출처 구분

가상 차량은 운영상 혼동을 줄이기 위해, 최소한 내부적으로 출처 구분이 가능해야 한다.

권장 방식:

1. `TeslaAccount.teslaEmail`에 가상 도메인 사용
2. `Vehicle.oemVehicleId` 또는 metadata 패턴으로 구분
3. 추후 UI 배지(`가상`, `Demo`) 추가 가능성 열어두기

### 8.3 동기화 정책

가상 차량은 실제 Tesla sync 대상이 아니므로:

- 자동 sync 시 overwrite되면 안 됨
- 실 API 누락 VIN soft unlink 대상에서 제외하거나
- 가상 차량 계정은 별도 분기 처리해야 함

구현 결정(2026-07-08):

- 가상 `TeslaAccount`는 `@virtual.tesla.local` 이메일과 `virtual ...` scope 패턴으로 식별
- 실제 Tesla OAuth/status/sync 경로는 가상 계정을 제외한 실계정만 조회
- 실동기화 이벤트 치환/soft unlink는 현재 동기화 중인 실 TeslaAccount 범위로 한정

---

## 9. 감사 로그 요구사항

`차량 추가(가상)`도 민감한 등록 행위이므로 감사 로그 대상이다.

최소 기록:

- 누가 생성했는지 (`actorUserId`)
- 몇 대 생성했는지
- 어떤 가상 TeslaAccount를 만들었는지
- 생성된 Vehicle ID 목록
- 성공/실패 여부

관련 문서: [requirements-log-db.md](./requirements-log-db.md)

---

## 10. 비기능 요구사항

### 10.1 성능

- 버튼 클릭 후 수 초 내 등록 완료
- 1~5대 생성은 단일 트랜잭션 또는 일관된 처리로 보장

### 10.2 정합성

- 생성 중 일부만 들어가는 반쪽 상태를 피해야 함
- `TeslaAccount`만 생기고 `Vehicle`이 없는 상태는 예외적으로만 허용
- Vercel/Supabase pooler 환경에서는 장시간 interactive transaction(`$transaction(async (tx) => ...)`) 의존을 피하고, nested write 또는 짧은 쿼리 단위로 구성해야 함

### 10.3 보안

- 실제 Tesla 토큰/API 호출은 발생하지 않아야 함
- 가상 데이터 생성 API는 로그인 사용자만 호출 가능해야 함

### 10.4 데모 안정성

- sleep 상태 차량이 없어도 목록/상세/지도/배터리/경고 시연이 가능해야 함

---

## 11. 완료 기준

- [x] `/vehicles`에 `차량 추가(가상)` 요구사항 정의
- [x] 실제 Tesla OAuth skip 정책 정의
- [x] `TeslaAccount` 1:N `Vehicle` 생성 요구사항 정의
- [x] Tesla 공식 샘플 응답 기반 랜덤 필드 정의
- [x] 1~5대 랜덤 생성 규칙 정의
- [x] 감사 로그 대상 포함
- [x] Prisma/서비스/API/UI 구현

---

## 12. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-08 | 초안 작성 — sleep 상태 대안으로 가상 차량 추가 요구사항 정리 |
| 2026-07-08 | 구현 반영 — `/api/vehicles/virtual`, UI 버튼, 랜덤 시드/감사 로그/sync guard 정책 확정 |
| 2026-07-08 | 배포 보정 — Vercel `Transaction not found` 대응을 위해 interactive transaction 제거, nested create 기반으로 변경 |
