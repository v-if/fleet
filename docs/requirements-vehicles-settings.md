# Vehicles Settings — 차량 등록·연동 허브 (VS)

| 항목 | 내용 |
|------|------|
| 목적 | 목록의 「차량 추가」진입을 없애고, **Vehicles Settings**에서 Tesla 계정 연동 → 차량 선택 → 가상키(QR) → Telemetry 확인까지 **스텝형 등록·해제**를 한곳에서 수행한다. 등록 완료 차량만 `/vehicles`에 노출한다. |
| 배경 | 목록 「차량 추가」는 OAuth·registry까지이고, Telemetry·VK는 상세(v2)·Settings에 분산되어 관리자가 E2E를 끝내기 어렵다. |
| 관련 | [checklist-onboarding-e2e-reset.md](./checklist-onboarding-e2e-reset.md), [requirements-tesla-fleet-api-telemetry-webhook.md](./requirements-tesla-fleet-api-telemetry-webhook.md), [requirements-tesla-fleet-telemetry-disconnect.md](./requirements-tesla-fleet-telemetry-disconnect.md), [requirements-virtual-vehicle-seeding.md](./requirements-virtual-vehicle-seeding.md), [requirements-user-db.md](./requirements-user-db.md), [requirements-vehicle-list-filter-fields.md](./requirements-vehicle-list-filter-fields.md) (VL-F) |
| 적용 | 사이드바 신규 메뉴 · `/vehicles/settings` · `/vehicles` 목록 노출 규칙 · 목록 툴바 버튼 UI 제거 |
| 비범위(1차) | `/fleet/*` 레거시 UI 전면 개편 · Tesla 앱 내부 VK UX 대체 · Command(잠금/공조) |
| 상태 | **코드 ✅ (VS-2~6) · 실차 스모크 VS-7 ☐ · VS-8 P1 ☐** |
| 작성일 | 2026-07-17 |
| ID | **VS** |

---

## 1. As-Is 분석

### 1.1 목록 툴바 (`/vehicles`)

| UI | 파일 | 동작 |
|----|------|------|
| **차량 추가** | `FleetVehiclesListView` | 모달 → `GET /api/auth/tesla?returnTo=/vehicles` |
| **차량 추가(가상)** | 동일 | `POST /api/vehicles/virtual` |

- API·OAuth·virtual seed **백엔드/함수는 이미 존재**. UI만 제거하면 로직은 유지 가능.
- 목록은 lifecycle와 무관하게 **계정에 동기화된 차량 전부** 노출.

### 1.2 기존 Settings (`/settings`)

| | |
|--|--|
| 메뉴 | 사이드바 **Settings** → `/settings` (`FleetSettingsView`) |
| 내용 | Tesla 계정 연결/해제 · 차량 동기화 · Telemetry **운영 상태(읽기)** · 온보딩 대기 차량 링크 |
| 한계 | **스텝 위저드 없음** · VK 확인·disconnect·unlink UI 없음(상세 v2에 잔존) |

**Vehicles Settings ≠ Settings.** 기존 Settings는 “계정·서버 상태”, 신규 페이지는 “차량별 등록 E2E·운영 액션”.

### 1.3 등록 E2E (코드 기준)

```text
OAuth → registry sync (Vehicle + SyncState)
  → KEY_PENDING: Tesla 앱 VK 페어링 (FMS에 QR 생성 UI 없음)
  → POST .../virtual-key/confirm → TELEMETRY_PENDING (+ Baseline)
  → fleet_telemetry_config 구독 → 수신 → READY
```

| lifecycle | 의미 |
|-----------|------|
| `REGISTERED` | DB 등록 |
| `KEY_PENDING` | 가상키 대기 |
| `TELEMETRY_PENDING` | 키 확인 · 실시간 대기 |
| `READY` | 관제 준비(등록 완료) |
| `TELEMETRY_DISCONNECTED` | 실시간만 끔 · 차량 레코드 유지 |

