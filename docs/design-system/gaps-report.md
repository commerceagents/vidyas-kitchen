# Design system PDF gaps

Generated 9 Oct 2026. These items are absent from the repo, so the PDF does not invent a value for them.

- ForkKnife: rendered size not found next to the import in src/components/ui/mobile/CheckoutScreen.tsx
- LayoutDashboard: rendered size not found next to the import in src/components/dashboard/DashboardMobileNav.tsx
- TrendingUp: rendered size not found next to the import in src/components/dashboard/DashboardMobileNav.tsx
- Named spacing scale for the driver app: not found. Driver theme exports RADIUS only.
- Named spacing scale for the dashboard: not found. Sidebar uses literal padding 12px 16px and gap 4px.
- Breakpoint token file: not found. Dashboard layout uses literal #0d0d0d and component widths 240px / 72px.
- Opacity token table beyond customer text: driver muted is rgba(255,255,255,0.46) and faint is rgba(255,255,255,0.28). A shared opacity scale file does not exist.
- Motion duration token file: not found. Durations live on components (0.15s, 0.2s, 0.22s, 0.25s, 0.28s, 0.35s, 0.45s).
- #CC1C1C does not appear in this repository. Product brand red is #BD2320.
- Annotated screens are harness composites styled from source files. The PDF build does not boot the Next.js app, so these are not production screenshots.

## Measured components

- s-btn: 220×56px, radius 20px, padding 16px 24px, font 15px / 800
- s-size: 108×72px, radius 16px, padding 0px, font 15px / 800
- s-otp: 48×56px, radius 16px, padding 0px, font 26px / 800
- s-card: 220×193px, radius 28px, padding 10px, font 16px / 700
- s-chip: 66×24px, radius 8px, padding 4px 8px, font 10px / 800
- s-tabs: 280×64px, radius 24px, padding 8px 12px, font 10px / 800
- s-bill: 260×72px, radius 0px, padding 0px, font 14px / 600
- s-job: 280×103px, radius 18px, padding 14px, font 22px / 800
- s-collect: 280×81px, radius 16px, padding 14px 16px, font 28px / 800
- s-reach: 280×60px, radius 14px, padding 0px, font 16px / 800
- s-swipe: 280×60px, radius 14px, padding 0px, font 15px / 800
- s-side: 240×116px, radius 16px, padding 12px, font 14px / 600
- s-yellow: 125×44px, radius 12px, padding 0px 16px, font 14px / 700
- s-stat: 160×86px, radius 16px, padding 14px, font 28px / 800
- s-phone: 390×463px, radius 0px, padding 12px, font 16px / 700

## Fonts

```
AAAAAA+Outfit-Thin_Bold
BAAAAA+Outfit-Thin_ExtraBold
CAAAAA+Outfit-Thin_Medium
DAAAAA+Outfit-Thin_Bold
EAAAAA+Outfit-Thin_Bold
FAAAAA+Outfit-Thin_ExtraBold
GAAAAA+Outfit-Thin_wght28A0000
HAAAAA+Outfit-Thin_ExtraBold
IAAAAA+Outfit-Thin_SemiBold
JAAAAA+Outfit-Thin_SemiBold
KAAAAA+Outfit-Thin_ExtraBold
LAAAAA+Outfit-Thin_Medium
MAAAAA+Outfit-Thin_SemiBold
NAAAAA+Outfit-Thin_Medium
OAAAAA+Outfit-Thin_SemiBold
PAAAAA+Outfit-Thin_Bold
QAAAAA+Outfit-Thin_Bold
RAAAAA+Outfit-Thin_ExtraBold
SAAAAA+Outfit-Thin_ExtraBold
TAAAAA+Outfit-Thin_Black
UAAAAA+Outfit-Thin_Black
VAAAAA+Outfit-Thin_Bold
WAAAAA+Outfit-Thin_Bold
XAAAAA+Outfit-Thin_Regular
YAAAAA+Outfit-Thin_ExtraBold
ZAAAAA+Outfit-Thin_ExtraBold
ABAAAA+Outfit-Thin_ExtraBold
BBAAAA+Outfit-Thin_ExtraBold
CBAAAA+Outfit-Thin_ExtraBold
DBAAAA+Outfit-Thin_SemiBold
EBAAAA+Outfit-Thin_ExtraBold
FBAAAA+Outfit-Thin_SemiBold
GBAAAA+Outfit-Thin_wght28A0000
HBAAAA+Outfit-Thin_SemiBold
```
