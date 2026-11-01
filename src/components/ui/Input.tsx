"use client";

import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "@/lib/utils/cx";
import { Icon } from "./Icon";

const MAX_TEXTAREA_LINES = 8;

type FieldChrome = {
  label: string;
  helper?: ReactNode;
  error?: string;
};

const controlClasses = (invalid: boolean) =>
  cx(
    "w-full rounded-md border bg-surface-sunken px-4 text-body text-primary placeholder:text-tertiary",
    "transition-colors duration-(--motion-fast) ease-standard",
    "focus-visible:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    "disabled:opacity-40",
    invalid ? "border-danger" : "border-border",
  );

function Field({
  id,
  label,
  helper,
  error,
  children,
}: FieldChrome & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-eyebrow font-semibold tracking-eyebrow text-secondary uppercase"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          className="flex items-center gap-1 text-caption text-danger"
        >
          <Icon name="alert" size="chip" />
          {error}
        </p>
      ) : helper ? (
        <p id={`${id}-helper`} className="text-caption text-secondary">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, { helper, error }: FieldChrome) {
  return error ? `${id}-error` : helper ? `${id}-helper` : undefined;
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> &
  FieldChrome & { id?: string };

// 48px min height and 16px text prevent iOS zoom (DESIGN.md §6.4).
export function Input({
  label,
  helper,
  error,
  id: idProp,
  className,
  ...props
}: InputProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;

  return (
    <Field id={id} label={label} helper={helper} error={error}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { label, helper, error })}
        className={cx(controlClasses(Boolean(error)), "min-h-12", className)}
        {...props}
      />
    </Field>
  );
}

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> &
  FieldChrome & { id?: string };

// Auto-grows to eight lines, then scrolls.
export function Textarea({
  label,
  helper,
  error,
  id: idProp,
  className,
  onInput,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const style = window.getComputedStyle(element);
    const chrome =
      Number.parseFloat(style.paddingTop) +
      Number.parseFloat(style.paddingBottom) +
      Number.parseFloat(style.borderTopWidth) +
      Number.parseFloat(style.borderBottomWidth);
    const maxHeight =
      Number.parseFloat(style.lineHeight) * MAX_TEXTAREA_LINES + chrome;

    element.style.height = "auto";
    const nextHeight = Math.min(element.scrollHeight + chrome, maxHeight);
    element.style.height = `${nextHeight}px`;
    element.style.overflowY =
      element.scrollHeight + chrome > maxHeight ? "auto" : "hidden";
  }, []);

  useLayoutEffect(resize, [resize, props.value]);

  return (
    <Field id={id} label={label} helper={helper} error={error}>
      <textarea
        ref={ref}
        id={id}
        rows={2}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { label, helper, error })}
        className={cx(
          controlClasses(Boolean(error)),
          "min-h-12 resize-none py-3",
          className,
        )}
        onInput={(event) => {
          resize();
          onInput?.(event);
        }}
        {...props}
      />
    </Field>
  );
}
