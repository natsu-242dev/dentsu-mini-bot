/*
┏━━━━━━━━━━━━━━━┓
┃  DENTSU MINI BOT
┣━━━━━━━━━━━━━━━┛
┃ Image de carte jointe aux localisations du 🩸 BUG MENU
┃
┃ Une localisation WhatsApp ne pèse que quelques centaines d'octets : c'est
┃ deux nombres et du texte. Pour obtenir du poids, il faut joindre une
┃ IMAGE. On récupère donc un vrai rendu de carte pour les coordonnées, puis
┃ on peut compléter le fichier jusqu'à une taille cible.
┃
┃ BUG_MEDIA_TARGET_MB (optionnel) : taille visée par image, en Mo.
┃   0 ou vide  -> image d'origine (rapide, ~70 Ko)
┃   1 à 14     -> fichier complété jusqu'à cette taille
┃ ⚠️ WhatsApp refuse les images de plus de 16 Mo ; au-delà, l'envoi échoue
┃    et un compte qui envoie des dizaines de fichiers énormes se fait
┃    couper. La valeur par défaut reste donc raisonnable.
┗━━━━━━━━━━━━━━━┛
*/

const https = require("https");
const zlib = require("zlib");

// Rendu de carte statique (aucune clé requise).
function mapUrl(lat, lng, { width = 600, height = 450, zoom = 13 } = {}) {
  const size = `${Math.min(width, 600)},${Math.min(height, 450)}`;
  return `https://static-maps.yandex.ru/1.x/?ll=${lng},${lat}&z=${zoom}&l=map&size=${size}&pt=${lng},${lat},pm2rdm`;
}

function fetchBuffer(url, { timeout = 12_000, redirects = 3 } = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location && redirects > 0) {
        response.resume();
        const next = new URL(response.headers.location, url).toString();
        return resolve(fetchBuffer(next, { timeout, redirects: redirects - 1 }));
      }
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`HTTP ${response.statusCode}`));
      }
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    });
    request.setTimeout(timeout, () => request.destroy(new Error("timeout")));
    request.on("error", reject);
  });
}

// ── PNG : ajout d'un bloc de texte pour atteindre une taille cible ──
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

/**
 * Complète un PNG avec un bloc tEXt « Comment » jusqu'à `targetBytes`.
 * Le fichier reste une image PNG valide : les clients l'affichent
 * normalement et ignorent le bloc.
 */
function padPng(buffer, targetBytes) {
  if (!Buffer.isBuffer(buffer) || targetBytes <= buffer.length) return buffer;
  // Un bloc PNG est limité à 2^31-1 octets ; on plafonne largement en dessous.
  const missing = targetBytes - buffer.length;
  const headerOverhead = 12 + 7; // longueur + type + crc + "Comment"
  if (missing <= headerOverhead) return buffer;
  // On insère avant le bloc IEND (les 12 derniers octets du fichier).
  const iend = buffer.subarray(buffer.length - 12);
  if (iend.subarray(4, 8).toString("ascii") !== "IEND") return buffer;
  const body = buffer.subarray(0, buffer.length - 12);
  const payload = Buffer.alloc(missing - headerOverhead, 0x20); // espaces
  const text = Buffer.concat([Buffer.from("Comment\u0000", "latin1"), payload]);
  return Buffer.concat([body, pngChunk("tEXt", text), iend]);
}

function targetBytes() {
  const configured = process.env.BUG_MEDIA_TARGET_MB;
  let mb = configured === undefined || configured === ""
    ? require("../config").BUG_MEDIA_TARGET_MB
    : Number(configured);
  if (!Number.isFinite(mb)) mb = 0;
  if (!Number.isFinite(mb) || mb <= 0) return 0;
  // Plafond dur : WhatsApp refuse au-delà de 16 Mo.
  return Math.min(mb, 15) * 1024 * 1024;
}

/**
 * Image de carte pour une position.
 * Retourne { buffer, kind } ou null si rien n'a pu être obtenu.
 */
async function buildMapImage(lat, lng, { caption = "", zoom } = {}) {
  let buffer = null;
  try {
    buffer = await fetchBuffer(mapUrl(lat, lng, zoom ? { zoom } : {}));
  } catch (error) {
    console.warn("bugMedia: carte indisponible —", error.message);
  }
  if (!buffer || buffer.length < 1000) return null;

  const target = targetBytes();
  if (target && buffer.length < target) {
    try {
      buffer = padPng(buffer, target);
    } catch (error) {
      console.warn("bugMedia: complément impossible —", error.message);
    }
  }
  return { buffer, kind: "image/png", size: buffer.length, caption };
}

module.exports = {
  buildMapImage,
  fetchBuffer,
  mapUrl,
  padPng,
  targetBytes,
};