| 능력 | API | 기본 상세(VD3) | v2 상세 | Settings |
|------|:---:|:--------------:|:------:|:--------:|
| OAuth / sync | ✅ | — | — | ✅ |
| 가상 시드 | ✅ | — | — | — (목록) |
| QR 표시 | ❌ (FMS 자체) · Tesla `_ak` URL로 대체 예정 | ❌ | ❌ | ❌ |
| 키 연결 확인 | ✅ | ❌ | ✅ | ❌ |
| Telemetry reconnect | ✅ | 일부 | ✅ | ❌ |
| disconnect / unlink | ✅ | ❌ | ✅ | ❌(계정 DELETE만) |
| 스텝 위저드 | — | ❌ | ❌ | ❌ |

### 1.4 요청 해석

| # | 요청 | 해석 |
|---|------|------|
| 1 | 목록 「차량 추가」「차량 추가(가상)」제거 · 로직 유지 | JSX·모달만 제거. API·handler 이전/재사용 |
| 2 | 사이드바 **Vehicles Settings** 신설 | Settings와 **별 메뉴·별 라우트** |
| 3 | 계정 연동 · 차량 선택 · QR/VK · Telemetry 확인 · 등록/제거/연동끊기 | 단일 허브 + **스텝 UI** |
| 4 | 등록 완료만 목록 노출 | `/vehicles` 필터. Settings에서 미완료·완료 분리 표시 |
| 5 | 차량 선택 시 Tesla `_ak` 페이지(안내+QR) 표시 | `https://www.tesla.com/_ak/bori-fleet.shop`를 **팝업 또는 새 창** |
| 6 | QR 후 FMS에서 Telemetry 등록 버튼 | VK 페어링 완료 → Settings에서 「Telemetry 등록」 |
| 7 | QR는 **최초 등록만** | 차량에서 VK 미제거 시 disconnect/재등록은 QR 생략 |

---

## 2. To-Be 설계

### 2.1 정보 구조 (IA)

| 메뉴 라벨 | 경로 | 역할 |
|-----------|------|------|
| Vehicles | `/vehicles` | **관제 목록** — 등록 완료(및 운영 단절) 차량만 |
| **Vehicles Settings** | `/vehicles/settings` | **등록·연동 허브** — 위저드 + 차량별 상태·액션 |
| Settings | `/settings` | **시스템 연동 상태** — 계정 토큰·Telemetry 서버 헬스(기존 유지, 점진 축소 가능) |

- Next.js: `app/(admin)/vehicles/settings/page.tsx`는 `[id]`보다 우선 → 충돌 없음.
- 사이드바: Vehicles와 Settings **사이**(또는 Vehicles 직하)에 영문 라벨 **Vehicles Settings** (요청 그대로). 화면 제목은 「차량 등록 · 연동」권고.

### 2.2 목록 툴바 (목적 1)

| 제거 | 유지 |
|------|------|
| 「차량 추가」버튼 · 확인 모달 | `GET /api/auth/tesla` |
| 「차량 추가(가상)」버튼 · seed 메시지 UI(목록) | `POST /api/vehicles/virtual` |

가상 시드는 **Vehicles Settings → 개발/데모** 접힘 섹션으로 이전(프로덕션 기본 숨김 또는 `NODE_ENV`/플래그).

### 2.3 Vehicles Settings 페이지 구성

#### A. 계정 스텝 (글로벌)

1. Tesla 계정 연결 상태  
2. 연결 / 연결 해제 (`/api/auth/tesla`, `DELETE .../status`)  
3. 차량 목록 가져오기 (`POST /api/sync/vehicles`)  
4. 안내: 「계정을 연결하면 Tesla에 등록된 차량이 아래에 나타납니다」

#### B. 차량 보드 (두 구역)

| 구역 | 조건(권고) | 표시 |
|------|------------|------|
| **연동 진행 중** | `lifecycle ∈ {REGISTERED, KEY_PENDING, TELEMETRY_PENDING}` | 현재 스텝·다음 액션 CTA |
| **Telemetry 등록됨** | `READY` ∪ `TELEMETRY_DISCONNECTED` | 상태 · 연동 끄기 · 다시 켜기 · 플릿 제거 |

