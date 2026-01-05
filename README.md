# Signal Lost: The Last Relay (Web)

Terminal-style browser version of the text game.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

This repo is configured for GitHub Pages via **GitHub Actions**. After pushing to `main`:

1. In GitHub repo settings: **Settings → Pages**
2. Set **Source** to **GitHub Actions**

The workflow automatically sets the Vite base path to `/<repo>/` during CI build.

## Commands

- `help`
- `status`
- `scan`
- `repair <antenna|cooling|beacon|ai|docking>`
- `reroute <antenna|cooling|beacon|ai|docking>`
- `rest`
- `override`
- `tx` (only during external signal window)
- `restart [seed]`

You can also start with a specific seed using `?seed=123` in the URL.
