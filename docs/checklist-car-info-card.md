# Phase CI — 차체·TPMS 통합 다이어그램 체크리스트

관련 요구사항: [requirements-car-info-card.md](./requirements-car-info-card.md)  
샘플: [sample-html/vehicle-sample.html](./sample-html/vehicle-sample.html)  
상태: **CI-A~D · CI-C2 · CI-C3 구현 완료** · §10 평가 반영 · CI-E(개선) 미착수 · 실차 검수 남음

---

## 이슈 ↔ Phase

| ID | 요구 | Phase | 상태 |
|----|------|-------|:----:|
| CI-1 | 탑뷰 + 4바퀴 PSI · 「타이어 · 차체」 | CI-A/C | ✅ |
| CI-2 | 실내 온도 | CI-D | ✅ 퀵타일 |
| CI-3 | 실외 온도 | CI-D | ✅ 퀵타일 |
| CI-4 | 변속 P/R/N/D | CI-D | ✅ 퀵타일 |
| CI-5 | 구역 제목 「타이어 · 차체」 | CI-A | ✅ |
| CI-6 | ~~퀵타일 2×2~~ | — | ❌ → CI-10 |
| CI-7 | 필드명 미노출 · null `-` | CI-A | ✅ |
| CI-8 | 좁은 폭 겹침 완화 | CI-A | ✅ |
| CI-9 | sample HTML 차체·타이어 | CI-C | ✅ |
| CI-9b | sample3 차체·알로이 휠·연결선 | CI-C2 | ✅ |
| CI-9c | sample4 Ultimate · 화이트·실버 · 헤더 우측 알림 | CI-C3 | ✅ |
| CI-10 | 3×2: 잠금·변속·감시모드·공조·실내·실외 | CI-D | ✅ |
| CI-11~20 | §10 개선 후보 (개폐·강조·신선도 등) | CI-E | ☐ |

---

## 구현 메모

- 퀵타일: `buildQuickStatusTiles` · `grid-cols-3` · 순서 잠금→변속→감시→공조→실내→실외
- 다이어그램: `TpmsDiagram` TPMS 전용 (글래스 루프 · 측면 타이어)
- 중복 제거: 하단 「센트리」칸 · 배터리「변속」필드 제거 (퀵타일 SoT)
- 평가: [requirements-car-info-card.md](./requirements-car-info-card.md) **§10**

---

## 수동 검수 (실차)

- [ ] 3×2에 잠금 · 변속 · 감시모드 · 공조 · 실내 · 실외 (해당 순서)
- [ ] 「타이어 · 차체」에 실내·실외·변속 **없음** · PSI만
- [ ] 저압 「주의」·펄스
- [ ] `ShiftStateD` / `InsideTemp` 등 필드명 미노출
- [ ] 라이트/다크 · 모바일
- [ ] (평가용) 문·트렁크 이상을 **상단만**으로 즉시 알 수 있는지 — CI-11 판단 근거

수용 VIN: `LRWYGCFJ7SC214742`

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-14 | CI-A~C 구현 |
| 2026-07-14 | **CI-D** — 3×2 퀵타일 확정 · 순서 잠금·변속·감시·공조·실내·실외 |
| 2026-07-14 | §10 카드 평가 · CI-E(CI-11~20) 후보 기록 |
| 2026-07-17 | **CI-C2** — sample3 `TpmsDiagram` 고도화 ✅ |
| 2026-07-17 | **CI-C3** — sample4 Ultimate `TpmsDiagram` ✅ |
| 2026-07-17 | **CI-C3b** — 화이트·실버 차체 · 「타이어」제목 우측 알림 ✅ |
