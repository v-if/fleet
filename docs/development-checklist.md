# FMS 개발 체크리스트

요구사항(`requirements.md`)·기술스택(`requirements-tech-stack.md`)·DB(`requirements-db.md`)을 기반으로 한 단계별 개발 체크리스트다. 각 Phase는 `requirements.md` §12 마일스톤(M1~M5)과 대응한다.

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
- [x] Kakao Maps 연동 (키 없을 시 간이 지도 폴백)
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
- 지도: `VehicleMap`(Kakao) + `SimpleMapFallback`(API 키 없을 때)
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
- 토큰 저장: `TeslaOAuthToken` (Supabase PostgreSQL), refresh token rotation 지원
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
- [x] **공개 HTTPS 도메인** 확보 — `fleet-tau.vercel.app` (Vercel 배포, UI 로드 확인)
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
- [x] 브라우저/curl로 공개키 URL 접근 확인 (`fleet-tau.vercel.app`, 2026-07-07)

### Partner Register (`na` 리전 — 한국)
- [x] **Partner 토큰** 발급 (`grant_type=client_credentials`, OAuth 사용자 토큰과 별개)
- [x] `POST https://fleet-api.prd.na.vn.cloud.tesla.com/api/1/partner_accounts` 호출
  - `Authorization: Bearer {partner_token}`
  - Body: `{"domain": "fleet-tau.vercel.app"}` (scheme 제외)
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
- **진행 상태 (2026-07-07)**: EC 키 쌍 생성, 공개키 URL 접근 확인, Partner 토큰 발급, `fleet-tau.vercel.app` 도메인 Register 및 public key 조회 확인 완료.
- **연동 상태 (2026-07-07)**: 로컬·Vercel 모두 Tesla OAuth 연결 + `POST /api/sync/vehicles` 성공, `usedFallback=false`, `provider=tesla` 확인. `fleet_status` 응답 파싱 오류(`map is not a function`)와 API 캐시 이슈 수정 완료.
- **UI 보정 (2026-07-07)**: Tesla `display_name`이 번호판처럼 보이지 않도록 VIN suffix 기반 식별명(`TESLA-xxxxxx`)으로 고정, 좌표 `0,0`은 `위치 데이터 없음`으로 표시, 지도는 유효 좌표가 없을 때 안내 문구를 노출. TPMS atm→PSI 환산 적용.
- **알려진 제한**: 실차량 1대, VIN·배터리 확인. 위치는 수면·비주행 시 `0,0`으로 수신되어 지도 마커 미표시 — wake-up·주행 중 telemetry 재확인 필요.
- 참고: [Partner Endpoints — register](https://developer.tesla.com/docs/fleet-api/endpoints/partner-endpoints#register)

---

## Phase 3.6. Supabase PostgreSQL (M3.6)

> 설치: [setup-guide.md](./setup-guide.md) §5.7
> 근거: [requirements-db.md](./requirements-db.md) (Vercel 배포 오류 분석·DB 전환 요구사항)
>
> **배경**: Vercel 배포(`https://fleet-tau.vercel.app`)에서 UI는 로드되나 `GET /api/vehicles`가 **HTTP 500** → "차량 목록을 불러오지 못했습니다." SQLite(`file:./dev.db`)는 서버리스 환경에서 사용 불가. Phase 3 Tesla OAuth·동기화 **배포 테스트**를 위해 클라우드 DB 전환이 선행되어야 한다.

### 사전 조건
- [x] Vercel 배포 완료 (페이지 로드 확인) — `fleet-tau.vercel.app` 등
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
  - [x] 기존 `VEHICLE_DATA_PROVIDER`, `TESLA_*`, `NEXT_PUBLIC_KAKAO_MAP_KEY` 유지
- [x] Vercel 재배포 (`build` 스크립트에 `prisma migrate deploy` 포함됨, 2026-07-07)

### 데이터 초기화·검증
- [x] `pnpm db:setup`으로 dev DB에 Mock 12대 주입
- [x] 로컬: `GET /api/vehicles` → **200**
- [x] 배포: `https://fleet-tau.vercel.app/api/vehicles` → **200** + JSON (2026-07-07)
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
- **Vercel 완료 (2026-07-07)**: env 등록·재배포, `fleet-tau.vercel.app/api/vehicles` 200, mock·tesla 대시보드 확인
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
- [ ] 환경변수·키 git 제외 재확인
- [ ] 개인정보·위치정보 준수 점검 (§9.1 / 데모는 Mock·자가차량)

### 데모 준비
- [ ] 데모 시나리오 3종 스크립트 작성
- [ ] 네트워크 불안정 대비 로컬/Mock 폴백 리허설
- [ ] 성능 점검 (첫 로딩 3초 이내, 차량 10대+ 표시)

**완료 기준**: 정량 지표(`requirements.md` §11.2) 충족 + 무중단 리허설 성공

---

## Phase 5. 배포 및 데모 (M5)

> 설치: [setup-guide.md](./setup-guide.md) §7

- [x] Vercel 프로젝트 연결 및 GitHub 자동 배포 (`fleet-tau.vercel.app`)
- [x] Vercel 환경변수 완비 (Phase 3.6 `DATABASE_URL`·`DIRECT_URL` 등 — 2026-07-07)
- [ ] Supabase production 설정 (dev → production 프로젝트 분리)
- [x] production 배포 및 도메인 확인 (API 200·대시보드 mock·tesla 데이터 표시, 2026-07-07)
- [ ] 배포 환경 데모 시나리오 최종 점검
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
