import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/utils/cx";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-on hover:bg-accent-hover",
  secondary: "border border-border bg-surface-2 text-primary",
  ghost: "text-secondary hover:bg-surface-2",
  danger: "bg-danger-muted text-danger",
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex min-h-11 items-center justify-center rounded-pill px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
