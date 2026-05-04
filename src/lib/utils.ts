import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatContactName(name: string): string {
  return name.replace(/@s\.whatsapp\.net$/, '');
}

export function normalizeContactDigits(input: string): string {
  return String(input || '').replace(/@s\.whatsapp\.net$/i, '').replace(/\D/g, '');
}

export function maskContactNumber(input: string): string {
  const digits = normalizeContactDigits(input);
  if (!digits) return '—';
  if (digits.length <= 4) return `${'*'.repeat(digits.length)}`;
  const prefix = digits.slice(0, Math.min(2, digits.length));
  const suffix = digits.slice(-4);
  return `${prefix}*****${suffix}`;
}

export function formatContactDisplay(input: string, canViewPhone: boolean): string {
  if (canViewPhone) return formatContactName(input);
  return maskContactNumber(input);
}

export function isLikelyPhoneLabel(input: string): boolean {
  const raw = String(input || '').trim();
  if (!raw) return false;
  const digits = normalizeContactDigits(raw);
  if (!digits) return false;
  if (digits.length < 8) return false;
  const non = raw.replace(/[0-9+\s().-]/g, '');
  return non.length === 0;
}

export function formatContactDisplayName(name: string, contato: string, canViewPhone: boolean): string {
  const raw = String(name || '').trim();
  if (canViewPhone) return formatContactName(raw);
  const rawDigits = normalizeContactDigits(raw);
  const contatoDigits = normalizeContactDigits(contato);
  if (!raw) return 'Contato';
  if (rawDigits && contatoDigits && rawDigits === contatoDigits) return 'Contato';
  if (isLikelyPhoneLabel(raw)) return 'Contato';
  return raw;
}

export type ResolvedTheme = "light" | "dark";

export function resolveTheme(theme: "light" | "dark" | "system"): ResolvedTheme {
  if (theme === "light" || theme === "dark") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

export function getBrandLogoUrl(
  branding: { logo_url?: string; logo_url_light?: string; logo_url_dark?: string },
  resolvedTheme: ResolvedTheme
): string {
  const fallback = String(branding.logo_url || "");
  const light = String(branding.logo_url_light || "");
  const dark = String(branding.logo_url_dark || "");
  if (resolvedTheme === "dark") return dark || light || fallback;
  return light || dark || fallback;
}
