import type { Prisma } from "@prisma/client";

/** Active (linked) vehicles shown in dashboard, list, and map APIs. */
export const activeVehicleWhere = {
  unlinkedAt: null,
  isDeleted: false,
} satisfies Prisma.VehicleWhereInput;

export const activeTeslaAccountWhere = {
  unlinkedAt: null,
} satisfies Prisma.TeslaAccountWhereInput;
