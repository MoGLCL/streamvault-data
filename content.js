// Andro StreamVault - Content Script
function detectPlatform(url) {
  if (url.includes('netflix.com')) return 'netflix';
  if (url.includes('primevideo.com') || (url.includes('amazon.com') && url.includes('/gp/video'))) return 'prime';
  if (url.includes('max.com') || url.includes('hbomax.com')) return 'max';
  if (url.includes('disneyplus.com')) return 'disney';
  if (url.includes('paramountplus.com')) return 'paramount';
  if (url.includes('hulu.com')) return 'hulu';
  if (url.includes('tv.apple.com')) return 'appletv';
  if (url.includes('peacocktv.com')) return 'peacock';
  if (url.includes('crunchyroll.com')) return 'crunchyroll';
  return null;
}
const p = detectPlatform(window.location.href);
if (p) chrome.runtime.sendMessage({ action: 'platformDetected', platform: p });
