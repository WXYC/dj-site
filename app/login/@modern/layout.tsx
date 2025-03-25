import { isIncomplete, isPasswordReset } from "@/lib/features/authentication/types";
import { createServerSideProps } from "@/lib/features/session";
import WXYCPage from "@/src/Layout/WXYCPage";

export default async function ModernLoginLayout({
  normal,
  newuser,
  reset,
}: {
  normal: React.ReactNode;
  newuser: React.ReactNode;
  reset: React.ReactNode;
}) {
  const serverSideProps = await createServerSideProps();

  return (
    <WXYCPage title="Login">
      {isPasswordReset(serverSideProps.authentication) ? reset : isIncomplete(serverSideProps.authentication) ? newuser : normal}
    </WXYCPage>
  );
}
