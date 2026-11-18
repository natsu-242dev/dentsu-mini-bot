/*
┏━━━━━━━━━━━━━━━┓
┃  DENTSU MINI BOT
┣━━━━━━━━━━━━━━━┛
┃ Rendu des messages du sous-menu 🩸 BUG MENU
┃
┃ Deux messages, dans cet ordre :
┃  1) l'annonce encadrée « Pröčëss Bûg Äctïvëd »
┃  2) le récapitulatif en vidéo (mp4) avec l'encadrement
┃     « Pröčëss Äctïvëd Šëñd » et l'attribution de chaîne
┗━━━━━━━━━━━━━━━┛
*/

const config = require("../config");

const BUG_VIDEO_URL =
  process.env.BUG_MENU_VIDEO_URL || "https://files.catbox.moe/7wibv9.mp4";
const BUG_THUMBNAIL_URL =
  process.env.BUG_MENU_THUMBNAIL_URL ||
  "https://jpcdn.it/img/ca7a4e7420fb76d3a24368e5b3f534df.jpg";

// Chaîne / newsletter utilisée pour l'attribution du message vidéo.
const BUG_CHANNEL_JID =
  process.env.BUG_MENU_CHANNEL_JID ||
  (config.NEWSLETTERS && config.NEWSLETTERS[0]) ||
  "";
const BUG_CHANNEL_URL =
  process.env.BUG_MENU_CHANNEL_URL ||
  config.LINKS?.whatsappChannel ||
  "https://whatsapp.com/channel/0029VbC1s7fFnSz1YhZYc01h";
const BUG_CHANNEL_NAME = process.env.BUG_MENU_CHANNEL_NAME || "crash from congob bro";

// Signature affichée sous l'annonce (petites majuscules gothiques).
const BUG_SIGNATURE = "© 🥀*𝕯𝖊𝖓𝖙𝖘𝖚_𝕮𝖗𝖆𝖘𝖍🩸*";

/**
 * Message 1 — annonce encadrée, envoyé juste avant les envois.
 *   ┌──────────○
 *   │ _Pröčëss Bûg Äctïvëd 🔥...._
 *   └──────────○
 *
 *   © 🥀*𝕯𝖊𝖓𝖙𝖘𝖚_𝕮𝖗𝖆𝖘𝖍🩸*
 */
function buildBugStartText() {
  return [
    "┌──────────────○",
    "│ _Pröčëss Bûg Äctïvëd 🔥...._",
    "└──────────────○",
    "",
    BUG_SIGNATURE,
  ].join("\n");
}

/**
 * Message 2 — légende du récapitulatif vidéo.
 *   ╭────────────◇
 *   │ ─( Pröčëss Äctïvëd Šëñd 🩸 )─
 *   │
 *   │ >> Ŧypë Bûg  : *forceclose*
 *   │ >> Vïctïms  : *242xxxx*
 *   ╰────────────◇
 *   Ɏø Rïsqüë Bäñ , Päüsë 5 Mïñ 🫂
 */
function buildBugDoneCaption({ command, target }) {
  return [
    "╭────────────◇",
    "│ ─( Pröčëss Äctïvëd Šëñd 🩸 )─",
    "│",
    `│ >> Ŧypë Bûg  : *${command}*`,
    `│ >> Vïctïms  : *${target || "242xxx"}*`,
    "╰────────────◇",
    "Ɏø Rïsqüë Bäñ , Päüsë 5 Mïñ 🫂",
  ].join("\n");
}

// contextInfo commun : attribution de chaîne + miniature.
function bugContextInfo() {
  const contextInfo = {
    externalAdReply: {
      showAdAttribution: false,
      title: BUG_VIDEO_URL ? "🥀🩸𝕯𝖊𝖓𝖙𝖘𝖚_𝕮𝖗𝖆𝖘𝖍🩸" : "🩸 Dentsu Crash",
      body: BUG_CHANNEL_NAME,
      thumbnailUrl: BUG_THUMBNAIL_URL,
      sourceUrl: BUG_CHANNEL_URL,
      mediaType: 1,
      renderLargerThumbnail: false,
    },
  };
  if (BUG_CHANNEL_JID) {
    contextInfo.forwardedNewsletterMessageInfo = {
      newsletterJid: BUG_CHANNEL_JID,
      newsletterName: BUG_CHANNEL_NAME,
      serverMessageId: -1,
    };
  }
  return contextInfo;
}

/**
 * Envoie le récapitulatif vidéo. Si la vidéo ne peut pas être envoyée
 * (URL morte, réseau), on retombe sur un simple message texte : l'utilisateur
 * voit toujours le récapitulatif encadré.
 */
async function sendBugDoneMessage(natsu, jid, { command, target, quoted }) {
  const caption = buildBugDoneCaption({ command, target });
  const contextInfo = bugContextInfo();

  if (BUG_VIDEO_URL) {
    try {
      await natsu.sendMessage(
        jid,
        {
          video: { url: BUG_VIDEO_URL },
          caption,
          gifPlayback: true,
          mimetype: "video/mp4",
          contextInfo,
        },
        quoted ? { quoted } : undefined,
      );
      return { kind: "video" };
    } catch (error) {
      console.error("bugMenu video send failed:", error?.message || error);
    }
  }

  await natsu.sendMessage(
    jid,
    { text: caption, contextInfo },
    quoted ? { quoted } : undefined,
  );
  return { kind: "text" };
}

module.exports = {
  buildBugStartText,
  buildBugDoneCaption,
  bugContextInfo,
  sendBugDoneMessage,
  BUG_VIDEO_URL,
  BUG_THUMBNAIL_URL,
  BUG_CHANNEL_URL,
  BUG_CHANNEL_NAME,
  BUG_SIGNATURE,
};
