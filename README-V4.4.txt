Yorumiru V4.4.1 — episode pagination fix

This patch fixes long-running anime episode loading. Jikan serves episode lists in pages of up to 100 episodes; V4.4 could stop after the first page. V4.4.1 continues through all pages with retry/backoff, preserves cached episode details, shows loading progress, and provides a Load more fallback if an upstream API request fails. Existing V4.4 localStorage data is migrated automatically.

Replace index.html, app.js and styles.css in the GitHub repository.
