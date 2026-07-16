# 차량 상세 — Telemetry 시대 IA·표시 고도화 (VD3)

| 항목 | 내용 |
|------|------|
| 목적 | CAF Telemetry 확장·TRF(Baseline/park nearby) 이후 **관리자 차량상세**의 정보 구조·배치·우선순위를 재정의한다. Tesla 앱 복제가 아니라 **5초 내 관제 판단 → 필요 시 조치** |
| 배경 | 상세 UI는 초기 REST/폴링·부분 Telemetry 기준으로 쌓였다. 지금은 P0/P1 스트림·제원 REST·주차 nearby가 있는데, **카드가 늘고 질문은 분산**되어 있다 |
| 리서치 | [research-vehicles-detail-chatgpt.md](./research/research-vehicles-detail-chatgpt.md), [research-vehicles-detail-gemini.md](./research/research-vehicles-detail-gemini.md) |
| 선행 | [requirements-vehicle-detail-ui.md](./requirements-vehicle-detail-ui.md) (VD), [requirements-vehicle-detail-ui2.md](./requirements-vehicle-detail-ui2.md) (VD-UX2), [requirements-vehicle-detail-ops-copy.md](./requirements-vehicle-detail-ops-copy.md) (VD-OPS), [requirements-tesla-fleet-telemetry-config-add-field.md](./requirements-tesla-fleet-telemetry-config-add-field.md) (CAF), [requirements-tesla-wake-telemetry-rest.md](./requirements-tesla-wake-telemetry-rest.md) (TRF-B2), [requirements-charging-card.md](./requirements-charging-card.md), [requirements-car-info-card.md](./requirements-car-info-card.md) |
| 적용 | **컷오버 완료:** 기본 `/vehicles/[id]` = VD3 · 이전 `/vehicles/[id]/v2` 보존 |
| 상태 | **문서 ✅ · 기본 상세 VD3 ✅ · v2 보존 ✅ · 실차 비교 ☐** |
| 작성일 | 2026-07-15 |
| ID | **VD3** |

---

## 1. 리서치 분석

### 1.1 ChatGPT 문서 — UI/UX 본선 (채택 축)

| 주장 | 평가 | VD3 반영 |
|------|------|----------|
| FMS = 「조치에 필요한 정보」, Tesla 앱 ≠ FMS | **강하게 동의** | 핵심 원칙 §2 |
| 흐름: 표시 → 문제 발견 → 조치 | **동의** | Hero → 이슈/권장 → 상세 |
| AI Summary 상단 | **방향 동의 · 1차는 룰 기반** | LLM은 후순위. 규칙형 「관제 요약」먼저 |
| 실시간 상태 카드 + 큰 운행모드(주차/운행/충전) | **동의** · 일부 As-Is 존재 | Hero에 모드 강조 |
| 지도를 위로 | **동의** | 1viewport 내 지도 유지·강화 |
| 충전/TPMS/공조 분리 카드 | **부분 동의** | CAF 필드로 채우되 스크롤 과밀 방지 |
| 최근 운행(오늘 km·시간·평균속도) | **제품 가치↑ · 데이터 갭** | Phase C — Trip 집계 없으면 미표시 |
| REST 제원 블록 | **이미 있음 · TRF-B1** | **VD3-S**: Hero `i` 모달 (하단 접힘 카드 제거) |
| 원격 제어(잠금·공조·wake…) | **보류** | Command Proxy·권한·정책 후속. Wake 자동 금지(TRF) |
| 관리자 TOP10 | **채택** | §4 우선순위 표 |

### 1.2 Gemini 문서 — Cockpit / 관제·제어 분리 (채택·보류 정리)

