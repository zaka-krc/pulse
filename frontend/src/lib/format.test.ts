import { describe, expect, it } from "vitest";
import { formatHttpStatus, formatRelative } from "./format";

describe("formatHttpStatus", () => {
  it("formats common REST status codes", () => {
    expect(formatHttpStatus(200)).toBe("200 OK");
    expect(formatHttpStatus(201)).toBe("201 Created");
    expect(formatHttpStatus(204)).toBe("204 No Content");
    expect(formatHttpStatus(404)).toBe("404 Not Found");
    expect(formatHttpStatus(418)).toBe("418");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-01-01T12:00:00Z");

  it.each([
    [null, "jamais"],
    ["2026-01-01T11:59:58Z", "à l'instant"],
    ["2026-01-01T11:59:40Z", "il y a 20 s"],
    ["2026-01-01T11:50:00Z", "il y a 10 min"],
    ["2026-01-01T09:00:00Z", "il y a 3 h"],
    ["2025-12-29T12:00:00Z", "il y a 3 j"],
  ])("formatRelative(%s) = %s", (iso, expected) => {
    expect(formatRelative(iso, now)).toBe(expected);
  });
});
