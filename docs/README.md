# FMS 프로젝트 문서 인덱스

차량 관제 시스템(FMS, Fleet Management System) 기획·설계 문서 모음이다. 1인 개발(Cursor AI) 기반으로 데모데이 MVP를 목표로 한다.

## 문서 목록

| 문서 | 내용 | 언제 보나 |
|------|------|-----------|
| [requirements.md](./requirements.md) | 핵심 요구사항 (개요·범위·기능·성공기준·일정·리스크·용어) | 무엇을 만들지 정할 때 |
| [requirements-benchmarking.md](./requirements-benchmarking.md) | UMOS ONE Pleos Fleet 벤치마킹, 기능 우선순위·화면·차별화 | 기능·화면 설계 참고할 때 |
| [requirements-tech-stack.md](./requirements-tech-stack.md) | 기술스택 정의 (Next.js+Supabase), 아키텍처·수집전략·보안 | 어떻게 만들지 정할 때 |
| [requirements-db.md](./requirements-db.md) | DB 전략, Vercel 배포 오류 분석, Phase 3.6 Supabase PostgreSQL 요구사항 | DB 전환·배포 DB 이슈 해결할 때 |
| [requirements-user-db.md](./requirements-user-db.md) | User·TeslaAccount·Vehicle 계층 DB, 연동 해제(Soft Delete)·Telemetry 요구사항 | 멀티 계정·차량 스키마 설계할 때 |
| [requirements-log-db.md](./requirements-log-db.md) | Tesla/FMS API 감사 로그 DB, 마스킹, 인터셉터·AuditLog 설계 | 로그 적재·감사 추적 설계할 때 |
| [requirements-virtual-vehicle-seeding.md](./requirements-virtual-vehicle-seeding.md) | `/vehicles`의 `차량 추가(가상)` 기반 데모용 차량/계정 랜덤 시드 요구사항 | sleep 상태 대안, 데모 차량 생성 설계할 때 |
| [requirements-tesla-fleet-telemetry.md](./requirements-tesla-fleet-telemetry.md) | Tesla Polling에서 Fleet Telemetry webhook/스트리밍 구조로 전환하기 위한 요구사항 (FMS 측) | FMS webhook/ingress 구현·운영할 때 |
| [requirements-fleet-telemetry.md](./requirements-fleet-telemetry.md) | **Fleet Telemetry 서버** 구축·FMS 연동 인수인계서 — **Fly.io 단독** (mTLS + relay) | Telemetry 서버 요구사항·§5 계약 확인할 때 |
| [requirements-fleet-telemetry-completed.md](./requirements-fleet-telemetry-completed.md) | Telemetry 서버 **개발 완료·보류 현황** · FMS 인수인계 (도메인·secrets·공동 검증) | Telemetry 연동·실차 E2E·시연 준비할 때 |
| [auth-user-mapping.md](./auth-user-mapping.md) | Phase 4 Supabase Auth ↔ FMS User 매핑 설계 메모 | 인증·다테넌시 구현 전 |
| [requirements-tesla-api.md](./requirements-tesla-api.md) | 테슬라 Fleet API 조회/제어 기능 정리, FMS 화면 적용안 | 데이터 연동·제어 기능 설계할 때 |
| [requirements-front-design.md](./requirements-front-design.md) | Pleos Fleet UI 벤치마킹, 프론트 구성·디자인 개선 요구사항 | 화면 UI/UX 개선할 때 |
| [requirements-dashboard-design.md](./requirements-dashboard-design.md) | TailAdmin 템플릿 벤치마킹, 디자인 토큰·컴포넌트 마감 개선 요구사항 (Phase 3.7) · **전면 템플릿 적용** (Phase 3.8) | 대시보드·목록·상세 디자인 다듬을 때 |
| [development-checklist.md](./development-checklist.md) | Phase별(M1~M5) 개발 체크리스트 | 개발 진행·진척 관리할 때 |
| [setup-guide.md](./setup-guide.md) | 단계별 설치 가이드 (Windows/PowerShell) | 도구를 Phase별로 설치할 때 |

## 핵심 결정 사항 요약

