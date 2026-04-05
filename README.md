# Stitch Prompt Optimiser

A Chrome extension that adds an **Optimise** button to [Google Stitch](https://stitch.withgoogle.com/), transforming rough prompts into structured, high-quality prompts that produce better UI designs.

Powered by **Gemini 3 Flash Preview** via the Google AI Studio API.

![Stitch Prompt Optimiser in action](assets/screenshot.png)

## What it does

When you type a casual prompt like:

> A modern, brutalist, football club website for Alcester Town Football Club, using their club colours but imposing a sense of excitement, thrill, success and teamwork. Bright contrasting colours.

The extension rewrites it into a structured prompt following all official Stitch best practices:

> A bold, brutalist football club website for Alcester Town FC. Raw, high-contrast design with heavy typography and stark geometric shapes conveying excitement, intensity and squad unity.
>
> DESIGN SYSTEM:
> - Platform: Web, Desktop-first
> - Theme: Light with high-contrast accents, brutalist, raw, confrontational
> - Background: Clean White (#ffffff)
> - Primary Accent: Alcester Gold (#FFD700) for call-to-action buttons and highlights
> - Secondary Accent: Alcester Red (#C8102E) for headers and accent bars
> - Text Primary: Near Black (#111827) for body text
> - Text Secondary: Dark Grey (#374151) for captions
> - Typography: Heavy, condensed sans-serif headings; clean body font
> - Buttons: Sharp corners (0px radius), bold uppercase labels
> - Cards: No border-radius, strong borders, high-contrast shadows
>
> PAGE STRUCTURE:
> 1. Navigation bar: Club crest on left, bold uppercase menu items (Home, Fixtures, Squad, News, Contact), sharp-edged active states in gold
> 2. Hero section: Full-width action photography of match day, large condensed headline overlaid ("This is Alcester Town"), primary CTA button "View Fixtures"
> ...

This structured format dramatically improves Stitch's output quality.

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** and select the `stitch-optimiser` folder
5. Click the extension icon in your toolbar and enter your [Google AI Studio API key](https://aistudio.google.com/apikey)

## Usage

1. Go to [stitch.withgoogle.com](https://stitch.withgoogle.com/)
2. Type your prompt as normal in the input field
3. Click the **✦ Optimise** button (appears next to the App/Web toggle)
4. Review the enhanced prompt — it preserves all your original details
5. Click **Generate designs** as normal

## How it optimises

The extension applies the following techniques from the [official Stitch Prompt Guide](https://discuss.ai.google.dev/t/stitch-prompt-guide/83844):

- **Structured sections** — organises into Design System + Page Structure format
- **UI/UX keywords** — replaces vague terms with precise component names
- **Vibe amplification** — expands terse adjectives into richer visual descriptions
- **Colour formatting** — resolves brand colours to hex values with functional roles
- **Platform inference** — adds Web/Mobile and Desktop/Mobile-first context
- **Imagery guidance** — describes the style of images where relevant
- **Length control** — keeps output under 2500 characters to avoid Stitch omitting components

## API key & privacy

- Your API key is stored locally in Chrome's extension storage (`chrome.storage.local`)
- It is sent only to `generativelanguage.googleapis.com` (Google's Gemini API)
- No data is sent to any third-party server
- No analytics or tracking

## Cost

Gemini 3 Flash Preview has a free tier on Google AI Studio. Each optimisation call uses roughly 500–1000 input tokens and 500–800 output tokens, so the cost at paid rates would be fractions of a penny per use.

## Files

```
stitch-optimiser/
├── manifest.json      # Extension manifest (Manifest V3)
├── content.js         # Injected script — button + Gemini API logic
├── content.css        # Button and toast notification styles
├── popup.html         # API key management popup
├── popup.js           # Popup logic
├── assets/
│   └── screenshot.png
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Requirements

- Chrome 88+ (Manifest V3 support)
- A Google AI Studio API key ([get one free](https://aistudio.google.com/apikey))
