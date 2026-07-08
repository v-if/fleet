# API 로그·감사 DB 요구사항 정의서

## 1. 문서 개요

| 항목 | 내용 |
|------|------|
| 목적 | Tesla Fleet API 및 FMS 내부 API의 **민감 요청/응답 이력**을 저장해 감사(audit), 추적(trace), 장애 분석을 가능하게 하는 로그 요구사항 정의 |
| 관련 문서 | [requirements.md](./requirements.md), [requirements-db.md](./requirements-db.md), [requirements-user-db.md](./requirements-user-db.md), [requirements-tesla-api.md](./requirements-tesla-api.md), [development-checklist.md](./development-checklist.md) |
| 적용 범위 | **Phase 4 안정화 이후 P0/P1**. 우선은 쓰기·변경·삭제·제어성 요청 중심, 조회성 API는 선택 기록 |
| 구현 상태 | **Phase 4 P0 1차 구현 완료** — Prisma 스키마·마이그레이션, Tesla outbound/FMS 변경 API 로그 적재, 민감정보 마스킹 (2026-07-08) |

---

## 2. 배경·목표

FMS는 차량 등록, 연동 해제, Tesla OAuth 연결, 향후 원격 제어 등 **민감한 작업**을 수행한다.  
문제 발생 시 아래 질문에 답할 수 있어야 한다.

1. **누가** 요청했는가
2. **언제** 요청했는가
3. **어떤 차량/계정**에 대해 요청했는가
4. **어떤 API**를 호출했는가
5. **요청/응답 결과**가 무엇이었는가
6. 실패했다면 **어떤 에러**였는가

따라서 본 문서는 단순 디버그 로그가 아니라, **감사 추적용 구조화 로그**를 DB에 저장하는 것을 목표로 한다.

---

## 3. 기록 대상 범위

### 3.1 우선 기록 대상 (P0)

| 구분 | 설명 | 예시 |
|------|------|------|
| Tesla 외부 API 호출 | FMS 서버가 Tesla Fleet API에 호출한 Request/Response | OAuth token 교환, `/api/1/vehicles`, `vehicle_data`, 향후 command API |
| FMS 내부 변경 API | FMS 사용자가 실행한 등록/수정/삭제/연동/해제 요청 | 로그인, 차량 동기화, 차량 unlink, Tesla 연결/해제 |
| 보안·권한 이벤트 | 인증/인가/실패 관련 행위 | 로그인 성공/실패, 세션 만료, 권한 없음 |

### 3.2 선택 기록 대상 (P1)

| 구분 | 설명 |
|------|------|
| FMS 내부 조회 API | `/api/vehicles`, `/api/vehicles/[id]` 등 조회 API |
| 배치/자동 동기화 | Cron, poller, 백그라운드 sync |
| Telemetry/제어 API | 향후 원격 제어, 구독 해제, 파트너 등록 관련 작업 |

### 3.3 비대상 또는 축소 대상

- 정적 파일, 단순 헬스체크, CSS/이미지 요청
- 민감 정보가 큰 의미 없이 중복되는 단순 성공 GET 요청
- 바이너리 응답 전체 본문
- Access Token / Refresh Token / 세션 서명 / 쿠키 원문

> 원칙: **모든 통신을 무조건 저장**하는 것보다, 감사 가치가 높은 이벤트를 우선 구조화 저장한다.

---

## 4. 핵심 비즈니스 요구사항

1. **추적성**: 차량 등록/해제/제어 등 민감 작업에 대해 사용자·차량·TeslaAccount 단위로 역추적 가능해야 한다.
2. **감사성**: 나중에 “왜/누가/무엇을” 했는지 확인할 수 있어야 한다.
3. **장애 분석성**: Tesla API 실패, timeout, 4xx/5xx 응답을 원인 분석에 사용할 수 있어야 한다.
4. **보안성**: 로그 테이블이 오히려 토큰/개인정보 유출 지점이 되면 안 된다.
5. **성능성**: 운영 요청 처리보다 로그 적재가 병목이 되면 안 된다.

---

