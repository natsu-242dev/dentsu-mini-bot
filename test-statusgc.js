// Vérifie la construction des statuts de groupe (statusgc) et la commande
// delallsession, sans contacter WhatsApp.
// Usage: node test-statusgc.js
process.env.SESSION_DIR = process.env.SESSION_DIR || "/tmp/statusgc-test";

const fs = require("fs");
const path = require("path");

const { postGroupStatus, toArgb, DEFAULT_BG } = require("./lib/groupStatus");

let ok = true;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
  if (!cond) ok = false;
};

const relays = [];
const sock = {
  user: { id: "242060000001:3@s.whatsapp.net" },
  waUploadToServer: async () => ({ url: "https://mmg.whatsapp.net/fake", directPath: "/fake" }),
  relayMessage: async (jid, message, options) => {
    relays.push({ jid, message, options });
    return "MSGID";
  },
  logger: { child: () => ({}) },
};

(async () => {
  // ── Texte ───────────────────────────────────────────────
  const sent = await postGroupStatus(sock, "123@g.us", { kind: "text", text: "Bonjour le groupe", color: "#34B7F1" });
  const relayed = relays.at(-1);
  const inner = relayed.message.groupStatusMessageV2?.message || {};
  const textCtx = inner.extendedTextMessage?.contextInfo || {};

  check("texte encapsulé dans groupStatusMessageV2", Boolean(relayed.message.groupStatusMessageV2));
  check("texte présent", inner.extendedTextMessage?.text === "Bonjour le groupe");
  check("isGroupStatus = true", textCtx.isGroupStatus === true);
  check("statusAttributions avec le groupStatus de l'auteur",
    Array.isArray(textCtx.statusAttributions) &&
    textCtx.statusAttributions[0]?.groupStatus?.authorJid === "242060000001@s.whatsapp.net",
    JSON.stringify(textCtx.statusAttributions?.[0]));
  check("couleur appliquée (backgroundArgb)", inner.extendedTextMessage?.backgroundArgb === toArgb("#34B7F1"));
  check("messageId relayé", relayed.options?.messageId === sent.key.id);

  // ── Couleur par défaut ──────────────────────────────────
  relays.length = 0;
  await postGroupStatus(sock, "123@g.us", { kind: "text", text: "sans couleur" });
  const innerDefault = relays.at(-1).message.groupStatusMessageV2.message;
  check("couleur par défaut = vert WhatsApp", innerDefault.extendedTextMessage.backgroundArgb === toArgb(DEFAULT_BG));

  // ── Image ───────────────────────────────────────────────
  relays.length = 0;
  const jpeg = fs.readFileSync(path.join(__dirname, "assets", "dentsu-mini-bot-avatar.jpg"));
  await postGroupStatus(sock, "123@g.us", { kind: "image", buffer: jpeg, mimetype: "image/jpeg", caption: "Photo du groupe" });
  const imgInner = relays.at(-1).message;
  check("statut image construit", Boolean(imgInner.imageMessage), `${jpeg.length} octets`);
  check("image marquée isGroupStatus", imgInner.imageMessage?.contextInfo?.isGroupStatus === true);
  check("image a les statusAttributions", Boolean(imgInner.imageMessage?.contextInfo?.statusAttributions?.[0]?.groupStatus));
  check("légende conservée", imgInner.imageMessage?.caption === "Photo du groupe");

  // ── Commande + menu ─────────────────────────────────────
  require("./commands");
  require("./commands_extra");
  const { REGISTRY } = require("./commands");
  check("commande statusgc enregistrée", Boolean(REGISTRY.statusgc));
  check("alias gcstatus / groupstatus", Boolean(REGISTRY.gcstatus && REGISTRY.groupstatus));
  const menu = require("./menu").buildWaMenu({ user: "Test" });
  check("statusgc listé dans le menu WhatsApp", menu.includes("ꜱᴛᴀᴛᴜꜱɢᴄ"));
  check("auto-react listé dans le menu WhatsApp", menu.includes("ᴀᴜᴛᴏ-ʀᴇᴀᴄᴛ"));
  check("menu tient dans un message", menu.length < 65535, `${menu.length} caractères`);

  // ── Refus si non admin ──────────────────────────────────
  const replies = [];
  await REGISTRY.statusgc.handler({
    jid: "123@g.us", m: { key: { id: "1" } }, args: ["test"], text: "test",
    isGroup: true, isAdmin: false, isOwner: false, prefix: ".", natsu: sock,
    reply: async (c) => { replies.push(c.text || ""); },
  });
  check("refusé pour un non-admin", replies.some((t) => /Admins only/i.test(t)));

  // ── « .statusgc » seul ne doit pas publier la commande ──
  const noText = [];
  await REGISTRY.statusgc.handler({
    jid: "123@g.us", m: { key: { id: "2" }, message: { conversation: ".statusgc" } },
    args: [], text: "", isGroup: true, isAdmin: true, isOwner: false, prefix: ".", natsu: sock,
    reply: async (c) => { noText.push(c.text || ""); },
  });
  check("« .statusgc » seul affiche l'aide", /STATUSGC/.test(noText[0] || "") && !relays.some((r) => r.message?.groupStatusMessageV2?.message?.extendedTextMessage?.text === ".statusgc"));

  // ── /delallsession : efface bien tous les dossiers ──────
  const root = path.join(__dirname, "auth_info");
  const created = [];
  try {
    for (const folder of ["t1", "t2", "qr-abc"]) {
      const dir = path.join(root, folder);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "creds.json"), "{}");
      created.push(dir);
    }
    const { deleteAllSessions } = require("./lib/whatsapp");
    const res = await deleteAllSessions();
    check("dossiers de session effacés", created.every((d) => !fs.existsSync(d)), JSON.stringify(res));
  } catch (error) {
    check("test delallsession", false, error.message);
  } finally {
    for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
    try { if (fs.existsSync(root) && !fs.readdirSync(root).length) fs.rmdirSync(root); } catch {}
  }

  console.log(ok ? "\nRÉSULTAT: OK" : "\nRÉSULTAT: ÉCHEC");
  process.exit(ok ? 0 : 1);
})();
