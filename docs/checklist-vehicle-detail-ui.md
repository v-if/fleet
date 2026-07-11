# Phase VD — 차량 상세 UI 고도화 체크리스트

관련 요구사항: [requirements-vehicle-detail-ui.md](./requirements-vehicle-detail-ui.md)  
대상: `FleetVehicleDetailView` (`/vehicles/[id]`)  
수용 테스트 VIN: `LRWYGCFJ7SC214742`

---

## VD-1 (P0) — 신뢰 + 한눈에 — ✅ 2026-07-12

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| 1 | Summary strip (상태·SoC·충전·잠금·이슈·데이터 나이) | ✅ | sticky, 이슈→`#vehicle-security` |
| 2 | ASLEEP 추론 배지·`sleepInferredAt` | ✅ | 「취침 (추론)」 |
| 3 | 위치 null empty UX (가짜 좌표 금지) | ✅ | dashed placeholder |
| 4 | `configSynced === false` 경고 카드 | ✅ | 활성 구독 + 미동기 시 |
| 5 | 이슈 스트립 ↔ 보안 타일 정렬 | ✅ | 헤더 이슈 뱃지 중복 제거, 보안 타일 |
| 6 | 운영 액션 그룹화 | ✅ | `#vehicle-ops` 카드 |
| 7 | VIN 복사 | ✅ | 수용 기준 |
| 8 | TPMS 이슈 판정 PSI 환산 | ✅ | atm 그대로 임계 비교하던 버그 수정 |
| 9 | `formatRelativeTime` / `formatSocPercent` | ✅ | `vehicle-status.ts` |

### VD-1 수동 검수 (실차)

- [ ] Summary에서 취침(추론)·SoC·데이터 상대시각 확인
- [ ] 위치 없을 때 placeholder 문구 확인 (지도 미표시)
- [ ] configSynced false 시 경고 카드 표시
- [ ] VIN 복사 동작
- [ ] 잠금/문/창문 타일 톤 · 이슈 링크 스크롤

---

## VD-2 (P1) — 운영 진단 — ✅ 2026-07-12

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| 1 | Connectivity 타임라인 (구독/VK/config/Baseline/Telemetry/REST/wake) | ✅ | `#vehicle-ops` |
| 2 | `lastError` · `baselineLastError` 접이식 | ✅ | 오류 있으면 “기록 있음” |
| 3 | TPMS/공조 출처·시각 힌트 | ✅ | REST Baseline vs Telemetry |
| 4 | 이벤트 `resolvedAt` · empty 카피 강화 | ✅ | 해소됨 뱃지·취소선 |
| 5 | 제원 섹션 접기 | ✅ | 기본 접힘, VIN 복사는 접힌 상태에서도 |
| 6 | REST 사유 한글 라벨 | ✅ | `REST_SYNC_REASON_LABEL` |

### VD-2 수동 검수 (실차)

- [ ] 연동 타임라인에 VK·Baseline·wake·REST 사유 표시
- [ ] baselineLastError(과거 408 등) 접이식에서 확인
- [ ] 제원 접기/펼치기 · 접힌 상태 VIN 복사
- [ ] 공조/TPMS 출처 힌트
- [ ] 이벤트 empty 카피

---

## VD-3 (P2) — 데이터 파이프 연동 — ✅ 2026-07-12

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| 1 | Snapshot 스키마: chargeLimitSoc · chargerPowerKw · 개별 도어/트렁크 | ✅ | migrate `20260712080000_phase_vd3_snapshot_detail` |
| 2 | REST 매핑: charge · doors/trunk · windows(ft/rt 오매핑 수정) | ✅ | `mapper.ts` |
| 3 | `nearby_charging_sites` · `service_data` 클라이언트 + Baseline/wake 수집 | ✅ | |
| 4 | Baseline 시 `recent_alerts` → VehicleEvent 갱신 | ✅ | ALERT/WARNING 교체 |
| 5 | Telemetry 필드 보강: EstBatteryRange · DoorState | ✅ | 재연결 시 config 반영 |
| 6 | 상세 UI: 충전 한도/출력 · 개별 개폐 · 인근 충전소 | ✅ | Location empty 카피 보강 |

### VD-3 수동 검수 (실차)

- [ ] 차량 깨어 있을 때 Baseline → 충전 한도·인근 충전소·serviceStatus·이벤트 갱신
- [ ] 보안 타일에 개별 도어/프렁크/트렁크 표시
- [ ] Telemetry 재연결 후 EstBatteryRange/DoorState 구독 반영(선택)
- [ ] `pnpm exec prisma generate` 후 `pnpm dev` 재시작 (마이그레이션 적용됨)

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-12 | VD-1 체크리스트 작성 · 구현 완료 반영 |
| 2026-07-12 | VD-2 완료 — 타임라인·오류·출처·이벤트·제원 접기 |
| 2026-07-12 | VD-3 완료 — charge/doors/trunk 스키마·nearby/service/alerts · UI |
