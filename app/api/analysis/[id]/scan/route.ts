import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scanWithVirusTotal, scanWithMetaDefender } from "@/lib/malware/providers";

type Params = { id: string };

function toProvider(x: unknown): "virustotal" | "metadefender" {
  return x === "metadefender" ? "metadefender" : "virustotal";
}

function clampScore(x: number) {
  return Math.max(0, Math.min(100, Math.round(x)));
}

function extractEvidence(provider: "virustotal" | "metadefender", raw: any): string[] {
  try {
    if (provider === "virustotal") {
      const stats = raw?.data?.attributes?.last_analysis_stats;
      if (stats) {
        const malicious = Number(stats?.malicious ?? 0);
        const suspicious = Number(stats?.suspicious ?? 0);
        const harmless = Number(stats?.harmless ?? 0);
        const undetected = Number(stats?.undetected ?? 0);
        return [
          `VirusTotal: malicious=${malicious}, suspicious=${suspicious}, harmless=${harmless}, undetected=${undetected}`,
        ];
      }
      return ["VirusTotal: relatório recebido."];
    }

    const overall =
      raw?.scan_results?.scan_all_result_a ??
      raw?.scan_results?.scan_all_result_i ??
      raw?.scan_results?.scan_all_result ??
      null;

    if (overall) return [`MetaDefender: resultado global="${String(overall)}"`];
    return ["MetaDefender: relatório recebido."];
  } catch {
    return [];
  }
}

export async function POST(_req: Request, ctx: { params: Promise<Params> | Params }) {
  const { id } = await Promise.resolve(ctx.params);

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

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
          scanProvider: true,
          scanScore: true,
          scanEvidence: true,
          scanReport: true,
        },
      },
    },
  });

  if (!analysis) return NextResponse.json({ error: "Análise não encontrada" }, { status: 404 });

  const settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: { malwareProvider: true },
  });

  const provider = toProvider(settings?.malwareProvider);

  await prisma.analysis.update({
    where: { id: analysis.id },
    data: { status: "SCANNING", malwareProvider: provider },
  });

  const results: Array<{
    fileId: string;
    filename: string;
    provider: "virustotal" | "metadefender";
    status: "COMPLETED" | "FAILED";
    score: number | null;
    verdict: "CLEAN" | "MALWARE" | "UNKNOWN";
  }> = [];

  let maxScore = 0;
  const allEvidence: string[] = [];
  const allReports: any[] = [];

  for (const f of analysis.files) {
    if (f.scanStatus === "COMPLETED" && f.scanProvider === provider) {
      const score = f.scanScore ?? 0;
      maxScore = Math.max(maxScore, score);
      if (Array.isArray(f.scanEvidence)) allEvidence.push(...(f.scanEvidence as any));
      if (f.scanReport) allReports.push({ fileId: f.id, filename: f.filename, report: f.scanReport });

      results.push({
        fileId: f.id,
        filename: f.filename,
        provider,
        status: "COMPLETED",
        score,
        verdict: score >= 70 ? "MALWARE" : "CLEAN",
      });
      continue;
    }

    await prisma.analysisFile.update({
      where: { id: f.id },
      data: { scanStatus: "SCANNING", scanProvider: provider },
    });

    try {
      const r =
        provider === "metadefender"
          ? await scanWithMetaDefender({
              sha256: f.sha256,
              filename: f.filename,
              content: Buffer.from(f.content),
            })
          : await scanWithVirusTotal({
              sha256: f.sha256,
              filename: f.filename,
              content: Buffer.from(f.content),
              sizeBytes: f.sizeBytes,
            });

      const score = clampScore(r.score ?? 0);
      const verdict = score >= 70 ? "MALWARE" : "CLEAN";
      const evidence = extractEvidence(provider, r.raw);

      await prisma.analysisFile.update({
        where: { id: f.id },
        data: {
          scanStatus: r.status === "COMPLETED" ? "COMPLETED" : "FAILED",
          scanProvider: provider,
          scanScore: score,
          scanEvidence: evidence,
          scanReport: r.raw ?? (r.error ? { error: r.error } : null),
        },
      });

      maxScore = Math.max(maxScore, score);
      allEvidence.push(...evidence);
      if (r.raw) allReports.push({ fileId: f.id, filename: f.filename, report: r.raw });

      results.push({
        fileId: f.id,
        filename: f.filename,
        provider,
        status: r.status === "COMPLETED" ? "COMPLETED" : "FAILED",
        score,
        verdict: r.status === "COMPLETED" ? verdict : "UNKNOWN",
      });
    } catch (e: any) {
      const errMsg = String(e?.message ?? "Erro desconhecido");

      await prisma.analysisFile.update({
        where: { id: f.id },
        data: {
          scanStatus: "FAILED",
          scanProvider: provider,
          scanScore: null,
          scanEvidence: [`Erro no scan: ${errMsg}`],
          scanReport: { error: errMsg },
        },
      });

      allEvidence.push(`Erro no scan (${f.filename}): ${errMsg}`);

      results.push({
        fileId: f.id,
        filename: f.filename,
        provider,
        status: "FAILED",
        score: null,
        verdict: "UNKNOWN",
      });
    }
  }

  await prisma.analysis.update({
    where: { id: analysis.id },
    data: {
      malwareProvider: provider,
      malwareScore: clampScore(maxScore),
      malwareEvidence: allEvidence,
      malwareReport: { provider, files: allReports },
    },
  });

  return NextResponse.json({ ok: true, provider, results });
}
