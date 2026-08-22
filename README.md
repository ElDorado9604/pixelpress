# Pixelpress

Compress images in the browser. Files never leave the device.

Drop JPEG, PNG, WebP, GIF, BMP, or AVIF files, pick a quality or a target size, then download one file or a zip of the queue. Encoding, resizing, and format conversion all happen locally.

## Deploy on Cloudflare Pages

This repo is a static Vite app. The production output is plain HTML, CSS, and JS.

1. Open [Cloudflare Dashboard → Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
2. **Create** → **Pages** → **Connect to Git**
3. Authorize GitHub if needed, then select **pixelpress**
4. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variable:** `NODE_VERSION` = `22`
5. **Save and Deploy**

Cloudflare will rebuild on every push to `main`. After the first deploy you can attach a custom domain from the project's Custom domains tab.

## Local

```bash
npm install
npm run dev
```
