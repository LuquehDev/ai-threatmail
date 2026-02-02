import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { streamGroqText } from "@/lib/ai/groq-stream";
import { resolveGroqModel } from "@/lib/ai/groq";
import { classifyEmailText } from "@/lib/ml/classifyEmail";
import { combineVerdict } from "@/lib/ml/final-veredict";
import type { VerdictLabel } from "@prisma/client";
import {
  scanWithVirusTotal,
  scanWithMetaDefender,
} from "@/lib/malware/providers";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } },
) {
  const { id } = await Promise.resolve(ctx.params);

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email)
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user)
    return NextResponse.json({ error: "Utilizador inválido" }, { status: 401 });

  const analysis = await prisma.analysis.findFirst({
    where: { id, userId: user.id },
    include: {
      files: {
        select: {
          id: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          sha256: true,
          content: true,
          scanStatus: true,
        },
      },
    },
  });
  if (!analysis)
    return NextResponse.json(
      { error: "Análise não encontrada" },
      { status: 404 },
    );

  const settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: { groqModel: true, malwareProvider: true },
  });
  if (!settings)
    return NextResponse.json(
      { error: "Configuração não encontrada" },
      { status: 400 },
    );

  // replay
  if (analysis.status === "COMPLETED" && analysis.aiResponse) {
    const enc = new TextEncoder();
    return new NextResponse(
      new ReadableStream({
        start(controller) {
          controller.enqueue(enc.encode(analysis.aiResponse ?? ""));
          controller.close();
        },
      }),
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  // já a correr
  if (analysis.status === "SCANNING") {
    const enc = new TextEncoder();
    const partial = analysis.aiResponse ?? "";
    return new NextResponse(
      new ReadableStream({
        start(controller) {
          controller.enqueue(enc.encode(partial));
          controller.close();
        },
      }),
      {
        status: 200, // <- OPÇÃO A: era 409
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  await prisma.analysis.update({
    where: { id: analysis.id },
    data: { status: "SCANNING", aiResponse: "" },
  });

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullResponse = "";
      let lastPersist = Date.now();

      const push = async (text: string) => {
        fullResponse += text;
        controller.enqueue(enc.encode(text));

        const now = Date.now();
        if (now - lastPersist >= 1000) {
          lastPersist = now;
          await prisma.analysis.update({
            where: { id: analysis.id },
            data: { aiResponse: fullResponse },
          });
        }
      };

      const fail = async (msg: string) => {
        try {
          await prisma.analysis.update({
            where: { id: analysis.id },
            data: { status: "FAILED", aiResponse: fullResponse || msg },
          });
        } finally {
          controller.enqueue(enc.encode(msg));
          controller.close(); // <- em vez de controller.error(...)
        }
      };

      try {
        await push("Análise iniciada…\n\n");

        // 1) perceptron
        const fullText = [
          analysis.emailTitle,
          analysis.emailSubject,
          analysis.emailBody,
        ].join("\n\n");

        let p: { label: VerdictLabel; score: number; evidence: string[] };
        try {
          const r = classifyEmailText(fullText);
          p = {
            label: r.label as VerdictLabel,
            score: r.score,
            evidence: r.evidence,
          };
        } catch {
          await fail("Falha ao classificar email. Confirma model/model.json.");
          return;
        }

        await prisma.analysis.update({
          where: { id: analysis.id },
          data: {
            perceptronLabel: p.label,
            perceptronScore: p.score,
            perceptronEvidence: p.evidence,
          },
        });

        await push(`Perceptron: ${p.label} (${p.score}/100)\n\n`);

        // 2) malware scan (sem scanResult)
        const provider = (
          settings.malwareProvider ?? "virustotal"
        ).toLowerCase();
        const useVT = provider === "virustotal";
        const useMD = provider === "metadefender";

        let malwareHits = 0;

        if (analysis.files.length) {
          await push(
            `A analisar anexos (${analysis.files.length}) via ${useVT ? "VirusTotal" : useMD ? "MetaDefender" : provider}…\n`,
          );

          for (const f of analysis.files) {
            try {
              await prisma.analysisFile.update({
                where: { id: f.id },
                data: { scanStatus: "SCANNING" },
              });

              await push(`• ${f.filename}… `);

              const buf = Buffer.from(f.content);

              const result = useVT
                ? await scanWithVirusTotal({
                    sha256: f.sha256,
                    filename: f.filename,
                    content: buf,
                    sizeBytes: f.sizeBytes,
                  })
                : await scanWithMetaDefender({
                    sha256: f.sha256,
                    filename: f.filename,
                    content: buf,
                  });

              const score = result.score ?? 0;
              if (score >= 70) malwareHits += 1;

              await prisma.analysisFile.update({
                where: { id: f.id },
                data: {
                  scanStatus:
                    result.status === "COMPLETED" ? "COMPLETED" : "FAILED",
                },
              });

              await push(`ok (${score}/100)\n`);
            } catch {
              await prisma.analysisFile.update({
                where: { id: f.id },
                data: { scanStatus: "FAILED" },
              });
              await push("falhou\n");
            }
          }

          await push("\n");
        } else {
          await push("Sem anexos para analisar.\n\n");
        }

        // 3) combinar veredito
        const { finalLabel, finalScore } = combineVerdict({
          perceptronLabel: p.label,
          perceptronScore: p.score,
          malwareHits,
        });

        // 4) groq streaming
        const model = resolveGroqModel(settings.groqModel);

        const system = `
        És um analista de cibersegurança.
        Responde exclusivamente em português de Portugal.
        Não faças perguntas.
              
        Formato obrigatório:
        Veredito Final: <Legítimo|Spam|Malware>
        Score de Risco Final: <0-100>
              
        REGRAS IMPORTANTES:
        - O perceptron e o malware scan são sinais, não são verdade absoluta.
        - Se o perceptron vier com score muito alto mas o conteúdo parecer claramente legítimo (ex.: email corporativo normal, sem urgência, sem pedido de dados, sem links suspeitos),
          então DEVES corrigir o veredito final.
        - Se corrigires, explica porquê nas evidências (ex.: falso positivo do perceptron).
        - Se não corrigires, justifica com sinais concretos do texto.
              
        Evidências:
        - ...
              
        Medidas de Mitigação:
        1. ...
        `.trim();

        const userPrompt = `
        EMAIL SUBMETIDO:
        TÍTULO: ${analysis.emailTitle}
        ASSUNTO: ${analysis.emailSubject}

        CORPO:
        ${analysis.emailBody}

        RESULTADO DO PERCEPTRON:
        - label: ${p.label}
        - score: ${p.score}/100
        - evidências:
        ${(p.evidence ?? []).map((e) => `  - ${e}`).join("\n")}

        ANEXOS:
        - deteções malware: ${malwareHits}

        VEREDITO (pré-calculado):
        - finalLabel: ${finalLabel}
        - finalScore: ${finalScore}/100

        Escreve a explicação final mantendo os valores finalLabel/finalScore.
        Podes AJUSTAR finalLabel/finalScore se houver inconsistência clara com o conteúdo e evidências.
        `.trim();

        const upstream = await streamGroqText({
          model,
          system,
          user: userPrompt,
        });
        const reader = upstream.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunkText = dec.decode(value, { stream: true });
            await push(chunkText);
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
            data: { status: "FAILED", aiResponse: fullResponse },
          });
          controller.error(err);
        } finally {
          reader.releaseLock();
        }
      } catch (e: any) {
        await fail(String(e?.message ?? e));
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
