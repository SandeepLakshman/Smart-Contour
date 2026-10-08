# Prosthetic socket pressure — fitting support notes

These notes are project knowledge for SmartContour. They are educational summaries for a prototype fitting-support tool. They are not clinical protocols and must not be used as a diagnosis.

A prosthetic socket transfers load between the residual limb and the prosthesis. Localized high pressure can cause discomfort, skin redness, or reduced wear time. Fitting work often aims to redistribute load using socket geometry, alignment, and soft inserts rather than concentrating force on a small region.

Force-sensitive resistors (FSRs) on a wearable sleeve can show relative pressure differences between regions during standing or walking. SmartContour maps FSR1–FSR4 to Zone 1–Zone 4. Current hardware exposes FSR1 on GPIO 34 and FSR2 on GPIO 35. Zones 3 and 4 are reserved for expansion.

High readings in one zone with low readings in neighboring zones often indicate a hotspot: load is not shared. Soft cushioning in that socket region may reduce peak contact stress. After adding an insert, pressure should be reassessed under similar loading.

SmartContour severity bands (LOW / MEDIUM / HIGH) are configurable prototype thresholds. They are not published clinical diagnostic limits.
