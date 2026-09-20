import { describe, expect, it } from "vitest";
import { DeepSeekClient, DEEPSEEK_DEFAULT_MODEL } from "@aeta/ai";

describe("DeepSeek client", () => {
  it("uses the documented default model", () => {
    expect(DEEPSEEK_DEFAULT_MODEL).toBe("deepseek-flash");
  });

  it("refuses to call without an API key", async () => {
    const client = new DeepSeekClient({ apiKey: "", maxRetries: 0 });
    await expect(client.chat({ messages: [{ role: "user", content: "hello" }] })).rejects.toMatchObject({ code: "DEEPSEEK_CONFIGURATION_ERROR" });
  });
});
