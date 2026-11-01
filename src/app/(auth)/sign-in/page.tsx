import { Button } from "../../../components/ui/Button";
import { getSafeRedirectPath } from "../../../lib/auth/redirect";
import { beginGoogleSignIn } from "./actions";

type SignInPageProps = {
  searchParams: Promise<{ error?: string; next?: string; notice?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const errorMessage =
    params.error === "oauth" || params.error === "exchange"
      ? "Google sign-in could not be completed. Please try again."
      : params.error === "session"
        ? "Your session could not be verified. Please sign in again."
        : null;

  return (
    <main className="flex min-h-dvh items-center justify-center px-page py-12">
      <section className="w-full max-w-content rounded-xl border border-border bg-surface-1 p-6 text-center shadow-float sm:p-10">
        <p className="font-display text-h1 font-bold tracking-display text-primary">
          Apexoria
        </p>
        <p className="mt-3 text-sm text-secondary">
          Your daily content, already written.
        </p>
        <form action={beginGoogleSignIn} className="mt-8">
          <input
            type="hidden"
            name="next"
            value={getSafeRedirectPath(params.next)}
          />
          <Button className="w-full" type="submit">
            Continue with Google
          </Button>
        </form>
        {errorMessage ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <p className="mt-5 text-caption text-tertiary">
          Access is by invitation only.
        </p>
      </section>
    </main>
  );
}