요청의 「Telemetry 등록 / 미등록 분리」= 위 두 구역.

#### C. 차량별 스텝 위저드 (핵심)

스텝은 **lifecycle + 구독 상태 + VK 필요 여부**로 자동 산출. 완료 스텝은 체크, 현재 스텝만 primary CTA, 이후 스텝은 잠금(또는 비활성).

| Step | 제목 | 사용자 할 일 | 완료 조건 | 주요 API/자산 |
|------|------|--------------|-----------|---------------|
| **1** | 계정·차량 가져오기 | OAuth · sync | Vehicle 행 존재 · ≠ 계정 미연결 | auth/tesla · sync/vehicles |
| **2** | 가상키(QR) 페어링 | 차량 선택 → Tesla `_ak` 페이지에서 QR 촬영·앱 동의 · (선택) 「키 연결 확인」 | `fleet_status` key paired 또는 confirm 성공 → `TELEMETRY_PENDING`+ | **§2.3.1** · `POST .../virtual-key/confirm` |
| **3** | Telemetry 등록 | FMS에서 「Telemetry 등록」버튼 | 구독·`fleet_telemetry_config` 시도 성공 | subscribe / reconnect |
| **4** | 수신 확인 | 차량 ONLINE·주행/충전으로 신호 | `lastTelemetryAt` 또는 Snapshot `TELEMETRY` · → `READY` | webhook/Ingress (읽기) |
| **5** | 관제 목록 반영 | — | `READY` → `/vehicles`에 노출 | 목록 필터 |

#### C-1. 가상키 QR · Tesla `_ak` 페이지 (추가요구 · SoT)

| 항목 | 내용 |
|------|------|
| **URL** | `https://www.tesla.com/_ak/bori-fleet.shop` |
| **역할** | Tesla 호스팅 페이지 — **가상키 발급 안내문 + QR코드** (FMS가 QR을 자체 생성하지 않음) |
| **트리거** | 계정 연동 후 가져온 차량 목록에서 **등록할 차량을 선택**했을 때 |
| **표시 방식** | **팝업(`window.open`) 또는 새 브라우저 탭**으로 위 URL 로드. (모달 iframe은 Tesla X-Frame 제한 가능 → **새 창/탭 권고**, 팝업 차단 시 동일 URL을 새 탭 링크로 폴백) |
| **사용자 절차** | 1) PC에서 `_ak` 페이지 확인 · 2) **휴대폰**으로 QR 촬영 · 3) Tesla 앱에서 동의 · 4) Vehicles Settings로 돌아와 **「Telemetry 등록」** |
| **상수** | `TESLA_VIRTUAL_KEY_PAIRING_URL` (또는 `NEXT_PUBLIC_…`)로 고정 — 하드코딩 산재 금지 |

```text
[Vehicles Settings]
  차량 선택 (최초·키 미페어링)
       │
       ├─► 새 창/탭: https://www.tesla.com/_ak/bori-fleet.shop
       │         (안내 + QR)
       │
       ▼  휴대폰 QR → 앱 동의 완료
  「키 연결 확인」(권고) → 「Telemetry 등록」
       │
       ▼
  수신 확인 → READY → /vehicles 노출
```

#### C-2. QR(가상키) 필요 여부 — 최초 vs 재연동

| 시나리오 | `_ak` QR 절차 | Telemetry 등록/재등록 | 비고 |
|----------|:-------------:|:---------------------:|------|
| **최초 등록** (키 미페어링 · `REGISTERED`/`KEY_PENDING`) | **필요** | 키 절차 후 「Telemetry 등록」 | 차량 선택 시 `_ak` 창 오픈 |
| **Telemetry만 끊기** (`disconnect`) · 차량에 VK **유지** | **불필요** | 「다시 켜기」만 | QR·키 확인 스킵 |
| **Telemetry 재등록** · VK **미제거** | **불필요** | 「Telemetry 등록」/reconnect만 | 동일 |
| 사용자가 Tesla 앱/차량에서 **가상키 제거** 후 재등록 | **필요** | 키 절차부터 재개 | `KEY_PENDING` 복귀 또는 confirm 실패(`virtual_key_not_paired`) 시 `_ak` 재유도 |
| 플릿 **unlink** 후 다시 가져오기 | **필요**(새 온보딩) | 최초와 동일 | |

