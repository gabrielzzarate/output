# docs

The documentation site for `output`: getting started, guides, the API reference, and live examples. Every paragraph is rendered by `<Output>` itself, against the package sources in this repo.

```bash
pnpm docs         # from the repo root
pnpm docs:build   # static build in apps/docs/dist
```

To deploy on Vercel, create a project with **Root Directory** set to `apps/docs`. Vite is detected automatically, and `vercel.json` sends every route to the single-page app.
