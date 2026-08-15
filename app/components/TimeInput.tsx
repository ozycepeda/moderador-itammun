"use client";

import { useId } from "react";
import { useLanguage } from "./LanguageProvider";

export function parseTime(value: string) {
  const clean = value.trim();
  if (/^\d+$/.test(clean)) return Math.max(0, Number(clean));
  const parts = clean.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 2) return Math.max(0, parts[0] * 60 + Math.min(59, parts[1]));
  if (parts.length === 3) return Math.max(0, parts[0] * 3600 + parts[1] * 60 + Math.min(59, parts[2]));
  return 0;
}

export function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function TimeInput({ label, seconds, onChange, compact = false }: {
  label: string;
  seconds: number;
  onChange: (seconds: number) => void;
  compact?: boolean;
}) {
  const id = useId();
  const { t } = useLanguage();
  return (
    <label className={`time-field ${compact ? "time-field-compact" : ""}`} htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        aria-describedby={`${id}-hint`}
        inputMode="numeric"
        key={formatTime(seconds)}
        defaultValue={formatTime(seconds)}
        onBlur={(event) => onChange(parseTime(event.currentTarget.value))}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        pattern="[0-9:]*"
        spellCheck={false}
      />
      <small id={`${id}-hint`}>{t("timeHint")}</small>
    </label>
  );
}
