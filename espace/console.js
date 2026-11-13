(function () {
  const D = window.RENOM_DATA, $ = id => document.getElementById(id), vue = $("vue");
  // Textes, dates et nombres : espace/web/i18n.js (français ou anglais).
  const I = window.RENOM_I18N, t = I.t, ph = I.phrase;
  const e = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const msg = x => { const m = $("msg"); if (m) m.textContent = x; };
  const dh = I.dateHeureCourte;
  const METIERS = I.carte("metier", ["restaurant", "beaute", "sport", "autre"]);
  const INVITATION = I.carte("con.inv", ["a_envoyer", "envoyee", "acceptee", "echec"]);
  const OFFRES = window.RENOM_OFFRES;
  $("demo").hidden = D.mode !== "demo";
  const entete = (titre, texte) => `<div class="entete"><p class="sur">${t("con.sur")}</p><h1>${titre}</h1>${texte ? `<p class="chapo">${texte}</p>` : ""}</div>`;

  // ---------------- Prise en charge (« Je prends », 26/10/2026, audit du parcours, constat 26). Le compte de la console est partagé (bloc
  // « Administrateur sans double authentification ») : la session ne dit pas QUI est connecté. Le prénom est donc choisi sur chaque appareil (stockage
  // du navigateur, simple confort) et envoyé avec chaque prise (fonction SQL admin_prendre). Chaque carte de « À faire » a une clé « <objet>:<id> » ;
  // « Pris par Pascal, 14 h 02 » et le filtre « À moi » en découlent. Base sans le bloc « Console : garantie des 24 h tenue à deux » : adminPrises
  // rend null, et tout ce qui touche à la prise est masqué.
  const CLE_PRENOM = "renom-console-prenom";
  let moi = (() => { try { return (localStorage.getItem(CLE_PRENOM) || "").trim().slice(0, 40); } catch (er) { return ""; } })();
  const garderMoi = v => { moi = String(v || "").trim().slice(0, 40); try { if (moi) localStorage.setItem(CLE_PRENOM, moi); else localStorage.removeItem(CLE_PRENOM); } catch (er) {} };
  let prises = null;
  const memeNom = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
  const quandPris = d => new Date(d).toDateString() === new Date().toDateString() ? I.heure(d) : dh(d);
  const blocPrise = cle => { const p = prises[cle], mien = p && memeNom(p.par, moi);
    return `<div class="prise" data-prise="${e(cle)}">${p ? `<p class="note fort" data-pris-par>${t("con.prise.par", { p: e(p.par), h: quandPris(p.pris_le) })}</p>` : ""}<button type="button" class="bouton second petit" data-prendre="${mien ? 0 : 1}">${t(mien ? "con.prise.laisser" : p ? "con.prise.reprendre" : "con.prise.prendre")}</button></div>`; };
  const avecPrise = (html, cle) => cle && prises ? html.replace(/<\/article>\s*$/, blocPrise(cle) + "</article>") : html;
  const aMoi = cle => !!(prises && cle && prises[cle] && memeNom(prises[cle].par, moi));
  async function lirePrises() { try { const l = D.adminPrises ? await D.adminPrises() : null; prises = Array.isArray(l) ? Object.fromEntries(l.map(x => [x.cle, x])) : null; } catch (er) { prises = null; } }

  // ---------------- Navigation (25/10/2026, décision de PJ : « c'est trop, ajuste ») : trois onglets. À faire (une seule file triée par urgence :
  // alertes, à publier à la main, avis de l'équipe, vidéos, garanties, mises en route, options), Clients (liste, fiche de chaque client, nouveau
  // client, journal) et Prospects. Barre latérale sur ordinateur, onglets du bas sur téléphone.
  const trait = d => `<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  // 29/10/2026 (demande de PJ) : « Cockpit » en tête, premier écran à l'ouverture ; les trois autres onglets inchangés.
  const ENTREES = [
    ["cockpit", t("con.entree.cockpit"), trait('<path d="M4 15a8 8 0 0 1 16 0"></path><path d="M12 15l4-5"></path><path d="M4 19h16"></path>')],
    ["afaire", t("con.entree.afaire"), trait('<rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M8.5 12.5l2.5 2.5 4.5-5"></path>')],
    ["clients", t("con.entree.clients"), trait('<path d="M4 10l1.5-5h13L20 10"></path><path d="M5 10v10h14V10"></path><path d="M4 10h16M10 20v-5h4v5"></path>')],
    ["prospects", t("con.entree.prospects"), trait('<circle cx="9" cy="8" r="3.5"></circle><path d="M3 20c.8-3.6 3.2-5.5 6-5.5s5.2 1.9 6 5.5"></path><path d="M16 6.5h5M18.5 4v5"></path>')],
  ];
  // Mode d'emploi (11/11/2026, demande de PJ : « un tuto explicatif ») : hors des quatre onglets. Barre latérale : groupe « Aide » sous le menu ;
  // téléphone : lien dans l'en-tête, comme « Réglages » dans l'espace (jamais un 5e onglet en bas).
  const GUIDE = ["guide", t("con.entree.guide"), trait('<path d="M5 4.5h9a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"></path><path d="M17 7.5h2V20"></path><path d="M8.5 9h5M8.5 12.5h5"></path>')];
  const large = window.matchMedia("(min-width: 900px)"); let route = "cockpit", connecte = false;
  function dessinerNav() {
    document.body.classList.toggle("hors-session", !connecte);
    const lat = $("lat"), haut = $("haut"), onglets = $("onglets"); lat.innerHTML = haut.innerHTML = onglets.innerHTML = "";
    if (!connecte) return;
    const lien = ([r, nom, icone], avecIcone) => `<a href="#/${r}" data-r="${r}"${r === route ? ' aria-current="page"' : ""}>${avecIcone ? `<span class="onglet-icone">${icone}</span>` : ""}<span>${nom}</span></a>`;
    if (large.matches) lat.innerHTML = `<div class="lat-in"><a class="logo" href="${I.lien("console.html")}" translate="no"><img class="logo-img" src="icones/logo-ligne-encre.png?v=pascal" width="482" height="80" alt="boost impact."></a><nav id="nav" class="menu" aria-label="${t("con.titre")}"><div class="groupe"><p class="groupe-lib">${t("con.titre")}</p>${ENTREES.map(x => lien(x, false)).join("")}</div></nav><nav id="nav-aide" class="menu" aria-label="${t("con.entree.guide")}"><div class="groupe">${lien(GUIDE, false)}</div></nav><div class="lat-pied">${I.selecteur()}<button type="button" id="sortir" class="quitter">${t("quitter")}</button></div></div>`;
    else { haut.innerHTML = `<a class="logo" href="${I.lien("console.html")}" translate="no"><img class="logo-img" src="icones/logo-ligne-encre.png?v=pascal" width="482" height="80" alt="boost impact."></a><span class="haut-note">${t("con.titre")}</span><a class="haut-guide" href="#/guide" data-r="guide"${route === "guide" ? ' aria-current="page"' : ""}>${t("con.entree.guide")}</a>${I.selecteur()}<button type="button" id="sortir" class="quitter">${t("quitter")}</button>`;
      onglets.innerHTML = ENTREES.map(x => lien(x, true)).join(""); }
  }

  // Compte connecté sans droit sur la console (un commerçant, 25/10/2026) : « Accès réservé », et « Se connecter avec un autre compte » (déconnexion,
  // puis le formulaire de connexion) en plus du retour à son espace.
  async function refuse() { connecte = false; dessinerNav(); vue.innerHTML = `<div class="connexion"><div class="carte" id="acces-reserve"><div class="connexion-tete"><p class="logo" translate="no"><img class="logo-img" src="icones/logo-ligne-encre.png?v=pascal" width="482" height="80" alt="boost impact."></p>${I.selecteur()}</div><div class="entete"><h1>${t("con.refuse.titre")}</h1><p class="chapo">${t("con.refuse.texte")}</p></div><button type="button" class="bouton plein" id="autre-compte">${t("acces.autre.compte")}</button><a class="bouton second plein" href="${I.lien("index.html")}">${t("con.retour.espace")}</a></div></div>`;
    $("autre-compte").onclick = async () => { await D.quitter(); location.hash = ""; rendre(); }; }
  async function connexion() {
    connecte = false; dessinerNav();
    // Démonstration : l'adresse de l'administrateur vient de la graine chargée (parcours ou graine publique).
    const admins = D.mode === "demo" && D.comptesDemo ? (await D.comptesDemo()).filter(x => x.role === "administrateur").map(x => x.email) : [];
    // Accès par mot de passe (17/10/2026) : même écran que l'espace (acces.js).
    window.RENOM_ACCES.connexion({ vue, I, D, titre: t("con.titre"), chapo: t("con.connexion"), apres: rendre,
      extra: admins.length ? `<p class='note' id="comptes-demo">${t("con.demo", { l: e(admins.join(", ")) })}</p>` : "",
      pied: `<p class="retour"><a href="${I.lien("index.html")}">${t("con.retour")}</a></p>` });
  }
  // Session ouverte par un lien d'email : seulement le choix du mot de passe (la base refuse tout le reste à une telle session).
  function choixMotDePasse(s) {
    connecte = false; dessinerNav();
    window.RENOM_ACCES.choixMotDePasse({ vue, I, D, email: s.email, apres: rendre, annuler: async () => { await D.quitter(); location.hash = ""; rendre(); } });
  }
  // Double authentification de l'administrateur (18/10/2026, décision de PJ) : après le mot de passe, « Activez la double authentification »
  // (aucun facteur : QR code) ou « Code de votre application ». RETIRÉE le 22/10/2026 (décision de PJ) : gardée derrière DOUBLE_AUTH_ADMIN
  // (acces.js, false) ; la console s'ouvre à l'adresse + mot de passe, la base aussi (bloc « Administrateur sans double authentification »).
  function doubleAuth(s, mode) {
    connecte = false; dessinerNav();
    window.RENOM_ACCES.doubleAuthentification({ vue, I, D, mode, email: s.email, apres: rendre, annuler: async () => { await D.quitter(); location.hash = ""; rendre(); } });
  }

  // Score de santé (automatisations de service) : niveau en toutes lettres et raisons en clair. Règles : fonction SQL sante_de (schema.sql), les mêmes en démonstration.
  const NIVEAUX = I.carte("con.niveau", ["vert", "orange", "rouge"]), RANG = { rouge: 0, orange: 1, vert: 2 };
  const COURT = I.carte("con.court", ["compte", "google", "metricool", "demarrage"]);
  const sante = s => s ? `<p><span class="sante sante-${e(s.niveau)}">${NIVEAUX[s.niveau] || e(s.niveau)}</span></p>${s.raisons.length ? `<ul class="raisons">${s.raisons.map(r => `<li>${e(ph(r))}</li>`).join("")}</ul>` : `<p class="note">${t("con.rien.signaler")}</p>`}` : `<p class="note">${t("con.non.calcule")}</p>`;
  // ---------------- Un seul bouton par fait (v46, 11/11/2026, relecture « exploitation » : « deux boutons pour un même fait »). Avant, « Google vérifié »
  // (mise en route) ne cochait que l'étape (admin_mise_en_route) et lançait la garantie, sans relier le compte, quand « Accès vérifié » Google (Comptes)
  // reliait le compte (admin_acces_reseau) : deux effets différents pour un même constat. Désormais les deux passent par la même action complète
  // (brancherCartes, verifier) : admin_acces_reseau (compte « connecté », la base coche l'étape par le déclencheur suivre_mise_en_route et programme les
  // publications déjà validées), puis pour Google la date de départ de la garantie si elle manque (noterAccesGoogle), après une confirmation explicite.
  // Un seul bouton visible par fait : dans la mise en route tant que l'étape n'est pas faite, dans Comptes ensuite. Même règle pour les réseaux sociaux
  // et l'étape Metricool (un bouton « Instagram vérifié »… par réseau, au lieu de « Metricool vérifié » + « Accès vérifié »). Une étape cochée par erreur
  // se remet « à faire » (« Annuler » : admin_mise_en_route accepte « a_faire » ; les accès notés vérifiés sont notés retirés).
  const RES_SOCIAUX = ["instagram", "facebook", "tiktok"];
  const etapeOuverte = (c, r) => { const m = c.sante && c.sante.mise_en_route, pt = r === "google" ? "google" : RES_SOCIAUX.includes(r) ? "metricool" : null;
    const x = m && pt && (m.points || []).find(y => y.point === pt); return !!x && x.etat !== "fait"; };
  const actionMer = (c, x) => { const cid = e(c.id);
    if (x.etat === "fait") return ["google", "metricool"].includes(x.point) ? `<button type="button" class="lien" data-mer-annuler="${e(x.point)}" data-cid="${cid}">${t("con.mer.annuler")}</button>` : "";
    // v48 (12/11/2026, retour de PJ : « je ne dois rien vérifier moi-même ») : le robot des fiches Google coche l'étape seul ; la vérification à la main
    // n'est plus qu'un recours discret (même action complète, même confirmation).
    if (x.point === "google") return `<button type="button" class="lien recours" data-mer="google" data-cid="${cid}">${t("con.mer.g.manuel")}</button>`;
    if (x.point !== "metricool") return "";
    const avecLien = "lien_envoye_le" in x, aVerifier = !avecLien || !!x.lien_envoye_le || x.etat === "declare";
    // v49 (13/11/2026, retour de PJ : « Lien envoyé », gros bouton vert, se lisait comme un état) : un verbe, toujours en bouton secondaire ; l'état est
    // dit en une phrase au-dessus (etapeMetricool).
    const lien = avecLien && x.etat === "a_faire" ? `<button type="button" class="bouton second petit" data-mer-lien data-cid="${cid}">${t(x.lien_envoye_le ? "con.mer.lien.renvoye" : "con.mer.lien.bouton")}</button>` : "";
    const sociaux = window.RENOM_RESEAUX_AUTORISES(c).filter(r => RES_SOCIAUX.includes(r) && ((c.comptes || {})[r] || {}).etat !== "connecte");
    const verif = !aVerifier ? "" : sociaux.length ? sociaux.map(r => `<button type="button" class="bouton petit" data-acces="${r}" data-oui="1" data-cid="${cid}">${t("con.verifie", { x: NOM_RESEAU[r] })}</button>`).join("")
      : `<button type="button" class="bouton petit" data-mer="metricool" data-cid="${cid}">${t("con.verifie", { x: "Metricool" })}</button>`;
    return lien + verif; };
  // Carte « Mise en route » de À faire : les étapes qui restent, chacune avec les mêmes boutons que la fiche (actionMer).
  const miseEnRoute = c => { const m = c.sante && c.sante.mise_en_route; if (!m) return ""; const reste = (m.points || []).filter(x => x.etat !== "fait");
    return `<p>${t("sur", { a: m.faits, b: m.total })}</p>${reste.map(x => { const a = actionMer(c, x);
      return `<p class="note">${COURT[x.point] || e(x.point)}${t("deux.points")}${t(x.etat === "declare" ? (x.point === "google" ? "con.mer.declare.google" : "con.mer.declare") : "con.mer.afaire")}</p>${a ? `<div class="actions">${a}</div>` : ""}`; }).join("")}`; };
  // Mise en route sur la fiche du client (11/11/2026, retour de PJ : « je ne comprends pas ») : les étapes de l'offre TOUJOURS, une ligne chacune (nom
  // clair, état en mots avec sa date, action de l'équipe à droite), puis les réponses du client aux 5 questions (commerces.demarrage), repliées.
  // v46 : « X sur 5 répondues » dans la ligne de l'étape ; « quand cliquer Google vérifié » et la procédure Metricool ne sont plus sur la fiche (trop de
  // texte) : un lien mène au Mode d'emploi, qui les garde (quandGoogle, procReseaux sans état). La carte de « À faire » garde la forme courte.
  const TONS = I.carte("ton", ["chaleureux", "sobre", "enjoue"]), ACTIONS = I.carte("action", ["reserver", "appeler", "venir", "acheter"]);
  const etatMer = x => x.etat === "fait" ? (x.maj ? t("con.mer.etat.fait.le", { d: I.date(x.maj) }) : t("con.mer.etat.fait"))
    : x.etat === "declare" ? (x.maj ? t("con.mer.etat.declare.le", { d: dh(x.maj) }) : t("con.mer.etat.declare")) : t("con.mer.etat.afaire");
  // Étape en cours : lien pas encore noté « envoyé », 1 et 2 ; noté, 4 (1 à 3 faites). Sans x (Mode d'emploi) : la procédure seule.
  const procReseaux = x => { const lien = x && x.lien_envoye_le, cur = !x || x.etat === "fait" ? 0 : lien || x.etat === "declare" ? 4 : 1;
    return `<ol class="mer-proc">${[1, 2, 3, 4].map(n => { const fait = !!x && (x.etat === "fait" || (!!lien && n < 4)), en = !!cur && (n === cur || (cur === 1 && n === 2));
      return `<li${fait ? ' class="fait"' : ""}${en ? ' aria-current="step"' : ""}>${t("con.mer.proc." + n)}${n === 3 && lien ? ` <span class="mer-proc-etat">${t("con.mer.lien.envoye.court", { d: I.date(lien) })}</span>` : fait ? ` <span class="mer-proc-etat">${t("con.mer.proc.fait")}</span>` : ""}</li>`; }).join("")}</ol>`; };
  const quandGoogle = () => `<div class="mer-quand"><p class="note"><span class="aide-lib">${t("con.mer.google.quand.lib")}</span> ${t("con.mer.google.quand")}</p><p class="note"><span class="aide-lib">${t("con.mer.google.pas.lib")}</span> ${t("con.mer.google.pas")}</p></div>`;
  // v49 (13/11/2026, retour de PJ : « je dois pouvoir remplir pour le client pendant l'appel ») : 6 questions (la 6e, « Vos réseaux sociaux », rangée
  // dans demarrage.reseaux, RENOM_RESEAUX_CLIENT de donnees.js) ; chaque réponse a « Modifier », qui ouvre le formulaire « Remplir pour le client »
  // (mêmes listes de choix que l'espace : TONS, ACTIONS, oui ou non) ; « Enregistrer les réponses » n'envoie que les champs changés
  // (admin_reponses_demarrage, journal REPONSES_DEMARRAGE_PAR_EQUIPE). Sans adminReponsesDemarrage (adaptateur ancien) : la lecture seule de la v48.
  const RSC = window.RENOM_RESEAUX_CLIENT;
  const QUESTIONS = ["phrase", "distinctions", "ton", "interdits", "action", "reseaux"], NB_Q = QUESTIONS.length;
  const demarrageDe = c => c.demarrage && typeof c.demarrage === "object" ? c.demarrage : null;
  const texteRep = v => Array.isArray(v) ? v.join("\n") : typeof v === "string" ? v : "";
  // v50 (retour du gérant : « Venir sur place : https://… » pas cliquable) : adresses http(s) des réponses rendues cliquables. Le texte est d'abord
  // échappé, puis seules les suites « http:// » ou « https:// » de ce texte échappé deviennent des liens (rien d'autre : ni javascript:, ni balise) ;
  // une entité (&quot; &#39; &lt; &gt;) ou une ponctuation finale arrête l'adresse. Nouvel onglet, rel=noopener noreferrer.
  const lierUrls = s => e(s).replace(/https?:\/\/(?:(?!&(?:quot|#39|lt|gt);)[^\s<>"'])+/gi, m => { const u = m.replace(/(?:[.,;:!?)\]]|&amp;)+$/, ""), reste = m.slice(u.length); return (/^https?:\/\/[^/?#&]/i.test(u) ? `<a class="casse" href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>` : u) + reste; });
  const OUI_NON = r => r === "oui" ? t("con.oui") : r === "non" ? t("con.non") : r === "nsp" ? t("con.nsp") : "";
  const resumeReseaux = r => { if (!r || typeof r !== "object" || !Object.keys(r).length) return "";
    return [r.instagram ? `Instagram${t("deux.points")}${OUI_NON(r.instagram)}${r.instagram === "oui" && r.instagram_pro ? ", " + t("con.rs.pro." + r.instagram_pro) : ""}` : "",
      r.facebook ? `Facebook${t("deux.points")}${OUI_NON(r.facebook)}${r.facebook === "oui" && r.facebook_page ? ", " + t("con.rs.page." + r.facebook_page) : ""}` : "",
      r.tiktok ? `TikTok${t("deux.points")}${OUI_NON(r.tiktok)}` : ""].filter(Boolean).join(" · "); };
  const repondue = (r, k) => { if (!r) return false; if (k === "reseaux") return RSC.repondu(r.reseaux);
    if (k === "action" && typeof r.action_detail === "string" && r.action_detail.trim()) return true; const v = r[k];
    return Array.isArray(v) ? v.some(x => String(x || "").trim()) : typeof v === "string" ? !!v.trim() : !!v; };
  const nbReponses = c => { const r = demarrageDe(c); return r ? QUESTIONS.filter(k => repondue(r, k)).length : 0; };
  const nbReponses5 = c => { const r = demarrageDe(c); return r ? QUESTIONS.slice(0, 5).filter(k => repondue(r, k)).length : 0; };
  const titreQ = k => k === "reseaux" ? t("con.rs.titre") : t("q." + k + ".titre");
  const choix = (id, l, v, lib) => `<select id="${id}">${[["", t("con.mer.rep.vide")], ...l.map(k => [k, lib(k)])].map(([k, x]) => `<option value="${k}"${(v || "") === k ? " selected" : ""}>${e(x)}</option>`).join("")}</select>`;
  const formReponses = c => { const r = demarrageDe(c) || {}, rs = r.reseaux && typeof r.reseaux === "object" ? r.reseaux : {};
    const ta = (k, n) => `<div class="f" data-f-q="${k}"><label for="rq-${k}">${titreQ(k)}</label><textarea id="rq-${k}" maxlength="${n}" rows="2">${e(texteRep(r[k]))}</textarea></div>`;
    const sel = (k, l, v, lib, libelle) => `<div class="f" data-f-q="${k}"><label for="rq-${k}">${libelle}</label>${choix("rq-" + k, l, v, lib)}</div>`;
    return `<form id="f-reponses" class="pile serre form-reponses" novalidate hidden><h4>${t("con.rep.form.titre")}</h4><p class="note">${t("con.rep.form.aide")}</p>
      ${ta("phrase", 300)}${ta("distinctions", 600)}${sel("ton", Object.keys(TONS), r.ton === "enjoué" ? "enjoue" : r.ton, k => TONS[k], titreQ("ton"))}${ta("interdits", 600)}
      ${sel("action", Object.keys(ACTIONS), r.action, k => ACTIONS[k], titreQ("action"))}<div class="f" data-f-q="action_detail"><label for="rq-action_detail">${t("q.action.detail")}</label><input id="rq-action_detail" type="text" maxlength="200" value="${e(r.action_detail || "")}"></div>
      <fieldset class="pile serre" data-f-q="reseaux"><legend class="fort">${t("con.rs.titre")}</legend><div class="champs deux">
        ${sel("rs-instagram", ["oui", "non"], rs.instagram, OUI_NON, t("con.rs.instagram"))}${sel("rs-instagram_pro", ["oui", "non", "nsp"], rs.instagram_pro, OUI_NON, t("con.rs.instagram.pro"))}
        ${sel("rs-facebook", ["oui", "non"], rs.facebook, OUI_NON, t("con.rs.facebook"))}${sel("rs-facebook_page", ["oui", "non"], rs.facebook_page, OUI_NON, t("con.rs.facebook.page"))}
        ${sel("rs-tiktok", ["oui", "non"], rs.tiktok, OUI_NON, t("con.rs.tiktok"))}</div></fieldset>
      <div class="actions"><button type="submit" class="bouton second petit" id="rq-enregistrer">${t("con.rep.enregistrer")}</button><button type="button" class="lien" id="rq-fermer">${t("con.rep.fermer")}</button></div></form>`; };
  // Valeurs du formulaire, seulement celles qui changent (admin_reponses_demarrage ne touche pas aux autres).
  const lireReponses = c => { const r = demarrageDe(c) || {}, v = id => ($("rq-" + id) || {}).value || "", out = {};
    for (const k of ["phrase", "distinctions", "interdits", "action_detail"]) { const x = v(k).trim(); if (x !== texteRep(r[k]).trim()) out[k] = x; }
    for (const k of ["ton", "action"]) { const x = v(k); if (x !== ((k === "ton" && r.ton === "enjoué" ? "enjoue" : r[k]) || "")) out[k] = x; }
    const rs = RSC.normaliser({ instagram: v("rs-instagram"), instagram_pro: v("rs-instagram_pro"), facebook: v("rs-facebook"), facebook_page: v("rs-facebook_page"), tiktok: v("rs-tiktok") });
    if (JSON.stringify(Object.entries(rs).sort()) !== JSON.stringify(Object.entries(RSC.normaliser(r.reseaux)).sort())) out.reseaux = rs;
    return out; };
  const reponsesDemarrage = c => { const r = demarrageDe(c), vide = `<span class="mer-rep-vide" data-rep-vide>${t("con.mer.rep.vide")}</span>`, modif = !!D.adminReponsesDemarrage;
    const val = k => { const v = r ? r[k] : null;
      if (k === "ton") return TONS[v === "enjoué" ? "enjoue" : v] || (v ? e(v) : vide);
      if (k === "action") { const a = ACTIONS[v] || (v ? e(v) : ""), d = r && typeof r.action_detail === "string" ? r.action_detail.trim() : ""; return a || d ? [a, d ? lierUrls(d) : ""].filter(Boolean).join(t("deux.points")) : vide; }
      if (k === "reseaux") { const x = resumeReseaux(v); return x ? `<span class="mer-rep-texte">${e(x)}</span>${RSC.repondu(v) ? "" : " " + vide}` : vide; }
      const s_ = texteRep(v); return s_.trim() ? `<span class="mer-rep-texte">${lierUrls(s_.trim())}</span>` : vide; };
    return `<details class="repliable mer-reponses" id="mer-reponses"${nbReponses(c) < NB_Q ? " open" : ""}><summary><h3>${t("con.mer.rep.titre")}, <span data-reponses-n>${t("con.mer.rep.n", { n: nbReponses(c), t: NB_Q })}</span></h3></summary>
      ${r ? "" : `<p class="note">${t("con.mer.rep.aucune")}</p>`}${modif ? `<div class="actions"><button type="button" class="bouton second petit" data-rep-remplir>${t(r ? "con.rep.corriger" : "con.rep.remplir")}</button></div>` : ""}
      <dl class="mer-rep">${QUESTIONS.map((k, i) => `<div data-q="${k}"><dt>${i + 1}. ${titreQ(k)}</dt><dd>${val(k)}${modif ? ` <button type="button" class="lien" data-rep-modifier="${k}">${t("con.rep.modifier")}</button>` : ""}</dd></div>`).join("")}</dl>
      ${modif ? formReponses(c) : ""}</details>`; };
  // Étape « Accès à la fiche Google » pas encore faite (v48, 12/11/2026, retour de PJ : « Déclaré par le client…, à vérifier » + « Google vérifié »
  // lui demandaient une vérification inutile). Le robot n8n « RENOM, fiches Google : invitations et liens » (toutes les 30 min) accepte l'invitation
  // reçue par team@boostimpact.agency, relie la fiche (rapprocher_fiches_google) et coche l'étape seul. La fiche dit donc : ce qu'on attend du client,
  // le dernier passage du robot (passages_robots ; plus de 2 h : « robot muet »), ce qui l'empêcherait de relier seul (ni place_id ni lien de fiche,
  // alerte « Fiche Google à relier » de ce client, fiches reçues sans client trouvé) et, passé le délai, d'appeler le client. Le délai : 24 h après
  // l'invitation annoncée par le client ; sans annonce, sa date d'appel (création + J_APPEL jours), comme la bannière « Prochaine action ».
  // robotsFiche est lu par client() avant le dessin (adminPassagesRobots, adminAlertesClient) ; undefined : lecture impossible, rien n'est inventé.
  let robotsFiche = { passage: undefined, alertes: [] };
  const H2 = 2 * 3600000;
  const robotGoogle = () => { const p = robotsFiche.passage, ms = p && Date.parse(p.passe_le); return ms ? { connu: true, ms, muet: Date.now() - ms > H2 } : { connu: false }; };
  const sansIdGoogle = c => FG.sql(c) && !FG.ID.test(c.google_place_id || "") && !String(c.fiche_google_lien || "").trim();
  // v49 : seules les fiches orphelines qui ressemblent au commerce (ressemble) sont présentées sur sa fiche, avec leur titre.
  const alertesGoogle = c => { const l = (robotsFiche.alertes || []).filter(a => a.type === "FICHE_A_RELIER"); return { propres: l.filter(a => a.commerce_id === c.id), orphelines: l.filter(a => !a.commerce_id && ressemble(c, a.detail)) }; };
  const limiteGoogle = (c, x) => x.etat === "declare" ? (x.maj ? Date.parse(x.maj) + H24 : null) : c.cree_le ? Date.parse(c.cree_le) + J_APPEL * 864e5 : null;
  const etapeGoogle = (c, x) => { const decl = x.etat === "declare", r = robotGoogle(), lim = limiteGoogle(c, x), al = alertesGoogle(c), l = [];
    l.push(`<p class="note" data-google-attente="${decl ? "declare" : "client"}">${decl ? t("con.mer.g.declare", { d: x.maj ? dh(x.maj) : "" }) : t("con.mer.g.attente")}</p>`);
    l.push(r.muet ? `<p class="note fort alerte-ligne" data-robot="muet">${t("con.mer.g.muet", { h: dh(r.ms) })}</p>`
      : `<p class="note" data-robot="${r.connu ? "ok" : "inconnu"}">${r.connu ? t("con.mer.g.robot", { h: dh(r.ms) }) : t("con.mer.g.robot.inconnu")}</p>`);
    if (sansIdGoogle(c)) l.push(`<p class="note fort alerte-ligne" data-google-sans-id>${t("con.mer.g.sans.id")}</p>`);
    al.propres.forEach(a => l.push(`<p class="note fort alerte-ligne" data-google-alerte>${t("con.mer.g.alerte", { x: e(a.texte || "") })}</p>`));
    al.orphelines.forEach(a => l.push(`<p class="note" data-google-orphelines="1">${t("con.mer.g.orpheline", { x: e((a.detail || {}).titre || t("con.mer.g.sans.titre")) })}</p>`));
    l.push(lim != null && Date.now() >= lim ? `<p class="note fort" data-google-appeler>${t("con.mer.g.appeler")}</p>`
      : `<p class="note">${lim == null ? t("con.mer.g.si.sans") : t(decl ? "con.mer.g.si24" : "con.mer.g.si.appel", { d: decl ? dh(lim) : I.date(lim) })}</p>`);
    return `<div class="mer-google" id="mer-google-auto">${l.join("")}</div>`; };
  const etatMerFiche = x => x.point === "google" && x.etat !== "fait" ? t(x.etat === "declare" ? "con.mer.etat.g.declare" : "con.mer.etat.g.client") : etatMer(x);
  const merFiche = c => { const m = c.sante && c.sante.mise_en_route; if (!m) return "";
    // v49 : le Mode d'emploi seulement pour Google ; l'étape Metricool porte son mini-guide de 3 lignes (etapeMetricool).
    const guide = x => x.etat === "fait" || x.point !== "google" ? "" : `<p class="note"><a class="lien-guide" href="#/guide/e3">${t("con.mer.guide")}</a></p>`;
    const etat = x => x.point === "metricool" && x.etat !== "fait" ? `<span data-mc-etat="${etatMetricool(c, x).k}">${etatMetricool(c, x).x}</span>`
      : x.point === "metricool" && reseauxRelies(c).length ? `${etatMerFiche(x)} · <span data-mc-etat="fait">${etatMetricool(c, x).x}</span>` : etatMerFiche(x) + (x.point === "demarrage" ? " · " + `<span data-reponses>${t("con.mer.rep.n", { n: nbReponses(c), t: NB_Q })}</span>` : "");
    return `<p>${t("sur", { a: m.faits, b: m.total })}</p><ol class="mer-etapes" id="mer-etapes">${(m.points || []).map(x => { let a = actionMer(c, x);
      // Google pas encore fait (v48) : l'état automatique d'abord, le recours « J'ai vérifié moi-même dans team@ » ensuite, discret.
      const gAuto = x.point === "google" && x.etat !== "fait", mAuto = x.point === "metricool" && x.etat !== "fait";
      if (x.point === "demarrage") a = `<button type="button" class="lien" data-voir-reponses>${t("con.mer.rep.voir")}</button>` + (a || "");
      // Metricool pas encore fait (v49) : l'état en une phrase (dans la ligne), puis les réseaux à relier, le mini-guide, et les boutons dessous.
      return `<li class="mer-etape${x.etat === "fait" ? " fait" : ""}" id="mer-pt-${e(x.point)}" data-point="${e(x.point)}" data-etat="${e(x.etat)}"><div class="mer-ligne"><div class="mer-nom"><p class="fort">${I.a("con.mer.nom." + x.point) ? t("con.mer.nom." + x.point) : e(x.point)}</p><p class="note">${etat(x)}</p></div>${a && !gAuto && !mAuto ? `<div class="mer-action">${a}</div>` : ""}</div>${gAuto ? etapeGoogle(c, x) + (a ? `<div class="mer-recours">${a}</div>` : "") : ""}${mAuto ? etapeMetricool(c, x, false) + (a ? `<div class="mer-action mer-action-bas">${a}</div>` : "") : ""}${guide(x)}</li>`; }).join("")}</ol>
      ${reponsesDemarrage(c)}`; };
  // Étape « Réseaux sociaux (Metricool) » (v49, 13/11/2026, retour de PJ : « À faire » et un gros bouton vert « Lien envoyé », on croyait que c'était un
  // état). L'état réel en UNE phrase, dans cet ordre : étape faite (réseaux reliés), le client dit avoir relié (à vérifier), marque Metricool pas encore
  // créée (pas de blogId), lien envoyé et encore valable (71 h, admin_lien_reseaux), lien expiré, marque prête sans lien. Puis les réseaux à relier
  // (réponses du client à la 6e question, réduites aux réseaux de l'offre), la tâche « passer l'Instagram en compte professionnel » si besoin, et un
  // mini-guide de 3 lignes. Le bouton du lien est un verbe en style secondaire (actionMer).
  const H71 = 71 * 3600000;
  const lienMetricool = x => { const ms = x && x.lien_envoye_le ? Date.parse(x.lien_envoye_le) : NaN; return isNaN(ms) ? null : { ms, fin: ms + H71, expire: Date.now() >= ms + H71 }; };
  const sociauxOffre = c => window.RENOM_RESEAUX_AUTORISES(c).filter(r => RES_SOCIAUX.includes(r));
  const reseauxRelies = c => sociauxOffre(c).filter(r => ((c.comptes || {})[r] || {}).etat === "connecte");
  const instagramProAFaire = c => { const rs = (demarrageDe(c) || {}).reseaux; return RSC.proAFaire(rs) && sociauxOffre(c).includes("instagram") && ((c.comptes || {}).instagram || {}).etat !== "connecte"; };
  const etatMetricool = (c, x) => { const li = lienMetricool(x), relies = reseauxRelies(c);
    if (x.etat === "fait") return { k: "fait", x: relies.length ? t("con.mer.m.relies", { l: relies.map(r => NOM_RESEAU[r]).join(", ") }) : t("con.mer.m.fait") };
    if (x.etat === "declare") return { k: "declare", x: t("con.mer.m.declare", { d: x.maj ? dh(x.maj) : "" }) };
    if (!c.metricool_blog_id) return { k: "sans_marque", x: t("con.mer.m.sans.marque") };
    if (li && !li.expire) return { k: "lien", x: t("con.mer.m.lien", { d: dh(li.ms), f: I.date(li.fin), h: I.heure(li.fin) }) };
    if (li) return { k: "expire", x: t("con.mer.m.expire", { d: dh(li.fin) }) };
    return { k: "pret", x: t("con.mer.m.pret", { b: e(c.metricool_blog_id) }) }; };
  const etapeMetricool = (c, x, avecEtat = true) => { const et = etatMetricool(c, x), rs = (demarrageDe(c) || {}).reseaux, offre = sociauxOffre(c), relies = reseauxRelies(c), l = [];
    if (avecEtat) l.push(`<p class="note fort" data-mc-etat="${et.k}">${et.x}</p>`);
    if (x.etat !== "fait") {
      const voulus = RSC.repondu(rs) || RSC.aRelier(rs).length ? RSC.aRelier(rs).filter(r => offre.includes(r)) : null;
      l.push(`<p class="note" data-mc-a-relier>${voulus == null ? t("con.mer.m.inconnus") : voulus.length ? t("con.mer.m.a.relier", { l: voulus.map(r => NOM_RESEAU[r]).join(", ") }) : t("con.mer.m.aucun")}${relies.length ? " " + t("con.mer.m.deja", { l: relies.map(r => NOM_RESEAU[r]).join(", ") }) : ""}</p>`);
      if (instagramProAFaire(c)) l.push(`<p class="note fort" data-instagram-pro><span class="pastille">${t("con.pa.qui.vous")}</span> ${t(rs.instagram_pro === "nsp" ? "con.mer.m.pro.nsp" : "con.mer.m.pro")}</p>`);
      if (et.k === "sans_marque") l.push(`<div class="actions"><button type="button" class="bouton second petit" data-aller="mc-${e(c.id)}">${t("con.mer.m.coller")}</button></div>`);
      l.push(`<ol class="mer-mini-guide" data-mc-guide>${[1, 2, 3].map(n => `<li>${t("con.mer.m.guide." + n)}</li>`).join("")}</ol>`);
    }
    return `<div class="mer-metricool" id="mer-metricool">${l.join("")}</div>`; };
  // Fiches reçues sur team@ sans client trouvé (v49, 13/11/2026, vu en prod : la fiche « Gild-Tech », entreprise du gérant, présentée sur la fiche de
  // Fleur comme « c'est peut-être celle-ci »). Sur la fiche d'un client, seulement celles dont le titre (ou l'adresse) ressemble au commerce : un mot
  // du nom en commun (4 lettres ou plus, hors mots courants), ou le nom entier dans le titre. Les autres restent dans À faire, où « Ignorer cette fiche »
  // les sort (admin_ignorer_fiche_google).
  const MOTS_COURANTS = ["chez", "comme", "restaurant", "resto", "salon", "maison", "cafe", "boulangerie", "institut", "atelier", "studio", "sport", "club", "bar", "brasserie", "beaute", "coiffure", "the", "les", "des", "aux"];
  const motsDe = x => sansAccent(x).replace(/[^a-z0-9]+/g, " ").split(" ").filter(m => m.length >= 4 && !MOTS_COURANTS.includes(m));
  const ressemble = (c, d) => { const titre = sansAccent((d || {}).titre || "").replace(/[^a-z0-9]+/g, " ").trim(), nom = sansAccent(c.nom).replace(/[^a-z0-9]+/g, " ").trim();
    if (!titre && !(d || {}).adresse) return false;
    if (nom && titre && (titre.includes(nom) || nom.includes(titre))) return true;
    const mt = new Set([...motsDe((d || {}).titre), ...motsDe((d || {}).adresse)]); return motsDe(c.nom).some(m => mt.has(m)); };
  // ---------------- Dossier de démarrage (v49, 13/11/2026, retours de PJ sur « Comme Chez Fleur » : « on ne sait pas dire s'il faut cliquer », « on ne
  // sait pas dire si ça a été géré »). Sous « Prochaine action », un tableau d'UNE ligne par point : Accès Google, Autorisation photos, Photos (x sur 5
  // utilisables : 1 façade, 1 salle, 3 plats), WhatsApp, Réponses (x sur 6), Réseaux sociaux (offres avec réseaux). Pour chaque ligne : l'état en clair
  // (Fait, En attente du client, À faire par vous, Vérification automatique), une phrase qui dit quoi faire, et « Voir » qui descend au bon bloc.
  // Décisions (expert onboarding, validées par PJ) : appel de démarrage obligatoire sous 48 h, où le gérant remplit tout pour le client ; relances
  // J+2 et J+5, appel à J+7. Les relances ne partent PAS seules (canal WhatsApp non vérifié) : la ligne « Relances » les donne comme tâches VOUS.
  // « Copier le message au client » : message court, dans la langue du client, qui ne liste que ce qui lui manque, avec l'adresse de son espace.
  const PHOTOS_MIN = 5, H48 = 48 * 3600000;
  const photosUtilisables = l => Array.isArray(l) ? l.filter(p => p.statut !== "refusee" || p.refus_motif === "plafond").length : null;
  function lignesDossier(c, phs) {
    const m = c.sante && c.sante.mise_en_route, pts = Object.fromEntries(((m && m.points) || []).map(x => [x.point, x])), o = OFFRES[c.offre_id] || {}, l = [];
    const gg = pts.google, r = robotGoogle();
    if (gg) { const st = gg.etat === "fait" ? "fait" : r.muet || alertesGoogle(c).propres.length || (gg.etat === "declare" && sansIdGoogle(c)) ? "vous" : gg.etat === "declare" ? "robot" : "client";
      l.push({ k: "google", st, x: t("con.dos.google." + st), cible: "mer-pt-google", manque: st !== "fait" && st !== "robot" ? "google" : null }); }
    l.push(c.photos_autorisees_le ? { k: "autorisation", st: "fait", x: t("con.dos.autorisation.fait", { d: I.date(c.photos_autorisees_le) }), cible: "client-photos-ligne" }
      : { k: "autorisation", st: "client", x: t("con.dos.autorisation.client"), cible: "client-photos-ligne", manque: "autorisation" });
    const n = photosUtilisables(phs);
    l.push(n == null ? { k: "photos", st: "client", x: t("con.dos.photos.inconnu"), n: "?", cible: "client-photos-ligne" }
      : n >= PHOTOS_MIN ? { k: "photos", st: "fait", x: t("con.dos.photos.fait", { n }), n, cible: "client-photos-ligne" }
      : { k: "photos", st: "client", x: t("con.dos.photos.client", { n, r: PHOTOS_MIN - n }), n, cible: "client-photos-ligne", manque: "photos", reste: PHOTOS_MIN - n });
    l.push(waActif(c) ? { k: "whatsapp", st: "fait", x: t("con.dos.wa.fait", { n: e(window.RENOM_WHATSAPP ? window.RENOM_WHATSAPP.lisible(c.whatsapp_numero) : c.whatsapp_numero) }), cible: "wa-client-num" }
      : { k: "whatsapp", st: "vous", x: t("con.dos.wa.vous"), cible: "wa-client-num", manque: "whatsapp" });
    const nr = nbReponses(c);
    l.push({ k: "reponses", st: nr >= NB_Q ? "fait" : "vous", x: t(nr >= NB_Q ? "con.dos.rep.fait" : "con.dos.rep.vous", { n: nr, t: NB_Q }), n: nr, cible: "mer-reponses", manque: nr >= NB_Q ? null : "reponses" });
    const rr = pts.metricool;
    if (o.reseaux_sociaux && rr) { const li = lienMetricool(rr);
      const st = rr.etat === "fait" ? "fait" : instagramProAFaire(c) || rr.etat === "declare" || !c.metricool_blog_id || !li || li.expire ? "vous" : "client";
      const x = rr.etat === "fait" ? etatMetricool(c, rr).x : instagramProAFaire(c) ? t("con.dos.rs.pro") : rr.etat === "declare" ? t("con.dos.rs.declare")
        : !c.metricool_blog_id ? t("con.dos.rs.marque") : !li ? t("con.dos.rs.lien") : li.expire ? t("con.dos.rs.expire") : t("con.dos.rs.client", { d: I.date(li.fin), h: I.heure(li.fin) });
      l.push({ k: "reseaux", st, x, cible: "mer-pt-metricool", manque: st === "client" ? "reseaux" : instagramProAFaire(c) ? "instagram_pro" : null, fin: li && li.fin }); }
    return l;
  }
  // Relances (décision du 12/11/2026) : J+2 et J+5 « Relancer le client », J+7 « Appelez le client », comptés depuis la création du commerce, tant
  // qu'il manque quelque chose au dossier. Rien n'est envoyé seul.
  const relancesDossier = (c, l) => { if (c.en_pause || !c.cree_le || l.every(x => x.st === "fait" || x.st === "robot")) return null;
    const d0 = Date.parse(c.cree_le), j = n => d0 + n * 864e5, now = Date.now(), d = { j2: I.date(j(2)), j5: I.date(j(5)), j7: I.date(j(7)) };
    return now >= j(7) ? { k: "j7", x: t("con.dos.rel.j7", d), vous: true } : now >= j(5) ? { k: "j5", x: t("con.dos.rel.j5", d), vous: true }
      : now >= j(2) ? { k: "j2", x: t("con.dos.rel.j2", d), vous: true } : { k: "prevues", x: t("con.dos.rel.prevues", d), vous: false }; };
  // Message au client : dans SA langue (commerces.langue), seulement ce qui lui manque, l'adresse de son espace ; vide si rien ne lui manque.
  const lienEspace = () => { try { return new URL(I.lien("index.html"), location.href).href.replace(/[?#].*$/, ""); } catch (er) { return ""; } };
  function messageDossier(c, l) {
    const lg = ["fr", "en", "nl"].includes(c.langue) ? c.langue : "fr", T_ = (k, v) => t(k, v, lg), manques = l.filter(x => x.manque);
    if (!manques.length) return "";
    const ligne = x => x.manque === "photos" ? T_("con.msg.photos", { r: x.reste }) : x.manque === "reponses" ? T_("con.msg.reponses", { r: NB_Q - x.n })
      : x.manque === "reseaux" ? T_("con.msg.reseaux", { d: I.date(x.fin, lg) }) : T_("con.msg." + x.manque);
    const u = lienEspace();
    return [T_("con.msg.bonjour"), T_("con.msg.manque"), ...manques.map((x, i) => `${i + 1}. ${ligne(x)}`), u ? T_("con.msg.espace", { u }) : T_("con.msg.espace.sans"), T_("con.msg.fin")].join("\n");
  }
  const ETATS_DOS = { fait: "con.dos.st.fait", client: "con.dos.st.client", vous: "con.dos.st.vous", robot: "con.dos.st.robot" };
  function blocDossier(c, phs, contacts) {
    const l = lignesDossier(c, phs), rel = relancesDossier(c, l), msg_ = messageDossier(c, l), faits = l.filter(x => x.st === "fait").length;
    // Appel de démarrage : tant que le dossier n'est pas complet, pendant la première semaine (ensuite, la ligne des relances dit « Appelez le client »).
    const lim = c.cree_le ? Date.parse(c.cree_le) + H48 : null, appel = faits < l.length && lim != null && Date.now() < Date.parse(c.cree_le) + 7 * 864e5;
    return `<section class="carte dossier" id="dossier-demarrage" aria-labelledby="dossier-titre"><div class="carte-tete"><h2 id="dossier-titre">${t("con.dos.titre")}</h2><span class="note" data-dossier-n>${t("con.dos.n", { a: faits, b: l.length })}</span></div>
      ${appel ? `<p class="note${Date.now() > lim ? " fort" : ""}" data-appel-demarrage>${t(Date.now() > lim ? "con.dos.appel.passe" : "con.dos.appel", { d: dh(lim) })}</p>` : ""}
      <table class="dossier-tab"><thead><tr><th>${t("con.dos.col.point")}</th><th>${t("con.dos.col.etat")}</th><th>${t("con.dos.col.quoi")}</th><th><span class="vh">${t("con.dos.voir")}</span></th></tr></thead><tbody>
        ${l.map(x => `<tr data-dossier="${x.k}" data-st="${x.st}"><td data-l="${t("con.dos.col.point")}" class="fort">${t("con.dos.k." + x.k, { n: x.n, t: NB_Q, m: PHOTOS_MIN })}</td>
          <td data-l="${t("con.dos.col.etat")}"><span class="etat-dos etat-dos-${x.st}">${t(ETATS_DOS[x.st])}</span></td><td data-l="${t("con.dos.col.quoi")}" class="note">${x.x}</td>
          <td data-l=""><button type="button" class="lien" data-aller="${x.cible}">${t("con.dos.voir")}</button></td></tr>`).join("")}</tbody></table>
      ${rel ? `<p class="note${rel.vous ? " fort" : ""}" data-relance="${rel.k}">${rel.vous ? `<span class="pastille">${t("con.pa.qui.vous")}</span> ` : ""}${rel.x}</p>` : ""}
      ${msg_ ? `<div class="pile serre" id="dossier-message-zone"><label for="dossier-message" class="note">${t("con.dos.message.lib", { l: t("con.dos.langue." + (["fr", "en", "nl"].includes(c.langue) ? c.langue : "fr")) })}</label>
        <textarea id="dossier-message" readonly rows="8" class="note" lang="${["fr", "en", "nl"].includes(c.langue) ? c.langue : "fr"}">${e(msg_)}</textarea>
        <div class="actions"><button type="button" class="bouton second petit" data-dossier-copier>${t("con.coh.copier")}</button></div></div>` : `<p class="note" data-dossier-complet>${t("con.dos.rien.client")}</p>`}
      <p><button type="button" class="lien" id="trame-ouvrir" aria-expanded="false" aria-controls="trame-appel">${t("con.trame.lien")}</button></p>
      ${trameAppel(c, contacts)}</section>`;
  }
  // Trame de l'appel de démarrage (v49) : format téléprompteur, une phrase par ligne, relances écrites « Si besoin : », dans l'ordre du dossier.
  const TRAME = ["presenter", "google", "whatsapp", "autorisation", "reponses", "reseaux", "photos", "conclure"];
  const trameAppel = (c, contacts) => { const k = contacts && contacts.commerce && contacts.commerce.prenom ? contacts.commerce : contacts && contacts.global && contacts.global.prenom ? contacts.global : null, p = k ? k.prenom : "PJ";
    return `<div class="trame" id="trame-appel" hidden><h3>${t("con.trame.titre")}</h3>${TRAME.map((s_, i) => `<section class="trame-partie" data-trame="${s_}"><h4>${i + 1}. ${t("con.trame." + s_ + ".titre")}</h4>
      ${t("con.trame." + s_, { p: e(p) }).split("\n").map(x => `<p class="trame-ligne${/^(Si besoin|If needed|Indien nodig)/.test(x) ? " trame-relance" : ""}">${x}</p>`).join("")}</section>`).join("")}
      <p><button type="button" class="lien" id="trame-fermer">${t("con.trame.fermer")}</button></p></div>`; };
  // Style du commerce (kit de marque) : qui l'a validé et quand, demandes de changement en attente, lien vers le panneau « Style du commerce ».
  const ligneStyle = c => { const m = c.marque, n = +c.demandes_style || 0;
    const etat = m && m.verrouille ? t("con.sty.ligne." + (m.valide_par === "renom" ? "renom" : "commercant"), { d: I.date(m.verrouille_le || m.maj) }) : t(m ? "con.sty.ligne.attente" : "con.sty.ligne.aucun");
    return `<div class="pile serre style-ligne"><p class="note">${etat}</p>${n ? `<p class="note fort">${t("con.sty.ligne.demandes", { n })}</p>` : ""}<a class="bouton second petit" href="${I.lien("console.html")}#/style/${encodeURIComponent(c.id)}" data-style="${e(c.id)}">${t("con.sty.ouvrir")}</a></div>`
      + lignePhotos(c); };
  // Autorisation photos (décision de PJ du 22/10/2026, CGV article 11) : son état, et « Déposer des photos pour ce client » (panneau #/photos/<commerce>).
  // Autorisation photos (CGV article 11, 26/10/2026) : « fiche Google seulement » pour un Essentiel, ou une autorisation donnée en Essentiel et pas encore
  // étendue par le commerçant (commerces.photos_autorisees_perimetre) : l'équipe ne reprend alors que les photos publiées sur la fiche Google.
  const phAutorise = c => t((OFFRES[c.offre_id] || {}).reseaux_sociaux === false || c.photos_autorisees_perimetre === "fiche_google" ? "con.ph.autorise.google" : "con.ph.autorise", { d: I.date(c.photos_autorisees_le) });
  // Autorisation enregistrée par l'équipe (v48, 12/11/2026, demande de PJ : « je veux déposer moi-même les photos de Fleur ») : même modèle que le
  // WhatsApp, case obligatoire jamais précochée (l'accord est celui du client, recueilli par l'équipe), admin_autoriser_photos.
  const autoriserPhotos = suffixe => !D.adminAutoriserPhotos ? "" : `<div class="pile serre" id="ph-autoriser${suffixe}"><label class="option"><input type="checkbox" id="ph-accord${suffixe}"><span>${t("con.ph.accord.equipe")}</span></label>
    <button type="button" class="bouton second petit" data-a="photos-autoriser" id="ph-autoriser-ok${suffixe}">${t("con.ph.autoriser")}</button></div>`;
  const lignePhotos = c => `<div class="pile serre photos-ligne" id="client-photos-ligne"><p class="note">${c.photos_autorisees_le ? phAutorise(c) : t("con.ph.non")}</p>${c.photos_autorisees_le ? "" : autoriserPhotos("-fiche")}
    <a class="bouton second petit" href="${I.lien("console.html")}#/photos/${encodeURIComponent(c.id)}" data-photos="${e(c.id)}">${t("con.ph.bouton")}</a></div>`;
  // Panneau « Déposer des photos pour ce client » : fermé sans l'autorisation du commerçant (la base le refuse aussi : admin_deposer_photos et la règle du
  // seau). Envoi de chaque photo dans le dossier du commerce (même envoi que l'espace), puis un seul enregistrement (1 à 10 photos), source « equipe ».
  async function photosClient(cid) {
    const c = cid && (await D.adminCommerces()).find(x => x.id === cid); if (!c) { location.hash = "#/clients"; return; }
    const ouvert = !!c.photos_autorisees_le;
    vue.innerHTML = `<div class="entete"><p class="sur">${t("con.ph.bouton")}</p><h1>${e(c.nom)}</h1><p class="chapo">${t("con.ph.chapo")}</p></div><p class="retour-liste"><a href="#/client/${encodeURIComponent(c.id)}">${t("con.client.retour")}</a></p>
      <section class="carte" id="ph-client"><p class="fort">${ouvert ? phAutorise(c) : t("con.ph.non")}</p>
      ${ouvert ? `<form id="ph-f"><div class="f"><label for="ph-fichiers">${t("con.ph.choisir")}</label><input id="ph-fichiers" type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple></div>
        <div class="actions"><button class="bouton" type="submit" id="ph-ok">${t("con.ph.deposer")}</button><button type="button" class="lien" id="ph-retirer">${t("con.ph.retirer")}</button></div></form>`
      : `<p class="texte2" id="ph-ferme">${t("con.ph.sans")}</p>${autoriserPhotos("")}`}<p class="msg" id="msg" role="status"></p></section>`;
    if (!ouvert) { const b = $("ph-autoriser-ok"); if (b) b.onclick = async () => { b.disabled = true;
        try { if (!$("ph-accord").checked) throw new Error(t("con.ph.accord.requis")); const r = await D.adminAutoriserPhotos(cid, true);
          await photosClient(cid); msg(t(r && r.etat === "deja" ? "con.ph.autorisee.deja" : "con.ph.autorisee.ok")); }   // #msg est juste sous le dépôt, dans la même carte
        catch (er) { b.disabled = false; msg(ph(er.message)); } };
      return; }
    $("ph-f").onsubmit = async ev => {
      ev.preventDefault(); const fs = [...$("ph-fichiers").files];
      if (!fs.length) return msg(t("con.ph.aucune")); if (fs.length > 10) return msg(t("con.ph.trop"));
      $("ph-ok").disabled = true;
      try {
        const recus = [];
        for (const [i, f] of fs.entries()) { msg(t("con.ph.envoi", { i: i + 1, n: fs.length })); const r = await D.adminEnvoyerPhoto(cid, f); recus.push({ chemin: r.chemin, nom: f.name, taille: f.size }); }
        const r = await D.adminDeposerPhotos(cid, recus); $("ph-fichiers").value = ""; msg(t("con.ph.ok", { n: r.nb_photos }));
      } catch (er) { msg(ph(er.message)); } finally { $("ph-ok").disabled = false; }
    };
    $("ph-retirer").onclick = async () => { if (!window.confirm(t("con.ph.retirer") + " ?")) return;
      try { await D.adminRetirerAutorisationPhotos(cid); await photosClient(cid); msg(t("con.ph.retire")); } catch (er) { msg(ph(er.message)); } };
  }
  // Écran d'un dépôt (31/10/2026, montage à la main) : plans du client (liens signés de 10 minutes, admin_plans_depot) et dépôt d'un MP4 fini
  // (envoi dans « contenus », puis admin_deposer_montage_main : contenu « à valider », même notification, aucun nouveau montage, place de l'offre
  // déjà réservée). sous = « plans » : les liens sont demandés à l'ouverture ; « main » : le formulaire prend le focus.
  async function depotClient(id, sous) {
    const d = id && (await D.adminDepotsVideo()).find(x => x.id === id); if (!d) { location.hash = "#/afaire/videos"; return; }
    const ST = I.carte("dv.st", window.RENOM_DEPOT_VIDEO.STATUTS), R = window.RENOM_ENVOI.REGLES;
    const remplace = ["a_valider", "modification"].includes(d.contenu_statut), quota = remplace ? "con.dp.quota.remplace" : d.statut === "refuse" ? "con.dp.quota.refuse" : "con.dp.quota.reserve";
    const plansEtat = d.rushes_effaces_le ? t("con.dp.plans.effaces", { d: I.date(d.rushes_effaces_le) }) : d.effacement_demande_le ? t("con.dp.plans.efface.demande") : !(d.nb_fichiers > 0) ? t("con.dp.plans.aucun") : "";
    vue.innerHTML = `<div class="entete"><p class="sur">${t("con.entree.videos")}</p><h1>${e(d.commerce || "")}</h1><p class="chapo">${t("con.dp.chapo")}</p></div>
      <p class="retour-liste"><a href="#/client/${encodeURIComponent(d.commerce_id)}">${t("con.client.retour")}</a></p>
      <section class="carte" id="dp-etat"><div class="carte-tete"><h2>${t("con.dp.depot", { d: dh(d.cree_le) })}</h2></div>
        <p class="fort">${ST[d.statut] || e(d.statut)}</p>${d.motif ? `<p class="note">${e(ph(d.motif))}</p>` : ""}
        ${d.nb_videos ? `<p class="note">${t("dv.depot.contenu", { v: d.nb_videos, p: (d.nb_fichiers || 0) - d.nb_videos, d: "" }) + secDv(d.duree_totale_s)}</p>` : ""}${d.note ? `<p class="note casse" translate="no">${e(d.note)}</p>` : ""}</section>
      <section class="carte" id="dp-plans"><h2>${t("con.dp.plans.titre")}</h2>
        ${plansEtat ? `<p class="texte2">${plansEtat}</p>` : `<p class="note">${t("con.dp.plans.note", { m: MM.LIEN_S / 60 })}</p><div class="actions"><button type="button" class="bouton second" id="dp-plans-ok">${t("con.plans")}</button></div><ul class="liste" id="dp-liens"></ul>`}</section>
      <section class="carte" id="dp-main"><h2>${t("con.main")}</h2>
        ${MM.possible(d) ? `<form id="dp-f" class="pile serre"><div class="f"><label for="dp-fichier">${t("con.dp.fichier", { s: R.DUREE_MAX_S, mo: R.VIDEO_MAX_MO })}</label><input id="dp-fichier" type="file" accept="video/mp4,.mp4,.m4v"></div>
          <div class="f"><label for="dp-legende">${t("con.dp.legende")}</label><textarea id="dp-legende" rows="5" maxlength="2200" translate="no">${e(d.contenu_legende || "")}</textarea><p class="note">${t(d.contenu_legende ? "con.dp.legende.reprise" : "con.dp.legende.note")}</p></div>
          <p class="note fort" id="dp-quota">${t(quota)}</p><p class="note">${t("con.dp.notif")}</p>
          <div class="actions"><button class="bouton" type="submit" id="dp-ok">${t("con.dp.deposer")}</button></div></form>`
        : `<p class="texte2" id="dp-ferme">${t("con.dp.ferme", { s: ST[d.statut] || e(d.statut) })}</p>`}
        <p class="msg" id="msg" role="status"></p></section>`;
    const plans = async () => { const b = $("dp-plans-ok"); if (!b) return; b.disabled = true;
      try { const l = await D.adminPlansDepot(d.id), u = $("dp-liens");
        u.innerHTML = l.length ? l.map((x, i) => `<li><div><p class="fort">${t("con.dp.plan", { n: i + 1 })}${x.duree_s != null ? secDv(x.duree_s) : ""}</p><p class="note casse" translate="no">${e(x.nom || "")}</p></div>
          ${x.url ? `<a class="bouton second petit" href="${e(x.url)}" download="${e(x.fichier || "")}" rel="noopener">${t("con.dp.telecharger")}</a>` : `<span class="note">${t("con.dp.plans.demo")}</span>`}</li>`).join("") : `<li><p class="note">${t("con.dp.plans.aucun")}</p></li>`;
        msg(l.some(x => x.url) ? t("con.dp.plans.ok", { n: l.length, m: MM.LIEN_S / 60 }) : "");
      } catch (er) { msg(ph(er.message)); } finally { b.disabled = false; } };
    if ($("dp-plans-ok")) $("dp-plans-ok").onclick = plans;
    if (sous === "plans") plans();
    if (!$("dp-f")) return;
    if (sous === "main") { $("dp-main").scrollIntoView({ block: "start" }); $("dp-fichier").focus({ preventScroll: true }); }
    $("dp-f").onsubmit = async ev => {
      ev.preventDefault(); const f = $("dp-fichier").files[0]; if (!f) { msg(t("con.dp.choisir")); return; }
      const l = MM.legende($("dp-legende").value, d.contenu_legende); if (l.raison) { msg(MM.PHRASES[l.raison]); return; }
      $("dp-ok").disabled = true; msg(t("con.dp.controle"));
      try {
        const r = await D.adminEnvoyerMontageMain(d.id, f, { onProgress: (a, n) => msg(t("con.dp.envoi", { p: n ? Math.floor(a * 100 / n) : 0 })) });
        const x = await D.adminDeposerMontageMain(d.id, r.chemin, l.legende, r.infos);
        await depotClient(d.id); msg(t("con.dp.ok", { v: x.version }));
      } catch (er) { msg(ph(er.message)); if ($("dp-ok")) $("dp-ok").disabled = false; }
    };
  }
  // Accès vérifié (22/10/2026, admin_acces_reseau) : par réseau compris dans l'offre (et retenu), l'état réel et le bouton « Accès vérifié » (l'équipe a
  // accepté l'invitation : fiche Google, Meta Business Suite, TikTok) ou « Accès retiré » (le client a retiré l'accès). Sans réseau « connecté »,
  // la base ne programme rien et la file « Contenus à publier » reste vide.
  // v46 : « Accès vérifié » n'est ici que si l'étape de mise en route du réseau est faite (sinon le bouton est dans la mise en route : un seul par fait).
  const ligneAcces = c => `<div class="pile serre acces-ligne">${window.RENOM_RESEAUX_AUTORISES(c).map(r => { const k = (c.comptes || {})[r] || {}, on = k.etat === "connecte", ailleurs = !on && etapeOuverte(c, r);
    return `<div class="pile serre" data-acces-res="${e(r)}"><p class="note${on ? " fort" : ""}">${on ? (k.maj ? t("con.acces.etat.on", { res: NOM_RESEAU[r] || e(r), d: dh(k.maj) }) : t("con.acces.etat.connecte", { res: NOM_RESEAU[r] || e(r) })) : t("con.acces.etat.off", { res: NOM_RESEAU[r] || e(r) })}${ailleurs ? " " + t("con.acces.dans.mer") : ""}</p>
      ${ailleurs ? "" : `<button type="button" class="bouton ${on ? "second " : ""}petit" data-acces="${e(r)}" data-oui="${on ? 0 : 1}" data-cid="${e(c.id)}">${t(on ? "con.acces.retirer" : "con.acces.verifier")}</button>`}</div>`; }).join("")}</div>`;
  // Marque Metricool du commerce (22/10/2026, bloc « Marque Metricool par commerce » de schema.sql) : un blogId par commerce, jamais une marque commune.
  // Sans blogId, ses publications vont dans la file « À publier à la main ». Standard et Premium seulement (l'Essentiel ne publie que sur la fiche Google).
  const ligneMarque = c => !(OFFRES[c.offre_id] || {}).reseaux_sociaux ? "" : `<div class="pile serre marque-metricool"><div class="f etroit"><label for="mc-${e(c.id)}">${t("con.mc.lib")}</label>
      <input id="mc-${e(c.id)}" type="text" inputmode="numeric" maxlength="20" autocomplete="off" value="${e(c.metricool_blog_id || "")}" data-mc></div>
      <button type="button" class="bouton second petit" data-mc-enregistrer>${t("enregistrer")}</button>${c.metricool_blog_id ? "" : `<p class="note fort">${t("con.mc.manque")}</p>`}</div>`;
  // Options commandées (22/10/2026, bloc « Options commandées » de schema.sql) : Visibilité IA et Site du restaurant payés par leur lien Stripe,
  // enregistrés par le webhook (n8n). Une carte par commande à livrer (puis par second test de la Visibilité IA), en évidence passé l'échéance.
  // Livraison : délai de l'option après le paiement et la réception des éléments du client, la plus tardive des deux dates (CGV, article 3 bis) : tant
  // que la réception n'est pas notée, l'échéance affichée est « au plus tôt ».
  const jourParis = x => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(x));
  const nomOption = k => { const o = (window.RENOM_OPTIONS || {})[k] || {}; return (I.langue === "en" ? o.nom_en : I.langue === "nl" ? o.nom_nl : o.nom) || o.nom || k; };
  const etatOption = x => t(x.etape === "second_test" ? (x.en_retard ? "con.opt.st.retard" : "con.opt.st.prevu") : x.en_retard ? "con.opt.retard" : x.elements_recus_le ? "con.opt.prevue" : "con.opt.plus.tot", { d: I.dateLongue(x.echeance) });
  const carteOption = (x, cs) => { const i = e(x.id);
    return `<article class="carte${x.en_retard ? " attention" : ""}" data-opt="${e(x.id)}" data-opt-etape="${e(x.etape)}">
        <div class="carte-tete"><h2>${e(nomOption(x.option))}</h2><span class="etat${x.en_retard ? "" : " actif"}">${etatOption(x)}</span></div>
        <p class="fort">${x.commerce ? e(x.commerce) : t("con.opt.sans.commerce")}${x.test ? ` · ${t("con.opt.test")}` : ""}</p>
        ${x.email ? `<p class="note casse" translate="no">${e(x.email)}</p>` : ""}
        <p class="note">${t("con.opt.payee", { d: dh(x.paye_le) })} · ${x.etape === "second_test" ? t("con.opt.livree.le", { d: dh(x.livree_le) }) : x.elements_recus_le ? t("con.opt.elements.le", { d: I.dateLongue(jourParis(x.elements_recus_le)) }) : t("con.opt.elements.attente")}</p>
        ${x.etape === "livraison" && !x.commerce_id ? `<div class="f"><label for="opt-c-${i}">${t("con.opt.rattacher.lib")}</label><select id="opt-c-${i}" data-opt-commerce><option value="">${t("con.opt.choisir")}</option>${cs.map(c => `<option value="${e(c.id)}">${e(c.nom)}</option>`).join("")}</select></div>` : ""}
        ${x.etape === "livraison" && !x.elements_recus_le ? `<div class="f"><label for="opt-d-${i}">${t("con.opt.elements.lib")}</label><input id="opt-d-${i}" type="date" data-opt-date value="${jourParis(Date.now())}" max="${jourParis(Date.now())}"></div>` : ""}
        <div class="actions">${x.etape === "second_test" ? `<button type="button" class="bouton petit" data-opt-second>${t("con.opt.second")}</button>`
          : `${!x.commerce_id ? `<button type="button" class="bouton second petit" data-opt-rattacher>${t("con.opt.rattacher")}</button>` : ""}${!x.elements_recus_le ? `<button type="button" class="bouton second petit" data-opt-elements>${t("con.opt.elements.bouton")}</button>` : ""}${x.commerce_id ? `<button type="button" class="bouton petit" data-opt-livree>${t("con.opt.livree")}</button>` : ""}`}</div></article>`; };

  // ---------------- Prospects (audit gratuit de la page de vente) : relances J+2, J+5, J+10 envoyées par le service du jour
  const ECHEANCES = [2, 5, 10], JOUR = 86400000;
  const jourCourt = I.jourMoisCourt;
  // Tournée du jour (bloc « Prospection quotidienne ») : statut noté par PJ (lien de l'email ou boutons ci-dessous) et prochaine action.
  // Rappels à J+2, J+5, J+10 après « rappeler », annoncés dans l'email de la tournée (jamais d'email au prospect).
  // La tournée ne part que les jours ouvrés : un rappel dû un samedi ou un dimanche arrive le lundi (jours fériés non comptés ici).
  const ouvre = ms => { let d = new Date(ms); while ([0, 6].includes(d.getDay())) d = new Date(d.getTime() + JOUR); return d.getTime(); };
  function etatTournee(p) {
    const r = p.resultat || "propose";
    if (r === "pas_interesse") return [t("con.p.pas.interesse"), t("con.p.opposition.det", { d: jourCourt(p.resultat_le || p.desinscrit_le) })];
    if (r === "pilote") return [t("con.p.pilote"), t("con.p.le", { d: jourCourt(p.resultat_le) })];
    if (r === "rdv") return [t("con.p.rdv"), t("con.p.le", { d: jourCourt(p.resultat_le || p.rdv_le) })];
    if (r === "rappeler") return p.relances >= 3 ? [t("con.p.rappels.finis"), t("con.p.rappels.finis.det")]
      : [t("con.p.rappeler"), t("con.p.rappel.det", { n: p.relances + 1, d: jourCourt(ouvre(new Date(p.resultat_le).getTime() + ECHEANCES[p.relances] * JOUR)) })];
    return [t("con.p.propose"), t("con.p.propose.det", { d: jourCourt(p.propose_le || p.audit_le), c: t("con.canal." + (p.canal || "visite")) })];
  }
  function etatProspect(p) {
    if (p.origine === "tournee") return etatTournee(p);
    if (p.desinscrit_le) return [t("con.p.arrete"), t("con.p.arrete.det", { d: jourCourt(p.desinscrit_le) })];
    if (p.rdv_le) return [t("con.p.rdv"), t("con.p.le", { d: jourCourt(p.rdv_le) })];
    if (p.repondu_le) return [t("con.p.repondu"), t("con.p.repondu.det", { d: jourCourt(p.repondu_le) })];
    if (!p.rapport_envoye_le) return [t("con.p.pas.envoye"), t("con.p.pas.envoye.det")];
    if (p.relances >= 3) return [t("con.p.finies"), t("con.p.finies.det")];
    return [t("con.p.en.relance"), t("con.p.relance.det", { n: p.relances, d: jourCourt(new Date(p.rapport_envoye_le).getTime() + ECHEANCES[p.relances] * JOUR) })];
  }
  async function prospects() {
    const l = await D.adminProspects(), C = k => t("con.col." + k);
    vue.innerHTML = `${entete(t("con.entree.prospects"), t("con.prospects.chapo"))}
      <p class="msg" id="msg" role="status"></p>${l.length ? `<section class="carte tableau"><table class="tab"><thead><tr><th>${C("prospect")}</th><th>${C("audit")}</th><th>${C("suivi")}</th><th>${C("actions")}</th></tr></thead><tbody>${l.map(p => { const [et, det] = etatProspect(p);
        const fini = p.desinscrit_le || p.rdv_le, tournee = p.origine === "tournee";
        const qui = tournee ? `${t("con.p.tournee")}, ${e([p.code_postal, p.ville].filter(Boolean).join(" "))}, SIRET ${e(p.siret || "")}` : e(p.email);
        const actions = tournee ? (p.resultat === "pas_interesse" || p.resultat === "pilote" ? "" : ["rappeler", "rdv", "pilote"].filter(r => r !== p.resultat)
            .map(r => `<button type="button" class="bouton second petit" data-r="${r}">${t("con.r." + r)}</button>`).join("") + `<button type="button" class="lien" data-r="pas_interesse">${t("con.r.pas_interesse")}</button>`)
          : null;
        return `<tr data-id="${e(p.id)}"><td data-l="${C("prospect")}"><p class="fort">${e(p.commerce || t("con.non.nomme"))}</p><p class="note casse">${qui}</p>${p.note_pj ? `<p class="note">${e(p.note_pj)}</p>` : ""}</td><td data-l="${C("audit")}">${p.audit_le ? jourCourt(p.audit_le) : ""}</td>
          <td data-l="${C("suivi")}"><p class="fort">${et}</p><p class="note">${det}</p></td>
          <td data-l="${C("actions")}"><div class="pile serre"><a class="bouton second petit" href="#/nouveau/${encodeURIComponent(p.id)}" data-creer-client>${t("con.p.creer.client")}</a>${actions !== null ? actions : fini ? "" : `${!p.rapport_envoye_le ? `<button type="button" class="bouton second petit" data-p="rapport_envoye">${t("con.rapport.envoye")}</button>` : ""}<button type="button" class="bouton second petit" data-p="rdv">${t("con.rdv")}</button>${!p.repondu_le ? `<button type="button" class="bouton second petit" data-p="reponse">${t("con.a.repondu")}</button>` : ""}<button type="button" class="lien" data-p="arreter">${t("con.arreter")}</button>`}</div></td></tr>`; }).join("")}</tbody></table></section>`
      : `<section class="carte"><p class="texte2">${t("con.aucun.prospect")}</p></section>`}`;
    vue.querySelectorAll("[data-p]").forEach(b => b.onclick = async () => { try { await D.adminProspect(b.closest("tr").dataset.id, b.dataset.p); await prospects(); msg(t("enregistre")); } catch (er) { msg(ph(er.message)); } });
    vue.querySelectorAll("[data-r]").forEach(b => b.onclick = async () => { try { await D.adminResultatProspect(b.closest("tr").dataset.id, b.dataset.r); await prospects(); msg(t("enregistre")); } catch (er) { msg(ph(er.message)); } });
  }

  // ================= Cartes de la file « À faire » (25/10/2026). Chaque carte garde l'action directe qu'elle avait dans son ancien onglet
  // (Alertes, À publier, Avis et garanties, Dépôts vidéo, Commerces) ; les boutons appellent les mêmes fonctions de la base.
  // Alertes : le type et le texte viennent de la base. Les phrases connues sont traduites ; ce qui est cité (texte d'un avis ou d'un commentaire,
  // message d'erreur d'un workflow) reste tel qu'il a été écrit, marqué translate="no". Rend [partie traduite, partie citée].
  const texteAlerte = x => { const s = String(x || ""); if (I.langue === "fr") return [s, ""];
    const tr = ph(s); if (tr !== s) return [tr, ""];
    const i = s.indexOf(" : "), tete = i > 0 ? s.slice(0, i).split(", ") : [];
    if (tete.length && tete.every(r => ph(r) !== r)) return [tete.map(r => ph(r)).join(", ") + ": ", s.slice(i + 3)];
    return ["", s]; };
  const alerteHtml = x => {
    // Erreur de workflow : « <workflow>, nœud <nœud> : <message> » ; le nom du workflow, celui du nœud et le message restent tels quels.
    const w = I.langue !== "fr" && String(x || "").match(/^(.*), nœud (.*?) : ([\s\S]*)$/);
    if (w) return `<span translate="no">${e(w[1])}</span>, ${t("con.noeud")} <span translate="no">${e(w[2])}</span>: <span translate="no">${e(w[3])}</span>`;
    const [a, b] = texteAlerte(x); return e(a) + (b ? `<span translate="no">${e(b)}</span>` : ""); };
  // Alertes en tête (26/10/2026, audit du parcours, constat 4) : « Avis sensible » et « Erreur de workflow » ont une échéance (reçue + 24 h, garantie des
  // avis) et l'étiquette « En retard » une fois passée. Boutons : « Ouvrir l'avis » (la file des avis du client, dans sa fiche) ou « Ouvrir le
  // client », et « Traité » pour une alerte de l'exploitant (admin_alerte_vue : elle sort de la file). Un avis sensible n'a pas de « Traité » ici :
  // il ne sort qu'une fois la réponse publiée (sa carte de la file des avis, en tête elle aussi, porte « Traité : réponse publiée »).
  // Étapes du journal (refus, échec) : libellé et détail lisibles, comme dans le journal.
  const ALERTES_PRIO = ["AVIS_SENSIBLE", "ERREUR_WORKFLOW"];
  const echeanceAlerte = a => ALERTES_PRIO.includes(a.code) ? Date.parse(a.date) + GD.avis_traite_heures * 3600000 : null;
  const carteAlerte = a => { const ech = echeanceAlerte(a), retard = ech != null && Date.now() > ech;
    const ouvrir = a.avis_id && a.commerce_id ? `<a class="bouton second petit" href="#/client/${encodeURIComponent(a.commerce_id)}/avis" data-ouvrir-avis>${t("con.al.ouvrir.avis")}</a>`
      : a.commerce_id ? `<a class="bouton second petit" href="#/client/${encodeURIComponent(a.commerce_id)}" data-ouvrir-client>${t("con.al.ouvrir.client")}</a>` : "";
    const traite = a.id != null && D.adminAlerteVue ? `<button type="button" class="bouton petit" data-alerte-vue>${t("con.al.traite")}</button>` : "";
    // v49 (13/11/2026, vu en prod : la fiche « Gild-Tech » du gérant reçue sur team@) : fiche Google sans client, « Ignorer cette fiche » (admin_ignorer_fiche_google).
    const ignorer = a.code === "FICHE_A_RELIER" && !a.commerce_id && a.id != null && D.adminIgnorerFicheGoogle ? `<button type="button" class="bouton second petit" data-fiche-ignorer>${t("con.al.fiche.ignorer")}</button>` : "";
    const titreFiche = a.code === "FICHE_A_RELIER" && !a.commerce_id && (a.detail_alerte || {}).titre ? `<p class="fort" data-fiche-titre>${t("con.al.fiche.titre", { x: e(a.detail_alerte.titre) })}</p>` : "";
    return `<article class="carte${retard ? " attention" : ""}" data-alerte="${e(a.id ?? "")}" data-code="${e(a.code || "")}"><div class="carte-tete"><h2>${e(a.journal ? libelleEtape(a.code) : ph(a.type))}</h2>${ech != null ? `<span class="etat${retard ? " retard" : " actif"}">${t(retard ? "con.al.retard" : "con.al.avant", { d: dh(ech) })}</span>` : `<span class="note">${dh(a.date)}</span>`}</div>
      ${a.commerce ? `<p class="fort">${e(a.commerce)}</p>` : ""}<p class="texte2 casse">${a.journal ? `<span translate="no">${e(detailJournal(a.detail))}</span>` : alerteHtml(a.texte)}</p>${ech != null ? `<p class="note">${t("con.file.recu", { d: dh(a.date) })}</p>` : ""}
      ${titreFiche}${a.avis_id ? `<p class="note">${t("con.al.publiee.seulement")}</p>` : ""}${ouvrir || traite || ignorer ? `<div class="actions">${ouvrir}${traite}${ignorer}</div>` : ""}</article>`; };
  // File « à publier à la main » : réponses aux commentaires validées par le commerçant, tant que l'accès de Meta n'est pas accordé (ou si l'API a
  // refusé). Texte prêt à copier, lien vers la publication ; « Publiée » une fois la réponse collée sous le commentaire, sous le compte du commerce.
  const RESEAUX_CM = { instagram: "Instagram", facebook: "Facebook" };
  // Mode de secours des avis (20/10/2026) : « À publier sur Google ». Tant que l'accès à l'API Google Business Profile n'est pas ouvert (variable n8n
  // RENOM_GBP_API), une réponse prête arrive ici au lieu d'échouer. L'équipe colle la réponse sous l'avis, puis « Marquer comme publiée » : la base note
  // l'heure (publication, et garantie des 24 h d'une réponse automatique). Après SECOURS_ALERTE_HEURES (4 h), la carte est en évidence.
  const etoilesAvis = n => n == null ? t("note.effacee") : t("con.etoiles", { n });
  const carteAvisGoogle = x => `<article class="carte${x.en_retard || x.attente_longue ? " attention" : ""}" data-avis-pub="${e(x.id)}"><div class="carte-tete"><h2>${e(x.commerce || "")}</h2>
          <span class="etat${x.en_retard ? "" : " actif"}">${x.echeance ? t(x.en_retard ? "con.file.retard" : "con.file.avant", { d: dh(x.echeance) }) : t("con.gbp.tenue")}</span></div>
          <p class="note">${t("con.gbp.titre")}</p>
          <p class="fort">${etoilesAvis(x.note)} · ${t(x.decision === "publication_automatique" ? "con.gbp.auto" : "con.gbp.validee")}</p>
          ${x.texte ? `<p class="texte2 casse" translate="no">${e(x.texte)}</p>` : `<p class="note">${t("con.gbp.texte.efface")}</p>`}
          <p class="note">${x.auteur ? `<span translate="no">${e(x.auteur)}</span> · ` : ""}${t("con.file.recu", { d: dh(x.recu_le) })} · ${t("con.gbp.depuis", { d: dh(x.a_publier_le) })}</p>
          ${x.attente_longue ? `<p class="note fort">${t("con.gbp.attente", { h: window.RENOM_SECOURS.ALERTE_HEURES })}</p>` : ""}
          <div class="f"><label for="gbp-${e(x.id)}">${t("con.rep.coller")}</label><textarea id="gbp-${e(x.id)}" readonly data-rep-gbp translate="no">${e(x.reponse || "")}</textarea></div>
          <div class="actions"><button type="button" class="bouton second petit" data-copier-gbp>${t("con.copier")}</button>${x.lien ? `<a class="bouton second petit" href="${e(x.lien)}" target="_blank" rel="noopener" data-ouvrir-gbp>${t("con.gbp.ouvrir")}</a>` : ""}<button type="button" class="bouton petit" data-publie-gbp>${t("con.gbp.marquer")}</button></div>
          ${x.lien ? "" : `<p class="note">${t("con.gbp.sans.lien")}</p>`}</article>`;
  // Publication à la main, sans Metricool (22/10/2026) : tant que RENOM_METRICOOL_ACTIF (n8n) ne vaut pas « oui », chaque contenu programmé arrive ici,
  // une carte par réseau (admin_publications_a_publier). Télécharger le média (lien signé au clic), copier la légende, publier depuis le compte du
  // commerce, puis « Marquer comme publiée » : la base note l'heure du clic et le journal (interne). En évidence 2 heures après l'heure prévue.
  const NOM_RESEAU = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", google: t("res.google") };
  const cartePublication = (x, i) => `<article class="carte${x.en_retard ? " attention" : ""}" data-pm="${e(x.id)}" data-pm-res="${e(x.reseau)}" data-pm-i="${i}">
          <div class="carte-tete"><h2>${e(x.commerce || "")}</h2><span class="etat${x.en_retard ? "" : " actif"}">${t(x.en_retard ? "con.pm.retard" : "con.pm.prevue", { d: dh(x.prevu_le) })}</span></div>
          <p class="note">${t("con.pm.titre")}</p>
          <p class="fort">${NOM_RESEAU[x.reseau] || e(x.reseau)} · ${t("con.pm.format." + (x.type === "video" ? "video" : x.format === "story" ? "story" : "publication"))}</p>
          ${x.ia ? `<p class="etiquette-ia" data-ia>${t("con.pm.ia")}</p>` : ""}
          ${(x.deja || []).length ? `<p class="note">${t("con.pm.deja", { res: x.deja.map(r => NOM_RESEAU[r] || e(r)).join(", ") })}</p>` : ""}
          ${x.son ? `<p class="note fort">${t("con.pm.son", { a: e(x.son.ambiance || "naturel") })}</p>` : ""}
          <div class="f"><label for="pm-${i}">${t("con.pm.legende", { res: NOM_RESEAU[x.reseau] || e(x.reseau) })}</label><textarea id="pm-${i}" readonly data-pm-legende translate="no" rows="${Math.min(12, Math.max(3, Math.ceil(String(x.legende || "").length / 34) + 1))}">${e(x.legende || "")}</textarea></div>
          ${(x.chemins || []).length > 1 ? `<p class="note fort" data-pm-carrousel>${t("con.pm.carrousel", { n: x.chemins.length })}</p>` : ""}
          <div class="actions"><button type="button" class="bouton second petit" data-pm-media>${(x.chemins || []).length > 1 ? t("con.pm.visuels", { n: x.chemins.length }) : t(x.type === "video" ? "con.pm.video" : "con.pm.visuel")}</button><button type="button" class="bouton second petit" data-pm-copier>${t("con.pm.copier")}</button><button type="button" class="bouton petit" data-pm-publiee>${t("con.pm.marquer")}</button></div></article>`;
  const carteCommentaireAPublier = x => `<article class="carte" data-id="${e(x.id)}" data-cm-pub><div class="carte-tete"><h2>${e(x.commerce || "")}</h2><span class="note">${t("con.validee.le", { res: RESEAUX_CM[x.reseau] || e(x.reseau), d: dh(x.decide_le || x.cree_le) })}</span></div>
          <p class="note">${t("con.cm.titre")}</p>
          ${x.texte ? `<p class="note">${t("con.commentaire.de", { de: x.auteur ? t("con.de", { a: e(x.auteur) }) : "", x: `<span translate="no">${e(x.texte)}</span>` })}</p>` : `<p class="note">${t("con.texte.efface")}</p>`}
          <div class="f"><label for="rep-${e(x.id)}">${t("con.rep.coller")}</label><textarea id="rep-${e(x.id)}" readonly data-rep translate="no">${e(x.reponse_proposee || "")}</textarea></div>
          ${x.erreur ? `<p class="note">${e(ph(x.erreur))}</p>` : ""}
          <div class="actions"><button type="button" class="bouton second petit" data-copier>${t("con.copier")}</button>${x.lien ? `<a class="bouton second petit" href="${e(x.lien)}" target="_blank" rel="noopener">${t("con.ouvrir.sur", { res: RESEAUX_CM[x.reseau] || t("con.le.reseau") })}</a>` : ""}<button type="button" class="bouton petit" data-publie>${t("con.publiee")}</button></div></article>`;
  // Son de plateforme des vidéos programmées : l'API Metricool ne documente aucun champ pour le poser (moteur/metricool_api.py) ; l'équipe l'ajoute dans
  // l'interface web de Metricool avant l'heure de publication, puis le marque ici (fonction SQL admin_musique_posee).
  const RS_SON = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook" }, nomsSon = l => l.map(r => RS_SON[r] || e(r)).join(", ");
  const carteSon = x => { const m = x.musique_a_poser || {}; return `<article class="carte" data-pub="${e(x.id)}"><div class="carte-tete"><h2>${e(x.commerce || "")}</h2><span class="note">${t("con.son.prevue", { d: dh(x.prevu_le) })}</span></div>
          <p class="note">${t("con.son.titre")}</p>
          <p class="fort">${t("con.son.reseaux", { res: nomsSon(m.reseaux || []) })}</p>
          <p class="note">${m.volume_video == null || m.volume_musique == null ? t("con.son.ambiance.seule", { a: e(m.ambiance || "naturel") }) : t("con.son.ambiance", { a: e(m.ambiance || "naturel"), v: m.volume_video, m: m.volume_musique })}</p>
          ${(m.sans_bibliotheque || []).length ? `<p class="note">${t("con.son.sans", { res: nomsSon(m.sans_bibliotheque) })}</p>` : ""}
          <div class="actions"><button type="button" class="bouton petit" data-son-pose>${t("con.son.pose")}</button></div></article>`; };
  // Avis et garanties (trois offres, 16/10/2026 ; bloc « Trois offres » de schema.sql).
  // 1. File des avis de BoostImpact : Standard et Premium (22/10/2026), avis 1 à 3 étoiles et avis sensibles traités et publiés par l'équipe
  //    (« Réponse publiée », commerçant prévenu) ; Essentiel, avis sensibles : la réponse est PROPOSÉE au commerçant (admin_avis_proposer),
  //    publiée seulement avec son accord (admin_avis_publie, accord coché). Tant que l'accès à l'API Google n'est pas ouvert, la réponse est publiée à
  //    la main sur la fiche, puis notée ici.
  // 2. Commentaires des commerces Premium (gestion par l'équipe). 3. Garantie des délais : départ (Essentiel : accès seul, depuis le 26/10/2026 ;
  //    Croissance et Premium : accès et premières photos), fiche sous 7 jours,
  //    premier contenu sous 72 h, avis sous 24 h ; manquements → mois offert, appliqué À LA MAIN dans Stripe puis noté ici (ordres/BRANCHEMENT.md).
  // 4. Réseaux retenus et mode délégation. 5. Objectif INTERNE des pilotes (ancienne garantie « 10 avis ») : jamais montré au commerçant.
  // 3 à 5 sont dans la fiche de chaque client ; les délais en retard ou proches et les mois offerts à appliquer sont aussi dans « À faire ».
  const ETAT_OBJ = I.carte("con.obj.etat", ["en_cours", "atteinte", "non_atteint", "condition_manquante"]);
  const ETAT_DELAI = I.carte("delai.etat", ["non_demarre", "en_cours", "tenu", "manque"]);
  const ENGAGEMENT = I.carte("con.engagement", ["fiche_7j", "premier_contenu_72h", "avis_24h"]);
  const RESEAUX_RET = ["instagram", "facebook", "tiktok"], NOM_RES = I.carte("res", ["facebook", "instagram", "google", "tiktok"]);
  const etoiles = n => t("con.etoiles", { n }), COND_O = window.RENOM_CONDITIONS.objectif_interne_pilotes, GD = window.RENOM_CONDITIONS.garantie_delais;
  const jourDe = v => v ? String(v).slice(0, 10) : "";
  // Avis sensible (26/10/2026) : en tête de « À faire » (alertes), « En retard » passé reçu + 24 h tant que la réponse n'est pas PUBLIÉE (une réponse
  // proposée au commerçant ne suffit pas) ; « Traité : réponse publiée » ; « Ouvrir l'avis » (fiche du client) et « Voir sur Google » (lien de
  // l'avis ou de la fiche, si connu). Mode équipe : l'avis reste dans la file jusqu'à la publication, même s'il a été « traité » plus tôt.
  // Version du commerçant reçue (01/11/2026) : échéance suspendue, « Version reçue, à reprendre », jamais en retard.
  const retardAvis = a => a.suspendue ? false : a.sensible || a.mode === "equipe" ? Date.now() > Date.parse(a.echeance) : !!a.en_retard;
  // « Attendez mon appel » (01/11/2026, retenir_reponse_avis) : avis en tête, « Le commerçant attend votre appel », publication grisée avec la raison
  // (la base la refuse aussi : admin_avis_publie) ; « Appel fait » (admin_liberer_avis) lève la retenue. Aucune publication automatique de ces avis.
  const retenueAvis = a => !a.retenue_le ? "" : `<div class="encart" data-retenue role="alert"><p class="fort">${t("con.file.retenue", { d: dh(a.retenue_le) })}</p>${a.telephone_client ? `<p class="note">${t("con.file.retenue.tel", { tel: `<a class="casse" href="tel:${e(a.telephone_client)}" translate="no">${e(window.RENOM_WHATSAPP ? window.RENOM_WHATSAPP.lisible(a.telephone_client) : a.telephone_client)}</a>` })}</p>` : ""}${a.rappel_jour ? `<p class="note" data-rappel-jour>${t(a.rappel_creneau === "15-17" ? "con.file.retenue.jour.1517" : "con.file.retenue.jour", { d: I.jourEtDate(a.rappel_jour + "T12:00:00") })}</p>` : ""}</div>`;
  const carteAvisFile = (a, o = {}) => { const r = retardAvis(a), sens = !!a.sensible;
    // Version restée 48 h sans reprise (01/11/2026, tour 6 Premium) : « En retard », relance (admin_file_avis : relance_version).
    const etat = a.relance_version ? t("con.file.version.relance", { d: dh(a.version_client_le) }) : a.suspendue ? t("con.file.version.reprendre") : sens ? t(r ? "con.al.retard" : "con.file.avant", { d: dh(a.echeance) }) : a.traite_le && a.mode !== "equipe" ? t("con.file.traite", { d: dh(a.traite_le) }) : t(r ? "con.file.retard" : "con.file.avant", { d: dh(a.echeance) });
    const ouvrir = !o.surClient && a.commerce_id ? `<a class="bouton second petit" href="#/client/${encodeURIComponent(a.commerce_id)}/avis" data-ouvrir-avis>${t("con.al.ouvrir.avis")}</a>` : "";
    const google = a.lien ? `<a class="bouton second petit" href="${e(a.lien)}" target="_blank" rel="noopener" data-avis-google>${t("con.al.google")}</a>` : "";
    return `<article class="carte${r ? " attention" : ""}" data-avis="${e(a.id)}" data-mode="${e(a.mode)}"${sens ? " data-sensible" : ""}><div class="carte-tete"><h2>${sens ? t("con.al.avis.sensible") : e(a.commerce || "")}</h2><span class="etat${r ? (sens ? " retard" : "") : " actif"}">${etat}</span></div>
          ${retenueAvis(a)}${sens ? `<p class="fort">${e(a.commerce || "")}</p>` : ""}<p class="note">${t("con.file.titre")}</p>
          <p class="fort">${etoiles(a.note)} · ${e(I.offre(a.offre || ""))}${a.sensible ? " · " + t("con.file.sensible", { r: e((a.raisons || []).join(", ")) }) : " · " + t("con.file.equipe")}</p>
          ${a.texte ? `<p class="texte2 casse" translate="no">${e(a.texte)}</p>` : `<p class="note">${t("con.texte.efface")}</p>`}<p class="note">${t("con.file.recu", { d: dh(a.recu_le) })}</p>
          <div class="f"><label for="rep-av-${e(a.id)}">${t(a.mode === "equipe" ? "con.file.reponse" : "con.file.reponse.proposer")}</label><textarea id="rep-av-${e(a.id)}" data-rep-avis maxlength="2000" translate="no">${e(a.reponse_proposee || "")}</textarea></div>
          ${a.mode === "equipe" ? `<p class="note">${t("con.file.mode.equipe")}</p>` : `<p class="note">${t("con.file.mode.proposer", { email: a.email_client ? `<span class="casse">${e(a.email_client)}</span>` : t("con.file.sans.email") })}</p>
          ${a.version_client ? `<div class="encart" data-version-client><p class="fort">${t("con.file.version", { d: dh(a.version_client_le) })}</p><p class="texte2 casse" translate="no">${e(a.version_client)}</p></div>` : ""}
          ${a.propose_le ? `<p class="note">${t("con.file.proposee", { d: dh(a.propose_le) })}</p>` : ""}${a.accord_espace ? `<p class="fort" data-accord-espace>${t("con.file.accord.espace", { d: dh(a.decision_client_le) })}</p>` : a.decision_client === "en_parler" ? `<p class="fort">${t("con.file.en.parler", { d: dh(a.decision_client_le) })}</p>` : ""}<label class="option"><input type="checkbox" data-accord${a.accord_espace ? " checked" : ""}><span>${t("con.file.accord")}</span></label>`}
          ${ouvrir || google ? `<div class="actions">${ouvrir}${google}</div>` : ""}
          <div class="actions"><button type="button" class="bouton second petit" data-copier-avis>${t("con.copier")}</button>${a.mode === "equipe" ? "" : `<button type="button" class="bouton second petit" data-avis-proposer>${t("con.file.proposer")}</button>`}${a.retenue_le ? `<button type="button" class="bouton petit" data-avis-liberer>${t("con.file.liberer")}</button>` : ""}<button type="button" class="bouton petit${a.retenue_le ? " second" : ""}" data-avis-publie${a.retenue_le ? ` disabled aria-describedby="retenue-raison-${e(a.id)}"` : ""}>${t(sens ? "con.file.traite.publiee" : "con.file.publiee")}</button></div>
          ${a.retenue_le ? `<p class="note" id="retenue-raison-${e(a.id)}" data-retenue-raison>${t("con.file.retenue.raison")}</p>` : ""}</article>`; };
  const carteCommentaireEquipe = x => `<article class="carte" data-cm="${e(x.id)}"><div class="carte-tete"><h2>${e(x.commerce || "")}</h2><span class="note">${NOM_RES[x.reseau] || e(x.reseau)}</span></div>
          <p class="note">${t("con.cm.equipe.titre")}</p>
          <p class="texte2 casse" translate="no">${e(x.texte || "")}</p><p class="note">${x.auteur ? e(x.auteur) + " · " : ""}${dh(x.recu_le)}</p>
          <div class="f"><label for="cm-eq-${e(x.id)}">${t("con.cm.equipe.reponse")}</label><textarea id="cm-eq-${e(x.id)}" data-cm-texte maxlength="1000" translate="no">${e(x.reponse_proposee || "")}</textarea></div>
          <div class="actions"><button type="button" class="bouton petit" data-cm-d="valide">${t("con.cm.equipe.valider")}</button><button type="button" class="bouton second petit" data-cm-d="ignore">${t("con.cm.equipe.ignorer")}</button></div></article>`;
  // Cohérence des informations (22/10/2026, CGV article 10) : à vérifier avant de noter « Fiche optimisée le » (la base le refuse sinon) ; écarts relevés,
  // un par ligne, et message au client dans SA langue (commerces.langue), prêt à copier et à envoyer depuis team@.
  const coherenceEtat = f => { const c = (f || {}).coherence || {}; return c.verifiee_le ? `<p class="note">${t("con.coh.faite", { d: I.date(jourDe(c.verifiee_le)) })}${c.ecarts ? " · " + t("con.coh.ecarts.n", { n: c.ecarts.split("\n").filter(x => x.trim()).length }) : " · " + t("con.coh.aucun.ecart")}</p>`
    : (f || {}).fait_le ? "" : `<p class="note fort">${t("con.coh.a.faire")}</p>`; };
  const messageCoherence = (g, ecarts) => { const lg = ["fr", "en", "nl"].includes(g.langue) ? g.langue : "fr", l = String(ecarts || "").split("\n").map(x => x.trim()).filter(Boolean);
    return t("con.coh.objet", { commerce: g.commerce || "" }, lg) + "\n\n" + t("con.coh.message", { commerce: g.commerce || "", ecarts: l.length ? l.map(x => "- " + x).join("\n") : "- …" }, lg); };
  const delai = d => !d ? `<p class="note">${t("con.delais.sans.objet")}</p>` : `<p><span class="etat${d.etat === "tenu" ? " actif" : ""}">${ETAT_DELAI[d.etat] || e(d.etat)}</span></p>${d.echeance ? `<p class="note">${t(d.fait_le ? "con.delais.fait" : "con.delais.avant", { d: dh(d.fait_le || d.echeance) })}</p>` : ""}`;
  // Saisie des dates d'un commerce (accès remis, photos reçues, cohérence, écarts, fiche optimisée) : la même dans « À faire » et dans la fiche du client.
  // « Accès remis le » en date ET heure (26/10/2026) : posé à la minute par « Google vérifié », il démarre la garantie ; envoyé en heure exacte (ISO).
  const dateHeureLocale = v => { if (!v) return ""; const d = new Date(v); if (isNaN(d)) return ""; const z = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; };
  const valeurDate = i => !i.value ? null : i.type === "datetime-local" && !isNaN(new Date(i.value)) ? new Date(i.value).toISOString() : i.value;
  const saisieDelais = g => `<div class="pile serre">
            <div class="f etroit"><label for="acc-${e(g.commerce_id)}">${t("con.delais.acces.lib")}</label><input id="acc-${e(g.commerce_id)}" type="datetime-local" value="${e(dateHeureLocale(g.acces_remis_le))}" data-d="acces_remis_le"></div>
            <div class="f etroit"><label for="pho-${e(g.commerce_id)}">${t("con.delais.photos.lib")}</label><input id="pho-${e(g.commerce_id)}" type="date" value="${e(jourDe(g.photos_recues_le))}" data-d="photos_recues_le"></div>
            <div class="f etroit"><label for="coh-${e(g.commerce_id)}">${t("con.coh.lib")}</label><input id="coh-${e(g.commerce_id)}" type="date" value="${e(jourDe(((g.fiche || {}).coherence || {}).verifiee_le))}" data-d="coherence_verifiee_le"></div>
            <div class="f etroit"><label for="eca-${e(g.commerce_id)}">${t("con.coh.ecarts.lib")}</label><textarea id="eca-${e(g.commerce_id)}" rows="3" maxlength="2000" data-d="coherence_ecarts" data-coh-ecarts translate="no">${e(((g.fiche || {}).coherence || {}).ecarts || "")}</textarea><p class="aide">${t("con.coh.ecarts.aide")}</p></div>
            <div class="f etroit"><label for="fic-${e(g.commerce_id)}">${t("con.delais.fiche.lib")}</label><input id="fic-${e(g.commerce_id)}" type="date" value="${e(jourDe((g.fiche || {}).fait_le))}" data-d="fiche_optimisee_le"></div>
            <button type="button" class="bouton second petit" data-delais-enregistrer>${t("enregistrer")}</button>
            <button type="button" class="bouton second petit" data-coh-copier>${t("con.coh.copier")}</button>
            <div class="f etroit"><label for="msg-coh-${e(g.commerce_id)}">${t("con.coh.message.lib", { l: (g.langue || "fr").toUpperCase() })}</label><textarea id="msg-coh-${e(g.commerce_id)}" rows="6" readonly data-coh-message translate="no">${e(messageCoherence(g, ((g.fiche || {}).coherence || {}).ecarts))}</textarea></div></div>`;
  // Délais d'un commerce à surveiller : un engagement manqué, en retard, ou dont l'échéance tombe dans le délai d'alerte de la base (conditions_offre :
  // fiche 48 h avant, premier contenu 24 h avant, avis 4 h avant, comme garantie_delais_controle).
  const AVANT_H = { fiche: GD.alerte_fiche_avant_heures, premier_contenu: GD.alerte_contenu_avant_heures };
  const delaisAFaire = g => { const maintenant = Date.now(), raisons = [];
    for (const k of ["fiche", "premier_contenu"]) { const d = g[k]; if (!d || d.fait_le || !d.echeance) continue;
      const ech = Date.parse(d.echeance); if (d.etat === "manque" || ech < maintenant) raisons.push({ k, retard: true, ech }); else if (ech - maintenant <= AVANT_H[k] * 3600000) raisons.push({ k, retard: false, ech }); }
    for (const a of g.avis_en_cours || []) { const ech = Date.parse(a.echeance || 0); if (a.en_retard) raisons.push({ k: "avis", retard: true, ech }); else if (ech && ech - maintenant <= GD.alerte_avis_avant_heures * 3600000) raisons.push({ k: "avis", retard: false, ech }); }
    return raisons; };
  const carteDelais = (g, raisons) => `<article class="carte${raisons.some(r => r.retard) ? " attention" : ""}" data-delais="${e(g.commerce_id)}"><div class="carte-tete"><h2>${e(g.commerce || "")}</h2><span class="note">${e(I.offre(g.offre || ""))}</span></div>
          <p class="note">${t("con.delais.titre")}</p>
          <ul class="liste raisons">${raisons.map(r => `<li><span>${C_({ fiche: "delais.fiche", premier_contenu: "delais.contenu", avis: "delais.avis" }[r.k])}</span><span class="fort">${t(r.retard ? "con.file.retard" : "con.file.avant", { d: dh(r.ech) })}</span></li>`).join("")}</ul>
          ${g.depart ? `<p class="note">${C_("delais.depart")}${t("deux.points")}${dh(g.depart)}</p>` : ""}${coherenceEtat(g.fiche)}
          ${saisieDelais(g)}</article>`;
  // Un seul mois offert par client et par mois (CGV article 10 : « plusieurs délais manqués au cours d'un même mois donnent droit à un seul mois
  // offert ») ; correctif du 29/10/2026 (bug « Appliqué » : une carte par manquement proposait d'appliquer deux fois le même mois dans Stripe).
  // Les manquements à appliquer d'un même client et d'un même mois offert forment UNE carte ; « Mois offert appliqué dans Stripe » les clôt tous.
  // Si ce mois a déjà été appliqué pour ce client, la carte le dit et propose seulement « Clore sans rien changer dans Stripe » (statut « écarté »,
  // motif écrit : le journal ne dit jamais qu'un second mois a été offert). Mêmes règles que le cockpit (cockpit.js, mois offerts à appliquer).
  const groupesManquements = g => { const ms = g.manquements || [], deja = new Set(ms.filter(m => m.statut === "applique").map(m => m.mois_offert)), gr = {};
    ms.filter(m => m.statut === "a_appliquer").forEach(m => { const x = gr[m.mois_offert] || (gr[m.mois_offert] = { commerce: g.commerce, commerce_id: g.commerce_id, mois_offert: m.mois_offert, statut: "a_appliquer", ids: [], engagements: [], echeance: m.echeance, deja: deja.has(m.mois_offert) });
      x.ids.push(m.id); x.engagements.push(m.engagement); if (Date.parse(m.echeance) < Date.parse(x.echeance)) x.echeance = m.echeance; });
    return Object.values(gr); };
  const carteManquement = m => { const ids = m.ids || [m.id], deja = !!m.deja, ouvert = m.statut === "a_appliquer", cle = e(ids.join("-"));
    return `<article class="carte${ouvert && !deja ? " attention" : ""}" data-mq="${e(ids.join(","))}"${deja ? " data-mq-deja" : ""}><div class="carte-tete"><h2>${e(m.commerce || "")}</h2><span class="etat">${t(deja ? "con.mq.st.deja" : "con.mq.st." + m.statut)}</span></div>
          <p class="note">${t("con.mq.titre")}</p>
          <p class="fort">${(m.engagements || [m.engagement]).map(k => ENGAGEMENT[k] || e(k)).join(", ")}</p><p class="note">${t("con.mq.echeance", { d: dh(m.echeance) })} · ${C_("mq.mois")}${t("deux.points")}${I.date(m.mois_offert)}</p>
          ${ouvert && deja ? `<p class="note fort" data-mq-explication>${t("con.mq.deja", { m: nomMois(m.mois_offert) })}</p><div class="pile serre"><button type="button" class="bouton petit" data-mq-d="deja">${t("con.mq.clore")}</button></div>`
          : ouvert ? `${ids.length > 1 ? `<p class="note fort" data-mq-explication>${t("con.mq.groupe", { n: ids.length, m: nomMois(m.mois_offert) })}</p>` : ""}<div class="pile serre"><button type="button" class="bouton petit" data-mq-d="applique">${t("con.mq.appliquer")}</button>
            <div class="f etroit"><label for="mq-${cle}">${t("con.mq.motif")}</label><input id="mq-${cle}" type="text" maxlength="500" data-mq-motif></div><button type="button" class="bouton second petit" data-mq-d="ecarte">${t("con.mq.ecarter")}</button></div>`
          : m.motif ? `<p class="note casse">${e(m.motif)}</p>` : ""}</article>`; };
  const C_ = k => t("con.col." + k);
  // Dépôts de vidéos : statut, motif ; relance du montage (fonction SQL admin_relancer_montage, qui revérifie tout).
  const ST_DV = I.carte("dv.st", window.RENOM_DEPOT_VIDEO.STATUTS);
  const RELANCABLE = ["envoye", "en_montage", "refuse"];
  const relancable = d => RELANCABLE.includes(d.statut) && !d.rushes_effaces_le && !d.effacement_demande_le;
  const secDv = d => d == null ? "" : ", " + I.nombre(+d, +d % 1 ? 1 : 0) + " s";
  // Montage à la main (31/10/2026) : filet de sécurité quand le montage automatique échoue ou ne plaît pas. « Télécharger les plans » (tant que
  // les vidéos d'origine existent) et « Déposer un montage fait à la main » ouvrent l'écran du dépôt (#/depot/<id>/plans ou /main).
  const MM = window.RENOM_MONTAGE_MAIN;
  const lienDepot = (d, sous, cle) => `<a class="bouton second petit" href="#/depot/${encodeURIComponent(d.id)}/${sous}" data-${sous === "plans" ? "plans" : "main"}>${t(cle)}</a>`;
  const actionsDepot = d => [relancable(d) ? `<button type="button" class="bouton second petit" data-relancer>${t("con.relancer")}</button>` : "",
    MM.plansDispo(d) ? lienDepot(d, "plans", "con.plans") : "", MM.possible(d) ? lienDepot(d, "main", "con.main") : ""].join("");
  // Dépôt refusé (26/10/2026, constat 25) : c'est au commerçant de refilmer ; jamais « en retard », jamais en évidence, rangé dans « Vidéos ».
  const carteDepot = d => `<article class="carte" data-depot="${e(d.id)}"><div class="carte-tete"><h2>${e(d.commerce || "")}</h2><span class="note">${dh(d.cree_le)}</span></div>
          <p class="note">${t("con.entree.videos")}</p>
          <p class="fort">${ST_DV[d.statut] || e(d.statut)}</p>${d.motif ? `<p class="note">${e(ph(d.motif))}</p>` : ""}${d.essais ? `<p class="note">${t("con.essais", { n: d.essais })}</p>` : ""}
          ${d.nb_videos ? `<p class="note">${t("dv.depot.contenu", { v: d.nb_videos, p: (d.nb_fichiers || 0) - d.nb_videos, d: "" }) + secDv(d.duree_totale_s)}</p>` : ""}${d.note ? `<p class="note casse" translate="no">${e(d.note)}</p>` : ""}
          ${actionsDepot(d) ? `<div class="actions">${actionsDepot(d)}</div>` : ""}</article>`;
  // Mise en route bloquée : pas finie 5 jours après la création (même seuil que l'alerte MISE_EN_ROUTE_BLOQUEE et le score de santé), ou un point
  // déclaré fait par le commerçant, que l'équipe doit vérifier.
  const ageJours = c => c.cree_le ? Math.floor((Date.now() - Date.parse(c.cree_le)) / 86400000) : null;
  const merBloquee = c => { const m = c.sante && c.sante.mise_en_route; if (!m || m.faits >= m.total) return false; return m.points.some(x => x.etat === "declare") || (ageJours(c) ?? 0) >= 5; };
  // Tâches de l'équipe dès le jour 0 (v46) : fiche à vérifier (nom pas confirmé, ou métier « Autre commerce » d'un client venu par le paiement en
  // ligne, jamais corrigé), lien Metricool à envoyer, blogId à noter. Les étapes du client n'entrent dans « À faire » qu'à leur date d'appel (merBloquee).
  // jl : journal de CE client (COMMERCE_CREE « paiement_en_ligne », METIER_COMMERCE) ; sans lui, le métier n'est pas contrôlé.
  const metierAVerifier = (c, jl) => c.metier === "autre" && Array.isArray(jl) && jl.some(x => x.type === "COMMERCE_CREE" && (x.detail || {}).origine === "paiement_en_ligne") && !jl.some(x => x.type === "METIER_COMMERCE");
  // Numéro WhatsApp obligatoire (11/11/2026, bloc SQL « Numéro WhatsApp obligatoire au démarrage ») : WhatsApp actif = numéro, accord daté,
  // notifications.whatsapp vrai (whatsapp_actif de schema.sql). Client actif (pas en pause) sans WhatsApp après sa date d'appel (création +
  // J_APPEL jours) : tâche « WhatsApp manquant » de À faire, en retard.
  const waActif = c => !!(c && c.whatsapp_numero && c.whatsapp_accord_le && (c.notifications || {}).whatsapp);
  const waEnRetard = c => !c.en_pause && !waActif(c) && (ageJours(c) ?? 0) >= J_APPEL;
  const tachesAdmin = (c, jl) => { if (c.en_pause) return []; const l = [], o = OFFRES[c.offre_id] || {}, m = c.sante && c.sante.mise_en_route, r = m && (m.points || []).find(x => x.point === "metricool");
    if ("nom_confirme_le" in c && !c.nom_confirme_le) l.push("fiche"); else if (metierAVerifier(c, jl)) l.push("metier");
    if (r && r.etat === "a_faire" && "lien_envoye_le" in r && !r.lien_envoye_le) l.push("lien");
    if (o.reseaux_sociaux && !c.metricool_blog_id) l.push("blog");
    if (waEnRetard(c)) l.push("whatsapp");
    if (o.reseaux_sociaux && r && r.etat !== "fait" && instagramProAFaire(c)) l.push("instagram_pro");   // v49 : 6e question, Instagram pas professionnel
    return l; };
  const carteMiseEnRoute = (c, taches) => { const bloque = merBloquee(c), lien = taches.includes("lien") && !bloque;
    return `<article class="carte${bloque ? " attention" : ""}" data-mer-commerce="${e(c.id)}"><div class="carte-tete"><h2>${e(c.nom)}</h2><a href="#/client/${encodeURIComponent(c.id)}">${t("con.client.ouvrir")}</a></div>
          <p class="note">${t("con.col.mer")}</p>${taches.length ? `<ul class="taches-admin">${taches.map(k => `<li data-tache="${k}">${t("con.af.tache." + k)}</li>`).join("")}</ul>` : ""}
          ${lien ? `<div class="actions"><button type="button" class="bouton second petit" data-mer-lien data-cid="${e(c.id)}">${t("con.mer.lien.bouton")}</button></div>` : ""}${bloque ? miseEnRoute(c) : ""}</article>`; };

  // ================= Écran « À faire » : une seule file, triée par urgence (en retard d'abord, puis l'échéance la plus proche, puis le reste, le plus
  // récent d'abord). Un compteur par type en haut ; chaque compteur filtre la file (#/afaire/<type>).
  const TYPES_AF = ["alertes", "apublier", "avis", "videos", "garanties", "miseenroute", "options"];
  let afCtx = {};
  // 26/10/2026 (garantie des 24 h tenue à deux) : les alertes prioritaires (avis sensibles, erreurs de workflow) passent avant tout, avec leur échéance ;
  // un avis sensible reste dans la file jusqu'à sa publication ; un dépôt vidéo refusé n'est jamais « en retard » ; « Charge du jour » en haut ;
  // « Je prends » sur chaque carte et le filtre « À moi ».
  // Collecte de la file (29/10/2026, extraite de afaire) : la file « À faire » et le cockpit comptent EXACTEMENT les mêmes tâches, avec les mêmes
  // règles de retard ; chaque tâche porte le commerce concerné (cid), pour la file de travail par client du cockpit.
  async function collecterAFaire() {
    const sur = p => p.catch(() => null);
    const [alertes, pubs, avisG, cmPub, sons, file, cmEq, depots, dl, cs, opts] = await Promise.all([sur(D.adminAlertes()), sur(D.adminPublicationsAPublier()), sur(D.adminAvisAPublier()), sur(D.adminCommentairesAPublier()),
      sur(D.adminMusiquesAPoser()), sur(D.adminFileAvis()), sur(D.adminCommentairesEquipe()), sur(D.adminDepotsVideo()), sur(D.adminGarantieDelais()), D.adminCommerces(), D.adminCommandesOptions ? sur(D.adminCommandesOptions()) : [], lirePrises()]);
    const T_ = x => x ? Date.parse(x) : NaN, items = [];
    const ajout = (type, html, retard, quand, date, o = {}) => items.push({ type, types: o.types || [type], prio: !!o.prio, tete: !!o.tete, cle: o.cle || null, cid: o.cid || null, html: avecPrise(html, o.cle), retard: !!retard, quand: isNaN(quand) ? Infinity : quand, date: isNaN(date) ? 0 : date });
    // Avis sensibles de la file : une seule carte (l'alerte ET la réponse), en tête.
    const sensibles = new Set((file || []).filter(a => a.sensible).map(a => a.id));
    (alertes || []).filter(a => !(a.code === "AVIS_SENSIBLE" && sensibles.has(a.avis_id))).forEach(a => { const ech = echeanceAlerte(a);
      const cle = a.id != null ? "alerte:" + a.id : a.avis_id ? "avis:" + a.avis_id : a.commentaire_id ? "commentaire:" + a.commentaire_id : a.publication_id ? "publication:" + a.publication_id : null;
      ajout("alertes", carteAlerte(a), ech != null && Date.now() > ech, ech == null ? NaN : ech, T_(a.date), { prio: ech != null, cle, cid: a.commerce_id }); });
    (pubs || []).forEach((x, i) => ajout("apublier", cartePublication(x, i), x.en_retard, T_(x.prevu_le), NaN, { cle: "publication:" + x.id + ":" + x.reseau, cid: x.commerce_id }));
    (avisG || []).forEach(x => ajout("apublier", carteAvisGoogle(x), x.en_retard, T_(x.echeance), T_(x.a_publier_le), { cle: "avis:" + x.id, cid: x.commerce_id }));
    (cmPub || []).forEach(x => ajout("apublier", carteCommentaireAPublier(x), false, NaN, T_(x.decide_le || x.cree_le), { cle: "commentaire:" + x.id, cid: x.commerce_id }));
    (sons || []).forEach(x => ajout("apublier", carteSon(x), false, T_(x.prevu_le), NaN, { cle: "son:" + x.id, cid: x.commerce_id }));
    (file || []).forEach(a => ajout(a.sensible || a.retenue_le ? "alertes" : "avis", carteAvisFile(a), retardAvis(a), a.sensible || a.mode === "equipe" || !a.traite_le ? T_(a.echeance) : NaN, T_(a.recu_le),
      { cle: "avis:" + a.id, prio: !!a.sensible || !!a.retenue_le, tete: !!a.retenue_le, types: a.sensible || a.retenue_le ? ["alertes", "avis"] : ["avis"], cid: a.commerce_id }));
    (cmEq || []).forEach(x => ajout("avis", carteCommentaireEquipe(x), false, NaN, T_(x.recu_le), { cle: "commentaire:" + x.id, cid: x.commerce_id }));
    (depots || []).filter(relancable).forEach(d => ajout("videos", carteDepot(d), false, NaN, T_(d.cree_le), { cle: "depot:" + d.id, cid: d.commerce_id }));
    (dl || []).forEach(g => { const r = delaisAFaire(g); if (r.length) ajout("garanties", carteDelais(g, r), r.some(x => x.retard), Math.min(...r.map(x => x.ech)), NaN, { cle: "delais:" + g.commerce_id, cid: g.commerce_id }); });
    // Mois offerts : une carte par client et par mois offert ; un mois déjà offert reste à clore, sans être « en retard » (aucun geste Stripe).
    (dl || []).flatMap(groupesManquements).forEach(m => ajout("garanties", carteManquement(m), !m.deja, T_(m.echeance), NaN, { cle: "manquement:" + m.ids[0], cid: m.commerce_id }));
    // Métier à contrôler : journal de chaque client encore en « Autre commerce » (peu nombreux), lu à part.
    const jls = Object.fromEntries(await Promise.all(cs.filter(c => c.metier === "autre" && D.adminJournalClient).map(async c => [c.id, await D.adminJournalClient(c.id).catch(() => null)])));
    cs.forEach(c => { const tk = tachesAdmin(c, jls[c.id]), bloque = merBloquee(c);
      if (bloque || tk.length) ajout("miseenroute", carteMiseEnRoute(c, tk), (bloque && (ageJours(c) ?? 0) >= 5) || tk.includes("whatsapp"), NaN, T_(c.cree_le), { cle: "mer:" + c.id, cid: c.id }); });
    (opts || []).forEach(x => ajout("options", carteOption(x, [...cs].sort((a, b) => a.nom.localeCompare(b.nom))), x.en_retard, T_(x.echeance), NaN, { cle: "option:" + x.id, cid: x.commerce_id }));
    items.sort((a, b) => (a.tete ? 0 : 1) - (b.tete ? 0 : 1) || (a.prio ? 0 : 1) - (b.prio ? 0 : 1) || (a.retard ? 0 : 1) - (b.retard ? 0 : 1) || a.quand - b.quand || b.date - a.date);
    return { items, alertes, pubs, dl, cs, erreurs: [alertes, pubs, avisG, cmPub, sons, file, cmEq, depots, dl].some(x => x === null) };
  }
  // Prénom de l'appareil (compte partagé) : la même zone dans « À faire » et dans le cockpit.
  const zoneMoi = () => { if (!prises) return ""; const noms = [...new Set(Object.values(prises).map(x => x.par))];
    return moi ? `<p class="note moi" id="moi">${t("con.moi.est", { p: e(moi) })} <button type="button" class="lien" id="moi-changer">${t("con.moi.changer")}</button></p>`
      : `<form class="moi" id="f-moi"><div class="f etroit"><label for="moi-prenom">${t("con.moi.lib")}</label><input id="moi-prenom" type="text" maxlength="40" autocomplete="given-name"${noms.length ? ' list="moi-noms"' : ""}></div>${noms.length ? `<datalist id="moi-noms">${noms.map(x => `<option value="${e(x)}">`).join("")}</datalist>` : ""}<button class="bouton second petit" type="submit">${t("con.moi.ok")}</button></form>`; };
  const brancherMoi = refaire => { const fm = $("f-moi"); if (fm) fm.onsubmit = ev => { ev.preventDefault(); const v = $("moi-prenom").value.trim(); if (!v) return; garderMoi(v); refaire(); };
    const mc = $("moi-changer"); if (mc) mc.onclick = () => { garderMoi(""); refaire(true); }; };
  async function afaire(filtreType) {
    const { items, pubs, dl, cs, erreurs } = await collecterAFaire();
    const avecMoi = !!(prises && moi), TYPES = avecMoi ? [...TYPES_AF, "moi"] : TYPES_AF;
    const de = k => k === "moi" ? items.filter(x => aMoi(x.cle)) : items.filter(x => x.types.includes(k));
    const n = Object.fromEntries(TYPES.map(k => [k, de(k).length])), f = TYPES.includes(filtreType) ? filtreType : "";
    const visibles = f ? de(f) : items;
    afCtx = { pubs: pubs || [], dl: dl || [], cs };
    // Charge du jour (constat 7) : toutes les actions de la file ; « en retard » et « avant <heure> » (échéance aujourd'hui, l'heure de la plus tardive).
    const finJour = new Date(); finJour.setHours(23, 59, 59, 999);
    const enRetard = items.filter(x => x.retard).length, duJour = items.filter(x => !x.retard && x.quand !== Infinity && x.quand <= finJour.getTime());
    const charge = t("con.charge", { n: items.length, r: enRetard, m: duJour.length, h: duJour.length ? I.heure(Math.max(...duJour.map(x => x.quand))) : "" });
    vue.innerHTML = `${entete(t("con.entree.afaire"), t("con.afaire.chapo"))}<p class="charge fort" id="charge">${charge}</p>${zoneMoi()}<p class="msg" id="msg" role="status"></p>
      <nav class="filtres compteurs" id="a-faire" aria-label="${t("con.afaire.types")}"><a href="#/afaire" data-type=""${f ? "" : ' aria-current="page"'}>${t("con.afaire.tout", { n: items.length })}</a>${TYPES.map(k => `<a href="#/afaire/${k}" data-type="${k}" data-n="${n[k]}"${f === k ? ' aria-current="page"' : ""}>${t("con.af." + k)}, ${n[k]}</a>`).join("")}</nav>
      ${erreurs ? `<p class="note">${t("con.afaire.erreur")}</p>` : ""}
      ${visibles.length ? `<div class="pile" id="file-a-faire">${visibles.map(x => x.html.replace("<article ", `<article data-type="${f && x.types.includes(f) ? f : x.type}" data-types="${x.types.join(" ")}"${x.prio ? " data-prio" : ""} `)).join("")}</div>` : `<section class="carte"><p class="texte2" id="a-faire-vide">${t(f ? "con.afaire.vide.type" : "con.afaire.vide")}</p></section>`}`;
    const fl = vue.querySelector(".compteurs"), fp = fl && fl.querySelector("[aria-current]");
    if (fp && fl.scrollWidth > fl.clientWidth) fl.scrollLeft += fp.getBoundingClientRect().left - fl.getBoundingClientRect().left - 8;
    brancherMoi(change => afaire(change && filtreType === "moi" ? "" : filtreType));
    brancherCartes(() => afaire(filtreType));
  }
  // Accès Google vérifié (mise en route « Google vérifié » ou « Accès vérifié » de la fiche Google, 26/10/2026, constat 24) : si la date de remise de
  // l'accès (départ de la garantie) est vide, elle est notée à maintenant, modifiable ensuite dans Garanties. Plus de double saisie.
  async function noterAccesGoogle(cid) {
    try { const g = ((await D.adminGarantieDelais()) || []).find(x => x.commerce_id === cid); if (g && g.acces_remis_le) return null;
      const maintenant = new Date().toISOString(); await D.adminDelais(cid, { acces_remis_le: maintenant }); return t("con.acces.depart", { d: dh(maintenant) }); }
    catch (er) { return null; }
  }
  // Actions des cartes (À faire et fiche du client) : chaque bouton appelle la fonction de la base, puis l'écran est redessiné (apres) et le message
  // dit ce qui a été noté.
  // « Fait à 19 h 12 : … » (v46, retour de PJ : « on clique, il y a un petit message mais ça disparaît ») : le dernier geste sur la fiche ouverte reste
  // affiché sous la bannière jusqu'au geste suivant, même après un aller-retour vers un autre écran (mémoire de la page ; le journal garde tout).
  let ficheCourante = null, dernierFait = null, clicCourant = null;
  const ANNULE = Symbol("annulé");
  const noterFait = (texte, lib) => { dernierFait = ficheCourante ? { cid: ficheCourante, x: texte === t("enregistre") && lib ? t("con.fait.bouton", { b: lib }) : texte, h: Date.now() } : dernierFait; };
  // Confirmation à côté du bouton cliqué (v48, 12/11/2026, retour de PJ sur « Comme Chez Fleur » : « Changer l'offre », plus bas dans la fiche, écrivait
  // son message dans #msg, tout en haut, hors de l'écran : « je crois que rien n'est enregistré »). Avant le geste, on note comment retrouver le bouton
  // (son formulaire, son id ou son attribut data-*, dans sa carte) ; après le nouveau dessin de l'écran, le message (role="status") s'affiche juste
  // sous le bouton, ou en tête de son bloc si le bouton a disparu (étape cochée...), et reste jusqu'au geste suivant. #msg est toujours écrit aussi.
  const selAttr = el => { const a = [...el.attributes].find(x => x.name.startsWith("data-") && !["data-cid", "data-l", "data-types", "data-prio"].includes(x.name));
    return a ? `[${a.name}${a.value ? `="${a.value.replace(/["\\]/g, "\\$&")}"` : ""}]` : ""; };
  const repereBouton = b => { if (!b || !b.closest) return null; const f = b.closest("form[id]");
    const soi = f && (b.type === "submit" || !b.id && !selAttr(b)) ? "#" + f.id + " [type=submit]" : b.id ? "#" + b.id : selAttr(b) + (b.dataset.cid ? `[data-cid="${b.dataset.cid}"]` : "");
    const porteur = !f && !b.id && b.closest("article, tr, li[data-point]"), pa = porteur ? selAttr(porteur) : "";
    const zone = b.closest("[id]:not(#vue)");
    return { bouton: soi ? (pa ? porteur.tagName.toLowerCase() + pa + " " : "") + soi : null, zone: zone ? "#" + zone.id : null }; };
  function msgPres(rep, x, erreur) {
    vue.querySelectorAll("[data-msg-local]").forEach(p => p.remove()); if (!rep || !x) return;
    const q = s_ => { try { return s_ ? vue.querySelector(s_) : null; } catch (er) { return null; } };
    const p = document.createElement("p"); p.className = "msg-local" + (erreur ? " erreur" : ""); p.setAttribute("role", erreur ? "alert" : "status"); p.dataset.msgLocal = ""; p.textContent = x;
    const b = q(rep.bouton), z = q(rep.zone);
    if (b) (b.closest(".actions, .mer-action, .mer-recours, .mer-ligne") || b).insertAdjacentElement("afterend", p);
    else if (z) { const h = z.querySelector(":scope > h2, :scope > h3"); h ? h.insertAdjacentElement("afterend", p) : z.prepend(p); }
    else return;
    p.scrollIntoView({ block: "nearest" }); }
  function brancherCartes(apres) {
    const agir = async (f, ok, b) => { const lib = b ? b.textContent.trim() : "", rep = repereBouton(b || clicCourant); if (b) b.disabled = true;
      try { const m = await f(); if (m === null) { if (b) b.disabled = false; return; } const x = ok != null ? ok : typeof m === "string" ? m : t("enregistre"); noterFait(x, lib); await apres(); msg(x); msgPres(rep, x); }
      catch (er) { if (b) b.disabled = false; const x = ph(er.message); msg(x); msgPres(rep, x, true); } };
    const cidDe = b => b.dataset.cid || ((b.closest("[data-mer-commerce]") || {}).dataset || {}).merCommerce;
    // Vérifier un accès, Google ou un réseau social : confirmation explicite, puis la même action complète d'où que vienne le clic (voir actionMer).
    const verifier = (b, r) => { const cid = cidDe(b), res = NOM_RESEAU[r] || r;
      if (!window.confirm(r === "google" ? t("con.verif.google.confirmer") : t("con.verif.res.confirmer", { res }))) return;
      agir(async () => { const x = await D.adminAccesReseau(cid, r, true), dep = r === "google" ? await noterAccesGoogle(cid) : null;
        return t("con.acces.ok", { res, n: x.programmes || 0 }) + (dep ? " " + dep.replace(/^[^.]*\.\s*/, "") : ""); }, null, b); };
    const copier = async (x, ok) => { try { await navigator.clipboard.writeText(x.value); msg(t(ok)); } catch (er) { x.select(); msg(t("con.selectionnee")); } };
    const sur = (sel, f) => vue.querySelectorAll(sel).forEach(b => { const ev = b.tagName === "INPUT" && b.type === "checkbox" ? "onchange" : "onclick"; b[ev] = () => { clicCourant = b; return f(b, b.closest("[data-type], article, tr, section")); }; });
    // Alertes de l'exploitant : « Traité » (admin_alerte_vue) ; prise en charge : « Je prends », « Je prends à la place », « Je laisse ».
    sur("[data-alerte-vue]", b => agir(() => D.adminAlerteVue(b.closest("article").dataset.alerte), t("con.al.traite.ok"), b));
    sur("[data-fiche-ignorer]", b => { if (!window.confirm(t("con.al.fiche.ignorer.confirmer"))) return;
      agir(async () => { const r = await D.adminIgnorerFicheGoogle(b.closest("article").dataset.alerte); return t(r && r.etat === "deja" ? "con.al.fiche.ignoree.deja" : "con.al.fiche.ignoree"); }, null, b); });
    sur("[data-prendre]", b => { if (!moi) { msg(t("con.moi.dabord")); const i = $("moi-prenom"); if (i) i.focus(); return; }
      agir(async () => { const r = await D.adminPrendre(b.closest("[data-prise]").dataset.prise, moi, b.dataset.prendre === "1"); return r && r.par ? t("con.prise.ok", { p: r.par }) : t("con.prise.laissee"); }, null, b); });
    // À publier à la main
    sur("[data-copier]", b => copier(b.closest("article").querySelector("[data-rep]"), "con.copiee"));
    sur("[data-publie]", b => agir(() => D.adminCommentairePublie(b.closest("article").dataset.id), t("con.publiee.equipe"), b));
    const pm = b => afCtx.pubs[+b.closest("article").dataset.pmI];
    sur("[data-pm-copier]", b => copier(b.closest("article").querySelector("[data-pm-legende]"), "con.pm.copiee"));
    // Carrousel TikTok (02/11/2026, admin_publications_a_publier : « chemins ») : une image après l'autre, numérotées dans l'ordre de l'envoi.
    sur("[data-pm-media]", async b => { b.disabled = true;
      try { const x = pm(b), liste = (x.chemins || []).length > 1 ? x.chemins.map((c, i) => Object.assign({}, x, { chemin: c, rang: i + 1 })) : [x];
        for (const y of liste) { const u = await D.adminLienMedia(y); if (!u) { msg(t("con.pm.sans.media")); return; }
          const a = document.createElement("a"); a.href = u; a.download = ""; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
          if (liste.length > 1) await new Promise(r => setTimeout(r, 400)); }
        msg(t("con.pm.telechargement")); }
      catch (er) { msg(ph(er.message)); } finally { b.disabled = false; } });
    sur("[data-pm-publiee]", b => { const x = pm(b); agir(async () => { const r = await D.adminPublicationPubliee(x.id, x.reseau); return t("con.pm.notee", { res: NOM_RESEAU[x.reseau] || x.reseau, h: dh(r.publie_le) }); }, null, b); });
    sur("[data-copier-gbp]", b => copier(b.closest("article").querySelector("[data-rep-gbp]"), "con.copiee"));
    sur("[data-publie-gbp]", b => agir(() => D.adminAvisMarquerPubliee(b.closest("article").dataset.avisPub), t("con.gbp.publiee"), b));
    sur("[data-son-pose]", b => agir(() => D.adminMusiquePosee(b.closest("article").dataset.pub), t("con.son.enregistre"), b));
    // Avis de la file de BoostImpact et commentaires des commerces Premium
    sur("[data-copier-avis]", b => copier(b.closest("article").querySelector("[data-rep-avis]"), "con.copiee"));
    sur("[data-avis-proposer]", b => { const a = b.closest("article"); agir(() => D.adminAvisProposer(a.dataset.avis, a.querySelector("[data-rep-avis]").value), t("con.file.proposee.msg")); });
    sur("[data-avis-liberer]", b => agir(() => D.adminLibererAvis(b.closest("article").dataset.avis), t("con.file.liberee"), b));
    sur("[data-avis-publie]", b => { const a = b.closest("article"), acc = a.querySelector("[data-accord]"); agir(() => D.adminAvisPublie(a.dataset.avis, a.querySelector("[data-rep-avis]").value, acc ? acc.checked : false), t("con.file.notee")); });
    sur("[data-cm-d]", b => { const a = b.closest("article"); agir(() => D.adminCommentaireDecider(a.dataset.cm, b.dataset.cmD, b.dataset.cmD === "valide" ? a.querySelector("[data-cm-texte]").value : null)); });
    // Garanties : dates du commerce, message de cohérence, manquements, réseaux retenus, délégation, objectif interne
    sur("[data-delais-enregistrer]", b => { const z = b.closest("[data-delais]"), p = {}; z.querySelectorAll("[data-d]").forEach(i => { p[i.dataset.d] = valeurDate(i); }); agir(() => D.adminDelais(z.dataset.delais, p)); });
    sur("[data-coh-copier]", async b => { const z = b.closest("[data-delais]"), g = afCtx.dl.find(x => x.commerce_id === z.dataset.delais) || {}, m = z.querySelector("[data-coh-message]");
      m.value = messageCoherence(g, z.querySelector("[data-coh-ecarts]").value);
      try { await navigator.clipboard.writeText(m.value); msg(t("con.coh.copie")); } catch (er) { m.select(); msg(t("con.selectionnee")); } });
    // Un geste pour tout le mois : chaque manquement de la carte reçoit la même décision (« déjà offert » : écarté, avec le motif de l'article 10).
    sur("[data-mq-d]", b => { const z = b.closest("[data-mq]"), m = z.querySelector("[data-mq-motif]"), d = b.dataset.mqD, ids = z.dataset.mq.split(",").filter(Boolean);
      agir(async () => { for (const id of ids) await D.adminManquement(id, d === "deja" ? "ecarte" : d, d === "deja" ? t("con.mq.deja.motif", {}, "fr") : m ? m.value : null);
        return d === "deja" ? t("con.mq.clos") : undefined; }, null, b); });   // undefined : « Enregistré » (null voudrait dire « annulé »)
    sur("[data-ret-enregistrer]", b => { const z = b.closest("[data-ret]"); agir(() => D.adminReseaux(z.dataset.ret, [...z.querySelectorAll("[data-ret-res]:checked")].map(i => i.value))); });
    sur("[data-delegation]", i => agir(() => D.adminDelegation(i.closest("[data-ret]").dataset.ret, i.checked)));
    sur("[data-gar-releve]", b => { const z = b.closest("[data-gar]"), v = z.querySelector("[data-releve]").value; agir(() => D.adminGarantie(z.dataset.gar, { avis_releve: v })); });
    sur("[data-gar-cartes]", b => agir(() => D.adminGarantie(b.closest("[data-gar]").dataset.gar, { cartes_en_place_le: window.RENOM_MAJ.aujourdhui() })));
    // Dépôts vidéo, mise en route, options
    sur("[data-relancer]", b => agir(() => D.adminRelancerMontage(b.closest("[data-depot]").dataset.depot), t("con.relance.ok"), b));
    // « Google vérifié » : action complète (verifier). « Metricool vérifié » ne reste que pour une offre à réseaux sans réseau social retenu.
    sur("[data-mer]", b => b.dataset.mer === "google" ? verifier(b, "google")
      : agir(async () => { await D.adminMiseEnRoute(cidDe(b), b.dataset.mer, "fait"); return t("con.mer.fait.ok", { x: t("con.mer.nom." + b.dataset.mer) }); }, null, b));
    // « Accès vérifié » (Comptes, ou « Instagram vérifié »… dans la mise en route) et « Accès retiré ».
    sur("[data-acces]", b => { const r = b.dataset.acces, res = NOM_RESEAU[r] || r; if (b.dataset.oui === "1") { verifier(b, r); return; }
      if (!window.confirm(t("con.acces.confirmer", { res }))) return;
      agir(async () => { await D.adminAccesReseau(cidDe(b), r, false); return t("con.acces.retire", { res }); }, null, b); });
    // Étape cochée par erreur : remise « à faire » (admin_mise_en_route, état « a_faire ») ; les accès de l'étape notés vérifiés sont notés retirés,
    // sinon la base (et la démonstration) la recocheraient au premier passage. La date de départ de la garantie n'est pas effacée (Garanties).
    sur("[data-mer-annuler]", b => { const cid = cidDe(b), p = b.dataset.merAnnuler, c = (afCtx.cs || []).find(x => x.id === cid) || {}, nom = t("con.mer.nom." + p);
      const lies = window.RENOM_RESEAUX_AUTORISES(c).filter(r => (p === "google" ? r === "google" : RES_SOCIAUX.includes(r)) && ((c.comptes || {})[r] || {}).etat === "connecte");
      if (!window.confirm(p === "google" ? t("con.mer.annuler.google") : lies.length ? t("con.mer.annuler.reseaux", { l: I.liste(lies.map(r => NOM_RESEAU[r])) }) : t("con.mer.annuler.simple", { x: nom }))) return;
      agir(async () => { for (const r of lies) await D.adminAccesReseau(cid, r, false); await D.adminMiseEnRoute(cid, p, "a_faire"); return t("con.mer.annule", { x: nom }); }, null, b); });
    // Étape réseaux (27/10/2026, branche nuit-emails) : l'équipe note l'envoi du lien de connexion (admin_lien_reseaux).
    sur("[data-mer-lien]", b => agir(async () => { await D.adminLienReseaux(cidDe(b), true); return t("con.mer.lien.ok"); }, null, b));
    sur("[data-opt-elements]", b => { const a = b.closest("article"); agir(async () => { const r = await D.adminCommandeOptionElements(a.dataset.opt, a.querySelector("[data-opt-date]").value); return t("con.opt.elements.ok", { d: I.dateLongue(r.livraison_prevue_le) }); }, null, b); });
    sur("[data-opt-livree]", b => { const a = b.closest("article"); agir(async () => { if (!window.confirm(t("con.opt.livree.confirmer"))) return null; const r = await D.adminCommandeOptionLivree(a.dataset.opt);
      return r.second_test_prevu_le ? t("con.opt.livree.ok.second", { d: I.dateLongue(r.second_test_prevu_le) }) : t("con.opt.livree.ok"); }, null, b); });
    sur("[data-opt-second]", b => agir(async () => { await D.adminCommandeOptionSecondTest(b.closest("article").dataset.opt); return t("con.opt.second.ok"); }, null, b));
    sur("[data-opt-rattacher]", b => { const a = b.closest("article"), s_ = a.querySelector("[data-opt-commerce]"), cid = s_ && s_.value; if (!cid) { msg(t("con.opt.choisir.dabord")); return; }
      agir(async () => { await D.adminCommandeOptionRattacher(a.dataset.opt, cid); return t("con.opt.rattacher.ok", { c: ((afCtx.cs || []).find(c => c.id === cid) || {}).nom || "" }); }, null, b); });
  }

  // ================= Clients : la liste des commerces (triée par santé), la fiche de chaque client, « Nouveau client » et le journal de tous les clients.
  async function clients() {
    const l = (await D.adminCommerces()).sort((a, b) => (RANG[(a.sante || {}).niveau] ?? 3) - (RANG[(b.sante || {}).niveau] ?? 3) || a.nom.localeCompare(b.nom));
    vue.innerHTML = `${entete(t("con.entree.clients"), t("con.commerces.chapo"))}
      <div class="actions"><a class="bouton" href="#/nouveau" id="nouveau-client">${t("con.nouveau.client")}</a><a class="bouton second" href="#/journal">${t("con.journal.tous")}</a></div>
      <section class="carte tableau" id="clients"><table class="tab"><thead><tr><th>${C_("commerce")}</th><th>${C_("sante")}</th><th>${C_("offre")}</th><th>${C_("mois")}</th><th>${C_("alertes")}</th><th>${C_("etat")}</th></tr></thead><tbody>${l.map(c => {
      const k = c.compteur || {};
      return `<tr data-id="${e(c.id)}"><td data-l="${C_("commerce")}"><p class="fort"><a href="#/client/${encodeURIComponent(c.id)}" data-client="${e(c.id)}">${e(c.nom)}</a></p><p class="note">${e(METIERS[c.metier] || "")}${c.ville ? ", " + e(c.ville) : ""}</p></td>
        <td data-l="${C_("sante")}">${sante(c.sante)}</td><td data-l="${C_("offre")}">${e(I.offre(c.offre_id))}</td>
        <td data-l="${C_("mois")}"><p>${t("con.pub.sur", { a: k.publications_utilisees, b: k.publications_plafond })}</p><p>${t("con.vid.sur", { a: k.videos_utilisees, b: k.videos_plafond })}</p></td>
        <td data-l="${C_("alertes")}"><span class="${c.alertes ? "fort" : ""}">${c.alertes}</span></td>
        <td data-l="${C_("etat")}"><span class="etat${c.en_pause ? "" : " actif"}">${t(c.en_pause ? "con.en.pause" : "con.actif")}</span></td></tr>`; }).join("")}</tbody></table></section>`;
  }
  // Fiche d'un client : état et offre, santé et mise en route, accès aux réseaux, style et photos, garanties (délais, mois offerts, réseaux retenus,
  // délégation, objectif interne), options, dépôts vidéo et journal de CE client. Mêmes actions qu'avant, aux mêmes fonctions de la base.
  // Mise en route claire (27/10/2026) : nom du commerce à confirmer (aucune demande d'avis ne part avant), fiche Google à créer ou récupérer
  // (la garantie démarre à sa vérification par Google). Rien sans le bloc SQL (colonnes absentes).
  const merClient = c => !("nom_confirme_le" in c) ? "" : `${c.nom_confirme_le ? "" : `<div class="pile serre" id="nom-a-confirmer"><p class="fort">${t("con.nom.a.confirmer")}</p>
      <div class="f"><label for="nom-console">${t("con.nom.lib")}</label><input id="nom-console" type="text" maxlength="120" value="${e(c.nom)}"></div><button type="button" class="bouton second petit" data-a="nom">${t("con.nom.confirmer")}</button></div>`}
    ${c.fiche_google_demande_le && !c.fiche_google_verifiee_le ? `<div class="pile serre" id="fiche-a-creer"><p class="fort">${t(c.fiche_google_cas === "pas_a_mon_nom" ? "con.fiche.recuperer" : "con.fiche.creer", { d: I.date(c.fiche_google_demande_le) })}</p>
      <div class="f etroit"><label for="fiche-verif">${t("con.fiche.verifiee.lib")}</label><input id="fiche-verif" type="date"></div><button type="button" class="bouton second petit" data-a="fiche-verifiee">${t("con.fiche.verifiee")}</button></div>`
    : c.fiche_google_verifiee_le ? `<p class="note">${t("con.fiche.verifiee.le", { d: I.date(c.fiche_google_verifiee_le) })}</p>` : ""}`;
  // Fiche Google de chaque commerce (28/10/2026, bloc SQL « Fiche Google du client venu du site et photos hors sujet ») : état, lien collé par le
  // client (à ouvrir pour trouver la fiche), identifiant de lieu à poser ou corriger (admin_fiche_google_lieu). Sans le bloc SQL : rien.
  const FG = window.RENOM_FICHE;
  // v49 (13/11/2026, retour de PJ : le client de « Comme Chez Fleur » a collé un lien de recherche Google, inutilisable, alors que son place_id était
  // déjà bon) : fiche reconnue (place_id valide, rien à identifier) : « Fiche identifiée : <nom> » et « Voir sur Google Maps » (lien par place_id) pour
  // vérifier d'un coup d'œil ; le lien du client est dit « pas utilisé : l'identifiant suffit » ; le champ de l'identifiant passe derrière
  // « Corriger l'identifiant ». Sans place_id : ce qu'il faut faire, champ ouvert.
  const mapsPlace = id => "https://www.google.com/maps/place/?q=place_id:" + encodeURIComponent(id);
  const ligneFiche = c => { if (!FG.sql(c)) return ""; const et = FG.etat(c), ok_ = et === "reconnue" && FG.ID.test(c.google_place_id || "");
    const lienClient = c.fiche_google_lien ? `<p class="note casse">${t("con.fg.lien")} <a href="${e(c.fiche_google_lien)}" target="_blank" rel="noopener" translate="no" id="fg-lien-client">${e(c.fiche_google_lien)}</a></p>` : "";
    const champ = `<div class="f"><label for="fg-id">${t("con.fg.id.lib")}</label><input id="fg-id" type="text" autocomplete="off" maxlength="500" value="${e(c.google_place_id || "")}" aria-describedby="fg-aide" translate="no">
        <p class="aide" id="fg-aide">${t("con.fg.aide")}${c.google_place_id && c.google_place_id_source ? " " + t("con.fg.source." + c.google_place_id_source) : ""}</p></div>
      <button type="button" class="bouton second petit" data-a="fiche-lieu">${t("con.fg.enregistrer")}</button>`;
    const reliee = "google_location_id" in c ? `<p class="note" id="fg-reliee" data-fiche-reliee="${/^locations\/[0-9]+$/.test(c.google_location_id || "") ? 1 : 0}">${/^locations\/[0-9]+$/.test(c.google_location_id || "")
        ? t("con.fg.reliee", { l: `<span class="casse" translate="no">${e(c.google_location_id)}</span>` }) : t("con.fg.non.reliee")}</p>` : "";
    return `<div class="pile serre" id="client-fiche-google"><h3>${t("con.fg.titre")}</h3>${aide("fiche", nowFiche(c))}
      ${ok_ ? `<p class="fort" data-fiche-identifiee>${t("con.fg.identifiee", { n: e(c.nom) })}</p><p><a class="bouton second petit" href="${e(mapsPlace(c.google_place_id))}" target="_blank" rel="noopener" id="fg-maps">${t("con.fg.maps")}</a></p>` : ""}
      <p class="note" data-etat-fiche="${e(et)}">${t("con.fg.etat." + et)}</p>${reliee}
      ${ok_ ? `${c.fiche_google_lien ? `<p class="note" data-lien-inutile>${t("con.fg.lien.inutile")}</p>` : ""}<details class="repliable sous" id="fg-corriger"><summary>${t("con.fg.corriger")}</summary>${lienClient}${champ}</details>`
        : `<p class="note fort" data-fiche-a-faire>${t(c.fiche_google_lien ? "con.fg.afaire.lien" : "con.fg.afaire")}</p>${lienClient || `<p class="note">${t("con.fg.aucun.lien")}</p>`}${champ}`}</div>`; };
  // 26/10/2026 : « Avis à traiter » (la file des avis de CE client, mêmes cartes et mêmes actions que dans « À faire ») ; #/client/<id>/avis y descend.
  // Votre contact (31/10/2026) : un formulaire pour tous les commerces, un pour ce commerce (prioritaire). Prénom vide : réglage retiré.
  const formContact = (id, x, titre) => `<form id="${id}" class="pile serre" novalidate><h3>${e(titre)}</h3><div class="champs deux"><div class="f"><label for="${id}-prenom">${t("con.contact.prenom")}</label><input id="${id}-prenom" type="text" maxlength="40" autocomplete="off" value="${e((x || {}).prenom || "")}"></div>
      <div class="f"><label for="${id}-tel">${t("con.contact.tel")}</label><input id="${id}-tel" type="tel" inputmode="tel" autocomplete="off" value="${e((x || {}).telephone ? window.RENOM_WHATSAPP.lisible(x.telephone) : "")}" placeholder="+33 6 12 34 56 78"></div></div>
      <div class="f"><label for="${id}-photo">${t("con.contact.photo")}</label><input id="${id}-photo" type="url" inputmode="url" maxlength="500" autocomplete="off" value="${e((x || {}).photo || "")}"><p class="aide">${t("con.contact.aide")}</p></div>
      <button class="bouton second petit" type="submit">${t("enregistrer")}</button></form>`;
  // ---------------- Aide de chaque bloc de la fiche client (11/11/2026, demande de PJ : « au moins une phrase ou deux explicatives dans chaque partie…
  // je ne sais pas si c'est moi ou le client »). Trois lignes au plus, même style que les textes d'aide : à quoi ça sert, qui le fait, ce que vous
  // faites maintenant. « Maintenant » suit l'état réel lu ici (mise en route, accès, fiche Google, dates de la garantie, lien d'avis...). Textes :
  // con.ai.* de i18n.js. Chaque phrase décrit ce que fait le code (schema.sql, workflows n8n) ; un texte vide n'est pas affiché.
  // v46 (relecture « exploitation » : trop de texte) : l'aide de chaque bloc tient en UNE ligne repliable ; la prochaine action de la fiche est dans la
  // bannière du haut ; les explications longues sont dans le Mode d'emploi.
  const aide = (cle, now, o = {}) => { const tx = k => o[k] !== undefined ? o[k] : I.a("con.ai." + cle + "." + k) ? t("con.ai." + cle + "." + k) : "";
    const l = [["sert", tx("sert")], ["qui", tx("qui")], ["now", now || ""]].filter(([, x]) => x);
    return l.length ? `<details class="aide-bloc" data-aide="${cle}"><summary>${t("con.ai.lib")}</summary>${l.map(([k, x]) => `<p class="note"${k === "now" ? " data-aide-now" : ""}><span class="aide-lib">${t("con.ai." + k)}</span> ${x}</p>`).join("")}</details>` : ""; };
  const H24 = 24 * 3600000;
  const nowEtat = c => t(c.en_pause ? "con.ai.etat.pause" : c.metier === "autre" ? "con.ai.etat.autre" : "con.ai.etat.defaut");
  const nowSante = s_ => !s_ ? "" : t("con.ai.sante." + (["vert", "orange", "rouge"].includes(s_.niveau) ? s_.niveau : "orange"));
  const nowComptes = c => { const off = window.RENOM_RESEAUX_AUTORISES(c).filter(r => ((c.comptes || {})[r] || {}).etat !== "connecte");
    return off.length ? t("con.ai.comptes.off", { l: off.map(r => NOM_RESEAU[r] || e(r)).join(", ") }) : t("con.ai.comptes.on"); };
  const nowFiche = c => { const et = FG.etat(c), reliee = /^locations\/[0-9]+$/.test(c.google_location_id || "");
    return t("con.ai.fiche." + (et === "reconnue" ? (reliee || !("google_location_id" in c) ? "reliee" : "reconnue") : et)); };
  const nowStyle = c => { const m = c.marque; return +c.demandes_style ? t("con.ai.style.demande") : !(m && m.verrouille) ? t("con.ai.style.valider") : t(c.photos_autorisees_le ? "con.ai.style.ok" : "con.ai.style.sans.photos"); };
  const nowDelais = (g, o) => { if (!g) return t("con.ai.delais.aucun");
    if (!g.depart) { const l = [!g.acces_remis_le ? t("con.ai.delais.manque.acces") : "", o.reseaux_sociaux !== false && !g.photos_recues_le ? t("con.ai.delais.manque.photos") : ""].filter(Boolean);
      return l.length ? t("con.ai.delais.attente", { l: I.liste(l) }) : t("con.ai.delais.ok"); }
    return g.fiche && !g.fiche.fait_le && g.fiche.echeance ? t("con.ai.delais.fiche", { d: dh(g.fiche.echeance) }) : t("con.ai.delais.ok"); };
  const nowRet = (c, o) => !o.reseaux_sociaux ? t("con.ai.ret.google") : t("con.ai.ret.now") + (o.delegation && !c.delegation_signee_le ? " " + t("con.ai.ret.accord") : "");
  const nowVideos = l => !l.length ? t("con.ai.videos.aucun") : l.some(d => relancable(d) || d.statut === "refuse") ? t("con.ai.videos.bloque") : t("con.ai.videos.ok");
  const nowLien = c => t(String(c.lien_avis || "").trim() ? "con.ai.lien.ok" : /^[A-Za-z0-9_-]+$/.test(c.google_place_id || "") ? "con.ai.lien.place" : "con.ai.lien.aucun");
  const nowContact = x => { const k = x && x.commerce && x.commerce.prenom ? x.commerce : x && x.global && x.global.prenom ? x.global : null, W = window.RENOM_WHATSAPP;
    return t("con.ai.contact.voit", { p: k ? e(k.prenom) + (k.telephone ? ", " + e(W ? W.lisible(k.telephone) : k.telephone) : "") : "PJ, +33 6 99 08 05 39" }); };
  // Métier (11/11/2026, fonction SQL admin_metier) : un client venu du paiement en ligne est créé en « Autre commerce ». Sans la fonction (adaptateur
  // sans adminMetier), le choix n'est pas montré.
  const choixMetier = c => !D.adminMetier ? "" : `<div class="etat-col" id="metier-zone"><label for="metier-client">${t("con.metier.lib")}</label><select id="metier-client">${Object.entries(METIERS).map(([k2, x]) => `<option value="${k2}"${c.metier === k2 ? " selected" : ""}>${e(x)}</option>`).join("")}</select><button type="button" class="bouton second petit" data-a="metier">${t("con.metier.enregistrer")}</button></div>`;
  // Numéro WhatsApp du client (v47) : lisible, avec la date de l'accord ; sinon « WhatsApp manquant ».
  // v48 (12/11/2026, demande de PJ : « je veux pouvoir saisir moi-même le numéro quand je l'ai ») : présenté comme Offre, Pays et Métier : libellé,
  // champ prérempli, case d'accord de l'équipe dessous (obligatoire, jamais précochée : l'accord est celui du client, recueilli par l'équipe), bouton
  // « Enregistrer le WhatsApp » (admin_regler_whatsapp : mêmes règles que la case du client, journal WHATSAPP_SAISI_PAR_EQUIPE). « Effacer le
  // numéro » : discret, avec confirmation. Sans adminReglerWhatsapp (adaptateur ancien) : l'affichage de la v47 seul.
  // v50 (13/11/2026, retour du gérant : la case décochée faisait croire que l'accord manquait) : numéro déjà enregistré avec accord, « Numéro
  // enregistré · Accord donné le … » et la case cachée ; elle n'apparaît (obligatoire) que si le champ désigne un autre numéro (waChange). Même numéro :
  // « Enregistrer » n'appelle pas la base et dit « déjà enregistré ».
  const blocWhatsapp = c => { const W = window.RENOM_WHATSAPP, lis = n => W ? W.lisible(n) : n, actif = waActif(c), ex = W ? W.exemple(c.pays) : "+33 6 12 34 56 78";
    const ouvrir = actif ? `<a class="casse" href="https://wa.me/${e(String(c.whatsapp_numero).replace(/^\+/, ""))}" target="_blank" rel="noopener" translate="no">${t("con.wa.ouvrir")}</a>` : "";
    const etat = actif ? `<p class="note">${ouvrir} · ${t("con.wa.accord", { d: I.date(c.whatsapp_accord_le) })}</p>` : `<p class="fort" data-wa-manquant>${t("con.wa.manquant")}</p>`;
    if (!D.adminReglerWhatsapp) return `<div class="etat-col" id="client-wa" data-wa="${actif ? "actif" : "manquant"}"><p class="note">${t("con.wa.lib")}</p>${actif ? `<p class="casse fort" translate="no">${e(lis(c.whatsapp_numero))}</p>` : ""}${etat}</div>`;
    return `<div class="etat-col" id="client-wa" data-wa="${actif ? "actif" : "manquant"}"><label for="wa-client-num">${t("con.wa.lib")}</label>
      <input id="wa-client-num" type="tel" inputmode="tel" autocomplete="off" maxlength="30" value="${e(c.whatsapp_numero ? lis(c.whatsapp_numero) : "")}" placeholder="${e(ex)}" aria-describedby="wa-client-aide" translate="no">
      <p class="aide" id="wa-client-aide">${t("con.wa.aide", { ex: e(ex) })}</p>${actif ? `<p class="fort" data-wa-enregistre>${t("con.wa.enregistre", { d: I.date(c.whatsapp_accord_le) })}</p><p class="note">${ouvrir.replace('class="casse"', 'class="casse lien-wa"')}</p>` : etat}
      <label class="option" id="wa-accord-zone"${actif ? " hidden" : ""}><input type="checkbox" id="wa-client-accord"><span>${t("con.wa.accord.equipe")}</span></label>
      <button type="button" class="bouton second petit" data-a="whatsapp">${t("con.wa.enregistrer")}</button>${actif ? `<button type="button" class="lien recours" data-a="wa-effacer">${t("con.wa.effacer")}</button>` : ""}</div>`; };
  // ---------------- Prochaine action (v46, 11/11/2026 ; relecture « exploitation » : « aucune prochaine action unique ») : UNE phrase tout en haut de la
  // fiche, le responsable d'abord (VOUS, CLIENT, ROBOT), au plus un bouton. Les règles de l'équipe passent dans l'ordre de PRIORITE ci-dessous (la
  // première qui s'applique gagne). Sinon, ce qu'on attend du client ou du robot, avec la date avant laquelle il n'y a rien à faire : pour le client, sa
  // date d'appel, création + J_APPEL jours (même seuil que la carte « Mise en route » de À faire et que l'alerte MISE_EN_ROUTE_BLOQUEE), ou lien
  // Metricool + 72 h (il expire à 71 h) ; pour le robot des fiches Google, accès déclaré + 24 h. Date passée : la tâche du client devient « appelez-le ».
  const J_APPEL = 5, H72 = 72 * 3600000;
  function prochaineAction(c, g, jl, avis = []) {
    const m = c.sante && c.sante.mise_en_route, pts = Object.fromEntries(((m && m.points) || []).map(x => [x.point, x])), o = OFFRES[c.offre_id] || {};
    const maintenant = Date.now(), appel = c.cree_le ? Date.parse(c.cree_le) + J_APPEL * 864e5 : maintenant, gg = pts.google, rr = pts.metricool;
    const aller = (id, cle) => `<button type="button" class="bouton second petit" data-aller="${e(id)}">${t("con.pa.b." + cle)}</button>`;
    const attentes = [];
    if (pts.compte && pts.compte.etat !== "fait") attentes.push({ qui: "client", k: "compte", d: appel });
    if (gg && gg.etat === "declare") attentes.push({ qui: "robot", k: "google", d: (gg.maj ? Date.parse(gg.maj) : maintenant) + H24 });
    else if (gg && gg.etat === "a_faire") attentes.push({ qui: "client", k: "google", d: appel });
    if (rr && rr.etat === "a_faire" && rr.lien_envoye_le) attentes.push({ qui: "client", k: "reseaux", d: Date.parse(rr.lien_envoye_le) + H72, v: { d: I.date(rr.lien_envoye_le) } });
    if (pts.demarrage && pts.demarrage.etat !== "fait") attentes.push({ qui: "client", k: "questions", d: appel, v: { n: nbReponses5(c) } });   // les 5 questions (la 6e, réseaux, est facultative)
    if (!c.demarrage_fini && !waActif(c)) attentes.push({ qui: "client", k: "whatsapp", d: appel });   // numéro obligatoire, demandé à la fin du démarrage
    if (!(g && g.photos_recues_le)) attentes.push({ qui: "client", k: "photos", d: appel });
    const PRIORITE = [
      // Avis à traiter par l'équipe (garantie des 24 h) : avant tout le reste, sinon la bannière dirait « Rien à faire » avec un avis sensible ouvert.
      ["avis", () => avis.length > 0 && { texte: t(avis.some(a => a.sensible || a.retenue_le) ? "con.pa.avis.sensible" : "con.pa.avis", { n: avis.length, d: dh(avis.map(a => a.echeance).filter(Boolean).sort()[0] || Date.now()) }), bouton: aller("client-avis", "avis") }],
      ["pause", () => c.en_pause && { texte: t("con.pa.pause"), bouton: aller("client-etat", "etat") }],
      ["fiche", () => "nom_confirme_le" in c && !c.nom_confirme_le && { texte: t("con.pa.fiche"), bouton: aller("nom-console", "fiche") }],
      ["metier", () => metierAVerifier(c, jl) && { texte: t("con.pa.metier"), bouton: aller("metier-client", "fiche") }],
      // Démarré sans numéro WhatsApp (ancien client, ou accord retiré dans Notifications) : à demander au client (11/11/2026).
      ["whatsapp", () => !c.en_pause && c.demarrage_fini && !waActif(c) && { texte: t("con.pa.wa"), bouton: aller("wa-client-num", "wa") }],
      // Accès Google (v48) : tant que la fiche n'est pas arrivée, CLIENT ou ROBOT (attentes ci-dessus) ; VOUS seulement si le robot ne peut pas faire
      // son travail (muet depuis plus de 2 h, alerte « Fiche Google à relier » de ce client, invitation annoncée sans identifiant ni lien de fiche),
      // ou, passé le délai, pour appeler le client (google_24h, appeler).
      ["google_robot", () => gg && gg.etat !== "fait" && robotGoogle().muet && { texte: t("con.pa.google.muet", { h: dh(robotGoogle().ms) }), bouton: aller("mer-google-auto", "mer") }],
      ["google_alerte", () => gg && gg.etat !== "fait" && alertesGoogle(c).propres.length > 0 && { texte: t("con.pa.google.alerte"), bouton: aller("fg-id", "fg") }],
      ["google_sans_id", () => gg && gg.etat === "declare" && sansIdGoogle(c) && { texte: t("con.pa.google.sans.id"), bouton: aller("fg-id", "fg") }],
      ["google_24h", () => gg && gg.etat === "declare" && gg.maj && maintenant - Date.parse(gg.maj) > H24 && { texte: t("con.pa.google.vieux", { d: dh(gg.maj) }), bouton: "" }],
      ["reseaux_declares", () => rr && rr.etat === "declare" && { texte: t("con.pa.reseaux.declare"), bouton: aller("mer-etapes", "mer") }],
      ["lien_metricool", () => rr && rr.etat === "a_faire" && "lien_envoye_le" in rr && !rr.lien_envoye_le && { texte: t("con.pa.lien"), bouton: `<button type="button" class="bouton second petit" data-mer-lien data-cid="${e(c.id)}">${t("con.mer.lien.bouton")}</button>` }],
      ["blogid", () => o.reseaux_sociaux && !c.metricool_blog_id && { texte: t("con.pa.blog"), bouton: aller("mc-" + c.id, "blog") }],
      ["appeler", () => { const l = attentes.filter(a => a.qui === "client" && maintenant >= a.d);
        return l.length > 0 && { texte: t("con.pa.appeler", { l: I.liste(l.map(a => t("con.pa.a." + a.k, a.v))), d: I.date(Math.min(...l.map(a => a.d))) }), bouton: "" }; }],
      ["style", () => (+c.demandes_style > 0 || !(c.marque && c.marque.verrouille)) && { texte: t(+c.demandes_style > 0 ? "con.pa.style.demande" : "con.pa.style"),
        bouton: `<a class="bouton second petit" href="${I.lien("console.html")}#/style/${encodeURIComponent(c.id)}" data-style="${e(c.id)}">${t("con.pa.b.style")}</a>` }],
      ["fiche_optimisee", () => g && g.fiche && !g.fiche.fait_le && g.fiche.echeance && { texte: t("con.pa.optimiser", { d: dh(g.fiche.echeance) }), bouton: aller("client-garanties", "garanties") }],
    ];
    for (const [regle, f] of PRIORITE) { const r = f(); if (r) return { qui: "vous", regle, ...r }; }
    if (attentes.length) { attentes.sort((a, b) => a.d - b.d); const qui = attentes[0].qui, l = attentes.filter(a => a.qui === qui);
      return { qui, regle: "attente", texte: t(qui === "robot" ? "con.pa.robot" : "con.pa.attente", { d: qui === "robot" ? dh(l[0].d) : I.date(l[0].d), l: I.liste(l.map(a => t("con.pa.c." + a.k, a.v))) }), bouton: "" }; }
    return { qui: "robot", regle: "fini", texte: t("con.pa.fini"), bouton: "" };
  }
  const banniere = (c, pa) => `<section class="carte prochaine" id="prochaine-action" data-qui="${pa.qui}" data-regle="${pa.regle}"><h2 class="prochaine-lib">${t("con.pa.titre")}</h2>
      <p class="prochaine-phrase"><span class="pastille" data-pastille>${t("con.pa.qui." + pa.qui)}</span> ${pa.texte}</p>${pa.bouton ? `<div class="actions">${pa.bouton}</div>` : ""}
      ${dernierFait && dernierFait.cid === c.id ? `<p class="note fait-recent" id="fait-recent">${t("con.fait.ligne", { h: I.heure(dernierFait.h), x: e(dernierFait.x) })}</p>` : ""}</section>`;
  // ---------------- Dernières actions sur ce client (v46, retour de PJ : « quand on revient, on n'a pas le récapitulatif ») : les 5 dernières lignes du
  // journal de CE client (lu à part, adminJournalClient), lisibles : quoi, quand, qui (console, robot ou client, quand le détail ou le type le dit),
  // puis le journal complet replié. Chaque geste de la fiche redessine la fiche : sa ligne apparaît en tête.
  const QUI_PAR = { administrateur: "console", console: "console", equipe: "console", automatique: "robot", recherche: "robot", renomia: "robot", commercant: "client", client: "client", espace: "client" };
  const TYPES_CONSOLE = ["MISE_EN_ROUTE", "MISE_EN_ROUTE_LIEN_RESEAUX", "MISE_EN_PAUSE", "REPRISE", "PAYS_COMMERCE", "METIER_COMMERCE", "RESEAUX_RETENUS", "METRICOOL_MARQUE_NOTEE"];
  const quiJournal = x => { const p = ((x.detail && typeof x.detail === "object" ? x.detail : {}).par || "").toLowerCase();
    if (x.type === "COMMERCE_CREE") return (x.detail || {}).origine === "paiement_en_ligne" ? "robot" : "console";   // paiement en ligne : créé par le robot (client_en_ligne)
    return QUI_PAR[p] || (TYPES_CONSOLE.includes(x.type) ? "console" : x.type === "MISE_EN_ROUTE_DECLAREE" ? "client" : ""); };
  const resumeJournal = x => { const d = x.detail && typeof x.detail === "object" ? x.detail : {}, pt = d.point && I.a("con.mer.nom." + d.point) ? t("con.mer.nom." + d.point) : e(d.point || "");
    if (x.type === "MISE_EN_ROUTE") return t("con.hist.mer", { p: pt, e: I.a("con.hist.etat." + d.etat) ? t("con.hist.etat." + d.etat) : e(d.etat || "") });
    const plus = x.type === "MISE_EN_ROUTE_DECLAREE" ? pt : /^ACCES_RESEAU_/.test(x.type) ? NOM_RESEAU[d.reseau] || e(d.reseau || "") : x.type === "PAYS_COMMERCE" ? (I.a("con.pays." + d.pays) ? t("con.pays." + d.pays) : e(d.pays || ""))
      : x.type === "METIER_COMMERCE" ? METIERS[d.apres] || e(d.apres || "") : x.type === "OFFRE_CHANGEE" && d.offre ? e(I.offre(d.offre)) : x.type === "METRICOOL_MARQUE_NOTEE" ? e(d.blog_id || t("con.hist.retire")) : "";
    return e(libelleEtape(x.type)) + (plus ? t("deux.points") + plus : ""); };
  // v48 (12/11/2026, demande de PJ) : « Voir tout l'historique » déplie TOUTES les lignes du journal de ce client (lu par client, 500 au plus), même
  // forme que les 5 dernières : libellé lisible, date, par qui. Le journal complet (tableau filtrable, détail brut) reste replié dessous.
  const ligneHist = x => { const q = quiJournal(x);
    return `<li data-type="${e(x.type)}"><p class="fort">${resumeJournal(x)}</p><p class="note">${dh(x.cree_le)}${q ? ` · <span data-qui="${q}">${t("con.hist.qui." + q)}</span>` : ""}</p></li>`; };
  const blocHistorique = l => `<section class="carte" id="historique-client"><h2>${t("con.hist.titre")}</h2>
      ${l.length ? `<ol class="historique" id="historique-liste">${l.slice(0, 5).map(ligneHist).join("")}</ol>${l.length > 5 ? `<button type="button" class="lien" id="historique-voir-tout" aria-expanded="false" aria-controls="historique-tout">${t("con.hist.voir.tout", { n: l.length })}</button>
      <ol class="historique" id="historique-tout" hidden>${l.slice(5).map(ligneHist).join("")}</ol>` : ""}` : `<p class="note" id="historique-vide">${t("con.hist.vide")}</p>`}
      <details class="repliable sous" id="journal-client"><summary><h3>${t("con.hist.tout", { n: l.length })}</h3></summary>${tableJournal("jc")}</details></section>`;
  async function client(cid, ancre) {
    const sur = p => p.catch(() => null);
    // Journal de CE client lu à part (v46) : adminJournal s'arrête aux 300 lignes les plus récentes de tous les clients.
    const [cs, dl, gs, opts, depots, jl, fileAvis, , contacts] = await Promise.all([D.adminCommerces(), sur(D.adminGarantieDelais()), sur(D.adminGaranties()), D.adminCommandesOptions ? sur(D.adminCommandesOptions()) : [], sur(D.adminDepotsVideo()), sur(D.adminJournalClient ? D.adminJournalClient(cid) : D.adminJournal()), sur(D.adminFileAvis()), lirePrises(), D.adminContact ? sur(D.adminContact(cid)) : null]);
    const c = cs.find(x => x.id === cid); if (!c) { location.hash = "#/clients"; return; }
    ficheCourante = cid;
    // v48 : dernier passage du robot des fiches Google et alertes de ce client (étape « Accès à la fiche Google », bannière). Lus seulement tant que
    // l'étape n'est pas faite ; illisibles (bloc SQL du 12/11/2026 pas collé) : undefined, la fiche dit « pas encore noté ».
    const gPt = ((c.sante && c.sante.mise_en_route && c.sante.mise_en_route.points) || []).find(x => x.point === "google");
    if (gPt && gPt.etat !== "fait") { const [pr, al] = await Promise.all([D.adminPassagesRobots ? sur(D.adminPassagesRobots()) : null, D.adminAlertesClient ? sur(D.adminAlertesClient(cid)) : null]);
      robotsFiche = { passage: pr ? pr.liens_google || null : undefined, alertes: al || [] }; }
    else robotsFiche = { passage: undefined, alertes: [] };
    // v49 : photos du client pour le dossier de démarrage (x sur 5 utilisables) ; illisibles : null, la ligne dit « nombre inconnu ».
    const phs = D.adminPhotosClient ? await sur(D.adminPhotosClient(cid)) : null;
    const g = (dl || []).find(x => x.commerce_id === cid), gar = (gs || []).find(x => x.commerce_id === cid), o = OFFRES[c.offre_id] || {}, ret = Array.isArray(c.reseaux_retenus) ? c.reseaux_retenus : RESEAUX_RET;
    const k = c.compteur || {}, mq = g ? [...groupesManquements(g), ...(g.manquements || []).filter(m => m.statut !== "a_appliquer").map(m => ({ ...m, commerce: g.commerce }))] : [], mesOpts = (opts || []).filter(x => x.commerce_id === cid), mesDepots = (depots || []).filter(d => d.commerce_id === cid);
    const journalClient = (jl || []).filter(x => x.commerce_id === cid), mesAvis = (fileAvis || []).filter(a => a.commerce_id === cid).sort((a, b) => (b.retenue_le ? 1 : 0) - (a.retenue_le ? 1 : 0) || (b.sensible ? 1 : 0) - (a.sensible ? 1 : 0) || String(a.recu_le).localeCompare(String(b.recu_le)));
    afCtx = { pubs: [], dl: dl || [], cs };
    vue.innerHTML = `<div class="entete"><p class="sur">${t("con.entree.clients")}</p><h1>${e(c.nom)}</h1><p class="chapo">${e(METIERS[c.metier] || "")}${c.ville ? ", " + e(c.ville) : ""} · ${e(I.offre(c.offre_id))}</p></div>
      <p class="retour-liste"><a href="#/clients">${t("con.sty.retour")}</a><br><a class="lien-guide" href="#/guide" data-lien-guide>${t("con.guide.lien")}</a></p><p class="msg" id="msg" role="status"></p>
      ${banniere(c, prochaineAction(c, g, journalClient, mesAvis))}${blocDossier(c, phs, contacts)}${blocHistorique(journalClient)}
      <section class="carte" id="client-etat" data-client-id="${e(c.id)}"><h2>${t("con.client.etat")}</h2>${aide("etat", nowEtat(c))}
        <div class="etat-offre" id="etat-offre"><div class="etat-col" id="etat-zone"><p class="note">${C_("etat")}</p><span class="etat${c.en_pause ? "" : " actif"}">${t(c.en_pause ? "con.en.pause" : "con.actif")}</span><button type="button" class="bouton second petit" data-a="pause">${t(c.en_pause ? "con.reprendre" : "con.pause")}</button></div>
        <div class="etat-col" id="offre-zone"><label for="offre-client">${C_("offre")}</label><select id="offre-client" data-offre aria-label="${t("con.offre.de", { nom: e(c.nom) })}">${Object.entries(OFFRES).filter(([k2, x]) => !x.retiree || c.offre_id === k2).map(([k2, x]) => `<option value="${k2}"${c.offre_id === k2 ? " selected" : ""}>${e(I.offre(k2))}${x.retiree ? " " + t("con.offre.retiree") : ""}</option>`).join("")}</select><button type="button" class="bouton second petit" data-a="offre">${t("con.changer.offre")}</button></div>
        <div class="etat-col" id="pays-zone"><label for="pays-client">${t("con.pays.lib")}</label><select id="pays-client">${["FR", "BE"].map(k2 => `<option value="${k2}"${(c.pays || "FR") === k2 ? " selected" : ""}>${t("con.pays." + k2)}</option>`).join("")}</select><p class="note">${t("con.pays.note")}</p><button type="button" class="bouton second petit" data-a="pays">${t("con.pays.enregistrer")}</button></div>${choixMetier(c)}${blocWhatsapp(c)}</div>
        <p>${t("con.pub.sur", { a: k.publications_utilisees, b: k.publications_plafond })} · ${t("con.vid.sur", { a: k.videos_utilisees, b: k.videos_plafond })}</p>${merClient(c)}</section>
      <section class="carte" id="client-sante" data-mer-commerce="${e(c.id)}"><h2>${C_("sante")}</h2>${aide("sante", nowSante(c.sante))}${sante(c.sante)}<h3>${C_("mer")}</h3>${aide("mer", "")}${merFiche(c)}</section>
      ${mesAvis.length ? `<section class="carte" id="client-avis"><h2>${t("con.client.avis")}, ${mesAvis.length}</h2>${aide("avis", t("con.ai.avis.now"))}</section><div class="pile" id="client-avis-file">${mesAvis.map(a => avecPrise(carteAvisFile(a, { surClient: true }), "avis:" + a.id)).join("")}</div>` : ""}
      <section class="carte" id="client-comptes" data-id="${e(c.id)}"><h2>${C_("comptes")}</h2>${aide("comptes", nowComptes(c))}<p>${t("con.connectes", { n: Object.values(c.comptes || {}).filter(x => x.etat === "connecte").length })}</p>${ligneAcces(c)}${ligneMarque(c)}${ligneFiche(c)}</section>
      <section class="carte" id="client-style"><h2>${t("con.client.style")}</h2>${aide("style", nowStyle(c))}${ligneStyle(c)}</section>
      <section class="carte" id="client-garanties"><h2>${t("con.entree.garanties")}</h2>${aide("gar", "")}
        <h3>${t("con.delais.titre")}</h3>${aide("delais", nowDelais(g, o))}${g ? `<div data-delais="${e(cid)}"><dl class="liste-delais">${[["delais.depart", g.depart ? `<p>${dh(g.depart)}</p>` : `<p class="note">${t("con.delais.pas.demarre")}</p>`], ["delais.fiche", delai(g.fiche) + coherenceEtat(g.fiche)], ["delais.contenu", delai(g.premier_contenu)],
            ["delais.avis", `<p class="fort">${(g.avis_en_cours || []).length}</p>`]].map(([lib, v]) => `<div><dt class="note">${C_(lib)}</dt><dd>${v}</dd></div>`).join("")}</dl>${saisieDelais(g)}</div>`
          : `<form id="f-delais-client" class="pile serre"><div class="f etroit"><label for="dl-acces">${t("con.delais.acces.lib")}</label><input id="dl-acces" type="datetime-local" required></div><p class="note">${t(o.reseaux_sociaux === false ? "con.delais.regle.google" : "con.delais.regle")}</p><button class="bouton second petit" type="submit">${t("con.delais.demarrer.bouton")}</button></form>`}
        ${mq.length ? `<h3>${t("con.mq.titre")}</h3>${aide("mq", t("con.ai.mq.now"))}<div class="pile" id="manquements">${mq.map(carteManquement).join("")}</div>` : ""}
        <h3>${t("con.ret.titre")}</h3>${aide("ret", nowRet(c, o))}<div class="pile serre" data-ret="${e(cid)}">${o.reseaux_sociaux ? `<div class="pile serre">${RESEAUX_RET.map(r => `<label class="option"><input type="checkbox" value="${r}" data-ret-res${ret.includes(r) ? " checked" : ""}><span>${NOM_RES[r]}</span></label>`).join("")}<button type="button" class="bouton second petit" data-ret-enregistrer>${t("enregistrer")}</button></div>` : `<p class="note">${t("con.ret.google.seul")}</p>`}
          ${o.delegation ? `<label class="option"><input type="checkbox" data-delegation${c.delegation_signee_le ? " checked" : ""}><span>${t(c.delegation_signee_le ? "con.ret.delegation.le" : "con.ret.delegation.non", { d: c.delegation_signee_le ? I.date(jourDe(c.delegation_signee_le)) : "" })}</span></label>` : `<p class="note">${t("con.ret.delegation.sans")}</p>`}</div>
        <h3>${t("con.gar.titre")}</h3><p class="note">${t("con.obj.chapo")}</p>${aide("obj", t(gar ? "con.ai.obj.suivi" : "con.ai.obj.aucun"))}${gar ? `<div class="pile serre" data-gar="${e(cid)}"><p>${t("con.gar.avis", { n: gar.avis_actuel })} · ${t("con.gar.gagnes", { n: gar.gagnes, o: gar.objectif })} · <span class="etat${gar.etat === "atteinte" ? " actif" : ""}">${ETAT_OBJ[gar.etat] || e(gar.etat)}</span></p>
            <p class="note">${t("con.gar.jour", { n: gar.jour })} · ${I.date(gar.echeance)}${gar.prolongation_jours ? " · " + t("con.gar.prolongee", { n: gar.prolongation_jours }) : ""}${gar.cartes_en_place_le ? " · " + t("con.gar.cartes", { d: I.date(gar.cartes_en_place_le) }) : ""}</p>
            ${!gar.en_vue && gar.etat === "en_cours" && gar.jour >= COND_O.rappel_jour ? `<p class="note fort">${t("con.gar.pas.en.vue", { s: gar.seuil_en_vue })}</p>` : ""}
            <div class="f etroit"><label for="rel-${e(cid)}">${t("con.gar.releve.lib")}</label><input id="rel-${e(cid)}" type="number" min="0" inputmode="numeric" data-releve></div>
            <button type="button" class="bouton second petit" data-gar-releve>${t("con.gar.enregistrer")}</button>${!gar.cartes_en_place_le ? `<button type="button" class="bouton second petit" data-gar-cartes>${t("con.gar.cartes.ok")}</button>` : ""}</div>`
          : `<form id="f-gar-client" class="pile serre"><div class="champs deux"><div class="f"><label for="gar-date">${t("con.gar.date")}</label><input id="gar-date" type="date" required></div><div class="f"><label for="gar-avis">${t("con.gar.avis.capture")}</label><input id="gar-avis" type="number" min="0" inputmode="numeric" required></div></div>
            <div class="f etroit"><label for="gar-cartes">${t("con.gar.cartes.lib")}</label><input id="gar-cartes" type="date"></div><p class="note">${t("con.gar.regle")}</p><button class="bouton second petit" type="submit">${t("con.gar.demarrer.bouton")}</button></form>`}</section>
      ${mesOpts.length ? `<section class="carte" id="client-options"><h2>${t("con.opt.titre")}</h2>${aide("opt", t("con.ai.opt.now"))}</section><div class="pile">${mesOpts.map(x => carteOption(x, cs)).join("")}</div>` : ""}
      ${!mesDepots.length && +k.videos_plafond > 0 ? `<section class="carte" id="client-videos"><h2>${t("con.entree.videos")}</h2>${aide("videos", nowVideos(mesDepots))}<p class="texte2">${t("con.aucun.depot")}</p><p class="note">${t("con.videos.client", { b: k.videos_plafond })}</p></section>` : ""}
      ${mesDepots.length ? `<section class="carte tableau" id="client-videos"><h2>${t("con.entree.videos")}</h2>${aide("videos", nowVideos(mesDepots))}<p class="texte2">${t("con.videos.client", { b: k.videos_plafond || 0 })}</p><table class="tab"><thead><tr><th>${C_("depot")}</th><th>${C_("fichiers")}</th><th>${C_("statut")}</th><th>${C_("actions")}</th></tr></thead><tbody>${mesDepots.map(d =>
        `<tr data-depot="${e(d.id)}"><td data-l="${C_("depot")}"><p>${dh(d.cree_le)}</p>${d.note ? `<p class="note casse" translate="no">${e(d.note)}</p>` : ""}</td>
          <td data-l="${C_("fichiers")}">${d.nb_videos ? t("dv.depot.contenu", { v: d.nb_videos, p: (d.nb_fichiers || 0) - d.nb_videos, d: "" }) + secDv(d.duree_totale_s) : ""}${d.rushes_effaces_le ? `<p class="note">${t("dv.efface.le", { d: I.date(d.rushes_effaces_le) })}</p>` : ""}</td>
          <td data-l="${C_("statut")}"><p class="fort">${ST_DV[d.statut] || e(d.statut)}</p>${d.motif ? `<p class="note">${e(ph(d.motif))}</p>` : ""}${d.essais ? `<p class="note">${t("con.essais", { n: d.essais })}</p>` : ""}</td>
          <td data-l="${C_("actions")}">${actionsDepot(d) ? `<div class="pile serre">${actionsDepot(d)}</div>` : ""}</td></tr>`).join("")}</tbody></table></section>` : ""}
      <section class="carte" id="client-reglages-espace"><h2>${t("con.lien.avis")}</h2>${aide("lien", nowLien(c))}<form id="f-lien-avis" class="pile serre" novalidate><div class="f"><label for="lien-avis-client">${t("con.lien.avis")}</label>
          <input id="lien-avis-client" type="url" inputmode="url" maxlength="500" autocomplete="off" value="${e(c.lien_avis || "")}" placeholder="https://g.page/r/…/review"><p class="aide">${t("con.lien.avis.aide")}</p></div>
          <button class="bouton second petit" type="submit">${t("enregistrer")}</button></form>
        <h2>${t("con.langues.titre")}</h2>${aide("langue", t("con.ai.langue.now"))}<form id="f-langues-client" class="pile serre"><div class="f"><label for="langues-client">${t("con.langues.titre")}</label>
          <select id="langues-client">${[["fr", "fiche.langues.fr"], ["nl", "fiche.langues.nl"], ["fr,nl", "fiche.langues.frnl"]].map(([v, k]) => `<option value="${v}"${(Array.isArray(c.langues_publication) && c.langues_publication.length ? ["fr", "nl"].filter(x => c.langues_publication.includes(x)).join(",") : c.langue === "nl" ? "nl" : "fr") === v ? " selected" : ""}>${t(k)}</option>`).join("")}</select></div>
          <button class="bouton second petit" type="submit">${t("enregistrer")}</button></form>
        <h2>${t("con.contact.titre")}</h2><p class="note">${t("con.contact.chapo")}</p>${aide("contact", nowContact(contacts))}${formContact("contact-tous", (contacts || {}).global, t("con.contact.titre"))}${formContact("contact-client", (contacts || {}).commerce, t("con.contact.client"))}</section>`;
    remplirJournal("jc", journalClient);
    // Chaque geste de la fiche : la fonction de la base, puis la fiche redessinée (sa ligne apparaît dans « Dernières actions »), le message, et
    // « Fait à … » qui reste sous la bannière (noterFait).
    // v48 : le message s'affiche aussi à côté du bouton (msgPres). f() rend ANNULE : geste annulé (confirmation refusée), rien n'est redessiné.
    const faire = async (b, f, ok) => { const lib = b ? b.textContent.trim() : "", rep = repereBouton(b); if (b) b.disabled = true;
      try { const r = await f(); if (r === ANNULE) { if (b) b.disabled = false; return; } const x = typeof ok === "function" ? ok(r) : ok || t("enregistre"); noterFait(x, lib); await client(cid); msg(x); msgPres(rep, x); }
      catch (er) { if (b) b.disabled = false; const x = ph(er.message); msg(x); msgPres(rep, x, true); } };
    const envoi = (id, f, ok) => { const fo = $(id); if (fo) fo.onsubmit = ev => { ev.preventDefault(); faire(ev.submitter || fo.querySelector("[type=submit]"), f, ok); }; };
    envoi("f-langues-client", () => D.adminReglerLanguesPublication(cid, $("langues-client").value.split(",")));
    envoi("f-lien-avis", () => D.adminLienAvis(cid, $("lien-avis-client").value));
    [["contact-tous", null], ["contact-client", cid]].forEach(([id, pour]) => envoi(id, () => D.adminReglerContact(pour, { prenom: $(id + "-prenom").value, telephone: $(id + "-tel").value, photo: $(id + "-photo").value })));
    const zc = $("client-etat"), clic = (z, sel, f, ok) => { const b = z && z.querySelector(sel); if (b) b.onclick = () => faire(b, f, ok); };
    clic(zc, "[data-a=pause]", () => D.adminPause(cid, !c.en_pause));
    clic(zc, "[data-a=nom]", () => D.adminConfirmerNom(cid, $("nom-console").value));
    clic(zc, "[data-a=fiche-verifiee]", () => D.adminFicheGoogleVerifiee(cid, $("fiche-verif").value));
    // Changement d'offre (27/10/2026) : la base arrête ce qui est hors de la nouvelle offre et ajoute la tâche « Mettre Stripe à jour » si besoin.
    // Pays du commerce (31/10/2026) : jours fériés de France ou de Belgique pour la programmation et l'idée de la semaine (fonction SQL admin_pays).
    clic(zc, "[data-a=pays]", () => D.adminPays(cid, $("pays-client").value));
    clic(zc, "[data-a=metier]", () => D.adminMetier(cid, $("metier-client").value), t("con.metier.ok"));
    // v48 : même offre qu'avant : rien n'est appelé, et le message le dit (admin_changer_offre ne change rien et ne dit rien). Après un vrai changement,
    // la tâche « Mettre Stripe à jour » (STRIPE_A_METTRE_A_JOUR, créée par admin_changer_offre seulement si le commerce a un abonnement Stripe en
    // cours d'une autre offre) est relue : le message dit si elle est dans À faire ; Stripe n'est jamais mis à jour par la console.
    clic(zc, "[data-a=offre]", async () => { const v = $("offre-client").value; if (v === c.offre_id) return { meme: true, v };
      await D.adminOffre(cid, v); const al = D.adminAlertesClient ? await D.adminAlertesClient(cid).catch(() => null) : null;
      return { v, stripe: al ? al.some(a => a.type === "STRIPE_A_METTRE_A_JOUR") : null }; },
      r => r.meme ? t("con.offre.meme", { o: I.offre(r.v) }) : t(r.stripe ? "con.offre.changee.stripe" : r.stripe === false ? "con.offre.changee.sans" : "con.offre.changee", { o: I.offre(r.v) }));
    // WhatsApp saisi par l'équipe (v48) : la case d'accord d'abord, puis le numéro (mêmes règles que le client, phrases de la base).
    // v50 : numéro enregistré avec accord, la case n'apparaît que si le champ change de numéro ; même numéro : rien n'est appelé.
    const waChange = () => { const W = window.RENOM_WHATSAPP, v = ($("wa-client-num") || {}).value || ""; return !waActif(c) || (W ? W.numero(v, c.pays || "FR") : v.trim()) !== c.whatsapp_numero; };
    if ($("wa-client-num") && $("wa-accord-zone")) $("wa-client-num").oninput = () => { const z = $("wa-accord-zone"), ch = waChange(); z.hidden = !ch; if (!ch) $("wa-client-accord").checked = false; };
    clic(zc, "[data-a=whatsapp]", async () => { const n = $("wa-client-num").value.trim(), ok_ = $("wa-client-accord").checked;
      if (!n) throw new Error(t("con.wa.vide")); if (!waChange()) return { etat: "deja", numero: c.whatsapp_numero }; if (!ok_) throw new Error(t("con.wa.accord.requis"));
      return D.adminReglerWhatsapp(cid, n, true); }, r => t(r && r.etat === "deja" ? "con.wa.ok.deja" : "con.wa.ok", { n: window.RENOM_WHATSAPP ? window.RENOM_WHATSAPP.lisible(r && r.numero) : (r && r.numero) }));
    clic(zc, "[data-a=wa-effacer]", async () => { if (!window.confirm(t("con.wa.effacer.confirmer"))) return ANNULE; return D.adminReglerWhatsapp(cid, null, false); }, t("con.wa.ok.efface"));
    clic(vue, "[data-a=fiche-lieu]", () => D.adminFicheGoogleLieu(cid, $("fg-id").value), t("con.fg.ok"));
    clic(vue, "#ph-autoriser-ok-fiche", async () => { if (!$("ph-accord-fiche").checked) throw new Error(t("con.ph.accord.requis")); return D.adminAutoriserPhotos(cid, true); },
      r => t(r && r.etat === "deja" ? "con.ph.autorisee.deja" : "con.ph.autorisee.ok"));
    clic(vue, "[data-mc-enregistrer]", () => D.adminMetricoolMarque(cid, vue.querySelector("[data-mc]").value), t("con.mc.ok"));
    envoi("f-delais-client", () => D.adminDelais(cid, { acces_remis_le: valeurDate($("dl-acces")) }));
    envoi("f-gar-client", () => D.adminGarantie(cid, { depart_le: $("gar-date").value, avis_depart: $("gar-avis").value, cartes_en_place_le: $("gar-cartes").value || null }));
    // Réponses du démarrage remplies par l'équipe (v49) : « Remplir pour le client », « Modifier » (ouvre le formulaire sur la bonne question),
    // « Enregistrer les réponses » (seulement les champs changés ; aucun : « rien à changer », sans appel à la base).
    const ouvrirReponses = k => { const d = $("mer-reponses"), f = $("f-reponses"); if (!d || !f) return; d.open = true; f.hidden = false;
      const z = k ? f.querySelector(`[data-f-q="${k}"]`) : null, champ = z ? z.querySelector("textarea, select, input") : f.querySelector("textarea");
      (z || f).scrollIntoView({ block: "center" }); if (champ) champ.focus({ preventScroll: true }); };
    vue.querySelectorAll("[data-rep-remplir]").forEach(b => b.onclick = () => ouvrirReponses(null));
    vue.querySelectorAll("[data-rep-modifier]").forEach(b => b.onclick = () => ouvrirReponses(b.dataset.repModifier));
    if ($("rq-fermer")) $("rq-fermer").onclick = () => { $("f-reponses").hidden = true; };
    envoi("f-reponses", async () => { const ch = lireReponses(c); if (!Object.keys(ch).length) return { etat: "rien" }; return D.adminReponsesDemarrage(cid, ch); },
      r => r && r.etat === "rien" ? t("con.rep.ok.rien") : t(r && r.fini && !c.demarrage_fini ? "con.rep.ok.fini" : "con.rep.ok", { n: nbReponses({ demarrage: r && r.demarrage }), t: NB_Q }));
    // Dossier de démarrage (v49) : « Copier le message au client » ; trame de l'appel de démarrage, ouverte et fermée sur place.
    const dc = vue.querySelector("[data-dossier-copier]"); if (dc) dc.onclick = async () => { const m = $("dossier-message"), rep = repereBouton(dc);
      try { await navigator.clipboard.writeText(m.value); msg(t("con.dos.copie")); msgPres(rep, t("con.dos.copie")); } catch (er) { m.select(); msg(t("con.selectionnee")); msgPres(rep, t("con.selectionnee")); } };
    const trame = (ouvrir) => { const z = $("trame-appel"), b = $("trame-ouvrir"); if (!z) return; z.hidden = !ouvrir; b.setAttribute("aria-expanded", String(ouvrir)); if (ouvrir) z.scrollIntoView({ block: "start" }); else b.focus(); };
    if ($("trame-ouvrir")) $("trame-ouvrir").onclick = () => trame($("trame-appel").hidden);
    if ($("trame-fermer")) $("trame-fermer").onclick = () => trame(false);
    // « Voir les 5 réponses » (v48) : ouvre le volet des réponses et y descend. « Voir tout l'historique » : affiche ou masque le reste du journal.
    vue.querySelectorAll("[data-voir-reponses]").forEach(b => b.onclick = () => { const d = $("mer-reponses"); if (!d) return; d.open = true; d.scrollIntoView({ block: "start" }); });
    const vt = $("historique-voir-tout"); if (vt) vt.onclick = () => { const o = $("historique-tout"), ouvrir = o.hidden; o.hidden = !ouvrir; vt.setAttribute("aria-expanded", String(ouvrir));
      vt.textContent = ouvrir ? t("con.hist.masquer") : t("con.hist.voir.tout", { n: journalClient.length }); };
    // Bouton de la bannière qui mène au bon champ (« Vérifier la fiche », « Noter le blogId »…) : défilement et focus, sans changer d'adresse.
    vue.querySelectorAll("[data-aller]").forEach(b => b.onclick = () => { const z = $(b.dataset.aller); if (!z) return;
      const d = z.closest("details"); if (d) d.open = true; z.scrollIntoView({ block: "center" }); if (z.matches("input, select, textarea, button")) z.focus({ preventScroll: true }); });
    brancherCartes(() => client(cid));
    if (ancre === "avis") { const z = $("client-avis"); if (z) z.scrollIntoView({ block: "start" }); }
  }
  // Journal : libellé lisible (etape.* de i18n.js, les mêmes que l'historique de l'espace), le code en petit dessous pour le filtre et le support ;
  // détail : « clé : valeur » au lieu du JSON brut (24/10/2026). Le même tableau sert au journal de tous les clients et à celui d'un client.
  const libelleEtape = ty => I.a("etape." + ty) ? t("etape." + ty) : String(ty || "").charAt(0) + String(ty || "").slice(1).toLowerCase().replace(/_/g, " ");
  const valeurJournal = (k, v) => v === true ? t("con.journal.oui") : v === false ? t("con.journal.non") : v && typeof v === "object" ? JSON.stringify(v) : k === "raison" ? ph(String(v)) : String(v);
  const detailJournal = d => d && typeof d === "object" && !Array.isArray(d) ? Object.entries(d).map(([k, v]) => `${k}${t("deux.points")}${valeurJournal(k, v)}`).join(" · ") : (d == null ? "" : JSON.stringify(d));
  const tableJournal = id => `<div class="f etroit"><label for="filtre-${id}">${t("con.filtrer")}</label><input id="filtre-${id}" type="text"></div>
      <table class="tab"><thead><tr><th>${C_("date")}</th><th>${C_("commerce")}</th><th>${C_("etape")}</th><th>${C_("detail")}</th></tr></thead><tbody id="corps-${id}"></tbody></table>`;
  function remplirJournal(id, l) {
    const dessiner = () => { const f = $("filtre-" + id).value.toLowerCase(); $("corps-" + id).innerHTML = l.filter(x => !f || (x.commerce + " " + x.type + " " + libelleEtape(x.type)).toLowerCase().includes(f)).map(x => `<tr><td data-l="${C_("date")}">${dh(x.cree_le)}</td><td data-l="${C_("commerce")}">${e(x.commerce || "")}</td><td data-l="${C_("etape")}"><span class="fort">${e(libelleEtape(x.type))}</span><br><span class="note" translate="no">${e(x.type)}</span></td><td data-l="${C_("detail")}" class="note casse" translate="no">${e(detailJournal(x.detail))}</td></tr>`).join(""); };
    $("filtre-" + id).oninput = dessiner; dessiner();
  }
  async function journal() {
    const l = await D.adminJournal();
    vue.innerHTML = `${entete(t("con.journal.titre"), t("con.journal.chapo"))}<p class="retour-liste"><a href="#/clients">${t("con.sty.retour")}</a></p><section class="carte tableau" id="journal">${tableJournal("tous")}</section>`;
    remplirJournal("tous", l);
  }
  // Nouveau client : créer le commerce et inviter son propriétaire, puis le suivi des invitations (anciens onglets Créer et Invitations).
  // 26/10/2026 (constat 35) : ville, lien de la fiche Google et langue des emails (fonction SQL admin_creer_client ; sans elle, admin_creer_commerce et
  // un message le dit). #/nouveau/<prospect> : formulaire prérempli depuis un prospect (nom, ville, email, métier, langue, fiche par son identifiant de
  // lieu) ; l'offre est choisie par l'équipe, rien n'est créé sans « Créer et inviter ». Le score de l'audit n'est pas gardé par la base.
  // Villes belges connues (communes les plus peuplées et chefs-lieux), comparées sans accents ni casse ; sert seulement à l'alerte du pays.
  const VILLES_BE = ["bruxelles", "brussel", "anvers", "antwerpen", "gand", "gent", "charleroi", "liege", "luik", "bruges", "brugge", "namur", "namen", "louvain", "leuven", "mons", "bergen",
    "malines", "mechelen", "alost", "aalst", "la louviere", "hasselt", "courtrai", "kortrijk", "ostende", "oostende", "tournai", "doornik", "genk", "seraing", "roulers", "roeselare", "verviers",
    "mouscron", "moeskroen", "wavre", "waver", "arlon", "aarlen", "nivelles", "ixelles", "elsene", "uccle", "ukkel", "schaerbeek", "schaarbeek", "anderlecht", "molenbeek", "etterbeek", "waterloo",
    "ottignies", "louvain-la-neuve", "dinant", "spa", "huy", "bastogne", "marche-en-famenne", "ath", "binche", "soignies", "braine-l'alleud", "knokke", "knokke-heist", "ypres", "ieper", "turnhout", "sint-niklaas", "lier", "dendermonde", "vilvoorde", "zaventem"];
  const sansAccent = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const villeBelge = v => VILLES_BE.includes(sansAccent(v).replace(/\s+/g, " "));
  const lienFicheDe = p => /^[A-Za-z0-9_-]+$/.test(p.place_id || "") ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(p.commerce || "") + "&query_place_id=" + p.place_id : "";
  async function nouveau(pid) {
    const [l, ps] = await Promise.all([D.adminInvitations(), pid ? D.adminProspects().catch(() => []) : []]), pr = pid ? ps.find(x => x.id === pid) : null;
    const v = pr ? { nom: pr.commerce || "", ville: pr.ville || "", email: pr.email || "", metier: pr.metier || "", langue: ["fr", "en", "nl"].includes(pr.langue) ? pr.langue : "fr", fiche: lienFicheDe(pr) } : { langue: "fr" };
    const sel = (a, b) => a === b ? " selected" : "";
    vue.innerHTML = `${entete(t("con.nouveau.client"), t("con.creer.titre"))}<p class="retour-liste"><a href="#/${pr ? "prospects" : "clients"}">${t(pr ? "con.retour.prospects" : "con.sty.retour")}</a></p>
      <section class="carte formulaire" id="creer">${pr ? `<p class="note fort" id="depuis-prospect">${t("con.nv.depuis", { p: e(pr.commerce || pr.email || "") })}</p><p class="note">${t("con.nv.score")}</p>` : ""}<form id="f"><div class="f"><label for="nom">${t("fiche.nom")}</label><input id="nom" type="text" required value="${e(v.nom || "")}"></div>
      <div class="champs deux"><div class="f"><label for="metier">${t("fiche.metier")}</label><select id="metier">${Object.entries(METIERS).map(([k, x]) => `<option value="${k}"${sel(k, v.metier)}>${x}</option>`).join("")}</select></div>
      <div class="f"><label for="offre">${C_("offre")}</label><select id="offre">${Object.entries(OFFRES).filter(([k, o]) => !o.retiree).map(([k, o]) => `<option value="${k}">${e(I.offre(k))}</option>`).join("")}</select></div></div>
      <div class="champs deux"><div class="f"><label for="ville">${t("con.nv.ville")}</label><input id="ville" type="text" maxlength="120" autocomplete="off" value="${e(v.ville || "")}"></div>
      <div class="f"><label for="langue">${t("con.nv.langue")}</label><select id="langue">${["fr", "en", "nl"].map(k => `<option value="${k}"${sel(k, v.langue)}>${t("con.nv.langue." + k)}</option>`).join("")}</select></div></div>
      <div class="f etroit"><label for="pays">${t("con.nv.pays")}</label><select id="pays" required><option value="">${t("con.nv.pays.choisir")}</option>${["FR", "BE"].map(k => `<option value="${k}"${sel(k, v.pays)}>${t("con.nv.pays." + k)}</option>`).join("")}</select><p class="aide fort" id="pays-alerte" role="status" hidden></p></div>
      <div class="f"><label for="fiche">${t("con.nv.fiche")}</label><input id="fiche" type="url" inputmode="url" maxlength="500" autocomplete="off" placeholder="https://maps.google.com/…" value="${e(v.fiche || "")}"><p class="aide">${t("con.nv.fiche.aide")}</p></div>
      <div class="f"><label for="email">${t("con.email.proprio")}</label><input id="email" type="email" required value="${e(v.email || "")}"></div><button class="bouton" type="submit">${t("con.creer.inviter")}</button><p class="msg" id="msg" role="status"></p></form></section>
      <section class="carte tableau" id="invitations"><h2>${t("con.entree.invitations")}</h2><p class="texte2">${t("con.invitations.chapo")}</p>${l.length ? `<table class="tab"><thead><tr><th>${C_("date")}</th><th>${C_("commerce")}</th><th>${C_("email")}</th><th>${C_("etat")}</th></tr></thead><tbody>${l.map(i => `<tr><td data-l="${C_("date")}">${dh(i.cree_le)}</td><td data-l="${C_("commerce")}">${e(i.commerce || "")}</td><td data-l="${C_("email")}" class="casse">${e(i.email)}</td><td data-l="${C_("etat")}">${INVITATION[i.statut] ? `<span class="fort" data-statut="${e(i.statut)}">${INVITATION[i.statut]}</span>` : e(i.statut)}</td></tr>`).join("")}</tbody></table>` : `<p class="texte2">${t("con.aucune.invitation")}</p>`}</section>`;
    // Pays (31/10/2026, test client Essentiel, tour 5) : obligatoire ; une ville belge connue avec « France » choisi est signalée (pas bloquée).
    const alertePays = () => { const vi = $("ville").value, z = $("pays-alerte"), be = villeBelge(vi) && $("pays").value === "FR"; z.hidden = !be; z.textContent = be ? t("con.nv.pays.alerte", { v: vi.trim() }) : ""; };
    $("ville").oninput = alertePays; $("pays").onchange = alertePays;
    $("f").onsubmit = async ev => { ev.preventDefault(); const b = ev.submitter || $("f").querySelector("button[type=submit]"); b.disabled = true;
      const p = { nom: $("nom").value, metier: $("metier").value, offre: $("offre").value, email: $("email").value, ville: $("ville").value, langue: $("langue").value, fiche: $("fiche").value.trim(), pays: $("pays").value };
      if (pr) p.prospect = pr.id;
      try { const r = D.adminCreerClient ? await D.adminCreerClient(p) : await D.adminCreer(p.nom, p.metier, p.offre, p.email);
        if (pr) history.replaceState(null, "", "#/nouveau"); await nouveau(); msg(t(r && r.partiel ? "con.nv.partiel" : "con.cree")); }
      catch (er) { b.disabled = false; msg(ph(er.message)); } };
  }
  // ---------------- Style du commerce : le kit de marque est créé et réglé par BoostImpact ici (même écran et mêmes règles que « Votre style », marque.js).
  // Proposition automatique depuis le logo, sinon depuis les photos ; « Enregistrer » ou « Enregistrer et valider pour le client » (fonction SQL admin_regler_marque).
  const MQ = window.RENOM_MARQUE, ecransStyle = {};
  async function style(cid) {
    if (!cid) { location.hash = "#/clients"; return; }
    // Une lecture du commerce et de son kit par affichage complet ; relue après chaque enregistrement et à chaque ouverture du panneau.
    const x = ecransStyle[cid] || (ecransStyle[cid] = (() => {
      let lu = null; const lire = async () => lu || (lu = await D.adminMarque(cid));
      const ecran = MQ.ecran({ vue, I, mode: "renom",
        entete: c => `<div class="entete"><p class="sur">${t("con.sty.titre")}</p><h1>${e(c.nom)}</h1><p class="chapo">${t("con.sty.chapo")}</p></div><p class="retour-liste"><a href="#/client/${encodeURIComponent(cid)}">${t("con.client.retour")}</a></p>`,
        commerce: async () => (await lire()).commerce, marque: lire,
        deposerLogo: f => D.adminDeposerLogo(cid, f), enregistrer: async (k, v) => { const m = await D.adminEnregistrerMarque(cid, k, v); lu = null; return m; } });
      return { ...ecran, oublier() { lu = null; ecran.oublier(); } };
    })());
    x.oublier(); await x.rendre();
  }
  // ================= Cockpit (29/10/2026, demande de PJ) : premier écran de la console. En quelques secondes : chaque client est-il bien servi,
  // dans les délais garantis, sans rien oublier ? Calculs : cockpit.js (RENOM_COCKPIT.calculer), sur les lectures de la base (aucune écriture ici,
  // sauf « Je prends », la même fonction admin_prendre que la file). Ordre de lecture : la phrase d'état, les indicateurs (le retard d'abord), les
  // garanties en danger, les contrôles techniques, le pipeline, la file de travail par client, la provenance.
  const CK = window.RENOM_COCKPIT;
  const duree = x => { const m = Math.max(1, Math.round(Math.abs(x) / 60000)); return m < 60 ? t("con.ck.min", { n: m }) : m < 48 * 60 ? t("con.ck.h", { n: Math.round(m / 60) }) : t("con.ck.j", { n: Math.round(m / 1440) }); };
  const nomMois = iso => { const [a, m] = String(iso).split("-").map(Number); return I.mois()[m - 1] + " " + a; };
  const euros = x => t("con.ck.euros", { x: I.nombre(x, x % 1 ? 2 : 0) });
  const lienClient = (cid, texte) => cid ? `<a href="#/client/${encodeURIComponent(cid)}">${e(texte)}</a>` : e(texte);
  // Glyphes d'état des contrôles (traits seuls, aucune couleur d'accent ; le rouge seulement pour « À régler »).
  const GLYPHE = { ok: '<path d="M5 12.5l4.5 4.5L19 7.5"></path>', alerte: '<path d="M12 6v8"></path><path d="M12 18h.01"></path>', a_verifier: '<circle cx="12" cy="12" r="7.5"></circle><path d="M12 9v4"></path><path d="M12 15.8h.01"></path>', inconnu: '<path d="M7 12h10"></path>' };
  const glyphe = k => `<svg class="ck-glyphe" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${GLYPHE[k] || GLYPHE.inconnu}</svg>`;

  function verdictTexte(r) { const v = r.verdict;
    if (r.niveau === "rouge") { const parts = [v.retard ? t("con.ck.v.retard", { n: v.retard }) : "", v.depasses ? t("con.ck.v.depasses", { n: v.depasses }) : "",
        v.a_appliquer ? t("con.ck.v.appliquer", { n: v.a_appliquer }) : "", v.systeme ? t("con.ck.v.systeme", { n: v.systeme }) : ""].filter(Boolean);
      const s = I.liste(parts); return s.charAt(0).toUpperCase() + s.slice(1) + "."; }
    if (r.niveau === "or") return v.risques ? t("con.ck.v.risques", { n: v.risques }) : v.attente_longue ? t("con.ck.v.attente", { n: v.attente_longue }) : t("con.ck.v.verifier", { n: r.controles.filter(c => c.etat === "a_verifier").length });
    return t(r.niveau === "vide" ? "con.ck.v.vide" : "con.ck.v.calme"); }

  const kpi = (k, lien, val, det, o = {}) => `<a class="kpi${o.alerte ? " kpi-alerte" : ""}${o.vide ? " kpi-vide" : ""}" href="${lien}" data-kpi="${k}"><span class="kpi-lib">${t("con.ck.k." + k)}${o.sous ? `<span class="kpi-sous">${o.sous}</span>` : ""}</span><span class="kpi-val">${val}</span><span class="kpi-det">${det}</span></a>`;
  function blocKpi(r) { const k = r.kpi, per = t("con.ck.per." + r.periode);
    return `<section class="kpis" id="kpis" aria-label="${t("con.ck.kpis")}">
      ${kpi("retard", "#/afaire", I.nombre(k.retard.n), k.retard.n ? (k.retard.garanties ? t("con.ck.k.retard.gar", { n: k.retard.garanties }) : t("con.ck.k.retard.det")) : k.retard.total ? t("con.ck.k.retard.aucun", { n: k.retard.total }) : t("con.ck.k.retard.vide"), { alerte: k.retard.n > 0 })}
      ${kpi("clients", "#/clients", k.clients.n ? I.nombre(k.clients.n) : t("con.ck.aucun"), k.clients.n ? [k.clients.mise_en_route ? t("con.ck.k.clients.mer", { n: k.clients.mise_en_route }) : t("con.ck.k.clients.servis"), k.clients.pause ? t("con.ck.k.clients.pause", { n: k.clients.pause }) : ""].filter(Boolean).join(", ") : t("con.ck.k.clients.vide"), { vide: !k.clients.n })}
      ${kpi("mrr", "#/clients", k.mrr.n ? euros(k.mrr.total) : t("con.ck.pas.encore"), k.mrr.n ? t("con.ck.k.mrr.det", { n: k.mrr.n }) + (k.mrr.estime ? " " + t("con.ck.k.mrr.estime") : "") + (k.mrr.impayes ? " " + t("con.ck.k.mrr.impayes", { n: k.mrr.impayes }) : "") + (k.mrr.remplaces ? " " + t("con.ck.k.mrr.remplaces", { n: k.mrr.remplaces }) : "") : t("con.ck.k.mrr.vide"), { vide: !k.mrr.n, alerte: k.mrr.impayes > 0 })}
      ${kpi("audits", "#/prospects", k.audits.n ? I.nombre(k.audits.n) : t("con.ck.aucun"), k.audits.n ? (k.audits.a_envoyer ? t("con.ck.k.audits.envoyer", { n: k.audits.a_envoyer }) : t("con.ck.k.audits.envoyes")) : t("con.ck.k.audits.vide"), { vide: !k.audits.n })}
      ${kpi("avis", "#/afaire/avis", k.avis.n ? I.nombre(k.avis.n) : t("con.ck.aucun"), (k.avis.n ? t("con.ck.k.avis.det", { a: k.avis.dans24, b: k.avis.n }) : t("con.ck.k.avis.vide")) + ", " + per, { vide: !k.avis.n })}
    </section>`; }

  const ENG = { fiche: "con.ck.g.fiche", premier_contenu: "con.ck.g.contenu", avis: "con.ck.g.avis" };
  function blocGaranties(r) { const g = r.garanties, now = r.maintenant;
    const barre = d => { const total = d.echeance - (d.debut || d.echeance), fait = total > 0 ? Math.min(1, Math.max(0, (now - d.debut) / total)) : 1;
      return `<div class="ck-barre" role="img" aria-label="${t("con.ck.g.ecoule", { p: Math.round(fait * 100) })}"><span style="width:${Math.round(fait * 1000) / 10}%"></span></div>`; };
    const ligne = d => `<li class="ck-g ck-${d.etat}${d.pause ? " ck-pause" : ""}" data-garantie="${e(d.engagement)}" data-etat="${d.etat}" data-client="${e(d.cid)}">
        <div class="ck-g-tete"><p class="fort">${lienClient(d.cid, d.nom)}</p><p class="ck-g-etat">${d.etat === "depasse" ? t("con.ck.g.depasse", { d: duree(now - d.echeance) }) : t("con.ck.g.reste", { d: duree(d.echeance - now) })}</p></div>
        <p class="ck-g-eng">${t(ENG[d.engagement], { n: d.note })}<span class="note">${t("con.ck.g.echeance", { d: dh(d.echeance) })}</span></p>${barre(d)}
        <p class="note">${d.pause ? t("con.ck.g.pause") : t(d.etat === "depasse" ? "con.ck.g.mois.depasse" : "con.ck.g.mois.risque", { m: nomMois(d.mois_offert) })}</p></li>`;
    const vide = !g.danger.length ? `<p class="texte2 ck-vide" id="garanties-vide">${g.suivis ? t("con.ck.g.calme", { n: g.suivis }) : t("con.ck.g.aucune")}</p>` : "";
    const appl = g.a_appliquer.length ? `<h3>${t("con.ck.g.appliquer.titre")}</h3><ul class="ck-liste" id="mois-a-appliquer">${g.a_appliquer.map(m => `<li class="ck-g ${m.deja ? "ck-attente" : "ck-depasse"}" data-mois="${e(m.mois_offert)}"${m.deja ? " data-deja" : ""}>
        <p class="fort">${lienClient(m.cid, m.nom)}</p><p>${t(m.deja ? "con.ck.g.appliquer.deja" : "con.ck.g.appliquer", { m: nomMois(m.mois_offert) })}</p>
        <p class="note">${t("con.ck.g.appliquer.det", { l: I.liste(m.engagements.map(k => C_({ fiche_7j: "delais.fiche", premier_contenu_72h: "delais.contenu", avis_24h: "delais.avis" }[k]).toLowerCase())) })} ${m.deja ? "" : t(m.rythme === "annuel" ? "con.ck.g.appliquer.annuel" : "con.ck.g.appliquer.mensuel")}</p>
        <p><a href="#/afaire/garanties">${t("con.ck.g.appliquer.ouvrir")}</a></p></li>`).join("")}</ul>` : "";
    const att = g.attente.length ? `<h3>${t("con.ck.g.attente.titre")}</h3><ul class="ck-liste" id="delais-attente">${g.attente.map(a => `<li class="ck-g ck-attente${a.long ? " ck-long" : ""}" data-client="${e(a.cid)}">
        <div class="ck-g-tete"><p class="fort">${lienClient(a.cid, a.nom)}</p>${a.jours != null ? `<p class="ck-g-etat">${t("con.ck.g.attente.depuis", { n: a.jours })}</p>` : ""}</div>
        <p class="note">${I.liste(a.raisons.map(x => t("con.ck.g.raison." + x)))}${a.long ? ". " + t("con.ck.g.attente.long") : "."}</p></li>`).join("")}</ul>` : "";
    return `<section class="carte ck-bloc" id="garanties"><h2>${t("con.ck.g.titre")}</h2><p class="note ck-chapo">${t("con.ck.g.chapo")}</p>
      ${g.danger.length ? `<ul class="ck-liste" id="garanties-danger">${g.danger.map(ligne).join("")}</ul>` : vide}${appl}${att}</section>`; }

  const ligneControle = (c, x) => { const qui = x.nom ? lienClient(x.cid, x.nom) : "", q = x.quand ? dh(x.quand) : "";
    const k = I.a("con.ck.c.i." + c.k + "." + x.cle) ? "con.ck.c.i." + c.k + "." + x.cle : "con.ck.c.i." + c.k + ".defaut";
    return `<li>${t(k, { qui, d: q, texte: x.texte ? `<span class="casse" translate="no">${e(String(x.texte).slice(0, 160))}</span>` : "" })}</li>`; };
  // Vidéo IA (11/11/2026) : seulement ce que la base sait (dernière ligne PRODUIT du journal, cockpit.js) ; la clé et le solde ne se lisent pas d'ici.
  const ligneVideoIa = c => { const x = c.details[0] || {}, qui = x.nom ? " · " + lienClient(x.cid, x.nom) : "", d = x.quand ? dh(x.quand) : "";
    const motif = x.motif ? (I.a("con.ck.c.ia.motif." + x.motif) ? t("con.ck.c.ia.motif." + x.motif) : t("con.ck.c.ia.motif.defaut", { x: `<span translate="no">${e(x.motif)}</span>` })) : "";
    const k = x.cle === "faite" ? "faite" : x.cle === "plan_b" ? (c.etat === "ok" ? "normal" : c.etat === "alerte" ? "grave" : "planb") : x.cle === "desactivee" ? "coupee" : x.cle === "illisible" ? "illisible" : x.cle === "jamais" ? "jamais" : "planb";
    return `<p class="note" data-video-ia="${e(x.cle || "")}">${t("con.ck.c.ia." + k, { d, qui, motif, m: x.modele ? ` (<span translate="no">${e(x.modele)}</span>)` : "" })}</p><p class="note">${t("con.ck.c.ia.fixe")}</p>`; };
  function blocControles(r) {
    return `<section class="carte ck-bloc" id="controles"><h2>${t("con.ck.c.titre")}</h2><p class="note ck-chapo">${t("con.ck.c.chapo")}</p>
      <ul class="ck-controles">${r.controles.map(c => `<li class="ck-c ck-c-${c.etat}" data-controle="${c.k}" data-etat="${c.etat}">${glyphe(c.etat)}<div>
        <p class="ck-c-tete"><span class="fort">${t("con.ck.c." + c.k)}</span><span class="ck-c-etat">${t("con.ck.etat." + c.etat)}</span></p>
        ${c.k === "video_ia" ? ligneVideoIa(c) : c.etat === "ok" ? `<p class="note">${t("con.ck.c.ok." + c.k)}</p>` : c.k === "donnees" ? `<p class="note">${t("con.ck.c.i.donnees", { l: e(c.details.map(d => d.texte).join(", ")) })}</p>`
          : `<ul class="ck-c-det">${c.details.slice(0, 5).map(x => ligneControle(c, x)).join("")}${c.details.length > 5 ? `<li class="note">${t("con.ck.c.plus", { n: c.details.length - 5 })}</li>` : ""}</ul>${I.a("con.ck.c.pourquoi." + c.k) ? `<p class="note">${t("con.ck.c.pourquoi." + c.k)}</p>` : ""}`}
      </div></li>`).join("")}</ul></section>`; }

  function blocPipeline(r) { const total = r.pipeline.reduce((s, x) => s + x.n, 0);
    const det = x => x.k === "relance" && r.rdv ? t("con.ck.p.rdv", { n: r.rdv }) : x.k === "actif" && r.pauses ? t("con.ck.p.pause", { n: r.pauses }) : x.k === "perdu" ? t("con.ck.per." + r.periode) : "";
    return `<section class="carte ck-bloc" id="pipeline"><h2>${t("con.ck.p.titre")}</h2><p class="note ck-chapo">${t("con.ck.p.chapo")}</p>
      <ol class="ck-etapes">${r.pipeline.map(x => `<li class="ck-etape${x.n ? "" : " ck-zero"}${x.k === "perdu" ? " ck-perdu" : ""}" data-etape="${x.k}" data-n="${x.n}"><span class="ck-etape-n">${I.nombre(x.n)}</span><span class="ck-etape-lib">${t("con.ck.p." + x.k)}</span>${det(x) ? `<span class="note">${det(x)}</span>` : ""}${x.noms.filter(Boolean).length ? `<span class="note ck-noms">${e(x.noms.filter(Boolean).join(", "))}${x.n > x.noms.length ? "…" : ""}</span>` : ""}</li>`).join("")}</ol>
      ${total ? "" : `<p class="texte2 ck-vide">${t("con.ck.p.vide")}</p>`}</section>`; }

  function blocFile(r) {
    const qui = g => !g.cle || !prises ? "" : blocPrise(g.cle);
    return `<section class="carte ck-bloc" id="file-travail"><h2>${t("con.ck.f.titre")}</h2><p class="note ck-chapo">${t("con.ck.f.chapo")}</p>${zoneMoi()}
      ${r.file.length ? `<table class="tab ck-tab"><thead><tr><th>${C_("commerce")}</th><th>${t("con.ck.f.taches")}</th><th>${t("con.ck.f.retard")}</th><th>${t("con.ck.f.prochaine")}</th>${prises ? `<th>${t("con.ck.f.qui")}</th>` : ""}</tr></thead><tbody>
        ${r.file.map(g => `<tr data-file-client="${e(g.cid || "")}"><td data-l="${C_("commerce")}"><p class="fort">${g.cid ? lienClient(g.cid, g.nom || t("con.non.nomme")) : `<a href="#/afaire">${t("con.ck.f.sans.client")}</a>`}</p>${g.prises ? `<p class="note">${t("con.ck.f.cartes.prises", { n: g.prises })}</p>` : ""}</td>
          <td data-l="${t("con.ck.f.taches")}">${I.nombre(g.n)}</td><td data-l="${t("con.ck.f.retard")}"${g.retard ? ' class="ck-rouge fort"' : ""}>${I.nombre(g.retard)}</td>
          <td data-l="${t("con.ck.f.prochaine")}">${g.prochaine !== Infinity ? dh(g.prochaine) : `<span class="note">${t("con.ck.f.sans.echeance")}</span>`}</td>${prises ? `<td data-l="${t("con.ck.f.qui")}">${qui(g)}</td>` : ""}</tr>`).join("")}</tbody></table>
        <p><a class="bouton second petit" href="#/afaire">${t("con.ck.f.ouvrir")}</a></p>` : `<p class="texte2 ck-vide">${t("con.ck.f.vide")}</p>`}</section>`; }

  function blocProvenance(r) { const p = r.provenance, ligne = (k, n, max) => `<li data-source="${k}"><span class="ck-src-lib">${t("con.ck.s." + k)}</span><span class="ck-src-n">${I.nombre(n)}</span><span class="ck-src-barre"><span style="width:${max ? Math.round(n / max * 100) : 0}%"></span></span></li>`;
    const gr = (titre, o) => { const max = Math.max(0, ...Object.values(o)); return `<h3>${titre}</h3><ul class="ck-sources">${Object.entries(o).map(([k, n]) => ligne(k, n, max)).join("")}</ul>`; };
    const rien = !Object.values(p.prospects).some(Boolean) && !Object.values(p.clients).some(Boolean);
    return `<section class="carte ck-bloc" id="provenance"><h2>${t("con.ck.s.titre")}</h2><p class="note ck-chapo">${t("con.ck.per.long." + r.periode)}</p>
      ${rien ? `<p class="texte2 ck-vide">${t("con.ck.s.vide")}</p>` : gr(t("con.ck.s.prospects"), p.prospects) + gr(t("con.ck.s.clients"), p.clients)}</section>`; }

  async function cockpit(periodeDemandee) {
    const periode = CK.periodeValide(periodeDemandee), sur = p => p.catch(() => null), maintenant = Date.now();
    const debut = CK.PERIODES[periode] == null ? null : maintenant - CK.PERIODES[periode] * 864e5;
    const [col, prospectsL, brut] = await Promise.all([collecterAFaire(), sur(D.adminProspects()), D.adminCockpit ? sur(D.adminCockpit(debut)) : null]);
    const r = CK.calculer({ maintenant, periode, commerces: col.cs, delais: col.dl, prospects: prospectsL, alertes: col.alertes, afaire: col.items, prises,
      afaireIllisible: !!col.erreurs, prospectsTronques: Array.isArray(prospectsL) && prospectsL.length >= 200,   // adminProspects lit 200 prospects au plus
      brut: brut || { illisible: ["cockpit"] }, offres: OFFRES, conditions: window.RENOM_CONDITIONS, stripe: (window.RENOM_CONFIG || {}).stripe || null, mode: D.mode,
      etatFiche: FG && FG.sql ? (c => FG.sql(c) ? FG.etat(c) : (/^[A-Za-z0-9_-]{10,255}$/.test(c.google_place_id || "") ? "reconnue" : "aucune")) : null });
    afCtx = { pubs: [], dl: col.dl || [], cs: col.cs };
    vue.innerHTML = `<div class="entete ck-entete"><h1>${t("con.entree.cockpit")}</h1>
        <nav class="filtres ck-periode" id="periode" aria-label="${t("con.ck.periode")}">${Object.keys(CK.PERIODES).map(k => `<a href="#/cockpit/${k}" data-periode="${k}"${k === periode ? ' aria-current="page"' : ""}>${t("con.ck.per.bouton." + k)}</a>`).join("")}</nav></div>
      <p class="ck-verdict ck-verdict-${r.niveau}" id="verdict" data-niveau="${r.niveau}">${e(verdictTexte(r))}</p>
      <p class="note ck-lu" id="lu">${t("con.ck.lu", { h: I.heure(maintenant) })} <button type="button" class="lien" id="relire">${t("con.ck.relire")}</button> · <a class="lien-guide" href="#/guide" data-lien-guide>${t("con.guide.lien")}</a></p><p class="msg" id="msg" role="status"></p>
      ${blocKpi(r)}
      <div class="ck-grille">${blocGaranties(r)}${blocControles(r)}</div>
      ${blocPipeline(r)}
      <div class="ck-grille">${blocFile(r)}${blocProvenance(r)}</div>`;
    $("relire").onclick = () => cockpit(periode);
    brancherMoi(() => cockpit(periode));
    brancherCartes(() => cockpit(periode));
  }

  // ================= Mode d'emploi (11/11/2026, demande de PJ : « il me faudrait un tuto explicatif ») : le parcours d'un nouveau client, du paiement
  // à « actif », étape par étape (le client, le robot, vous, où cliquer, combien de temps, si ça bloque, message prêt à copier), la routine du jour
  // et le glossaire. Textes fixes (con.guide.* de i18n.js), rien n'est lu dans la base. #/guide/<ancre> descend à la partie demandée.
  const ETAPES_GUIDE = ["e1", "e2", "e3", "e4", "e5", "e6", "e7"], ROUTINE = [1, 2, 3, 4, 5, 6];
  const GLOSSAIRE = ["place_id", "reliee", "acces", "declare", "delegation", "garanties", "metricool", "apublier", "sensible", "ia", "sante", "objectif"];
  async function guide(ancre) {
    const L = k => t("con.guide.l." + k), G = (e_, k) => t("con.guide." + e_ + "." + k);
    const etape = (k, i) => `<section class="carte guide-etape" id="guide-${k}"><h2>${i + 1}. ${G(k, "titre")}</h2>
        <dl class="guide-dl">${["client", "robot", "vous", "ou", "duree", "bloque"].map(r => `<div data-role="${r}"><dt>${L(r)}</dt><dd>${G(k, r)}</dd></div>`).join("")}</dl>
        ${k === "e3" ? `<div class="encart guide-mer" id="guide-google-verifie"><p class="fort">${t("con.mer.google.titre")}</p>${quandGoogle()}</div>` : ""}
        ${k === "e4" ? `<div class="encart guide-mer" id="guide-reseaux-proc"><p class="fort">${t("con.mer.proc.titre")}</p>${procReseaux()}</div>` : ""}
        ${I.a("con.guide." + k + ".message") ? `<div class="encart guide-message"><p class="fort">${L("message")}</p><p class="texte2" data-message>${G(k, "message")}</p><button type="button" class="bouton second petit" data-copier-message>${t("con.guide.copier")}</button></div>` : ""}</section>`;
    vue.innerHTML = `${entete(t("con.entree.guide"), t("con.guide.chapo"))}<p class="msg" id="msg" role="status"></p>
      <nav class="carte guide-sommaire" id="guide-sommaire" aria-label="${t("con.guide.sommaire")}"><p class="fort">${t("con.guide.sommaire")}</p>
        <ol>${ETAPES_GUIDE.map(k => `<li><a href="#/guide/${k}">${G(k, "titre")}</a></li>`).join("")}</ol>
        <p><a href="#/guide/fiche">${t("con.guide.fiche.titre")}</a> · <a href="#/guide/mer">${t("con.guide.mer.titre")}</a> · <a href="#/guide/routine">${t("con.guide.routine.titre")}</a> · <a href="#/guide/glossaire">${t("con.guide.glossaire")}</a></p></nav>
      <h2 class="guide-partie" id="guide-parcours">${t("con.guide.parcours")}</h2>
      <div class="pile" id="guide-etapes">${ETAPES_GUIDE.map(etape).join("")}</div>
      <section class="carte" id="guide-fiche"><h2>${t("con.guide.fiche.titre")}</h2><ol class="guide-liste">${[1, 2, 3, 4, 5].map(n => `<li>${t("con.guide.fiche." + n)}</li>`).join("")}</ol></section>
      <section class="carte" id="guide-mer"><h2>${t("con.guide.mer.titre")}</h2><p class="texte2">${t("con.guide.mer.chapo")}</p>
        <dl class="guide-dl">${["compte", "google", "metricool", "demarrage"].map(k => `<div data-point="${k}"><dt>${t("con.mer.nom." + k)}</dt><dd>${t("con.guide.mer." + k)}</dd></div>`).join("")}</dl></section>
      <section class="carte" id="guide-routine"><h2>${t("con.guide.routine.titre")}</h2><ol class="guide-liste">${ROUTINE.map(n => `<li>${t("con.guide.routine." + n)}</li>`).join("")}</ol></section>
      <section class="carte" id="guide-glossaire"><h2>${t("con.guide.glossaire")}</h2><dl class="guide-dl guide-glossaire">${GLOSSAIRE.map(k => `<div data-terme="${k}"><dt translate="no">${t("con.guide.g." + k + ".t")}</dt><dd>${t("con.guide.g." + k)}</dd></div>`).join("")}</dl></section>`;
    vue.querySelectorAll("[data-copier-message]").forEach(b => b.onclick = async () => { const x = b.parentElement.querySelector("[data-message]").textContent;
      try { await navigator.clipboard.writeText(x); msg(t("con.guide.copie")); } catch (er) { const r = document.createRange(); r.selectNodeContents(b.parentElement.querySelector("[data-message]")); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); msg(t("con.selectionnee")); } });
    const z = ancre && $("guide-" + ancre); if (z) z.scrollIntoView({ block: "start" });
  }

  // Routes. Anciennes adresses (emails d'alerte, workflows n8n, favoris) : chacune ouvre le même contenu à sa nouvelle place, sans étape d'historique.
  const ROUTES = { cockpit, afaire, clients, client, nouveau, journal, prospects, style, photos: photosClient, depot: depotClient, guide };
  const ANCIENNES = { commerces: "clients", alertes: "afaire/alertes", apublier: "afaire/apublier", garanties: "afaire/garanties", videos: "afaire/videos", invitations: "nouveau", creer: "nouveau" };
  // Onglet allumé pour chaque écran.
  const ONGLET = { cockpit: "cockpit", afaire: "afaire", clients: "clients", client: "clients", nouveau: "clients", journal: "clients", style: "clients", photos: "clients", depot: "clients", prospects: "prospects", guide: "guide" };
  let derniere = null;
  async function rendre() {
    const s = await D.session(); if (!s) return connexion();
    // Lien d'email d'un compte qui a ENCORE un facteur TOTP vérifié : Supabase exige le code avant de changer le mot de passe, interrupteur ou
    // non (« AAL2 session is required to update email or password when MFA is enabled ») ; retirer le facteur l'évite (BRANCHEMENT, étape 81).
    if (s.codeRequis) return doubleAuth(s, "code");
    if (s.motDePasseRequis || s.doubleAuth === "mot_de_passe") return choixMotDePasse(s);
    if (s.role !== "administrateur") return refuse();
    if (window.RENOM_ACCES.DOUBLE_AUTH_ADMIN && s.doubleAuth !== "ok") return doubleAuth(s, s.doubleAuth === "code" ? "code" : "activer");
    const [r, param, sous] = location.hash.replace("#/", "").split("/");
    if (ANCIENNES[r]) { history.replaceState(null, "", "#/" + ANCIENNES[r] + (param ? "/" + param : "")); return rendre(); }
    const ecran = ROUTES[r] ? r : "cockpit";
    ficheCourante = null;   // « Fait à … » ne se note que pour un geste fait sur la fiche ouverte (client la rouvre et la remet)
    route = ONGLET[ecran]; connecte = true; dessinerNav();
    const cle = ecran + "/" + (param || "") + "/" + (sous || ""); if (derniere !== cle) window.scrollTo(0, 0); derniere = cle;
    try { await ROUTES[ecran](param ? decodeURIComponent(param) : undefined, sous ? decodeURIComponent(sous) : undefined); } catch (er) { vue.innerHTML = `<section class="carte"><h1>${t("souci")}</h1><p>${e(ph(er.message))}</p></section>`; }
  }
  document.addEventListener("click", async ev => { if (ev.target.closest("#sortir")) { await D.quitter(); location.hash = ""; rendre(); } });
  large.addEventListener("change", dessinerNav);
  window.addEventListener("hashchange", rendre); rendre();
})();