**판정(권고):**

| 신호 | 의미 |
|------|------|
| `lifecycle ∈ {REGISTERED, KEY_PENDING}` | QR/`_ak` **필요** |
| `lifecycle === TELEMETRY_PENDING` · 키는 확인됐으나 스트림만 대기 | QR **생략** · 「Telemetry 등록」강조 |
| `lifecycle === TELEMETRY_DISCONNECTED` · 이전 `virtualKeyConfirmedAt` 또는 `fleet_status` paired | QR **생략** |
| reconnect/confirm 시 `virtual_key_not_paired` | QR **재필요** · `_ak` 창 + 안내 |

UI: 등록됨 구역의 「연동 끄기 / 다시 켜기」에는 `_ak`를 띄우지 않는다. 「키 다시 연결」명시 CTA만 `_ak`를 연다.

#### C-3. 이전 QR 옵션 정리 (문서 정정)

| 이전 초안 | 변경 |
|-----------|------|
| FMS 자체 QR 생성(P1) | **불필요** — Tesla `_ak` 페이지에 QR이 있음 |
| 안내 문구만(MVP) | **부족** — 차량 선택 시 `_ak` **필수 오픈** |
| VS-8 QR 보강 | **축소** — 팝업 차단 폴백·복사 링크·모바일 안내 UX만 |

#### D. 운영 액션 (등록 후 · 동일 페이지)

| 액션 | API | 목록 영향 | QR/`_ak` |
|------|-----|-----------|:--------:|
| 실시간 연동 끄기 | `POST .../telemetry/disconnect` | 유지(`TELEMETRY_DISCONNECTED`) | ❌ |
| 실시간 다시 켜기 | `POST .../telemetry/reconnect` | READY 복귀 목표 | ❌ (VK 유지 시) |
| 플릿에서 제거 | `DELETE .../unlink` | 목록·Settings에서 사라짐(soft-delete) | — |
| 키 다시 연결 | `_ak` 오픈 + confirm | — | ✅ |

v2 상세에만 있던 UI를 **이 페이지로 이관**(VD3에는 관제 운영만 유지 권고).

### 2.4 `/vehicles` 노출 규칙 (목적 「완료만 목록」)

| 노출 | lifecycle |
|------|-----------|
| **목록에 표시** | `READY`, `TELEMETRY_DISCONNECTED` |
| **목록에서 숨김** | `REGISTERED`, `KEY_PENDING`, `TELEMETRY_PENDING` (+ soft-deleted) |

**의견:** `TELEMETRY_DISCONNECTED`는 “등록은 끝냈으나 스트림만 끔”이므로 **목록에 남겨** 관제·재연동이 가능하게 한다. 숨기면 “연동 끔 = 차량 증발”로 운영이 깨진다. 미완료만 Settings에 둔다.

구현: `GET /api/vehicles`(또는 list DTO 조립)에서 서버 필터 권고 — 클라이언트만 숨기면 API·지도·대시보드가 어긋날 수 있음. 대시보드 KPI·맵은 **동일 SoT**를 쓰는지 회귀 점검(VS-5).

### 2.5 기존 `/settings`와의 관계

| 권고 | |
|------|--|
| 단기 | Settings 유지(헬스·토큰). Vehicles Settings에 **동일 OAuth/sync CTA**를 두고 returnTo=`/vehicles/settings` |
| 중기 | Settings의 「온보딩 대기 목록」·차량 sync 버튼은 Vehicles Settings로 이전하고 Settings는 서버/Telemetry 메타만 |

