import { FormSubmitButton } from "../../../components/ui/FormSubmitButton";
import { Icon } from "../../../components/ui/Icon";
import { signOut } from "../../../server/auth/actions";
import { NoAccessSearchSchema } from "../../../lib/schemas/auth-search";

type NoAccessPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NoAccessPage({
  searchParams,
}: NoAccessPageProps) {
  const { error } = NoAccessSearchSchema.parse(await searchParams);

  return (
    <main className="flex min-h-dvh items-center justify-center px-page py-12">
      <section className="w-full max-w-content text-center">
        <Icon name="lock" size="empty" className="mx-auto text-secondary" />
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
          <FormSubmitButton className="w-full" variant="secondary">
            Sign out and use another account
          </FormSubmitButton>
        </form>
      </section>
    </main>
  );
}
