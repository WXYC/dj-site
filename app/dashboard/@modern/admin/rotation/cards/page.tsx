import { redirect } from "next/navigation";

// The cards screen now lives inside the rotation shelf; old links land there.
export default function RotationCardsRedirect(): never {
  redirect("/dashboard/admin/rotation?view=cards");
}
