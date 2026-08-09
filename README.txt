Yorumiru v4.5.5 — series-family fix

This patch keeps the existing v4.5 design and fixes multi-season franchises. PREQUEL/SEQUEL chains are resolved recursively, so a title such as Attack on Titan opens as one series page with the canonical four TV seasons. Existing separate season records are consolidated into the root series and their watched progress is merged.

Upload index.html, app.js and styles.css to the repository. Do not delete browser storage.
