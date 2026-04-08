import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatContactName(name: string): string {
  return name.replace(/@s\.whatsapp\.net$/, '');
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
