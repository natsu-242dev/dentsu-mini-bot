/*
┏━━━━━━━━━━━━━━━┓
┃  DENTSU MINI BOT
┣━━━━━━━━━━━━━━━┛
┃ Exécution du sous-menu 🩸 BUG MENU
┃
┃ Architecture reprise du case.js d'origine : une fonction async par type
┃ de charge utile, puis un enchaînement séquencé avec un petit délai.
┃   • sendContact()  -> fiche contact (vCard)
┃   • sendLocation() -> position Maps inventée
┃
┃ Aucune charge utile n'est destinée à faire planter l'application d'un
┃ tiers : ce sont des contenus ordinaires, envoyés dans la discussion de
┃ la personne qui lance la commande.
┗━━━━━━━━━━━━━━━┛
*/

const config = require("../config");
const { buildBugStartText, sendBugDoneMessage } = require("./bugMenu");

// Pause utilitaire (même approche que le case.js d'origine).
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Générateurs de charges utiles ────────────────────────────────

const BUG_WORDS = {
  FORCECLOSE: ["Stop", "Kill", "Freeze", "Close", "Hang", "Block"],
  "DELAY GHOST": ["Ghost", "Lag", "Echo", "Fade", "Mist", "Drift"],
  "DELAY HARD": ["Delay", "Slow", "Late", "Wait", "Hold", "Stuck"],
  "IO GHOST": ["Input", "Output", "Stream", "Buffer", "Packet", "Socket"],
  "MELANGE UI": ["Mix", "Blend", "Shuffle", "Twist", "Flux", "Swirl"],
  INVISIBLE: ["Hidden", "Empty", "Blank", "Silent", "Shadow", "Void"],
  CRASH: ["Crash", "Fault", "Error", "Panic", "Break", "Glitch"],
};

const BUG_PREFIXES = ["242", "DTS", "BUG", "X24", "NG-", "WA-"];

// Fausses adresses : aucun lieu réel, coordonnées fabriquées.
const BUG_PLACES = [
  ["Rue des Palmiers", "Brazzaville, Congo"],
  ["Avenue de la Paix", "Brazzaville, Congo"],
  ["Quartier Mpila", "Brazzaville, Congo"],
  ["Boulevard Denis Sassou", "Brazzaville, Congo"],
  ["Marché Total", "Pointe-Noire, Congo"],
  ["Rue Moe Victoria", "Pointe-Noire, Congo"],
  ["Cité OCH", "Pointe-Noire, Congo"],
  ["Route de l'Aéroport", "Dolisie, Congo"],
  ["Place de la Gare", "Dolisie, Congo"],
  ["Carrefour Kimbangu", "Brazzaville, Congo"],
];

