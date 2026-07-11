# 체크리스트 — Fleet Telemetry 연동 해제 (Phase 4.5)

> **상태**: A~C 완료 / D(E2E)·P1 오프라인 감지기 미완 (2026-07-11)  
> **요구사항**: [requirements-tesla-fleet-telemetry-disconnect.md](./requirements-tesla-fleet-telemetry-disconnect.md)

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

- [ ] 소프트웨어 끊기 E2E
- [ ] ASLEEP ≠ DISCONNECTED 오탐 없음
- [ ] (P1) VK 제거 → fleet_status → DISCONNECTED
- [ ] 자동 wake / vehicle_data 프로브 없음

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-11 | 초안 — Phase 4.5 체크리스트 (코드 미착수) |
| 2026-07-11 | A~C 완료 — 스키마·disconnect/reconnect/unlink·UI · D·P1 감지기 잔여 |
