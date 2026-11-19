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
// Chaque fiche porte un nom, une adresse complète, un quartier, une ville,
// un pays et une URL Maps, comme une vraie carte partagée.
const BUG_PLACES = [
  { name: "Rue des Palmiers", district: "Bacongo", city: "Brazzaville", country: "Congo", region: "Pool" },
  { name: "Avenue de la Paix", district: "Poto-Poto", city: "Brazzaville", country: "Congo", region: "Brazzaville" },
  { name: "Quartier Mpila", district: "Mpila", city: "Brazzaville", country: "Congo", region: "Brazzaville" },
  { name: "Boulevard Denis Sassou", district: "Moungali", city: "Brazzaville", country: "Congo", region: "Brazzaville" },
  { name: "Marché Total", district: "Tié-Tié", city: "Pointe-Noire", country: "Congo", region: "Kouilou" },
  { name: "Rue Moe Victoria", district: "Loandjili", city: "Pointe-Noire", country: "Congo", region: "Kouilou" },
  { name: "Cité OCH", district: "Mvou-Mvou", city: "Pointe-Noire", country: "Congo", region: "Kouilou" },
  { name: "Route de l'Aéroport", district: "Aéroport", city: "Dolisie", country: "Congo", region: "Niari" },
  { name: "Place de la Gare", district: "Centre", city: "Dolisie", country: "Congo", region: "Niari" },
  { name: "Carrefour Kimbangu", district: "Ouenzé", city: "Brazzaville", country: "Congo", region: "Brazzaville" },
  { name: "Avenue Marien Ngouabi", district: "Talangaï", city: "Brazzaville", country: "Congo", region: "Brazzaville" },
  { name: "Rue des Manguiers", district: "Makélékélé", city: "Brazzaville", country: "Congo", region: "Brazzaville" },
  { name: "Corniche de Loango", district: "Loango", city: "Pointe-Noire", country: "Congo", region: "Kouilou" },
  { name: "Rond-point Koulounda", district: "Ouesso", city: "Ouésso", country: "Congo", region: "Sangha" },
  { name: "Marché Central", district: "Centre-ville", city: "Owando", country: "Congo", region: "Cuvette" },
  { name: "Boulevard de l'Indépendance", district: "Ngoyo", city: "Pointe-Noire", country: "Congo", region: "Kouilou" },
];

// Détails affichés sous chaque carte (le « Voir plus » de la capture).
const BUG_TAGS = [
  "signal fort", "zone dense", "point de relais", "accès rapide", "secteur calme",
  "zone résidentielle", "carrefour actif", "sortie de ville", "point de contrôle",
];

const BUG_TITLES = ["ᴄᴏᴏʀᴅᴏɴɴᴇ́ᴇ ɢᴘꜱ", "ɢᴇᴏ ʟᴏᴄᴋ", "ᴍᴀᴘᴋɪᴛ ɴᴏᴅᴇ", "ᴘᴏꜱɪᴛɪᴏɴ ʀᴀᴡ", "ᴄᴀʀᴛᴇ ᴘᴀʀᴛᴀɢᴇ́ᴇ"];

function buildLocationText(profile, index, place, lat, lng) {
  const number = String(index + 1).padStart(3, "0");
  const tag = BUG_TAGS[index % BUG_TAGS.length];
  const title = BUG_TITLES[index % BUG_TITLES.length];
  const street = `${place.name}, ${String(index % 90 + 10)}`;
  const address = `${street} — ${place.district}, ${place.city}, ${place.country}`;
  const maps = `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
  return {
    street,
    address,
    maps,
    caption: [
      `╭─────────────◇`,
      `│ ${profile.emoji} *${title}* · ${number}`,
      `├─────────────◇`,
      `│ ➠ ʟɪᴇᴜ    : ${street}`,
      `│ ➠ Qᴜᴀʀᴛɪᴇʀ: ${place.district}`,
      `│ ➠ Vɪʟʟᴇ   : ${place.city} (${place.region})`,
      `│ ➠ Pᴀʏꜱ    : ${place.country}`,
      `│ ➠ Lᴀᴛ     : ${lat.toFixed(6)}`,
      `│ ➠ Lɴɢ     : ${lng.toFixed(6)}`,
      `│ ➠ Tᴀɢ     : ${tag}`,
      `│ ➠ Sᴏᴜʀᴄᴇ  : ${profile.theme} · ${profile.emoji}`,
      `╰─────────────◇`,
      `> By NatsuTech's 🇨🇬`,
    ].join("\n"),
  };
}

