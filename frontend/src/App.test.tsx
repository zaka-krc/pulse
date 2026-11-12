import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Ticket } from "./api/types";
import { jsonResponse, mockApi, renderApp } from "./test/utils";

const sampleTicket: Ticket = {
  id: 1,
  title: "Erreur 500 export PDF",
  description: "Problème d'encodage UTF-8",
  status: "open",
  severity: "critical",
  assignee: "Zakaria",
  comments_count: 1,
  created_at: "2026-11-12T19:00:00Z",
  updated_at: "2026-11-12T19:00:00Z",
};

describe("App — REST workflow", () => {
  it("loads tickets (GET) and logs the request in the REST inspector", async () => {
    mockApi({
      "GET /api/tickets": () => jsonResponse([sampleTicket]),
    });

    renderApp();

    expect(await screen.findByText("Erreur 500 export PDF")).toBeInTheDocument();
    expect(screen.getByText("Zakaria")).toBeInTheDocument();

    const inspector = screen.getByRole("complementary", { name: "Inspecteur REST" });
    expect(within(inspector).getAllByText("/api/tickets").length).toBeGreaterThanOrEqual(1);
    expect(within(inspector).getByText("200 OK")).toBeInTheDocument();
  });

  it("filters tickets via GET query parameters", async () => {
    const user = userEvent.setup();
    const listFiltered = vi.fn(() => jsonResponse([]));
    mockApi({
      "GET /api/tickets": () => jsonResponse([sampleTicket]),
      "GET /api/tickets?status=resolved": listFiltered,
    });

    renderApp();
    await screen.findByText("Erreur 500 export PDF");

    await user.selectOptions(screen.getByLabelText("Filtrer par statut"), "resolved");

    await waitFor(() => expect(listFiltered).toHaveBeenCalledOnce());
    expect(screen.getAllByText("/api/tickets?status=resolved").length).toBeGreaterThanOrEqual(2);
  });

  it("creates a ticket via POST /api/tickets and keeps 201 Created selected in the inspector", async () => {
    const user = userEvent.setup();
    const createMock = vi.fn((init?: RequestInit) =>
      jsonResponse({ ...sampleTicket, id: 2, ...JSON.parse(init!.body as string) }, 201),
    );
    mockApi({
      "GET /api/tickets": () => jsonResponse([sampleTicket]),
      "POST /api/tickets": createMock,
    });

    renderApp();
    await user.click(await screen.findByRole("button", { name: "+ Nouveau ticket (POST)" }));

    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Titre du ticket"), "Timeout API paiement");
    await user.selectOptions(within(dialog).getByLabelText("Sévérité"), "high");
    await user.click(within(dialog).getByRole("button", { name: "Créer le ticket (POST)" }));

    expect(await screen.findByText("Timeout API paiement")).toBeInTheDocument();
    const inspector = screen.getByRole("complementary", { name: "Inspecteur REST" });
    expect(within(inspector).getByText("201 Created")).toBeInTheDocument();
  });

  it("partially updates status via PATCH /api/tickets/{id}", async () => {
    const user = userEvent.setup();
    const patchMock = vi.fn((_init?: RequestInit) =>
      jsonResponse({ ...sampleTicket, status: "in_progress" }),
    );
    mockApi({
      "GET /api/tickets": () => jsonResponse([sampleTicket]),
      "PATCH /api/tickets/1": patchMock,
    });

    renderApp();
    const statusSelect = await screen.findByLabelText("Statut du ticket 1");
    await user.selectOptions(statusSelect, "in_progress");

    await waitFor(() => expect(patchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(patchMock.mock.calls[0]![0]!.body as string)).toEqual({
      status: "in_progress",
    });
  });

  it("replaces a ticket via PUT /api/tickets/{id} and deletes via DELETE", async () => {
    const user = userEvent.setup();
    const putMock = vi.fn(() => jsonResponse({ ...sampleTicket, title: "Titre corrigé" }));
    const deleteMock = vi.fn(() => jsonResponse(null, 204));
    mockApi({
      "GET /api/tickets": () => jsonResponse([sampleTicket]),
      "PUT /api/tickets/1": putMock,
      "DELETE /api/tickets/1": deleteMock,
    });

    renderApp();
    await user.click(await screen.findByRole("button", { name: "Modifier (PUT)" }));

    const dialog = screen.getByRole("dialog");
    const titleInput = within(dialog).getByLabelText("Titre du ticket");
    await user.clear(titleInput);
    await user.type(titleInput, "Titre corrigé");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer (PUT)" }));

    expect(await screen.findByText("Titre corrigé")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Supprimer (DELETE)" }));
    await waitFor(() => expect(deleteMock).toHaveBeenCalledOnce());
    expect(screen.queryByText("Titre corrigé")).not.toBeInTheDocument();
  });

  it("loads, adds and deletes comments on a ticket (/api/tickets/1/comments)", async () => {
    const user = userEvent.setup();
    const postComment = vi.fn(() =>
      jsonResponse(
        {
          id: 10,
          ticket_id: 1,
          author: "Zakaria",
          body: "Je m'en occupe",
          created_at: "2026-11-12T19:05:00Z",
        },
        201,
      ),
    );
    const deleteComment = vi.fn(() => jsonResponse(null, 204));

    mockApi({
      "GET /api/tickets": () => jsonResponse([sampleTicket]),
      "GET /api/tickets/1": () =>
        jsonResponse({
          ...sampleTicket,
          comments: [
            {
              id: 5,
              ticket_id: 1,
              author: "Sarah",
              body: "Bug reproduit",
              created_at: "2026-11-12T19:01:00Z",
            },
          ],
        }),
      "POST /api/tickets/1/comments": postComment,
      "DELETE /api/tickets/1/comments/5": deleteComment,
    });

    renderApp();
    await user.click(await screen.findByRole("button", { name: "Commentaires (1)" }));

    expect(await screen.findByText("Bug reproduit")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Votre commentaire"), "Je m'en occupe");
    await user.click(screen.getByRole("button", { name: "Publier (POST)" }));
    expect(await screen.findByText("Je m'en occupe")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Supprimer le commentaire de Sarah" }));
    await waitFor(() => expect(deleteComment).toHaveBeenCalledOnce());
  });

  it("simulates 404 and 422 HTTP errors in the REST inspector", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/tickets": () => jsonResponse([sampleTicket]),
      "GET /api/tickets/9999": () => jsonResponse({ detail: "Ticket introuvable" }, 404),
      "POST /api/tickets": () =>
        jsonResponse({ detail: [{ msg: "String should have at least 3 characters" }] }, 422),
    });

    renderApp();
    await screen.findByText("Erreur 500 export PDF");

    await user.click(screen.getByRole("button", { name: "GET #9999 (404)" }));
    expect(await screen.findByText("404 Not Found")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "POST invalide (422)" }));
    expect(await screen.findByText("422 Unprocessable Entity")).toBeInTheDocument();
  });
});
