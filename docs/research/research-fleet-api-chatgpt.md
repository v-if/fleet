Q. 이번에는 반대로 fms에 테슬라 계정 연동, 가상키 발급(Telemetry) 이후 호출하는 rest api 항목 조사 이번 호출에는 모델타입(모델y), 색상(그레이) 같은 최초에 1회 수신시 바뀌지 않는 데이터를 조사해서 알려줘


A.
좋은 방향입니다.

FMS를 구현할 때는 데이터를 **2가지로 분리**하는 것이 좋습니다.

1. **Telemetry (Streaming)** → 실시간으로 계속 변하는 데이터
2. **REST API (Vehicle Data)** → 거의 변하지 않는 차량 정보

실제로 Tesla도 이러한 구조를 권장하고 있습니다.

---

# 최초 차량 등록 시 1회 수신하면 되는 데이터

아래 데이터는 대부분 차량 구매 후 거의 바뀌지 않거나 매우 드물게 변경됩니다.

## 1. 차량 기본 정보 ⭐⭐⭐⭐⭐

가장 중요합니다.

| 항목                | API 필드                      |
| ----------------- | --------------------------- |
| VIN               | vin                         |
| Vehicle ID        | vehicle_id                  |
| 차량명               | vehicle_name                |
| 모델                | vehicle_config.car_type     |
| 구동방식(롱레인지/퍼포먼스 등) | vehicle_config.trim_badging |
| API Version       | api_version                 |

예시 데이터  

---

# 2. 외관 정보

| 항목    | API            |
| ----- | -------------- |
| 외장 색상 | exterior_color |
| 외장 트림 | exterior_trim  |
| 루프 타입 | roof_color     |
| 휠 종류  | wheel_type     |
| 스포일러  | spoiler_type   |



이 정보는 차량 카드 UI에 활용하기 좋습니다.

예)

```
Model Y Long Range

Midnight Silver

19" Apollo
```

---

# 3. 하드웨어 정보

FMS에서는 의외로 유용합니다.

| 항목               | API                         |
| ---------------- | --------------------------- |
| Autopilot HW     | driver_assist               |
| Charge Port Type | charge_port_type            |
| Air Suspension   | has_air_suspension          |
| Ludicrous        | has_ludicrous_mode          |
| Seat Cooling     | has_seat_cooling            |
| Dashcam 지원       | dashcam_clip_save_supported |



---

# 4. 차량 옵션

| 항목                | API                   |
| ----------------- | --------------------- |
| Third Row         | third_row_seats       |
| Rear Seat Heater  | rear_seat_heaters     |
| Interior Trim     | interior_trim_type    |
| Charge Port Motor | motorized_charge_port |



---

# 5. 지역 정보

| 항목         | API        |
| ---------- | ---------- |
| 좌핸들/우핸들    | rhd        |
| 유럽 차량 여부   | eu_vehicle |
| UTC Offset | utc_offset |



---

# 6. 기능 지원 여부

FMS에서 기능 버튼 활성화 여부를 결정할 수 있습니다.

| 항목            | API                            |
| ------------- | ------------------------------ |
| Trunk 제어 가능   | can_actuate_trunks             |
| Navigation 가능 | can_accept_navigation_requests |
| QR Pairing    | supports_qr_pairing            |
| Webcam        | webcam_supported               |
| Selfie Camera | webcam_selfie_supported        |



---

# 7. 차량 소프트웨어

이 정보는 자주 바뀌지는 않습니다.

| 항목          | API         |
| ----------- | ----------- |
| 현재 소프트웨어 버전 | car_version |



업데이트 이후에만 다시 조회하면 됩니다.

---

# 8. GUI 설정 (선택)

운영에는 크게 중요하지 않습니다.

| 항목     | API                    |
| ------ | ---------------------- |
| 거리 단위  | gui_distance_units     |
| 온도 단위  | gui_temperature_units  |
| PSI 단위 | gui_tirepressure_units |



---

# 굳이 저장하지 않아도 되는 항목

이런 데이터는 REST에서 받아도 매번 Telemetry로 들어오므로 별도 저장할 필요가 거의 없습니다.

* Battery %
* Range
* GPS
* Speed
* Lock
* Climate
* TPMS
* Charging
* Odometer
* Sentry Mode
* Window
* Door
* Inside Temp

---

# BORI Fleet에서 추천하는 Vehicle 테이블

제가 설계한다면 아래 정도만 DB에 저장합니다.

| 컬럼              | 설명                       |
| --------------- | ------------------------ |
| vehicleId       | Tesla Vehicle ID         |
| vin             | VIN                      |
| vehicleName     | 차량 이름                    |
| model           | Model Y / Model 3        |
| trim            | Long Range / Performance |
| exteriorColor   | 차량 색상                    |
| wheelType       | 휠 종류                     |
| roofType        | 루프                       |
| autopilotHw     | AP Hardware              |
| chargePortType  | 충전 규격                    |
| softwareVersion | 현재 버전                    |
| ownerType       | OWNER / DRIVER           |
| createdAt       | 최초 등록일                   |
| lastSyncAt      | 마지막 동기화                  |

---

# 제가 추가로 추천하는 구조

Tesla API는 시간이 지나면서 필드가 추가되거나 변경될 수 있습니다. 그래서 **필수 컬럼만 정규화하고 나머지 `vehicle_config` 전체 JSON을 그대로 보관**하는 방식을 추천합니다.

예를 들면:

```sql
Vehicle
--------
id
vin
model
trim
color
software_version
vehicle_config_json
created_at
updated_at
```

이렇게 하면 나중에 Tesla가 새로운 옵션(예: 새로운 하드웨어, 카메라, 배터리 타입)을 추가해도 **DB 스키마를 변경하지 않고 대응**할 수 있습니다.

**BORI Fleet처럼 장기 운영을 목표로 하는 SaaS라면,**

* **실시간 Telemetry는 Redis + Timeseries(DB)**
* **차량 기본 정보는 Vehicle 테이블 + 원본 JSON 보관**

이 구조가 유지보수성과 확장성 면에서 가장 안정적입니다.
