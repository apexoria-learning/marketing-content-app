"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./Button";

export function FormSubmitButton(
  props: Omit<Parameters<typeof Button>[0], "loading" | "type">,
) {
  const { pending } = useFormStatus();

  return <Button {...props} loading={pending} type="submit" />;
}
