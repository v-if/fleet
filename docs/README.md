# FMS 프로젝트 문서 인덱스

차량 관제 시스템(FMS, Fleet Management System) 기획·설계 문서 모음이다. 1인 개발(Cursor AI) 기반으로 데모데이 MVP를 목표로 한다.

## 문서 목록

| 문서 | 내용 | 언제 보나 |
|------|------|-----------|
| [requirements.md](./requirements.md) | 핵심 요구사항 (개요·범위·기능·성공기준·일정·리스크·용어) | 무엇을 만들지 정할 때 |
| [requirements-benchmarking.md](./requirements-benchmarking.md) | UMOS ONE Pleos Fleet 벤치마킹, 기능 우선순위·화면·차별화 | 기능·화면 설계 참고할 때 |
| [requirements-tech-stack.md](./requirements-tech-stack.md) | 기술스택 정의 (Next.js+Supabase), 아키텍처·수집전략·보안 | 어떻게 만들지 정할 때 |
| [development-checklist.md](./development-checklist.md) | Phase별(M1~M5) 개발 체크리스트 | 개발 진행·진척 관리할 때 |
| [setup-guide.md](./setup-guide.md) | 단계별 설치 가이드 (Windows/PowerShell) | 도구를 Phase별로 설치할 때 |

## 핵심 결정 사항 요약

| 항목 | 결정 |
|------|------|
| 제품 | PC 웹 대시보드 중심 차량 관제 MVP |
| 타깃 차종 | 테슬라(Tesla) 1종 — 공식 Fleet API + OAuth |
| 데이터 수집 | 테슬라 Fleet API + Mock 폴백 (Deviceless) |
| 기술 스택 | TypeScript · Next.js · Supabase(PostgreSQL) · Prisma · Vercel |
| 지도 | Kakao Maps API |
| 방법론 | AI-assisted Lean MVP (Agile Lite) |
| 1차 목표 | 데모데이 시연 → 이후 투자 시 확장 |

## 참고 자료
- `benchmarking/UMOS-ONE.pdf`
- `benchmarking/UMOS-ONE-Pleos-Fleet.pdf`

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-06 | 문서 인덱스 생성 |
| 2026-07-06 | 개발 체크리스트·설치 가이드 문서 추가 |
