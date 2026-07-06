# FMS 개발 체크리스트

요구사항(`requirements.md`)·기술스택(`requirements-tech-stack.md`)을 기반으로 한 단계별 개발 체크리스트다. 각 Phase는 `requirements.md` §12 마일스톤(M1~M5)과 대응한다.

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
- [ ] Supabase 프로젝트 생성 (dev) — **Phase 1은 로컬 SQLite로 대체, Supabase는 Phase 4 인증·배포 시 연결**
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
- Prisma **6.19** + **SQLite** (`prisma/dev.db`) 로컬 개발 DB 구성 (Supabase PostgreSQL은 이후 전환)
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

## Phase 3. 데이터 연동 (M3)

> 설치: [setup-guide.md](./setup-guide.md) §5

### 테슬라 Fleet API (P0~P1)
- [ ] Tesla 개발자 앱 등록 / OAuth 클라이언트 발급
- [ ] `TeslaVehicleProvider` 구현 (OAuth 인증 흐름)
- [ ] 토큰 저장·갱신 처리
- [ ] 실 차량 데이터 → 내부 스냅샷 모델 매핑

### 동기화
- [ ] 데이터 동기화 로직 (Provider → DB upsert)
- [ ] Vercel Cron 또는 API 라우트 기반 주기 폴링(1~5분)
- [ ] `mock` ↔ `tesla` 환경변수 전환 검증 (30초 내 전환)

**완료 기준**: 실제 테슬라 데이터(또는 실패 시 Mock 폴백)로 대시보드 갱신

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

- [ ] Vercel 프로젝트 연결 및 환경변수 등록
- [ ] Supabase production 설정
- [ ] production 배포 및 도메인 확인
- [ ] 배포 환경 데모 시나리오 최종 점검
- [ ] 데모데이 시연 및 피드백 수집

---

## Phase 6. 이후 확장 (P1~P2, 투자 이후)

- [ ] 기간별 운행 이력·동선 재생 (P1)
- [ ] Geofencing 관심 지역 (P1)
- [ ] 운행 거리·시간 집계·리포트 export (P1)
- [ ] 위험 운전 이벤트 카운트 (P1)
- [ ] 원격 차량 제어 (P2)
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
