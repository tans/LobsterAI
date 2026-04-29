#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

const projectRoot = path.resolve(__dirname, '..');
const inputPath = path.resolve(projectRoot, process.argv[2] || 'public/logo.png');
const outputDir = path.resolve(projectRoot, 'resources/tray');

function packIco(entries) {
  const headerSize = 6;
  const entrySize = 16;
  const count = entries.length;
  const dataOffset0 = headerSize + entrySize * count;

  let currentOffset = dataOffset0;
  const withOffsets = entries.map((entry) => {
    const next = { ...entry, offset: currentOffset, dataSize: entry.data.length };
    currentOffset += entry.data.length;
    return next;
  });

  const ico = Buffer.alloc(currentOffset);
  ico.writeUInt16LE(0, 0);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(count, 4);

  withOffsets.forEach((entry, index) => {
    const off = headerSize + index * entrySize;
    ico.writeUInt8(entry.size >= 256 ? 0 : entry.size, off + 0);
    ico.writeUInt8(entry.size >= 256 ? 0 : entry.size, off + 1);
    ico.writeUInt8(0, off + 2);
    ico.writeUInt8(0, off + 3);
    ico.writeUInt16LE(1, off + 4);
    ico.writeUInt16LE(32, off + 6);
    ico.writeUInt32LE(entry.dataSize, off + 8);
    ico.writeUInt32LE(entry.offset, off + 12);
  });

  withOffsets.forEach((entry) => {
    entry.data.copy(ico, entry.offset);
  });

  return ico;
}

async function resizePng(baseImage, size) {
  const img = baseImage.clone().resize({ w: size, h: size });
  return img.getBuffer('image/png');
}

async function main() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input logo not found: ${inputPath}`);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const logo = await Jimp.read(inputPath);

  // Linux tray
  const tray48 = await resizePng(logo, 48);
  fs.writeFileSync(path.join(outputDir, 'tray-icon.png'), tray48);

  // Windows tray ico
  const icoEntries = [];
  for (const size of [16, 32, 48]) {
    icoEntries.push({ size, data: await resizePng(logo, size) });
  }
  fs.writeFileSync(path.join(outputDir, 'tray-icon.ico'), packIco(icoEntries));

  // macOS tray assets (template + color)
  fs.writeFileSync(path.join(outputDir, 'trayIconTemplate.png'), await resizePng(logo, 18));
  fs.writeFileSync(path.join(outputDir, 'trayIconTemplate@2x.png'), await resizePng(logo, 36));
  fs.writeFileSync(path.join(outputDir, 'tray-icon-mac.png'), await resizePng(logo, 18));
  fs.writeFileSync(path.join(outputDir, 'tray-icon-mac@2x.png'), await resizePng(logo, 36));

  console.log(`[TrayIconGenerator] generated tray icons from ${inputPath}`);
}

main().catch((error) => {
  console.error('[TrayIconGenerator] failed to generate tray icons:', error);
  process.exit(1);
});