| 주장 | 평가 | VD3 반영 |
|------|------|----------|
| 관리자 3질문: 일하고 있나 / 문제 있나 / 직접 제어 가능? | **동의** (3번은 후순위) | §2 질문 순서. 제어는 Phase Command |
| 정적(제원) · Telemetry · REST **제어** 구역 분리 | **강하게 동의** | IA·출처 매트릭스 §5 |
| 상단: 식별 + **가동 배지**(주행/대기/충전/취침) | **동의** · ChatGPT와 합치 | Hero 운행모드. 「탑승 대기」(P+공조)는 모드 후보 |
| 좌: 탑뷰 문·창문·TPMS + Hard 점멸 | **방향 동의 · 단계화** | 현행 탑뷰/TPMS 강화 = VD3-3. 풀 3D·창틈 SVG는 P2 |
| 배터리 ↔ 충전 중 **Dynamic UI 전환** | **동의** · CC와 정합 | 충전모드 강조 유지·확장 |
| 우: 원격 명령(잠금·공조·wake·한도) | **보류** | Command Proxy·RBAC 후속. 자동/상시 wake 금지(TRF). **수동 깨우기 UI**는 별도 정책 검토 |
| 우: 목적지·ETA·도착시 SoC 예측 | **동의 · CAF 필드 이미 구독** | 주행 중 조건부 블록 (VD3-3). `RouteTrafficMinutesDelay` 미구독 시 생략 |
| Telemetry 롤링·REST 명령 5~10초 스피너 | **동의** | 표시는 폴링/갱신 UX · 명령 UX는 Command Phase |

**Gemini vs ChatGPT:**  
둘 다 「모드·에너지·위치/목적지·이상」이 핵심. Gemini는 **좌(관제 비주얼) / 우(제어·트립)** 2열 Cockpit을 더 강조하고, ChatGPT는 **요약→지도→카드 스크롤**과 AI/오늘운행을 앞세운다. VD3는 **ChatGPT형 스크롤 + Gemini형 모드·Dynamic 충전·목적지 카드**를 합치고, **우측 원격 패널은 제외(후속)**.

### 1.3 리서치 vs 우리 계약(충돌 정리)

| 리서치 제안 | 현행 FMS 계약 | VD3 결정 |
|-------------|---------------|-----------|
| 상단/우측 원격 제어·수동 wake | Command 미구현 · TRF 자동 wake 금지 | UI 동작 **제외**. 수동 wake는 후속 정책 |
| vehicle_data로 상세 보강 | Telemetry SoT · Freeze | Snapshot 동적 = Telemetry. REST는 제원·nearby만 |
| 오늘 운행 52km (ChatGPT) | Trip/세션 테이블 없음 | 「데이터 없으면 구역 숨김」 |
| `RouteTrafficMinutesDelay` (Gemini) | 현 CAF 구독 목록에 없음 | 구독 추가 없으면 미표시 |

---

## 2. 원칙 (관리자 · Telemetry 시대)

1. **질문이 레이아웃이다** — (1) 지금 문제인가 (2) 어디·무슨모드 (3) 충전·보안 (4) 연동 건강 (5) 제원.
2. **동적 = Telemetry SoT** — SoC·위치·문·TPMS·공조·OTA%·목적지 등은 스트림. 제원 = Baseline REST. 인근충전소 = park nearby REST (실패·절전 시 공백 허용).
3. **1차 화면 = 업무 언어** — VD-UX2·VD-OPS 유지. enum·필드명·Freeze 용어는 운영 접힘.
4. **정상은 조용히, 이상만 크게** — 잠김·공조 OFF·충전 미연결은 Hero를 채우지 않음 (UX2 조건부).
5. **조치 3종만 상단 CTA** — 새로고침 / 재연동 / (필요 시) 제원. 원격제어·깨우기는 VD3에 넣지 않음.
6. **CAF를 “다 보여주기” 금지** — 구독 44키 ≠ 상세 44카드. 관리자 TOP에 묶는다.

---

## 3. As-Is 갭 (2026-07 코드 기준)

이미 있는 것: Summary·지도·인근충전소·충전 서브카드(CC)·3×2 퀵타일·TPMS·문상세·OTA/목적지 일부(CAF-4)·제원(Hero `i` 모달)·운영 타임라인(VD-OPS).

| 갭 | 설명 |
|----|------|
| **관제 요약 부재** | issue 태그는 있으나 ChatGPT형 「한 블록 요약」이 약함 · 정상시 확언 부족 |
| **운행 모드 약함** | Gear/충전/절전이 흩어짐 · Hero에 «주차/운행/충전/절전» 단일 시그널 부족 |
| **CAF 표출 불균일** | 포트·OTA·목적지·Hard 경고는 들어왔으나 속도·도착예정·전조·Preconditioning 등 약함 |
| **카드 나열감** | 스크롤이 길고 「다음 볼 곳」이 불명확 |
| **운행/이벤트** | 오늘 거리·이벤트 타임라인은 데이터/집계 없음 |
| **인근충전소 신뢰** | asleep 실패·빈배열 덮기 가능 · UI는 「주차 후 갱신」만 |
| **출처 혼란** | 값마다 Telemetry/REST가 섞여도 1차엔 숨김(OK) · 개발 모니터와 관리자 구역 경계 유지 |

