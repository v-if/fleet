# Vehicle Command Proxy — 개발 인수인계 · 요구사항

> **작성자**: FMS 개발자 (`bori-fleet` / Vercel)  
> **대상**: **신규 Vehicle Command Proxy 개발자** (본 문서만으로 Fly에 Proxy를 올려 재연동 이슈를 닫을 수 있어야 함)  
> **작성일**: 2026-07-12  
> **우선순위**: P0 — Production 재연동(config 재등록) 차단 중  
> **관련 FMS 문서**: [requirements-tesla-fleet-telemetry-disconnect.md](./requirements-tesla-fleet-telemetry-disconnect.md), [requirements-fleet-telemetry-completed.md](./requirements-fleet-telemetry-completed.md), [requirements-fleet-telemetry.md](./requirements-fleet-telemetry.md), [setup-guide.md](./setup-guide.md) §5.4

---

## 0. 이 문서를 받은 당신에게

당신은 **Vehicle Command Proxy**(`tesla-http-proxy`)를 **Fly.io에 신규 배포**하는 담당입니다.

| 당신이 할 일 | 당신이 하지 않는 일 |
|--------------|---------------------|
| Fly에 Command Proxy 앱 구축·상시 기동 | FMS(Next.js) 코드 수정 (이미 create 클라이언트 있음) |
| VK용 EC private key로 `fleet_telemetry_config` **서명 create** 가능하게 하기 | Telemetry 수신 서버(`bori-telemetry`) 개조 |
| FMS 개발자에게 **Proxy HTTPS origin URL** 전달 | Vercel env 최종 입력은 FMS 담당과 협의 (값을 만들어 주는 것은 당신) |
| 실차(또는 지정 VIN)로 create → GET 검증 | 대시보드 UI·DB 스키마 |

**완료의 정의(당신 관점)**: FMS가 `POST {당신의 Proxy URL}/api/1/vehicles/fleet_telemetry_config` 를 호출하면 Tesla에 config가 등록되고, 차량이 다시 `telemetry.bori-fleet.shop`에 붙어 FMS로 스트림이 들어온다.

---

## 1. 왜 Command Proxy가 필요한가 (배경)

### 1.1 한 줄

FMS에서 Telemetry **연동 해지**는 되지만, **다시 연결**하려면 Tesla `fleet_telemetry_config`를 **서명하여 재등록**해야 하는데, 그 서명을 하는 서버(Command Proxy)가 Production에 없다.

### 1.2 발생한 Production 이슈

| 항목 | 내용 |
|------|------|
| 제품 | 보리차 FMS — `https://bori-fleet.shop` |
| 재현 VIN | `LRWYGCFJ7SC214742` (실차) |
| 사용자 조작 | 차량 상세 → 「Telemetry 연동 끊기」→ 이후 「Telemetry 다시 연결」 |
| FMS DB / ApiCallLog | `errorMessage`: **`TESLA_VEHICLE_COMMAND_PROXY_URL 미설정 — fleet_telemetry_config 재등록에는 Vehicle Command Proxy가 필요합니다`** |
| Tesla 상태 | `GET .../fleet_telemetry_config` → **`config: null`** (VK는 `key_paired: true`) |
| 결과 | 차량을 깨워도 **Telemetry 스트림이 오지 않음** (수신할 config가 없음) |

### 1.3 원인 (기술)

```text
[연동 끊기]  FMS → Tesla DELETE /api/1/vehicles/{vin}/fleet_telemetry_config
             ✅ 성공 → 차량 구독 설정 삭제

[다시 연결]  FMS → createFleetTelemetryConfig()
             → env TESLA_VEHICLE_COMMAND_PROXY_URL 없음
             → ❌ Tesla 호출 전 실패
             → config 여전히 null → 스트림 없음
```

| 작업 | 담당 | 서명(private key) |
|------|------|-------------------|
| **DELETE** config | FMS가 Fleet API **직접** 호출 | 불필요 (이미 구현·동작) |
| **CREATE** config | **Command Proxy** 경유 (Tesla 권장) | **필요** — Proxy만 VK private key 보유 |

Tesla 문서: `POST /api/1/vehicles/fleet_telemetry_config` 는 **Vehicle Command Proxy**를 통해 호출하고, Proxy가 private key로 서명한 뒤 Fleet API로 전달한다.  
([Vehicle Endpoints — fleet_telemetry_config create](https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-endpoints))

