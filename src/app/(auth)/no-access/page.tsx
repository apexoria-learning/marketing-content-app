import { Button } from "../../../components/ui/Button";
import { signOut } from "../../../server/auth/actions";

type NoAccessPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NoAccessPage({
  searchParams,
}: NoAccessPageProps) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-page py-12">
      <section className="w-full max-w-content rounded-xl border border-border bg-surface-1 p-6 text-center shadow-float sm:p-10">
        <span aria-hidden="true" className="text-3xl text-secondary">
          &#128274;
        </span>
        <h1 className="mt-5 font-display text-h1 font-bold tracking-display text-primary">
          This account doesn&apos;t have access yet.
        </h1>
        <p className="mt-3 text-sm text-secondary">
          Contact your workspace administrator to request an invitation.
        </p>
        {error === "signout" ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            Sign-out could not be completed. Please try again.
          </p>
        ) : null}
        <form action={signOut} className="mt-8">
          <Button className="w-full" type="submit" variant="secondary">
            Sign out and use another account
          </Button>
        </form>
      </section>
    </main>
  );
}
