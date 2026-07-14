# Phase UX2 — 차량 상세 표시 문구·표현 개선 체크리스트

관련 요구사항: [requirements-vehicle-detail-ui2.md](./requirements-vehicle-detail-ui2.md)  
선행: [checklist-vehicle-detail-ui.md](./checklist-vehicle-detail-ui.md) (VD-1~3 ✅)  
대상: `FleetVehicleDetailView` · 목록/지도 라벨 · 툴바·상단 배치 · Summary 밀도  
수용 테스트 VIN: `LRWYGCFJ7SC214742`  
상태: **UX2-A~G 완료** — 실차 수동 검수(온보딩 후) 남음

---

## 이슈 ↔ Phase 매핑

| ID | 요구 | Phase | 우선 |
|----|------|-------|:----:|
| UX2-1 | ASLEEP → `주차 (절전)` + `마지막 신호: …` | UX2-A | P0 |
| UX2-2 | Summary/상태 카드에서 `추론`·영문 enum 병기 제거 | UX2-A | P0 |
| UX2-3 | configSynced 경고: 최근 수신 시 숨김/정보톤 | UX2-A | P0 |
| UX2-4 | 타임라인·구독 문구 필드명 제거 (`반영됨`/`반영 대기`) | UX2-A | P0 |
| UX2-5 | 버튼·모달 동사 한글화 | UX2-B | P1 |
| UX2-6 | TPMS/공조/위치 empty 출처 업무 언어화 | UX2-B | P1 |
| UX2-7 | 목록·지도 상태 라벨 동일 사전 | UX2-B | P1 |
| UX2-8 | 기술 상세 접기 (+ 선택 configSynced 갱신) | UX2-C | P2 |
| UX2-9 | 상세 툴바 Provider 뱃지 제거 | UX2-D | P2 |
| UX2-10 | 상세 툴바 「갱신: 절대시각」 미표시 | UX2-D | P2 |
| UX2-11 | 상단 식별·상태 중복 제거 (헤더·제원 접힘) | UX2-D | P1 |
| UX2-12 | Summary SOC → `BatteryProgressBar` | UX2-E | P1 |
| UX2-13 | Summary 충전: 연결 시에만 · `미연결` 숨김 | UX2-E | P1 |
| UX2-14 | Summary 잠금 미노출 | UX2-E | P1 |
| UX2-15 | Summary 신선도 한 줄 (절전=`마지막 신호`만) | UX2-E | P1 |
| UX2-16 | 「실시간 차량 정보」+「현재 위치」2×1 | UX2-F | P1 |
| UX2-17 | SOC 옆 `주행 가능 N km` | UX2-F | P1 |
| UX2-18 | 3×2 퀵타일 (잠금·문·트렁크·공조·실내·실외) | UX2-F | P1 |
| UX2-19 | TPMS를 퀵타일 아래로 이동 | UX2-F | P1 |
| UX2-20 | 하단 공조 제거·잠금 상세 축소 | UX2-F | P1 |
| UX2-21 | 상세 맵 선택 캡션(번호·상세 보기) 숨김 | UX2-G | P1 |
| UX2-22 | 인근 충전소 → 위치 카드 맵 아래 · 하단 카드 제거 | UX2-G | P1 |

---

## UX2-A (P0) — 상태·경고·타임라인 카피

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| 1 | ASLEEP(+추론) 1차: `주차 (절전)` | ✅ | `STATUS_LABEL` · Summary/상태 카드 |
| 2 | 보조: `마지막 신호: N… (절전 모드)` — `Telemetry 공백으로…추론` 제거 | ✅ | |
| 3 | Summary/설명에서 `추론`, `READY`/`ASLEEP` 병기 제거 | ✅ | |
| 4 | 최근 Telemetry 있으면 `configSynced false` **경고 카드 숨김**(또는 info) | ✅ | 수신 없을 때만 warning |
| 5 | 1차에서 `configSynced false` 뱃지·`fleet_telemetry_config` 문구 제거 | ✅ | |
| 6 | 타임라인: `실시간 설정` · `반영됨`/`반영 대기` | ✅ | 필드명 금지 |
| 7 | 구독 표시: `활성 · 설정 반영 대기` 등 (미동기 필드명 금지) | ✅ | |
| 8 | 타임라인 `done`: 최근 수신 또는 synced true면 완료 처리 | ✅ | |

### UX2-A 수동 검수 (실차)

