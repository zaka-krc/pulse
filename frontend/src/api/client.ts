import type {
  Comment,
  CommentInput,
  HttpMethod,
  RestLogEntry,
  Ticket,
  TicketCreateInput,
  TicketDetail,
  TicketFilters,
  TicketPatchInput,
  TicketPutInput,
  TicketStats,
} from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// --- Journal des requêtes REST en direct ------------------------------------

type Listener = () => void;
let logSeq = 0;
let entries: RestLogEntry[] = [];
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

export const restLog = {
  getEntries: (): RestLogEntry[] => entries,
  clear: () => {
    entries = [];
    notify();
  },
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

function recordLog(entry: Omit<RestLogEntry, "id" | "timestamp">) {
  logSeq += 1;
  entries = [
    {
      ...entry,
      id: logSeq,
      timestamp: new Date().toLocaleTimeString("fr-BE"),
    },
    ...entries.slice(0, 29),
  ];
  notify();
}

// --- Client HTTP générique --------------------------------------------------

function extractErrorMessage(body: unknown, response: Response): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((d: { msg?: string }) => d.msg ?? "Erreur").join(", ");
    }
  }
  return response.statusText || `HTTP ${response.status}`;
}

export async function request<T>(
  path: string,
  method: HttpMethod = "GET",
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const fullPath = `/api${path}`;
  const start = performance.now();
  const response = await fetch(fullPath, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const durationMs = Math.max(1, Math.round(performance.now() - start));

  let parsedBody: unknown = null;
  if (response.status !== 204) {
    try {
      parsedBody = await response.json();
    } catch {
      parsedBody = null;
    }
  }

  recordLog({
    method,
    path: fullPath,
    status: response.status,
    durationMs,
    requestBody: body ?? null,
    responseBody: parsedBody,
  });

  if (!response.ok) {
    throw new ApiError(response.status, extractErrorMessage(parsedBody, response));
  }
  return (response.status === 204 ? undefined : parsedBody) as T;
}

export function buildTicketsQuery(filters: TicketFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  const qs = params.toString();
  return qs ? `/tickets?${qs}` : "/tickets";
}

export const api = {
  tickets: {
    list: (filters: TicketFilters = {}) => request<Ticket[]>(buildTicketsQuery(filters), "GET"),
    stats: () => request<TicketStats>("/tickets/stats", "GET"),
    get: (id: number) => request<TicketDetail>(`/tickets/${id}`, "GET"),
    create: (input: TicketCreateInput) => request<Ticket>("/tickets", "POST", input),
    replace: (id: number, input: TicketPutInput) => request<Ticket>(`/tickets/${id}`, "PUT", input),
    patch: (id: number, input: TicketPatchInput) =>
      request<Ticket>(`/tickets/${id}`, "PATCH", input),
    remove: (id: number) => request<void>(`/tickets/${id}`, "DELETE"),
  },
  comments: {
    list: (ticketId: number) => request<Comment[]>(`/tickets/${ticketId}/comments`, "GET"),
    create: (ticketId: number, input: CommentInput) =>
      request<Comment>(`/tickets/${ticketId}/comments`, "POST", input),
    remove: (ticketId: number, commentId: number) =>
      request<void>(`/tickets/${ticketId}/comments/${commentId}`, "DELETE"),
  },
};
