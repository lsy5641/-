import sharp from 'sharp';
import fs from 'node:fs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="112" fill="#0a0a0a"/>
  <path d="M330 138v154a67 67 0 0 1-67 67h-11a67 67 0 0 1-67-67" fill="none" stroke="#ffffff" stroke-width="40" stroke-linecap="round"/>
  <circle cx="390" cy="144" r="23" fill="#ffffff"/>
</svg>`;

fs.mkdirSync('build', { recursive: true });
await sharp(Buffer.from(svg)).resize(512, 512).png().toFile('build/icon.png');
console.log('icon written');