// Métiers/entreprises des fiches contact : rend chaque contact crédible.
const BUG_COMPANIES = [
  "Dentsu Project", "NatsuTech's Lab", "Congo Digital", "Brazza Telecom",
  "Kongo Media", "Atlantique Services", "Pool Networks", "Niari Systems",
];
const BUG_ROLES = [
  "Support réseau", "Technicien terrain", "Administrateur système",
  "Chargé de compte", "Ingénieur télécom", "Responsable logistique",
];
const BUG_STREETS = [
  "Avenue de la Paix", "Rue des Palmiers", "Boulevard Denis Sassou",
  "Rue Moe Victoria", "Avenue Marien Ngouabi", "Corniche de Loango",
];

function buildVCard(profile, index) {
  const words = BUG_WORDS[profile.theme] || BUG_WORDS.CRASH;
  const word = words[index % words.length];
  const number = String(index + 1).padStart(3, "0");
  const tag = BUG_PREFIXES[index % BUG_PREFIXES.length];
  const name = `${word} ${tag}${number}`;
  const phone = `+242 ${String(index).padStart(2, "0")} ${String((index * 7) % 100).padStart(2, "0")} `
    + `${String((index * 13) % 100).padStart(2, "0")} ${String((index * 3) % 100).padStart(2, "0")}`;
  const company = BUG_COMPANIES[index % BUG_COMPANIES.length];
  const role = BUG_ROLES[index % BUG_ROLES.length];
  const street = BUG_STREETS[index % BUG_STREETS.length];
  const place = BUG_PLACES[index % BUG_PLACES.length];
  const waid = `2420${String(index).padStart(8, "0")}`;
  const email = `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@${company
    .toLowerCase().replace(/[^a-z0-9]+/g, "")}.cg`;
  const site = `https://wa.me/${waid}`;
  // Une fiche contact complète : identité, société, fonction, adresse postale,
  // téléphone, e-mail, site, note détaillée — comme une vraie fiche enregistrée.
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${name}`,
    `N:${word};${tag}${number};;;`,
    `NICKNAME:${word}·${number}`,
    `ORG:${company};${profile.theme}`,
    `TITLE:${role}`,
    `ROLE:${profile.theme} · payload ${number}`,
    `ADR;type=WORK:;;${street};${place.district};${place.city};${place.region};${place.country}`,
    `LABEL;type=WORK:${street}\\n${place.district}\\n${place.city}, ${place.country}`,
    `TEL;type=CELL;type=VOICE;waid=${waid}:${phone}`,
    `EMAIL;type=INTERNET;type=WORK:${email}`,
    `URL;type=WORK:${site}`,
    `BDAY:19${String(60 + (index % 40)).padStart(2, "0")}${String((index % 12) + 1).padStart(2, "0")}`,
    `NOTE:${profile.emoji} ${profile.theme} — fiche ${number}\\n`
      + `Source : ${company}\\n`
      + `Zone : ${place.city} (${place.region})\\n`
      + `Statut : ${BUG_TAGS[index % BUG_TAGS.length]}\\n`
      + `Contact créé par NatsuTech's 🇨🇬`,
    `X-WA-BIZ-DESCRIPTION:${profile.emoji} ${profile.theme} · ${company}`,
    `X-WA-BIZ-CATEGORY:${role}`,
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
  const roundedLat = Number(lat.toFixed(6));
  const roundedLng = Number(lng.toFixed(6));
  const details = buildLocationText(profile, index, place, roundedLat, roundedLng);

  await natsu.sendMessage(target, {
    location: {
      degreesLatitude: roundedLat,
      degreesLongitude: roundedLng,
      name: `${profile.emoji} ${details.street} · ${String(index + 1).padStart(3, "0")}`,
      address: details.address,
      url: details.maps,
      // La légende est ce que WhatsApp affiche sous la carte, et ce que
      // « Voir plus » déplie : c'est là que tient tout le détail.
      caption: details.caption,
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
  buildLocationText,
  resolveBugTarget,
  sleep,
  BUG_WORDS,
  BUG_PLACES,
};
