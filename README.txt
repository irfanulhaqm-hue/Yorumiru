Yorumiru v4.5.3 — Profile artwork rendering fix

This patch preserves the v4.5.2 design and data model.
Only the profile banner/avatar image loading was changed, plus the cache-busting version.

Replace index.html, app.js and styles.css in GitHub Pages.
Do not clear localStorage.

Profile remote images now try the original URL first and the image proxy second.
Uploaded data:image files continue to work directly.
