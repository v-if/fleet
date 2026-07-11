# Tesla Fleet API 표시 데이터 조사 · FMS 프론트 고도화 선행 분석

## 1. 문서 개요

| 항목 | 내용 |
|------|------|
| 목적 | FMS 프론트 화면 고도화 **작업 전** — Fleet API로 받을 수 있는 데이터 중 **관제 사용자에게 표시할 가치가 있는 항목**을 조사하고, **정적/동적**으로 분류한다 |
| 배경 | Telemetry primary 운영 중. 등록 시 1회 조회·상시 갱신(Telemetry/이벤트 REST) 전략을 명확히 해야 DB·UI 설계가 흔들리지 않음 |
| 관련 문서 | [requirements-tesla-api.md](./requirements-tesla-api.md), [requirements-tesla-fleet-api-model-mapping.md](./requirements-tesla-fleet-api-model-mapping.md), [requirements-tesla-fleet-telemetry.md](./requirements-tesla-fleet-telemetry.md), [requirements-front-design.md](./requirements-front-design.md) |
| 적용 범위 | 대시보드 · 차량 목록 · 차량 상세 · 설정(연동 상태) UI 고도화 |
| 작성일 | 2026-07-11 |

### 1.1 조사 원칙

1. **Endpoint 공식 문서 기준**으로 항목을 뽑는다 (추측·비공식 필드 제외).
2. **FMS 관제 사용자** 관점 — 개인 편의(미디어·시트 히터 등)보다 위치·상태·충전·보안·이상에 우선순위.
3. **변하지 않는 데이터**와 **수시로 변하는 데이터**를 나눈다.
   - 정적: 최초 차량 등록 시 **1회 조회 → DB 저장 → 이후 갱신하지 않음** (또는 수동 재동기화만).
   - 동적: 저장 후에도 **Telemetry 신호** 또는 **특정 이벤트 시 REST 재조회**로 갱신.
4. 본 문서는 **조사·분류·화면 후보**까지. 스키마·동기화 구현은 [requirements-tesla-hybrid-data-model.md](./requirements-tesla-hybrid-data-model.md) · [checklist-tesla-hybrid-data.md](./checklist-tesla-hybrid-data.md).

---

## 2. 조사 대상 Endpoint (공식 문서)

| 문서 | URL | FMS 조사 우선 |
|------|-----|:-------------:|
| Vehicle Endpoints | https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-endpoints | **P0** |
| Vehicle Commands | https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-commands | P1 (표시보다 제어·결과 피드백) |
| Vehicle Management | https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-management | P1 |
| User Endpoints | https://developer.tesla.com/docs/fleet-api/endpoints/user-endpoints | P2 |
| Partner Endpoints | https://developer.tesla.com/docs/fleet-api/endpoints/partner-endpoints | P2 (운영·Register, 화면 직접 표시 적음) |
| Energy Endpoints | https://developer.tesla.com/docs/fleet-api/endpoints/energy | **범위 외** (Powerwall 등 — 차량 FMS MVP 제외) |

> Fleet Telemetry Available Data는 REST와 별도 스트림이다. 동적 필드 갱신 소스로 병행 검토한다.  
> https://developer.tesla.com/docs/fleet-api/fleet-telemetry/available-data

---

## 3. 정적 vs 동적 — 분류 기준

| 구분 | 정의 | 수집 시점 | 저장 위치(안) | 갱신 트리거 |
|------|------|-----------|---------------|-------------|
| **정적 (Static)** | 차량 제원·구성. 일상 운행으로 거의 안 바뀜 | OAuth/registry sync · 최초 `vehicle_data` 1회 | `Vehicle` 테이블 컬럼 | 수동 “제원 재동기화” 또는 펌웨어/옵션 변경 감지 시만 |
| **준정적 (Semi-static)** | 드물게 바뀜 (이름, 공유 드라이버, Telemetry config) | 등록 시 + 설정 변경 시 | `Vehicle` / 구독·공유 테이블 | 사용자 액션·unlink·config 변경 |
| **동적 (Dynamic)** | 실시간 관제에 필요 | Telemetry 우선 · REST fallback | `VehicleSnapshot` (+ 이벤트) | Telemetry webhook, wake 후 REST, 알림/충전 이벤트 |

