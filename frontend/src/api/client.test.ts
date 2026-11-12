import { describe, expect, it } from "vitest";
import { jsonResponse, mockApi } from "../test/utils";
import { ApiError, api, buildTicketsQuery, restLog } from "./client";

describe("buildTicketsQuery", () => {
  it("builds clean query strings from filters", () => {
    expect(buildTicketsQuery()).toBe("/tickets");
    expect(buildTicketsQuery({ status: "open", severity: "critical", search: " pdf " })).toBe(
      "/tickets?status=open&severity=critical&search=pdf",
    );
  });
});

describe("api client & REST log", () => {
  it("records GET, POST and DELETE calls in the live REST log", async () => {
    mockApi({
      "GET /api/tickets": () => jsonResponse([]),
      "POST /api/tickets": () => jsonResponse({ id: 1, title: "Bug" }, 201),
      "DELETE /api/tickets/1": () => jsonResponse(null, 204),
    });

    await api.tickets.list();
    await api.tickets.create({ title: "Bug" });
    await api.tickets.remove(1);

    const entries = restLog.getEntries();
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({ method: "DELETE", path: "/api/tickets/1", status: 204 });
    expect(entries[1]).toMatchObject({
      method: "POST",
      path: "/api/tickets",
      status: 201,
      requestBody: { title: "Bug" },
    });
    expect(entries[2]).toMatchObject({ method: "GET", path: "/api/tickets", status: 200 });
  });

  it("throws ApiError and logs failed requests (404 / 422)", async () => {
    mockApi({
      "GET /api/tickets/99": () => jsonResponse({ detail: "Ticket introuvable" }, 404),
      "POST /api/tickets": () =>
        jsonResponse({ detail: [{ msg: "String should have at least 3 characters" }] }, 422),
    });

    await expect(api.tickets.get(99)).rejects.toEqual(new ApiError(404, "Ticket introuvable"));
    await expect(api.tickets.create({ title: "a" })).rejects.toThrow(
      "String should have at least 3 characters",
    );
    expect(restLog.getEntries()[0]?.status).toBe(422);
  });
});