계정 **연결 해제**는 전 차량 unlink 파급 → Settings **또는** Vehicles Settings 계정 영역에만 두고 강한 확인 모달.

### 2.6 UX 원칙 (스텝 표시)

1. 상단 **진행 표시**(1–4 또는 1–5): 완료 · 현재 · 대기.  
2. 각 스텝에 **왜 필요한지 2–3문장** + 실패 시 구체 메시지(`virtual_key_not_paired` 등).  
3. 다음 스텝 CTA는 **현재 스텝 완료 전 비활성**.  
4. 다중 차량: 카드/행 선택 후 해당 VIN 위저드(계정 스텝은 공통).  
5. 완료 시 「차량 목록에서 보기」딥링크.

### 2.7 수용 기준

1. `/vehicles` 툴바에 「차량 추가」「차량 추가(가상)」**없음**.  
2. OAuth·`POST /api/vehicles/virtual`는 **다른 진입점**에서 호출 가능(로직 유지).  
3. 사이드바에 **Vehicles Settings** → `/vehicles/settings`.  
4. 해당 페이지에서 계정 연동 · sync · 키 확인 · Telemetry 등록/재시도 · disconnect · unlink 가능.  
5. 스텝 UI가 lifecycle에 따라 완료/현재를 반영.  
6. `READY`/`TELEMETRY_DISCONNECTED`만 `/vehicles`에 노출 · 미완료는 Settings에만.  
7. Settings와 Vehicles Settings 메뉴가 **구분**됨.  
8. **최초 등록:** 차량 선택 시 `https://www.tesla.com/_ak/bori-fleet.shop`가 팝업/새 탭으로 열림.  
9. `_ak` 안내대로 휴대폰 QR·앱 동의 후, Settings에서 **「Telemetry 등록」**으로 구독 진행.  
10. **VK 유지 시** Telemetry 끊기/다시 켜기에 `_ak`/QR을 **강제하지 않음**.  
11. VK 제거·`virtual_key_not_paired` 시에만 `_ak`를 다시 유도.  
12. 실차 E2E: OAuth → `_ak` QR → Telemetry 등록 → 수신 → 목록 등장 ([onboarding checklist](./checklist-onboarding-e2e-reset.md)).

### 2.8 비범위 · 후속

- FMS가 Tesla `_ak` 페이지·QR을 **자체 호스팅/복제**하는 것  
- Tesla 앱 내부 VK UX 대체  
- 법인/멀티테넌트 승인 워크플로 (bori v2)  
- `/fleet/settings` 레거시 동기화(필요 시 별도)  
- 충전 AC/DC 등 관제 UX (VL-F와 무관)  
- iframe으로 `_ak`를 FMS 모달에 임베드(차단·약관 리스크)

---

## 3. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **VS-1** | 본 문서 승인 (GO) | ✅ |
| **VS-2** | 목록 「차량 추가」「차량 추가(가상)」UI 제거 · API 유지 | ✅ |
| **VS-3** | 사이드바 + `/vehicles/settings` 셸 · 계정 연동/sync 이전 | ✅ |
| **VS-4** | 차량 보드 · 스텝 위저드 · 차량 선택 시 `_ak` 오픈 · Telemetry 등록 CTA | ✅ |
| **VS-5** | `/vehicles`(및 공유 list SoT) 완료 차량만 노출 | ✅ |
| **VS-6** | disconnect / unlink / 가상시드(데모) Settings 이관 · **재연동 시 QR 생략** | ✅ |
| **VS-7** | 실차 스모크 · 대시보드/맵 회귀 · `_ak`·팝업 차단 폴백 | ☐ |
| **VS-8** | (P1) `_ak` UX 보강 — 복사 링크 · 모바일 안내 · 팝업 차단 폴백 다듬기 | ☐ |

### 구현 파일

