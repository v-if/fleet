# 차량 목록·상세 — 주차(절전) / ONLINE 표시 정합 (AS)

| 항목 | 내용 |
|------|------|
| 목적 | 목록과 상세의 「주차 (절전)」/`ONLINE` 뱃지가 **동일 Snapshot**을 보도록 Telemetry 부재 추론 경로를 정합한다 |
| 증상 | Telemetry 무신호인데 목록은 「주차 (절전)」, 상세는 `ONLINE` 유지 · 상세 새로고침 후에야 맞춤 |
| 적용 | `GET /api/vehicles` · `GET /api/vehicles/[id]` · `inferAsleepVehicles` · (Pro) Cron → `/api/internal/telemetry/process` |
| 관련 | [requirements-tesla-fleet-api-telemetry-webhook.md](./requirements-tesla-fleet-api-telemetry-webhook.md), [checklist-vehicle-asleep-status.md](./checklist-vehicle-asleep-status.md) |
| **현행 채택** | **안 1 (Hobby)** — 목록·상세 GET에서 `inferAsleepVehicles` |
| **종착 (보류)** | **안 2 (Pro Cron)** — `vercel.json` 준비됨 · **Vercel Pro 업그레이드 시 활성화** |
| 상태 | Hobby 안1 운영 · 안2/AS-B(목록 infer 제거)는 Pro까지 **보류** · AS-4(`lastUpdatedAt`)는 유지 |
| 작성일 | 2026-07-15 |

---

## 1. 배경 · 현장 관찰

1. Telemetry **online 이력** 후 **무신호** → 「주차 (절전)」이어야 함.  
2. 목록은 절전으로 바뀌고 상세는 `ONLINE` 잔류 → **표시 사전은 같고 DB 쓰기 시점만 다름**.  
3. 잠금은 webhook 푸시 + UI 폴링으로 상세만 열어 두어도 갱신. 절전은 **부재 추론**이라 같은 패턴이 아님.

---

## 2. 내부 로직 (왜 달랐는가)

### 2.1 표시

둘 다 `snapshot.status` → `STATUS_LABEL` (`ASLEEP` = 「주차 (절전)」). 클라이언트 재계산 없음.

### 2.2 잠금 vs 절전

| | 잠금 | 주차(절전) |
|---|------|------------|
| 입력 | `Locked` 이벤트 | **신호 부재** (이벤트 없음) |
| DB | webhook → Snapshot | `inferAsleepVehicles()` |
| UI | 60s 폴링 읽기 | 추론이 DB에 쓴 뒤에야 반영 |

### 2.3 `inferAsleepVehicles`

- stale: `TESLA_TELEMETRY_STALE_AFTER_SECONDS` (기본 300초)  
- stale → `ASLEEP` + `isAsleepInferred`  
- 신호 신선 + 기존 절전 추론 → `ONLINE`  
- **AS-4:** ASLEEP 행 `lastUpdatedAt: new Date()` (최신 Snapshot 선택)

### 2.4 불일치 원인 (수정 전)

```
목록 GET  → infer 실행 → ASLEEP 기록 → 표시 OK
상세 GET  → infer 없음  → ONLINE 잔류
상세 새로고침 → 목록 API 경유 infer → 그때 맞춤
```

목록만 안 **1과 같은 패턴**, 상세는 빠져 있었음.

---

## 3. 수정 방향 · Hobby / Pro 결정

| 안 | 내용 | 평가 |
|----|------|------|
| **1** | 목록 **및 상세** GET에서 `inferAsleepVehicles` | Hobby에서 **채택**. 잠금과 아키텍처는 다르지만 목록·상세 **정합·무신호 갱신**에 충분. UI 60s 폴링 = 사실상 추론 주기 |
| **2** | Vercel Cron이 SoT · GET은 읽기만 | **종착 권고** · 잠금에 가까운 “DB 먼저”. **Hobby 2분 cron 불가/제한 → Pro 업그레이드까지 보류** |
| **3** | ASLEEP `lastUpdatedAt` = now | **양쪽 공통 필수** · 이미 적용(AS-4) |
| **4** | 수동 새로고침만 | 비권고 |

### 3.1 결론 (2026-07-15)

| 구간 | 정책 |
|------|------|
| **지금 (Vercel Hobby)** | **안 1** — 목록·상세 GET에 infer. AS-4 유지. |
| **나중 (Vercel Pro)** | **안 2** — Cron 2분 SoT → AS-5(목록 infer 제거)·상세 infer 제거. `vercel.json`은 이미 커밋되어 있음. |
| Cron 코드/`vercel.json` | **삭제하지 않음** — Pro에서 스케줄이 의미를 갖게 되면 AS-B 재개 |

**안 1이 Hobby에 좋은가?** → **예.**  
이유: (1) Cron 없이 무신호 ASLEEP을 쓸 경로가 webhook `after()`만으로는 부족 (2) 목록과 상세를 **같은 side-effect**로 맞추면 원 증상 해소 (3) 폴링 60초 ≈ 운영상 허용 지연 (4) Pro에서 안 2로 되돌리기 쉬움(GET에서 infer 블록만 제거).

