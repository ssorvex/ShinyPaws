# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shiny Paws is a static production website for a pet grooming & daycare business in Pasadena, CA. No build system — all files are served directly by Netlify.

## File Structure

```
index.html            Main landing page (all sections as anchors)
admin/
  index.html          Netlify CMS (Decap CMS) admin panel — login at /admin
  config.yml          CMS config: manages data/gallery.json + image uploads
data/
  gallery.json        Gallery photo data (managed via /admin CMS)
images/
  gallery/            Uploaded gallery photos (committed to repo by CMS)
netlify.toml          Cache headers, security headers, Netlify config
shinypaws-checkout.html  Standalone booking/checkout page (Stripe integration)
```

## Architecture

**No build step.** `netlify.toml` sets `publish = "."` so Netlify serves the repo root directly.

### index.html
Single-page site with anchor-link navigation. All CSS is in a `<style>` block; all JS is at the bottom in a `<script>` block. Key runtime behaviors:
- `loadGallery()` — fetches `/data/gallery.json` on page load and renders the gallery grid. Falls back to emoji placeholders if no photos exist yet.
- Contact form — uses Netlify Forms via `fetch('/')` with `application/x-www-form-urlencoded`. The `data-netlify="true"` attribute on the `<form>` tag is detected at deploy time; no API key or backend needed.
- `window.netlifyIdentity` — redirects CMS logins to `/admin/`.

### Gallery management (CMS)
The gallery is managed through **Decap CMS** (formerly Netlify CMS) at `/admin`:
1. Enable Netlify Identity + Git Gateway in the Netlify dashboard (see Deployment section)
2. Owner logs in at `https://your-site.netlify.app/admin`
3. Upload photos and set captions through the UI
4. CMS commits the image to `images/gallery/` and updates `data/gallery.json`
5. Netlify redeploys automatically; the gallery updates within ~30 seconds

### Contact form
Netlify Forms handles delivery. After deploy, go to **Netlify Dashboard → Forms** to:
- Set the notification email address
- View all submissions

## Deployment

### First deploy
1. Push the repo to GitHub
2. Connect the repo to Netlify (Import project → GitHub → select repo)
3. Build settings: leave blank (no build command; publish directory = `.`)
4. Deploy

### Enable CMS admin (one-time)
1. Netlify Dashboard → **Identity** → Enable
2. Identity → **Registration** → set to "Invite only"
3. Identity → **Services → Git Gateway** → Enable
4. Invite yourself as a user via Identity → **Invite users**
5. Visit `/admin` and accept the invite — you can now manage gallery photos

### Contact form notifications
Netlify Dashboard → **Forms** → select "contact" form → **Form notifications** → add your email.

## Brand

```
--pink:       #F2D2D2   Ballerina Pink
--pink-light: #F8E4E4   Ballerina Pink Light
--pink-warm:  #EECFCF   Ballerina Pink Warm
--lilac:      #C9B8FF   True Lilac
--lilac-dust: #D4B8E0   Dusty Lilac
--purple:     #3D2060   Deep Purple
```
Fonts: Cormorant Garamond (headings) + Nunito (body).

## Placeholders to replace

| Placeholder | Where | What to replace with |
|---|---|---|
| `YOUR_BOOKING_URL_HERE` | `index.html` (×9), footer | The external booking system URL |
| Google Maps embed | `index.html` map section | `<iframe>` from Google Maps → Share → Embed |
| Hero image | `index.html` `.orb-emoji` comment | `<img class="orb-img" src="/images/hero-dog.jpg">` |
| About image | `index.html` `.ab-emoji` comment | `<img src="/images/about-studio.jpg">` |
| `og-image.jpg` | SEO meta tags | 1200×630px social share image in `/images/` |
| `@shinypaws` Instagram handle | footer, instagram section | Real handle |
| Social media URLs | footer | Real Instagram/TikTok/Facebook URLs |

## Domain

Production domain: `shinypawsla.com`
