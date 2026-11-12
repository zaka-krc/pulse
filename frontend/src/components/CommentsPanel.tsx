import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { Ticket, TicketDetail } from "../api/types";
import { formatRelative } from "../lib/format";

interface Props {
  ticketId: number;
  onClose: () => void;
}

export function CommentsPanel({ ticketId, onClose }: Props) {
  const queryClient = useQueryClient();
  const [author, setAuthor] = useState("Zakaria");
  const [body, setBody] = useState("");

  const { data: ticket, isPending } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => api.tickets.get(ticketId),
  });

  const updateCountInLists = (delta: number) => {
    queryClient.setQueriesData<Ticket[]>({ queryKey: ["tickets"] }, (old) =>
      old?.map((t) =>
        t.id === ticketId ? { ...t, comments_count: Math.max(0, t.comments_count + delta) } : t,
      ),
    );
  };

  const addComment = useMutation({
    mutationFn: () => api.comments.create(ticketId, { author, body }),
    onSuccess: (created) => {
      setBody("");
      queryClient.setQueryData<TicketDetail>(["ticket", ticketId], (old) =>
        old
          ? {
              ...old,
              comments_count: old.comments_count + 1,
              comments: [...old.comments, created],
            }
          : old,
      );
      updateCountInLists(1);
    },
  });

  const removeComment = useMutation({
    mutationFn: (commentId: number) => api.comments.remove(ticketId, commentId),
    onSuccess: (_, commentId) => {
      queryClient.setQueryData<TicketDetail>(["ticket", ticketId], (old) =>
        old
          ? {
              ...old,
              comments_count: Math.max(0, old.comments_count - 1),
              comments: old.comments.filter((c) => c.id !== commentId),
            }
          : old,
      );
      updateCountInLists(-1);
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || !author.trim()) return;
    addComment.mutate();
  }

  return (
    <section className="card comments-panel" aria-label="Commentaires du ticket">
      <div className="comments-panel__header">
        <div>
          <h3>
            Commentaires — Ticket #{ticketId} {ticket ? `(${ticket.title})` : ""}
          </h3>
          <p className="muted small">
            Sous-ressource REST : <code>/api/tickets/{ticketId}/comments</code>
          </p>
        </div>
        <button type="button" className="secondary small-btn" onClick={onClose}>
          Fermer
        </button>
      </div>

      {isPending || !ticket ? (
        <p className="muted">Chargement des commentaires...</p>
      ) : (
        <>
          {ticket.comments.length === 0 ? (
            <p className="muted small">Aucun commentaire sur ce ticket.</p>
          ) : (
            <ul className="comment-list">
              {ticket.comments.map((c) => (
                <li key={c.id} className="comment-item">
                  <div>
                    <strong>{c.author}</strong>{" "}
                    <span className="muted small">· {formatRelative(c.created_at)}</span>
                    <p>{c.body}</p>
                  </div>
                  <button
                    type="button"
                    className="danger small-btn"
                    onClick={() => removeComment.mutate(c.id)}
                    aria-label={`Supprimer le commentaire de ${c.author}`}
                  >
                    Supprimer (DELETE)
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form className="form inline" onSubmit={handleSubmit} aria-label="Ajouter un commentaire">
            <input
              aria-label="Auteur"
              placeholder="Auteur"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              required
              style={{ maxWidth: "150px" }}
            />
            <input
              aria-label="Votre commentaire"
              placeholder="Ajouter un commentaire..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
            <button type="submit" disabled={addComment.isPending}>
              Publier (POST)
            </button>
          </form>
        </>
      )}
    </section>
  );
}
