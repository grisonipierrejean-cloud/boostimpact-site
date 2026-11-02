(function () {
  const D = window.RENOM_DATA, $ = id => document.getElementById(id), vue = $("vue");
  // Textes, dates et nombres : espace/web/i18n.js (français ou anglais). Les contenus du commerce (légendes, avis, réponses, idées) restent dans sa langue.
  const I = window.RENOM_I18N, t = I.t, ph = I.phrase;
  // Belgique : « HTVA » dans les prix (i18n.js) dès que le commerce est lu (31/10/2026, test client Essentiel, tour 5).
  if (D && D.commerce) { const lire = D.commerce.bind(D); D.commerce = async (...a) => { const c = await lire(...a); if (I.pays) I.pays(c && c.pays); return c; }; }
  // Votre contact (31/10/2026) : réglé dans la console (mon_contact) ; rien de réglé (décision de PJ du 01/11/2026) : PJ, le numéro officiel, sans photo.
  // « Votre contact : PJ, BoostImpact · WhatsApp +33 6 99 08 05 39 » (lien wa.me). La console peut régler un autre prénom ou une photo.
  const CONTACT_DEFAUT = { prenom: "PJ", telephone: "+33699080539", photo: null };
  const contactDe = x => x && x.prenom ? x : CONTACT_DEFAUT;
  // Publications du mois comptées comme les vidéos (01/11/2026, tour 6 Premium) : faites + photos en préparation (vue compteur, publications_preparation ;
  // base sans la colonne : 0, l'ancien compte).
  const pubReservees = k => (+k.publications_utilisees || 0) + (+k.publications_preparation || 0);
  const lienWa = tel => "https://wa.me/" + String(tel || "").replace(/[^\d]/g, "");
  const ligneContact = (x, id) => { const k = contactDe(x), tel = window.RENOM_WHATSAPP.lisible(k.telephone).replace(/ /g, "\u00a0");
    return `<p class="contact-ligne" id="${id}">${k.photo ? `<img class="contact-photo" src="${e(k.photo)}" alt="" width="40" height="40" loading="lazy">` : ""}<span>${t("contact.votre", { p: e(k.prenom || ""), tel: `<a href="${e(lienWa(k.telephone))}" target="_blank" rel="noopener">${e(tel)}</a>` })}</span></p>`; };
  const monContact = () => (D.monContact ? D.monContact().catch(() => null) : Promise.resolve(null));
  // Point mensuel Premium de 30 min (décision de PJ du 01/11/2026) : « Réserver mon point du mois ». 02/11/2026 : le bouton ouvre la page de réservation
  // Calendly de l'équipe (AGENDA_POINT_MOIS, « Monthly Meeting - 30mins - BoostImpact Team » ; avant : page Google Agenda de PJ), dans un nouvel
  // onglet ; repli dessous : WhatsApp (wa.me/33699080539) avec le message prérempli d'avant. Lien seul, sans état « Point demandé le … » : la réservation
  // se fait chez Calendly, l'espace ne sait pas si elle a abouti.
  const AGENDA_POINT_MOIS = "https://calendly.com/team-boostimpact/30min";
  const lienPointMois = c => "https://wa.me/33699080539?text=" + encodeURIComponent(t("point.mois.message", { nom: (c && c.nom) || "" }));
  const pointMoisInclus = c => !!(c && (window.RENOM_OFFRES || {})[c.offre_id] && window.RENOM_OFFRES[c.offre_id].delegation);
  const boutonPointMois = (c, id) => pointMoisInclus(c)
    ? `<a class="bouton second" id="${id}" href="${e(AGENDA_POINT_MOIS)}" target="_blank" rel="noopener" aria-describedby="${id}-note">${t("point.mois.reserver")}</a>` : "";
  const notePointMois = (c, id) => pointMoisInclus(c) ? `<p class="note" id="${id}-note">${t("point.mois.note", { wa: `<a href="${e(lienPointMois(c))}" target="_blank" rel="noopener" id="${id}-wa">${e(window.RENOM_WHATSAPP.lisible("+33699080539")).replace(/ /g, "\u00a0")}</a>` })}</p>` : "";
  const e = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MOIS = I.mois(), JOURS = I.joursCourts();
  const ST_PHOTO = I.carte("st.photo", ["a_traiter", "en_cours", "traitee", "refusee"]);
  const ST_CONTENU = I.carte("st.contenu", ["a_valider", "approuve", "modification", "programme", "publie", "refuse"]);
  const ST_PUB = I.carte("st.pub", ["programme", "envoye", "publie", "echec", "annule"]);
  const ST_AVIS = I.carte("st.avis", ["nouveau", "a_valider", "valide", "publie", "humain", "refuse", "escalade", "a_publier_main"]);
  const METIERS = I.carte("metier", ["restaurant", "beaute", "sport", "autre"]);
  const RES = I.carte("res", ["facebook", "instagram", "google", "tiktok"]);
  // Destination d'une publication programmée (31/10/2026, test client Essentiel) : jamais vide. Réseaux hors de l'offre (après une baisse d'offre) :
  // la phrase dit où elle était prévue et pourquoi elle sera annulée (« prévue sur Instagram, qui n'est plus dans votre offre : elle sera annulée »,
  // audit Essentiel du 31/10/2026), comme la base qui annule ce qui sort de l'offre.
  const horsOffreDe = (x, autorises) => !(x.reseaux || []).some(r => autorises.includes(r));
  // Ordre fixe des réseaux à l'affichage (31/10/2026, test client Croissance, tour 5) : Instagram, Facebook, TikTok, Fiche Google.
  const ORDRE_AFFICHAGE = ["instagram", "facebook", "tiktok", "google"], trierRes = l => [...(l || [])].sort((a, b) => (ORDRE_AFFICHAGE.indexOf(a) + 9) % 9 - (ORDRE_AFFICHAGE.indexOf(b) + 9) % 9);
  const destTexte = (x, autorises) => { const ok = trierRes(x.reseaux).filter(r => autorises.includes(r)), avant = trierRes(x.reseaux).map(r => RES[r]).filter(Boolean);
    return ok.length ? ok.map(r => RES[r]).join(", ") : avant.length ? t(avant.length > 1 ? "cal.hors.offre.plusieurs" : "cal.hors.offre.un", { r: I.liste(avant) }) : t("cal.hors.offre"); };
  // Règle de publication des réponses aux avis, selon l'offre (moteur/avis/regles.js ; CGV article 8 ; drapeaux de RENOM_OFFRES, donnees.js).
  // Essentiel, Croissance (standard) et Premium (avis_equipe ou delegation) : 4 et 5 étoiles automatiques, 1 à 3 étoiles et avis sensibles traités par
  // l'équipe BoostImpact. Le cas « tout passe par le commerçant » ne reste que pour une offre sans ces drapeaux. Un avis sensible n'est jamais automatique.
  const offreDe = c => (window.RENOM_OFFRES || {})[(c || {}).offre_id] || {};
  // Langue des publications (01/11/2026, tour 7 Premium ; commerces.langues_publication, même repli que redaction.langues_de du moteur).
  const languesPub = c => { const l = ["fr", "nl"].filter(x => Array.isArray((c || {}).langues_publication) && c.langues_publication.includes(x)); return l.length ? l : [(c || {}).langue === "nl" ? "nl" : "fr"]; };
  // Offre sans réseaux sociaux (Essentiel : fiche Google seulement, moteur/offres.json). 26/10/2026 (test réel de PJ) : ses écrans ne parlent ni de
  // réseaux, ni de vidéos, ni de « community manager » ; les photos y sont facultatives, pour ses publications Google du mois (clés « .google »).
  const sansReseaux = c => offreDe(c).reseaux_sociaux === false;
  // Autorisation photos (CGV article 11, 26/10/2026) : périmètre « fiche_google » (donnée en Essentiel) ou « fiche_site_reseaux ». Après un passage
  // de l'Essentiel à Croissance ou Premium, l'autorisation reste limitée à la fiche Google : la case (texte complet) est proposée de nouveau.
  const autorisationGoogle = c => sansReseaux(c) || c.photos_autorisees_perimetre === "fiche_google";
  const autorisationAJour = c => !!c.photos_autorisees_le && (sansReseaux(c) || c.photos_autorisees_perimetre !== "fiche_google");
  const pubGoogle = c => offreDe(c).publications || 2;
  // Mise en route claire (27/10/2026, bloc SQL « Mise en route claire et travail visible ») : ses colonnes de commerces (nom_confirme_le…) disent que le
  // bloc est appliqué. Sans elles (base pas encore à jour), les écrans restent ceux d'avant : ni écran du nom, ni « rappelez-moi », ni fiche à créer.
  const merSql = c => !!c && "nom_confirme_le" in c;
  const nomAConfirmer = c => merSql(c) && !c.nom_confirme_le;
  const ficheDemandee = c => merSql(c) && !!c.fiche_google_demande_le && !c.fiche_google_verifiee_le;
  // Lien de la fiche Google (28/10/2026, bloc SQL « Fiche Google du client venu du site et photos hors sujet ») : le commerçant colle l'adresse de sa
  // fiche (mise en route, étape Google, et Comptes) ; l'identifiant en est tiré ou cherché (jamais montré : pas de « place_id » côté client).
  // Sans le bloc SQL (colonne fiche_google_lien_le absente) : aucun champ.
  const FG = window.RENOM_FICHE;
  const etatFiche = c => { const x = FG.etat(c); return x === "aucune" ? "" : t("fg.etat." + x); };
  const blocFiche = (c, id) => !FG.sql(c) ? "" : `<form class="pile serre fiche-lien" id="${id}" novalidate>
      <div class="f"><label for="${id}-champ">${t("fg.lib")}</label><input id="${id}-champ" type="url" inputmode="url" autocomplete="off" maxlength="500" value="${e(c.fiche_google_lien || "")}" placeholder="https://maps.app.goo.gl/…" aria-describedby="${id}-aide">
        <p class="aide" id="${id}-aide">${t("fg.aide")}</p></div>
      <div class="actions"><button class="bouton second" type="submit" id="${id}-ok">${t("fg.bouton")}</button></div><p class="note" id="${id}-etat" role="status" data-etat-fiche="${e(FG.etat(c))}">${etatFiche(c)}</p></form>`;
  // Réglages > Comptes connectés (31/10/2026, même règle que « Mon commerce », vague 9) : le lien est en lecture seule, « BoostImpact le renseigne
  // pour vous » ; seul l'écran de mise en route (étape Google) garde le champ, et la console garde l'édition.
  const ficheLecture = (c, id) => !FG.sql(c) ? "" : c.fiche_google_lien
    ? `<div class="pile serre fiche-lien" id="${id}"><div class="f"><label for="${id}-champ">${t("fg.lib")}</label><input id="${id}-champ" type="url" value="${e(c.fiche_google_lien)}" readonly aria-describedby="${id}-aide">
        <p class="aide" id="${id}-aide">${t("fiche.lien.boost")}</p></div><p class="note" id="${id}-etat" role="status" data-etat-fiche="${e(FG.etat(c))}">${etatFiche(c)}</p></div>`
    : `<p class="texte2 fiche-lien" id="${id}">${t("fg.lecture.vide")}</p>`;
  // Fiche reliée (02/11/2026, bloc SQL « Fiches Google reliées automatiquement ») : commerces.google_location_id, posé par relier_fiche_google
  // (n8n « RENOM, fiches Google : invitations et liens »), lisible par le commerçant ; jamais montré (pas de « locations/… » côté client).
  // Colonne absente (démonstration, base d'avant) : rien.
  const ficheReliee = c => !c || !("google_location_id" in c) ? "" : /^locations\/[0-9]+$/.test(c.google_location_id || "")
    ? `<div class="pile serre" id="fiche-reliee" data-fiche-reliee="1"><p class="fort">${t("fg.reliee")}</p><p class="texte2">${t("fg.reliee.texte", { lien: `<a href="#/resultats">${t("ecran.resultats")}</a>` })}</p></div>`
    : `<p class="note" id="fiche-reliee" data-fiche-reliee="0">${t("fg.non.reliee")}</p>`;
  const brancherFiche = (id, apres) => { const f = $(id); if (!f) return;
    f.onsubmit = async ev => { ev.preventDefault(); const b = $(id + "-ok"); b.disabled = true;
      try { const r = await D.enregistrerFicheGoogle($(id + "-champ").value); await apres(); const z = $(id + "-etat"); if (z) z.textContent = (r && r.deja ? t("fg.deja") + " " : "") + t("fg.etat." + r.etat); }
      catch (er) { b.disabled = false; const z = $(id + "-etat"); if (z) z.textContent = ph(er.message); } }; };
  // Avis sensible d'une offre où l'équipe ne répond pas elle-même (aucune offre en vente depuis le 29/10/2026 : Essentiel a avis_equipe) : réponse proposée
  // par l'équipe, à approuver dans l'espace (decider_avis_sensible) ; l'accord vaut s'il suit la proposition.
  const accordDonne = x => x.decision_client === "approuve" && !!x.propose_le && !!x.decision_client_le && x.decision_client_le >= x.propose_le;
  const sensibleADecider = (x, c) => merSql(c) && !equipeRepond(c) && x.sensible && x.statut === "humain" && !!x.propose_le && !!String(x.reponse_proposee || "").trim()
    && !(x.decision_client && x.decision_client_le && x.decision_client_le >= x.propose_le);
  // Mode délégation : Premium ET accepté par écrit par le commerçant (commerces.delegation_signee_le, saisi dans la console).
  const delegationActive = c => !!(offreDe(c).delegation && (c || {}).delegation_signee_le);
  // Avis : l'équipe répond et publie elle-même (avis de 1 à 3 étoiles et avis sensibles) en Essentiel, Croissance et Premium (offres.avis_equipe, delegation).
  const equipeRepond = c => !!(offreDe(c).avis_equipe || offreDe(c).delegation);
  // Règle des avis par offre : Premium ; « standard » (avis_equipe : Croissance et Essentiel, 29/10/2026) ; ancienne offre retirée (Croissance, Signature :
  // 4 et 5 étoiles automatiques, 1 à 3 étoiles proposées au commerçant, inchangée tant que son abonnement court) ; « essentiel » : offre sans ces drapeaux.
  const regleAvis = c => { const o = offreDe(c); return o.delegation ? "premium" : o.avis_equipe ? "standard" : o.avis_auto ? "retiree" : "essentiel"; };
  // Réglage des avis en blocs (26/10/2026, test réel de PJ : un seul paragraphe « 4 et 5 étoiles … 1 à 3 étoiles et avis sensibles … » illisible
  // sur téléphone). Un bloc par cas, titre court et une ou deux phrases ; même sens qu'avant pour chaque offre, aucune règle changée. Croissance et
  // Premium : 4 et 5 étoiles, 1 à 3 étoiles, avis sensibles. Ancienne offre retirée : idem. Essentiel (tout passe par le commerçant) : « De 1 à 5
  // étoiles », puis avis sensibles. Écrans Avis, Offre (« Qui publie quoi ») et Fiche.
  const BLOCS_AVIS = {
    premium: [["45", "avis.regle.auto.45"], ["13", "avis.regle.equipe.13"], ["sensibles", "avis.regle.equipe.sensibles"]],
    standard: [["45", "avis.regle.auto.45"], ["13", "avis.regle.equipe.13"], ["sensibles", "avis.regle.equipe.sensibles"]],
    retiree: [["45", "avis.regle.auto.45"], ["13", "avis.regle.retiree.13"], ["sensibles", "avis.sensible.jamais"]],
    essentiel: [["tous", "avis.regle.essentiel.tous"], ["sensibles", "avis.sensible.jamais"]] };
  const regleAvisBlocs = c => { const r = regleAvis(c);
    return `<dl class="regle-avis" data-regle="${r}">${BLOCS_AVIS[r].map(([b, k]) => `<div class="regle-avis-bloc" data-bloc="${b}"><dt>${t("avis.bloc." + b)}</dt><dd>${t(k)}</dd></div>`).join("")}</dl>`; };
  const ETAT = I.carte("etat", ["non_connecte", "en_attente", "connecte", "erreur"]);
  const ETAPES = I.carte("etape", ["ACCES_RESEAU_VERIFIE", "ACCES_RESEAU_RETIRE", "PRODUIT", "PUBLIE", "PROGRAMME", "PROGRAMMATION_ANNULEE", "IDEES", "CONTENU_APPROUVE", "CONTENU_MODIFICATION", "CONTENU_REFUSE", "REFUS", "LEGENDE_REFUSEE", "ECHEC_PUBLICATION",
    "AVIS_RECU", "AVIS_A_VALIDER", "AVIS_VALIDE", "AVIS_REFUSE", "AVIS_PUBLIE", "AVIS_SENSIBLE", "MISE_EN_PAUSE", "REPRISE", "OFFRE_CHANGEE", "COMMERCE_CREE", "LEGENDE_MODIFIEE", "EMAIL_VALIDATION",
    "ACTION_FICHE", "ACTION_FICHE_VALIDEE", "ACTION_FICHE_REFUSEE", "ACTION_FICHE_PUBLIEE", "DEMARRAGE", "COMMENTAIRE_VALIDE", "COMMENTAIRE_IGNORE", "COMMENTAIRE_CLOS", "COMMENTAIRE_PUBLIE",
    "AVIS_EFFACES_30_JOURS", "COMMENTAIRES_EFFACES_30_JOURS", "ABONNEMENT_EN_ATTENTE", "ABONNEMENT_ACTIF", "ABONNEMENT_IMPAYE", "ABONNEMENT_RESILIE",
    // Types écrits par la base (schema.sql), n8n et le moteur que le commerçant voit dans Offre > Historique (les types internes sont filtrés :
    // journal_interne() de schema.sql, RENOM_JOURNAL_INTERNE de donnees.js). Un type inconnu s'affiche « Autre étape du service », jamais en code brut.
    "VALIDATION_TACITE", "PROGRAMMATION_AUTO", "APPROUVE_NON_PROGRAMME", "PHOTOS_DEPOSEES", "TIKTOK_CARROUSEL", "VALIDATION_PAR_LIEN", "NOTIFICATION_VALIDATION", "BIENVENUE",
    "BILAN_ENVOYE", "AVIS_TRAITE", "AVIS_PROPOSE", "AVIS_RELANCE", "AVIS_EQUIPE", "AVIS_ESCALADE", "ACTION_FICHE_CREEE", "ACTION_FICHE_A_PUBLIER", "ACTION_FICHE_REFUSE",
    "IDEE_SEMAINE", "IDEE_RETENUE", "IDEE_ECARTEE", "CLIENTS_IMPORTES", "OPPOSITION_AJOUTEE", "DESINSCRIPTION", "MISE_EN_ROUTE", "MISE_EN_ROUTE_DECLAREE",
    "EMAIL_MISE_EN_ROUTE", "EMAIL_RELANCE_VALIDATION", "EMAIL_RELANCE_PHOTOS", "EMAIL_OFFRE_SUPERIEURE", "DELEGATION_SIGNEE", "DELEGATION_RETIREE", "RESEAUX_RETENUS",
    "GARANTIE_MANQUEMENT", "MOIS_OFFERT_APPLIQUE", "RELEVE_MENSUEL", "OPTION_COMMANDEE", "OPTION_ELEMENTS_RECUS", "OPTION_LIVREE", "OPTION_SECOND_TEST_REMIS",
    // Mise en route claire (27/10/2026, bloc SQL « Mise en route claire et travail visible »)
    "NOM_CONFIRME", "RAPPEL_DEMANDE", "FICHE_GOOGLE_DEMANDEE", "FICHE_GOOGLE_DEMANDE_ANNULEE", "FICHE_GOOGLE_VERIFIEE", "PHOTOS_AUTORISATION_REFUSEE", "AVIS_REPONSE_APPROUVEE", "AVIS_EN_PARLER",
    // Fiche Google du client venu du site et photos hors sujet (28/10/2026, bloc SQL du même nom)
    "FICHE_GOOGLE_LIEN", "FICHE_GOOGLE_IDENTIFIEE", "FICHE_GOOGLE_A_IDENTIFIER", "PHOTO_HORS_SUJET",
    // Fiches Google reliées automatiquement (02/11/2026, relier_fiche_google)
    "FICHE_RELIEE"]);
  const ST_ABO = I.carte("abo.st", ["en_attente", "actif", "impaye", "resilie"]);
  const M = window.RENOM_MAJ;
  // Exemple de numéro selon le pays du commerce (31/10/2026, test client Premium belge) : +32 470 12 34 56 en Belgique, +33 6 12 34 56 78 sinon.
  const exNum = c => window.RENOM_WHATSAPP.exemple((c || {}).pays);
  const numParams = c => ({ ex: exNum(c), ind: M.paysDe((c || {}).pays) === "BE" ? "+32" : "+33" });
  // Vidéo animée par IA (24/10/2026) : étiquette sobre sur la carte (texte seul, ni trait de couleur, ni majuscules d'étiquette).
  const etiquetteIA = x => M.estIA(x) ? `<p class="etiquette-ia" data-ia>${t("ia.etiquette")}</p>` : "";
  const nombre = I.nombre;
  const moisDe = m => new Date(m.slice(0, 7) + "-15T12:00:00");
  const hm = I.hm;
  const creneauxTexte = metier => I.liste((M.CRENEAUX[metier] || M.CRENEAUX.autre).map(x => hm(x)));

  // ---------------- Dates et heures, dans la langue de l'interface (i18n.js)
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const jourMois = I.jourMois, date = I.date, heure = I.heure, heureCourte = I.heureCourte, dateHeure = I.dateHeure;
  // Heure de la grille du mois : « 18 h 30 » avec une espace sécable avant les minutes (« 18:<wbr>30 » hors français), pour passer sur deux lignes si besoin.
  const heureGrille = d => e(heure(d)).replace(":", ":<wbr>").replace(/\u00a0(\d\d)$/, " $1");
  const memeJour = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const jourRelatif = d => { const j = new Date(d), n = new Date(), h = new Date(Date.now() - 86400000); return memeJour(j, n) ? t("jour.aujourdhui") : memeJour(j, h) ? t("jour.hier") : cap(date(d)); };
  const jourLocal = d => { d = new Date(d); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const heureLocale = d => { d = new Date(d); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  const demain = () => jourLocal(Date.now() + 86400000);

  const cut = (s, n) => s.length > n ? s.slice(0, s.lastIndexOf(" ", n)) + "…" : s;
  // Coupe propre (tour 9) : jusqu'à n caractères ; à la dernière virgule si elle laisse au moins 20 caractères, sinon au dernier espace, avec « … ».
  const coupePropre = (s, n) => { if (s.length <= n) return s; const v = s.lastIndexOf(",", n); if (v >= 20) return s.slice(0, v).trimEnd();
    const b = s.lastIndexOf(" ", n); return (b > 0 ? s.slice(0, b) : s.slice(0, n)).replace(/[\s,;:–-]+$/, "") + "…"; };
  const msg = x => { const m = $("msg"); if (m) m.textContent = x; };
  // Message amené à l'écran (tour 11, v37) : s'il commence au-dessus de l'écran ou trop bas pour être lu au-dessus de la barre d'onglets (téléphone),
  // la page défile pour le mettre en haut ; le focus y va, sans nouveau défilement.
  const amenerMsg = m => { if (!m || !m.textContent.trim()) return; const r = m.getBoundingClientRect(), o = $("onglets"), barre = o && getComputedStyle(o).position === "fixed" ? o.getBoundingClientRect().height : 0;
    if (r.top < 8 || r.top > innerHeight - barre - 120) window.scrollTo({ top: Math.max(0, scrollY + r.top - 12), behavior: "instant" });
    if (!m.hasAttribute("tabindex")) m.setAttribute("tabindex", "-1"); m.focus({ preventScroll: true }); };
  // Confirmation flottante au-dessus de la barre d'onglets (31/10/2026) : après une décision, #msg est souvent hors de l'écran sur téléphone. 5 s, un tap la ferme.
  let toastMinuteur = 0;
  const toast = x => { let el = $("toast"); if (!el) { el = document.createElement("p"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); document.body.appendChild(el);
      el.addEventListener("click", () => { clearTimeout(toastMinuteur); el.hidden = true; el.textContent = ""; }); }   // un tap la ferme
    el.textContent = x; el.title = x || ""; el.hidden = !x; clearTimeout(toastMinuteur); if (x) toastMinuteur = setTimeout(() => { el.hidden = true; el.textContent = ""; }, 5000); };
  const fermerToast = () => { const el = $("toast"); if (el && !el.hidden) { clearTimeout(toastMinuteur); el.hidden = true; el.textContent = ""; } };
  addEventListener("hashchange", fermerToast);
  // 01/11/2026 (tour 6 Croissance) : le toast recouvrait « Envoyer la demande ». Il se ferme dès qu'un formulaire s'ouvre ou qu'un champ prend le focus.
  // Saisie au téléphone (01/11/2026, tour 7 Croissance) : la légende en cours d'écriture passait sous la barre d'onglets. Tant qu'un champ de texte a
  // le focus ET que le clavier du téléphone est ouvert, la barre est masquée (classe « saisie » sur <body>, style.css) ; elle revient dès que le
  // champ perd le focus ou que le clavier se ferme.
  const champTexte = el => !!(el && el.matches && el.matches("textarea, input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]):not([type=submit]):not([type=button]):not([type=range]), [contenteditable=true]"));
  // Clavier ouvert = la zone visible (visualViewport) a perdu plus de 120 px : sans clavier (ordinateur, clavier externe), la barre reste.
  const clavierOuvert = () => !!window.visualViewport && window.visualViewport.height < window.innerHeight - 120;
  const majSaisie = () => document.body.classList.toggle("saisie", champTexte(document.activeElement) && clavierOuvert());
  document.addEventListener("focusin", ev => { if (ev.target && ev.target.matches && ev.target.matches("input, textarea, select")) fermerToast(); majSaisie(); setTimeout(majSaisie, 350); });
  document.addEventListener("focusout", () => setTimeout(majSaisie, 0));
  if (window.visualViewport) window.visualViewport.addEventListener("resize", majSaisie);
  const urlSure = async (x, reseau) => { try { return x ? await D.urlVisuel(x, reseau) : null; } catch (er) { return null; } };
  // Visuel 9:16 envoyé à TikTok : seulement pour une publication photo (la story et la vidéo ont un seul fichier pour tous les réseaux).
  const url916 = x => M.photoPublication(x) ? urlSure(x, "tiktok") : Promise.resolve(null);
  const videoSure = async x => { try { return x && x.type === "video" ? await D.urlVideo(x) : null; } catch (er) { return null; } };
  $("demo").hidden = D.mode !== "demo";
  // Langue du commerce : les contenus écrits pour lui (légendes, avis, réponses, idées) gardent sa langue ; l'attribut lang le dit au navigateur.
  let langueCommerce = "fr";
  const lc = () => ` lang="${langueCommerce}"`;

  // ---------------- Morceaux d'écran partagés
  const pauseBandeau = c => c && c.en_pause ? `<div class="alerte" role="alert"><div><p class="fort">${t("pause.titre")}</p><p>${t("pause.texte")}</p></div></div>` : "";
  const entete = (sur, titre, texte) => `<div class="entete">${sur ? `<p class="sur">${sur}</p>` : ""}<h1>${titre}</h1>${texte ? `<p class="chapo">${texte}</p>` : ""}</div>`;
  const jauge = (u, n) => `<div class="jauge" role="img" aria-label="${t("sur", { a: u, b: n })}"><span style="width:${n ? Math.min(100, u / n * 100) : 0}%"></span></div>`;
  // Jamais « 5 sur 2 » (31/10/2026) : au-delà du plafond, « 2 sur 2 ». Plafond atteint (audit Essentiel du 31/10/2026) : la même phrase que l'écran
  // Photos, « 2 sur 2 : la prochaine photo servira en novembre » (plafond.phrase), au lieu de « les publications en plus sont offertes ».
  const moisApres = () => (new Date().getMonth() + 1) % 12;
  const mesure = (nom, u, n, plus) => `<div class="mesure"><div class="mesure-tete"><span>${nom}</span><span>${t("sur.chiffre", { a: `<span class="chiffre">${n && +u > +n ? n : u}</span>`, b: n })}</span></div>${jauge(Math.min(+u, +n || +u), n)}${plus && +n > 0 && +u >= +n ? `<p class="note" data-plafond-phrase>${t(plus, { n, mois: moisApres() })}</p>` : ""}</div>`;
  const vignette = u => u ? `<img class="vignette" src="${e(u)}" alt="">` : `<span class="vignette vide" aria-hidden="true"></span>`;
  const FORMAT_LIB = I.carte("format.lib", ["publication", "story", "video"]);
  const media = (x, u, v) => `<div class="media">${v ? `<video class="visuel" controls preload="metadata" poster="${e(u || "")}" src="${e(v)}"></video>` : u ? `<span class="visuel-zone"><img class="visuel" src="${e(u)}" alt="${t("visuel.alt")}"><button type="button" class="agrandir" data-agrandir aria-label="${e(t("visuel.agrandir"))}" title="${e(t("visuel.agrandir"))}">${LOUPE}</button></span>` : `<div class="visuel vide">${t("apercu.indispo")}</div>`}</div>`;
  // Les trois décisions sur un contenu à valider : mêmes boutons et mêmes appels sur l'accueil et sur l'écran Contenus.
  // La légende se modifie soi-même (voir blocReseaux) ; « Demander une modification à BoostImpact » reste pour ce qu'on ne peut pas faire seul, comme le visuel.
  let pubPlein = false, pubDepasse = false;   // pubDepasse : même refusée, la limite reste atteinte (remise impossible ce mois-ci, à coup sûr)   // limite de publications du mois atteinte (écran Contenus et accueil), lue au compteur
  const decisions = (x, refus) => `<div class="actions" data-choix><button type="button" class="bouton" data-a="approuve">${t("dec.approuver")}</button><button type="button" class="bouton second" data-a="modif">${t("dec.modif")}</button><button type="button" class="lien" data-a="refuse">${refus}</button></div>
    <div class="f" data-zone hidden><label for="mot-${e(x.id)}">${t("dec.mot")}</label><textarea id="mot-${e(x.id)}" data-mot></textarea>
      <div class="actions"><button type="button" class="bouton" data-a="envoyer-modif">${t("dec.envoyer")}</button><button type="button" class="lien" data-a="fermer-modif">${t("annuler")}</button></div></div>
    <div class="f confirmer-refus" data-zone-refus hidden><p class="fort">${t("dec.refus.question")}</p>${pubPlein && x.type === "publication" ? `<p class="texte2" data-refus-plein>${t(pubDepasse ? "dec.refus.plein.sur" : "dec.refus.plein")}</p>` : ""}<label for="motif-${e(x.id)}">${t("dec.refus.motif")}</label><textarea id="motif-${e(x.id)}" data-motif rows="2" maxlength="500"></textarea>
      <div class="actions"><button type="button" class="bouton second" data-a="refuse-ok">${t("dec.refus.oui")}</button><button type="button" class="bouton second" data-a="refuse-garder">${t("dec.refus.garder")}</button></div></div>`;
  // Dernier contenu approuvé : {id, p}. La base le programme à l'approbation (schema.sql, bloc « Programmation à l'approbation ») ; p est sa
  // publication, relue dans le calendrier : on affiche la date. Rien de programmé (aucun réseau connecté, commerce en pause…) : p est nul et
  // l'écran propose de le programmer au meilleur créneau.
  let approuveRecent = null;
  const texteProgramme = p => t("auto.programme", { quand: I.dateHeureDans(p.prevu_le), res: (p.reseaux || []).map(r => RES[r]).join(", ") });
  const publicationDe = async id => { try { return (await D.calendrier()).find(x => x.contenu_id === id && x.statut === "programme") || null; } catch (er) { return null; } };
  // Agrandir (01/11/2026, tour 7 Premium) : une icône discrète (loupe) au lieu de la pastille « Toucher pour agrandir » ; le nom reste lu (aria-label).
  const LOUPE = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 15l5 5M8 10.5h5M10.5 8v5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  function agrandir(im) {
    const retour = document.activeElement, z = document.createElement("div"); z.className = "agrandi"; z.setAttribute("role", "dialog"); z.setAttribute("aria-modal", "true"); z.setAttribute("aria-label", t("visuel.agrandi"));
    z.innerHTML = `<img src="${e(im.currentSrc || im.src)}" alt="${e(im.alt || "")}"><button type="button" class="bouton second" data-fermer>${t("fermer")}</button>`;
    const fermer = () => { z.remove(); document.removeEventListener("keydown", touche); if (retour && retour.focus) retour.focus({ preventScroll: true }); };
    const touche = ev => { if (ev.key === "Escape") fermer(); };
    z.onclick = fermer; document.addEventListener("keydown", touche); document.body.appendChild(z); z.querySelector("[data-fermer]").focus({ preventScroll: true });
  }
  function brancherDecisions(racine, apres) {
    racine.querySelectorAll("[data-contenu]").forEach(a => a.addEventListener("click", async ev => {
      // Téléphone : l'aperçu est réduit pour garder Approuver à l'écran ; un tap l'affiche en entier, un second le réduit.
      // 01/11/2026 (tour 7 Croissance) : le visuel est montré entier dans la carte (object-fit contain, style.css) ; « Toucher pour agrandir »
      // l'ouvre en grand, par-dessus l'écran (agrandir), fermé d'un tap, par le bouton ou par Échap.
      const img = ev.target.closest("img.visuel, [data-agrandir]"); if (img && a.contains(img)) { const im = img.matches("img") ? img : a.querySelector("img.visuel"); if (im) agrandir(im); return; }
      const b = ev.target.closest("[data-a]"); if (!b) return; const id = a.dataset.contenu, act = b.dataset.a, zone = a.querySelector("[data-zone]"), choix = a.querySelector("[data-choix]"), zr = a.querySelector("[data-zone-refus]");
      if (!["approuve", "modif", "fermer-modif", "envoyer-modif", "refuse", "refuse-ok", "refuse-garder"].includes(act)) return;
      try {
        // Refuser (31/10/2026) : jamais d'un seul geste. Confirmation explicite, motif facultatif.
        if (act === "refuse") { zr.hidden = false; choix.hidden = true; zr.querySelector("[data-a=refuse-garder]").focus({ preventScroll: true }); zr.scrollIntoView({ block: "nearest" }); return; }
        if (act === "refuse-garder") { zr.hidden = true; choix.hidden = false; a.querySelector("[data-a=refuse]").focus({ preventScroll: true }); return; }
        if (act === "modif") { fermerToast(); zone.hidden = false; choix.hidden = true; a.querySelector("[data-mot]").focus({ preventScroll: true }); zone.scrollIntoView({ block: "start" }); return; }   // clavier : « Envoyer la demande » reste visible
        if (act === "fermer-modif") { zone.hidden = true; choix.hidden = false; return; }
        if (b.disabled) return;
        // Légende en cours de modification (31/10/2026) : enregistrée avant la décision, jamais perdue.
        const legende = await sauverEditionOuverte(a);
        // Demander une modification (31/10/2026, test client Croissance, tour 5) : qui s'en charge (votre contact, sinon l'équipe) et le délai.
        const quiModif = act === "envoyer-modif" ? (contactDe(await monContact()).prenom || t("contact.equipe.min")) : "";
        a.querySelectorAll("[data-a]").forEach(x => { x.disabled = true; });
        try { if (act === "envoyer-modif") await D.valider(id, "modification", a.querySelector("[data-mot]").value); else if (act === "refuse-ok") await D.valider(id, "refuse", a.querySelector("[data-motif]").value); else await D.valider(id, act); }
        catch (er) { a.querySelectorAll("[data-a]").forEach(x => { x.disabled = false; }); throw er; }
        approuveRecent = act === "approuve" ? { id, p: await publicationDe(id) } : null;
        const p = approuveRecent && approuveRecent.p;
        // 27/10/2026 (constat 32) : ce qui se passe ensuite, pas seulement « Enregistré ».
        const absents = act === "approuve" ? absentsDe(id) : [];
        await apres();
        const conf = (legende ? legende + " " : "") + (act === "approuve" ? (p ? t("dec.valide.prevu.res", { quand: I.dateHeureDans(p.prevu_le), res: I.liste(ORDRE_RES.filter(r => (p.reseaux || []).includes(r)).map(r => RES[r])) }) : t("dec.valide"))
          + (absents.length ? " " + t("res.absent.phrase", { res: I.liste(absents.map(r => RES[r])) }) : "") : act === "envoyer-modif" ? t("dec.modif.envoyee", { qui: quiModif }) : t("dec.refuse.msg"));
        // Un seul message (31/10/2026) : la confirmation flottante, pas en plus une ligne en haut de l'écran.
        msg(""); toast(conf); majCompteurs();
      } catch (er) { msg(ph(er.message)); }
    }));
  }
  function brancherAvis(racine, apres) {
    racine.querySelectorAll("[data-avis]").forEach(a => a.addEventListener("click", async ev => {
      const b = ev.target.closest("[data-a]"); if (!b) return;
      try { await D.validerAvis(a.dataset.avis, b.dataset.a, b.dataset.a === "valide" ? a.querySelector("[data-texte]").value : null); await apres(); msg(t(b.dataset.a === "valide" ? "rep.validee.msg" : "rep.refusee.msg")); majCompteurs(); } catch (er) { msg(ph(er.message)); }
    }));
  }
  const reponseAValider = x => `<div class="f"><label for="rep-${e(x.id)}">${t("rep.proposee")}</label><textarea id="rep-${e(x.id)}" class="haut-texte" data-texte${lc()}>${e(x.reponse_proposee || "")}</textarea></div>
    <div class="actions"><button type="button" class="bouton" data-a="valide">${t("rep.valider")}</button><button type="button" class="lien" data-a="refuse">${t("rep.refuser")}</button></div>`;
  const etoiles = n => n == null ? t("note.effacee") : t("etoiles", { n });
  // Avis de plus de 30 jours : texte, note et auteur effacés (règle « Content storage » de l'API Google Business Profile) ; notre réponse reste.
  const citation = x => x.efface_le ? `<p class="note efface">${t("avis.efface")}</p>` : x.texte ? `<p class="citation"${lc()}>${t("guillemets", { x: e(x.texte) })}</p>` : `<p class="citation">${t("avis.sans.texte")}</p>`;
  // Motifs d'un avis sensible : la base écrit « sante » (moteur/avis/regles.js) ; le commerçant lit « santé » (22/10/2026 : pas d'étiquette technique).
  const raisonsTexte = l => (l || []).map(r => ph(r === "sante" ? "santé" : r)).join(", ");

  // ---------------- Aperçu au format du réseau et légende par réseau (Contenus et Accueil)
  // Un cadre sobre qui rappelle la publication sur chaque réseau. Aucun logo de marque : le nom du réseau suffit.
  // Ordre fixe d'affichage partout (31/10/2026, test client Croissance, tour 5) : Instagram, Facebook, TikTok, puis la fiche Google.
  const ORDRE_RES = ["instagram", "facebook", "tiktok", "google"];
  const vus = new Map(), choixRes = {}, parReseau = new Set();   // contenu affiché (id -> {x, u, v}) ; réseau choisi par contenu
  let nomCommerce = "", commerceVu = null, comptesVus = null;
  // Réseaux d'un contenu pour le commerce affiché (30/10/2026, bug vu par PJ) : format ET offre ET réseaux retenus. Essentiel : la fiche Google seule,
  // donc aucun onglet ni aucune mention d'Instagram, Facebook ou TikTok. Croissance et Premium : leurs réseaux retenus, plus la fiche Google.
  // Où ça part vraiment (31/10/2026) : M.destinations, la même règle que la programmation (donnees.js) et la page de validation. Un réseau de l'offre
  // pas encore connecté garde son onglet, grisé, avec la phrase « ne partira pas » ; il n'est jamais annoncé dans les réseaux programmés.
  const destDe = x => M.destinations(x, commerceVu ? window.RENOM_RESEAUX_AUTORISES(commerceVu) : null, comptesVus);
  const resDe = x => destDe(x).reseaux;
  const absentsDe = id => { const v = vus.get(id); return v ? destDe(v.x).absents.filter(r => r !== "google") : []; };
  // TikTok déjà demandé (31/10/2026, test client Premium, tour 5) : la date de la demande, sans lien (plus de « Activer TikTok avec l'équipe »).
  const tiktokDejaDemande = () => commerceVu ? tiktokDemande(commerceVu) : "";
  const noteAbsent = r => r === "tiktok" && tiktokDejaDemande() ? `<p class="note res-absent-note" data-absent="${r}" data-tiktok-demande>${t("res.absent", { res: RES[r] })} ${t("acc.act.tiktok.demande", { d: date(tiktokDejaDemande()) })}</p>`
    : `<p class="note res-absent-note" data-absent="${r}">${t("res.absent", { res: RES[r] })} <a href="#/comptes${r === "tiktok" ? "?tiktok" : ""}">${r === "tiktok" ? t("acc.act.tiktok") : t("res.absent.lien", { res: RES[r] })}</a></p>`;
  const resChoisi = id => { const l = resDe(vus.get(id).x); return l.includes(choixRes[id]) ? choixRes[id] : ORDRE_RES.find(k => l.includes(k)) || "google"; };
  // Légende identique sur tous les réseaux du contenu (31/10/2026) : une seule vue, sans onglets ; les réseaux concernés sont nommés sous l'aperçu.
  const legendeCommune = x => { if (parReseau.has(x.id)) return null; const l = ORDRE_RES.filter(k => resDe(x).includes(k)); return l.length > 1 && l.every(k => M.legendeDe(x, k) === M.legendeDe(x, l[0])) ? l : null; };
  // Légende repliée sur téléphone (01/11/2026, tour 7 Premium, décision prise) : 3 lignes et « Lire la suite » (style.css), pour que Valider et
  // Modifier viennent juste sous le visuel. Ordinateur : la légende entière, sans le bouton.
  const lireSuite = l => M.longueur(l) > 110 || /\n/.test(l) ? `<button type="button" class="lien lire-suite" data-lire-suite aria-expanded="false">${t("leg.lire.suite")}</button>` : "";
  // Tour 12 (v38) : plus de « N caractères » sous l'aperçu pour le commerçant (le compteur reste pendant la modification de la légende) ; seule
  // reste la phrase utile, quand la légende dépasse la limite de la fiche Google.
  const trop = (n, lim) => lim && n > lim ? `<p class="note" data-compte>${t("car", { n })}${t("car.sur", { lim: nombre(lim) })}${t("car.trop.google")}</p>` : "";
  function cadre(id) {
    const { x, u: u45, v, u9 } = vus.get(id), commun = legendeCommune(x);
    if (commun) {
      const f = M.formatDe(x), l = M.legendeDe(x, commun[0]), n = M.longueur(l), lim = commun.includes("google") ? M.LIMITE_GOOGLE : 0;
      const visuel = v ? `<video class="visuel" controls preload="metadata" poster="${e(u45 || "")}" src="${e(v)}"></video>` : u45 ? `<span class="visuel-zone"><img class="visuel" src="${e(u45)}" alt="${t("visuel.alt")}"><button type="button" class="agrandir" data-agrandir aria-label="${e(t("visuel.agrandir"))}" title="${e(t("visuel.agrandir"))}">${LOUPE}</button></span>` : `<div class="visuel vide">${t("apercu.indispo")}</div>`;
      return `<div class="cadre cadre-commun${f !== "publication" ? " vertical" : ""}"><div class="cadre-tete"><span class="avatar" aria-hidden="true">${e((nomCommerce || "R").charAt(0).toUpperCase())}</span><span class="cadre-nom">${e(nomCommerce)}</span>${f === "story" ? `<span class="cadre-res">${t("cadre.story.seule")}</span>` : ""}</div>
        ${visuel}<p class="cadre-texte" data-legende${lc()}>${e(l)}</p>${lireSuite(l)}</div>
        <p class="note" data-res-communs>${t("res.memes", { res: I.liste(commun.filter(k => !absentsDe(id).includes(k)).map(k => RES[k])) })}</p>${absentsDe(id).filter(k => commun.includes(k)).map(noteAbsent).join("")}
        ${trop(n, lim)}`;
    }
    const r = resChoisi(id), f = M.formatDe(x), vertical = f !== "publication" || r === "tiktok";
    const u = r === "tiktok" && M.photoPublication(x) ? u9 : u45;   // TikTok : le visuel 9:16 qui part réellement, jamais le 4:5 dans un cadre vertical
    // Offre sans réseaux sociaux (Essentiel, 01/11/2026, tour 7) : pas de « Choisissez Instagram… », il n'y a rien à choisir.
    if (!resDe(x).includes(r)) return `<div class="cadre-vide"><p class="texte2">${t(f === "video" ? "cadre.video.google" : "cadre.story.google")}</p>${commerceVu && sansReseaux(commerceVu) ? "" : `<p class="note">${t("cadre.choisir")}</p>`}</div>`;
    const l = M.legendeDe(x, r), n = M.longueur(l), lim = r === "google" ? M.LIMITE_GOOGLE : 0;
    const visuel = v ? `<video class="visuel" controls preload="metadata" poster="${e(u || "")}" src="${e(v)}"></video>` : u ? `<span class="visuel-zone"><img class="visuel" src="${e(u)}" alt="${t("visuel.alt")}"><button type="button" class="agrandir" data-agrandir aria-label="${e(t("visuel.agrandir"))}" title="${e(t("visuel.agrandir"))}">${LOUPE}</button></span>` : `<div class="visuel vide">${t("apercu.indispo")}</div>`;
    const tete = `<div class="cadre-tete"><span class="avatar" aria-hidden="true">${e((nomCommerce || "R").charAt(0).toUpperCase())}</span><span class="cadre-nom">${e(nomCommerce)}</span><span class="cadre-res">${RES[r]}${f === "story" ? t("cadre.story") : ""}</span></div>`;
    const texte = `<p class="cadre-texte" data-legende${lc()}>${r === "instagram" && f === "publication" ? `<span class="fort">${e(nomCommerce)}</span> ` : ""}${e(l)}</p>${lireSuite(l)}`;
    const corps = r === "facebook" ? tete + (f === "publication" ? texte + visuel : visuel + texte) : r === "tiktok" ? visuel + tete + texte : tete + visuel + texte;
    return `${absentsDe(id).includes(r) ? noteAbsent(r) : ""}<div class="cadre cadre-${r}${vertical ? " vertical" : ""}${absentsDe(id).includes(r) ? " absent" : ""}">${corps}</div>
      ${trop(n, lim)}`;
  }
  // Tour 12 (v38) : « apres » (les décisions d'un contenu à valider) se place juste sous l'aperçu, avant la modification de la légende ; il est
  // gardé tel quel (champ ouvert, texte saisi) quand on change d'onglet de réseau (redessinerReseaux).
  function blocReseaux(x, u, v, u9, apres) {
    vus.set(x.id, { x, u, v, u9 }); const r = resChoisi(x.id), modifiable = (x.statut === "a_valider" || x.statut === "approuve") && resDe(x).includes(r), commun = legendeCommune(x);
    // Onglets : seulement les réseaux où ce format peut partir (24/10/2026) : ni vidéo ni story sur la fiche Google, donc pas d'onglet « Fiche Google ».
    // Un seul réseau (Essentiel : la fiche Google) : aucun onglet, le cadre seul.
    // Légende identique partout (31/10/2026) : pas d'onglets, une seule vue (voir legendeCommune) ; « Modifier la légende » change alors celle de tous ces réseaux.
    const ordre = ORDRE_RES.filter(k => resDe(x).includes(k)), onglets = ordre.length > 1 && !commun;
    return `<div class="reseaux" data-reseaux="${e(x.id)}"${commun ? ` data-commun="${commun.join(" ")}"` : ""}>
      ${onglets ? `<div class="res-onglets" role="tablist" aria-label="${t("res.onglets")}">${ordre.map(k => `<button type="button" role="tab" id="t-${e(x.id)}-${k}" data-res="${k}" aria-selected="${k === r}" tabindex="${k === r ? 0 : -1}"${absentsDe(x.id).includes(k) ? ` class="res-absent" aria-describedby="t-${e(x.id)}-${k}-n"` : ""}>${k === "google" ? `<span class="lib-long">${RES[k]}</span><span class="lib-court">Google</span>` : RES[k]}${absentsDe(x.id).includes(k) ? `<span class="vh" id="t-${e(x.id)}-${k}-n">${t("res.absent.court")}</span>` : ""}</button>`).join("")}</div>` : ""}
      <div class="res-panneau"${onglets ? ` role="tabpanel" aria-labelledby="t-${e(x.id)}-${r}"` : ""}>${cadre(x.id)}</div>
      ${apres != null ? `<div class="apres-cadre" data-apres-cadre>${apres}</div>` : ""}
      ${modifiable ? `<div class="f" data-edition hidden><label for="leg-${e(x.id)}">${commun ? t("leg.commune") : t("leg.pour", { res: RES[r] })}</label><textarea id="leg-${e(x.id)}" class="haut-texte" data-texte-legende${lc()}></textarea>
        <p class="note" data-compte-edition aria-live="polite"></p>
        <div class="actions"><button type="button" class="bouton petit" data-a="leg-enregistrer">${t("leg.enregistrer")}</button><button type="button" class="lien" data-a="leg-annuler">${t("annuler")}</button></div></div>
        <button type="button" class="lien leg-modifier" data-a="leg-modifier">${commun ? t("leg.modifier.commune") : t("leg.modifier", { res: RES[r] })}</button>${commun ? `<button type="button" class="lien leg-modifier" data-a="leg-detail">${t("leg.un.reseau")}</button>` : ""}` : ""}
    </div>`;
  }
  // Avant de valider une publication photo : les deux visuels qui partent, côte à côte, à la même hauteur, avec leurs réseaux.
  // 4:5 pour Instagram, Facebook et Google ; 9:16 pour TikTok (metricool_api.chemin_media). Story et vidéo : un seul fichier, rien à montrer de plus.
  const fig = (u, alt, res, fmt, cls) => `<figure class="format ${cls}">${u ? `<img src="${e(u)}" alt="${alt}">` : `<div class="format-vide"><p class="note">${t("apercu.indispo")}</p></div>`}
    <figcaption><span class="fort">${res}</span><span class="note">${fmt}</span></figcaption></figure>`;
  // Sans TikTok (Essentiel : fiche Google seule ; ou TikTok non retenu) : un seul visuel part, pas de bloc « Ce qui part sur chaque réseau ».
  const formatsPublies = (x, u, u9) => M.photoPublication(x) && resDe(x).includes("tiktok") ? `<details class="formats" aria-label="${t("fmt.titre")}"><summary class="fort">${t("fmt.titre")}</summary>
    <div class="formats-rangee">${fig(u, t("fmt.alt.45"), t("fmt.res.45"), t("fmt.45"), "f45")}${fig(u9, t("fmt.alt.916"), t("fmt.res.916"), t("fmt.916"), "f916")}</div>
    <p class="note">${t("fmt.note")}</p></details>` : "";
  const compteEdition = (r, x) => { const n = M.longueur(x), lim = r === "google" ? M.LIMITE_GOOGLE : 0; return `${t("car", { n })}${lim ? t("car.sur", { lim: nombre(lim) }) : ""}${lim && n > lim ? t("car.trop.google.phrase") : ""}`; };
  // Réseau dont la limite s'applique pendant l'édition : la fiche Google si la légende commune y part aussi.
  const resEdition = b => b.dataset.commun && b.dataset.commun.split(" ").includes("google") ? "google" : resChoisi(b.dataset.reseaux);
  function redessinerReseaux(b, focus) {
    const id = b.dataset.reseaux, { x, u, v, u9 } = vus.get(id), garde = b.querySelector(":scope > [data-apres-cadre]"); const d = document.createElement("div"); d.innerHTML = blocReseaux(x, u, v, u9, garde ? "" : null); const neuf = d.firstElementChild; b.replaceWith(neuf);
    if (garde) neuf.querySelector(":scope > [data-apres-cadre]").replaceWith(garde);
    if (focus) neuf.querySelector(`[data-res="${choixRes[id]}"]`).focus();
  }
  // Programmer au meilleur créneau : réseaux connectés compatibles avec le format, créneau de départ du métier.
  async function programmerAuto(id) { const { quand, res } = await programmerAutoQuand(id); return t("auto.programme", { quand: I.dateHeureDans(quand), res: res.map(r => RES[r]).join(", ") }); }
  // « Programmer tout » (tour 8) : [contenu, lot] dans l'ordre des gestes. Stories et contenus du jour (M.duJour) d'abord, sans lot (premier créneau
  // libre) ; les autres ensuite, avec leur rang parmi eux seuls (jour_lot / jourLot les étale sur le mois).
  const lotProgrammer = l => { const jour_ = l.filter(x => M.duJour(x)), autres = l.filter(x => !M.duJour(x));
    return [...jour_.map(x => [x, null]), ...autres.map((x, i) => [x, { rang: i, nombre: autres.length }])]; };
  async function programmerAutoQuand(id, lot) {
    const [x, cpt] = await Promise.all([D.contenus().then(l => l.find(y => y.id === id)), D.comptes()]);
    if (!x) throw new Error(t("err.contenu.introuvable"));
    const res = cpt.filter(k => k.etat === "connecte").map(k => k.reseau).filter(r => resDe(x).includes(r));
    if (!res.length) throw new Error(t("err.aucun.reseau"));
    const quand = await D.programmerAuto(id, res, lot); approuveRecent = null;
    return { quand, res };
  }
  // Phrase « Créneaux prévus… » (31/10/2026, test client Premium) : une seule fois, en tête de l'onglet Validées (noteCreneaux), et sous les boutons de
  // la carte de proposition (avec note) ; plus répétée sur chaque carte validée.
  const noteCreneaux = metier => `<p class="note" id="note-creneaux">${t("auto.creneaux", { h: creneauxTexte(metier), fuseau: t("fuseau." + M.paysDe(commerceVu && commerceVu.pays)) })}</p>`;
  const boutonsAuto = (id, metier, note) => `<div class="actions"><button type="button" class="bouton" data-auto="${e(id)}">${t("auto.bouton")}</button><a class="bouton second" href="#/calendrier?contenu=${encodeURIComponent(id)}">${t("auto.moi")}</a></div>
    ${note ? noteCreneaux(metier) : ""}`;
  async function proposition(c) {
    if (!approuveRecent) return "";
    // Programmé à l'approbation : la date et les réseaux, une fois, à la place du bouton.
    // Programmé à l'approbation : la confirmation flottante dit déjà la date et les réseaux (31/10/2026) ; pas de carte en plus.
    if (approuveRecent.p) { approuveRecent = null; return ""; }
    const x = (await D.contenus()).find(y => y.id === approuveRecent.id);
    if (!x || x.statut !== "approuve") { approuveRecent = null; return ""; }
    return `<section class="carte proposition" id="proposition"><div><p class="fort">${t("prop.titre")}</p><p class="texte2">${t("prop.texte")}</p></div>${boutonsAuto(x.id, c.metier, true)}</section>`;
  }
  // Enregistre la légende ouverte d'un bloc de réseaux (31/10/2026, test client : modification perdue en tapant Approuver ou un autre onglet).
  // Rend la phrase de confirmation, ou "" s'il n'y avait rien à enregistrer. Légende commune : la fiche Google d'abord (sa limite refuse avant toute écriture).
  async function sauverLegende(b) {
    const ed = b && b.querySelector("[data-edition]"), ta = b && b.querySelector("[data-texte-legende]"); if (!ed || ed.hidden || !ta) return "";
    const id = b.dataset.reseaux, r = resChoisi(id), communs = b.dataset.commun ? b.dataset.commun.split(" ").sort((p, q) => (q === "google") - (p === "google")) : null;
    if (ta.value.trim() === M.legendeDe(vus.get(id).x, communs ? communs[0] : r).trim()) return "";
    if (communs) { for (const k of communs) await D.modifierLegende(id, k, ta.value); } else await D.modifierLegende(id, r, ta.value);
    const x = vus.get(id).x; x.legendes = Object.assign({}, x.legendes || {}, Object.fromEntries((communs || [r]).map(k => [k, ta.value.trim()])));
    return communs ? t("leg.enregistree.commune", { res: I.liste(ORDRE_RES.filter(k => communs.includes(k)).map(k => RES[k])) }) : t("leg.enregistree", { res: RES[r] });
  }
  const sauverEditionOuverte = racine => sauverLegende(racine.querySelector("[data-reseaux]"));
  // Changement d'écran pendant une modification de légende : enregistrée quand même (l'erreur éventuelle s'affiche en confirmation flottante).
  addEventListener("hashchange", () => { vue.querySelectorAll("[data-reseaux]").forEach(b => { sauverLegende(b).then(m => { if (m) toast(m); }).catch(er => toast(ph(er.message))); }); });
  // Un seul écouteur pour tout l'écran : onglets de réseau, édition de la légende, programmation au meilleur créneau.
  let ecranCourant = null;
  vue.addEventListener("click", async ev => {
    const ls = ev.target.closest("[data-lire-suite]");
    if (ls) { const p = ls.previousElementSibling, ouvert = ls.getAttribute("aria-expanded") === "true"; if (p) p.classList.toggle("deplie", !ouvert);
      ls.setAttribute("aria-expanded", String(!ouvert)); ls.textContent = t(ouvert ? "leg.lire.suite" : "leg.replier"); return; }
    const onglet = ev.target.closest("[data-res]");
    if (onglet) { const b = onglet.closest("[data-reseaux]"); let m = "";
      try { m = await sauverLegende(b); } catch (er) { toast(ph(er.message)); return; }   // légende refusée (trop longue…) : on reste sur l'onglet
      choixRes[b.dataset.reseaux] = onglet.dataset.res; redessinerReseaux(vue.querySelector(`[data-reseaux="${CSS.escape(b.dataset.reseaux)}"]`) || b, true); if (m) toast(m); return; }
    const auto = ev.target.closest("[data-auto]");
    if (auto) { auto.disabled = true; try { const m = await programmerAuto(auto.dataset.auto); await ecranCourant(); toast(m); majCompteurs(); } catch (er) { auto.disabled = false; toast(ph(er.message)); } return; }
    const a = ev.target.closest("[data-a^='leg-']"); if (!a) return;
    const b = a.closest("[data-reseaux]"), id = b.dataset.reseaux, r = resChoisi(id), ed = b.querySelector("[data-edition]"), ta = b.querySelector("[data-texte-legende]"), bt = b.querySelector(".leg-modifier");
    if (a.dataset.a === "leg-modifier") { ta.value = M.legendeDe(vus.get(id).x, r); b.querySelector("[data-compte-edition]").textContent = compteEdition(resEdition(b), ta.value); ed.hidden = false; bt.hidden = true; ta.focus(); return; }
    // Légende commune : « Modifier un seul réseau » rouvre les onglets (hashtags pour Instagram ou TikTok, refusés sur la fiche Google).
    if (a.dataset.a === "leg-detail") { parReseau.add(id); redessinerReseaux(b, false); const o = vue.querySelector(`[data-reseaux="${CSS.escape(id)}"] [role=tab][aria-selected=true]`); if (o) o.focus(); return; }
    if (a.dataset.a === "leg-annuler") { ed.hidden = true; bt.hidden = false; bt.focus(); return; }
    // « Appliquer aussi à Facebook et Fiche Google » (01/11/2026, tour 7 Premium) : proposé après l'enregistrement de la légende Instagram, pour les
    // réseaux de ce contenu. Fiche Google : jamais un numéro de téléphone (M.contientTelephone, même règle que le moteur) ; elle est alors laissée.
    if (a.dataset.a === "leg-appliquer") { const tx = M.legendeDe(vus.get(id).x, "instagram"), cibles = a.dataset.cibles.split(" "), faits = [], laisses = []; a.disabled = true;
      for (const k of cibles) { if (k === "google" && M.contientTelephone(tx)) { laisses.push(k); continue; } try { await D.modifierLegende(id, k, tx); faits.push(k); } catch (er) { laisses.push(k); } }
      await ecranCourant();
      toast((faits.length ? t("leg.appliquee", { res: I.liste(faits.map(k => RES[k])) }) : "") + (laisses.includes("google") && M.contientTelephone(tx) ? " " + t("leg.google.tel") : laisses.length ? " " + t("leg.non.appliquee", { res: I.liste(laisses.map(k => RES[k])) }) : ""));
      return; }
    const cibles = r === "instagram" && !b.dataset.commun ? [...b.querySelectorAll("[role=tab][data-res]")].map(x => x.dataset.res).filter(k => ["facebook", "google"].includes(k)) : [];
    try { const m = await sauverLegende(b); await ecranCourant(); toast(m || t("leg.inchangee"));
      const nb = m && cibles.length ? vue.querySelector(`[data-reseaux="${CSS.escape(id)}"]`) : null;
      if (nb) { const p = document.createElement("p"); p.className = "actions leg-appliquer"; p.innerHTML = `<button type="button" class="bouton second petit" data-a="leg-appliquer" data-cibles="${cibles.join(" ")}">${t("leg.appliquer", { res: I.liste(cibles.map(k => RES[k])) })}</button>`; nb.appendChild(p); }
    } catch (er) { msg(ph(er.message)); toast(ph(er.message)); }
  });
  vue.addEventListener("input", ev => { const ta = ev.target.closest("[data-texte-legende]"); if (!ta) return; const b = ta.closest("[data-reseaux]"); b.querySelector("[data-compte-edition]").textContent = compteEdition(resEdition(b), ta.value); });
  vue.addEventListener("keydown", ev => {
    const k = ev.target.closest("[data-res]"); if (!k || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(ev.key)) return; ev.preventDefault();
    const b = k.closest("[data-reseaux]"), ordre = [...b.querySelectorAll("[role=tab][data-res]")].map(x => x.dataset.res), n = ordre.length, i = ordre.indexOf(k.dataset.res);
    const j = ev.key === "Home" ? 0 : ev.key === "End" ? n - 1 : (i + (ev.key === "ArrowRight" ? 1 : n - 1)) % n;
    choixRes[b.dataset.reseaux] = ordre[j]; redessinerReseaux(b, true);
  });

  // ---------------- Navigation (25/10/2026, décision de PJ : « c'est trop, ajuste ») : le restaurateur a 5 gestes à faire. 4 onglets (Accueil, Photos,
  // À valider, Résultats) et « Réglages » dans l'en-tête (téléphone) ou en bas de la barre latérale (ordinateur). Aucun écran n'est supprimé : chaque
  // ancienne adresse (#/contenus, #/offre, #/calendrier…) ouvre le même contenu, rangé dans l'un de ces cinq endroits.
  //   Accueil : ce qui attend le commerçant, les prochaines publications (calendrier complet en dessous : #/calendrier), l'idée de la semaine.
  //   Photos : le dépôt, et la vidéo d'avis dans le même écran (#/videoavis l'ouvre dépliée).
  //   À valider : une seule boîte, trois sections (Contenus, Avis, Commentaires) ; badge = tout ce qui attend une décision.
  //   Résultats : les résultats et le bilan du mois, puis la collecte d'avis (deux sections).
  //   Réglages : offre et factures, comptes connectés, notifications, style, fiche, fiche Google, démarrage.
  const GROUPES = [
    { id: "accueil", ecrans: ["accueil", "calendrier"] },
    { id: "photos", ecrans: ["photos", "videoavis"] },
    // 27/10/2026 (constat 33) : « Demander des avis » (collecte) est rangé avec les avis Google ; un retour privé non lu est une action de l'accueil.
    { id: "avalider", ecrans: ["avalider", "contenus", "avis", "commentaires", "collecte"], sections: ["contenus", "avis", "commentaires"], compte: "avalider" },
    { id: "resultats", ecrans: ["resultats"] },
  ];
  const REGLAGES = { id: "reglages", ecrans: ["reglages", "offre", "comptes", "notifications", "publications", "fiche", "fichegoogle", "demarrage"] };
  GROUPES.concat(REGLAGES).forEach(g => { g.nom = t("groupe." + g.id); });
  const ECRANS = I.carte("ecran", ["accueil", "resultats", "photos", "avalider", "contenus", "calendrier", "avis", "commentaires", "collecte", "fichegoogle", "fiche", "offre", "comptes",
    "notifications", "demarrage", "videoavis", "publications", "reglages"]);
  // Anciennes adresses : elles mènent toujours quelque part (aucun lien cassé).
  const ANCIENNES = { idees: "contenus", style: "publications" };   // #/style : ancien « Votre style » (31/10/2026)
  const groupeDe = r => GROUPES.concat(REGLAGES).find(g => g.ecrans.includes(r)) || GROUPES[0];
  const trait = d => `<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const APPAREIL = trait('<path d="M4 8h3l2-3h6l2 3h3v11H4z"></path><circle cx="12" cy="13" r="3.5"></circle>');
  const ICONES = {
    accueil: trait('<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"></path>'),
    photos: APPAREIL,
    avalider: trait('<rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M8.5 12.5l2.5 2.5 4.5-5"></path>'),
    resultats: trait('<path d="M4 20h16"></path><path d="M6 16l4-5 3 3 5-7"></path>'),
    reglages: trait('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"></path><circle cx="15" cy="7" r="2"></circle><circle cx="9" cy="17" r="2"></circle>'),
  };
  const GALERIE = trait('<rect x="4" y="4" width="16" height="16" rx="3"></rect><circle cx="9" cy="9.5" r="1.5"></circle><path d="M4 16l4.5-4.5 4 4 3-3L20 17"></path>');
  const CAMERA = trait('<rect x="3" y="7" width="13" height="10" rx="2"></rect><path d="M16 11l5-3v8l-5-3z"></path>');
  const FILM = trait('<rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M10 9l5 3-5 3z"></path>');
  const large = window.matchMedia("(min-width: 900px)");
  const nb = { contenus: 0, avis: 0, commentaires: 0, avalider: 0, retours: 0 }; let offreNom = "", route = "accueil", connecte = false, commentairesInclus = true;
  const compte = k => `<span class="nb" data-nb="${k}"${nb[k] ? "" : " hidden"}><span data-n>${nb[k] || ""}</span><span class="vh">${t("nav.a.traiter")}</span></span>`;
  const COMPTE_ECRAN = { contenus: "contenus", avis: "avis", commentaires: "commentaires" };
  // Lien d'un groupe : il mène au premier écran du groupe ; data-ecrans liste tous ses écrans (le lien reste allumé sur chacun).
  // Calendrier ouvert par « Choisir moi-même » (#/calendrier?contenu=…, 31/10/2026, test client Premium) : l'onglet allumé reste celui d'où l'on vient
  // (À valider), pas Accueil ; le lien de retour y ramène.
  let navActif = null;
  const groupeActif = () => { if (route !== "calendrier" || !/(?:^|&)contenu=/.test(paramRoute)) return groupeDe(route);
    const de = derniere && derniere !== route ? derniere : (origines.calendrier || {}).route, g = de && GROUPES.find(x => x.ecrans.includes(de)); return g || groupeDe(route); };
  const lienGroupe = (g, icone) => `<a href="#/${g.ecrans[0]}" data-r="${g.ecrans[0]}" data-ecrans="${g.ecrans.join(" ")}"${(navActif ? g === navActif : g.ecrans.includes(route)) ? ` aria-current="${g.ecrans[0] === route ? "page" : "true"}"` : ""}>${icone
    ? `<span class="onglet-icone">${ICONES[g.id]}${g.compte ? compte(g.compte) : ""}</span><span>${g.nom}</span>` : `<span>${g.nom}</span>${g.compte ? compte(g.compte) : ""}`}</a>`;
  function dessinerNav() {
    document.body.classList.toggle("hors-session", !connecte);
    const lat = $("lat"), haut = $("haut"), sous = $("sous"), onglets = $("onglets");
    lat.innerHTML = haut.innerHTML = sous.innerHTML = onglets.innerHTML = "";
    if (!connecte) return;
    const actif = groupeActif(); navActif = actif.ecrans.includes(route) || actif !== groupeDe(route) ? actif : null;
    // Sections d'un écran en plusieurs parties (À valider, Résultats) : une rangée de liens au-dessus du contenu, sur téléphone comme sur ordinateur.
    const secs = (actif.ecrans.includes(route) ? actif.sections || [] : []).filter(r => r !== "commentaires" || commentairesInclus || route === r);
    sous.innerHTML = secs.length > 1 ? secs.map(r => `<a href="#/${r}" data-r="${r}"${r === route ? ' aria-current="page"' : r === "avis" && route === "collecte" ? ' aria-current="true"' : ""}><span>${r === "avis" ? `<span class="lib-long">${ECRANS[r]}</span><span class="lib-court">${t("ecran.avis.court")}</span>` : ECRANS[r]}</span>${COMPTE_ECRAN[r] ? compte(COMPTE_ECRAN[r]) : ""}</a>`).join("") : "";
    sous.setAttribute("aria-label", actif.nom);
    if (large.matches) {
      lat.innerHTML = `<div class="lat-in"><a class="logo" href="#/accueil" translate="no"><img class="logo-img" src="icones/logo-ligne-encre.png?v=pascal" width="482" height="80" alt="boost impact."></a><nav id="nav" class="menu" aria-label="${t("nav.espace")}"><div class="groupe">${GROUPES.map(g => lienGroupe(g)).join("")}</div>
        <div class="groupe groupe-reglages">${lienGroupe(REGLAGES)}</div></nav><div class="lat-pied">${I.selecteur()}<button type="button" id="sortir" class="quitter">${t("quitter")}</button></div></div>`;
      return;
    }
    haut.innerHTML = `<a class="logo" href="#/accueil" translate="no"><img class="logo-img" src="icones/logo-ligne-encre.png?v=pascal" width="482" height="80" alt="boost impact."></a><span class="haut-note" id="haut-offre">${offreNom ? t("offre.nom", { nom: e(offreNom) }) : ""}</span>${I.selecteur()}<nav class="haut-reglages" aria-label="${REGLAGES.nom}">${lienGroupe(REGLAGES, true)}</nav>`;
    onglets.setAttribute("aria-label", t("nav.espace"));
    onglets.innerHTML = GROUPES.map(g => lienGroupe(g, true)).join("");
  }
  // UN SEUL compteur (01/11/2026, tour 6 Croissance) pour l'accueil, le badge « À valider » et Résultats : les décisions (contenus à valider,
  // réponses d'avis à valider et avis sensibles à décider, commentaires à valider ou à lire) ; « à programmer » (approuvés restés sans date alors
  // qu'un réseau de l'offre est connecté) compté à part : « 2 décisions, 4 à programmer ».
  const sansDateDe = (ct, cal, cpt, c) => { const connectes = (cpt || []).filter(k => k.etat === "connecte").map(k => k.reseau), occupes = new Set((cal || []).filter(p => ["programme", "envoye", "publie"].includes(p.statut)).map(p => p.contenu_id));
    return ct.filter(x => x.statut === "approuve" && !horsOffreContenu(x, c) && !occupes.has(x.id) && resDe(x).some(r => connectes.includes(r))); };
  const compteDe = ({ ct, av, cm, k, c, cal, cpt }) => { const contenus = ct.filter(x => x.statut === "a_valider").length, avis = av.filter(x => (x.statut === "a_valider" && !x.sensible) || sensibleADecider(x, c)).length,
    commentaires = k.commentaires_inclus ? cm.filter(x => x.statut === "a_valider" || x.statut === "humain").length : 0;
    return { k, contenus, avis, commentaires, decisions: contenus + avis + commentaires, aProgrammer: sansDateDe(ct, cal, cpt, c).length }; };
  async function compterAValider() {
    const [ct, av, k, cm, c, cal, cpt] = await Promise.all([D.contenus(), D.avis(), D.compteur(), D.commentaires().catch(() => []), D.commerce(), D.calendrier().catch(() => []), D.comptes().catch(() => null)]);
    return compteDe({ ct, av, cm, k, c, cal, cpt });
  }
  async function majCompteurs() {
    try {
      const n = await compterAValider();
      nb.contenus = n.contenus; nb.avis = n.avis; nb.commentaires = n.commentaires; nb.avalider = n.decisions;
      offreNom = n.k.offre || n.k.offre_nom || "";   // identifiant : le nom vient de moteur/offres.json, dans la langue de la page
      if (commentairesInclus !== !!n.k.commentaires_inclus) { commentairesInclus = !!n.k.commentaires_inclus; dessinerNav(); }
      nb.retours = await retoursNonLus();   // ---- Collecte
    } catch (er) { return; }
    document.querySelectorAll("[data-nb]").forEach(s => { const n = nb[s.dataset.nb]; s.hidden = !n; s.querySelector("[data-n]").textContent = n || ""; });
    const o = $("haut-offre"); if (o) o.textContent = offreNom ? t("offre.nom", { nom: offreNom }) : "";
  }
  // « À valider » sans section précisée : la première qui attend une décision (contenus, puis avis, puis commentaires), sinon les contenus.
  async function avalider() {
    let r = "contenus"; try { const n = await compterAValider(); r = ["contenus", "avis", "commentaires"].find(x => n[x]) || "contenus"; } catch (er) {}
    history.replaceState(null, "", "#/" + r); return rendre();
  }
  // Lien de retour d'un écran rangé dans Réglages ou sous l'accueil (texte simple, aucun menu).
  const retour = (href, cle) => `<p class="retour-liste"><a href="${href}">${t(cle)}</a></p>`;
  // Retour vers l'écran d'origine (31/10/2026, test client Premium) : chaque écran retient d'où l'on vient (adresse complète et libellé) ;
  // revenir en arrière ne remplace pas cette origine (pas d'aller-retour sans fin entre deux écrans). Sans origine (lien ouvert directement) :
  // le retour par défaut de l'écran.
  const origines = {};
  let hashPrecedent = "";
  function noterOrigine(de, vers, hashDe) {
    if (!de || de === vers) return;
    if (origines[de] && origines[de].route === vers) return;   // retour en arrière : l'origine de l'écran retrouvé reste la sienne
    origines[vers] = { route: de, hash: hashDe || "#/" + de };
  }
  const SECTIONS_AVALIDER = ["contenus", "avis", "commentaires"];
  const libelleRetour = r => r === "accueil" ? t("cal.retour") : r === "reglages" ? t("reg.retour")
    : t("retour.vers", { ecran: SECTIONS_AVALIDER.includes(r) ? t("ecran.avalider") : r === "photos" && sansVideoVu() ? t("ecran.photos.seules") : ECRANS[r] || t("ecran.accueil") });
  // Offre sans vidéo (Essentiel, Croissance) : « Retour aux photos », pas « aux photos et vidéos » (audit Essentiel du 31/10/2026).
  const sansVideoVu = () => !!commerceVu && !(+offreDe(commerceVu).videos > 0);
  const retourAuto = (href, cle) => { const o = origines[route]; return o ? `<p class="retour-liste"><a href="${e(o.hash)}">${libelleRetour(o.route)}</a></p>` : retour(href, cle); };
  const retourOrigine = () => retourAuto("#/reglages", "reg.retour");

  // ---------------- Connexion
  // Démonstration : les comptes affichés sont ceux de la graine chargée (parcours ou graine publique), jamais écrits en dur.
  const comptesTexte = l => I.liste(l.map(x => `${x.email} (${x.role === "administrateur" ? t("cx.console") : x.commerce || t("cx.commercant")})`), "ou");
  // Accès par mot de passe (17/10/2026) : écrans communs à l'espace et à la console, dans acces.js (connexion, choix du mot de passe).
  const ACC = window.RENOM_ACCES;
  // Après l'entrée (mot de passe, lien de démonstration) : la console pour l'administrateur, l'accueil pour le commerçant. Une session encore sans
  // mot de passe revient ici et rendre() montre le choix du mot de passe.
  const apresEntree = async () => { if (await D.estAdmin()) location.href = I.lien("console.html"); else aller("accueil"); };
  async function connexion() {
    const comptesDemo = D.mode === "demo" && D.comptesDemo ? await D.comptesDemo() : [];
    ACC.connexion({ vue, I, D, titre: t("cx.titre"), chapo: t("cx.chapo"), apres: apresEntree,
      extra: comptesDemo.length ? `<div class="entrer-demo" id="entrer-demo"><p class="fort">${t("cx.visite")}</p>${comptesDemo.map(c => `<button type="button" class="bouton second" data-entrer="${e(c.email)}">${c.role === "administrateur" ? t("cx.console.exploitant") : e(c.commerce || c.email)}</button>`).join("")}</div>
      <p class="note" id="comptes-demo">${t("cx.demo", { comptes: e(comptesTexte(comptesDemo)) })}</p>` : "",
      pied: `<p class="retour"><a href="../">${t("cx.retour.site")}</a></p>` });
  }
  // Visite directe de la démonstration (boutons sous le formulaire, redessinés quand on passe d'un mode de l'écran à l'autre).
  vue.addEventListener("click", async ev => { const b = ev.target.closest && ev.target.closest("[data-entrer]"); if (b && D.mode === "demo") { await D.ouvrirLien(b.dataset.entrer); await apresEntree(); } });
  // Lien d'email au nouveau format (?jeton=…&type=…, 26/10/2026) : écran à un bouton (acces.js, lienEmail) ; au clic, le lien est vérifié, puis
  // rendre() montre le choix du mot de passe (session née du lien). Lien expiré ou déjà servi : l'écran de connexion, « recevoir un nouveau lien ».
  const lienEmail = () => ACC.lienEmail({ vue, I, D, apres: () => rendre(), echec: () => connexion() });
  // Session ouverte par un lien d'email (invitation, mot de passe oublié) : seulement le choix du mot de passe, jamais l'espace.
  const choixMotDePasse = s => ACC.choixMotDePasse({ vue, I, D, email: s.email, apres: apresEntree, annuler: async () => { await D.quitter(); aller("accueil"); } });

  // ---------------- Automatisations de service : mise en route (4 étapes) et idée de la semaine
  const AU = window.RENOM_AUTO;
  const ETATS_MR = I.carte("mer.etat", ["a_faire", "declare", "fait"]);
  function blocMiseEnRoute(mr, c) {
    if (!mr || !mr.points || mr.faits >= mr.total) return "";
    // Plus rien à faire par le commerçant (points déclarés, en vérification par l'équipe) : la phrase de l'accueil suffit.
    if (mr.points.every(x => x.etat !== "a_faire" || (x.point === "google" && ficheDemandee(c)))) return "";
    // 27/10/2026 : titres de i18n.js dans toutes les langues (« Mise en route », « 5 questions sur votre commerce »).
    const lib = Object.fromEntries(AU.AUTO.POINTS.map(x => [x.point, { ...x, titre: I.a("mer.titre." + x.point) ? t("mer.titre." + x.point) : x.titre }]));
    return `<section class="carte mise-en-route" id="mise-en-route" aria-labelledby="mer-titre"><div class="carte-tete"><h2 id="mer-titre">${t("mer.titre", { a: mr.faits, b: mr.total })}</h2></div>
      ${jauge(mr.faits, mr.total)}
      <ol class="liste etapes">${mr.points.map(x => { const p = lib[x.point] || { titre: x.point, aide: "" };
        // 27/10/2026 (constat 3) : plus de marche à suivre en une phrase ici ; les étapes numérotées sont dans l'écran de la mise en route.
        const demande = x.point === "google" && x.etat === "a_faire" && ficheDemandee(c);
        const action = x.etat !== "a_faire" || demande ? "" : p.declarable ? `<a class="bouton second petit" href="#/miseenroute">${t("mer.voir.etapes")}</a>`
          : x.point === "demarrage" ? `<a class="bouton second petit" href="#/demarrage?questions">${t("mer.repondre")}</a>` : "";
        return `<li data-point="${e(x.point)}"><div><p class="fort">${e(p.titre)}</p>${x.etat === "fait" ? "" : `<p class="note">${t("mer.court." + x.point)}</p>`}</div>
          <div class="pile serre etape-etat"><span class="etat${x.etat === "fait" ? " actif" : ""}">${demande ? t("mer2.demande.etat") : ETATS_MR[x.etat] || e(x.etat)}</span>${action}</div></li>`; }).join("")}</ol></section>`;
  }
  const ORIGINES = I.carte("idee.origine", ["calendrier", "meteo", "saison"]);
  // Idée d'un jour férié (moteur/temps_forts, idee_ferie : « Vos horaires du jour férié ») : on y répond par ses horaires, pas par une photo.
  // Date du jour férié visé par l'idée (31/10/2026) : le premier jour férié à partir d'aujourd'hui (ou du lundi de la semaine de l'idée), sous 3 semaines.
  // Pays du commerce (commerces.pays, 'FR' par défaut, 'BE') : jours fériés de France ou de Belgique, comme la programmation (31/10/2026).
  const jourFerieProche = (semaine, pays) => { const auj = M.aujourdhui(), dep = semaine && semaine > auj ? semaine : auj, d = new Date(dep + "T12:00:00Z");
    for (let i = 0; i < 21; i++, d.setUTCDate(d.getUTCDate() + 1)) { const j = d.toISOString().slice(0, 10); if (M.estFerie(j, pays)) return j; } return ""; };
  const ideeHoraires = x => /^Vos horaires du jour férié/.test(String(x.titre || ""));
  // Idée de la semaine en anglais ou en néerlandais (31/10/2026, test client Premium) : l'idée est enregistrée en français (calendrier des temps
  // forts, vendor/temps-forts.json, mêmes textes que le workflow du lundi) ; l'espace la montre dans la langue d'affichage grâce aux traductions
  // du même fichier (« en », « nl », « nom_en », « nom_nl »), motif recomposé (événement et date, saison, prévision météo). Idée inconnue du
  // fichier (demande d'idées, texte de l'équipe) : telle quelle, dans la langue du commerce.
  let tfTrad = null;
  const chargerTraductionsIdees = () => tfTrad || (tfTrad = fetch("vendor/temps-forts.json").then(r => r.ok ? r.json() : null).then(j => {
    if (!j) return null; const textes = new Map(), noms = new Map(), saisons = new Map();
    const ajouter = i => { if (i && i.en && i.nl) textes.set(i.titre + "\n" + i.texte, i); };
    (j.evenements || []).forEach(ev => { (ev.idee && ev.idee.par_metier ? Object.values(ev.idee.par_metier) : [ev.idee]).forEach(ajouter); if (ev.nom_en) noms.set(ev.nom, ev); });
    (j.saisons || []).forEach(s => { Object.values(s.idees || {}).forEach(ajouter); saisons.set(s.nom, s); });
    Object.values((j.meteo || {}).idees || {}).forEach(m => Object.values(m).forEach(ajouter));
    return { textes, noms, saisons }; }).catch(() => null));
  const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const dateFr = s => { const m = /(\d{1,2})(?:er)? (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) (\d{4})/.exec(s || ""); return m ? new Date(+m[3], MOIS_FR.indexOf(m[2]), +m[1], 12) : null; };
  const jourIdee = d => I.langue === "en" ? I.jourEtDate(d) : I.minusculeDebut(I.jourEtDate(d));
  function ideeVue(x, T) {
    const lg = I.langue, brut = { titre: x.titre, texte: x.texte, motif: x.motif, traduite: false };
    if (!T || (lg !== "en" && lg !== "nl")) return brut;
    const i = T.textes.get(String(x.titre) + "\n" + String(x.texte)); if (!i) return brut;
    let motif = x.motif || "";
    const mc = /^(.+) : (.+\d{4})$/.exec(motif), ms = /^Saison en cours : (.+) \(saison météorologique\)$/.exec(motif);
    const mm = /^Prévision Open-Meteo pour (.+?\d{4})(?: à (.+?))? : (-?\d+) °C au plus, (?:([\d,]+) mm de pluie|sans pluie)$/.exec(motif);
    if (x.origine === "meteo" && mm) { const d = dateFr(mm[1]);
      motif = t("idee.motif.meteo", { d: d ? jourIdee(d) : mm[1], v: mm[2] ? t("idee.motif.a", { v: mm[2] }) : "", t: mm[3], p: mm[4] ? t("idee.motif.pluie", { mm: mm[4].replace(",", lg === "en" ? "." : ",") }) : t("idee.motif.sans.pluie") }); }
    else if (ms && T.saisons.get(ms[1])) motif = t("idee.motif.saison", { s: T.saisons.get(ms[1])["nom_" + lg] });
    else if (mc && T.noms.get(mc[1])) { const d = dateFr(mc[2]); motif = T.noms.get(mc[1])["nom_" + lg] + t("deux.points") + (d ? jourIdee(d) : mc[2]); }
    return { titre: i[lg].titre, texte: i[lg].texte, motif, traduite: true };
  }
  const lcIdee = v => v.traduite ? "" : lc();
  // Idée d'un jour férié (31/10/2026, test client Essentiel) : rédigée dans la langue d'affichage (le calendrier des temps forts est en français),
  // date du jour visé selon le pays du commerce ; les autres idées restent dans la langue du commerce (lang marqué).
  function blocIdeeSemaine(x, c, T) {
    if (!x) return ""; const v = ideeVue(x, T);
    const pays = M.paysDe(c && c.pays), jf = ideeHoraires(x) ? jourFerieProche(x.semaine, pays) : "", jour = jf ? I.jourEtDate(jf + "T12:00:00") : "";
    const google = !!c && offreDe(c).reseaux_sociaux === false;
    const corps = jf ? `<p class="fort">${t("idee.ferie.titre")}</p><p class="texte2">${t(google ? "idee.ferie.texte.google" : "idee.ferie.texte", { j: e(I.minusculeDebut(jour)) })}</p><p class="note">${t("idee.ferie.motif", { j: e(I.minusculeDebut(jour)) })}</p>`
      : `<p class="fort"${lcIdee(v)}>${e(v.titre)}</p><p class="texte2"${lcIdee(v)}>${e(v.texte)}</p>${v.motif ? `<p class="note"${lcIdee(v)}>${e(v.motif)}</p>` : ""}`;
    return `<section class="carte" id="idee-semaine" data-idee="${e(x.id)}" data-semaine="${e(x.semaine || "")}" data-pays="${pays}" aria-labelledby="idee-titre"><div class="carte-tete"><h2 id="idee-titre">${t("idee.semaine")}</h2><span class="note">${ORIGINES[x.origine] || ""}</span></div>
      ${corps}
      <div class="actions"><button type="button" class="bouton second" data-decider-idee="retenue"${ideeHoraires(x) ? ' data-vers-horaires="1"' : ""}>${t(ideeHoraires(x) ? "idee.horaires" : "idee.retenir")}</button><button type="button" class="lien" data-decider-idee="ecartee">${t("idee.ecarter")}</button></div>
      <p class="note">${t(ideeHoraires(x) ? "idee.note.horaires" : "idee.note")}</p></section>`;
  }
  function brancherAutomatisations(racine, apres) {
    racine.querySelectorAll("[data-declarer]").forEach(b => b.onclick = async () => { try { await D.declarerMiseEnRoute(b.dataset.declarer); await apres(); msg(t("mer.merci")); } catch (er) { msg(ph(er.message)); } });
    racine.querySelectorAll("[data-decider-idee]").forEach(b => b.onclick = async () => {
      const id = b.closest("[data-idee]").dataset.idee, d = b.dataset.deciderIdee;
      try { await D.deciderIdee(id, d); if (b.dataset.versHoraires) { typeAction = "horaires"; const z = b.closest("[data-idee]"), j = jourFerieProche(z.dataset.semaine, z.dataset.pays); aller("fichegoogle?horaires=" + (j || "")); return; } await apres(); msg(t(d === "retenue" ? "idee.retenue.msg" : "idee.ecartee.msg")); majCompteurs(); } catch (er) { msg(ph(er.message)); } });
  }

  // ---------------- Accueil (25/10/2026) : « ce que vous avez à faire maintenant ». En tête, un bouton par action en attente (contenus, réponses
  // d'avis, commentaires, mise en route, démarrage, photos du mois) ; puis les prochaines publications (le calendrier devient ce bloc ; le calendrier
  // complet reste à #/calendrier) ; puis l'idée de la semaine. Le bilan du mois est passé dans Résultats ; l'offre, la fiche et le style dans Réglages.
  // Bilan du mois : 4 chiffres au plus et une phrase. Mêmes données que l'email du 1er du mois (fonction bilan_mois).
  // Tour 11 (v37, 320 px : aucun chiffre au premier écran de Résultats en démonstration) : une seule ligne, le bilan remonte. L'explication complète
  // reste dans le nom accessible et l'infobulle (title) ; la carte du bilan redit déjà « Chiffres de démonstration. » avec sa phrase.
  const bandeauDemo = () => D.mode === "demo" ? `<p class="bandeau-demo" role="note" title="${e(t("demo.chiffres.texte"))}"><span class="fort">${t("demo.chiffres")}</span> <span class="note">${t("demo.chiffres.court")}</span></p>` : "";
  function bilanBloc(b, N) {
    if (!b) return "";
    const m = moisDe(b.mois || k0()), notes = b.note_debut != null && b.note_fin != null, n = x => +x || 0;
    const morceaux = [t("bilan.publie", { r: n(b.reponses_publiees), p: n(b.publications) }),
      t(b.avis_obtenus_source === "avis_recus" ? "bilan.recu" : "bilan.obtenu", { n: n(b.avis_obtenus) }) + (notes ? (b.note_fin === b.note_debut ? t("bilan.note.reste", { n: nombre(b.note_fin, 1) }) : t("bilan.note.passe", { a: nombre(b.note_debut, 1), b: nombre(b.note_fin, 1) })) : ".")];
    if (N && (N.decisions || N.aProgrammer)) morceaux.push(t("bilan.afaire", { x: t("compte.phrase", { n: N.decisions, p: N.aProgrammer, k: 0 }) }));   // compteur unique (compteDe)
    const chiffre = (lib, val) => `<div class="bilan-chiffre"><dt>${lib}</dt><dd class="chiffre">${val}</dd></div>`;
    const corps = `${D.mode === "demo" ? `<p class="note bilan-demo"><span class="fort">${t("demo.chiffres.point")}</span> ${t("bilan.demo")}</p>` : ""}
      <p class="texte2">${morceaux.join(" ")}</p>
      <dl class="bilan-chiffres">${chiffre(t("bilan.reponses"), nombre(n(b.reponses_publiees)))}${chiffre(t("bilan.publications"), nombre(n(b.publications)))}${chiffre(t("bilan.note"), notes ? nombre(b.note_fin, 1) : t("non.lue"))}${chiffre(t("bilan.avis"), nombre(n(b.avis_obtenus)))}</dl>`;
    // Tour 9 (01/11/2026) : le mois en cours reste replié tant que tout y est à zéro (réponses publiées, publications, avis obtenus) : le
    // 1er du mois, une carte de quatre zéros passait avant ce que la fiche a rapporté. Il s'ouvre d'un tap, rien n'est retiré.
    if (!n(b.reponses_publiees) && !n(b.publications) && !n(b.avis_obtenus)) return `<section class="carte bilan" id="bilan-mois" data-vide="1" aria-labelledby="bilan-titre"><details class="repliable" id="bilan-mois-repli"><summary><h2 id="bilan-titre">${t("bilan.titre", { mois: m.getMonth() })}</h2><span class="note">${t("bilan.rien.encore")}</span></summary>${corps}</details></section>`;
    return `<section class="carte bilan" id="bilan-mois" aria-labelledby="bilan-titre"><div class="carte-tete"><h2 id="bilan-titre">${t("bilan.titre", { mois: m.getMonth() })}</h2><span class="note">${t("bilan.a.ce.jour")}</span></div>
      ${corps}</section>`;
  }
  // Offre souscrite, en haut de l'accueil (26/10/2026, test réel de PJ : « Bonjour » et le nom du commerce, sans l'offre ; sur téléphone, la note de l'en-tête
  // est masquée sous 420 px). Nom de l'offre, une ligne sur ce qu'elle comprend (chiffres de moteur/offres.json, via window.RENOM_OFFRES), lien vers
  // l'écran Offre (Réglages). Texte sobre : ni badge, ni couleur d'accent.
  function offreAccueil(c) {
    const o = offreDe(c); if (!o.nom) return "";
    const ligne = t("acc.offre.inclus", { n: o.contenus ?? ((o.publications || 0) + (o.videos || 0)), p: o.publications || 0, v: o.videos || 0, g: o.reseaux_sociaux === false, cm: !!o.commentaires_disponible });   // même drapeau que l'offre (01/11/2026, tour 6 Croissance)
    return `<div class="offre-accueil" id="offre-accueil"><p class="fort" id="offre-accueil-nom">${e(t("offre.nom", { nom: c.offre_id }))}</p>
      <p class="texte2" id="offre-accueil-inclus">${e(ligne)}</p><p><a href="#/offre" id="offre-accueil-lien">${t("acc.voir.offre")}</a></p></div>`;
  }
  // Changement d'offre demandé (01/11/2026, tour 7 Essentiel) : une ligne sur l'accueil, tant que la demande a moins de 3 jours et qu'une offre au-dessus
  // existe encore (une fois l'offre changée par PJ, Premium n'a plus d'offre au-dessus ; Essentiel passé en Croissance garde la ligne au plus 3 jours).
  const ligneChgOffre = (c, d) => !d || !offreCible(c) || Date.now() - Date.parse(d) > 3 * 864e5 ? ""
    : `<p class="texte2" id="acc-chg-offre">${t("acc.chg.offre", Object.assign({ d: date(d) }, quandChgOffre(c, d)))} <a href="#/offre">${t("acc.voir.offre")}</a></p>`;
  // « Cette semaine » (27/10/2026, constat 10) : le travail fait pour le commerçant ces 7 derniers jours, seulement les chiffres réels et non nuls ;
  // rien du tout si tout est à zéro. Réponses aux avis publiées, publications parties, avis sensibles pris en charge, réponses aux commentaires.
  function ligneSemaine(c, av, cal, cm) {
    const t0 = Date.now() - 7 * 86400000, dans = d => !!d && Date.parse(d) >= t0 && Date.parse(d) <= Date.now();
    const n = { reponses: av.filter(x => x.statut === "publie" && !x.sensible && dans(x.repondu_le || x.traite_le)).length,
      publications: cal.filter(x => x.statut === "publie" && dans(x.publie_le || x.prevu_le)).length,
      sensibles: av.filter(x => x.sensible && dans(x.traite_le || x.propose_le || x.repondu_le)).length,
      commentaires: (cm || []).filter(x => x.statut === "publie" && dans(x.publie_le || x.decide_le)).length };
    const l = ["reponses", "publications", "sensibles", "commentaires"].filter(k => n[k]).map(k => t("acc.semaine." + k, { n: n[k] }));
    return l.length ? `<p class="texte2 semaine" id="cette-semaine">${t("acc.semaine", { l: I.liste(l) })} <a href="#/resultats">${t("acc.semaine.voir")}</a></p>` : "";
  }
  // « Vos publications de <mois> : le 4 et le 18 » (31/10/2026, test client Essentiel, tour 5) : les prochaines dates programmées, du mois de la prochaine.
  // Hors offre (01/11/2026, tour 6 Essentiel) : une publication qui « sera annulée » (horsOffreDe, même règle que son libellé) n'est pas annoncée.
  // Tour 9 (01/11/2026, Essentiel : trois dates en novembre pour une offre de 2 publications) : quand l'avis de la semaine (contenus.hors_plafond)
  // est parmi les dates du mois, la ligne le dit : « 2 publications + l'avis de la semaine (non compté) ».
  // Tour 11 (v37, Premium : « Vos publications de novembre : le 4, le 5, le 12 et le 21 » pour une offre de 12) : quand le plafond du mois n'est pas
  // atteint, « 4 sur 16 prévues ; les suivantes viendront avec vos prochaines photos. » N = contenus du mois (programmés ou déjà partis, photos et
  // vidéos, comme les dates de la ligne), sans l'avis de la semaine (non compté) ni les publications hors offre ; M = contenus de l'offre
  // (publications_plafond + videos_plafond : 2, 8 ou 16).
  // Tour 12 (v38) : UN seul compteur du mois. Le compteur de l'offre fait foi (vue compteur en base : contenus.mois, pas la date de publication) ;
  // l'accueil redit le même N que l'écran Offre et Photos : publications (faites et en préparation, pubReservees) + vidéos du mois (videos_utilisees),
  // sur publications_plafond + videos_plafond. Une date dont le contenu est compté sur un autre mois le dit (« compté en octobre ») ; l'avis de la
  // semaine aussi (« non compté »). Le compteur n'est donné que pour le mois en cours (celui de la vue compteur).
  const nMoisOffre = k => !k ? 0 : pubReservees(k) + (+k.videos_plafond > 0 ? +k.videos_utilisees || 0 : 0);
  const moisContenu = x => { const m = /^(\d{4})-(\d{2})/.exec(String((x.contenu && x.contenu.mois) || "")); return m ? { a: +m[1], m: +m[2] - 1 } : null; };
  // Mention d'une date (accueil, calendrier) : contenu compté sur un autre mois que celui de sa date, ou avis de la semaine (non compté).
  const mentionMois = x => { const d = new Date(x.prevu_le), mc = moisContenu(x);
    return x.contenu && x.contenu.hors_plafond ? t("acc.pub.avis.semaine") : mc && (mc.m !== d.getMonth() || mc.a !== d.getFullYear()) ? t("acc.pub.compte.en", { mois: MOIS[mc.m] }) : ""; };
  // prevu : les publications du mois sont toutes prévues (accueil, moisPrevu) ; alors pas de « Les suivantes viendront avec vos prochaines photos ».
  function ligneMois(cal, autorises, k, prevu) {
    const it = cal.filter(x => x.statut === "programme" && Date.parse(x.prevu_le) > Date.now() && !(autorises && horsOffreDe(x, autorises))).sort((a, b) => Date.parse(a.prevu_le) - Date.parse(b.prevu_le)); if (!it.length) return "";
    const d0 = new Date(it[0].prevu_le), m = d0.getMonth(), a = d0.getFullYear(), dansM = x => { const d = new Date(x.prevu_le); return d.getMonth() === m && d.getFullYear() === a; }, duM = it.filter(dansM);
    // Une entrée par jour et par mention (rien, compté sur un autre mois, avis de la semaine) : « le 5, le 12 (compté en octobre) et le 19 (avis de la semaine, non compté) ».
    const vus_ = new Set(), l = I.liste(duM.map(x => { const j = new Date(x.prevu_le).getDate(), mention = mentionMois(x);
      const cle = j + "|" + mention; if (vus_.has(cle)) return null; vus_.add(cle); return t("acc.pub.le", { j }) + mention; }).filter(Boolean));
    const plaf = (+(k && k.publications_plafond) || 0) + (+(k && k.videos_plafond) || 0), km = k && k.mois ? new Date(k.mois + "T12:00:00") : null;
    const compteur = plaf && km && km.getMonth() === m && km.getFullYear() === a ? (n => ` <span id="publications-du-mois-plafond" data-n="${n}" data-m="${plaf}">${t("acc.pub.mois.offre", { n, m: plaf, mois: MOIS[m], suite: !prevu })}</span>`)(nMoisOffre(k)) : "";
    return `<p class="texte2" id="publications-du-mois">${t("acc.pub.mois", { mois: MOIS[m], l })}${compteur} <a href="#/calendrier">${t("acc.ouvrir.calendrier")}</a></p>`;
  }
  // « Temps gagné ce mois-ci » (bilan) : estimation, réponses aux avis publiées × 10 min, publications parties × 20 min, vidéos × 45 min, depuis le 1er.
  const MINUTES_GAGNEES = { reponse: 10, publication: 20, video: 45 };
  // Du 1er au 5 du mois (01/11/2026, tour 6 Premium) : le mois écoulé, avec son nom (« Temps gagné en octobre »), au lieu d'un mois en cours presque vide.
  const debutDeMoisCivil = () => new Date().getDate() <= 5;
  const debutMoisPrecedent = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(); };
  // Du 1er au 5 (01/11/2026, tour 7 Premium) : calculé depuis le bilan du mois écoulé (bilanMois, même source que la carte Bilan de Résultats :
  // reponses_publiees, publications), pour que les deux écrans disent les mêmes chiffres. Le bilan ne distingue pas les vidéos : chaque
  // publication y compte 20 min. Le reste du mois : avis et calendrier, comme avant.
  // Tour 11 (v37) : une offre sans vidéo (Essentiel, Croissance) ne lit plus « 45 min par vidéo » dans l'estimation.
  function tempsGagne(av, cal, bilanP, avecVideos) {
    const prec = debutDeMoisCivil(), t0 = prec ? debutMoisPrecedent() : debutDuMois(), t1 = prec ? debutDuMois() : Date.now() + 1;
    const dans = d => !!d && Date.parse(d) >= t0 && Date.parse(d) < t1 && Date.parse(d) <= Date.now(), typeDe = x => (x.contenu && x.contenu.type) || x.type;
    const n = prec && bilanP ? (+bilanP.reponses_publiees || 0) * MINUTES_GAGNEES.reponse + (+bilanP.publications || 0) * MINUTES_GAGNEES.publication
      : av.filter(x => x.statut === "publie" && dans(x.repondu_le || x.traite_le || x.cree_le)).length * MINUTES_GAGNEES.reponse
      + cal.filter(x => x.statut === "publie" && dans(x.publie_le || x.prevu_le)).reduce((s_, x) => s_ + (typeDe(x) === "video" ? MINUTES_GAGNEES.video : MINUTES_GAGNEES.publication), 0);
    if (!n) return ""; const h = Math.floor(n / 60), mn = n % 60, d = h ? (mn >= 15 && mn < 45 ? t("acc.temps.hdemi", { h }) : t("acc.temps.h", { h: mn >= 45 ? h + 1 : h })) : t("acc.temps.min", { m: n });
    return `<p class="texte2 temps-gagne" id="temps-gagne"><span class="fort">${prec ? t("acc.temps.mois", { d, mois: MOIS[new Date(t0).getMonth()] }) : t("acc.temps", { d })}</span> <span class="note">${t(avecVideos ? "acc.temps.estimation" : "acc.temps.estimation.sans.video")}</span></p>`;
  }
  // Autorisation photos sur l'accueil : une ligne (texte complet dans Photos), plus jamais après « Non merci » (photos_autorisation_refusee_le).
  // Petite carte (01/11/2026, tour 8) : la question et une phrase qui dit à quoi sert l'autorisation (avant : une ligne seule, sans explication).
  // Un seul geste (01/11/2026, tour 9 : « Autoriser » menait à Photos, où il fallait cocher puis enregistrer) : le texte de l'accord est écrit dans la
  // carte, « Autoriser » l'enregistre tout de suite (D.autoriserPhotos, fonction autoriser_photos : même trace d'accord, datée, qu'avant).
  const ligneAutorisation = c => autorisationAJour(c) || c.photos_autorisation_refusee_le ? "" : `<section class="carte carte-autorisation" id="autorisation-ligne" aria-labelledby="aut-ligne-titre">
      <p class="fort" id="aut-ligne-titre">${t("aut.ligne")}</p><p class="texte2">${t(sansReseaux(c) ? "aut.ligne.explication.google" : "aut.ligne.explication")}</p>
      <p class="note" id="aut-ligne-accord">${t("aut.ligne.accord")} ${t(sansReseaux(c) ? "aut.case.google" : "aut.case", { comptes: I.liste(ORDRE_RES.filter(x => x !== "google" && window.RENOM_RESEAUX_AUTORISES(c).includes(x)).map(x => RES[x])) })}</p>
      <div class="ligne-autorisation"><button type="button" class="bouton second petit" id="aut-oui">${t("aut.autoriser")}</button>${merSql(c) ? `<button type="button" class="lien" id="aut-non">${t("aut.non")}</button>` : ""}</div></section>`;
  const k0 = () => new Date().toISOString().slice(0, 7) + "-01";
  const plusTard = id => { try { return localStorage.getItem("renom-demarrage-plus-tard:" + id) === "1"; } catch (er) { return false; } };
  // Photos du mois : aucune photo envoyée depuis le 1er du mois (heure de l'appareil), commerce actif.
  const debutDuMois = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
  // Incitation à passer en Croissance (Photos, limite atteinte) : une fois par mois au plus, gardée sur l'appareil ; toute la visite où elle est vue.
  let incitationVue = false;
  const incitationCroissance = c => { const k = "renom-incitation-croissance:" + c.id, m = new Date().toISOString().slice(0, 7);
    try { if (!incitationVue && localStorage.getItem(k) === m) return false; localStorage.setItem(k, m); } catch (er) {}
    incitationVue = true; return true; };
  const ACTIONS_VISIBLES = 3;
  async function accueil() {
    const c0 = await D.commerce();
    // Nom du commerce à confirmer (27/10/2026) : toujours d'abord, même après « Faire plus tard » (aucune demande d'avis ne part sans lui).
    if (nomAConfirmer(c0) || (!c0.demarrage_fini && !plusTard(c0.id))) return demarrage();
    const [c, k, p, ct, av, cal, mr, ids, cm0, bilanP] = await Promise.all([D.commerce(), D.compteur(), D.photos(), D.contenus(), D.avis(), D.calendrier(),
      D.miseEnRoute().catch(() => null), D.idees().catch(() => []), D.commentaires().catch(() => []), debutDeMoisCivil() ? D.bilanMois(moisPrecedentIso()).catch(() => null) : null]);
    const [nonLus, cpt, tfT, , contact, dChg] = await Promise.all([retoursNonLus(), D.comptes().catch(() => null), chargerTraductionsIdees(), chargerDemandeTiktok(c0), monContact(),
      D.demandeRappel ? D.demandeRappel("changement_offre").catch(() => null) : null]);
    const ligneFiche = await ligneFicheAccueil(c0, mr);
    const cm = k.commentaires_inclus ? cm0 : [], cmValider = cm.filter(x => x.statut === "a_valider"), cmHumains = cm.filter(x => x.statut === "humain");
    const idee = ids.find(x => x.semaine && x.statut === "a_valider") || null;
    nomCommerce = c.nom; commerceVu = c; comptesVus = cpt;
    // Approuvés restés sans date (31/10/2026) : approuvés quand aucun réseau n'était connecté. Un geste les programme tous au meilleur créneau.
    const sansDate = sansDateDe(ct, cal, cpt, c), N = compteDe({ ct, av, cm: cm0, k, c, cal, cpt });
    const aValider = ct.filter(x => x.statut === "a_valider"), reponses = av.filter(x => x.statut === "a_valider" && !x.sensible), humains = av.filter(x => x.statut === "humain");
    const prochaines = cal.filter(x => x.statut === "programme").slice(0, 3), vign = await Promise.all(prochaines.map(x => urlSure(x.contenu)));
    // Sous-titre : le nombre de validations (contenus, réponses aux avis, réponses aux commentaires) et leur durée (environ 40 secondes chacune).
    // Un avis sensible n'en fait pas partie (décision de PJ du 22/10/2026) : l'équipe s'en charge, le commerçant n'a rien à faire.
    const aDecider = av.filter(x => sensibleADecider(x, c));
    // Mise en route (31/10/2026, test client Essentiel) : un point déclaré par le commerçant, ou une fiche Google demandée, attend l'équipe ; il ne compte
    // plus comme « à finir ». Tout fait de son côté : « Vous avez tout fait. Nous vérifions… », sans bouton.
    const merRestants = ((mr && mr.points) || []).filter(x => x.etat !== "fait"), merAFaire = merRestants.filter(x => x.etat === "a_faire" && !(x.point === "google" && ficheDemandee(c)));
    const merEnCours = merAFaire.length > 0, merAttente = !merEnCours && merRestants.length > 0, merFaits = mr && mr.total ? mr.total - merAFaire.length : 0;
    const merAttenteTexte = t(merRestants.some(x => x.point === "google") ? "acc.mer.attente.google" : "acc.mer.attente");
    // Réseau de l'offre pas encore connecté (31/10/2026) : une action tant qu'il manque, sauf si l'étape « réseaux » de la mise en route l'annonce déjà.
    const etapeReseaux = merAFaire.some(x => x.point === "metricool");
    const aConnecter = cpt && !etapeReseaux ? window.RENOM_RESEAUX_AUTORISES(c).filter(r => r !== "google" && !cpt.some(k => k.reseau === r && k.etat === "connecte") && !(r === "tiktok" && tiktokDemande(c))) : [];
    // Compteur (31/10/2026) : exactement ce que liste « À faire maintenant », dans la même phrase (validations, puis messages à lire).
    // Compteur unique (01/11/2026) : les décisions (même chiffre que le badge et Résultats), « à programmer » à part, puis les retours à lire.
    const nv = N.decisions + N.aProgrammer, na = nonLus ? 1 : 0;
    const phrase = nv ? t("compte.phrase", { n: N.decisions, p: N.aProgrammer, k: na })
      : na ? t("acc.messages", { n: na }) : merEnCours ? t("acc.reste.mer") : merAttente ? merAttenteTexte : t("acc.a.jour");
    const raisons = [...new Set(humains.flatMap(x => x.raisons || []))];
    const photosDuMois = p.filter(x => Date.parse(x.cree_le) >= debutDuMois()).length;
    // Mois complet (01/11/2026, tour 7 Essentiel) : même calcul que l'écran Photos (pubReservees >= plafond) ; plus d'incitation à envoyer une photo,
    // le grand bouton n'est plus vert et une ligne dit qu'une photo envoyée maintenant servira le mois suivant.
    const moisPlein = !!(k && +k.publications_plafond > 0 && pubReservees(k) >= +k.publications_plafond);
    // Tour 12 (v38) : « Une photo pour vos N publications » disparaît quand les publications du mois sont prévues : celles du calendrier de ce mois
    // (programmées, envoyées ou parties, quel que soit le mois où elles comptent), plus les validées sans date et les publications à valider, sans
    // l'avis de la semaine ni les publications hors offre ; leur nombre atteint le plafond de l'offre.
    const estPub = x => !!x && (x.type || "publication") === "publication" && !x.hors_plafond, aut_ = window.RENOM_RESEAUX_AUTORISES(c), dm_ = new Date(debutDuMois());
    const prevuesMois = new Set([...cal.filter(x => ["programme", "envoye", "publie"].includes(x.statut) && estPub(x.contenu) && !horsOffreDe(x, aut_)
        && new Date(x.prevu_le).getMonth() === dm_.getMonth() && new Date(x.prevu_le).getFullYear() === dm_.getFullYear()).map(x => x.contenu_id),
      ...sansDate.filter(estPub).map(x => x.id), ...ct.filter(x => x.statut === "a_valider" && estPub(x) && !horsOffreContenu(x, c)).map(x => x.id)]).size;
    const moisPrevu = !!(k && +k.publications_plafond > 0 && prevuesMois >= +k.publications_plafond);
    // Un bouton par action en attente, dans l'ordre des gestes : valider, puis mettre en route, puis envoyer les photos.
    const actions = [
      aValider.length ? { id: "contenus", href: "#/contenus", texte: t("acc.act.contenus", { n: aValider.length }) } : null,
      // Tour 10 (v36) : sous 360 px, « Programmer N validées » (libellé court), pour que la 2e action tienne au premier écran de l'iPhone SE.
      sansDate.length ? { id: "programmer", bouton: true, texte: `<span class="lib-long">${t("acc.act.programmer", { n: sansDate.length })}</span><span class="lib-court">${t("acc.act.programmer.court", { n: sansDate.length })}</span>` } : null,
      reponses.length ? { id: "avis", href: "#/avis", texte: t("acc.act.avis", { n: reponses.length }) } : null,
      aDecider.length ? { id: "avis-sensible", href: "#/avis", texte: t("acc.act.sensible", { n: aDecider.length }) } : null,
      cmValider.length + cmHumains.length ? { id: "commentaires", href: "#/commentaires", texte: t("acc.act.commentaires", { n: cmValider.length + cmHumains.length }) } : null,
      merEnCours ? { id: "mise-en-route", href: "#/miseenroute", texte: t("acc.act.mer", { a: merFaits, b: mr.total }) } : null,
      // TikTok ne se connecte pas seul : l'équipe l'active avec le commerçant (Comptes, bouton « Demander l'activation »).
      ...aConnecter.map(r => ({ id: "connecter-" + r, href: "#/comptes" + (r === "tiktok" ? "?tiktok" : ""), texte: r === "tiktok" ? t("acc.act.tiktok") : t("acc.act.connecter", { res: RES[r] }) })),
      !c.demarrage_fini ? { id: "demarrage", href: "#/demarrage", texte: t("acc.dem.reprendre") } : null,
      !c.en_pause && !photosDuMois && !moisPlein && !moisPrevu ? { id: "photos", facultatif: true, href: "#/photos", texte: sansReseaux(c) ? t("acc.act.photos.google", { n: pubGoogle(c) }) : t("acc.act.photos") } : null,
      // Retour privé d'un client non lu (constat 33) : une action ici, plus une pastille sur Résultats.
      nonLus ? { id: "retours", href: "#/collecte?retours", texte: t("acc.act.retours", { n: nonLus }) } : null,
    ].filter(Boolean);
    // Seul reste un geste facultatif (envoyer des photos, 31/10/2026) ou la mise en route en attente de BoostImpact (déjà dite dans le chapô, test
    // client Essentiel) : pas de section « À faire maintenant ». Le grand bouton « Envoyer une photo » reste secondaire (tour 12 : jamais vert, il est
    // facultatif). Un seul bouton vert au plus : la première action requise.
    // Rien du tout à faire (audit Essentiel du 31/10/2026) : pas de carte vide non plus, « Tout est à jour. » n'est dit qu'une fois, dans le chapô.
    const requises = actions.filter(a => !a.facultatif), sansAFaire = !requises.length && !humains.length;
    // Tour 12 (v38) : jamais une action facultative en bouton principal vert. Le vert va à la première action requise ; s'il ne reste que du
    // facultatif (envoyer une photo, créer une vidéo), aucun bouton vert sur l'accueil.
    const principale = requises[0] || null;
    // Avis sensible : bandeau en tête seulement s'il y a quelque chose à décider ; sinon (l'équipe s'en charge) une ligne sous « À faire maintenant ».
    const sensibleEnTete = humains.length && aDecider.length;
    // Petit écran (01/11/2026, tour 8, iPhone SE) : 3 actions au plus, puis « Tout voir, N de plus » (N = exactement les actions repliées).
    const replier = actions.length > ACTIONS_VISIBLES && matchMedia("(max-width: 899px) and (max-height: 760px)").matches;
    // « Attendez mon appel » (01/11/2026, tour 6 Premium) : un avis retenu (retenue_le) n'est pas « publié sous 24 h » : « Nous attendons de vous
    // appeler avant de publier. »
    vue.innerHTML = `${pauseBandeau(c)}
      ${sensibleEnTete ? `<section class="alerte" id="alerte-avis-sensibles"><div><p class="fort">${t("acc.humains.titre", { n: humains.length })}</p>
        <p>${raisons.length ? t("acc.motif", { r: e(raisonsTexte(raisons)) }) + " " : ""}${t(equipeRepond(c) ? (humains.some(x => x.retenue_le) ? "acc.humains.texte.retenue" : "acc.humains.texte.equipe") : merSql(c) ? "acc.humains.texte.espace" : "acc.humains.texte", { n: humains.length, r: humains.filter(x => x.retenue_le).length })}</p></div><a class="bouton second" href="#/avis">${t("acc.humains.lire", { n: humains.length })}</a></section>` : ""}
      <div class="entete-accueil"><div class="entete"><p class="sur">${t("acc.bonjour")}</p><h1>${e(c.nom)}</h1><p class="chapo">${phrase}</p></div></div>
      <div class="msg" id="msg" role="status"></div>
      ${/* Tour 9 (01/11/2026) : « À faire maintenant » disparaît quand il n'y a rien à faire (avant : la carte restait, avec seulement « notre équipe
         s'en charge, vous n'avez rien à faire ») ; la ligne de l'avis sensible pris en charge reste alors seule, sous l'en-tête. */ ""}
      ${(sansAFaire || !actions.length) && humains.length && !sensibleEnTete ? `<p class="note" id="alerte-avis-sensibles">${t("acc.humains.titre", { n: humains.length })}. ${t(equipeRepond(c) ? (humains.some(x => x.retenue_le) ? "acc.humains.texte.retenue" : "acc.humains.texte.equipe") : merSql(c) ? "acc.humains.texte.espace" : "acc.humains.texte", { n: humains.length, r: humains.filter(x => x.retenue_le).length })} <a href="#/avis">${t("acc.humains.lire", { n: humains.length })}</a></p>` : ""}
      ${sansAFaire || !actions.length ? "" : `<section class="carte" id="a-faire" aria-labelledby="a-faire-titre"><h2 id="a-faire-titre">${t("acc.afaire.titre")}</h2>
        ${actions.length ? `<ul class="actions-attente">${actions.map((a, i) => { const sec = a === principale ? "" : " second";
          return `<li${replier && i >= ACTIONS_VISIBLES ? " hidden data-repliee" : ""}>${a.bouton ? `<button type="button" class="bouton${sec}" data-action="${a.id}">${a.texte}</button>` : a.vers ? `<button type="button" class="bouton${sec}" data-action="${a.id}" data-vers="${a.vers}">${a.texte}</button>`
          : `<a class="bouton${sec}" data-action="${a.id}" href="${a.href}">${a.texte}</a>`}</li>`; }).join("")}</ul>
          ${replier ? `<p class="pied"><button type="button" class="lien" id="acc-tout-voir" aria-expanded="false" data-n="${actions.length - ACTIONS_VISIBLES}">${t("acc.tout.voir", { n: actions.length - ACTIONS_VISIBLES })}</button></p>` : ""}` : ""}
        ${humains.length && !sensibleEnTete ? `<p class="note" id="alerte-avis-sensibles">${t("acc.humains.titre", { n: humains.length })}. ${t(equipeRepond(c) ? (humains.some(x => x.retenue_le) ? "acc.humains.texte.retenue" : "acc.humains.texte.equipe") : merSql(c) ? "acc.humains.texte.espace" : "acc.humains.texte", { n: humains.length, r: humains.filter(x => x.retenue_le).length })} <a href="#/avis">${t("acc.humains.lire", { n: humains.length })}</a></p>` : ""}</section>`}
      ${carteStyle(c, true)}
      ${offreAccueil(c) ? `<div class="entete-accueil offre-sous">${offreAccueil(c)}</div>` : ""}
      ${ligneChgOffre(c, dChg)}
      <div class="gestes-accueil"><a class="bouton grand second" id="envoyer-photo" href="#/photos">${APPAREIL}<span>${t("acc.envoyer.photo")}</span></a>
        ${+k.videos_plafond > 0 && !sansReseaux(c) && !c.en_pause ? `<a class="bouton second grand" id="creer-video" href="#/photos?video">${CAMERA}<span>${t("acc.creer.video")}</span></a>` : ""}</div>
      ${moisPlein && !c.en_pause ? `<p class="texte2" id="acc-mois-complet">${t("acc.mois.complet", { mois: (new Date().getMonth() + 1) % 12 })}</p>` : ""}
      ${lienPublications(c)}
      ${ligneMois(cal, window.RENOM_RESEAUX_AUTORISES(c), k, moisPrevu || moisPlein)}
      ${ligneSemaine(c, av, cal, cm)}
      ${tempsGagne(av, cal, bilanP, +k.videos_plafond > 0)}
      ${ligneFiche}
      ${ligneContact(contact, "contact-accueil")}
      ${boutonPointMois(c, "point-mois-accueil") ? `<p class="pied">${boutonPointMois(c, "point-mois-accueil")}</p>${notePointMois(c, "point-mois-accueil")}` : ""}
      ${blocMiseEnRoute(mr, c)}
      ${ligneAutorisation(c)}
      <section class="carte" id="prochaines" aria-labelledby="prochaines-titre">
        <div class="carte-tete"><h2 id="prochaines-titre">${t("acc.prochaines")}</h2></div>
        ${prochaines.length ? `<ul class="liste">${prochaines.map((x, i) => `<li class="avec-vignette${horsOffreDe(x, window.RENOM_RESEAUX_AUTORISES(c)) ? " hors-offre" : ""}">${vignette(vign[i])}<div><p class="fort">${dateHeure(x.prevu_le)}<span class="note" data-mention-mois>${mentionMois(x)}</span></p><p class="note">${destTexte(x, window.RENOM_RESEAUX_AUTORISES(c))}</p></div></li>`).join("")}</ul>`
        : sansDate.length ? "" : `<p class="texte2" id="acc-rien-programme">${t("acc.rien.programme")}</p>`}
        ${sansDate.length ? `<div class="encart" id="acc-attendent"><p class="texte2">${t("acc.attendent", { n: sansDate.length })}</p><div class="actions"><button type="button" class="bouton second" data-action="programmer">${t("acc.programmer.tout")}</button></div></div>` : ""}
        <p class="pied"><a href="#/calendrier" id="ouvrir-calendrier">${t("acc.ouvrir.calendrier")}</a></p>
      </section>
      ${blocIdeeSemaine(idee, c, tfT)}`;
    // « Valider … » (30/10/2026, fluidité téléphone) : la première carte à valider arrive en haut de l'écran, sans défiler l'en-tête de Contenus.
    vue.querySelectorAll('[data-action="contenus"]').forEach(a => a.addEventListener("click", () => { versCarte = true; }));
    vue.querySelectorAll("[data-vers]").forEach(b => b.onclick = () => { const x = $(b.dataset.vers); if (x) { x.scrollIntoView({ block: "start" }); const f = x.querySelector("button, a"); if (f) f.focus({ preventScroll: true }); } });
    // Petit écran (tour 9, 01/11/2026 : sur iPhone SE, « Tout voir, 2 de plus » tombait sous la barre d'onglets) : tant que le lien passe sous la
    // barre au premier écran, une action de plus est repliée (au moins une reste visible) et le nombre du lien suit.
    const tv = $("acc-tout-voir"), barreO = $("onglets");
    if (tv && barreO && scrollY < 4 && getComputedStyle(barreO).position === "fixed") { const lis = [...vue.querySelectorAll("#a-faire .actions-attente > li")];
      for (let k_ = lis.filter(li => !li.hidden).length; k_ > 1 && tv.getBoundingClientRect().bottom > barreO.getBoundingClientRect().top - 4; k_--) {
        lis[k_ - 1].hidden = true; lis[k_ - 1].dataset.repliee = ""; const n_ = lis.filter(li => li.hidden).length; tv.dataset.n = n_; tv.textContent = t("acc.tout.voir", { n: n_ }); } }
    if (tv) tv.onclick = () => { const f_ = vue.querySelector("#a-faire li[data-repliee] a, #a-faire li[data-repliee] button"); vue.querySelectorAll("#a-faire [data-repliee]").forEach(li => { li.hidden = false; }); const b_ = $("acc-tout-voir");
      b_.closest("p").remove(); if (f_) f_.focus({ preventScroll: true }); };
    const bp = vue.querySelector('[data-action="programmer"]');
    // « Programmer N publications validées » (31/10/2026, test client Premium) : le message liste les N dates et mène au calendrier (lien).
    // 01/11/2026 (tour 6 Croissance) : pour chaque publication, sa vignette, son titre (première phrase de la légende) et sa date.
    // Deux boutons (tour 8) : l'action de « À faire maintenant » et « Programmer tout » sous les prochaines publications ; même geste.
    if (bp) vue.querySelectorAll('[data-action="programmer"]').forEach(b_ => b_.onclick = () => bp.onclick());
    if (bp) bp.onclick = async () => { bp.disabled = true; const faits = []; let er0 = null;
      // Étalé sur le mois (01/11/2026, tour 7 Premium) : rang et nombre passés à la programmation (jour_lot en base, jourLot en démonstration).
      // Tour 8 (01/11/2026) : les stories et les contenus « du jour » d'abord, au premier créneau libre (sans lot) ; les autres ensuite, étalés entre eux.
      for (const [x, lot] of lotProgrammer(sansDate)) { try { const r_ = await programmerAutoQuand(x.id, lot); faits.push({ x, quand: r_.quand, res: r_.res }); } catch (er) { er0 = er0 || er; } }
      faits.sort((p, q) => Date.parse(p.quand) - Date.parse(q.quand)); const vgs = await Promise.all(faits.map(f => urlSure(f.x)));
      // 01/11/2026 (tour 7 Croissance) : chaque ligne mène à sa publication dans le calendrier (#/calendrier?pub=<id>), avec ses réseaux ; et
      // « Annuler ces programmations » les annule une à une (D.annuler, même fonction que « Annuler » du calendrier), après confirmation.
      const cal_ = await D.calendrier().catch(() => []); faits.forEach(f => { const p_ = cal_.find(y => y.contenu_id === f.x.id && y.statut === "programme"); f.pub = p_ ? p_.id : null; if (p_ && p_.reseaux) f.res = p_.reseaux; });
      // Titre (tour 9, 01/11/2026 : « … servie sur une table de mar… ») : le plat et le prix saisis au dépôt de la photo (photos.precision), sinon
      // la première phrase de la légende, coupée proprement (à la virgule, sinon entre deux mots, jamais au milieu d'un mot).
      const phs_ = await D.photos().catch(() => []), platDe = x => { const p_ = x.photo_id && phs_.find(y => y.id === x.photo_id); return p_ ? String(p_.precision || "").trim() : ""; };
      const titreDe = x => platDe(x) || coupePropre(String(x.titre || (x.legende || "").split(/[.!?\n]/)[0] || "").trim(), 60);
      await accueil(); const m = $("msg"), n = faits.length, aAnnuler = faits.filter(f => f.pub);
      const ligne = (f, i) => { const corps_ = `${vignette(vgs[i])}<div><p class="fort"${lc()}>${e(titreDe(f.x) || t("type.publication.cap"))}</p><p class="note">${e(cap(I.dateHeureDans(f.quand)))}</p>${(f.res || []).length ? `<p class="note" data-reseaux>${e(I.liste(ORDRE_RES.filter(r => f.res.includes(r)).map(r => RES[r])))}</p>` : ""}</div>`;
        return `<li class="avec-vignette">${f.pub ? `<a class="ligne-lien" href="#/calendrier?pub=${encodeURIComponent(f.pub)}" data-pub="${e(f.pub)}">${corps_}</a>` : corps_}</li>`; };
      if (m && n) { m.innerHTML = `<span>${t("acc.programmes", { n })}</span><ul class="dates-programmees">${faits.map(ligne).join("")}</ul>`
        + `${er0 ? `<span>${e(ph(er0.message))}</span> ` : ""}<a href="#/calendrier" id="acc-vers-calendrier">${t("acc.ouvrir.calendrier")}</a>`
        + (aAnnuler.length ? `<div class="actions"><button type="button" class="lien" id="acc-annuler-prog">${t("acc.programmes.annuler", { n: aAnnuler.length })}</button></div>
          <div class="confirmer-refus" id="acc-annuler-zone" hidden><p class="fort">${t("acc.programmes.annuler.question", { n: aAnnuler.length })}</p><div class="actions"><button type="button" class="bouton" id="acc-annuler-oui">${t("acc.programmes.annuler.oui", { n: aAnnuler.length })}</button><button type="button" class="bouton second" id="acc-annuler-garder">${t("acc.programmes.garder", { n: aAnnuler.length })}</button></div></div>` : "");
        if ($("acc-annuler-prog")) { const z = $("acc-annuler-zone");
          $("acc-annuler-prog").onclick = () => { z.hidden = false; $("acc-annuler-prog").hidden = true; $("acc-annuler-garder").focus({ preventScroll: true });
            // 01/11/2026 (tour 7 Premium) : les deux boutons au-dessus de la barre d'onglets (avant : « nearest » les laissait dessous sur téléphone).
            const bas = $("acc-annuler-garder").getBoundingClientRect().bottom, barre = innerWidth < 900 ? 88 : 0; if (bas > innerHeight - barre) window.scrollBy(0, bas - innerHeight + barre + 16); };
          $("acc-annuler-garder").onclick = () => { z.hidden = true; $("acc-annuler-prog").hidden = false; $("acc-annuler-prog").focus({ preventScroll: true }); };
          $("acc-annuler-oui").onclick = async () => { $("acc-annuler-oui").disabled = true; let k_ = 0, er1 = null;
            for (const f of aAnnuler) { try { await D.annuler(f.pub); k_++; } catch (er) { er1 = er1 || er; } }
            await accueil(); toast(t("acc.programmes.annulees", { n: k_ }) + (er1 ? " " + ph(er1.message) : "")); majCompteurs(); }; } }
      else msg(ph(er0 ? er0.message : ""));
      // Tour 11 (v37) : lancé depuis la carte du bas (« Programmer tout » sous les prochaines publications), la confirmation restait hors de l'écran
      // (#msg, en haut de l'accueil, à y = -1741 sur iPhone 13). Après le rendu, elle est amenée en haut de l'écran.
      amenerMsg($("msg")); majCompteurs(); };
    brancherAutomatisations(vue, accueil);
    if ($("aut-oui")) $("aut-oui").onclick = async () => { const b = $("aut-oui"); b.disabled = true;
      try { await D.autoriserPhotos(); const c2 = await D.commerce(); await accueil(); toast(t("aut.toast")); msg(t(sansReseaux(c2) ? "aut.donnee.google" : "aut.donnee", { d: date(c2.photos_autorisees_le || new Date().toISOString()) })); }
      catch (er) { b.disabled = false; msg(ph(er.message)); } };
    if ($("aut-non")) $("aut-non").onclick = async () => { try { await D.refuserAutorisationPhotos(); await accueil(); msg(t("aut.non.merci")); } catch (er) { msg(ph(er.message)); } };
  }

  // ---------------- Réglages (25/10/2026) : tout ce qui se règle une fois, rangé derrière un seul lien de l'en-tête. Chaque écran garde son adresse.
  const ENTREES_REGLAGES = ["offre", "comptes", "notifications", "publications", "fiche", "fichegoogle", "demarrage"];
  async function reglages() {
    // Une seule entrée vers « Vos publications » (audit Essentiel du 31/10/2026) : la carte tant que le style n'est pas validé, sinon la ligne de la liste.
    const c = await D.commerce(), carte = carteStyle(c);
    vue.innerHTML = `${entete("", t("ecran.reglages"), t("reg.chapo"))}
      ${carte}
      <nav class="carte reglages" id="reglages" aria-label="${t("ecran.reglages")}"><ul class="liste">${ENTREES_REGLAGES.filter(r => !(carte && r === "publications")).map(r => { const g = r === "comptes" && sansReseaux(c) ? ".google" : "";
        return `<li><a href="#/${r}" data-r="${r}"><span class="pile serre"><span class="fort">${t("reg." + r + g)}</span><span class="note">${t("reg." + r + ".texte" + g, { res: I.liste(["google", "facebook", "instagram", "tiktok"].filter(x => window.RENOM_RESEAUX_AUTORISES(c).includes(x)).map(x => x === "google" ? "Google" : RES[x])) })}</span></span></a></li>`; }).join("")}</ul></nav>
      ${large.matches ? "" : `<p class="pied-reglages"><button type="button" id="sortir" class="bouton second">${t("quitter")}</button></p>`}`;
  }

  // ---------------- Fiche
  async function fiche() {
    const c = await D.commerce(), v = k => e(c[k] ?? ""), co = c.couleurs || {};
    const dm = c.demarrage || {}, sienne = x => x ? `<span${lc()}>${e(x)}</span>` : "";
    const rep = (lib, val) => `<li><span class="note">${lib}</span><span>${val || `<span class="note">${t("fiche.pas.reponse")}</span>`}</span></li>`;
    vue.innerHTML = `${retourOrigine()}${entete(t("fiche.sur"), t("fiche.titre"), t("fiche.chapo"))}
    <section class="carte fiche demarrage-resume"><div class="carte-tete"><h2>${t("fiche.dem.titre")}</h2><a href="#/demarrage">${t(c.demarrage_fini ? "fiche.dem.modifier" : "fiche.dem.repondre")}</a></div>
      ${c.demarrage ? `<ul class="liste reponses">${rep(t("q.phrase.titre"), sienne(dm.phrase))}${rep(t("q.distinctions.titre"), sienne(dm.distinctions))}${rep(t("fiche.dem.ton"), e(TONS_LIB[dm.ton] || ""))}${rep(t("q.interdits.titre"), sienne(dm.interdits))}${rep(t("fiche.dem.action"), dm.action ? e(ACTIONS_LIB[dm.action]) + (dm.action_detail ? t("deux.points") + sienne(dm.action_detail) : "") : "")}</ul>`
      : `<p class="texte2">${t("fiche.dem.vide")}</p>`}</section>
    <form id="f" class="fiche">
      <section class="carte"><h2>${t("fiche.commerce")}</h2><div class="champs">
        <div class="f toute"><label for="nom">${t("fiche.nom")}</label><input id="nom" type="text" value="${v("nom")}" required></div>
        <div class="f"><label for="metier">${t("fiche.metier")}</label><select id="metier">${Object.entries(METIERS).map(([k, l]) => `<option value="${k}"${c.metier === k ? " selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="f"><label for="ville">${t("fiche.ville")}</label><input id="ville" type="text" value="${v("ville")}"></div>
        <div class="f toute"><label for="horaires">${t("fiche.horaires")}</label><textarea id="horaires"${lc()}>${v("horaires")}</textarea></div></div></section>
      <section class="carte" id="fiche-langues"><fieldset class="choix-langues"><legend><h2>${t("fiche.langues.titre")}</h2></legend>
        ${[["fr", ["fr"]], ["nl", ["nl"]], ["frnl", ["fr", "nl"]]].map(([k, l]) => `<label class="option"><input type="radio" name="langues-pub" value="${l.join(",")}"${languesPub(c).join(",") === l.join(",") ? " checked" : ""}><span>${t("fiche.langues." + k)}</span></label>`).join("")}
        <p class="aide">${t("fiche.langues.aide")}${String(c.pays || "").toUpperCase() === "BE" ? " " + t("fiche.langues.be") : ""}</p></fieldset></section>
      <section class="carte"><h2>${t("fiche.propose")}</h2><div class="champs">
        <div class="f toute"><label for="specialites">${t("fiche.specialites")}</label><textarea id="specialites"${lc()}>${v("specialites")}</textarea><p class="aide">${t("fiche.specialites.aide")}</p></div>
        <div class="f toute"><label for="ton">${t("fiche.ton")}</label><input id="ton" type="text" value="${v("ton")}"${lc()}><p class="aide">${t("fiche.ton.aide")}</p></div>
        <div class="f"><label for="mots_cles">${t("fiche.mots")}</label><input id="mots_cles" type="text" value="${e((c.mots_cles || []).join(", "))}"${lc()}></div>
        <div class="f"><label for="mentions">${t("fiche.mentions")}</label><input id="mentions" type="text" value="${e((c.mentions_autorisees || []).join(", "))}"${lc()}><p class="aide">${t("fiche.mentions.aide")}</p></div></div></section>
      <section class="carte"><h2>${t("fiche.contact.titre")}</h2><div class="champs">
        <div class="f"><label for="contact">${t("fiche.contact")}</label><input id="contact" type="text" value="${v("contact")}"></div>
        <div class="f"><label for="email_validation">${t("fiche.email")}</label><input id="email_validation" type="email" value="${v("email_validation")}"></div></div></section>
      <section class="carte"><h2>${t("fiche.avis.titre")}</h2>
        ${c.lien_avis ? `<div class="f"><label for="lien_avis">${t("fiche.lien")}</label><input id="lien_avis" type="url" value="${v("lien_avis")}" readonly aria-describedby="lien-avis-aide"><p class="aide" id="lien-avis-aide">${t("fiche.lien.boost")}</p></div>` : `<p class="texte2" id="lien-avis-vide">${t("fiche.lien.vide")}</p>`}
        <div class="pile serre" id="fiche-regle-avis"><h3>${t("fiche.reponses")}</h3>${regleAvisBlocs(c)}
          <p class="aide">${t("fiche.reglage.aide")}</p></div></section>
      <section class="carte" id="fiche-style"><h2>${t("fiche.couleurs")}</h2>
        <div class="style-accueil-corps"><p class="texte2">${t("fiche.couleurs.style")}</p><div class="style-nuancier" aria-hidden="true">${[co.accent, co.fond, co.texte].filter(Boolean).map(x => `<span style="background:${e(x)}"></span>`).join("")}</div></div>
        <p class="pied"><a class="bouton second" href="#/publications">${t("fiche.couleurs.lien")}</a></p></section>
      <div class="actions pied-formulaire"><button class="bouton" type="submit">${t("enregistrer")}</button><p class="msg" id="msg" role="status"></p></div></form>`;
    const liste = id => $(id).value.split(",").map(s => s.trim()).filter(Boolean);
    $("f").onsubmit = async ev => {
      ev.preventDefault();
      try {
        await D.enregistrer({ nom: $("nom").value.trim(), metier: $("metier").value, ville: $("ville").value.trim(), specialites: $("specialites").value.trim(), horaires: $("horaires").value.trim(), ton: $("ton").value.trim(),
          mots_cles: liste("mots_cles"), mentions_autorisees: liste("mentions"), contact: $("contact").value.trim(), email_validation: $("email_validation").value.trim() });   // lien_avis : renseigné par BoostImpact (console)   // couleurs : écran « Votre style » (kit de marque)
        if (nomAConfirmer(c)) await D.confirmerNom($("nom").value.trim());
        const lg = (vue.querySelector("input[name=langues-pub]:checked") || {}).value;
        if (lg && lg !== languesPub(c).join(",")) await D.reglerLanguesPublication(lg.split(","));
        msg(t("fiche.enregistree"));
      } catch (er) { msg(t("fiche.echec", { m: ph(er.message) })); }
    };
  }

  // ---------------- Photos. 17/10/2026 (décision de PJ) : les photos arrivent SEULEMENT ici, jamais par email. Envoi résumable TUS (espace/web/envoi.js,
  // même envoi fiable que le dépôt de vidéos), puis D.deposerPhotos enregistre l'envoi entier (fonction deposer_photos de schema.sql : 1 à 10 photos).
  // Chaque photo enregistrée suit la chaîne habituelle : création d'un contenu, « à valider » dans Contenus.
  // État gardé hors de l'écran : le nom donné à chaque fichier (nom, taille, date) est réutilisé à un nouvel essai, pour que l'envoi reprenne au lieu
  // de repartir de zéro ; il est oublié dès que la photo est enregistrée.
  const phEnvoi = { encours: false, noms: new Map() };
  const clePhoto = f => [f.name, f.size, f.lastModified || 0].join(":");
  // Doublon de photo (31/10/2026, test client sur iPhone : chaque photo de la galerie arrive sous le nom « image.jpg ») : une photo est « déjà
  // envoyée » si cet appareil a déjà envoyé le même fichier (nom, taille et date du fichier identiques, retenus ici après chaque envoi réussi),
  // ou, depuis un autre appareil, si son nom est propre au fichier. Un nom générique (image.jpg, IMG_1234.JPG, photo.jpeg…) ne suffit jamais.
  const NOM_GENERIQUE = /^(image|img|photo|picture|pxl|dsc|dscn|dcim|capture|screenshot|file|fichier)([\s_\-]*\d+)*[\s_\-]*(\(\d+\))?\.(jpe?g|png|heic|heif|webp)$/i;
  const cleEnvois = cid => "renom:photos-envoyees:" + cid;
  const envoisLocaux = cid => { try { return JSON.parse(localStorage.getItem(cleEnvois(cid)) || "{}") || {}; } catch (er) { return {}; } };
  const retenirEnvois = (cid, fs) => { try { const m = envoisLocaux(cid), q = new Date().toISOString(); fs.forEach(f => { m[clePhoto(f)] = q; });
    const l = Object.entries(m).sort((a, b) => b[1].localeCompare(a[1])).slice(0, 500); localStorage.setItem(cleEnvois(cid), JSON.stringify(Object.fromEntries(l))); } catch (er) {} };
  let phVueVideo = null;
  async function photos() {
    const [c, l, k] = await Promise.all([D.commerce(), D.photos(), D.compteur().catch(() => null)]); commerceVu = c;
    // Plafond du mois (31/10/2026) : prévenu AVANT l'envoi, pour toutes les offres ; remise à zéro le 1er du mois suivant.
    const g = sansReseaux(c), plein = !!(k && +k.publications_plafond > 0 && pubReservees(k) >= +k.publications_plafond), sansVideo = !(+offreDe(c).videos > 0);
    const moisSuivant = (new Date().getMonth() + 1) % 12, dessus = offreCible(c);
    // Photo gardée pour le mois suivant (refus « plafond », ou à traiter alors que la limite est atteinte) : « En attente (novembre) », jamais
    // « En préparation » (audit Essentiel du 31/10/2026) : rien ne sera préparé avant le 1er.
    // Photos refusées (31/10/2026) : un seul message groupé au-dessus de la liste, au lieu du motif répété sur chaque ligne.
    // Photo « En attente (mois suivant) » (01/11/2026, tour 7 Premium) : SEULEMENT au-delà des places du mois. Gardée par la base dès l'envoi
    // (refus_motif 'plafond', enregistrer_photos) ; ou, photo plus ancienne encore « à traiter », au-delà des places dans l'ordre d'arrivée (même
    // règle que la vue compteur_photos). Avant (v31) : avec le mois complet, TOUTES les photos à traiter passaient « En attente (décembre) ».
    const auDela = (() => { const pl = k ? +k.publications_plafond || 0 : 0; if (!(pl > 0)) return new Set();
      const t0 = new Date(); t0.setDate(1); t0.setHours(0, 0, 0, 0); let libres = Math.max(0, pl - (+k.publications_utilisees || 0));
      return new Set(l.filter(x => ["a_traiter", "en_cours"].includes(x.statut) && Date.parse(x.cree_le) >= t0.getTime()).sort((a, b) => String(a.cree_le).localeCompare(String(b.cree_le)))
        .filter(() => libres-- <= 0).map(x => x.id)); })();
    const enAttente = x => x.statut === "refusee" && x.refus_motif === "plafond" || auDela.has(x.id);
    // « Déjà déposées » (01/11/2026, tour 8) : le titre est le plat et le prix saisis à l'envoi (photos.precision), sinon la date ; jamais le nom du
    // fichier (« IMG_2041.jpg » ne dit rien au commerçant). Avec un plat, la date passe dessous.
    const titrePhoto = x => { const pr = String(x.precision || "").trim();
      return pr ? `<p class="fort"${lc()} data-titre-photo>${e(pr)}</p><p class="note">${cap(date(x.cree_le))}</p>` : `<p class="fort" data-titre-photo>${e(cap(t("photo.du", { d: date(x.cree_le) })))}</p>`; };
    const refusGroupe = () => { const sujet = l.filter(x => x.statut === "refusee" && ["hors_sujet", "doute"].includes(x.refus_motif)).length, pl = l.filter(x => x.statut === "refusee" && x.refus_motif === "plafond").length;
      return (sujet ? `<div class="encart refus-photo" id="refus-sujet"><p class="fort">${t("photos.refus.groupe", { n: sujet })}</p><p class="note">${t("photo.refus.conseil")}</p></div>` : "")
        + (pl ? `<div class="encart refus-photo" id="refus-plafond"><p class="fort">${t("photos.refus.groupe.plafond", { n: pl, mois: moisSuivant })}</p>${dessus ? `<p class="note"><a href="#/offre?dessus">${t("photos.plafond.dessus", { nom: e(I.offre(dessus)), n: (window.RENOM_OFFRES[dessus] || {}).publications })}</a></p>` : ""}</div>` : ""); };
    // Deux vues (31/10/2026) : « Photos » (dépôt, photos envoyées, autorisation) et « Vidéo » (dépôt de vidéos, suivi, vidéo d'avis), choisies par le
    // sélecteur du haut. #/photos?video et #/videoavis ouvrent la vue Vidéo ; elle commence en haut de la page, donc rien à faire défiler (avant : un
    // défilement jusqu'à la carte vidéo, à 1 500 px sous le haut sur téléphone). Offre sans réseaux : aucune vidéo, ni sélecteur ni vue Vidéo.
    // Offre sans vidéo (Essentiel, Croissance, 31/10/2026) : pas de vue Vidéo pour le dépôt ; une ligne sobre dit où sont les vidéos montées.
    const [htmlDv, htmlVa] = [sansVideo ? "" : await blocDepotVideo(c), await blocVideoAvis(c)], aVideo = !!(htmlDv || htmlVa);
    const enVideo = aVideo && (ecranCourant === videoAvis || /(^|&)video\b/.test(paramRoute));
    const bascule = aVideo ? `<nav class="filtres bascule" id="ph-bascule" aria-label="${e(t("photos.bascule"))}">
        <a href="#/photos" data-ph-vue="photos"${enVideo ? "" : ' aria-current="page"'}>${t("photos.bascule.photos")}</a><a href="#/photos?video" data-ph-vue="video"${enVideo ? ' aria-current="page"' : ""}>${t("photos.bascule.video")}</a></nav>` : "";
    // Mois plein en Essentiel (01/11/2026, tour 8) : UNE ligne d'information (le chapô : « 2 sur 2 : la prochaine photo servira en décembre »), au
    // lieu de trois (bandeau, phrase Google, compteur) ; les boutons d'envoi restent visibles sans défiler sur un téléphone de 390 × 664 ; la
    // proposition de Croissance passe sous la liste des photos déposées.
    const pleinG = plein && g, phrasePlein = pleinG ? `<span id="ph-plein" data-plafond-phrase>${t("plafond.phrase", { n: k.publications_plafond, mois: moisSuivant })}</span>` : "";
    vue.innerHTML = `${pauseBandeau(c)}${entete(t("groupe.photos"), t(sansVideo ? "photos.titre.google" : "photos.titre"), pleinG ? phrasePlein : g ? t("photos.chapo.google", { n: pubGoogle(c) }) : `<span class="chapo-long">${sansVideo ? t("photos.chapo.sansvideo") : t("photos.chapo")}</span><span class="chapo-court">${t(sansVideo ? "photos.chapo.court.sansvideo" : "photos.chapo.court")}</span>`)}${bascule}
      <div class="pile" id="vue-photos"${enVideo ? " hidden" : ""}>
      ${pleinG ? ""
      : plein ? `<section class="plafond-bandeau" id="plafond-bandeau" role="status"><p class="fort" data-plafond-phrase>${t("plafond.phrase", { n: k.publications_plafond, mois: moisSuivant })}</p><p class="texte2">${t("photos.plafond.suite", { mois: moisSuivant })}</p>
        ${dessus ? `<p class="note"><a href="#/offre?dessus" id="plafond-offre">${t("photos.plafond.dessus", { nom: e(I.offre(dessus)), n: (window.RENOM_OFFRES[dessus] || {}).publications })}</a></p>` : ""}</section>` : ""}
      <div class="rangee">
        <section class="carte moitie"><div class="carte-tete"><h2>${t("photos.deposer")}</h2>${k && +k.publications_plafond > 0 && !pleinG ? `<span class="note" id="ph-compteur">${t("photos.compteur.reste", { a: Math.min(pubReservees(k), +k.publications_plafond), b: +k.publications_plafond, r: Math.max(0, +k.publications_plafond - pubReservees(k)), n: +k.publications_preparation || 0 })}</span>` : ""}</div>
          <form id="f"><div class="f"><div class="depot">
            <span class="depot-choix"><input id="appareil" class="vh" type="file" accept="image/*" capture="environment"><label for="appareil" class="bouton second appareil-photo">${APPAREIL}<span>${t("photos.prendre")}</span></label></span>
            <span class="depot-choix"><input id="fichiers" class="vh" type="file" accept="image/*" multiple><label for="fichiers" class="bouton second">${GALERIE}<span class="sur-tel">${t("photos.galerie")}</span><span class="sur-ordi">${t("photos.choisir")}</span></label></span>
            <span class="note" id="choisies" aria-live="polite">${t("photos.aucune.choisie")}</span></div>
          <ul class="miniatures" id="ph-miniatures" aria-label="${e(t("photos.choisies.liste"))}"></ul>
          <p class="aide">${t("photos.aide", { max: EN.REGLES.PHOTOS_MAX, mo: nombre(EN.REGLES.PHOTO_MAX_MO) })}</p></div>
          <div class="f" id="ph-precision-zone"><label for="ph-precision">${t(c.metier === "restaurant" ? "photos.precision" : "photos.precision.produit")}</label><input id="ph-precision" type="text" maxlength="200" autocomplete="off" enterkeyhint="done" value="${e(phEnvoi.precision || "")}" placeholder="${e(t(c.metier === "restaurant" ? "photos.precision.ex" : "photos.precision.ex.produit"))}" aria-describedby="ph-precision-aide"><p class="aide" id="ph-precision-aide">${t("photos.precision.aide")}</p></div>
          <div class="jauge" id="ph-jauge" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="${e(t("photos.progression"))}" hidden><span style="width:0%"></span></div>
          <p class="note" id="ph-quota" aria-live="polite" hidden></p><button class="bouton" type="submit" id="ph-envoyer">${t("envoyer")}</button>
          <div class="confirmer-refus" id="ph-doublon" role="alert" hidden><p class="fort" id="ph-doublon-texte"></p><div class="actions"><button type="button" class="bouton" id="ph-doublon-envoyer">${t("photos.doublon.envoyer")}</button><button type="button" class="bouton second" id="ph-doublon-retirer"></button></div></div><p class="msg" id="msg" role="status" aria-live="polite"></p><p class="note" id="ph-suite" hidden></p></form></section>
        <section class="carte moitie"><div class="carte-tete"><h2>${t("photos.deja")}</h2>${l.length ? `<span class="note">${t("photos.n", { n: l.length })}</span>` : ""}</div>
          ${refusGroupe()}${l.length ? `<ul class="liste">${l.map(x => `<li class="avec-vignette">${vignette(x.url && !/^data:/.test(x.url) ? x.url : null)}<div>${titrePhoto(x)}<p class="etat"${enAttente(x) ? ' data-refus="plafond"' : ""}>${enAttente(x) ? t("photo.attente.mois", { mois: moisSuivant }) : ST_PHOTO[x.statut] || e(x.statut)}</p>${x.statut === "refusee" && x.refus_motif && x.refus_motif !== "plafond" ? `<p class="note" data-refus="${e(x.refus_motif)}">${t("photo.refus.court.sujet")}</p>` : ""}</div></li>`).join("")}</ul>` : `<p class="texte2">${t("photos.vide")}</p>`}</section>
      </div>
      ${pleinG && incitationCroissance(c) ? `<section class="carte plafond-essentiel" id="plafond-essentiel"><p class="texte2">${t("photos.plafond.croissance")}</p><p class="pied"><a class="bouton second" href="#/offre?dessus" id="plafond-offre">${t("offre.passer.lien", { nom: e(I.offre("standard")) })}</a></p></section>` : ""}
      ${sansVideo && !g ? `<p class="note" id="videos-premium">${t("photos.video.premium")} <a href="#/offre?dessus=premium">${t("photos.video.premium.lien")}</a></p>` : ""}
      ${autorisationAJour(c) ? `<p class="note" id="autorisation-donnee">${t(autorisationGoogle(c) ? "aut.donnee.google" : "aut.donnee", { d: date(c.photos_autorisees_le) })}</p>` : carteAutorisation(c)}<p class="msg" id="msg-aut" role="status"></p></div>
      ${aVideo ? `<div class="pile" id="vue-video"${enVideo ? "" : " hidden"}>${htmlDv}${htmlVa}</div>` : ""}`;
    const chapo = vue.querySelector(".entete .chapo"); if (chapo) chapo.hidden = enVideo;   // vue Vidéo : la carte vidéo a son propre chapeau, elle vient tout de suite
    if (phVueVideo !== null && phVueVideo !== enVideo) window.scrollTo(0, 0); phVueVideo = enVideo;
    brancherAutorisation(photos);
    // Deux façons de choisir (appareil photo, galerie ou fichiers de l'ordinateur) ; l'envoi reste le même pour les deux.
    // 31/10/2026 (test client) : les photos choisies se voient (miniature 48 px, date de prise), se retirent une à une, et une photo déjà envoyée
    // (même fichier, voir NOM_GENERIQUE) est signalée avant l'envoi.
    phEnvoi.choix = phEnvoi.choix || [];
    const choisies = () => phEnvoi.choix.map(x => x.f);
    const locaux = envoisLocaux(c.id);
    const dejaEnvoyee = f => locaux[clePhoto(f)] ? { cree_le: locaux[clePhoto(f)] } : NOM_GENERIQUE.test(f.name || "") ? null : l.find(x => x.nom_fichier && x.nom_fichier === f.name);
    // Quota du mois (01/11/2026, tour 7 Croissance) : plus de photos choisies que de places restantes -> « 3 deviendront des publications ce mois-ci,
    // 3 en décembre » ; mois complet -> « Envoyer pour décembre » et la phrase qui l'explique. Places : celles du compteur (ph-compteur, pubReservees).
    const plafond = k ? +k.publications_plafond || 0 : 0, places = plafond > 0 ? Math.max(0, plafond - pubReservees(k)) : Infinity;
    const dessinerChoix = () => { const fs = choisies(), q = $("ph-quota"), n_ = fs.length;
      if (q) { q.hidden = !(n_ && places < n_); q.textContent = !n_ || places >= n_ ? "" : places === 0 ? t("photos.quota.plein", { n: n_, mois: moisSuivant }) : t("photos.quota.partage", { a: places, b: n_ - places, mois: moisSuivant }); }
      $("ph-envoyer").textContent = places === 0 && plafond > 0 ? t("photos.envoyer.mois", { mois: moisSuivant }) : fs.length ? t("photos.envoyer.n", { n: fs.length }) : t("envoyer"); $("ph-envoyer").toggleAttribute("data-choix", fs.length > 0); $("ph-doublon").hidden = true; $("choisies").textContent = !fs.length ? t("photos.aucune.choisie") : fs.length === 1 ? fs[0].name : t("photos.n.choisies", { n: fs.length });
      $("ph-miniatures").innerHTML = phEnvoi.choix.map((x, i) => { const d = dejaEnvoyee(x.f);
        return `<li><img src="${e(x.u)}" alt=""><div><p class="fort casse">${e(x.f.name)}</p><p class="note">${x.f.lastModified ? cap(date(new Date(x.f.lastModified).toISOString())) : ""}</p>${d ? `<p class="texte2" data-doublon>${t("photos.doublon", { d: date(d.cree_le) })}</p>` : ""}</div>
          <button type="button" class="lien" data-retirer="${i}" aria-label="${e(t("dv.retirer.nom", { nom: x.f.name }))}">${t("dv.retirer")}</button></li>`; }).join(""); };
    $("appareil").onchange = $("fichiers").onchange = ev => { const inp = ev.target;
      for (const f of inp.files) if (!phEnvoi.choix.some(x => x.f.name === f.name && x.f.size === f.size)) phEnvoi.choix.push({ f, u: URL.createObjectURL(f) });
      inp.value = ""; dessinerChoix();
      // Photo choisie : le bouton « Envoyer » vient sous le pouce s'il est sous le pli (barre d'onglets comprise).
      const b_ = $("ph-envoyer"); if (phEnvoi.choix.length && b_.getBoundingClientRect().bottom > innerHeight - 90) b_.scrollIntoView({ block: "center" }); };
    $("ph-precision").oninput = ev => { phEnvoi.precision = ev.target.value; };
    $("ph-miniatures").onclick = ev => { const b = ev.target.closest("[data-retirer]"); if (!b || phEnvoi.encours) return; const [x] = phEnvoi.choix.splice(+b.dataset.retirer, 1); if (x) URL.revokeObjectURL(x.u); dessinerChoix(); };
    dessinerChoix();
    $("f").onsubmit = async ev => {
      ev.preventDefault(); if (phEnvoi.encours) return;
      const fs = choisies();
      if (!fs.length) { msg(t("photos.choisir.une")); return; }
      // Photo déjà envoyée (même fichier) : on demande avant d'envoyer (l'envoyer quand même, en premier, ou la retirer).
      const doublons = phEnvoi.choix.filter(x => dejaEnvoyee(x.f));
      if (doublons.length && !phEnvoi.doublonOk) { const z = $("ph-doublon"); $("ph-doublon-texte").textContent = t("photos.doublon.question", { n: doublons.length });
        $("ph-doublon-retirer").textContent = t("photos.doublon.retirer", { n: doublons.length }); z.hidden = false;
        $("ph-doublon-retirer").onclick = () => { phEnvoi.choix = phEnvoi.choix.filter(x => { const d = dejaEnvoyee(x.f); if (d) URL.revokeObjectURL(x.u); return !d; }); dessinerChoix(); $("ph-envoyer").focus(); };
        $("ph-doublon-envoyer").onclick = () => { phEnvoi.doublonOk = true; z.hidden = true; $("f").requestSubmit(); };
        $("ph-doublon-envoyer").focus(); return; }
      phEnvoi.doublonOk = false;
      // Contrôle avant envoi (format, 50 Mo) : un fichier refusé n'empêche pas les autres de partir.
      const erreurs = [], bonnes = [];
      for (const f of fs) { const k = await EN.controler(f); if (k.genre !== "photo") erreurs.push(f.name + t("deux.points") + ph("Format non accepté (JPEG, PNG, WebP ou HEIC).")); else if (k.raison) erreurs.push(f.name + t("deux.points") + ph("Fichier trop lourd (50 Mo au plus).")); else bonnes.push(f); }
      if (!bonnes.length) { msg(t("photos.aucune.envoyee") + t("photos.refusees", { n: erreurs.length, l: erreurs.join(" ; ") })); return; }
      const ens = EN.controlerPhotos(bonnes.length); if (ens) { msg(t("photos.ens." + ens.code, { n: ens.n, max: EN.REGLES.PHOTOS_MAX })); return; }
      // Plat et prix avec un numéro de téléphone (01/11/2026, tour 7 Premium) : refusé AVANT l'envoi des fichiers (même règle que la base).
      if (M.contientTelephone(($("ph-precision") || {}).value || "")) { msg(t("photos.precision.tel")); const pz = $("ph-precision"); if (pz) pz.focus(); return; }
      // Places calculées AVANT l'envoi (01/11/2026, tour 7 Premium) : la phrase d'après l'envoi reprend exactement celle d'avant (« 7 ce mois-ci,
      // 1 en décembre »). La base fait le même calcul et garde les photos au-delà (réponse ce_mois / gardees de deposer_photos).
      const placesAvant = places;
      // Écran quitté pendant l'envoi (01/11/2026, tour 7 Premium) : l'envoi continue, mais rien n'est écrit ni redessiné sur l'autre écran.
      const surPhotos = () => ecranCourant === photos || ecranCourant === videoAvis;
      const msgPh = x => { if (surPhotos()) msg(x); };
      phEnvoi.encours = true; $("ph-envoyer").disabled = true; $("appareil").disabled = $("fichiers").disabled = true;
      const jauge = $("ph-jauge"), total = bonnes.reduce((s, f) => s + (f.size || 0), 0) || 1, recus = [], pris = new Set(); let faits = 0, deposees = 0, gardees = 0;
      const avancer = n => { const p = Math.min(100, Math.floor((faits + n) / total * 100)); jauge.hidden = false; jauge.setAttribute("aria-valuenow", p); jauge.firstElementChild.style.width = p + "%"; };
      try {
        for (let i = 0; i < bonnes.length; i++) {
          // Deux fichiers identiques (même nom, taille, date) dans un même envoi reçoivent deux noms : jamais de doublon refusé par la base.
          const f = bonnes[i], cle = clePhoto(f); let nom = phEnvoi.noms.get(cle); if (!nom || pris.has(nom)) nom = EN.nomPhoto(f); pris.add(nom); phEnvoi.noms.set(cle, nom);
          msgPh(t("photos.envoi.de", { nom: f.name, i: i + 1, n: bonnes.length }));
          try {
            const r = await D.envoyerPhoto(f, { nom, onProgress: a => avancer(a),
              onEtat: et => msgPh(et === "hors_ligne" ? t("dv.hors.ligne") : et === "nouvel_essai" ? t("dv.nouvel.essai") : t("photos.envoi.de", { nom: f.name, i: i + 1, n: bonnes.length })) });
            recus.push({ chemin: r.chemin, nom: f.name, taille: f.size, cle, f });
          } catch (er) { erreurs.push(f.name + t("deux.points") + (er && er.interrompu ? t("photos.interrompu") : ph(er.message))); }
          faits += f.size || 0; avancer(0);
        }
        // Enregistrement de l'envoi entier : un refus de la base n'enregistre rien (les fichiers reçus restent, un nouvel essai les reprend).
        // Plat et prix (01/11/2026, tour 7 Croissance) : facultatif, le même pour toutes les photos de cet envoi (photos.precision, enregistrer_photos).
        const precision = String(($("ph-precision") || {}).value || "").trim().replace(/\s+/g, " ").slice(0, 200);
        if (recus.length) { const r = await D.deposerPhotos(recus.map(({ chemin, nom, taille }) => Object.assign({ chemin, nom, taille }, precision ? { precision } : {}))); deposees = r.nb_photos;
          gardees = r.gardees != null ? +r.gardees : Math.max(0, deposees - (placesAvant === Infinity ? deposees : placesAvant)); recus.forEach(x => phEnvoi.noms.delete(x.cle)); retenirEnvois(c.id, recus.map(x => x.f)); }
      } catch (er) { erreurs.push(ph(er.message)); }
      finally { phEnvoi.encours = false; }
      if (deposees) { phEnvoi.choix.forEach(x => URL.revokeObjectURL(x.u)); phEnvoi.choix = []; phEnvoi.precision = ""; }
      const bilan = (deposees ? t("photos.deposees", { n: deposees }) : t("photos.aucune.enregistree")) + (erreurs.length ? t("photos.refusees", { n: erreurs.length, l: erreurs.join(" ; ") }) : "");
      if (!surPhotos()) { toast(bilan + (deposees ? " " + phraseSuite(deposees, gardees, moisSuivant) : "")); majCompteurs(); return; }
      await photos(); msg(bilan);
      if (deposees) await suitePhotos(c, deposees, gardees);
      // Le résultat de l'envoi reste sous les yeux (l'écran est redessiné) : message et suite amenés au milieu de l'écran s'ils en sont sortis.
      const m_ = $("msg"); if (m_) { const r_ = m_.getBoundingClientRect(); if (r_.top < 0 || r_.bottom > innerHeight - 90) m_.scrollIntoView({ block: "center" }); }
      majCompteurs();
    };
    brancherDepotVideo(); await brancherVideoAvis();
    // Sélecteur : bascule sur place (sans redessiner l'écran, les fichiers choisis restent), adresse mise à jour sans étape d'historique, haut de page.
    // Depuis #/videoavis, le lien suit son cours (l'écran est redessiné, vidéo d'avis repliée).
    vue.querySelectorAll("[data-ph-vue]").forEach(a => { a.onclick = ev => {
      if (ecranCourant === videoAvis) return;
      ev.preventDefault(); const v = a.dataset.phVue === "video", h = "#/photos" + (v ? "?video" : "");
      if (location.hash !== h) history.replaceState(null, "", h); paramRoute = v ? "video" : ""; phVueVideo = v;
      $("vue-photos").hidden = v; $("vue-video").hidden = !v;
      vue.querySelectorAll("[data-ph-vue]").forEach(x => { if (x === a) x.setAttribute("aria-current", "page"); else x.removeAttribute("aria-current"); });
      const ch = vue.querySelector(".entete .chapo"); if (ch) ch.hidden = v; window.scrollTo(0, 0); }; });
    if (/autorisation/.test(paramRoute) && $("autorisation-photos")) { $("autorisation-photos").scrollIntoView({ block: "start" }); $("aut-case").focus({ preventScroll: true }); }
  }
  // Après un envoi réussi : la suite en une phrase, avec le lien vers les contenus de l'onglet « À valider ». Délai : seulement celui que l'offre promet (« Premier contenu proposé
  // sous 72 h », Standard et Premium, site/index.html #offres ; COND = moteur/conditions_offre.json), et seulement tant qu'aucun contenu n'existe.
  // 26/10/2026 (test réel de PJ) : le lien porte le nom de l'onglet tel qu'il apparaît (« À valider »), plus « Contenus ».
  // Après l'envoi (01/11/2026, tour 7 Premium) : la phrase vient des places calculées AVANT l'envoi (gardees = photos au-delà, gardées par la
  // base pour le mois suivant), plus du compteur relu après : « 7 deviendront des publications ce mois-ci, 1 en décembre », comme avant l'envoi.
  const phraseSuite = (n, gardees, mois) => gardees >= n ? t("photos.suite.plein", { n, mois }) : gardees > 0 ? t("photos.quota.partage", { a: n - gardees, b: gardees, mois }) : "";
  async function suitePhotos(c, n = 1, gardees = 0) {
    const s = $("ph-suite"); if (!s) return;
    const mois = (new Date().getMonth() + 1) % 12;
    // Toutes gardées (mois complet avant l'envoi) : pas de promesse « le jour même ».
    if (gardees >= n) { s.textContent = phraseSuite(n, gardees, mois); s.hidden = false; return; }
    const premier = !!offreDe(c).reseaux_sociaux && !(await D.contenus().catch(() => [null])).length;
    // Délai (31/10/2026) : le rendu part dès l'envoi (n8n/renom-creation.json : webhook de la photo, rendu GitHub Actions), sans file d'attente.
    s.innerHTML = (gardees > 0 ? e(phraseSuite(n, gardees, mois)) + " " : "") + t("photos.suite.delai", { lien: `<a href="#/contenus">${e(ECRANS.avalider)}</a>` }) + (premier ? " " + t("offre.garantie.contenu", { n: COND.garantie_delais.premier_contenu_heures }) : "");
    s.hidden = false;
  }

  // ---------------- Dépôt de vidéos (écran Photos et vidéos). Règles et envoi : espace/web/envoi.js ; base : bloc « Dépôt de vidéos » de schema.sql.
  // État gardé hors de l'écran : un envoi continue si l'on change d'écran, et l'écran le retrouve à son retour.
  const EN = window.RENOM_ENVOI, DV = window.RENOM_DEPOT_VIDEO;
  const ST_DV = I.carte("dv.st", DV.STATUTS);
  const dv = { fichiers: [], envoi: false, interrompu: false, reseau: "", ctrl: null, note: "", n: 0, depot: null };
  const mo = n => nombre(Math.max(0.1, n / EN.MO), n < 10 * EN.MO ? 1 : 0);
  const taille = n => t("dv.f.mo", { n: mo(n) });
  const secondes = d => t("dv.f.secondes", { n: nombre(d, d < 10 && d % 1 ? 1 : 0) });
  const pourcent = x => x.f.size ? Math.min(100, Math.floor((x.envoyes || 0) / x.f.size * 100)) : 0;
  function etatFichier(x) {
    const c = x.ctrl;
    if (!c) return t("dv.f.controle");
    if (c.raison === "lourde") return t("dv.r.lourde", { t: taille(c.taille), max: nombre(EN.REGLES.VIDEO_MAX_MO) });
    if (c.raison === "longue") return t("dv.r.longue", { d: secondes(c.duree), max: EN.REGLES.DUREE_MAX_S });
    if (c.raison) return t("dv.r." + c.raison);
    if (x.etat === "recu") return t("dv.f.recu");
    if (x.etat === "envoi") return t("dv.f.envoi", { p: pourcent(x) });
    if (x.etat === "interrompu") return t("dv.f.interrompu", { p: pourcent(x) });
    return (dv.envoi ? t("dv.f.attente") : t("dv.f.ok")) + (c.horizontale ? ". " + t("dv.f.horizontale") : "");
  }
  const metaFichier = x => !x.ctrl || x.ctrl.raison === "format" ? "" : x.ctrl.genre === "photo" ? t("dv.f.photo", { t: taille(x.f.size) })
    : t("dv.f.video", { d: x.ctrl.duree == null ? t("dv.f.duree.inconnue") : secondes(x.ctrl.duree), t: taille(x.f.size) });
  const ligneFichier = x => `<li data-dvf="${x.id}"${x.ctrl && x.ctrl.raison ? ' class="refuse"' : ""}><div><p class="fort casse">${e(x.f.name)}</p><p class="note" data-dv-meta>${metaFichier(x)}</p></div>
    <span class="etat${x.etat === "recu" ? " actif" : ""}" data-dv-etat>${etatFichier(x)}</span>
    ${!dv.envoi && x.etat !== "recu" ? `<button type="button" class="lien petit-lien" data-dv-retirer="${x.id}" aria-label="${e(t("dv.retirer.nom", { nom: x.f.name }))}">${t("dv.retirer")}</button>` : ""}
    ${x.ctrl && !x.ctrl.raison && (dv.envoi || x.etat) ? `<div class="jauge" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pourcent(x)}" aria-label="${e(x.f.name)}"><span style="width:${pourcent(x)}%"></span></div>` : ""}</li>`;
  const valables = () => dv.fichiers.filter(x => x.ctrl && !x.ctrl.raison);
  function dvDessinerListe() {
    const ul = $("dv-fichiers"); if (!ul) return;
    ul.innerHTML = dv.fichiers.map(ligneFichier).join("");
    const ok = valables(), nv = ok.filter(x => x.ctrl.genre === "video").length, np = ok.length - nv;
    $("dv-choisies").textContent = dv.fichiers.length ? t("dv.choisies", { v: nv, p: np }) : t("dv.aucun.fichier");
    $("dv-lourde").hidden = !dv.fichiers.some(x => x.ctrl && x.ctrl.raison === "lourde");
    const b = $("dv-envoyer"); if (b) { b.textContent = t(dv.interrompu ? "dv.reprendre" : "dv.envoyer"); b.disabled = dv.envoi; }
    document.querySelectorAll("#depot-video input[type=file]").forEach(i => { i.disabled = dv.envoi; });
    if ($("dv-note")) $("dv-note").disabled = dv.envoi;
  }
  // Mise à jour d'une ligne pendant l'envoi, sans redessiner l'écran (la page reste lisible et le défilement ne saute pas).
  function dvMajLigne(x) {
    const li = document.querySelector(`[data-dvf="${x.id}"]`); if (!li) return;
    li.querySelector("[data-dv-etat]").textContent = etatFichier(x); li.querySelector("[data-dv-etat]").classList.toggle("actif", x.etat === "recu");
    const j = li.querySelector(".jauge"); if (j) { const p = pourcent(x); j.setAttribute("aria-valuenow", p); j.firstElementChild.style.width = p + "%"; }
  }
  const dvMsg = x => { const m = $("dv-msg"); if (m) m.textContent = x; };
  async function ajouterFichiers(liste) {
    for (const f of liste) { const x = { id: "f" + (++dv.n), f, ctrl: null, etat: "", envoyes: 0 }; dv.fichiers.push(x); }
    dv.interrompu = false; dvDessinerListe();
    await Promise.all(dv.fichiers.filter(x => !x.ctrl).map(async x => { x.ctrl = await EN.controler(x.f); }));
    dvDessinerListe();
    // Message d'un envoi refusé (« Ajoutez au moins une vidéo ») effacé dès que le choix change (31/10/2026).
    if (valables().some(x => x.ctrl.genre === "video")) dvMsg("");
  }
  window.addEventListener("beforeunload", ev => { if (dv.envoi || phEnvoi.encours) { ev.preventDefault(); ev.returnValue = t("dv.quitter"); return t("dv.quitter"); } });
  async function envoyerDepot(ouvert) {
    if (dv.envoi) return;
    const ok = valables(), nv = ok.filter(x => x.ctrl.genre === "video").length, np = ok.length - nv;
    if (dv.fichiers.some(x => !x.ctrl)) return;
    const ens = EN.controlerEnsemble(nv, np); if (ens) { dvMsg(t("dv.ens." + ens.code, { n: ens.n })); return; }
    dv.envoi = true; dv.interrompu = false; dv.ctrl = new AbortController(); dvDessinerListe();
    let x = null;
    try {
      const depot = dv.depot || (ouvert ? ouvert.id : (await D.creerDepotVideo({ note: $("dv-note") ? $("dv-note").value : dv.note })).id); dv.depot = depot;
      const recus = await D.fichiersRecus(depot);
      for (let i = 0; i < ok.length; i++) {
        x = ok[i]; dvMsg(dv.reseau === "hors_ligne" ? t("dv.hors.ligne") : t("dv.envoi.en.cours", { i: i + 1, n: ok.length }));
        if (x.etat === "recu" && x.chemin) continue;
        // Fichier déjà complet dans le dossier du dépôt (envoi repris après un rechargement) : il ne repart pas.
        x.etat = "envoi"; dvMajLigne(x);
        const r = await D.envoyerFichierDepot(depot, x.f, i, { signal: dv.ctrl.signal, deja: recus[EN.nomDansDepot(i, x.f)] === x.f.size,
          onProgress: (a) => { x.envoyes = a; dvMajLigne(x); },
          onEtat: et => { dv.reseau = et; dvMsg(et === "hors_ligne" ? t("dv.hors.ligne") : et === "nouvel_essai" ? t("dv.nouvel.essai") : t("dv.envoi.en.cours", { i: i + 1, n: ok.length })); } });
        x.chemin = r.chemin; x.etat = "recu"; x.envoyes = x.f.size; dvMajLigne(x);
      }
      x = null;
      const res = await D.finaliserDepotVideo(depot, ok.map(y => ({ chemin: y.chemin, nom: y.f.name, taille: y.f.size, duree_s: y.ctrl.duree })));
      dv.fichiers = []; dv.envoi = false; dv.note = ""; dv.depot = null;
      await photos(); dvMsg(t("dv.envoye", { v: res.nb_videos, p: res.nb_photos })); majCompteurs();
    } catch (er) {
      dv.envoi = false; if (x && x.etat === "envoi") x.etat = "interrompu"; dv.interrompu = !!x;
      dvDessinerListe(); dvMsg(er && er.annule ? ph(er.message) : x ? t("dv.interrompu") + (er && er.statut ? " (" + ph(er.message) + ")" : "") : ph(er.message));
      if (!x) await dvRafraichirSuivi();
    }
  }
  const dvLigneDepot = d => {
    const duree = d.duree_totale_s != null ? secondes(+d.duree_totale_s) : "";
    return `<li data-depot="${e(d.id)}"><div><p class="fort">${t("dv.depot.du", { d: cap(date(d.cree_le)) })}</p>
      ${d.statut !== "en_envoi" && d.nb_videos ? `<p class="note">${t("dv.depot.contenu", { v: d.nb_videos, p: (d.nb_fichiers || 0) - d.nb_videos, d: duree })}</p>` : ""}
      ${d.note ? `<p class="note">${t("dv.depot.note", { x: `<span${lc()}>${e(d.note)}</span>` })}</p>` : ""}
      ${d.motif && ["refuse", "abandonne"].includes(d.statut) ? `<p class="texte2 dv-motif">${e(ph(d.motif))}</p>` : ""}
      ${d.statut === "a_valider" ? `<p><a href="#/contenus">${t("dv.voir.valider")}</a></p>` : ""}
      ${d.rushes_effaces_le ? `<p class="note">${t("dv.efface.le", { d: date(d.rushes_effaces_le) })}</p>` : ""}</div>
      <span class="etat${d.statut === "a_valider" ? " actif" : ""}">${ST_DV[d.statut] || e(d.statut)}</span></li>`;
  };
  const dvSuivi = l => `<div class="carte-tete"><h2>${t("dv.suivi.titre")}</h2></div>${l.length ? `<ul class="liste">${l.map(dvLigneDepot).join("")}</ul>` : `<p class="texte2">${t("dv.suivi.vide")}</p>`}
    <p class="note">${t("dv.conservation")}</p>`;
  let dvMinuteur = null;
  async function dvRafraichirSuivi() {
    const s_ = $("dv-suivi"); if (!s_) return; const l = await D.depotsVideo(); s_.innerHTML = dvSuivi(l); dvSurveiller(l);
  }
  // Tant qu'un dépôt est envoyé ou en montage et que l'écran reste ouvert : le suivi se relit toutes les 15 secondes (une lecture de la table).
  function dvSurveiller(l) {
    clearTimeout(dvMinuteur);
    if (l.some(d => ["envoye", "en_montage"].includes(d.statut))) dvMinuteur = setTimeout(() => { if ([photos, videoAvis].includes(ecranCourant) && !dv.envoi && $("dv-suivi")) dvRafraichirSuivi().catch(() => {}); }, window.RENOM_SUIVI_MS || 15000);
  }
  let dvOuvert = null;
  async function blocDepotVideo(c) {
    const [k, l] = await Promise.all([D.compteurVideos(), D.depotsVideo()]), o = window.RENOM_OFFRES[c.offre_id] || {};
    // Offre sans réseaux (Essentiel, 26/10/2026) : aucune carte « Vidéos » (une vidéo ne se publie pas sur la fiche Google). Changement d'offre
    // (27/10/2026, constat 20) : une offre sans vidéo n'affiche plus le suivi des anciens dépôts (ceux pas encore montés sont annulés par la base,
    // changer_offre_commerce) ; les vidéos déjà montées restent dans « À valider » et le calendrier. Croissance : la carte dit ce qu'apporte le Premium.
    if (!k.videos_plafond && sansReseaux(c)) return "";
    if (!k.videos_plafond) return `<section class="carte" id="depot-video"><h2>${t("dv.sans.titre")}</h2><p class="texte2">${t("dv.sans.texte", { offre: e(I.offre(c.offre_id)), v: (window.RENOM_OFFRES.premium || {}).videos })}</p>
      <p class="pied"><a class="bouton second" href="#/offre?dessus=premium" id="dv-passer">${t("offre.passer.lien", { nom: e(I.offre("premium")) })}</a></p></section>`;
    dvOuvert = l.find(d => d.statut === "en_envoi" && Date.now() - Date.parse(d.cree_le) < DV.OUVERT_MS) || null;
    const attente = k.videos_reservees - k.videos_utilisees, plein = k.videos_reservees >= k.videos_plafond && !dvOuvert;
    const plans = t("dv.plans." + (c.metier === "restaurant" ? "restaurant" : "autre"));
    return `<section class="carte" id="depot-video" aria-labelledby="dv-titre">
      <div class="carte-tete"><h2 id="dv-titre">${t("dv.titre")}</h2><span class="note" id="dv-compteur">${t("dv.compteur.reste", { a: k.videos_reservees, b: k.videos_plafond, r: Math.max(0, k.videos_plafond - k.videos_reservees), n: attente })}</span></div>
      ${dvOuvert && !dv.envoi ? `<div class="alerte dv-ouvert" role="status"><div><p class="fort">${t("dv.ouvert.titre")}</p><p>${t("dv.ouvert.texte", { d: I.dateHeureDans(dvOuvert.cree_le) })}</p>
        <p><button type="button" class="lien" id="dv-annuler">${t("dv.annuler")}</button></p></div></div>` : ""}
      ${/* Tour 9 (01/11/2026, Premium) : « Filmer » et « Choisir des vidéos » juste sous le titre, visibles sans défiler sur un écran de 390 × 664 ;
         le texte d'explication et le guide « Bien filmer » passent dessous (sur ordinateur, le guide reste à gauche, CSS .dv-infos). */ ""}
      <div class="dv-grille">
        ${plein ? `<div><p class="texte2" id="dv-plein">${t("dv.plafond")}</p><p class="msg" id="dv-msg" role="status" aria-live="polite"></p></div>` : `<form id="fv" class="dv-form" novalidate><div class="f"><div class="depot">
            <span class="depot-choix"><input id="filmer" class="vh" type="file" accept="video/*" capture="environment"><label for="filmer" class="bouton second appareil-photo">${CAMERA}<span>${t("dv.filmer")}</span></label></span>
            <span class="depot-choix"><input id="videos" class="vh" type="file" accept="video/*" multiple><label for="videos" class="bouton second">${FILM}<span>${t("dv.choisir")}</span></label></span>
            <span class="depot-choix"><input id="photos-depot" class="vh" type="file" accept="image/*" multiple><label for="photos-depot" class="bouton second">${GALERIE}<span>${t("dv.photos")}</span></label></span>
            <span class="note" id="dv-choisies" aria-live="polite">${t("dv.aucun.fichier")}</span></div>
            <p class="aide">${t("dv.aide", { duree: EN.REGLES.DUREE_MAX_S, max: nombre(EN.REGLES.VIDEO_MAX_MO) })}</p></div>
          <ul class="liste dv-fichiers" id="dv-fichiers" aria-live="off"></ul>
          <div class="alerte dv-lourde" id="dv-lourde" hidden><div><p class="fort">${t("dv.lourde.titre")}</p><p>${t("dv.lourde.texte")}</p><p>${t("dv.lourde.iphone")}</p><p>${t("dv.lourde.android")}</p></div></div>
          ${dvOuvert ? "" : `<div class="f"><label for="dv-note">${t("dv.note")}</label><textarea id="dv-note" maxlength="${EN.REGLES.NOTE_MAX}" rows="2" aria-describedby="dv-note-aide">${e(dv.note)}</textarea><p class="aide" id="dv-note-aide">${t("dv.note.aide")}</p></div>`}
          <button class="bouton" type="submit" id="dv-envoyer">${t("dv.envoyer")}</button><p class="msg" id="dv-msg" role="status" aria-live="polite"></p></form>`}
        <div class="dv-infos"><p class="texte2">${t("dv.chapo")} ${t("dv.delai")}</p>
        <p class="note" id="dv-comptent">${t("dv.comptent")}</p>
        <details class="dv-guide repliable sous" id="dv-guide"${large.matches ? " open" : ""}><summary><h3>${t("dv.guide.titre")}</h3></summary><div class="dv-guide-corps"><ol class="dv-points" id="dv-guide-points">${[1, 2, 3, 4, 5].map(i => `<li>${t("dv.guide." + i)}</li>`).join("")}</ol>
          <p class="note" id="dv-guide-accord">${t("dv.guide.accord")}</p>
          <h3>${t("dv.plans.titre." + (c.metier === "restaurant" ? "restaurant" : "autre"))}</h3><ul class="dv-points">${plans.map(x => `<li>${x}</li>`).join("")}</ul></div></details></div>
      </div></section>
      <section class="carte" id="dv-suivi">${dvSuivi(l)}</section>`;
  }
  function brancherDepotVideo() {
    D.depotsVideo().then(dvSurveiller).catch(() => {});
    if (!$("fv")) return;
    dvDessinerListe();
    ["filmer", "videos", "photos-depot"].forEach(id => { $(id).onchange = async () => { const l = [...$(id).files]; $(id).value = ""; if (l.length) await ajouterFichiers(l);
      const b_ = $("dv-envoyer"); if (l.length && b_ && b_.getBoundingClientRect().bottom > innerHeight - 90) b_.scrollIntoView({ block: "center" }); }; });
    $("dv-fichiers").onclick = ev => { const b = ev.target.closest("[data-dv-retirer]"); if (!b || dv.envoi) return; dv.fichiers = dv.fichiers.filter(x => x.id !== b.dataset.dvRetirer); dvDessinerListe(); };
    if ($("dv-note")) $("dv-note").oninput = () => { dv.note = $("dv-note").value; };
    $("fv").onsubmit = ev => { ev.preventDefault(); envoyerDepot(dvOuvert); };
    if ($("dv-annuler")) $("dv-annuler").onclick = async () => { try { await D.annulerDepotVideo(dvOuvert.id); dv.fichiers = []; dv.interrompu = false; dv.depot = null; await photos(); dvMsg(t("dv.annule")); } catch (er) { dvMsg(ph(er.message)); } };
    if ($("dv-annuler") && dv.depot && dvOuvert && dv.depot !== dvOuvert.id) dv.depot = null;
    if (dv.envoi) dvMsg(dv.reseau === "hors_ligne" ? t("dv.hors.ligne") : t("dv.envoi.en.cours", { i: valables().findIndex(x => x.etat !== "recu") + 1, n: valables().length }));
  }

  // ---------------- Contenus
  const FILTRES = ["a_valider", "approuve", "programme", "publie", "hors_offre", "autres"].map(k => [k, t("filtre." + k)]);
  const VIDE_FILTRE = I.carte("filtre.vide", ["a_valider", "approuve", "programme", "publie", "hors_offre", "autres"]);
  // Hors offre (01/11/2026, tour 6 Essentiel) : un contenu validé dont le format ne part sur aucun réseau de l'offre (story ou vidéo après le passage
  // à l'Essentiel) n'est pas « à programmer » ; onglet « Hors offre », montré seulement s'il en a. Même règle à l'accueil et au calendrier (prets).
  const horsOffreContenu = (x, c) => x.statut === "approuve" && !!c && M.reseauxDuContenu(x, window.RENOM_RESEAUX_AUTORISES(c)).length === 0;
  // Onglet « Refusés » (clé « autres », 31/10/2026) : les contenus refusés seulement ; une modification demandée reste avec « À valider »
  // (elle y revient, refaite par l'équipe).
  // Hors offre (01/11/2026, tour 7 Essentiel) : aucun bouton de programmation (rien ne peut partir) ; « Ne part pas avec l'offre … » et le lien vers
  // l'offre du dessus (#/offre?dessus), quand elle existe.
  const blocHorsOffre = c => { const d = offreCible(c);
    return `<div class="encart" data-hors-offre><p class="fort">${t("contenus.hors.offre", { nom: e(I.offre(c.offre_id)) })}</p>${d ? `<p><a href="#/offre?dessus" data-hors-offre-dessus>${t("offre.dessus.passer", { nom: e(I.offre(d)) })}</a></p>` : ""}</div>`; };
  const famille = (x, c) => x.statut === "modification" ? "a_valider" : horsOffreContenu(x, c || commerceVu) ? "hors_offre" : FILTRES.some(f => f[0] === x.statut) ? x.statut : "autres";
  let filtre = null;
  // Les idées sont fusionnées dans Contenus : bouton « Proposer des idées », qui ouvre le panneau des idées.
  let ideesOuvertes = false, versCarte = false;
  async function panneauIdees(c) {
    // Hors plafond depuis le 22/10/2026 (décision de PJ) : une demande ne consomme plus de publication ; la base en accepte une par 24 heures.
    const [k, l, T] = await Promise.all([D.compteur(), D.idees(), chargerTraductionsIdees()]);
    return `<section class="carte" id="idees" aria-labelledby="idees-titre"><div class="carte-tete"><h2 id="idees-titre">${t("idees.titre")}</h2><button type="button" class="lien" id="fermer-idees">${t("fermer")}</button></div>
        <p class="texte2">${t("idees.texte")}</p>
        <div class="actions"><button type="button" class="bouton" id="demande"${c.en_pause ? " disabled" : ""}>${t("idees.demander")}</button><p class="msg" id="msg-idees" role="status"></p></div>
        ${l.length ? `<ul class="liste idees">${l.map(x => { const v = ideeVue(x, T); return `<li${x.semaine ? ` data-idee="${e(x.id)}"` : ""}><div><p class="fort"${lcIdee(v)}>${e(v.titre)}</p><p class="texte2"${lcIdee(v)}>${e(v.texte)}</p>
          ${x.semaine ? `<p class="note">${t("idee.semaine")}${v.motif ? `. <span${lcIdee(v)}>${e(v.motif)}</span>` : ""}</p>${x.statut === "a_valider" ? `<div class="actions"><button type="button" class="bouton second petit" data-decider-idee="retenue">${t("idee.retenir")}</button><button type="button" class="lien" data-decider-idee="ecartee">${t("idee.ecarter")}</button></div>` : ""}` : ""}</div>
          <span class="note">${x.semaine && x.statut !== "a_valider" ? t(x.statut === "retenue" ? "idee.retenue" : "idee.ecartee") + ", " : ""}${cap(date(x.cree_le))}</span></li>`; }).join("")}</ul>` : `<p class="texte2">${t("idees.vide")}</p>`}</section>`;
  }
  // Délégation (01/11/2026, tour 6 Premium) : Premium sans délégation active, une ligne et le bouton d'activation de l'écran Offre (même fonction,
  // regler_delegation : accord horodaté avec la version des CGV). Base sans ce réglage par bouton : rien (l'écran Offre dit « écrivez-nous »).
  const ligneDelegation = c => !offreDe(c).delegation || delegationActive(c) || !(D.reglerDelegation && D.delegationParBouton && D.delegationParBouton(c)) ? ""
    : `<div class="encart" id="contenus-delegation"><p class="texte2">${t("contenus.deleg.ligne", { h: COND.delegation.publication_auto_heures })}</p>
      <div class="actions"><button type="button" class="bouton second" id="contenus-delegation-activer">${t("offre.deleg.activer")}</button></div><p class="note">${t("offre.deleg.trace")}</p></div>`;
  async function contenus() {
    const [c, l, cpt, calc, kc] = await Promise.all([D.commerce(), D.contenus(), D.comptes().catch(() => null), D.calendrier().catch(() => []), D.compteur().catch(() => null)]);
    // Limite du mois (01/11/2026, tour 7 Essentiel) : même règle que remettre_a_valider (usage_publications >= plafond, refusées non comptées).
    pubPlein = !!(kc && +kc.publications_plafond > 0 && (+kc.publications_utilisees || 0) >= +kc.publications_plafond);
    pubDepasse = !!(kc && +kc.publications_plafond > 0 && (+kc.publications_utilisees || 0) - 1 >= +kc.publications_plafond); const nbf = Object.fromEntries(FILTRES.map(f => [f[0], l.filter(x => famille(x, c) === f[0]).length]));
    nomCommerce = c.nom; commerceVu = c; comptesVus = cpt; if (demandesTiktok[c.id] == null) await chargerDemandeTiktok(c);   // note TikTok des aperçus
    // Quand part ce contenu (31/10/2026) : programmé, sa date ; à valider, le créneau qu'il prendrait s'il est approuvé maintenant (même règle que la base).
    const pris = calc.filter(p => ["programme", "envoye", "publie"].includes(p.statut)).map(p => Date.parse(p.prevu_le));
    // Date annoncée = date programmée (01/11/2026) : même fonction que la programmation automatique (creneauPour : offre et moment du texte compris).
    const prochain = x => { try { return M.creneauPour(c, pris, x); } catch (er) { return null; } };
    const quand = x => { const p = calc.find(y => y.contenu_id === x.id && ["programme", "envoye", "publie"].includes(y.statut));
      if (p) return t(p.statut === "programme" ? "contenus.quand.prevu" : "contenus.quand.parti", { quand: I.dateHeureDans(p.prevu_le) });
      // Validée sans date (test client Croissance) : « Validée aujourd'hui », jamais « Aujourd'hui » seul.
      if (x.statut === "approuve") { const d = x.decide_le || x.cree_le, j = new Date(d), rel = memeJour(j, new Date()) ? "aujourdhui" : memeJour(j, new Date(Date.now() - 86400000)) ? "hier" : "";
        return t("contenus.quand.validee." + (rel || "le"), { d: date(d) }); }
      // Refusée (31/10/2026, test client Premium) : « Refusée aujourd'hui / hier / le … », lu sur decide_le.
      if (x.statut === "refuse") { const d = x.decide_le || x.cree_le, j = new Date(d), rel = memeJour(j, new Date()) ? "aujourdhui" : memeJour(j, new Date(Date.now() - 86400000)) ? "hier" : "";
        return t("contenus.quand.refusee." + (rel || "le"), { d: date(d) }); }
      const q = x.statut === "a_valider" && destDe(x).partent.length ? prochain(x) : null;
      return q ? t("contenus.quand.si", { quand: I.dateHeureDans(q) }) : jourRelatif(x.cree_le); };
    // Délégation (01/11/2026, tour 8) : la date « sans réponse » est le VRAI créneau tacite, calculé par la même règle que « si vous validez »
    // (creneauPour), à partir de l'échéance des 48 h (valider_tacitement valide à l'échéance, puis programme au premier créneau libre à 2 h au moins).
    // Elle ne vient donc jamais avant la date « si vous validez » ; la phrase dit pourquoi elle est plus tard (l'échéance).
    const echeanceTacite = x => { const ech = Date.parse(x.soumis_le || x.cree_le) + COND.delegation.publication_auto_heures * 3600000;
      let q = null; try { q = destDe(x).partent.length ? M.creneauPour(c, pris, x, Math.max(Date.now(), ech)) : null; } catch (er) { q = null; }
      return `<p class="note fort" data-deleg-echeance>${q ? t("contenus.deleg.echeance.creneau", { e: I.dateHeureDans(new Date(ech).toISOString()), d: I.dateHeureDans(new Date(q).toISOString()) })
        : t("contenus.deleg.echeance", { d: I.dateHeureDans(new Date(ech).toISOString()) })}</p>`; };
    if (!filtre) filtre = (FILTRES.find(f => nbf[f[0]]) || FILTRES[0])[0];
    if (filtre === "hors_offre" && !nbf.hors_offre) filtre = (FILTRES.find(f => nbf[f[0]]) || FILTRES[0])[0];
    const liste = l.filter(x => famille(x, c) === filtre), urls = await Promise.all(liste.map(x => urlSure(x))), vids = await Promise.all(liste.map(videoSure));
    const u9s = await Promise.all(liste.map(url916));   // onglet TikTok de chaque publication photo : le 9:16 qui part
    const formatCourt = x => t("format.court." + M.formatDe(x));
    vue.innerHTML = `${pauseBandeau(c)}<div class="entete-accueil contenus-tete">${entete(t("groupe.avalider"), t("contenus.titre"), `<span class="sur-ordi">${t(delegationActive(c) ? "contenus.chapo.delegation" : sansReseaux(c) ? "contenus.chapo.google" : "contenus.chapo")}</span><span class="sur-tel">${delegationActive(c) ? t("contenus.chapo.delegation") : `<span class="lib-long">${t("contenus.chapo.court")}</span><span class="lib-court">${t("contenus.chapo.mini")}</span>`}</span>`)}
        <button type="button" class="bouton second" id="proposer-idees" aria-expanded="${ideesOuvertes}" aria-controls="idees"><span class="lib-long">${t("idees.titre")}</span><span class="lib-court">${t("idees.titre.court")}</span></button></div>
      ${ideesOuvertes ? await panneauIdees(c) : ""}
      ${await proposition(c)}
      ${/* Tour 12 (v38) : à toutes les largeurs, la proposition de délégation passe sous les contenus : « Valider » d'abord (tour 11 : sous 360 px seulement). */ ""}
      ${/* Tour 11 (v37, 320 px : « Valider » à 1 137 px) : sous 360 px, seul le filtre actif reste affiché, avec « Autres filtres, N » qui déplie les autres
         (feuille de style : .filtres:not(.ouverts)) ; au-dessus de 360 px, le bouton n'est pas rendu et tous les filtres restent visibles. */ ""}
      ${l.length ? `<div class="filtres" role="group" aria-label="${t("filtres.aria")}">${FILTRES.filter(([k]) => k !== "hors_offre" || nbf[k]).map(([k, nom]) => `<button type="button" data-f="${k}" aria-pressed="${k === filtre}">${nom}, ${nbf[k]}</button>`).join("")}${matchMedia("(max-width: 359px)").matches ? `<button type="button" class="filtres-plus" id="filtres-plus" aria-expanded="false">${t("filtres.autres", { n: FILTRES.filter(([k]) => (k !== "hors_offre" || nbf[k]) && k !== filtre).length })}</button>` : ""}</div>
      <p class="msg" id="msg" role="status"></p>
      ${liste.length && filtre === "approuve" && !approuveRecent ? noteCreneaux(c.metier) : ""}
      ${liste.length ? `<div class="cartes">${liste.map((x, i) => `<article class="carte contenu${x.statut === "a_valider" ? " a-decider" : ""}" data-contenu="${e(x.id)}">
        <p class="meta"><span>${formatCourt(x)}${x.depot_video_id ? " · " + t("dv.montage.de.vos") : ""}</span><span class="etat${x.statut === "a_valider" ? " actif" : ""}">${ST_CONTENU[x.statut] || e(x.statut)}</span></p>
        <p class="note contenu-quand" data-quand>${cap(quand(x))}</p>
        ${/* Délégation active (01/11/2026, tour 7 Premium) : l'échéance de 48 h ; la base valide puis programme au créneau (valider_tacitement). */ ""}
        ${x.statut === "a_valider" && delegationActive(c) ? echeanceTacite(x) : ""}
        ${etiquetteIA(x)}${blocReseaux(x, urls[i], vids[i], u9s[i], x.statut === "a_valider" ? decisions(x, t("contenus.refuser")) : null)}<div class="contenu-corps">
        ${x.note_modification ? `<p class="note">${t(x.statut === "refuse" ? "contenus.motif" : "contenus.demande")}<span${lc()}>${e(x.note_modification)}</span></p>` : ""}
        ${x.statut === "modification" ? `<p class="note fort" data-modif-delai>${t(x.decide_le ? "contenus.modif.delai.le" : "contenus.modif.delai", { d: x.decide_le ? date(x.decide_le) : "" })}</p>` : ""}
        ${x.statut === "a_valider" ? formatsPublies(x, urls[i], u9s[i]) : horsOffreContenu(x, c) ? blocHorsOffre(c) : x.statut === "approuve" ? boutonsAuto(x.id, c.metier)
          : x.statut === "refuse" ? (pubPlein && x.type === "publication" ? `<p class="note" data-remettre-plein>${t("contenus.remettre.plein", { mois: (new Date().getMonth() + 1) % 12 })}</p>`
            : `<div class="actions"><button type="button" class="bouton second" data-remettre="${e(x.id)}">${t("contenus.remettre")}</button></div>`) : ""}</div></article>`).join("")}</div>`
      : `<section class="carte"><p class="texte2">${VIDE_FILTRE[filtre]}${filtre === "a_valider" && nbf.approuve ? ` <span id="vide-a-programmer">${t("filtre.vide.a_programmer", { n: nbf.approuve, lien: `<a href="#/calendrier">${e(ECRANS.calendrier)}</a>` })}</span>` : ""}</p></section>`}`
      : `<section class="carte"><h2>${t("contenus.vide.titre")}</h2><p class="texte2">${t("contenus.vide.texte")}</p><p class="pied"><a class="bouton" href="#/photos">${t("photos.deposer")}</a></p></section><p class="msg" id="msg" role="status"></p>`}`;
    if (ligneDelegation(c)) vue.insertAdjacentHTML("beforeend", ligneDelegation(c));   // après les contenus, à toutes les largeurs (tour 12)
    vue.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { filtre = b.dataset.f; contenus(); });
    if ($("filtres-plus")) $("filtres-plus").onclick = () => { const b_ = $("filtres-plus"), f_ = b_.closest(".filtres"), ouvert = !f_.classList.contains("ouverts");
      f_.classList.toggle("ouverts", ouvert); b_.setAttribute("aria-expanded", String(ouvert)); b_.textContent = ouvert ? t("filtres.replier") : t("filtres.autres", { n: f_.querySelectorAll("[data-f][aria-pressed=false]").length }); };
    if ($("contenus-delegation-activer")) $("contenus-delegation-activer").onclick = async () => { const b = $("contenus-delegation-activer"); b.disabled = true;
      try { await D.reglerDelegation(true); await contenus(); toast(t("offre.deleg.ok.active")); } catch (er) { b.disabled = false; msg(ph(er.message)); } };
    vue.querySelectorAll("[data-remettre]").forEach(b => b.onclick = async () => { b.disabled = true;
      try { await D.remettreAValider(b.dataset.remettre); filtre = "a_valider"; await contenus(); toast(t("contenus.remis")); majCompteurs(); } catch (er) { b.disabled = false; toast(ph(er.message)); } });   // un seul message (tour 7 : il s'affichait en double)
    // Téléphone : les filtres défilent sur une ligne ; le filtre choisi reste visible après le nouveau rendu.
    const fl = vue.querySelector(".filtres"), fp = fl && fl.querySelector("[aria-pressed=true]");
    if (fp && fl.scrollWidth > fl.clientWidth) fl.scrollLeft += fp.getBoundingClientRect().left - fl.getBoundingClientRect().left - 8;
    // Fondu à droite tant qu'il reste des filtres cachés à droite (27/10/2026, constat 34).
    const fondu = () => { if (fl) fl.classList.toggle("deborde", fl.scrollLeft + fl.clientWidth < fl.scrollWidth - 4); };
    if (fl) { fondu(); fl.addEventListener("scroll", fondu, { passive: true }); }
    $("proposer-idees").onclick = async () => { ideesOuvertes = !ideesOuvertes; await contenus(); if (ideesOuvertes) $("demande").focus(); };
    if ($("fermer-idees")) $("fermer-idees").onclick = async () => { ideesOuvertes = false; await contenus(); $("proposer-idees").focus(); };
    if ($("demande")) $("demande").onclick = async () => { try { await D.demanderIdees(); await contenus(); msg(t("idees.enregistree")); majCompteurs(); } catch (er) { $("msg-idees").textContent = ph(er.message); } };
    brancherDecisions(vue, contenus); brancherAutomatisations(vue, contenus);
    if (versCarte) { versCarte = false; const a = vue.querySelector('[data-contenu]'); if (a && filtre === "a_valider") a.scrollIntoView({ block: "start" }); }
  }

  // ---------------- Calendrier
  // À l'arrivée sur l'écran (test client Croissance) : le mois de la prochaine publication programmée, pas forcément le mois en cours ;
  // les flèches et les modes gardent ensuite le mois choisi, jusqu'à ce qu'on quitte l'écran.
  const cal = { mode: "mois", ref: new Date(), auto: true };
  addEventListener("hashchange", () => { if (!location.hash.startsWith("#/calendrier")) cal.auto = true; });
  // Calendrier « pas programmable » (26/10/2026, test réel de PJ en Premium) : tant qu'aucun réseau social du commerce n'est relié à notre outil
  // de programmation et vérifié par l'équipe (compte « connecte » : admin_acces_reseau de schema.sql ; étape de mise en route « metricool »),
  // rien ne se programme sur les réseaux. Le calendrier le dit en tête : pourquoi, où en est l'étape (à faire, déclarée et en vérification,
  // ou faite mais accès inactif), ce qui se passe ensuite (à l'accès vérifié, les contenus approuvés se programment seuls : schema.sql, bloc
  // « Accès vérifié »), avec un lien vers la mise en route (#/miseenroute) ou vers Comptes connectés. Essentiel (fiche Google seulement) :
  // jamais ce message, et le formulaire ne propose que la fiche Google.
  function calendrierBloque(c, connectes, mr) {
    if (sansReseaux(c)) return "";
    const sociaux = window.RENOM_RESEAUX_AUTORISES(c).filter(r => r !== "google");
    if (connectes.some(r => sociaux.includes(r))) return "";
    const p = ((mr && mr.points) || []).find(x => x.point === "metricool"), etat = p ? p.etat : "a_faire";
    const merVisible = !!(mr && mr.points && mr.faits < mr.total), lien = etat === "fait" || !merVisible ? ["#/comptes", "cal.bloque.lien.comptes"] : ["#/miseenroute", "cal.bloque.lien.mer"];
    return `<section class="alerte cal-bloque" id="cal-bloque" data-etape="${e(etat)}" aria-labelledby="cal-bloque-titre"><div>
      <p class="fort" id="cal-bloque-titre">${t("cal.bloque.titre")}</p>
      <p id="cal-bloque-pourquoi">${t("cal.bloque.pourquoi")}</p>
      <p id="cal-bloque-etape">${t("cal.bloque.etape." + (["declare", "fait"].includes(etat) ? etat : "a_faire"))}</p>
      <p id="cal-bloque-ensuite">${t(etat === "declare" ? "cal.bloque.ensuite.declare" : "cal.bloque.ensuite")}</p></div>
      <a class="bouton second" id="cal-bloque-lien" href="${lien[0]}">${t(lien[1])}</a></section>`;
  }
  // Alertes d'un créneau choisi à la main (déplacer ou programmer) : jour de fermeture (horaires), jour férié nommé, heure hors 7 h-23 h,
  // autre publication à moins d'une heure ; avec le créneau conseillé à partir du jour demandé.
  // Une seule alerte (01/11/2026, tour 6 Croissance : « jour fermé » et « déjeuner » s'affichaient l'une sur l'autre) : le moment du texte s'ajoute
  // aux motifs quand le jour pose déjà problème, et le créneau conseillé (creneauPour) respecte à la fois le jour ouvert et le moment du texte.
  const momentDecale = (ct, nh) => { const mo = ct ? M.momentLegende(M.texteDuContenu(ct)) : null, h = +String(nh || "").slice(0, 2);
    return mo === "midi" && h >= 15 ? "midi" : mo === "soir" && nh && h < 17 ? "soir" : null; };
  const jourBloque = (c, nj) => { const js = new Date(nj + "T12:00:00Z").getUTCDay() || 7, ouv = M.joursOuverts(c.horaires); return (ouv && !ouv.includes(js)) || !!M.ferieDe(nj, c.pays); };
  function alertesCreneau(c, nj, nh, autres, ct) {
    const js = new Date(nj + "T12:00:00Z").getUTCDay() || 7, ouv = M.joursOuverts(c.horaires), h = +nh.slice(0, 2), voulu = new Date(nj + "T" + nh).getTime();
    const proche = autres.find(x => Math.abs(Date.parse(x.prevu_le) - voulu) < 3600000), fe = M.ferieDe(nj, c.pays);
    const motifs = [ouv && !ouv.includes(js) ? t("cal.alerte.ferme") : "", fe ? t("cal.alerte.ferie.nom", { nom: t("ferie." + fe) }) : "", h < 7 || h >= 23 ? t("cal.alerte.heure") : "",
      proche ? t("cal.alerte.pris", { quand: I.dateHeureDans(proche.prevu_le) }) : ""].filter(Boolean);
    const md = momentDecale(ct, nh); if (motifs.length && md) motifs.push(t("cal.alerte.moment." + md));
    let conseil = null;
    if (motifs.length) { try { conseil = M.creneauPour(c, autres.map(x => Date.parse(x.prevu_le)), ct, Math.max(Date.now(), new Date(nj + "T00:00").getTime())); } catch (er) { conseil = null; } }
    return { motifs, conseil };
  }
  function montrerAlerte(za, a, cle, focus = true) {
    za.querySelector("[data-alerte-texte]").textContent = a.motifs.join(" ");
    const bc = za.querySelector("[data-a=" + cle + "-conseil]"); bc.hidden = !a.conseil; if (a.conseil) { bc.dataset.q = new Date(a.conseil).toISOString(); bc.textContent = t("cal.conseil", { quand: I.dateHeureDans(a.conseil) }); }
    const zm = $("cal-moment"); if (zm) zm.hidden = true;   // une seule alerte : celle du créneau conseillé
    za.hidden = false; if (focus) (a.conseil ? bc : za.querySelector("[data-a=" + cle + "-force]")).focus({ preventScroll: true });
  }
  async function calendrier() {
    const [c, l, ct, cpt, mr] = await Promise.all([D.commerce(), D.calendrier(), D.contenus(), D.comptes(), D.miseEnRoute().catch(() => null)]);
    const connectes = cpt.filter(x => x.etat === "connecte").map(x => x.reseau), vign = await Promise.all(l.map(x => urlSure(x.contenu)));
    // Validés sans date (même liste que « Programmer tout » de l'accueil) : approuvés, sans programmation en cours.
    const aProgrammerCal = sansDateDe(ct, l, cpt, c);
    // TikTok demandé (01/11/2026, tour 6 Premium) : « TikTok (activation demandée) » au lieu de « (non connecté) ».
    if (cpt.some(x => x.reseau === "tiktok" && x.etat !== "connecte")) await chargerDemandeTiktok(c);
    const nonConnecte = r => r === "tiktok" && tiktokDemande(c) ? t("cal.tiktok.demande") : t(r === "google" ? "cal.non.connectee" : "cal.non.connecte");
    // Réseaux proposés au formulaire : ceux de l'offre et retenus (Essentiel : la fiche Google seule), dans l'ordre habituel.
    const autorises = window.RENOM_RESEAUX_AUTORISES(c), proposes = ORDRE_RES.filter(r => autorises.includes(r));   // ordre fixe : Instagram, Facebook, TikTok, Fiche Google
    // Programmer à la main (31/10/2026, test client Essentiel) : seuls les contenus qui peuvent partir sur un réseau de l'offre (une story ne va
    // jamais sur la fiche Google) ; les destinations suivent le contenu choisi, cochée d'office quand il n'y en a qu'une.
    const actifs = l.filter(x => x.statut !== "annule"), prets = ct.filter(x => x.statut === "approuve" && M.reseauxDuContenu(x, autorises).length > 0);
    // « Choisir moi-même » depuis un contenu approuvé (#/calendrier?contenu=<id>) : ce contenu présélectionné, au prochain bon créneau du commerce.
    const voulu = decodeURIComponent((/(?:^|&)contenu=([^&]+)/.exec(paramRoute) || [])[1] || "");
    // Publication désignée (#/calendrier?pub=<id>, 01/11/2026 : lignes de « Programmer tout ») : sa semaine ou son mois, et sa ligne amenée à l'écran.
    const pubVoulue = decodeURIComponent((/(?:^|&)pub=([^&]+)/.exec(paramRoute) || [])[1] || ""), pv = pubVoulue && l.find(x => x.id === pubVoulue);
    if (!pubVoulue) cal.pub = null;
    if (pv && cal.pub !== pubVoulue) { cal.pub = pubVoulue; cal.auto = false; cal.ref = new Date(pv.prevu_le); }
    const occupes = l.filter(x => ["programme", "envoye", "publie"].includes(x.statut));
    let defaut = null; try { defaut = M.creneauPour(c, occupes.map(x => Date.parse(x.prevu_le)), ct.find(x => x.id === voulu) || null); } catch (er) { defaut = null; }
    const jourDefaut = defaut ? jourLocal(defaut) : demain(), heureDefaut = defaut ? heureLocale(defaut) : "12:00";
    // Publication restée sur un réseau sorti de l'offre (audit Essentiel du 31/10/2026) : pas de « Déplacer » (elle serait annulée quand même) ;
    // « Publier sur la fiche Google à la place » quand l'offre a la fiche Google, qu'elle est connectée et que le format y va (pas une story ni une vidéo).
    const versGoogle = x => autorises.includes("google") && connectes.includes("google") && !!x.contenu && M.reseauxDuContenu(x.contenu, autorises).includes("google");
    const libContenu = x => x.type === "video" ? t("type.video") : M.formatDe(x) === "story" ? t("cal.type.story") : t("type.publication.cap");
    // Contenu nommé dans la confirmation (31/10/2026, test client Premium) : « Vidéo « Ce que disent nos clients » programmée le… » ; le titre
    // est la première phrase de la légende. Aucun autre contenu n'est ensuite présélectionné : le choix reste à faire (sauf s'il n'y en a qu'un).
    const typeCourt = x => x.type === "video" ? t("type.video") : M.formatDe(x) === "story" ? t("cal.type.story.court") : t("type.publication.cap");
    const titreContenu = x => cut(String(x.titre || (x.legende || "").split(/[.!?\n]/)[0] || "").trim(), 60);
    const choixFait = prets.some(x => x.id === voulu) || prets.length === 1;
    if (cal.auto) { cal.auto = false; const pro = actifs.filter(x => x.statut === "programme" && Date.parse(x.prevu_le) >= Date.now()).map(x => Date.parse(x.prevu_le)).sort((p, q) => p - q)[0]; cal.ref = pro ? new Date(pro) : new Date(); }
    const ref = new Date(cal.ref), aujourd = new Date(); let grille = "";
    const du = d => actifs.filter(x => memeJour(new Date(x.prevu_le), d));
    const lundi = (() => { const d = new Date(ref); d.setDate(ref.getDate() - ((ref.getDay() + 6) % 7)); return d; })();
    // Jour vide à venir (01/11/2026, tour 6 Croissance) : un bouton qui préremplit la date de « Programmer à la main » et y fait défiler.
    const jourIso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const libre = d => prets.length > 0 && jourIso(d) >= jourIso(aujourd);
    const boutonLibre = (d, contenu, cls = "") => `<button type="button" class="cal-saut cal-libre${cls}" data-jour="${jourIso(d)}" aria-label="${e(t("cal.libre.aria", { d: I.jourEtDate(d) }))}">${contenu}</button>`;
    if (cal.mode === "mois") {
      const p = new Date(ref.getFullYear(), ref.getMonth(), 1), dec = (p.getDay() + 6) % 7, n = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
      grille = `<div class="cal" role="grid" aria-label="${MOIS[ref.getMonth()]} ${ref.getFullYear()}">${JOURS.map(j => `<div class="ent">${j}</div>`).join("")}` + Array.from({ length: Math.ceil((dec + n) / 7) * 7 }, (_, i) => {
        const j = i - dec + 1; if (j < 1 || j > n) return `<div class="hors"></div>`; const d = new Date(ref.getFullYear(), ref.getMonth(), j), it = du(d);
        // Jour qui a une publication (31/10/2026, test client Premium, tour 5) : tout le jour est un bouton (44 px au moins) qui mène à la publication.
        if (it.length) return `<div class="a-pub"${memeJour(d, aujourd) ? ' aria-current="date"' : ""}><button type="button" class="cal-saut" data-saut="${e(it[0].id)}" aria-label="${e(t("cal.saut.aria", { d: I.jourEtDate(d), n: it.length }) + " (" + I.liste(it.map(x => heure(x.prevu_le))) + ")")}"><span class="n">${j}</span>${it.map(x => `<span data-cell${horsOffreDe(x, autorises) ? ' class="hors-offre"' : ""}><span class="h-long">${heureGrille(x.prevu_le)}</span><span class="h-court" aria-hidden="true">${I.heureMini(x.prevu_le)}</span></span>`).join("")}</button></div>`;
        return `<div${memeJour(d, aujourd) ? ' aria-current="date"' : ""}>${libre(d) ? boutonLibre(d, `<span class="n">${j}</span>`) : `<span class="n">${j}</span>`}</div>`; }).join("") + "</div>";
    } else {
      grille = `<ul class="liste semaine" aria-label="${t("cal.semaine.aria")}">` + Array.from({ length: 7 }, (_, i) => { const d = new Date(lundi); d.setDate(lundi.getDate() + i); const it = du(d);
        return `<li${memeJour(d, aujourd) ? ' aria-current="date"' : ""}>${it.length ? `<button type="button" class="cal-saut fort" data-saut="${e(it[0].id)}" aria-label="${e(t("cal.saut.aria", { d: I.jourEtDate(d), n: it.length }))}">${I.jourEtDate(d)}</button>` : libre(d) ? boutonLibre(d, I.jourEtDate(d), " fort") : `<p class="fort">${I.jourEtDate(d)}</p>`}<div>${it.length ? it.map(x => `<p${horsOffreDe(x, autorises) ? ' class="hors-offre"' : ""}><span class="barrable">${heure(x.prevu_le)}</span> · ${destTexte(x, autorises)} · <span class="barrable"${lc()}>${e(cut(x.contenu?.legende || "", 60))}</span></p>`).join("") : `<p class="note">${t("cal.rien")}</p>`}</div></li>`; }).join("") + "</ul>";
    }
    // Chapeau selon la vraie situation (31/10/2026, test client Premium) : aucun réseau connecté (le bloc en dessous dit pourquoi), contenus approuvés
    // restés sans date, ou rien en attente. La raison « approuvés avant la connexion de vos réseaux » (test client Croissance) n'est dite que si
    // c'est vrai : une décision (contenus.decide_le) antérieure à la première connexion d'un réseau de l'offre (comptes_connectes.maj).
    const bloque = calendrierBloque(c, connectes, mr);
    const majCo = cpt.filter(x => x.etat === "connecte" && autorises.includes(x.reseau) && x.maj).map(x => Date.parse(x.maj)), connexion = majCo.length ? Math.min(...majCo) : NaN;
    const avantConnexion = prets.some(x => x.decide_le && Date.parse(x.decide_le) < connexion);
    const chapoCal = sansReseaux(c) ? t("cal.chapo.google") : bloque ? t("cal.chapo.bloque") : prets.length ? t(avantConnexion ? "cal.chapo.attente.connexion" : "cal.chapo.attente", { n: prets.length }) : t("cal.chapo.neutre");
    const titre = cal.mode === "mois" ? `${cap(MOIS[ref.getMonth()])} ${ref.getFullYear()}` : t("cal.semaine.du", { d: date(lundi) });
    vue.innerHTML = `${pauseBandeau(c)}${retourAuto("#/accueil", "cal.retour")}${entete(t("groupe.calendrier"), t("cal.titre"), chapoCal)}
      ${bloque}
      <div class="rangee">
        <section class="carte large"><div class="cal-tete"><div class="cal-nav"><button type="button" class="bouton second petit cal-fleche" data-n="-1" aria-label="${t("cal.precedent")}">‹</button><h2>${titre}</h2><button type="button" class="bouton second petit cal-fleche" data-n="1" aria-label="${t("cal.suivant")}">›</button></div>
          <div class="actions serre cal-modes"><button type="button" class="bouton second petit" data-m="semaine" aria-pressed="${cal.mode === "semaine"}">${t("cal.semaine")}</button><button type="button" class="bouton second petit" data-m="mois" aria-pressed="${cal.mode === "mois"}">${t("cal.mois")}</button></div></div>${grille}</section>
        <section class="carte etroite"><h2 id="cal-programmer-titre">${t("cal.programmer.titre")}</h2>${prets.length ? `<form id="f">
          <div class="f"><label for="contenu">${t("cal.contenu")}</label><select id="contenu" required>${choixFait ? "" : `<option value="" selected disabled>${t("cal.contenu.choisir")}</option>`}${prets.map(x => `<option value="${e(x.id)}"${x.id === voulu || prets.length === 1 ? " selected" : ""}>${libContenu(x)}${t("deux.points")}${e(cut(x.legende || "", 70))}</option>`).join("")}</select></div>
          <div class="champs deux"><div class="f"><label for="jour">${t("cal.date")}</label><input id="jour" type="date" value="${jourDefaut}" required></div><div class="f"><label for="heure">${t("cal.heure")}</label><input id="heure" type="time" value="${heureDefaut}" required></div></div>
          ${proposes.length === 1 ? `<div class="f" data-dest-unique><p class="fort">${t(proposes[0] === "google" ? "cal.sur.google" : "cal.sur.reseau", { r: RES[proposes[0]] })}${connectes.includes(proposes[0]) ? "" : nonConnecte(proposes[0])}</p><input type="hidden" name="res" value="${proposes[0]}" data-unique>
          <p class="aide">${t("cal.plafond.aide")}</p></div>`
          : `<fieldset><legend>${t("cal.choisir.ou")}</legend>${proposes.map(r => `<label class="option" data-res-lib="${r}"><input type="checkbox" name="res" value="${r}"${connectes.includes(r) ? "" : " disabled"}><span>${RES[r]}${connectes.includes(r) ? "" : nonConnecte(r)}</span></label>`).join("")}
          <p class="aide">${t("cal.plafond.aide")}</p></fieldset>`}
          <div class="confirmer-refus" id="f-alerte" data-zone-alerte hidden role="alert"><p class="fort" data-alerte-texte></p><div class="actions"><button type="button" class="bouton" data-a="programmer-conseil"></button><button type="button" class="bouton second" data-a="programmer-force">${t("cal.programmer.quand.meme")}</button></div></div>
          <div class="encart" id="cal-moment" hidden><p class="texte2" data-moment-texte></p><div class="actions"><button type="button" class="bouton second petit" id="cal-moment-prendre"></button></div></div>
          <button class="bouton" type="submit" id="cal-programmer">${t("cal.programmer")}</button><p class="msg" id="msg" role="status"></p></form>` : `<p class="texte2">${t(sansReseaux(c) ? "cal.aucun.pret.google" : bloque ? "cal.aucun.pret.bloque" : "cal.aucun.pret")}</p><p class="msg" id="msg" role="status"></p>`}</section>
      </div>
      <section class="carte" id="cal-vos"><div class="carte-tete"><h2>${t("cal.vos")}</h2>${(n_ => n_ ? `<span class="note" id="cal-vos-n">${t("cal.vos.a.venir", { n: n_ })}</span>` : "")(l.filter(x => x.statut === "programme" && Date.parse(x.prevu_le) >= Date.now()).length)}</div>
        ${aProgrammerCal.length ? `<div class="actions" id="cal-tout-zone"><button type="button" class="bouton second" id="cal-programmer-tout">${t("cal.programmer.tout", { n: aProgrammerCal.length })}</button></div>` : ""}${l.length ? `<ul class="liste programmations">${l.map((x, i) => `<li class="avec-vignette${x.statut === "programme" && horsOffreDe(x, autorises) ? " hors-offre" : ""}" data-id="${e(x.id)}">${vignette(vign[i])}<div class="prog">
        <p><span class="fort">${dateHeure(x.prevu_le)}</span>${mentionMois(x) ? `<span class="note" data-mention-mois>${mentionMois(x)}</span>` : ""} · ${destTexte(x, autorises)} · <span class="etat${x.statut === "programme" ? " actif" : ""}">${ST_PUB[x.statut] || e(x.statut)}</span></p>
        <p class="note"${lc()}>${e(cut(x.contenu?.legende || "", 90))}</p>${x.erreur ? `<p class="note">${e(ph(x.erreur))}</p>` : ""}
        ${x.statut === "programme" && horsOffreDe(x, autorises) ? `<div class="actions serre">${versGoogle(x) ? `<button type="button" class="bouton second petit" data-a="vers-google">${t("cal.vers.google")}</button>` : ""}<button type="button" class="lien" data-a="annuler">${t("cal.annuler")}</button></div>
          <div class="confirmer-refus" data-zone-annuler hidden><p class="fort">${t("cal.annuler.question", { quand: I.dateHeureDans(x.prevu_le) })}</p><div class="actions"><button type="button" class="bouton" data-a="annuler-ok">${t("cal.annuler.oui")}</button><button type="button" class="bouton second" data-a="annuler-garder">${t("cal.annuler.garder")}</button></div></div>`
        : x.statut === "programme" ? `<div class="actions serre"><input type="date" data-nj value="${jourLocal(x.prevu_le)}" aria-label="${t("cal.nouvelle.date")}"><input type="time" data-nh value="${heureLocale(x.prevu_le)}" aria-label="${t("cal.nouvelle.heure")}"><button type="button" class="bouton second petit" data-a="deplacer" aria-disabled="true" aria-describedby="rien-${e(x.id)}">${t("cal.deplacer")}</button><span class="note" id="rien-${e(x.id)}" data-rien hidden>${t("cal.rien.a.changer")}</span><button type="button" class="lien" data-a="annuler">${t("cal.annuler")}</button></div>
          <div class="confirmer-refus" data-zone-alerte hidden role="alert"><p class="fort" data-alerte-texte></p><div class="actions"><button type="button" class="bouton" data-a="deplacer-conseil"></button><button type="button" class="bouton second" data-a="deplacer-force">${t("cal.quand.meme")}</button></div></div>
          <div class="confirmer-refus" data-zone-annuler hidden><p class="fort">${t("cal.annuler.question", { quand: I.dateHeureDans(x.prevu_le) })}</p><div class="actions"><button type="button" class="bouton" data-a="annuler-ok">${t("cal.annuler.oui")}</button><button type="button" class="bouton second" data-a="annuler-garder">${t("cal.annuler.garder")}</button></div></div>` : ""}</div></li>`).join("")}</ul>` : `<p class="texte2">${t("cal.aucune")}</p>`}</section>`;
    // « Annulé » replié (01/11/2026, tour 7 Premium) : les programmations annulées sous « Annulées, N », fermé par défaut.
    // À venir d'abord, passé replié (01/11/2026, tour 8) : les programmations à venir restent en tête, de la plus proche à la plus lointaine ; les
    // passées (publiées, en échec, envoyées, ou programmées dont l'heure est passée) vont sous « Passées, N (P publiées) », fermé par défaut, de la
    // plus récente à la plus ancienne ; puis les annulées.
    const ulP = vue.querySelector("#cal-vos ul.programmations"), ann = l.filter(x => x.statut === "annule");
    const passees = l.filter(x => x.statut !== "annule" && !(x.statut === "programme" && Date.parse(x.prevu_le) >= Date.now())).sort((a, b) => Date.parse(b.prevu_le) - Date.parse(a.prevu_le));
    const replie = (id, cls, titre, liste_) => { const d_ = document.createElement("details"); d_.className = "repliable " + cls; d_.id = id;
      d_.innerHTML = `<summary>${titre}</summary><ul class="liste programmations"></ul>`;
      liste_.forEach(x => { const li = ulP.querySelector(`li[data-id="${CSS.escape(x.id)}"]`); if (li) d_.querySelector("ul").appendChild(li); }); return d_; };
    if (ulP && (passees.length || ann.length)) {
      const blocs = [passees.length ? replie("cal-passees", "cal-passees", t("cal.passees", { n: passees.length, p: passees.filter(x => x.statut === "publie").length }), passees) : null,
        ann.length ? replie("cal-annulees", "cal-annulees", t("cal.annulees", { n: ann.length }), ann) : null].filter(Boolean);
      ulP.after(...blocs);
      if (!ulP.children.length) ulP.replaceWith(Object.assign(document.createElement("p"), { className: "texte2", id: "cal-rien-a-venir", textContent: t("cal.rien.a.venir") }));
    }
    // Une publication désignée (grille, « Programmer tout ») qui est dans une partie repliée : la partie s'ouvre d'abord.
    const ouvrirPour = li => { const d_ = li && li.closest("details"); if (d_) d_.open = true; };
    // « Programmer tout » (01/11/2026, tour 7 Premium) : comme l'accueil, étalé sur le mois (rang et nombre : jour_lot / jourLot).
    if ($("cal-programmer-tout")) $("cal-programmer-tout").onclick = async () => { const b_ = $("cal-programmer-tout"); b_.disabled = true; const faits = []; let er0 = null;
      for (const [x, lot] of lotProgrammer(aProgrammerCal)) { try { faits.push((await programmerAutoQuand(x.id, lot)).quand); } catch (er) { er0 = er0 || er; } }
      faits.sort(); await calendrier(); majCompteurs();
      toast(faits.length ? t("cal.programmes.etales", { n: faits.length, d1: I.dateHeureDans(faits[0]), d2: I.dateHeureDans(faits[faits.length - 1]) }) + (er0 ? " " + ph(er0.message) : "") : ph(er0 ? er0.message : "")); };
    vue.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { cal.mode = b.dataset.m; calendrier(); });
    vue.querySelectorAll("[data-saut]").forEach(b => b.onclick = () => { const li = vue.querySelector(`.programmations li[data-id="${CSS.escape(b.dataset.saut)}"]`); if (!li) return;
      ouvrirPour(li); li.setAttribute("tabindex", "-1"); li.scrollIntoView({ block: "center" }); li.focus({ preventScroll: true }); });
    if (pv) requestAnimationFrame(() => { const li = vue.querySelector(`.programmations li[data-id="${CSS.escape(pv.id)}"]`); if (!li) return; ouvrirPour(li); li.setAttribute("tabindex", "-1"); li.classList.add("designee"); li.scrollIntoView({ block: "center" }); li.focus({ preventScroll: true }); });
    // Grille du mois (tour 9, 01/11/2026) : « 11 h 30 » quand l'heure tient dans sa pastille ; sinon toute la grille passe à « 11 h » (un point hors
    // français) : sous 360 px toujours, et sur les téléphones où « 11 h 30 » dépasserait. L'heure complète reste dans le nom du bouton et dans la liste.
    // Tour 10 (v36) : de 360 px et plus, l'heure reste entière ; si « 18 h 30 » ne tient pas sur une ligne, la pastille passe sur deux lignes
    // (« 18 h » puis « 30 ») au lieu de devenir « 18 h ». Sous 360 px seulement, « 18 h » (feuille de style), l'heure complète restant dans le nom du bouton.
    const ajusterGrille = g_ => { if (!g_ || !g_.isConnected) return; g_.classList.remove("deux", "court");
      if ([...g_.querySelectorAll("[data-cell]")].some(x => x.scrollWidth > x.clientWidth + 0.5)) g_.classList.add("deux"); };
    const grilleM = vue.querySelector(".cal");
    if (grilleM) { ajusterGrille(grilleM); if (!cal.ecouteGrille) { cal.ecouteGrille = true; addEventListener("resize", () => ajusterGrille(document.querySelector("#vue .cal"))); } }
    vue.querySelectorAll("[data-n]").forEach(b => b.onclick = () => { const n = +b.dataset.n, d = new Date(cal.ref); if (cal.mode === "mois") { d.setDate(1); d.setMonth(d.getMonth() + n); } else d.setDate(d.getDate() + 7 * n); cal.ref = d; calendrier(); });
    const majDestinations = () => { const x = prets.find(y => y.id === ($("contenu") || {}).value); if (!x) return; const ok = M.reseauxDuContenu(x, autorises);
      vue.querySelectorAll("[data-res-lib]").forEach(lb => { const i = lb.querySelector("input"), dedans = ok.includes(lb.dataset.resLib); lb.hidden = !dedans; if (!dedans) i.checked = false; });
      // Les réseaux où ce contenu part réellement (connectés et compatibles avec son format) sont cochés d'office.
      vue.querySelectorAll("[data-res-lib]:not([hidden]) input:not(:disabled)").forEach(i => { i.checked = true; }); };
    if ($("contenu")) { $("contenu").onchange = majDestinations; majDestinations(); }
    if ($("f")) {
      // Une seule destination possible (Essentiel : la fiche Google) : pas de case à cocher, la phrase « Sur votre fiche Google » (audit du 31/10/2026).
      const choisis = () => [...document.querySelectorAll("input[name=res]:checked, input[name=res][data-unique]")].map(x => x.value);
      const envoyer = async q => { const res = choisis(), x = prets.find(y => y.id === $("contenu").value);
        try { await D.programmer({ contenu_id: $("contenu").value, reseaux: res, prevu_le: q }); history.replaceState(null, "", "#/calendrier"); paramRoute = ""; hashPrecedent = "#/calendrier"; await calendrier();
          toast(x && titreContenu(x) ? t("cal.programme.nomme", { type: typeCourt(x), titre: titreContenu(x), quand: I.dateHeureDans(q) }) : t("cal.programme.le", { quand: I.dateHeureDans(q) })); majCompteurs(); } catch (er) { msg(ph(er.message)); } };
      // Mêmes alertes que « Déplacer » avant d'enregistrer (fermé, férié, heure inhabituelle, créneau déjà pris).
      $("f").onsubmit = ev => { ev.preventDefault(); const nj = $("jour").value, nh = $("heure").value; if (!nj || !nh) return;
        if (!$("contenu").value) { msg(t("cal.contenu.choisir.dabord")); $("contenu").focus(); return; }
        if (!choisis().length) { msg(ph("Choisissez où publier.")); return; }
        // Alerte ouverte (31/10/2026, test client Premium, tour 5) : « Programmer » masqué, un seul bouton vert (« Prendre le créneau conseillé »).
        const a = alertesCreneau(c, nj, nh, occupes, prets.find(y => y.id === $("contenu").value)); if (a.motifs.length) { montrerAlerte($("f-alerte"), a, "programmer"); $("cal-programmer").hidden = true; return; }
        envoyer(new Date(nj + "T" + nh).toISOString()); };
      $("f-alerte").onclick = ev => { const b = ev.target.closest("[data-a]"); if (!b) return;
        envoyer(b.dataset.a === "programmer-conseil" ? b.dataset.q : new Date($("jour").value + "T" + $("heure").value).toISOString()); };
      ["jour", "heure", "contenu"].forEach(k => $(k).addEventListener("change", () => { $("f-alerte").hidden = true; $("cal-programmer").hidden = false; }));
      // Moment du texte (31/10/2026, test client Premium, tour 5) : une légende qui parle du déjeuner programmée après 15 h, ou du soir avant 17 h,
      // reçoit une suggestion douce (non bloquante) avec le créneau du métier qui convient. Rien n'empêche de programmer à l'heure choisie.
      const momentTexte = () => { const x = prets.find(y => y.id === $("contenu").value), nh = $("heure").value, nj = $("jour").value, z = $("cal-moment");
        // Mêmes mots que la programmation automatique (momentLegende de donnees.js, moment_legende de schema.sql).
        const mo = x ? M.momentLegende(M.texteDuContenu(x)) : null, midi = mo === "midi", soir = mo === "soir";
        const h = +String(nh).slice(0, 2), heures = M.CRENEAUX[c.metier] || M.CRENEAUX.autre;
        const cas = midi && !soir && h >= 15 ? ["midi", heures.find(k => +k.slice(0, 2) < 15)] : soir && !midi && nh && h < 17 ? ["soir", heures.find(k => +k.slice(0, 2) >= 17)] : null;
        // Jour fermé ou férié : pas de 2e alerte ; celle du créneau conseillé (au moment de programmer) dit les deux et propose un créneau qui convient.
        if (!cas || !cas[1] || !nj || jourBloque(c, nj) || !$("f-alerte").hidden) { z.hidden = true; return; }
        const hh = heure(new Date(nj + "T" + cas[1]).toISOString());
        z.querySelector("[data-moment-texte]").textContent = t("cal.moment." + cas[0], { h: hh }); $("cal-moment-prendre").textContent = t("cal.moment.prendre", { h: hh });
        $("cal-moment-prendre").onclick = () => { $("heure").value = cas[1]; $("heure").dispatchEvent(new Event("change")); }; z.hidden = false; };
      ["jour", "heure", "contenu"].forEach(k => $(k).addEventListener("change", momentTexte));
      // Jour fermé ou férié (01/11/2026, tour 7 Croissance) : l'alerte vient dès que la date change, sans attendre « Programmer » (sans voler le focus).
      const alerteJour = () => { const nj = $("jour").value, nh = $("heure").value, x = prets.find(y => y.id === $("contenu").value); if (!nj || !jourBloque(c, nj)) return;
        const a = alertesCreneau(c, nj, nh || "12:00", occupes, x); if (!a.motifs.length) return; montrerAlerte($("f-alerte"), a, "programmer", false); $("cal-programmer").hidden = true; };
      $("jour").addEventListener("change", alerteJour);
      // Jour vide touché (01/11/2026, tour 7 Croissance) : le premier contenu prêt est présélectionné s'il n'y en a pas, et le focus va sur la liste
      // des contenus (sur iOS, le focus du champ date rouvrait la roue).
      vue.querySelectorAll("[data-jour]").forEach(b => b.onclick = () => { const j = $("jour"), sc = $("contenu"); if (!j) return;
        if (sc && !sc.value && prets[0]) { sc.value = prets[0].id; sc.dispatchEvent(new Event("change")); }
        j.value = b.dataset.jour; j.dispatchEvent(new Event("change"));
        const h = $("cal-programmer-titre"); if (h) h.scrollIntoView({ block: "start" }); if (sc) sc.focus({ preventScroll: true }); }); $("heure").addEventListener("input", momentTexte); momentTexte();
      // Arrivée depuis « Choisir moi-même » : le titre « Programmer à la main » en haut de l'écran (block « start »), pas le milieu du formulaire.
      if (voulu) requestAnimationFrame(() => $("cal-programmer-titre").scrollIntoView({ block: "start" }));
    }
    // Déplacer (31/10/2026, test client Premium) : inactif tant que la date ou l'heure n'a pas changé ; « Rien à changer » le dit à côté.
    vue.querySelectorAll("li[data-id]").forEach(li => { const nj = li.querySelector("[data-nj]"), nh = li.querySelector("[data-nh]"), b = li.querySelector("[data-a=deplacer]"), z = li.querySelector("[data-rien]");
      if (!nj || !nh || !b) return; const j0 = nj.value, h0 = nh.value;
      // « Rien à changer » (31/10/2026, test client Croissance, tour 5) : masqué par défaut, montré seulement après un appui sur « Déplacer » inactif.
      const maj = () => { const pareil = nj.value === j0 && nh.value === h0; b.setAttribute("aria-disabled", String(pareil || !nj.value || !nh.value)); if (!pareil) z.hidden = true; };
      nj.addEventListener("input", maj); nh.addEventListener("input", maj); nj.addEventListener("change", maj); nh.addEventListener("change", maj); });
    vue.querySelectorAll("li[data-id]").forEach(li => li.addEventListener("click", async ev => {
      const b = ev.target.closest("[data-a]"); if (!b) return;
      if (b.dataset.a === "deplacer" && b.getAttribute("aria-disabled") === "true") { const z = li.querySelector("[data-rien]"); if (z) z.hidden = false; return; }
      // Annuler (31/10/2026) : confirmation explicite ; déplacer et annuler ont chacun leur message.
      const z = li.querySelector("[data-zone-annuler]"), boutons = li.querySelector(".actions.serre");
      if (b.dataset.a === "annuler") { z.hidden = false; boutons.hidden = true; z.querySelector("[data-a=annuler-garder]").focus({ preventScroll: true }); return; }
      if (b.dataset.a === "annuler-garder") { z.hidden = true; boutons.hidden = false; li.querySelector("[data-a=annuler]").focus({ preventScroll: true }); return; }
      // Déplacer (31/10/2026) : jour de fermeture (horaires), jour férié ou heure hors 7 h-23 h : on le dit avant d'enregistrer, avec le créneau conseillé.
      if (b.dataset.a === "vers-google") { try { await D.publierSurGoogle(li.dataset.id); await calendrier(); toast(t("cal.vers.google.fait")); majCompteurs(); } catch (er) { msg(ph(er.message)); toast(ph(er.message)); } return; }
      const za = li.querySelector("[data-zone-alerte]"), nj = (li.querySelector("[data-nj]") || {}).value, nh = (li.querySelector("[data-nh]") || {}).value;
      if (b.dataset.a === "deplacer" && nj === jourLocal(l.find(x => x.id === li.dataset.id).prevu_le) && nh === heureLocale(l.find(x => x.id === li.dataset.id).prevu_le)) { toast(t("cal.rien.a.changer")); return; }
      if (b.dataset.a === "deplacer" && nj && nh) {
        // 31/10/2026 (test client Croissance) : le férié est nommé (« Toussaint ») ; une autre publication à moins d'une heure : « créneau déjà pris » ;
        // le créneau conseillé part du jour demandé (pas d'aujourd'hui).
        const a = alertesCreneau(c, nj, nh, occupes.filter(x => x.id !== li.dataset.id), (l.find(x => x.id === li.dataset.id) || {}).contenu);
        if (a.motifs.length) { montrerAlerte(za, a, "deplacer"); return; }
      }
      try { let m;
        if (b.dataset.a === "annuler-ok") { await D.annuler(li.dataset.id); m = t("cal.annulee"); }
        else { const q = b.dataset.a === "deplacer-conseil" ? b.dataset.q : new Date(nj + "T" + nh).toISOString(); await D.deplacer(li.dataset.id, q); m = t("cal.deplacee", { quand: I.dateHeureDans(q) }); }
        await calendrier(); toast(m); majCompteurs(); } catch (er) { msg(ph(er.message)); toast(ph(er.message)); }
    }));
  }

  // ---------------- Autorisation photos (décision de PJ du 22/10/2026, CGV article 11) : case au premier écran (démarrage, et accueil tant qu'elle
  // n'est pas cochée), état dans l'écran Photos. Fonction autoriser_photos (schema.sql) ; le retrait se fait par email (noté par l'équipe).
  // Essentiel (26/10/2026) : la case ne porte que sur les photos publiées par le commerce sur sa fiche Google (« aut.case.google »).
  const carteAutorisation = c => autorisationAJour(c) ? "" : `<section class="carte autorisation-photos" id="autorisation-photos" aria-labelledby="aut-titre">
      <h2 id="aut-titre">${t("aut.titre")}</h2><p class="texte2">${t("aut.chapo")}</p>
      <form id="aut-f" novalidate><label class="option consentement"><input id="aut-case" type="checkbox"><span>${t(sansReseaux(c) ? "aut.case.google" : "aut.case", { comptes: I.liste(ORDRE_RES.filter(x => x !== "google" && window.RENOM_RESEAUX_AUTORISES(c).includes(x)).map(x => RES[x])) })}</span></label>
      <div class="actions"><button type="submit" class="bouton second" id="aut-ok">${t("aut.enregistrer")}</button></div><p class="msg" id="aut-msg" role="status"></p></form></section>`;
  function brancherAutorisation(apres) {
    const f = $("aut-f"); if (!f) return;
    f.onsubmit = async ev => { ev.preventDefault();
      if (!$("aut-case").checked) { $("aut-msg").textContent = t("aut.cocher"); $("aut-case").focus(); return; }
      try { await D.autoriserPhotos(); await apres(); const m = $("msg-aut") || $("msg"); if (m) m.textContent = t("aut.merci"); } catch (er) { $("aut-msg").textContent = ph(er.message); } };
  }

  // ---------------- Avis
  // Libellé de la réponse : « Réponse publiée… » seulement quand elle l'est réellement. Mode de secours des avis (20/10/2026) : une réponse prête,
  // publiée à la main par l'équipe tant que l'API de Google n'est pas ouverte, reste « en cours de publication » ; une fois collée sur la fiche,
  // elle est « publiée » (jamais « publiée automatiquement » : elle ne l'a pas été). Même promesse qu'avant pour le commerçant.
  const etiquetteReponse = x => x.statut === "a_publier_main" ? "avis.rep.encours" : x.escalade_le ? "avis.rep.renomia"
    : x.statut === "publie" && x.publie_par === "equipe" && x.decision === "publication_automatique" ? "avis.rep.publiee"
    : x.decision === "publication_automatique" ? "avis.rep.auto" : "avis.rep.validee";
  // Avis sensible (décision de PJ du 22/10/2026) : notre équipe s'en charge, le commerçant est prévenu et n'a rien à faire. En attente : texte de
  // l'offre (Premium : l'équipe répond ; sinon la réponse lui est envoyée par email pour accord) ; réponse proposée (propose_le) : la date de l'email ;
  // réponse publiée : « Notre équipe s'en est chargée. »
  // 31/10/2026 (décision) : l'équipe propose la réponse, le commerçant la relit ici et peut donner sa version ; sans action, publiée à l'échéance des 24 h.
  const texteSensible = (x, c) => x.statut === "publie" ? t("avis.sensible.fait") : x.statut !== "humain" ? ""
    : equipeRepond(c) ? (x.propose_le && String(x.reponse_proposee || "").trim() ? "" : t("avis.sensible.attente.equipe"))
    : x.propose_le && !equipeRepond(c) ? (merSql(c) ? "" : t("avis.sensible.propose", { d: date(x.propose_le) })) : t(equipeRepond(c) ? "avis.sensible.texte.equipe" : merSql(c) ? "avis.sensible.texte.espace" : "avis.sensible.texte");
  // Essentiel, bloc SQL appliqué (27/10/2026, constat 14) : la réponse proposée par l'équipe, « J'approuve cette réponse » et « Je veux en parler ».
  const decisionSensible = (x, c) => !(merSql(c) && !equipeRepond(c) && x.sensible && x.statut === "humain" && x.propose_le && String(x.reponse_proposee || "").trim()) ? ""
    : `<div class="sensible-reponse" data-sensible-zone><p class="fort">${t("avis.sensible.proposee", { d: date(x.propose_le) })}</p><p class="reponse"${lc()}>${e(x.reponse_proposee)}</p>
      ${accordDonne(x) ? `<p class="note" data-sensible-etat="approuve">${t("avis.sensible.approuvee", { d: date(x.decision_client_le) })}</p>`
      : x.decision_client === "en_parler" && x.decision_client_le >= x.propose_le ? `<p class="note" data-sensible-etat="en_parler">${t("avis.sensible.en.parler.fait", { d: date(x.decision_client_le) })}</p>`
      : `<div class="actions"><button type="button" class="bouton" data-sensible="approuve">${t("avis.sensible.approuver")}</button><button type="button" class="bouton second" data-sensible="en_parler">${t("avis.sensible.en.parler")}</button></div>
        <p class="note">${t("avis.sensible.regle")}</p>`}</div>`;
  // Offres où l'équipe répond : « Réponse proposée par l'équipe », l'heure de publication prévue, et le champ « Votre version » (donner_version_avis).
  const ECHEANCE_AVIS_H = 24;
  // Version envoyée (règle du 01/11/2026, tour 6 Croissance) : l'échéance des 24 h est suspendue ; plus de « Publication prévue… », mais
  // « Nous reprenons la réponse avec votre version : vous la relisez ici avant publication. » (la console : « Version reçue, à reprendre »).
  // Échéance passée (01/11/2026, tour 6 Essentiel) : une heure précise au lieu de « Nous la publions sur votre fiche » : l'heure pleine qui suit
  // dans au moins 30 minutes (« vers 15 h »).
  // « Attendez mon appel » (décision de PJ du 01/11/2026) : sous une réponse proposée pas encore publiée, le commerçant retient la publication
  // (D.retenirReponseAvis, fonction retenir_reponse_avis) ; ensuite « Nous ne publions rien avant de vous avoir appelé(e). » et son contact.
  const proposee = x => !!x.propose_le && !!String(x.reponse_proposee || "").trim();
  // Numéro et jour du rappel (01/11/2026, tour 6 Premium ; comme la demande TikTok) : l'appui ouvre un petit formulaire, numéro prérempli (WhatsApp,
  // sinon contact du commerce, au format du pays) et jour (aujourd'hui, ou demain ; après 17 h, demain seulement), appel entre 9 h et 18 h.
  // Ensuite : « Nous vous appelons au +32 …, demain entre 9 h et 18 h. » (retenue_telephone, retenue_jour), et « Modifier ».
  let retenueOuverte = null;
  // Heure de Paris (tour 10 : lue par formatToParts) : désormais dans M.joursRappelA (partiesParis), qui décale les jours proposés à 17 h (tour 11).
  const quandRappel = j => !j ? "" : j === jourParis(Date.now()) ? t("avis.rappel.auj") : j === jourParis(Date.now() + 864e5) ? t("avis.rappel.demain") : t("avis.rappel.le", { d: date(j + "T12:00:00") });
  // Numéro préenregistré (01/11/2026, tour 7 Premium) : ATTENTION, un numéro dont l'indicatif ne correspond pas au pays du commerce (+33 pour un
  // commerce belge, +32 pour un français) est signalé ici (console) et dans le champ (aide « vérifiez ce numéro ») ; il reste proposé, un
  // commerçant peut avoir un mobile d'un autre pays. Démonstration d'un commerce belge sans numéro belge : numéro de démonstration au format belge.
  const DEMO_TEL_BE = "+3225123456";
  const paysNumero = n => /^\+32/.test(n || "") ? "BE" : /^\+33/.test(n || "") ? "FR" : null;
  const numeroHorsPays = (n, c) => !!n && !!paysNumero(n) && paysNumero(n) !== M.paysDe((c || {}).pays);
  const telRetenue = c => { const n = (c && (c.whatsapp_numero || (window.RENOM_WHATSAPP.numero(c.contact, c.pays) ? window.RENOM_WHATSAPP.numero(c.contact, c.pays) : ""))) || "";
    if (D.mode === "demo" && M.paysDe((c || {}).pays) === "BE" && paysNumero(n) !== "BE") return DEMO_TEL_BE;
    if (numeroHorsPays(n, c)) console.warn("RENOM : numéro préenregistré au format d'un autre pays que celui du commerce", n, (c || {}).pays);
    return n; };
  // Jours proposés (01/11/2026, tour 7 Croissance) : jamais « Aujourd'hui » un dimanche ni un jour férié du pays ; alors le jour ouvré suivant, nommé
  // (« Lundi 2 novembre »), puis le suivant. Mêmes jours que retenir_reponse_avis (jour_ouvre, bloc « Plat et prix au dépôt de la photo »).
  const libJourRappel = (j, auj) => j === auj ? t("avis.rappel.auj.cap") : j === jourParis(Date.parse(auj + "T12:00:00Z") + 864e5) ? t("avis.rappel.demain.cap") : cap(I.jourEtDate(new Date(j + "T12:00:00")));
  // Tour 11 (v37) : toujours DEUX jours ouvrés (ni samedi, ni dimanche, ni férié du pays), à partir de demain à 17 h et après (M.joursRappelA, même
  // règle que jours_rappel() en base) ; avant, un seul jour était proposé après 17 h. Même bloc pour l'avis, TikTok et la montée d'offre (radiosJours).
  const radiosJours = (nom, jr, auj) => `<label class="option"><input type="radio" name="${nom}" value="aujourdhui" checked data-jour-rappel="${jr.aujourdhui}"><span>${libJourRappel(jr.aujourdhui, auj)}</span></label>
        <label class="option"><input type="radio" name="${nom}" value="demain" data-jour-rappel="${jr.demain}"><span>${libJourRappel(jr.demain, auj)}</span></label>`;
  const formRetenue = (x, c) => { const auj = jourParis(Date.now()), jr = M.joursRappelA(Date.now(), c && c.pays), tel = x.retenue_telephone || telRetenue(c);
    return `<form class="pile serre encart" data-retenir-f="${e(x.id)}" novalidate><p class="fort">${t("avis.rappel.titre")}</p>
      <div class="f"><label for="ret-tel-${e(x.id)}">${t("avis.rappel.tel")}</label><input id="ret-tel-${e(x.id)}" type="tel" inputmode="tel" autocomplete="tel" maxlength="24" value="${e(tel ? window.RENOM_WHATSAPP.lisible(tel) : "")}" placeholder="${e(exNum(c))}" aria-describedby="ret-aide-${e(x.id)}" data-ret-tel><p class="aide" id="ret-aide-${e(x.id)}">${t("rappel.aide", numParams(c))}${numeroHorsPays(tel, c) ? " " + t("rappel.hors.pays") : ""}</p></div>
      <fieldset><legend>${t("avis.rappel.quand")}</legend>
        ${radiosJours("ret-jour-" + e(x.id), jr, auj)}</fieldset>
      <fieldset><legend>${t("avis.rappel.heure")}</legend>
        <label class="option"><input type="radio" name="ret-plage-${e(x.id)}" value=""${x.retenue_creneau === "15-17" ? "" : " checked"}><span>${t("avis.rappel.plage.journee")}</span></label>
        <label class="option"><input type="radio" name="ret-plage-${e(x.id)}" value="_15_17"${x.retenue_creneau === "15-17" ? " checked" : ""}><span>${t(c && c.metier === "restaurant" ? "avis.rappel.plage.service" : "avis.rappel.plage.1517")}</span></label>
        <p class="aide">${t("avis.rappel.rien")}</p></fieldset>
      <div class="actions"><button type="submit" class="bouton">${t("avis.rappel.confirmer")}</button><button type="button" class="lien" data-retenir-annuler>${t("annuler")}</button></div>
      <p class="msg" data-ret-msg role="status"></p></form>`; };
  const blocRetenue = (x, contact, c) => !D.retenirReponseAvis ? "" : retenueOuverte === x.id ? formRetenue(x, c) : x.retenue_le
    ? `<div class="encart" data-retenue><p class="fort">${t("avis.retenue.fait")}</p>${x.retenue_telephone ? `<p class="texte2" data-retenue-quand>${t(x.retenue_creneau === "15-17" ? "avis.rappel.prevu.1517" : "avis.rappel.prevu", { tel: `<span class="casse" translate="no">${e(window.RENOM_WHATSAPP.lisible(x.retenue_telephone))}</span>`, quand: quandRappel(x.retenue_jour) })}</p>
        <p><button type="button" class="lien" data-retenir="${e(x.id)}">${t("avis.rappel.modifier")}</button></p>` : ""}${ligneContact(contact, "contact-retenue-" + x.id)}</div>`
    : proposee(x) ? `<div class="pile serre"><div class="actions"><button type="button" class="bouton second" data-retenir="${e(x.id)}" aria-describedby="retenir-aide-${e(x.id)}">${t("avis.retenir")}</button></div><p class="aide" id="retenir-aide-${e(x.id)}">${t("avis.retenir.aide")}</p></div>` : "";
  const relectureSensible = (x, c, contact) => !(equipeRepond(c) && x.sensible && x.statut === "humain") ? "" : `<div class="sensible-reponse" data-relecture>
      ${x.propose_le && String(x.reponse_proposee || "").trim() ? `<p class="fort">${t("avis.sensible.proposee.equipe")}</p><p class="reponse"${lc()}>${e(x.reponse_proposee)}</p>
        ${x.retenue_le && D.retenirReponseAvis ? "" : x.version_client ? `<p class="note" id="publication-suspendue-${e(x.id)}">${t("avis.version.reprise")}</p>` : `<p class="note" id="publication-prevue-${e(x.id)}">${Date.parse(x.cree_le) + ECHEANCE_AVIS_H * 36e5 > Date.now() ? t("avis.sensible.publication", { d: dateHeure(new Date(Date.parse(x.cree_le) + ECHEANCE_AVIS_H * 36e5).toISOString()), retenir: !!D.retenirReponseAvis }) : t("avis.sensible.publication.passee", { retenir: !!D.retenirReponseAvis })}</p>`}` : ""}
      ${blocRetenue(x, contact, c)}
      ${champVersion(x)}
      ${x.retenue_le && D.retenirReponseAvis ? "" : ligneContact(contact, "contact-avis-" + x.id)}</div>`;
  // « Votre version » (donner_version_avis) : avis sensibles ci-dessus, et avis de 1 à 3 étoiles traités par l'équipe tant que la réponse n'est pas
  // publiée (31/10/2026 : la carte « Réglage » le promet, « donnez votre version sous l'avis »). Mêmes règles que la base.
  function champVersion(x) {
    return `${x.version_client ? `<p class="note" data-version-etat><span class="fort">${t("avis.version.envoyee", { d: date(x.version_client_le) })}</span> <span${lc()}>${e(x.version_client)}</span></p>` : ""}
      ${D.donnerVersionAvis ? `<form class="pile serre" data-version="${e(x.id)}" novalidate><div class="f"><label for="version-${e(x.id)}">${t(x.version_client ? "avis.version.lib.autre" : "avis.version.lib")}</label>
        <textarea id="version-${e(x.id)}" maxlength="2000" rows="3" aria-describedby="version-aide-${e(x.id)}"></textarea><p class="aide" id="version-aide-${e(x.id)}">${t("avis.version.aide")}</p></div>
        <div class="actions"><button type="submit" class="bouton second">${t("avis.version.envoyer")}</button></div></form>` : ""}`;
  }
  // 1 à 3 étoiles (01/11/2026) : la réponse proposée par l'équipe, lisible ici comme pour un avis sensible, et « Attendez mon appel ».
  const versionEquipe = (x, c, contact) => !x.sensible && x.statut === "escalade" && x.note <= 3 && equipeRepond(c) ? `<div class="sensible-reponse" data-version-equipe>
      ${proposee(x) ? `<p class="fort">${t("avis.sensible.proposee.equipe")}</p><p class="reponse"${lc()}>${e(x.reponse_proposee)}</p>` : ""}${blocRetenue(x, contact, c)}${champVersion(x)}</div>` : "";
  // Avis vide : où en est l'accès à la fiche (constat 23). Sans accès : le lien vers l'étape ; fiche en création : ce qui se passe ; sinon : demander des avis.
  const avisVide = (c, mr) => { const g = ((mr && mr.points) || []).find(x => x.point === "google"), acces = !g || g.etat === "fait";
    if (ficheDemandee(c)) return `<section class="carte" id="avis-vide"><h2>${t("avis.vide.titre")}</h2><p class="texte2">${t("avis.vide.fiche.demandee")}</p></section>`;
    if (!acces) return `<section class="carte" id="avis-vide"><h2>${t("avis.vide.titre")}</h2><p class="texte2">${t("avis.vide.sans.acces")}</p><p class="pied"><a class="bouton" href="#/miseenroute" id="avis-vers-google">${t("avis.vide.donner.acces")}</a></p></section>`;
    return `<section class="carte" id="avis-vide"><h2>${t("avis.vide.titre")}</h2><p class="texte2">${t("avis.vide.texte.acces")}</p><p class="pied"><a class="bouton" href="#/collecte">${t("ecran.collecte")}</a></p></section>`; };
  async function avis() {
    const [c, l0, mr, contact] = await Promise.all([D.commerce(), D.avis(), D.miseEnRoute().catch(() => null), monContact()]);
    const rang = x => (x.statut === "a_valider" && !x.sensible) || sensibleADecider(x, c) ? 0 : x.sensible || x.statut === "humain" ? 1 : 2, l = l0.map((x, i) => [x, i]).sort((a, b) => rang(a[0]) - rang(b[0]) || a[1] - b[1]).map(x => x[0]);
    vue.innerHTML = `<div class="entete-accueil">${entete(t("groupe.avalider"), t("avis.titre"))}<a class="bouton second" id="demander-avis" href="#/collecte">${t("ecran.collecte")}</a></div>
      <div class="colonnes">
        <div class="pile">${l.length ? l.map(x => `<article class="carte avis${x.sensible ? " attention" : ""}" data-avis="${e(x.id)}">
          <div class="carte-tete"><p class="fort">${etoiles(x.note)}</p><p class="etat${x.statut === "a_valider" && !x.sensible ? " actif" : ""}">${ST_AVIS[x.statut] || e(x.statut)}</p></div>
          ${citation(x)}<p class="note">${x.auteur && !x.efface_le ? e(x.auteur) + " · " : ""}${t("recu.le", { d: date(x.cree_le) })}</p>
          ${x.sensible ? `<div class="encart" role="alert"><p class="fort">${t("avis.sensible", { r: e(raisonsTexte(x.raisons)) })}</p>${texteSensible(x, c) ? `<p>${texteSensible(x, c)}</p>` : ""}</div>${decisionSensible(x, c)}${relectureSensible(x, c, contact)}` : ""}
          ${x.statut === "a_valider" && !x.sensible ? reponseAValider(x) : ""}
          ${x.statut === "escalade" ? `${x.retenue_le && D.retenirReponseAvis ? "" : `<p class="note">${t(offreDe(c).delegation ? "avis.equipe.texte" : "avis.escalade.texte")}</p>`}${versionEquipe(x, c, contact)}` : ""}
          ${x.statut === "publie" || x.statut === "valide" || x.statut === "a_publier_main" ? `<p class="reponse"><span class="fort">${t(etiquetteReponse(x))}</span> <span${lc()}>${e(x.reponse || x.reponse_proposee || "")}</span></p>` : ""}</article>`).join("")
          : avisVide(c, mr)}
          <p class="msg" id="msg" role="status"></p></div>
        <section class="carte" id="avis-regle"><h2>${t("reglage")}</h2>${regleAvisBlocs(c)}
          <p class="pied"><a href="#/offre">${t("acc.voir.offre")}</a></p></section>
      </div>`;
    brancherAvis(vue, avis);
    // Lien d'une alerte (WhatsApp ou email, 02/11/2026) : #/avis?avis=<id> ouvre l'écran sur CET avis, une fois (le paramètre est ensuite retiré).
    const avisVoulu = decodeURIComponent((/(?:^|&)avis=([A-Za-z0-9_-]{1,64})(?:&|$)/.exec(paramRoute) || [])[1] || "");
    if (avisVoulu) { paramRoute = ""; history.replaceState(null, "", "#/avis"); hashPrecedent = "#/avis";
      const z = vue.querySelector(`[data-avis="${CSS.escape(avisVoulu)}"]`); if (z) z.scrollIntoView({ block: "center" }); }
    vue.querySelectorAll("form[data-version]").forEach(f => f.onsubmit = async ev => { ev.preventDefault(); const b = f.querySelector("button"), id = f.dataset.version; b.disabled = true;
      try { await D.donnerVersionAvis(id, f.querySelector("textarea").value); await avis(); toast(t("avis.version.merci")); }   // le toast seul (role=status) : plus de 2e phrase en clair sous la liste
      catch (er) { b.disabled = false; msg(ph(er.message)); } });
    vue.querySelectorAll("[data-retenir]").forEach(b => b.onclick = async () => { const id = b.dataset.retenir; retenueOuverte = id; fermerToast(); await avis();
      const f = vue.querySelector(`[data-retenir-f="${CSS.escape(id)}"]`); if (f) { f.scrollIntoView({ block: "center" }); const i = f.querySelector("[data-ret-tel]"); if (i) i.focus({ preventScroll: true }); } });
    vue.querySelectorAll("[data-retenir-annuler]").forEach(b => b.onclick = async () => { retenueOuverte = null; await avis(); });
    vue.querySelectorAll("form[data-retenir-f]").forEach(f => f.onsubmit = async ev => { ev.preventDefault(); const id = f.dataset.retenirF, b = f.querySelector("button[type=submit]"); b.disabled = true;
      const j = ((f.querySelector('input[name^="ret-jour-"]:checked') || {}).value || "demain") + ((f.querySelector('input[name^="ret-plage-"]:checked') || {}).value || "");
      // Tour 7 Essentiel (01/11/2026) : champ vide = bloqué ici (« Indiquez votre numéro »), jamais un repli sur le contact (texte libre) du commerce.
      const telSaisi = f.querySelector("[data-ret-tel]").value.trim();
      if (!telSaisi) { b.disabled = false; f.querySelector("[data-ret-msg]").textContent = t("avis.rappel.tel.vide"); f.querySelector("[data-ret-tel]").focus(); return; }
      try { await D.retenirReponseAvis(id, telSaisi, j); retenueOuverte = null; await avis(); toast(t("avis.retenue.toast"));
        const z = vue.querySelector(`[data-avis="${CSS.escape(id)}"] [data-retenue]`); if (z) z.scrollIntoView({ block: "center" }); }
      catch (er) { b.disabled = false; f.querySelector("[data-ret-msg]").textContent = ph(er.message); } });
    vue.querySelectorAll("[data-sensible]").forEach(b => b.onclick = async () => { const d = b.dataset.sensible; b.disabled = true;
      try { await D.deciderAvisSensible(b.closest("[data-avis]").dataset.avis, d); await avis(); msg(t(d === "approuve" ? "avis.sensible.approuvee.msg" : "avis.sensible.en.parler.msg")); majCompteurs(); }
      catch (er) { b.disabled = false; msg(ph(er.message)); } });
  }

  // ---- Collecte : début. Page publique d'avis, QR code et carte A6, demande par WhatsApp, retours privés.
  // Conformité Google : la page publique est la même pour tous les clients ; rien ici ne trie selon la note.
  // La carte A6 et le message WhatsApp s'adressent aux clients du commerce : ils sont écrits dans la langue du commerce.
  const retoursNonLus = async () => { try { return (await D.retoursPrives()).filter(x => !x.lu).length; } catch (er) { return 0; } };
  // Résultats (01/11/2026, tour 7 Essentiel) : les non-lus avec leurs mois, pour « 0 ce mois-ci · 1 non lu (octobre) ».
  const retoursNonLusMois = async () => { try { const l = (await D.retoursPrives()).filter(x => !x.lu);
    return { n: l.length, mois: [...new Set(l.map(x => new Date(x.cree_le)).sort((a, b) => a - b).map(d => MOIS[d.getMonth()]))] }; } catch (er) { return { n: 0, mois: [] }; } };
  const HOTE_GOOGLE = /(^|\.)(google\.[a-z.]{2,6}|g\.page|goo\.gl|g\.co)$/i;
  // Lien Google proposé par la page publique : même règle que la base (https obligatoire, sinon identifiant de lieu).
  function lienAvis(c) {
    const lien = window.RENOM_LIEN_AVIS(c); if (!lien) return null;
    const deLaFiche = lien === String(c.lien_avis || "").trim(); let hote = ""; try { hote = new URL(lien).hostname; } catch (er) {}
    return { lien, source: t(!deLaFiche ? "col.lien.construit" : HOTE_GOOGLE.test(hote) ? "col.lien.fiche" : "col.lien.douteux") };
  }
  const lienPagePublique = jeton => new URL("avis.html#" + jeton, location.href.split("#")[0]).href;
  function qrSvg(texte) { const q = qrcode(0, "M"); q.addData(texte); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
  // Numéro au format international : indicatif précédé de + ou de 00, puis 8 à 15 chiffres au total ; un numéro national qui commence par 0 prend
  // l'indicatif du pays du commerce (+32 en Belgique, +33 en France ; 31/10/2026, test client Premium belge). Renvoie les chiffres seuls, ou null.
  function numeroInternational(saisie, pays) {
    let n = String(saisie || "").trim().replace(/\(0\)/g, "").replace(/[\s.\-()  ]/g, "");
    if (n.startsWith("+")) n = n.slice(1); else if (n.startsWith("00")) n = n.slice(2); else if (/^0[1-9]/.test(n)) n = (M.paysDe(pays) === "BE" ? "32" : "33") + n.slice(1); else return null;
    if (!/^[1-9]\d{7,14}$/.test(n)) return null;
    if (n.startsWith("33") && !/^33[1-9]\d{8}$/.test(n)) return null;   // France : pas de 0 après l'indicatif, neuf chiffres
    return n;
  }
  const messageWhatsApp = (c, prenom, lien) => t("wa.message", { prenom: prenom ? " " + prenom : "", nom: c.nom, lien }, langueCommerce);
  const lienWhatsApp = (numero, texte) => "https://wa.me/" + numero + "?text=" + encodeURIComponent(texte);
  const retourPrive = x => `<li data-retour="${e(x.id)}"><div class="retour-prive">
      <p><span class="fort">${etoiles(x.note)}</span>${x.prenom ? " · " + e(x.prenom) : ""} · <span class="etat${x.lu ? "" : " actif"}">${t(x.lu ? "retour.lu" : "retour.non.lu")}</span></p>
      ${x.message ? `<p class="citation"${lc()}>${t("guillemets", { x: e(x.message) })}</p>` : `<p class="note">${t("retour.sans.message")}</p>`}
      <p class="note">${t("recu.le", { d: date(x.cree_le) })}, ${heure(x.cree_le)}</p></div>
      <button type="button" class="lien" data-lu="${x.lu ? "0" : "1"}">${t(x.lu ? "retour.marquer.non.lu" : "retour.marquer.lu")}</button></li>`;
  async function dessinerRetours() {
    const zone = $("retours"); if (!zone) return; const l = await D.retoursPrives(), non = l.filter(x => !x.lu).length;
    zone.innerHTML = `<div class="carte-tete"><h2>${t("retours.titre")}</h2>${l.length ? `<span class="note" id="retours-compte">${non ? t("retours.non.lus", { n: non, total: l.length }) : t("retours.tous.lus", { n: l.length })}</span>` : ""}</div>
      <p class="note">${t("retours.note")}</p>
      ${l.length ? `<ul class="liste retours">${l.map(retourPrive).join("")}</ul>` : `<p class="texte2">${t("retours.vide")}</p>`}
      <p class="msg" id="retours-msg" role="status"></p>`;
    zone.querySelectorAll("[data-lu]").forEach(b => b.onclick = async () => {
      try { await D.marquerRetour(b.closest("[data-retour]").dataset.retour, b.dataset.lu === "1"); await dessinerRetours(); majCompteurs(); } catch (er) { $("retours-msg").textContent = ph(er.message); }
    });
  }
  // Mesure de la collecte : passages sur la page d'avis, clics vers Google, retours privés, nouveaux avis (lus sur la fiche Google à la demande,
  // jamais conservés : sans lecture, « Voir Résultats », jamais un zéro inventé).
  const MESURES = ["passages", "clics_google", "retours_prives", "nouveaux_avis"].map(k => [k, t("mesure." + k)]);
  const valeurMesure = (m, k) => k === "nouveaux_avis" && m[k] == null ? `<a href="#/resultats">${t("voir.resultats")}</a>` : nombre(+m[k] || 0);
  // Retours privés non lus (01/11/2026, tour 6 Premium) : même compte que l'accueil (retoursNonLus : tous les non lus), à côté du total du mois.
  const nonLusMesure = (k, nl) => k === "retours_prives" && nl && typeof nl === "object" ? (nl.n > 0 ? ` <span class="note" data-ce-mois>${t("res.ce.mois.court")} · <a href="#/collecte?retours" id="retours-non-lus-res">${t("res.retours.non.lus", { n: nl.n })}${nl.mois.length ? ` (${e(I.liste(nl.mois))})` : ""}</a></span>` : "")
    : k === "retours_prives" && nl > 0 ? ` <a class="note" href="#/collecte?retours" id="retours-non-lus-res">${t("res.retours.non.lus", { n: nl })}</a>` : "";
  const chiffresCollecte = (m, deux, nl) => `<dl class="bilan-chiffres${deux ? " deux" : ""}">${MESURES.map(([k, lib]) => `<div class="bilan-chiffre"><dt>${lib}</dt><dd class="chiffre" data-mesure="${k}">${valeurMesure(m, k)}${nonLusMesure(k, nl)}</dd></div>`).join("")}</dl>`;
  const blocMesure = m => m ? `<section class="carte" id="mesure-collecte"><div class="carte-tete"><h2>${t("ce.mois")}</h2>${D.mode === "demo" ? `<span class="note">${t("demo.chiffres")}</span>` : ""}</div>
      ${chiffresCollecte(m)}<p class="note">${t("col.mesure.note")}</p></section>` : "";
  async function collecte() {
    const c = await D.commerce(), l = lienAvis(c), co = c.couleurs || {}, page = l ? lienPagePublique(await D.jetonAvis()) : null;
    const mesure = await D.resultats(1).then(r => r && r.collecte).catch(() => null), dem = await D.demandesAvis().catch(() => null);
    const local = D.mode === "demo" || /^(localhost|127\.|\[::1\])/.test(location.host), lgc = langueCommerce;
    const carteA6 = id => `<div class="a6" lang="${lgc}" style="background:${e(co.fond || "#fff")};color:${e(co.texte || "#000")}"><div><p class="a6-nom">${e(c.nom)}</p><h3>${t("a6.titre", null, lgc)}</h3></div>
      <p>${t("a6.texte", null, lgc)}</p><div class="qr"${id ? ` id="${id}"` : ""}>${qrSvg(page)}</div></div>`;
    const regle = `<section class="carte"><h2>${t("col.regle.titre")}</h2><p class="texte2">${t("col.regle.texte")}</p></section>`;
    // 27/10/2026 : nom du commerce pas encore confirmé, les demandes par email attendent (bloc SQL « Mise en route claire »).
    const nomAvant = nomAConfirmer(c) ? `<section class="alerte" id="col-nom"><div><p class="fort">${t("col.nom.titre")}</p><p>${t("col.nom.texte")}</p></div><a class="bouton second" href="#/demarrage">${t("nom.confirmer")}</a></section>` : "";
    const tete = `${retourAuto("#/avis", "col.retour")}${entete(t("groupe.avalider"), t("ecran.collecte"), t("col.chapo"))}${nomAvant}`;
    if (!l) {
      vue.innerHTML = `${tete}
        <div class="pile">${regle}${blocMesure(mesure)}
          <section class="carte"><h2>${t("col.manque.titre")}</h2><p class="texte2">${t("col.manque.texte")}</p>
          <p class="note">${t("col.manque.note")}</p></section></div>`;
      return;
    }
    vue.innerHTML = `${tete}
      <div class="colonnes collecte">
        <div class="pile">
          ${regle}
          ${blocMesure(mesure)}
          <section class="carte"><h2>${t("col.page.titre")}</h2>
            <p class="texte2">${t("col.page.texte")}</p>
            <p id="lien" class="casse fort">${e(page)}</p>
            <div class="actions"><button type="button" class="bouton" id="imprimer">${t("col.imprimer")}</button><a class="bouton second" id="ouvrir-lien" href="${e(page)}" target="_blank" rel="noopener">${t("col.ouvrir")}</a><button type="button" class="lien" id="copier">${t("col.copier")}</button></div>
            <p class="msg" id="msg" role="status"></p>
            <p class="note">${t("col.bouton.google")}<span id="lien-google" class="casse">${e(l.lien)}</span>. ${e(l.source)}</p>
            ${local ? `<p class="note" id="note-adresse">${t("col.adresse.demo")}</p>` : ""}</section>
          ${blocDemandesEmail(dem)}
          <section class="carte" id="retours"></section>
          <section class="carte"><h2>${t("wa.titre")}</h2>
            <p class="texte2">${t("wa.texte")}</p>
            <div class="encart"><p><span class="fort">${t("wa.respecter")}</span> ${t("wa.regle")}</p></div>
            <form id="wa" novalidate><div class="champs">
              <div class="f"><label for="wa-prenom">${t("wa.prenom")}</label><input id="wa-prenom" type="text" autocomplete="off" maxlength="60"></div>
              <div class="f"><label for="wa-numero">${t("wa.numero")}</label><input id="wa-numero" type="tel" inputmode="tel" autocomplete="off" placeholder="${e(exNum(c))}" aria-describedby="wa-aide"></div>
              <p class="aide toute" id="wa-aide">${t("wa.aide", numParams(c))}</p>
              <div class="f toute"><label for="wa-message">${t("wa.message.lib")}</label><textarea id="wa-message" class="haut-texte" lang="${lgc}"></textarea></div></div>
              <div class="actions"><button class="bouton" type="submit">${t("wa.ouvrir")}</button><p class="msg" id="wa-msg" role="status"></p></div></form></section>
        </div>
        <section class="carte carte-apercu"><h2>${t("a6.apercu")}</h2><div class="apercu-a6" id="apercu">${carteA6("qr")}</div><p class="note">${t("a6.note")}</p></section>
      </div>
      <div class="zone-a6">${carteA6("")}</div>`;
    $("imprimer").onclick = () => window.print();
    $("copier").onclick = async () => { try { await navigator.clipboard.writeText(page); msg(t("col.copie")); } catch (er) { msg(t("col.copie.echec")); } };
    // WhatsApp : le message suit le prénom tant que le commerçant ne l'a pas réécrit lui-même.
    const waMsg = x => { $("wa-msg").textContent = x; }; let reecrit = false;
    const proposer = () => { if (!reecrit) $("wa-message").value = messageWhatsApp(c, $("wa-prenom").value.trim(), page); };
    proposer(); $("wa-prenom").oninput = proposer; $("wa-message").oninput = () => { reecrit = true; };
    $("wa").onsubmit = ev => {
      ev.preventDefault(); const numero = numeroInternational($("wa-numero").value, c.pays), texte = $("wa-message").value.trim();
      if (!numero) { waMsg(t("wa.numero.ko", numParams(c))); $("wa-numero").focus(); return; }
      if (!texte.includes(page)) { waMsg(t("wa.garder.lien")); $("wa-message").focus(); return; }
      window.open(lienWhatsApp(numero, texte), "_blank", "noopener");
      $("wa-numero").value = ""; $("wa-prenom").value = ""; reecrit = false; proposer();
      waMsg(t("wa.ouvre"));
    };
    brancherDemandesEmail();
    await dessinerRetours();
    if (/retours/.test(paramRoute) && $("retours")) $("retours").scrollIntoView({ block: "start" });
  }
  // ---- Automatisations de service : demande d'avis par email (import CSV, mesure, liste d'opposition)
  const ST_DEMANDE = I.carte("dem.st", ["a_envoyer", "en_cours", "envoye", "annule", "echec"]);
  const CHIFFRES_DEMANDES = ["envois", "ouvertures", "clics_google", "relances"].map(k => [k, t("dem.chiffre." + k)]);
  function blocDemandesEmail(m) {
    if (!m) return "";
    const modele = "data:text/csv;charset=utf-8," + encodeURIComponent(AU.MODELE_CSV);
    return `<section class="carte" id="demandes-email" aria-labelledby="dem-email-titre"><div class="carte-tete"><h2 id="dem-email-titre">${t("dem.titre")}</h2>${D.mode === "demo" ? `<span class="note">${t("demo.chiffres")}</span>` : ""}</div>
      <p class="texte2">${t("dem.texte")}</p>
      <div class="encart"><p><span class="fort">${t("dem.regles")}</span> ${t("dem.regles.texte")}</p></div>
      <form id="import-clients" novalidate>
        <div class="f"><div class="depot"><input id="csv" class="vh" type="file" accept=".csv,text/csv,text/plain"><label for="csv" class="bouton second">${t("dem.choisir")}</label><span class="note casse" id="csv-nom" aria-live="polite">${t("dem.aucun.fichier")}</span></div>
          <p class="aide">${t("dem.aide")} <a href="${modele}" download="${t("dem.modele.nom")}">${t("dem.modele")}</a></p></div>
        <label class="option consentement"><input type="checkbox" id="consentement"><span>${t("dem.consentement")}</span></label>
        <div class="actions"><button class="bouton" type="submit" id="importer">${t("dem.importer")}</button></div>
        <p class="msg" id="msg-import" role="status"></p><ul class="liste" id="import-ignores" hidden></ul></form>
      <dl class="bilan-chiffres deux">${CHIFFRES_DEMANDES.map(([k, lib]) => `<div class="bilan-chiffre"><dt>${lib}</dt><dd class="chiffre" data-demandes="${k}">${nombre(+m[k] || 0)}</dd></div>`).join("")}</dl>
      <p class="note">${t("dem.periode", { j: m.periode_jours || 30, a_venir: `<span data-demandes="a_venir">${nombre(+m.a_venir || 0)}</span>`, opp: `<span data-demandes="oppositions">${nombre(+m.oppositions || 0)}</span>` })}</p>
      ${(m.dernieres || []).length ? `<details class="dernieres"><summary>${t("dem.dernieres", { n: m.dernieres.length })}</summary><ul class="liste">${m.dernieres.map(x => `<li><div><p class="fort">${e(x.prenom || t("dem.client"))}</p>
        <p class="note">${t(x.etape === "relance" ? "dem.rappel" : "dem.demande")}, ${cap(date(x.envoye_le || x.prevu_le))}${x.ouverte ? t("dem.page.ouverte") : ""}${x.motif ? " (" + e(ph(x.motif)) + ")" : ""}</p></div><span class="etat">${ST_DEMANDE[x.statut] || e(x.statut)}</span></li>`).join("")}</ul></details>` : ""}
      <form id="opposition" novalidate><div class="f"><label for="opp-email">${t("dem.opp.label")}</label><input id="opp-email" type="email" autocomplete="off"></div>
        <div class="actions"><button class="bouton second" type="submit">${t("dem.opp.bouton")}</button></div><p class="msg" id="msg-opp" role="status"></p></form></section>`;
  }
  function brancherDemandesEmail() {
    if (!$("import-clients")) return;
    $("csv").onchange = () => { const f = $("csv").files[0]; $("csv-nom").textContent = f ? f.name : t("dem.aucun.fichier"); };
    $("import-clients").onsubmit = async ev => {
      ev.preventDefault(); const m = x => { $("msg-import").textContent = x; }, ul = $("import-ignores"); ul.hidden = true; ul.innerHTML = "";
      const f = $("csv").files[0]; if (!f) { m(t("dem.choisir.dabord")); return; }
      if (!$("consentement").checked) { m(t("dem.cocher")); $("consentement").focus(); return; }
      try {
        const lignes = AU.lireCsvClients(await f.text()), r = await D.importerClients(lignes, true), ign = r.ignores || [];
        await collecte();
        $("msg-import").textContent = t("dem.importes", { n: r.importes }) + (ign.length ? t("dem.ecartees", { n: ign.length }) : "") + t("dem.partent");
        if (ign.length) { const u = $("import-ignores"); u.hidden = false; u.innerHTML = ign.map(x => `<li><div><p class="fort">${t("dem.ligne", { n: x.ligne + 1 })}</p><p class="note">${e(ph(x.raison))}</p></div></li>`).join(""); }
        $("demandes-email").scrollIntoView({ block: "nearest" });
      } catch (er) { m(ph(er.message)); }
    };
    $("opposition").onsubmit = async ev => {
      ev.preventDefault(); const em = $("opp-email").value.trim();
      try { await D.ajouterOpposition(em); await collecte(); $("msg-opp").textContent = t("dem.opp.ok"); } catch (er) { $("msg-opp").textContent = ph(er.message); }
    };
  }
  // ---- Collecte : fin

  // ---------------- Comptes connectés
  const AIDE = I.carte("compte.aide", ["google", "facebook", "instagram", "tiktok"]);
  // TikTok (31/10/2026) : pas de lien de connexion en libre-service. La demande est enregistrée dans l'espace par le circuit « rappelez-moi »
  // (demander_rappel, sujet « reseaux » : alerte RAPPEL_DEMANDE pour l'équipe, avec le numéro). Son état est lu côté serveur (D.demandeRappel,
  // fonction ma_demande_rappel du bloc SQL « Créneaux réels » ; test client Premium : la demande n'était retenue que sur l'appareil) pour l'afficher
  // dans Comptes et retirer la tâche de l'accueil sur tout appareil ; base sans cette fonction : la date retenue sur l'appareil, en secours.
  // L'email pré-rempli reste en secours (base sans demander_rappel, ou au choix).
  const cleTiktok = c => "renom-tiktok-demande:" + c.id, demandesTiktok = {};
  const tiktokLocal = c => { try { return localStorage.getItem(cleTiktok(c)) || ""; } catch (er) { return ""; } };
  const tiktokDemande = c => demandesTiktok[c.id] != null ? demandesTiktok[c.id] : tiktokLocal(c);
  // Numéro donné pour le rappel TikTok, retenu sur l'appareil (la base ne rend que la date de la demande) ; modifTiktok : formulaire rouvert.
  const telTiktok = c => { try { return localStorage.getItem(cleTiktok(c) + ":tel") || ""; } catch (er) { return ""; } };
  let modifTiktok = false;
  async function chargerDemandeTiktok(c) { let d = null; try { d = D.demandeRappel ? await D.demandeRappel("reseaux") : null; } catch (er) { d = null; }
    demandesTiktok[c.id] = d == null ? tiktokLocal(c) : d; return demandesTiktok[c.id]; }
  const activerTiktok = c => { const nom = c.nom || "", su = t("compte.tiktok.sujet", { nom }), co = t("compte.tiktok.corps", { nom, res: "TikTok" }), d = tiktokDemande(c);
    const mail = `mailto:info@boostimpact.agency?subject=${encodeURIComponent(su)}&body=${encodeURIComponent(co)}`;
    // Confirmation (31/10/2026, test client Premium, tour 5) : numéro mis au format (+32 470 12 34 56), délai, « Modifier le numéro ».
    const telD = telTiktok(c), recente = d && Date.now() - Date.parse(d) < 24 * 3600000;
    const qd = (() => { try { return JSON.parse(localStorage.getItem(cleTiktok(c) + ":quand") || "null"); } catch (er) { return null; } })();
    const telLu = telD ? `<span class="casse" translate="no">${e(window.RENOM_WHATSAPP.lisible(telD))}</span>` : "";
    if (d && !modifTiktok) return `<div class="pile serre"><p class="texte2" id="tiktok-demande" role="status">${telD && recente && qd && qd.jour ? t("compte.tiktok.envoyee.le", { d: date(d) }) + " " + t(qd.creneau === "15-17" ? "avis.rappel.prevu.1517" : "avis.rappel.prevu", { tel: telLu, quand: quandRappel(String(qd.jour).slice(0, 10)) })
      : telD ? t("compte.tiktok.envoyee.tel", { d: date(d), tel: telLu, quand: recente ? t("compte.tiktok.quand", { j: quandJour(jourRappelDe(c, d)) }) : "" }) : t("compte.tiktok.envoyee", { d: date(d) })}</p>
      ${recente && merSql(c) ? `<p><button type="button" class="lien" id="tiktok-modifier">${t("compte.tiktok.modifier")}</button></p>` : ""}</div>`;
    if (!merSql(c)) return `<p class="actions"><a class="bouton second" id="activer-tiktok" href="${mail}">${t("compte.tiktok.demander")}</a></p>`;
    const tel = telTiktok(c) || telRetenue(c);   // même numéro préenregistré que le formulaire d'avis (01/11/2026, tour 7 Premium)
    // Jour et heure (01/11/2026, tour 7 Premium) : mêmes jours que le formulaire d'avis (M.joursRappel : jamais un dimanche ni un jour férié du pays)
    // et même choix d'heure (9 h-18 h, ou 15 h-17 h, « après le service » pour un restaurant) ; base : preciser_rappel.
    const auj = jourParis(Date.now()), jr = M.joursRappelA(Date.now(), c.pays);
    return `<form id="tiktok-f" class="pile serre" novalidate><div class="f"><label for="tiktok-tel">${t("compte.tiktok.tel")}</label><input id="tiktok-tel" type="tel" inputmode="tel" autocomplete="tel" maxlength="24" value="${e(tel ? window.RENOM_WHATSAPP.lisible(tel) : "")}" placeholder="${e(exNum(c))}" aria-describedby="tiktok-aide"><p class="aide" id="tiktok-aide">${t("rappel.aide", numParams(c))}</p></div>
      ${D.preciserRappel ? `<fieldset><legend>${t("avis.rappel.quand")}</legend>
        ${radiosJours("tiktok-jour", jr, auj)}</fieldset>
      <fieldset><legend>${t("avis.rappel.heure")}</legend>
        <label class="option"><input type="radio" name="tiktok-plage" value="" checked><span>${t("avis.rappel.plage.journee")}</span></label>
        <label class="option"><input type="radio" name="tiktok-plage" value="_15_17"><span>${t(c.metier === "restaurant" ? "avis.rappel.plage.service" : "avis.rappel.plage.1517")}</span></label></fieldset>` : ""}
      <div class="actions"><button class="bouton" type="submit" id="activer-tiktok">${t("compte.tiktok.demander")}</button></div><p class="msg" id="tiktok-msg" role="status"></p>
      <p class="note">${t("compte.tiktok.ou")} <a href="${mail}" id="tiktok-mail">${t("compte.tiktok.email")}</a></p></form>`; };
  async function comptes() {
    // Offre sans réseaux (Essentiel, 26/10/2026) : seulement l'accès à la fiche Google ; Facebook, Instagram et TikTok ne la concernent pas.
    const [c, l0] = await Promise.all([D.commerce(), D.comptes()]), g = sansReseaux(c), l = g ? l0.filter(x => x.reseau === "google") : l0;
    if (l.some(x => x.reseau === "tiktok" && x.etat !== "connecte")) await chargerDemandeTiktok(c);
    // TikTok demandé (01/11/2026, tour 6 Premium) : « · Activation demandée », sans la phrase d'aide (la confirmation dit déjà la suite).
    const tiktokEnAttente = x => x.reseau === "tiktok" && x.etat !== "connecte" && !!tiktokDemande(c) && !modifTiktok;
    vue.innerHTML = `${retourOrigine()}${entete(t("groupe.reglages"), t(g ? "reg.comptes.google" : "ecran.comptes"), (D.mode === "demo" ? t("comptes.demo") + " " : "") + t(g ? "comptes.chapo.google" : "comptes.chapo"))}
      <div class="cartes comptes">${l.map(x => `<article class="carte"${x.reseau === "google" ? ' id="compte-google"' : ""}><h2>${RES[x.reseau]} <span class="etat${x.etat === "connecte" ? " actif" : ""}">· ${tiktokEnAttente(x) ? t("etat.tiktok.demande") : ETAT[x.etat] || e(x.etat)}</span></h2>${x.reseau === "google" ? ficheReliee(c) : ""}${tiktokEnAttente(x) ? "" : `<p class="texte2">${AIDE[x.reseau]}</p>`}${x.detail ? `<p class="note pied">${e(ph(x.detail))}</p>` : ""}${x.reseau === "google" ? ficheLecture(c, "fiche-comptes") : ""}${x.reseau === "tiktok" && x.etat !== "connecte" ? activerTiktok(c) : ""}</article>`).join("")}</div>`;
    if ($("tiktok-f")) $("tiktok-f").onsubmit = async ev => { ev.preventDefault(); const b = $("activer-tiktok"); b.disabled = true;
      try { const r = await D.demanderRappel("reseaux", $("tiktok-tel").value), d = (r && r.cree_le) || new Date().toISOString(), n = (r && r.telephone) || window.RENOM_WHATSAPP.numero($("tiktok-tel").value, c.pays) || "";
        const jv = (vue.querySelector("input[name=tiktok-jour]:checked") || {}).value, pv = (vue.querySelector("input[name=tiktok-plage]:checked") || {}).value || "";
        const q = jv && D.preciserRappel ? await D.preciserRappel("reseaux", jv + pv).catch(() => null) : null;
        try { localStorage.setItem(cleTiktok(c), d); if (n) localStorage.setItem(cleTiktok(c) + ":tel", n); if (q) localStorage.setItem(cleTiktok(c) + ":quand", JSON.stringify(q)); } catch (er) {} demandesTiktok[c.id] = d; modifTiktok = false;
        // Pas de toast : la confirmation complète est affichée (role=status) à la place du formulaire.
        await comptes(); majCompteurs(); const z = $("tiktok-demande"); if (z) z.scrollIntoView({ block: "center" }); } catch (er) { b.disabled = false; $("tiktok-msg").textContent = ph(er.message); } };
    if ($("tiktok-modifier")) $("tiktok-modifier").onclick = async () => { modifTiktok = true; await comptes(); const i = $("tiktok-tel"); if (i) { i.focus(); i.select(); } };
    if (/[?&]tiktok\b/.test(location.hash) && $("activer-tiktok")) $("activer-tiktok").scrollIntoView({ block: "center" });
  }

  // ---------------- Offre : ce qui est inclus (contenus originaux par mois, réseaux retenus), le prix (annuel, mensuel, frais de mise en route
  // selon l'offre), la règle de publication, la garantie des délais et son suivi, le parcours en 3 étapes et l'abonnement Stripe.
  // Chiffres : window.RENOM_OFFRES et window.RENOM_CONDITIONS (donnees.js, égaux à moteur/ et à la base). L'objectif interne des pilotes n'est jamais montré ici.
  const COND = window.RENOM_CONDITIONS;
  const euros = x => t("euros", { x: nombre(x) });
  const ETATS_DELAI = I.carte("delai.etat", ["non_demarre", "en_cours", "tenu", "manque"]);
  // Essentiel (26/10/2026, CGV article 10) : les délais partent de l'accès à la fiche Google seul (photos facultatives).
  function suiviDelais(g, google) {
    if (!g) return "";
    if (!g.depart) return `<div class="pile serre" id="offre-delais-suivi"><h3>${t("offre.delais.suivi")}</h3><p class="note">${t(google ? "offre.delais.pas.demarre.google" : "offre.delais.pas.demarre")}</p></div>`;
    const ligne = (lib, d, id) => `<li id="${id}"><span>${lib}${d.echeance ? `<span class="note">${t(d.fait_le ? "offre.delais.fait" : "offre.delais.avant", { d: I.dateLongue((d.fait_le || d.echeance).slice(0, 10)) })}</span>` : ""}</span><span class="etat${d.etat === "tenu" ? " actif" : ""}">${ETATS_DELAI[d.etat] || e(d.etat)}</span></li>`;
    const av = g.avis_en_cours || [], offerts = (g.mois_offerts || []).map(m => I.dateLongue(m)).join(", ");
    // Suivi replié (27/10/2026, écran Offre plus court sur téléphone) : les engagements restent affichés au-dessus.
    return `<details class="repliable sous" id="offre-delais-suivi"><summary><h3>${t("offre.delais.suivi")}</h3></summary><div class="pile serre">
      <p class="note">${t("offre.delais.depart", { d: I.dateLongue(g.depart.slice(0, 10)) })}</p>
      <ul class="liste">${ligne(t("offre.delais.fiche"), g.fiche, "delai-fiche")}${g.premier_contenu ? ligne(t("offre.delais.contenu"), g.premier_contenu, "delai-contenu") : ""}
        <li id="delai-avis"><span>${t("offre.delais.avis")}</span><span class="fort chiffre">${av.length ? t("offre.delais.avis.n", { n: av.length }) : t("offre.delais.avis.aucun")}</span></li></ul>
      ${offerts ? `<p class="note" id="offre-mois-offerts">${t("offre.delais.mois.offerts", { l: offerts })}</p>` : ""}</div></details>`;
  }
  // Options commandées (22/10/2026, CGV article 3 bis) : une ligne par option payée, « en cours » (date prévue dès que les éléments du client sont
  // reçus, sinon le délai) ou « livrée le … » (et le second test de la Visibilité IA). Rien quand le commerce n'a commandé aucune option.
  const jourParis = x => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(x));
  const nomOption = k => { const o = (window.RENOM_OPTIONS || {})[k] || {}; return (I.langue === "en" ? o.nom_en : I.langue === "nl" ? o.nom_nl : o.nom) || o.nom || k; };
  const etatOption = x => x.statut === "livree"
    ? (x.second_test_prevu_le && !x.second_test_fait_le ? t("opt.livree.second", { d: I.dateLongue(jourParis(x.livree_le)), s: I.dateLongue(x.second_test_prevu_le) }) : t("opt.livree", { d: I.dateLongue(jourParis(x.livree_le)) }))
    : x.elements_recus_le ? t("opt.en.cours.date", { d: I.dateLongue(x.livraison_prevue_le) }) : t("opt.en.cours.elements", { n: ((window.RENOM_OPTIONS || {})[x.option_id] || {}).livraison_jours || 14 });
  const optionsCommandees = l => (l || []).length ? `<section class="carte" id="offre-options"><h2>${t("opt.titre")}</h2>${l.map(x => `<p class="texte2 lecture" data-option="${e(x.option_id)}"><span class="fort">${e(nomOption(x.option_id))}</span>${t("deux.points")}${etatOption(x)}</p>`).join("")}</section>` : "";
  // Offre du dessus et Premium (27/10/2026, constats 6, 21 et 22 ; décisions de PJ du 27/10/2026). Offre du dessus : ce qu'elle ajoute, son prix
  // (chiffres de moteur/offres.json : window.RENOM_OFFRES) et le bouton « Passer à <offre> », qui ouvre le portail client de Stripe (abonnement en
  // cours) ou la page de paiement de cette offre (aucun abonnement) : D.lienMonteeOffre. Sans lien Stripe configuré : « écrivez-nous ».
  // Adresse « #/offre?dessus » (offre suivante) ou « #/offre?dessus=premium » (offre précise, plus haute que l'offre actuelle : vidéos).
  // Bouton « Réserver mon point du mois » (01/11/2026, tour 6 Premium) : juste sous la ligne « Point de 30 min », plus au milieu du bloc délégation.
  // Premium : bilan commenté et point de 30 min chaque mois (CGV, tableau des offres et article 3), mode délégation activé ou désactivé ICI
  // (D.reglerDelegation, fonction regler_delegation : accord horodaté avec la version des CGV) ; base sans ce bloc : texte « écrivez-nous ».
  const ORDRE_OFFRES = ["essentiel", "standard", "premium"];
  // « Prix de lancement » (02/11/2026, décision de PJ) : Croissance seulement, en note sous le prix, comme sur le site ; aucun prix changé, aucun prix
  // barré ni prix futur chiffré (règle des annonces de réduction de prix : un prix de référence barré doit avoir été pratiqué).
  const PRIX_LANCEMENT = ["standard"];
  const offreCible = (c, voulue) => { const i = ORDRE_OFFRES.indexOf(c.offre_id), j = ORDRE_OFFRES.indexOf(voulue);
    return i >= 0 && j > i ? voulue : i >= 0 && i < ORDRE_OFFRES.length - 1 ? ORDRE_OFFRES[i + 1] : null; };
  // Montée en offre sans email (01/11/2026, tour 6 Croissance) : abonnement en cours (ou aucun lien de paiement) = « Passer en <offre> » fait une
  // demande en un geste (D.demanderRappel, sujet « changement_offre », offre visée), jamais un second paiement Stripe (risque de double abonnement) ;
  // PJ confirme et change l'abonnement au prorata. Sans abonnement, le lien de paiement Stripe reste (premier paiement, aucun doublon possible).
  let demandeChgOffre = null;
  function offreDessus(c, o, ab, voulue) {
    const O = window.RENOM_OFFRES || {}, h = COND.delegation.publication_auto_heures;
    if (o.delegation) {
      const actif = delegationActive(c), bouton = !!(D.reglerDelegation && D.delegationParBouton && D.delegationParBouton(c));
      const reglage = !bouton ? (actif ? `<p class="note">${t("offre.premium.delegation.sortir")}</p>` : `<p class="texte2 lecture" id="delegation-activer">${t("offre.premium.delegation.activer", { h })}</p>`)
        : actif ? `<p class="texte2 lecture" id="delegation-etat">${t("offre.deleg.depuis", { d: I.dateLongue(String(c.delegation_signee_le).slice(0, 10)), h })}</p>
            <p class="pied"><button type="button" class="bouton second" id="delegation-desactiver">${t("offre.deleg.desactiver")}</button></p>`
        : `<p class="texte2 lecture" id="delegation-accord">${t("offre.deleg.accord", { h })}</p>
            <p class="pied"><button type="button" class="bouton" id="delegation-activer-btn">${t("offre.deleg.activer")}</button></p><p class="note">${t("offre.deleg.trace")}</p>`;
      return `<section class="carte" id="offre-premium"><h2>${t("offre.premium.titre")}</h2><ul class="liste">
        <li id="premium-videos"><span>${t("offre.inc.videos")}</span><span class="fort">${t("offre.premium.videos", { v: o.videos })}</span></li>
        <li id="premium-point"><span>${t("offre.premium.point")}</span><span class="fort">${t("compris")}</span></li></ul>
        ${boutonPointMois(c, "premium-reserver-point") ? `<p class="pied" id="premium-point-pied">${boutonPointMois(c, "premium-reserver-point")}</p>${notePointMois(c, "premium-reserver-point")}` : ""}
        <ul class="liste"><li id="premium-delegation"><span>${t("offre.premium.delegation")}</span><span class="fort">${t(actif ? "offre.premium.delegation.active" : "offre.premium.delegation.inactive")}</span></li></ul>
        ${reglage}<p class="msg" id="msg-deleg" role="status"></p></section>`;
    }
    const suiv = offreCible(c, voulue), s_ = O[suiv]; if (!s_) return "";
    // Lien de paiement de l'offre du dessus (jamais le portail : décision de PJ du 27/10/2026), même rythme que l'abonnement en cours.
    const nom = e(I.offre(suiv)), lien = D.lienMonteeOffre ? D.lienMonteeOffre(ab, c, suiv) : null, enCours = !!(ab && ab.statut !== "resilie");
    // Même rythme que le prix et le lien (tour 8) : window.RENOM_RYTHME_MONTEE (donnees.js), une seule règle.
    const rythme = window.RENOM_RYTHME_MONTEE(ab), mer = COND.mise_en_route, offertsF = rythme === mer.offerts_paiement;
    // Mise en route déjà payée (offre actuelle avec mise en route, Croissance) : jamais refacturée.
    // Montée par demande (tour 7 Essentiel, 01/11/2026) : aucun paiement en ligne, donc ni « avec le paiement de la montée » ni « sans nouveau
    // paiement » (phrases contradictoires) : les frais tels que les CGV les prévoient (article 4, une seule fois, offerts en annuel), et la note
    // « PJ vous confirme le montant avant tout changement ».
    const parDemande = !!D.demanderRappel && (enCours || !lien);
    const frais = !s_.frais_mise_en_route ? "" : o.frais_mise_en_route ? t("offre.dessus.frais.deja") : t(offertsF ? "offre.dessus.frais.offerts" : parDemande ? "offre.dessus.frais.demande" : "offre.dessus.frais.factures", { prix: euros(mer.prix_ht) });
    const lignes = suiv === "standard" ? ["offre.dessus.std.1", "offre.dessus.std.2"] : ["offre.dessus.prem.1", "offre.dessus.prem.2", "offre.dessus.prem.3"];
    const P = window.RENOM_PRIX_MONTEE(o, s_, ab), ecartPrix = P.ecart, mensuelP = P.rythme === "mensuel";
    // Tour 9 (01/11/2026) : plus de « aujourd'hui ou demain » écrit en dur. Le numéro est demandé comme pour « Attendez mon appel » (prérempli,
    // obligatoire) et le jour est un vrai jour ouvré (M.joursRappel : jamais un dimanche ni un jour férié du pays), nommé (« lundi 2 novembre »),
    // avec la plage horaire ; base : demander_rappel puis preciser_rappel (sujet « changement_offre »), comme la demande TikTok.
    const blocDemande = demandeChgOffre ? `<p class="texte2 lecture" id="offre-demande-envoyee" role="status">${t("offre.dessus.demande.envoyee", Object.assign({ d: date(demandeChgOffre) }, quandChgOffre(c, demandeChgOffre)))}</p>`
      : formChgOffre(c, suiv, nom);
    return `<section class="carte" id="offre-dessus" data-offre="${e(suiv)}"><h2>${t("offre.dessus.titre", { nom })}</h2>
      <ul class="liste-engagements">${lignes.map(k => `<li><p>${t(k, { n: s_.contenus, v: s_.videos, h })}</p></li>`).join("")}</ul>
      ${P.enCours && P.actuel ? `<p class="texte2" id="dessus-vous">${t(mensuelP ? "offre.dessus.vous.mensuel" : "offre.dessus.vous.annuel", { prix: euros(P.actuel) })}</p>` : ""}
      <p class="prix-offre" id="dessus-prix"><span class="chiffre">${euros(P.cible)}</span> ${t(mensuelP ? "offre.ht.mois.mensuel" : "offre.ht.mois.annuel")}</p>${PRIX_LANCEMENT.includes(suiv) ? `<p class="note" id="dessus-lancement">${t("offre.lancement")}</p>` : ""}
      <p class="texte2" id="dessus-mensuel">${t(mensuelP ? "offre.dessus.annuel.ou" : "offre.dessus.mensuel", { prix: euros(P.autre) })}</p>
      ${frais ? `<p class="texte2" id="dessus-frais">${frais}</p>` : ""}
      ${ecartPrix > 0 ? `<p class="texte2" id="dessus-difference">${t("offre.dessus.difference", { prix: euros(ecartPrix) })}</p>` : ""}
      ${parDemande ? blocDemande : lien ? `<p class="pied actions-abo"><a class="bouton" id="offre-passer" href="${e(lien)}" target="_blank" rel="noopener">${t("offre.dessus.passer", { nom })}</a></p>
        <p class="note" id="dessus-note">${t(enCours ? "offre.dessus.note.paiement" : "offre.dessus.note.paiement.seul", { nom, r: t("offre.dessus.rythme." + rythme) })}</p>`
        : `<p class="note" id="dessus-note">${t("offre.dessus.comment")}</p>`}</section>`;
  }
  // Demande de changement d'offre (tour 9) : jour et plage choisis, gardés sur l'appareil (la base les garde aussi, alertes_exploitant.detail) ;
  // ailleurs, le jour ouvré qui suit la demande (après 17 h : le suivant), même calcul que joursRappel.
  const cleChgOffre = c => "renom-chg-offre:" + ((c && c.id) || "");
  const minJour = s_ => I.langue === "en" ? s_ : s_.charAt(0).toLowerCase() + s_.slice(1);
  // Jour ouvré du rappel d'une demande faite à l'instant d (tour 10, v36 : partagé par le changement d'offre, « Je n'y arrive pas : rappelez-moi »
  // et TikTok) : M.joursRappel (jamais un dimanche ni un férié du pays), et après 17 h (heure de Paris) le jour ouvré suivant.
  // Tour 11 (v37) : le premier des deux jours proposés à l'instant de la demande (M.joursRappelA : ni samedi, ni dimanche, ni férié ; après 17 h, à partir de demain).
  function jourRappelDe(c, d) { return M.joursRappelA(Date.parse(d), c && c.pays).aujourdhui; }
  const quandJour = j => minJour(I.jourEtDate(new Date(j + "T12:00:00")));
  function quandChgOffre(c, d) {
    let q = null; try { q = JSON.parse(localStorage.getItem(cleChgOffre(c)) || "null"); } catch (er) { q = null; }
    if (!q || q.demande !== String(d)) q = { jour: jourRappelDe(c, d), creneau: "9-18", telephone: null };
    return { quand: minJour(I.jourEtDate(new Date(q.jour + "T12:00:00"))), plage: q.creneau === "15-17" ? "15-17" : "9-18", tel: q.telephone ? window.RENOM_WHATSAPP.lisible(q.telephone) : "" };
  }
  const formChgOffre = (c, suiv, nom) => { const auj = jourParis(Date.now()), jr = M.joursRappelA(Date.now(), c && c.pays), tel = telRetenue(c);
    return `<form id="chg-f" class="pile serre" novalidate data-offre="${e(suiv)}"><p class="fort">${t("avis.rappel.titre")}</p>
      <div class="f"><label for="chg-tel">${t("avis.rappel.tel")}</label><input id="chg-tel" type="tel" inputmode="tel" autocomplete="tel" maxlength="24" value="${e(tel ? window.RENOM_WHATSAPP.lisible(tel) : "")}" placeholder="${e(exNum(c))}" aria-describedby="chg-aide"><p class="aide" id="chg-aide">${t("rappel.aide", numParams(c))}</p></div>
      ${D.preciserRappel ? `<fieldset><legend>${t("avis.rappel.quand")}</legend>
        ${radiosJours("chg-jour", jr, auj)}</fieldset>
      <fieldset><legend>${t("avis.rappel.heure")}</legend>
        <label class="option"><input type="radio" name="chg-plage" value="" checked><span>${t("avis.rappel.plage.journee")}</span></label>
        <label class="option"><input type="radio" name="chg-plage" value="_15_17"><span>${t(c && c.metier === "restaurant" ? "avis.rappel.plage.service" : "avis.rappel.plage.1517")}</span></label></fieldset>` : ""}
      <div class="actions actions-abo"><button type="submit" class="bouton" id="offre-demander" data-offre="${e(suiv)}">${t("offre.dessus.passer.en", { nom })}</button></div>
      <p class="msg" id="msg-chg" role="status"></p><p class="note" id="dessus-note">${t("offre.dessus.demande.note")}</p></form>`; };
  async function offre() {
    const [k, j, c, ab, g, cmds] = await Promise.all([D.compteur(), D.journal(), D.commerce(), D.abonnement ? D.abonnement().catch(() => null) : null, D.maGarantieDelais ? D.maGarantieDelais().catch(() => null) : null,
      D.mesCommandesOptions ? D.mesCommandesOptions().catch(() => []) : []]);
    demandeChgOffre = D.demandeRappel ? await D.demandeRappel("changement_offre").catch(() => null) : null;
    const o = window.RENOM_OFFRES[k.offre] || {}, mois = new Date(k.mois + "T12:00:00"), mer = COND.mise_en_route;
    const gd = COND.garantie_delais, reseaux = window.RENOM_RESEAUX_AUTORISES(c), sociaux = reseaux.filter(r => r !== "google");
    // Abonnement Stripe : état écrit par le webhook (table abonnements) ; boutons seulement si les liens sont configurés (config.js, stripe).
    const portail = ab && ab.statut !== "resilie", lien = D.lienAbonnement ? D.lienAbonnement(ab, c, k.offre, null, "mensuel") : null, lienA = !portail && D.lienAbonnement ? D.lienAbonnement(ab, c, k.offre, null, "annuel") : null;
    // Formule annuelle (16/10/2026) : prix de base = prix par mois en paiement annuel ; économie EXACTE affichée (12 x (mensuel - base)), jamais un pourcentage arrondi à 20.
    const gainAn = o.prix_mensuel_ht && o.prix_ht ? 12 * (o.prix_mensuel_ht - o.prix_ht) : 0;
    const contenus = o.contenus ?? ((+k.publications_plafond || 0) + (+k.videos_plafond || 0));
    // Ordre (27/10/2026, écran trop long sur téléphone) : ce mois-ci, puis l'offre du dessus et son bouton (ou ce que Premium apporte), puis le détail ;
    // règle de publication, parcours, plafond et historique repliés (tout le texte reste dans la page, rien de contractuel n'est retiré).
    const repli = (id, titre, corps) => `<details class="repliable" id="${id}-repli"><summary><h2>${titre}</h2></summary><div id="${id}">${corps}</div></details>`;
    const baisse = ORDRE_OFFRES.indexOf(c.offre_id) > 0;
    vue.innerHTML = `${pauseBandeau(c)}${retourOrigine()}${entete(t("offre.sur"), t("offre.titre.nom", { nom: e(k.offre || k.offre_nom) }))}
        <section class="carte" id="offre-mois"><div class="carte-tete"><h2>${t("ce.mois")}</h2><span class="note">${cap(MOIS[mois.getMonth()])} ${mois.getFullYear()}</span></div>
          ${/* Compteur de l'offre (01/11/2026, tour 7 Premium) : comme Photos, publications faites + photos en préparation (pubReservees), « dont N en préparation ». */ ""}
          ${mesure(t("offre.pub.reservees"), pubReservees(k), k.publications_plafond, "plafond.phrase")}${+k.publications_preparation > 0 ? `<p class="note" id="offre-preparation">${t("offre.pub.preparation", { n: +k.publications_preparation })}</p>` : ""}
          ${k.videos_plafond ? mesure(t("offre.vid.utilisees"), k.videos_utilisees, k.videos_plafond) : o.reseaux_sociaux === false ? "" : `<div class="mesure-tete"><span>${t("mes.videos")}</span><span class="note">${t("non.comprises.offre")}</span></div>`}
          ${o.reseaux_sociaux === false || !o.commentaires_disponible ? "" /* Essentiel (26/10/2026) : ni vidéos ni commentaires de réseaux à compter ; 30/10/2026 : compteur masqué tant que offres.json dit commentaires_disponible faux (aucun « bientôt » à l'écran) */ : `<div class="mesure-tete" id="offre-commentaires"><span>${t("offre.rep.commentaires")}</span>${k.commentaires_inclus ? `<span>${t("offre.cm.sans.plafond", { n: `<span class="chiffre">${nombre(+k.commentaires_repondus || 0)}</span>` })}</span>` : `<span class="note">${t("non.comprises.offre")}</span>`}</div>`}
          <p class="note pied">${t("offre.compteur.debut")}</p></section>
      ${o.delegation ? offreDessus(c, o, ab, (/dessus=(\w+)/.exec(paramRoute) || [])[1]) : ""}
        <section class="carte" id="offre-inclus"><h2>${t("offre.inclus")}</h2><ul class="liste">
          <li id="offre-contenus"><span>${t("offre.inc.contenus")}</span><span class="fort">${o.videos ? t("offre.contenus.dont.videos", { n: contenus, p: o.publications || contenus - o.videos, v: o.videos }) : t("offre.contenus.n", { n: contenus })}</span></li>
          <li id="offre-reseaux"><span>${t("offre.inc.reseaux")}</span><span class="fort">${sociaux.length ? [...sociaux, "google"].map(r => RES[r]).join(", ") : t("offre.reseaux.google.seul")}</span></li>
          <li><span>${t("offre.inc.avis")}</span><span class="fort">${t("comprises")}</span></li>
          <li><span>${t(o.delegation ? "offre.inc.bilan.premium" : "offre.inc.bilan")}</span><span class="fort">${t("compris")}</span></li></ul>
          <p class="note pied">${t(o.reseaux_sociaux === false ? "offre.contenus.unite.google" : "offre.contenus.unite")} ${t("offre.idees.compte")}</p></section>
      ${/* Tour 9 (01/11/2026) : « Prix de votre offre » au même rythme que la montée d'offre (RENOM_RYTHME_MONTEE : celui de l'abonnement en cours,
          mensuel s'il est inconnu) ; avant, 79 € « payé à l'année » ici et 95 € par mois dans « Passer à Croissance », sur le même écran. */ ""}
      ${o.prix_ht ? `<section class="carte" id="offre-prix"><h2>${t("offre.prix.titre")}</h2>${window.RENOM_RYTHME_MONTEE(ab) === "mensuel" && o.prix_mensuel_ht
          ? `<p class="prix-offre" id="offre-prix-vous" data-rythme="mensuel"><span class="chiffre">${euros(o.prix_mensuel_ht)}</span> ${t("offre.ht.mois.mensuel")}</p>` : `<p class="prix-offre" id="offre-prix-vous" data-rythme="annuel"><span class="chiffre">${euros(o.prix_ht)}</span> ${t("offre.ht.mois.annuel")}</p>`}
        ${PRIX_LANCEMENT.includes(c.offre_id) ? `<p class="note" id="offre-lancement">${t("offre.lancement")}</p>` : ""}
        ${ab && ab.statut !== "resilie" && ab.rythme ? `<p class="note" id="offre-votre-rythme">${t("offre.votre.rythme." + (ab.rythme === "mensuel" ? "mensuel" : "annuel"))}</p>` : ""}
        ${/* Tour 9 : prix du haut au mois, l'annuel dit comme l'autre choix (« Ou 79 € HT par mois en paiement annuel, soit 948 € HT par an… »). */ ""}
        <p class="texte2 lecture" id="offre-annuel">${window.RENOM_RYTHME_MONTEE(ab) === "mensuel" && o.prix_mensuel_ht ? t("offre.annuel.ou", { prix: euros(o.prix_ht), total: euros(o.prix_annuel_ht), gain: euros(gainAn) }) : t("offre.annuel", { total: euros(o.prix_annuel_ht), gain: euros(gainAn) })}</p>
        <p class="texte2 lecture" id="offre-mensuel">${t("offre.mensuel", { prix: euros(o.prix_mensuel_ht) })}</p>
        ${/* Tour 11 (v37) : abonnement en cours (actif, ou impayé à régulariser) sur une offre qui comprend la mise en route : elle est faite, plus de
            « Frais de mise en route : 190 € HT » à un client qui paie déjà. */ ""}
        <p class="texte2 lecture" id="offre-frais">${!o.frais_mise_en_route ? t("offre.frais.aucun") : ab && ["actif", "impaye"].includes(ab.statut) ? t("offre.frais.deja.faite") : t("offre.frais.regle", { prix: euros(mer.prix_ht) })}</p>
        <p class="note">${t("offre.sans.engagement")} ${t("offre.cgv")}</p></section>` : o.retiree ? `<section class="carte" id="offre-prix"><h2>${t("offre.prix.titre")}</h2><p class="texte2 lecture">${t("offre.retiree")}</p></section>` : ""}
      ${o.delegation ? "" : (() => { const h = offreDessus(c, o, ab, (/dessus=(\w+)/.exec(paramRoute) || [])[1]), suiv = offreCible(c, (/dessus=(\w+)/.exec(paramRoute) || [])[1]), s_ = (window.RENOM_OFFRES || {})[suiv];
        return h && s_ ? `<details class="repliable carte" id="offre-dessus-repli"${/dessus/.test(paramRoute) || demandeChgOffre ? " open" : ""}><summary><span class="fort">${t("offre.dessus.ligne", { nom: e(I.offre(suiv)), n: s_.contenus, prix: euros(window.RENOM_PRIX_MONTEE(o, s_, ab).cible) })}</span></summary>${h}</details>` : ""; })()}
      <section class="carte" id="offre-garanties"><h2>${t("offre.garanties.titre")}</h2>
        <ul class="liste-engagements"><li><p class="fort">${t("offre.garantie.fiche", { n: gd.fiche_optimisee_jours })}</p></li>
          ${o.reseaux_sociaux ? `<li><p class="fort">${t("offre.garantie.contenu", { n: gd.premier_contenu_heures })}</p></li>` : ""}
          <li><p class="fort">${t("offre.garantie.avis24", { n: gd.avis_traite_heures })}</p></li>
          <li><p class="note">${t(o.reseaux_sociaux === false ? "offre.garantie.contrepartie.google" : "offre.garantie.contrepartie")}</p></li></ul>
        ${suiviDelais(g, o.reseaux_sociaux === false)}</section>
      ${optionsCommandees(cmds)}
      <section class="carte" id="offre-abonnement"><div class="carte-tete"><h2>${t("abo.titre")}</h2>${ab ? `<span class="etat${ab.statut === "actif" ? " actif" : ""}" id="abo-statut">${ST_ABO[ab.statut] || e(ab.statut)}</span>` : ""}</div>
        <p class="texte2 lecture">${ab ? t("abo.texte." + ab.statut) : t("abo.aucun")}</p>
        ${lien ? `<p class="pied actions-abo"><a class="bouton${lienA ? " second" : ""}" id="offre-payer" href="${e(lien)}" target="_blank" rel="noopener">${t(portail ? "abo.bouton.portail" : "abo.bouton.mensuel")}</a>${lienA ? `<a class="bouton" id="offre-payer-annuel" href="${e(lienA)}" target="_blank" rel="noopener">${t("abo.bouton.annuel", { gain: euros(gainAn) })}</a>` : ""}</p><p class="note">${t(portail ? "abo.note.portail" : "abo.note.paiement")}</p>`
          : D.mode === "demo" ? `<p class="note">${t("abo.demo")}</p><p class="note" id="abo-sans-lien">${t("abo.sans.lien")}</p>` : `<p class="note" id="abo-sans-lien">${t("abo.sans.lien")}</p>`}
        ${baisse ? `<p class="note" id="offre-baisse">${t("offre.baisse")}</p>` : ""}</section>
      <section class="carte replis" id="offre-plus">${repli("offre-regle", t("offre.regle.titre"), `${regleAvisBlocs(c)}
        <p class="texte2 lecture" id="offre-regle-contenus">${t(delegationActive(c) ? "offre.regle.contenus.delegation" : o.delegation ? "offre.regle.contenus.delegation.option" : "offre.regle.contenus", { h: COND.delegation.publication_auto_heures })}</p>`)}
      ${repli("offre-processus", t("offre.processus.titre"), `<ol class="etapes-offre">${[1, 2, 3].map(n => `<li>${t("offre.processus." + n + (n === 1 && o.reseaux_sociaux === false ? ".google" : ""))}</li>`).join("")}</ol>`)}
      ${/* Renvoi au bouton « Passer à … » seulement si ce bouton existe (lien Stripe configuré, 01/11/2026, tour 6 Essentiel). */ ""}
      ${repli("offre-plafond", t("offre.plafond.titre"), `<p class="texte2 lecture">${t("offre.plafond.texte", { mois: (new Date().getMonth() + 1) % 12 })}${offreCible(c) && D.lienMonteeOffre && D.lienMonteeOffre(ab, c, offreCible(c)) ? " " + t("offre.plafond.dessus", { nom: e(I.offre(offreCible(c))) }) : ""}</p>`)}
      ${repli("offre-historique", t("offre.historique"), j.length ? `<ul class="liste">${j.slice(0, 12).map(x => `<li><span>${e(ETAPES[x.type] || t("etape.autre"))}${x.detail && x.detail.raison ? `<span class="note">${t("deux.points")}${e(ph(x.detail.raison))}</span>` : ""}</span><span class="note">${cap(date(x.cree_le))}</span></li>`).join("")}</ul>` : `<p class="texte2">${t("offre.aucune.etape")}</p>`)}</section>`;
    if (/dessus/.test(paramRoute) && $("offre-dessus")) $("offre-dessus").scrollIntoView({ block: "start" });
    // Paiement en euros (02/11/2026) : « Payer au mois / à l'année » sans abonnement en cours et « Passer à <offre> » sans abonnement demandent une
    // session Checkout en euros (D.sessionPaiement : jeton de la base puis webhook n8n renom-checkout), puis y vont. REPLI, comme site/app.js : pas de
    // réponse en 8 s, refus ou réseau coupé -> le lien de paiement du bouton ; clic avec Ctrl, Cmd, Maj ou molette : le lien tel quel, dans un onglet.
    // Démonstration (pas de D.sessionPaiement) et portail client (adresse billing.stripe.com, non reconnue par D.demandeDeLien) : rien ne change.
    ["offre-payer", "offre-payer-annuel", "offre-passer"].forEach(id => { const a = $(id), d = a && D.sessionPaiement && D.demandeDeLien ? D.demandeDeLien(a.getAttribute("href")) : null;
      if (!d) return;
      a.addEventListener("click", ev => {
        if (ev.defaultPrevented || ev.button > 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
        ev.preventDefault(); if (a.getAttribute("aria-busy") === "true") return;
        const html = a.innerHTML, lien = a.href; a.setAttribute("aria-busy", "true"); a.setAttribute("aria-disabled", "true"); a.textContent = t("pub.chargement").replace(/\.$/, "…");
        let fini = false; const aller = u => { if (fini) return; fini = true; location.href = u; };
        Promise.race([D.sessionPaiement(c, d), new Promise((_, ko) => setTimeout(() => ko(new Error("délai")), 8000))]).then(aller, () => aller(lien));
        window.addEventListener("pageshow", () => { a.removeAttribute("aria-busy"); a.removeAttribute("aria-disabled"); a.innerHTML = html; fini = false; }, { once: true });
      });
    });
    if ($("chg-f")) $("chg-f").onsubmit = async ev => { ev.preventDefault(); const b = $("offre-demander"), m = $("msg-chg"); b.disabled = true;
      // Tour 7 Essentiel (01/11/2026) : le bloc replié s'ouvre dès qu'une demande existe (avant : seulement avec « ?dessus » dans l'adresse, donc la
      // confirmation restait cachée dans un bloc fermé) ; un toast le dit aussi. Tour 9 : numéro obligatoire, comme « Attendez mon appel ».
      const saisi = $("chg-tel").value.trim(), num = saisi && window.RENOM_WHATSAPP.numero(saisi, M.paysDe(c.pays));
      if (!saisi || !num) { b.disabled = false; m.textContent = saisi ? t("chg.tel.invalide", numParams(c)) : t("avis.rappel.tel.vide"); $("chg-tel").focus(); return; }
      try { const r = await D.demanderRappel("changement_offre", num, b.dataset.offre); demandeChgOffre = (r && r.cree_le) || new Date().toISOString();
        const jv = (vue.querySelector("input[name=chg-jour]:checked") || {}).value, pv = (vue.querySelector("input[name=chg-plage]:checked") || {}).value || "";
        const q = jv && D.preciserRappel ? await D.preciserRappel("changement_offre", jv + pv).catch(() => null) : null;
        try { localStorage.setItem(cleChgOffre(c), JSON.stringify({ demande: String(demandeChgOffre), jour: q && q.jour ? String(q.jour).slice(0, 10) : M.joursRappelA(Date.now(), c.pays)[jv === "demain" ? "demain" : "aujourdhui"], creneau: (q && q.creneau) || (pv ? "15-17" : "9-18"), telephone: (r && r.telephone) || num })); } catch (er) {}
        await offre(); const z = $("offre-demande-envoyee"); if (z) z.scrollIntoView({ block: "center" }); toast(t("offre.dessus.demande.toast", quandChgOffre(c, demandeChgOffre))); }
      catch (er) { b.disabled = false; if (m) m.textContent = ph(er.message); } };
    // Mode délégation (Premium) : activé ou désactivé par le commerçant ; l'écran est relu (règle de publication, historique).
    const deleg = async (oui, b) => { b.disabled = true; try { await D.reglerDelegation(oui); await offre(); const m = $("msg-deleg"); if (m) m.textContent = t(oui ? "offre.deleg.ok.active" : "offre.deleg.ok.inactive"); }
      catch (er) { b.disabled = false; const m = $("msg-deleg"); if (m) m.textContent = ph(er.message); } };
    if ($("delegation-activer-btn")) $("delegation-activer-btn").onclick = () => deleg(true, $("delegation-activer-btn"));
    if ($("delegation-desactiver")) $("delegation-desactiver").onclick = () => deleg(false, $("delegation-desactiver"));
  }

  // ---------------- Résultats : ce que BoostImpact rapporte, mois par mois. Aucun chiffre inventé : la portée attend les statistiques des réseaux.
  const pctTaux = x => x == null ? null : Math.round(+x <= 1 ? +x * 100 : +x);   // la base peut rendre une proportion (0 à 1) ou un pourcentage
  const delaiTexte = h => h == null ? t("delai.aucun.periode") : +h < 1 ? t("delai.moins.heure") : +h < 48 ? t("delai.h", { n: nombre(Math.round(+h)) }) : t("delai.jours", { n: nombre(Math.round(+h / 24)) });
  const NOMS_PILIERS = I.carte("pilier", ["profil", "categories", "photos", "avis", "engagement"]);
  // Libellé d'un pilier : traduit d'après sa clé quand elle est connue, sinon le nom donné par la base.
  const nomPilier = (cle, nom) => NOMS_PILIERS[cle] || nom || cle;
  const piliersDe = p => Array.isArray(p) ? p.map(x => ({ nom: nomPilier(x.cle, x.nom), note: +x.note || 0, sur: +x.sur || 20 }))
    : p && typeof p === "object" ? Object.entries(p).map(([k, v]) => v && typeof v === "object" ? { nom: nomPilier(k, v.nom), note: +v.note || 0, sur: +v.sur || 20 } : { nom: nomPilier(k), note: +v || 0, sur: 20 }) : [];
  const moisLong = m => { const d = moisDe(m); return MOIS[d.getMonth()] + " " + d.getFullYear(); };
  const moisCourt = m => I.moisCourt(moisDe(m).getMonth());
  // Courbe simple : un trait de 2 px (SVG), des points et les libellés en HTML pour rester lisibles à toutes les largeurs.
  function courbe(pts, o) {
    const vals = pts.filter(p => p.v != null).map(p => p.v); if (!vals.length) return `<p class="texte2">${o.vide}</p>`;
    let lo = Math.min(...vals), hi = Math.max(...vals); const marge = Math.max((hi - lo) * 0.25, o.pas || 1); lo -= marge; hi += marge; if (o.min != null) lo = Math.max(o.min, lo);
    const X = i => pts.length === 1 ? 50 : 6 + i * 88 / (pts.length - 1), Y = v => 100 - (v - lo) / (hi - lo) * 100;
    const pleins = pts.map((p, i) => [p, i]).filter(([p]) => p.v != null), [premier, dernier] = [pleins[0], pleins[pleins.length - 1]];
    const etiquette = ([p, i], cote) => `<span class="c-val ${cote}" style="left:${X(i)}%;top:${Y(p.v)}%">${o.fmt(p.v)}</span>`;
    return `<figure class="courbe"><div class="c-zone" role="img" aria-label="${e(o.alt)}">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="100" y1="100" y2="100" class="c-base"></line><line x1="0" x2="100" y1="50" y2="50" class="c-grille"></line>
          <polyline points="${pleins.map(([p, i]) => X(i) + "," + Y(p.v)).join(" ")}" class="c-trait"></polyline></svg>
        ${pleins.map(([p, i]) => `<span class="c-point" style="left:${X(i)}%;top:${Y(p.v)}%" title="${e(p.lib + t("deux.points") + o.fmt(p.v))}"></span>`).join("")}
        ${etiquette(premier, "debut")}${dernier !== premier ? etiquette(dernier, "fin") : ""}</div>
      <div class="c-mois" aria-hidden="true">${pts.map((p, i) => `<span style="left:${X(i)}%">${p.court}</span>`).join("")}</div></figure>`;
  }
  // Google interdit à BoostImpact de garder note, nombre d'avis, noms et historique (ordres/BRANCHEMENT.md, « Conformité des résultats ») : ces chiffres
  // sont lus à l'ouverture de la page (lecture_google). La phrase dit ce qui a été lu, ou pourquoi rien ne l'a été.
  function lectureTexte(lg) {
    if (!lg || lg.statut === "non_demandee") return "";
    // Démonstration (01/11/2026, tour 8) : rien n'est lu sur Google ; jamais « Chiffres lus en direct sur Google » sous « Ces chiffres sont fictifs ».
    if (lg.demo || D.mode === "demo") return t("lecture.demo");
    if (lg.statut === "ok") return t("lecture.ok", { h: lg.le ? ` (${heure(lg.le)})` : "" });
    if (lg.statut === "limite") return t("lecture.limite");
    if (lg.statut === "non_branchee") return t("lecture.non.branchee");
    return t("lecture.echec");
  }
  // « Ce que votre fiche vous a rapporté » (01/11/2026, tour 8) : statistiques de la fiche Google lues à l'ouverture de Résultats (R.performance,
  // fusionner de moteur/resultats/lecture_google.js) : clics pour appeler, itinéraires, clics vers le site, vues ; le mois précédent complet en grand,
  // le mois en cours (jusqu'à aujourd'hui) dessous. Rien n'est gardé, sauf en mémoire le temps de la visite (rappel de l'accueil, perfVue).
  // Démonstration : chiffres fictifs, dits comme tels. Lecture sans statistiques (ancien workflow, plafond) : rien n'est affiché.
  let perfVue = null;
  const PERF_CLES = [["appels", "fiche.rap.appels"], ["itineraires", "fiche.rap.itineraires"], ["clics_site", "fiche.rap.site"], ["vues", "fiche.rap.vues"]];
  function blocFicheRapporte(R, lg) {
    const l = Array.isArray(R && R.performance) ? R.performance.filter(x => x && x.mois) : null, demo = D.mode === "demo" || !!lg.demo;
    if (!l && !lg.performance) return "";
    const tete = `<div class="carte-tete"><h2 id="r-fiche-rap">${t("fiche.rap.titre")}</h2>${demo ? `<span class="note">${t("demo.chiffres")}</span>` : ""}</div>`;
    if (!l || !l.length) return `<section class="carte" id="fiche-rapporte" aria-labelledby="r-fiche-rap">${tete}<p class="texte2">${t(lg.performance === "non_reliee" ? "fiche.rap.non.reliee" : "fiche.rap.erreur")}</p></section>`;
    const auj = new Date(), m1 = auj.getFullYear() + "-" + String(auj.getMonth() + 1).padStart(2, "0") + "-01", prec = l.find(x => x.mois < m1), cour = l.find(x => x.mois === m1);
    const grand = prec || cour, petit = prec ? cour : null, nomM = x => MOIS[moisDe(x.mois).getMonth()], jusqua = auj.getDate() === 1 ? "1er" : String(auj.getDate());
    const periode = prec && cour ? t("fiche.rap.periode", { a: nomM(prec), b: nomM(cour), j: jusqua }) : t("fiche.rap.periode.seul", { a: nomM(grand), j: grand === cour ? jusqua : "" });
    perfVue = { mois: grand.mois, appels: +grand.appels || 0, itineraires: +grand.itineraires || 0, vues: +grand.vues || 0, demo };
    const chiffre = ([k, lib]) => `<div class="bilan-chiffre" data-perf="${k}"><dt>${t(lib)}</dt><dd class="chiffre">${nombre(+grand[k] || 0)}${petit ? `<span class="note">${t("fiche.rap.courant", { mois: nomM(petit), j: jusqua, n: nombre(+petit[k] || 0) })}</span>` : ""}</dd></div>`;
    return `<section class="carte" id="fiche-rapporte" aria-labelledby="r-fiche-rap">${tete}<p class="note" id="fiche-rap-periode">${periode}</p>
      <dl class="bilan-chiffres">${PERF_CLES.map(chiffre).join("")}</dl>
      <p class="note" id="fiche-rap-note">${t("fiche.rap.note")}</p>${demo ? `<p class="note" id="fiche-rap-demo">${t("fiche.rap.demo")}</p>` : ""}</section>`;
  }
  // Rappel sur l'accueil (tour 8) : les chiffres du mois écoulé s'ils ont été lus pendant cette visite (ou en démonstration, fictifs) ; sinon un lien
  // vers Résultats. Aucune lecture de Google n'est faite depuis l'accueil (chaque lecture est plafonnée et coûte).
  async function ligneFicheAccueil(c, mr) {
    const g = ((mr && mr.points) || []).find(x => x.point === "google"); if (g && g.etat !== "fait") return "";
    if (D.mode === "demo" && !perfVue) { try { const R = await D.resultats(6); blocFicheRapporte(R, (R && R.lecture_google) || {}); } catch (er) {} }
    const lien = `<a href="#/resultats" id="acc-fiche-lien">${t(perfVue ? "fiche.rap.acc.detail" : "fiche.rap.acc.lien")}</a>`;
    if (!perfVue) return `<p class="texte2" id="acc-fiche-google">${t("fiche.rap.acc.sans")} ${lien}</p>`;
    return `<p class="texte2" id="acc-fiche-google">${t("fiche.rap.acc", { demo: perfVue.demo, mois: MOIS[moisDe(perfVue.mois).getMonth()], a: nombre(perfVue.appels), i: nombre(perfVue.itineraires), v: nombre(perfVue.vues) })} ${lien}</p>`;
  }
  // Point de départ (27/10/2026, constat 8) : tant que l'accès à la fiche Google n'est pas en place, un seul écran avec ce qui est connu (note, nombre d'avis,
  // score de l'audit) et ce qui manque pour avoir les premiers chiffres ; jamais une page de zéros.
  const ETAPES_DEPART = ["google", "metricool", "demarrage"];
  function pointDeDepart(c, R, mr) {
    const mois = (R && R.mois) || [], avecNote = mois.filter(m => m.note != null), dern = avecNote[avecNote.length - 1], audit = ((R && R.audit) || []).filter(a => a && a.score != null), aud = audit[0];
    const chiffre = (lib, val, id) => `<div class="bilan-chiffre"><dt>${lib}</dt><dd class="chiffre" id="${id}">${val}</dd></div>`;
    const connus = [dern ? chiffre(t("bilan.note"), nombre(dern.note, 1), "depart-note") : "", dern && dern.nb_avis != null ? chiffre(t("res.nb.avis"), nombre(dern.nb_avis), "depart-avis") : "",
      aud ? chiffre(t("res.depart.score"), t("res.depart.score.val", { n: nombre(+aud.score) }), "depart-score") : ""].filter(Boolean);
    const manque = ((mr && mr.points) || []).filter(x => x.etat !== "fait" && ETAPES_DEPART.includes(x.point)).map(x => t("res.depart.etape." + (x.point === "google" && ficheDemandee(c) ? "fiche" : x.point)));
    const lecture = lectureTexte((R && R.lecture_google) || {});
    vue.innerHTML = `${entete(t("groupe.resultats"), t("res.depart.titre"), t("res.depart.chapo"))}
      <section class="carte" id="point-depart" aria-labelledby="depart-titre"><h2 id="depart-titre">${t("res.depart.aujourdhui")}</h2>
        ${connus.length ? `<dl class="bilan-chiffres">${connus.join("")}</dl>` : `<p class="texte2" id="depart-inconnu">${t("res.depart.inconnu")}</p>`}
        ${manque.length ? `<p class="texte2" id="depart-attente">${t("res.depart.attente", { l: I.liste(manque) })}</p>` : ""}
        <p class="pied"><a class="bouton" href="#/miseenroute" id="depart-mer">${t("res.depart.bouton")}</a></p></section>
      ${lecture && connus.length ? `<p class="note lecture-google" id="lecture-google">${e(lecture)}</p>` : ""}`;
  }
  // « Vos réseaux ce mois-ci » (31/10/2026, test client) : par réseau de l'offre, les publications parties et programmées ce mois-ci, lues dans le
  // calendrier (rien d'inventé). Tour 9 (01/11/2026) : plus de promesse « Statistiques (vues, abonnés) : bientôt » ; à la place, ce qui existe
  // vraiment pour le mois : les réponses publiées à vos commentaires (table commentaires, statut « publie », répondues ce mois-ci), par réseau.
  // Vues et abonnés : la base ne les lit pas, donc rien n'est affiché.
  function blocReseauxMois(c, cal, cms, cpt) {
    // 31/10/2026 (test client Croissance) : mois en heure locale (plus en UTC) ; « À venir » = toutes les publications programmées futures,
    // y compris celles du mois prochain (avant, une publication du 2 novembre n'apparaissait nulle part le 31 octobre).
    const res = ORDRE_RES.filter(r => window.RENOM_RESEAUX_AUTORISES(c).includes(r)), auj = new Date(), maintenant = auj.getTime();
    const duMois = x => { const d = new Date(x.prevu_le || 0); return d.getFullYear() === auj.getFullYear() && d.getMonth() === auj.getMonth(); };
    const n = (r, st) => cal.filter(x => (st === "programme" ? Date.parse(x.prevu_le) >= maintenant : duMois(x)) && x.statut === st && (x.reseaux || []).includes(r)).length, sociaux = res.filter(r => r !== "google");
    // Tour 10 (v36) : un réseau non connecté (comptes lus, état autre que « connecte ») et sans rien ce mois-ci n'affiche plus « 0 / 0 » mais
    // « Non connecté » (« Activation demandée » pour TikTok déjà demandé). Comptes illisibles : les chiffres, comme avant.
    const connectes = cpt ? cpt.filter(x => x.etat === "connecte").map(x => x.reseau) : null;
    const ligne = r => connectes && !connectes.includes(r) && !n(r, "publie") && !n(r, "programme")
      ? `<td data-l="${t("res.reseaux.etat")}" colspan="2" class="note" data-non-connecte>${t(r === "tiktok" && tiktokDemande(c) ? "res.reseaux.tiktok.demande" : r === "google" ? "res.reseaux.non.connectee" : "res.reseaux.non.connecte")}</td>`
      : `<td data-l="${t("res.reseaux.parties")}">${nombre(n(r, "publie"))}</td><td data-l="${t("res.reseaux.programmees")}">${nombre(n(r, "programme"))}</td>`;
    return `<section class="carte" id="reseaux-mois" aria-labelledby="r-reseaux"><h2 id="r-reseaux">${t(sociaux.length ? "res.reseaux.titre" : "res.reseaux.titre.google")}</h2>
      <table class="tab compact"><thead><tr><th>${t("res.reseaux.col")}</th><th>${t("res.reseaux.parties")}</th><th>${t("res.reseaux.programmees")}</th></tr></thead><tbody>
      ${res.map(r => `<tr data-reseau="${r}"><td data-l="${t("res.reseaux.col")}">${RES[r]}</td>${ligne(r)}</tr>`).join("")}</tbody></table>
      ${sociaux.length && offreDe(c).commentaires ? (() => { const rep = (cms || []).filter(x => x.statut === "publie" && duMoisCm(x)), parRes = ORDRE_RES.map(r => [r, rep.filter(x => x.reseau === r).length]).filter(([, k]) => k);
        return `<p class="texte2" id="reseaux-commentaires">${t("res.reseaux.cm", { n: rep.length, l: parRes.length ? I.liste(parRes.map(([r, k]) => RES[r] + " " + nombre(k))) : "" })}</p>`; })() : ""}</section>`;
  }
  // Réponse à un commentaire publiée ce mois-ci (heure locale) : date de la réponse, sinon de la décision.
  const duMoisCm = x => { const d = new Date(x.repondu_le || x.decide_le || x.cree_le || 0), a = new Date(); return d.getFullYear() === a.getFullYear() && d.getMonth() === a.getMonth(); };
  // Bilan du mois écoulé (01/11/2026, tour 6 Premium) : du 1er au 5 du mois, en tête de Résultats, les chiffres du mois précédent (bilan_mois, même
  // fonction que l'email du 1er) et « En parler avec <contact> » sur WhatsApp. Aucun commentaire écrit à la main n'existe en base : rien n'est inventé.
  // L'email (n8n/renom-bilan-mensuel.json, le 1er à 9 h, heure de Paris) part aux commerces qui le reçoivent (notifications.email, adresse valide,
  // client depuis 14 jours au moins) : la ligne qui l'annonce n'est écrite que dans ce cas. Ce bilan est automatique (chiffres, thèmes, pistes) :
  // il n'est pas présenté comme « commenté ».
  const moisPrecedentIso = () => { const d = new Date(); const p = new Date(d.getFullYear(), d.getMonth() - 1, 1); return p.getFullYear() + "-" + String(p.getMonth() + 1).padStart(2, "0") + "-01"; };
  const recoitBilanEmail = c => !!c && (c.notifications || {}).email !== false && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email_validation || "")
    && Date.parse(c.cree_le || 0) <= Date.now() - 14 * 86400e3;
  function bilanPrecedentBloc(b, c, contact) {
    // Toutes les offres (01/11/2026, tour 7 Croissance ; la vague 13 l'avait fait pour Premium) : du 1er au 5, le mois précédent complet d'abord,
    // puis le mois en cours (bilanBloc). « En parler avec … » reste au point mensuel de Premium (delegation).
    if (!b) return ""; const premium = !!offreDe(c).delegation;
    const m = moisDe(b.mois), n = x => +x || 0, k = contactDe(contact), nomMois = MOIS[m.getMonth()], notes = b.note_debut != null && b.note_fin != null;   // 2 ou 4 chiffres (grille de 2)
    const chiffre = (lib, val, id) => `<div class="bilan-chiffre"><dt>${lib}</dt><dd class="chiffre" id="${id}">${val}</dd></div>`;
    const wa = lienWa(k.telephone) + "?text=" + encodeURIComponent(t("bilan.prec.message", { mois: nomMois, nom: c.nom || "" }));
    return `<section class="carte bilan" id="bilan-precedent" aria-labelledby="bilan-prec-titre"><div class="carte-tete"><h2 id="bilan-prec-titre">${t("bilan.prec.titre", { mois: nomMois })}</h2></div>
      <p class="texte2">${t("bilan.publie", { r: n(b.reponses_publiees), p: n(b.publications) })} ${t(b.avis_obtenus_source === "avis_recus" ? "bilan.recu" : "bilan.obtenu", { n: n(b.avis_obtenus) })}${notes ? (b.note_fin === b.note_debut ? t("bilan.note.reste", { n: nombre(b.note_fin, 1) }) : t("bilan.note.passe", { a: nombre(b.note_debut, 1), b: nombre(b.note_fin, 1) })) : "."}</p>
      <dl class="bilan-chiffres">${chiffre(t("bilan.reponses"), nombre(n(b.reponses_publiees)), "bilan-prec-reponses")}${chiffre(t("bilan.publications"), nombre(n(b.publications)), "bilan-prec-publications")}${notes ? chiffre(t("bilan.note"), nombre(b.note_fin, 1), "bilan-prec-note") + chiffre(t("bilan.avis"), nombre(n(b.avis_obtenus)), "bilan-prec-avis") : ""}</dl>
      ${recoitBilanEmail(c) ? `<p class="note" id="bilan-prec-email">${t("bilan.prec.email")}</p>` : ""}
      ${premium ? `<p class="pied"><a class="bouton second" id="bilan-prec-parler" href="${e(wa)}" target="_blank" rel="noopener">${t("bilan.prec.parler", { p: e(k.prenom || "") })}</a></p>` : ""}</section>`;
  }
  async function resultats() {
    const [c, R, bilan, mr, calR, NR, bilanP, contactR, nonLusR, cmsR, cptR] = await Promise.all([D.commerce(), D.resultats(6), D.bilanMois().catch(() => null), D.miseEnRoute().catch(() => null), D.calendrier().catch(() => []), compterAValider().catch(() => null),
      debutDeMoisCivil() ? D.bilanMois(moisPrecedentIso()).catch(() => null) : null, monContact(), retoursNonLusMois(), D.commentaires ? D.commentaires().catch(() => []) : [], D.comptes().catch(() => null)]), mois = (R && R.mois) || [], avecNote = mois.filter(m => m.note != null), lg = (R && R.lecture_google) || {};
    // Tant que BoostImpact n'a pas accès à la fiche Google (étape « google » de la mise en route), aucun chiffre ne peut arriver : le point de départ.
    const etapeGoogle = ((mr && mr.points) || []).find(x => x.point === "google");
    if (etapeGoogle && etapeGoogle.etat !== "fait") { pointDeDepart(c, R, mr); vue.insertAdjacentHTML("beforeend", blocReseauxMois(c, calR, cmsR, cptR)); return; }
    // Thèmes nommés en français par la démonstration (FAMILLES de donnees.js) : traduits dans la langue d'affichage ; ceux de Claude, tels quels.
    const THEMES_CONNUS = { "L'accueil et le service": "accueil", "Le matériel": "materiel", "Le parcours et les paysages": "parcours", "L'attente": "attente", "Les plats": "plats", "L'ambiance": "ambiance", "Les prix": "prix" };
    const prem = avecNote[0], dern = avecNote[avecNote.length - 1], rep = (R && R.reponses) || {}, audit = (R && R.audit) || [], conc = (R && R.concurrents) || [], themes = (R && R.themes) || [], col = (R && R.collecte) || {};
    const pts = k => mois.map(m => ({ v: m[k] == null ? null : +m[k], lib: moisLong(m.mois), court: moisCourt(m.mois) }));
    const periode = mois.length ? t("res.periode", { a: moisLong(mois[0].mois), b: moisLong(mois[mois.length - 1].mois) }) : "";
    const ecart = (a, b, d) => { const x = Math.round((b - a) * 10 ** d) / 10 ** d; return x > 0 ? "+" + nombre(x, d) : x < 0 ? "−" + nombre(-x, d) : t("res.stable"); };
    const taux = pctTaux(rep.taux), dernierAudit = audit[audit.length - 1];
    const maxTheme = Math.max(1, ...themes.map(x => (+x.positif || 0) + (+x.negatif || 0)));
    const actuelConc = x => (x.mois || [])[x.mois.length - 1] || {}, actuel = mois[mois.length - 1] || {}, enCours = dern && dern === actuel;
    const nonLu = t(lg.fiche === "non_reliee" ? "res.fiche.non.reliee" : "res.note.non.lue");
    const lecture = lectureTexte(lg), nonLue = t("non.lue"), nonLuM = t("non.lu");
    // Tour 12 (v38) : sur téléphone, le chapeau se réduit à la période (« De juin 2026 à novembre 2026. ») pour qu'une tuile chiffrée tienne au premier écran à 320 px.
    vue.innerHTML = `${entete(t("groupe.resultats"), t("res.titre"), `<span class="sur-ordi">${t("res.chapo") + (periode ? ", " + periode : "")}.</span>${periode ? `<span class="sur-tel res-periode">${cap(periode)}.</span>` : ""}`)}
      ${bandeauDemo()}
      ${bilanPrecedentBloc(bilanP, c, contactR)}
      ${/* Tour 9 (01/11/2026) : ce que la fiche a rapporté juste sous le bilan du mois écoulé, avant le mois en cours. */ ""}
      ${blocFicheRapporte(R, lg)}
      ${bilanBloc(bilan, NR)}
      ${blocReseauxMois(c, calR, cmsR, cptR)}
      <div class="rangee">
        <section class="carte moitie" aria-labelledby="r-note"><div class="carte-tete"><h2 id="r-note">${t("bilan.note")}</h2>${prem && dern && prem !== dern ? `<span class="note">${t("res.depuis", { x: ecart(+prem.note, +dern.note, 1), mois: MOIS[moisDe(prem.mois).getMonth()] })}</span>` : ""}</div>
          ${dern ? `<p><span class="chiffre grand-chiffre">${nombre(dern.note, 1)}</span> <span class="note">${t(enCours ? "res.sur5.auj" : "res.sur5.fin", { mois: moisLong(dern.mois) })}</span></p>` : ""}
          ${courbe(pts("note"), { fmt: v => nombre(v, 1), pas: 0.4, min: 1, alt: t("res.note.alt", { l: avecNote.map(m => moisLong(m.mois) + " " + nombre(m.note, 1)).join(", ") }), vide: nonLu })}
          ${lg.historique_reconstitue && avecNote.length > 1 ? `<p class="note" id="historique-note">${t("res.historique")}</p>` : ""}</section>
        <section class="carte moitie" aria-labelledby="r-nb"><div class="carte-tete"><h2 id="r-nb">${t("res.nb.avis")}</h2>${prem && dern && prem !== dern ? `<span class="note">${t("res.depuis", { x: ecart(+prem.nb_avis, +dern.nb_avis, 0), mois: MOIS[moisDe(prem.mois).getMonth()] })}</span>` : ""}</div>
          ${dern ? `<p><span class="chiffre grand-chiffre">${nombre(dern.nb_avis)}</span> <span class="note">${t("res.avis.total")}</span></p>` : ""}
          ${courbe(pts("nb_avis"), { fmt: v => nombre(v), pas: 2, min: 0, alt: t("res.nb.alt", { l: avecNote.map(m => moisLong(m.mois) + " " + nombre(m.nb_avis)).join(", ") }), vide: lg.fiche === "non_reliee" ? nonLu : t("res.nb.non.lu") })}</section>
      </div>
      ${avecNote.length ? `<details class="carte details-chiffres"><summary>${t("res.voir.chiffres")}</summary>
        <table class="tab compact"><thead><tr><th>${t("res.col.mois")}</th><th>${t("res.col.note")}</th><th>${t("res.col.total")}</th><th>${t("res.col.recus")}</th><th>${t("res.col.reponses")}</th><th>${t("res.col.delai")}</th><th>${t("res.col.publications")}</th></tr></thead><tbody>
        ${mois.map(m => `<tr><td data-l="${t("res.col.mois")}">${cap(moisLong(m.mois))}</td><td data-l="${t("res.col.note")}">${m.note == null ? nonLue : nombre(m.note, 1)}</td><td data-l="${t("res.col.total")}">${m.nb_avis == null ? nonLuM : nombre(m.nb_avis)}</td><td data-l="${t("res.col.recus")}">${nombre(+m.avis_recus || 0)}</td><td data-l="${t("res.l.reponses")}">${nombre(+m.reponses || 0)}</td><td data-l="${t("res.l.delai")}">${m.delai_moyen_h == null ? t("res.aucune.reponse") : delaiTexte(m.delai_moyen_h)}</td><td data-l="${t("res.col.publications")}">${nombre(+m.publications || 0)}</td></tr>`).join("")}</tbody></table></details>` : ""}
      <div class="rangee">
        <section class="carte etroite" aria-labelledby="r-rep"><h2 id="r-rep">${t("res.rep.titre")}</h2>
          ${taux == null ? `<p class="texte2">${t("res.rep.aucun")}</p>` : `<dl class="bilan-chiffres deux"><div class="bilan-chiffre"><dt>${t("res.taux")}</dt><dd class="chiffre" id="taux">${t("pourcent", { n: nombre(taux) })}</dd></div><div class="bilan-chiffre"><dt>${t("res.l.delai")}</dt><dd class="chiffre" id="delai">${delaiTexte(rep.delai_moyen_h)}</dd></div></dl>
          <p class="note">${t("res.rep.note", { n: mois.length })}</p>`}</section>
        <section class="carte large" aria-labelledby="r-audit"><div class="carte-tete"><h2 id="r-audit">${t("res.score.titre")}</h2><span class="note">${t("etat.actuel")}</span></div>
          ${dernierAudit ? `<p><span class="chiffre grand-chiffre chiffre-or" id="score-audit">${nombre(+dernierAudit.score)}</span> <span class="note">${t("res.score.sur")}</span></p>
          <div class="audit"><div class="pile serre piliers">${piliersDe(dernierAudit.piliers).map(p => mesure(e(p.nom), p.note, p.sur)).join("")}</div></div>
          <p class="note">${t("res.score.note")}</p>`
          : `<p class="texte2">${t(lg.score === "non_reliee" ? "res.score.non.reliee" : "res.score.non.calcule")}</p>`}</section>
      </div>
      <section class="carte" aria-labelledby="r-conc"><div class="carte-tete"><h2 id="r-conc">${t("res.conc.titre")}</h2><span class="note">${t("etat.actuel")}</span></div>
        ${conc.length ? `<p class="note" id="conc-mention">${t("res.conc.mention")}</p>
          <div class="defile"><table class="comparatif"><thead><tr><th>${t("res.col.commerce")}</th><th>${t("res.col.note")}</th><th>${t("res.col.avis")}</th></tr></thead><tbody>
          <tr class="vous"><td data-l="${t("res.col.commerce")}"><span class="fort">${e(c.nom)}</span> ${t("res.vous")}</td><td data-l="${t("res.col.note")}">${actuel.note == null ? nonLue : nombre(actuel.note, 1)}</td><td data-l="${t("res.col.avis")}">${actuel.nb_avis == null ? nonLuM : nombre(actuel.nb_avis)}</td></tr>
          ${conc.map(x => { const b = actuelConc(x); return `<tr><td data-l="${t("res.col.commerce")}">${e(x.nom)}</td><td data-l="${t("res.col.note")}">${b.note == null ? nonLue : nombre(b.note, 1)}</td><td data-l="${t("res.col.avis")}">${b.nb_avis == null ? nonLuM : nombre(b.nb_avis)}</td></tr>`; }).join("")}</tbody></table></div>`
        : `<p class="texte2">${t("res.conc.aucun")}</p>`}</section>
      <div class="rangee">
        <section class="carte moitie" aria-labelledby="r-themes"><h2 id="r-themes">${t("res.themes.titre")}</h2>
          ${themes.length ? `<ul class="liste themes">${themes.map(x => { const p = +x.positif || 0, n = +x.negatif || 0; return `<li><div class="theme">${THEMES_CONNUS[x.theme] ? `<p class="fort">${t("theme." + THEMES_CONNUS[x.theme])}</p>` : `<p class="fort"${lc()}>${e(x.theme)}</p>`}<div class="t-barre" aria-hidden="true">${p ? `<span class="t-pos" style="width:${p / maxTheme * 100}%"></span>` : ""}${n ? `<span class="t-neg" style="width:${n / maxTheme * 100}%"></span>` : ""}</div></div><p class="note t-compte">${t("res.themes.compte", { p, n })}</p></li>`; }).join("")}</ul>
          <p class="note">${t("res.themes.legende")}</p>` : `<p class="texte2">${t(lg.themes === "insuffisants" ? "res.themes.insuffisants" : "res.themes.aucun")}</p>`}
          <p class="note" id="themes-note">${t("res.themes.note", { n: lg.themes_avis ? ` (${t("res.n.avis", { n: lg.themes_avis })})` : "" })}</p></section>
        <section class="carte moitie" aria-labelledby="r-col"><div class="carte-tete"><h2 id="r-col">${t("res.collecte.titre")}</h2><a href="#/collecte">${t("res.collecte.ouvrir")}</a></div>${chiffresCollecte(col, true, nonLusR)}
          <p class="note">${t("res.collecte.note")}</p></section>
      </div>
      ${resultatsDessus(c)}
      ${lecture ? `<p class="note lecture-google" id="lecture-google">${e(lecture)}</p>` : ""}`;
    // 27/10/2026 (constat 9) : la carte « Portée de vos publications » reviendra quand les statistiques des réseaux seront branchées.
  }
  // Essentiel (27/10/2026, audit du parcours, constat 22) : sous ses résultats, ce que Croissance ajouterait (mêmes lignes que l'écran Offre, chiffres de
  // moteur/offres.json) et le lien vers l'offre du dessus. Aucun chiffre de concurrent inventé : la base ne lit pas leurs réseaux.
  function resultatsDessus(c) {
    const suiv = sansReseaux(c) ? offreCible(c) : null, s_ = suiv && (window.RENOM_OFFRES || {})[suiv]; if (!s_) return "";
    const nom = e(I.offre(suiv));
    return `<section class="carte" id="resultats-dessus" aria-labelledby="r-dessus"><h2 id="r-dessus">${t("offre.dessus.titre", { nom })}</h2>
      <ul class="liste-engagements">${["offre.dessus.std.1", "offre.dessus.std.2"].map(k => `<li><p>${t(k, { n: s_.contenus })}</p></li>`).join("")}</ul>
      <p class="pied"><a class="bouton second" href="#/offre?dessus" id="resultats-passer">${t("offre.passer.lien", { nom })}</a></p></section>`;
  }

  // ---------------- Fiche Google : photos, offre, événement, horaires exceptionnels. Le commerçant valide, rien ne part seul.
  const TYPES_ACT = I.carte("act.type", ["photos", "offre", "evenement", "horaires"]);
  const ST_ACT = I.carte("act.st", ["a_valider", "a_publier", "publie", "refuse"]);
  let typeAction = "photos";
  // Ce que le commerçant envoie lui-même (audit Essentiel du 31/10/2026) : « Envoyé le… », pas « Préparé le… » (c'est BoostImpact qui prépare les
  // autres). La table actions_fiche ne dit pas qui a créé l'action : drapeau par_commerce en démonstration, sinon les envois retenus sur cet appareil.
  const cleActionsEnvoyees = "renom:actions-fiche-envoyees";
  const actionsEnvoyees = () => { try { return JSON.parse(localStorage.getItem(cleActionsEnvoyees) || "[]") || []; } catch (er) { return []; } };
  const retenirActionEnvoyee = id => { try { localStorage.setItem(cleActionsEnvoyees, JSON.stringify([String(id), ...actionsEnvoyees().filter(x => x !== String(id))].slice(0, 200))); } catch (er) {} };
  const parCommerce = a => !!a.par_commerce || actionsEnvoyees().includes(String(a.id));
  const jourTexte = j => cap(date(j + "T12:00:00"));
  const resumeAction = (a, ph_) => { const d = a.donnees || {};
    // Tour 8 (01/11/2026) : plus de nom de fichier ; le plat et le prix saisis à l'envoi, s'il y en a.
    if (a.type === "photos") { const noms = [...new Set((d.photos || []).map(id => String((ph_.find(p => p.id === id) || {}).precision || "").trim()).filter(Boolean))]; const n = (d.photos || []).length; return `${t("photos.n", { n })}${noms.length ? t("deux.points") + e(noms.join(", ")) : ""}`; }
    if (a.type === "horaires") return `${jourTexte(d.date)}${t("deux.points")}${d.ferme ? t("act.ferme.journee") : t("act.de.a", { a: hm(d.ouverture), b: hm(d.fermeture) })}`;
    return `<span${lc()}>${e(d.titre)}</span>${t("act.du.au", { a: date(d.debut + "T12:00:00"), b: date(d.fin + "T12:00:00") })}${d.conditions ? `${t("act.conditions")}<span${lc()}>${e(d.conditions)}</span>` : ""}`; };
  function champsAction(ph_) {
    const auj = M.aujourdhui(), dates = `<div class="champs deux"><div class="f"><label for="af-debut">${t("act.debut")}</label><input id="af-debut" type="date" min="${auj}" required></div><div class="f"><label for="af-fin">${t("act.fin")}</label><input id="af-fin" type="date" min="${auj}" required></div></div>`;
    const titre = lib => `<div class="f"><label for="af-titre">${lib}</label><input id="af-titre" type="text" maxlength="120" required></div>`;
    return { photos: ph_.length ? `<fieldset><legend>${t("act.photos.legend")}</legend>${ph_.slice(0, 12).map(p => `<label class="option"><input type="checkbox" name="af-photo" value="${e(p.id)}"><span class="casse">${t("act.photo.deposee", { nom: e(String(p.precision || "").trim() || t("photo")), d: date(p.cree_le) })}</span></label>`).join("")}</fieldset>`
        : `<p class="texte2">${t("act.aucune.photo")}</p>`,
      offre: titre(t("act.titre.offre")) + dates + `<div class="f"><label for="af-conditions">${t("act.conditions.lib")}</label><textarea id="af-conditions" maxlength="1500"></textarea><p class="aide">${t("act.conditions.aide")}</p></div>`,
      evenement: titre(t("act.titre.evenement")) + dates,
      horaires: `<div class="f"><label for="af-date">${t("cal.date")}</label><input id="af-date" type="date" min="${auj}" required></div>
        <label class="option"><input type="checkbox" id="af-ferme"><span>${t("act.ferme")}</span></label>
        <div class="champs deux" id="af-heures"><div class="f"><label for="af-ouverture">${t("act.ouverture")}</label><input id="af-ouverture" type="time"></div><div class="f"><label for="af-fermeture">${t("act.fermeture")}</label><input id="af-fermeture" type="time"></div></div>` }[typeAction];
  }
  async function ficheGoogle() {
    // Venue de l'idée « jour férié » (#/fichegoogle?horaires=AAAA-MM-JJ) : horaires choisis, date pré-remplie, retour vers l'accueil.
    const hj = (/(?:^|&)horaires=(\d{4}-\d{2}-\d{2})?/.exec(paramRoute) || []), depuisIdee = hj.length > 0; if (depuisIdee) typeAction = "horaires";
    const [c, l, ph_] = await Promise.all([D.commerce(), D.actionsFiche(), D.photos()]);
    vue.innerHTML = `${pauseBandeau(c)}${depuisIdee ? retourAuto("#/accueil", "cal.retour") : retourOrigine()}${entete(t("groupe.reglages"), t("act.titre"), t("act.chapo"))}
      <div class="rangee">
        <section class="carte moitie" aria-labelledby="af-titre-carte"><h2 id="af-titre-carte">${t("act.preparer.titre")}</h2>
          <form id="af"><div class="f"><label for="af-type">${t("act.quoi")}</label><select id="af-type">${Object.entries(TYPES_ACT).map(([k, lib]) => `<option value="${k}"${k === typeAction ? " selected" : ""}>${lib}</option>`).join("")}</select></div>
            <div class="pile" id="af-champs">${champsAction(ph_)}</div>
            <div class="actions"><button class="bouton" type="submit">${t("act.envoyer")}</button></div><p class="msg" id="msg" role="status"></p></form></section>
        <section class="carte moitie" aria-labelledby="af-liste-titre"><div class="carte-tete"><h2 id="af-liste-titre">${t("act.vos")}</h2>${l.length ? `<span class="note">${l.length}</span>` : ""}</div>
          <p class="note">${t("act.note")}${D.mode === "demo" ? " " + t("act.demo") : ""}</p>
          ${l.length ? `<ul class="liste actions-fiche">${l.map(a => `<li data-action="${e(a.id)}"><div class="prog"><p><span class="fort">${TYPES_ACT[a.type] || e(a.type)}</span> · <span class="etat${a.statut === "a_valider" ? " actif" : ""}">${ST_ACT[a.statut] || e(a.statut)}</span></p>
            <p class="texte2">${resumeAction(a, ph_)}</p><p class="note">${a.statut === "publie" && a.publie_le ? t("act.publie.le", { d: date(a.publie_le) }) : t(parCommerce(a) ? "act.envoye.le" : "act.prepare.le", { d: date(a.cree_le) })}${a.demo ? t("act.exemple.demo") : ""}</p>
            ${a.statut === "a_valider" ? `<div class="actions serre"><button type="button" class="bouton petit" data-d="approuve">${t("valider")}</button><button type="button" class="lien" data-d="refuse">${t("refuser")}</button></div>` : ""}</div></li>`).join("")}</ul>`
          : `<p class="texte2">${t("act.aucune")}</p>`}</section>
      </div>`;
    if (hj[1] && $("af-date")) $("af-date").value = hj[1];
    const brancherChamps = () => { const f = $("af-ferme"); if (f) f.onchange = () => { $("af-heures").hidden = f.checked; }; };
    brancherChamps();
    $("af-type").onchange = () => { typeAction = $("af-type").value; $("af-champs").innerHTML = champsAction(ph_); brancherChamps(); msg(""); };
    $("af").onsubmit = async ev => {
      ev.preventDefault(); const v = id => ($(id) ? $(id).value : "");
      const d = typeAction === "photos" ? { photos: [...document.querySelectorAll("input[name=af-photo]:checked")].map(x => x.value) }
        : typeAction === "horaires" ? { date: v("af-date"), ferme: $("af-ferme").checked, ouverture: v("af-ouverture"), fermeture: v("af-fermeture") }
        : { titre: v("af-titre"), debut: v("af-debut"), fin: v("af-fin"), conditions: v("af-conditions") };
      // Saisie du commerçant (31/10/2026, test client Essentiel) : envoyée prête à BoostImpact, sans lui faire valider sa propre saisie ; message visible
      // (bandeau) et défilement jusqu'à l'action dans « Vos actions ». Fiche Google pas encore connectée : l'action reste « à valider », la raison est dite.
      // Un seul message après l'envoi (audit Essentiel du 31/10/2026) : le bandeau quand tout est parti ; la raison sous le formulaire, qui reste, sinon.
      let id = null; try { id = await D.creerActionFiche(typeAction, d); } catch (er) { msg(ph(er.message)); return; }
      if (id) retenirActionEnvoyee(id);
      let note = t("act.envoyee"), envoyee = true; try { await D.validerActionFiche(id, "approuve"); } catch (er) { note = ph(er.message); envoyee = false; }
      await ficheGoogle(); if (envoyee) toast(note); else msg(note);
      const li = id && vue.querySelector(`[data-action="${CSS.escape(String(id))}"]`); if (li) { li.scrollIntoView({ block: "center", behavior: "smooth" }); li.setAttribute("tabindex", "-1"); li.focus({ preventScroll: true }); }
    };
    vue.querySelectorAll("[data-action]").forEach(li => li.addEventListener("click", async ev => {
      const b = ev.target.closest("[data-d]"); if (!b) return;
      try { await D.validerActionFiche(li.dataset.action, b.dataset.d); await ficheGoogle(); msg(t(b.dataset.d === "approuve" ? "act.valide" : "act.refusee")); } catch (er) { msg(ph(er.message)); }
    }));
  }

  // ---------------- Application installable (écran Notifications) : marche à suivre iPhone et Android, bouton direct quand le navigateur le permet.
  let invitationInstall = null;
  window.addEventListener("beforeinstallprompt", ev => { ev.preventDefault(); invitationInstall = ev; const b = $("installer-maintenant"); if (b) b.hidden = false; });
  window.addEventListener("appinstalled", () => { invitationInstall = null; if (ecranCourant === notifications) rendre(); });
  const installee = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  function blocInstaller() {
    return `<section class="carte" id="installer" aria-labelledby="inst-titre"><h2 id="inst-titre">${t("inst.titre")}</h2>
      ${installee() ? `<p class="texte2">${t("inst.deja")}</p>`
      : `<p class="texte2">${t("inst.texte")}</p>
      <ul class="liste reponses"><li><span class="fort">iPhone</span><span>${t("inst.iphone")}</span></li>
        <li><span class="fort">Android</span><span>${t("inst.android")}</span></li></ul>
      <div class="actions"><button type="button" class="bouton second" id="installer-maintenant"${invitationInstall ? "" : " hidden"}>${t("inst.maintenant")}</button></div>`}</section>`;
  }
  document.addEventListener("click", async ev => {
    if (!ev.target.closest("#installer-maintenant") || !invitationInstall) return;
    const i = invitationInstall; invitationInstall = null; ev.target.closest("#installer-maintenant").hidden = true; i.prompt(); try { await i.userChoice; } catch (er) {}
  });

  // ---------------- Notifications : email de validation (lien à usage unique, 7 jours) ; alertes WhatsApp (22/10/2026) avec accord explicite.
  async function notifications() {
    const [c, s] = await Promise.all([D.commerce(), D.session()]), n = c.notifications || { email: true, whatsapp: false };
    const adresse = c.email_validation || (s && s.email) || "";
    vue.innerHTML = `${retourOrigine()}${entete(t("groupe.reglages"), t("ecran.notifications"), t("notif.chapo"))}
      <div class="rangee">
        <section class="carte moitie" aria-labelledby="n-titre"><h2 id="n-titre">${t("notif.comment")}</h2><form id="f-notif">
          <fieldset><legend>${t("notif.canaux")}</legend>
            <label class="option"><input type="checkbox" id="notif-email"${n.email !== false ? " checked" : ""}><span>${t("notif.email")}${adresse ? t("notif.a", { adresse: `<span class="casse">${e(adresse)}</span>` }) : ""}</span></label>
            </fieldset>
          <fieldset><legend>${t("notif.whatsapp")}</legend>${champsWhatsapp(c)}<p class="aide">${t("notif.whatsapp.aide")}</p></fieldset>
          <div class="actions"><button class="bouton" type="submit">${t("enregistrer")}</button></div><p class="msg" id="msg" role="status"></p></form></section>
        <section class="carte moitie"><h2>${t("notif.lien.titre")}</h2>
          <ul class="liste"><li>${t("notif.lien.1")}</li><li>${t("notif.lien.2")}</li><li>${t("notif.lien.3")}</li><li>${t("notif.lien.4")}</li></ul>
          <p class="note">${t("notif.adresse")}</p></section>
      </div>
      ${blocInstaller()}
      ${D.mode === "demo" ? `<section class="carte" aria-labelledby="n-demo"><h2 id="n-demo">${t("demonstration")}</h2><p class="texte2">${t("notif.demo")}</p>
        <div class="actions"><button type="button" class="bouton second" id="voir-email" aria-expanded="false" aria-controls="apercu-email">${t("notif.voir.email")}</button></div><div id="apercu-email" class="pile" hidden></div></section>` : ""}`;
    brancherEchoWhatsapp();
    $("f-notif").onsubmit = async ev => { ev.preventDefault();
      try { const w = await enregistrerWhatsapp(c); if (w === null) return; await D.enregistrer({ notifications: { email: $("notif-email").checked, whatsapp: w } }); await notifications(); msg(t("reglage.enregistre")); }
      catch (er) { msg(ph(er.message)); } };
    if ($("voir-email")) $("voir-email").onclick = async () => {
      const z = $("apercu-email"), ouvrir = z.hidden; z.hidden = !ouvrir; $("voir-email").setAttribute("aria-expanded", String(ouvrir)); if (!ouvrir) return;
      const l = await D.outilsDemo.emailsValidation();
      // L'email part dans la langue du commerce : son contenu est montré tel qu'il serait reçu.
      const lgc = langueCommerce, tc = (k, v) => t(k, v, lgc);
      z.innerHTML = l.length ? l.map(m => `<article class="email" aria-label="${t("email.apercu", { objet: e(m.objet_email) })}">
          <dl class="email-tete"><div><dt>${t("email.de")}</dt><dd>BoostImpact</dd></div><div><dt>${t("email.a")}</dt><dd class="casse">${adresse ? e(adresse) : t("email.adresse.compte")}</dd></div><div><dt>${t("email.objet")}</dt><dd lang="${lgc}">${e(m.objet_email)}</dd></div></dl>
          <div class="email-corps" lang="${lgc}"><p>${tc("email.bonjour")}</p><p>${e(m.phrase)}</p>${m.extrait ? `<p class="citation">${tc("guillemets", { x: e(m.extrait) })}</p>` : ""}
            <p><a class="bouton" data-lien-validation href="valider.html#${e(m.jeton)}" target="_blank" rel="noopener">${tc("email.voir.decider")}</a></p>
            <p class="note">${tc("email.lien.note", { d: I.date(m.expire_le, lgc) })}</p></div></article>`).join("")
        : `<p class="texte2">${t("email.rien")}</p>`;
    };
  }

  // ---------------- Alertes WhatsApp (décision de PJ du 22/10/2026) : numéro au format international et case d'accord, au démarrage (premier accès,
  // tant que l'accord n'est pas donné) et dans Notifications. La case reprend le numéro saisi, mot pour mot : « Je souhaite recevoir les alertes de
  // BoostImpact sur WhatsApp au numéro … ». Sans case cochée, aucun WhatsApp (regler_whatsapp de schema.sql : heure de l'accord, journal).
  const whatsappActif = c => !!((c.notifications || {}).whatsapp && c.whatsapp_numero);
  const champsWhatsapp = c => `<div class="f"><label for="awa-numero">${t("awa.numero")}</label><input id="awa-numero" type="tel" inputmode="tel" autocomplete="tel" maxlength="24" value="${e(c.whatsapp_numero || "")}" placeholder="${e(exNum(c))}" aria-describedby="awa-exemple"><p class="aide" id="awa-exemple">${t("awa.exemple", numParams(c))}</p></div>
      <label class="option consentement"><input type="checkbox" id="awa-case"${whatsappActif(c) ? " checked" : ""}><span>${t("awa.case", { n: `<span id="awa-echo" class="casse" translate="no">${e(c.whatsapp_numero || t("awa.vide"))}</span>` })}</span></label>
      ${whatsappActif(c) ? `<p class="note" id="awa-etat">${t("awa.actif", { n: `<span class="casse" translate="no">${e(window.RENOM_WHATSAPP.lisible(c.whatsapp_numero).replace(/ /g, "\u00a0"))}</span>`, d: date(c.whatsapp_accord_le) })}</p>` : ""}`;
  function brancherEchoWhatsapp() { const i = $("awa-numero"); if (i) i.oninput = () => { $("awa-echo").textContent = i.value.trim() || t("awa.vide"); }; }
  // Rend l'état WhatsApp enregistré (vrai ou faux), ou null si la saisie est incomplète (message affiché).
  async function enregistrerWhatsapp(c) {
    const coche = $("awa-case").checked, num = $("awa-numero").value.trim();
    if (coche && !num) { msg(t("awa.cocher")); $("awa-numero").focus(); return null; }
    if (coche && whatsappActif(c) && window.RENOM_WHATSAPP.numero(num, c.pays) === c.whatsapp_numero) return true;
    if (!coche && !whatsappActif(c) && !c.whatsapp_numero) return false;
    const r = await D.reglerWhatsapp(num, coche); return !!(r && r.whatsapp);
  }
  const carteWhatsapp = c => whatsappActif(c) ? "" : `<section class="carte alertes-whatsapp" id="alertes-whatsapp" aria-labelledby="awa-titre">
      <h2 id="awa-titre">${t("awa.titre")}</h2><p class="texte2">${t("awa.chapo")}</p>
      <form id="awa-f" novalidate>${champsWhatsapp(c)}<div class="actions"><button type="submit" class="bouton second" id="awa-ok">${t("awa.enregistrer")}</button></div><p class="msg" id="awa-msg" role="status"></p></form></section>`;
  function brancherWhatsapp(c, apres) {
    const f = $("awa-f"); if (!f) return; brancherEchoWhatsapp();
    f.onsubmit = async ev => { ev.preventDefault();
      if (!$("awa-case").checked) { $("awa-msg").textContent = t("awa.cocher"); $("awa-case").focus(); return; }
      try { const w = await enregistrerWhatsapp(c); if (w === null) { $("awa-msg").textContent = t("awa.cocher"); return; } await apres(); const m = $("msg-aut") || $("msg"); if (m) m.textContent = t("awa.merci"); }
      catch (er) { $("awa-msg").textContent = ph(er.message); } };
  }

  // ---------------- Démarrage en 5 questions (premier accès). Chaque question peut être passée ; la fiche complète reste accessible.
  const TONS_LIB = I.carte("ton", ["chaleureux", "sobre", "enjoue"]);
  const ACTIONS_LIB = I.carte("action", ["reserver", "appeler", "venir", "acheter"]);
  const QUESTIONS = [
    { cle: "phrase" },
    { cle: "distinctions" },
    { cle: "ton", choix: TONS_LIB },
    { cle: "interdits" },
    { cle: "action", choix: ACTIONS_LIB, detail: t("q.action.detail") },
  ].map(q => ({ ...q, titre: t("q." + q.cle + ".titre"), aide: t("q." + q.cle + ".aide") }));
  const dem = { pour: null, i: 0, rep: {}, fini: false, vue: null };
  // ---------------- Mise en route (27/10/2026, audit du parcours, constats 1 et 3 ; décisions de PJ) : un seul mot, « Mise en route », et dans cet ordre :
  //   1. « Le nom de votre commerce » (prérempli, modifiable, Confirmer) tant qu'il n'est pas confirmé : il part dans les demandes d'avis à ses clients ;
  //   2. « Pour démarrer, 2 choses » (3 en Croissance et Premium) : l'accès à la fiche Google en étapes numérotées (ou « je n'ai pas de fiche »),
  //      les photos, et la connexion des réseaux selon l'état réel de l'étape ; « Je n'y arrive pas : rappelez-moi » ;
  //   3. les 5 questions ; 4. à la fin, l'autorisation photos et les alertes WhatsApp, repliées (facultatives).
  // Sans le bloc SQL (colonnes absentes) : ni écran du nom, ni « rappelez-moi », ni fiche à créer ; le reste est inchangé.
  const PAS_GOOGLE = [1, 2, 3, 4, 5, 6];
  function etapeTete(n, titre, etat, id) {
    return `<div class="etape-tete"><span class="etape-num" aria-hidden="true">${n}</span><h2 id="${id}">${titre}</h2>${etat ? `<span class="etat${etat === "fait" ? " actif" : ""}">${etat === "demande" ? t("mer2.demande.etat") : etat === "facultatif" ? t("mer2.facultatif") : ETATS_MR[etat] || e(etat)}</span>` : ""}</div>`;
  }
  async function ecranNom(c) {
    // Offre activée sur le même écran (27/10/2026, demande de PJ) : le commerçant voit tout de suite quelle offre il a prise.
    const off = offreAccueil(c);
    vue.innerHTML = `${entete(t("ecran.demarrage"), t("nom.titre"), t("nom.chapo"))}
      ${off ? `<section class="carte nom-offre" aria-label="${e(t("nom.offre"))}"><p class="texte2">${t("nom.offre")}</p>${off}</section>` : ""}
      <section class="carte nom-commerce" aria-labelledby="nom-lib"><form id="nom-f" novalidate>
        <div class="f"><label for="nom-commerce" id="nom-lib">${t("nom.lib")}</label><input id="nom-commerce" type="text" maxlength="120" autocomplete="organization" value="${e(c.nom)}" aria-describedby="nom-aide" required>
          <p class="aide" id="nom-aide">${t("nom.aide")}</p></div>
        <div class="actions"><button class="bouton" type="submit" id="nom-ok">${t("nom.confirmer")}</button></div><p class="msg" id="msg" role="status"></p></form></section>`;
    $("nom-f").onsubmit = async ev => { ev.preventDefault(); $("nom-ok").disabled = true;
      try { await D.confirmerNom($("nom-commerce").value); await demarrage(); msg(t("nom.merci")); majCompteurs(); } catch (er) { $("nom-ok").disabled = false; msg(ph(er.message)); } };
  }
  async function ecranEssentiel(c) {
    const [mr, ph_] = await Promise.all([D.miseEnRoute().catch(() => null), D.photos().catch(() => [])]), pts = Object.fromEntries(((mr && mr.points) || []).map(x => [x.point, x.etat]));
    // Étape réseaux (bloc SQL « Emails au commerçant », 27/10/2026) : tant que l'équipe n'a pas envoyé le lien (lien_envoye_le vide), rien à faire.
    const ptRes = ((mr && mr.points) || []).find(x => x.point === "metricool"), attenteLien = !!ptRes && ptRes.etat === "a_faire" && "lien_envoye_le" in ptRes && !ptRes.lien_envoye_le;
    const g = sansReseaux(c), avecReseaux = "metricool" in pts, eg = ficheDemandee(c) ? "demande" : pts.google || "a_faire", eph = ph_.length ? "fait" : "a_faire";
    const tel = c.whatsapp_numero ? window.RENOM_WHATSAPP.lisible(c.whatsapp_numero) : window.RENOM_WHATSAPP.numero(c.contact, c.pays) ? c.contact : "";
    const google = eg === "fait" ? `<p class="texte2">${t("mer2.google.fait")}</p>`
      : eg === "demande" ? `<div class="pile serre" id="fiche-demandee"><p class="texte2">${t("mer2.fiche.demandee", { d: date(c.fiche_google_demande_le) })}</p>
          <ol class="pas">${(c.fiche_google_cas === "pas_a_mon_nom" ? ["nom.1", "nom.2", "3"] : ["1", "2", "3"]).map(i => `<li>${t("mer2.fiche.suite." + i)}</li>`).join("")}</ol>
          <p><button type="button" class="lien" id="fiche-annuler">${t("mer2.fiche.annuler")}</button></p></div>`
      : `${blocFiche(c, "fiche-lien")}<p class="texte2">${t("mer2.google.chapo")}</p>
        <ol class="pas" id="pas-google">${PAS_GOOGLE.map(i => `<li>${t("mer2.google.pas." + i)}</li>`).join("")}</ol>
        ${eg === "declare" ? `<p class="note">${t("mer2.google.declare")}</p>` : `<div class="actions"><button type="button" class="bouton" data-declarer="google">${t("mer2.google.fait.bouton")}</button></div>`}
        ${merSql(c) && eg !== "declare" ? `<div class="sans-fiche"><label class="option"><input type="checkbox" id="sans-fiche"><span>${t("mer2.sans.fiche")}</span></label>
          <div class="pile serre" id="sans-fiche-choix" hidden><p class="texte2">${t("mer2.sans.fiche.texte")}</p>
            <fieldset><legend class="vh">${t("mer2.sans.fiche")}</legend>${["pas_de_fiche", "pas_a_mon_nom"].map((k, i) => `<label class="option"><input type="radio" name="fiche-cas" value="${k}"${i ? "" : " checked"}><span>${t("mer2.cas." + k)}</span></label>`).join("")}</fieldset>
            <div class="actions"><button type="button" class="bouton second" id="fiche-demander">${t("mer2.fiche.demander")}</button></div></div></div>` : ""}`;
    const reseaux = !avecReseaux ? "" : `<li class="carte etape-mer" id="mer-reseaux" data-etat="${e(pts.metricool)}">${etapeTete(3, t("mer2.reseaux.titre"), pts.metricool, "mer-reseaux-titre")}
        <p class="texte2">${t("mer2.reseaux." + (pts.metricool === "fait" ? "fait" : pts.metricool === "declare" ? "declare" : attenteLien ? "attente" : "a_faire"))}</p>
        ${pts.metricool === "a_faire" && !attenteLien ? `<div class="actions"><button type="button" class="bouton second" data-declarer="metricool">${t("mer2.reseaux.fait.bouton")}</button></div>` : ""}</li>`;
    vue.innerHTML = `${entete(t("ecran.demarrage"), e(c.nom), t(avecReseaux ? "mer2.chapo.req.2" : "mer2.chapo.req.1"))}
      <p class="msg" id="msg" role="status"></p>
      <ol class="etapes-mer" id="pour-demarrer">
        <li class="carte etape-mer" id="mer-google" data-etat="${e(eg)}">${etapeTete(1, t("mer2.google.titre"), eg, "mer-google-titre")}${google}</li>
        <li class="carte etape-mer" id="mer-photos" data-etat="${eph}">${etapeTete(2, t(g ? "mer2.photos.titre.google" : "mer2.photos.titre"), eph === "fait" ? "fait" : "facultatif", "mer-photos-titre")}
          <p class="texte2">${ph_.length ? t("mer2.photos.fait", { n: ph_.length }) : t(g ? "mer2.photos.google" : "mer2.photos.texte", { n: pubGoogle(c) })}</p>
          <div class="actions"><a class="bouton second" href="#/photos">${APPAREIL}<span>${t("acc.envoyer.photo")}</span></a></div></li>
        ${reseaux}
      </ol>
      ${merSql(c) ? `<section class="carte rappel" id="rappel" aria-labelledby="rappel-titre"><h2 id="rappel-titre" class="vh">${t("rappel.bouton")}</h2>
        <button type="button" class="bouton second" id="rappel-ouvrir" aria-expanded="false" aria-controls="rappel-f">${t("rappel.bouton")}</button>
        <form id="rappel-f" class="pile serre" novalidate hidden><div class="f"><label for="rappel-tel">${t("rappel.tel")}</label><input id="rappel-tel" type="tel" inputmode="tel" autocomplete="tel" maxlength="24" value="${e(tel)}" placeholder="${e(exNum(c))}" aria-describedby="rappel-aide"><p class="aide" id="rappel-aide">${t("rappel.aide", numParams(c))}</p></div>
          <div class="actions"><button class="bouton" type="submit" id="rappel-envoyer">${t("rappel.envoyer")}</button></div></form><p class="msg" id="rappel-msg" role="status"></p></section>` : ""}
      <div class="actions pied-mer">${c.demarrage_fini ? `<a class="bouton" href="#/accueil" id="mer-accueil">${t("dem5.accueil")}</a>` : `<button type="button" class="bouton" id="mer-continuer">${t("mer2.continuer")}</button>`}
        ${c.demarrage_fini ? "" : `<button type="button" class="lien" id="dem-plus-tard">${t("dem5.plus.tard")}</button>`}</div>`;
    vue.querySelectorAll("[data-declarer]").forEach(b => b.onclick = async () => { b.disabled = true; try { await D.declarerMiseEnRoute(b.dataset.declarer); await ecranEssentiel(await D.commerce()); msg(t("mer.merci")); majCompteurs(); } catch (er) { b.disabled = false; msg(ph(er.message)); } });
    if ($("sans-fiche")) $("sans-fiche").onchange = () => { $("sans-fiche-choix").hidden = !$("sans-fiche").checked; };
    if ($("fiche-demander")) $("fiche-demander").onclick = async () => { const x = document.querySelector("input[name=fiche-cas]:checked");
      try { await D.demanderFicheGoogle(x ? x.value : "pas_de_fiche"); await ecranEssentiel(await D.commerce()); msg(t(x && x.value === "pas_a_mon_nom" ? "mer2.fiche.merci.nom" : "mer2.fiche.merci")); } catch (er) { msg(ph(er.message)); } };
    brancherFiche("fiche-lien", async () => ecranEssentiel(await D.commerce()));
    if ($("fiche-annuler")) $("fiche-annuler").onclick = async () => { try { await D.demanderFicheGoogle("annuler"); await ecranEssentiel(await D.commerce()); } catch (er) { msg(ph(er.message)); } };
    if ($("rappel-ouvrir")) $("rappel-ouvrir").onclick = () => { const f_ = $("rappel-f"), o = f_.hidden; f_.hidden = !o; $("rappel-ouvrir").setAttribute("aria-expanded", String(o)); if (o) $("rappel-tel").focus(); };
    if ($("rappel-f")) $("rappel-f").onsubmit = async ev => { ev.preventDefault(); const m = $("rappel-msg");
      try { const r = await D.demanderRappel("mise_en_route", $("rappel-tel").value); $("rappel-f").hidden = true; $("rappel-ouvrir").setAttribute("aria-expanded", "false");
        const n_ = window.RENOM_WHATSAPP.numero($("rappel-tel").value, c.pays);
        m.textContent = t(r && r.deja ? "rappel.deja" : "rappel.merci", { tel: (n_ ? window.RENOM_WHATSAPP.lisible(n_) : $("rappel-tel").value.trim()).replace(/\s+/g, "\u00a0"), quand: quandJour(jourRappelDe(c, (r && r.cree_le) || new Date().toISOString())) }); } catch (er) { m.textContent = ph(er.message); } };
    if ($("mer-continuer")) $("mer-continuer").onclick = async () => { dem.vue = "questions"; await demarrage(); const q = vue.querySelector("#dem-champ, input[name=dem-choix]"); if (q) q.focus(); };
    if ($("dem-plus-tard")) $("dem-plus-tard").onclick = () => { try { localStorage.setItem("renom-demarrage-plus-tard:" + c.id, "1"); } catch (er) {} dem.pour = null; aller("accueil"); };
  }
  async function demarrage() {
    const c = await D.commerce();
    if (dem.pour !== c.id) Object.assign(dem, { pour: c.id, i: 0, rep: { ...(c.demarrage || {}) }, fini: false });
    if (nomAConfirmer(c)) return ecranNom(c);
    // Par défaut : « Pour démarrer » tant que la mise en route n'est pas finie (premier accès), sinon les questions (réponses à modifier).
    if (!dem.vue) { const mr = await D.miseEnRoute().catch(() => null); dem.vue = mr && mr.points && mr.faits < mr.total && !dem.fini ? "essentiel" : "questions"; }
    if (dem.vue === "essentiel") return ecranEssentiel(c);
    if (dem.fini) {
      // Fin des questions : la suite, puis l'autorisation photos et les alertes WhatsApp, repliées et facultatives (27/10/2026, constat 3).
      vue.innerHTML = `${entete(t("dem5.fini"), e(c.nom), t("dem5.fini.chapo"))}<p class="msg" id="msg-aut" role="status"></p>
        <section class="carte style-accueil" id="dem-style"><h2>${t("dem5.style.titre")}</h2><p class="texte2">${t("dem5.style.texte")}</p>
          <p class="pied"><a class="bouton" href="#/publications">${t("dem5.style.bouton")}</a></p></section>
        <section class="carte"><h2>${t("dem5.maintenant")}</h2><p class="texte2">${sansReseaux(c) ? t("dem5.maintenant.texte.google", { n: pubGoogle(c) }) : t("dem5.maintenant.texte")}</p>
          <div class="actions"><button type="button" class="bouton" id="dem-accueil">${t("dem5.accueil")}</button><a class="bouton second" href="#/fiche">${t("dem5.voir.fiche")}</a></div></section>
        ${autorisationAJour(c) ? "" : `<details class="carte repli" id="repli-autorisation"><summary>${t("dem5.repli.autorisation")}</summary>${carteAutorisation(c)}</details>`}
        ${whatsappActif(c) ? "" : `<details class="carte repli" id="repli-whatsapp"><summary>${t("dem5.repli.whatsapp")}</summary>${carteWhatsapp(c)}</details>`}`;
      $("dem-accueil").onclick = () => { dem.pour = null; aller("accueil"); };
      brancherAutorisation(demarrage); brancherWhatsapp(c, demarrage);
      return;
    }
    const q = QUESTIONS[dem.i], v = dem.rep[q.cle] || "", mr0 = await D.miseEnRoute().catch(() => null), merEnCoursDem = !!(mr0 && mr0.points && mr0.faits < mr0.total);
    vue.innerHTML = `${entete(t("ecran.demarrage"), e(c.nom), t("dem5.chapo"))}
      <section class="carte demarrage">
        <div class="mesure"><div class="mesure-tete"><span class="fort">${t("dem5.question", { n: dem.i + 1 })}</span></div>${jauge(dem.i + 1, 5)}</div>
        <form id="dem-f" novalidate>
          ${q.choix ? `<fieldset><legend class="q-titre" id="q-titre">${q.titre}</legend><p class="aide">${q.aide}</p>${Object.entries(q.choix).map(([k, lib]) => `<label class="option"><input type="radio" name="dem-choix" value="${k}"${v === k ? " checked" : ""}><span>${lib}</span></label>`).join("")}</fieldset>
            ${q.detail ? `<div class="f"><label for="dem-detail">${q.detail}</label><input id="dem-detail" type="text" maxlength="200" value="${e(dem.rep.action_detail || "")}"></div>` : ""}`
          : `<div class="f"><label for="dem-champ" class="q-titre" id="q-titre">${q.titre}</label><p class="aide" id="q-aide">${q.aide}</p><textarea id="dem-champ" class="haut-texte" maxlength="600" aria-describedby="q-aide"${lc()}>${e(v)}</textarea></div>`}
          <div class="actions"><button class="bouton" type="submit" id="dem-suivant">${t(dem.i === 4 ? "dem5.terminer" : "dem5.suivant")}</button><button type="button" class="bouton second" id="dem-passer">${t("dem5.passer")}</button>${dem.i ? `<button type="button" class="lien" id="dem-precedent">${t("dem5.precedente")}</button>` : ""}</div>
          <p class="msg" id="msg" role="status"></p></form></section>
      <p class="note">${merEnCoursDem ? `<a href="#/miseenroute" id="dem-retour-etapes">${t("mer2.retour.etapes")}</a> · ` : ""}<button type="button" class="lien" id="dem-plus-tard">${t("dem5.plus.tard")}</button> ${t("dem5.plus.tard.note")}</p>`;
    const lire = () => { if (q.choix) { const x = document.querySelector("input[name=dem-choix]:checked"); dem.rep[q.cle] = x ? x.value : ""; if (q.detail) dem.rep.action_detail = $("dem-detail").value.trim(); } else dem.rep[q.cle] = $("dem-champ").value.trim(); };
    const avancer = async () => {
      if (dem.i < 4) { dem.i++; await demarrage(); const f = vue.querySelector("#dem-champ, input[name=dem-choix]"); if (f) f.focus(); return; }
      try {
        await D.enregistrerDemarrage(dem.rep);
        const c2 = await D.commerce(), r = dem.rep, pre = {};   // la fiche est préremplie, sans écraser ce qui y est déjà
        if (!c2.specialites && (r.phrase || r.distinctions)) pre.specialites = [r.phrase, r.distinctions].filter(Boolean).join("\n");
        // Le ton de la fiche est écrit dans la langue du commerce (BoostImpact écrit dans cette langue).
        if (!c2.ton && TONS_LIB[r.ton]) pre.ton = t("ton." + r.ton, null, langueCommerce).toLowerCase();
        if (Object.keys(pre).length) await D.enregistrer(pre);
        dem.fini = true; await demarrage(); majCompteurs();
      } catch (er) { msg(ph(er.message)); }
    };
    $("dem-f").onsubmit = async ev => { ev.preventDefault(); lire(); await avancer(); };
    $("dem-passer").onclick = async () => { await avancer(); };
    if ($("dem-precedent")) $("dem-precedent").onclick = async () => { lire(); dem.i--; await demarrage(); };
    $("dem-plus-tard").onclick = () => { try { localStorage.setItem("renom-demarrage-plus-tard:" + c.id, "1"); } catch (er) {} dem.pour = null; aller("accueil"); };
  }

  // ---- Réponses aux commentaires ----------------------------------------------------------------------------------
  // Écran du groupe « Réputation ». Instagram et Facebook (offres Standard et Premium ; Croissance et Signature, retirées, pour un ancien commerce). Classement et réponse proposés par BoostImpact, décision du
  // commerçant ; un commentaire sensible n'est jamais traité par BoostImpact. Publication par l'API de Meta, ou par l'équipe tant que l'accès n'est pas accordé.
  const CO = window.RENOM_COMMENTAIRES;
  const CM_CATEGORIES = I.carte("cm.cat", Object.keys(CO.CATEGORIES)), CM_ETATS = I.carte("cm.etat", Object.keys(CO.ETATS));
  const rangCommentaire = x => x.statut === "a_valider" ? 0 : x.statut === "humain" ? 1 : ["valide", "a_publier_main"].includes(x.statut) ? 2 : x.statut === "publie" ? 3 : 4;
  const texteCommentaire = x => x.efface_le ? `<p class="note efface">${t("cm.efface")}</p>`
    : x.texte ? `<p class="citation"${lc()}>${t("guillemets", { x: e(x.texte) })}</p>` : `<p class="citation">${t("cm.sans.texte")}</p>`;
  const lienPublication = x => x.lien ? `<a href="${e(x.lien)}" target="_blank" rel="noopener">${t("cm.ouvrir.sur", { res: CO.RESEAUX[x.reseau] || t("cm.le.reseau") })}</a>` : "";
  function corpsCommentaire(x) {
    const reseau = CO.RESEAUX[x.reseau] || e(x.reseau), sensible = x.statut === "humain" || x.categorie === "sensible";
    let suite = "";
    if (x.statut === "a_valider") suite = `${(x.refus || []).length && !x.reponse_proposee ? `<p class="note">${t("cm.ecartee", { r: e(raisonsTexte(x.refus)) })}</p>` : ""}
      <div class="f"><label for="cm-${e(x.id)}">${t("rep.proposee")}</label><textarea id="cm-${e(x.id)}" class="haut-texte" maxlength="${CO.LIMITE}" data-texte-c${lc()}>${e(x.reponse_proposee || "")}</textarea></div>
      <div class="actions"><button type="button" class="bouton" data-c="valide">${t("cm.valider")}</button><button type="button" class="lien" data-c="ignore">${t("cm.ne.pas.repondre")}</button></div>`;
    else if (x.statut === "humain") suite = `<div class="encart" role="alert"><p class="fort">${t("cm.sensible")}${(x.raisons || []).length ? t("deux.points") + e(raisonsTexte(x.raisons)) : ""}.</p>
      <p>${t("cm.sensible.texte", { res: reseau })}</p></div>
      <div class="actions"><button type="button" class="bouton second" data-c="clos">${t("cm.traite")}</button>${lienPublication(x)}</div>`;
    else if (x.statut === "valide" || x.statut === "a_publier_main") suite = `<p class="reponse"><span class="fort">${t("avis.rep.validee")}</span> <span${lc()}>${e(x.reponse_proposee || "")}</span></p>
      <p class="note">${t(x.statut === "a_publier_main" ? "cm.publiee.equipe" : "cm.publication.cours")}</p>`;
    else if (x.statut === "publie") suite = `<p class="reponse"><span class="fort">${t(x.publie_par === "equipe" ? "cm.rep.equipe" : x.decision === "publication_automatique" ? "avis.rep.auto" : "cm.rep.publiee")}</span> <span${lc()}>${e(x.reponse || x.reponse_proposee || "")}</span></p>`;
    else if (x.statut === "ignore") suite = `<p class="note">${t(x.categorie === "spam" ? "cm.spam" : "cm.choisi.pas")}</p>`;
    else if (x.statut === "clos") suite = `<p class="note">${t("cm.traite.par.vous")}</p>`;
    return `<div class="carte-tete"><p class="fort">${reseau} · ${CM_CATEGORIES[x.categorie] || e(x.categorie)}</p><p class="etat${x.statut === "a_valider" || sensible && x.statut === "humain" ? " actif" : ""}">${CM_ETATS[x.statut] || e(x.statut)}</p></div>
      ${texteCommentaire(x)}<p class="note">${x.auteur && !x.efface_le ? e(x.auteur) + " · " : ""}${t("recu.le", { d: date(x.cree_le) })}</p>${suite}`;
  }
  function brancherCommentaires(racine, apres) {
    racine.querySelectorAll("[data-commentaire]").forEach(a => a.addEventListener("click", async ev => {
      const b = ev.target.closest("[data-c]"); if (!b) return; const d = b.dataset.c, ta = a.querySelector("[data-texte-c]");
      try {
        await D.deciderCommentaire(a.dataset.commentaire, d, d === "valide" && ta ? ta.value : null); await apres(); majCompteurs();
        msg(t(d === "valide" ? "cm.validee.msg" : d === "ignore" ? "cm.ignore.msg" : "enregistre"));
      } catch (er) { msg(ph(er.message)); }
    }));
  }
  async function commentaires() {
    const [c, k, l0] = await Promise.all([D.commerce(), D.compteur(), D.commentaires().catch(() => [])]);
    const titre = entete(t("cm.sur"), t("ecran.commentaires"), t("cm.chapo"));
    if (!k.commentaires_inclus) {
      vue.innerHTML = `${titre}<section class="carte"><h2>${t("cm.offre.titre")}</h2>
        <p class="texte2 lecture">${t("cm.offre.texte")}</p><p class="pied"><a class="bouton second" href="#/offre?dessus" id="cm-passer">${t("offre.passer.lien", { nom: e(I.offre("standard")) })}</a></p></section>`;
      return;
    }
    const l = l0.map((x, i) => [x, i]).sort((a, b) => rangCommentaire(a[0]) - rangCommentaire(b[0]) || a[1] - b[1]).map(x => x[0]);
    const visibles = l.filter(x => !(x.statut === "ignore" && x.categorie === "spam")), spams = l.filter(x => x.statut === "ignore" && x.categorie === "spam");
    vue.innerHTML = `${pauseBandeau(c)}${titre}<p class="msg" id="msg" role="status"></p>
      <div class="colonnes">
        <div class="pile">${visibles.length ? visibles.map(x => `<article class="carte avis${x.statut === "humain" ? " attention" : ""}" data-commentaire="${e(x.id)}">${corpsCommentaire(x)}</article>`).join("")
          : `<section class="carte"><h2>${t("cm.vide.titre")}</h2><p class="texte2">${t("cm.vide.texte")}</p></section>`}
          ${spams.length ? `<details class="carte"><summary>${t("cm.spams", { n: spams.length })}</summary><div class="pile">${spams.map(x => `<div data-commentaire="${e(x.id)}">${corpsCommentaire(x)}</div>`).join("")}</div></details>` : ""}</div>
        <div class="pile">
          <section class="carte"><h2>${t("reglage")}</h2><form id="f-cm">
            <label class="option"><input type="checkbox" id="cm-auto"${c.commentaires_compliments_auto ? " checked" : ""}><span>${t("cm.auto")}</span></label>
            <p class="aide">${t("cm.auto.aide")}</p>
            <div class="actions"><button class="bouton second petit" type="submit">${t("enregistrer")}</button></div></form></section>
          <section class="carte"><h2>${t("cm.comment")}</h2><ul class="liste">
            <li>${t("cm.c1")}</li>
            <li>${t("cm.c2")}</li>
            <li>${t("cm.c3")}</li>
            <li>${t("cm.c4")}</li>
            <li>${t("cm.c5")}</li></ul>
            <p class="note pied">${t("cm.ce.mois", { n: +k.commentaires_repondus || 0 })}</p></section>
        </div>
      </div>`;
    $("f-cm").onsubmit = async ev => { ev.preventDefault(); try { await D.enregistrer({ commentaires_compliments_auto: $("cm-auto").checked }); msg(t($("cm-auto").checked ? "cm.reglage.auto" : "cm.reglage.accord")); } catch (er) { msg(ph(er.message)); } };
    brancherCommentaires(vue, commentaires);
  }
  // ---- fin du bloc Réponses aux commentaires -----------------------------------------------------------------------

  // ---- Vidéo d'avis ------------------------------------------------------------------------------------------------
  // Écran du groupe « Créer » : choisir 2 à 4 avis, un fond, un style ; la vidéo arrive dans « Contenus », à valider.
  // Tout ce qui concerne la vidéo d'avis est dans ce bloc (écran, entrée de menu, libellés du journal) ; les règles sont dans donnees.js.
  const VA = window.RENOM_VIDEO_AVIS;
  Object.assign(ETAPES, I.carte("etape", ["VIDEO_AVIS", "VIDEO_AVIS_DEMANDEE", "VIDEO_AVIS_REFUSEE", "DEPOT_VIDEO", "DEPOT_VIDEO_ANNULE", "MONTAGE", "MONTAGE_RELANCE", "RUSHES_A_EFFACER", "RUSHES_EFFACES", "MUSIQUE_PLATEFORME_NON_POSEE", "MUSIQUE_PLATEFORME_POSEE"]));
  const ST_VA = I.carte("va.st", ["a_traiter", "en_cours", "traitee", "refusee"]);
  // Noms des styles et des fonds : ceux de donnees.js (égalité testée avec le moteur), traduits à l'affichage d'après leur identifiant.
  const vaNomStyle = s => I.ou("va.style." + s.id, s.nom), vaFond = f => ({ nom: I.ou("va.fond." + f.id, f.nom), note: I.ou("va.fond.note." + f.id, f.note) });
  const va = { choisis: [], fond: null, style: "franc", veille: null };
  // Figtree de l'aperçu : la version variable du moteur (« Figtree Variable », style.css), pas les fichiers statiques de l'interface.
  const vaPolice = p => `font-family:'${p[0] === "Figtree" ? "Figtree Variable" : p[0]}',system-ui,sans-serif;font-variation-settings:${p[1]}`;
  // Même calcul de contraste que le moteur (gabarits.py) : le texte de l'aperçu prend la couleur que la vidéo prendra.
  const vaLum = h => { const v = parseInt(h.slice(1), 16), f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(v >> 16) + 0.7152 * f((v >> 8) & 255) + 0.0722 * f(v & 255); };
  const vaContraste = (a, b) => { const [x, y] = [vaLum(a), vaLum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  // Étoiles dessinées (formes), jamais un caractère : pleines jusqu'à la note, en contour ensuite.
  const vaEtoiles = n => `<svg class="va-etoiles" viewBox="0 0 116 20" role="img" aria-label="${etoiles(n)}">${[0, 1, 2, 3, 4].map(i => `<path transform="translate(${i * 24})" d="M10 1.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L1.4 7.5l6-.8z" ${i < n ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.3"'}></path>`).join("")}</svg>`;
  const vaDemande = x => { const f = VA.FONDS.find(y => y.id === x.fond), s = VA.STYLES.find(y => y.id === x.style);
    return `<li><div><p class="fort">${t("va.dem.resume", { n: x.avis_ids.length, fond: e(f ? vaFond(f).nom : x.fond), style: e(s ? vaNomStyle(s) : x.style) })}</p><p class="note">${t("va.dem.quand", { jour: I.minusculeDebut(jourRelatif(x.cree_le)), h: heure(x.cree_le) })}${x.demo ? t("va.rendu.simule") : ""}</p>
      ${x.statut === "refusee" && x.motif ? `<p class="note">${t("va.motif")}${e(ph(x.motif))}</p>` : ""}${x.statut === "traitee" ? `<p class="note"><a class="lien-seul" href="#/contenus">${t("va.a.valider")}</a></p>` : ""}</div><span class="etat${x.statut === "a_traiter" || x.statut === "en_cours" ? " actif" : ""}">${ST_VA[x.statut] || e(x.statut)}</span></li>`; };
  const vaQuota = k => t("va.quota", { a: k.videos_utilisees, b: k.videos_plafond });
  async function vaSuivre() {
    // Tant qu'une demande attend son rendu, on relit son état toutes les deux secondes, sans redessiner l'écran (la sélection reste).
    clearTimeout(va.veille); if (route !== "videoavis" || !$("va-demandes")) return;
    const [dm, k] = await Promise.all([D.demandesVideoAvis(), D.compteur()]);
    $("va-demandes").innerHTML = dm.length ? `<ul class="liste">${dm.slice(0, 6).map(vaDemande).join("")}</ul>` : `<p class="texte2">${t("va.aucune.demande")}</p>`;
    if ($("va-quota")) $("va-quota").innerHTML = vaQuota(k);
    majCompteurs();
    if (dm.some(x => x.statut === "a_traiter" || x.statut === "en_cours")) va.veille = setTimeout(() => vaSuivre().catch(() => {}), 2000);
  }
  // Vidéo d'avis dans l'écran Photos (25/10/2026) : une carte « Créer une vidéo d'avis » (offres avec vidéos) ; #/videoavis la déplie (section #video-avis).
  // Message propre à la section (#va-msg) : l'écran Photos a déjà le sien (#msg).
  let vaOuvert = false, vaCtx = null;
  const vaMsg = x => { const m = $("va-msg"); if (m) m.textContent = x; };
  async function blocVideoAvis(c) {
    const [k, tous, ph_] = await Promise.all([D.compteur(), vaOuvert ? D.avisVideo() : [], D.photos()]); vaCtx = null;
    if (!vaOuvert) return k.videos_plafond ? `<section class="carte" id="video-avis" aria-labelledby="va-titre"><h2 id="va-titre">${t("ecran.videoavis")}</h2><p class="texte2">${t("va.chapo")}</p>
      <p class="pied"><a class="bouton second" id="va-ouvrir" href="#/videoavis">${t("va.ouvrir")}</a></p></section>` : "";
    if (!k.videos_plafond) return `<section class="carte" id="video-avis" aria-labelledby="va-titre"><h2 id="va-titre">${t("va.offre.titre")}</h2>
        <p class="texte2 lecture">${t("va.offre.texte", { nom: e(I.offre(k.offre || k.offre_nom)), v: (window.RENOM_OFFRES.premium || {}).videos })}</p><p class="pied"><a class="bouton second" href="#/offre?dessus=premium" id="va-passer">${t("offre.passer.lien", { nom: e(I.offre("premium")) })}</a></p></section>`;
    const motifs = new Map(tous.map(a => [a.id, VA.motif(a)])), bons = tous.filter(a => !motifs.get(a.id)), autres = tous.filter(a => motifs.get(a.id));
    va.choisis = va.choisis.filter(id => bons.some(a => a.id === id));
    if (!va.fond || (va.fond === "photos" && !ph_.length)) va.fond = ph_.length ? "photos" : "uni";
    vaCtx = { c, bons, co: c.couleurs || {} };
    return `<section class="va-bloc" id="video-avis" aria-labelledby="va-titre"><div class="carte-tete"><h2 id="va-titre">${t("ecran.videoavis")}</h2><a href="#/photos?video" id="va-fermer">${t("fermer")}</a></div>
      <p class="texte2">${t("va.chapo")}</p>
      <div class="colonnes va">
        <div class="pile">
          <section class="carte"><div class="carte-tete"><h3>${t("va.avis.titre")}</h3><span class="note" id="va-compte"></span></div>
            <p class="note">${t("va.avis.note")}</p>
            <p class="note" id="va-30-jours">${t("va.30.jours")}</p>
            ${bons.length ? `<ul class="liste va-avis">${bons.map(a => `<li><label class="option va-choix"><input type="checkbox" name="va-avis" value="${e(a.id)}"${va.choisis.includes(a.id) ? " checked" : ""}>
              <span class="va-texte"><span class="fort">${e(a.auteur)} · ${etoiles(a.note)}</span><span class="citation"${lc()}>${t("guillemets.insec", { x: e(a.texte) })}</span>
              <span class="note">${t("va.car", { n: VA.longueur(a.texte), lim: VA.LIMITE })}<span data-rang></span></span></span></label></li>`).join("")}</ul>`
            : `<p class="texte2">${t("va.aucun.avis")}</p>`}
            ${autres.length ? `<details class="va-refus"><summary>${t("va.non.proposes", { n: autres.length })}</summary><ul class="liste">${autres.map(a => `<li><div><p class="fort">${e(a.auteur || t("va.auteur.inconnu"))} · ${etoiles(a.note)}</p><p class="citation"${lc()}>${t("guillemets.insec", { x: e(cut(a.texte || "", 140)) })}</p><p class="note">${e(ph(motifs.get(a.id)))}</p></div></li>`).join("")}</ul></details>` : ""}
          </section>
          <section class="carte"><h3>${t("va.fond.titre")}</h3><fieldset><legend class="vh">${t("va.fond.legend")}</legend>
            ${VA.FONDS.map(f0 => { const f = { ...f0, ...vaFond(f0) }, sans = f.id === "photos" && !ph_.length; return `<label class="option va-choix"><input type="radio" name="va-fond" value="${f.id}"${va.fond === f.id ? " checked" : ""}${sans ? " disabled" : ""}><span class="va-texte"><span>${f.nom}${sans ? t("va.sans.photo") : ""}</span><span class="note">${f.note}</span></span></label>`; }).join("")}</fieldset></section>
          <section class="carte"><h3>${t("va.typo.titre")}</h3><p class="note">${t("va.typo.note")}</p>
            <fieldset class="va-styles"><legend class="vh">${t("va.typo.legend")}</legend>${VA.STYLES.map(s => `<label class="va-style"><input class="vh" type="radio" name="va-style" value="${s.id}"${va.style === s.id ? " checked" : ""}>
              <span class="va-style-nom" style="${vaPolice(s.titre)}">${vaNomStyle(s)}</span><span class="va-style-ex" style="${vaPolice(s.texte)}">${t("va.typo.exemple")}</span></label>`).join("")}</fieldset></section>
        </div>
        <div class="pile">
          <section class="carte"><div class="carte-tete"><h3>${t("va.apercu")}</h3><span class="note">${t("va.indicatif")}</span></div>
            <div class="va-apercu" id="va-apercu"></div>
            <p class="note">${t("va.apercu.note")}</p></section>
          <section class="carte"><h3>${t("va.creer.titre")}</h3><p class="texte2" id="va-quota">${vaQuota(k)}</p>
            <p class="note">${t("va.creer.note")}</p>
            <div class="actions"><button type="button" class="bouton" id="va-creer">${t("va.creer")}</button></div><p class="msg" id="va-msg" role="status"></p></section>
          <section class="carte"><h3>${t("va.demandes")}</h3><div id="va-demandes"></div></section>
        </div>
      </div></section>`;
  }
  async function brancherVideoAvis() {
    if (!vaCtx || !$("va-creer")) return;
    const { c, bons, co } = vaCtx, cases = [...vue.querySelectorAll("input[name=va-avis]")];
    const maj = () => {
      const n = va.choisis.length, premier = bons.find(a => a.id === va.choisis[0]), s = VA.STYLES.find(x => x.id === va.style) || VA.STYLES[0];
      $("va-compte").textContent = t("va.compte", { n, max: VA.MAX });
      cases.forEach(i => { i.disabled = !i.checked && n >= VA.MAX; const r = va.choisis.indexOf(i.value); i.closest("label").querySelector("[data-rang]").textContent = r < 0 ? "" : t("va.position", { n: r + 1 }); });
      $("va-creer").disabled = n < VA.MIN || !!c.en_pause;
      if (!$("va-msg").dataset.fixe) vaMsg(n < VA.MIN ? t("va.cocher", { min: VA.MIN, n }) : "");
      // Aperçu : couleurs de la fiche pour un fond uni ; pour les photos, un fond sombre neutre tient lieu de photo assombrie.
      const hex = (x, d) => /^#[0-9a-f]{6}$/i.test(x || "") ? x : d, accent = String(co.accent || "").toUpperCase() === "#2438FF" ? "#0F1C3A" : hex(co.accent, "#0F1C3A");   // même accent par défaut que moteur/video_avis.py (24/10/2026)
      const fond = va.fond === "photos" ? "#26282E" : va.fond === "accent" ? accent : hex(co.fond, "#FFFFFF");
      const encre = va.fond === "photos" ? "#FFFFFF" : [hex(co.texte, "#000000"), hex(co.fond, "#FFFFFF"), "#000000", "#FFFFFF"].find(x => vaContraste(x, fond) >= 4.5) || "#000000";
      const etoile = va.fond === "uni" && vaContraste(accent, fond) >= 3 ? accent : encre;
      const texte = premier ? premier.texte : t("va.apercu.vide"), taille = Math.max(13, Math.min(21, 21 - (VA.longueur(texte) - 60) / 22));
      const ap = $("va-apercu"); ap.style.background = fond; ap.style.color = encre;
      ap.innerHTML = `<p class="va-ap-nom" style="${vaPolice(s.auteur)}">${e(c.nom)}</p><div class="va-ap-centre"><span style="color:${etoile}">${vaEtoiles(premier ? premier.note : 5)}</span>
        <p class="va-ap-texte" style="${vaPolice(s.texte)};font-size:${taille.toFixed(1)}px"${premier ? lc() : ""}>${e(texte)}</p><p class="va-ap-auteur" style="${vaPolice(s.auteur)}">${premier ? e(premier.auteur) : ""}</p></div>`;
    };
    cases.forEach(i => i.onchange = () => { delete $("va-msg").dataset.fixe; if (i.checked) va.choisis.push(i.value); else va.choisis = va.choisis.filter(x => x !== i.value); maj(); });
    vue.querySelectorAll("input[name=va-fond]").forEach(i => i.onchange = () => { va.fond = i.value; maj(); });
    vue.querySelectorAll("input[name=va-style]").forEach(i => i.onchange = () => { va.style = i.value; maj(); });
    $("va-creer").onclick = async () => {
      try {
        $("va-creer").disabled = true; await D.demanderVideoAvis({ avis_ids: va.choisis, fond: va.fond, style: va.style });
        va.choisis = []; await photos(); $("va-msg").dataset.fixe = "1"; vaMsg(t("va.enregistree"));
      } catch (er) { $("va-msg").dataset.fixe = "1"; vaMsg(ph(er.message)); $("va-creer").disabled = va.choisis.length < VA.MIN; }
    };
    maj(); await vaSuivre();
  }
  // Adresse #/videoavis : l'écran Photos, section Vidéo d'avis dépliée et amenée à l'écran.
  async function videoAvis() {
    const premiere = !vaOuvert; vaOuvert = true; await photos();
    if (premiere && $("video-avis")) $("video-avis").scrollIntoView({ block: "start" });
  }
  // ---- fin du bloc Vidéo d'avis ------------------------------------------------------------------------------------

  // ---- Vos publications (kit de marque) -----------------------------------------------------------------------------
  // 31/10/2026 (décision produit) : le restaurateur ne « designe » pas, il VOIT ses publications et valide. Écran du groupe Réglages, entrée visible
  // sur l'accueil tant qu'il n'a pas validé : sa grille Instagram dessinée avec SES photos, le seul réglage « Texte sur vos photos » (jamais,
  // seulement pour vos annonces, souvent : marque.texte_photos, lu par le moteur), ses annonces, ses vidéos, ses couleurs et son logo (changement
  // par une demande à champs fixes, circuit demander_changement_style). Couleurs, polices et modèles : BoostImpact (console « Style du commerce »).
  // Écran partagé avec la console : marque.js, fonction ecran.
  const MQ = window.RENOM_MARQUE;
  Object.assign(ETAPES, I.carte("etape", ["MARQUE_PROPOSEE", "MARQUE_ENREGISTREE", "MARQUE_VALIDEE", "MARQUE_REGLEE_RENOM", "MARQUE_VALIDEE_RENOM", "STYLE_CHANGEMENT_DEMANDE",
    "MARQUE_APERCUS", "LOGO_ILLISIBLE", "VIDEO_GENEREE_REFUSEE"]));
  // Envoi de photos depuis « Vos publications » (aucune photo encore) : même chaîne que l'écran Photos (envoi.js, D.envoyerPhoto, D.deposerPhotos).
  async function envoyerDesPhotos(fs, dire) {
    const bonnes = [], erreurs = [];
    for (const f of fs) { const k = await EN.controler(f); if (k.genre !== "photo") erreurs.push(f.name); else if (k.raison) erreurs.push(f.name); else bonnes.push(f); }
    if (!bonnes.length) throw new Error(t("photos.aucune.envoyee"));
    const ens = EN.controlerPhotos(bonnes.length); if (ens) throw new Error(t("photos.ens." + ens.code, { n: ens.n, max: EN.REGLES.PHOTOS_MAX }));
    const recus = [];
    for (let i = 0; i < bonnes.length; i++) {
      const f = bonnes[i]; dire(t("photos.envoi.de", { nom: f.name, i: i + 1, n: bonnes.length }));
      try { const r = await D.envoyerPhoto(f, { nom: EN.nomPhoto(f) }); recus.push({ chemin: r.chemin, nom: f.name, taille: f.size }); } catch (er) { erreurs.push(f.name); }
    }
    if (!recus.length) throw new Error(t("photos.aucune.enregistree"));
    const r = await D.deposerPhotos(recus); majCompteurs();
    return { deposees: r.nb_photos, erreurs };
  }
  // En-tête selon la provenance (31/10/2026, test client) : arrivé de l'accueil, retour à l'accueil et pas de surtitre « Réglages ».
  let pubDepuis = "reglages";
  const styleEcran = MQ.ecran({ vue, I, mode: "commercant", entete: () => pubDepuis === "accueil" ? retourAuto("#/accueil", "cal.retour") + entete("", t("ecran.publications"), t("pub.chapo"))
    : retourAuto("#/reglages", "reg.retour") + entete(t("groupe.reglages"), t("ecran.publications"), t("pub.chapo")),
    commerce: () => D.commerce(), marque: () => D.marque(), deposerLogo: f => D.deposerLogo(f),
    regler: (p, v) => D.reglerMaMarque(p, v), demander: x => D.demanderChangementStyle(x), apres: async () => majCompteurs(),
    envoyerPhotos: envoyerDesPhotos, offre: c => offreDe(c),
    plein: async () => { const k = await D.compteur().catch(() => null); return !!(k && +k.publications_plafond > 0 && pubReservees(k) >= +k.publications_plafond); },
    // Ce que l'écran montre en plus des photos : les publications déjà rendues par le moteur (jamais une photo brute : la démonstration en crée
    // avec la photo seule, en data:), la dernière légende écrite, et la dernière vidéo montée (Premium).
    publications: async () => {
      const l = await D.contenus(), vivants = y => ["a_valider", "approuve", "programme", "publie"].includes(y.statut);
      const photos = l.filter(y => y.type !== "video" && (y.format || "publication") === "publication" && vivants(y)).slice(0, 12);
      const rendus = (await Promise.all(photos.map(async y => ({ url: await D.urlVisuel(y, "instagram").catch(() => null), gabarit: y.gabarit || null }))))
        .filter(x => x.url && !/^data:/.test(x.url));
      // Vidéo montée de préférence (dépôt de vidéos, ou vidéo tirée d'une photo) ; à défaut, la dernière vidéo (vidéo d'avis).
      const videos = l.filter(y => y.type === "video" && vivants(y)), v = videos.find(y => y.depot_video_id || y.photo_id) || videos[0];
      const video = v ? { url: await D.urlVideo(v).catch(() => null), image: v.visuel_url && !/^data:/.test(v.visuel_url) ? v.visuel_url : null } : null;
      return { rendus, legende: (photos[0] && photos[0].legende) || "", video: video && video.url ? video : null };
    } });
  // Entrée « Vos publications » : sur l'accueil (juste sous « À faire maintenant ») et dans Réglages tant que le commerçant n'a pas validé son
  // réglage « Texte sur vos photos » (marque.texte_photos posé et kit validé) ; ensuite une ligne discrète sur l'accueil (lienPublications)
  // et l'entrée de la liste des Réglages, pour modifier.
  const publicationsVues = c => !!(c.marque && c.marque.verrouille && c.marque.texte_photos);
  const carteStyle = (c, secondaire) => publicationsVues(c) ? "" : `<section class="carte style-accueil" id="carte-style" aria-labelledby="carte-style-titre"><div class="style-accueil-corps">
      <div><h2 id="carte-style-titre">${t("acc.pub.titre")}</h2><p class="texte2">${t(sansReseaux(c) ? "acc.pub.texte.google" : "acc.pub.texte")}</p></div></div>
      <p class="pied"><a class="bouton${secondaire ? " second" : ""}" href="#/publications" id="voir-publications">${t("acc.pub.bouton")}</a></p></section>`;
  const lienPublications = c => publicationsVues(c) ? `<p class="lien-accueil"><a class="lien-seul" href="#/publications" id="lien-publications">${t("acc.pub.lien")}</a></p>` : "";
  const style = () => styleEcran.rendre();
  // ---- fin du bloc Votre style ------------------------------------------------------------------------------------

  // ---------------- Routage
  const ROUTES = { connexion, accueil, resultats, fiche, photos, avalider, contenus, calendrier, avis, commentaires, collecte, fichegoogle: ficheGoogle, comptes, offre, notifications, demarrage, videoavis: videoAvis, publications: style, reglages };
  // Administrateur arrivé dans l'espace des commerçants (25/10/2026) : il le dit, avec « Ouvrir la console » et « Se connecter avec un autre compte »
  // (déconnexion, puis le formulaire de connexion). Même écran que la console pour un commerçant (console.js, refuse).
  function reserveCommercants() {
    connecte = false; derniere = null; dessinerNav();
    vue.innerHTML = `<div class="connexion"><div class="carte" id="acces-reserve"><div class="connexion-tete"><p class="logo" translate="no"><img class="logo-img" src="icones/logo-ligne-encre.png?v=pascal" width="482" height="80" alt="boost impact."></p>${I.selecteur()}</div>
      <div class="entete"><h1>${t("con.refuse.titre")}</h1><p class="chapo">${t("esp.admin.texte")}</p></div>
      <a class="bouton plein" href="${I.lien("console.html")}">${t("esp.admin.console")}</a><button type="button" class="bouton second plein" id="autre-compte">${t("acces.autre.compte")}</button></div></div>`;
    $("autre-compte").onclick = async () => { await D.quitter(); aller("accueil"); };
  }
  const aller = r => { if (location.hash === "#/" + r) rendre(); else location.hash = "#/" + r; };
  let derniere = null, langueLue = null, paramRoute = "";
  async function rendre() {
    // Lien d'email au nouveau format : avant toute session (une session déjà ouverte sur l'appareil ne doit pas masquer le choix du mot de passe).
    if (ACC.jeton) { connecte = false; derniere = null; dessinerNav(); return lienEmail(); }
    const r = (location.hash.replace("#/", "") || "accueil").split("?")[0], s = await D.session();
    // Ancienne adresse (par exemple #/idees) : remplacée par la nouvelle, sans ajouter d'étape dans l'historique.
    if (ANCIENNES[r]) { if (r === "idees") ideesOuvertes = true; history.replaceState(null, "", "#/" + ANCIENNES[r]); return rendre(); }
    // #/miseenroute (liens du calendrier, de l'accueil et des avis) : l'écran de la mise en route, sur « Pour démarrer » (27/10/2026) ;
    // #/demarrage?questions : directement les 5 questions (Mon commerce, « Modifier vos réponses »).
    if (r === "miseenroute") { dem.vue = "essentiel"; history.replaceState(null, "", "#/demarrage"); return rendre(); }
    if (r === "demarrage" && /\?questions/.test(location.hash)) { dem.vue = "questions"; history.replaceState(null, "", "#/demarrage"); return rendre(); }
    paramRoute = (location.hash.split("?")[1] || "");
    if (!s) { connecte = false; derniere = null; dessinerNav(); return connexion(); }
    // Lien d'email ouvert ici par un compte à double authentification (l'administrateur seul en a une, 18/10/2026) : la console demande le code.
    if (s.codeRequis) { location.href = I.lien("console.html"); return; }
    if (s.motDePasseRequis) { connecte = false; derniere = null; dessinerNav(); return choixMotDePasse(s); }
    if (s.role === "administrateur" && !(D.mode === "demo" && /(\?|&)voir\b/.test(location.search))) return reserveCommercants();
    // Langue : sans choix explicite (?lang= ou sélecteur), l'espace prend celle du commerce (la page se recharge une fois si elle change).
    if (s.role !== "administrateur" && langueLue !== s.email) {
      try { const c = await D.commerce(); langueCommerce = I.langueValide(c && c.langue) || "fr"; langueLue = s.email; if (I.depuisCommerce(langueCommerce)) return; } catch (er) {}
    }
    connecte = true; route = ECRANS[r] ? r : "accueil"; dessinerNav();
    if (route === "publications" && derniere !== route) pubDepuis = derniere === "accueil" ? "accueil" : "reglages";
    if (derniere !== route) noterOrigine(derniere, route, hashPrecedent);
    if (derniere !== route) { filtre = null; window.scrollTo(0, 0); if (route !== "contenus") ideesOuvertes = false; if (route !== "videoavis") vaOuvert = false; if (derniere === "demarrage") { dem.vue = null; if (dem.fini) dem.pour = null; } } derniere = route;
    hashPrecedent = location.hash || "#/" + route; ecranCourant = ROUTES[route];
    try { await ROUTES[route](); } catch (er) { vue.innerHTML = `<section class="carte"><h1>${t("souci")}</h1><p>${e(ph(er.message))}</p></section>`; }
    vue.focus({ preventScroll: true }); majCompteurs();
  }
  document.addEventListener("click", async ev => { if (ev.target.closest("#sortir")) { await D.quitter(); aller("accueil"); } });
  document.querySelectorAll("[data-o]").forEach(b => b.onclick = async () => { await D.outilsDemo[b.dataset.o](); rendre(); });
  // Hors session (écran de connexion), aucun compteur à demander : sans ce garde, passer la largeur de 900 px appelait la base sans session.
  large.addEventListener("change", () => { dessinerNav(); if (connecte) majCompteurs(); });
  window.addEventListener("hashchange", rendre); rendre();
  // Application installable : service worker (fichiers statiques de l'espace seulement, réseau d'abord pour la page et les scripts : voir sw.js).
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
})();
