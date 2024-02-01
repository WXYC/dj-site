'use client';

import { getter } from "@/lib/services";
import { useEffect } from "react";
import { toast } from "sonner";

export default function VerifyPage() {

  useEffect(() => {
    console.log("mounted");

    const process = async (e: KeyboardEvent) => {
      if ((e as KeyboardEvent).key === 'v') {
        const { data, error } = await getter('testAuth')();
        
        if (error) {
          console.error(error);
          toast.error(error.message);
        } else {
          console.table(data);
        }
      }
    }

    window.addEventListener('keydown', process);

    return () => {
      console.log('Verify page unmounted');
      window.removeEventListener('keydown', process);
    }
  }, []);

  return (
    <>
      <h1>Verify page</h1>
      <p>
        This page is intended to verify that Redux state is persisted across
        page navigations.
      </p>
    </>
  );
}