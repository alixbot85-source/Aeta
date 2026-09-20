import type { DeepSeekStreamChunk } from "./types.js";

export async function* parseSseStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<DeepSeekStreamChunk> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of frame.split(/\r?\n/)) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        yield JSON.parse(data) as DeepSeekStreamChunk;
      }
    }
  }
  const rest = buffer.trim();
  if (rest.startsWith("data:")) {
    const data = rest.slice(5).trim();
    if (data && data !== "[DONE]") yield JSON.parse(data) as DeepSeekStreamChunk;
  }
}
