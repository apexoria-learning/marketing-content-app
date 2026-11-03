import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/utils/cx";

type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "id"
> & {
  label: string;
  helper?: ReactNode;
};

// Native checkbox for settings-style on/off choices (DESIGN.md §6.4). The
// whole row is the 44px target; state is the native tick, never colour alone.
export function Checkbox({
  label,
  helper,
  className,
  ...props
}: CheckboxProps) {
  const id = useId();
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <label
        htmlFor={id}
        className="flex min-h-11 cursor-pointer items-center gap-3 text-body text-primary has-disabled:cursor-not-allowed has-disabled:opacity-40"
      >
        <input
          id={id}
          type="checkbox"
          aria-describedby={helper ? `${id}-helper` : undefined}
          className="size-5 shrink-0 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          {...props}
        />
        {label}
      </label>
      {helper ? (
        <p id={`${id}-helper`} className="pl-8 text-caption text-secondary">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
