# FSR Hardware, ESP32 Ingest, and Session Quality

SmartContour ingest path: ESP32 reads analog FSR voltage, posts JSON to POST /api/sensor-data, the API analyzes severity, optionally writes Firestore collection sensorReadings, and broadcasts a live event to the dashboard.

Expected payload includes deviceId (for example SMARTCONTOUR-001), timestamp, and sensors.fsr1 / sensors.fsr2. fsr3 and fsr4 may be omitted until hardware expands.

Session quality checks:
- Device should appear connected when packets arrive within the live timeout window.
- Readings must be tagged with source esp32 and demo false. Demo Mode on the web client must never write simulated values into Firestore.
- High-frequency noise can create brief HIGH spikes. Peak, average, and trend together are more informative than a single sample.
- If the backend cannot reach Firebase, live memory may still update the heatmap, but those samples are not stored as real session history until the database is available.

The assistant should explain patterns using these engineering facts: which zone is highest, whether the trend is rising, whether neighboring sensors are still unavailable, and whether a stored cushioning recommendation already exists for that zone.
