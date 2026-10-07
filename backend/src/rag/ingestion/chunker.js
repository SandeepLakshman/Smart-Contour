export function chunkDocument({ id, title, source, text }, size = 900, overlap = 140) {
  const clean = String(text || "").replace(/\r\n/g, "\n").trim();
  const paragraphs = clean.split(/\n{2,}/);
  const chunks = [];
  let buffer = "";
  let index = 0;

  const flush = () => {
    const content = buffer.trim();
    if (!content) return;
    chunks.push({
      id: `${id}::${index}`,
      documentId: id,
      title,
      source,
      index,
      content,
    });
    index += 1;
  };

  for (const p of paragraphs) {
    if ((buffer + "\n\n" + p).length > size && buffer) {
      flush();
      const words = buffer.split(/\s+/);
      const keep = words.slice(-Math.floor(overlap / 6)).join(" ");
      buffer = keep ? `${keep}\n\n${p}` : p;
    } else {
      buffer = buffer ? `${buffer}\n\n${p}` : p;
    }
  }
  flush();
  return chunks;
}
