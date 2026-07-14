# Snapshot 위경도 null — REST가 Telemetry 좌표를 덮음 (LN)

| 항목 | 내용 |
|------|------|
| 목적 | Telemetry로 들어온 위경도가 **이후 Snapshot에서 null로 바뀌는** 원인을 정리하고, REST·Telemetry merge가 **유효 좌표를 지우지 않게** 한다 |
| 증상 | Ingress/Telemetry Snapshot에는 Location 있음 → 수초 후 REST Snapshot부터 null → 이후 Telemetry도 null 유지 |
| 적용 | `hybrid/rest-sync.ts` (`writeRestSnapshot`) · `mapper.ts` (REST `drive_state`) · `processor.ts` (wake REST + Telemetry merge) |
| 관련 | [requirements-vehicle-asleep-status.md](./requirements-vehicle-asleep-status.md), [requirements-tesla-fleet-api-telemetry-webhook.md](./requirements-tesla-fleet-api-telemetry-webhook.md) (wake 쿨다운 REST), [checklist-vehicle-location-null.md](./checklist-vehicle-location-null.md) |
| **확정 원인 (본 건)** | **LN-R** — `writeRestSnapshot`이 REST lat/lng를 이전값 merge 없이 그대로 기록 |
| 상태 | **원인 확정 ✅ · LN-R 수정 ✅ · 실차 검수 ☐** |
| 작성일 | 2026-07-15 |
| 수용 VIN | `LRWYGCFJ7SC214742` |

---

## 1. 현장 관찰 (Snapshot 타임라인 · 확정)

VIN 기준 `VehicleSnapshot` 예 (KST):

| 시각 (`lastUpdatedAt`) | `telemetrySource` | Location | 의미 |
|------------------------|-------------------|----------|------|
| `2026-07-15 04:56:36.242+09` | **TELEMETRY** | **있음** | Location 파싱·저장 **성공** |
| `2026-07-15 04:56:40.771+09` | **REST** | **null** | **이 시점부터 null** (약 4초 후) |
| `2026-07-15 04:57:33.837+09` | TELEMETRY | null | 이전(REST null)과 merge → null 유지 |
| … | … | null | null 머리 전파 |

보조 관찰:

- Ingress `~04:56:33`에 Location 포함 → **파서로 Snapshot에 들어간 것이 첫 TELEMETRY 행으로 증명됨.**
- 주차(절전) 구간에서 깨어난 뒤 Telemetry 수신 → **ASLEEP→ONLINE** 처리가 wake 쿨다운 REST를 유발한 타임라인과 일치.

---

## 2. 확정 원인: LN-R (REST overwrite)

### 2.1 트리거

`applyTelemetryFields`에서 절전 깨어남 시:

```text
wasAsleep → maybeRunWakeCooldownRestSync(vehicleId)
```

쿨다운 경과 시 `vehicle_data` 1회 → `writeRestSnapshot` (`RestSyncReason.WAKE_COOLDOWN`).  
본 건 타임라인( TELEMETRY 직후 ~4초 REST )과 정합.

### 2.2 버그 지점

`writeRestSnapshot` (`src/lib/tesla/hybrid/rest-sync.ts`):

```text
latitude: snapshot.latitude,   // previous merge 없음
longitude: snapshot.longitude,
```

Telemetry 쪽 `mergeSnapshotFields`는 `current ?? previous`인데, **REST create는 이전 Snapshot 좌표를 쓰지 않는다.**

`preserveTelemetryFields: true`여도 보존 대상은 `chargingPowerKind` · `lastTelemetryAt` · `isAsleepInferred` 등뿐이고 **lat/lng는 미포함**.  
wake 쿨다운 경로는 애초에 `preserveTelemetryFields`도 켜지 않음.

### 2.3 REST가 null을 주는 이유

`mapTeslaVehicleToSnapshot`은 `drive_state.latitude/longitude`만 사용.  
usable 아니면 **둘 다 null** (예: 응답에 drive 위치 없음 · `(0,0)` · 한쪽만).

