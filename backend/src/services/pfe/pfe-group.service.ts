import prisma from "../../config/database";
import { Prisma } from "@prisma/client";
import logger from "../../utils/logger";

export interface SearchStudentsInput {
  query?: string;
  limit?: number;
  exclude?: number[]; // Student IDs already in group
}

export interface AssignStudentsInput {
  groupId: number;
  studentIds: number[];
}

export interface GroupStudentInfo {
  id: number;
  userId: number;
  email: string;
  nom: string;
  prenom: string;
  matricule: string | null;
  moyenne: number | null;
  promo: {
    id: number;
    nom_ar: string | null;
    nom_en: string | null;
  } | null;
  role: "membre" | "chef_groupe";
}

export interface AvailableStudent {
  id: number;
  userId: number;
  email: string;
  nom: string;
  prenom: string;
  matricule: string | null;
  moyenne: number | null;
}

/**
 * Get all students currently assigned to a PFE group
 */
export const getGroupStudents = async (
  groupId: number
): Promise<GroupStudentInfo[]> => {
  try {
    const group = await prisma.groupPfe.findUnique({
      where: { id: groupId },
      include: {
        groupMembers: {
          include: {
            etudiant: {
              include: {
                user: true,
                promo: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new Error("Group not found");
    }

    return group.groupMembers.map((member) => ({
      id: member.etudiant.id,
      userId: member.etudiant.userId,
      email: member.etudiant.user.email,
      nom: member.etudiant.user.nom,
      prenom: member.etudiant.user.prenom,
      matricule: member.etudiant.matricule,
      moyenne: member.etudiant.moyenne ? Number(member.etudiant.moyenne) : null,
      promo: member.etudiant.promo
        ? {
            id: member.etudiant.promo.id,
            nom_ar: member.etudiant.promo.nom_ar,
            nom_en: member.etudiant.promo.nom_en,
          }
        : null,
      role: member.role,
    }));
  } catch (error) {
    logger.error("Error fetching group students:", error);
    throw error;
  }
};

/**
 * Search for available students to assign to a group
 * Supports filtering by name/email and excludes already assigned students
 */
export const searchAvailableStudents = async (
  input: SearchStudentsInput
): Promise<AvailableStudent[]> => {
  try {
    const limit = Math.min(input.limit || 20, 100);
    const excludeIds = input.exclude || [];

    const where: Prisma.EtudiantWhereInput = {
      AND: [
        {
          NOT: {
            id: { in: excludeIds },
          },
        },
      ],
    };

    // Add search query if provided
    if (input.query && input.query.trim()) {
      const searchQuery = input.query.trim();
      where.AND = where.AND || [];
      (where.AND as any).push({
        OR: [
          {
            user: {
              nom: {
                contains: searchQuery,
                mode: "insensitive" as Prisma.QueryMode,
              },
            },
          },
          {
            user: {
              prenom: {
                contains: searchQuery,
                mode: "insensitive" as Prisma.QueryMode,
              },
            },
          },
          {
            user: {
              email: {
                contains: searchQuery,
                mode: "insensitive" as Prisma.QueryMode,
              },
            },
          },
          {
            matricule: {
              contains: searchQuery,
              mode: "insensitive" as Prisma.QueryMode,
            },
          },
        ],
      });
    }

    const students = await prisma.etudiant.findMany({
      where,
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            email: true,
            nom: true,
            prenom: true,
          },
        },
        matricule: true,
        moyenne: true,
      },
      orderBy: { user: { nom: "asc" } },
      take: limit,
    });

    return students.map((student) => ({
      id: student.id,
      userId: student.userId,
      email: student.user.email,
      nom: student.user.nom,
      prenom: student.user.prenom,
      matricule: student.matricule,
      moyenne: student.moyenne ? Number(student.moyenne) : null,
    }));
  } catch (error) {
    logger.error("Error searching available students:", error);
    throw error;
  }
};

/**
 * Bulk assign students to a group
 * Handles adding new students and updates existing assignments
 */
export const bulkAssignStudentsToGroup = async (
  input: AssignStudentsInput
): Promise<{ added: number; updated: number; failed: number; errors: string[] }> => {
  try {
    const MAX_GROUP_MEMBERS = 3;

    // Verify group exists
    const group = await prisma.groupPfe.findUnique({
      where: { id: input.groupId },
      include: {
        groupMembers: {
          select: { etudiantId: true },
        },
      },
    });

    if (!group) {
      throw new Error("Group not found");
    }

    // Get existing member IDs
    const existingMemberIds = new Set(group.groupMembers.map((m) => m.etudiantId));
    const currentMembersCount = group.groupMembers.length;

    if (currentMembersCount >= MAX_GROUP_MEMBERS) {
      throw new Error(`Group already reached the maximum of ${MAX_GROUP_MEMBERS} members`);
    }

    if (currentMembersCount + input.studentIds.length > MAX_GROUP_MEMBERS) {
      throw new Error(`A PFE group can contain at most ${MAX_GROUP_MEMBERS} students`);
    }

    // Separate new and existing assignments
    const newStudentIds = input.studentIds.filter((id) => !existingMemberIds.has(id));
    const existingStudentIds = input.studentIds.filter((id) => existingMemberIds.has(id));

    const errors: string[] = [];
    let added = 0;
    let updated = 0;
    let failed = 0;

    // Verify all students exist
    const students = await prisma.etudiant.findMany({
      where: { id: { in: input.studentIds } },
      select: { id: true },
    });

    const validStudentIds = new Set(students.map((s) => s.id));
    const invalidStudentIds = input.studentIds.filter((id) => !validStudentIds.has(id));

    if (invalidStudentIds.length > 0) {
      errors.push(
        `Invalid student IDs not found: ${invalidStudentIds.join(", ")}`
      );
      failed += invalidStudentIds.length;
    }

    // Create new assignments
    if (newStudentIds.length > 0) {
      try {
        await prisma.groupMember.createMany({
          data: newStudentIds.map((studentId) => ({
            groupId: input.groupId,
            etudiantId: studentId,
            role: "membre" as const,
          })),
          skipDuplicates: true,
        });
        added = newStudentIds.length;
      } catch (error) {
        logger.error("Error creating group members:", error);
        errors.push("Failed to add students to group");
        failed += newStudentIds.length;
      }
    }

    // Existing assignments stay unchanged (no need to update)
    updated = existingStudentIds.length;

    logger.info(
      `Bulk assigned students to group ${input.groupId}: ${added} added, ${updated} already assigned`
    );

    return {
      added,
      updated,
      failed,
      errors,
    };
  } catch (error) {
    logger.error("Error bulk assigning students:", error);
    throw error;
  }
};

/**
 * Remove a student from a group
 */
export const removeStudentFromGroup = async (
  groupId: number,
  studentId: number
): Promise<void> => {
  try {
    await prisma.groupMember.deleteMany({
      where: {
        groupId,
        etudiantId: studentId,
      },
    });

    logger.info(`Student ${studentId} removed from group ${groupId}`);
  } catch (error) {
    logger.error("Error removing student from group:", error);
    throw error;
  }
};

/**
 * Set a student as group leader
 */
export const setGroupLeader = async (
  groupId: number,
  studentId: number
): Promise<void> => {
  try {
    // First, remove leader role from all members
    await prisma.groupMember.updateMany(
      {
        where: { groupId },
        data: { role: "membre" },
      }
    );

    // Then set the new leader
    await prisma.groupMember.update({
      where: {
        groupId_etudiantId: {
          groupId,
          etudiantId: studentId,
        },
      },
      data: { role: "chef_groupe" },
    });

    logger.info(`Student ${studentId} set as leader of group ${groupId}`);
  } catch (error) {
    logger.error("Error setting group leader:", error);
    throw error;
  }
};

/**
 * Get group info with assigned teacher details
 */
export const getGroupWithTeacher = async (groupId: number) => {
  try {
    const group = await prisma.groupPfe.findUnique({
      where: { id: groupId },
      include: {
        sujetFinal: {
          include: {
            enseignant: {
              include: {
                user: true,
              },
            },
          },
        },
        coEncadrant: {
          include: {
            user: true,
          },
        },
        groupMembers: {
          include: {
            etudiant: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new Error("Group not found");
    }

    return {
      id: group.id,
      nom: group.nom_ar || group.nom_en || `Groupe ${group.id}`,
      nom_ar: group.nom_ar,
      nom_en: group.nom_en,
      sujet: group.sujetFinal
        ? {
            id: group.sujetFinal.id,
            titre_ar: group.sujetFinal.titre_ar,
            titre_en: group.sujetFinal.titre_en,
            enseignant: group.sujetFinal.enseignant
              ? {
                  id: group.sujetFinal.enseignant.id,
                  email: group.sujetFinal.enseignant.user.email,
                  nom: group.sujetFinal.enseignant.user.nom,
                  prenom: group.sujetFinal.enseignant.user.prenom,
                }
              : null,
          }
        : null,
      coEncadrant: group.coEncadrant
        ? {
            id: group.coEncadrant.id,
            email: group.coEncadrant.user.email,
            nom: group.coEncadrant.user.nom,
            prenom: group.coEncadrant.user.prenom,
          }
        : null,
      students: group.groupMembers.map((member) => ({
        id: member.etudiant.id,
        userId: member.etudiant.userId,
        email: member.etudiant.user.email,
        nom: member.etudiant.user.nom,
        prenom: member.etudiant.user.prenom,
        role: member.role,
      })),
      dateSoutenance: group.dateSoutenance,
      lieu: group.salleSoutenance,
      note: group.note,
    };
  } catch (error) {
    logger.error("Error fetching group with teacher:", error);
    throw error;
  }
};