## 5. 저장 모델 제안

DB에는 **2계층 구조**를 권장한다.

### 5.1 AuditLog (업무/사용자 행위 중심)

사용자 행위와 비즈니스 이벤트를 기록하는 **상위 감사 로그**다.

| 필드(안) | 타입 | 필수 | 설명 |
|----------|------|:---:|------|
| `id` | String/UUID | ✅ | PK |
| `occurredAt` | DateTime | ✅ | 이벤트 시각 |
| `actorUserId` | String? | | 요청 수행 FMS 사용자 |
| `actorEmail` | String? | | 조회 편의용 이메일 스냅샷 |
| `action` | String | ✅ | 예: `TESLA_CONNECT`, `VEHICLE_UNLINK`, `SYNC_VEHICLES` |
| `targetType` | String? | | `TeslaAccount`, `Vehicle`, `Session`, `System` |
| `targetId` | String? | | 대상 PK |
| `vehicleId` | String? | | 관련 차량 |
| `teslaAccountId` | String? | | 관련 TeslaAccount |
| `requestId` | String? | | HTTP 요청 상관관계 ID |
| `status` | String | ✅ | `SUCCESS`, `FAILURE`, `DENIED` |
| `summary` | String | ✅ | 사람이 읽을 짧은 설명 |
| `metadata` | Json | | 추가 문맥(변경 전후 일부, 필터링된 payload 등) |
| `createdAt` | DateTime | ✅ | 저장 시각 |

### 5.2 ApiCallLog (실제 HTTP 통신 중심)

외부 Tesla API 또는 FMS 내부 API의 Request/Response 단위를 기록하는 **하위 상세 로그**다.

| 필드(안) | 타입 | 필수 | 설명 |
|----------|------|:---:|------|
| `id` | String/UUID | ✅ | PK |
| `occurredAt` | DateTime | ✅ | 호출 시작 시각 |
| `direction` | Enum | ✅ | `OUTBOUND`(Tesla로 나감), `INBOUND`(FMS로 들어옴) |
| `system` | Enum/String | ✅ | `TESLA`, `FMS`, `SUPABASE`, `INTERNAL_JOB` |
| `requestId` | String? | | 상관관계 ID |
| `auditLogId` | String? | | 연관 상위 감사 로그 FK |
| `actorUserId` | String? | | 세션 사용자 |
| `teslaAccountId` | String? | | 관련 TeslaAccount |
| `vehicleId` | String? | | 관련 차량 |
| `method` | String | ✅ | `GET`, `POST`, `DELETE` 등 |
| `url` | String | ✅ | 전체 URL 또는 path |
| `path` | String? | | 집계용 path |
| `statusCode` | Int? | | 응답 상태 |
| `success` | Boolean | ✅ | 성공 여부 |
| `durationMs` | Int? | | 응답 시간 |
| `requestHeaders` | Json? | | 필터링/마스킹 후 저장 |
| `requestBody` | Json/Text? | | 마스킹 후 저장 |
| `responseHeaders` | Json? | | 필요 시 선택 저장 |
| `responseBody` | Json/Text? | | 마스킹/크기 제한 후 저장 |
| `errorCode` | String? | | 내부 에러 코드/외부 에러 코드 |
| `errorMessage` | String? | | 실패 메시지 |
| `createdAt` | DateTime | ✅ | 저장 시각 |

### 5.3 권장 관계

```text
User 1 --- N AuditLog
AuditLog 1 --- N ApiCallLog
TeslaAccount 1 --- N AuditLog / ApiCallLog
Vehicle 1 --- N AuditLog / ApiCallLog
```

> 핵심: “사용자 행위”와 “실제 API 통신”을 분리하면 조회성과 보안 통제가 좋아진다.

---

## 6. 로그 정책

### 6.1 반드시 남겨야 하는 로그

| 이벤트 | 레벨 |
|--------|------|
| 로그인 성공/실패 | AuditLog |
| Tesla OAuth 시작/callback 성공/실패 | AuditLog + ApiCallLog |
| 차량 동기화 시작/성공/실패 | AuditLog + ApiCallLog |
| 차량 unlink | AuditLog |
| 향후 원격 제어 명령 | AuditLog + ApiCallLog |
| Tesla API 4xx/5xx | ApiCallLog |