---

## 4. To-Be IA (권장 스크롤)

모바일 1열 · 데스크톱은 **상단 2열(좌: 상태·요약 · 우: 지도)** 유지·정리.

```text
┌─ 툴바 ─────────────────────────────────────┐
│ 목록 ← · 새로고침 · (이상 시) 재연동       │
├─ Hero (1 viewport 핵심) ───────────────────┤
│ 번호 · 모델 · [주차|운행|충전|절전] · 신선도 │
│ SoC 게이지 · 잔여 km · (조건부 이슈 칩)     │
│ 관제 요약 (룰) · 권장 조치 0~3개           │
├─ 지도 + 인근충전소 ───────────────────────┤
│ 맵 · 주소/좌표 캡션 · nearby (또는 empty)  │
├─ 관제 블록 (접지 가능) ───────────────────┤
│ 충전(중일 때 강조) · 보안·차체 · 공조 · 타이어 │
│ 운행 중이면: 속도·목적지·도착·잔여에너지   │
├─ 소프트웨어 · OTA (이상/진행 시만 상단화) ─┤
├─ (제원 = Hero `i` 모달 · 스크롤 카드 없음) ─┤
├─ 운영 · 연동 (접힘·관리자) ───────────────┤
└─ (후속) 운행 요약 · 이벤트 ────────────────┘
```

**ChatGPT / Gemini 합성:**  
요약·지도 우선(ChatGPT) + 가동 배지·충전 Dynamic·목적지/도착 SoC(Gemini). 원격 패널·3D 풀모션은 후속.
---

## 5. 표시 데이터 · 출처 매트릭스

### 5.1 Hero · 관제 요약 (P0)

| UI | 출처 | 비고 |
|----|------|------|
| 운행 모드 | Telemetry Gear + ChargeState + ASLEEP 추론 | 단일 뱃지/헤드라인 |
| SoC · 잔여 km | Soc · EstBatteryRange | |
| 신선도 | lastTelemetryAt | VD-UX2 한 줄 |
| 이슈 칩 | 저배터리·잠금해제·문/창·TPMS Hard/Soft·신호없음 | 정상 시 숨김/「이상 없음」 |
| 권장 조치 | 룰 (배터리% / 재연동 / TPMS) | CTA는 기존 3종만 |

### 5.2 지도 · nearby (P0)

| UI | 출처 | 비고 |
|----|------|------|
| 지도 | Location | null UX 유지 (LN) |
| 인근충전소 | park nearby REST | dest+supercharger 합침·거리순. **목록 있을 때만 UI 블록** (VD3-NB). 실패/절전 = 숨김. **2km stale → Snapshot null** 유지 |

### 5.3 관제 블록 — Telemetry CAF (P0~P1)

| 구역 | 키/필드 (대표) | 표시 |
|------|----------------|------|
| 충전 | ChargeState · TimeToFullCharge · AC/DC · ChargeLimitSoc · ChargePort* · FastCharger | CC 카드 확장 · 미충전 시 축소 |
| 보안·차체 | Locked · DoorState · Windows · Sentry · Valet · ServiceMode | 퀵타일 + 문 상세 |
| 공조 | Inside/OutsideTemp · HvacPower · Preconditioning | ON/온도만이 아니라 Precondition |
| 타이어 | Tpms* · Hard/SoftWarnings | 평균·이상 개수(ChatGPT) 권장 · SVG는 P2 |
| 주행 중 | VehicleSpeed · Destination* · Minutes/MilesToArrival · ExpectedEnergy% | **주행 중일 때만** (Gemini 네비 카드). 교통지연 필드는 구독 시 |

### 5.4 REST (이미 졸업된 것만)