### 1.4 왜 FMS(Vercel)에 키를 안 두는가

- VK/command용 **EC private key**를 Serverless(FMS)에 올리면 유출 면적이 커짐.
- Tesla 권장 아키텍처가 Proxy 분리.
- 최초 실차 연동도 **로컬 Docker Proxy + 스크립트**로 create 했음 → 같은 Proxy를 **Fly에 상시** 올리면 FMS 재연동이 자동화됨.

### 1.5 임시 우회 (당신 배포 전)

Telemetry 저장소의 로컬 Proxy + `scripts/fleet-telemetry-config.ps1`로 수동 create 가능.  
**목표**: 그 수동 절차를 **Fly Proxy + FMS 버튼**으로 대체.

---

## 2. 전체 시스템 지도 (반드시 이해)

보리차는 **세 층**이다. 당신은 **네 번째 구성요소(Command Proxy)** 를 새로 만든다.

```text
┌─────────────────────────────────────────────────────────────────┐
│  ① FMS — Vercel                                                  │
│     https://bori-fleet.shop                                      │
│     Next.js · Supabase · Tesla OAuth · UI · webhook 수신         │
│     DELETE config ✅ / CREATE config → ② Proxy 호출 (대기 중)     │
└───────────────────────────────┬─────────────────────────────────┘
                                │ POST /api/1/vehicles/fleet_telemetry_config
                                │ Authorization: Bearer <user OAuth>
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  ② Vehicle Command Proxy — Fly.io  ★ 당신 담당 (신규)            │
│     예: https://bori-cmd-proxy.fly.dev                           │
│     tesla-http-proxy · VK private key로 서명 → Tesla Fleet API   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ signed create
                                ▼
                          Tesla Cloud
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  ③ Fleet Telemetry — Fly.io (이미 운영 중)                       │
│     앱: bori-telemetry · region nrt                               │
│     hostname: telemetry.bori-fleet.shop                           │
│     차량 mTLS WebSocket 수신 → 디코딩 → FMS webhook POST         │
└───────────────────────────────┬─────────────────────────────────┘
                                │ POST /api/tesla/telemetry
                                ▼
                              다시 ① FMS
```

### 2.1 역할 분담표

| 구성요소 | 호스팅 | 하는 일 | 저장소/문서 |
|----------|--------|---------|-------------|
| **FMS** | Vercel | OAuth, 차량 DB, UI, ingress, ASLEEP, **DELETE** config, reconnect API | 본 repo `fleet` |
| **Fleet Telemetry** | Fly `bori-telemetry` | 차량→서버 스트림 수신, FMS로 relay | 별도 `fleet-telemetry` · [completed](./requirements-fleet-telemetry-completed.md) |
| **Command Proxy** | Fly **신규 앱** | config **CREATE(서명)** · (추후 원격 명령) | **당신** — vehicle-command 기반 |
| Tesla Fleet API | Tesla | config 저장·차량에 배포 | — |

### 2.2 혼동 금지 — URL 세 개

| URL | 용도 | Command Proxy? |
|-----|------|----------------|
| `https://bori-fleet.shop` | FMS 웹·API | ❌ |
| `https://telemetry.bori-fleet.shop` | **차량이 붙는** Telemetry 수신 (mTLS) | ❌ |
| `https://<cmd-proxy>.fly.dev` | **FMS가 붙는** 서명 Proxy | ✅ **이것이 `TESLA_VEHICLE_COMMAND_PROXY_URL`** |

`fleet_telemetry_config` body의 **`hostname` 필드는 항상 `telemetry.bori-fleet.shop`** 이다 (Proxy URL이 아님).

---

## 3. FMS (Vercel) — Proxy 개발자가 알아야 할 것

### 3.1 제품·엔드포인트

| 항목 | 값 |
|------|------|
| Production | `https://bori-fleet.shop` |
| 스택 | Next.js 16 · Prisma · Supabase PostgreSQL · Vercel |
| Tesla 리전 | `na` (`fleet-api.prd.na.vn.cloud.tesla.com`) — KR 포함 |
| Partner 도메인 | `bori-fleet.shop` (공개키 `/.well-known/appspecific/com.tesla.3p.public-key.pem`) |

