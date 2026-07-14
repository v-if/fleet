# Phase AS — 주차(절전) / ONLINE 표시 정합 체크리스트

관련 요구사항: [requirements-vehicle-asleep-status.md](./requirements-vehicle-asleep-status.md)  
상태: **Hobby = 안 1 (AS-H) 운영** · **안 2 Cron = Pro 보류** · AS-C 실차 검수 남음

---

## 이슈 ↔ Phase

| ID | 요구 | Phase | Hobby | Pro |
|----|------|-------|:----:|:---:|
| AS-1 | 원인 문서화 | — | ✅ | ✅ |
| AS-4 | ASLEEP `lastUpdatedAt` | AS-A | ✅ | 유지 |
| AS-H1 | 목록 GET infer (안1) | AS-H | ✅ | → AS-5로 제거 |
| AS-H2 | 상세 GET infer (안1) | AS-H | ✅ | → AS-6로 제거 |
| AS-2 | Cron SoT | AS-A/B | 보류 | ☐ |
| AS-3 | Cron Jobs 실가동 | AS-A/B | 보류 | ☐ |
| AS-5 | 목록 GET infer 제거 | AS-B | **안 함** | ☐ |
| AS-6 | 상세 GET infer 제거 | AS-B | **안 함** | ☐ |
| AS-7~9 | 실차 검수 | AS-C | ☐ | Pro 재검수 |
| AS-10 | webhook after 중복 | — | ✅ | ✅ |

---

## AS-H — Hobby 안 1 — ✅

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | `GET /api/vehicles` → `inferAsleepVehicles` | ✅ |
| 2 | `GET /api/vehicles/[id]` → `inferAsleepVehicles` | ✅ |
| 3 | AS-4 `lastUpdatedAt` | ✅ |

### 수동 검수 (Hobby)

- [ ] 상세만 열기 · stale 후 「주차 (절전)」 · 목록과 동일 (새로고침 불필요)
- [ ] Telemetry 재개 → ONLINE
- [ ] VIN `LRWYGCFJ7SC214742`

---

## AS-A — Cron 준비 (코드 ✅ · Hobby 운영 보류)

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| 1 | `vercel.json` cron | ☐ Pro 시 추가 | Hobby: **비움** (`*/2`면 배포 스킵) |
| 2 | process endpoint · secret | ✅ | Pro에서 Jobs 확인 |
| 3 | setup-guide §7.2 | ✅ | |

---

## AS-B — Pro 전환 시 (보류)

| # | 항목 | 상태 |
|---|------|:----:|
| 1 | Cron Jobs 2분 Succeeded 확인 | ☐ Pro |
| 2 | 목록 GET infer 제거 (AS-5) | ☐ |
| 3 | 상세 GET infer 제거 (AS-6) | ☐ |
| 4 | AS-C 재검수 | ☐ |

**전환은 Cron 실가동 확인과 같은 배포에서.**

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-15 | AS-A~B 체크리스트 · 이후 Hobby→안1 · Pro 보류로 개정 |
| 2026-07-15 | **AS-H 구현** — 목록·상세 GET infer |
