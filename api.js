import fs from 'node:fs/promises';
import got from 'got';
import mime from 'mime';
import { createReadStream } from 'tailing-stream';
import { v4 as uuidv4 } from 'uuid';

// Adobe IMS API
// https://github.com/AdobeDocs/adobe-dev-console/blob/main/src/pages/guides/authentication/UserAuthentication/IMS.md

const clientFile = 'client.json';
const tokenFile = 'token.json';

const clientData = JSON.parse(await fs.readFile(clientFile))
let tokenData = JSON.parse(await fs.readFile(tokenFile))

let accountId;
let catalogId;

function parseResponseBody(body) {
  if (body.startsWith('while (1) {}'))
    body = body.substring(12);
  return JSON.parse(body);
}

export async function getAccount() {
  const url = 'https://lr.adobe.io/v2/account';
  const resp = await got(url, { headers: {
    'X-API-Key': clientData.apiKey,
    'Authorization': 'Bearer ' + tokenData.access_token,
  }});
  return parseResponseBody(resp.body);
}

export async function getCatalog() {
  const url = 'https://lr.adobe.io/v2/catalog';
  const resp = await got(url, { headers: {
    'X-API-Key': clientData.apiKey,
    'Authorization': 'Bearer ' + tokenData.access_token,
  }});
  return parseResponseBody(resp.body);
}

export async function createAsset(fileName) {
  if (!accountId) {
    const resp = await getAccount();
    accountId = resp.id;
  }
  if (!catalogId) {
    const resp = await getCatalog();
    catalogId = resp.id;
  }
  const assetId = uuidv4().replaceAll('-', '');
  const url = `https://lr.adobe.io/v2/catalogs/${catalogId}/assets/${assetId}`;
  const date = new Date().toISOString();
  const body = {
    'subtype': 'image',
    'payload': {
      'userCreated': date,
      'userUpdated': date,
      'captureDate': '0000-00-00T00:00:00',
      'importSource': {
        'fileName': fileName,
        'importedOnDevice': 'Pi5',
        'importedBy': accountId,
        'importTimestamp': date,
      }
    }
  };
  await got.put(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': clientData.apiKey,
      'Authorization': 'Bearer ' + tokenData.access_token,
    },
    body: JSON.stringify(body),
  });
  return assetId;
}

export async function uploadAsset(assetId, fileName) {
  if (!catalogId) {
    const resp = await getCatalog();
    catalogId = resp.id;
  }
  const url = `https://lr.adobe.io/v2/catalogs/${catalogId}/assets/${assetId}/master`;
  const mimeType = mime.getType(fileName);
  let contentType;
  if (mimeType && (mimeType == 'image/jpeg' || mimeType.startsWith('video/')))
    contentType = mimeType;
  else
    contentType = 'application/octet-stream';

  await got.put(url, {
    headers: {
      'Content-Type': contentType,
      'X-API-Key': clientData.apiKey,
      'Authorization': 'Bearer ' + tokenData.access_token,
    },
    body: createReadStream(fileName),
  });
}

export async function getAsset(assetId) {
  if (!catalogId) {
    const resp = await getCatalog();
    catalogId = resp.id;
  }
  const url = `https://lr.adobe.io/v2/catalogs/${catalogId}/assets/${assetId}`;
  const resp = await got(url, { headers: {
    'X-API-Key': clientData.apiKey,
    'Authorization': 'Bearer ' + tokenData.access_token,
  }});
  return parseResponseBody(resp.body);
}

export async function refresh(logger) {
  const url = 'https://ims-na1.adobelogin.com/ims/token/v3';
  const resp = await got.post(url, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${clientData.apiKey}:${clientData.apiSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=refresh_token&refresh_token=${tokenData.refresh_token}`,
  });
  tokenData = parseResponseBody(resp.body);
  await fs.writeFile(tokenFile, JSON.stringify(tokenData, null, 2));
  logger.info(`refreshed token`);
  setTimeout(() => refresh(logger), 12 * 60 * 60 * 1000);
}