| 파일 | 역할 |
|------|------|
| `FleetVehiclesListView.tsx` | 추가 버튼 제거 |
| `AppSidebar.tsx` | Vehicles Settings 메뉴 |
| `app/(admin)/vehicles/settings/page.tsx` | 라우트 |
| `FleetVehiclesSettingsView.tsx` | 허브 UI · 위저드 · `_ak` · 액션 |
| `lib/tesla/virtual-key-pairing.ts` | `_ak` URL 상수 · `openTeslaVirtualKeyPairingPage` |
| `lib/vehicle-lifecycle.ts` | `isFleetListLifecycle` · `needsVirtualKeyQr` 등 |
| `lib/vehicles.ts` · `api/vehicles` · `use-vehicles` | `scope=fleet\|all` |

체크리스트: [checklist-vehicle-detail-vd3.md](./checklist-vehicle-detail-vd3.md) · [development-checklist.md](./development-checklist.md)

---

## 4. 의견 · 진행 여부

### 판단: **GO (단계 분할)** — `_ak` QR 반영 유지

| 근거 | |
|------|--|
| 제품 | 온보딩이 목록·Settings·v2에 흩어져 E2E 실패가 반복됨. 허브+스텝은 배경과 일치. |
| 기술 | API 대부분 존재. **새 백엔드보다 UI 조립·목록 필터·메뉴**가 핵심. |
| 리스크 | 목록 필터를 클라이언트만 하면 KPI/맵 불일치 → **서버(또는 단일 list 헬퍼) SoT** 필수. |
| QR/`_ak` | Tesla 공식 `_ak` URL을 **새 창으로 연다** — FMS QR 생성 불필요. 팝업 차단만 폴백. |
| 재연동 | VK 유지 시 QR 생략 — disconnect/reconnect UX와 일치 · 불필요한 마찰 제거. |

### 권고 (요청 대비 보완)

1. **목록 노출에 `TELEMETRY_DISCONNECTED` 포함** — 운영 단절 ≠ 미등록.  
2. **기존 Settings 즉시 폐기하지 않음** — 헬스 패널 유지, 차량 온보딩만 이전.  
3. **가상 시드**는 목록이 아니라 Settings 데모 구역.  
4. **구현 순서:** VS-2 → VS-3 → VS-5 → VS-4(`_ak`+Telemetry CTA) → VS-6(재연동 QR 생략 검증).  
5. **VK UI를 VD3에 다시 넣지 말고** Settings 위저드로만 모을 것.  
6. **표시 방식:** iframe 모달보다 **`window.open` / `target=_blank`** 권고. 차단 시 동일 URL 버튼+클립보드 복사.  
7. `_ak` 오픈 직후 Settings에 「휴대폰으로 QR을 찍은 뒤, 아래 Telemetry 등록을 누르세요」고정 안내.  
8. 「키 연결 확인」은 `_ak`와 Telemetry 등록 **사이**에 두면 confirm 실패를 조기 발견(권고, 필수는 아님 — Telemetry 등록이 confirm을 내포해도 됨).

### 비GO / 보류

- FMS가 QR을 직접 그려 `_ak`를 우회  
- disconnect/reconnect마다 `_ak` 강제 (요청과 반대 · VK 유지 시 불필요)  
- “Tesla가 웹훅으로 VK 완료를 준다” 가정 (표준 아님 — 사용자 확인/confirm 유지)  
- VS-2~7을 단일 PR로 몰아넣기

### 추천 한 줄

**GO — 최초 등록만 `tesla.com/_ak/bori-fleet.shop`를 새 창으로 띄워 QR·앱 동의를 받고, Settings에서 Telemetry 등록; VK가 남아 있으면 끊기/재등록에 QR을 요구하지 않는다.**

---

## 5. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-17 | 초안 — 목록 버튼 제거 · Vehicles Settings 허브 · 스텝 위저드 · 목록 노출 규칙 · GO(단계 분할) |
| 2026-07-17 | 추가 — Tesla `_ak` URL(팝업/새 창) · 최초만 QR · VK 유지 시 Telemetry 재연동 QR 생략 |
| 2026-07-17 | VS-2~6 코드 ✅ — Settings 허브 · list `scope` · `_ak` · disconnect/unlink · 가상시드 데모 |
