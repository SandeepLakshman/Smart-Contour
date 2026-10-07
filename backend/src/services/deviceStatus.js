const devices = new Map();
const OFFLINE_MS = 8000;

export function markDeviceSeen(deviceId, extra = {}) {
  devices.set(deviceId, {
    deviceId,
    lastSeen: Date.now(),
    ...extra,
  });
}

export function getDeviceStatus(deviceId) {
  const entry = devices.get(deviceId);
  if (!entry) {
    return { deviceId, connected: false, status: "offline", lastSeen: null };
  }
  const connected = Date.now() - entry.lastSeen < OFFLINE_MS;
  return {
    ...entry,
    connected,
    status: connected ? "connected" : "offline",
    lastSeen: new Date(entry.lastSeen).toISOString(),
  };
}

export function listDevices() {
  return [...devices.keys()].map(getDeviceStatus);
}