- [ ] 주차(절전) 상세 상단에 `추론` 없음
- [ ] `마지막 신호: …` 형태로 이해 가능
- [ ] Telemetry 수신 중 차량에서 configSynced **경고 카드 기본 숨김**
- [ ] 연동 타임라인에 `configSynced` 문자열 없음

---

## UX2-B (P1) — 버튼·출처·목록 동기

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| 1 | Baseline 재시도 → `제원·상태 다시 불러오기` | ✅ | title에 Baseline 병기 |
| 2 | Telemetry 다시 연결/끊기 → `실시간 연동 다시 켜기`/`끄기` | ✅ | 모달 포함 |
| 3 | REST 사유 라벨 업무 언어화 (Wake 쿨다운 REST 등) | ✅ | `REST_SYNC_REASON_LABEL` |
| 4 | TPMS/공조 출처: `마지막 상세 조회` / `실시간` (Baseline 유산·필드명 제거) | ✅ | |
| 5 | 위치 empty: 업무 한국어 (Location·취침(추론) 제거) | ✅ | |
| 6 | lifecycle 안내 문구 한글화 (영문 enum 과시 축소) | ✅ | `LIFECYCLE_LABEL` · guidance |
| 7 | 목록·지도: `취침 중` → `주차(절전)` 등 상세와 동일 사전 | ✅ | `STATUS_LABEL` · 필터·Attention·Metrics |

### UX2-B 수동 검수 (실차)

- [ ] 운영자가 「실시간 연동 다시 켜기」「제원·상태 다시 불러오기」를 설명 없이 이해
- [ ] 목록/지도와 상세 상태 라벨 일치
- [ ] TPMS/공조/위치 empty에 개발 메모 톤 없음

---

## UX2-C (P2) — 기술 상세 · (선택) synced 갱신

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| 1 | 「기술 상세」접기: configSynced·lifecycle·REST reason 원문 | ✅ | 운영·연동 카드 내 |
| 2 | (선택) Telemetry 수신 시 `telemetryConfigSyncedAt` / configSynced 갱신 | ✅ | `processor.ts` apply 시 |
| 3 | (선택) create 후 GET `synced` 폴링 | ⏭ | 별도 여유 시 — 수신 시 마크로 대체 |

### UX2-C 수동 검수

- [ ] 기술 상세를 펼쳐야만 내부 필드명 확인 가능
- [ ] (선택 구현 시) 수신 후 타임라인 config 단계가 완료로 수렴

---

## UX2-D — 툴바 · 상단 중복 배치

요구: [requirements-vehicle-detail-ui2.md](./requirements-vehicle-detail-ui2.md) §4.6 · §4.7  
상태: **완료** (2026-07-13)

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| 1 | UX2-9: 상세 툴바에서 Provider 뱃지 **제거** | ✅ | 기술 상세에 `provider` 유지 |
| 2 | UX2-10: 상세 툴바 `갱신: 절대시각` **미표시** | ✅ | |
| 3 | UX2-11: 헤더 신원 카드 **폐지** | ✅ | |
| 4 | UX2-11: 제원 접힘 → `VIN ···` / 「제원 보기」 | ✅ | |
| 5 | (선택) 목록·대시보드·지도 툴바 Provider 일괄 제거 | ⏭ | 상세만 적용 |

### UX2-D 수동 검수 (실차)

- [ ] 상세 상단에 Provider 뱃지·「갱신: …」절대시각 없음
- [ ] 스크롤 전 구간에 번호·모델·운행상태가 **각각 한 번만** 보임
- [ ] 제원 접힘에 Model Y · RWD · StealthGrey 등 재노출 없음
- [ ] Summary만으로 “지금 문제인가?” 판단 가능

---

## UX2-E — Summary 밀도 (SOC·충전·잠금·신선도)

요구: [requirements-vehicle-detail-ui2.md](./requirements-vehicle-detail-ui2.md) §4.8  
상태: **완료** (2026-07-13)

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| 1 | UX2-12: Summary SOC → `BatteryProgressBar` (막대→%) | ✅ | 목록과 동일 컴포넌트 |
| 2 | UX2-13: 충전 뱃지 — `DISCONNECTED` 숨김 · 연결/충전만 | ✅ | |
| 3 | UX2-14: 잠금 문구 Summary **미노출** | ✅ | 해제는 이슈·보안 카드 |
| 4 | UX2-15: 절전=`마지막 신호`만 · 비절전=`데이터 N분 전`만 (소스 접미사 없음) | ✅ | |

### UX2-E 수동 검수 (실차)

