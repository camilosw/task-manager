# Task Manager

A personal task manager built around a bounded daily plan, implemented as an
offline-first installable PWA. See `openspec/changes/add-task-manager-app/`
for the proposal, design, and specs driving this implementation.

## Development

```sh
npm install
npm run dev
```

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build for production
- `npm run test` — run the test suite (Vitest)
- `npm run lint` — run ESLint

## Deployment

Production is deployed on [Vercel](https://task-manager-tawny-gamma-81.vercel.app),
building on every push to `main`. Pull requests get their own preview deployment.
No Vercel configuration is committed to the repo — the Vite framework preset is
auto-detected.
