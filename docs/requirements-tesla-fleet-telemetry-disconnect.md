# Fleet Telemetry 연동 해제 요구사항

## 1. 문서 개요

| 항목 | 내용 |
|------|------|
| 목적 | Telemetry **구독 해제·연동 단절**을 오프라인(VK 삭제) / 소프트웨어(FMS) 두 경로로 정의하고, DB·API·UI·운영 계약을 확정한다 |
| 초안 | 사용자 메모 → 본 문서로 정식화 (2026-07-11) |
| 코드 | **A~D 완료** (2026-07-11) · P1 `fleet_status` 오프라인 감지기 잔여 |
| 관련 | [checklist-tesla-fleet-telemetry-disconnect.md](./checklist-tesla-fleet-telemetry-disconnect.md), [requirements-tesla-fleet-telemetry.md](./requirements-tesla-fleet-telemetry.md), [requirements-tesla-fleet-api-telemetry-webhook.md](./requirements-tesla-fleet-api-telemetry-webhook.md), [requirements-tesla-hybrid-data-model.md](./requirements-tesla-hybrid-data-model.md), [handoff-phase44-to-fleet-telemetry.md](./handoff-phase44-to-fleet-telemetry.md) |
| As-Is | `POST .../telemetry/disconnect`(A) · reconnect · unlink(B). UI·`disconnect:verify`(VIN `LRWYGCFJ7SC214742`) 반영. P1 오프라인 VK 감지는 미구현 |

---

## 2. 초안 분석 (채택 / 수정)

### 2.1 채택

| 초안 | 평가 |
|------|------|
| 해제 경로 2종: **오프라인(차량·앱에서 VK 삭제)** / **소프트웨어(FMS)** | 채택 — 원인·권한이 다름 |
| FMS [연동 끊기] ≠ 원격 VK 삭제 (Tesla 보안) | 채택 — 필수 UX 전제 |
| FMS 버튼 = `fleet_telemetry_config` **구독 해지** | 채택 — 프라이버시·과금(스트리밍) 관리에 필수 |
| 해제 후 VK 수동 삭제 안내 모달 | 채택 — 권장 카피 포함 |

### 2.2 수정·보완 (기술적으로 권장)

| 초안 | 이슈 | 본 문서 결정 |
|------|------|----------------|
| 무신호 시 `GET vehicle_data`로 403이면 DISCONNECTED | Phase 4.4 **ASLEEP에서 자동 `vehicle_data`/`wake_up` 금지**와 충돌. 403은 토큰·권한·미등록 등 다의적 | **무신호 → 우선 ASLEEP 유지**. 단절 판정은 **`fleet_status`(키 페어링) 또는 config 조회** 등 **저빈도·비-wake** API만 사용 |
| DB 상태를 `DISCONNECTED`로 둔다고만 기술 | `VehicleStatus`(ONLINE/ASLEEP…)와 혼동 위험 | **운행 상태와 분리**. 연동 단절은 `VehicleLifecycle` + `TelemetrySubscription` (+ 사유 enum) |
| FMS 끊기 = 기존 unlink와 동일시 가능 | 현재 unlink는 차량을 soft-delete해 **목록에서 사라짐**. B2B는 “목록은 남기고 스트리밍만 중지”가 필요할 수 있음 | **Telemetry 단절**과 **차량 unlink(제거)** 를 **별 액션**으로 분리 |
| “가볍게 vehicle_data” | Rate limit·Phantom Drain·하이브리드 정책 위반 | **금지**. 대체: `POST fleet_status`의 `key_paired_vins` / `unpaired_vins` |

---

## 3. 용어 · 상태 모델

### 3.1 두 가지 “끊기” (반드시 구분)

| 액션 | 의미 | Tesla 호출 | FMS DB 결과 (권장) |
|------|------|------------|-------------------|
| **A. Telemetry 연동 해제** | 스트리밍 구독만 중지. 차량은 플릿에 남을 수 있음 | `DELETE .../fleet_telemetry_config` | Subscription `active=false`, lifecycle → `TELEMETRY_DISCONNECTED` (가칭). **Vehicle soft-delete 하지 않음** |
| **B. 차량 unlink (제거)** | 계정·플릿에서 차량 제거 (기존) | config DELETE + (선택) 계정 정리 | `unlinkedAt` / `isDeleted=true`, SyncState 삭제 — **현행 `unlinkVehicle`** |

본 문서의 초안 [연동 끊기]는 **기본값 = A**.  
A 이후 사용자가 “목록에서도 제거”를 원하면 B를 추가 제공(2단계 UX).

