# NMK Portfolio Archive

Exported from Squarespace on 2026-03-29.

## Stats
- **99** projects
- **2319** images
- **3** videos
- **5** sections

## Sections
- **Graphic Design / Creative Direction**: 62 projects, 1265 images
- **Interiors / Architecture**: 18 projects, 356 images
- **Digital**: 8 projects, 449 images
- **Experiments**: 10 projects, 247 images
- **_root**: 1 projects, 2 images

## Structure
```
content/           # Markdown + JSON per project
  graphic-design/
  interiors-architecture/
  digital/
  experiments/
  about/
assets/            # Downloaded images organized by section/project
  graphic-design/
    nike-tech-pack/
    nike-x-off-white/
    ...
  interiors-architecture/
  digital/
  experiments/
  about/
manifest.json      # Full site manifest
```

## Setup
To download all images:
```bash
chmod +x download-all-assets.sh
bash download-all-assets.sh
```
