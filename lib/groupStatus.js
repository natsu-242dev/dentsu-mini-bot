/*
┏━━━━━━━━━━━━━━━┓
┃  DENTSU MINI BOT
┣━━━━━━━━━━━━━━━┛
┃ Statut de groupe (group status) — photo / vidéo / texte
┃
┃ Structure attendue par WhatsApp (voir discussion Baileys #2318) :
┃  • texte  -> groupStatusMessageV2 > extendedTextMessage (contextInfo riche)
┃  • média  -> message média avec contextInfo.isGroupStatus = true
┃  • il faut contextInfo.statusAttributions avec le groupStatus de l'auteur,
┃    sinon WhatsApp accepte l'envoi mais n'affiche RIEN dans le statut.
┗━━━━━━━━━━━━━━━┛
*/

const {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  jidNormalizedUser,
  downloadMediaMessage,
} = require("@whiskeysockets/baileys");

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
  const isImage = Boolean(content.imageMessage);
  const isVideo = Boolean(content.videoMessage);
  if (!isImage && !isVideo) return null;
  const caption = content.imageMessage?.caption || content.videoMessage?.caption || "";
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
  const msg = unwrapMessage(botMessage.message || {}) || {};
  return String(msg.conversation || msg.extendedTextMessage?.text || "").trim();
}

// contextInfo indispensable pour que le statut soit reconnu comme statut de groupe.
function groupStatusContext(senderJid, extra = {}) {
  return {
    forwardingScore: 0,
    featureEligibilities: { canBeReshared: true, canReceiveMultiReact: true },
    pairedMediaType: 0,
    statusSourceType: 4,
    isGroupStatus: true,
    ...extra,
  };
}

// Publie un statut de groupe et renvoie le message créé.
async function postGroupStatus(sock, groupJid, payload) {
  const senderJid = jidNormalizedUser(sock.user?.id || "");
  const argb = toArgb(payload.color || DEFAULT_BG);

  // ── Texte ────────────────────────────────────────────────────
  if (payload.kind === "text") {
    const inner = {
      extendedTextMessage: {
        text: payload.text,
        font: 1,
        backgroundArgb: argb,
        contextInfo: groupStatusContext(senderJid, {
          statusAttributions: [{ type: 6, groupStatus: { authorJid: senderJid } }],
        }),
      },
    };
    const built = generateWAMessageFromContent(
      groupJid,
      { groupStatusMessageV2: { message: inner } },
      { userJid: senderJid },
    );
    await sock.relayMessage(groupJid, built.message, { messageId: built.key.id });
    return built;
  }

  // ── Photo / vidéo ────────────────────────────────────────────
  const mediaInput = payload.kind === "image"
    ? { image: payload.buffer, mimetype: payload.mimetype || "image/jpeg", caption: payload.caption || undefined }
    : { video: payload.buffer, mimetype: payload.mimetype || "video/mp4", caption: payload.caption || undefined };

  const prepared = await prepareWAMessageMedia(mediaInput, { upload: sock.waUploadToServer });
  const key = payload.kind === "image" ? "imageMessage" : "videoMessage";
  if (!prepared?.[key]) throw new Error("préparation du média impossible");

  prepared[key].contextInfo = groupStatusContext(senderJid, {
    statusAttributions: [{ type: 6, groupStatus: { authorJid: senderJid } }],
  });

  const built = generateWAMessageFromContent(groupJid, prepared, { userJid: senderJid });
  await sock.relayMessage(groupJid, built.message, { messageId: built.key.id });
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
