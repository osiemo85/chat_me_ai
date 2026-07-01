This is the frontend for Chat Me AI, built with Next.js.

## Environment

Set the backend URL in `frontend/.env`:

```bash
API_BASE_URL=http://localhost:8000
```

`API_BASE_URL` is the backend origin used by the Next.js server and by the
`/api/v1/*` proxy rewrite. In production, set this to your backend origin so
you can switch environments without changing frontend code.

`NEXT_PUBLIC_API_BASE_URL` is optional. Leave it unset unless you explicitly
want browser code to call the backend origin directly instead of going through
the Next.js proxy.

## Getting Started

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```
