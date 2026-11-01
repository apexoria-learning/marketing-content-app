"use client";

import { useEffect } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { ErrorState } from "@/components/feedback/States";
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Workspace load failed.", { digest: error.digest });
  }, [error]);
  return (
    <>
      <PageHeader title="Content unavailable" back />
      <ErrorState
        statement="This content couldn't load."
        guidance="Nothing was changed. Check your connection and try again."
        onRetry={reset}
      />
    </>
  );
}
