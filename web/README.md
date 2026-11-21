# Photos web (React + Vite)

Web client for the Express server in `../server`. Every page and heavy component is loaded lazily.

```
npm install
npm run dev            # http://localhost:5173, /api is proxied to http://localhost:3000
npm run build          # writes ./build (the server serves it)
npm test               # unit + component tests
npm run typecheck
npm run server-todo    # regenerates docs/server-todo.md
```

Read **[docs/FUNCTIONAL_DESCRIPTION.md](docs/FUNCTIONAL_DESCRIPTION.md)** for what is implemented, how it works, and what is missing.
`docs/server-todo.md` lists the server endpoints the web already calls but the server does not have yet.