주차·막 깨어난 직후 `vehicle_data`에 GPS가 비어 있으면 REST Snapshot = **좌표 null + `lastUpdatedAt` 최신** → UI 머리가 null.

### 2.4 이후 Telemetry가 null을 유지하는 이유

Telemetry merge는 **이전 머리**를 기준으로 `??` 한다.  
머리가 이미 REST(null)이면 Location 없는(또는 null) Telemetry 메시지도 **null을 유지**한다.  
절전 추론은 null 머리를 복사만 하므로 고착을 풀지 못함.

```text
TELEMETRY(좌표○) → REST(좌표×, 머리) → TELEMETRY(merge←null) → ASLEEP(복사 null) …
```

---

## 3. 기각·부차 가설

| ID | 가설 | 본 건 판정 | 비고 |
|----|------|:----------:|------|
| **LN-R** | REST가 Telemetry 좌표를 null로 덮음 | **확정** | §2 · Snapshot 타임라인 |
| **LN-A** | Location 파싱 실패 | **기각 (본 건)** | 04:56:36 TELEMETRY에 좌표 있음 |
| **LN-B** | ASLEEP `lastUpdatedAt=now`에 좌표 행 매장 | **본 건 주원인 아님** | null은 REST에서 시작. AS-4/Hobby는 별도 리스크 |
| **LN-C** | null 머리 전파 | **결과** (2차) | LN-R 이후 ASLEEP/Telemetry가 유지 |
| **LN-D** | 기타 REST (baseline·manual 등) | **동일 코드 경로** | `writeRestSnapshot` 공통 — wake만이 아니라 **모든 REST 쓰기**에 동일 결함 |

---

## 4. DB 진단 (재현·회귀)

동일 VIN Snapshot `orderBy lastUpdatedAt`:

| 관찰 | 결론 |
|------|------|
| TELEMETRY(좌표○) 직후 REST(좌표×) | **LN-R 확정** |
| REST만 있고 그 전 좌표 TELEMETRY 없음 | REST 원천 null 또는 다른 이슈 |
| 좌표 TELEMETRY만 있고 REST 없이 최신이 ASLEEP(null) | LN-B 등 재검토 |

교차:

1. `VehicleSyncState.lastRestSyncReason` ≈ `WAKE_COOLDOWN` (해당 시각)  
2. Audit `VEHICLE_WAKE_REST_SYNC` SUCCESS  
3. Ingress Location → 첫 TELEMETRY 좌표 일치 여부

---

## 5. To-Be (수정 방향)

### 5.1 LN-R — REST에서도 좌표 merge (필수 · 1차) ✅

`mergeSnapshotCoordinates` + `writeRestSnapshot`:

```text
latitude  = snapshot.latitude  ?? previousSnapshot?.latitude  ?? null
longitude = snapshot.longitude ?? previousSnapshot?.longitude ?? null
```

적용 범위: wake / gear correction / baseline / manual fallback 등 **`writeRestSnapshot` 전 호출** (공통 함수).  
`existing` 조회에 실패한 경우에도 `vehicleId`로 최신 Snapshot을 다시 읽어 merge한다.

검증: `npm run ln:verify`

### 5.2 후속 Telemetry / ASLEEP (LN-C 완화 · 선택)

LN-R 수정만으로 “REST가 null을 머리에 넣는” 문제는 막힌다.  
이미 DB에 쌓인 null 머리·과거 행은 남음 → 실차 재수신 또는 LN-4 fallback으로 회복 가능.

| 안 | 내용 | 우선 |
|----|------|:----:|
| **R1** | `writeRestSnapshot` lat/lng `?? previous` | ✅ 필수 |
| **C1** | ASLEEP 시 최근 non-null 좌표 fallback | 선택 |
| **A1** | Location 파서 보강 | 본 건 불필요 · 방어적 유지 가능 |
| **B1** | Telemetry `lastUpdatedAt = max(eventAt, now)` | LN-B 방지용 · **본 건과 독립** |

