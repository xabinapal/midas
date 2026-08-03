---
version: alpha
name: Sveltekeleton
description: A minimal, accessible starting point. The UI is composed from daisyUI components on Tailwind v4; the tokens below are the brand layer on top of daisyUI's default theming.
colors:
  primary: "#f97316"
  on-primary: "#ffffff"
  base: "#ffffff"
  text: "#1f2937"
typography:
  body:
    fontFamily: system-ui
    fontSize: 1rem
    lineHeight: 1.5
  h1:
    fontFamily: system-ui
    fontSize: 2.25rem
    fontWeight: 700
    lineHeight: 1.2
rounded:
  sm: 4px
  md: 8px
  lg: 16px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: 8px 16px
  panel:
    backgroundColor: "{colors.base}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
---

## Overview

Sveltekeleton is a minimal, accessible boilerplate. Screens are composed from
**daisyUI** components on Tailwind v4; daisyUI supplies the full component
catalog and its default light/dark themes. The tokens in this file are the brand
layer on top — primarily a single warm-orange accent used for brand marks and
calls to action. This file is the normative source for these brand values.

## Colors

The palette is intentionally small: a brand accent plus neutral surfaces.
daisyUI owns the wider semantic range (secondary, accent, success, warning,
error, info, neutral, base tiers); the values here are the brand specifics that
distinguish this project.

- **Primary (#f97316):** warm orange — the brand accent. It is already used for
  the favicon, web manifest, and `theme-color` meta. Use it for the main call to
  action and brand marks. (It is a bright accent — verify text contrast when
  pairing it; `on-primary` is the intended content color.)
- **On-primary (#ffffff):** content placed on top of `primary`.
- **Base (#ffffff):** page surface.
- **Text (#1f2937):** default body text on light surfaces.

## Typography

A system font stack keeps the skeleton dependency-free and native on every
platform. Two scales are defined: body copy at 1rem/1.5 and an h1 at
2.25rem/700. Reuse the system stack rather than introducing a webfont unless the
project explicitly adopts one.

## Components

daisyUI is the component library — prefer its components over hand-rolled markup
(the coding rule lives in `AGENTS.md`). The component tokens here show how brand
tokens compose into primitives:

- **button-primary:** `primary` background, `on-primary` text, medium radius.
- **panel:** `base` surface, `text` content, large radius and generous padding.

## Do's and Don'ts

- **Do** use `colors.primary` for the main call to action and brand accents.
- **Do** add a token here first when the design needs a new value, then
  reference it — don't invent one-off colors in markup.
- **Don't** introduce colors outside this palette without defining them as tokens.
- **Don't** replace daisyUI's accessible primitives with raw elements.
