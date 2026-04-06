/// <reference types="node" />

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  const password = await bcrypt.hash("Test@1234", 10);

  // ── Roles & permissions ──────────────────────────────────
  const roleData = [
    { nom: "admin", description: "Administrateur système" },
    { nom: "admin_faculte", description: "Administrateur de faculté" },
    { nom: "chef_departement", description: "Chef de département" },
    { nom: "chef_specialite", description: "Chef de spécialité" },
    { nom: "enseignant", description: "Enseignant" },
    { nom: "etudiant", description: "Étudiant" },
    { nom: "delegue", description: "Délégué de section" },
    { nom: "president_conseil", description: "Président du conseil de discipline" },
  ];

  const roles: Record<string, { id: number; nom: string | null }> = {};
  for (const r of roleData) {
    const role = await prisma.role.upsert({
      where: { id: (await prisma.role.findFirst({ where: { nom: r.nom } }))?.id ?? 0 },
      update: {},
      create: r,
    });
    roles[r.nom] = role;
  }
  console.log("✅ Roles created");

  // ── Permissions ──────────────────────────────────────────
  const permData = [
    { nom: "manage_users", description: "Gérer les utilisateurs", module: "auth", action: "manage" },
    { nom: "manage_pfe", description: "Gérer les PFE", module: "pfe", action: "manage" },
    { nom: "submit_pfe", description: "Soumettre un PFE", module: "pfe", action: "submit" },
    { nom: "view_documents", description: "Consulter les documents", module: "documents", action: "view" },
    { nom: "manage_discipline", description: "Gérer les dossiers disciplinaires", module: "discipline", action: "manage" },
    { nom: "submit_reclamation", description: "Soumettre une réclamation", module: "reclamations", action: "submit" },
    { nom: "manage_annonces", description: "Gérer les annonces", module: "annonces", action: "manage" },
  ];

  for (const p of permData) {
    await prisma.permission.upsert({
      where: { id: (await prisma.permission.findFirst({ where: { nom: p.nom } }))?.id ?? 0 },
      update: {},
      create: p,
    });
  }
  console.log("✅ Permissions created");

  // ── University structure ─────────────────────────────────
  const faculte = await prisma.faculte.create({
    data: {
      nom_ar: "كلية العلوم والتكنولوجيا",
      nom_en: "Faculty of Science and Technology",
    },
  });

  const deptInfo = await prisma.departement.create({
    data: {
      nom_ar: "الإعلام الآلي",
      nom_en: "Computer Science",
      faculteId: faculte.id,
    },
  });

  await prisma.departement.create({
    data: {
      nom_ar: "الفيزياء",
      nom_en: "Physics",
      faculteId: faculte.id,
    },
  });

  const filiereInfo = await prisma.filiere.create({
    data: {
      nom_ar: "شعبة الإعلام الآلي",
      nom_en: "Computer Science Track",
      departementId: deptInfo.id,
      description_ar: "شعبة الإعلام الآلي",
      description_en: "Computer science stream",
    },
  });

  const specISI = await prisma.specialite.create({
    data: {
      nom_ar: "ISI",
      nom_en: "ISI",
      filiereId: filiereInfo.id,
      niveau: "M2",
    },
  });

  await prisma.specialite.create({
    data: {
      nom_ar: "SIC",
      nom_en: "SIC",
      filiereId: filiereInfo.id,
      niveau: "M2",
    },
  });

  const promo2025 = await prisma.promo.create({
    data: {
      nom_ar: "M2 ISI 2024-2025",
      nom_en: "M2 ISI 2024-2025",
      specialiteId: specISI.id,
      anneeUniversitaire: "2024-2025",
      section: "A",
    },
  });

  const promo2025B = await prisma.promo.create({
    data: {
      nom_ar: "M2 ISI 2024-2025",
      nom_en: "M2 ISI 2024-2025",
      specialiteId: specISI.id,
      anneeUniversitaire: "2024-2025",
      section: "B",
    },
  });

  console.log("✅ University structure created (Faculté → Département → Filière → Spécialité → Promo)");

  // ── Grades ───────────────────────────────────────────────
  const gradeMAA = await prisma.grade.create({
    data: {
      nom_ar: "أستاذ مساعد أ",
      nom_en: "Assistant Professor A",
      description_ar: "رتبة أستاذ مساعد أ",
      description_en: "Academic rank: Assistant Professor A",
    },
  });
  const gradeMCA = await prisma.grade.create({
    data: {
      nom_ar: "أستاذ محاضر أ",
      nom_en: "Associate Professor A",
      description_ar: "رتبة أستاذ محاضر أ",
      description_en: "Academic rank: Associate Professor A",
    },
  });
  await prisma.grade.create({
    data: {
      nom_ar: "أستاذ",
      nom_en: "Professor",
      description_ar: "رتبة أستاذ",
      description_en: "Academic rank: Professor",
    },
  });

  console.log("✅ Grades created");

  // ── Helper: create user + assign roles ───────────────────
  async function createUser(data: {
    email: string;
    nom: string;
    prenom: string;
    roleNames: string[];
    emailVerified?: boolean;
    enseignantData?: { gradeId: number };
    etudiantData?: { promoId: number; matricule: string };
  }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          firstUse: false,
          emailVerified: data.emailVerified ?? true,
          status: "active",
        },
      });
      console.log(`  ⏭️  ${data.email} already exists`);
      return existing;
    }

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password,
        nom: data.nom,
        prenom: data.prenom,
        emailVerified: data.emailVerified ?? true,
        firstUse: false,
        ...(data.enseignantData
          ? { enseignant: { create: { gradeId: data.enseignantData.gradeId } } }
          : {}),
        ...(data.etudiantData
          ? { etudiant: { create: { promoId: data.etudiantData.promoId, matricule: data.etudiantData.matricule } } }
          : {}),
      },
    });

    // Assign roles
    for (const roleName of data.roleNames) {
      const role = roles[roleName];
      if (role) {
        await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
      }
    }

    console.log(`  ✅ [${data.roleNames.join(", ")}] ${data.email}`);
    return user;
  }

  // ── Users ────────────────────────────────────────────────
  console.log("\n👤 Creating users (password for all: Test@1234)\n");

  await createUser({
    email: "admin@univ-tiaret.dz",
    nom: "Super",
    prenom: "Admin",
    roleNames: ["admin"],
  });

  await createUser({
    email: "faculty@univ-tiaret.dz",
    nom: "Bouzid",
    prenom: "Karim",
    roleNames: ["admin_faculte"],
  });

  await createUser({
    email: "chef.info@univ-tiaret.dz",
    nom: "Hamdani",
    prenom: "Mohamed",
    roleNames: ["chef_departement"],
  });

  await createUser({
    email: "chef.isi@univ-tiaret.dz",
    nom: "Berkane",
    prenom: "Amina",
    roleNames: ["chef_specialite"],
  });

  await createUser({
    email: "teacher@univ-tiaret.dz",
    nom: "Benali",
    prenom: "Youcef",
    roleNames: ["enseignant"],
    enseignantData: { gradeId: gradeMCA.id },
  });

  await createUser({
    email: "teacher2@univ-tiaret.dz",
    nom: "Mebarki",
    prenom: "Nadia",
    roleNames: ["enseignant"],
    enseignantData: { gradeId: gradeMAA.id },
  });

  await createUser({
    email: "student@univ-tiaret.dz",
    nom: "Bensalem",
    prenom: "Amira",
    roleNames: ["etudiant"],
    etudiantData: { promoId: promo2025.id, matricule: "212131234567" },
  });

  await createUser({
    email: "student2@univ-tiaret.dz",
    nom: "Mehdaoui",
    prenom: "Yacine",
    roleNames: ["etudiant"],
    etudiantData: { promoId: promo2025B.id, matricule: "212131234568" },
  });

  await createUser({
    email: "delegate@univ-tiaret.dz",
    nom: "Djeraba",
    prenom: "Sara",
    roleNames: ["etudiant", "delegue"],
    etudiantData: { promoId: promo2025.id, matricule: "212131234569" },
  });

  await createUser({
    email: "committee@univ-tiaret.dz",
    nom: "Touati",
    prenom: "Rachid",
    roleNames: ["president_conseil"],
  });

  // ── Direct assignments: teachers ↔ promos/modules/groups, students ↔ promo/section/groups ──
  const teacherUser = await prisma.user.findUnique({
    where: { email: "teacher@univ-tiaret.dz" },
    include: { enseignant: true },
  });
  const teacher2User = await prisma.user.findUnique({
    where: { email: "teacher2@univ-tiaret.dz" },
    include: { enseignant: true },
  });
  const studentUser = await prisma.user.findUnique({
    where: { email: "student@univ-tiaret.dz" },
    include: { etudiant: true },
  });
  const student2User = await prisma.user.findUnique({
    where: { email: "student2@univ-tiaret.dz" },
    include: { etudiant: true },
  });
  const delegateUser = await prisma.user.findUnique({
    where: { email: "delegate@univ-tiaret.dz" },
    include: { etudiant: true },
  });

  if (
    !teacherUser?.enseignant?.id ||
    !teacher2User?.enseignant?.id ||
    !studentUser?.etudiant?.id ||
    !student2User?.etudiant?.id ||
    !delegateUser?.etudiant?.id
  ) {
    throw new Error("Missing enseignant/etudiant records required for direct assignments.");
  }

  const moduleAlgo = await prisma.module.upsert({
    where: { code: "ISI-M2-ALGO-ADV" },
    update: {},
    create: {
      nom_ar: "الخوارزميات المتقدمة",
      nom_en: "Advanced Algorithms",
      code: "ISI-M2-ALGO-ADV",
      semestre: 3,
      specialiteId: specISI.id,
      volumeCours: 24,
      volumeTd: 18,
      volumeTp: 0,
      credit: 6,
      coef: 3,
      description_ar: "وحدة تعليمية أساسية لطلبة ماستر 2 ISI",
      description_en: "Core unit for M2 ISI students",
    },
  });

  const moduleCloud = await prisma.module.upsert({
    where: { code: "ISI-M2-CLOUD" },
    update: {},
    create: {
      nom_ar: "الحوسبة السحابية وDevOps",
      nom_en: "Cloud and DevOps",
      code: "ISI-M2-CLOUD",
      semestre: 3,
      specialiteId: specISI.id,
      volumeCours: 20,
      volumeTd: 10,
      volumeTp: 14,
      credit: 5,
      coef: 2,
      description_ar: "البنية السحابية والتكامل المستمر",
      description_en: "Cloud infrastructure and continuous integration",
    },
  });

  const moduleAI = await prisma.module.upsert({
    where: { code: "ISI-M2-AI" },
    update: {},
    create: {
      nom_ar: "الذكاء الاصطناعي التطبيقي",
      nom_en: "Applied AI",
      code: "ISI-M2-AI",
      semestre: 3,
      specialiteId: specISI.id,
      volumeCours: 18,
      volumeTd: 12,
      volumeTp: 12,
      credit: 5,
      coef: 2,
      description_ar: "طرق الذكاء الاصطناعي للتطبيقات المهنية",
      description_en: "AI methods for business applications",
    },
  });

  const ensureEnseignement = async (enseignantId: number, moduleId: number, promoId: number, type: "cours" | "td" | "tp") => {
    const existing = await prisma.enseignement.findFirst({
      where: {
        enseignantId,
        moduleId,
        promoId,
        type,
        anneeUniversitaire: "2024-2025",
      },
    });

    if (existing) return existing;

    return prisma.enseignement.create({
      data: {
        enseignantId,
        moduleId,
        promoId,
        type,
        anneeUniversitaire: "2024-2025",
      },
    });
  };

  await ensureEnseignement(teacherUser.enseignant.id, moduleAlgo.id, promo2025.id, "cours");
  await ensureEnseignement(teacherUser.enseignant.id, moduleCloud.id, promo2025.id, "td");
  await ensureEnseignement(teacher2User.enseignant.id, moduleAI.id, promo2025B.id, "cours");
  await ensureEnseignement(teacher2User.enseignant.id, moduleCloud.id, promo2025B.id, "tp");

  const sujet1 = await prisma.pfeSujet.create({
    data: {
      titre_ar: "منصة ذكية لإدارة الشكاوى",
      titre_en: "Smart Complaint Management Platform",
      description_ar: "تصميم منصة ويب مع مسارات عمل مؤتمتة.",
      description_en: "Design of a web platform with automated workflows.",
      keywords_ar: "شكاوى، منصة، سير عمل",
      keywords_en: "complaints, platform, workflow",
      enseignantId: teacherUser.enseignant.id,
      promoId: promo2025.id,
      workplan_ar: "تحليل المتطلبات ثم تطوير الواجهة الخلفية والأمامية",
      workplan_en: "Requirements analysis followed by backend and frontend implementation",
      bibliographie_ar: "مراجع في نظم إدارة الشكاوى والمنصات الأكاديمية",
      bibliographie_en: "References on complaint management systems and academic platforms",
      typeProjet: "application",
      status: "valide",
      anneeUniversitaire: "2024-2025",
      maxGrps: 2,
    },
  });

  const sujet2 = await prisma.pfeSujet.create({
    data: {
      titre_ar: "تحليل تنبؤي للمخاطر التأديبية",
      titre_en: "Predictive Analysis of Disciplinary Risks",
      description_ar: "نموذج ذكاء اصطناعي للكشف المبكر عن المخاطر الأكاديمية.",
      description_en: "AI model for early detection of academic risks.",
      keywords_ar: "ذكاء اصطناعي، تنبؤ، مخاطر تأديبية",
      keywords_en: "AI, prediction, disciplinary risks",
      enseignantId: teacher2User.enseignant.id,
      promoId: promo2025B.id,
      workplan_ar: "جمع البيانات، تدريب النموذج، ثم تقييم النتائج",
      workplan_en: "Data collection, model training, then evaluation",
      bibliographie_ar: "مراجع في التحليل التنبؤي والذكاء الاصطناعي التعليمي",
      bibliographie_en: "References on predictive analytics and educational AI",
      typeProjet: "recherche",
      status: "valide",
      anneeUniversitaire: "2024-2025",
      maxGrps: 1,
    },
  });

  const groupA = await prisma.groupPfe.create({
    data: {
      nom_ar: "فريق ISI-A1",
      nom_en: "Group ISI-A1",
      sujetFinalId: sujet1.id,
      coEncadrantId: teacher2User.enseignant.id,
      dateCreation: new Date("2024-10-01"),
      dateAffectation: new Date("2024-10-05"),
    },
  });

  const groupB = await prisma.groupPfe.create({
    data: {
      nom_ar: "فريق ISI-B1",
      nom_en: "Group ISI-B1",
      sujetFinalId: sujet2.id,
      coEncadrantId: teacherUser.enseignant.id,
      dateCreation: new Date("2024-10-01"),
      dateAffectation: new Date("2024-10-06"),
    },
  });

  const ensureGroupMember = async (groupId: number, etudiantId: number, role: "chef_groupe" | "membre") => {
    const existing = await prisma.groupMember.findFirst({
      where: { groupId, etudiantId },
    });
    if (existing) return existing;
    return prisma.groupMember.create({
      data: { groupId, etudiantId, role },
    });
  };

  await ensureGroupMember(groupA.id, studentUser.etudiant.id, "membre");
  await ensureGroupMember(groupA.id, delegateUser.etudiant.id, "chef_groupe");
  await ensureGroupMember(groupB.id, student2User.etudiant.id, "chef_groupe");

  const ensureJury = async (groupId: number, enseignantId: number, role: "president" | "examinateur" | "rapporteur") => {
    const existing = await prisma.pfeJury.findFirst({
      where: { groupId, enseignantId, role },
    });
    if (existing) return existing;
    return prisma.pfeJury.create({
      data: { groupId, enseignantId, role },
    });
  };

  await ensureJury(groupA.id, teacherUser.enseignant.id, "president");
  await ensureJury(groupA.id, teacher2User.enseignant.id, "examinateur");
  await ensureJury(groupB.id, teacher2User.enseignant.id, "president");
  await ensureJury(groupB.id, teacherUser.enseignant.id, "rapporteur");

  console.log("✅ Direct assignments created:");
  console.log("   • Teachers assigned to promos/modules (enseignements)");
  console.log("   • Students assigned to promo sections A/B");
  console.log("   • PFE groups created with student members and teacher jury/co-encadrant");

  console.log("\n🎉 Seeding complete!\n");
  console.log("────────────────────────────────────────────");
  console.log("  📧 Login credentials (all accounts):");
  console.log("  Password: Test@1234");
  console.log("");
  console.log("  admin@univ-tiaret.dz       (Admin)");
  console.log("  teacher@univ-tiaret.dz     (Enseignant)");
  console.log("  student@univ-tiaret.dz     (Étudiant)");
  console.log("  chef.info@univ-tiaret.dz   (Chef département)");
  console.log("  delegate@univ-tiaret.dz    (Délégué)");
  console.log("────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
