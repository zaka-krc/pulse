export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketSeverity = "low" | "medium" | "high" | "critical";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface Comment {
  id: number;
  ticket_id: number;
  author: string;
  body: string;
  created_at: string;
}

export interface CommentInput {
  author: string;
  body: string;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  severity: TicketSeverity;
  assignee: string | null;
  comments_count: number;
  created_at: string;
  updated_at: string;
}

export interface TicketDetail extends Ticket {
  comments: Comment[];
}

export interface TicketCreateInput {
  title: string;
  description?: string;
  severity?: TicketSeverity;
  assignee?: string | null;
}

export interface TicketPutInput {
  title: string;
  description: string;
  status: TicketStatus;
  severity: TicketSeverity;
  assignee: string | null;
}

export interface TicketPatchInput {
  title?: string;
  description?: string;
  status?: TicketStatus;
  severity?: TicketSeverity;
  assignee?: string | null;
}

export interface TicketFilters {
  status?: TicketStatus | "";
  severity?: TicketSeverity | "";
  search?: string;
}

export interface TicketStats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  critical: number;
}

export interface RestLogEntry {
  id: number;
  method: HttpMethod;
  path: string;
  status: number;
  durationMs: number;
  requestBody: unknown;
  responseBody: unknown;
  timestamp: string;
}
