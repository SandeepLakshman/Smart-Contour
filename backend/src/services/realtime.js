import { WebSocketServer } from "ws";

const clients = new Set();

export function initRealtime(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (socket) => {
    clients.add(socket);
    socket.send(JSON.stringify({ type: "connected", at: new Date().toISOString() }));
    socket.on("close", () => clients.delete(socket));
    socket.on("error", () => clients.delete(socket));
  });
  return wss;
}

export function broadcast(event) {
  const payload = JSON.stringify({ ...event, at: new Date().toISOString() });
  for (const client of clients) {
    if (client.readyState === 1) client.send(payload);
  }
}

export function clientCount() {
  return clients.size;
}
