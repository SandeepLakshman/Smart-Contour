# SmartContour Socket Pressure Mapping Notes

This document is part of the SmartContour project knowledge base. It is engineering guidance for a prototype wearable FSR sleeve, not a clinical protocol and not a substitute for a prosthetist's judgment.

Force Sensitive Resistors (FSRs) estimate relative interface loading between the residual limb and the prosthetic socket. SmartContour currently wires FSR1 to GPIO 34 (Zone 1) and FSR2 to GPIO 35 (Zone 2). Zone 3 and Zone 4 are reserved in software for posterior and distal regions when additional sensors are fitted.

Pressure in this prototype is represented as unitless ADC-derived magnitudes. Classification uses configurable project thresholds: LOW, MEDIUM, and HIGH. Those bands are for demonstration and iterative fitting support. They are not published clinical diagnostic limits.

A hotspot is a zone whose live value crosses the HIGH band. Hotspots often appear over bony prominences, poorly relieved socket regions, or areas where the liner/socket contour does not match the limb. The first engineering response in this prototype is to consider additional soft cushioning in that region and then reassess after refitting.

A continuous heatmap interpolates between discrete FSR sites so the clinician-engineer can see a field rather than four isolated numbers. Interpolation is a visualization aid. It does not create new sensor measurements between pads.

When only two FSRs are live, Zones 3 and 4 should be treated as unavailable rather than zero. Zero would incorrectly look like comfortable low pressure.
