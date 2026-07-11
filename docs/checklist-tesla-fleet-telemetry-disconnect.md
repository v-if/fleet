# 체크리스트 — Fleet Telemetry 연동 해제 (Phase 4.5)

> **상태**: A~D 완료 / P1 오프라인 감지기 미완 (2026-07-11)  
> **요구사항**: [requirements-tesla-fleet-telemetry-disconnect.md](./requirements-tesla-fleet-telemetry-disconnect.md)  
> **검증 VIN**: `LRWYGCFJ7SC214742` · `pnpm disconnect:verify` (`scripts/verify-phase45-disconnect.ts`)

---

## 0. 선행

- [x] 초안 분석 · A(Telemetry 단절) / B(차량 unlink) 분리
- [x] `vehicle_data` 프로브 금지 · `fleet_status` 대체 확정
- [x] development-checklist Phase 4.5 연결
- [x] README 인덱스 등록

---

## A. 스키마

- [x] `VehicleLifecycle.TELEMETRY_DISCONNECTED`
- [x] `TelemetryDisconnectReason` + `disconnectedAt` (Subscription)
- [x] migrate (`20260711130000_phase45_telemetry_disconnect`)
- [x] API DTO · lifecycle 라벨 (`DISCONNECT_REASON_LABEL`)

---

## B. API · 도메인

- [x] `disconnectVehicleTelemetry` (soft-delete 없음)
- [x] `POST /api/vehicles/[id]/telemetry/disconnect`
- [x] `POST /api/vehicles/[id]/telemetry/reconnect` (+ VK confirm)
- [x] unlink(B) = A 후 soft-delete
- [x] inactive 구독 → wake REST skip · allowlist 제외
- [ ] (P1) 오프라인 감지기 (`fleet_status` only)

---

## C. UI

- [x] 상세: 확인 모달 + VK 안내 성공 모달
- [x] 상세: 단절 배지·배너·다시 연결 · 단절 시각/사유
- [x] 목록/대시보드: 단절 뱃지·필터 · 요약 카드 링크
- [x] unlink 라벨 → 「플릿에서 제거」

---

## D. 검증

- [x] 소프트웨어 끊기 E2E — VIN `LRWYGCFJ7SC214742`  
  - Tesla `DELETE fleet_telemetry_config` 200 · DB `TELEMETRY_DISCONNECTED` · `USER_SOFTWARE` · 목록 잔존(`isDeleted=false`) · allowlist 제외
- [x] ASLEEP ≠ DISCONNECTED 오탐 없음 (스냅샷 ASLEEP + 단절 사유 없는 DISCONNECTED = 0)
- [ ] (P1) VK 제거 → fleet_status → DISCONNECTED
- [x] 자동 wake / vehicle_data 프로브 없음 (`src`에 `wake_up` 0 · disconnect 경로 `vehicle_data` 없음 · wake REST skip)

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-11 | 초안 — Phase 4.5 체크리스트 (코드 미착수) |
| 2026-07-11 | A~C 완료 — 스키마·disconnect/reconnect/unlink·UI · D·P1 감지기 잔여 |
| 2026-07-11 | D 완료 — `disconnect:verify` · VIN LRWYGCFJ7SC214742 · partner token 빈값 버그 수정 · P1 감지기 잔여 |