### 6.1.1 로그 시각 저장 정책

`AuditLog.occurredAt`, `ApiCallLog.occurredAt`, `createdAt` 계열 컬럼은 **PostgreSQL `timestamptz(3)`** 로 저장한다.

원칙:

- DB 저장 시각과 UI 표시 시각이 9시간 어긋나 보이지 않도록 DB timezone은 `Asia/Seoul` 기준으로 운영한다.
- 단, 의미적으로는 "한국 시계값 문자열"이 아니라 **절대 시각이 보존된 timezone-aware 값**이어야 한다.
- 장애 분석 시 DB 콘솔, Prisma 조회 결과, UI `ko-KR` 렌더링이 모두 같은 시점을 가리켜야 한다.

### 6.2 본문 저장 원칙

| 항목 | 정책 |
|------|------|
| Request/Response Body | JSON이면 구조 그대로 저장 가능, 단 민감 필드 마스킹 필수 |
| 대용량 응답 | 전부 저장하지 말고 크기 제한 또는 요약 저장 |
| Token/Cookie | 원문 저장 금지 |
| 비밀번호 | 원문 저장 금지 |
| 위치정보 | 감사상 필요하면 저장 가능하나 최소 범위 원칙 적용 |

### 6.3 마스킹 대상

- `Authorization`
- `access_token`
- `refresh_token`
- `id_token`
- `password`
- `cookie`
- `set-cookie`
- 세션 서명값

마스킹 예시:

```text
Bearer eyJ...abc  ->  Bearer [REDACTED]
password=0000     ->  password=[REDACTED]
```

---

## 7. 구현 방식 권장안

### 7.1 결론

사용자 메모의 질문처럼, **공통 클라이언트/라우트 계층에 인터셉터를 두는 방식이 맞다.**  
다만 **“모든 요청을 AOP로 일괄 저장” 단독 방식보다**, 아래의 **혼합 전략**을 권장한다.

### 7.2 권장 구조

1. **Outbound Tesla API 공통 클라이언트 인터셉트**
   - `TeslaFleetClient.request()` 한 곳에서 request/response/error를 감싼다.
   - 가장 구현 난도가 낮고, 누락 가능성이 적다.

2. **Inbound FMS API 공통 래핑**
   - Next.js Route Handler에 공통 helper 또는 middleware/helper 함수 적용
   - 예: `withAudit(handler, { action: "VEHICLE_UNLINK" })`

3. **비즈니스 이벤트는 명시적 AuditLog**
   - “차량 해제”, “Tesla 연결”, “동기화 시작/실패” 등은 코드에서 의도를 알고 남기는 것이 좋다.

### 7.3 왜 AOP/Interceptor 단독만으로는 부족한가

| 방식 | 장점 | 한계 |
|------|------|------|
| 인터셉터/미들웨어 | 공통 처리, 누락 감소 | “이 요청이 어떤 비즈니스 의미인지”는 부족 |
| 서비스 코드에서 명시 저장 | 액션 의미가 명확 | 누락 위험, 반복 코드 증가 |

따라서:

- **통신 원본은 인터셉터**
- **업무 의미는 AuditLog 명시 호출**

이 조합이 가장 실용적이다.

---

## 8. FMS 현재 코드 기준 적용 포인트

### 8.1 Tesla 외부 API

우선 적용 위치:

- `src/lib/tesla/mapper.ts`의 `TeslaFleetClient.request()`

여기서 기록 가능한 항목:

- 호출 시각
- Tesla path
- method
- duration
- status code
- 필터링된 request/response
- 에러 메시지
- `userId` / `teslaAccountId`

### 8.2 FMS 내부 API

우선 적용 후보:

- `/api/auth/login`
- `/api/auth/tesla`
- `/api/auth/tesla/callback`
- `/api/auth/tesla/status`
- `/api/sync/vehicles`
- `/api/vehicles/[id]/unlink`

