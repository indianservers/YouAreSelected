import { ServiceError } from "./errors";
export async function readJson(
  request: Request,
  limit = 1500000,
): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > limit)
    throw new ServiceError(413, "Request too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new ServiceError(400, "A JSON request body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new ServiceError(413, "Request too large.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    try {
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new ServiceError(400, "Invalid JSON request body.");
    }
  } finally {
    reader.releaseLock();
  }
}