### 3.1 예시 (사용자 초안 반영)

**변하지 않는 데이터 (정적)**

| 필드 예 | 출처 | 비고 |
|---------|------|------|
| `car_type` (예: `modely`) | `vehicle_data.vehicle_config` | 화면용 모델명 매핑 → [model-mapping](./requirements-tesla-fleet-api-model-mapping.md) |
| `trim_badging` (예: `50`) | 동일 | RWD / Long Range 등 트림 표시 |
| `exterior_color` (예: `StealthGrey`) | 동일 | 상세·목록 뱃지 |
| `vin` | `vehicles` / `vehicle_data` | 식별 키 (`oemVehicleId`) |
| 휠·루프 등 config | `vehicle_config` | 조사 후 표시 여부 결정 |

**변하는 데이터 (동적)**

| 필드 예 | 출처 | 비고 |
|---------|------|------|
| `state` (online/asleep/…) | `vehicles`, Telemetry connectivity | ASLEEP 추론과 병행 |
| 배터리 SoC·주행가능거리 | `charge_state` / Telemetry `Soc` | |
| 위치 | `drive_state` / Telemetry `Location` | |
| 충전 상태 | `charge_state` / `ChargeState` | |
| 타이어 공기압(TPMS) | `vehicle_state` | REST 위주(Telemetry mapper 미지원 시) |
| 잠금·문·창문 | `vehicle_state` / Telemetry | |
| 실내외 온도·공조 | `climate_state` / Telemetry | |

---

## 4. Endpoint별 표시 후보 (조사 체크리스트)

아래는 **문서 기준으로 뽑을 항목의 틀**이다. 구현 전 각 엔드포인트 응답 샘플을 실차/Mock으로 채워 `우선순위`·`정적/동적`을 확정한다.

### 4.1 Vehicle Endpoints — P0

| Endpoint | 주요 응답/용도 | 정적/동적 | FMS 화면 후보 | 조사 상태 |
|----------|----------------|-----------|---------------|:---------:|
| `GET /api/1/vehicles` | 목록, `vin`, `display_name`, `state` | 준정적+동적 | 목록·KPI·식별명 | ☐ |
| `GET /api/1/vehicles/{vin}` | 단일 차량 요약 | 동적 | 상세 헤더 | ☐ |
| `GET .../vehicle_data` | charge/climate/drive/vehicle_state/**vehicle_config**/gui | **혼합** | 상세 전 탭·등록 시 제원 | ☐ |
| `POST .../fleet_status` | firmware, telemetry version, keys, command protocol | 준정적 | 설정·상세 “연동 준비도” | ☐ |
| `GET .../mobile_enabled` | 모바일 접근 | 준정적 | 설정 경고 | ☐ |
| `GET .../recent_alerts` | 최근 경고 | 동적 | 대시보드 알림·상세 타임라인 | ☐ |
| `GET .../service_data` | 정비/서비스 상태 | 준정적~동적 | 상세 정비 탭 | ☐ |
| `GET .../release_notes` | 펌웨어 노트 | 준정적 | 상세 소프트웨어 | ☐ |
| `GET .../nearby_charging_sites` | 인근 충전소 | 동적 | 상세 지도 보조 | ☐ |
| `GET .../fleet_telemetry_config` | Telemetry 구독·synced | 준정적 | 설정 Telemetry 패널 | ☐ |
| `GET .../fleet_telemetry_errors` | Telemetry 오류 | 동적 | 설정·운영 진단 | ☐ |
| `GET .../drivers` | 공유 운전자 | 준정적 | 상세·권한 (P2) | ☐ |
| `GET .../invitations` | 공유 초대 | 준정적 | 상세 (P2) | ☐ |

### 4.2 `vehicle_data` 그룹 상세 (핵심)