### 8.3 비즈니스 액션 예시

| 액션 코드 | 설명 |
|-----------|------|
| `LOGIN_SUCCESS` | 로그인 성공 |
| `LOGIN_FAILURE` | 로그인 실패 |
| `TESLA_CONNECT_START` | Tesla OAuth 시작 |
| `TESLA_CONNECT_SUCCESS` | Tesla 연동 성공 |
| `TESLA_CONNECT_FAILURE` | Tesla 연동 실패 |
| `SYNC_VEHICLES` | 차량 동기화 실행 |
| `VEHICLE_UNLINK` | 차량 연동 해제 |

---

## 9. 비기능 요구사항

### 9.1 보안

- 로그 테이블 접근은 관리자/백엔드 전용
- 민감 필드 마스킹 필수
- 토큰 원문 저장 금지
- 필요 시 장기적으로 암호화 또는 별도 저장소 검토

### 9.2 성능

- 요청 처리 경로를 과도하게 지연시키지 않도록 해야 한다
- P0은 **동기 저장**으로 시작 가능
- 트래픽 증가 시 큐/비동기 적재로 전환 가능해야 한다

### 9.3 보존 정책

- 감사 로그는 일반 앱 로그보다 길게 보관
- 예: P0 기준 90~180일
- 대용량 response body는 짧게, 요약 로그는 길게 보관 가능

### 9.4 검색성

다음 조건으로 빠르게 조회 가능해야 한다.

- `actorUserId`
- `vehicleId`
- `teslaAccountId`
- `requestId`
- `action`
- `occurredAt`

---

## 10. 권장 단계별 구현

### Phase A (P0)

- [x] `AuditLog`, `ApiCallLog` 테이블 추가
- [x] Tesla outbound request logging
- [x] FMS 내부 쓰기 API audit logging
- [x] 민감정보 마스킹

### Phase B (P1)

- 조회 API 선택 기록
- requestId 상관관계 강화
- 관리자용 로그 조회 화면 또는 검색 API

### Phase C (P2)

- 비동기 적재(큐/배치)
- 보존기간 아카이빙
- 이상행위 탐지/알림 연결

---

## 11. 완료 기준

- [x] 감사 로그 대상 범위 정의
- [x] AuditLog / ApiCallLog 2계층 저장 모델 정의
- [x] 민감정보 마스킹 원칙 정의
- [x] 인터셉터 + 명시적 감사 로그 혼합 전략 결정
- [x] 현재 FMS 코드 기준 적용 포인트 식별
- [x] Prisma 스키마/마이그레이션 반영
- [x] 로그 적재 유틸/헬퍼 구현
- [ ] 관리자 조회/검색 방식 정의

## 11.1 1차 구현 메모

- **스키마**: `AuditLog`, `ApiCallLog`, `AuditLogStatus`, `ApiCallDirection`
- **유틸**: `src/lib/audit-log.ts` — requestId 생성, header/body 마스킹, 공통 적재 함수
- **Tesla 외부 API 로그**:
  - `src/lib/tesla/auth.ts`의 OAuth token 교환
  - `src/lib/tesla/mapper.ts`의 `TeslaFleetClient.request()`
- **FMS 내부 변경 API 로그**:
  - `/api/auth/login`
  - `/api/auth/tesla`
  - `/api/auth/tesla/callback`
  - `/api/auth/tesla/status` `DELETE`
  - `/api/sync/vehicles`
  - `/api/vehicles/[id]/unlink`
- **검증**: `prisma migrate deploy`, `prisma generate --no-engine`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec next build`

---

## 12. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-08 | 메모 초안 — Tesla/FMS API 로그 저장 필요성 정리 |
| 2026-07-08 | 요구사항 정의서 정식화 — AuditLog·ApiCallLog, 마스킹, 인터셉터 전략 |
| 2026-07-08 | Phase 4 P0 1차 구현 — Prisma 스키마·마이그레이션, Tesla/FMS 로그 적재 유틸, 민감정보 마스킹 |