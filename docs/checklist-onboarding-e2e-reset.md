# 온보딩 E2E 테스트 환경 — DB 리셋 후 첫 연동

> 목적: FMS **첫 로그인 → Tesla OAuth → VK → 제원 Baseline → Telemetry 수신**을 처음부터 검증  
> 수용 VIN: `LRWYGCFJ7SC214742`  
> 관련: [setup-guide.md](./setup-guide.md) §5.4, [handoff-fms.md](./handoff-fms.md), [requirements-tesla-telemetry-rest-baseline-specs.md](./requirements-tesla-telemetry-rest-baseline-specs.md) (TRF-B1), [checklist-tesla-telemetry-rest-freeze.md](./checklist-tesla-telemetry-rest-freeze.md)

---

## 0. 최신 리셋 상태 (2026-07-15 · 재실행)

| 항목 | 결과 |
|------|------|
| DB | Production Supabase (`aws-1-ap-northeast-2.pooler.supabase.com`) |
| 유지 User | `user@teslarental.com` (테슬라 렌트) |
| 삭제 | TeslaAccount 1 · Vehicle 1(`LRWYGCFJ7SC214742`) · Subscription · Audit/Api **완료** |
| Snapshot / Ingress | 이미 0 · 유지 |
| `fleet_telemetry_config` DELETE | VIN `LRWYGCFJ7SC214742` → **200 OK** |
| Vehicle / TeslaAccount | **0** |

스크립트 재실행:

```powershell
node --env-file=.env scripts/reset-fms-data.mjs --dry-run --unsubscribe
node --env-file=.env scripts/reset-fms-data.mjs --confirm --unsubscribe
```

---

## 1. 무엇이 유지되고 / 무엇이 지워지나

| 구분 | 항목 |
|------|------|
| **유지 (운영)** | `User` (FMS 로그인), Supabase Auth, Vercel/로컬 **env**, Partner Register, Telemetry 서버, Command Proxy, Naver Maps 키 |
| **리셋(카운터만)** | `SyncMetadata`, `TelemetryMetadata` |
| **삭제 (FMS DB)** | `TeslaAccount`, `Vehicle`(+SyncState/Snapshot/Event), Telemetry 구독·Ingress, Audit/Api 로그 |
| **DB 밖 · 수동** | Tesla **Virtual Key** (앱에서 제거 권장), 차량 Telemetry config(스크립트 `--unsubscribe`로 시도함) |

---

## 2. E2E 시나리오 (리셋 후 · 현재 코드 기준)

`TESLA_REST_FREEZE=true` 유지 권장 (Wake REST는 계속 차단 · **Baseline 제원은 Freeze 졸업**).

1. **FMS 로그인** — `user@teslarental.com` → https://bori-fleet.shop/signin  
2. **Tesla 계정 연동** — 설정 → OAuth → `TeslaAccount` 생성  
3. **차량 목록 동기화** — registry → `Vehicle` + SyncState (`KEY_PENDING` 등) · **Snapshot 없음**  
4. **Virtual Key** — Tesla 앱에서 플릿 키 페어링 → FMS 「키 연결 확인」  
5. **Baseline (specs-only)** — VK 후 자동/수동 → **Vehicle 제원만** 저장 · **Snapshot 미생성** · Audit `specs_only`  
6. **Telemetry 구독** — Proxy로 `fleet_telemetry_config` create (CAF 44키)  
7. **수신 확인** — Ingress PROCESSED · Snapshot `telemetrySource=TELEMETRY` · SoC/위치 등  

의도적으로 **안 나오는 것:** ASLEEP→ONLINE 시 Wake 쿨다운 REST (Freeze 미졸업).

`VEHICLE_DATA_PROVIDER=tesla` 필수.

---

## 3. 사용자 할 일

### 필수

| # | 할 일 | 상태 |
|---|--------|:----:|
| 1 | DB 리셋 (User만 유지) | ✅ 2026-07-15 |
| 2 | Telemetry config DELETE (실차 VIN) | ✅ |
| 3 | **Tesla 앱에서 Virtual Key 제거** 후 처음부터 페어링 | ☐ 수동 |
| 4 | FMS 로그인 → Tesla OAuth → VK → Baseline → Telemetry | ☐ |
| 5 | Vercel env: Proxy URL · CA · `TESLA_REST_FREEZE` | ☐ 확인 |

### 권장

| # | 할 일 |
|---|--------|
| 6 | 차량 ONLINE으로 Baseline·config synced 확인 |
| 7 | 상세에서 `firmwareVersion` / wheel / color 등 제원 · Snapshot은 Telemetry 이후만 |

---

## 4. 스모크 체크

- [x] `User` ≥ 1, `Vehicle` = 0, `TeslaAccount` = 0
- [ ] `/` · `/vehicles` — 차량 없음 / 연동 유도
- [ ] Tesla OAuth → 계정·차량(registry)
- [ ] VK confirm → lifecycle · **Baseline 제원** (`carType` 등) · Snapshot 0건 유지(또는 Telemetry 전)
- [ ] Telemetry create → Ingress · Snapshot `TELEMETRY`
- [ ] Wake REST Audit **없음** (Freeze ON)

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-12 | 온보딩 E2E용 리셋 가이드 |
| 2026-07-13 | Phase UX2 표시 반영 |
| 2026-07-15 | Production DB 리셋 실행 · TRF-B1 specs-only · Freeze 졸업 시나리오 반영 |
| 2026-07-15 | E2E 재준비 — 부분 연동 데이터 재리셋 (Vehicle 1 · TeslaAccount 1) |
|
