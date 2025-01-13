import { getErrorMessage } from "@/utils/get-error-message";
import {
  confirmResetPassword,
  confirmSignIn,
  confirmUserAttribute,
  resetPassword,
  signIn,
  signOut,
  updateUserAttribute,
} from "aws-amplify/auth";
import { redirect } from "next/navigation";
import { Credentials, SigninResponse } from "./models";

export async function handleSignIn(
  prevState: SigninResponse | undefined,
  formData: FormData
): Promise<SigninResponse | undefined> {
  try {
    const { isSignedIn, nextStep } = await signIn({
      username: String(formData.get("username")),
      password: String(formData.get("password")),
    });
    if (nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
      return {
        passwordChallenge: true,
        user: {
          username: String(formData.get("password")),
          password: String(formData.get("password")),
        },
      };
    }
  } catch (error) {
    return { passwordChallenge: false, message: getErrorMessage(error) };
  }

  redirect("/dashboard");
}

export async function handleUpdateData(
  prevState: SigninResponse | undefined,
  formData: FormData
): Promise<SigninResponse | undefined> {
  try {
    let success = true;

    success =
      success &&
      (await handleUpdatePassword(success ? "success" : "error", {
        current: prevState,
        new: String(formData.get("password")),
      }));

    success =
      success &&
      (await handleUpdateUserAttribute(prevState?.message ?? "", {
        attribute: "realname",
        value: String(formData.get("realname")),
      }));

    success =
      success &&
      (await handleUpdateUserAttribute(prevState?.message ?? "", {
        attribute: "djname",
        value: String(formData.get("djname")),
      }));

    if (!success) {
      return { passwordChallenge: false, message: "An error occurred" };
    }
  } catch (error) {
    return { passwordChallenge: false, message: getErrorMessage(error) };
  }

  redirect("/dashboard");
}

export async function handleSignOut() {
  try {
    await signOut();
  } catch (error) {
    console.log(getErrorMessage(error));
  }
  redirect("/login");
}

export async function handleUpdateUserAttribute(
  prevState: string,
  userData: {
    attribute: keyof Credentials;
    value: string | undefined;
  }
): Promise<boolean> {
  if (!userData || !userData.value || userData.value === "") {
    return false;
  }

  try {
    const output = await updateUserAttribute({
      userAttribute: {
        attributeKey: userData.attribute,
        value: String(userData.value),
      },
    });
    return output.nextStep.updateAttributeStep === "DONE";
  } catch (error) {
    console.log(error);
    return false;
  }
}

export async function handleUpdatePassword(
  prevState: "success" | "error" | undefined,
  data: {
    current: SigninResponse | undefined;
    new: string | undefined;
  }
) {
  if (!data.new || data.new === "" || !data.current || !data.current.user) {
    return false;
  }

  if (data.current?.user.password === data.new) {
    return false;
  }

  let result;
  try {
    result = await confirmSignIn({
      challengeResponse: String(data.new),
    });
  } catch (error) {
    console.log(error);
    return false;
  }

  return result.isSignedIn;
}

export async function handleConfirmUserAttribute(
  prevState: "success" | "error" | undefined,
  formData: FormData
) {
  const code = formData.get("code");

  if (!code) {
    return;
  }

  try {
    await confirmUserAttribute({
      userAttributeKey: "email",
      confirmationCode: String(code),
    });
  } catch (error) {
    console.log(error);
    return "error";
  }

  return "success";
}

export async function handleResetPassword(
  prevState: string | undefined,
  formData: FormData
) {
  try {
    await resetPassword({ username: String(formData.get("email")) });
  } catch (error) {
    return getErrorMessage(error);
  }
  redirect("/auth/reset-password/confirm");
}

export async function handleConfirmResetPassword(
  prevState: string | undefined,
  formData: FormData
) {
  try {
    await confirmResetPassword({
      username: String(formData.get("email")),
      confirmationCode: String(formData.get("code")),
      newPassword: String(formData.get("password")),
    });
  } catch (error) {
    return getErrorMessage(error);
  }
  redirect("/auth/login");
}
