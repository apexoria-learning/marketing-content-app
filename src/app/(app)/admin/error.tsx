"use client";

import { useEffect } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { ErrorState } from "@/components/feedback/States";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin panel load failed.", { digest: error.digest });
  }, [error]);
  return (
    <>
      <PageHeader title="Admin" back />
      <ErrorState
        statement="Admin data couldn't load."
        guidance="Nothing was changed. Check your connection and try again."
        onRetry={reset}
      />
    </>
  );
}