### 3.2 오프라인 해제 (VK 삭제)

| 항목 | 정의 |
|------|------|
| 트리거 | 차주가 Tesla 앱/차량 화면에서 **Virtual Key(보리차/FMS 키)** 삭제 |
| 현상 | 차량 → Telemetry 서버로 V 푸시 중단 (또는 급감) |
| FMS가 바로 알 수 없음 | 무신호는 **ASLEEP와 동일하게 보임** |
| 확정 조건 (권장) | stale 이후 **저빈도** `fleet_status`에서 VIN이 `unpaired_vins`이거나 `key_paired_vins`에 없음 → **VK 제거로 추정** → Telemetry 단절 상태로 전이 + 구독 행 비활성(이미 수신 없으면 config DELETE는 best-effort) |

### 3.3 상태 배치 (혼동 방지)

```
Operational (VehicleSnapshot.status / isAsleepInferred)
  ONLINE | ASLEEP | OFFLINE | WARNING | ALERT
  → “지금 차가 깨어 있나 / 취침인가”

Link / Lifecycle (VehicleSyncState.lifecycle + TelemetrySubscription)
  READY | TELEMETRY_PENDING | … | TELEMETRY_DISCONNECTED
  → “FMS가 이 차의 Telemetry를 받을 계약이 살아 있나”
```

**금지**: `VehicleStatus`에 `DISCONNECTED`를 넣어 ASLEEP와 배지를 섞지 않는다.

---

## 4. 목표

1. B2B 고객이 FMS에서 **Telemetry 수신·과금 대상**을 명시적으로 끌 수 있다.
2. 차주가 VK를 지운 **오프라인 단절**을 ASLEEP와 구분 가능하도록 한다 (오탐 최소화).
3. FMS 끊기가 **원격 VK 삭제처럼 오해되지 않게** 안내한다.
4. Phase 4.4 하이브리드 원칙(자동 wake / ASLEEP 중 `vehicle_data` 금지)을 깨지 않는다.
5. Telemetry 서버 allowlist는 FMS status VIN 목록 갱신으로 자연 반영한다.

---

## 5. 기능 요구사항

### 5.1 소프트웨어 해제 (FMS) — P0

| ID | 요구사항 |
|----|----------|
| S1 | 차량 상세(및 설정·목록 액션)에 **[Telemetry 연동 끊기]** 제공 |
| S2 | 확인 모달: “스트리밍만 중지됩니다. 차량의 Virtual Key는 자동 삭제되지 않습니다.” |
| S3 | 확인 시 FMS → Tesla `DELETE /api/1/vehicles/{vin}/fleet_telemetry_config` (기존 `unsubscribeVehicleTelemetry` 경로) |
| S4 | 성공 시 DB: `TelemetrySubscription.active=false`, `unsubscribedAt=now`, `configSynced=false`, SyncState lifecycle=`TELEMETRY_DISCONNECTED`, `disconnectReason=USER_SOFTWARE`, 감사 로그 |
| S5 | 성공 모달(또는 토스트+배너): VK 수동 삭제 안내 (카피 §8) |
| S6 | 차량은 **목록에 잔존** (기본). soft-delete는 하지 않음 |
| S7 | 실패 시: 에러 표시, Subscription에 `lastError`, 재시도 가능. 부분 성공(Tesla 실패·DB만 갱신) 정책은 “DB를 단절로 두고 Tesla 재시도” 또는 “롤백” 중 **명시** — 권장: **DB 단절 + lastError + 재시도 버튼** (과금 우선 중지) |
| S8 | (선택 P1) 같은 화면에서 **[플릿에서 제거]** = 기존 unlink(B) |

### 5.2 오프라인 해제 감지 — P1 (오탐 주의)

| ID | 요구사항 |
|----|----------|
| O1 | `lastTelemetryAt`이 stale 임계 초과 → **먼저 ASLEEP** (현행 `inferAsleepVehicles`) |
| O2 | ASLEEP가 **연속 T시간**(권장 기본 24h, env) 유지되거나, 운영자가 “연동 점검”을 누른 경우에만 `fleet_status` 1회 |
| O3 | `unpaired` / 키 미페어링이면 lifecycle=`TELEMETRY_DISCONNECTED`, `disconnectReason=VK_REMOVED_OFFLINE`, Subscription 비활성, 감사 로그 |
| O4 | 키가 여전히 paired이면 **ASLEEP 유지** — DISCONNECTED로 올리지 않음 |
| O5 | **금지**: 무신호만으로 자동 `vehicle_data` / `wake_up` |
| O6 | (선택) `GET fleet_telemetry_config` synced=false 등 보조 신호 — Partner/권한 필요 시 P2 |