### 3.2 재연동 시 FMS가 이미 하는 일

1. `POST /api/vehicles/{id}/telemetry/reconnect` (세션 인증)
2. DB: `TelemetrySubscription.active=true`, lifecycle → `TELEMETRY_PENDING`
3. `subscribeVehicleTelemetry` → GET config → 없으면 **`createFleetTelemetryConfig`**
4. VK confirm / Baseline (Fleet API `fleet_status` / `vehicle_data`) — Proxy와 무관

**막힌 지점**: 3번의 create — Proxy URL 없음.

### 3.3 FMS가 Proxy로 보내는 요청 (당신이 구현해야 할 서버 계약)

FMS 코드 (`src/lib/tesla/telemetry/client.ts`)가 아래를 **그대로** 호출한다.  
당신의 Proxy는 Tesla 공식 `tesla-http-proxy`와 동일하게 이 path를 지원하면 된다.

```http
POST {TESLA_VEHICLE_COMMAND_PROXY_URL}/api/1/vehicles/fleet_telemetry_config
Authorization: Bearer {Tesla 사용자 OAuth access_token}
Content-Type: application/json
```

```json
{
  "vins": ["LRWYGCFJ7SC214742"],
  "config": {
    "hostname": "telemetry.bori-fleet.shop",
    "port": 443,
    "ca": "<Telemetry 서버와 동일 CA PEM 문자열>",
    "fields": {
      "Soc": { "interval_seconds": 60 },
      "Location": { "interval_seconds": 60 },
      "ChargeState": { "interval_seconds": 60 },
      "Gear": { "interval_seconds": 60 },
      "Locked": { "interval_seconds": 60 },
      "Odometer": { "interval_seconds": 60 },
      "InsideTemp": { "interval_seconds": 60 },
      "OutsideTemp": { "interval_seconds": 60 },
      "SentryMode": { "interval_seconds": 60 }
    },
    "prefer_typed": true
  }
}
```

| 규칙 | 내용 |
|------|------|
| `Gear` | **필수 표기** — Tesla config 제약상 `ShiftState` 쓰지 말 것 (기존 실차 연동과 동일) |
| `hostname` | `telemetry.bori-fleet.shop` only |
| `ca` | Fly Telemetry TLS와 **동일 CA** (데모 self-signed). FMS가 body에 넣음 — Proxy는 서명만 |
| 인증 | FMS가 넘기는 **사용자 Bearer**를 Proxy가 Tesla 쪽으로 전달·서명에 사용 |
| 응답 | 2xx면 FMS는 성공 처리. 본문 파싱은 Tesla 표준 |

### 3.4 FMS가 당신에게 요청하는 산출물

배포 완료 후 FMS 개발자에게 아래를 전달:

| 전달 항목 | 예시 | 비고 |
|-----------|------|------|
| `TESLA_VEHICLE_COMMAND_PROXY_URL` | `https://bori-cmd-proxy.fly.dev` | **origin만**, path 없음, trailing `/` 없음 |
| Telemetry CA PEM 확인 | “Telemetry repo/Fly의 ca.pem과 동일” 확인 메모 | 실제 PEM 문자열은 Telemetry/FMS 시크릿에서 — **새로 만들지 말 것** |
| 스모크 결과 | create + GET `config != null` 스크린샷/로그 | VIN `LRWYGCFJ7SC214742` 권장 |
| Fly 앱 이름·리전 | `bori-cmd-proxy` / `nrt` | 운영 인수 |

FMS가 Vercel에 env를 넣고 재배포하면 「다시 연결」E2E가 열린다.

### 3.5 FMS 측 검증 (당신 배포 후 · FMS 담당)

- 차량 상세 → 「Telemetry 다시 연결」
- `ApiCallLog`에 `TESLA_VEHICLE_COMMAND_PROXY_URL 미설정` **없음**
- `GET fleet_telemetry_config` → `config != null`
- ingress / `telemetrySource=TELEMETRY`

---

## 4. Fleet Telemetry (Fly.io) — Proxy 개발자가 알아야 할 것

Command Proxy ≠ Telemetry 서버. **합치지 말 것.**

### 4.1 이미 있는 Telemetry 앱

