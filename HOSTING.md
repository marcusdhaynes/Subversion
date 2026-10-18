# Hosting

The interface is built from the original source and hosted directly at https://marcusdhaynes.github.io/Subversion/. API requests and WebSocket collaboration connect to the existing https://subversion.ai.studio runtime. Its server allows only the requested GitHub Pages origin through CORS. No iframe, redirect, additional account or public Gemini credential is used.

The original server and client are both included. Set VITE_API_BASE_URL to change the runtime endpoint. Local development defaults to the local server. Production and native clients default to the existing cloud runtime.

## Shared app services

services/router.ts also registers the original Starborn map-analysis endpoint and original ProSeU server flows. These reuse the already configured server-side Gemini environment key and existing spend cap. services/proseu retains the original flow prompts and schemas; only the import path and environment-key fallback were adapted.
