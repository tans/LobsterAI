#!/usr/bin/env node

/**
 * Pure Node.js icon generator for Windows app icon.
 * - Reads public/logo.png
 * - Resizes with Jimp
 * - Packs multi-size PNGs into build/icons/win/icon.ico
 */

const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

const SOURCE = path.join(__dirname, '..', 'public', 'logo.png');
const OUT_DIR = path.join(__dirname, '..', 'build', 'icons', 'win');
const OUT_ICO = path.join(OUT_DIR, 'icon.ico');
const SIZES = [256, 128, 64, 48, 32, 16];

function ensureSource() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Source logo not found: ${SOURCE}`);
  }
}

async function resizePngBuffers() {
  const source = await Jimp.read(SOURCE);
  return Promise.all(
    SIZES.map(async (size) => {
      const img = source.clone().resize({ w: size, h: size });
      const data = await img.getBuffer('image/png');
      return { size, data };
    }),
  );
}

function packIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const entrySize = 16;
  const dataOffset0 = headerSize + entrySize * count;

  let currentOffset = dataOffset0;
  const entries = pngBuffers.map(({ size, data }) => {
    const entry = {
      width: size >= 256 ? 0 : size,
      height: size >= 256 ? 0 : size,
      dataSize: data.length,
      offset: currentOffset,
      data,
    };
    currentOffset += data.length;
    return entry;
  });

  const ico = Buffer.alloc(currentOffset);
  ico.writeUInt16LE(0, 0);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(count, 4);

  entries.forEach((entry, index) => {
    const off = headerSize + index * entrySize;
    ico.writeUInt8(entry.width, off + 0);
    ico.writeUInt8(entry.height, off + 1);
    ico.writeUInt8(0, off + 2);
    ico.writeUInt8(0, off + 3);
    ico.writeUInt16LE(1, off + 4);
    ico.writeUInt16LE(32, off + 6);
    ico.writeUInt32LE(entry.dataSize, off + 8);
    ico.writeUInt32LE(entry.offset, off + 12);
  });

  entries.forEach((entry) => {
    entry.data.copy(ico, entry.offset);
  });

  return ico;
}

async function main() {
  ensureSource();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const buffers = await resizePngBuffers();
  const ico = packIco(buffers);
  fs.writeFileSync(OUT_ICO, ico);

  console.log(`[IconGenerator] generated ${OUT_ICO} (${SIZES.join(', ')})`);
}

main().catch((error) => {
  console.error('[IconGenerator] failed to generate app icon:', error);
  process.exit(1);
});
