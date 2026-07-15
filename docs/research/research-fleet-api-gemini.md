Q. 이번에는 반대로 fms에 테슬라 계정 연동, 가상키 발급(Telemetry) 이후 호출하는 rest api 항목 조사 이번 호출에는 모델타입(모델y), 색상(그레이) 같은 최초에 1회 수신시 바뀌지 않는 데이터를 조사해서 알려줘


A.
제시해주신 테슬라 Fleet API의 `vehicle_data` 응답 스펙을 바탕으로, 최초 1회 연동 시 수신한 이후 거의 바뀌지 않는 고정 제원 및 설정 데이터(정적 데이터)를 분류해 드립니다.

이 데이터들은 데이터베이스의 `Vehicle` 마스터 테이블에 한 번만 저장해 두고 재호출을 피함으로써 API 호출 크레딧과 데이터 트래픽을 극적으로 아낄 수 있는 항목들입니다.

---

## 1. 뼈대 정보 (기본 식별 및 권한 데이터)

차량의 고유 식별자 및 소유 자산으로서의 권한을 정의하는 항목입니다.

* **`id` / `id_s`:** API 호출 시 사용하는 테슬라 내부 차량 고유 ID.


* **`vin`:** 차량 식별 번호 (차대번호, 변하지 않는 고유 키).


* **`access_type`:** 해당 계정의 차량 접근 권한 유형 (예: `OWNER`).



---

## 2. 하드웨어 및 제원 스펙 (`vehicle_config`)

공장에서 출고된 이후 튜닝이나 휠 교체를 하지 않는 이상 물리적으로 고정된 차량의 스펙 정보입니다. FMS에서 차량 상세 카드에 스펙 표기용으로 아주 유용합니다.

* **`car_type`:** 차량 모델 타입 (예: `modely` -> 모델 Y, `model3` -> 모델 3).


* **`exterior_color`:** 기본 외장 색상 (예: `MidnightSilver` -> 미드나잇 실버).


* **`exterior_trim` / `exterior_trim_override`:** 크롬 유무 등 외장 트림 스펙 (예: `Black`).


* **`roof_color`:** 루프 타입 (예: `RoofColorGlass` -> 글래스 루프).


* **`wheel_type`:** 기본 장착 휠 종류 (예: `Apollo19` -> 19인치 아폴로 휠).


* **`trim_badging`:** 세부 트림 등급 배지 (예: `74d`).


* **`efficiency_package`:** 연비/전비 효율성 패키지 세대 명칭 (예: `MY2021`).


* **`motorized_charge_port`:** 전동 충전구 개폐 지원 여부 (`true`/`false`).


* **`charge_port_type`:** 충전 포트 규격 타입 (예: `US` -> NACS/CCS1 등 국가별 규격).


* **`rear_seat_heaters` / `has_seat_cooling`:** 열선 시트 등급 및 통풍 시트 지원 여부.


* **`third_row_seats`:** 3열 시트 존재 여부 (예: `None`, 7인승 여부 확인용).


* **`has_air_suspension`:** 에어 서스펜션 장착 여부.


* **`rhd`:** 우핸들 차량 여부 (`Right Hand Drive` 여부로 한국은 기본 `false`).



---

## 3. 소프트웨어 및 기능 활성화 플래그 (`vehicle_config` / `vehicle_state`)

해당 차량이 하드웨어·소프트웨어적으로 어떤 안전/자율주행 기술을 품고 있는지에 대한 불변에 가까운 기능 지원 정보입니다.

* **`driver_assist`:** 자율주행 컴퓨터 하드웨어 버전 (예: `TeslaAP3` -> HW3 하드웨어 장착 차량).


* **`pws`:** 보행자 경고 시스템 (Pedestrian Warning System, 저속 가상 사운드) 탑재 여부.


* **`plg`:** 파워 리프트게이트 (전동 트렁크) 탑재 여부.


* **`can_accept_navigation_requests`:** 외부(FMS 서버)에서 차량 네비게이션으로 목적지 전송 명령을 보낼 수 있는 스펙인지 여부.


* **`can_actuate_trunks`:** 원격 트렁크 제어 가능 여부.


* **`dashcam_clip_save_supported` / `webcam_supported`:** 블랙박스(대시캠) 클립 저장 및 웹캠 실시간 뷰 지원 여부.



---

## 🛠️ FMS 아키텍처 설계 제안: "초기 동기화 데이터베이스"

사용자가 테슬라 계정을 FMS 플랫폼에 연동하는 순간, 최초 1회만 위 REST API(`vehicle_data`)를 호출하여 다음과 같이 데이터베이스 테이블을 분리 저장(Normalization)하는 것을 추천합니다.

```sql
-- 1. 고정 정보 마스터 테이블 (최초 1회만 Write, 거의 Read 전용)
CREATE TABLE "VehicleMaster" (
    vin VARCHAR(17) PRIMARY KEY,
    car_type VARCHAR(20),
    exterior_color VARCHAR(30),
    wheel_type VARCHAR(30),
    charge_port_type VARCHAR(10),
    has_air_suspension BOOLEAN,
    has_seat_cooling BOOLEAN,
    driver_assist VARCHAR(20)
);

-- 2. 유동적 상태 정보 테이블 (Telemetry 수신 시마다 계속 Update 혹은 Insert)
CREATE TABLE "VehicleStatus" (
    vin VARCHAR(17) REFERENCES "VehicleMaster"(vin),
    soc NUMERIC,
    latitude NUMERIC,
    longitude NUMERIC,
    speed NUMERIC,
    updated_at TIMESTAMP
);

```

이 구조로 설계하시면, 화면을 그릴 때 `VehicleMaster`와 `VehicleStatus`를 `JOIN`하여 렌더링하되, 데이터 수집단은 가볍고 빠른 Telemetry 기반 스트리밍만 처리하므로 부하가 대폭 줄어듭니다.