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
| [requirements-tesla-fleet-api-display-data.md](./requirements-tesla-fleet-api-display-data.md) | 프론트 고도화 선행 — Fleet API 표시 항목 조사, **정적/동적** 분류 | 화면 고도화·제원/실시간 데이터 설계할 때 |
| [requirements-vehicle-detail-ui.md](./requirements-vehicle-detail-ui.md) | **차량 상세** 고도화 — 실차 DB 대조, 관리자 IA·표현·Phase (VD-1~3) | 상세 UI/UX 구현 전에 |
| [requirements-vehicle-detail-ui2.md](./requirements-vehicle-detail-ui2.md) | 차량 상세 **표시 문구·배치** — VD-UX2 (A~G 완료) | 카피·위치 카드 검수 |
| [requirements-vehicle-detail-ops-copy.md](./requirements-vehicle-detail-ops-copy.md) | **VD-OPS** — 새로고침/제원/재연동 안내 (TRF-B1) · ✅ | 상세 운영 문구 |
| [requirements-vehicle-detail-vd3.md](./requirements-vehicle-detail-vd3.md) | **VD3** — Telemetry 시대 상세 · `/vehicles/[id]/v3` ✅ · 실차 ☐ | 상세 비교 |
| [requirements-vehicle-detail-vd3-specs-popover.md](./requirements-vehicle-detail-vd3-specs-popover.md) | **VD3-S** — Hero `i` 제원 모달 · Tier B 필드 · 코드 ✅ · 실차 ☐ | V3 제원 UX |
| [checklist-vehicle-detail-vd3.md](./checklist-vehicle-detail-vd3.md) | Phase VD3-1b~4 ✅ · VD3-6~7 ☐ | VD3 검수 |
| [research/research-vehicles-detail-chatgpt.md](./research/research-vehicles-detail-chatgpt.md) | 상세 UI 리서치 (FMS 관리자 IA) | VD3 근거 |
| [research/research-vehicles-detail-gemini.md](./research/research-vehicles-detail-gemini.md) | 상세 UI 리서치 (Cockpit·모드·제어·네비) | VD3 근거 |
| [checklist-vehicle-detail-ops-copy.md](./checklist-vehicle-detail-ops-copy.md) | Phase VD-OPS ✅ | 검수 |
| [requirements-charging-card.md](./requirements-charging-card.md) | 상세 「충전 중」서브카드 (CC-A~D ✅) — 완속/급속 포함 | 충전 UX · migrate·실차 검수 |
| [checklist-charging-card.md](./checklist-charging-card.md) | Phase CC 체크리스트 · 실차 검수 남음 | CC 구현·검수 |
| [requirements-car-info-card.md](./requirements-car-info-card.md) | 상세 3×2+TPMS (CI-A~D ✅) · **§10 카드 평가·CI-E 후보** | 차체·퀵타일 · 개선 검토 |
| [checklist-car-info-card.md](./checklist-car-info-card.md) | Phase CI 체크리스트 · 실차 검수 남음 | CI 구현·검수 |
| [requirements-vehicle-asleep-status.md](./requirements-vehicle-asleep-status.md) | 절전/ONLINE 정합 · **Hobby=안1** · **Pro Cron=보류** | 목록·상세 뱃지 |
| [checklist-vehicle-asleep-status.md](./checklist-vehicle-asleep-status.md) | Phase AS-H ✅ · AS-B(Pro) 보류 · AS-C 검수 | AS 검수 |
| [requirements-vehicle-location-null.md](./requirements-vehicle-location-null.md) | **LN-R ✅** — REST null GPS 시 이전 좌표 유지 | 위치 유실 · `writeRestSnapshot` |
| [checklist-vehicle-location-null.md](./checklist-vehicle-location-null.md) | Phase LN-R 코드 ✅ · LN-QA 실차 ☐ | LN 검수 |
| [checklist-vehicle-detail-ui2.md](./checklist-vehicle-detail-ui2.md) | Phase UX2-A~G ✅ · 실차 수동 검수 남음 | UX2 구현·실차 검수할 때 |
| [checklist-vehicle-detail-ui.md](./checklist-vehicle-detail-ui.md) | 차량 상세 UI Phase VD-1~3 체크리스트 | VD 구현·검수할 때 |
| [requirements-tesla-api-bugfix-0712.md](./requirements-tesla-api-bugfix-0712.md) | 실차 검증 **도어/트렁크·인근충전소 고착** 버그 원인·수정 요구 (BF-1~3) | 표시 데이터 버그 수정 전에 |
| [checklist-tesla-api-bugfix-0712.md](./checklist-tesla-api-bugfix-0712.md) | Phase BF-A~E 구현 체크리스트 (미착수) | BF 구현·실차 검수할 때 |
| [checklist-onboarding-e2e-reset.md](./checklist-onboarding-e2e-reset.md) | 온보딩 E2E DB 리셋 · **2026-07-15 실행 완료** · TRF-B1 시나리오 | 첫 연동 재검증 |
| [requirements-tesla-api-bug-report-0712.md](./requirements-tesla-api-bug-report-0712.md) | 위 이슈의 **현장 관찰·가설 원문** | 재현 시나리오 참고 |
| [requirements-tesla-fleet-api-telemetry-webhook.md](./requirements-tesla-fleet-api-telemetry-webhook.md) | Telemetry vs Fleet API **하이브리드 호출** — ASLEEP 금지·이벤트 주도 REST | 수집 전략·wake/쿨다운 설계할 때 |
| [requirements-tesla-fleet-telemetry-config.md](./requirements-tesla-fleet-telemetry-config.md) | **fleet_telemetry_config** create · **CAF 44키** | 구독·재구독 |
| [requirements-tesla-fleet-telemetry-config-add-field.md](./requirements-tesla-fleet-telemetry-config-add-field.md) | **CAF** P0/P1·REST-1 · 코드 ✅ | 필드 확장 |
| [checklist-tesla-fleet-telemetry-config-add-field.md](./checklist-tesla-fleet-telemetry-config-add-field.md) | Phase CAF-2~4 ✅ · CAF-6 실차 ☐ | CAF 검수 |
| [requirements-tesla-telemetry-rest-freeze.md](./requirements-tesla-telemetry-rest-freeze.md) | **TRF** — Freeze(미졸업 REST 차단) · Baseline 졸업 · Wake 대기 | 경로 졸업 모델 |
| [requirements-tesla-telemetry-rest-baseline-specs.md](./requirements-tesla-telemetry-rest-baseline-specs.md) | **TRF-B1** — specs-only Baseline · Tier A/B/C · 코드 ✅ · 실차 ☐ | Baseline 제원 |
| [requirements-tesla-wake-telemetry-rest.md](./requirements-tesla-wake-telemetry-rest.md) | **TRF-B2** — 절전→Online Telemetry · park nearby 졸업 · 코드 ✅ · 실차 ☐ | Wake 재정의 |
| [requirements-nearby-charging-catalog.md](./requirements-nearby-charging-catalog.md) | **NCS** — nearby 카탈로그 Upsert · asleep 폴백 · 코드 ✅ · 실차 ☐ | 인근충전소 |
| [checklist-nearby-charging-catalog.md](./checklist-nearby-charging-catalog.md) | Phase NCS-2~4 ✅ · NCS-5 ☐ | NCS 검수 |
| [checklist-tesla-telemetry-rest-freeze.md](./checklist-tesla-telemetry-rest-freeze.md) | Phase TRF · Freeze ✅ · Baseline·park nearby 졸업 ✅ · B2 실차 ☐ | TRF 검수 |
| [requirements-tesla-fleet-telemetry-value-monitor.md](./requirements-tesla-fleet-telemetry-value-monitor.md) | 상세 **Telemetry 수신 로그(개발)** — 요구1 ✅ · 요구2 미착수 | 수신·매핑 검증 UI |
| [requirements-tesla-hybrid-data-model.md](./requirements-tesla-hybrid-data-model.md) | 하이브리드 **DB 설계** — Vehicle 제원 + VehicleSyncState + Snapshot 쓰기 경로 | 스키마·마이그레이션·sync 구현할 때 |
| [checklist-tesla-hybrid-data.md](./checklist-tesla-hybrid-data.md) | Phase 4.4 구현 체크리스트 (A~E) | 하이브리드 데이터 작업 진척·완료 확인 |
| [handoff-phase44-to-fleet-telemetry.md](./handoff-phase44-to-fleet-telemetry.md) | Phase 4.4 → **Telemetry 서버 전달 사항** (배포 불필요·인지/선택 과제) | Telemetry 담당에 공유·이슈 붙일 때 |
| [requirements-tesla-fleet-telemetry-disconnect.md](./requirements-tesla-fleet-telemetry-disconnect.md) | Telemetry **연동 해제** — 오프라인(VK)/소프트웨어(FMS), A·B 분리, UI·체크리스트 | 구독 끊기·프라이버시·과금·unlink 분리 설계할 때 |
| [checklist-tesla-fleet-telemetry-disconnect.md](./checklist-tesla-fleet-telemetry-disconnect.md) | Phase 4.5 연동 해제 구현 체크리스트 | 연동 해제 작업 진척 관리할 때 |
| [requirements-tesla-vehicle-command-proxy.md](./requirements-tesla-vehicle-command-proxy.md) | **Command Proxy** 요구·인수 (Proxy 측 배포 완료) | Proxy/재연동 create·Vercel env |
| [handoff-fms.md](./handoff-fms.md) | Proxy→**FMS** 인수인계 — `bori-cmd-proxy` URL·Vercel env·E2E 잔여 | Vercel에 Proxy URL 넣을 때 |
| [requirements-tesla-fleet-api-model-mapping.md](./requirements-tesla-fleet-api-model-mapping.md) | `car_type`·`trim_badging` → 화면 모델명 매핑 | 차량 제원 표시·Vehicle 컬럼 추가할 때 |
| [requirements-tesla-fleet-api-model-mapping2.md](./requirements-tesla-fleet-api-model-mapping2.md) | 동적 필드 — `chargerPowerKw`·**`shiftState`**(Gear) REST/Telemetry 매핑 (MM2-A~B ✅) | Snapshot 변속 저장·충전기 kW 정합 |
| [checklist-tesla-fleet-api-model-mapping2.md](./checklist-tesla-fleet-api-model-mapping2.md) | Phase MM2 체크리스트 · migrate·실차 검수 남음 | MM2 구현·검수 |
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
| 지도 | Naver Maps API v3 |
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
| 2026-07-11 | requirements-tesla-fleet-api-display-data / model-mapping — 프론트 고도화 선행 조사·정적·동적 분류 문서화 |
| 2026-07-11 | requirements-tesla-fleet-api-telemetry-webhook — Telemetry+REST 하이브리드 호출 최종 요구사항 |
| 2026-07-11 | requirements-tesla-hybrid-data-model + checklist-tesla-hybrid-data — Phase 4.4 설계·체크리스트 (코드 미착수) |
| 2026-07-11 | Phase 4.4.A 완료 — Vehicle 제원·VehicleSyncState migrate (`20260711120000_phase44a_hybrid_data_model`) |
| 2026-07-11 | Phase 4.4.B 완료 — Baseline/wake 쿨다운·VK confirm·제원 분리 Sync |
| 2026-07-11 | Phase 4.4.C 완료 — vehicles API 제원/lifecycle/freshness · baseline 재시도 |
| 2026-07-11 | Phase 4.4.D 완료 — 목록/상세 제원·lifecycle UI · 설정 온보딩 |
| 2026-07-11 | Phase 4.4.E 완료 — hybrid:verify · telemetry:check · setup-guide 온보딩 · Phase 4.4 마감 |
| 2026-07-11 | handoff-phase44-to-fleet-telemetry — Telemetry 서버 전달 사항(배포 불필요) 정리 |
| 2026-07-11 | requirements-tesla-fleet-telemetry-disconnect — 연동 해제(A/B·fleet_status·UI·체크리스트) |
| 2026-07-11 | checklist-tesla-fleet-telemetry-disconnect — Phase 4.5 체크리스트 |
| 2026-07-11 | Phase 4.5 A~C 완료 — Telemetry disconnect/reconnect · UI · D·P1 잔여 |
| 2026-07-11 | Phase 4.5 D 완료 — disconnect:verify · VIN LRWYGCFJ7SC214742 · P1 감지기 잔여 |
| 2026-07-12 | requirements-tesla-vehicle-command-proxy — Fly Proxy·Vercel env·재연동 create 요구사항 |
| 2026-07-12 | Command Proxy 문서를 **신규 개발자 인수인계서**로 개편 |
| 2026-07-12 | handoff-fms — Proxy 배포 완료·FMS Vercel env/E2E 잔여 (`bori-cmd-proxy`) |
| 2026-07-12 | Phase VD-1 — 차량 상세 UI ([requirements-vehicle-detail-ui.md](./requirements-vehicle-detail-ui.md), [checklist-vehicle-detail-ui.md](./checklist-vehicle-detail-ui.md)) |
| 2026-07-12 | Phase VD-2 — 차량 상세 운영 진단 UI 완료 |
| 2026-07-12 | Phase VD-3 — charge/doors/nearby/service/alerts 파이프·UI 완료 |
| 2026-07-12 | requirements-tesla-api-bugfix-0712 — 실차 도어/트렁크·인근충전소 고착 BF-1~3 요구사항 (코드 미착수) |
| 2026-07-12 | bugfix §3.1.1 — Telemetry 구독×파서×merge 전수 조사 (Sentry/Gear/창문/TPMS 등) |
| 2026-07-12 | checklist-tesla-api-bugfix-0712 — Phase BF-A~E 체크리스트 · development-checklist Phase BF |
| 2026-07-12 | Phase BF 코드 완료 — DoorState/typed 파서·nearby·구독 확장 (실차 검수 잔여) |
| 2026-07-12 | 온보딩 E2E 리셋 가이드 · `reset-fms-data.mjs` (--confirm/--unsubscribe) |
| 2026-07-13 | requirements-vehicle-detail-ui2 — 상세 표시 문구(법인 관리자 언어) VD-UX2 |
| 2026-07-13 | checklist-vehicle-detail-ui2 · development-checklist Phase UX2 (미착수) |
| 2026-07-13 | Phase UX2 구현 완료 — 체크리스트·요구사항 상태 갱신 |
| 2026-07-13 | UX2-D(UX2-9~11) 후속 — 툴바·상단 중복 권고를 체크리스트·관련 문서에 반영 |
| 2026-07-13 | UX2-D 구현 완료 반영 |
| 2026-07-13 | UX2-E(UX2-12~15) 구현 완료 반영 |
| 2026-07-13 | UX2-F(UX2-16~20) 후속 — 상단 2열·퀵타일·TPMS 권고 반영 |
| 2026-07-13 | UX2-F 구현 완료 반영 |
| 2026-07-13 | UX2-G(UX2-21~22) 후속 — 위치 캡션·인근충전소 권고 반영 |
| 2026-07-13 | UX2-G 구현 완료 — hideSelectionCard · 맵 아래 인근충전소 |
| 2026-07-13 | Telemetry value-monitor 요구1 — 상세 수신 로그(개발) |
| 2026-07-14 | requirements-tesla-fleet-api-model-mapping2 — shiftState·충전기 kW 매핑 요구 (미착수) |
| 2026-07-14 | MM2-A~B 구현 완료 — shiftState Snapshot·checklist |
| 2026-07-14 | requirements-charging-card — 충전 서브카드 UX 요구 (미착수) |
| 2026-07-14 | Phase CC-A~B 구현 — ChargingSessionCard · checklist |
| 2026-07-14 | charging-card §5.4 — 완속/급속 표시 요구 (CC-D 미착수) |
| 2026-07-14 | Phase CC-D 구현 — chargingPowerKind · 완속/급속 UI |
| 2026-07-14 | requirements-car-info-card — TPMS+온도+Gear 다이어그램 요구 (미착수) |
| 2026-07-14 | Phase CI-A~B 구현 — 타이어·차체 다이어그램 · 퀵타일 4칸 |
| 2026-07-14 | Phase CI-C 구현 — vehicle-sample.html 차체·타이어 고도화 |
| 2026-07-14 | Phase CI-D 구현 — 3×2 퀵타일(잠금·감시모드·공조·변속·실내·실외) |
| 2026-07-14 | CI-D 순서 변경 — 잠금·변속·감시모드·공조·실내·실외 |
| 2026-07-14 | requirements-car-info-card §10 — 「실시간 차량 정보」카드 평가·개선안 |
| 2026-07-15 | requirements-vehicle-asleep-status — 목록/상세 절전 불일치 · 안 2 요구 (미착수) |
| 2026-07-15 | Phase AS-A~B 구현 — vercel Cron · lastUpdatedAt · 목록 GET infer 제거 |
| 2026-07-15 | Phase AS — Hobby는 안1(목록·상세 infer) · 안2 Cron은 Pro 보류 |
| 2026-07-15 | requirements/checklist-vehicle-location-null — Snapshot 위경도 null (LN) |
| 2026-07-15 | LN — REST overwrite(LN-R) 확정 · 문서 개정 |
| 2026-07-15 | LN-R 구현 — `mergeSnapshotCoordinates` · `npm run ln:verify` |
| 2026-07-15 | requirements-tesla-fleet-telemetry-config — 구독 fields·create 문서 |
| 2026-07-15 | CAF — Telemetry P0/P1·REST-1 제원 분리 요구 (config-add-field) |
| 2026-07-15 | CAF 체크리스트 · hybrid/setup/개발 체크리스트 연결 |
| 2026-07-15 | CAF-2~4 구현 반영 (44키 · migrate · UI) |
| 2026-07-15 | TRF — Telemetry 검증 REST Freeze · Baseline/Wake 재정의 요구 |
| 2026-07-15 | TRF-A Freeze 코드 ✅ (`TESLA_REST_FREEZE`) · TRF-4 QA · B 대기 |
| 2026-07-15 | TRF-B1 — 온보딩 최초 REST 제원 재정의 요구 초안 |
| 2026-07-15 | TRF-B1-3 코드 — `writeVehicleSpecs` · Vehicle 제원 컬럼 migrate |
| 2026-07-15 | TRF Freeze 졸업 — Baseline 예외 · Wake 등 차단 유지 |
| 2026-07-15 | 온보딩 E2E — Production DB 리셋 (User만 유지 · Telemetry config DELETE) |
| 2026-07-15 | VD-OPS — 차량상세 운영 안내·버튼 문구 (TRF-B1 정합) |
| 2026-07-15 | TRF-B2 — 절전→Online Wake/Telemetry 요구 초안 |
| 2026-07-15 | TRF-B2 코드 ✅ — Wake/Gear 폐기 · park nearby 졸업 |
| 2026-07-15 | VD3 — 차량상세 Telemetry 시대 IA 요구 초안 |
| 2026-07-15 | VD3 `/vehicles/[id]/v3` · As-Is 병렬 UI |
| 2026-07-16 | NCS — nearby 카탈로그 DB · asleep 폴백 요구 초안 |
| 2026-07-16 | NCS-2~4 코드 — ChargingStation · 폴백 · `ncs:verify` |
| 2026-07-16 | VD3-S — Hero `i` 제원 모달 요구 초안 |
| 2026-07-16 | VD3-S-2·S-3 코드 ✅ — Specs Modal · 하단 제원 카드 제거 |
