"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { COPY_CONFIRM_MS } from "@/lib/constants/motion";
import { triggerHaptic } from "@/lib/utils/haptics";

export function CopyBlock({
  label,
  text,
  mono = false,
}: {
  label: string;
  text: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [selectable, setSelectable] = useState(false);
  const [error, setError] = useState("");
  const content = useRef<HTMLParagraphElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPress = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const start = useRef({ x: 0, y: 0 });
  useEffect(() => {
    setSelectable(!navigator.clipboard?.writeText);
    return () => {
      clearTimeout(timer.current);
      clearTimeout(longPress.current);
    };
  }, []);
  function selectAll() {
    if (!content.current) return;
    const range = document.createRange();
    range.selectNodeContents(content.current);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
  async function copy(isLongPress = false) {
    if (selectable || !navigator.clipboard?.writeText) {
      setSelectable(true);
      selectAll();
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      triggerHaptic(isLongPress ? "medium" : "light");
      setError("");
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPY_CONFIRM_MS);
    } catch {
      console.warn("Clipboard access failed; offering text selection.");
      setSelectable(true);
      setError("Copy isn't available. Select the text and copy it manually.");
      selectAll();
    }
  }
  return (
    <section className="rounded-md bg-surface-sunken p-4" aria-label={label}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-eyebrow font-semibold tracking-eyebrow text-secondary uppercase">
          {label}
        </h2>
        <Button
          variant="ghost"
          onClick={() => copy()}
          aria-label={`${selectable ? "Select all" : copied ? "Copied" : "Copy"} ${label}`}
        >
          <Icon name={copied ? "check" : "copy"} size="chip" />
          {selectable ? "Select all" : copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p
        ref={content}
        className={`select-text whitespace-pre-wrap break-words text-body text-primary ${mono ? "font-mono" : ""}`}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          start.current = { x: event.clientX, y: event.clientY };
          longPress.current = setTimeout(() => copy(true), 600);
        }}
        onPointerMove={(event) => {
          if (
            Math.abs(event.clientX - start.current.x) +
              Math.abs(event.clientY - start.current.y) >
            8
          )
            clearTimeout(longPress.current);
        }}
        onPointerUp={() => clearTimeout(longPress.current)}
        onPointerCancel={() => clearTimeout(longPress.current)}
        onContextMenu={() => clearTimeout(longPress.current)}
      >
        {text}
      </p>
      <span role="status" className="sr-only">
        {copied ? `${label} copied` : ""}
      </span>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-secondary">
          {error}
        </p>
      ) : null}
    </section>
  );
}
