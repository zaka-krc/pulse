import { useEffect, useState, useSyncExternalStore } from "react";
import { api, restLog } from "../api/client";
import { formatHttpStatus } from "../lib/format";

export function RestInspector() {
  const entries = useSyncExternalStore(restLog.subscribe, restLog.getEntries);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Sélectionne automatiquement la dernière requête exécutée
  const latestId = entries[0]?.id ?? null;
  useEffect(() => {
    if (latestId !== null) {
      setSelectedId(latestId);
    }
  }, [latestId]);

  const selected = entries.find((e) => e.id === selectedId) ?? entries[0] ?? null;

  async function trigger404() {
    try {
      await api.tickets.get(9999);
    } catch {
      // L'erreur 404 est volontaire et enregistrée dans restLog
    }
  }

  async function trigger422() {
    try {
      await api.tickets.create({ title: "a" });
    } catch {
      // L'erreur 422 (titre < 3 caractères) est volontaire et enregistrée dans restLog
    }
  }

  return (
    <aside className="card inspector" aria-label="Inspecteur REST">
      <div className="inspector__header">
        <div>
          <h2>Journal des appels REST</h2>
          <p className="muted small">
            Clique sur une requête pour inspecter le JSON envoyé et reçu.
          </p>
        </div>
        {entries.length > 0 && (
          <button type="button" className="secondary small-btn" onClick={() => restLog.clear()}>
            Vider
          </button>
        )}
      </div>

      <div className="inspector__sim">
        <span className="muted small">Simuler une erreur HTTP :</span>
        <div className="inspector__sim-btns">
          <button type="button" className="secondary small-btn" onClick={trigger404}>
            GET #9999 (404)
          </button>
          <button type="button" className="secondary small-btn" onClick={trigger422}>
            POST invalide (422)
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="muted small">Aucune requête enregistrée pour le moment.</p>
      ) : (
        <>
          <ul className="log-list" aria-label="Historique HTTP">
            {entries.map((entry) => {
              const isSelected = selected?.id === entry.id;
              const isError = entry.status >= 400;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={`log-item ${isSelected ? "log-item--active" : ""}`}
                    onClick={() => setSelectedId(entry.id)}
                  >
                    <span className={`method method--${entry.method.toLowerCase()}`}>
                      {entry.method}
                    </span>
                    <code className="log-item__path">{entry.path}</code>
                    <span
                      className={`status-code ${isError ? "status-code--err" : "status-code--ok"}`}
                    >
                      {formatHttpStatus(entry.status)}
                    </span>
                    <span className="muted small">{entry.durationMs} ms</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selected && (
            <div className="log-detail">
              <div className="log-detail__title">
                <span className={`method method--${selected.method.toLowerCase()}`}>
                  {selected.method}
                </span>
                <code>{selected.path}</code>
                <span className="muted small">({selected.timestamp})</span>
              </div>
              {selected.requestBody !== null && (
                <div>
                  <div className="muted small">Corps envoyé (Request JSON) :</div>
                  <pre>{JSON.stringify(selected.requestBody, null, 2)}</pre>
                </div>
              )}
              <div>
                <div className="muted small">Réponse ({formatHttpStatus(selected.status)}) :</div>
                <pre>
                  {selected.status === 204
                    ? "// 204 No Content (aucun corps retourné après DELETE)"
                    : JSON.stringify(selected.responseBody, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
