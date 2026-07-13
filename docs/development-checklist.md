# FMS 개발 체크리스트

요구사항(`requirements.md`)·기술스택(`requirements-tech-stack.md`)·DB(`requirements-db.md`)·User/Tesla 계정(`requirements-user-db.md`)을 기반으로 한 단계별 개발 체크리스트다. 각 Phase는 `requirements.md` §12 마일스톤(M1~M5)과 대응한다.

- 설치·환경 준비는 [setup-guide.md](./setup-guide.md)를 참고한다. (한 번에 모두 설치하지 않고 Phase별로 필요한 시점에 설치)
- 우선순위 표기: **P0**(데모 필수) / **P1**(데모 강화) / **P2**(투자·확장)

---

## Phase 0. 사전 준비 (개발 환경)

> 설치: [setup-guide.md](./setup-guide.md) §1~§2

- [x] Git 저장소 초기화 및 `.gitignore` 정리
- [x] Node.js LTS 설치 확인 (`node -v`)
- [x] pnpm 설치 확인 (`pnpm -v` 또는 사용자 로컬 `pnpm.cmd`)
- [ ] Cursor(에디터) + 확장(ESLint, Prettier, Prisma, Tailwind) 준비
- [x] `docs/` 문서를 AI 컨텍스트로 활용할 준비 완료
- [x] 브랜치 전략 확정 (`main` + `feature/*`)

### Phase 0 실행 메모
- 저장소는 이미 Git 저장소였으며 현재 기본 브랜치는 `main`이다.
- `.gitignore`에 Node/Next.js/환경변수/테스트 산출물 관련 기본 항목을 추가했다.
- Node.js 버전 확인: `v22.22.0`
- Git 버전 확인: `2.50.0.windows.2`
- `corepack enable`은 Windows 권한 이슈로 실패하여, `pnpm`은 사용자 로컬 경로(`$env:LOCALAPPDATA\\pnpm\\pnpm.cmd`)에 설치했다.
- Cursor 확장 설치 여부는 에디터 UI에서 직접 확인이 필요하므로 체크는 남겨둔다.

---

## Phase 1. 프로젝트 기반 구축 (M1)

> 설치: [setup-guide.md](./setup-guide.md) §3

### 스캐폴딩
- [x] Next.js(App Router) + TypeScript 프로젝트 생성
- [x] Tailwind CSS 적용 확인
- [x] ESLint + Prettier 설정 및 포맷 통일
- [x] shadcn/ui 초기화 및 기본 컴포넌트 추가(Button, Card, Table, Badge)
- [x] 폴더 구조 정의 (`app/`, `components/`, `lib/`, `lib/vehicle-providers/`)

### 데이터 계층
- [x] Supabase 프로젝트 생성 (dev) — **Phase 3.6에서 생성·연결 완료 (로컬)**
- [x] 환경 변수 파일 구성 (`.env`, `.env.example`)
- [x] Prisma 설치 및 `schema.prisma` 작성
  - [x] `vehicles` (차량 기본정보)
  - [x] `vehicle_snapshots` (최신 위치·배터리·상태)
  - [x] `vehicle_events` (이상·경고·미운행 이벤트)
  - [x] `users` (관리자)
- [x] 최초 마이그레이션 실행 및 DB 반영 확인

### Mock 데이터 (데모 안전장치, P0)
- [x] `VehicleDataProvider` 인터페이스 정의
- [x] `MockVehicleProvider` 구현 (차량 10대 이상 시뮬레이션)
- [x] 시드 스크립트로 샘플 데이터 주입
- [x] `VEHICLE_DATA_PROVIDER` 환경변수로 provider 선택 구조

**완료 기준**: 로컬에서 앱 실행 + DB에 Mock 차량 데이터 조회 가능 ✅

### Phase 1 실행 메모
- Next.js 16 + React 19 + TypeScript + Tailwind v4 스캐폴딩 완료
- Prisma **6.19** + **Supabase PostgreSQL** (Phase 3.6 로컬 연결 완료, 2026-07-07)
- Mock 차량 **12대** 시드 완료 (`pnpm db:seed`)
- API `GET /api/vehicles` — 12대 조회 확인
- 홈(`/`) 대시보드 프로토타입: KPI 카드 + 차량 목록 테이블 (Phase 2 본격 UI 전 단계)
- 검증: `pnpm lint`, `pnpm build`, `pnpm dev` + API 호출 성공

---

## Phase 2. 핵심 화면 (M2)

> 설치: [setup-guide.md](./setup-guide.md) §4

### 공통
- [x] 앱 레이아웃 (사이드바 + 헤더, 관제자 중심 구조)
- [x] TanStack Query 설정 (서버 상태·폴링)
- [x] 서버 API 라우트: 차량 목록/상세 조회

### 대시보드 (P0)
- [x] KPI 카드: 전체 차량 수 / 가동 / 이상 / 미운행
- [x] 이상·미운행 차량 요약 패널
- [x] "마지막 업데이트" 타임스탬프 표시

### 차량 목록 (P0)
- [x] 차량 목록 테이블 (번호·차종·상태·배터리·최종 업데이트)
- [x] 상태 색상 코딩 (정상/주의/이상 3단계)
- [x] 검색 + 필터 (상태, 미운행)

### 지도 (P0)
- [x] Naver Maps 연동 (Client ID 없을 시 간이 지도 폴백)
- [x] 차량 위치 마커 표시
- [x] 마커 클릭 → 차량 요약 팝업

### 차량 상세 (P0)
- [x] 기본정보 + 실시간 상태(위치·배터리·시동·최종 업데이트)
- [x] 상세 화면 내 지도(현재 위치)

**완료 기준**: Mock 데이터로 대시보드·목록·지도·상세 전체 흐름 시연 가능 ✅

### Phase 2 실행 메모
- 레이아웃: `AppShell`(사이드바) + `AppHeader`
- 페이지: `/`, `/vehicles`, `/map`, `/vehicles/[id]`
- TanStack Query 60초 폴링 (`QueryProvider`)
- API: `GET /api/vehicles`, `GET /api/vehicles/[id]` (summary·idle·lastUpdatedAt 포함)
- 지도: `VehicleMap`(Naver Maps) + `SimpleMapFallback`(Client ID 없을 때)
- 미운행 기준: `OFFLINE` 또는 7일 이상 미갱신 (`lib/vehicle-status.ts`)
- 검증: `pnpm lint`, `pnpm build`, API 호출 성공

---

## Phase 2.1. 조회 데이터 화면 매핑 (Mock)

> 근거: [requirements-tesla-api.md §5.2](./requirements-tesla-api.md) 조회 데이터 → 화면 매핑
> 범위: **실제 Fleet API 연동이 아닌 Mock 데이터**로 화면에 표시 (실 연동은 Phase 3)
> 선행 작업: Mock provider·타입(`lib/vehicle-providers/`)·시드에 해당 필드 추가 → 화면 표시

### P0 (대시보드 + 차량 상세)
- [x] 온라인/오프라인 상태 표시 *(Phase 2 반영됨 — 확인)*
- [x] 배터리 잔량(%) 표시 *(Phase 2 반영됨 — 확인)*
- [x] 주행가능거리 표시 *(Phase 2 반영됨 — 확인)*
- [x] 위치(위도/경도) 지도 표시 *(Phase 2 반영됨 — 확인)*
- [x] 충전 상태(충전중/완료/미연결) 표시 + 대시보드 KPI "충전중" 추가

### P1
- [x] 최근 경고(alerts): 대시보드 알림 패널 + 상세 이벤트 타임라인 (Mock 이벤트)
- [x] 주행거리(odometer): 상세(○) / 대시보드(△)
- [x] 잠금/문/창문 상태: 차량 상세

### P2 (차량 상세 중심)
- [x] 실내/외 온도·공조 상태
- [x] 타이어 공기압(TPMS)
- [x] 센트리/도난 관련 상태 (대시보드 이상 △)
- [x] 서비스(정비) 상태
- [x] 소프트웨어 버전
- [x] 인근 충전소 (상세 △)

**완료 기준**: §5.2 표의 P0~P1 필드가 Mock 데이터로 대시보드·차량 상세에 표시됨 ✅

### Phase 2.1 실행 메모
- Prisma `VehicleSnapshot` 확장: `chargingStatus`, `odometerKm`, 잠금/개폐, 공조/TPMS, 센트리, 서비스, 펌웨어, 인근 충전소
- Mock provider 12대 차량에 §5.2 필드 반영, Mock 이벤트 9건
- 대시보드: KPI "충전중" 추가, 알림 패널(경고·센트리·TPMS·보안), 목록에 충전/주행거리 컬럼
- 차량 상세: 잠금·개폐, 공조, TPMS, 정비·펌웨어, 인근 충전소, 이벤트 타임라인
- 검증: `pnpm db:push`, `pnpm db:seed`, `pnpm lint`, `pnpm build` 성공

---

## Phase 2.2. 프론트 UI/UX 개선 (벤치마킹)

> 근거: [requirements-front-design.md](./requirements-front-design.md)
> 참조: `benchmarking/dashboard.png`, `benchmarking/vehicles.png`, `benchmarking/vehicles-info.png`
> 전략: Pleos 구조는 취하되 **테슬라 오너 감성으로 재해석** — "정장 vs 스포츠웨어" (front-design §2)
> 범위: Mock 데이터 기반 (실 연동·차트·다운로드 제외)

### 차별화 전략 (P0, 데모 승부처)
- [x] **지도 Hero**: 대시보드 상단 크게 배치, 소수(1~10대)를 직관적·매력적으로 (front-design §5.3)
- [x] **커스텀 마커** `VehicleMarker`: 상태·배터리 색 반영 (기본 핀 지양)
- [x] **테슬라 EV 비주얼 언어**: 딥 톤 베이스 + 포인트 1색, 여백·타이포 위계 (§5.2)
- [x] 첫인상 점검: "예쁘다/테슬라 같다" + 지도만으로 이상 차량 식별 (§2.3)

