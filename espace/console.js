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

  // ---------------- Navigation (25/10/2026, décision de PJ : « c'est trop, ajuste ») : trois onglets. À faire (une seule file triée par urgence :
  // alertes, à publier à la main, avis de l'équipe, vidéos, garanties, mises en route, options), Clients (liste, fiche de chaque client, nouveau
  // client, journal) et Prospects. Barre latérale sur ordinateur, onglets du bas sur téléphone.
  const trait = d => `<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ENTREES = [
    ["afaire", t("con.entree.afaire"), trait('<rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M8.5 12.5l2.5 2.5 4.5-5"></path>')],
    ["clients", t("con.entree.clients"), trait('<path d="M4 10l1.5-5h13L20 10"></path><path d="M5 10v10h14V10"></path><path d="M4 10h16M10 20v-5h4v5"></path>')],
    ["prospects", t("con.entree.prospects"), trait('<circle cx="9" cy="8" r="3.5"></circle><path d="M3 20c.8-3.6 3.2-5.5 6-5.5s5.2 1.9 6 5.5"></path><path d="M16 6.5h5M18.5 4v5"></path>')],
  ];
  const large = window.matchMedia("(min-width: 900px)"); let route = "afaire", connecte = false;
  function dessinerNav() {
    document.body.classList.toggle("hors-session", !connecte);
    const lat = $("lat"), haut = $("haut"), onglets = $("onglets"); lat.innerHTML = haut.innerHTML = onglets.innerHTML = "";
    if (!connecte) return;
    const lien = ([r, nom, icone], avecIcone) => `<a href="#/${r}" data-r="${r}"${r === route ? ' aria-current="page"' : ""}>${avecIcone ? `<span class="onglet-icone">${icone}</span>` : ""}<span>${nom}</span></a>`;
    if (large.matches) lat.innerHTML = `<div class="lat-in"><a class="logo" href="${I.lien("console.html")}" translate="no">boostimpact<span class="logo-point">.</span><span class="logo-suffixe">agency</span></a><nav id="nav" class="menu" aria-label="${t("con.titre")}"><div class="groupe"><p class="groupe-lib">${t("con.titre")}</p>${ENTREES.map(x => lien(x, false)).join("")}</div></nav><div class="lat-pied">${I.selecteur()}<button type="button" id="sortir" class="quitter">${t("quitter")}</button></div></div>`;
    else { haut.innerHTML = `<a class="logo" href="${I.lien("console.html")}" translate="no">boostimpact<span class="logo-point">.</span><span class="logo-suffixe">agency</span></a><span class="haut-note">${t("con.titre")}</span>${I.selecteur()}<button type="button" id="sortir" class="quitter">${t("quitter")}</button>`;
      onglets.innerHTML = ENTREES.map(x => lien(x, true)).join(""); }
  }

  // Compte connecté sans droit sur la console (un commerçant, 25/10/2026) : « Accès réservé », et « Se connecter avec un autre compte » (déconnexion,
  // puis le formulaire de connexion) en plus du retour à son espace.
  async function refuse() { connecte = false; dessinerNav(); vue.innerHTML = `<div class="connexion"><div class="carte" id="acces-reserve"><div class="connexion-tete"><p class="logo" translate="no">boostimpact<span class="logo-point">.</span><span class="logo-suffixe">agency</span></p>${I.selecteur()}</div><div class="entete"><h1>${t("con.refuse.titre")}</h1><p class="chapo">${t("con.refuse.texte")}</p></div><button type="button" class="bouton plein" id="autre-compte">${t("acces.autre.compte")}</button><a class="bouton second plein" href="${I.lien("index.html")}">${t("con.retour.espace")}</a></div></div>`;
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
  const miseEnRoute = s => { const m = s && s.mise_en_route; if (!m) return ""; const reste = m.points.filter(x => x.etat !== "fait");
    return `<p>${t("sur", { a: m.faits, b: m.total })}</p>${reste.map(x => `<p class="note">${COURT[x.point] || e(x.point)}${t("deux.points")}${t(x.etat === "declare" ? "con.mer.declare" : "con.mer.afaire")}</p>${["google", "metricool"].includes(x.point) ? `<button type="button" class="bouton second petit" data-mer="${e(x.point)}">${t("con.verifie", { x: x.point === "google" ? "Google" : "Metricool" })}</button>` : ""}`).join("")}`; };
  // Style du commerce (kit de marque) : qui l'a validé et quand, demandes de changement en attente, lien vers le panneau « Style du commerce ».
  const ligneStyle = c => { const m = c.marque, n = +c.demandes_style || 0;
    const etat = m && m.verrouille ? t("con.sty.ligne." + (m.valide_par === "renom" ? "renom" : "commercant"), { d: I.date(m.verrouille_le || m.maj) }) : t(m ? "con.sty.ligne.attente" : "con.sty.ligne.aucun");
    return `<div class="pile serre style-ligne"><p class="note">${etat}</p>${n ? `<p class="note fort">${t("con.sty.ligne.demandes", { n })}</p>` : ""}<a class="bouton second petit" href="${I.lien("console.html")}#/style/${encodeURIComponent(c.id)}" data-style="${e(c.id)}">${t("con.sty.ouvrir")}</a></div>`
      + lignePhotos(c); };
  // Autorisation photos (décision de PJ du 22/10/2026, CGV article 11) : son état, et « Déposer des photos pour ce client » (panneau #/photos/<commerce>).
  const lignePhotos = c => `<div class="pile serre photos-ligne"><p class="note">${c.photos_autorisees_le ? t("con.ph.autorise", { d: I.date(c.photos_autorisees_le) }) : t("con.ph.non")}</p>
    <a class="bouton second petit" href="${I.lien("console.html")}#/photos/${encodeURIComponent(c.id)}" data-photos="${e(c.id)}">${t("con.ph.bouton")}</a></div>`;
  // Panneau « Déposer des photos pour ce client » : fermé sans l'autorisation du commerçant (la base le refuse aussi : admin_deposer_photos et la règle du
  // seau). Envoi de chaque photo dans le dossier du commerce (même envoi que l'espace), puis un seul enregistrement (1 à 10 photos), source « equipe ».
  async function photosClient(cid) {
    const c = cid && (await D.adminCommerces()).find(x => x.id === cid); if (!c) { location.hash = "#/clients"; return; }
    const ouvert = !!c.photos_autorisees_le;
    vue.innerHTML = `<div class="entete"><p class="sur">${t("con.ph.bouton")}</p><h1>${e(c.nom)}</h1><p class="chapo">${t("con.ph.chapo")}</p></div><p class="retour-liste"><a href="#/client/${encodeURIComponent(c.id)}">${t("con.client.retour")}</a></p>
      <section class="carte" id="ph-client"><p class="fort">${ouvert ? t("con.ph.autorise", { d: I.date(c.photos_autorisees_le) }) : t("con.ph.non")}</p>
      ${ouvert ? `<form id="ph-f"><div class="f"><label for="ph-fichiers">${t("con.ph.choisir")}</label><input id="ph-fichiers" type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple></div>
        <div class="actions"><button class="bouton" type="submit" id="ph-ok">${t("con.ph.deposer")}</button><button type="button" class="lien" id="ph-retirer">${t("con.ph.retirer")}</button></div></form>`
      : `<p class="texte2" id="ph-ferme">${t("con.ph.sans")}</p>`}<p class="msg" id="msg" role="status"></p></section>`;
    if (!ouvert) return;
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
  // Accès vérifié (22/10/2026, admin_acces_reseau) : par réseau compris dans l'offre (et retenu), l'état réel et le bouton « Accès vérifié » (l'équipe a
  // accepté l'invitation : fiche Google, Meta Business Suite, TikTok) ou « Accès retiré » (le client a retiré l'accès). Sans réseau « connecté »,
  // la base ne programme rien et la file « Contenus à publier » reste vide.
  const ligneAcces = c => `<div class="pile serre acces-ligne">${window.RENOM_RESEAUX_AUTORISES(c).map(r => { const k = (c.comptes || {})[r] || {}, on = k.etat === "connecte";
    return `<div class="pile serre" data-acces-res="${e(r)}"><p class="note${on ? " fort" : ""}">${on ? (k.maj ? t("con.acces.etat.on", { res: NOM_RESEAU[r] || e(r), d: dh(k.maj) }) : t("con.acces.etat.connecte", { res: NOM_RESEAU[r] || e(r) })) : t("con.acces.etat.off", { res: NOM_RESEAU[r] || e(r) })}</p>
      <button type="button" class="bouton ${on ? "second " : ""}petit" data-acces="${e(r)}" data-oui="${on ? 0 : 1}">${t(on ? "con.acces.retirer" : "con.acces.verifier")}</button></div>`; }).join("")}</div>`;
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
          <td data-l="${C("actions")}"><div class="pile serre">${actions !== null ? actions : fini ? "" : `${!p.rapport_envoye_le ? `<button type="button" class="bouton second petit" data-p="rapport_envoye">${t("con.rapport.envoye")}</button>` : ""}<button type="button" class="bouton second petit" data-p="rdv">${t("con.rdv")}</button>${!p.repondu_le ? `<button type="button" class="bouton second petit" data-p="reponse">${t("con.a.repondu")}</button>` : ""}<button type="button" class="lien" data-p="arreter">${t("con.arreter")}</button>`}</div></td></tr>`; }).join("")}</tbody></table></section>`
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
  const carteAlerte = a => `<article class="carte" data-alerte><div class="carte-tete"><h2>${e(ph(a.type))}</h2><span class="note">${dh(a.date)}</span></div><p class="fort">${e(a.commerce || "")}</p><p class="texte2 casse">${alerteHtml(a.texte)}</p></article>`;
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
          <div class="actions"><button type="button" class="bouton second petit" data-pm-media>${t(x.type === "video" ? "con.pm.video" : "con.pm.visuel")}</button><button type="button" class="bouton second petit" data-pm-copier>${t("con.pm.copier")}</button><button type="button" class="bouton petit" data-pm-publiee>${t("con.pm.marquer")}</button></div></article>`;
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
  // 2. Commentaires des commerces Premium (gestion par l'équipe). 3. Garantie des délais : départ (accès et premières photos), fiche sous 7 jours,
  //    premier contenu sous 72 h, avis sous 24 h ; manquements → mois offert, appliqué À LA MAIN dans Stripe puis noté ici (ordres/BRANCHEMENT.md).
  // 4. Réseaux retenus et mode délégation. 5. Objectif INTERNE des pilotes (ancienne garantie « 10 avis ») : jamais montré au commerçant.
  // 3 à 5 sont dans la fiche de chaque client ; les délais en retard ou proches et les mois offerts à appliquer sont aussi dans « À faire ».
  const ETAT_OBJ = I.carte("con.obj.etat", ["en_cours", "atteinte", "non_atteint", "condition_manquante"]);
  const ETAT_DELAI = I.carte("delai.etat", ["non_demarre", "en_cours", "tenu", "manque"]);
  const ENGAGEMENT = I.carte("con.engagement", ["fiche_7j", "premier_contenu_72h", "avis_24h"]);
  const RESEAUX_RET = ["instagram", "facebook", "tiktok"], NOM_RES = I.carte("res", ["facebook", "instagram", "google", "tiktok"]);
  const etoiles = n => t("con.etoiles", { n }), COND_O = window.RENOM_CONDITIONS.objectif_interne_pilotes, GD = window.RENOM_CONDITIONS.garantie_delais;
  const jourDe = v => v ? String(v).slice(0, 10) : "";
  const carteAvisFile = a => `<article class="carte${a.en_retard ? " attention" : ""}" data-avis="${e(a.id)}" data-mode="${e(a.mode)}"><div class="carte-tete"><h2>${e(a.commerce || "")}</h2><span class="etat${a.en_retard ? "" : " actif"}">${a.traite_le ? t("con.file.traite", { d: dh(a.traite_le) }) : t(a.en_retard ? "con.file.retard" : "con.file.avant", { d: dh(a.echeance) })}</span></div>
          <p class="note">${t("con.file.titre")}</p>
          <p class="fort">${etoiles(a.note)} · ${e(I.offre(a.offre || ""))}${a.sensible ? " · " + t("con.file.sensible", { r: e((a.raisons || []).join(", ")) }) : " · " + t("con.file.equipe")}</p>
          ${a.texte ? `<p class="texte2 casse" translate="no">${e(a.texte)}</p>` : `<p class="note">${t("con.texte.efface")}</p>`}<p class="note">${t("con.file.recu", { d: dh(a.recu_le) })}</p>
          <div class="f"><label for="rep-av-${e(a.id)}">${t(a.mode === "equipe" ? "con.file.reponse" : "con.file.reponse.proposer")}</label><textarea id="rep-av-${e(a.id)}" data-rep-avis maxlength="2000" translate="no">${e(a.reponse_proposee || "")}</textarea></div>
          ${a.mode === "equipe" ? `<p class="note">${t("con.file.mode.equipe")}</p>` : `<p class="note">${t("con.file.mode.proposer", { email: a.email_client ? `<span class="casse">${e(a.email_client)}</span>` : t("con.file.sans.email") })}</p>
          ${a.propose_le ? `<p class="note">${t("con.file.proposee", { d: dh(a.propose_le) })}</p>` : ""}<label class="option"><input type="checkbox" data-accord><span>${t("con.file.accord")}</span></label>`}
          <div class="actions"><button type="button" class="bouton second petit" data-copier-avis>${t("con.copier")}</button>${a.mode === "equipe" ? "" : `<button type="button" class="bouton second petit" data-avis-proposer>${t("con.file.proposer")}</button>`}<button type="button" class="bouton petit" data-avis-publie>${t("con.file.publiee")}</button></div></article>`;
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
  const saisieDelais = g => `<div class="pile serre">
            <div class="f etroit"><label for="acc-${e(g.commerce_id)}">${t("con.delais.acces.lib")}</label><input id="acc-${e(g.commerce_id)}" type="date" value="${e(jourDe(g.acces_remis_le))}" data-d="acces_remis_le"></div>
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
  const carteManquement = m => `<article class="carte attention" data-mq="${e(m.id)}"><div class="carte-tete"><h2>${e(m.commerce || "")}</h2><span class="etat">${t("con.mq.st." + m.statut)}</span></div>
          <p class="note">${t("con.mq.titre")}</p>
          <p class="fort">${ENGAGEMENT[m.engagement] || e(m.engagement)}</p><p class="note">${t("con.mq.echeance", { d: dh(m.echeance) })} · ${C_("mq.mois")}${t("deux.points")}${I.date(m.mois_offert)}</p>
          ${m.statut === "a_appliquer" ? `<div class="pile serre"><button type="button" class="bouton petit" data-mq-d="applique">${t("con.mq.appliquer")}</button>
            <div class="f etroit"><label for="mq-${e(m.id)}">${t("con.mq.motif")}</label><input id="mq-${e(m.id)}" type="text" maxlength="500" data-mq-motif></div><button type="button" class="bouton second petit" data-mq-d="ecarte">${t("con.mq.ecarter")}</button></div>` : m.motif ? `<p class="note casse">${e(m.motif)}</p>` : ""}</article>`;
  const C_ = k => t("con.col." + k);
  // Dépôts de vidéos : statut, motif ; relance du montage (fonction SQL admin_relancer_montage, qui revérifie tout).
  const ST_DV = I.carte("dv.st", window.RENOM_DEPOT_VIDEO.STATUTS);
  const RELANCABLE = ["envoye", "en_montage", "refuse"];
  const relancable = d => RELANCABLE.includes(d.statut) && !d.rushes_effaces_le && !d.effacement_demande_le;
  const secDv = d => d == null ? "" : ", " + I.nombre(+d, +d % 1 ? 1 : 0) + " s";
  const carteDepot = d => `<article class="carte${d.statut === "refuse" ? " attention" : ""}" data-depot="${e(d.id)}"><div class="carte-tete"><h2>${e(d.commerce || "")}</h2><span class="note">${dh(d.cree_le)}</span></div>
          <p class="note">${t("con.entree.videos")}</p>
          <p class="fort">${ST_DV[d.statut] || e(d.statut)}</p>${d.motif ? `<p class="note">${e(ph(d.motif))}</p>` : ""}${d.essais ? `<p class="note">${t("con.essais", { n: d.essais })}</p>` : ""}
          ${d.nb_videos ? `<p class="note">${t("dv.depot.contenu", { v: d.nb_videos, p: (d.nb_fichiers || 0) - d.nb_videos, d: "" }) + secDv(d.duree_totale_s)}</p>` : ""}${d.note ? `<p class="note casse" translate="no">${e(d.note)}</p>` : ""}
          ${relancable(d) ? `<div class="actions"><button type="button" class="bouton second petit" data-relancer>${t("con.relancer")}</button></div>` : ""}</article>`;
  // Mise en route bloquée : pas finie 5 jours après la création (même seuil que l'alerte MISE_EN_ROUTE_BLOQUEE et le score de santé), ou un point
  // déclaré fait par le commerçant, que l'équipe doit vérifier.
  const ageJours = c => c.cree_le ? Math.floor((Date.now() - Date.parse(c.cree_le)) / 86400000) : null;
  const merBloquee = c => { const m = c.sante && c.sante.mise_en_route; if (!m || m.faits >= m.total) return false; return m.points.some(x => x.etat === "declare") || (ageJours(c) ?? 0) >= 5; };
  const carteMiseEnRoute = c => `<article class="carte attention" data-mer-commerce="${e(c.id)}"><div class="carte-tete"><h2>${e(c.nom)}</h2><a href="#/client/${encodeURIComponent(c.id)}">${t("con.client.ouvrir")}</a></div>
          <p class="note">${t("con.col.mer")}</p>${miseEnRoute(c.sante)}</article>`;

  // ================= Écran « À faire » : une seule file, triée par urgence (en retard d'abord, puis l'échéance la plus proche, puis le reste, le plus
  // récent d'abord). Un compteur par type en haut ; chaque compteur filtre la file (#/afaire/<type>).
  const TYPES_AF = ["alertes", "apublier", "avis", "videos", "garanties", "miseenroute", "options"];
  let afCtx = {};
  async function afaire(filtreType) {
    const sur = p => p.catch(() => null);
    const [alertes, pubs, avisG, cmPub, sons, file, cmEq, depots, dl, cs, opts] = await Promise.all([sur(D.adminAlertes()), sur(D.adminPublicationsAPublier()), sur(D.adminAvisAPublier()), sur(D.adminCommentairesAPublier()),
      sur(D.adminMusiquesAPoser()), sur(D.adminFileAvis()), sur(D.adminCommentairesEquipe()), sur(D.adminDepotsVideo()), sur(D.adminGarantieDelais()), D.adminCommerces(), D.adminCommandesOptions ? sur(D.adminCommandesOptions()) : []]);
    const T_ = x => x ? Date.parse(x) : NaN, items = [], ajout = (type, html, retard, quand, date) => items.push({ type, html, retard: !!retard, quand: isNaN(quand) ? Infinity : quand, date: isNaN(date) ? 0 : date });
    (alertes || []).forEach(a => ajout("alertes", carteAlerte(a), false, NaN, T_(a.date)));
    (pubs || []).forEach((x, i) => ajout("apublier", cartePublication(x, i), x.en_retard, T_(x.prevu_le)));
    (avisG || []).forEach(x => ajout("apublier", carteAvisGoogle(x), x.en_retard, T_(x.echeance), T_(x.a_publier_le)));
    (cmPub || []).forEach(x => ajout("apublier", carteCommentaireAPublier(x), false, NaN, T_(x.decide_le || x.cree_le)));
    (sons || []).forEach(x => ajout("apublier", carteSon(x), false, T_(x.prevu_le)));
    (file || []).filter(a => !a.traite_le || a.mode !== "equipe").forEach(a => ajout("avis", carteAvisFile(a), a.en_retard, a.traite_le ? NaN : T_(a.echeance), T_(a.recu_le)));
    (cmEq || []).forEach(x => ajout("avis", carteCommentaireEquipe(x), false, NaN, T_(x.recu_le)));
    (depots || []).filter(relancable).forEach(d => ajout("videos", carteDepot(d), d.statut === "refuse", NaN, T_(d.cree_le)));
    (dl || []).forEach(g => { const r = delaisAFaire(g); if (r.length) ajout("garanties", carteDelais(g, r), r.some(x => x.retard), Math.min(...r.map(x => x.ech))); });
    (dl || []).flatMap(g => (g.manquements || []).filter(m => m.statut === "a_appliquer").map(m => ({ ...m, commerce: g.commerce }))).forEach(m => ajout("garanties", carteManquement(m), true, T_(m.echeance)));
    cs.filter(merBloquee).forEach(c => ajout("miseenroute", carteMiseEnRoute(c), (ageJours(c) ?? 0) >= 5, NaN, T_(c.cree_le)));
    (opts || []).forEach(x => ajout("options", carteOption(x, [...cs].sort((a, b) => a.nom.localeCompare(b.nom))), x.en_retard, T_(x.echeance)));
    items.sort((a, b) => (a.retard ? 0 : 1) - (b.retard ? 0 : 1) || a.quand - b.quand || b.date - a.date);
    const n = Object.fromEntries(TYPES_AF.map(k => [k, items.filter(x => x.type === k).length])), f = TYPES_AF.includes(filtreType) ? filtreType : "";
    const visibles = f ? items.filter(x => x.type === f) : items;
    afCtx = { pubs: pubs || [], dl: dl || [], cs };
    const erreurs = [alertes, pubs, avisG, cmPub, sons, file, cmEq, depots, dl].some(x => x === null);
    vue.innerHTML = `${entete(t("con.entree.afaire"), t("con.afaire.chapo"))}<p class="msg" id="msg" role="status"></p>
      <nav class="filtres compteurs" id="a-faire" aria-label="${t("con.afaire.types")}"><a href="#/afaire" data-type=""${f ? "" : ' aria-current="page"'}>${t("con.afaire.tout", { n: items.length })}</a>${TYPES_AF.map(k => `<a href="#/afaire/${k}" data-type="${k}" data-n="${n[k]}"${f === k ? ' aria-current="page"' : ""}>${t("con.af." + k)}, ${n[k]}</a>`).join("")}</nav>
      ${erreurs ? `<p class="note">${t("con.afaire.erreur")}</p>` : ""}
      ${visibles.length ? `<div class="pile" id="file-a-faire">${visibles.map(x => x.html.replace("<article ", `<article data-type="${x.type}" `)).join("")}</div>` : `<section class="carte"><p class="texte2" id="a-faire-vide">${t(f ? "con.afaire.vide.type" : "con.afaire.vide")}</p></section>`}`;
    const fl = vue.querySelector(".compteurs"), fp = fl && fl.querySelector("[aria-current]");
    if (fp && fl.scrollWidth > fl.clientWidth) fl.scrollLeft += fp.getBoundingClientRect().left - fl.getBoundingClientRect().left - 8;
    brancherCartes(() => afaire(filtreType));
  }
  // Actions des cartes (À faire et fiche du client) : chaque bouton appelle la fonction de la base, puis l'écran est redessiné (apres) et le message
  // dit ce qui a été noté.
  function brancherCartes(apres) {
    const agir = async (f, ok, b) => { if (b) b.disabled = true; try { const m = await f(); if (m === null) { if (b) b.disabled = false; return; } await apres(); msg(ok != null ? ok : typeof m === "string" ? m : t("enregistre")); } catch (er) { if (b) b.disabled = false; msg(ph(er.message)); } };
    const copier = async (x, ok) => { try { await navigator.clipboard.writeText(x.value); msg(t(ok)); } catch (er) { x.select(); msg(t("con.selectionnee")); } };
    const sur = (sel, f) => vue.querySelectorAll(sel).forEach(b => { const ev = b.tagName === "INPUT" && b.type === "checkbox" ? "onchange" : "onclick"; b[ev] = () => f(b, b.closest("[data-type], article, tr, section")); });
    // À publier à la main
    sur("[data-copier]", b => copier(b.closest("article").querySelector("[data-rep]"), "con.copiee"));
    sur("[data-publie]", b => agir(() => D.adminCommentairePublie(b.closest("article").dataset.id), t("con.publiee.equipe"), b));
    const pm = b => afCtx.pubs[+b.closest("article").dataset.pmI];
    sur("[data-pm-copier]", b => copier(b.closest("article").querySelector("[data-pm-legende]"), "con.pm.copiee"));
    sur("[data-pm-media]", async b => { b.disabled = true;
      try { const u = await D.adminLienMedia(pm(b)); if (!u) { msg(t("con.pm.sans.media")); return; }
        const a = document.createElement("a"); a.href = u; a.download = ""; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); msg(t("con.pm.telechargement")); }
      catch (er) { msg(ph(er.message)); } finally { b.disabled = false; } });
    sur("[data-pm-publiee]", b => { const x = pm(b); agir(async () => { const r = await D.adminPublicationPubliee(x.id, x.reseau); return t("con.pm.notee", { res: NOM_RESEAU[x.reseau] || x.reseau, h: dh(r.publie_le) }); }, null, b); });
    sur("[data-copier-gbp]", b => copier(b.closest("article").querySelector("[data-rep-gbp]"), "con.copiee"));
    sur("[data-publie-gbp]", b => agir(() => D.adminAvisMarquerPubliee(b.closest("article").dataset.avisPub), t("con.gbp.publiee"), b));
    sur("[data-son-pose]", b => agir(() => D.adminMusiquePosee(b.closest("article").dataset.pub), t("con.son.enregistre"), b));
    // Avis de la file de BoostImpact et commentaires des commerces Premium
    sur("[data-copier-avis]", b => copier(b.closest("article").querySelector("[data-rep-avis]"), "con.copiee"));
    sur("[data-avis-proposer]", b => { const a = b.closest("article"); agir(() => D.adminAvisProposer(a.dataset.avis, a.querySelector("[data-rep-avis]").value), t("con.file.proposee.msg")); });
    sur("[data-avis-publie]", b => { const a = b.closest("article"), acc = a.querySelector("[data-accord]"); agir(() => D.adminAvisPublie(a.dataset.avis, a.querySelector("[data-rep-avis]").value, acc ? acc.checked : false), t("con.file.notee")); });
    sur("[data-cm-d]", b => { const a = b.closest("article"); agir(() => D.adminCommentaireDecider(a.dataset.cm, b.dataset.cmD, b.dataset.cmD === "valide" ? a.querySelector("[data-cm-texte]").value : null)); });
    // Garanties : dates du commerce, message de cohérence, manquements, réseaux retenus, délégation, objectif interne
    sur("[data-delais-enregistrer]", b => { const z = b.closest("[data-delais]"), p = {}; z.querySelectorAll("[data-d]").forEach(i => { p[i.dataset.d] = i.value || null; }); agir(() => D.adminDelais(z.dataset.delais, p)); });
    sur("[data-coh-copier]", async b => { const z = b.closest("[data-delais]"), g = afCtx.dl.find(x => x.commerce_id === z.dataset.delais) || {}, m = z.querySelector("[data-coh-message]");
      m.value = messageCoherence(g, z.querySelector("[data-coh-ecarts]").value);
      try { await navigator.clipboard.writeText(m.value); msg(t("con.coh.copie")); } catch (er) { m.select(); msg(t("con.selectionnee")); } });
    sur("[data-mq-d]", b => { const z = b.closest("[data-mq]"), m = z.querySelector("[data-mq-motif]"); agir(() => D.adminManquement(z.dataset.mq, b.dataset.mqD, m ? m.value : null)); });
    sur("[data-ret-enregistrer]", b => { const z = b.closest("[data-ret]"); agir(() => D.adminReseaux(z.dataset.ret, [...z.querySelectorAll("[data-ret-res]:checked")].map(i => i.value))); });
    sur("[data-delegation]", i => agir(() => D.adminDelegation(i.closest("[data-ret]").dataset.ret, i.checked)));
    sur("[data-gar-releve]", b => { const z = b.closest("[data-gar]"), v = z.querySelector("[data-releve]").value; agir(() => D.adminGarantie(z.dataset.gar, { avis_releve: v })); });
    sur("[data-gar-cartes]", b => agir(() => D.adminGarantie(b.closest("[data-gar]").dataset.gar, { cartes_en_place_le: window.RENOM_MAJ.aujourdhui() })));
    // Dépôts vidéo, mise en route, options
    sur("[data-relancer]", b => agir(() => D.adminRelancerMontage(b.closest("[data-depot]").dataset.depot), t("con.relance.ok"), b));
    sur("[data-mer]", b => agir(() => D.adminMiseEnRoute(b.closest("[data-mer-commerce]").dataset.merCommerce, b.dataset.mer, "fait")));
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
  async function client(cid) {
    const sur = p => p.catch(() => null);
    const [cs, dl, gs, opts, depots, jl] = await Promise.all([D.adminCommerces(), sur(D.adminGarantieDelais()), sur(D.adminGaranties()), D.adminCommandesOptions ? sur(D.adminCommandesOptions()) : [], sur(D.adminDepotsVideo()), sur(D.adminJournal())]);
    const c = cs.find(x => x.id === cid); if (!c) { location.hash = "#/clients"; return; }
    const g = (dl || []).find(x => x.commerce_id === cid), gar = (gs || []).find(x => x.commerce_id === cid), o = OFFRES[c.offre_id] || {}, ret = Array.isArray(c.reseaux_retenus) ? c.reseaux_retenus : RESEAUX_RET;
    const k = c.compteur || {}, mq = g ? (g.manquements || []).map(m => ({ ...m, commerce: g.commerce })) : [], mesOpts = (opts || []).filter(x => x.commerce_id === cid), mesDepots = (depots || []).filter(d => d.commerce_id === cid);
    const journalClient = (jl || []).filter(x => x.commerce_id === cid);
    afCtx = { pubs: [], dl: dl || [], cs };
    vue.innerHTML = `<div class="entete"><p class="sur">${t("con.entree.clients")}</p><h1>${e(c.nom)}</h1><p class="chapo">${e(METIERS[c.metier] || "")}${c.ville ? ", " + e(c.ville) : ""} · ${e(I.offre(c.offre_id))}</p></div>
      <p class="retour-liste"><a href="#/clients">${t("con.sty.retour")}</a></p><p class="msg" id="msg" role="status"></p>
      <section class="carte" id="client-etat" data-client-id="${e(c.id)}"><h2>${t("con.client.etat")}</h2>
        <div class="champs deux"><div class="pile serre"><p class="note">${C_("etat")}</p><span class="etat${c.en_pause ? "" : " actif"}">${t(c.en_pause ? "con.en.pause" : "con.actif")}</span><button type="button" class="bouton second petit" data-a="pause">${t(c.en_pause ? "con.reprendre" : "con.pause")}</button></div>
        <div class="pile serre"><label for="offre-client">${C_("offre")}</label><select id="offre-client" data-offre aria-label="${t("con.offre.de", { nom: e(c.nom) })}">${Object.entries(OFFRES).filter(([k2, x]) => !x.retiree || c.offre_id === k2).map(([k2, x]) => `<option value="${k2}"${c.offre_id === k2 ? " selected" : ""}>${e(I.offre(k2))}${x.retiree ? " " + t("con.offre.retiree") : ""}</option>`).join("")}</select><button type="button" class="bouton second petit" data-a="offre">${t("con.changer.offre")}</button></div></div>
        <p>${t("con.pub.sur", { a: k.publications_utilisees, b: k.publications_plafond })} · ${t("con.vid.sur", { a: k.videos_utilisees, b: k.videos_plafond })}</p></section>
      <section class="carte" id="client-sante" data-mer-commerce="${e(c.id)}"><h2>${C_("sante")}</h2>${sante(c.sante)}<h3>${C_("mer")}</h3>${miseEnRoute(c.sante)}</section>
      <section class="carte" id="client-comptes" data-id="${e(c.id)}"><h2>${C_("comptes")}</h2><p>${t("con.connectes", { n: Object.values(c.comptes || {}).filter(x => x.etat === "connecte").length })}</p>${ligneAcces(c)}${ligneMarque(c)}</section>
      <section class="carte" id="client-style"><h2>${t("con.client.style")}</h2>${ligneStyle(c)}</section>
      <section class="carte" id="client-garanties"><h2>${t("con.entree.garanties")}</h2>
        <h3>${t("con.delais.titre")}</h3>${g ? `<div data-delais="${e(cid)}"><dl class="liste-delais">${[["delais.depart", g.depart ? `<p>${dh(g.depart)}</p>` : `<p class="note">${t("con.delais.pas.demarre")}</p>`], ["delais.fiche", delai(g.fiche) + coherenceEtat(g.fiche)], ["delais.contenu", delai(g.premier_contenu)],
            ["delais.avis", `<p class="fort">${(g.avis_en_cours || []).length}</p>`]].map(([lib, v]) => `<div><dt class="note">${C_(lib)}</dt><dd>${v}</dd></div>`).join("")}</dl>${saisieDelais(g)}</div>`
          : `<form id="f-delais-client" class="pile serre"><div class="f etroit"><label for="dl-acces">${t("con.delais.acces.lib")}</label><input id="dl-acces" type="date" required></div><p class="note">${t("con.delais.regle")}</p><button class="bouton second petit" type="submit">${t("con.delais.demarrer.bouton")}</button></form>`}
        ${mq.length ? `<h3>${t("con.mq.titre")}</h3><div class="pile" id="manquements">${mq.map(carteManquement).join("")}</div>` : ""}
        <h3>${t("con.ret.titre")}</h3><div class="pile serre" data-ret="${e(cid)}">${o.reseaux_sociaux ? `<div class="pile serre">${RESEAUX_RET.map(r => `<label class="option"><input type="checkbox" value="${r}" data-ret-res${ret.includes(r) ? " checked" : ""}><span>${NOM_RES[r]}</span></label>`).join("")}<button type="button" class="bouton second petit" data-ret-enregistrer>${t("enregistrer")}</button></div>` : `<p class="note">${t("con.ret.google.seul")}</p>`}
          ${o.delegation ? `<label class="option"><input type="checkbox" data-delegation${c.delegation_signee_le ? " checked" : ""}><span>${t(c.delegation_signee_le ? "con.ret.delegation.le" : "con.ret.delegation.non", { d: c.delegation_signee_le ? I.date(jourDe(c.delegation_signee_le)) : "" })}</span></label>` : `<p class="note">${t("con.ret.delegation.sans")}</p>`}</div>
        <h3>${t("con.gar.titre")}</h3><p class="note">${t("con.obj.chapo")}</p>${gar ? `<div class="pile serre" data-gar="${e(cid)}"><p>${t("con.gar.avis", { n: gar.avis_actuel })} · ${t("con.gar.gagnes", { n: gar.gagnes, o: gar.objectif })} · <span class="etat${gar.etat === "atteinte" ? " actif" : ""}">${ETAT_OBJ[gar.etat] || e(gar.etat)}</span></p>
            <p class="note">${t("con.gar.jour", { n: gar.jour })} · ${I.date(gar.echeance)}${gar.prolongation_jours ? " · " + t("con.gar.prolongee", { n: gar.prolongation_jours }) : ""}${gar.cartes_en_place_le ? " · " + t("con.gar.cartes", { d: I.date(gar.cartes_en_place_le) }) : ""}</p>
            ${!gar.en_vue && gar.etat === "en_cours" && gar.jour >= COND_O.rappel_jour ? `<p class="note fort">${t("con.gar.pas.en.vue", { s: gar.seuil_en_vue })}</p>` : ""}
            <div class="f etroit"><label for="rel-${e(cid)}">${t("con.gar.releve.lib")}</label><input id="rel-${e(cid)}" type="number" min="0" inputmode="numeric" data-releve></div>
            <button type="button" class="bouton second petit" data-gar-releve>${t("con.gar.enregistrer")}</button>${!gar.cartes_en_place_le ? `<button type="button" class="bouton second petit" data-gar-cartes>${t("con.gar.cartes.ok")}</button>` : ""}</div>`
          : `<form id="f-gar-client" class="pile serre"><div class="champs deux"><div class="f"><label for="gar-date">${t("con.gar.date")}</label><input id="gar-date" type="date" required></div><div class="f"><label for="gar-avis">${t("con.gar.avis.capture")}</label><input id="gar-avis" type="number" min="0" inputmode="numeric" required></div></div>
            <div class="f etroit"><label for="gar-cartes">${t("con.gar.cartes.lib")}</label><input id="gar-cartes" type="date"></div><p class="note">${t("con.gar.regle")}</p><button class="bouton second petit" type="submit">${t("con.gar.demarrer.bouton")}</button></form>`}</section>
      ${mesOpts.length ? `<section class="carte" id="client-options"><h2>${t("con.opt.titre")}</h2></section><div class="pile">${mesOpts.map(x => carteOption(x, cs)).join("")}</div>` : ""}
      ${mesDepots.length ? `<section class="carte tableau" id="client-videos"><h2>${t("con.entree.videos")}</h2><table class="tab"><thead><tr><th>${C_("depot")}</th><th>${C_("fichiers")}</th><th>${C_("statut")}</th><th>${C_("actions")}</th></tr></thead><tbody>${mesDepots.map(d =>
        `<tr data-depot="${e(d.id)}"><td data-l="${C_("depot")}"><p>${dh(d.cree_le)}</p>${d.note ? `<p class="note casse" translate="no">${e(d.note)}</p>` : ""}</td>
          <td data-l="${C_("fichiers")}">${d.nb_videos ? t("dv.depot.contenu", { v: d.nb_videos, p: (d.nb_fichiers || 0) - d.nb_videos, d: "" }) + secDv(d.duree_totale_s) : ""}${d.rushes_effaces_le ? `<p class="note">${t("dv.efface.le", { d: I.date(d.rushes_effaces_le) })}</p>` : ""}</td>
          <td data-l="${C_("statut")}"><p class="fort">${ST_DV[d.statut] || e(d.statut)}</p>${d.motif ? `<p class="note">${e(ph(d.motif))}</p>` : ""}${d.essais ? `<p class="note">${t("con.essais", { n: d.essais })}</p>` : ""}</td>
          <td data-l="${C_("actions")}">${relancable(d) ? `<button type="button" class="bouton second petit" data-relancer>${t("con.relancer")}</button>` : ""}</td></tr>`).join("")}</tbody></table></section>` : ""}
      <details class="carte tableau" id="journal-client"><summary>${t("con.journal.client")}, ${journalClient.length}</summary>${tableJournal("jc")}</details>`;
    remplirJournal("jc", journalClient);
    const zc = $("client-etat");
    zc.querySelector("[data-a=pause]").onclick = async () => { try { await D.adminPause(cid, !c.en_pause); await client(cid); msg(t("enregistre")); } catch (er) { msg(ph(er.message)); } };
    zc.querySelector("[data-a=offre]").onclick = async () => { try { await D.adminOffre(cid, $("offre-client").value); await client(cid); msg(t("enregistre")); } catch (er) { msg(ph(er.message)); } };
    vue.querySelectorAll("[data-acces]").forEach(b => b.onclick = async () => { const r = b.dataset.acces, oui = b.dataset.oui === "1", res = NOM_RESEAU[r] || r;
      if (!oui && !window.confirm(t("con.acces.confirmer", { res }))) return; b.disabled = true;
      try { const x = await D.adminAccesReseau(cid, r, oui); await client(cid); msg(t(oui ? "con.acces.ok" : "con.acces.retire", { res, n: x.programmes || 0 })); } catch (er) { b.disabled = false; msg(ph(er.message)); } });
    vue.querySelectorAll("[data-mc-enregistrer]").forEach(b => b.onclick = async () => { try { await D.adminMetricoolMarque(cid, vue.querySelector("[data-mc]").value); await client(cid); msg(t("con.mc.ok")); } catch (er) { msg(ph(er.message)); } });
    const fd = $("f-delais-client"); if (fd) fd.onsubmit = async ev => { ev.preventDefault(); try { await D.adminDelais(cid, { acces_remis_le: $("dl-acces").value }); await client(cid); msg(t("enregistre")); } catch (er) { msg(ph(er.message)); } };
    const fg = $("f-gar-client"); if (fg) fg.onsubmit = async ev => { ev.preventDefault(); try { await D.adminGarantie(cid, { depart_le: $("gar-date").value, avis_depart: $("gar-avis").value, cartes_en_place_le: $("gar-cartes").value || null }); await client(cid); msg(t("enregistre")); } catch (er) { msg(ph(er.message)); } };
    brancherCartes(() => client(cid));
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
  async function nouveau() {
    const l = await D.adminInvitations();
    vue.innerHTML = `${entete(t("con.nouveau.client"), t("con.creer.titre"))}<p class="retour-liste"><a href="#/clients">${t("con.sty.retour")}</a></p>
      <section class="carte formulaire" id="creer"><form id="f"><div class="f"><label for="nom">${t("fiche.nom")}</label><input id="nom" type="text" required></div>
      <div class="champs deux"><div class="f"><label for="metier">${t("fiche.metier")}</label><select id="metier">${Object.entries(METIERS).map(([k, x]) => `<option value="${k}">${x}</option>`).join("")}</select></div>
      <div class="f"><label for="offre">${C_("offre")}</label><select id="offre">${Object.entries(OFFRES).filter(([k, o]) => !o.retiree).map(([k, o]) => `<option value="${k}">${e(I.offre(k))}</option>`).join("")}</select></div></div>
      <div class="f"><label for="email">${t("con.email.proprio")}</label><input id="email" type="email" required></div><button class="bouton" type="submit">${t("con.creer.inviter")}</button><p class="msg" id="msg" role="status"></p></form></section>
      <section class="carte tableau" id="invitations"><h2>${t("con.entree.invitations")}</h2><p class="texte2">${t("con.invitations.chapo")}</p>${l.length ? `<table class="tab"><thead><tr><th>${C_("date")}</th><th>${C_("commerce")}</th><th>${C_("email")}</th><th>${C_("etat")}</th></tr></thead><tbody>${l.map(i => `<tr><td data-l="${C_("date")}">${dh(i.cree_le)}</td><td data-l="${C_("commerce")}">${e(i.commerce || "")}</td><td data-l="${C_("email")}" class="casse">${e(i.email)}</td><td data-l="${C_("etat")}">${INVITATION[i.statut] ? `<span class="fort">${INVITATION[i.statut]}</span> <span class="note">(${e(i.statut)})</span>` : e(i.statut)}</td></tr>`).join("")}</tbody></table>` : `<p class="texte2">${t("con.aucune.invitation")}</p>`}</section>`;
    $("f").onsubmit = async ev => { ev.preventDefault(); try { await D.adminCreer($("nom").value, $("metier").value, $("offre").value, $("email").value); await nouveau(); msg(t("con.cree")); } catch (er) { msg(ph(er.message)); } };
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
  // Routes. Anciennes adresses (emails d'alerte, workflows n8n, favoris) : chacune ouvre le même contenu à sa nouvelle place, sans étape d'historique.
  const ROUTES = { afaire, clients, client, nouveau, journal, prospects, style, photos: photosClient };
  const ANCIENNES = { commerces: "clients", alertes: "afaire/alertes", apublier: "afaire/apublier", garanties: "afaire/garanties", videos: "afaire/videos", invitations: "nouveau", creer: "nouveau" };
  // Onglet allumé pour chaque écran.
  const ONGLET = { afaire: "afaire", clients: "clients", client: "clients", nouveau: "clients", journal: "clients", style: "clients", photos: "clients", prospects: "prospects" };
  let derniere = null;
  async function rendre() {
    const s = await D.session(); if (!s) return connexion();
    // Lien d'email d'un compte qui a ENCORE un facteur TOTP vérifié : Supabase exige le code avant de changer le mot de passe, interrupteur ou
    // non (« AAL2 session is required to update email or password when MFA is enabled ») ; retirer le facteur l'évite (BRANCHEMENT, étape 81).
    if (s.codeRequis) return doubleAuth(s, "code");
    if (s.motDePasseRequis || s.doubleAuth === "mot_de_passe") return choixMotDePasse(s);
    if (s.role !== "administrateur") return refuse();
    if (window.RENOM_ACCES.DOUBLE_AUTH_ADMIN && s.doubleAuth !== "ok") return doubleAuth(s, s.doubleAuth === "code" ? "code" : "activer");
    const [r, param] = location.hash.replace("#/", "").split("/");
    if (ANCIENNES[r]) { history.replaceState(null, "", "#/" + ANCIENNES[r] + (param ? "/" + param : "")); return rendre(); }
    const ecran = ROUTES[r] ? r : "afaire";
    route = ONGLET[ecran]; connecte = true; dessinerNav();
    const cle = ecran + "/" + (param || ""); if (derniere !== cle) window.scrollTo(0, 0); derniere = cle;
    try { await ROUTES[ecran](param ? decodeURIComponent(param) : undefined); } catch (er) { vue.innerHTML = `<section class="carte"><h1>${t("souci")}</h1><p>${e(ph(er.message))}</p></section>`; }
  }
  document.addEventListener("click", async ev => { if (ev.target.closest("#sortir")) { await D.quitter(); location.hash = ""; rendre(); } });
  large.addEventListener("change", dessinerNav);
  window.addEventListener("hashchange", rendre); rendre();
})();