**주의:** GET마다 전체 차량 infer → 차량 수↑ 시 목록/상세 TTFB 증가. 규모 확대 전 Pro+안 2로 이전하는 것이 맞음.

---

## 4. To-Be

### 4.1 Hobby — 안 1 (현행)

```
[목록 GET /api/vehicles]     → inferAsleepVehicles → 읽기
[상세 GET /api/vehicles/id]  → inferAsleepVehicles → 읽기
[webhook after()]            → infer (보조, 유지)
[Cron / process]             → 준비됨 · Hobby에서 실질 비활성/드묾 → 의존하지 않음
```

목표 UX: 상세만 열어도 ~60s(+ stale 임계) 내 목록과 같은 「주차 (절전)」.

### 4.2 Pro — 안 2 (보류 · 업그레이드 시)

```
[Cron */2]  GET /api/internal/telemetry/process → infer (SoT)
[목록·상세 GET]  읽기만 (infer 제거)
[webhook after()]  유지 가능
```

`vercel.json` · setup-guide §7.2 · secret(`CRON_SECRET`) 문서 유지.

---

## 5. 요구사항 ID

| ID | 요구 | Hobby | Pro 시 | 상태 |
|----|------|:-----:|:------:|:----:|
| **AS-1** | 원인 문서화 | — | — | ✅ |
| **AS-4** | ASLEEP `lastUpdatedAt: now` | 필수 | 유지 | ✅ |
| **AS-H1** | 목록 GET에서 `inferAsleepVehicles` (안1) | **필수** | 제거→AS-5 | ✅ Hobby |
| **AS-H2** | 상세 GET에서 `inferAsleepVehicles` (안1) | **필수** | 제거 | ✅ Hobby |
| **AS-2** | Cron이 infer SoT | 보류 | 필수 | ☐ Pro |
| **AS-3** | Cron secret · runbook · Jobs 확인 | 보류 | 필수 | ☐ Pro (`vercel.json` 준비 ✅) |
| **AS-5** | 목록 GET infer **제거** | **하지 않음** | 필수 | ☐ Pro |
| **AS-6** | 상세 GET infer **제거** | **하지 않음** | 필수 | ☐ Pro |
| **AS-7~9** | 실차 정합 검수 | Hobby 기준 | Pro 재검수 | ☐ |
| **AS-10** | webhook after + (Cron\|GET) 중복 무해 | ✅ | ✅ | ✅ |

---

## 6. Phase

| Phase | 범위 | 상태 |
|-------|------|:----:|
| **AS-A** | Cron 코드·`vercel.json`·AS-4 · runbook 준비 | ✅ 준비 / **Hobby에서 Cron 운영 보류** |
| **AS-H** | 안 1 — 목록·상세 GET infer (Hobby 운영) | ✅ |
| **AS-B** | GET infer 제거 · Cron SoT만 (안 2) | ☐ **Pro 업그레이드 후** |
| **AS-C** | 실차 검수 | ☐ (Hobby: 안1 기준) |

---

## 7. 수용 기준

### Hobby (안 1)

- [x] 목록·상세 GET 모두 Telemetry primary 시 infer (코드)
- [x] ASLEEP `lastUpdatedAt` now (코드)
- [ ] 상세만 열어도 stale 후 「주차 (절전)」 · 목록과 일치 (실차)
- [ ] 신호 재개 → ONLINE
- [ ] 수용 VIN: `LRWYGCFJ7SC214742`

### Pro (안 2 · 보류)

- [ ] Cron Jobs 2분 Succeeded · `asleepUpdated` 관찰
- [ ] 목록·상세 GET infer 제거 후에도 절전 갱신
- [ ] 상세 수동 새로고침 0회 · 목록과 일치

---

## 8. 리스크

| 항목 | 내용 |
|------|------|
| Hobby+안2만(AS-B) | Cron 미동작 시 **절전 추론 공백** → **금지**. Hobby는 안1 유지 |
| 안1 장기 | 차량↑ 시 GET 지연 → Pro 이전 트리거 |
| Pro 이전 시 | AS-H1/H2 제거와 Cron 실가동을 **같은 배포**에서 |

비권고: 클라이언트 stale 위장 · 안 4.

---

## 9. 구현 메모

**Hobby (현행)**  
- `src/app/api/vehicles/route.ts` — infer  
- `src/app/api/vehicles/[id]/route.ts` — infer  
- `processor.ts` — AS-4 `lastUpdatedAt`  
- `vercel.json` — Pro용으로 유지(삭제 금지)

**Pro 전환 체크리스트 요지**  
1. Production Cron Jobs 2분 확인  
2. AS-5·AS-6 (GET infer 제거)  
3. AS-C 재검수  

---

## 10. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-15 | 불일치 분석 · 안 2(+3) 요구 · AS-A~B 구현 |
| 2026-07-15 | **Hobby → 안 1 채택** · **안 2(Cron) Pro까지 보류** · AS-H 반영 |
