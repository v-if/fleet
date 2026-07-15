Q. fms 차량 관리자 관점에서
fms 대시보드, 차량상세화면에서
실시간으로 데이터를 받아 보여주면 좋은 항목을 조사해줘
모델타입(모델y), 색상(그레이) 이런 최초에 1회 수신시 바뀌지 않는 데이터는 제외

A.
**FMS 대시보드 & 차량 상세 화면 추천 실시간 표시 항목** (Fleet Manager 관점)

Tesla Fleet Telemetry 필드를 기반으로, **플릿 관리자**가 실시간으로 가장 유용하게 볼 수 있는 항목들을 우선순위별로 정리했습니다. 

**정적 데이터(1회 수신 후 거의 변하지 않음)**는 제외했습니다. (CarType, ExteriorColor, Trim, Version, EfficiencyPackage 등)

### 1. 대시보드 메인 화면 (전체 차량 목록 / 지도 뷰) 추천
한눈에 상태를 파악할 수 있는 핵심 KPI 중심:

| 우선순위 | 항목 | 이유 (관리자 관점) |
|----------|------|-------------------|
| ★★★★★ | **Location** + **GpsHeading** | 실시간 위치 추적, 지도 표시 필수 |
| ★★★★★ | **Soc** (State of Charge) | 배터리 잔량, 충전 필요 차량 빠른 식별 |
| ★★★★ | **VehicleSpeed** | 주행 중인지, 과속 여부 |
| ★★★★ | **EstBatteryRange** 또는 **RatedRange** | 실제 주행 가능 거리 |
| ★★★★ | **Gear** | P/R/D/S 상태 (주차/주행 구분) |
| ★★★ | **TpmsPressureFl/Fr/Rl/Rr** + **TpmsHardWarnings** | 타이어 공기압 이상 조기 발견 |
| ★★★ | **ChargeState** / **DetailedChargeState** | 충전 중인지, 완료 여부 |
| ★★ | **Locked** + **SentryMode** | 보안 상태 |
| ★★ | **Odometer** | 누적 주행거리 (일일 증가량 계산) |

**대시보드 카드 예시**:
- 색상으로 상태 표시 (Soc 20% 미만 = 빨강, 충전 중 = 파랑 등)

### 2. 차량 상세 화면 추천 (클릭 시 상세 모달/페이지)
여기서는 더 많은 실시간 데이터를 배치합니다.

#### **A. 기본 상태 섹션**
- Location + GpsHeading (지도 크게)
- Soc + EstBatteryRange + RatedRange
- VehicleSpeed + Gear
- OutsideTemp / InsideTemp
- Locked / DoorState / SentryMode
- Odometer (일일/이번 주 주행거리)

#### **B. 충전 관련 (가장 중요)**
- **ChargeState**, **TimeToFullCharge**, **ChargeRateMilePerHour**
- **ChargeAmps**, **ChargerVoltage**, **ACChargingPower** / **DCChargingPower**
- **ChargeLimitSoc**, **ChargePortDoorOpen**, **ChargePortLatch**
- **ScheduledChargingMode** / **ScheduledChargingPending**
- **FastChargerPresent** / **FastChargerType**

#### **C. 배터리 & 건강 상태**
- **BatteryHeaterOn**
- **PackVoltage**, **PackCurrent**
- **BMSState**, **EnergyRemaining**
- **ModuleTempMax/Min** (배터리 모듈 온도)

#### **D. 주행 & 안전**
- **CruiseSetSpeed**, **CruiseFollowDistance**
- **ForwardCollisionWarning**, **LaneDepartureAvoidance**
- **BrakePedal**, **PedalPosition**
- **LightsTurnSignal**, **LightsHighBeams**, **LightsHazardsActive**
- **DriverSeatBelt**, **DriverSeatOccupied**

#### **E. TPMS & 타이어**
- **TpmsPressureFl/Fr/Rl/Rr**
- **TpmsHardWarnings** / **TpmsSoftWarnings**
- **TpmsLastSeenPressureTime** 시리즈 (마지막 업데이트 시간)

#### **F. 기후 & 편의**
- **HvacPower**, **HvacFanStatus**, **HvacAutoMode**
- **InsideTemp**, **HvacLeftTemperatureRequest** 등
- **SeatHeater** 시리즈, **DefrostMode**
- **PreconditioningEnabled**

#### **G. 기타 유용 항목**
- **DestinationName**, **MilesToArrival**, **MinutesToArrival** (목적지 주행 중일 때)
- **SoftwareUpdate** 관련 (다운로드/설치 진행률)
- **PowershareStatus** (V2H/V2G 사용 시)
- **MediaPlaybackStatus** (필요에 따라)

### 3. 추천 그룹핑 (UI 설계 팁)
**차량 상세 화면 레이아웃 예시**:
1. **헤더**: 차량명 + Soc 큰 숫자 + 상태 아이콘 (주행/충전/주차)
2. **지도 섹션**: Location 중심
3. **상태 그리드** (카드 4~6개)
   - 배터리 (Soc, Range, 충전 정보)
   - 주행 (Speed, Gear, Cruise)
   - 타이어 (TPMS 4개)
   - 기후 (온도, HVAC)
4. **경고/이벤트 로그** (실시간 업데이트)
5. **고급 데이터** (접을 수 있는 Accordion): Di* (드라이브 인버터), PackVoltage 등 기술적 데이터

### 4. 추가 추천
- **경고 규칙** 설정 기능: Soc < 15%, Tpms 이상, SentryMode Off 등 자동 알림.
- **색상 코딩**: 녹색(정상), 노랑(주의), 빨강(문제).
- **필터**: “충전 필요 차량”, “주행 중”, “TPMS 이상” 등 빠른 필터.
- **히스토리**: 중요한 값(Soc, Speed, Location)은 시간에 따라 그래프 표시.

이 중에서 **Soc, Location, Speed, TPMS, ChargeState** 5가지를 최우선으로 구현하면 MVP 대시보드가 바로 실용적으로 나옵니다.

특정 섹션(예: 충전 섹션 UI, TPMS SVG 연동 등)을 더 자세히 원하시거나, 위 항목들로 실제 컴포넌트 코드 예시를 만들어 드릴까요?