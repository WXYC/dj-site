import { redirect } from "next/navigation";

// The thresholds screen now lives inside the rotation shelf; old links land there.
export default function RotationThresholdsRedirect(): never {
  redirect("/dashboard/admin/rotation?windows=1");
}
