@AGENTS.md
# MAAMAR frontend rules

## Colors and style
- Use only the colors, radii and shadows defined in app/globals.css. Never hardcode hex colors or pixel sizes.
- Brand colors come from the logo: navy (text, selected states) and gold (primary actions, accents).
- Primary buttons are gold with navy text. Never put white text on gold.
- Use text-gold-700 for links on light backgrounds. Gold-500 is for fills and decoration only.
- Cards use a thin border and no shadow. Shadows are only for modals and dropdowns.

## Language and direction
- Every screen supports Arabic (RTL) and English (LTR).
- All visible text goes in lib/i18n.tsx (app screens) or lib/landing-copy.ts (landing page), in both languages. Never write text directly inside a screen.
- Use logical classes (ms-, me-, ps-, pe-, start-, end-, text-start) instead of left/right. Icons that show direction use the flip-rtl class.

## Components and structure
- Shared components live in components/. Check there before creating a new one.
- Screens inside app/(auth) and app/(app) already get their frame (logo and header) from the layout. Do not add another.
- Do not edit globals.css or shared components without agreeing with the team first.