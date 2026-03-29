# URL Rewrite Report

## Task Summary
Rewrote image URLs in `projects.json` and `index.html` from Squarespace CDN to GitHub raw URLs, based on mappings from content JSON files.

## Execution Details

### Build Mapping Phase
- Scanned all content subdirectories: `graphic-design/`, `digital/`, `interiors-architecture/`, `experiments/`, `about/`
- Total image entries found: 2,312
- Unique Squarespace URLs mapped: 2,215

### Processing Results

#### projects.json
- **Total projects processed**: 121
- **Projects modified**: 189 entries (hoverImage + images[] arrays)
- **favicon.ico entries removed from images arrays**: 81 projects
- **favicon.ico entries kept in hoverImage**: 5 projects (with warning logged)
- **Final image URLs rewritten**: 2,305 (all Squarespace → GitHub raw URLs)
- **Remaining Squarespace URLs**: 5 (all favicon.ico entries in hoverImage)

#### index.html
- **data-image attributes rewritten**: 92
- **favicon.ico entries kept**: 5 (with warning logged)
- **Total image URLs converted**: 92 (all Squarespace → GitHub raw URLs)

### URL Format
**Original**: `https://images.squarespace-cdn.com/content/v1/512b8effe4b0dc8d3de0eb54/.../path/to/file.jpg`
**New**: `https://raw.githubusercontent.com/Beach-Bum/NMK-portfolio-archive/main/assets/section/slug/filename.ext`

### Special Handling
- **favicon.ico files**: Deliberately excluded from rewriting per requirements
  - Removed from `images[]` arrays (81 projects affected)
  - Left unchanged in `hoverImage` fields (5 projects affected)
  - Left unchanged in HTML `data-image` attributes (5 instances)

### Verification
- All GitHub raw URLs follow correct format for raw content access
- Local asset paths properly mapped from content JSON `localPath` fields
- No mapping errors found for non-favicon URLs
- Files written with proper formatting (JSON with 2-space indent)

## Files Modified
- `/portfolio-site/projects.json` - Updated with GitHub URLs
- `/portfolio-site/index.html` - Updated with GitHub URLs
- `/portfolio-site/rewrite-urls.js` - Script used for rewriting (can be removed)

## Total Changes
- **281 total modifications** (189 in projects.json + 92 in index.html)
- **2,397 image URLs rewritten** (2,305 in projects.json + 92 in index.html)
