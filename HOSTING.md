# Web runtime

The exact GitHub Pages URL embeds the existing published Subversion runtime at https://subversion.ai.studio/ across the full viewport, with no added UI. This preserves the original server-owned projects, translation service and real-time WebSocket collaboration. The complete original client and server source remain in this repository.

`npm run build:web` builds this connected runtime for Pages and native packages. `npm run build:standalone` builds the original client directly; it needs the included Express/WebSocket server and GEMINI_API_KEY. The cloud runtime remains an external dependency; this is not an independently hosted backend on GitHub Pages.
