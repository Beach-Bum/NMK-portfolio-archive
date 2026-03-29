#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Paths
const contentDir = path.join(__dirname, '..', 'content');
const projectsJsonPath = path.join(__dirname, 'projects.json');
const indexHtmlPath = path.join(__dirname, 'index.html');

// Build mapping of Squarespace URL -> GitHub raw URL
console.log('Building URL mapping from content files...');
const urlMap = {};
let foundCount = 0;

// Scan all content subdirectories
const sections = fs.readdirSync(contentDir).filter(
  f => fs.statSync(path.join(contentDir, f)).isDirectory()
);

sections.forEach(section => {
  const sectionPath = path.join(contentDir, section);
  const files = fs.readdirSync(sectionPath).filter(f => f.endsWith('.json'));

  files.forEach(file => {
    const filePath = path.join(sectionPath, file);
    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (content.images && Array.isArray(content.images)) {
        content.images.forEach(img => {
          if (img.url && img.localPath) {
            const githubUrl = `https://raw.githubusercontent.com/Beach-Bum/NMK-portfolio-archive/main/${img.localPath}`;
            urlMap[img.url] = githubUrl;
            foundCount++;
          }
        });
      }
    } catch (e) {
      console.warn(`Error parsing ${filePath}: ${e.message}`);
    }
  });
});

console.log(`Found ${foundCount} image URLs in content files`);
console.log(`Created mapping for ${Object.keys(urlMap).length} unique URLs\n`);

// Function to check if URL is favicon.ico
function isFavicon(url) {
  return url.includes('favicon.ico');
}

// Function to convert URL
function convertUrl(url) {
  if (urlMap[url]) {
    return urlMap[url];
  }
  console.warn(`WARNING: No mapping found for URL: ${url}`);
  return url;
}

// Process projects.json
console.log('Processing projects.json...');
const projectsJson = JSON.parse(fs.readFileSync(projectsJsonPath, 'utf8'));
let projectsModified = 0;

projectsJson.forEach(project => {
  // Convert hoverImage
  if (project.hoverImage) {
    if (isFavicon(project.hoverImage)) {
      console.warn(`Favicon in hoverImage for "${project.title}" - keeping as is`);
    } else {
      project.hoverImage = convertUrl(project.hoverImage);
      projectsModified++;
    }
  }

  // Convert images array, filtering out favicons
  if (project.images && Array.isArray(project.images)) {
    const originalLength = project.images.length;
    project.images = project.images
      .filter(url => {
        if (isFavicon(url)) {
          console.warn(`Removing favicon from images in "${project.title}"`);
          return false;
        }
        return true;
      })
      .map(url => convertUrl(url));

    if (project.images.length < originalLength) {
      projectsModified++;
    }
  }
});

fs.writeFileSync(projectsJsonPath, JSON.stringify(projectsJson, null, 2) + '\n');
console.log(`Modified ${projectsModified} project entries\n`);

// Process index.html
console.log('Processing index.html...');
let htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
let htmlModified = 0;

// Find all data-image attributes and replace them
const dataImageRegex = /data-image="([^"]+)"/g;
htmlContent = htmlContent.replace(dataImageRegex, (match, url) => {
  if (isFavicon(url)) {
    console.warn(`Favicon in data-image: ${url} - keeping as is`);
    return match;
  }
  const newUrl = convertUrl(url);
  htmlModified++;
  return `data-image="${newUrl}"`;
});

fs.writeFileSync(indexHtmlPath, htmlContent);
console.log(`Modified ${htmlModified} data-image attributes\n`);

console.log('Done!');
console.log(`Total modifications: ${projectsModified + htmlModified}`);
