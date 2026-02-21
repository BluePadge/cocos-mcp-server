#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const distPath = path.resolve(__dirname, '..', 'dist');

try {
    fs.rmSync(distPath, { recursive: true, force: true });
    fs.mkdirSync(distPath, { recursive: true });
    console.log('[clean-dist] dist 已清理');
} catch (error) {
    console.error('[clean-dist] 清理失败:', error.message);
    process.exit(1);
}
