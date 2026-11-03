import "server-only";
import { notFound, redirect } from "next/navigation";
import { getAuthorizedUser, toAdminActor, type AdminActor } from ".";

/**
 * Gate for every admin page and data loader. Members get a 404 so the panel's
 * existence is not advertised; layouts do not re-run on client navigation,
 * so each page calls this itself.
 */
export async function requireAdminPage(): Promise<AdminActor> {
  const authorization = await getAuthorizedUser();

  if (!authorization.ok) {
    if (authorization.code === "FORBIDDEN") redirect("/no-access");
    redirect(
      authorization.code === "UNEXPECTED"
        ? "/sign-in?error=session"
        : "/sign-in",
    );
  }

  const admin = toAdminActor(authorization.user);
  if (!admin) notFound();
  return admin;
}
