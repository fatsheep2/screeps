"use strict";

import clear from 'rollup-plugin-clear';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import screeps from 'rollup-plugin-screeps';
import path from 'path';
import fs from 'fs';

let cfg;
const dest = process.env.DEST;
if (!dest) {
  console.log("No destination specified - code will be compiled but not uploaded");
} else if ((cfg = require("./screeps.json")[dest]) == null) {
  throw new Error("Invalid upload destination");
}

// 检查是否是本地配置
const isLocalConfig = cfg && cfg.local === true;

// 创建本地文件复制插件
const localCopyPlugin = () => {
  return {
    name: 'local-copy',
    writeBundle() {
      if (isLocalConfig && cfg.localPath) {
        const localPath = cfg.localPath;
        // 确保目标目录存在
        if (!fs.existsSync(localPath)) {
          fs.mkdirSync(localPath, { recursive: true });
          console.log(`Created local directory: ${localPath}`);
        }

        // 复制文件
        if (fs.existsSync('dist/main.js')) {
          fs.copyFileSync('dist/main.js', path.join(localPath, 'main.js'));
          console.log(`Copied main.js to: ${localPath}`);
        }
      }
    }
  };
};

export default {
  input: "src/main.ts",
  output: {
    file: "dist/main.js",
    format: "cjs",
    sourcemap: true
  },

  plugins: [
    clear({ targets: ["dist"] }),
    resolve({ rootDir: "src" }),
    commonjs(),
    typescript({tsconfig: "./tsconfig.json"}),
    // 如果是本地配置，使用 dryRun 模式；否则正常上传
    screeps({config: cfg, dryRun: isLocalConfig || cfg == null}),
    // 添加本地文件复制插件
    localCopyPlugin()
  ]
}
