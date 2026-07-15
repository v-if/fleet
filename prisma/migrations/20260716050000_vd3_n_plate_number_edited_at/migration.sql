-- VD3-N: 관리자 수동 표시명 보호
ALTER TABLE "Vehicle" ADD COLUMN "plateNumberEditedAt" TIMESTAMPTZ(3);