| 항목 | 결정 |
|------|------|
| 제품 | PC 웹 대시보드 중심 차량 관제 MVP |
| 타깃 차종 | 테슬라(Tesla) 1종 — 공식 Fleet API + OAuth |
| 데이터 수집 | 테슬라 Fleet API + Mock 폴백 (Deviceless) |
| Tesla 실데이터 | Phase 3 OAuth + **Phase 3.6 DB** + **Phase 3.5 Partner Register** (`412` 해결) |
| 기술 스택 | TypeScript · Next.js · Supabase(PostgreSQL) · Prisma · Vercel |
| 로컬 DB (현재) | **Supabase PostgreSQL** — Phase 3.6 로컬·Vercel 연결·API 200 완료 (2026-07-07) |
| 배포 상태 | **`https://bori-fleet.shop`** (Vercel) — API 200, mock·tesla 연동 / Telemetry: **`https://telemetry.bori-fleet.shop`** (Fly.io) |
| 지도 | Kakao Maps API |
| 방법론 | AI-assisted Lean MVP (Agile Lite) |
| 1차 목표 | 데모데이 시연 → 이후 투자 시 확장 |

## 참고 자료
- `benchmarking/UMOS-ONE.pdf`
- `benchmarking/UMOS-ONE-Pleos-Fleet.pdf`
- `benchmarking/dashboard.png` — Pleos Fleet 대시보드 UI
- `benchmarking/vehicles.png` — Pleos Fleet 차량 목록 UI
- `benchmarking/vehicles-info.png` — Pleos Fleet 차량 상세 UI

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-06 | 문서 인덱스 생성 |
| 2026-07-06 | 개발 체크리스트·설치 가이드 문서 추가 |
| 2026-07-06 | Phase 1 완료 — 앱 스캐폴딩, Prisma+SQLite, Mock API 반영 |
| 2026-07-06 | Phase 2 완료 — 대시보드/목록/지도/상세 UI, TanStack Query |
| 2026-07-07 | 테슬라 Fleet API 요구사항 문서 추가 (조회/제어 기능·FMS 적용안) |
| 2026-07-07 | 체크리스트에 Phase 2.1(§5.2 조회 데이터 화면 매핑, Mock 표시) 추가 |
| 2026-07-07 | Phase 2.1 완료 — §5.2 Mock 데이터 화면 매핑(충전·odometer·TPMS·센트리 등) |
| 2026-07-07 | 프론트 디자인 요구사항 문서·Phase 2.2 체크리스트 추가 (Pleos UI 벤치마킹) |
| 2026-07-07 | Phase 2.2 완료 — 지도 Hero·커스텀 마커·Tesla EV 테마·탭/위젯 UI |
| 2026-07-07 | Phase 3 완료 — Tesla OAuth, Fleet API Provider, 동기화 API, Mock 폴백 |
| 2026-07-07 | Tesla 리전 정정 — 한국 계정 `na` (Invalid audience 해결) |
| 2026-07-07 | Phase 3.5 — Tesla Partner Register(412) 체크리스트·가이드 추가 |
| 2026-07-07 | Phase 3.5 일부 진행 — EC 키 생성, `.well-known` 공개키 파일 배치 |
| 2026-07-07 | Phase 3.5 Register 진행 — 공개키 URL 확인, `bori-fleet.shop` Partner Register 완료 |
| 2026-07-07 | Phase 3.6 — requirements-db.md 추가, Prisma postgresql 전환·db:setup 스크립트 |
| 2026-07-07 | Phase 3.6 로컬 완료 — Supabase migrate·시드·API 200 / Phase 3.5 Register·Vercel 배포 대기 |
| 2026-07-07 | Phase 3.5·3.6 배포 검증 완료 — Vercel env·재배포, API 200, mock·tesla 연동, TPMS PSI 환산 |
| 2026-07-07 | requirements-dashboard-design.md 추가 — TailAdmin 벤치마킹 디자인 개선 요구사항 |
| 2026-07-07 | Phase 3.7 체크리스트 추가 — TailAdmin 디자인 개선 (development-checklist.md) |
| 2026-07-07 | Phase 3.7 구현 완료 — TailAdmin 벤치마킹 UI 개선(토큰·다크모드·3화면) |
| 2026-07-08 | Phase 3.8 완료 — TailAdmin 템플릿 전면 적용(데모 UI), FMS 기능 화면 `/fleet/*` 격리 |
| 2026-07-08 | Phase 3.8 P1 완료 — TailAdmin UI + FMS API 연동 (`/`, `/vehicles`, `/map`, `/settings`) |
| 2026-07-08 | Phase 3.8 P1 대시보드 레이아웃 — KPI 6카드·실시간 지도 1:1 가로 배치 |
| 2026-07-08 | Phase 3.8 P1 KPI 카드 — 아이콘·라벨 가로, 전 항목 % 배지 |
| 2026-07-08 | Phase 3.8 P1 배터리 — Demographic 스타일 프로그래스바 적용 |
| 2026-07-08 | Phase 3.8 P1 최근 차량 테이블 — 차량·상태·충전·배터리 컬럼 통일 |
| 2026-07-08 | Phase 3.8 P1 충전 현황 — 차량 모델 nowrap, 배터리 `120px` |
| 2026-07-08 | Phase 3.8 P1 충전·최근 차량 — 충전 컬럼 축소, 배터리 프로그래스바 확대 |
| 2026-07-08 | Phase 3.8 P1 최근 차량 — 상태·충전 배지 줄바꿈 방지, 배터리 폭 조정 |
| 2026-07-08 | Phase 3.8 P1 KPI — 전체 차량 Fleet 아이콘 배지 복구 |
| 2026-07-08 | Phase 3.8 P1 사이드바 — Fleet 브랜딩(자동차 아이콘 + 텍스트) |
| 2026-07-08 | Phase 3.8 P1 차량 목록 — 컬럼 폭 균형 재조정 |
| 2026-07-08 | requirements-user-db.md — User·TeslaAccount·Vehicle DB 요구사항 정의 (Phase 3.9) |
| 2026-07-08 | Phase 3.9 완료 — TeslaAccount·unlink API·active vehicle 필터 |
| 2026-07-08 | Phase 3.9 로그인 플로우 — `/signin`, 세션 쿠키, 차량 0대 초기 대시보드 |
| 2026-07-08 | 로그인 UI 정리 — 안내 문구 제거, `회원가입` 링크 `/signup` 연결 |
| 2026-07-08 | 차량 목록 UX 정리 — 설명 문구 제거, `차량 추가` 버튼 + 안내 모달 |
| 2026-07-08 | 차량 추가 모달 보강 — 확인 시 Tesla OAuth 이동, 배경 투명도 완화 |
| 2026-07-08 | 차량 추가 모달 미세 조정 — 배경 오버레이 추가 완화 |
| 2026-07-08 | TeslaAccount 세션 귀속 — OAuth·동기화 = 로그인 User, 레거시 admin 자동 생성 제거 |
| 2026-07-08 | Tesla 저장 정책 보강 — OAuth callback 원위치 복귀, placeholder/default 값 대신 `null` 저장 |
| 2026-07-08 | requirements-log-db.md — API 로그·감사 DB 요구사항 정의 |
| 2026-07-08 | Phase 4 P0 로그 구현 — `AuditLog`·`ApiCallLog`, Tesla/FMS 변경 API 로그 적재, 마스킹 |
| 2026-07-08 | requirements-virtual-vehicle-seeding.md — `차량 추가(가상)` 데모용 가상 차량 시드 요구사항 정의 |
| 2026-07-09 | requirements-tesla-fleet-telemetry.md — Tesla Fleet Telemetry 전환 요구사항 문서 추가 |
| 2026-07-10 | Phase 4.2 완료 — Telemetry webhook/ingress/비동기 처리, ASLEEP 추론, polling fallback, 설정 화면 Telemetry 상태 |
| 2026-07-10 | Telemetry primary 운영 — REST 자동 폴링 중지, registry-only sync, webhook 전용 VehicleSnapshot 갱신 |
| 2026-07-10 | Telemetry 점검 — `scripts/telemetry-webhook-check.ps1`, `scripts/telemetry-status.sql`, `GET /api/internal/telemetry/status` |
| 2026-07-10 | requirements-fleet-telemetry.md — 신규 Fleet Telemetry 서버 Fly.io 단독 구성 인수인계서 작성 |
| 2026-07-10 | 커스텀 도메인 — FMS `bori-fleet.shop`, Telemetry `telemetry.bori-fleet.shop` |
| 2026-07-10 | requirements-fleet-telemetry-completed.md — Telemetry 서버 개발 완료·보류 현황 FMS 인수인계 반영 |
| 2026-07-10 | P0 Telemetry E2E 실측 — 실차 V→PROCESSED·TELEMETRY, 사용자 잔여=로컬 secret·UI 리허설 |
