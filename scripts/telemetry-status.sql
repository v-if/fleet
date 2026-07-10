-- Fleet Telemetry 운영 점검용 SQL (Supabase SQL Editor)

-- 1) 전역 Telemetry 메타
SELECT
  "lastReceivedAt",
  "lastProcessedAt",
  "pendingIngressCount",
  "subscriptionCount",
  "lastError",
  "updatedAt"
FROM "TelemetryMetadata"
WHERE id = 'default';

-- 2) ingress 상태별 건수
SELECT status, COUNT(*) AS count
FROM "TelemetryIngress"
GROUP BY status
ORDER BY count DESC;

-- 3) 최근 webhook 수신 20건
SELECT
  id,
  vin,
  status,
  "receivedAt",
  "processedAt",
  "errorMessage"
FROM "TelemetryIngress"
ORDER BY "receivedAt" DESC
LIMIT 20;

-- 4) Telemetry 기반 최신 스냅샷
SELECT
  v."plateNumber",
  v."oemVehicleId" AS vin,
  vs."telemetrySource",
  vs."lastTelemetryAt",
  vs."lastUpdatedAt",
  vs.status
FROM "VehicleSnapshot" vs
JOIN "Vehicle" v ON v.id = vs."vehicleId"
WHERE vs."telemetrySource" = 'TELEMETRY'
ORDER BY vs."lastTelemetryAt" DESC NULLS LAST
LIMIT 20;

-- 5) 등록 차량 vs Telemetry 수신 여부
SELECT
  v."plateNumber",
  v."oemVehicleId" AS vin,
  ts.active AS subscription_active,
  latest."lastTelemetryAt",
  latest."telemetrySource"
FROM "Vehicle" v
LEFT JOIN "TelemetrySubscription" ts ON ts."vehicleId" = v.id
LEFT JOIN LATERAL (
  SELECT s."lastTelemetryAt", s."telemetrySource"
  FROM "VehicleSnapshot" s
  WHERE s."vehicleId" = v.id
  ORDER BY s."lastUpdatedAt" DESC
  LIMIT 1
) latest ON true
WHERE v."unlinkedAt" IS NULL
  AND v."isDeleted" = false
  AND v."oemVehicleId" IS NOT NULL
ORDER BY v."plateNumber";

-- 6) 최근 Telemetry 감사 로그
SELECT "action", status, summary, "occurredAt"
FROM "AuditLog"
WHERE action LIKE 'TELEMETRY_%'
ORDER BY "occurredAt" DESC
LIMIT 30;
