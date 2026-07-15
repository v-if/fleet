Q. fms 차량 관리자 관점에서
fms 대시보드, 차량상세화면에서
실시간으로 데이터를 받아 보여주면 좋은 항목을 조사해줘
모델타입(모델y), 색상(그레이) 이런 최초에 1회 수신시 바뀌지 않는 데이터는 제외

A.
업로드한 telemetry 목록을 보니 **Tesla Fleet API에서 받을 수 있는 실시간 데이터 전체 목록**인 것 같습니다. 

FMS는 일반 사용자가 사용하는 Tesla 앱과 목적이 다릅니다.

* **Tesla 앱** → 내 차를 제어
* **FMS** → 관리자가 수십~수천 대 차량을 운영

따라서 **"예쁜 데이터"보다 "관리에 도움이 되는 데이터"**가 중요합니다.

---

# 1순위 (대시보드에 반드시 있어야 하는 데이터)

## 차량 상태

| 항목             | API              |
| -------------- | ---------------- |
| 온라인/오프라인       | GpsState         |
| 운행 상태(P/R/N/D) | Gear             |
| 현재 속도          | VehicleSpeed     |
| 현재 위치          | Location         |
| 마지막 업데이트       | RouteLastUpdated |

  

---

## 배터리

| 항목      | API             |
| ------- | --------------- |
| 배터리 %   | BatteryLevel    |
| 예상 주행거리 | EstBatteryRange |
| 실제 주행거리 | RatedRange      |
| 남은 에너지  | EnergyRemaining |

 

---

## 충전

| 항목        | API                               |
| --------- | --------------------------------- |
| 충전 상태     | ChargeState                       |
| 충전 출력(kW) | ACChargingPower / DCChargingPower |
| 예상 완료시간   | TimeToFullCharge                  |
| 충전전류      | ChargeAmps                        |
| 충전전압      | ChargerVoltage                    |
| 충전속도      | ChargeRateMilePerHour             |

 

---

## 보안

| 항목    | API              |
| ----- | ---------------- |
| 잠금    | Locked           |
| 감시모드  | SentryMode       |
| 발렛모드  | ValetModeEnabled |
| 서비스모드 | ServiceMode      |

 

---

# 2순위 (차량 상세화면 핵심)

## 공조

| 항목        | API          |
| --------- | ------------ |
| 공조 ON/OFF | HvacPower    |
| 실내온도      | InsideTemp   |
| 실외온도      | OutsideTemp  |
| 팬속도       | HvacFanSpeed |
| AUTO 여부   | HvacAutoMode |

 

---

## TPMS

| 항목 | API                             |
| -- | ------------------------------- |
| 전좌 | TpmsPressureFl                  |
| 전우 | TpmsPressureFr                  |
| 후좌 | TpmsPressureRl                  |
| 후우 | TpmsPressureRr                  |
| 경고 | TpmsSoftWarnings / HardWarnings |



---

## 문 상태

| 항목   | API                                       |
| ---- | ----------------------------------------- |
| 문 열림 | DoorState                                 |
| 창문   | FdWindow / FpWindow / RdWindow / RpWindow |
| 충전포트 | ChargePortDoorOpen                        |

 

---

# 3순위 (관리자가 좋아할 데이터)

## 운행

| 항목       | API         |
| -------- | ----------- |
| 누적주행거리   | Odometer    |
| 운행거리(계산) | Odometer 차이 |
| 평균속도     | 계산          |
| 운행시간     | 계산          |



---

## 배터리 건강

| 항목                   | API                 |
| -------------------- | ------------------- |
| Battery Heater       | BatteryHeaterOn     |
| Pack Voltage         | PackVoltage         |
| Pack Current         | PackCurrent         |
| Isolation Resistance | IsolationResistance |

 

---

## OTA

| 항목       | API                                       |
| -------- | ----------------------------------------- |
| 다운로드 진행률 | SoftwareUpdateDownloadPercentComplete     |
| 설치 진행률   | SoftwareUpdateInstallationPercentComplete |
| 예정시간     | SoftwareUpdateExpectedDurationMinutes     |
| 버전       | SoftwareUpdateVersion                     |



---

# 4순위 (AI 분석용)

이 데이터는 화면보다는 AI 분석에 활용하면 좋습니다.

* 급가속
* 급감속
* 장시간 공회전
* 배터리 열화
* 충전 패턴
* 운전 습관
* 효율(kWh/km)

API에는

* PedalPosition
* BrakePedal
* LateralAcceleration
* LongitudinalAcceleration
* PackVoltage
* PackCurrent

등이 있어 AI 분석에 활용하기 좋습니다.  

---

# 제가 추천하는 "BORI Fleet" 차량 상세 화면

상단

```
온라인
주차중

81%

344km

Tesla Model Y
```

---

첫 번째 카드

```
잠금
감시모드
공조
충전상태
오늘 운행
최근 업데이트
```

---

두 번째 카드

```
TPMS
```

---

세 번째 카드

```
현재 위치
```

---

네 번째 카드

```
최근 운행

09:14 출발

09:52 도착

52km
```

---

다섯 번째 카드

```
충전

AC

11kW

예상 완료

22:41
```

---

여섯 번째 카드

```
AI 분석

✔ 충전 불필요

✔ TPMS 정상

✔ 배터리 상태 양호

✔ 이상 없음
```

---

# 투자자에게 가장 임팩트 있는 기능

제가 투자자라면 단순히 **200개의 데이터를 보여주는 서비스보다**, **운영에 필요한 정보를 자동으로 요약해 주는 서비스**에 더 높은 점수를 줄 것입니다.

예를 들어 차량 상세 화면 상단에 **"AI Fleet Summary"** 카드 하나를 두는 것입니다.

```
AI Fleet Summary

✓ 차량 상태 정상

✓ 오늘 52km 운행

✓ 배터리 81% (충전 불필요)

✓ TPMS 정상

✓ 문/창문 모두 닫힘

✓ 감시모드 활성화

✓ 이상 징후 없음
```

또는 문제가 있을 때는

```
⚠ TPMS 후좌 타이어 압력 낮음

⚠ 충전이 1시간 내 필요

⚠ 차량이 3일간 미운행 상태
```

처럼 **관리자가 즉시 행동해야 할 내용을 한눈에 보여주는 것**입니다.

이런 기능은 단순히 Tesla API 데이터를 나열하는 FMS가 아니라, **"데이터를 해석해 주는 Fleet Intelligence Platform"**이라는 차별점을 만들 수 있고, IR 자료에서도 매우 강력한 경쟁력이 될 수 있습니다.
