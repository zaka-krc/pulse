import { useState, type FormEvent } from "react";
import type {
  Ticket,
  TicketCreateInput,
  TicketPutInput,
  TicketSeverity,
  TicketStatus,
} from "../api/types";
import { SEVERITY_LABELS, STATUS_LABELS } from "../lib/format";

interface Props {
  ticket?: Ticket;
  onClose: () => void;
  onCreate: (payload: TicketCreateInput) => Promise<void>;
  onReplace: (id: number, payload: TicketPutInput) => Promise<void>;
}

export function TicketFormModal({ ticket, onClose, onCreate, onReplace }: Props) {
  const isEdit = Boolean(ticket);
  const [title, setTitle] = useState(ticket?.title ?? "");
  const [description, setDescription] = useState(ticket?.description ?? "");
  const [status, setStatus] = useState<TicketStatus>(ticket?.status ?? "open");
  const [severity, setSeverity] = useState<TicketSeverity>(ticket?.severity ?? "medium");
  const [assignee, setAssignee] = useState(ticket?.assignee ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (ticket) {
        await onReplace(ticket.id, {
          title,
          description,
          status,
          severity,
          assignee: assignee.trim() || null,
        });
      } else {
        await onCreate({
          title,
          description,
          severity,
          assignee: assignee.trim() || null,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <form className="card modal form" onSubmit={handleSubmit}>
        <div className="modal__header">
          <div>
            <h2 id="modal-title">
              {isEdit ? `Modifier le ticket #${ticket!.id}` : "Nouveau ticket"}
            </h2>
            <p className="muted small">
              {isEdit
                ? `Envoie PUT /api/tickets/${ticket!.id} (remplacement complet)`
                : "Envoie POST /api/tickets (retourne 201 Created)"}
            </p>
          </div>
          <button type="button" className="secondary small-btn" onClick={onClose}>
            Fermer
          </button>
        </div>

        <label>
          Titre du ticket
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Erreur 500 sur l'export CSV"
            minLength={3}
            required
          />
        </label>

        <label>
          Description détaillée
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Étapes pour reproduire le problème..."
          />
        </label>

        <div className="form-row">
          {isEdit && (
            <label>
              Statut
              <select value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Sévérité
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as TicketSeverity)}
            >
              {Object.entries(SEVERITY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Assigné à
            <input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Ex: Zakaria, Alice..."
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}

        <div className="modal__actions">
          <button type="button" className="secondary" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? "Envoi..." : isEdit ? "Enregistrer (PUT)" : "Créer le ticket (POST)"}
          </button>
        </div>
      </form>
    </div>
  );
}
