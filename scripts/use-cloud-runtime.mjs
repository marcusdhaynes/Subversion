import fs from 'node:fs';
// The original app uses server-owned subtitle data, Gemini translation and WebSockets.
// Pages cannot execute that server. Keep the existing published runtime inside the
// full viewport rather than silently substituting a disconnected sample project.
if(process.env.STANDALONE_WEB==='true')process.exit(0);
fs.writeFileSync('dist/index.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Subversion</title><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#09090b}iframe{display:block;position:fixed;inset:0;width:100%;height:100%;border:0}</style></head><body><iframe title="Subversion" src="https://subversion.ai.studio/" allow="fullscreen; autoplay; clipboard-read; clipboard-write; picture-in-picture" allowfullscreen></iframe></body></html>`);
