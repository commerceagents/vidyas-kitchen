# Putting Vidya's Kitchen on the Play Store

The app on Google Play is the same website in a native shell — a Trusted Web
Activity (TWA). Nothing is rewritten: Play downloads a small Android wrapper
that opens `vidyaskitchenhome.com` full-screen, with no address bar, and every
deploy we ship updates the app instantly without a new Play release.

The code side is already done. What is left is a Play Console account, one
build command, and two environment variables.

## What the site already provides

| Piece | Where |
| --- | --- |
| Installable manifest | `/manifest.webmanifest?mobile=1` (the `?mobile=1` forces the app variant; without it, desktop tools get a deliberately non-installable manifest) |
| Icons (192, 512, maskable) | `public/icon-*.png`, listed in `src/lib/customer-manifest.ts` |
| Domain ownership proof | `/.well-known/assetlinks.json`, generated from env by `src/app/.well-known/assetlinks.json/route.ts` |
| Privacy policy URL (Play requires one) | `https://vidyaskitchenhome.com/privacy` |
| Play Store link on the desktop page | `NEXT_PUBLIC_PLAY_STORE_URL`, read by `DesktopLanding.tsx` |

## Step 1 — Play Console account

<https://play.google.com/console/signup> · ₹2,000-ish one-time (US$25).

Choose **Personal** unless the business is registered; a personal account needs
ID verification, an organisation account needs a D-U-N-S number. Verification
usually clears in a day or two.

> A personal account opened after late 2023 must run a **closed test with 12
> testers for 14 continuous days** before Google unlocks production. Start that
> clock early — it is the longest part of this whole process.

## Step 2 — Build the app bundle

Needs Node 18+ and a JDK; Bubblewrap installs the Android SDK itself on first
run.

```bash
npm install -g @bubblewrap/cli

bubblewrap init --manifest="https://vidyaskitchenhome.com/manifest.webmanifest?mobile=1"
```

Answers that matter:

- **Application ID / package**: `com.vidyaskitchen.app` (must match
  `ANDROID_PACKAGE_NAME` below, and can never change once published)
- **Display mode**: `standalone`
- **Signing key**: let Bubblewrap create `android.keystore`, then **back that
  file and its passwords up somewhere permanent**

```bash
bubblewrap build
```

This produces `app-release-bundle.aab` — that is the file Play wants.

## Step 3 — Create the listing

In Play Console: **Create app** → name `Vidya's Kitchen`, type App, free.

Upload the `.aab` to **Internal testing** first (it installs within minutes and
proves the wrapper works before anyone else sees it). Then fill in, under
Dashboard, the items Play blocks release on:

- Store listing: short + full description, 512×512 icon, 1024×500 feature
  graphic, at least 2 phone screenshots
- Privacy policy: `https://vidyaskitchenhome.com/privacy`
- Data safety: the app collects name, phone, address and location for delivery;
  none of it is sold
- Content rating questionnaire, target audience (18+), ads declaration (no ads)

## Step 4 — Wire the fingerprint back to the site

Play re-signs the app with its own key, so the fingerprint that must be
published is **Google's**, not the local keystore's.

Play Console → **Test and release → Setup → App signing** → copy the SHA-256
under *App signing key certificate*.

Then set on Vercel (Production) and redeploy:

```
ANDROID_PACKAGE_NAME=com.vidyaskitchen.app
ANDROID_SHA256_FINGERPRINTS=AA:BB:CC:…:FF
NEXT_PUBLIC_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=com.vidyaskitchen.app
```

`ANDROID_SHA256_FINGERPRINTS` takes a comma-separated list, so the local upload
key can sit alongside Google's while testing a locally built APK.

Check it took:

```bash
curl https://vidyaskitchenhome.com/.well-known/assetlinks.json
```

An empty `[]` means the fingerprint is missing or malformed — the route only
publishes values shaped like `AA:BB:…` (32 hex pairs), because a wrong
fingerprint fails exactly like a missing one but is far harder to spot.

## Step 5 — Confirm it looks native

Install from the internal testing link and check:

- No Chrome address bar at the top. If there is one, asset links did not
  verify — re-check the fingerprint and that the file is served over HTTPS at
  the apex domain.
- Splash screen shows the logo, not a white flash
- Back gesture moves through app history instead of closing the app

Once `NEXT_PUBLIC_PLAY_STORE_URL` is set, the Android tab on the desktop
landing page automatically points its QR at the Play listing instead of the
"install from Chrome" page. Nothing else needs changing.

## iPhone

Apple does not accept wrapped web apps that add nothing native, so iOS stays on
"Add to Home Screen" from Safari — which is what the iPhone tab on the desktop
page explains. The installed result is the same full-screen app, just delivered
by Safari rather than the App Store.
