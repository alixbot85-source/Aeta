import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../apps/api/src/services/password";

describe("authentication", () => {
  it("hashes passwords and verifies without storing plaintext", async () => {
    const hash = await hashPassword("ChangeMe123!");
    expect(hash).not.toContain("ChangeMe123!");
    expect(await verifyPassword("ChangeMe123!", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
