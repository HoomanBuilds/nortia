export function parseTxlineResponse(body: string): unknown {
  const normalized = body.trim().replaceAll("\r\n", "\n");
  if (!normalized) return [];
  if (normalized.startsWith("{") || normalized.startsWith("[")) {
    return JSON.parse(normalized) as unknown;
  }

  const values: unknown[] = [];
  for (const block of normalized.split("\n\n")) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") continue;
    const parsed = JSON.parse(data) as unknown;
    if (Array.isArray(parsed)) values.push(...parsed);
    else values.push(parsed);
  }
  return values;
}
