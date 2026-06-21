# Golf Ruler

A mobile-first map ruler for measuring golf distances with two or three draggable points.

## Local development

```bash
npm install
npm run dev
```

Open the printed local URL. Browser geolocation requires HTTPS in production (localhost is allowed during development).

## Checks

```bash
npm test
npm run lint
npm run build
```

## Railway

- Build command: `npm run build`
- Start command: `npm start`

The start command serves `dist` on Railway's `$PORT`. For a static-hosting deployment, publish the `dist` directory directly instead.
