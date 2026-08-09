Yorumiru v4.5.2 — Ongoing Episode Fix

This patch preserves the v4.5.1 design and changes only episode availability logic.

- Ongoing anime use aired episodes (nextAiringEpisode - 1) instead of planned totals.
- Planned totals are shown separately where known.
- Future episodes are not created as watchable episodes.
- Season cards show aired/total for releasing seasons.
- Completed anime keep their full episode totals.

Replace index.html, app.js and styles.css with these files. styles.css is unchanged except it is included to keep the package self-contained.
