# 온보딩 E2E 테스트 환경 — DB 리셋 후 첫 연동

> 목적: FMS **첫 로그인 → Tesla OAuth → 차량/VK → Telemetry 수신**을 처음부터 검증  
> 수용 VIN: `LRWYGCFJ7SC214742`  
> 관련: [setup-guide.md](./setup-guide.md) §5.4, [handoff-fms.md](./handoff-fms.md), Phase BF

---

## 1. 무엇이 유지되고 / 무엇이 지워지나

| 구분 | 항목 |
|------|------|
| **유지 (운영)** | `User` (FMS 로그인), Supabase Auth 계정, Vercel/로컬 **env 시크릿**, Partner Register, Telemetry 서버(`telemetry.bori-fleet.shop`), Command Proxy, Naver Maps 키 |
| **리셋(카운터만)** | `SyncMetadata`, `TelemetryMetadata` |
| **삭제 (FMS DB)** | `TeslaAccount`, `Vehicle`(+SyncState/Snapshot/Event), Telemetry 구독·Ingress, Audit/Api 로그 |
| **DB 밖 · 수동** | Tesla **Virtual Key**, 차량 쪽 `fleet_telemetry_config`(스크립트가 `--unsubscribe`로 삭제 시도) |

스크립트: `pnpm db:reset-data` → `scripts/reset-fms-data.mjs`

```powershell
# 미리보기
node --env-file=.env scripts/reset-fms-data.mjs --dry-run --unsubscribe

# 실행 (실삭제 + Telemetry config DELETE 시도)
node --env-file=.env scripts/reset-fms-data.mjs --confirm --unsubscribe
```

---

## 2. E2E 시나리오 (리셋 후)

1. **FMS 로그인** — 유지된 User (예: `user@teslarental.com`)로 `/signin`
2. **Tesla 계정 연동** — 설정/차량 추가 → OAuth → `TeslaAccount` 생성
3. **차량 목록 동기화** — registry → `Vehicle` + `VehicleSyncState` (`KEY_PENDING` 등)
4. **Virtual Key** — Tesla 앱/계정에서 플릿 키 페어링 → FMS 「키 연결 확인」
5. **Baseline** — 깨어 있는 차량에서 제원/스냅샷 1회
6. **Telemetry 구독** — Proxy로 `fleet_telemetry_config` create (BF 필드 포함)
7. **수신 확인** — 상세에서 `TELEMETRY` 소스 · 위치/SoC · 문 상태 갱신

`VEHICLE_DATA_PROVIDER=tesla` 권장 (mock이면 실차 플로우가 아님).

---

## 3. 사용자 도움이 필요한 부분

### 필수

| # | 할 일 | 왜 |
|---|--------|-----|
| 1 | **어느 DB인지 확인** — 로컬 `.env`의 Supabase가 프로덕션(`bori-fleet.shop`)과 같은지 | 리셋이 **공용 DB면 운영 데이터도 날아감** |
| 2 | 리셋 실행 승인 / 또는 본인이 ` --confirm --unsubscribe` 실행 | 파괴적 작업 |
| 3 | **Tesla 앱에서 Virtual Key 제거**(또는 “키 없음” 상태로 맞추기) | FMS DB만 지워도 차량 VK는 남음. 처음부터 페어링을 보려면 제거 |
| 4 | 리셋 후 **FMS 로그인 비밀번호**로 로그인 가능한지 | Auth는 유지, Tesla 토큰만 삭제됨 |
| 5 | **Vercel(또는 로컬) env**에 Proxy·CA 있는지 확인 | Telemetry **재구독 create**에 필요. 로컬 `.env` 점검 시 `TESLA_VEHICLE_COMMAND_PROXY_URL` / `TESLA_TELEMETRY_CA_PEM` 비어 있었음 |

### 권장

| # | 할 일 |
|---|--------|
| 6 | 차량을 **ONLINE(깨어 있음)** 상태로 두고 Baseline·config synced 확인 |
| 7 | `--unsubscribe` 실패 시 Tesla developer/Fleet에서 해당 VIN `fleet_telemetry_config` 수동 삭제 또는 Partner 토큰을 `.env`에 넣고 재시도 |
| 8 | 프로덕션 시연 DB를 쓰려면 Vercel 재배포 후 동일 시나리오 1회 |

### 에이전트가 대신 할 수 있는 것

- FMS DB 리셋 스크립트 실행 (`--confirm --unsubscribe`)
- 리셋 후 카운트 검증 (Vehicle=0, User≥1)
- 온보딩 체크리스트·문서 갱신

### 에이전트가 대신 못 하는 것

- Tesla 앱 Virtual Key UI 조작
- 실차 시동/도어/주행
- Supabase Auth 비밀번호 재발급(메일 소유자만)
- Vercel 대시보드에 env 붙여넣기(비밀값)

---

## 4. 리셋 후 스모크 체크

- [ ] `User` ≥ 1, `Vehicle` = 0, `TeslaAccount` = 0
- [ ] `/` 또는 `/vehicles` — 차량 없음 / 연동 유도 UI
- [ ] Tesla OAuth 성공 → 계정·차량 생성
- [ ] VK confirm → lifecycle 진행
- [ ] Telemetry create 성공 → Ingress PROCESSED · Snapshot `TELEMETRY`

> **카피·배치**: `주차 (절전)`·`마지막 신호` · 툴바 단순 · 헤더 제거.  
> **Summary(UX2-E)**: SOC 프로그레스 · 미연결/잠김 숨김 · 신선도 한 줄.  
> **UX2-F**: 상단 2열 · 퀵타일 · TPMS · 하단 공조 제거.  
> **UX2-G**: 맵 캡션(상세 보기) 숨김 · 인근충전소 맵 아래 (§4.10).  
> → [checklist-vehicle-detail-ui2.md](./checklist-vehicle-detail-ui2.md) (A~G 완료 · 실차 검수 남음)

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-12 | 온보딩 E2E용 리셋 가이드 · 유지/삭제 범위 · 사용자 할 일 |
| 2026-07-13 | Phase UX2(표시 문구) 체크리스트 링크 |
| 2026-07-13 | Phase UX2 구현 완료 반영 |
| 2026-07-13 | UX2-D(UX2-9~11) 후속 안내 |
| 2026-07-13 | UX2-D 구현 완료 반영 |
| 2026-07-13 | UX2-E 구현 완료 반영 |
| 2026-07-13 | UX2-F 후속 안내 |
| 2026-07-13 | UX2-F 구현 완료 반영 |
| 2026-07-13 | UX2-G 후속 안내 |
| 2026-07-13 | UX2-G 구현 완료 반영 |
