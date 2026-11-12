import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { restLog } from "../api/client";

afterEach(() => {
  cleanup();
  restLog.clear();
  vi.restoreAllMocks();
});
