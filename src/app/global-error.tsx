"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-canvas px-page py-12 text-primary">
        <main className="mx-auto max-w-content">
          <h1 className="font-display text-h1 font-semibold">
            Something went wrong
          </h1>
          <p className="mt-3 text-body text-secondary">
            Something went wrong on our side. Please try again.
          </p>
          <button
            className="mt-6 min-h-11 rounded-pill bg-accent px-6 font-semibold text-accent-on focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => reset()}
            type="button"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
