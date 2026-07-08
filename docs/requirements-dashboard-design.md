# FMS 대시보드 디자인 개선 요구사항 정의서 (TailAdmin 벤치마킹)

## 1. 문서 개요

| 항목 | 내용 |
|------|------|
| 목적 | **TailAdmin Free Next.js Admin Dashboard** 템플릿을 분석하고, FMS 대시보드·차량 목록·차량 상세 화면의 디자인 개선에 적용할 요구사항 정의 |
| 참조 템플릿 | [GitHub — TailAdmin/free-nextjs-admin-dashboard](https://github.com/TailAdmin/free-nextjs-admin-dashboard) (MIT), [라이브 데모](https://nextjs-free-demo.tailadmin.com/) |
| 관련 문서 | [requirements-front-design.md](./requirements-front-design.md) (Pleos 벤치마킹·테슬라 감성 전략), [development-checklist.md](./development-checklist.md), [requirements-tesla-api.md](./requirements-tesla-api.md) |
| 적용 범위 | **Phase 3.7**: 대시보드·차량 목록·상세 + 공통 레이아웃 (토큰/패턴 차용) · **Phase 3.8**: TailAdmin 템플릿 **전면 적용** (데모 UI, FMS 연동은 다음 단계) |
| 전제 | **Phase 3.7**: [requirements-front-design.md](./requirements-front-design.md) 전략(지도 Hero·테슬라 EV 감성) 유지 — 토큰/패턴만 차용. **Phase 3.8**: 템플릿 구조·컴포넌트 **변경 없이** 데모 그대로 적용, FMS는 `/fleet/*` 격리 |

> **Phase 3.7 한 줄 요약**: 코드 통째 이식이 아니라 **디자인 시스템(토큰·카드·배지·다크모드)을 차용**한다.
>
> **Phase 3.8 한 줄 요약 (2026-07-08)**: TailAdmin + FMS 연동(`src/components/fms/`). Hero KPI·지도 1:1. 배터리 프로그래스바. 최근 차량·충전 현황·목록 테이블 컬럼 통일. E-commerce는 `/demo`.

---

## 2. TailAdmin 템플릿 분석

### 2.1 기술 스택 — FMS와의 호환성

| 항목 | TailAdmin | 현재 FMS | 호환성 |
|------|-----------|----------|:---:|
| 프레임워크 | Next.js 16 (App Router) + React 19 | Next.js 16 + React 19 | ✅ 동일 |
| 스타일 | Tailwind CSS **v4** (`@theme` 토큰) | Tailwind v4 (`@theme inline`) | ✅ 동일 |
| 언어 | TypeScript | TypeScript | ✅ 동일 |
| UI 컴포넌트 | 자체 구현 (Badge·Button·Table·Modal·Dropdown 등 50+) | shadcn/ui + 자체 fleet 컴포넌트 | △ 패턴만 차용 |
| 차트 | ApexCharts (react-apexcharts) | 없음 (차트 P2) | △ 도입 시 선택 |
| 폰트 | **Outfit** (라틴 전용) | Geist Sans | △ 한글 폰트 별도 필요 |
| 다크모드 | class 기반 `.dark` + ThemeContext (localStorage) | 라이트 고정 + 다크 사이드바만 | ✅ 도입 용이 |
| 라이선스 | **MIT** | — | ✅ 자유 사용 |

**결론**: 스택이 완전히 동일하므로 토큰(CSS 변수)·클래스 패턴·컴포넌트 구조를 거의 그대로 옮길 수 있다. 단, shadcn/ui 기반을 버리고 TailAdmin 컴포넌트로 전면 교체하는 것은 **비용 대비 이득이 없으므로 하지 않는다** (§4 적용 전략).

### 2.2 디자인 시스템 분석 (`globals.css` `@theme`)

#### 색상 팔레트 (Untitled UI 계열)
| 토큰 | 값 | 용도 |
|------|-----|------|
| `brand-500` | `#465fff` (블루) | 주 액센트 — **FMS는 테슬라 레드로 치환** |
| `success-500` | `#12b76a` | 정상·상승 지표 |
| `warning-500` | `#f79009` | 주의 |
| `error-500` | `#f04438` | 이상·하락 지표 |
| `blue-light-500` | `#0ba5ec` | 정보 (FMS: 충전중) |
| `gray-25`~`gray-950` | `#fcfcfd`~`#0c111d` | 12단계 뉴트럴 — 배경·보더·텍스트 위계 |

- 각 색상이 **25~950 12단계**로 정의되어 light-variant 배지(`bg-*-50 text-*-600`), 다크모드(`dark:bg-*-500/15`)까지 일관 대응.
- 현재 FMS는 oklch 시맨틱 토큰(shadcn 방식)만 있어 **단계별 상태 색 스케일이 없다** → 상태 색 스케일 도입이 핵심 차용 포인트.

#### 타이포·그림자·기타
| 항목 | TailAdmin | 적용 가치 |
|------|-----------|:---:|
| 타이틀 스케일 | `text-title-sm(30px)`~`2xl(72px)` — KPI Hero 숫자용 | ★★★ |
| 본문 스케일 | `text-theme-xs(12)/sm(14)/xl(20)` | ★★ |
| 그림자 | `shadow-theme-xs~xl` — 매우 옅은 계층 그림자 (`rgba(16,24,40,0.03~0.1)`) | ★★★ |
| 포커스 링 | `shadow-focus-ring` (brand 12% 4px) | ★★ |
| 카드 radius | `rounded-2xl` (16px) 통일 | ★★★ |
| 커스텀 스크롤바 | `custom-scrollbar` 유틸리티 | ★ |

### 2.3 레이아웃·컴포넌트 패턴

| 패턴 | 구현 내용 | FMS 적용 가치 |
|------|-----------|:---:|
| **접이식 사이드바** | expanded(290px)/collapsed(90px, 아이콘만)/hover 확장/모바일 오버레이 — `SidebarContext` | ★★ (P1) |
| **헤더** | sticky, 사이드바 토글, 검색 인풋(`⌘K`), 다크모드 토글, 알림·프로필 드롭다운 | ★★ (부분) |
| **메트릭 카드** | 아이콘(원형 배경) + 라벨 + **큰 숫자** + 증감 배지(↑11.01%) — `rounded-2xl border p-5` | ★★★ (KPI) |
| **Badge** | `light`(연한 배경+진한 글자)/`solid` × 7색 × 2크기, 아이콘 슬롯 | ★★★ (상태 배지) |
| **테이블** | 헤더 `gray-500 text-theme-xs`, 셀 `py-3`, 아바타/썸네일 + 2줄 텍스트(주+보조), 상태 Badge | ★★★ (차량 목록) |
| **Pagination** | 이전/다음 + 번호, 현재 페이지 brand 강조 | ★★ (이미 유사 구현) |
| **Radial 게이지** | ApexCharts radialBar (Monthly Target 75.55%) | ★★ (배터리 게이지) |
| **기간 탭 차트** | Monthly/Quarterly/Annually `ChartTab` + 라인 차트 | ★ (P2 주행거리) |
| **다크모드** | 모든 컴포넌트 `dark:` 변형 완비, `ThemeContext` + localStorage | ★★★ |
| 모달·드롭다운·알림 | `useModal` 훅, ClickOutside 처리 | ★ (필요 시) |

### 2.4 데모 화면 구조 (E-commerce 대시보드)

```
[사이드바]  [헤더: 토글·검색·다크모드·알림·프로필]
           [메트릭 카드 2개 (Customers·Orders + 증감배지)]  [Monthly Target (radial)]
           [Monthly Sales (막대 차트)                    ]
           [Statistics (기간 탭 + 라인 차트)]
           [Demographic (지도+국가 비율)]  [Recent Orders (썸네일 테이블 + 상태 배지)]
```

- 카드 그리드 기반, 흰 카드 + `gray-50` 배경 + 옅은 보더·그림자로 **깔끔한 위계**.
- 정보 밀도는 낮고 여백이 넉넉 — FMS의 "선택과 집중" 방향과 일치.
- 차트·표·배지의 **마감 품질**(색·간격·폰트 위계)이 좋음 — 이것이 차용 대상.

---

## 3. 현재 FMS와의 Gap

| 영역 | 현재 FMS (Phase 2.2) | TailAdmin | Gap → 개선 방향 |
|------|----------------------|-----------|------------------|
| 색상 토큰 | shadcn 시맨틱 (primary·muted 등)만 | 상태별 12단계 스케일 | 상태 색 스케일 추가 (`success/warning/error/info` 계열) |
| KPI 카드 | 숫자+라벨 (단순) | 아이콘+숫자+증감 배지, `rounded-2xl` | 아이콘·증감(전 갱신 대비)·타이틀 스케일 적용 |
| 상태 배지 | shadcn Badge 4 variant | light/solid × 7색 | light-variant 패턴 도입 (연한 배경+진한 글자) |
| 테이블 | 기본 shadcn Table | 아바타+2줄 텍스트, 옅은 헤더, 행 간격 | 차량 셀 2줄 구성(식별명+모델), 헤더 톤 정리 |
| 카드 스타일 | `rounded-xl` + 기본 그림자 | `rounded-2xl` + `shadow-theme-*` 계층 | radius·그림자 토큰 통일 |
| 다크모드 | 없음 (사이드바만 딥 톤) | 전면 지원 + 토글 | **다크모드 도입** — EV 감성·지도 대비에 유리 (front-design §5.2에서 P1로 명시됨) |
| 사이드바 | 고정폭 딥 톤 | 접이식 + hover 확장 | 접이식 동작 추가 (P1) |
| 헤더 | PageHeader (제목·갱신·새로고침) | sticky 글로벌 헤더 + 토글·검색 | 다크모드 토글 추가, 검색은 P2 |
| 게이지 | CSS 막대 게이지 | radial 차트 | 배터리 게이지 radial 검토 (P1~P2) |
| 폰트 | Geist Sans | Outfit + 타이틀 스케일 | 숫자 타이틀 스케일만 차용, 한글은 현행 유지 (§8 주의) |

---

## 4. 적용 전략

### 4.1 원칙 — "토큰과 패턴만 가져온다"

1. **전면 이식 금지**: TailAdmin 페이지·컴포넌트를 통째로 복사하지 않는다. shadcn/ui 기반과 기존 fleet 컴포넌트(17종)를 유지하고, **클래스·토큰 수준에서 개선**한다.
2. **전략 문서 우선**: [requirements-front-design.md](./requirements-front-design.md)의 지도 Hero·테슬라 레드 포인트·"정장 vs 스포츠웨어" 포지셔닝이 상위 원칙이다. TailAdmin의 **블루 brand 색은 채택하지 않고** 테슬라 레드를 유지한다.
3. **차용 우선순위**: ① 상태 색 스케일·그림자·radius 토큰 → ② KPI 카드·배지·테이블 패턴 → ③ 다크모드 → ④ 접이식 사이드바·radial 게이지 → ⑤ 차트 (P2).
4. **의존성 최소화**: ApexCharts는 radial 게이지·차트를 실제 구현하는 시점에만 도입 검토. CSS로 충분하면 추가하지 않는다.

### 4.2 채택 / 비채택 요약

| 채택 (차용) | 비채택 (유지 또는 제외) |
|-------------|------------------------|
| 상태 색 12단계 스케일 (success·warning·error·info·gray) | brand 블루 → **테슬라 레드 유지** |
| `rounded-2xl` + `shadow-theme-*` 카드 마감 | Outfit 폰트 (한글 미지원 — 현행 Geist + 시스템 한글 유지) |
| 메트릭 카드 패턴 (아이콘·타이틀 스케일·증감 배지) | E-commerce 위젯 내용 (매출·고객 등) |
| Badge light-variant 패턴 | TailAdmin 컴포넌트 라이브러리 자체 (shadcn 유지) |
| 테이블 스타일 (2줄 셀·옅은 헤더·행 리듬) | 캘린더·프로필·인증 페이지 |
| **다크모드 시스템** (class 기반 + 토글 + localStorage) | jsvectormap (Kakao Maps 유지) |
| 접이식 사이드바 동작 (P1) | 검색 `⌘K` (P2로 보류) |
| Pagination·radial 게이지 스타일 참고 | ApexCharts 전면 도입 (필요 시점에만) |

---

## 5. 화면별 적용 요구사항

### 5.1 공통 — 디자인 토큰·레이아웃

| ID | 요구사항 | TailAdmin 참조 | 우선순위 |
|----|----------|----------------|:---:|
| TA-COM-01 | `globals.css`에 **상태 색 스케일** 추가: `success/warning/error/info` 각 50·100·500·600 단계 (light 배지·다크모드 대응) | `@theme` 팔레트 | **P0** |
| TA-COM-02 | 카드 공통 마감 통일: `rounded-2xl` + 옅은 계층 그림자(`shadow-theme-sm` 상당) + `border-gray-200` | 카드 패턴 | **P0** |
| TA-COM-03 | KPI 숫자용 **타이틀 타입 스케일** 추가 (`30/36/48px` 상당) | `text-title-*` | P0 |
| TA-COM-04 | **다크모드**: class 기반 `.dark` + 헤더 토글 + localStorage 유지. 사이드바·카드·표·지도 폴백 전체 다크 변형 | `ThemeContext`, `dark:` 변형 | **P1** |
| TA-COM-05 | 사이드바 **접이식**: 축소(아이콘만)↔확장, hover 시 임시 확장 | `SidebarContext` | P1 |
| TA-COM-06 | 헤더 sticky화 + 다크모드 토글 배치 (알림·프로필 드롭다운은 placeholder) | `AppHeader` | P1 |
| TA-COM-07 | `custom-scrollbar` 유틸리티 (위젯 내부 스크롤 영역) | 스크롤바 유틸 | P2 |
| TA-COM-08 | 글로벌 검색 인풋 (`⌘K`) | 헤더 검색 | P2 |

### 5.2 대시보드 (`/`)

> 지도 Hero 레이아웃(front-design §6.2)은 유지. **카드·위젯의 마감 품질**을 TailAdmin 수준으로 개선한다.

| ID | 요구사항 | TailAdmin 참조 | 우선순위 |
|----|----------|----------------|:---:|
| TA-DSH-01 | KPI 카드 → **메트릭 카드 패턴**: 좌상단 아이콘(원형 `gray-100` 배경), 라벨(`gray-500 text-sm`), 큰 숫자(타이틀 스케일 `font-bold`) | `EcommerceMetrics` | **P0** |
| TA-DSH-02 | KPI **증감 배지**: 직전 동기화 대비 증감(예: 이상 +1↑)을 light-variant 배지로 표시 — 데이터 없으면 생략 가능 | 증감 배지 (↑11.01%) | P1 |
| TA-DSH-03 | 이상/미운행/충전 위젯 카드: 헤더(제목+더보기)·바디 구분, 리스트 행 간격·구분선 리듬 정리 | `RecentOrders` 카드 구조 | **P0** |
| TA-DSH-04 | 위젯 내 차량 행: **2줄 셀** (식별명 굵게 + 모델·상태 보조 텍스트) + 상태 light 배지 | 테이블 셀 패턴 | P0 |
| TA-DSH-05 | 지도 Hero 카드도 공통 마감(TA-COM-02) 적용, 다크모드 시 지도 폴백 다크 톤 유지 | — | P0 |
| TA-DSH-06 | (P2) 주행거리·통계 차트 위젯 도입 시 기간 탭(`ChartTab`) + ApexCharts 패턴 참고 | `StatisticsChart` | P2 |
| TA-DSH-07 | **충전 현황** 위젯: 차량 모델·연식 `nowrap`·`truncate`, 배터리 `120px`·충전 `76px` (좁은 카드에서 모델명 줄바꿈 방지) | `FleetChargingPanel` | **P1** |

### 5.3 차량 목록 (`/vehicles`)

| ID | 요구사항 | TailAdmin 참조 | 우선순위 |
|----|----------|----------------|:---:|
| TA-VLS-01 | 테이블 헤더: `gray-500` 소형 텍스트(12~13px)·`font-medium`·배경 없음(또는 `gray-50`) — 현행보다 옅고 정돈된 톤 | `BasicTableOne` | **P0** |
| TA-VLS-02 | 차량 컬럼 **2줄 셀**: 1줄 식별명(굵게) + 2줄 모델·연식(`gray-500 text-xs`). 좌측에 상태 색 도트 또는 차량 아이콘 원형 배지 | 아바타+2줄 텍스트 | **P0** |
| TA-VLS-03 | 상태·충전 배지를 **light-variant**로 교체: `bg-success-50 text-success-600` 형태 (다크: `bg-success-500/15`) | `Badge` light | **P0** |
| TA-VLS-04 | 행 hover `gray-50`(다크 `white/5`)·행 패딩 `py-3` 리듬 통일 | 테이블 행 | P0 |
| TA-VLS-05 | 페이지네이션을 TailAdmin 스타일(이전/다음 + 번호, 현재 페이지 액센트)로 정리 | `Pagination` | P1 |
| TA-VLS-06 | 필터 바: 검색 인풋·드롭다운을 카드 안에 배치, 포커스 링(`shadow-focus-ring` 상당 — 레드 계열) 적용 | 폼 요소 | P1 |
| TA-VLS-07 | 테이블 카드 래핑: `rounded-2xl` 카드 + 내부 overflow 스크롤 | 테이블 컨테이너 | P0 |
| TA-VLS-08 | **위치 컬럼 제거**(지도는 `/map`·상세에서 확인), 6컬럼 폭 균형(차량 `200px`·배터리 `140px` 등) + `BatteryProgressBar expanded` | Demographic 프로그래스바 | **P1** |

### 5.4 차량 상세 (`/vehicles/[id]`)

| ID | 요구사항 | TailAdmin 참조 | 우선순위 |
|----|----------|----------------|:---:|
| TA-VDT-01 | 요약 헤더 카드: 좌측 차량 아이콘(원형)+식별명·모델, 우측 상태 light 배지 열 — 프로필 메타 카드 구조 참고 | `UserMetaCard` | **P0** |
| TA-VDT-02 | 상태 그리드 카드들(배터리·주행·잠금·공조 등): 라벨(`gray-500 text-xs`) + 값(`font-semibold`) 위계, 카드 마감 통일 | `UserInfoCard` 필드 위계 | **P0** |
| TA-VDT-03 | 경고 태그(`IssueTag`)를 light-variant 배지 체계로 통일 (warning·error 계열) | `Badge` | P0 |
| TA-VDT-04 | **배터리 건강 게이지**: radial(반원) 게이지 스타일 검토 — CSS conic-gradient 또는 ApexCharts radialBar | `MonthlyTarget` | P1 |
| TA-VDT-05 | 탭(홈/이벤트): 밑줄형 → TailAdmin식 pill 탭(선택: `bg-brand`→레드 계열) 또는 현행 유지 중 택1 | `ChartTab` | P1 |
| TA-VDT-06 | 이벤트 타임라인: 아이콘 원형 배지 + 시간(`gray-400 text-xs`) 리듬 정리 | 알림 드롭다운 리스트 | P1 |
| TA-VDT-07 | TPMS 도식·지도 카드도 공통 카드 마감 적용 | — | P0 |

---

## 6. 디자인 토큰 정의 (FMS 버전)

TailAdmin 팔레트를 FMS 상태 체계에 맞게 치환한다. **브랜드 액센트만 테슬라 레드로 교체**하고 나머지는 그대로 차용.

```css
/* globals.css @theme 추가 (제안) */
--color-success-50: #ecfdf3;  --color-success-500: #12b76a;  --color-success-600: #039855;
--color-warning-50: #fffaeb;  --color-warning-500: #f79009;  --color-warning-600: #dc6803;
--color-error-50:   #fef3f2;  --color-error-500:   #f04438;  --color-error-600:   #d92d20;
--color-info-50:    #f0f9ff;  --color-info-500:    #0ba5ec;  --color-info-600:    #0086c9;
/* gray 스케일: TailAdmin gray-25~950 채택 (뉴트럴 통일) */
/* brand: 테슬라 레드 유지 (현행 --primary oklch 레드 계열) — TailAdmin 블루 미채택 */
```

| FMS 상태 | 배지 (light) | 마커·KPI | 비고 |
|----------|--------------|-----------|------|
| 정상/온라인 | `bg-success-50 text-success-600` | `success-500` | |
| 충전중 | `bg-info-50 text-info-600` | `info-500` | |
| 주의 (WARNING) | `bg-warning-50 text-warning-600` | `warning-500` | |
| 이상 (ALERT) | `bg-error-50 text-error-600` | `error-500` | |
| 오프라인/미운행 | `bg-gray-100 text-gray-700` | `gray-400` | |
| 브랜드 포인트 | 테슬라 레드 (현행 primary) | CTA·활성 메뉴·포커스 링 | TailAdmin 블루 대체 |

다크모드 배지: `dark:bg-{color}-500/15 dark:text-{color}-400~500` 패턴 (TailAdmin Badge 동일).

---

## 7. 우선순위·적용 단계 (Phase 3.7)

### P0 — 마감 품질 (1차 스프린트)
- 상태 색 스케일·그림자·radius 토큰 추가 (TA-COM-01~03)
- KPI 메트릭 카드 패턴 (TA-DSH-01)
- Badge light-variant 전환 (TA-VLS-03, TA-VDT-03)
- 테이블 2줄 셀·헤더 톤·행 리듬 (TA-VLS-01~04, 07)
- 위젯·상세 카드 마감 통일 (TA-DSH-03~05, TA-VDT-01~02, 07)

### P1 — 경험 강화 (2차)
- **다크모드** 전면 도입 + 헤더 토글 (TA-COM-04, 06)
- 접이식 사이드바 (TA-COM-05)
- KPI 증감 배지 (TA-DSH-02), radial 배터리 게이지 (TA-VDT-04)
- 페이지네이션·필터 정리 (TA-VLS-05~06), 탭·타임라인 (TA-VDT-05~06)

### P2 — 확장
- 기간 탭 차트(주행거리 통계), 글로벌 검색, 알림 드롭다운, 커스텀 스크롤바

> 체크리스트는 [development-checklist.md — Phase 3.7](./development-checklist.md)에 반영되어 있다. 실 데이터 연동(Phase 3.x)과 독립적인 프론트 작업이므로 병행 가능.

---

## 8. 제약·주의사항

| 항목 | 내용 |
|------|------|
| 폰트 | Outfit은 한글 미지원. 숫자·라틴에만 적용하거나 미채택 — 타이틀 **크기 스케일만** 차용하고 폰트는 현행(Geist) 유지 권장 |
| 색상 충돌 | TailAdmin brand 블루(`#465fff`)를 그대로 쓰면 기존 테슬라 레드 포인트와 충돌 — **액센트는 반드시 레드 유지** (front-design §5.2) |
| ApexCharts | 번들 크기 증가. radial 게이지는 CSS(conic-gradient)로 우선 시도, 차트가 실제 필요한 P2에 도입 결정 |
| 다크모드 범위 | Kakao Maps는 다크 테마 미지원(간이 폴백만 다크 가능) — 지도 영역은 라이트 유지 + 카드 프레임만 다크 처리 허용 |
| shadcn 충돌 | shadcn 시맨틱 토큰(primary·muted 등)과 신규 스케일 토큰 공존 — 기존 컴포넌트 회귀 없도록 **추가** 방식으로 도입 (교체 아님) |
| 라이선스 | MIT — 코드·스타일 차용 자유. 이미지 에셋(사용자 사진 등)은 미사용 |
| Tesla 실데이터 | 위치 `0,0`·희소 telemetry 등 기존 UI 보정 로직(Phase 3.5)과 충돌 없도록 배지·표 개선 시 `위치 데이터 없음` 등 폴백 문구 유지 |

---

## 9. 완료 기준

1. 대시보드·목록·상세 3화면의 카드·배지·표가 **일관된 토큰**(색 스케일·radius·그림자)으로 렌더링됨
2. KPI가 아이콘+큰 숫자+（증감）의 메트릭 카드로 표시되고, 상태 배지가 light-variant로 통일됨
3. (P1) 다크모드 토글 시 3화면 + 사이드바·헤더가 깨짐 없이 전환되고 localStorage로 유지됨
4. 지도 Hero·테슬라 레드 포인트 등 기존 front-design 전략 요소가 **회귀 없이** 유지됨
5. `pnpm lint`, `pnpm build` 통과 / Phase 2.2·3.x 기능 회귀 없음
6. 첫인상 테스트: "관리자 템플릿처럼 정돈됐다 + 여전히 테슬라답다"

---

## 10. 참고 자료

| 자료 | 설명 |
|------|------|
| [TailAdmin GitHub](https://github.com/TailAdmin/free-nextjs-admin-dashboard) | 소스 (Next.js 16·React 19·Tailwind v4, MIT) |
| [TailAdmin 라이브 데모](https://nextjs-free-demo.tailadmin.com/) | E-commerce 대시보드 데모 |
| [TailAdmin Figma (Community)](https://www.figma.com/community/file/1463141366275764364) | 디자인 파일 |
| `src/app/globals.css` (TailAdmin) | `@theme` 토큰 정의 — 색·타이포·그림자 원본 |
| `src/components/ecommerce/EcommerceMetrics.tsx` | 메트릭 카드 패턴 |
| `src/components/ui/badge/Badge.tsx` | light/solid 배지 패턴 |
| `src/components/tables/BasicTableOne.tsx` | 테이블 셀·헤더 패턴 |
| [requirements-front-design.md](./requirements-front-design.md) | 상위 디자인 전략 (지도 Hero·테슬라 감성) |

---

## 11. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-07 | 초안 — TailAdmin Free Next.js 템플릿 분석, 토큰·패턴 차용 전략, 화면별 요구사항(TA-COM/DSH/VLS/VDT) 정의 |
| 2026-07-07 | 체크리스트 연계 — development-checklist.md Phase 3.7 반영 (Phase 2.3 제안 → 3.7 확정) |
| 2026-07-07 | Phase 3.7 구현 완료 — globals 토큰, fleet-card, light 배지, 다크모드, KPI 메트릭 카드, 테이블·상세 UI |
| 2026-07-08 | Phase 3.8 P1 — 충전 현황 차량 모델 nowrap, 배터리 `120px` (TA-DSH-07) |
