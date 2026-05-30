This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Remote Control

The presentation shell includes an optional browser-side remote-control bridge for controller apps that send JSON commands over WebSocket.

Add these values to your local env file:

```bash
NEXT_PUBLIC_TRIFECTA_REMOTE_CONTROL_ENABLED=true
NEXT_PUBLIC_TRIFECTA_REMOTE_CONTROL_RELAY_URL=ws://127.0.0.1:8787/session
NEXT_PUBLIC_TRIFECTA_REMOTE_CONTROL_SESSION_CODE=demo-session
```

Notes:

- Set `NEXT_PUBLIC_TRIFECTA_REMOTE_CONTROL_ENABLED=false` to disable the feature completely.
- `NEXT_PUBLIC_TRIFECTA_REMOTE_CONTROL_RELAY_URL` defaults to `ws://127.0.0.1:8787/session` in development when the flag is enabled.
- `NEXT_PUBLIC_TRIFECTA_REMOTE_CONTROL_SESSION_CODE` is required before the site will join a relay session.
- Every received command is re-broadcast in the browser as `window.dispatchEvent(new CustomEvent("trifecta:control", { detail: command }))`.
- You can also inject commands manually with `window.TrifectaPresenter.receiveNativeCommand(command)`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.\




## ENV

SMTP_HOST = "sandbox.smtp.mailtrap.io"
SMTP_PORT = "2525"
SMTP_USER = "121fa6c516e293"
SMTP_PASS = "51290f3a2ec291"
SMTP_TO= "rishav@sthyra.com"
MONGODB_URI="mongodb://rishav_db_user:XTQRElKq3WCRNknu@ac-t0gvank-shard-00-00.77n4jhn.mongodb.net:27017,ac-t0gvank-shard-00-01.77n4jhn.mongodb.net:27017,ac-t0gvank-shard-00-02.77n4jhn.mongodb.net:27017/?ssl=true&replicaSet=atlas-4jofd4-shard-0&authSource=admin&retryWrites=true&w=majority"
MONGODB_DB_NAME="project_0"
ASSET_SECRET = "4e30b98b91b4775c049a924c350ace8a"

## ENV LOCAL

ADMIN_SESSION_SECRET=8b66e8f1db8647a5a728a78d16c8cb95fb986be561f3490b8cb39ee4332032d6
ASSET_WORKER_DOMAIN=https://assets.sthyra.com


## ENV EXAMPLE 

NEXT_PUBLIC_TRIFECTA_REMOTE_CONTROL_ENABLED=false
NEXT_PUBLIC_TRIFECTA_REMOTE_CONTROL_RELAY_URL=ws://127.0.0.1:8787/session
NEXT_PUBLIC_TRIFECTA_REMOTE_CONTROL_SESSION_CODE=
ASSET_SECRET=your_secret_here
ASSET_WORKER_DOMAIN=https://assets.sthyra.com