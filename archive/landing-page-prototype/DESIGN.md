# Design System Document: The Humanitarian Editorial

## 1. Overview & Creative North Star
**Creative North Star: "The Organic Curator"**

This design system is built to move beyond the cold, utilitarian feel of typical logistics platforms. It adopts an "Editorial Humanitarian" aesthetic—blending the warmth of a community-focused magazine with the precision of a high-end digital tool. 

To break the "template" look, we employ **Intentional Asymmetry** and **Tonal Depth**. Instead of rigid, boxed-in grids, we use expansive whitespace and overlapping elements to create a sense of movement and life. The system prioritizes "breathing room," ensuring that the mission of food rescue feels urgent yet calm, professional yet deeply human.

---

## 2. Colors & Surface Philosophy

The palette is rooted in the "Fresh Forest" primary and "Warm Orange" accents, but its sophistication lies in the neutral "Surface" tiers that create a sense of physical layering.

### The "No-Line" Rule
**Explicit Instruction:** 1px solid borders are strictly prohibited for sectioning or containment. Boundaries must be defined solely through background color shifts. For example, a `surface-container-low` section should sit directly on a `surface` background to create a soft, edge-less transition.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, high-quality papers. 
- **Base Layer:** `surface` (#f9f9f9)
- **Content Blocks:** `surface-container-low` (#f3f3f3)
- **Elevated Cards:** `surface-container-lowest` (#ffffff) for maximum "pop" and perceived cleanliness.

### The "Glass & Gradient" Rule
To add soul to the interface, avoid flat blocks of color for high-impact areas.
- **Hero Backgrounds:** Use subtle linear gradients transitioning from `primary` (#396632) to `primary-container` (#518048) at a 135-degree angle.
- **Floating Elements:** Use Glassmorphism for navigation bars or overlaying labels. Apply `surface-container-lowest` at 80% opacity with a `backdrop-blur` of 20px.

---

## 3. Typography: The Editorial Voice

We utilize a pairing of **Plus Jakarta Sans** for expressive moments and **Inter** for functional clarity.

- **Display & Headlines (Plus Jakarta Sans):** These are the "voice" of the system. Use `display-lg` for hero statements with tight tracking (-2%) to create an authoritative, editorial feel.
- **Titles & Body (Inter):** Inter provides a professional, "humanitarian-standard" legibility. 
- **Visual Hierarchy:** Use `headline-sm` in `primary` color to draw attention to community stories, while using `body-md` in `on-surface-variant` (#3f4a3b) for secondary descriptions to reduce visual noise.

---

## 4. Elevation & Depth: Tonal Layering

Traditional drop shadows are often too "digital." We use **Ambient Depth** to create a premium feel.

- **The Layering Principle:** Depth is achieved by stacking. Place a `surface-container-lowest` card (Pure White) on a `surface-container-low` background. The contrast alone provides the "lift."
- **Ambient Shadows:** When a float is required (e.g., a primary CTA button), use a diffused shadow: `box-shadow: 0 20px 40px rgba(26, 28, 28, 0.06);`. The shadow color must be a tint of `on-surface`, never pure black.
- **The "Ghost Border" Fallback:** If a border is required for accessibility, use `outline-variant` (#becab7) at 15% opacity. It should be felt, not seen.
- **Roundedness Scale:** All main containers must use `lg` (2rem/32px) or `md` (1.5rem/24px) corners to maintain the "Soft Minimalism" aesthetic.

---

## 5. Components

### Buttons (The "Call to Action")
- **Primary:** `secondary` (#914d00) background with `on-secondary` (#ffffff) text. Use a subtle gradient from `secondary` to `secondary-container` for a high-end "glow."
- **Secondary:** `primary` (#396632) background with `on-primary` text. Large `full` (9999px) or `md` (1.5rem) rounded corners.
- **Tertiary:** No background. Use `primary` text with a `label-md` weight.

### Cards & Feed Items
- **Rule:** No dividers. Use `1.5rem` (md) vertical spacing between elements. 
- **Composition:** Images should have `xl` (3rem) rounded corners on one or two opposing corners to create a custom, asymmetrical "signature" look.

### Input Fields
- **Background:** `surface-container-high` (#e8e8e8).
- **Shape:** `md` roundedness. 
- **State:** On focus, transition the background to `surface-container-lowest` and add a 2px `primary` ghost-border (20% opacity).

### Chips & Tags
- Use `primary-fixed` (#bcf0ae) for donor tags and `secondary-fixed` (#ffdcc3) for urgent food rescue alerts. These soft, pastel-like backgrounds keep the UI friendly.

---

## 6. Do’s and Don’ts

### Do
- **Do** use large amounts of whitespace (up to 80px or 100px between major sections) to convey a premium, "curated" feel.
- **Do** use high-quality, warm-toned photography of real community interactions.
- **Do** overlap images over the edge of container backgrounds to break the "grid."

### Don’t
- **Don't** use 1px solid lines to separate content; it creates a "cheap" or "boxed-in" feeling.
- **Don't** use pure black (#000000) for text. Always use `on-surface` (#1a1c1c).
- **Don't** use sharp corners. Everything in this system is soft and approachable.
- **Don't** crowd the interface. If an element isn't serving the humanitarian mission, remove it.