| 그룹 | 대표 필드 | 분류 | 화면 |
|------|-----------|------|------|
| `vehicle_config` | `car_type`, `trim_badging`, `exterior_color`, `wheel_type`, `roof_color` 등 | **정적** | 목록 모델명·상세 제원 카드 |
| `charge_state` | `battery_level`, `battery_range`, `charging_state`, `charge_limit_soc`, `charger_power` 등 | **동적** | KPI·상세 충전 |
| `drive_state` | `latitude`, `longitude`, `heading`, `shift_state`, `speed` | **동적** | 지도·주행 상태 |
| `vehicle_state` | `locked`, doors/windows, `odometer`, `car_version`, `sentry_mode`, TPMS | **동적**(odometer·버전은 완만) | 상세 보안·타이어·SW |
| `climate_state` | 실내외 온도, `is_climate_on`, 목표 온도 | **동적** | 상세 공조 |
| `gui_settings` | 거리/온도 단위 | 준정적 | 표시 단위 환산 |
| `closures_state` | 문/트렁크 상세 | **동적** | 상세 개폐 |

### 4.3 Vehicle Commands — 화면 관점

명령 자체는 “표시 데이터”가 아니라 **버튼·결과 피드백**이다. 고도화 시 조사할 것:

- 실행 전/후 어떤 동적 필드를 다시 읽을지 (`wake_up` → `vehicle_data`)
- 실패 시 사용자에게 보여줄 오류 코드

(상세 명령 목록은 [requirements-tesla-api.md](./requirements-tesla-api.md) §4)

### 4.4 Partner / User / Energy

| 영역 | FMS 표시 | 비고 |
|------|----------|------|
| Partner | 공개키·Register 상태는 운영자용 | 일반 대시보드 비표시 |
| User | 프로필·연락처 | MVP 제외 (`user_data` 스코프) |
| Energy | 제외 | 차량 FMS 범위 외 |

---

## 5. FMS 사용자 관점 — 화면별 “있으면 좋은” 항목

기존 매핑([requirements-tesla-api.md](./requirements-tesla-api.md) §5.2)을 고도화 관점으로 확장한다.

### 5.1 대시보드

| 후보 | 소스 분류 | 가치 | 우선 |
|------|-----------|------|:----:|
| 온라인/취침/이상 KPI | 동적 | 플릿 가동 한눈 | P0 (기구현) |
| 지도 마커·배터리 색 | 동적 | 위치 관제 | P0 (기구현) |
| 충전중 대수 | 동적 | 운영 | P0~P1 |
| 최근 경고 패널 | 동적 | 이상 대응 | P1 |
| 모델/트림 요약 (정적 제원) | 정적 | 차종 구성 파악 | **고도화 P1** |
| Telemetry 수신 지연 차량 | 동적+메타 | 연동 건강도 | P1 |

### 5.2 차량 목록

| 후보 | 소스 분류 | 가치 | 우선 |
|------|-----------|------|:----:|
| 식별명·상태·배터리·충전 | 동적 | 목록 핵심 | P0 (기구현) |
| **표시 모델명** (`car_type`+`trim` 매핑) | 정적 | “Model Y Long Range” 등 | **고도화 P0** |
| 외장 색 | 정적 | 식별 | P1 |
| 최종 Telemetry/REST 시각 | 동적 | 신선도 | P1 |

### 5.3 차량 상세

| 후보 | 소스 분류 | 가치 | 우선 |
|------|-----------|------|:----:|
| 제원 카드 (모델·트림·색·VIN) | 정적 | 차량 프로필 | **고도화 P0** |
| 배터리·거리·충전·위치·잠금 | 동적 | 관제 | P0 (기구현) |
| TPMS·공조·센트리·odometer·SW | 동적 | 상세 운영 | P1~P2 (일부 기구현) |
| 정비/릴리스 노트 | 준정적 | 유지보수 | P2 |
| Telemetry synced / errors | 준정적·동적 | 연동 진단 | P1 |

---

## 6. 수집·저장 전략 (고도화 전제)

