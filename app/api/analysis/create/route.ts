import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import crypto from "node:crypto";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 500 * 1024 * 1024;

function sha256FromBytes(bytes: Uint8Array<ArrayBuffer>) {
  return crypto.createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "Utilizador inválido" }, { status: 401 });

  const form = await req.formData();

  const emailTitle = String(form.get("emailTitle") ?? "").trim();
  const emailSubject = String(form.get("emailSubject") ?? "").trim();
  const emailBody = String(form.get("emailBody") ?? "").trim();

  if (!emailTitle || !emailSubject || !emailBody) {
    return NextResponse.json({ error: "Preenche título, assunto e corpo." }, { status: 400 });
  }

  const files = form.getAll("files").filter(Boolean) as File[];
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Máximo de ${MAX_FILES} ficheiros.` }, { status: 400 });
  }

  const prepared: Array<{
    filename: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    content: Uint8Array<ArrayBuffer>;
  }> = [];

  for (const f of files) {
    const sizeBytes = f.size ?? 0;

    if (sizeBytes > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `O ficheiro "${f.name}" excede 500MB.` },
        { status: 400 }
      );
    }

    const ab = (await f.arrayBuffer()) as ArrayBuffer;
    const bytes: Uint8Array<ArrayBuffer> = new Uint8Array<ArrayBuffer>(ab);

    prepared.push({
      filename: f.name || "ficheiro",
      mimeType: f.type || "application/octet-stream",
      sizeBytes,
      sha256: sha256FromBytes(bytes),
      content: bytes,
    });
  }

  const analysis = await prisma.analysis.create({
    data: {
      userId: user.id,
      status: "PENDING",
      emailTitle,
      emailSubject,
      emailBody,
      files: prepared.length
        ? {
            create: prepared.map((p) => ({
              filename: p.filename,
              mimeType: p.mimeType,
              sizeBytes: p.sizeBytes,
              sha256: p.sha256,
              content: p.content,
              scanStatus: "PENDING",
            })),
          }
        : undefined,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, analysisId: analysis.id });
}
