# FMS 프로젝트 문서 인덱스

차량 관제 시스템(FMS, Fleet Management System) 기획·설계 문서 모음이다. 1인 개발(Cursor AI) 기반으로 데모데이 MVP를 목표로 한다.

## 문서 목록

| 문서 | 내용 | 언제 보나 |
|------|------|-----------|
| [requirements.md](./requirements.md) | 핵심 요구사항 (개요·범위·기능·성공기준·일정·리스크·용어) | 무엇을 만들지 정할 때 |
| [requirements-benchmarking.md](./requirements-benchmarking.md) | UMOS ONE Pleos Fleet 벤치마킹, 기능 우선순위·화면·차별화 | 기능·화면 설계 참고할 때 |
| [requirements-tech-stack.md](./requirements-tech-stack.md) | 기술스택 정의 (Next.js+Supabase), 아키텍처·수집전략·보안 | 어떻게 만들지 정할 때 |
| [requirements-db.md](./requirements-db.md) | DB 전략, Vercel 배포 오류 분석, Phase 3.6 Supabase PostgreSQL 요구사항 | DB 전환·배포 DB 이슈 해결할 때 |
| [requirements-tesla-api.md](./requirements-tesla-api.md) | 테슬라 Fleet API 조회/제어 기능 정리, FMS 화면 적용안 | 데이터 연동·제어 기능 설계할 때 |
| [requirements-front-design.md](./requirements-front-design.md) | Pleos Fleet UI 벤치마킹, 프론트 구성·디자인 개선 요구사항 | 화면 UI/UX 개선할 때 |
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
| 배포 상태 | `fleet-tau.vercel.app` — API 200, mock·tesla 연동 검증 완료 (dev Supabase 공유) |
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
| 2026-07-07 | Phase 3.5 Register 진행 — 공개키 URL 확인, `fleet-tau.vercel.app` Partner Register 완료 |
| 2026-07-07 | Phase 3.6 — requirements-db.md 추가, Prisma postgresql 전환·db:setup 스크립트 |
| 2026-07-07 | Phase 3.6 로컬 완료 — Supabase migrate·시드·API 200 / Phase 3.5 Register·Vercel 배포 대기 |
| 2026-07-07 | Phase 3.5·3.6 배포 검증 완료 — Vercel env·재배포, API 200, mock·tesla 연동, TPMS PSI 환산 |
