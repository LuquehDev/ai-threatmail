// "use server";

// // import { auth } from "@/auth";
// import { prisma } from "@/lib/prisma";
// import { classifyEmail } from "@/lib/ml/classifyEmail";

// function toVerdictLabel(label: string) {
//   if (label === "LEGITIMO") return "LEGITIMO";
//   if (label === "SPAM") return "SPAM";
//   return "MALWARE";
// }

// export async function createAnalysis(input: {
//   title: string;
//   subject: string;
//   body: string;
// }) {
//   const session = await auth();
//   if (!session?.user?.id) throw new Error("Unauthorized");

//   // 1) cria Analysis em PENDING
//   const analysis = await prisma.analysis.create({
//     data: {
//       userId: session.user.id,
//       status: "PENDING",
//     },
//     select: { id: true },
//   });

//   // 2) corre perceptron (sincrono e rápido)
//   const r = classifyEmail(input.subject, input.body);

//   // 3) guarda resultados e marca como COMPLETED (por agora)
//   await prisma.analysis.update({
//     where: { id: analysis.id },
//     data: {
//       status: "COMPLETED",
//       perceptronLabel: toVerdictLabel(r.label),
//       perceptronScore: r.score,
//       perceptronEvidence: r.evidences,
//       finalLabel: toVerdictLabel(r.label),
//       finalScore: r.score,
//       completedAt: new Date(),
//     },
//   });

//   return { analysisId: analysis.id };
// }
