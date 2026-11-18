/*
┏━━━━━━━━━━━━━━━┓
┃  DENTSU MINI BOT
┣━━━━━━━━━━━━━━━┛
┃ Emplacement des fichiers persistants (sessions WhatsApp, abonnés
┃ Telegram…).
┃
┃ Sur Railway, le système de fichiers est effacé à chaque redéploiement :
┃ sans volume, le dossier auth_info/ disparaît et le bot se retrouve
┃ déconnecté (il ne répond plus à personne).
┃
┃ Pour garder la session : monter un volume (ex. /data) sur le service et
┃ définir la variable DATA_DIR=/data. Le dossier est alors créé là-bas et
┃ survit aux redéploiements.
┗━━━━━━━━━━━━━━━┛
*/

const fs = require("fs");
const path = require("path");

// Dossier racine des données persistantes.
// - DATA_DIR défini  -> DATA_DIR (volume Railway, ex. /data)
// - sinon            -> dossier du projet (comme avant)
const DATA_ROOT = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "..");

// Dossier des sessions WhatsApp (un sous-dossier par numéro appairé).
const AUTH_ROOT = path.join(DATA_ROOT, "auth_info");

function ensureDir(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (error) {
    console.error(`❌ impossible de créer ${dir}:`, error.message);
  }
  return dir;
}

function authDirFor(folder) {
  return path.join(AUTH_ROOT, folder || "default");
}

module.exports = {
  DATA_ROOT,
  AUTH_ROOT,
  ensureDir,
  authDirFor,
  isCustomDataDir: Boolean(process.env.DATA_DIR),
};
