import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { FormSubmitButton } from "../../components/ui/FormSubmitButton";
import { getAuthorizedUser } from "../../server/auth";
import { signOut } from "../../server/auth/actions";

export default async function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const authorization = await getAuthorizedUser();

  if (!authorization.ok) {
    if (authorization.code === "FORBIDDEN") {
      redirect("/no-access");
    }

    redirect(
      authorization.code === "UNEXPECTED"
        ? "/sign-in?error=session"
        : "/sign-in",
    );
  }

  return (
    <>
      <header className="mx-auto flex w-full max-w-content items-center justify-between px-page pt-4">
        <p className="max-w-[65%] truncate text-caption text-secondary">
          {authorization.user.email}
        </p>
        <form action={signOut}>
          <FormSubmitButton className="px-4" variant="ghost">
            Sign out
          </FormSubmitButton>
        </form>
      </header>
      {children}
    </>
  );
}
