export function getLmlBaseUrl(): string {
  return process.env.NEXT_PUBLIC_LML_URL || "http://localhost:8000";
}