### 5.3 재연결

| ID | 요구사항 |
|----|----------|
| R1 | `TELEMETRY_DISCONNECTED` 차량에 **[다시 연결]** — VK 확인(`fleet_status`) → config 재등록(기존 온보딩) → Baseline 정책은 Phase 4.4와 동일 |
| R2 | 소프트웨어 단절 후 재연결 시 과금/구독 재개 안내 |

### 5.4 Telemetry 서버

| ID | 요구사항 |
|----|----------|
| T1 | FMS status allowlist에서 VIN 제외(또는 subscription inactive 차량 미포함) 시 relay 중단 — **기존 계약 유지**, Telemetry 코드 필수 변경 없음 |
| T2 | handoff: 단절 차량이 status에 남더라도 allowlist 규칙이 `active` VIN만 쓰도록 FMS status API를 명확화 (구현 시) |

---

## 6. 영향도 분석

### 6.1 DB

| 변경 | 내용 | 영향 |
|------|------|------|
| `VehicleLifecycle` enum 확장 | `TELEMETRY_DISCONNECTED` 추가 | Prisma migrate · UI 라벨 · API DTO |
| `TelemetrySubscription` | `disconnectReason` enum? (`USER_SOFTWARE` \| `VK_REMOVED_OFFLINE` \| `UNLINK` \| null), `disconnectedAt` | 감사·화면 문구 분기 |
| `VehicleSyncState` | lifecycle 전이만으로도 가능. 사유는 Subscription 또는 SyncState 컬럼 중 1곳 SoT | **권장 SoT: Subscription** (구독 도메인) + lifecycle 미러 |
| `Vehicle` soft-delete | A 경로에서는 **사용 안 함** | 기존 unlink(B)와 쿼리 분리: `activeVehicleWhere`는 유지하되, 단절 차량은 `isDeleted=false` + lifecycle 필터 |
| `VehicleStatus` | **변경 없음** | ASLEEP 배지와 단절 배지 병행 표시 |

**마이그레이션 규모**: enum + 컬럼 1~2개 — Phase 4.4.A급 소규모.

### 6.2 시스템 · API

| 영역 | 영향 |
|------|------|
| `unsubscribeVehicleTelemetry` | 재사용. A 전용 서비스 `disconnectVehicleTelemetry(vehicleId)` 로 감싸 soft-delete 제거 |
| `unlinkVehicle` | B 전용으로 유지. 내부에서 A를 먼저 호출한 뒤 soft-delete |
| 신규 `POST /api/vehicles/[id]/telemetry/disconnect` | S1~S7 |
| 신규 `POST /api/vehicles/[id]/telemetry/reconnect` (또는 기존 VK confirm 확장) | R1 |
| 오프라인 감지기 | cron 또는 sync 후훅 — `fleet_status`만, rate limit 백오프 |
| 감사 | `TELEMETRY_DISCONNECT` / `TELEMETRY_DISCONNECT_DETECTED` / 기존 `TELEMETRY_UNSUBSCRIBE` |
| Phase 4.4 wake 쿨다운 | 단절 차량은 wake REST **스킵** (Subscription inactive) |
| Telemetry allowlist | status `items`에서 `subscription.active !== true` 제외 권장 |

### 6.3 UI

| 화면 | 영향 |
|------|------|
| 차량 상세 | 단절 버튼·모달·배너·재연결 — **본 문서 §8** |
| 대시보드 / 목록 | 단절 뱃지·필터·요약 카운트 |
| 설정 | 온보딩 대기와 별도로 “Telemetry 단절 N대” 패널(선택) |
| 기존 unlink 버튼 | 라벨을 **[플릿에서 제거]** 등으로 명확화해 A와 구분 |

### 6.4 리스크

| 리스크 | 대응 |
|--------|------|
| ASLEEP를 DISCONNECTED로 오탐 | O2 장시간 임계 + fleet_status 확정만 |
| vehicle_data 프로브로 배터리/비용 이슈 | **금지** (본 문서 핵심 수정) |
| config DELETE 실패인데 UI만 단절 | S7 정책 + 재시도 |
| VK는 남고 구독만 끊김 | 의도된 동작 — 안내 모달로 보완 |
| 단절 차량에 대한 wake REST | processor에서 inactive 구독 skip |

---

## 7. 권장 판정 알고리즘 (오프라인)

