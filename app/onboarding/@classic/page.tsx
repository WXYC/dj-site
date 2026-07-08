import { getServerSession } from "@/lib/features/authentication/server-utils";
import { redirect } from "next/navigation";
import Header from "@/src/components/experiences/classic/login/Layout/Header";
import OnboardingForm from "@/src/components/experiences/modern/login/Forms/OnboardingForm";

type ClassicOnboardingPageProps = {
  searchParams: Promise<{ token?: string; error?: string }>;
};

export default async function ClassicOnboardingPage({ searchParams }: ClassicOnboardingPageProps) {
  const { token } = await searchParams;
  const session = await getServerSession();
  if (!session && !token) {
    redirect("/login");
  }

  const username =
    session?.user.username ||
    session?.user.name ||
    session?.user.email?.split("@")[0] ||
    "";

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <Header />
      <OnboardingForm
        username={username}
        realName={session?.user.realName || undefined}
        djName={session?.user.djName || undefined}
      />
      <footer>
        <p>Copyright &copy; {new Date().getFullYear()} WXYC Chapel Hill</p>
      </footer>
    </div>
  );
}
