export const DEFAULT_USER_EMAIL = "admin@fleet.local";

export async function getOrCreateDefaultUser() {
  const { prisma } = await import("@/lib/prisma");

  return prisma.user.upsert({
    where: { email: DEFAULT_USER_EMAIL },
    update: {},
    create: {
      email: DEFAULT_USER_EMAIL,
      name: "Fleet Admin",
    },
  });
}
