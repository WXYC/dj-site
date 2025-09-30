import { getServerSideProps } from "@/lib/features/authentication/session";
import AuthBackButton from "@/src/components/modern/login/Forms/AuthBackButton";
import NewUserForm from "@/src/components/modern/login/Forms/NewUserForm";
import HoldOnQuotes from "@/src/components/modern/login/Quotes/HoldOn";

export default async function NewUserPage() {
  const serverSideProps = await getServerSideProps();
  const user = serverSideProps.authentication?.user;
  
  return (
    <>
      <AuthBackButton text="Login with a different account" />
      <HoldOnQuotes />
      <NewUserForm 
        username={user?.username || ""} 
        requiredAttributes={["realName", "djName"]} 
      />
    </>
  );
}
