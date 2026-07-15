Q. 이번에는 반대로 fms에 테슬라 계정 연동, 가상키 발급(Telemetry) 이후 호출하는 rest api 항목 조사 이번 호출에는 모델타입(모델y), 색상(그레이) 같은 최초에 1회 수신시 바뀌지 않는 데이터를 조사해서 알려줘


A.
**✅ Tesla Fleet API에서 정적/1회성 데이터 조사 결과**입니다.

Tesla Fleet API(`vehicle_data` 또는 `vehicle` 엔드포인트)를 호출했을 때, **모델 타입, 색상**처럼 **거의 변하지 않는(static) 데이터**를 중심으로 정리했습니다.

### 1. 정적 / 거의 변하지 않는 데이터 (1회 수신 후 캐싱 추천)

아래 데이터들은 `vehicle_config`, `vehicle_state`, `vehicle` 기본 정보에서 주로 나오며, 차량 등록 후 **캐싱**해서 자주 호출하지 않아도 됩니다.

**vehicle_config** (차량 사양 관련)
- `car_type`: "modely" (모델 Y)
- `exterior_color`: "MidnightSilver" (색상)
- `exterior_trim`, `paint_color_override`
- `interior_trim_type`
- `wheel_type`: "Apollo19"
- `roof_color`
- `trim_badging`
- `spoiler_type`
- `sun_roof_installed`
- `has_air_suspension`, `has_seat_cooling` 등 옵션 정보
- `rear_seat_heaters`, `third_row_seats`
- `efficiency_package`
- `motorized_charge_port`, `charge_port_type`
- `eu_vehicle`, `rhd` (지역/핸들 위치)

**vehicle_state** (차량 기본 정보)
- `car_version` (현재 소프트웨어 버전 — 업데이트 시 변경될 수 있음)
- `vehicle_name` (사용자가 설정한 차량 이름)
- `odometer` (주행거리 — 자주 변하지만, 일 단위로만 업데이트해도 충분)
- `homelink_device_count`

**기타 기본 정보** (`vehicle` 엔드포인트)
- `vin`
- `id`, `vehicle_id`
- `api_version`
- `tokens` (키 관련)

**권장 전략**:
- 차량 최초 등록 시 `GET /api/1/vehicles/{id}/vehicle_data` 한 번 호출 → 위 정적 필드들을 DB에 저장.
- 이후 실시간 데이터만 주기적으로/Telemetry로 수신.
- `car_version`, `odometer`는 주 1회 정도만 갱신.

---

### 2. FMS에서 자주 호출하게 될 주요 REST API Endpoints

Tesla Fleet API 문서 기반으로, **계정 연동 → 가상키(Virtual Key) 발급 → 차량 관리** 흐름에 맞춰 정리했습니다.

#### **인증 / 차량 목록 단계**
- `GET /api/1/vehicles` — 사용자의 모든 차량 목록 조회 (VIN, 상태, online/offline 등)
- `GET /api/1/vehicles/{id}` — 특정 차량 기본 정보

#### **차량 상세 데이터 (가장 중요)**
- `GET /api/1/vehicles/{id}/vehicle_data` — **모든 데이터 한 번에** (charge_state, climate_state, drive_state, vehicle_state, vehicle_config 등)
  - **주의**: 자주 호출하면 비용 발생 + 차량 wake-up 유발 → **Telemetry**와 병행 추천

#### **명령(Command) 관련** (가상키 필요)
- `POST /api/1/vehicles/{id}/command/wake_up` — 차량 깨우기
- **충전 관련**
  - `POST /api/1/vehicles/{id}/command/charge_start`
  - `POST /api/1/vehicles/{id}/command/charge_stop`
  - `POST /api/1/vehicles/{id}/command/set_charge_limit`
- **기후 제어**
  - `POST /api/1/vehicles/{id}/command/set_temps`
  - `POST /api/1/vehicles/{id}/command/auto_conditioning_start/stop`
  - `POST /api/1/vehicles/{id}/command/set_preconditioning_override`
- **도어/잠금**
  - `POST /api/1/vehicles/{id}/command/door_lock/unlock`
- **기타 유용**
  - `POST /api/1/vehicles/{id}/command/speed_limit_set`
  - `POST /api/1/vehicles/{id}/command/remote_auto_seat_climate_request`
  - `POST /api/1/vehicles/{id}/command/set_valet_mode`

#### **Telemetry (실시간 추천)**
- Fleet Telemetry 설정 (`POST /api/1/vehicles/{id}/fleet_telemetry_config`)
  - 실시간 스트리밍 (Location, Soc, Speed, TPMS 등) → `vehicle_data` 폴링 대체

#### **소프트웨어 업데이트**
- `GET /api/1/vehicles/{id}/data_request/software_update`
- 업데이트 명령 엔드포인트

---

**FMS 개발 시 추천 호출 전략**:
1. **최초 연동**: `/vehicles` → `/vehicle_data` (정적 데이터 저장)
2. **대시보드 실시간**: Fleet Telemetry (Location, Soc, Speed, TPMS, ChargeState 등)
3. **상세 화면**: 필요 시 `vehicle_data` 재호출 (캐싱 + 30초~1분 주기)
4. **명령**: 사용자가 버튼 클릭할 때만 Command API 호출

필요하면:
- 특정 엔드포인트의 Request/Response 예시
- 정적 데이터 저장용 DB 스키마
- Telemetry 설정 예시

원하는 부분을 더 자세히 알려주세요!