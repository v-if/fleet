# 테슬라 Fleet API 요구사항 정의서

## 1. 문서 개요

| 항목 | 내용 |
|------|------|
| 목적 | 테슬라 Fleet API로 조회·제어 가능한 기능을 정리하고, FMS 화면에 적용할 항목을 도출 |
| 참조 | [What is Fleet API](https://developer.tesla.com/docs/fleet-api/getting-started/what-is-fleet-api), [Vehicle Endpoints](https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-endpoints), [Vehicle Commands](https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-commands), [Authentication](https://developer.tesla.com/docs/fleet-api/authentication/overview), [3rd party apps](https://www.tesla.com/ko_kr/support/access-third-party-apps) |
| 관련 문서 | `requirements.md`, `requirements-tech-stack.md`, `requirements-benchmarking.md` |
| 적용 범위 | 데모데이 MVP ~ 확장 단계 (Phase 3 데이터 연동의 근거 문서) |

> Fleet API는 테슬라 차량·에너지 제품과 상호작용하는 공식 REST API다. 본 문서는 **차량(Vehicle)** 영역에 집중한다. (에너지 제품은 범위 외)

---

## 2. 인증·접근 개요

### 2.1 토큰 타입
| 타입 | 용도 | FMS 적용 |
|------|------|----------|
| Third-party token | 개인 사용자를 대신해 접근 | 개인 소유 차량 데모 시 |
| **Partner token** | 사업자가 자사 차량 플릿을 자동화 | **FMS 본 서비스 지향** |
| Third-party for Business token | 사업자 소유 다수 차량을 대신 관리하는 도구 | 향후 B2B 확장 |

### 2.2 스코프 (권한 범위)
| 스코프 | 설명 | FMS에서 필요성 |
|--------|------|----------------|
| `openid` | Tesla 계정 로그인 | 필수 |
| `offline_access` | 리프레시 토큰 발급 | 필수 (주기 폴링) |
| `vehicle_device_data` | 차량 라이브 데이터·서비스 이력·업그레이드·주변 슈퍼차저·소유 정보 | **필수 (조회 핵심)** |
| `vehicle_location` | 차량 위치(정밀/대략) | **필수 (지도)** |
| `vehicle_cmds` | 잠금/해제, wake, 원격 시동, 트렁크, 공조 등 명령 | 제어 기능(Phase 2+) |
| `vehicle_charging_cmds` | 충전 이력·예약·시작/중지 | 충전 제어(Phase 2+) |
| `vehicle_specs` | 상세 제원 (Partner 토큰 전용, 소유자 동의 불필요) | 차량 등록 보조 |
| `user_data` | 연락처·주소·프로필 | MVP 제외 |

### 2.3 제어를 위한 전제 — Virtual Key
- 대부분의 **명령(command)** 은 애플리케이션의 **Virtual Key**가 차량에 설치되어 있어야 동작한다.
- 서명되지 않은 명령은 차량이 거부한다 (Vehicle Command Protocol).
- 예외: **대부분의 비즈니스 차량 및 2021년 이전 S/X**는 Vehicle Command Proxy 없이도 명령 가능.
- **시사점**: 조회(데이터)는 진입장벽이 낮지만, **제어는 Virtual Key 등록·서명 인프라**가 필요 → MVP는 조회 우선, 제어는 후속.

### 2.4 리전·OAuth audience
OAuth authorize/token 요청 시 `audience`는 **Fleet API base URL**과 일치해야 한다. [Regions and Countries](https://developer.tesla.com/docs/fleet-api/getting-started/regions-countries) 기준:

| `TESLA_FLEET_API_REGION` | 대상 국가(예) | audience / Fleet API base |
|--------------------------|---------------|---------------------------|
| `na` | **KR, JP, AU**, US, CA, MX 등 (아시아태평양·중국 제외 + 북미) | `https://fleet-api.prd.na.vn.cloud.tesla.com` |
| `eu` | GB, DE, FR, NO 등 | `https://fleet-api.prd.eu.vn.cloud.tesla.com` |
| `cn` | 중국 (developer.tesla.cn 별도 앱) | `https://fleet-api.prd.cn.vn.cloud.tesla.cn` |

- **한국(KR) 계정은 `na`** 를 사용한다. `fleet-api.prd.ap...` 등 비공식 URL은 `Invalid audience` 오류가 발생한다.
- 리전별 **partner register** endpoint 호출이 필요할 수 있다 (412 오류 시).

---

## 3. 조회 가능한 데이터 (Read)

### 3.1 차량 목록·기본 상태
| 엔드포인트 | 조회 데이터 |
|-----------|-------------|
| `GET /api/1/vehicles` | 계정의 차량 목록 (VIN, display_name, state 등, 페이지네이션) |
| `GET /api/1/vehicles/{vin}` | 단일 차량 정보 (온라인 상태 등) |
| `POST /api/1/vehicles/fleet_status` | 차량 상태(펌웨어 버전, 텔레메트리 버전, 키 개수, 커맨드 프로토콜 필요 여부 등) |
| `GET /api/1/vehicles/{vin}/mobile_enabled` | 모바일 접근 허용 여부 |

### 3.2 실시간 차량 데이터 — `GET /api/1/vehicles/{vin}/vehicle_data`
차량에 라이브 호출로 실시간 정보를 가져온다. **주의: 잦은 폴링은 비용이 크며, 온라인 차량은 Fleet Telemetry(스트리밍) 권장.** 위치는 `location_data` 요청 필요(2023.38+).

주요 데이터 그룹과 대표 필드:

| 그룹 | 대표 데이터 |
|------|-------------|
| `charge_state` | 배터리 잔량(%), 주행가능거리, 충전 상태(충전중/완료/미연결), 충전 속도, 충전 한도, 충전 포트 상태, 예약 충전 정보 |
| `climate_state` | 실내/외 온도, 목표 온도, 공조 on/off, 시트/스티어링 히터, 예열(precondition) 상태 |
| `drive_state` | 위도/경도(location), 방향(heading), 속도, 기어(shift_state), 파워 |
| `vehicle_state` | 잠금 상태, 문/트렁크/창문 개폐, 주행거리(odometer), 소프트웨어 버전, 센트리 모드, 타이어 공기압(TPMS), 도난/경보 관련 |
| `vehicle_config` | 차종, 트림, 색상, 지붕 타입, 휠 등 구성 |
| `gui_settings` | 단위(거리/온도), 24시간제 등 표시 설정 |
| `closures_state` | 문/창문/트렁크/프렁크 개폐 상세 |

### 3.3 이벤트·이력·부가 조회
| 엔드포인트 | 조회 데이터 |
|-----------|-------------|
| `GET /api/1/vehicles/{vin}/recent_alerts` | 최근 경고(알림) 목록 |
| `GET /api/1/vehicles/{vin}/service_data` | 서비스(정비) 상태 정보 |
| `GET /api/1/vehicles/{vin}/release_notes` | 펌웨어 릴리스 노트 |
| `GET /api/1/vehicles/{vin}/nearby_charging_sites` | 현재 위치 인근 충전소 |
| `GET /api/1/vehicles/{vin}/drivers` | 허용된 운전자 목록 (소유자 전용) |
| `GET /api/1/vehicles/{vin}/invitations` | 활성 공유 초대 목록 |
| `GET /api/1/vehicles/{vin}/fleet_telemetry_config` | 텔레메트리 설정 상태 |
| `GET /api/1/vehicles/{vin}/fleet_telemetry_errors` | 텔레메트리 오류 이력 |

### 3.4 Fleet Telemetry (스트리밍 조회)
- 온라인 차량이 서버로 데이터를 **푸시(스트리밍)** 하는 방식.
- 잦은 `vehicle_data` 폴링 대비 **효율적·저비용**.
- 펌웨어 요건: 직접 호출 2023.20+, 프록시 경유 2024.26+ 등.
- **시사점**: MVP는 폴링으로 시작하되, 실시간성·비용 최적화가 필요하면 Telemetry로 전환.

---

## 4. 제어 가능한 기능 (Commands)

> 모든 명령은 `POST /api/1/vehicles/{vin}/command/{name}` 형태. Virtual Key 서명 필요(예외 있음).

### 4.1 차량 상태·보안
| 명령 | 기능 |
|------|------|
| `wake_up` | 차량 절전 해제 |
| `door_lock` / `door_unlock` | 잠금 / 해제 |
| `actuate_trunk` | 앞/뒤 트렁크 열기 |
| `window_control` | 창문 vent/close (주차 상태) |
| `sun_roof_control` | 선루프 stop/close/vent |
| `charge_port_door_open` / `charge_port_door_close` | 충전 포트 도어 |
| `honk_horn` | 경적 |
| `flash_lights` | 헤드라이트 점멸 |
| `remote_start_drive` | 원격 시동 (키리스 주행 필요) |
| `set_sentry_mode` | 센트리 모드(감시) on/off |
| `trigger_homelink` | 홈링크(차고문) |
| `remote_boombox` | 외부 스피커 사운드(위치 핑 등) |

### 4.2 충전
| 명령 | 기능 |
|------|------|
| `charge_start` / `charge_stop` | 충전 시작 / 중지 |
| `set_charge_limit` | 충전 한도(%) 설정 |
| `set_charging_amps` | 충전 전류(A) 설정 |
| `charge_standard` / `charge_max_range` | 표준 / 최대 주행 모드 |
| `add_charge_schedule` / `remove_charge_schedule` | 충전 스케줄 추가/삭제 |
| `set_scheduled_charging` / `set_scheduled_departure` | (구) 예약 충전/출발 |

### 4.3 공조(기후)
| 명령 | 기능 |
|------|------|
| `auto_conditioning_start` / `auto_conditioning_stop` | 공조 시작/중지 |
| `set_temps` | 운전석/동승석 온도 설정 |
| `set_climate_keeper_mode` | 클라이밋 키퍼(Off/Keep/Dog/Camp) |
| `set_preconditioning_max` | 최대 예열 |
| `set_bioweapon_mode` | 바이오웨폰 방어 모드 |
| `set_cabin_overheat_protection` / `set_cop_temp` | 실내 과열 방지·온도 |
| `remote_seat_heater_request` / `remote_seat_cooler_request` | 시트 열선/냉방 |
| `remote_steering_wheel_heater_request` 등 | 스티어링 휠 열선 |
| `add_precondition_schedule` / `remove_precondition_schedule` | 예열 스케줄 |

### 4.4 내비게이션·미디어
| 명령 | 기능 |
|------|------|
| `navigation_request` / `navigation_gps_request` | 목적지 전송 |
| `navigation_sc_request` | 슈퍼차저로 내비 |
| `navigation_waypoints_request` | 경유지 전송 |
| `media_toggle_playback`, `media_next_track` 등 | 미디어 재생 제어 |
| `adjust_volume`, `media_volume_up/down` | 볼륨 |

### 4.5 관리·보안 정책 (플릿 관리자·소유자 전용 다수)
| 명령 | 기능 |
|------|------|
| `set_valet_mode` / `reset_valet_pin` | 발렛 모드 |
| `speed_limit_activate` / `_deactivate` / `_set_limit` / `_clear_pin(_admin)` | 속도 제한 모드 |
| `set_pin_to_drive` / `reset_pin_to_drive_pin` / `clear_pin_to_drive_admin` | 주행 PIN |
| `parental_controls_*` | 자녀 보호(속도 상한 등) |
| `guest_mode` | 게스트 모드 |
| `set_vehicle_name` | 차량 이름 변경 |
| `schedule_software_update` / `cancel_software_update` | OTA 업데이트 예약/취소 |
| `erase_user_data` | 사용자 데이터 삭제 |
| `drivers remove`, `share_invites *` | 운전자/공유 관리 |

---

## 5. FMS 컨셉 적용 분석

FMS는 **관리자 웹에서 전체 차량을 관제**하는 제품이다. 소비자 앱 기능(미디어·시트 히터 등)은 대부분 제외하고, **관제·운영·안전·비용** 관점 기능만 선별한다.

### 5.1 선별 원칙
- 관제(위치·상태·이상)와 운영(충전·미운행)에 직접 기여하는가
- 관리자 1인 persona에 유효한가 (개인 편의 기능 제외)
- 조회는 적극 채택, 제어는 Virtual Key 부담을 고려해 단계화

### 5.2 조회 데이터 → 화면 매핑
> 이 매핑은 [development-checklist.md](./development-checklist.md) **Phase 2.1(Mock 표시)** → **Phase 3(실 연동)** 로 이어진다.

| 데이터 | 소스 | 대시보드 | 차량 상세 | 우선순위 |
|--------|------|:---:|:---:|:---:|
| 온라인/오프라인 상태 | `vehicles`, `vehicle_data.vehicle_state` | ○ | ○ | P0 |
| 배터리 잔량(%) | `charge_state` | ○ | ○ | P0 |
| 주행가능거리 | `charge_state` | ○ | ○ | P0 |
| 위치(위도/경도) | `drive_state`(location) | ○(지도) | ○(지도) | P0 |
| 충전 상태(충전중/완료) | `charge_state` | ○ | ○ | P0 |
| 최근 경고(alerts) | `recent_alerts` | ○(알림) | ○ | P1 |
| 주행거리(odometer) | `vehicle_state` | △ | ○ | P1 |
| 잠금/문/창문 상태 | `vehicle_state`, `closures_state` | - | ○ | P1 |
| 실내/외 온도·공조 | `climate_state` | - | ○ | P2 |
| 타이어 공기압(TPMS) | `vehicle_state` | - | ○ | P2 |
| 센트리/도난 관련 | `vehicle_state` | △(이상) | ○ | P2 |
| 서비스(정비) 상태 | `service_data` | - | ○ | P2 |
| 소프트웨어 버전 | `vehicle_state` | - | ○ | P2 |
| 인근 충전소 | `nearby_charging_sites` | - | △ | P2 |

### 5.3 제어 명령 → 버튼 매핑 (관제 유효성 기준)
| 제어 | 명령 | 화면 | FMS 유효성 | 우선순위 |
|------|------|------|------------|:---:|
| 차량 깨우기 | `wake_up` | 상세 | 데이터 갱신 전 필수 | P1 |
| 문 잠금/해제 | `door_lock/unlock` | 상세 | 보안·회수 | P2 |
| 충전 시작/중지 | `charge_start/stop` | 상세 | 운영비·가동률 | P2 |
| 충전 한도 설정 | `set_charge_limit` | 상세 | 배터리 관리 | P2 |
| 센트리 모드 | `set_sentry_mode` | 상세 | 도난 방지 | P2 |
| 위치 핑(경적/점멸/부저) | `honk_horn`/`flash_lights`/`remote_boombox` | 상세 | 주차장 차량 식별 | P2 |
| 속도 제한 | `speed_limit_*` | 상세 | 안전 정책 | P3 |
| 발렛 모드 | `set_valet_mode` | 상세 | 대여·정비 | P3 |
| OTA 예약 | `schedule_software_update` | 상세 | 유지보수 | P3 |
| 공조 제어 | `auto_conditioning_*` | 상세 | 여름/겨울 준비 | P3 |

> 미디어·시트/스티어링 히터·부메박스(사운드)·홈링크 등 **개인 편의 명령은 FMS에서 제외**한다. (단, `remote_boombox`의 "locate ping"은 차량 식별용으로만 선택 고려)

### 5.4 화면별 권장 반영안

#### 대시보드
- KPI: 전체/온라인/충전중/이상/미운행 (충전중을 KPI에 추가 권장)
- 지도: 실시간 위치 마커 (`vehicle_location`)
- 알림 패널: `recent_alerts` + 배터리 임계치·오프라인 규칙
- 배터리 낮은 차량 Top N 위젯 (운영 액션 유도)

#### 차량 상세
- 상태 요약: 배터리·주행가능거리·충전 상태·위치·잠금·주행거리·최종 업데이트
- 지도: 현재 위치
- 상세 탭: 공조/타이어/소프트웨어/서비스 상태 (P2)
- 제어 영역: `wake_up`(P1) → 잠금/충전/센트리/위치핑(P2) 순차 도입
- 이벤트 타임라인: `recent_alerts`

#### 제어 UX·안전
- 제어는 **확인 모달 + 실행 결과 표시** (성공/실패/차량상태 오류)
- 명령 이력 로그 저장 (요청·실행·결과) — 벤치마킹의 "차량 제어 이력"에 대응
- 권한 분리: 조회 사용자 vs 제어 권한 관리자 (Phase 4 인증과 연계)

---

## 6. 비용·제약·리스크

| 항목 | 내용 | 대응 |
|------|------|------|
| 폴링 비용 | `vehicle_data` 잦은 호출은 비용↑ | 폴링 주기 보수적(1~5분) + 대상 최소화, 추후 Telemetry |
| discounted device data | 특정 조건 시 할인 | 단일 VIN 호출 시 자격 확인 |
| Virtual Key | 제어의 전제(서명) | MVP는 조회 우선, 제어는 별도 스프린트 |
| 차량 절전(asleep) | 잠든 차량은 즉시 데이터 없음 | `wake_up` 후 조회, 무분별한 wake 자제(배터리) |
| 위치 아이콘 노출 | 위치 조회 시 차량 UI에 표시 | 소유자 동의·고지 (개인정보) |
| 펌웨어 요건 | Telemetry/명령별 최소 버전 | `fleet_status`로 사전 확인 |
| 개인정보/위치정보 | 위치·주행 데이터 규제 | `requirements.md` §9.1 준수 |

---

## 7. MVP 반영 결정 (요약)

| 구분 | 결정 |
|------|------|
| 필수 스코프 | `openid`, `offline_access`, `vehicle_device_data`, `vehicle_location` |
| 제어 스코프 | `vehicle_cmds`, `vehicle_charging_cmds` (제어 도입 시) |
| 수집 방식 | 초기 폴링(`vehicle_data`) → 확장 시 Fleet Telemetry |
| 조회 P0 | 상태·배터리·주행가능거리·위치·충전상태 |
| 조회 P1 | recent_alerts·odometer·잠금/개폐 |
| 제어 P1 | `wake_up`만 우선 |
| 제어 P2 | 잠금/해제·충전 시작·충전한도·센트리·위치핑 |
| 제어 제외 | 미디어·시트/휠 히터·홈링크 등 개인 편의 |

이 결정은 `development-checklist.md` Phase 3(데이터 연동)·이후 제어 스프린트의 근거가 된다.

---

## 8. 참고 링크
- Fleet API 소개: https://developer.tesla.com/docs/fleet-api/getting-started/what-is-fleet-api
- Vehicle Endpoints: https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-endpoints
- Vehicle Commands: https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-commands
- Authentication/Scopes: https://developer.tesla.com/docs/fleet-api/authentication/overview
- 서드파티 앱 접근(소유자용): https://www.tesla.com/ko_kr/support/access-third-party-apps

---

## 9. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-07 | Fleet API 조회/제어 기능 정리 및 FMS 적용안 초안 작성 |
| 2026-07-07 | §2.4 리전·OAuth audience 추가 (한국=na, Invalid audience 트러블슈팅) |
