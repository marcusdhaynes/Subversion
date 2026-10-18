# Subversion

The original AI Studio interface is retained. GitHub Pages serves the web build at https://marcusdhaynes.github.io/Subversion/. The native workflow packages the same interface for Windows, macOS, Linux and Android. iOS source can be initialized using npm run ios:init on macOS; distribution requires Apple signing.

The original server is retained in server.ts. GitHub Pages cannot execute it. Server-dependent features require deployment of that server with its existing environment secrets, and configuration of the front end to use its endpoint. No private API keys are bundled into the web app. Firebase authentication also requires the published domain to be authorized in the original Firebase project.
