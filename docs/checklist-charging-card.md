# Phase CC — 충전 중 서브카드 체크리스트

관련 요구사항: [requirements-charging-card.md](./requirements-charging-card.md)  
상태: **CC-A~D 구현 완료** · migrate·실차 검수 남음

---

## 이슈 ↔ Phase

| ID | 요구 | Phase | 상태 |
|----|------|-------|:----:|
| CC-1 | 신선도↔퀵타일 사이 full-width 슬롯 | CC-A | ✅ |
| CC-2 | `DISCONNECTED`/null 비노출 | CC-A | ✅ |
| CC-3 | `CHARGING` → 「충전 중」 | CC-A | ✅ |
| CC-4 | `COMPLETE`/`STOPPED` 카드·제목 | CC-B | ✅ |
| CC-5 | SOC·주행 km·출력 kW·한도 % | CC-A | ✅ |
| CC-6 | SOC 줄 충전 뱃지 숨김 | CC-A | ✅ |
| CC-7 | 한글 카피 · 필드명 미노출 | CC-A | ✅ |
| CC-8 | 완속/급속 표시 (`chargingPowerKind`) | CC-D | ✅ |

---

## 구현 메모

- 컴포넌트: `ChargingSessionCard` · 헤더 「완속」/`급속` 뱃지
- Ingest: `resolveChargingPowerFromTelemetry` · Snapshot `chargingPowerKind`
- Migration: `20260714180000_cc_d_charging_power_kind`

---

## 수동 검수 (실차)

- [ ] `npx prisma migrate deploy` (컬럼 적용)
- [ ] 충전 중: 퀵타일 위에 「충전 중」카드 · 출력/SOC 표시
- [ ] 미연결: 카드 없음 · SOC 옆 충전 뱃지 없음
- [ ] 충전 완료/중지: 제목·톤 구분
- [ ] AC 세션 「완속」 · DC 세션 「급속」 · REST-only는 종류 생략
- [ ] 영문 필드명 화면 없음

수용 VIN: `LRWYGCFJ7SC214742`

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-14 | CC-A~B 체크리스트 · 구현 완료 |
| 2026-07-14 | CC-8/§5.4 완속·급속 표시 후속 반영 |
| 2026-07-14 | **CC-D 구현 완료** |
