# Design System Strategy: The Kinetic Path

> **Canonical implementation:** [`css/styles.css`](css/styles.css)  
> All UI styling for ResQFood lives in that single file. Tokens, components, and rules below are the source of truth; `styles.css` implements them. Do not add parallel stylesheets (`main.css`, `variables.css`, etc.).

## 1. Overview & Creative North Star
This design system is anchored by the Creative North Star: **"The Urban Pulse."** 

Unlike traditional public utility apps that feel clinical and rigid, this system treats the commute as a living, breathing editorial experience. We are moving away from the "standard grid of boxes" toward a layout that feels fluid and intentional. By leveraging **Manrope** for authoritative, editorial-style headings and **Inter** for high-legibility utility, we create a "Premium Utility" aesthetic. 

The design breaks the "template" look through **intentional asymmetry** and **tonal depth**. We prioritize breathing room (whitespace) over containment lines, ensuring the app feels like a high-end concierge service rather than a basic mapping tool.

---

## 2. Colors & Atmospheric Depth
Our palette transitions from the deep, authoritative foundations of the city to the vibrant, kinetic energy of its movement.

### The Foundation
*   **Primary (`#00193c`):** Use for high-impact brand moments and structural anchors.
*   **Primary Container (`#0a2e5d`):** Our core "Trustworthy Blue." Use for active states and primary action surfaces.
*   **Secondary (`#705d00` / `#fcd400`):** The energetic "Jeepney Yellow." This is a high-visibility accent. Use sparingly for highlights, status indicators, and kinetic elements (like a moving vehicle on a map).

### The Rules of Engagement
*   **The "No-Line" Rule:** We do not use 1px solid borders to section content. Boundaries must be defined solely through background color shifts. For example, a `surface-container-low` card sitting on a `surface` background provides all the separation needed.
*   **Surface Hierarchy:** Treat the UI as stacked sheets of fine paper. Use the `surface-container` tiers (Lowest to Highest) to create nested depth.
    *   *Example:* A `surface-container-lowest` card placed inside a `surface-container-low` section creates a soft, natural lift.
*   **The "Glass & Gradient" Rule:** To avoid a flat, "out-of-the-box" feel, use Glassmorphism for floating elements (e.g., bottom navigation or floating action buttons) using semi-transparent surface colors and a `backdrop-blur` of 12px.
*   **Signature Textures:** Use subtle linear gradients (e.g., `primary` to `primary_container`) for main CTAs. This adds a "soul" and professional polish that flat hex codes cannot achieve.

---

## 3. Typography: Editorial Authority
We use a dual-font strategy to balance character with functionality.

*   **Display & Headlines (Manrope):** This is our "Editorial" voice. Use wide tracking and bold weights for `display-lg` through `headline-sm`. This font conveys the "Modern" and "Trustworthy" pillars.
*   **Body & Labels (Inter):** Our "Utility" voice. Chosen for its mathematical precision and readability at small sizes. 
*   **The Hierarchy:** 
    *   **Large Headlines:** Use `headline-lg` (Manrope) for screen titles to anchor the user's focus.
    *   **Micro-Copy:** Use `label-sm` (Inter) in all-caps with +5% letter spacing for secondary metadata to create a premium, "dashboard" feel.

---

## 4. Elevation & Depth: Tonal Layering
We reject heavy drop shadows. Depth is achieved through "Atmospheric Perspective."

*   **The Layering Principle:** Stacking color tokens is our primary method of elevation. 
    *   Base: `surface`
    *   Section: `surface-container-low`
    *   Card: `surface-container-lowest`
*   **Ambient Shadows:** If a "floating" effect is mandatory (e.g., a map marker), use a shadow with a blur radius of 24px and an opacity of 4%–6%. The shadow color must be a tinted version of `on-surface`, never pure black.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline-variant` token at 15% opacity. **100% opaque borders are strictly prohibited.**
*   **Glassmorphism:** For top-level overlays, use a background of `surface_container_lowest` at 80% opacity with a `backdrop-blur(16px)`. This integrates the component into the environment rather than making it look "pasted on."

---

## 5. Components: Functional Elegance

### Buttons
*   **Primary:** High-contrast `primary` background with `on_primary` text. Use the `xl` (1.5rem) roundedness for a friendly, approachable feel.
*   **Secondary:** `secondary_container` background. This is our "Jeepney" highlight. Use for high-importance actions that aren't the main path (e.g., "Reload Credits").

### Cards & Lists
*   **Forbid Dividers:** Do not use lines to separate list items. Use 16px or 24px of vertical white space or subtle alternating background shifts between `surface-container-low` and `surface-container-high`.
*   **Asymmetric Cards:** Experiment with slightly larger padding on the "leading" side of cards to drive the eye toward the content.

### Inputs
*   **Text Fields:** Use `surface_container_highest` for the input background. Transitions should be seamless; on focus, increase the background brightness rather than adding a thick border.

### Context-Specific Components
*   **The Kinetic Tracker:** A custom component for arrival times. Use a `secondary` yellow pulse animation against a `primary_container` blue background to signify "live" data.
*   **Route Chips:** Use `secondary_fixed` for route numbers to make them instantly scannable against the `surface` colors.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use Manrope for all large numbers (ETA, Price, Distance) to give them an authoritative, high-end feel.
*   **Do** use "Soft Transitions" (300ms ease-in-out) for all state changes to maintain the "Friendly" brand pillar.
*   **Do** prioritize `surface_container` shifts over lines to define your grid.

### Don't
*   **Don't** use pure black (`#000000`) for text. Stick to the `on_surface` or `primary` tokens to maintain tonal depth.
*   **Don't** use the 8px (`DEFAULT`) radius for everything. Use `full` (pill-shaped) for tags and `xl` for large cards to create a more sophisticated visual rhythm.
*   **Don't** crowd the screen. If a screen feels full, increase the white space by 20% and use a scrollable "Layered Sheet" pattern instead.