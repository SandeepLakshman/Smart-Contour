const DEVICE_TIMEOUT_MS = 15000;

const devices = new Map();
let latestReading = null;
const memoryHistory = [];
const MAX_MEMORY = 400;

export function noteDeviceActivity(deviceId, payload) {
  const id = deviceId || "UNKNOWN";
  devices.set(id, {
    deviceId: id,
    lastSeen: Date.now(),
    lastPayload: payload,
  });
}

export function getDeviceStatus(deviceId) {
  const id = deviceId || [...devices.keys()][0] || process.env.DEFAULT_DEVICE_ID || "SMARTCONTOUR-001";
  const rec = devices.get(id);
  if (!rec) {
    return { deviceId: id, connected: false, lastSeen: null, label: "Device Offline" };
  }
  const connected = Date.now() - rec.lastSeen < DEVICE_TIMEOUT_MS;
  return {
    deviceId: id,
    connected,
    lastSeen: rec.lastSeen,
    label: connected ? "Device Connected" : "Device Offline",
  };
}

export function listDevices() {
  const ids = new Set([...devices.keys()]);
  if (ids.size === 0) ids.add(process.env.DEFAULT_DEVICE_ID || "SMARTCONTOUR-001");
  return [...ids].map((id) => getDeviceStatus(id));
}

export function setLatest(reading) {
  latestReading = reading;
  memoryHistory.push(reading);
  if (memoryHistory.length > MAX_MEMORY) memoryHistory.shift();
}

export function getLatest() {
  return latestReading;
}

export function getMemoryHistory(limit = 120) {
  return memoryHistory.slice(-limit);
}