| UI | 출처 | 금지 |
|----|------|------|
| 제원 · SW 버전(제원) | Baseline specs-only | vehicle_data로 Snapshot 덮기 |
| nearby | park nearby | Wake REST · wake_up |

### 5.5 후순위 (데이터/정책)

| UI | 필요 | Phase |
|----|------|-------|
| 오늘 운행 km·시간 | Trip 집계 또는 Odometer 일일 delta | VD3-D |
| 이벤트 타임라인 | Ingress/Audit 요약 파이프 | VD3-D |
| 원격 제어 | Command Proxy · RBAC | 별도 Phase |
| LLM AI Summary | 프롬프트·비용·환각 | 데모 후 |

---

## 6. 의견 요약 (작성자)

### 6.0 IA · 데이터 (기존)

1. **ChatGPT·Gemini 공통 IA는 맞고**, BORI에선 **원격·자동 wake·LLM·Trip 집계**를 빼거나 뒤로 미뤄야 TRF/하이브리드와 안 깨진다.  
2. **가장 ROI 큰 개선**은 새 API가 아니라 **Hero + 가동모드 + 룰 요약 + 충전 Dynamic + 주행 중 목적지/ETA**(Gemini CAF 활용).  
3. Gemini **좌 관제 / 우 제어** Cockpit은 매력적이지만, 제어 열은 Command Phase 전까지 **넣지 않음** — 지도·nearby·요약을 우측에 두는 현행 2열을 유지·정리.  
4. VD·UX2·OPS·CC·CI를 **폐기하지 않고 재배치**한다.  
5. 「Telemetry로 더 들어온다」= 다 깔지 말 것. **모드·이상·충전·목적지**에만 노출을 키운다.

### 6.1 As-Is / To-Be 병렬 URL — 의견 (채택 권고)

**결론 (2026-07-16 컷오버):** VD3를 **기본 상세**로 승격했다. 이전 화면은 `/vehicles/[id]/v2`에 보존. 구 `/v3` URL은 기본으로 리다이렉트.

| 관점 | 의견 |
|------|------|
| 기본 진입 | 목록·위젯 → **`/vehicles/[id]`** (VD3) |
| 이전 화면 | **`/vehicles/[id]/v2`** — 비교·롤백용 |
| 구 URL | `/vehicles/[id]/v3` → `/vehicles/[id]` 리다이렉트 |

---

## 7. 병렬 라우트 · 구현 계약 (To-Be 작업 방식)

### 7.1 URL · 라우트

| 구분 | URL (admin 예) | 컴포넌트 |
|------|----------------|----------|
| **기본 (VD3)** | `/vehicles/[id]` | `FleetVehicleDetailViewV3` |
| **이전 (v2)** | `/vehicles/[id]/v2` | `FleetVehicleDetailView` |
| **구 URL** | `/vehicles/[id]/v3` | → `/vehicles/[id]` 리다이렉트 |

### 7.2 공유 / 분기

| 공유 (한 곳) | To-Be만 |
|--------------|---------|
| `getVehicle` 등 페이지 데이터 · DTO | IA·레이아웃·관제 요약·조건부 CAF 블록 |
| VD-OPS 액션 API (제원·재연동) | Hero·모드·근처 배치 |
| TRF/CAF 수집 | (후속) Trip/이벤트 구역 |

### 7.3 비교 검수

동일 VIN · 동일 시각대에 As-Is와 `/v3`를 열어 §4 IA·§5 필드가 기대대로인지 본다.  
결정 체크리스트(초안): 모드 뱃지 · SoC · 지도 · nearby · 충전 중 Dynamic · 주행 중 목적지 · Hero `i` 제원 · 운영 CTA.

### 7.4 종료 조건

- [ ] As-Is 유지 / To-Be 채택 / 혼합(일부 블록만 이식) 중 **하나 결정**  
- [ ] 채택 시: 목록→상세 링크 전환 · 구 URL 리다이렉트 또는 제거 일정  
- [ ] 기한(권고): 첫 To-Be 배포 후 **2~4주 내** 결정 (무기한 듀얼 금지)

---

## 8. Phase · ID

