import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingWizard } from "@/app/(auth)/onboarding/components/onboarding-wizard";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) redirect("/login");

  const already = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (already) redirect("/dashboard");

  return <OnboardingWizard />;
}
