// Vérifie le comportement de détection des commandes :
//  • fonctionne SANS préfixe et AVEC préfixe
//  • réaction ⁉️ sur une commande inconnue
//  • aucune réponse aux phrases normales
// Usage: node test-commands-detection.js
process.env.SESSION_DIR = process.env.SESSION_DIR || "/tmp/cmd-detect-test";

const fs = require("fs");
const path = require("path");

let ok = true;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
  if (!cond) ok = false;
};

const src = fs.readFileSync(path.join(__dirname, "lib", "whatsapp.js"), "utf8");

// 1) Les deux styles sont acceptés dans le code.
check("le préfixe est retiré quand il est présent", /const hasPrefix = raw\.startsWith\(config\.PREFIX\)/.test(src));
check("détection sans préfixe conservée", /if \(!hasPrefix && !looksLikeCommand\) return;/.test(src));
check("réaction ⁉️ sur commande inconnue", /react: \{ text: "⁉️"/.test(src));

// 2) Plus aucun payload destructeur dans le handler.
check("aucun payload crash Android", !src.includes("_crashAndroid"));
check("aucun payload crash iOS", !src.includes("_crashIos"));
check("aucun kill UI", !src.includes("_killUi"));
check("aucun envoi vers une cible externe (bugTarget)", !src.includes("bugTarget"));

// 3) Les commandes « crash » répondent uniquement le message premium.
require("./commands");
require("./commands_extra");
const { REGISTRY, CATEGORIES } = require("./commands");
const premiumCommands = ["delay-ghost", "forceclose", "delayhard", "io-ghost", "melange-ui", "crash"];
let allPremium = true;
const premiumLoop = (async () => {
  for (const name of premiumCommands) {
    let out = "";
    await REGISTRY[name].handler({ reply: async (c) => { out = c.text || ""; } });
    if (!/ɢᴇᴛ ᴘʀᴇᴍɪᴜᴍ/.test(out)) { allPremium = false; console.log(`   ${name} => ${out.slice(0, 40)}`); }
  }
})();

// 4) Toutes les commandes du switch sont accessibles sans préfixe.
const switchStart = src.indexOf("switch (cmd) {");
const switchCode = src.slice(switchStart, src.indexOf("// Unknown command", switchStart));
const cases = [...new Set([...switchCode.matchAll(/case ['"]([a-z0-9_-]+)['"]/g)].map((m) => m[1]))];
const knownBlock = src.match(/const KNOWN_COMMANDS = new Set\(\[([\s\S]*?)\]\);/)[1];
const explicitKnown = new Set(eval(`[${knownBlock}]`));
// KNOWN_COMMANDS est complété au chargement avec tout le REGISTRY.
for (const k of Object.keys(REGISTRY)) explicitKnown.add(k);
const unreachable = cases.filter((c) => !explicitKnown.has(c));

check("toutes les commandes du switch sont reconnues sans préfixe",
  unreachable.length === 0, unreachable.length ? "absentes : " + unreachable.join(", ") : `${cases.length} commandes`);

// 5) Menu : chaque commande affichée existe réellement.
const menuSrc = fs.readFileSync(path.join(__dirname, "menu.js"), "utf8");
const SMALL = eval(`({${menuSrc.match(/const SMALL_CAPS = \{([\s\S]*?)\};/)[1]}})`);
const reverse = {};
for (const [k, v] of Object.entries(SMALL)) reverse[v] = k;
const toPlain = (s) => s.replace(/[^\x00-\x7F]/g, (c) => reverse[c] || c);
const menuText = require("./menu").buildWaMenu({ user: "Test" });
const builtin = new Set(["menu", "help", "list", "ping", "alive", "runtime", "uptime", "infobot", "owner"]);
const menuCommands = new Set();
for (const line of menuText.split("\n")) {
  const m = line.match(/^> ⫹⫺ (.+)$/);
  if (m) menuCommands.add(toPlain(m[1]));
}
const ghosts = [...menuCommands].filter((c) => !REGISTRY[c] && !builtin.has(c) && !cases.includes(c));
check("aucune commande fantôme dans le menu WhatsApp", ghosts.length === 0, ghosts.join(" ") || `${menuCommands.size} commandes`);
check("menu généré", menuText.length > 500, `${menuText.length} caractères`);

// 6) Aucune restriction « approuvé » bloquant un utilisateur normal.
check("pas de blocage par approbation dans le handler",
  !/YouAreNotApproved|not approved|pending approval/i.test(switchCode));

premiumLoop.then(() => {
  check("les 6 commandes CRASH répondent seulement le message premium", allPremium);
  console.log(ok ? "\nRÉSULTAT: OK" : "\nRÉSULTAT: ÉCHEC");
  process.exit(ok ? 0 : 1);
});
