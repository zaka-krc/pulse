import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api, buildTicketsQuery } from "./api/client";
import type { Ticket, TicketFilters, TicketSeverity, TicketStatus } from "./api/types";
import { CommentsPanel } from "./components/CommentsPanel";
import { RestInspector } from "./components/RestInspector";
import { TicketFormModal } from "./components/TicketFormModal";
import { SEVERITY_LABELS, STATUS_LABELS, formatRelative } from "./lib/format";

export function App() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<TicketFilters>({ status: "", severity: "", search: "" });
  const [modalTicket, setModalTicket] = useState<Ticket | "new" | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);

  const queryKey = ["tickets", filters] as const;

  const {
    data: tickets = [],
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey,
    queryFn: () => api.tickets.list(filters),
  });

  // Calcul des compteurs à partir de la liste affichée (évite les requêtes GET parasites)
  const stats = useMemo(
    () => ({
      total: tickets.length,
      open: tickets.filter((t) => t.status === "open").length,
      in_progress: tickets.filter((t) => t.status === "in_progress").length,
      resolved: tickets.filter((t) => t.status === "resolved").length,
      critical: tickets.filter((t) => t.severity === "critical" && t.status !== "closed").length,
    }),
    [tickets],
  );

  // Mise à jour directe du cache local après une mutation pour que l'inspecteur REST
  // garde la requête POST / PUT / PATCH / DELETE affichée au premier plan.
  const replaceInCache = (updated: Ticket) => {
    queryClient.setQueriesData<Ticket[]>({ queryKey: ["tickets"] }, (old) =>
      old?.map((t) => (t.id === updated.id ? updated : t)),
    );
  };

  const patchTicket = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: number;
      patch: { status?: TicketStatus; severity?: TicketSeverity };
    }) => api.tickets.patch(id, patch),
    onSuccess: replaceInCache,
  });

  const deleteTicket = useMutation({
    mutationFn: (id: number) => api.tickets.remove(id),
    onSuccess: (_, deletedId) => {
      if (activeTicketId === deletedId) setActiveTicketId(null);
      queryClient.setQueriesData<Ticket[]>({ queryKey: ["tickets"] }, (old) =>
        old?.filter((t) => t.id !== deletedId),
      );
    },
  });

  const currentQueryUrl = `/api${buildTicketsQuery(filters)}`;

  return (
    <>
      <header className="topbar">
        <div>
          <span className="brand">Pulse Tracker</span>
          <span className="muted small topbar__subtitle">
            Suivi de bugs & démonstration d'API REST (FastAPI + React/TS)
          </span>
        </div>
        <div className="topbar__actions">
          <a
            href="http://localhost:8000/api/docs"
            target="_blank"
            rel="noreferrer"
            className="secondary-link"
          >
            Swagger OpenAPI
          </a>
          <button type="button" onClick={() => setModalTicket("new")}>
            + Nouveau ticket (POST)
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="stack">
          <section className="stats-grid" aria-label="Statistiques des tickets">
            <div className="stat-card">
              <span className="muted small">Affichés</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="stat-card">
              <span className="muted small">Ouverts</span>
              <strong className="text-open">{stats.open}</strong>
            </div>
            <div className="stat-card">
              <span className="muted small">En cours</span>
              <strong className="text-progress">{stats.in_progress}</strong>
            </div>
            <div className="stat-card">
              <span className="muted small">Résolus</span>
              <strong className="text-resolved">{stats.resolved}</strong>
            </div>
            <div className="stat-card">
              <span className="muted small">Critiques actifs</span>
              <strong className="text-critical">{stats.critical}</strong>
            </div>
          </section>

          <section className="card stack" aria-label="Filtres">
            <div className="filters-row">
              <input
                aria-label="Rechercher"
                placeholder="Rechercher dans le titre ou la description..."
                value={filters.search ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
              <select
                aria-label="Filtrer par statut"
                value={filters.status ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, status: e.target.value as TicketStatus | "" }))
                }
              >
                <option value="">Tous les statuts</option>
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filtrer par sévérité"
                value={filters.severity ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, severity: e.target.value as TicketSeverity | "" }))
                }
              >
                <option value="">Toutes les sévérités</option>
                {Object.entries(SEVERITY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
              {(filters.status || filters.severity || filters.search) && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setFilters({ status: "", severity: "", search: "" })}
                >
                  Réinitialiser
                </button>
              )}
            </div>
            <div className="query-preview muted small">
              Endpoint appelé : <span className="method method--get">GET</span>{" "}
              <code>{currentQueryUrl}</code>
            </div>
          </section>

          {activeTicketId !== null && (
            <CommentsPanel ticketId={activeTicketId} onClose={() => setActiveTicketId(null)} />
          )}

          <section className="stack" aria-label="Liste des tickets">
            {isPending ? (
              <p className="muted">Chargement des tickets...</p>
            ) : isError ? (
              <p role="alert" className="error">
                Erreur API : {error.message}
              </p>
            ) : tickets.length === 0 ? (
              <div className="card">
                <p className="muted">Aucun ticket ne correspond aux critères.</p>
              </div>
            ) : (
              tickets.map((ticket) => (
                <article key={ticket.id} className={`card ticket ticket--${ticket.severity}`}>
                  <div className="ticket__top">
                    <div>
                      <div className="ticket__title-row">
                        <span className="muted small">#{ticket.id}</span>
                        <h3>{ticket.title}</h3>
                        <span className={`pill pill--${ticket.severity}`}>
                          {SEVERITY_LABELS[ticket.severity]}
                        </span>
                      </div>
                      <p className="muted small">
                        Assigné à : <strong>{ticket.assignee ?? "Non assigné"}</strong> · créé{" "}
                        {formatRelative(ticket.created_at)}
                      </p>
                    </div>

                    <div className="ticket__controls">
                      <label className="inline-label">
                        Statut (PATCH)
                        <select
                          aria-label={`Statut du ticket ${ticket.id}`}
                          value={ticket.status}
                          onChange={(e) =>
                            patchTicket.mutate({
                              id: ticket.id,
                              patch: { status: e.target.value as TicketStatus },
                            })
                          }
                        >
                          {Object.entries(STATUS_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  {ticket.description && <p className="ticket__desc">{ticket.description}</p>}

                  <div className="ticket__footer">
                    <button
                      type="button"
                      className="secondary small-btn"
                      onClick={() =>
                        setActiveTicketId(activeTicketId === ticket.id ? null : ticket.id)
                      }
                    >
                      Commentaires ({ticket.comments_count})
                    </button>
                    <div className="ticket__actions">
                      <button
                        type="button"
                        className="secondary small-btn"
                        onClick={() => setModalTicket(ticket)}
                      >
                        Modifier (PUT)
                      </button>
                      <button
                        type="button"
                        className="danger small-btn"
                        onClick={() => deleteTicket.mutate(ticket.id)}
                      >
                        Supprimer (DELETE)
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>
        </div>

        <RestInspector />
      </main>

      {modalTicket !== null && (
        <TicketFormModal
          ticket={modalTicket === "new" ? undefined : modalTicket}
          onClose={() => setModalTicket(null)}
          onCreate={async (payload) => {
            const created = await api.tickets.create(payload);
            queryClient.setQueryData<Ticket[]>(queryKey, (old = []) => [created, ...old]);
          }}
          onReplace={async (id, payload) => {
            const updated = await api.tickets.replace(id, payload);
            replaceInCache(updated);
          }}
        />
      )}
    </>
  );
}