| 항목 | 값 |
|------|------|
| Fly 앱 | `bori-telemetry` |
| Region | `nrt` (Tokyo) |
| Public hostname | `telemetry.bori-fleet.shop` (shared IP `66.241.125.36`) |
| 역할 | 차량 **mTLS/WebSocket** 수신 → protobuf 디코딩 → FMS `POST /api/tesla/telemetry` |
| 문서 | [requirements-fleet-telemetry-completed.md](./requirements-fleet-telemetry-completed.md) |
| 저장소 | `fleet-telemetry` (FMS와 별도) |

### 4.2 Telemetry와 Proxy의 관계

| | Telemetry (`bori-telemetry`) | Command Proxy (신규) |
|--|------------------------------|----------------------|
| 클라이언트 | **차량** | **FMS (서버)** |
| 프로토콜 | mTLS WebSocket (데이터 스트림) | HTTPS REST (config create) |
| config.hostname | 자신이 그 값 | body에 Telemetry hostname을 넣어 줌 |
| private key | mTLS/서버 인증에 CA·키 사용 | **VK command 서명 키** (`TESLA_KEY_FILE`) |
| FMS webhook | 송신 | 무관 |

### 4.3 당신이 Telemetry 팀/저장소에서 가져와야 할 것

| 자산 | 용도 | 주의 |
|------|------|------|
| **VK EC private key** (기존 `fleet-key.pem` / `private-key.pem`) | Proxy `TESLA_KEY_FILE` | **신규 생성 금지** — `bori-fleet.shop` 공개키와 쌍이어야 함 |
| **Telemetry CA PEM** (실차 config에 넣었던 ca) | FMS `TESLA_TELEMETRY_CA_PEM` / create body | Telemetry self-signed와 동일. Proxy TLS cert와 **다름** |
| (참고) `fleet-telemetry-config.ps1` | 로컬 수동 create 레퍼런스 | 필드·hostname·Gear 관례 확인용 |

키 파일은 **git에 올리지 말고** Fly Volume/secrets로만 이전. FMS·Telemetry 담당에게 안전한 채널로 수령.

### 4.4 Telemetry 서버를 건드리면 안 되는 것 (기본)

- `FMS_WEBHOOK_*`, allowlist, mTLS 443 passthrough — **재연동 이슈 해결에 Telemetry 재배포 불필요**
- Proxy는 **별 Fly 앱**

---

## 5. 당신이 만들 것 — 기술 요구사항

### 5.1 스택 (권장 · 확정)