| ID | 내용 | 상태 |
|----|------|:----:|
| **VD3-1** | 본 문서 · 리서치 · **병렬 URL 전략** 승인 | ✅ |
| **VD3-1b** | 라우트 컷오버 — 기본 VD3 · v2 이전 · `/v3` 리다이렉트 | ✅ |
| **VD3-2** | To-Be: Hero · 운행모드 · 룰 기반 관제 요약 | ✅ |
| **VD3-3** | To-Be: CAF 조건부 블록 | ✅ |
| **VD3-4** | To-Be: nearby 신뢰 UX | ✅ |
| **VD3-5** | (후속) 운행 요약·이벤트 | ☐ |
| **VD3-6** | 실차 비교 검수 (As-Is vs `/v3`) | ☐ |
| **VD3-7** | 컷오버 — 기본 URL VD3 · v2 보존 | ✅ |
| **VD3-S** | Hero `i` 제원 모달 — [vd3-specs-popover](./requirements-vehicle-detail-vd3-specs-popover.md) | ✅ 코드 · ☐ 실차 |
| **VD3-N** | Hero 표시명 연필 인라인 편집 — [vd3-display-name](./requirements-vehicle-detail-vd3-display-name.md) | ✅ 코드 · ☐ 실차 |
| **VD3-R** | PC·모바일 상단 툴바 통일 · v2 링크 제거 — [vd3-responsive-toolbar](./requirements-vehicle-detail-vd3-responsive-toolbar.md) | ✅ 코드 · ☐ 검수 |
| **VD3-NB** | 인근충전소 목록 있을 때만 블록 — [vd3-nearby-block](./requirements-vehicle-detail-vd3-nearby-block.md) | ✅ |
| **VD3-DC** | 주행 목적지 주차·절전 클리어 — [vd3-destination-clear](./requirements-vehicle-detail-vd3-destination-clear.md) | ✅ 코드 · ☐ 실차 |

체크리스트: [checklist-vehicle-detail-vd3.md](./checklist-vehicle-detail-vd3.md)

---

## 9. 비범위

- Telemetry 구독 키 추가(CAF 재정의) — 필요 시 CAF 문서만 수정  
- nearby 지연·재시도·wake_up — TRF/nearby 후속  
- 명령(잠금/공조·경적) UI 동작  
- 목록(`/vehicles`) IA 전면 개편 (컷오버 전 **기본 링크는 As-Is 유지**)  
- As-Is 파일을 VD3 구현 중에 대량 리팩터 (병렬 기간 중 금지에 가깝게)

---

## 10. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-15 | 초안 — ChatGPT/Gemini 리서치 분석 · Telemetry·TRF 정합 IA · Phase VD3 |
| 2026-07-15 | Gemini 본문 정정 반영 — Cockpit/제어/네비 (오첨부 nearby 분석 폐기) |
| 2026-07-15 | §6.1·§7 — As-Is 유지 + `/v3` 병렬 URL 비교·컷오버 전략 |
| 2026-07-15 | 코드 — `FleetVehicleDetailViewV3` · `/vehicles/[id]/v3` · 상호 링크 · VD3-1b~4 ✅ |
| 2026-07-16 | VD3-S 링크 — Hero `i` 제원 모달 요구 |
| 2026-07-16 | VD3-S-2·S-3 — Hero `i` + Specs Modal · 하단 제원 accordion 제거 |
| 2026-07-16 | VD3-N 링크 — Hero 표시명 연필 인라인 편집 요구 |
| 2026-07-16 | VD3-N-2·N-3 — PATCH API · plateNumberEditedAt · Hero 연필 UI |
| 2026-07-16 | VD3-7 컷오버 — `/vehicles/[id]` 기본 VD3 · v2 · `/v3` 리다이렉트 |
| 2026-07-16 | VD3-R 링크 — PC·모바일 상단 툴바 통일 · v2 링크 제거 |
| 2026-07-16 | VD3-R-2 — `layout="inline"` · 기본 상세 v2 링크 제거 |
| 2026-07-16 | VD3-NB 링크 — 인근충전소 블록 조건부 표시 |
| 2026-07-16 | VD3-NB-2·3 — empty 숨김 · `nearbyEmptyReason` 삭제 |
| 2026-07-16 | VD3-DC 링크 — 목적지 주차·절전 클리어 |
| 2026-07-16 | VD3-DC-2·3 — P 엣지·ASLEEP destination* 클리어 |
|
