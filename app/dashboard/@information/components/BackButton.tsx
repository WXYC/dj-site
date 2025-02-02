"use client";

import { ModalClose } from "@mui/joy";
import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();

  return <ModalClose variant="solid" onClick={() => router.back()} />;
}
