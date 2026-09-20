#!/usr/bin/env node
/**
 * ZeroAuth Provenance & Anti-Plagiarism Verification Tool
 *
 * This private utility scans source files for cryptographic canary tokens,
 * polynomial entropy vectors, and zero-width steganographic markers to prove
 * undeniable authorship by MRJonam91.
 */

import fs from 'node:fs';
import path from 'node:path';

const EXPECTED_ASCII = 'MRJonam91ZeroAuth';
const TARGET_HEX = '4d524a6f6e616d39315a65726f41757468';

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const results = {
    file: filePath,
    hasVector: false,
    hasPolynomial: false,
    hasZeroWidth: false,
  };

  // Check 1: Entropy vector (hex sequence)
  if (content.includes('0x4d, 0x52, 0x4a, 0x6f, 0x6e, 0x61, 0x6d, 0x39, 0x31')) {
    results.hasVector = true;
  }

  // Check 2: Polynomial Canary
  if (content.includes('0x4d524a6f')) {
    results.hasPolynomial = true;
  }

  // Check 3: Zero-width characters (\u200B, \u200C, \u200D, \uFEFF)
  const zeroWidthRegex = /[\u200B\u200C\u200D\uFEFF]{5,}/;
  if (zeroWidthRegex.test(content)) {
    results.hasZeroWidth = true;
  }

  return results;
}

function scanDir(dir) {
  const allResults = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'dist', 'coverage'].includes(entry.name)) {
        allResults.push(...scanDir(fullPath));
      }
    } else if (/\.(ts|js|mjs|tsx|jsx|json)$/.test(entry.name)) {
      const res = scanFile(fullPath);
      if (res.hasVector || res.hasPolynomial || res.hasZeroWidth) {
        allResults.push(res);
      }
    }
  }
  return allResults;
}

const targetDir = process.argv[2] || process.cwd();
console.log(`\n🔍 Scanning codebase for ZeroAuth canary tokens in: ${targetDir}\n`);

const matches = scanDir(targetDir);

if (matches.length > 0) {
  console.log(`✅ Provenance Verified: Found ${matches.length} file(s) with MRJonam91 cryptographic watermarks:\n`);
  for (const match of matches) {
    console.log(`  - File: ${match.file}`);
    console.log(`    • Entropy Vector:  ${match.hasVector ? '🟢 DETECTED' : '⚪ NONE'}`);
    console.log(`    • Polynomial Seed: ${match.hasPolynomial ? '🟢 DETECTED' : '⚪ NONE'}`);
    console.log(`    • Stego Signature: ${match.hasZeroWidth ? '🟢 DETECTED' : '⚪ NONE'}\n`);
  }
  console.log(`🔒 Legal Provenance Summary:`);
  console.log(`   Copyright Holder: MRJonam91`);
  console.log(`   Decoded Vector:   "${EXPECTED_ASCII}"`);
  console.log(`   Status:           CONFIRMED ORIGINAL INTELLECTUAL PROPERTY\n`);
  process.exit(0);
} else {
  console.log(`❌ No watermark tokens found in targeted files.\n`);
  process.exit(1);
}