```
onStaleOrCron(vin):
  if subscription.active == false: return  // 이미 소프트웨어 단절
  if not asleepLongEnough(vin, T_hours): return  // ASLEEP만 유지

  fleet = POST fleet_status([vin])   // wake 없음, 저빈도
  if vin in unpaired OR vin not in key_paired:
    mark TELEMETRY_DISCONNECTED (VK_REMOVED_OFFLINE)
    bestEffort DELETE fleet_telemetry_config
    audit
  else:
    keep ASLEEP
```

`T_hours` 기본 **24** (`TESLA_TELEMETRY_OFFLINE_DISCONNECT_AFTER_HOURS`).  
데모는 짧게(예: 1h) 둘 수 있으나 운영 기본은 보수적으로.

---

## 8. UI 명세 (대시보드 · 차량 상세)

### 8.1 차량 상세 — 헤더 · 배지

| 요소 | 동작 |
|------|------|
| 운행 배지 | 기존 ONLINE / **ASLEEP** / … (변경 없음) |
| 연동 배지 | `READY` → 「Telemetry 연결」, `TELEMETRY_DISCONNECTED` → 「Telemetry 단절」(warning/light) |
| 동시 표시 | ASLEEP + READY 가능(현행). ASLEEP + DISCONNECTED 가능 — 보조 문구: “취침이 아니라 연동이 끊긴 상태일 수 있음”은 **DISCONNECTED일 때만** |

### 8.2 차량 상세 — [Telemetry 연동 끊기] (A)

1. 버튼 위치: 제원/신선도 카드 하단 또는 헤더 액션 영역. lifecycle이 READY 또는 TELEMETRY_PENDING일 때 노출.
2. **1차 확인 모달**
   - 제목: Telemetry 연동 끊기
   - 본문:  
     - 이 차량의 **실시간 Telemetry 수신이 중지**됩니다.  
     - **Virtual Key는 삭제되지 않습니다.**  
     - 과금·프라이버시 목적의 구독 해지에 가깝습니다.
   - 버튼: 취소 / 연동 끊기(위험색)
3. API 호출 중 로딩.
4. **성공 모달 (초안 UX 반영)**  
   > 보리차 FMS와의 Telemetry 연동이 해제되었습니다.  
   > 완벽한 보안을 위해 Tesla 모바일 앱 또는 차량 화면의 **안전** 메뉴에서 **bori-fleet(또는 앱 표시명) Virtual Key**를 함께 삭제해 주세요.
5. 화면 갱신: 연동 배지=단절, 신선도 카드에 `disconnectedAt`·사유, [다시 연결] 노출.
6. **실패**: 토스트/인라인 에러 + [재시도].

### 8.3 차량 상세 — [플릿에서 제거] (B, 기존 unlink)

- 라벨 명확화. 확인 문구: “목록에서 제거되며 Telemetry 구독도 해제됩니다.”
- 성공 시 `/vehicles`로 이동.

### 8.4 차량 상세 — 오프라인 감지 배너

- `disconnectReason=VK_REMOVED_OFFLINE`일 때:  
  > 차량에서 Virtual Key가 제거된 것으로 보입니다. Telemetry 수신이 중단되었습니다. 다시 쓰려면 키를 페어링한 뒤 [다시 연결]을 눌러 주세요.

### 8.5 대시보드 · 목록

| 요소 | 명세 |
|------|------|
| 요약 카드(선택) | `Telemetry 단절 N대` — 클릭 시 목록 `?filter=telemetry_disconnected` |
| 목록 행 | 모델 아래 또는 상태 열에 「단절」 뱃지 (lifecycle). 운행 ASLEEP와 **별 줄** |
| 필터 | 기존 IDLE/ASLEEP 등과 분리된 **Telemetry 단절** |
| 일괄 끊기 | P2 (계정 단위) |

### 8.6 설정

- 온보딩 대기 패널 옆에 **단절 차량** 요약(선택 P1).
- REST fallback과 무관함을 한 줄 고지.

### 8.7 카피 가이드 (한국어)

| 상황 | 권장 문구 |
|------|-----------|
| 버튼 | Telemetry 연동 끊기 |
| 성공+VK 안내 | §8.2 성공 모달 문장 |
| ASLEEP만 | (단절 문구 금지) “취침 중 — 신호가 잠시 없습니다” |
| 재연결 | Telemetry 다시 연결 |

---

## 9. As-Is → To-Be