비권고: Ingress를 UI SoT로 쓰기 · REST에서 Location 없을 때 Snapshot create 자체를 스킵(다른 필드 유실).

---

## 6. 요구사항 ID

| ID | 요구 | 상태 |
|----|------|:----:|
| **LN-1** | 원인·가설·진단 문서화 | ✅ |
| **LN-1b** | Snapshot 타임라인으로 **LN-R 확정** 반영 | ✅ |
| **LN-7** | `writeRestSnapshot` lat/lng previous merge (R1) | ✅ |
| **LN-8** | REST 좌표 merge 회귀 (`npm run ln:verify`) | ✅ |
| **LN-2** | Location 파서 보강 | ☐ 방어적 · 본 건 비필수 |
| **LN-3** | Telemetry `lastUpdatedAt` 정합 (B1) | ☐ 별도 · 본 건 비필수 |
| **LN-4** | (선택) ASLEEP non-null 좌표 fallback | ☐ |
| **LN-6** | 실차 검수 — wake REST 후에도 위경도 유지 | ☐ |

---

## 7. Phase

| Phase | 범위 | 상태 |
|-------|------|:----:|
| **LN-Doc** | 요구·체크리스트 · LN-R 확정 | ✅ |
| **LN-R** | `writeRestSnapshot` merge (LN-7 · LN-8) | ✅ |
| **LN-A** | 파서 (LN-2) | ☐ 선택 |
| **LN-B** | `lastUpdatedAt` (LN-3) | ☐ 선택 |
| **LN-C** | ASLEEP fallback (LN-4) | ☐ 선택 |
| **LN-QA** | 실차 (LN-6) | ☐ |

---

## 8. 수용 기준

- [x] 코드: REST null GPS 시 previous 좌표 유지 · usable GPS 시 갱신 (`ln:verify`)
- [ ] ASLEEP→ONLINE 후 wake REST가 돌아도, REST 응답에 GPS가 없어도 **직전 Telemetry 좌표가 최신 Snapshot에 유지**된다. (실차)
- [ ] 이후 Location 없는 Telemetry / ASLEEP 추론이 좌표를 null로 만들지 않는다. (실차)
- [ ] REST에 usable GPS가 있으면 그 값으로 갱신된다 (덮어쓰기 OK). (실차)
- [ ] UI 위치·지도가 Snapshot과 일치. (실차)
- [ ] VIN `LRWYGCFJ7SC214742` — TELEMETRY(○)→REST→TELEMETRY 순서 재현 검수.

---

## 9. 리스크

| 항목 | 내용 |
|------|------|
| 오래된 stale 좌표 | REST가 GPS를 의도적으로 비웠을 때 previous를 유지하면 **이전 주차 위치**가 남을 수 있음. 관제상 “마지막 알려진 위치”가 맞음 (null보다 낫다). |
| baseline 첫 동기화 | `previous` 없으면 null 유지 — 정상. |
| LN-A/B | 본 건과 무관하나, 파서 실패·ASLEEP 매장은 **별도 결함**으로 남길 수 있음. |

---

## 10. 구현 메모

- ✅ `src/lib/tesla/hybrid/coordinates.ts` — `mergeSnapshotCoordinates`
- ✅ `src/lib/tesla/hybrid/rest-sync.ts` — `writeRestSnapshot`에 적용 · previous 재조회
- ✅ `scripts/verify-ln-rest-coordinates.mjs` · `npm run ln:verify`
- 트리거 참고: `processor.ts` `maybeRunWakeCooldownRestSync`
- REST 매퍼: `drive_state` null은 정상 입력일 수 있음 — **쓰기 merge로 방어**

---

## 11. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-15 | 초기: LN-A/B/C 가설 문서화 |
| 2026-07-15 | **확정:** Snapshot TELEMETRY(○)→REST(×)→TELEMETRY(×) · **LN-R** 주원인 · To-Be R1 우선 |
| 2026-07-15 | **LN-7·LN-8 구현** · 실차 LN-QA 남음 |
