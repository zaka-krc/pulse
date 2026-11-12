import type { TicketSeverity, TicketStatus } from "../api/types";

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Ouvert",
  in_progress: "En cours",
  resolved: "Résolu",
  closed: "Fermé",
};

export const SEVERITY_LABELS: Record<TicketSeverity, string> = {
  low: "Faible",
  medium: "Moyenne",
  high: "Haute",
  critical: "Critique",
};

export const HTTP_STATUS_TEXT: Record<number, string> = {
  200: "200 OK",
  201: "201 Created",
  204: "204 No Content",
  400: "400 Bad Request",
  404: "404 Not Found",
  422: "422 Unprocessable Entity",
  500: "500 Internal Server Error",
};

export function formatHttpStatus(code: number): string {
  return HTTP_STATUS_TEXT[code] ?? String(code);
}

export function formatRelative(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "jamais";
  const seconds = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return "à l'instant";
  if (seconds < 60) return `il y a ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}