```
[최초 등록 / OAuth callback / registry sync]
  → vehicles + (가능 시) vehicle_data 1회
  → Vehicle: 정적 제원 저장 (car_type, trim_badging, exterior_color, …)
  → VehicleSnapshot: 동적 스냅샷 1회 (또는 Telemetry 대기)

[상시]
  → Telemetry webhook → VehicleSnapshot 갱신 (동적)
  → REST fallback / wake 후 vehicle_data → 동적만 갱신 (정적 컬럼 덮어쓰지 않음)

[이벤트]
  → recent_alerts, telemetry_errors, 충전 시작 등 → 필요 시 REST 보강
```

| 규칙 | 내용 |
|------|------|
| 정적 필드 | `Vehicle`에 보관. Telemetry/주기 sync가 **덮어쓰지 않음** |
| 동적 필드 | `VehicleSnapshot` append 또는 latest 정책 유지 |
| asleep | Telemetry 공백 → ASLEEP 추론. 강제 wake는 사용자/fallback만 |
| 비용 | 동적 고빈도 = Telemetry. REST `vehicle_data`는 등록·fallback·이벤트에 한정 |

모델명 매핑 규칙은 [requirements-tesla-fleet-api-model-mapping.md](./requirements-tesla-fleet-api-model-mapping.md)를 따른다.

---

## 7. As-Is (현재 FMS) vs 조사 갭

| 영역 | As-Is | 갭 / 조사 필요 |
|------|-------|----------------|
| 모델 표시 | `vehicle_config`로 `model` 문자열 유도 후 Vehicle에 저장 | `car_type`/`trim_badging`/`exterior_color` **전용 컬럼**·표시 고도화 |
| 동적 스냅샷 | Snapshot + Telemetry mapper | TPMS는 Telemetry 미매핑 → REST 보강 여부 |
| 제원 UI | 상세에 모델·일부 필드 | 제원 카드·색상·트림 뱃지 부재 |
| alerts/service | API·스키마 일부 | 화면 고도화·우선순위 재확인 |
| 정적/동적 분리 | 코드상 암묵적 | **명시적 정책·컬럼 분리** 문서화 (본 문서) |

---

## 8. 조사 작업 체크리스트 (구현 전)

- [ ] Vehicle Endpoints 문서 기준으로 `vehicle_data` **전체 필드 목록** 스프레드시트화
- [ ] 실차 1대 `vehicle_data` 샘플 JSON 확보 → 정적/동적 라벨링
- [ ] Telemetry Available Data와 REST 필드 **교차 매핑** (어느 쪽이 source of truth인지)
- [ ] 화면별(대시보드/목록/상세) **표시 확정 목록** + 우선순위 P0/P1/P2
- [ ] Prisma `Vehicle` 정적 컬럼 추가안 확정 ([model-mapping](./requirements-tesla-fleet-api-model-mapping.md) 포함)
- [ ] sync/provider: 등록 시 정적 저장 · 이후 sync는 동적만 갱신하도록 분기 설계
- [ ] UI 와이어: 제원 카드·트림/색 뱃지·신선도 표시
- [ ] Energy/User 범위 외 재확인

---

## 9. 후속 산출물

| 산출물 | 설명 | 상태 |
|--------|------|------|
| 필드 매트릭스 (시트/표) | Endpoint × 필드 × 정적/동적 × 화면 × 우선순위 | 조사 중 |
| 데이터 모델 설계 | [requirements-tesla-hybrid-data-model.md](./requirements-tesla-hybrid-data-model.md) | ✅ 문서 |
| 구현 체크리스트 | [checklist-tesla-hybrid-data.md](./checklist-tesla-hybrid-data.md) | ✅ A 스키마 완료 / B~E 미착수 |
| 스키마 PR | `Vehicle` 제원 + `VehicleSyncState` | 미착수 |
| Sync 로직 PR | Baseline·쿨다운·제원 분리 | 미착수 |
| UI PR | 목록·상세 고도화 | 미착수 |

---

## 10. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-11 | 초안 메모를 정식 조사·분석 문서로 확장 — Endpoint 범위, 정적/동적 분류, 화면 후보, As-Is 갭, 조사 체크리스트 |
| 2026-07-11 | 하이브리드 데이터 모델·Phase 4.4 체크리스트 링크 |
| 2026-07-11 | Phase 4.4.A 스키마 적용 반영 (체크리스트 A 완료) |
