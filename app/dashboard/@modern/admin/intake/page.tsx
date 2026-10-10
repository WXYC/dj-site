import { redirect } from "next/navigation";

// The music directors' lanes moved to the Reviews page's second tab, which runs
// the flag and role gates; a refusal there is the refusal the person gets.
export default async function IntakePage(): Promise<never> {
  redirect("/dashboard/reviews/music-directors");
}