| 항목 | 선택 | 근거 |
|------|------|------|
| 소프트웨어 | [teslamotors/vehicle-command](https://github.com/teslamotors/vehicle-command) `tesla-http-proxy` | Tesla 공식 |
| 이미지 | `tesla/vehicle-command:latest` (또는 repo Dockerfile) | 로컬 compose와 동일 |
| 호스팅 | **Fly.io** | 기존 `bori-telemetry`와 동일 플랫폼·공수·비용 |
| 리전 | `nrt` | Telemetry와 동일 권장 |
| 앱 이름 (예시) | `bori-cmd-proxy` | Telemetry와 이름 충돌 없게 |

### 5.2 키·인증서 3종 (필수 이해)

| ID | 이름 | 용도 | 위치 |
|----|------|------|------|
| **A** | VK / command EC private key | config·명령 **서명** (`TESLA_KEY_FILE`) | **Proxy Fly만** |
| **B** | Proxy HTTPS TLS cert/key | FMS↔Proxy TLS | Proxy (자체 서명 또는 공인) |
| **C** | Telemetry CA PEM | create body `ca` | **FMS Vercel env** (당신은 동일 파일임을 확인·전달) |

A ≠ B ≠ C.  
공개키(A의 쌍)는 이미 `https://bori-fleet.shop/.well-known/appspecific/com.tesla.3p.public-key.pem` 에 게시됨.

### 5.3 로컬 참고 compose (공식 패턴)

```yaml
# tesla/vehicle-command docker-compose 요지
services:
  tesla_http_proxy:
    image: tesla/vehicle-command:latest
    ports:
      - "4443:4443"
    environment:
      - TESLA_HTTP_PROXY_TLS_CERT=/config/tls-cert.pem
      - TESLA_HTTP_PROXY_TLS_KEY=/config/tls-key.pem
      - TESLA_HTTP_PROXY_HOST=0.0.0.0
      - TESLA_HTTP_PROXY_PORT=4443
      - TESLA_KEY_FILE=/config/fleet-key.pem
      - TESLA_VERBOSE=true
    volumes:
      - ./config:/config
```

Fly에서는 `/config`에 A·B를 두고 동일 env로 기동.

### 5.4 Fly 배포 요구

| ID | 요구 | 우선 |
|----|------|------|
| D1 | 별도 Fly 앱으로 배포 (Telemetry와 프로세스 분리) | P0 |
| D2 | 인터넷에서 FMS(Vercel)가 HTTPS로 도달 가능 | P0 |
| D3 | `min_machines_running=1`, **auto_stop off** (재연동 cold start 방지) | P0 |
| D4 | private key(A) git 미포함 · Volume/secret만 | P0 |
| D5 | `POST /api/1/vehicles/fleet_telemetry_config` 서명 성공 | P0 |
| D6 | 실차 VIN으로 GET `config != null` (가능하면 `synced: true`) | P0 |
| D7 | (선택) 커스텀 도메인 `cmd.bori-fleet.shop` | P1 |
| D8 | (선택) 추가 인증·접근 제한 | P1 |

### 5.5 비범위 (이번 P0)

- 차량 원격 제어(잠금/공조 등) 전체 — 추후 가능하나 **재연동 create가 P0**
- Telemetry relay/mTLS 변경
- FMS UI 수정 (오류 메시지 UX는 FMS P1)

---

## 6. 구현 · 검증 체크리스트 (당신용)

### A. 준비

- [ ] FMS·Telemetry 담당에게 **기존 VK private key(A)** 수령
- [ ] **Telemetry CA(C)** 파일 위치 확인 (create body / FMS env용 — 내용 변경 금지)
- [ ] Proxy HTTPS용 TLS(B) 준비
- [ ] Tesla 사용자 access token으로 로컬 스모크할 계획 (FMS 연동 계정)

### B. Fly 앱

- [ ] `fly apps create bori-cmd-proxy` (이름 협의 가능)
- [ ] region `nrt`
- [ ] Dockerfile + `fly.toml` (내부 포트 4443 ↔ 외부 443)
- [ ] Volume `/config` 또는 secret으로 `fleet-key.pem`, `tls-*.pem` 배치
- [ ] `fly deploy` · `fly status` · logs OK
- [ ] **상시 on** 설정 확인

### C. 기능 스모크

- [ ] (로컬 또는 Fly) Proxy 경유 CREATE — VIN `LRWYGCFJ7SC214742` (또는 협의 VIN)
- [ ] `GET /api/1/vehicles/{vin}/fleet_telemetry_config` → **`config` not null**
- [ ] (가능하면) 차량 wake 후 `synced: true`
- [ ] Fly `bori-telemetry` 로그/헬스 — 소켓·relay 정상 (Telemetry 담당과 확인)
- [ ] FMS webhook 수신 여부 — FMS 담당과 확인

### D. 인수인계 (FMS로 전달)

- [ ] Proxy origin URL 확정 전달
- [ ] CA 동일성 확인 메모
- [ ] create/GET 성공 증거 (로그)
- [ ] 장애 시: `fly status` / `fly logs` / 키 경로 runbook 1페이지

### E. FMS 연결 (FMS 담당 · 당신 협조)

- [ ] Vercel `TESLA_VEHICLE_COMMAND_PROXY_URL`
- [ ] Vercel `TESLA_TELEMETRY_CA_PEM`
- [ ] (선택) `TELEMETRY_PUBLIC_HOST=telemetry.bori-fleet.shop`
- [ ] Production redeploy
- [ ] UI 「다시 연결」→ `TESLA_VEHICLE_COMMAND_PROXY_URL 미설정` **소멸**
- [ ] 스트림 재개 확인

---

## 7. Vercel 설정 (FMS 담당 실행 · 당신은 URL 제공)

Proxy가 뜬 뒤 FMS가 넣는 값:

```env
TESLA_VEHICLE_COMMAND_PROXY_URL=https://bori-cmd-proxy.fly.dev
TESLA_TELEMETRY_CA_PEM="-----BEGIN CERTIFICATE-----\n...(Telemetry와 동일)...\n-----END CERTIFICATE-----"
TELEMETRY_PUBLIC_HOST=telemetry.bori-fleet.shop
```

| 금지 | 이유 |
|------|------|
| `https://localhost:4443` | Vercel에서 도달 불가 |
| `https://telemetry.bori-fleet.shop` | Telemetry 수신 서버 — 서명 Proxy 아님 |
| `https://bori-fleet.shop` | FMS |
| URL 끝에 `/api/1/...` | FMS 코드가 path를 붙임 |

---

## 8. 수락 기준 (Definition of Done)

다음이 **모두** 만족되면 본 이슈(재연동)는 해결된 것으로 본다.

1. Fly Command Proxy HTTPS origin이 존재하고, Vercel에서 도달 가능하다.
2. 동일 VK private key로 `fleet_telemetry_config` create가 성공한다.
3. 지정 VIN에서 `GET fleet_telemetry_config` → `config != null`.
4. FMS Production에 Proxy URL + Telemetry CA가 설정되어 있다.
5. FMS 「Telemetry 다시 연결」 시 `TESLA_VEHICLE_COMMAND_PROXY_URL 미설정` 오류가 **재발하지 않는다**.
6. (가능하면) 차량 wake 후 FMS에 Telemetry ingress가 다시 쌓이고 `telemetrySource=TELEMETRY`.

---

## 9. 보안

| 항목 | 요구 |
|------|------|
| private key(A) | git·슬랙 평문 금지. Fly Volume/secret. 유출 시 키 재발급·공개키·VK 재배포 |
| Proxy URL | 서명 권한이 있는 공개면 — 앱명 난수화·로그 감시·P1 추가 인증 검토 |
| CA(C) | Telemetry와 불일치 시 create는 되어도 **차량 미접속** — 반드시 동일본 |
| 로그 | Bearer·PEM 전문 로그 금지 |

---

## 10. 참고 링크 · 레포 좌표

| 자료 | URL / 경로 |
|------|------------|
| Tesla vehicle-command | https://github.com/teslamotors/vehicle-command |
| Fleet telemetry config create | https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-endpoints |
| FMS create 클라이언트 | `fleet` repo `src/lib/tesla/telemetry/client.ts` |
| FMS reconnect API | `POST /api/vehicles/[id]/telemetry/reconnect` |
| Telemetry 완료 인수인계 | [requirements-fleet-telemetry-completed.md](./requirements-fleet-telemetry-completed.md) |
| 연동 해제·재연결 정책 | [requirements-tesla-fleet-telemetry-disconnect.md](./requirements-tesla-fleet-telemetry-disconnect.md) |
| Telemetry 수동 스크립트 | `fleet-telemetry` repo `scripts/fleet-telemetry-config.ps1` |

### 연락·협업

| 역할 | 담당 내용 |
|------|-----------|
| FMS 개발자 (작성자) | Vercel env, 재연동 API·UI, E2E 확인, OAuth 토큰 이슈 |
| Telemetry 담당 | CA·기존 키 위치, `bori-telemetry` 수신 확인 |
| **Command Proxy 개발자 (당신)** | Fly Proxy 배포, create 스모크, URL 전달 |

---

## 11. FAQ

**Q. Telemetry 앱에 Proxy를 sidecar로 넣으면?**  
A. 가능은 하나, mTLS 443 passthrough와 HTTPS 서명 서버를 섞으면 장애 면적이 커짐. **별 앱 P0 권장.**

**Q. Partner token만으로 create?**  
A. FMS는 **사용자 OAuth access token**을 Proxy에 넘긴다. Partner-only 가정으로 설계하지 말 것.

**Q. create 성공인데 스트림이 없다?**  
A. (1) `ca`/`hostname` 불일치 (2) 차량 sleep → wake (3) `bori-telemetry` 다운 (4) FMS allowlist에 VIN 없음(구독 active). Proxy만의 문제는 아닐 수 있음 — Telemetry·FMS와 함께 본다.

**Q. `synced: false`?**  
A. 차량이 다음 백엔드 연결 때 적용. wake 후 GET 재확인.

---

## 12. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-12 | 초안 (FMS 내부) |
| 2026-07-12 | **신규 Command Proxy 개발자 인수인계서**로 전면 개편 — 시스템 지도·FMS/Telemetry 정보·계약·DoD |
