import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || password.length < 6) {
    return NextResponse.json({ error: "Email/password inválidos" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "Email já existe" }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: { email, password: hash },
  });

  return NextResponse.json({ ok: true });
}
