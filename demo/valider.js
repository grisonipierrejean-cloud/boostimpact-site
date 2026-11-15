// Page publique de validation par lien (valider.html#<jeton>), ouverte depuis l'email « ... attend votre accord ».
// Aucune connexion : le jeton suffit. Il ne sert qu'une fois et vaut 7 jours. Un avis sensible n'est jamais proposé ici.
// Démonstration : RENOM_PUBLIC est l'adaptateur de démonstration (stockage du navigateur). Supabase : fonctions publiques
// objet_par_jeton et valider_par_jeton (voir ordres/CONTRAT-MAJ-MEMBRE.md).
(function () {
  const P = window.RENOM_PUBLIC, M = window.RENOM_MAJ, $ = id => document.getElementById(id);
  // Textes : espace/web/i18n.js. Langue : ?lang=, puis le choix enregistré, puis celle du commerce, sinon le français.
  const I = window.RENOM_I18N, t = I.t;
  const e = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const jeton = decodeURIComponent(location.hash.replace(/^#\/?/, "")).trim();
  const RES = () => I.carte("res", ["instagram", "facebook", "google", "tiktok"]);
  const date = d => I.dateEtHeure(d);
  const ETATS = ["utilise", "expire", "traite"];
  const etat = cle => ETATS.includes(cle) ? [t("val.etat." + cle), t("val.etat." + cle + ".texte")] : [t("pub.lien.inconnu"), t("val.inconnu.texte")];
  const etatDuMessage = m => { m = String(m || "").toLowerCase(); return /servi|utilis/.test(m) ? "utilise" : /expir/.test(m) ? "expire" : /trait/.test(m) ? "traite" : /reconnu|introuvable|inconnu/.test(m) ? "inconnu" : null; };
  const msg = x => { $("msg").textContent = x; };
  function erreur(cle, titre, texte) {
    const [a, x] = cle ? etat(cle) : [titre, texte];
    $("chargement").hidden = true; $("page").hidden = true; $("fait").hidden = true; $("erreur").hidden = false; $("erreur-titre").textContent = a; $("erreur-texte").textContent = x;
  }
  const FAIT = cle => [t("val.fait." + cle), t("val.fait." + cle + ".texte")];
  let objet = null;
  // Refuser (31/10/2026) : jamais d'un seul geste. La barre de décision devient la question, avec « Refuser » et « Garder ».
  function confirmerRefus(question, oui, decision) {
    const avant = $("boutons").innerHTML;
    $("boutons").innerHTML = `<p class="fort" id="refus-question">${question}</p><button type="button" class="bouton second" id="refus-oui">${oui}</button><button type="button" class="bouton second" id="refus-garder">${t("dec.refus.garder")}</button>`;
    $("refus-oui").onclick = () => decider(decision);
    $("refus-garder").onclick = () => { $("boutons").innerHTML = avant; brancher(); };
    $("refus-garder").focus();
  }
  let brancher = () => {};
  async function decider(decision, texte) {
    const boutons = [...document.querySelectorAll("#decision button")]; boutons.forEach(b => { b.disabled = true; }); msg(t("envoi.en.cours"));
    try {
      const r = await P.validerParJeton(jeton, decision, texte);
      const [a, x0] = FAIT(decision === "refuse" ? "refuse_" + objet : decision === "valide" && objet === "commentaire" ? "valide_commentaire" : decision);
      // Contenu approuvé : la base le programme tout de suite (schema.sql, bloc « Programmation à l'approbation ») et rend la date et les réseaux.
      const prog = decision === "approuve" && r && r.prevu_le ? r : null, R = RES();
      const x = prog ? t("val.fait.approuve.programme", { quand: I.dateHeureDans(prog.prevu_le), res: ["instagram", "facebook", "tiktok", "google"].filter(k => (prog.reseaux || []).includes(k)).map(k => R[k] || k).join(", ") }) : x0;
      $("page").hidden = true; $("fait").hidden = false; $("fait-titre").textContent = a; $("fait-texte").textContent = x;
    } catch (er) {
      const cle = etatDuMessage(er && er.message); if (cle) return erreur(cle);
      boutons.forEach(b => { b.disabled = false; }); msg(er && er.message ? I.phrase(er.message) : t("pub.envoi.echec"));
    }
  }
  // Les textes du commerce (légende, avis, réponse proposée) gardent leur langue : l'attribut lang le dit au navigateur.
  let lc = "";
  function contenu(o) {
    // Même règle que l'espace et la programmation (donnees.js) : un réseau de l'offre pas encore connecté (TikTok souvent) n'est pas annoncé
    // comme destination ; une note dit que ce contenu n'y partira pas (« connectes » rendu par objet_par_jeton ; absent : connexions inconnues).
    const comptes = Array.isArray(o.connectes) ? ["instagram", "facebook", "google", "tiktok"].map(r => ({ reseau: r, etat: o.connectes.includes(r) ? "connecte" : "non_connecte" })) : null;
    const d = M.destinations(o, o.reseaux, comptes), absents = d.absents.filter(r => r !== "google"), res = d.reseaux.filter(r => !absents.includes(r));
    const f = M.formatDe(o), vertical = f !== "publication", R = RES();
    const avecTiktok = res.includes("tiktok"), seulGoogle = res.length === 1 && res[0] === "google";
    $("titre").textContent = t(f === "story" ? "val.titre.story" : f === "video" ? "val.titre.video" : "val.titre.publication");
    const visuel = o.video_url ? `<video class="visuel vertical" controls preload="metadata" poster="${e(o.visuel_url || "")}" src="${e(o.video_url)}"></video>`
      : o.visuel_url ? `<img class="visuel${vertical ? " vertical" : ""}" src="${e(o.visuel_url)}" alt="${t("visuel.alt")}">` : `<p class="note">${t("val.apercu.indispo")}</p>`;
    // Publication photo : les deux visuels qui partent (4:5 pour Instagram, Facebook et Google, 9:16 pour TikTok), côte à côte, avec leurs réseaux.
    const fig = (u, alt, res, fmt, cls, vide) => `<figure class="format ${cls}">${u ? `<img src="${e(u)}" alt="${alt}">` : `<div class="format-vide"><p class="note">${vide}</p></div>`}
      <figcaption><span class="fort">${res}</span><span class="note">${fmt}</span></figcaption></figure>`;
    // Essentiel (fiche Google seule, 30/10/2026) ou commerce sans TikTok : pas de bloc « Ce qui part sur chaque réseau » (un seul visuel part).
    const bloc = M.photoPublication(o) && o.visuel_url && avecTiktok ? `<section class="carte formats" aria-labelledby="formats-titre"><h2 id="formats-titre">${t("fmt.titre")}</h2>
        <div class="formats-rangee">${fig(o.visuel_url, t("fmt.alt.45"), t("fmt.res.45"), t("fmt.45"), "f45", "")}${fig(o.visuel_9x16_url, t("fmt.alt.916"), t("fmt.res.916"), t("fmt.916"), "f916", t("val.apercu.indispo"))}</div>
        <p class="note">${t("fmt.note")}</p></section>`
      : `<section class="carte"><h2>${t("val.visuel")}</h2>${M.estIA(o) ? `<div class="bloc-ia"><p class="etiquette-ia" data-ia>${t("ia.etiquette")}</p><p class="note" data-ia-det>${t("ia.etiquette.det")}</p></div>` : ""}${visuel}</section>`;
    $("objet").innerHTML = `${bloc}
      <section class="carte"><h2>${t(seulGoogle ? "val.legende.google" : "val.legende.reseau")}</h2><ul class="legendes">${res.map(r => { const x = M.legendeDe(o, r); return `<li data-reseau="${r}"><span class="reseau">${R[r]}</span><p class="texte"${lc}>${e(x)}</p>${r === "google" && M.longueur(x) > M.LIMITE_GOOGLE ? `<p class="note">${t("val.trop.google")}</p>` : ""}</li>`; }).join("")}</ul>
        ${absents.map(r => `<p class="note" data-absent="${r}">${t("res.absent", { res: R[r] })}${r === "tiktok" ? (o.tiktok_demande_le ? ` <span data-tiktok-demande>${t("acc.act.tiktok.demande", { d: I.date(o.tiktok_demande_le) })}</span>` : ` <a href="${e(I.lien("index.html") + "#/comptes?tiktok")}" id="val-tiktok">${t("acc.act.tiktok")}</a>`) : ""}</p>`).join("")}
        <p class="note">${t("val.modifier.note.lien", { espace: `<a href="${e(I.lien("index.html") + "#/contenus")}" id="val-espace">${t("val.votre.espace")}</a>` })}</p></section>`;
    $("boutons").innerHTML = `<button type="button" class="bouton" id="approuver">${t("dec.approuver")}</button><button type="button" class="bouton second" id="modifier">${t("val.demander.modif")}</button><button type="button" class="lien" id="refuser">${t("refuser")}</button>`;
    brancher = () => { $("approuver").onclick = () => decider("approuve"); $("refuser").onclick = () => confirmerRefus(t("dec.refus.question"), t("dec.refus.oui"), "refuse");
      $("modifier").onclick = ouvrirMot; };
    const ouvrirMot = () => { $("page").classList.remove("collante"); $("boutons").hidden = true; $("zone-mot").hidden = false; $("mot").focus({ preventScroll: true }); $("decision").scrollIntoView({ block: "start" }); };
    // Barre de décision collée en bas sur téléphone (valider.html, #page.collante) ; retirée pendant la saisie du mot.
    $("page").classList.add("collante");
    brancher();   // « Demander une modification » : en haut de l'écran : le clavier ne cache pas « Envoyer la demande »
    $("annuler-mot").onclick = () => { $("page").classList.add("collante"); $("boutons").hidden = false; $("zone-mot").hidden = true; msg(""); };
    $("envoyer-mot").onclick = () => { const x = $("mot").value.trim(); if (!x) { msg(t("val.ecrire.mot")); $("mot").focus(); return; } decider("modification", x); };
  }
  function avis(o) {
    $("titre").textContent = t("val.avis.titre");
    const n = +o.note || 0;
    $("objet").innerHTML = `<section class="carte"><h2>${t("val.l.avis")}</h2><p class="fort">${t("etoiles", { n })}${o.auteur ? " · " + e(o.auteur) : ""}</p>${o.texte ? `<p class="citation"${lc}>${t("guillemets", { x: e(o.texte) })}</p>` : `<p class="note">${t("val.note.sans.texte")}</p>`}</section>
      <section class="carte"><div class="f"><label for="reponse">${t("rep.proposee")}</label><textarea id="reponse" maxlength="4000"${lc}>${e(o.reponse_proposee || "")}</textarea></div>
        <p class="note">${t("val.publiee.sous.avis")}</p></section>`;
    $("boutons").innerHTML = `<button type="button" class="bouton" id="valider">${t("rep.valider")}</button><button type="button" class="lien" id="refuser">${t("rep.refuser")}</button>`;
    brancher = () => { $("valider").onclick = () => { const x = $("reponse").value.trim(); if (!x) { msg(t("val.reponse.vide")); $("reponse").focus(); return; } decider("valide", x); };
      $("refuser").onclick = () => confirmerRefus(t("val.refus.avis.question"), t("rep.refuser"), "refuse"); }; brancher();
  }
  // Réponse à un commentaire Instagram ou Facebook (jamais un commentaire sensible : la base ne crée pas de lien pour lui).
  function commentaire(o) {
    const reseau = { instagram: "Instagram", facebook: "Facebook" }[o.reseau] || t("val.vos.reseaux");
    $("titre").textContent = t("val.cm.titre");
    $("objet").innerHTML = `<section class="carte"><h2>${t("val.cm.sur", { res: e(reseau) })}</h2>${o.auteur ? `<p class="fort">${e(o.auteur)}</p>` : ""}${o.texte ? `<p class="citation"${lc}>${t("guillemets", { x: e(o.texte) })}</p>` : `<p class="note">${t("val.texte.indispo")}</p>`}</section>
      <section class="carte"><div class="f"><label for="reponse">${t("rep.proposee")}</label><textarea id="reponse" maxlength="1000"${lc}>${e(o.reponse_proposee || "")}</textarea></div>
        <p class="note">${t("val.publiee.sous.cm")}</p></section>`;
    $("boutons").innerHTML = `<button type="button" class="bouton" id="valider">${t("cm.valider")}</button><button type="button" class="lien" id="refuser">${t("cm.ne.pas.repondre")}</button>`;
    brancher = () => { $("valider").onclick = () => { const x = $("reponse").value.trim(); if (!x) { msg(t("val.reponse.vide")); $("reponse").focus(); return; } decider("valide", x); };
      $("refuser").onclick = () => confirmerRefus(t("val.refus.cm.question"), t("cm.ne.pas.repondre"), "ignore"); }; brancher();
  }
  async function charger() {
    if (P) $("demo").hidden = P.mode !== "demo";
    if (!P || !P.objetParJeton || !/^[A-Za-z0-9_-]{16,128}$/.test(jeton)) return erreur("inconnu");
    let o;
    try { o = await P.objetParJeton(jeton); } catch (er) { const cle = etatDuMessage(er && er.message); return cle ? erreur(cle) : erreur(null, t("pub.chargement.echec"), t("pub.verifier.connexion")); }
    if (!o) return erreur("inconnu");
    // Langue du commerce (renvoyée avec l'objet) : la page s'y met, sauf ?lang= ou choix enregistré.
    const lg = I.langueValide(o.langue); if (lg) { I.depuisCommerce(lg); lc = ` lang="${lg}"`; }
    if (o.etat && o.etat !== "a_valider") return erreur(ETATS.includes(o.etat) ? o.etat : "inconnu");
    objet = o.objet === "avis" ? "avis" : o.objet === "commentaire" ? "commentaire" : "contenu";
    const nom = o.commerce || o.nom_commerce || o.nom || "";
    $("commerce").textContent = nom; document.title = t("val.titre.page") + (nom ? ", " + nom : "");
    if (objet === "avis") avis(o); else if (objet === "commentaire") commentaire(o); else contenu(o);
    $("expire").textContent = o.expire_le ? t("val.expire", { d: date(o.expire_le) }) : t("val.une.fois");
    $("chargement").hidden = true; $("page").hidden = false;
  }
  window.addEventListener("hashchange", () => location.reload());
  charger();
})();