### 공통 (P0)
- [x] Breadcrumb 컴포넌트 (대시보드·목록·상세)
- [x] PageHeader: 제목 + 설명 + 마지막 업데이트 + **새로고침 버튼** (Query refetch)
- [x] 데이터 소스 배지 유지

### 대시보드 (P0)
- [x] 지도 Hero 중심 레이아웃 (KPI 컴팩트 → 지도 → 위젯 순)
- [x] KPI 카드 행 (Hero 숫자 스타일)
- [x] **이상 상태 차량** 위젯: 오프라인/주의/이상 건수 + 차량 리스트 + 이슈 태그
- [x] **장기 미운행** 위젯: N일(7/30) 선택 + 기간·위치 목록

### 대시보드 (P1)
- [x] 마커 ↔ 위젯/목록 연동 하이라이트
- [x] 위젯 카드 "더보기" → 목록/상세 링크
- [x] 충전중·배터리 낮음 요약 위젯

### 차량 목록 (P0)
- [x] 제목 + **총 N건** 배지
- [x] 필터: 검색 + 상태·충전·미운행 (칩/드롭다운)
- [x] 테이블: 위치 요약 컬럼 추가·컬럼 정리

### 차량 목록 (P1)
- [x] 이용/이상 상태 색상 뱃지 강화
- [x] 페이지네이션 (10/20건)

### 차량 상세 (P0)
- [x] **요약 헤더**: 번호·모델·배터리%·시동·충전·상태
- [x] **탭 UI**: 홈 \| 이벤트
- [x] 홈 탭: 상태 그리드 + **경고 태그** + 지도 + 잠금/공조/정비/충전소 (기존 §5.2)
- [x] 이벤트 탭: 타임라인

### 차량 상세 (P1)
- [x] **TPMS 차량 도식** (4타이어 PSI, 이상 강조)
- [x] **Tesla TPMS 단위 보정**: 원본 atm(≈bar) 값을 PSI로 환산해 표시 (`× 14.7`)
- [x] **배터리 건강 게이지** (잔량 기반 Mock)
- [x] 액션 버튼 placeholder (제어)
- [x] 푸터: 마지막 업데이트 + 새로고침

### 감성·모션 (P1)
- [x] 마이크로 인터랙션: 카드 hover·마커 진입/선택·새로고침 스핀 (front-design §7.3)
- [x] 다크/딥 톤 사이드바 (첫인상 차별화)
- [ ] KPI 카운트업(선택) — 미구현(선택 항목)

**완료 기준**: (1) 지도 Hero로 1~10대가 매력적으로 표현, (2) 첫인상 "예쁘다/테슬라 같다", (3) Pleos 핵심 UX 구조(카드·breadcrumb·상세 헤더+탭·경고 태그) Mock 동작 ✅

### Phase 2.2 실행 메모
- 공통: `Breadcrumb`, `PageHeader`, `RefreshButton`, `Tabs` / Tesla EV 테마 CSS(딥 사이드바·레드 포인트)
- 지도: `VehicleMarkerPin`, Kakao `CustomOverlay` 마커, `SimpleMapFallback` hero 다크 배경
- 대시보드: 지도 Hero(480px) → 이상/미운행 위젯 → 충전·배터리 요약, 마커↔위젯 연동
- 목록: `총 N건` 배지, 위치 컬럼, 페이지네이션(10건)
- 상세: 요약 헤더 + 홈/이벤트 탭, `IssueTag`, `TpmsDiagram`, `BatteryHealthGauge`, 제어 placeholder
- 검증: `pnpm lint`, `pnpm build` 성공

---

## Phase 3. 데이터 연동 (M3)

> 설치: [setup-guide.md](./setup-guide.md) §5
> 근거: [requirements-tesla-api.md](./requirements-tesla-api.md) (조회/제어 기능·스코프·비용 제약)

### 테슬라 Fleet API (P0~P1)
- [x] Tesla 개발자 앱 등록 / OAuth 클라이언트 발급 (사용자 포털 등록)
- [x] 스코프 요청: `openid`·`offline_access`·`vehicle_device_data`·`vehicle_location`
- [x] `TeslaVehicleProvider` 구현 (OAuth 인증 흐름)
- [x] 토큰 저장·갱신 처리 (refresh token)
- [x] `GET /api/1/vehicles` 목록 + `vehicle_data`(location_data 포함) 조회
- [x] 조회 P0 매핑: 상태·배터리·주행가능거리·위치·충전상태 → 내부 스냅샷 모델 (Phase 2.1 Mock 표시를 실 데이터로 대체)
- [x] 조회 P1 매핑: `recent_alerts`·odometer·잠금/개폐 (Phase 2.1 Mock 표시를 실 데이터로 대체)

### 동기화
- [x] 데이터 동기화 로직 (Provider → DB upsert)
- [x] Vercel Cron 또는 API 라우트 기반 주기 폴링(1~5분, 비용 고려)
- [x] `fleet_status`로 펌웨어·프로토콜·할인 자격 사전 확인
- [x] `mock` ↔ `tesla` 환경변수 전환 검증 (30초 내 전환)

**완료 기준**: OAuth 연결 + Provider 동기화 파이프라인 동작 (실패 시 Mock 폴백) ✅  
> **참고**: OAuth “계정 연결됨”만으로는 Fleet API 조회가 불가하다. `412 register` 해결은 **Phase 3.5** 참고.

### Phase 3 실행 메모
- Tesla OAuth: `/api/auth/tesla` → callback `/api/auth/tesla/callback` → 설정 화면 `/settings`
- 토큰 저장: `TeslaAccount` (User 1:N, Supabase PostgreSQL), refresh token rotation 지원
- Provider: `src/lib/vehicle-providers/tesla-provider.ts` + `src/lib/tesla/*`
- 동기화: `syncVehiclesFromProvider()` → `POST /api/sync/vehicles`, `GET /api/vehicles?refresh=1`
- 자동 폴링: `TESLA_SYNC_POLL_INTERVAL_MINUTES`(기본 3분), API 조회 시 stale이면 sync
- Mock 폴백: `VEHICLE_DATA_PROVIDER=tesla` + 연동 실패 시 Mock으로 자동 전환, `SyncMetadata.usedFallback` 기록
- 리전: `TESLA_FLEET_API_REGION=na` (한국·아시아태평양·북미, OAuth audience)
- OAuth 연동 검증: `na` 리전으로 계정 연결 완료 (2026-07-07)
- **412 register** — Phase 3.5 Partner Register 완료 (2026-07-07)

---

## Phase 3.5. Tesla Partner Register (M3.5)

> 설치: [setup-guide.md](./setup-guide.md) §5.5
> 근거: [requirements-tesla-api.md §2.5](./requirements-tesla-api.md) (Partner Register·412 대응)
>
> **배경**: Phase 3 OAuth는 사용자(Third-party) 토큰만 발급한다. Fleet API **데이터 조회**(`GET /api/1/vehicles` 등)는 앱이 해당 리전에 **Partner Register** 되어 있어야 한다. 미등록 시 `412` + `must be registered in the current region` 오류가 발생한다.

### 사전 조건 (인프라)
- [x] **공개 HTTPS 도메인** 확보 — `bori-fleet.shop` (Vercel 배포, UI 로드 확인)
- [x] Tesla 포털 `allowed_origins`에 배포 도메인 등록 (2026-07-07)
- [x] OAuth `redirect_uri`를 배포 URL로 추가 (로컬 URI와 병행, 2026-07-07)
- [x] EC 키 쌍 생성 (secp256r1 / prime256v1)
  ```powershell
  openssl ecparam -name prime256v1 -genkey -noout -out private-key.pem
  openssl ec -in private-key.pem -pubout -out public-key.pem
  ```

### 공개키 호스팅
- [x] 공개키를 아래 경로에 프로젝트에 배치
  ```
  https://{도메인}/.well-known/appspecific/com.tesla.3p.public-key.pem
  ```
- [x] 프로젝트 경로 확인: `public/.well-known/appspecific/com.tesla.3p.public-key.pem`
- [x] 브라우저/curl로 공개키 URL 접근 확인 (`bori-fleet.shop`, 2026-07-07)

### Partner Register (`na` 리전 — 한국)
- [x] **Partner 토큰** 발급 (`grant_type=client_credentials`, OAuth 사용자 토큰과 별개)
- [x] `POST https://fleet-api.prd.na.vn.cloud.tesla.com/api/1/partner_accounts` 호출
  - `Authorization: Bearer {partner_token}`
  - Body: `{"domain": "bori-fleet.shop"}` (scheme 제외)
- [x] 등록 확인: `GET /api/1/partner_accounts/public_key?domain={도메인}` (partner 토큰)
- [ ] (선택) `scripts/tesla-register.ps1` 또는 API 라우트로 register 자동화

### 연동 검증
- [x] `/settings`에서 Tesla 재연결 (배포 URL 기준 OAuth, 2026-07-07)
- [x] `POST /api/sync/vehicles` 성공, `SyncMetadata.usedFallback=false`
- [x] `/settings` **최근 오류**에 412 메시지 없음
- [x] 대시보드/API에 **본인 Tesla 차량** 실데이터 표시 (Mock 12대 아님, 2026-07-07)
- [x] `provider: tesla` + 실제 VIN/배터리 확인 (위치는 수면·비주행 시 `0,0` — 지도 미표시, 2026-07-07)

### 트러블슈팅 체크
- [x] `Invalid audience` → `TESLA_FLEET_API_REGION=na` (한국) — Phase 3에서 해결
- [x] `412 must be registered` 원인 파악 및 Partner Register 완료 (2026-07-07)
- [ ] `403 missing scopes` → 포털 스코프·앱 재연결(`prompt=consent`)
- [x] Partner 토큰 vs Third-party 토큰 혼동 금지 — register는 **client_credentials** 토큰 사용