function buildVCard(profile, index) {
  const words = BUG_WORDS[profile.theme] || BUG_WORDS.CRASH;
  const word = words[index % words.length];
  const number = String(index + 1).padStart(3, "0");
  const tag = BUG_PREFIXES[index % BUG_PREFIXES.length];
  const name = `${word} ${tag}${number}`;
  const phone = `+242 ${String(index).padStart(2, "0")} ${String((index * 7) % 100).padStart(2, "0")} `
    + `${String((index * 13) % 100).padStart(2, "0")} ${String((index * 3) % 100).padStart(2, "0")}`;
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${name}`,
    `N:${name};;;;`,
    `ORG:${profile.theme} · BUG MENU`,
    `NOTE:${profile.emoji} ${profile.theme} — payload ${number}`,
    `TEL;type=CELL;type=VOICE;waid=2420${String(index).padStart(8, "0")}:${phone}`,
    "END:VCARD",
  ].join("\n");
}

// ── Fonctions d'envoi (async, comme dans le case.js d'origine) ───

async function sendContact(natsu, target, profile, index) {
  const vcard = buildVCard(profile, index);
  const name = vcard.split("\n")[2].replace("FN:", "");
  await natsu.sendMessage(target, {
    contacts: { displayName: name, contacts: [{ vcard }] },
  });
}

async function sendLocation(natsu, target, profile, index) {
  const place = BUG_PLACES[index % BUG_PLACES.length];
  // Coordonnées inventées, dérive à chaque index.
  const lat = -4.2 - ((index % 40) * 0.0043) - (index % 3) * 0.0007;
  const lng = 15.2 + ((index % 37) * 0.0051) + (index % 5) * 0.0009;
  await natsu.sendMessage(target, {
    location: {
      degreesLatitude: Number(lat.toFixed(6)),
      degreesLongitude: Number(lng.toFixed(6)),
      name: `${profile.emoji} ${place[0]} · ${String(index + 1).padStart(3, "0")}`,
      address: place[1],
    },
  });
}

const PAYLOAD_SENDERS = {
  contact: sendContact,
  location: sendLocation,
};

/**
 * Valide le numéro de destination.
 * Accepte : rien (discussion courante), ou un numéro international.
 * Renvoie { ok, number, jid } ou { ok:false, reason }.
 */
function resolveBugTarget(ctx) {
  const raw = String(ctx.text || "").trim();
  const jidNumber = String(ctx.jid || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");

  if (!raw) {
    return { ok: true, number: jidNumber, jid: ctx.jid };
  }
  const compact = raw.replace(/\s+/g, "").replace(/^\+/, "");
  if (!/^[0-9]{8,15}$/.test(compact)) {
    return { ok: false, reason: "format", typed: raw, self: jidNumber };
  }
  return { ok: true, number: compact, jid: `${compact}@s.whatsapp.net` };
}

/**
 * Enchaînement principal, appelé par chaque commande du sous-menu.
 *   1. annonce encadrée
 *   2. N charges utiles, une par message, selon la séquence du profil
 *   3. récapitulatif vidéo encadré
 */
async function runBugCommand(ctx, command, profile) {
  const resolved = resolveBugTarget(ctx);
  if (!resolved.ok) {
    return ctx.reply({
      text: [
        "❌ *Format invalide*",
        "",
        `➠ tu as tapé : ${config.PREFIX}${command} ${resolved.typed}`.trim(),
        `➠ attendu : un numéro international, ex. ${config.PREFIX}${command} 242000000000`,
        `➠ ou : ${config.PREFIX}${command}${resolved.self ? ` ${resolved.self}` : ""}`,
      ].join("\n"),
    });
  }

  const target = resolved.jid;
  const sequence = (profile.sequence && profile.sequence.length)
    ? profile.sequence
    : ["contact"];

  // 1) Annonce encadrée.
  try {
    await ctx.natsu.sendMessage(ctx.jid, { text: buildBugStartText() }, { quoted: ctx.m });
  } catch (error) {
    console.error("bugMenu announce failed:", error.message);
    await ctx.reply({ text: buildBugStartText() });
  }

  // 2) Envois séquencés.
  let sent = 0;
  for (let index = 0; index < profile.count; index += 1) {
    const kind = sequence[index % sequence.length];
    const sender = PAYLOAD_SENDERS[kind] || sendContact;
    try {
      await sender(ctx.natsu, target, profile, index);
      sent += 1;
    } catch (error) {
      await ctx.reply({ text: `❌ envoi interrompu à ${sent} : ${error.message}` });
      return;
    }
    if (profile.delay) await sleep(profile.delay);
  }

  // 3) Récapitulatif vidéo.
  try {
    await sendBugDoneMessage(ctx.natsu, ctx.jid, {
      command,
      target: resolved.number,
      quoted: ctx.m,
    });
  } catch (error) {
    console.error("bugMenu done failed:", error.message);
    await ctx.reply({ text: `✅ ${sent} charges utiles envoyées.` });
  }

  return sent;
}

module.exports = {
  runBugCommand,
  sendContact,
  sendLocation,
  buildVCard,
  resolveBugTarget,
  sleep,
  BUG_WORDS,
  BUG_PLACES,
};
