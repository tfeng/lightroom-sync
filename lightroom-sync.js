#!/usr/bin/env node

"use strict";

import { createAsset, getAccount, refresh, uploadAsset } from './api.js';
import { createLogger } from './common.js';
import fs from 'node:fs/promises';
import chokidar from 'chokidar';
import path from 'path';

const settingsFile = 'settings.json';

const settings = JSON.parse(await fs.readFile(settingsFile))
const root = settings.root;

const logFile = 'lightroom-sync.log';
const logger = createLogger(logFile);

const watcher = chokidar.watch('.', {
  persistent: true,
  cwd: root,
});
watcher.on('add', async file => {
  const dir = path.dirname(file);
  if (dir === '.' && path.extname(file).toUpperCase() === '.ARW') {
    logger.info(`starting to upload ${file}`);
    const fullName = path.join(root, file);
    const assetId = await createAsset(file);
    await uploadAsset(assetId, fullName);
    await fs.unlink(fullName);
    logger.info(`finished uploading ${file}`);
  }
});

await refresh(logger);
const account = await getAccount();
logger.info(`logged in as ${account.full_name}`);
