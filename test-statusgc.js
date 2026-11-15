// Vérifie la construction des statuts de groupe (statusgc) et la commande
// delallsession, sans contacter WhatsApp.
// Usage: node test-statusgc.js
process.env.SESSION_DIR = process.env.SESSION_DIR || "/tmp/statusgc-test";

const os = require("os");
const fs = require("fs");
const path = require("path");

const { postGroupStatus, toArgb, DEFAULT_BG } = require("./lib/groupStatus");

let ok = true;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
  if (!cond) ok = false;
};

// Faux socket : capture le relai et simule l'upload média.
const relays = [];
const sock = {
  waUploadToServer: async () => ({ url: "https://mmg.whatsapp.net/fake", directPath: "/fake" }),
  groupMetadata: async () => ({
    participants: [{ id: "242060000001@s.whatsapp.net" }, { id: "242060000002@s.whatsapp.net" }],
  }),
  relayMessage: async (jid, message, options) => {
    relays.push({ jid, message, options });
    return "MSGID";
  },
  logger: { child: () => ({}) },
};

(async () => {
  // ── Texte ───────────────────────────────────────────────
  const textMsg = await postGroupStatus(sock, "123@g.us", { kind: "text", text: "Bonjour le groupe", color: "#34B7F1" });
  const relayed = relays.at(-1);
  const inner = relayed.message.groupStatusMessageV2?.message || {};
  check("statut texte encapsulé dans groupStatusMessageV2", Boolean(relayed.message.groupStatusMessageV2));
  check("texte présent", inner.extendedTextMessage?.text === "Bonjour le groupe");
  check("marqué isGroupStatus", inner.extendedTextMessage?.contextInfo?.isGroupStatus === true);
  check("couleur appliquée (backgroundArgb)", inner.extendedTextMessage?.backgroundArgb === toArgb("#34B7F1"), String(inner.extendedTextMessage?.backgroundArgb));
  check("liste des participants envoyée", (relayed.options.statusJidList || []).length === 2);
  check("messageSecret présent", Boolean(relayed.message.messageContextInfo?.messageSecret));
  check("identifiant du message dans les attributs", relayed.options.additionalAttributes?.messageId === textMsg.key.id);

  // ── Couleur par défaut ──────────────────────────────────
  relays.length = 0;
  await postGroupStatus(sock, "123@g.us", { kind: "text", text: "sans couleur" });
  const innerDefault = relays.at(-1).message.groupStatusMessageV2.message;
  check("couleur par défaut = vert WhatsApp", innerDefault.extendedTextMessage.backgroundArgb === toArgb(DEFAULT_BG));

  // ── Image ───────────────────────────────────────────────
  relays.length = 0;
  const jpeg = fs.readFileSync(path.join(__dirname, "assets", "dentsu-mini-bot-avatar.jpg"));
  await postGroupStatus(sock, "123@g.us", { kind: "image", buffer: jpeg, mimetype: "image/jpeg", caption: "Photo du groupe" });
  const imgInner = relays.at(-1).message.groupStatusMessageV2.message;
  check("statut image construit", Boolean(imgInner.imageMessage), `${jpeg.length} octets`);
  check("légende de l'image conservée", imgInner.imageMessage?.caption === "Photo du groupe");
  check("image marquée isGroupStatus", imgInner.imageMessage?.contextInfo?.isGroupStatus === true);

  // ── Commande enregistrée + menu ─────────────────────────
  require("./commands");
  require("./commands_extra");
  const { REGISTRY, CATEGORIES } = require("./commands");
  check("commande statusgc enregistrée", Boolean(REGISTRY.statusgc));
  check("alias gcstatus / groupstatus", Boolean(REGISTRY.gcstatus && REGISTRY.groupstatus));
  const menu = require("./menu").buildWaMenu({ user: "Test" });
  check("statusgc listé dans le menu WhatsApp", menu.includes("ꜱᴛᴀᴛᴜꜱɢᴄ"));
  check("menu tient dans un message", menu.length < 65535, `${menu.length} caractères`);

  // ── Refus si non admin ──────────────────────────────────
  const replies = [];
  const ctx = {
    jid: "123@g.us", m: { key: { id: "1" } }, args: ["test"], text: "test",
    isGroup: true, isAdmin: false, isOwner: false, prefix: ".",
    natsu: sock,
    reply: async (c) => { replies.push(c.text || ""); },
  };
  await REGISTRY.statusgc.handler(ctx);
  check("refusé pour un non-admin", replies.some((t) => /Admins only/i.test(t)));

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
