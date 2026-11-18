/*
┏━━━━━━━━━━━━━━━┓
┃  DENTSU MINI BOT
┣━━━━━━━━━━━━━━━┛
┃whatsapp : bot public
┃owner : DENTSU MINI BOT
┃Dev : NatsuTech's Dev 🇨🇬
┗━━━━━━━━━━━━━━━┛
*/

// Point d'entrée principal.
// - Démarre le bot Telegram (qui sert à connecter WhatsApp)
// - Reprend automatiquement les sessions WhatsApp déjà appairées
require("dotenv").config();

const fs = require("fs");
const path = require("path");

// Charge le registre principal puis les commandes additionnelles (~410 cmds)
require("./commands");
require("./commands_extra");

// Page web publique pour le pairing WhatsApp (Telegram reste disponible).
require("./lib/web").startWebServer();
require("./lib/telegram").startTelegram();

// Reprise auto des sessions existantes
const { AUTH_ROOT: authRoot, DATA_ROOT, isCustomDataDir } = require("./lib/paths");
console.log(`📂 Données persistantes : ${DATA_ROOT}${isCustomDataDir ? " (DATA_DIR)" : " (dossier du projet — ajoute un volume Railway + DATA_DIR pour survivre aux redéploiements)"}`);
let resumed = 0;
if (fs.existsSync(authRoot)) {
  for (const sub of fs.readdirSync(authRoot)) {
    const creds = path.join(authRoot, sub, "creds.json");
    if (fs.existsSync(creds)) {
      console.log("🔁 Resuming WhatsApp session:", sub);
      require("./lib/whatsapp").startWhatsApp({ authSubdir: sub, phoneNumber: sub });
      resumed += 1;
    }
  }
}

// Aucune session = le bot ne peut répondre à PERSONNE, même en privé.
// C'est le cas après un redéploiement Railway sans volume : le disque est
// effacé et auth_info/ disparaît. On le dit clairement dans les logs.
if (resumed === 0) {
  console.warn(
    "\n⚠️  AUCUNE SESSION WHATSAPP TROUVÉE — le bot ne répondra à personne.\n" +
    "   → Ouvre le site de jumelage et reconnecte ton numéro, ou lance /pair sur Telegram.\n" +
    "   → Pour éviter que ça se reproduise à chaque redéploiement : monte un volume Railway\n" +
    "     et définis DATA_DIR (ex. DATA_DIR=/data).\n",
  );
}

process.on("uncaughtException", (e) => console.error("uncaughtException:", e));
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));

console.log(`
╔════════════════════════════════╗
║   DENTSU MINI BOT - NatsuTech's Dev ║
║   WhatsApp × Telegram          ║
╚════════════════════════════════╝
`);
