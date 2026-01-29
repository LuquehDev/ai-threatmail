import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { streamGroqText } from "@/lib/ai/groq-stream";
import { resolveGroqModel } from "@/lib/ai/groq";
import { classifyEmail } from "@/lib/ml/classifyEmail";
import { combineVerdict } from "@/lib/ml/final-veredict";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await Promise.resolve(ctx.params);

  // AUTH
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "Utilizador inválido" }, { status: 401 });

  // ANALYSIS
  const analysis = await prisma.analysis.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      status: true,
      emailTitle: true,
      emailSubject: true,
      emailBody: true,
      aiResponse: true,
    },
  });
  if (!analysis) return NextResponse.json({ error: "Análise não encontrada" }, { status: 404 });

  // SETTINGS (schema real: groqModel)
  const settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: { groqModel: true },
  });
  if (!settings) return NextResponse.json({ error: "Configuração não encontrada" }, { status: 400 });

  // REPLAY
  if (analysis.status === "COMPLETED" && analysis.aiResponse) {
    const enc = new TextEncoder();
    const text = analysis.aiResponse ?? "";

    return new NextResponse(
      new ReadableStream({
        start(controller) {
          controller.enqueue(enc.encode(text));
          controller.close();
        },
      }),
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  // bloquear streams duplicados
  if (analysis.status === "SCANNING") {
    return NextResponse.json({ error: "Análise já em execução" }, { status: 409 });
  }

  // marcar SCANNING
  await prisma.analysis.update({
    where: { id: analysis.id },
    data: { status: "SCANNING", aiResponse: null },
  });

  // 1) PERCEPTRON
  const textToClassify = [analysis.emailTitle, analysis.emailSubject, analysis.emailBody].join("\n\n");
  const p = await classifyEmail(textToClassify);

  await prisma.analysis.update({
    where: { id: analysis.id },
    data: {
      perceptronLabel: p.label,
      perceptronScore: p.score,
      perceptronEvidence: p.evidence,
    },
  });

  // 2) MALWARE placeholder
  const malwareHits = 0;

  const { finalLabel, finalScore } = combineVerdict({
    perceptronLabel: p.label,
    perceptronScore: p.score,
    malwareHits,
  });

  // 3) GROQ (2 modelos via enum groqModel)
  const model = resolveGroqModel(settings.groqModel);

  const system = `
És um analista de cibersegurança.
Responde exclusivamente em português de Portugal.
Não faças perguntas.

Tens de produzir:
- Veredito final (Legítimo | Spam | Malware)
- Score de risco final (0-100)
- Evidências (bullets)
- Medidas de mitigação (passos)
Tom humano e claro.
`.trim();

  const userPrompt = `
EMAIL SUBMETIDO:
TÍTULO: ${analysis.emailTitle}
ASSUNTO: ${analysis.emailSubject}

CORPO:
${analysis.emailBody}

RESULTADO DO PERCEPTRON (para referência):
- label: ${p.label}
- score: ${p.score}/100
- evidências:
${(p.evidence ?? []).map((e: string) => `  - ${e}`).join("\n")}

SINAL MALWARE (anexos):
- deteções: ${malwareHits}

VEREDITO/Score calculado pelo sistema (prévio):
- finalLabel: ${finalLabel}
- finalScore: ${finalScore}/100

Agora escreve a explicação final para o utilizador, mantendo estes valores.
`.trim();

  // 4) STREAM GROQ + guardar no DB
  const upstream = await streamGroqText({ model, system, user: userPrompt });

  const dec = new TextDecoder();
  let fullResponse = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          fullResponse += dec.decode(value, { stream: true });
          controller.enqueue(value);
        }

        await prisma.analysis.update({
          where: { id: analysis.id },
          data: {
            status: "COMPLETED",
            aiResponse: fullResponse,
            finalLabel,
            finalScore,
            completedAt: new Date(),
          },
        });

        controller.close();
      } catch (err) {
        await prisma.analysis.update({
          where: { id: analysis.id },
          data: { status: "FAILED" },
        });

        controller.error(err);
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
