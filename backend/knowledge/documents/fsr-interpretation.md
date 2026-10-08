# Interpreting FSR readings in SmartContour

FSR output in this project is a numeric intensity from the ESP32 analog path. Values are comparable within a session for the same sensor placement. They are not calibrated newton units unless a future calibration step is added.

Default prototype bands:
- 0–349: LOW
- 350–699: MEDIUM
- 700 and above: HIGH

These bands can be changed in Settings.

A rising trend on one FSR with a falling trend on another can indicate load shifting. A simultaneous rise on all sensors may indicate overall tighter contact or a higher activity load rather than a single hotspot.

Missing FSR3 or FSR4 values mean expansion sensors are not attached. Analysis should treat them as unavailable, not as zero pressure.