| 항목 | As-Is | To-Be |
|------|-------|-------|
| FMS 끊기 | unlink = config DELETE + soft-delete | **A** config DELETE + DISCONNECTED 잔존 / **B** 기존 unlink |
| 무신호 | ASLEEP만 | ASLEEP 유지 + (P1) fleet_status로 VK 제거 시에만 DISCONNECTED |
| 단절 판정 API | (없음) / 초안 vehicle_data | **fleet_status only** |
| UI 안내 | 없음 | VK 수동 삭제 모달 |
| VehicleStatus | ONLINE…ASLEEP | 변경 없음 |

---

## 10. 환경변수 (구현 시)

| 변수 | 기본(안) | 의미 |
|------|----------|------|
| `TESLA_TELEMETRY_OFFLINE_DISCONNECT_AFTER_HOURS` | `24` | ASLEEP 유지 후 fleet_status로 VK 점검 |
| (기존) `TESLA_TELEMETRY_STALE_AFTER_SECONDS` | `300` | ASLEEP 추론 — 단절과 분리 |

---

## 11. 비기능

- 감사 로그에 사유·VIN·actor 필수.
- config DELETE는 idempotent 취급(이미 없음 = 성공).
- 다차량 `fleet_status` 배치로 오프라인 점검 시 rate limit 준수.

---

## 12. 구현 체크리스트

> **Phase 4.5** — A~D 완료 (2026-07-11). P1 오프라인 감지기 잔여.  
> 상세: [checklist-tesla-fleet-telemetry-disconnect.md](./checklist-tesla-fleet-telemetry-disconnect.md)  
> 검증: `pnpm disconnect:verify` · VIN `LRWYGCFJ7SC214742`

### 0. 문서 · 합의
- [x] 본 문서 A/B 액션 분리·vehicle_data 프로브 금지 합의
- [x] development-checklist Phase 4.5 항목 연결
- [x] README 인덱스 등록

### A. 스키마
- [x] `VehicleLifecycle.TELEMETRY_DISCONNECTED` (또는 동등)
- [x] `TelemetryDisconnectReason` enum + `disconnectedAt` (Subscription 권장)
- [x] migrate · backfill 없음(기본 null)
- [x] DTO/`MapVehicle`·lifecycle 라벨

### B. 도메인 · API
- [x] `disconnectVehicleTelemetry` (soft-delete 없음)
- [x] `POST .../telemetry/disconnect` + 감사
- [x] unlink(B)는 A 호출 후 soft-delete 유지
- [x] wake/Baseline 경로에서 inactive 구독 skip
- [x] status allowlist = active subscription VIN만
- [x] reconnect API/플로우 (`POST .../telemetry/reconnect`)
- [ ] (P1) 오프라인 감지기 + fleet_status

### C. UI
- [x] 상세: 끊기 확인 모달 + 성공 VK 안내 모달
- [x] 상세: 단절 배지·배너·다시 연결
- [x] 목록/대시보드: 단절 뱃지·필터
- [x] unlink 버튼 라벨을 “플릿에서 제거”로 구분

### D. 검증
- [x] 소프트웨어 끊기 → config DELETE · DB 단절 · 목록 잔존 · allowlist 제외 (`LRWYGCFJ7SC214742`)
- [x] ASLEEP 장시간 + 키 유지 → DISCONNECTED **아님** (오탐 0)
- [ ] 키 제거 후 fleet_status → DISCONNECTED (P1)
- [x] 자동 vehicle_data/wake_up 없음 회귀
- [x] Telemetry handoff 문서 한 줄 갱신(선택)

---

## 13. 결정 요약

| # | 결정 |
|---|------|
| 1 | 해제 = **오프라인(VK)** + **소프트웨어(FMS config DELETE)** |
| 2 | FMS 끊기는 **원격 VK 삭제 아님** — 안내 모달 필수 |
| 3 | **Telemetry 단절(A)** 과 **차량 제거 unlink(B)** 분리 |
| 4 | DISCONNECTED는 **Lifecycle/Subscription**, 운행 ASLEEP와 분리 |
| 5 | 오프라인 확정은 **`fleet_status`**, **`vehicle_data` 프로브 금지** |
| 6 | 무신호 기본 해석은 **ASLEEP** (Phase 4.4 유지) |

---

## 14. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-11 | 초안 메모를 요구사항화 — A/B 분리, vehicle_data 프로브 금지·fleet_status 대체, DB/UI/체크리스트·영향도 추가 |
| 2026-07-11 | A~C 구현 반영 — 코드 상태·§12 체크리스트 갱신 (D·P1 감지기 잔여) |
| 2026-07-11 | A~D 완료 — disconnect:verify · VIN LRWYGCFJ7SC214742 · 빈 partner token 버그 수정 · P1 감지기 잔여 |
