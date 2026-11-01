import { FormSubmitButton } from "../../../components/ui/FormSubmitButton";
import { getSafeRedirectPath } from "../../../lib/auth/redirect";
import { SignInSearchSchema } from "../../../lib/schemas/auth-search";
import { beginGoogleSignIn } from "./actions";

type SignInPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = SignInSearchSchema.parse(await searchParams);
  const errorMessage =
    params.error === "oauth" || params.error === "exchange"
      ? "Google sign-in could not be completed. Please try again."
      : params.error === "session"
        ? "Your session could not be verified. Please sign in again."
        : null;

  return (
    <main className="flex min-h-dvh items-center justify-center px-page py-12">
      <section className="w-full max-w-content text-center">
        <h1 className="font-display text-display font-bold tracking-display text-primary">
          Apexoria
        </h1>
        <p className="mt-3 text-sm text-secondary">
          Your daily content, already written.
        </p>
        <form action={beginGoogleSignIn} className="mt-8">
          <input
            type="hidden"
            name="next"
            value={getSafeRedirectPath(params.next)}
          />
          <FormSubmitButton className="w-full">
            Continue with Google
          </FormSubmitButton>
        </form>
        {errorMessage ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {params.notice === "signed-out" || params.notice === "local-signout" ? (
          <p className="mt-4 text-sm text-secondary" role="status">
            {params.notice === "signed-out"
              ? "You've signed out."
              : "You've signed out on this device. The remote session could not be revoked."}
          </p>
        ) : null}
        <p className="mt-5 text-caption text-secondary">
          Access is by invitation only.
        </p>
      </section>
    </main>
  );
}