- [ ] Summary에 프로그레스바 + %가 보이고 숫자만 표시가 아님
- [ ] `미연결`·`잠김`이 Summary에 없음
- [ ] 절전 시 `데이터 N분 전`과 `마지막 신호`가 **동시에** 보이지 않음
- [ ] 충전 중일 때만 충전 뱃지 노출

---

## UX2-F — 상단 2열 · 퀵타일 · TPMS

요구: [requirements-vehicle-detail-ui2.md](./requirements-vehicle-detail-ui2.md) §4.9  
상태: **완료** (2026-07-13)

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| 1 | UX2-16: 좌 「실시간 차량 정보」 · 우 「현재 위치」 2×1 | ✅ | sticky 미적용(가림 방지) |
| 2 | UX2-17: `%` 옆 `주행 가능 N km` | ✅ | rangeKm null 시 숨김 |
| 3 | UX2-18: 신선도 아래 퀵타일 | ✅ | **CI-D: 3×2** 잠금·변속·감시모드·공조·실내·실외 |
| 4 | UX2-19: TPMS 다이어그램 → 퀵타일 아래 | ✅ | 「타이어 · 차체」TPMS 전용 (CI-C 비주얼) |
| 5 | UX2-20: 하단 공조 제거 · 잠금→「문 · 창문 상세」축소 | ✅ | |

### UX2-F 수동 검수 (실차)

- [ ] 상단이 상황|위치 2열로 보임
- [ ] SOC와 주행 가능 거리가 한 줄에 이해됨
- [ ] 퀵타일(잠금·변속·감시모드·공조·실내·실외)·「타이어 · 차체」가 신선도 아래에 있음 — [CI](./checklist-car-info-card.md)
- [ ] 하단 공조 카드가 없고 잠금/공조 정보가 중복되지 않음

---

## UX2-G — 위치 캡션 · 인근 충전소

요구: [requirements-vehicle-detail-ui2.md](./requirements-vehicle-detail-ui2.md) §4.10  
상태: **구현 완료** (`VehicleMap.hideSelectionCard` · 위치 카드 내 인근 충전소)

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| 1 | UX2-21: 상세에서 맵 선택 카드(번호·모델·상태·상세 보기) **숨김** | ✅ | `/map`·대시보드 등은 유지 |
| 2 | UX2-22: 인근 충전소를 「현재 위치」맵 아래로 이동 | ✅ | 상위 5곳 · 좌표 한 줄 생략 |
| 3 | UX2-22: 하단 독립 「인근 충전소」카드 **제거** | ✅ | |

### UX2-G 수동 검수 (실차)

- [ ] 상세 위치 카드에 번호·「상세 보기」캡션 없음
- [ ] 인근 충전소가 지도 바로 아래에 있음
- [ ] 페이지 하단에 인근 충전소 단독 카드 없음

---

## 관련 문서

| 문서 | 역할 |
|------|------|
| [requirements-vehicle-detail-ui2.md](./requirements-vehicle-detail-ui2.md) | 표현 사전·§4.6~4.10·수용 기준 |
| [requirements-vehicle-detail-ui.md](./requirements-vehicle-detail-ui.md) | VD IA |
| [checklist-vehicle-detail-ui.md](./checklist-vehicle-detail-ui.md) | VD-1~3 · UX2 후속 |
| [checklist-onboarding-e2e-reset.md](./checklist-onboarding-e2e-reset.md) | 온보딩 후 수용 테스트 |
| [development-checklist.md](./development-checklist.md) | Phase UX2 요약 |

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-13 | UX2-A~C 체크리스트 작성 (미착수) — requirements-vehicle-detail-ui2 반영 |
| 2026-07-13 | UX2-A~C 구현 완료 · 실차 수동 검수 항목은 온보딩 후 |
| 2026-07-13 | UX2-D(UX2-9~11) 추가·구현 완료 |
| 2026-07-13 | UX2-E(UX2-12~15) 추가·구현 완료 — Summary SOC바·충전/잠금·신선도 |
| 2026-07-13 | UX2-F(UX2-16~20) 추가·구현 완료 — 상단 2열·퀵타일·TPMS |
| 2026-07-13 | UX2-G(UX2-21~22) 추가 — 위치 캡션·인근충전소 (미착수) |
| 2026-07-13 | UX2-G(UX2-21~22) 구현 완료 — hideSelectionCard · 맵 아래 인근충전소 |
| 2026-07-14 | UX2-F 퀵타일·TPMS → CI 후속 반영 메모 |
| 2026-07-14 | UX2-F → CI-D 3×2 퀵타일 반영 |
| 2026-07-14 | CI-D 순서 — 잠금·변속·감시모드·공조·실내·실외 |
