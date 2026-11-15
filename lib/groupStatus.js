/*
┏━━━━━━━━━━━━━━━┓
┃  DENTSU MINI BOT
┣━━━━━━━━━━━━━━━┛
┃ Statut de groupe (group status) — photo / vidéo / texte
┗━━━━━━━━━━━━━━━┛
*/

const crypto = require("crypto");
const {
  generateWAMessageContent,
  generateWAMessageFromContent,
  downloadMediaMessage,
} = require("@whiskeysockets/baileys");

// Couleur de fond par défaut d'un statut texte (vert WhatsApp).
const DEFAULT_BG = "#25D366";

function toArgb(color) {
  if (typeof color === "number") return color >>> 0;
  const hex = String(color || "").trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return toArgb(DEFAULT_BG);
  return parseInt(`FF${hex}`, 16) >>> 0;
}

// Déballe les wrappers (éphémère, vue unique, légende de document).
function unwrapMessage(message) {
  let content = message;
  for (let depth = 0; depth < 8 && content; depth += 1) {
    const key = [
      "ephemeralMessage",
      "viewOnceMessage",
      "viewOnceMessageV2",
      "viewOnceMessageV2Extension",
      "documentWithCaptionMessage",
    ].find((k) => content[k]?.message);
    if (!key) break;
    content = content[key].message;
  }
  return content;
}

// Le message auquel l'utilisateur a répondu (citation).
function quotedMessage(botMessage, jid) {
  let msg = botMessage.message || {};
  msg = unwrapMessage(msg) || msg;
  const info =
    msg.extendedTextMessage?.contextInfo ||
    msg.imageMessage?.contextInfo ||
    msg.videoMessage?.contextInfo ||
    msg.documentMessage?.contextInfo;
  if (!info?.quotedMessage) return null;
  return {
    key: {
      remoteJid: info.remoteJid || jid,
      id: info.stanzaId,
      fromMe: false,
      ...(info.participant ? { participant: info.participant } : {}),
    },
    message: info.quotedMessage,
  };
}

// Retourne { kind, buffer, mimetype, caption } ou null.
async function quotedMedia(botMessage, jid, sock) {
  const quoted = quotedMessage(botMessage, jid);
  if (!quoted) return null;
  const content = unwrapMessage(quoted.message) || {};
  const caption =
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    "";
  const isImage = Boolean(content.imageMessage);
  const isVideo = Boolean(content.videoMessage);
  if (!isImage && !isVideo) return null;
  const buffer = await downloadMediaMessage(quoted, "buffer", {}, {
    logger: sock?.logger,
    reuploadRequest: (m) => sock.updateMediaMessage(m),
  });
  return {
    kind: isImage ? "image" : "video",
    buffer,
    mimetype: isImage
      ? content.imageMessage?.mimetype || "image/jpeg"
      : content.videoMessage?.mimetype || "video/mp4",
    caption: String(caption || "").slice(0, 600),
  };
}

function captionFrom(botMessage) {
  let msg = unwrapMessage(botMessage.message || {}) || {};
  return String(
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    "",
  ).trim();
}

// Publie un statut de groupe et renvoie le message créé.
async function postGroupStatus(sock, groupJid, payload) {
  const content = payload.kind === "text"
    ? { text: payload.text, backgroundColor: payload.color || DEFAULT_BG }
    : payload.kind === "image"
      ? { image: payload.buffer, mimetype: payload.mimetype, caption: payload.caption || undefined }
      : { video: payload.buffer, mimetype: payload.mimetype, caption: payload.caption || undefined };

  const inner = await generateWAMessageContent(content, {
    upload: sock.waUploadToServer,
    backgroundColor: payload.color,
    jid: groupJid,
  });
  if (!inner) throw new Error("contenu vide");

  // Marque le contenu comme statut de groupe (obligatoire).
  const type = Object.keys(inner).find((k) => k.endsWith("Message"));
  if (type && inner[type]) {
    inner[type].contextInfo = { ...(inner[type].contextInfo || {}), isGroupStatus: true };
    if (payload.kind === "text") inner[type].backgroundArgb = toArgb(payload.color || DEFAULT_BG);
  }

  const secret = crypto.randomBytes(32);
  const built = generateWAMessageFromContent(groupJid, {
    messageContextInfo: { messageSecret: secret },
    groupStatusMessageV2: { message: { ...inner, messageContextInfo: { messageSecret: secret } } },
  }, {});

  const meta = await sock.groupMetadata(groupJid);
  const statusJidList = (meta?.participants || []).map((p) => p.id).filter(Boolean);

  await sock.relayMessage(groupJid, built.message, {
    messageId: built.key.id,
    statusJidList,
    additionalAttributes: { messageId: built.key.id },
  });
  return built;
}

module.exports = {
  postGroupStatus,
  quotedMedia,
  quotedMessage,
  captionFrom,
  unwrapMessage,
  toArgb,
  DEFAULT_BG,
};
