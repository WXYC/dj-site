import { isPasswordReset } from "@/lib/features/authentication/types";
import { getServerSideProps } from "@/lib/features/authentication/session";
import WXYCPage from "@/src/Layout/WXYCPage";

export default async function ModernLoginLayout({
  normal,
  reset,
}: {
  normal: React.ReactNode;
  reset: React.ReactNode;
}) {
  const serverSideProps = await getServerSideProps();

  return (
    <WXYCPage title="Login">
      {serverSideProps.authentication && isPasswordReset(serverSideProps.authentication) ? reset : normal}
    </WXYCPage>
  );
}
