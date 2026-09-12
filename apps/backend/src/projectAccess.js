import { prisma } from "./prisma.js";

export async function findOwnedProject(userId, projectId) {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
  });
}