**완료 기준**: `GET /api/1/vehicles` 412 없이 본인 차량 실데이터가 대시보드에 반영 ✅

### Phase 3.5 실행 메모
- OAuth 연결됨 ≠ Fleet API 사용 가능 — Register는 **앱(파트너)** 단위 1회(리전별)
- Register에 **공개 도메인 + 공개키 호스팅** 필수, 로컬만으로는 실데이터 연동 불가
- Phase 3 Mock 폴백으로 데모데이 일정은 보호 가능 → Register는 배포 직전 스프린트로 분리
- **선행 조건**: Phase 3.6 **완료** (2026-07-07) — 로컬·Vercel API 200, Register·Tesla 배포 검증 완료
- **진행 상태 (2026-07-07)**: EC 키 쌍 생성, 공개키 URL 접근 확인, Partner 토큰 발급, `bori-fleet.shop` 도메인 Register 및 public key 조회 확인 완료.
- **연동 상태 (2026-07-07)**: 로컬·Vercel 모두 Tesla OAuth 연결 + `POST /api/sync/vehicles` 성공, `usedFallback=false`, `provider=tesla` 확인. `fleet_status` 응답 파싱 오류(`map is not a function`)와 API 캐시 이슈 수정 완료.
- **UI 보정 (2026-07-07)**: Tesla `display_name`이 번호판처럼 보이지 않도록 VIN suffix 기반 식별명(`TESLA-xxxxxx`)으로 고정, 좌표 `0,0`은 `위치 데이터 없음`으로 표시, 지도는 유효 좌표가 없을 때 안내 문구를 노출. TPMS atm→PSI 환산 적용.
- **알려진 제한**: 실차량 1대, VIN·배터리 확인. 위치는 수면·비주행 시 `0,0`으로 수신되어 지도 마커 미표시 — wake-up·주행 중 telemetry 재확인 필요.
- 참고: [Partner Endpoints — register](https://developer.tesla.com/docs/fleet-api/endpoints/partner-endpoints#register)

---

## Phase 3.6. Supabase PostgreSQL (M3.6)

> 설치: [setup-guide.md](./setup-guide.md) §5.7
> 근거: [requirements-db.md](./requirements-db.md) (Vercel 배포 오류 분석·DB 전환 요구사항)
>
> **배경**: Vercel 배포(`https://bori-fleet.shop`)에서 UI는 로드되나 `GET /api/vehicles`가 **HTTP 500** → "차량 목록을 불러오지 못했습니다." SQLite(`file:./dev.db`)는 서버리스 환경에서 사용 불가. Phase 3 Tesla OAuth·동기화 **배포 테스트**를 위해 클라우드 DB 전환이 선행되어야 한다.

### 사전 조건
- [x] Vercel 배포 완료 (페이지 로드 확인) — `bori-fleet.shop` 등
- [x] [requirements-db.md §3](./requirements-db.md) 오류 원인 이해 (SQLite ≠ Vercel)

### Supabase 프로젝트
- [x] Supabase **dev** 프로젝트 생성 (Free tier)
- [x] Connection String 확보
  - [x] **Transaction pooler** URL (Vercel serverless용, 포트 6543)
  - [x] **Session pooler** URL (Prisma migrate용, 포트 5432 — Direct `db.xxx` 차단 시)
- [x] 비밀번호 URL 인코딩 (`@` → `%40`) 적용

### Prisma 전환
- [x] `schema.prisma` `provider`를 `postgresql`로 변경
- [x] `directUrl` 환경 변수 설정 (pooler 사용 시)
- [x] PostgreSQL 마이그레이션 파일 생성 (`20260707143000_init_postgresql`)
- [x] PostgreSQL에 마이그레이션 적용 (`pnpm db:setup` 성공, 2026-07-07)
- [x] SQLite→PostgreSQL 호환 점검 (enum, JSON 필드 등 — [requirements-db.md §4.4](./requirements-db.md))

### 환경 변수
- [x] 로컬 `.env`: `DATABASE_URL`·`DIRECT_URL` Supabase URL 설정
- [x] Vercel Environment Variables 등록 (2026-07-07)
  - [x] `DATABASE_URL` (pooler)
  - [x] `DIRECT_URL` (Session pooler, migrate·빌드 시)
  - [x] 기존 `VEHICLE_DATA_PROVIDER`, `TESLA_*` 유지 · 지도는 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`
- [x] Vercel 재배포 (`build` 스크립트에 `prisma migrate deploy` 포함됨, 2026-07-07)

### 데이터 초기화·검증
- [x] `pnpm db:setup`으로 dev DB에 Mock 12대 주입
- [x] 로컬: `GET /api/vehicles` → **200**
- [x] 배포: `https://bori-fleet.shop/api/vehicles` → **200** + JSON (2026-07-07)
- [x] 배포 대시보드: KPI·지도·차량 목록 정상 표시 (mock·tesla 모두 확인, 2026-07-07)

### Tesla 배포 테스트 (Phase 3 + 3.6 연계)
- [x] `/settings` Tesla OAuth (배포 redirect URI, 2026-07-07)
- [x] OAuth 토큰이 PostgreSQL `tesla_oauth_tokens`에 저장됨 (2026-07-07)
- [x] `POST /api/sync/vehicles` API 200, `usedFallback=false` (2026-07-07)

### Out of Scope (Phase 4로 유지)
- [ ] Supabase Auth (관리자 로그인) — Phase 4
- [ ] RLS 정책 — Phase 4~5

**완료 기준**: Vercel 프로덕션에서 `/api/vehicles` 200 + 대시보드 데이터 표시 + (Tesla 시) 토큰·스냅샷 DB 저장 가능 ✅  
> **진행 상태 (2026-07-07)**: **로컬·Vercel 완료** ✅ — dev Supabase 공유, mock·tesla 배포 검증 완료

### Phase 3.6 실행 메모
- Phase 3.6은 **DB만** 전환한다. 인증(Supabase Auth)은 Phase 4.
- Phase 3.5(Register)보다 **먼저** 진행 — Register·OAuth 배포 테스트 모두 API→DB 경로 필요
- 초기 MVP: Supabase dev 프로젝트 1개를 로컬·Vercel이 공유 가능
- `DATABASE_URL=file:./dev.db`를 Vercel에 설정해도 **해결되지 않음**
- **코드 반영 (2026-07-07)**: `schema.prisma` postgresql, `directUrl`, 마이그레이션 `init_postgresql`, `build`에 `prisma migrate deploy`, `pnpm db:setup` 스크립트
- **로컬 완료 (2026-07-07)**: Supabase dev 연결, migrate·시드 12대, `localhost/api/vehicles` 200
- **Vercel 완료 (2026-07-07)**: env 등록·재배포, `bori-fleet.shop/api/vehicles` 200, mock·tesla 대시보드 확인
- **P1001 해결**: Direct `db.xxx:5432` 차단 시 `DIRECT_URL`을 **Session pooler**(pooler 호스트:5432)로 변경
- **pgbouncer 해결**: Transaction pooler `DATABASE_URL`에 `?pgbouncer=true` 필수

---

## Phase 3.7. 대시보드 디자인 개선 — TailAdmin 벤치마킹 (M3.7)

> 근거: [requirements-dashboard-design.md](./requirements-dashboard-design.md) (TailAdmin 템플릿 분석·토큰/패턴 차용 전략)
> 상위 원칙: [requirements-front-design.md](./requirements-front-design.md) — 지도 Hero·테슬라 레드 포인트는 **유지** (회귀 금지)
>
> **배경**: Phase 2.2에서 구축한 UI의 **마감 품질**(토큰·카드·배지·표)을 TailAdmin 수준으로 끌어올린다. 템플릿 전면 이식이 아니라 **디자인 시스템(색 스케일·그림자·radius·light 배지·다크모드) 차용**이다. 실 데이터 연동(Phase 3.x)과 독립적인 프론트 작업.

### 사전 조건
- [x] [requirements-dashboard-design.md](./requirements-dashboard-design.md) §4 적용 전략(채택/비채택) 숙지
- [x] 브랜드 액센트는 **테슬라 레드 유지** — TailAdmin 블루(`#465fff`) 미채택 확인

### 공통 — 디자인 토큰·레이아웃 (P0)
- [x] `globals.css` **상태 색 스케일** 추가: `success/warning/error/info` 각 50·100·500·600 + gray 스케일 (TA-COM-01)
- [x] 카드 공통 마감 통일: `rounded-2xl` + 옅은 계층 그림자 + 보더 (`fleet-card` 유틸, TA-COM-02)
- [x] KPI 숫자용 **타이틀 타입 스케일** 추가 (`text-title-sm` 등, TA-COM-03)

### 대시보드 `/` (P0)
- [x] KPI 카드 → **메트릭 카드 패턴**: 원형 아이콘 + 라벨 + 큰 숫자 (TA-DSH-01)
- [x] 이상/미운행/충전 위젯 카드: 헤더(제목+더보기)·바디 구분, 리스트 행 리듬 정리 (TA-DSH-03)
- [x] 위젯 내 차량 행 **2줄 셀** (식별명 굵게 + 모델·상태 보조) + light 배지 (TA-DSH-04)
- [x] 지도 Hero 카드 공통 마감 적용 — Hero 레이아웃 자체는 유지 (TA-DSH-05)

### 차량 목록 `/vehicles` (P0)
- [x] 테이블 헤더 톤 정돈: `gray-500` 소형 텍스트, 옅은 배경 (TA-VLS-01)
- [x] 차량 컬럼 **2줄 셀**: 식별명(굵게) + 모델·연식 보조, 상태 도트/아이콘 (TA-VLS-02)
- [x] 상태·충전 배지 **light-variant** 전환: `bg-*-50 text-*-600` (TA-VLS-03)
- [x] 행 hover·패딩 리듬 통일 (TA-VLS-04)
- [x] 테이블 카드 래핑 (`rounded-2xl` + 내부 스크롤) (TA-VLS-07)

### 차량 상세 `/vehicles/[id]` (P0)
- [x] 요약 헤더 카드: 원형 차량 아이콘 + 식별명·모델 + 상태 light 배지 (TA-VDT-01)
- [x] 상태 그리드 카드: 라벨/값 위계(`gray-500 text-xs` + `font-semibold`) 정리 (TA-VDT-02)
- [x] 경고 태그(`IssueTag`) light-variant 배지 체계 통일 (TA-VDT-03)
- [x] TPMS 도식·지도 카드 공통 마감 적용 (TA-VDT-07)

### P1 — 경험 강화
- [x] **다크모드**: class 기반 `.dark` + 헤더 토글 + localStorage, 3화면·사이드바·헤더 전체 (TA-COM-04)
- [x] 접이식 사이드바: 축소(아이콘)↔확장 (TA-COM-05)
- [x] 헤더 sticky화 + 다크모드 토글 배치 (TA-COM-06)
- [ ] KPI **증감 배지**: 직전 동기화 대비 — P2로 보류 (sessionStorage·hydration 이슈)
- [x] 배터리 건강 게이지 radial 스타일 — CSS conic-gradient (TA-VDT-04)
- [x] 페이지네이션 스타일 정리 (TA-VLS-05)
- [x] 필터 바 카드 배치 + 포커스 링(레드 계열) (TA-VLS-06)
- [x] 상세 탭 pill 스타일 (테슬라 레드 액센트, TA-VDT-05)
- [x] 이벤트 타임라인 아이콘·시간 리듬 정리 (TA-VDT-06)

### P2 — 확장 (투자 이후)
- [ ] 기간 탭 차트 (주행거리 통계, ApexCharts 도입 검토) (TA-DSH-06)
- [ ] 글로벌 검색 인풋 (`⌘K`) (TA-COM-08)
- [x] 커스텀 스크롤바 유틸리티 (`custom-scrollbar`, 위젯 리스트 적용) (TA-COM-07)

### 제약·주의 (requirements-dashboard-design.md §8)
- [x] Outfit 폰트 미채택 — 타이틀 **크기 스케일만** 차용, 폰트는 현행(Geist) 유지
- [x] shadcn 토큰과 신규 스케일 **공존(추가)** 방식 — 기존 컴포넌트 회귀 금지
- [x] Kakao Maps 다크 테마 미지원 — 지도 라이트 유지 + 카드 프레임만 다크
- [x] Tesla 실데이터 폴백 문구(`위치 데이터 없음` 등) 유지

**완료 기준**: P0·P1 핵심 완료 ✅ (KPI 증감 배지·P2 차트/검색 제외)

### Phase 3.7 실행 메모
- **코드 반영 (2026-07-07)**: `globals.css` 상태 색·그림자·타이틀 스케일, `fleet-card` 유틸, Badge light-variant(success/warning/error/info)
- **레이아웃**: `ThemeProvider`+`ThemeToggle`, 접이식 `Sidebar`, sticky `PageHeader`
- **화면**: KPI 메트릭 카드, 위젯 2줄 셀·헤더 구분, 테이블 2줄 셀·light 배지, 상세 요약 헤더 카드·radial 배터리 게이지·pill 탭
- **검증**: `pnpm lint`, `pnpm exec next build` 성공 (2026-07-07)
- KPI 증감 배지(TA-DSH-02)는 hydration·lint 이슈로 P2 보류
- ApexCharts·글로벌 검색은 P2 유지

---

## Phase 3.8. TailAdmin 템플릿 전면 적용 — 데모 UI (M3.8)

> 근거: [TailAdmin free-nextjs-admin-dashboard](https://github.com/TailAdmin/free-nextjs-admin-dashboard) · [데모](https://nextjs-free-demo.tailadmin.com/)
>
> **배경**: Phase 3.7은 기존 FMS UI에 TailAdmin **패턴만** 차용했으나, 원하는 디자인 품질과 차이가 있음. Phase 3.8에서는 템플릿 **구조·박스·버튼·레이아웃을 변경 없이** 그대로 적용하고, FMS 기능 연동은 **다음 단계**로 분리한다.

### 사전 조건
- [x] TailAdmin MIT 무료 템플릿 v2.3.0 소스 확보 (GitHub clone)
- [x] Phase 3.7과의 관계 이해 — 3.7은 토큰 차용, 3.8은 **전면 템플릿 이식**

### 템플릿 소스 통합 (P0)
- [x] TailAdmin `context/`·`layout/`·`icons/`·`hooks/` 복사
- [x] TailAdmin `components/` (ecommerce·charts·form·ui 등) 복사
- [x] TailAdmin `app/(admin)/`·`(full-width-pages)/` 라우트 복사
- [x] TailAdmin `globals.css`·`not-found.tsx` 적용
- [x] TailAdmin `public/images/` 에셋 복사
- [x] shadcn/ui 충돌 방지 — `src/components/shadcn/ui/`로 분리

### 의존성·빌드 (P0)
- [x] ApexCharts·Flatpickr·FullCalendar·Swiper·react-jvectormap 등 템플릿 의존성 설치
- [x] `@svgr/webpack` + `next.config.ts` SVG 로더 (템플릿 아이콘)
- [x] `@tailwindcss/forms` (템플릿 폼 스타일)
- [x] Outfit 폰트 (템플릿 기본 폰트)
- [x] `pnpm exec next build` 성공
- [x] ESLint — TailAdmin 템플릿 파일 규칙 완화 (원본 코드 변경 최소화)

### 라우팅·격리 (P0)
- [x] `/` — TailAdmin E-commerce 대시보드 (데모 데이터, 기능 미연동)
- [x] TailAdmin 데모 페이지 전체: `/calendar`, `/profile`, `/basic-tables`, `/bar-chart`, `/signin` 등
- [x] 기존 FMS 화면 → `/fleet/*`로 격리 (Phase 3.x 기능·API 유지, UI는 Phase 3.7 스타일)
- [x] API 라우트 `/api/*` 변경 없음

### 기능 연동 (P1)
- [x] TailAdmin 대시보드에 FMS KPI·위젯 데이터 연동 (`FleetDashboardView`, `/`)
- [x] TailAdmin 테이블 패턴으로 차량 목록 UI (`FleetVehicleTable`, `/vehicles`)
- [x] TailAdmin 프로필/카드 패턴으로 차량 상세 UI (`FleetVehicleDetailView`, `/vehicles/[id]`)
- [x] 사이드바 메뉴 FMS 항목으로 교체 (Dashboard · Vehicles · Map · Settings)
- [x] 사이드바 상단 브랜딩: **TailAdmin → Fleet**, 자동차 아이콘 (`fleet-car-icon.svg`)
- [x] `/fleet/*` → 신규 경로 리다이렉트, E-commerce 데모는 `/demo`로 격리
- [x] 대시보드 Hero: KPI 6카드(2×3) + 실시간 지도 **1:1 가로 배치** (`xl:grid-cols-2`)
- [x] KPI 카드: 아이콘·라벨 상단 가로 배치, 전 카드 **비율(%) 배지** 표시 (전체 차량만 **Fleet** 배지 복구)
- [x] 배터리 표시: Demographic 스타일 **프로그래스바 + 정수 %** (`BatteryProgressBar`)
- [x] 최근 차량 테이블: 차량 목록과 동일 컬럼(**차량·상태·충전·배터리**) 구조 통일
- [x] 충전 현황: 테이블 구조(**차량·충전·배터리**), 헤더 없음, 차량 앞 **번개 아이콘** 유지
- [x] 충전 현황·최근 차량: **충전 컬럼 축소** · **배터리 컬럼 확대** + `BatteryProgressBar expanded`
- [x] 충전 현황: 차량 모델 **줄바꿈 방지** (`nowrap`·`truncate`), 배터리 `120px`로 축소
- [x] 최근 차량: 상태·충전 **줄바꿈 방지** (`whitespace-nowrap`, 배터리 `30%`·`max-w-[200px]`로 재조정)
- [x] 차량 목록 테이블: **위치 컬럼 제거**, 컬럼 폭 균형 조정(차량 `200px`·배터리 `140px` 등)

**완료 기준**: TailAdmin UI + FMS API/Mock·Tesla 데이터 연동 ✅

### Phase 3.8 실행 메모
- **P0 (2026-07-08)**: TailAdmin v2.3.0 소스 통합, 루트 `/` = E-commerce 데모
- **P1 (2026-07-08)**: `src/components/fms/*` — TailAdmin 컴포넌트 + FMS 데이터 연동
- **P1 레이아웃 (2026-07-08)**: 대시보드 상단 — `FleetMetrics`(6 small 카드) | `FleetMapCard`(지도) 50:50
- **P1 KPI 카드 (2026-07-08)**: 아이콘+라벨 가로 배치, 숫자 하단 % 배지 — **전체 차량**만 `Fleet` 아이콘 배지(100% 대신 복구)
- **P1 배터리 UI (2026-07-08)**: 목록·최근차량·충전패널 — TailAdmin Demographic 프로그래스바 + `72%` 정수 표시
- **P1 최근 차량 (2026-07-08)**: `FleetRecentVehicles` 컬럼을 `FleetVehicleTable`과 통일(차량·상태·충전·배터리)
- **P1 충전 현황 (2026-07-08)**: `FleetChargingPanel` — 차량·충전·배터리 테이블(헤더 없음), 번개 아이콘 유지
- **P1 충전 현황 컬럼 (2026-07-08)**: 차량 모델 `nowrap`·`truncate`, 배터리 `120px`·충전 `76px` (모델명 줄바꿈 방지)
- **P1 사이드바 브랜딩 (2026-07-08)**: `AppSidebar`·모바일 헤더 — TailAdmin 로고 → Fleet 텍스트 + 자동차 아이콘
- **P1 테이블 컬럼 폭 (2026-07-08)**: 충전 현황·최근 차량 — 충전 `w-[88px]`, 배터리 expanded 프로그래스바
- **P1 최근 차량 컬럼 (2026-07-08)**: 상태 `92px`·충전 `108px` nowrap, 배터리 `30%` max `200px` (배지 줄바꿈 방지)
- **P1 차량 목록 테이블 (2026-07-08)**: 위치 컬럼 제거, 컬럼 폭 재조정 — 차량 `200px`, 상태 `72px`, 충전 `84px`, 배터리 `140px`, 주행거리 `92px`, 갱신 `124px`
- **라우트**: `/`, `/vehicles`, `/vehicles/[id]`, `/map`, `/settings` (admin 레이아웃)
- **데모 보존**: `/demo` E-commerce 원본, UI Elements 등 기존 TailAdmin 페이지 유지
- **레거시**: `/fleet/*` → 신규 경로 redirect (`next.config.ts`)
- **검증**: `pnpm exec next build`, `pnpm lint` 성공 (2026-07-08)

---

## Phase 3.9. User·Tesla 계정·차량 DB 설계

> 요구사항: [requirements-user-db.md](./requirements-user-db.md)  
> **구현 완료** (2026-07-08)

### 요구사항 정의 (P0)
- [x] User → TeslaAccount → Vehicle **1:N:N 계층** 비즈니스 규칙 문서화
- [x] Tesla API **계정 단위 토큰**·Owner/Driver 제약 반영
- [x] 차량 연동 해제 시나리오(A: 일부 / B: 마지막 1대)·**Soft Delete** 원칙 정의
- [x] Telemetry **선해제**·과금 방지 요구사항 명시
- [x] 현행 스키마 Gap (`TeslaOAuthToken` 단일 행, Vehicle FK 없음) 정리

### 스키마·마이그레이션 (P0)
- [x] `TeslaAccount` 엔티티 신설 (`userId` FK, 토큰·리전·`unlinkedAt`)
- [x] `Vehicle`에 `teslaAccountId` FK·`unlinkedAt`/`isDeleted` 추가
- [x] `User` ↔ `TeslaAccount` 1:N 관계 Prisma 반영
- [x] 기존 `TeslaOAuthToken` → `TeslaAccount` 데이터 이전 (`20260708160000_phase39_user_tesla_account`)
- [x] Mock 차량은 `teslaAccountId` nullable 유지

### API·비즈니스 로직 (P0)
- [x] 목록·상세·동기화 API — `unlinkedAt IS NULL` · `isDeleted=false` 기본 필터
- [x] 차량 연동 해제 API — `DELETE /api/vehicles/[id]/unlink` (Telemetry stub → soft delete)
- [x] 마지막 차량 unlink 시 `TeslaAccount` 토큰·계정 정리 (시나리오 B)
- [x] `(teslaAccountId, oemVehicleId)` 유니크 제약
- [x] 로그인 API — `auth.users` + `User` 조합 검증, 세션 쿠키 발급
- [x] 로그아웃 API — 세션 쿠키 제거
- [x] 차량 0대 초기 상태 — 대시보드 KPI `0`, 지도는 유지·마커 없음, 차량 목록 empty state
- [x] Tesla 미연결 시 **mock 폴백 없이** 빈 데이터 유지
- [x] 차량 목록 헤더 — 설명 문구 제거, `차량 추가` 버튼 + Tesla Fleet 연동 안내 모달
- [x] 차량 추가 모달 — `확인` 시 `/api/auth/tesla` 이동, 오버레이 투명도 완화
- [x] Tesla OAuth·토큰·동기화 — **로그인 세션 User**에 `TeslaAccount` 귀속 (`tesla_oauth_user` 쿠키)
- [x] `getOrCreateDefaultUser()` / `admin@fleet.local` 자동 생성 제거 (seed·OAuth)
- [x] Tesla OAuth callback — `returnTo` 기준 원래 화면 복귀 (`/vehicles` → `/vehicles`)
- [x] Tesla 저장 정책 — 응답에 없는 값은 `null`, placeholder/default(`linked@tesla.local`, `OWNER`, `OK`, `0/false`) 저장 금지

### 인증 연동 (P1) — Phase 4 선행 설계
- [x] Supabase Auth `auth.users.id` ↔ FMS `User.id` 매핑 방안 ([auth-user-mapping.md](./auth-user-mapping.md))
- [ ] 인증된 User 소속 TeslaAccount·Vehicle만 API 접근 (다테넌시) — Phase 4 (목록/상세 쿼리 스코프 강화)

**완료 기준 (구현)**: Prisma 마이그레이션·API 필터·unlink 파이프라인 ✅

### Phase 3.9 실행 메모
- **스키마**: `TeslaAccount` 신설, `TeslaOAuthToken` 제거, `Vehicle` soft-delete 필드
- **라이브러리**: `vehicle-query.ts`, `vehicle-unlink.ts`, `tesla/auth.ts` → 세션 User 기준 TeslaAccount
- **API**: `DELETE /api/vehicles/[id]/unlink` — Telemetry stub + soft delete + 계정 정리
- **인증**: `/signin` → `/api/auth/login` → 세션 쿠키 → 보호 레이아웃(`/`, `/vehicles`, `/map`, `/settings`)
- **Tesla 귀속**: OAuth callback이 `session.userId`로 `TeslaAccount` upsert — 레거시 `admin@fleet.local` 경로 제거
- **복귀 경로**: `tesla_oauth_return_to` 쿠키로 OAuth 시작 화면 복귀 (`/vehicles`에서 시작 시 `/vehicles`로 복귀)
- **저장 정책**: `id_token`에 email이 있으면 `TeslaAccount.teslaEmail` 저장, 없으면 `null`; `Vehicle.teslaAccountId`는 `User.id`가 아니라 `TeslaAccount.id`
- **로그인 UI**: 상단 보조 문구·테스트 계정 박스 제거, `회원가입` 링크는 `/signup` 템플릿 그대로 연결
- **차량 추가 UX**: `/vehicles` 툴바에 `차량 추가` 버튼, 안내 모달 확인 후 `/api/auth/tesla`로 이동
- **모달 오버레이**: 차량 추가 팝업 배경을 더 투명하게 조정 (`12%`, blur 완화)
- **동기화**: **mock 미사용**, Tesla 미연결 시 0대 유지 / 계정별 upsert·누락 VIN soft unlink
- **검증**: 귀속 이관·legacy admin 삭제, `pnpm lint`, `pnpm exec next build` (2026-07-08)

---

## Phase 4. 안정화 (M4)

> 설치: [setup-guide.md](./setup-guide.md) §6

### 이상/미운행 식별 (P0)
- [ ] 이상 상태 판정 규칙 정의 (배터리 임계치, 오프라인 등)
- [ ] N일 이상 미운행 차량 식별 로직
- [ ] 대시보드 알림/배지로 강조

### 인증 (P0)
- [ ] Supabase Auth 관리자 로그인
- [ ] 미인증 접근 시 API/페이지 차단
- [ ] 서버 라우트에서만 Service Role 사용

### 품질·보안
- [ ] Vitest 단위 테스트 (Provider·판정 로직)
- [ ] Playwright E2E (데모 시나리오 1~2종)
- [x] API 감사 로그 스키마 — `AuditLog`·`ApiCallLog` 설계/Prisma 반영 ([requirements-log-db.md](./requirements-log-db.md))
- [x] Tesla/FMS API 로그 적재 유틸 — 인터셉터 + 명시적 AuditLog 혼합 전략 구현
- [x] 토큰·비밀번호·쿠키 마스킹 정책 구현 및 검증
- [ ] 환경변수·키 git 제외 재확인
- [ ] 개인정보·위치정보 준수 점검 (§9.1 / 데모는 Mock·자가차량)

### 데모 준비
- [ ] 데모 시나리오 3종 스크립트 작성
- [ ] 네트워크 불안정 대비 로컬/Mock 폴백 리허설
- [ ] 성능 점검 (첫 로딩 3초 이내, 차량 10대+ 표시)

### Phase 4.1 가상 차량 시드 (P0)
- [x] 요구사항 문서 확정 — [requirements-virtual-vehicle-seeding.md](./requirements-virtual-vehicle-seeding.md)
- [x] `/vehicles` 화면 — `차량 추가` 옆 `차량 추가(가상)` 버튼
- [x] 가상 추가는 실제 Tesla OAuth/실 API 호출 없이 DB 등록만 수행
- [x] callback 완료 상태를 가정한 `TeslaAccount` 생성 + 현재 로그인 User 귀속
- [x] 가상 `TeslaAccount`당 차량 1~5대 랜덤 생성
- [x] 차량/스냅샷 값은 [requirements-tesla-fleet-api-sample-response.md](./requirements-tesla-fleet-api-sample-response.md) 기반 랜덤 생성
- [x] 배터리/충전/위치/TPMS/잠금/문/창문/공조/SW 버전 포함
- [x] 일부 차량은 이상 상태/저배터리/오프라인 등 시연용 분포 반영
- [x] 가상 차량은 실동기화/soft unlink 정책과 충돌하지 않도록 출처 구분
- [x] 가상 차량 생성도 감사 로그(`AuditLog`/`ApiCallLog`) 대상 포함

**완료 기준**: 정량 지표(`requirements.md` §11.2) 충족 + 무중단 리허설 성공

> **구현 메모 (2026-07-08)**: `/api/vehicles/virtual` 추가, 가상 TeslaAccount 1건 + Vehicle 1~5대 + VehicleSnapshot/VehicleEvent 생성, `virtual.tesla.local` 이메일·`virtual` scope 패턴으로 실 Tesla sync 대상에서 제외.
>
> **추가 메모 (2026-07-08)**: PostgreSQL `DateTime` 컬럼을 `timestamptz(3)`로 전환하고 DB timezone을 `Asia/Seoul`로 맞춰, 테이블 저장 시각과 한국시간 표시 차이(UTC 9시간 오차)를 해소.
>
> **배포 메모 (2026-07-08)**: Vercel/Supabase pooler에서 `Transaction not found`가 발생해 가상 차량 생성 로직을 interactive transaction에서 nested create 기반으로 변경.

---

### Phase 4.2 Tesla Fleet Telemetry 전환 (P0)
- [x] 요구사항 문서 확정 — [requirements-tesla-fleet-telemetry.md](./requirements-tesla-fleet-telemetry.md)
- [x] 기존 Tesla Polling → Fleet Telemetry 전환 범위 정의 (`vehicle_data` 고빈도 호출 축소)
- [x] Tesla Telemetry webhook 수신 endpoint 설계
- [x] 수신 즉시 `200 OK` 반환 + 비동기 적재/후처리 구조 설계
- [x] 원본 payload ingress 저장소/큐 모델 정의
- [x] 이벤트 중복 수신 대비 idempotency key 또는 dedupe 정책 정의
- [x] Telemetry 기반 `VehicleSnapshot` 갱신 규칙 정의
- [x] `Asleep` 추론용 필드/파생 상태 설계 (`lastTelemetryAt`, `isAsleepInferred` 등)
- [x] polling fallback 정책 정의 (`GET /api/1/vehicles`, `fleet_status` 보조 유지)
- [x] Telemetry 구독 등록/해제 운영 시나리오 정의 (unlink 과금 방지 포함)
- [x] Telemetry 수신/실패/구독 변경 로그를 `AuditLog`/`ApiCallLog`에 포함
- [x] 설정 화면/운영 화면에 Telemetry 상태 노출 요구사항 반영

**완료 기준**: 온라인 차량은 Telemetry 우선 갱신, 취침 차량은 자연스럽게 `Asleep` 추론, polling은 fallback으로 축소

> **설계 메모 (2026-07-09)**: MVP의 Tesla 실데이터는 polling 기반이지만, 비용·실시간성 문제를 줄이기 위해 Phase 4.2에서 webhook 수신 + 비동기 처리 구조로 전환한다.
>
> **구현 메모 (2026-07-10)**: `POST /api/tesla/telemetry` ingress 저장 후 `after()` 비동기 처리, `TelemetryIngress`/`TelemetryMetadata`/`TelemetrySubscription` 모델 추가, `VehicleSnapshot`에 `lastTelemetryAt`·`isAsleepInferred`·`ASLEEP` 상태 반영. unlink 시 `DELETE /fleet_telemetry_config` + 감사 로그. 설정 화면 Telemetry 패널 추가.
>
> **운영 메모 (2026-07-10)**: `TESLA_TELEMETRY_ENABLED=true` + `TESLA_REST_AUTO_SYNC_ENABLED=false`(기본)이면 REST 주기 폴링·`VehicleSnapshot` REST 적재 중지. Telemetry webhook만 스냅샷 갱신. 수동 REST 복구는 `/api/sync/vehicles?fallback=1`.

### Phase 4.3 Fleet Telemetry 서버 연동 (P0)

> 상세: [requirements-fleet-telemetry.md](./requirements-fleet-telemetry.md), [requirements-fleet-telemetry-completed.md](./requirements-fleet-telemetry-completed.md)

- [x] Telemetry 서버 요구사항·§5 계약 문서화
- [x] Fly.io `bori-telemetry` 배포 — `telemetry.bori-fleet.shop` (mTLS + relay)
- [x] FMS 커스텀 도메인 — `bori-fleet.shop` (Partner / webhook)
- [x] Production FMS webhook smoke 200 (idempotency 포함)
- [x] VIN allowlist — FMS `GET /api/internal/telemetry/status` 연동
- [x] 실차 `fleet_telemetry_config` synced + WebSocket `socket_connected`
- [x] 실차 `txtype=V` → FMS `TelemetryIngress` PROCESSED (E2E) — VIN `LRWYGCFJ7SC214742`, 2026-07-10 실측
- [x] `VehicleSnapshot.telemetrySource=TELEMETRY` · `lastTelemetryAt` 갱신 (동일 VIN, battery ~82%)
- [x] FMS mapper `Gear` 필드 인식 · VIN 대소문자 무시 매칭
- [ ] unlink → allowlist 제거 · 시연 체크리스트 (P1)
- [x] 로컬 `.env` webhook secret = Vercel/Fly 동일 값 (`pnpm telemetry:check` 200 확인, 2026-07-10)
- [ ] `/settings`·대시보드·지도 **화면 육안 확인** (시연 리허설 — **사용자**)
- [ ] (권장) `TESLA_SYNC_CRON_SECRET` / Fly `FMS_CRON_SECRET` 설정 — status API 보호 (현재 빈 값이면 공개 조회 가능)

**완료 기준**: 실차 V 스트림이 FMS snapshot까지 반영되고, Telemetry primary 모드로 데모 시연 가능

> **인수인계 메모 (2026-07-10)**: Telemetry 서버 M0~M2·M4 완료. M3는 WS 연결까지 확인, V→FMS E2E는 시연 전 공동 재검증. Secrets는 Vercel↔Fly 동일 값 유지.
>
> **P0 검증 메모 (2026-07-10)**: Supabase 실측 — 실차 VIN ingress 다건 `PROCESSED`, `telemetrySource=TELEMETRY`. Fly→FMS secret Production 정상. 로컬 `TESLA_TELEMETRY_WEBHOOK_SECRET` 동기화 후 `pnpm telemetry:check` **200** 확인. `TESLA_SYNC_CRON_SECRET`/`FMS_CRON_SECRET`은 빈 값(기존) — status API 인증 없음. 시연 전 https://bori-fleet.shop UI 육안 확인.

### Phase 4.4 하이브리드 데이터 모델 · 제원/호출 분리 (P0)

> **Phase 4.4 완료** (2026-07-11) — A~E  
> 설계: [requirements-tesla-hybrid-data-model.md](./requirements-tesla-hybrid-data-model.md)  
> 체크리스트: [checklist-tesla-hybrid-data.md](./checklist-tesla-hybrid-data.md)  
> 정책: [telemetry-webhook](./requirements-tesla-fleet-api-telemetry-webhook.md) · [display-data](./requirements-tesla-fleet-api-display-data.md) · [model-mapping](./requirements-tesla-fleet-api-model-mapping.md)

#### 4.4.A 스키마
- [x] `VehicleLifecycle` / `RestSyncReason` enum
- [x] `Vehicle` 제원 컬럼 (`carType`, `trimBadging`, `exteriorColor`, `teslaDisplayName`, `specsSyncedAt`)
- [x] `VehicleSyncState` 1:1 (lifecycle, Baseline, `lastRestSyncAt` 쿨다운 SoT)
- [x] 마이그레이션 · SyncState backfill · 시드 · env example — `20260711120000_phase44a_hybrid_data_model`

#### 4.4.B Sync 로직
- [x] `buildDisplayModel` 매핑 유틸
- [x] Baseline `vehicle_data` 1회 (실패 시 자동 wake 금지)
- [x] ASLEEP→ONLINE 쿨다운 후 `vehicle_data` 0~1회
- [x] Telemetry는 Snapshot만 · 제원 미갱신
- [x] 수동 fallback 감사 로그 · 자동 wake_up 없음
- [x] VK confirm API · registry SyncState lifecycle 힌트

#### 4.4.C API
- [x] vehicles API에 제원·lifecycle·REST/Telemetry 신선도 노출
- [x] Baseline 재시도 · VK confirm 엔드포인트
- [x] Telemetry status SyncState 요약 · DTO/`MapVehicle` 갱신

#### 4.4.D UI
- [x] 목록·상세 제원/모델 표시 · lifecycle 온보딩 안내
- [x] 신선도 · ASLEEP+READY 동시 표시 · 제원 재동기화 버튼

#### 4.4.E 검증
- [x] 쿨다운 Skip/Call 정적 검증 (`pnpm hybrid:verify`) · `telemetry:check` · unlink SyncState 정리
- [x] setup-guide §5.4.2 · 체크리스트 완료일 기록

**완료 기준**: 정적 제원은 Vehicle에만, 동적은 Snapshot+Telemetry, `vehicle_data`는 Baseline·wake 쿨다운·수동만 — **충족 (2026-07-11)**

---

### Phase 4.5 Telemetry 연동 해제 (P0~P1) — A~D 완료

> **A~D 완료** (2026-07-11) · P1 오프라인 감지기 잔여  
> 요구사항: [requirements-tesla-fleet-telemetry-disconnect.md](./requirements-tesla-fleet-telemetry-disconnect.md)  
> 체크리스트: [checklist-tesla-fleet-telemetry-disconnect.md](./checklist-tesla-fleet-telemetry-disconnect.md)  
> 검증: `pnpm disconnect:verify` · VIN `LRWYGCFJ7SC214742`

- [x] 스키마: `TELEMETRY_DISCONNECTED` · `TelemetryDisconnectReason` · migrate
- [x] API: Telemetry 단절(A) ≠ 차량 unlink(B) · reconnect · allowlist/wake skip
- [x] UI: 끊기/VK 안내 모달 · 목록 단절 뱃지·필터 · 「플릿에서 제거」
- [x] D: 소프트웨어 끊기 E2E · ASLEEP≠DISCONNECTED · wake/`vehicle_data` 프로브 없음
- [ ] (P1) 오프라인 VK 제거 감지 — `fleet_status` only (`vehicle_data` 프로브 금지)

---

### Phase 4.6 Vehicle Command Proxy (P0) — Proxy 완료 · FMS 잔여

> **Proxy Fly 배포·CREATE 스모크 완료** (2026-07-12) · FMS Vercel env·재연동 E2E 잔여  
> Proxy→FMS 인수인계: [handoff-fms.md](./handoff-fms.md)  
> 요구사항: [requirements-tesla-vehicle-command-proxy.md](./requirements-tesla-vehicle-command-proxy.md)

- [x] Fly `tesla-http-proxy` 앱 배포 — `bori-cmd-proxy` · `https://bori-cmd-proxy.fly.dev` · 상시 on · VIN CREATE 200
- [ ] Vercel: `TESLA_VEHICLE_COMMAND_PROXY_URL=https://bori-cmd-proxy.fly.dev` + `TESLA_TELEMETRY_CA_PEM` — **FMS**
- [ ] 실차 재연동 E2E (FMS 「다시 연결」→ URL 미설정 오류 없음 → ingress TELEMETRY) — **FMS**
- [ ] (P1) 재연동 실패 UX·lifecycle 롤백 — FMS

---

### Phase VD-1 차량 상세 UI (P0) — ✅ 2026-07-12

> 요구사항: [requirements-vehicle-detail-ui.md](./requirements-vehicle-detail-ui.md)  
> 체크리스트: [checklist-vehicle-detail-ui.md](./checklist-vehicle-detail-ui.md)  
> 수용 VIN: `LRWYGCFJ7SC214742`

- [x] Summary strip (상태·SoC·충전·잠금·이슈·상대 신선도)
- [x] ASLEEP 추론 배지 · 위치 null empty UX · configSynced 경고
- [x] 보안 타일 · 운영 액션 그룹 · VIN 복사
- [ ] 실차 수동 검수 (체크리스트 VD-1)

### Phase VD-2 차량 상세 UI (P1) — ✅ 2026-07-12

- [x] 연동 타임라인 (구독/VK/config/Baseline/Telemetry/REST/wake)
- [x] baselineLastError · subscription.lastError 접이식
- [x] TPMS/공조 출처 힌트 · REST 사유 한글화
- [x] 제원 접기 · 이벤트 resolvedAt/empty
- [ ] 실차 수동 검수 (체크리스트 VD-2)

### Phase VD-3 차량 상세 데이터 파이프 (P2) — ✅ 2026-07-12

> migrate: `20260712080000_phase_vd3_snapshot_detail`

- [x] chargeLimitSoc · chargerPowerKw · 개별 도어/트렁크 스키마·REST 매핑
- [x] nearby_charging_sites · service_data · Baseline alerts
- [x] Telemetry EstBatteryRange · DoorState 구독 필드
- [x] 상세 UI (충전 상세·개폐·인근 충전소)
- [ ] 실차 Baseline 수동 검수 (체크리스트 VD-3)

### Phase BF 실차 표시 데이터 버그 수정 (P0~P1) — ✅ 코드 2026-07-12

> 요구: [requirements-tesla-api-bugfix-0712.md](./requirements-tesla-api-bugfix-0712.md)  
> 체크리스트: [checklist-tesla-api-bugfix-0712.md](./checklist-tesla-api-bugfix-0712.md)  
> 수용 VIN: `LRWYGCFJ7SC214742`  
> 배경: 실차 검증에서 주행 중 문/트렁크·인근충전소 고착 확인. VD-3는 구독·스키마만 넣었고 **DoorState 파서/merge는 미완**이었음 → BF에서 수정.

- [x] **BF-A** DoorState 파서 + per-door/trunk merge + 닫힘 `false` 명시 (P0)
- [x] **BF-A2** typed/enum 리더 + SentryMode·Gear·ChargeState (a) 고착 제거 (P0)
- [x] **BF-B** 인근 충전소 수집 메타·거리(2km) 클리어·UI 문구 (P1)
- [x] **BF-C** 정차 시 nearby 재조회 · Gear 보정 REST — wake 지연-only 금지 (P1)
- [x] **BF-D** 창문·TPMS·ChargeLimitSoc·충전기 kW·HvacPower·Version 구독/매핑 (P1, **재구독 필요**)
- [x] **BF-E** UI 소스/시각 힌트 (P2) — PF/DR 펌웨어 보정은 보류
- [ ] 실차 수동 검수 (체크리스트 BF-A~D) · Telemetry 재연결로 새 필드 반영

### Phase UX2 차량 상세 표시 문구·표현 (P0~P1) — ✅ A~G 완료

> 요구: [requirements-vehicle-detail-ui2.md](./requirements-vehicle-detail-ui2.md)  
> 체크리스트: [checklist-vehicle-detail-ui2.md](./checklist-vehicle-detail-ui2.md)  
> 수용 VIN: `LRWYGCFJ7SC214742`  
> A~G: 카피 · 툴바 · Summary · 상단 2열·퀵타일 · 위치 캡션·인근충전소.

- [x] **UX2-A** 주차(절전)·마지막 신호 · configSynced 경고 완화 · 타임라인 카피 (P0)
- [x] **UX2-B** 버튼·모달·출처·목록/지도 라벨 한글화 (P1)
- [x] **UX2-C** 기술 상세 접기 · Telemetry 수신 시 configSynced 갱신 (P2)
- [x] **UX2-D** 툴바 Provider·「갱신」미표시 · 헤더/제원 중복 제거 (UX2-9~11)
- [x] **UX2-E** Summary SOC 프로그레스 · 충전/잠금 조건부 · 신선도 한 줄 (UX2-12~15)
- [x] **UX2-F** 상단 2열·주행km·3×2 퀵타일·TPMS 이동 (UX2-16~20)
- [x] **UX2-G** 위치 캡션 숨김 · 인근충전소 맵 아래 (UX2-21~22)
- [ ] 실차 수동 검수 (체크리스트 UX2-A~G)

### Telemetry Value Monitor (개발) — 요구1 ✅

> [requirements-tesla-fleet-telemetry-value-monitor.md](./requirements-tesla-fleet-telemetry-value-monitor.md)

- [x] **요구1** 상세 「Telemetry 수신 로그 (개발)」— Ingress 펼친 줄 20 · KST · flag
- [ ] **요구2** REST/Telemetry 값 색 구분 (미착수)
- [ ] 실차 모니터 대조 검수

---

## Phase 5. 배포 및 데모 (M5)

> 설치: [setup-guide.md](./setup-guide.md) §7

- [x] Vercel 프로젝트 연결 및 GitHub 자동 배포
- [x] Vercel 환경변수 완비 (Phase 3.6 `DATABASE_URL`·`DIRECT_URL` 등 — 2026-07-07)
- [ ] Supabase production 설정 (dev → production 프로젝트 분리)
- [x] production 배포 및 도메인 확인 — **`https://bori-fleet.shop`** (커스텀 도메인, 이전 `*.vercel.app`)
- [x] Telemetry 도메인 — **`https://telemetry.bori-fleet.shop`** (Fly.io)
- [ ] 배포 환경 데모 시나리오 최종 점검 (로그인 → 차량 → 지도 → `/settings` Telemetry 패널 — **사용자 리허설**)
- [ ] 데모데이 시연 및 피드백 수집

---

## Phase 6. 이후 확장 (P1~P2, 투자 이후)

- [ ] 기간별 운행 이력·동선 재생 (P1)
- [ ] Geofencing 관심 지역 (P1)
- [ ] 운행 거리·시간 집계·리포트 export (P1)
- [ ] 위험 운전 이벤트 카운트 (P1)
- [ ] 원격 차량 제어 (P2) — Virtual Key 서명 인프라 + `wake_up`→잠금/충전/센트리/위치핑 (스코프 `vehicle_cmds`·`vehicle_charging_cmds`, [tesla-api §5.3](./requirements-tesla-api.md))
- [ ] 정비 이력·예약 (P2)
- [ ] EV 배터리·타이어 예지 (P2)
- [ ] 다차종·다역할·RBAC (P2)

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-06 | 요구사항·기술스택 기반 개발 체크리스트 초안 작성 |
| 2026-07-06 | Phase 0 실행 반영 — Git/Node/pnpm/브랜치 전략 점검, `.gitignore` 정리, 실행 메모 추가 |
| 2026-07-06 | Phase 1 완료 — Next.js 스캐폴딩, Prisma+SQLite, Mock 12대, API `/api/vehicles` |
| 2026-07-06 | Phase 2 완료 — 레이아웃, TanStack Query, 목록/지도/상세 화면, Kakao Maps+폴백 |
| 2026-07-07 | Phase 3 보강 — Fleet API 스코프·조회 P0/P1 매핑·비용 제약 반영, 제어 스프린트 근거 연결 |
| 2026-07-07 | Phase 2.1 추가 — §5.2 조회 데이터 화면 매핑(Mock 표시) 체크리스트 |
| 2026-07-07 | Phase 2.1 완료 — §5.2 Mock 데이터 화면 매핑(충전·odometer·TPMS·센트리 등) |
| 2026-07-07 | Phase 2.2 추가 — Pleos Fleet UI 벤치마킹 기반 프론트 디자인 개선 체크리스트 |
| 2026-07-07 | Phase 2.2 완료 — 지도 Hero, 커스텀 마커, PageHeader/Breadcrumb, 위젯·탭·TPMS·배터리 게이지 |
| 2026-07-07 | Phase 3 완료 — Tesla OAuth, TeslaVehicleProvider, 토큰 갱신, 동기화 API, Mock 폴백 |
| 2026-07-07 | Tesla 리전 수정 — 한국은 `na`(NA+APAC), `ap` audience 오류 문서·코드 반영 |
| 2026-07-07 | Phase 3.5 추가 — Tesla Partner Register(412) 체크리스트·setup/requirements 보강 |
| 2026-07-07 | Phase 3.5 일부 진행 — EC 키 생성, `.well-known` 공개키 파일 배치 |
| 2026-07-07 | Phase 3.5 Register 완료 — 공개키 URL 확인, Partner 토큰 발급, `partner_accounts` 등록·조회 성공 |
| 2026-07-07 | Phase 3.5 연동 검증 진행 — Tesla sync 성공, `usedFallback=false`, `provider=tesla` 확인 |
| 2026-07-07 | Tesla 실데이터 UI 보정 — VIN suffix 식별명, 위치 데이터 없음 처리, 지도 좌표 안내 |
| 2026-07-07 | Tesla TPMS 표시 보정 — 원본 atm(≈bar) 값을 PSI로 환산해 차량 상세에 반영 |
| 2026-07-07 | Phase 3.6 추가 — Vercel SQLite 500 분석, Supabase PostgreSQL 전환 체크리스트·requirements-db.md |
| 2026-07-07 | Phase 3.6 코드 반영 — Prisma postgresql, 마이그레이션, build/deploy 스크립트 (Supabase 연결·배포 검증 대기) |
| 2026-07-07 | Phase 3.6 로컬 완료 — Supabase 연결, migrate·시드, API 200 / Vercel env·재배포 대기 |
| 2026-07-07 | Phase 3.5·3.6 배포 검증 완료 — Vercel env·재배포, API 200, mock·tesla 연동, TPMS PSI 환산 |
| 2026-07-07 | Phase 3.7 추가 — TailAdmin 벤치마킹 디자인 개선 체크리스트 (requirements-dashboard-design.md 기반) |
| 2026-07-07 | Phase 3.7 완료 — TailAdmin 토큰·light 배지·메트릭 카드·다크모드·접이식 사이드바·3화면 UI 개선 |
| 2026-07-08 | Phase 3.8 추가·완료 — TailAdmin 템플릿 전면 적용(데모 UI), FMS `/fleet/*` 격리 |
| 2026-07-08 | Phase 3.8 P1 완료 — TailAdmin UI + FMS 데이터 연동, `/vehicles`·`/map`·`/settings` |
| 2026-07-08 | Phase 3.8 P1 레이아웃 — 대시보드 KPI 6카드·지도 1:1 가로 배치 |
| 2026-07-08 | Phase 3.8 P1 KPI 카드 — 아이콘·라벨 가로 배치, 전 카드 % 배지 |
| 2026-07-08 | Phase 3.8 P1 배터리 UI — Demographic 프로그래스바 + 정수 % 표시 |
| 2026-07-08 | Phase 3.8 P1 최근 차량 — 목록 테이블과 컬럼 구조 통일 |
| 2026-07-08 | Phase 3.8 P1 충전 현황 — 차량 모델 줄바꿈 방지, 배터리 컬럼 `120px` |
| 2026-07-08 | Phase 3.8 P1 테이블 컬럼 — 충전 축소·배터리 확대(expanded 프로그래스바) |
| 2026-07-08 | Phase 3.8 P1 최근 차량 — 상태·충전 nowrap, 배터리 폭 재조정(줄바꿈 방지) |
| 2026-07-08 | Phase 3.8 P1 KPI — 전체 차량 카드 Fleet 배지 복구(100% 표기 제거) |
| 2026-07-08 | Phase 3.8 P1 사이드바 — TailAdmin → Fleet 브랜딩, 자동차 아이콘 |
| 2026-07-08 | Phase 3.8 P1 차량 목록 — 위치 컬럼 제거, 배터리 expanded 프로그래스바 |
| 2026-07-08 | Phase 3.8 P1 차량 목록 — 컬럼 폭 균형 재조정 (차량·배터리·갱신 등) |
| 2026-07-08 | Phase 3.9 추가 — User·TeslaAccount·Vehicle DB 요구사항 정의 ([requirements-user-db.md](./requirements-user-db.md), 코드 미착수) |
| 2026-07-08 | Phase 3.9 완료 — TeslaAccount 스키마·마이그레이션·unlink API·active 필터 |
| 2026-07-08 | Phase 3.9 보강 — OAuth callback 원위치 복귀, placeholder/default 값 `null` 정책, `teslaAccountId` 매핑 명확화 |
| 2026-07-08 | Phase 3.9 보강 — Tesla OAuth를 세션 User에 귀속, `admin@fleet.local` 자동 생성 제거 |
| 2026-07-08 | Phase 4 선행 — API 로그·감사 DB 요구사항([requirements-log-db.md](./requirements-log-db.md)) 및 체크리스트 추가 |
| 2026-07-08 | Phase 4 P0 1차 구현 — `AuditLog`·`ApiCallLog`, Tesla/FMS 변경 API 로그 적재, 민감정보 마스킹 |
| 2026-07-08 | Phase 4.1 추가 — sleep 상태 대안용 가상 차량 시드 요구사항·체크리스트 ([requirements-virtual-vehicle-seeding.md](./requirements-virtual-vehicle-seeding.md)) |
| 2026-07-09 | Phase 4.2 추가 — Tesla Fleet Telemetry webhook/비동기 처리/Asleep 추론 요구사항·체크리스트 ([requirements-tesla-fleet-telemetry.md](./requirements-tesla-fleet-telemetry.md)) |
| 2026-07-10 | Phase 4.2 완료 — Telemetry webhook/ingress/비동기 처리, ASLEEP 추론, polling fallback 축소, unlink 구독 해제, 설정 화면 Telemetry 상태 |
| 2026-07-10 | 배포 URL 변경 — `fleet-tau.vercel.app` → `bori-fleet.shop` |
| 2026-07-10 | Telemetry primary 운영 — REST 자동 폴링 중지, registry-only sync, webhook 전용 VehicleSnapshot 갱신 |
| 2026-07-10 | 커스텀 도메인 — FMS `bori-fleet.shop`, Telemetry `telemetry.bori-fleet.shop` |
| 2026-07-10 | Phase 4.3 추가 — Fleet Telemetry 서버 연동 (M0~M2·M4 완료, M3 V→FMS E2E 보류) |
| 2026-07-10 | Phase 4.3 P0 검증 — 실차 V→ingress PROCESSED·`telemetrySource=TELEMETRY` 실측, mapper Gear·VIN insensitive, 로컬 secret 동기화는 사용자 작업 |
| 2026-07-11 | Phase 4.4 추가 — 하이브리드 데이터 모델·체크리스트 문서화 (스키마/Sync/UI, **코드 미착수**) |
| 2026-07-11 | Phase 4.4.A 완료 — Vehicle 제원·VehicleSyncState·migrate backfill·시드·env (`20260711120000_phase44a_hybrid_data_model`) |
| 2026-07-11 | Phase 4.4.B 완료 — Baseline/wake 쿨다운 REST, VK confirm API, 제원 분리 쓰기, fallback 감사 |
| 2026-07-11 | Phase 4.4.C 완료 — vehicles API 제원/lifecycle/freshness, baseline 재시도, telemetry status SyncState |
| 2026-07-11 | Phase 4.4.D 완료 — 목록/상세 제원·lifecycle UI, 설정 온보딩, Baseline/VK 액션 |
| 2026-07-11 | Phase 4.4.E 완료 — hybrid:verify, telemetry:check, unlink SyncState, setup-guide 온보딩 |
| 2026-07-11 | Phase 4.5 문서 — Telemetry 연동 해제 요구사항 ([requirements-tesla-fleet-telemetry-disconnect.md](./requirements-tesla-fleet-telemetry-disconnect.md)) |
| 2026-07-11 | Phase 4.5 A~C 완료 — disconnect/reconnect/unlink · UI · D·P1 감지기 잔여 |
| 2026-07-11 | Phase 4.5 D 완료 — disconnect:verify · VIN LRWYGCFJ7SC214742 · P1 감지기 잔여 |
| 2026-07-12 | Phase 4.6 문서 — Vehicle Command Proxy ([requirements-tesla-vehicle-command-proxy.md](./requirements-tesla-vehicle-command-proxy.md)) |
| 2026-07-12 | Phase 4.6 Proxy 완료 — [handoff-fms.md](./handoff-fms.md) · `bori-cmd-proxy` · FMS Vercel/E2E 잔여 |
| 2026-07-12 | Phase VD-1 완료 — 차량 상세 Summary/추론 ASLEEP/위치 empty/configSynced 경고 ([requirements-vehicle-detail-ui.md](./requirements-vehicle-detail-ui.md), [checklist-vehicle-detail-ui.md](./checklist-vehicle-detail-ui.md)) |
| 2026-07-12 | Phase VD-2 완료 — 연동 타임라인·오류 접이·제원 접기·이벤트 resolved |
| 2026-07-12 | Phase VD-3 완료 — Snapshot charge/doors/trunk · nearby/service/alerts · UI |
| 2026-07-12 | Phase BF 추가 — 실차 도어/트렁크·인근충전소 고착 ([requirements-tesla-api-bugfix-0712.md](./requirements-tesla-api-bugfix-0712.md), [checklist-tesla-api-bugfix-0712.md](./checklist-tesla-api-bugfix-0712.md)) |
| 2026-07-12 | Phase BF 코드 완료 — DoorState/typed 파서·nearby stale·구독 확장 · 실차 검수 잔여 |
| 2026-07-13 | Phase UX2 추가 — 상세 표시 문구 ([requirements-vehicle-detail-ui2.md](./requirements-vehicle-detail-ui2.md), [checklist-vehicle-detail-ui2.md](./checklist-vehicle-detail-ui2.md)) |
| 2026-07-13 | Phase UX2 구현 완료 (A~C) — 실차 수동 검수 남음 |
| 2026-07-13 | Phase UX2-D 후속 추가 — UX2-9~11 툴바·상단 중복 (미착수) |
| 2026-07-13 | Phase UX2-D 구현 완료 (UX2-9~11) |
| 2026-07-13 | Phase UX2-E 구현 완료 (UX2-12~15 Summary 밀도) |
| 2026-07-13 | Phase UX2-F 후속 추가 — UX2-16~20 상단 2열·퀵타일 (미착수) |
| 2026-07-13 | Phase UX2-F 구현 완료 (UX2-16~20) |
| 2026-07-13 | Phase UX2-G 후속 추가 — UX2-21~22 위치·인근충전소 (미착수) |
| 2026-07-13 | Phase UX2-G 구현 완료 (UX2-21~22) |
| 2026-07-13 | Telemetry Value Monitor 요구1 구현 (Ingress 모니터 카드) |

