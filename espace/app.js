(function () {
  const D = window.RENOM_DATA, $ = id => document.getElementById(id), vue = $("vue");
  // Textes, dates et nombres : espace/web/i18n.js (français ou anglais). Les contenus du commerce (légendes, avis, réponses, idées) restent dans sa langue.
  const I = window.RENOM_I18N, t = I.t, ph = I.phrase;
  const e = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MOIS = I.mois(), JOURS = I.joursCourts();
  const ST_PHOTO = I.carte("st.photo", ["a_traiter", "en_cours", "traitee", "refusee"]);
  const ST_CONTENU = I.carte("st.contenu", ["a_valider", "approuve", "modification", "programme", "publie", "refuse"]);
  const ST_PUB = I.carte("st.pub", ["programme", "envoye", "publie", "echec", "annule"]);
  const ST_AVIS = I.carte("st.avis", ["nouveau", "a_valider", "valide", "publie", "humain", "refuse", "escalade", "a_publier_main"]);
  const METIERS = I.carte("metier", ["restaurant", "beaute", "sport", "autre"]);
  const RES = I.carte("res", ["facebook", "instagram", "google", "tiktok"]);
  // Règle de publication des réponses aux avis, selon l'offre (moteur/avis/regles.js ; CGV article 8). Essentiel : tout est validé par le commerçant ;
  // Standard : 4 et 5 étoiles automatiques ; Premium : en plus, 1 à 3 étoiles traités par l'équipe BoostImpact. Un avis sensible n'est jamais automatique.
  const offreDe = c => (window.RENOM_OFFRES || {})[(c || {}).offre_id] || {};
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
  const brancherFiche = (id, apres) => { const f = $(id); if (!f) return;
    f.onsubmit = async ev => { ev.preventDefault(); const b = $(id + "-ok"); b.disabled = true;
      try { const r = await D.enregistrerFicheGoogle($(id + "-champ").value); await apres(); const z = $(id + "-etat"); if (z) z.textContent = (r && r.deja ? t("fg.deja") + " " : "") + t("fg.etat." + r.etat); }
      catch (er) { b.disabled = false; const z = $(id + "-etat"); if (z) z.textContent = ph(er.message); } }; };
  // Avis sensible en Essentiel : réponse proposée par l'équipe, à approuver dans l'espace (decider_avis_sensible) ; l'accord vaut s'il suit la proposition.
  const accordDonne = x => x.decision_client === "approuve" && !!x.propose_le && !!x.decision_client_le && x.decision_client_le >= x.propose_le;
  const sensibleADecider = (x, c) => merSql(c) && !equipeRepond(c) && x.sensible && x.statut === "humain" && !!x.propose_le && !!String(x.reponse_proposee || "").trim()
    && !(x.decision_client && x.decision_client_le && x.decision_client_le >= x.propose_le);
  // Mode délégation : Premium ET accepté par écrit par le commerçant (commerces.delegation_signee_le, saisi dans la console).
  const delegationActive = c => !!(offreDe(c).delegation && (c || {}).delegation_signee_le);
  // Avis : l'équipe répond et publie elle-même (avis de 1 à 3 étoiles et avis sensibles) en Standard et en Premium (offres.avis_equipe, 22/10/2026).
  const equipeRepond = c => !!(offreDe(c).avis_equipe || offreDe(c).delegation);
  // Règle des avis par offre : Premium ; Standard (avis_equipe, 22/10/2026) ; ancienne offre retirée (Croissance, Signature : 4 et 5 étoiles
  // automatiques, 1 à 3 étoiles proposées au commerçant, inchangée tant que son abonnement court) ; Essentiel.
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
    "VALIDATION_TACITE", "PROGRAMMATION_AUTO", "APPROUVE_NON_PROGRAMME", "PHOTOS_DEPOSEES", "VALIDATION_PAR_LIEN", "NOTIFICATION_VALIDATION", "BIENVENUE",
    "BILAN_ENVOYE", "AVIS_TRAITE", "AVIS_PROPOSE", "AVIS_RELANCE", "AVIS_EQUIPE", "AVIS_ESCALADE", "ACTION_FICHE_CREEE", "ACTION_FICHE_A_PUBLIER", "ACTION_FICHE_REFUSE",
    "IDEE_SEMAINE", "IDEE_RETENUE", "IDEE_ECARTEE", "CLIENTS_IMPORTES", "OPPOSITION_AJOUTEE", "DESINSCRIPTION", "MISE_EN_ROUTE", "MISE_EN_ROUTE_DECLAREE",
    "EMAIL_MISE_EN_ROUTE", "EMAIL_RELANCE_VALIDATION", "EMAIL_RELANCE_PHOTOS", "EMAIL_OFFRE_SUPERIEURE", "DELEGATION_SIGNEE", "DELEGATION_RETIREE", "RESEAUX_RETENUS",
    "GARANTIE_MANQUEMENT", "MOIS_OFFERT_APPLIQUE", "RELEVE_MENSUEL", "OPTION_COMMANDEE", "OPTION_ELEMENTS_RECUS", "OPTION_LIVREE", "OPTION_SECOND_TEST_REMIS",
    // Mise en route claire (27/10/2026, bloc SQL « Mise en route claire et travail visible »)
    "NOM_CONFIRME", "RAPPEL_DEMANDE", "FICHE_GOOGLE_DEMANDEE", "FICHE_GOOGLE_DEMANDE_ANNULEE", "FICHE_GOOGLE_VERIFIEE", "PHOTOS_AUTORISATION_REFUSEE", "AVIS_REPONSE_APPROUVEE", "AVIS_EN_PARLER",
    // Fiche Google du client venu du site et photos hors sujet (28/10/2026, bloc SQL du même nom)
    "FICHE_GOOGLE_LIEN", "FICHE_GOOGLE_IDENTIFIEE", "FICHE_GOOGLE_A_IDENTIFIER", "PHOTO_HORS_SUJET"]);
  const ST_ABO = I.carte("abo.st", ["en_attente", "actif", "impaye", "resilie"]);
  const M = window.RENOM_MAJ;
  // Vidéo animée par IA (24/10/2026) : étiquette sobre sur la carte (texte seul, ni trait de couleur, ni majuscules d'étiquette).
  const etiquetteIA = x => M.estIA(x) ? `<p class="etiquette-ia" data-ia>${t("ia.etiquette")}</p>` : "";
  const nombre = I.nombre;
  const moisDe = m => new Date(m.slice(0, 7) + "-15T12:00:00");
  const hm = I.hm;
  const creneauxTexte = metier => I.liste((M.CRENEAUX[metier] || M.CRENEAUX.autre).map(x => hm(x)));

  // ---------------- Dates et heures, dans la langue de l'interface (i18n.js)
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const jourMois = I.jourMois, date = I.date, heure = I.heure, heureCourte = I.heureCourte, dateHeure = I.dateHeure;
  const memeJour = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const jourRelatif = d => { const j = new Date(d), n = new Date(), h = new Date(Date.now() - 86400000); return memeJour(j, n) ? t("jour.aujourdhui") : memeJour(j, h) ? t("jour.hier") : cap(date(d)); };
  const jourLocal = d => { d = new Date(d); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const heureLocale = d => { d = new Date(d); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  const demain = () => jourLocal(Date.now() + 86400000);

  const cut = (s, n) => s.length > n ? s.slice(0, s.lastIndexOf(" ", n)) + "…" : s;
  const msg = x => { const m = $("msg"); if (m) m.textContent = x; };
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
  const mesure = (nom, u, n) => `<div class="mesure"><div class="mesure-tete"><span>${nom}</span><span>${t("sur.chiffre", { a: `<span class="chiffre">${u}</span>`, b: n })}</span></div>${jauge(u, n)}</div>`;
  const vignette = u => u ? `<img class="vignette" src="${e(u)}" alt="">` : `<span class="vignette vide" aria-hidden="true"></span>`;
  const FORMAT_LIB = I.carte("format.lib", ["publication", "story", "video"]);
  const media = (x, u, v) => `<div class="media">${v ? `<video class="visuel" controls preload="metadata" poster="${e(u || "")}" src="${e(v)}"></video>` : u ? `<img class="visuel" src="${e(u)}" alt="${t("visuel.alt")}">` : `<div class="visuel vide">${t("apercu.indispo")}</div>`}</div>`;
  // Les trois décisions sur un contenu à valider : mêmes boutons et mêmes appels sur l'accueil et sur l'écran Contenus.
  // La légende se modifie soi-même (voir blocReseaux) ; « Demander une modification à BoostImpact » reste pour ce qu'on ne peut pas faire seul, comme le visuel.
  const decisions = (x, refus) => `<div class="actions" data-choix><button type="button" class="bouton" data-a="approuve">${t("dec.approuver")}</button><button type="button" class="bouton second" data-a="modif">${t("dec.modif")}</button><button type="button" class="lien" data-a="refuse">${refus}</button></div>
    <div class="f" data-zone hidden><label for="mot-${e(x.id)}">${t("dec.mot")}</label><textarea id="mot-${e(x.id)}" data-mot></textarea>
      <div class="actions"><button type="button" class="bouton" data-a="envoyer-modif">${t("dec.envoyer")}</button><button type="button" class="lien" data-a="fermer-modif">${t("annuler")}</button></div></div>`;
  // Dernier contenu approuvé : {id, p}. La base le programme à l'approbation (schema.sql, bloc « Programmation à l'approbation ») ; p est sa
  // publication, relue dans le calendrier : on affiche la date. Rien de programmé (aucun réseau connecté, commerce en pause…) : p est nul et
  // l'écran propose de le programmer au meilleur créneau.
  let approuveRecent = null;
  const texteProgramme = p => t("auto.programme", { quand: I.dateHeureDans(p.prevu_le), res: (p.reseaux || []).map(r => RES[r]).join(", ") });
  const publicationDe = async id => { try { return (await D.calendrier()).find(x => x.contenu_id === id && x.statut === "programme") || null; } catch (er) { return null; } };
  function brancherDecisions(racine, apres) {
    racine.querySelectorAll("[data-contenu]").forEach(a => a.addEventListener("click", async ev => {
      const b = ev.target.closest("[data-a]"); if (!b) return; const id = a.dataset.contenu, act = b.dataset.a, zone = a.querySelector("[data-zone]"), choix = a.querySelector("[data-choix]");
      if (!["approuve", "modif", "fermer-modif", "envoyer-modif", "refuse"].includes(act)) return;
      try {
        if (act === "modif") { zone.hidden = false; choix.hidden = true; a.querySelector("[data-mot]").focus(); return; }
        if (act === "fermer-modif") { zone.hidden = true; choix.hidden = false; return; }
        if (act === "envoyer-modif") await D.valider(id, "modification", a.querySelector("[data-mot]").value);
        else await D.valider(id, act);
        approuveRecent = act === "approuve" ? { id, p: await publicationDe(id) } : null;
        const p = approuveRecent && approuveRecent.p;
        // 27/10/2026 (constat 32) : ce qui se passe ensuite, pas seulement « Enregistré ».
        await apres(); msg(act === "approuve" ? (p ? t("dec.valide.prevu", { quand: I.dateHeureDans(p.prevu_le) }) : t("dec.valide")) : act === "envoyer-modif" ? t("dec.modif.envoyee") : t("dec.refuse.msg")); majCompteurs();
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
  const ORDRE_RES = ["instagram", "facebook", "google", "tiktok"];
  const vus = new Map(), choixRes = {};   // contenu affiché (id -> {x, u, v}) ; réseau choisi par contenu
  let nomCommerce = "";
  function cadre(id) {
    const { x, u: u45, v, u9 } = vus.get(id), r = choixRes[id] || "instagram", f = M.formatDe(x), vertical = f !== "publication" || r === "tiktok";
    const u = r === "tiktok" && M.photoPublication(x) ? u9 : u45;   // TikTok : le visuel 9:16 qui part réellement, jamais le 4:5 dans un cadre vertical
    if (!M.reseauxPour(x).includes(r)) return `<div class="cadre-vide"><p class="texte2">${t(f === "video" ? "cadre.video.google" : "cadre.story.google")}</p><p class="note">${t("cadre.choisir")}</p></div>`;
    const l = M.legendeDe(x, r), n = M.longueur(l), lim = r === "google" ? M.LIMITE_GOOGLE : 0;
    const visuel = v ? `<video class="visuel" controls preload="metadata" poster="${e(u || "")}" src="${e(v)}"></video>` : u ? `<img class="visuel" src="${e(u)}" alt="${t("visuel.alt")}">` : `<div class="visuel vide">${t("apercu.indispo")}</div>`;
    const tete = `<div class="cadre-tete"><span class="avatar" aria-hidden="true">${e((nomCommerce || "R").charAt(0).toUpperCase())}</span><span class="cadre-nom">${e(nomCommerce)}</span><span class="cadre-res">${RES[r]}${f === "story" ? t("cadre.story") : ""}</span></div>`;
    const texte = `<p class="cadre-texte" data-legende${lc()}>${r === "instagram" && f === "publication" ? `<span class="fort">${e(nomCommerce)}</span> ` : ""}${e(l)}</p>`;
    const corps = r === "facebook" ? tete + (f === "publication" ? texte + visuel : visuel + texte) : r === "tiktok" ? visuel + tete + texte : tete + visuel + texte;
    return `<div class="cadre cadre-${r}${vertical ? " vertical" : ""}">${corps}</div>
      <p class="note" data-compte>${t("car", { n })}${lim ? t("car.sur", { lim: nombre(lim) }) + (n > lim ? t("car.trop.google") : "") : ""}</p>`;
  }
  function blocReseaux(x, u, v, u9) {
    vus.set(x.id, { x, u, v, u9 }); const r = choixRes[x.id] || "instagram", modifiable = (x.statut === "a_valider" || x.statut === "approuve") && M.reseauxPour(x).includes(r);
    // Onglets : seulement les réseaux où ce format peut partir (24/10/2026) : ni vidéo ni story sur la fiche Google, donc pas d'onglet « Fiche Google ».
    const ordre = ORDRE_RES.filter(k => M.reseauxPour(x).includes(k));
    return `<div class="reseaux" data-reseaux="${e(x.id)}">
      <div class="res-onglets" role="tablist" aria-label="${t("res.onglets")}">${ordre.map(k => `<button type="button" role="tab" id="t-${e(x.id)}-${k}" data-res="${k}" aria-selected="${k === r}" tabindex="${k === r ? 0 : -1}">${RES[k]}</button>`).join("")}</div>
      <div class="res-panneau" role="tabpanel" aria-labelledby="t-${e(x.id)}-${r}">${cadre(x.id)}</div>
      ${modifiable ? `<div class="f" data-edition hidden><label for="leg-${e(x.id)}">${t("leg.pour", { res: RES[r] })}</label><textarea id="leg-${e(x.id)}" class="haut-texte" data-texte-legende${lc()}></textarea>
        <p class="note" data-compte-edition aria-live="polite"></p>
        <div class="actions"><button type="button" class="bouton petit" data-a="leg-enregistrer">${t("leg.enregistrer")}</button><button type="button" class="lien" data-a="leg-annuler">${t("annuler")}</button></div></div>
        <button type="button" class="lien leg-modifier" data-a="leg-modifier">${t("leg.modifier", { res: RES[r] })}</button>` : ""}
    </div>`;
  }
  // Avant de valider une publication photo : les deux visuels qui partent, côte à côte, à la même hauteur, avec leurs réseaux.
  // 4:5 pour Instagram, Facebook et Google ; 9:16 pour TikTok (metricool_api.chemin_media). Story et vidéo : un seul fichier, rien à montrer de plus.
  const fig = (u, alt, res, fmt, cls) => `<figure class="format ${cls}">${u ? `<img src="${e(u)}" alt="${alt}">` : `<div class="format-vide"><p class="note">${t("apercu.indispo")}</p></div>`}
    <figcaption><span class="fort">${res}</span><span class="note">${fmt}</span></figcaption></figure>`;
  const formatsPublies = (x, u, u9) => M.photoPublication(x) ? `<details class="formats" aria-label="${t("fmt.titre")}"><summary class="fort">${t("fmt.titre")}</summary>
    <div class="formats-rangee">${fig(u, t("fmt.alt.45"), t("fmt.res.45"), t("fmt.45"), "f45")}${fig(u9, t("fmt.alt.916"), t("fmt.res.916"), t("fmt.916"), "f916")}</div>
    <p class="note">${t("fmt.note")}</p></details>` : "";
  const compteEdition = (r, x) => { const n = M.longueur(x), lim = r === "google" ? M.LIMITE_GOOGLE : 0; return `${t("car", { n })}${lim ? t("car.sur", { lim: nombre(lim) }) : ""}${lim && n > lim ? t("car.trop.google.phrase") : ""}`; };
  function redessinerReseaux(b, focus) {
    const id = b.dataset.reseaux, { x, u, v, u9 } = vus.get(id); const d = document.createElement("div"); d.innerHTML = blocReseaux(x, u, v, u9); const neuf = d.firstElementChild; b.replaceWith(neuf);
    if (focus) neuf.querySelector(`[data-res="${choixRes[id]}"]`).focus();
  }
  // Programmer au meilleur créneau : réseaux connectés compatibles avec le format, créneau de départ du métier.
  async function programmerAuto(id) {
    const [x, cpt] = await Promise.all([D.contenus().then(l => l.find(y => y.id === id)), D.comptes()]);
    if (!x) throw new Error(t("err.contenu.introuvable"));
    const res = cpt.filter(k => k.etat === "connecte").map(k => k.reseau).filter(r => M.reseauxPour(x).includes(r));
    if (!res.length) throw new Error(t("err.aucun.reseau"));
    const quand = await D.programmerAuto(id, res); approuveRecent = null;
    return t("auto.programme", { quand: I.dateHeureDans(quand), res: res.map(r => RES[r]).join(", ") });
  }
  const boutonsAuto = (id, metier) => `<div class="actions"><button type="button" class="bouton" data-auto="${e(id)}">${t("auto.bouton")}</button><a class="bouton second" href="#/calendrier">${t("auto.moi")}</a></div>
    <p class="note">${t("auto.creneaux", { h: creneauxTexte(metier) })}</p>`;
  async function proposition(c) {
    if (!approuveRecent) return "";
    // Programmé à l'approbation : la date et les réseaux, une fois, à la place du bouton.
    if (approuveRecent.p) { const p = approuveRecent.p; approuveRecent = null;
      return `<section class="carte proposition" id="proposition" data-programme><div><p class="fort">${t("prop.programme.titre")}</p><p class="texte2">${texteProgramme(p)}</p></div>
        <div class="actions"><a class="bouton second" href="#/calendrier">${t("acc.ouvrir.calendrier")}</a></div></section>`; }
    const x = (await D.contenus()).find(y => y.id === approuveRecent.id);
    if (!x || x.statut !== "approuve") { approuveRecent = null; return ""; }
    return `<section class="carte proposition" id="proposition"><div><p class="fort">${t("prop.titre")}</p><p class="texte2">${t("prop.texte")}</p></div>${boutonsAuto(x.id, c.metier)}</section>`;
  }
  // Un seul écouteur pour tout l'écran : onglets de réseau, édition de la légende, programmation au meilleur créneau.
  let ecranCourant = null;
  vue.addEventListener("click", async ev => {
    const onglet = ev.target.closest("[data-res]");
    if (onglet) { const b = onglet.closest("[data-reseaux]"); choixRes[b.dataset.reseaux] = onglet.dataset.res; redessinerReseaux(b, true); return; }
    const auto = ev.target.closest("[data-auto]");
    if (auto) { auto.disabled = true; try { const m = await programmerAuto(auto.dataset.auto); await ecranCourant(); msg(m); majCompteurs(); } catch (er) { auto.disabled = false; msg(ph(er.message)); } return; }
    const a = ev.target.closest("[data-a^='leg-']"); if (!a) return;
    const b = a.closest("[data-reseaux]"), id = b.dataset.reseaux, r = choixRes[id] || "instagram", ed = b.querySelector("[data-edition]"), ta = b.querySelector("[data-texte-legende]"), bt = b.querySelector(".leg-modifier");
    if (a.dataset.a === "leg-modifier") { ta.value = M.legendeDe(vus.get(id).x, r); b.querySelector("[data-compte-edition]").textContent = compteEdition(r, ta.value); ed.hidden = false; bt.hidden = true; ta.focus(); return; }
    if (a.dataset.a === "leg-annuler") { ed.hidden = true; bt.hidden = false; bt.focus(); return; }
    try { await D.modifierLegende(id, r, ta.value); await ecranCourant(); msg(t("leg.enregistree", { res: RES[r] })); } catch (er) { msg(ph(er.message)); }
  });
  vue.addEventListener("input", ev => { const ta = ev.target.closest("[data-texte-legende]"); if (!ta) return; const b = ta.closest("[data-reseaux]"); b.querySelector("[data-compte-edition]").textContent = compteEdition(choixRes[b.dataset.reseaux] || "instagram", ta.value); });
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
  const REGLAGES = { id: "reglages", ecrans: ["reglages", "offre", "comptes", "notifications", "style", "fiche", "fichegoogle", "demarrage"] };
  GROUPES.concat(REGLAGES).forEach(g => { g.nom = t("groupe." + g.id); });
  const ECRANS = I.carte("ecran", ["accueil", "resultats", "photos", "avalider", "contenus", "calendrier", "avis", "commentaires", "collecte", "fichegoogle", "fiche", "offre", "comptes",
    "notifications", "demarrage", "videoavis", "style", "reglages"]);
  // Anciennes adresses : elles mènent toujours quelque part (aucun lien cassé).
  const ANCIENNES = { idees: "contenus" };
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
  const lienGroupe = (g, icone) => `<a href="#/${g.ecrans[0]}" data-r="${g.ecrans[0]}" data-ecrans="${g.ecrans.join(" ")}"${g.ecrans.includes(route) ? ` aria-current="${g.ecrans[0] === route ? "page" : "true"}"` : ""}>${icone
    ? `<span class="onglet-icone">${ICONES[g.id]}${g.compte ? compte(g.compte) : ""}</span><span>${g.nom}</span>` : `<span>${g.nom}</span>${g.compte ? compte(g.compte) : ""}`}</a>`;
  function dessinerNav() {
    document.body.classList.toggle("hors-session", !connecte);
    const lat = $("lat"), haut = $("haut"), sous = $("sous"), onglets = $("onglets");
    lat.innerHTML = haut.innerHTML = sous.innerHTML = onglets.innerHTML = "";
    if (!connecte) return;
    const actif = groupeDe(route);
    // Sections d'un écran en plusieurs parties (À valider, Résultats) : une rangée de liens au-dessus du contenu, sur téléphone comme sur ordinateur.
    const secs = (actif.sections || []).filter(r => r !== "commentaires" || commentairesInclus || route === r);
    sous.innerHTML = secs.length > 1 ? secs.map(r => `<a href="#/${r}" data-r="${r}"${r === route ? ' aria-current="page"' : r === "avis" && route === "collecte" ? ' aria-current="true"' : ""}><span>${ECRANS[r]}</span>${COMPTE_ECRAN[r] ? compte(COMPTE_ECRAN[r]) : ""}</a>`).join("") : "";
    sous.setAttribute("aria-label", actif.nom);
    if (large.matches) {
      lat.innerHTML = `<div class="lat-in"><a class="logo" href="#/accueil" translate="no">boostimpact<span class="logo-point">.</span><span class="logo-suffixe">agency</span></a><nav id="nav" class="menu" aria-label="${t("nav.espace")}"><div class="groupe">${GROUPES.map(g => lienGroupe(g)).join("")}</div>
        <div class="groupe groupe-reglages">${lienGroupe(REGLAGES)}</div></nav><div class="lat-pied">${I.selecteur()}<button type="button" id="sortir" class="quitter">${t("quitter")}</button></div></div>`;
      return;
    }
    haut.innerHTML = `<a class="logo" href="#/accueil" translate="no">boostimpact<span class="logo-point">.</span><span class="logo-suffixe">agency</span></a><span class="haut-note" id="haut-offre">${offreNom ? t("offre.nom", { nom: e(offreNom) }) : ""}</span>${I.selecteur()}<nav class="haut-reglages" aria-label="${REGLAGES.nom}">${lienGroupe(REGLAGES, true)}</nav>`;
    onglets.setAttribute("aria-label", t("nav.espace"));
    onglets.innerHTML = GROUPES.map(g => lienGroupe(g, true)).join("");
  }
  // Décisions en attente par section (badges) ; « À valider » les additionne.
  async function compterAValider() {
    const [ct, av, k, cm, c] = await Promise.all([D.contenus(), D.avis(), D.compteur(), D.commentaires().catch(() => []), D.commerce()]);
    return { k, contenus: ct.filter(x => x.statut === "a_valider").length, avis: av.filter(x => (x.statut === "a_valider" && !x.sensible) || sensibleADecider(x, c)).length,
      commentaires: k.commentaires_inclus ? cm.filter(x => x.statut === "a_valider" || x.statut === "humain").length : 0 };
  }
  async function majCompteurs() {
    try {
      const n = await compterAValider();
      nb.contenus = n.contenus; nb.avis = n.avis; nb.commentaires = n.commentaires; nb.avalider = n.contenus + n.avis + n.commentaires;
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
  const ideeHoraires = x => /^Vos horaires du jour férié/.test(String(x.titre || ""));
  function blocIdeeSemaine(x) {
    if (!x) return "";
    return `<section class="carte" id="idee-semaine" data-idee="${e(x.id)}" aria-labelledby="idee-titre"><div class="carte-tete"><h2 id="idee-titre">${t("idee.semaine")}</h2><span class="note">${ORIGINES[x.origine] || ""}</span></div>
      <p class="fort"${lc()}>${e(x.titre)}</p><p class="texte2"${lc()}>${e(x.texte)}</p>${x.motif ? `<p class="note"${lc()}>${e(x.motif)}</p>` : ""}
      <div class="actions"><button type="button" class="bouton" data-decider-idee="retenue"${ideeHoraires(x) ? ' data-vers-horaires="1"' : ""}>${t(ideeHoraires(x) ? "idee.horaires" : "idee.retenir")}</button><button type="button" class="lien" data-decider-idee="ecartee">${t("idee.ecarter")}</button></div>
      <p class="note">${t(ideeHoraires(x) ? "idee.note.horaires" : "idee.note")}</p></section>`;
  }
  function brancherAutomatisations(racine, apres) {
    racine.querySelectorAll("[data-declarer]").forEach(b => b.onclick = async () => { try { await D.declarerMiseEnRoute(b.dataset.declarer); await apres(); msg(t("mer.merci")); } catch (er) { msg(ph(er.message)); } });
    racine.querySelectorAll("[data-decider-idee]").forEach(b => b.onclick = async () => {
      const id = b.closest("[data-idee]").dataset.idee, d = b.dataset.deciderIdee;
      try { await D.deciderIdee(id, d); if (b.dataset.versHoraires) { typeAction = "horaires"; aller("fichegoogle"); return; } await apres(); msg(t(d === "retenue" ? "idee.retenue.msg" : "idee.ecartee.msg")); majCompteurs(); } catch (er) { msg(ph(er.message)); } });
  }

  // ---------------- Accueil (25/10/2026) : « ce que vous avez à faire maintenant ». En tête, un bouton par action en attente (contenus, réponses
  // d'avis, commentaires, mise en route, démarrage, photos du mois) ; puis les prochaines publications (le calendrier devient ce bloc ; le calendrier
  // complet reste à #/calendrier) ; puis l'idée de la semaine. Le bilan du mois est passé dans Résultats ; l'offre, la fiche et le style dans Réglages.
  // Bilan du mois : 4 chiffres au plus et une phrase. Mêmes données que l'email du 1er du mois (fonction bilan_mois).
  const bandeauDemo = () => D.mode === "demo" ? `<div class="bandeau-demo" role="note"><p class="fort">${t("demo.chiffres")}</p><p>${t("demo.chiffres.texte")}</p></div>` : "";
  function bilanBloc(b) {
    if (!b) return "";
    const m = moisDe(b.mois || k0()), notes = b.note_debut != null && b.note_fin != null, n = x => +x || 0;
    const morceaux = [t("bilan.publie", { r: n(b.reponses_publiees), p: n(b.publications) }),
      t(b.avis_obtenus_source === "avis_recus" ? "bilan.recu" : "bilan.obtenu", { n: n(b.avis_obtenus) }) + (notes ? (b.note_fin === b.note_debut ? t("bilan.note.reste", { n: nombre(b.note_fin, 1) }) : t("bilan.note.passe", { a: nombre(b.note_debut, 1), b: nombre(b.note_fin, 1) })) : ".")];
    if (n(b.a_valider)) morceaux.push(t("bilan.attend", { n: n(b.a_valider) }));
    const chiffre = (lib, val) => `<div class="bilan-chiffre"><dt>${lib}</dt><dd class="chiffre">${val}</dd></div>`;
    return `<section class="carte bilan" aria-labelledby="bilan-titre"><div class="carte-tete"><h2 id="bilan-titre">${t("bilan.titre", { mois: m.getMonth() })}</h2><span class="note">${t("bilan.a.ce.jour")}</span></div>
      ${D.mode === "demo" ? `<p class="note bilan-demo"><span class="fort">${t("demo.chiffres.point")}</span> ${t("bilan.demo")}</p>` : ""}
      <p class="texte2">${morceaux.join(" ")}</p>
      <dl class="bilan-chiffres">${chiffre(t("bilan.reponses"), nombre(n(b.reponses_publiees)))}${chiffre(t("bilan.publications"), nombre(n(b.publications)))}${chiffre(t("bilan.note"), notes ? nombre(b.note_fin, 1) : t("non.lue"))}${chiffre(t("bilan.avis"), nombre(n(b.avis_obtenus)))}</dl></section>`;
  }
  // Offre souscrite, en haut de l'accueil (26/10/2026, test réel de PJ : « Bonjour » et le nom du commerce, sans l'offre ; sur téléphone, la note de l'en-tête
  // est masquée sous 420 px). Nom de l'offre, une ligne sur ce qu'elle comprend (chiffres de moteur/offres.json, via window.RENOM_OFFRES), lien vers
  // l'écran Offre (Réglages). Texte sobre : ni badge, ni couleur d'accent.
  function offreAccueil(c) {
    const o = offreDe(c); if (!o.nom) return "";
    const ligne = t("acc.offre.inclus", { n: o.contenus ?? ((o.publications || 0) + (o.videos || 0)), v: o.videos || 0, g: o.reseaux_sociaux === false, cm: !!o.commentaires });
    return `<div class="offre-accueil" id="offre-accueil"><p class="fort" id="offre-accueil-nom">${e(t("offre.nom", { nom: c.offre_id }))}</p>
      <p class="texte2" id="offre-accueil-inclus">${e(ligne)}</p><p><a href="#/offre" id="offre-accueil-lien">${t("acc.voir.offre")}</a></p></div>`;
  }
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
  // Autorisation photos sur l'accueil : une ligne (texte complet dans Photos), plus jamais après « Non merci » (photos_autorisation_refusee_le).
  const ligneAutorisation = c => autorisationAJour(c) || c.photos_autorisation_refusee_le ? "" : `<p class="ligne-autorisation" id="autorisation-ligne">${t("aut.ligne")}
      <a href="#/photos?autorisation" id="aut-oui">${t("aut.autoriser")}</a>${merSql(c) ? `<button type="button" class="lien" id="aut-non">${t("aut.non")}</button>` : ""}</p>`;
  const k0 = () => new Date().toISOString().slice(0, 7) + "-01";
  const plusTard = id => { try { return localStorage.getItem("renom-demarrage-plus-tard:" + id) === "1"; } catch (er) { return false; } };
  // Photos du mois : aucune photo envoyée depuis le 1er du mois (heure de l'appareil), commerce actif.
  const debutDuMois = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
  async function accueil() {
    const c0 = await D.commerce();
    // Nom du commerce à confirmer (27/10/2026) : toujours d'abord, même après « Faire plus tard » (aucune demande d'avis ne part sans lui).
    if (nomAConfirmer(c0) || (!c0.demarrage_fini && !plusTard(c0.id))) return demarrage();
    const [c, k, p, ct, av, cal, mr, ids, cm0] = await Promise.all([D.commerce(), D.compteur(), D.photos(), D.contenus(), D.avis(), D.calendrier(),
      D.miseEnRoute().catch(() => null), D.idees().catch(() => []), D.commentaires().catch(() => [])]);
    const nonLus = await retoursNonLus();
    const cm = k.commentaires_inclus ? cm0 : [], cmValider = cm.filter(x => x.statut === "a_valider"), cmHumains = cm.filter(x => x.statut === "humain");
    const idee = ids.find(x => x.semaine && x.statut === "a_valider") || null;
    nomCommerce = c.nom;
    const aValider = ct.filter(x => x.statut === "a_valider"), reponses = av.filter(x => x.statut === "a_valider" && !x.sensible), humains = av.filter(x => x.statut === "humain");
    const prochaines = cal.filter(x => x.statut === "programme").slice(0, 3), vign = await Promise.all(prochaines.map(x => urlSure(x.contenu)));
    // Sous-titre : le nombre de validations (contenus, réponses aux avis, réponses aux commentaires) et leur durée (environ 40 secondes chacune).
    // Un avis sensible n'en fait pas partie (décision de PJ du 22/10/2026) : l'équipe s'en charge, le commerçant n'a rien à faire.
    const aDecider = av.filter(x => sensibleADecider(x, c));
    const nv = aValider.length + reponses.length + cmValider.length + aDecider.length, na = cmHumains.length + (idee ? 1 : 0) + (nonLus ? 1 : 0), merEnCours = !!(mr && mr.points && mr.faits < mr.total);
    const phrase = nv ? t("acc.validations", { n: nv, m: Math.max(1, Math.round(nv * 40 / 60)) }) : na ? t("acc.choses", { n: na }) : t(merEnCours ? "acc.reste.mer" : "acc.a.jour");
    const raisons = [...new Set(humains.flatMap(x => x.raisons || []))];
    const photosDuMois = p.filter(x => Date.parse(x.cree_le) >= debutDuMois()).length;
    // Un bouton par action en attente, dans l'ordre des gestes : valider, puis mettre en route, puis envoyer les photos.
    const actions = [
      aValider.length ? { id: "contenus", href: "#/contenus", texte: t("acc.act.contenus", { n: aValider.length }) } : null,
      reponses.length ? { id: "avis", href: "#/avis", texte: t("acc.act.avis", { n: reponses.length }) } : null,
      aDecider.length ? { id: "avis-sensible", href: "#/avis", texte: t("acc.act.sensible", { n: aDecider.length }) } : null,
      cmValider.length + cmHumains.length ? { id: "commentaires", href: "#/commentaires", texte: t("acc.act.commentaires", { n: cmValider.length + cmHumains.length }) } : null,
      merEnCours ? { id: "mise-en-route", href: "#/miseenroute", texte: t("acc.act.mer", { a: mr.faits, b: mr.total }) } : null,
      !c.demarrage_fini ? { id: "demarrage", href: "#/demarrage", texte: t("acc.dem.reprendre") } : null,
      !c.en_pause && !photosDuMois ? { id: "photos", href: "#/photos", texte: sansReseaux(c) ? t("acc.act.photos.google", { n: pubGoogle(c) }) : t("acc.act.photos") } : null,
      // Retour privé d'un client non lu (constat 33) : une action ici, plus une pastille sur Résultats.
      nonLus ? { id: "retours", href: "#/collecte?retours", texte: t("acc.act.retours", { n: nonLus }) } : null,
    ].filter(Boolean);
    vue.innerHTML = `${pauseBandeau(c)}
      ${humains.length ? `<section class="alerte" id="alerte-avis-sensibles"><div><p class="fort">${t("acc.humains.titre", { n: humains.length })}</p>
        <p>${raisons.length ? t("acc.motif", { r: e(raisonsTexte(raisons)) }) + " " : ""}${t(equipeRepond(c) ? "acc.humains.texte.equipe" : merSql(c) ? "acc.humains.texte.espace" : "acc.humains.texte", { n: humains.length })}</p></div><a class="bouton second" href="#/avis">${t("acc.humains.lire", { n: humains.length })}</a></section>` : ""}
      <div class="entete-accueil"><div class="entete"><p class="sur">${t("acc.bonjour")}</p><h1>${e(c.nom)}</h1><p class="chapo">${phrase}</p>${ligneSemaine(c, av, cal, cm)}${offreAccueil(c)}</div>
        <a class="bouton grand" id="envoyer-photo" href="#/photos">${APPAREIL}<span>${t("acc.envoyer.photo")}</span></a></div>
      <p class="msg" id="msg" role="status"></p>
      <section class="carte" id="a-faire" aria-labelledby="a-faire-titre"><h2 id="a-faire-titre">${t("acc.afaire.titre")}</h2>
        ${actions.length ? `<ul class="actions-attente">${actions.map(a => `<li>${a.vers ? `<button type="button" class="bouton second" data-action="${a.id}" data-vers="${a.vers}">${a.texte}</button>`
          : `<a class="bouton second" data-action="${a.id}" href="${a.href}">${a.texte}</a>`}</li>`).join("")}</ul>` : `<p class="texte2" id="a-faire-rien">${t("acc.a.jour")}</p>`}</section>
      ${blocMiseEnRoute(mr, c)}
      ${ligneAutorisation(c)}
      ${carteStyle(c, true)}
      <section class="carte" id="prochaines" aria-labelledby="prochaines-titre">
        <div class="carte-tete"><h2 id="prochaines-titre">${t("acc.prochaines")}</h2></div>
        ${prochaines.length ? `<ul class="liste">${prochaines.map((x, i) => `<li class="avec-vignette">${vignette(vign[i])}<div><p class="fort">${dateHeure(x.prevu_le)}</p><p class="note">${x.reseaux.map(r => RES[r]).join(", ")}</p></div></li>`).join("")}</ul>`
        : `<p class="texte2">${t("acc.rien.programme")}</p>`}
        <p class="pied"><a href="#/calendrier" id="ouvrir-calendrier">${t("acc.ouvrir.calendrier")}</a></p>
      </section>
      ${blocIdeeSemaine(idee)}`;
    vue.querySelectorAll("[data-vers]").forEach(b => b.onclick = () => { const x = $(b.dataset.vers); if (x) { x.scrollIntoView({ block: "start" }); const f = x.querySelector("button, a"); if (f) f.focus({ preventScroll: true }); } });
    brancherAutomatisations(vue, accueil);
    if ($("aut-non")) $("aut-non").onclick = async () => { try { await D.refuserAutorisationPhotos(); await accueil(); msg(t("aut.non.merci")); } catch (er) { msg(ph(er.message)); } };
  }

  // ---------------- Réglages (25/10/2026) : tout ce qui se règle une fois, rangé derrière un seul lien de l'en-tête. Chaque écran garde son adresse.
  const ENTREES_REGLAGES = ["offre", "comptes", "notifications", "style", "fiche", "fichegoogle", "demarrage"];
  async function reglages() {
    const c = await D.commerce();
    vue.innerHTML = `${entete("", t("ecran.reglages"), t("reg.chapo"))}
      ${carteStyle(c, false)}
      <nav class="carte reglages" id="reglages" aria-label="${t("ecran.reglages")}"><ul class="liste">${ENTREES_REGLAGES.map(r => { const g = r === "comptes" && sansReseaux(c) ? ".google" : "";
        return `<li><a href="#/${r}" data-r="${r}"><span class="pile serre"><span class="fort">${t("reg." + r + g)}</span><span class="note">${t("reg." + r + ".texte" + g)}</span></span></a></li>`; }).join("")}</ul></nav>
      ${large.matches ? "" : `<p class="pied-reglages"><button type="button" id="sortir" class="bouton second">${t("quitter")}</button></p>`}`;
  }

  // ---------------- Fiche
  async function fiche() {
    const c = await D.commerce(), v = k => e(c[k] ?? ""), co = c.couleurs || {};
    const dm = c.demarrage || {}, sienne = x => x ? `<span${lc()}>${e(x)}</span>` : "";
    const rep = (lib, val) => `<li><span class="note">${lib}</span><span>${val || `<span class="note">${t("fiche.pas.reponse")}</span>`}</span></li>`;
    vue.innerHTML = `${retour("#/reglages", "reg.retour")}${entete(t("fiche.sur"), t("fiche.titre"), t("fiche.chapo"))}
    <section class="carte fiche demarrage-resume"><div class="carte-tete"><h2>${t("fiche.dem.titre")}</h2><a href="#/demarrage">${t(c.demarrage_fini ? "fiche.dem.modifier" : "fiche.dem.repondre")}</a></div>
      ${c.demarrage ? `<ul class="liste reponses">${rep(t("q.phrase.titre"), sienne(dm.phrase))}${rep(t("q.distinctions.titre"), sienne(dm.distinctions))}${rep(t("fiche.dem.ton"), e(TONS_LIB[dm.ton] || ""))}${rep(t("q.interdits.titre"), sienne(dm.interdits))}${rep(t("fiche.dem.action"), dm.action ? e(ACTIONS_LIB[dm.action]) + (dm.action_detail ? t("deux.points") + sienne(dm.action_detail) : "") : "")}</ul>`
      : `<p class="texte2">${t("fiche.dem.vide")}</p>`}</section>
    <form id="f" class="fiche">
      <section class="carte"><h2>${t("fiche.commerce")}</h2><div class="champs">
        <div class="f toute"><label for="nom">${t("fiche.nom")}</label><input id="nom" type="text" value="${v("nom")}" required></div>
        <div class="f"><label for="metier">${t("fiche.metier")}</label><select id="metier">${Object.entries(METIERS).map(([k, l]) => `<option value="${k}"${c.metier === k ? " selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="f"><label for="ville">${t("fiche.ville")}</label><input id="ville" type="text" value="${v("ville")}"></div>
        <div class="f toute"><label for="horaires">${t("fiche.horaires")}</label><textarea id="horaires"${lc()}>${v("horaires")}</textarea></div></div></section>
      <section class="carte"><h2>${t("fiche.propose")}</h2><div class="champs">
        <div class="f toute"><label for="specialites">${t("fiche.specialites")}</label><textarea id="specialites"${lc()}>${v("specialites")}</textarea><p class="aide">${t("fiche.specialites.aide")}</p></div>
        <div class="f toute"><label for="ton">${t("fiche.ton")}</label><input id="ton" type="text" value="${v("ton")}"${lc()}><p class="aide">${t("fiche.ton.aide")}</p></div>
        <div class="f"><label for="mots_cles">${t("fiche.mots")}</label><input id="mots_cles" type="text" value="${e((c.mots_cles || []).join(", "))}"${lc()}></div>
        <div class="f"><label for="mentions">${t("fiche.mentions")}</label><input id="mentions" type="text" value="${e((c.mentions_autorisees || []).join(", "))}"${lc()}><p class="aide">${t("fiche.mentions.aide")}</p></div></div></section>
      <section class="carte"><h2>${t("fiche.contact.titre")}</h2><div class="champs">
        <div class="f"><label for="contact">${t("fiche.contact")}</label><input id="contact" type="text" value="${v("contact")}"></div>
        <div class="f"><label for="email_validation">${t("fiche.email")}</label><input id="email_validation" type="email" value="${v("email_validation")}"></div></div></section>
      <section class="carte"><h2>${t("fiche.avis.titre")}</h2>
        <div class="f"><label for="lien_avis">${t("fiche.lien")}</label><input id="lien_avis" type="url" value="${v("lien_avis")}"><p class="aide">${t("fiche.lien.aide")}</p></div>
        <div class="pile serre" id="fiche-regle-avis"><h3>${t("fiche.reponses")}</h3>${regleAvisBlocs(c)}
          <p class="aide">${t("fiche.reglage.aide")}</p></div></section>
      <section class="carte" id="fiche-style"><h2>${t("fiche.couleurs")}</h2>
        <div class="style-accueil-corps"><p class="texte2">${t("fiche.couleurs.style")}</p><div class="style-nuancier" aria-hidden="true">${[co.accent, co.fond, co.texte].filter(Boolean).map(x => `<span style="background:${e(x)}"></span>`).join("")}</div></div>
        <p class="pied"><a class="bouton second" href="#/style">${t("fiche.couleurs.lien")}</a></p></section>
      <div class="actions pied-formulaire"><button class="bouton" type="submit">${t("enregistrer")}</button><p class="msg" id="msg" role="status"></p></div></form>`;
    const liste = id => $(id).value.split(",").map(s => s.trim()).filter(Boolean);
    $("f").onsubmit = async ev => {
      ev.preventDefault();
      try {
        await D.enregistrer({ nom: $("nom").value.trim(), metier: $("metier").value, ville: $("ville").value.trim(), specialites: $("specialites").value.trim(), horaires: $("horaires").value.trim(), ton: $("ton").value.trim(),
          mots_cles: liste("mots_cles"), mentions_autorisees: liste("mentions"), contact: $("contact").value.trim(), email_validation: $("email_validation").value.trim(), lien_avis: $("lien_avis").value.trim() });   // couleurs : écran « Votre style » (kit de marque)
        if (nomAConfirmer(c)) await D.confirmerNom($("nom").value.trim());
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
  async function photos() {
    const [c, l, k] = await Promise.all([D.commerce(), D.photos(), D.compteur().catch(() => null)]);
    const g = sansReseaux(c), plein = g && k && +k.publications_plafond > 0 && +k.publications_utilisees >= +k.publications_plafond;
    vue.innerHTML = `${pauseBandeau(c)}${entete(t("groupe.photos"), t(g ? "photos.titre.google" : "photos.titre"), g ? t("photos.chapo.google", { n: pubGoogle(c) }) : t("photos.chapo"))}
      ${plein ? `<section class="carte plafond-essentiel" id="plafond-essentiel"><p class="texte2">${t("photos.plafond.google", { n: k.publications_plafond, mois: (new Date().getMonth() + 1) % 12 })}</p>
        <p class="texte2">${t("photos.plafond.croissance")}</p><p class="pied"><a class="bouton second" href="#/offre?dessus" id="plafond-offre">${t("offre.passer.lien", { nom: e(I.offre("standard")) })}</a></p></section>` : ""}
      ${autorisationAJour(c) ? `<p class="note" id="autorisation-donnee">${t(autorisationGoogle(c) ? "aut.donnee.google" : "aut.donnee", { d: date(c.photos_autorisees_le) })}</p>` : carteAutorisation(c)}<p class="msg" id="msg-aut" role="status"></p>
      <div class="rangee">
        <section class="carte moitie"><h2>${t("photos.deposer")}</h2>
          <form id="f"><div class="f"><div class="depot">
            <span class="depot-choix"><input id="appareil" class="vh" type="file" accept="image/*" capture="environment"><label for="appareil" class="bouton second appareil-photo">${APPAREIL}<span>${t("photos.prendre")}</span></label></span>
            <span class="depot-choix"><input id="fichiers" class="vh" type="file" accept="image/*" multiple><label for="fichiers" class="bouton second">${GALERIE}<span class="sur-tel">${t("photos.galerie")}</span><span class="sur-ordi">${t("photos.choisir")}</span></label></span>
            <span class="note" id="choisies" aria-live="polite">${t("photos.aucune.choisie")}</span></div>
          <p class="aide">${t("photos.aide", { max: EN.REGLES.PHOTOS_MAX, mo: nombre(EN.REGLES.PHOTO_MAX_MO) })}</p></div>
          <div class="jauge" id="ph-jauge" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="${e(t("photos.progression"))}" hidden><span style="width:0%"></span></div>
          <button class="bouton" type="submit" id="ph-envoyer">${t("envoyer")}</button><p class="msg" id="msg" role="status" aria-live="polite"></p><p class="note" id="ph-suite" hidden></p></form></section>
        <section class="carte moitie"><div class="carte-tete"><h2>${t("photos.deja")}</h2>${l.length ? `<span class="note">${t("photos.n", { n: l.length })}</span>` : ""}</div>
          ${l.length ? `<ul class="liste">${l.map(x => `<li><div><p class="fort casse">${e(x.nom_fichier || t("photo"))}</p><p class="note">${cap(date(x.cree_le))}</p>${x.statut === "refusee" && ["hors_sujet", "doute"].includes(x.refus_motif) ? `<p class="texte2 refus-photo" data-refus="${e(x.refus_motif)}">${t("photo.refus." + x.refus_motif)}</p><p class="note">${t("photo.refus.conseil")}</p>` : ""}</div><span class="etat">${ST_PHOTO[x.statut] || e(x.statut)}</span></li>`).join("")}</ul>` : `<p class="texte2">${t("photos.vide")}</p>`}</section>
      </div>
      ${await blocDepotVideo(c)}
      ${await blocVideoAvis(c)}`;
    brancherAutorisation(photos);
    // Deux façons de choisir (appareil photo, galerie ou fichiers de l'ordinateur) ; l'envoi reste le même pour les deux.
    const choisies = () => [...$("appareil").files, ...$("fichiers").files];
    $("appareil").onchange = $("fichiers").onchange = () => { const fs = choisies(); $("choisies").textContent = !fs.length ? t("photos.aucune.choisie") : fs.length === 1 ? fs[0].name : t("photos.n.choisies", { n: fs.length }); };
    $("f").onsubmit = async ev => {
      ev.preventDefault(); if (phEnvoi.encours) return;
      const fs = choisies();
      if (!fs.length) { msg(t("photos.choisir.une")); return; }
      // Contrôle avant envoi (format, 50 Mo) : un fichier refusé n'empêche pas les autres de partir.
      const erreurs = [], bonnes = [];
      for (const f of fs) { const k = await EN.controler(f); if (k.genre !== "photo") erreurs.push(f.name + t("deux.points") + ph("Format non accepté (JPEG, PNG, WebP ou HEIC).")); else if (k.raison) erreurs.push(f.name + t("deux.points") + ph("Fichier trop lourd (50 Mo au plus).")); else bonnes.push(f); }
      if (!bonnes.length) { msg(t("photos.aucune.envoyee") + t("photos.refusees", { n: erreurs.length, l: erreurs.join(" ; ") })); return; }
      const ens = EN.controlerPhotos(bonnes.length); if (ens) { msg(t("photos.ens." + ens.code, { n: ens.n, max: EN.REGLES.PHOTOS_MAX })); return; }
      phEnvoi.encours = true; $("ph-envoyer").disabled = true; $("appareil").disabled = $("fichiers").disabled = true;
      const jauge = $("ph-jauge"), total = bonnes.reduce((s, f) => s + (f.size || 0), 0) || 1, recus = [], pris = new Set(); let faits = 0, deposees = 0;
      const avancer = n => { const p = Math.min(100, Math.floor((faits + n) / total * 100)); jauge.hidden = false; jauge.setAttribute("aria-valuenow", p); jauge.firstElementChild.style.width = p + "%"; };
      try {
        for (let i = 0; i < bonnes.length; i++) {
          // Deux fichiers identiques (même nom, taille, date) dans un même envoi reçoivent deux noms : jamais de doublon refusé par la base.
          const f = bonnes[i], cle = clePhoto(f); let nom = phEnvoi.noms.get(cle); if (!nom || pris.has(nom)) nom = EN.nomPhoto(f); pris.add(nom); phEnvoi.noms.set(cle, nom);
          msg(t("photos.envoi.de", { nom: f.name, i: i + 1, n: bonnes.length }));
          try {
            const r = await D.envoyerPhoto(f, { nom, onProgress: a => avancer(a),
              onEtat: et => msg(et === "hors_ligne" ? t("dv.hors.ligne") : et === "nouvel_essai" ? t("dv.nouvel.essai") : t("photos.envoi.de", { nom: f.name, i: i + 1, n: bonnes.length })) });
            recus.push({ chemin: r.chemin, nom: f.name, taille: f.size, cle });
          } catch (er) { erreurs.push(f.name + t("deux.points") + (er && er.interrompu ? t("photos.interrompu") : ph(er.message))); }
          faits += f.size || 0; avancer(0);
        }
        // Enregistrement de l'envoi entier : un refus de la base n'enregistre rien (les fichiers reçus restent, un nouvel essai les reprend).
        if (recus.length) { const r = await D.deposerPhotos(recus.map(({ chemin, nom, taille }) => ({ chemin, nom, taille }))); deposees = r.nb_photos; recus.forEach(x => phEnvoi.noms.delete(x.cle)); }
      } catch (er) { erreurs.push(ph(er.message)); }
      finally { phEnvoi.encours = false; }
      await photos(); msg((deposees ? t("photos.deposees", { n: deposees }) : t("photos.aucune.enregistree")) + (erreurs.length ? t("photos.refusees", { n: erreurs.length, l: erreurs.join(" ; ") }) : ""));
      if (deposees) await suitePhotos(c);
      majCompteurs();
    };
    brancherDepotVideo(); await brancherVideoAvis();
    if (/autorisation/.test(paramRoute) && $("autorisation-photos")) { $("autorisation-photos").scrollIntoView({ block: "start" }); $("aut-case").focus({ preventScroll: true }); }
  }
  // Après un envoi réussi : la suite en une phrase, avec le lien vers les contenus de l'onglet « À valider ». Délai : seulement celui que l'offre promet (« Premier contenu proposé
  // sous 72 h », Standard et Premium, site/index.html #offres ; COND = moteur/conditions_offre.json), et seulement tant qu'aucun contenu n'existe.
  // 26/10/2026 (test réel de PJ) : le lien porte le nom de l'onglet tel qu'il apparaît (« À valider »), plus « Contenus ».
  async function suitePhotos(c) {
    const s = $("ph-suite"); if (!s) return;
    const premier = !!offreDe(c).reseaux_sociaux && !(await D.contenus().catch(() => [null])).length;
    s.innerHTML = t("photos.suite", { lien: `<a href="#/contenus">${e(ECRANS.avalider)}</a>` }) + (premier ? " " + t("offre.garantie.contenu", { n: COND.garantie_delais.premier_contenu_heures }) : "");
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
    return dv.envoi ? t("dv.f.attente") : t("dv.f.ok");
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
      <div class="carte-tete"><h2 id="dv-titre">${t("dv.titre")}</h2><span class="note" id="dv-compteur">${t("dv.compteur", { a: k.videos_reservees, b: k.videos_plafond })}${attente > 0 ? t("dv.compteur.attente", { n: attente }) : ""}</span></div>
      <p class="texte2">${t("dv.chapo")}</p>
      ${dvOuvert && !dv.envoi ? `<div class="alerte dv-ouvert" role="status"><div><p class="fort">${t("dv.ouvert.titre")}</p><p>${t("dv.ouvert.texte", { d: I.dateHeureDans(dvOuvert.cree_le) })}</p>
        <p><button type="button" class="lien" id="dv-annuler">${t("dv.annuler")}</button></p></div></div>` : ""}
      <div class="dv-grille">
        <div class="dv-guide"><h3>${t("dv.guide.titre")}</h3><ol class="dv-points" id="dv-guide-points">${[1, 2, 3, 4, 5].map(i => `<li>${t("dv.guide." + i)}</li>`).join("")}</ol>
          <p class="note" id="dv-guide-accord">${t("dv.guide.accord")}</p>
          <h3>${t("dv.plans.titre." + (c.metier === "restaurant" ? "restaurant" : "autre"))}</h3><ul class="dv-points">${plans.map(x => `<li>${x}</li>`).join("")}</ul></div>
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
      </div></section>
      <section class="carte" id="dv-suivi">${dvSuivi(l)}</section>`;
  }
  function brancherDepotVideo() {
    D.depotsVideo().then(dvSurveiller).catch(() => {});
    if (!$("fv")) return;
    dvDessinerListe();
    ["filmer", "videos", "photos-depot"].forEach(id => { $(id).onchange = async () => { const l = [...$(id).files]; $(id).value = ""; if (l.length) await ajouterFichiers(l); }; });
    $("dv-fichiers").onclick = ev => { const b = ev.target.closest("[data-dv-retirer]"); if (!b || dv.envoi) return; dv.fichiers = dv.fichiers.filter(x => x.id !== b.dataset.dvRetirer); dvDessinerListe(); };
    if ($("dv-note")) $("dv-note").oninput = () => { dv.note = $("dv-note").value; };
    $("fv").onsubmit = ev => { ev.preventDefault(); envoyerDepot(dvOuvert); };
    if ($("dv-annuler")) $("dv-annuler").onclick = async () => { try { await D.annulerDepotVideo(dvOuvert.id); dv.fichiers = []; dv.interrompu = false; dv.depot = null; await photos(); dvMsg(t("dv.annule")); } catch (er) { dvMsg(ph(er.message)); } };
    if ($("dv-annuler") && dv.depot && dvOuvert && dv.depot !== dvOuvert.id) dv.depot = null;
    if (dv.envoi) dvMsg(dv.reseau === "hors_ligne" ? t("dv.hors.ligne") : t("dv.envoi.en.cours", { i: valables().findIndex(x => x.etat !== "recu") + 1, n: valables().length }));
  }

  // ---------------- Contenus
  const FILTRES = ["a_valider", "approuve", "programme", "publie", "autres"].map(k => [k, t("filtre." + k)]);
  const VIDE_FILTRE = I.carte("filtre.vide", ["a_valider", "approuve", "programme", "publie", "autres"]);
  const famille = x => FILTRES.some(f => f[0] === x.statut) ? x.statut : "autres";
  let filtre = null;
  // Les idées sont fusionnées dans Contenus : bouton « Proposer des idées », qui ouvre le panneau des idées.
  let ideesOuvertes = false;
  async function panneauIdees(c) {
    // Hors plafond depuis le 22/10/2026 (décision de PJ) : une demande ne consomme plus de publication ; la base en accepte une par 24 heures.
    const [k, l] = await Promise.all([D.compteur(), D.idees()]);
    return `<section class="carte" id="idees" aria-labelledby="idees-titre"><div class="carte-tete"><h2 id="idees-titre">${t("idees.titre")}</h2><button type="button" class="lien" id="fermer-idees">${t("fermer")}</button></div>
        <p class="texte2">${t("idees.texte")}</p>
        <div class="actions"><button type="button" class="bouton" id="demande"${c.en_pause ? " disabled" : ""}>${t("idees.demander")}</button><p class="msg" id="msg-idees" role="status"></p></div>
        ${l.length ? `<ul class="liste idees">${l.map(x => `<li${x.semaine ? ` data-idee="${e(x.id)}"` : ""}><div><p class="fort"${lc()}>${e(x.titre)}</p><p class="texte2"${lc()}>${e(x.texte)}</p>
          ${x.semaine ? `<p class="note">${t("idee.semaine")}${x.motif ? `. <span${lc()}>${e(x.motif)}</span>` : ""}</p>${x.statut === "a_valider" ? `<div class="actions"><button type="button" class="bouton second petit" data-decider-idee="retenue">${t("idee.retenir")}</button><button type="button" class="lien" data-decider-idee="ecartee">${t("idee.ecarter")}</button></div>` : ""}` : ""}</div>
          <span class="note">${x.semaine && x.statut !== "a_valider" ? t(x.statut === "retenue" ? "idee.retenue" : "idee.ecartee") + ", " : ""}${cap(date(x.cree_le))}</span></li>`).join("")}</ul>` : `<p class="texte2">${t("idees.vide")}</p>`}</section>`;
  }
  async function contenus() {
    const [c, l] = await Promise.all([D.commerce(), D.contenus()]), nbf = Object.fromEntries(FILTRES.map(f => [f[0], l.filter(x => famille(x) === f[0]).length]));
    nomCommerce = c.nom;
    if (!filtre) filtre = (FILTRES.find(f => nbf[f[0]]) || FILTRES[0])[0];
    const liste = l.filter(x => famille(x) === filtre), urls = await Promise.all(liste.map(x => urlSure(x))), vids = await Promise.all(liste.map(videoSure));
    const u9s = await Promise.all(liste.map(url916));   // onglet TikTok de chaque publication photo : le 9:16 qui part
    const formatCourt = x => t("format.court." + M.formatDe(x));
    vue.innerHTML = `${pauseBandeau(c)}<div class="entete-accueil">${entete(t("groupe.avalider"), t("contenus.titre"), t(delegationActive(c) ? "contenus.chapo.delegation" : sansReseaux(c) ? "contenus.chapo.google" : "contenus.chapo"))}
        <button type="button" class="bouton second" id="proposer-idees" aria-expanded="${ideesOuvertes}" aria-controls="idees">${t("idees.titre")}</button></div>
      ${ideesOuvertes ? await panneauIdees(c) : ""}
      ${await proposition(c)}
      ${l.length ? `<div class="filtres" role="group" aria-label="${t("filtres.aria")}">${FILTRES.map(([k, nom]) => `<button type="button" data-f="${k}" aria-pressed="${k === filtre}">${nom}, ${nbf[k]}</button>`).join("")}</div>
      <p class="msg" id="msg" role="status"></p>
      ${liste.length ? `<div class="cartes">${liste.map((x, i) => `<article class="carte contenu" data-contenu="${e(x.id)}">
        <p class="meta"><span>${formatCourt(x)}${x.depot_video_id ? " · " + t("dv.montage.de.vos") : ""} · ${jourRelatif(x.cree_le)}</span><span class="etat${x.statut === "a_valider" ? " actif" : ""}">${ST_CONTENU[x.statut] || e(x.statut)}</span></p>
        ${etiquetteIA(x)}${blocReseaux(x, urls[i], vids[i], u9s[i])}<div class="contenu-corps">
        ${x.note_modification ? `<p class="note">${t("contenus.demande")}<span${lc()}>${e(x.note_modification)}</span></p>` : ""}
        ${x.statut === "a_valider" ? decisions(x, t("contenus.refuser")) + formatsPublies(x, urls[i], u9s[i]) : x.statut === "approuve" ? boutonsAuto(x.id, c.metier) : ""}</div></article>`).join("")}</div>`
      : `<section class="carte"><p class="texte2">${VIDE_FILTRE[filtre]}</p></section>`}`
      : `<section class="carte"><h2>${t("contenus.vide.titre")}</h2><p class="texte2">${t("contenus.vide.texte")}</p><p class="pied"><a class="bouton" href="#/photos">${t("photos.deposer")}</a></p></section><p class="msg" id="msg" role="status"></p>`}`;
    vue.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { filtre = b.dataset.f; contenus(); });
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
  }

  // ---------------- Calendrier
  const cal = { mode: "mois", ref: new Date() };
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
  async function calendrier() {
    const [c, l, ct, cpt, mr] = await Promise.all([D.commerce(), D.calendrier(), D.contenus(), D.comptes(), D.miseEnRoute().catch(() => null)]);
    const actifs = l.filter(x => x.statut !== "annule"), prets = ct.filter(x => x.statut === "approuve");
    const connectes = cpt.filter(x => x.etat === "connecte").map(x => x.reseau), vign = await Promise.all(l.map(x => urlSure(x.contenu)));
    // Réseaux proposés au formulaire : ceux de l'offre et retenus (Essentiel : la fiche Google seule), dans l'ordre habituel.
    const autorises = window.RENOM_RESEAUX_AUTORISES(c), proposes = window.RENOM_RESEAUX.filter(r => autorises.includes(r));
    const ref = new Date(cal.ref), aujourd = new Date(); let grille = "";
    const du = d => actifs.filter(x => memeJour(new Date(x.prevu_le), d));
    const lundi = (() => { const d = new Date(ref); d.setDate(ref.getDate() - ((ref.getDay() + 6) % 7)); return d; })();
    if (cal.mode === "mois") {
      const p = new Date(ref.getFullYear(), ref.getMonth(), 1), dec = (p.getDay() + 6) % 7, n = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
      grille = `<div class="cal" role="grid" aria-label="${MOIS[ref.getMonth()]} ${ref.getFullYear()}">${JOURS.map(j => `<div class="ent">${j}</div>`).join("")}` + Array.from({ length: Math.ceil((dec + n) / 7) * 7 }, (_, i) => {
        const j = i - dec + 1; if (j < 1 || j > n) return `<div class="hors"></div>`; const d = new Date(ref.getFullYear(), ref.getMonth(), j), it = du(d);
        return `<div${memeJour(d, aujourd) ? ' aria-current="date"' : ""}><span class="n">${j}</span>${it.map(x => `<span data-cell>${heureCourte(x.prevu_le)}</span>`).join("")}</div>`; }).join("") + "</div>";
    } else {
      grille = `<ul class="liste semaine" aria-label="${t("cal.semaine.aria")}">` + Array.from({ length: 7 }, (_, i) => { const d = new Date(lundi); d.setDate(lundi.getDate() + i); const it = du(d);
        return `<li${memeJour(d, aujourd) ? ' aria-current="date"' : ""}><p class="fort">${I.jourEtDate(d)}</p><div>${it.length ? it.map(x => `<p>${heure(x.prevu_le)} · ${x.reseaux.map(r => RES[r]).join(", ")} · <span${lc()}>${e(cut(x.contenu?.legende || "", 60))}</span></p>`).join("") : `<p class="note">${t("cal.rien")}</p>`}</div></li>`; }).join("") + "</ul>";
    }
    const titre = cal.mode === "mois" ? `${cap(MOIS[ref.getMonth()])} ${ref.getFullYear()}` : t("cal.semaine.du", { d: date(lundi) });
    vue.innerHTML = `${pauseBandeau(c)}${retour("#/accueil", "cal.retour")}${entete(t("groupe.accueil"), t("cal.titre"), t("cal.chapo"))}
      ${calendrierBloque(c, connectes, mr)}
      <div class="rangee">
        <section class="carte large"><div class="cal-tete"><div class="cal-nav"><button type="button" class="bouton second petit cal-fleche" data-n="-1" aria-label="${t("cal.precedent")}">‹</button><h2>${titre}</h2><button type="button" class="bouton second petit cal-fleche" data-n="1" aria-label="${t("cal.suivant")}">›</button></div>
          <div class="actions serre cal-modes"><button type="button" class="bouton second petit" data-m="semaine" aria-pressed="${cal.mode === "semaine"}">${t("cal.semaine")}</button><button type="button" class="bouton second petit" data-m="mois" aria-pressed="${cal.mode === "mois"}">${t("cal.mois")}</button></div></div>${grille}</section>
        <section class="carte etroite"><h2>${t("cal.programmer.titre")}</h2>${prets.length ? `<form id="f">
          <div class="f"><label for="contenu">${t("cal.contenu")}</label><select id="contenu">${prets.map(x => `<option value="${e(x.id)}">${t(x.type === "video" ? "type.video" : "type.publication.cap")}${t("deux.points")}${e(cut(x.legende || "", 70))}</option>`).join("")}</select></div>
          <div class="champs deux"><div class="f"><label for="jour">${t("cal.date")}</label><input id="jour" type="date" value="${demain()}" required></div><div class="f"><label for="heure">${t("cal.heure")}</label><input id="heure" type="time" value="12:00" required></div></div>
          <fieldset><legend>${t(sansReseaux(c) ? "cal.ou.publier" : "cal.reseaux")}</legend>${proposes.map(r => `<label class="option"><input type="checkbox" name="res" value="${r}"${connectes.includes(r) ? "" : " disabled"}><span>${RES[r]}${connectes.includes(r) ? "" : t("cal.non.connecte")}</span></label>`).join("")}
          <p class="aide">${t("cal.plafond.aide")}</p></fieldset>
          <button class="bouton" type="submit">${t("cal.programmer")}</button><p class="msg" id="msg" role="status"></p></form>` : `<p class="texte2">${t(sansReseaux(c) ? "cal.aucun.pret.google" : "cal.aucun.pret")}</p><p class="msg" id="msg" role="status"></p>`}</section>
      </div>
      <section class="carte"><div class="carte-tete"><h2>${t("cal.vos")}</h2>${l.length ? `<span class="note">${l.length}</span>` : ""}</div>${l.length ? `<ul class="liste programmations">${l.map((x, i) => `<li class="avec-vignette" data-id="${e(x.id)}">${vignette(vign[i])}<div class="prog">
        <p><span class="fort">${dateHeure(x.prevu_le)}</span> · ${x.reseaux.map(r => RES[r]).join(", ")} · <span class="etat${x.statut === "programme" ? " actif" : ""}">${ST_PUB[x.statut] || e(x.statut)}</span></p>
        <p class="note"${lc()}>${e(cut(x.contenu?.legende || "", 90))}</p>${x.erreur ? `<p class="note">${e(ph(x.erreur))}</p>` : ""}
        ${x.statut === "programme" ? `<div class="actions serre"><input type="date" data-nj value="${jourLocal(x.prevu_le)}" aria-label="${t("cal.nouvelle.date")}"><input type="time" data-nh value="${heureLocale(x.prevu_le)}" aria-label="${t("cal.nouvelle.heure")}"><button type="button" class="bouton second petit" data-a="deplacer">${t("cal.deplacer")}</button><button type="button" class="lien" data-a="annuler">${t("annuler")}</button></div>` : ""}</div></li>`).join("")}</ul>` : `<p class="texte2">${t("cal.aucune")}</p>`}</section>`;
    vue.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { cal.mode = b.dataset.m; calendrier(); });
    vue.querySelectorAll("[data-n]").forEach(b => b.onclick = () => { const n = +b.dataset.n, d = new Date(cal.ref); if (cal.mode === "mois") d.setMonth(d.getMonth() + n); else d.setDate(d.getDate() + 7 * n); cal.ref = d; calendrier(); });
    if ($("f")) $("f").onsubmit = async ev => {
      ev.preventDefault(); const res = [...document.querySelectorAll("input[name=res]:checked")].map(x => x.value);
      try { await D.programmer({ contenu_id: $("contenu").value, reseaux: res, prevu_le: new Date($("jour").value + "T" + $("heure").value).toISOString() }); await calendrier(); msg(t("cal.programme")); } catch (er) { msg(ph(er.message)); }
    };
    vue.querySelectorAll("li[data-id]").forEach(li => li.addEventListener("click", async ev => {
      const b = ev.target.closest("[data-a]"); if (!b) return;
      try { if (b.dataset.a === "annuler") await D.annuler(li.dataset.id); else await D.deplacer(li.dataset.id, new Date(li.querySelector("[data-nj]").value + "T" + li.querySelector("[data-nh]").value).toISOString()); await calendrier(); msg(t("enregistre")); } catch (er) { msg(ph(er.message)); }
    }));
  }

  // ---------------- Autorisation photos (décision de PJ du 22/10/2026, CGV article 11) : case au premier écran (démarrage, et accueil tant qu'elle
  // n'est pas cochée), état dans l'écran Photos. Fonction autoriser_photos (schema.sql) ; le retrait se fait par email (noté par l'équipe).
  // Essentiel (26/10/2026) : la case ne porte que sur les photos publiées par le commerce sur sa fiche Google (« aut.case.google »).
  const carteAutorisation = c => autorisationAJour(c) ? "" : `<section class="carte autorisation-photos" id="autorisation-photos" aria-labelledby="aut-titre">
      <h2 id="aut-titre">${t("aut.titre")}</h2><p class="texte2">${t("aut.chapo")}</p>
      <form id="aut-f" novalidate><label class="option consentement"><input id="aut-case" type="checkbox"><span>${t(sansReseaux(c) ? "aut.case.google" : "aut.case")}</span></label>
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
  const texteSensible = (x, c) => x.statut === "publie" ? t("avis.sensible.fait") : x.statut !== "humain" ? ""
    : x.propose_le && !equipeRepond(c) ? (merSql(c) ? "" : t("avis.sensible.propose", { d: date(x.propose_le) })) : t(equipeRepond(c) ? "avis.sensible.texte.equipe" : merSql(c) ? "avis.sensible.texte.espace" : "avis.sensible.texte");
  // Essentiel, bloc SQL appliqué (27/10/2026, constat 14) : la réponse proposée par l'équipe, « J'approuve cette réponse » et « Je veux en parler ».
  const decisionSensible = (x, c) => !(merSql(c) && !equipeRepond(c) && x.sensible && x.statut === "humain" && x.propose_le && String(x.reponse_proposee || "").trim()) ? ""
    : `<div class="sensible-reponse" data-sensible-zone><p class="fort">${t("avis.sensible.proposee", { d: date(x.propose_le) })}</p><p class="reponse"${lc()}>${e(x.reponse_proposee)}</p>
      ${accordDonne(x) ? `<p class="note" data-sensible-etat="approuve">${t("avis.sensible.approuvee", { d: date(x.decision_client_le) })}</p>`
      : x.decision_client === "en_parler" && x.decision_client_le >= x.propose_le ? `<p class="note" data-sensible-etat="en_parler">${t("avis.sensible.en.parler.fait", { d: date(x.decision_client_le) })}</p>`
      : `<div class="actions"><button type="button" class="bouton" data-sensible="approuve">${t("avis.sensible.approuver")}</button><button type="button" class="bouton second" data-sensible="en_parler">${t("avis.sensible.en.parler")}</button></div>
        <p class="note">${t("avis.sensible.regle")}</p>`}</div>`;
  // Avis vide : où en est l'accès à la fiche (constat 23). Sans accès : le lien vers l'étape ; fiche en création : ce qui se passe ; sinon : demander des avis.
  const avisVide = (c, mr) => { const g = ((mr && mr.points) || []).find(x => x.point === "google"), acces = !g || g.etat === "fait";
    if (ficheDemandee(c)) return `<section class="carte" id="avis-vide"><h2>${t("avis.vide.titre")}</h2><p class="texte2">${t("avis.vide.fiche.demandee")}</p></section>`;
    if (!acces) return `<section class="carte" id="avis-vide"><h2>${t("avis.vide.titre")}</h2><p class="texte2">${t("avis.vide.sans.acces")}</p><p class="pied"><a class="bouton" href="#/miseenroute" id="avis-vers-google">${t("avis.vide.donner.acces")}</a></p></section>`;
    return `<section class="carte" id="avis-vide"><h2>${t("avis.vide.titre")}</h2><p class="texte2">${t("avis.vide.texte.acces")}</p><p class="pied"><a class="bouton" href="#/collecte">${t("ecran.collecte")}</a></p></section>`; };
  async function avis() {
    const [c, l0, mr] = await Promise.all([D.commerce(), D.avis(), D.miseEnRoute().catch(() => null)]);
    const rang = x => (x.statut === "a_valider" && !x.sensible) || sensibleADecider(x, c) ? 0 : x.sensible || x.statut === "humain" ? 1 : 2, l = l0.map((x, i) => [x, i]).sort((a, b) => rang(a[0]) - rang(b[0]) || a[1] - b[1]).map(x => x[0]);
    vue.innerHTML = `<div class="entete-accueil">${entete(t("groupe.avalider"), t("avis.titre"))}<a class="bouton second" id="demander-avis" href="#/collecte">${t("ecran.collecte")}</a></div>
      <div class="colonnes">
        <div class="pile">${l.length ? l.map(x => `<article class="carte avis${x.sensible ? " attention" : ""}" data-avis="${e(x.id)}">
          <div class="carte-tete"><p class="fort">${etoiles(x.note)}</p><p class="etat${x.statut === "a_valider" && !x.sensible ? " actif" : ""}">${ST_AVIS[x.statut] || e(x.statut)}</p></div>
          ${citation(x)}<p class="note">${x.auteur && !x.efface_le ? e(x.auteur) + " · " : ""}${t("recu.le", { d: date(x.cree_le) })}</p>
          ${x.sensible ? `<div class="encart" role="alert"><p class="fort">${t("avis.sensible", { r: e(raisonsTexte(x.raisons)) })}</p>${texteSensible(x, c) ? `<p>${texteSensible(x, c)}</p>` : ""}</div>${decisionSensible(x, c)}` : ""}
          ${x.statut === "a_valider" && !x.sensible ? reponseAValider(x) : ""}
          ${x.statut === "escalade" ? `<p class="note">${t(offreDe(c).delegation ? "avis.equipe.texte" : "avis.escalade.texte")}</p>` : ""}
          ${x.statut === "publie" || x.statut === "valide" || x.statut === "a_publier_main" ? `<p class="reponse"><span class="fort">${t(etiquetteReponse(x))}</span> <span${lc()}>${e(x.reponse || x.reponse_proposee || "")}</span></p>` : ""}</article>`).join("")
          : avisVide(c, mr)}
          <p class="msg" id="msg" role="status"></p></div>
        <section class="carte" id="avis-regle"><h2>${t("reglage")}</h2>${regleAvisBlocs(c)}
          <p class="pied"><a href="#/offre">${t("acc.voir.offre")}</a></p></section>
      </div>`;
    brancherAvis(vue, avis);
    vue.querySelectorAll("[data-sensible]").forEach(b => b.onclick = async () => { const d = b.dataset.sensible; b.disabled = true;
      try { await D.deciderAvisSensible(b.closest("[data-avis]").dataset.avis, d); await avis(); msg(t(d === "approuve" ? "avis.sensible.approuvee.msg" : "avis.sensible.en.parler.msg")); majCompteurs(); }
      catch (er) { b.disabled = false; msg(ph(er.message)); } });
  }

  // ---- Collecte : début. Page publique d'avis, QR code et carte A6, demande par WhatsApp, retours privés.
  // Conformité Google : la page publique est la même pour tous les clients ; rien ici ne trie selon la note.
  // La carte A6 et le message WhatsApp s'adressent aux clients du commerce : ils sont écrits dans la langue du commerce.
  const retoursNonLus = async () => { try { return (await D.retoursPrives()).filter(x => !x.lu).length; } catch (er) { return 0; } };
  const HOTE_GOOGLE = /(^|\.)(google\.[a-z.]{2,6}|g\.page|goo\.gl|g\.co)$/i;
  // Lien Google proposé par la page publique : même règle que la base (https obligatoire, sinon identifiant de lieu).
  function lienAvis(c) {
    const lien = window.RENOM_LIEN_AVIS(c); if (!lien) return null;
    const deLaFiche = lien === String(c.lien_avis || "").trim(); let hote = ""; try { hote = new URL(lien).hostname; } catch (er) {}
    return { lien, source: t(!deLaFiche ? "col.lien.construit" : HOTE_GOOGLE.test(hote) ? "col.lien.fiche" : "col.lien.douteux") };
  }
  const lienPagePublique = jeton => new URL("avis.html#" + jeton, location.href.split("#")[0]).href;
  function qrSvg(texte) { const q = qrcode(0, "M"); q.addData(texte); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
  // Numéro au format international : indicatif précédé de + ou de 00, puis 8 à 15 chiffres au total. Renvoie les chiffres seuls, ou null.
  function numeroInternational(saisie) {
    let n = String(saisie || "").trim().replace(/\(0\)/g, "").replace(/[\s.\-()  ]/g, "");
    if (n.startsWith("+")) n = n.slice(1); else if (n.startsWith("00")) n = n.slice(2); else return null;
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
  const chiffresCollecte = (m, deux) => `<dl class="bilan-chiffres${deux ? " deux" : ""}">${MESURES.map(([k, lib]) => `<div class="bilan-chiffre"><dt>${lib}</dt><dd class="chiffre" data-mesure="${k}">${valeurMesure(m, k)}</dd></div>`).join("")}</dl>`;
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
    const tete = `${retour("#/avis", "col.retour")}${entete(t("groupe.avalider"), t("ecran.collecte"), t("col.chapo"))}${nomAvant}`;
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
              <div class="f"><label for="wa-numero">${t("wa.numero")}</label><input id="wa-numero" type="tel" inputmode="tel" autocomplete="off" placeholder="${t("wa.exemple.numero")}" aria-describedby="wa-aide"></div>
              <p class="aide toute" id="wa-aide">${t("wa.aide")}</p>
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
      ev.preventDefault(); const numero = numeroInternational($("wa-numero").value), texte = $("wa-message").value.trim();
      if (!numero) { waMsg(t("wa.numero.ko")); $("wa-numero").focus(); return; }
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
  async function comptes() {
    // Offre sans réseaux (Essentiel, 26/10/2026) : seulement l'accès à la fiche Google ; Facebook, Instagram et TikTok ne la concernent pas.
    const [c, l0] = await Promise.all([D.commerce(), D.comptes()]), g = sansReseaux(c), l = g ? l0.filter(x => x.reseau === "google") : l0;
    vue.innerHTML = `${retour("#/reglages", "reg.retour")}${entete(t("groupe.reglages"), t(g ? "reg.comptes.google" : "ecran.comptes"), (D.mode === "demo" ? t("comptes.demo") + " " : "") + t(g ? "comptes.chapo.google" : "comptes.chapo"))}
      <div class="cartes comptes">${l.map(x => `<article class="carte"${x.reseau === "google" ? ' id="compte-google"' : ""}><h2>${RES[x.reseau]} <span class="etat${x.etat === "connecte" ? " actif" : ""}">· ${ETAT[x.etat] || e(x.etat)}</span></h2><p class="texte2">${AIDE[x.reseau]}</p>${x.detail ? `<p class="note pied">${e(ph(x.detail))}</p>` : ""}${x.reseau === "google" ? blocFiche(c, "fiche-comptes") : ""}</article>`).join("")}</div>`;
    brancherFiche("fiche-comptes", comptes);
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
  // Premium : bilan commenté et point de 30 min chaque mois (CGV, tableau des offres et article 3), mode délégation activé ou désactivé ICI
  // (D.reglerDelegation, fonction regler_delegation : accord horodaté avec la version des CGV) ; base sans ce bloc : texte « écrivez-nous ».
  const ORDRE_OFFRES = ["essentiel", "standard", "premium"];
  const offreCible = (c, voulue) => { const i = ORDRE_OFFRES.indexOf(c.offre_id), j = ORDRE_OFFRES.indexOf(voulue);
    return i >= 0 && j > i ? voulue : i >= 0 && i < ORDRE_OFFRES.length - 1 ? ORDRE_OFFRES[i + 1] : null; };
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
        <li id="premium-point"><span>${t("offre.premium.point")}</span><span class="fort">${t("compris")}</span></li>
        <li id="premium-delegation"><span>${t("offre.premium.delegation")}</span><span class="fort">${t(actif ? "offre.premium.delegation.active" : "offre.premium.delegation.inactive")}</span></li></ul>
        ${reglage}<p class="msg" id="msg-deleg" role="status"></p></section>`;
    }
    const suiv = offreCible(c, voulue), s_ = O[suiv]; if (!s_) return "";
    // Lien de paiement de l'offre du dessus (jamais le portail : décision de PJ du 27/10/2026), même rythme que l'abonnement en cours.
    const nom = e(I.offre(suiv)), lien = D.lienMonteeOffre ? D.lienMonteeOffre(ab, c, suiv) : null, enCours = !!(ab && ab.statut !== "resilie");
    const rythme = enCours && ab.rythme === "annuel" ? "annuel" : "mensuel", mer = COND.mise_en_route, offertsF = window.RENOM_MAJ.aujourdhui() <= mer.offerts_jusqu_au;
    // Mise en route déjà payée (offre actuelle avec mise en route, Croissance) : jamais refacturée.
    const frais = !s_.frais_mise_en_route ? "" : o.frais_mise_en_route ? t("offre.dessus.frais.deja") : t(offertsF ? "offre.dessus.frais.offerts" : "offre.dessus.frais.factures", { prix: euros(mer.prix_ht), date: I.dateLongue(mer.offerts_jusqu_au) });
    const lignes = suiv === "standard" ? ["offre.dessus.std.1", "offre.dessus.std.2", "offre.dessus.std.3"] : ["offre.dessus.prem.1", "offre.dessus.prem.2", "offre.dessus.prem.3"];
    return `<section class="carte" id="offre-dessus" data-offre="${e(suiv)}"><h2>${t("offre.dessus.titre", { nom })}</h2>
      <ul class="liste-engagements">${lignes.map(k => `<li><p>${t(k, { n: s_.contenus, v: s_.videos, h })}</p></li>`).join("")}</ul>
      <p class="prix-offre" id="dessus-prix"><span class="chiffre">${euros(s_.prix_ht)}</span> ${t("offre.ht.mois.annuel")}</p>
      <p class="texte2" id="dessus-mensuel">${t("offre.dessus.mensuel", { prix: euros(s_.prix_mensuel_ht) })}</p>
      ${frais ? `<p class="texte2" id="dessus-frais">${frais}</p>` : ""}
      ${lien ? `<p class="pied actions-abo"><a class="bouton" id="offre-passer" href="${e(lien)}" target="_blank" rel="noopener">${t("offre.dessus.passer", { nom })}</a></p>
        <p class="note" id="dessus-note">${t(enCours ? "offre.dessus.note.paiement" : "offre.dessus.note.paiement.seul", { nom, r: t("offre.dessus.rythme." + rythme) })}</p>`
        : `<p class="note" id="dessus-note">${t("offre.dessus.comment")}</p>`}</section>`;
  }
  async function offre() {
    const [k, j, c, ab, g, cmds] = await Promise.all([D.compteur(), D.journal(), D.commerce(), D.abonnement ? D.abonnement().catch(() => null) : null, D.maGarantieDelais ? D.maGarantieDelais().catch(() => null) : null,
      D.mesCommandesOptions ? D.mesCommandesOptions().catch(() => []) : []]);
    const o = window.RENOM_OFFRES[k.offre] || {}, mois = new Date(k.mois + "T12:00:00"), mer = COND.mise_en_route, offerts = window.RENOM_MAJ.aujourdhui() <= mer.offerts_jusqu_au;
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
    vue.innerHTML = `${pauseBandeau(c)}${retour("#/reglages", "reg.retour")}${entete(t("offre.sur"), t("offre.titre.nom", { nom: e(k.offre || k.offre_nom) }))}
        <section class="carte" id="offre-mois"><div class="carte-tete"><h2>${t("ce.mois")}</h2><span class="note">${cap(MOIS[mois.getMonth()])} ${mois.getFullYear()}</span></div>
          ${mesure(t("offre.pub.utilisees"), k.publications_utilisees, k.publications_plafond)}
          ${k.videos_plafond ? mesure(t("offre.vid.utilisees"), k.videos_utilisees, k.videos_plafond) : o.reseaux_sociaux === false ? "" : `<div class="mesure-tete"><span>${t("mes.videos")}</span><span class="note">${t("non.comprises.offre")}</span></div>`}
          ${o.reseaux_sociaux === false ? "" /* Essentiel (26/10/2026) : ni vidéos ni commentaires de réseaux à compter */ : `<div class="mesure-tete" id="offre-commentaires"><span>${t("offre.rep.commentaires")}</span>${k.commentaires_inclus ? `<span>${t("offre.cm.sans.plafond", { n: `<span class="chiffre">${nombre(+k.commentaires_repondus || 0)}</span>` })}</span>` : `<span class="note">${t("non.comprises.offre")}</span>`}</div>`}
          <p class="note pied">${t("offre.compteur.debut")}</p></section>
      ${offreDessus(c, o, ab, (/dessus=(\w+)/.exec(paramRoute) || [])[1])}
        <section class="carte" id="offre-inclus"><h2>${t("offre.inclus")}</h2><ul class="liste">
          <li id="offre-contenus"><span>${t("offre.inc.contenus")}</span><span class="fort">${o.videos ? t("offre.contenus.dont.videos", { n: contenus, v: o.videos }) : t("offre.contenus.n", { n: contenus })}</span></li>
          <li id="offre-reseaux"><span>${t("offre.inc.reseaux")}</span><span class="fort">${sociaux.length ? [...sociaux, "google"].map(r => RES[r]).join(", ") : t("offre.reseaux.google.seul")}</span></li>
          <li><span>${t("offre.inc.avis")}</span><span class="fort">${t("comprises")}</span></li>${o.reseaux_sociaux === false ? "" : `<li><span>${t("offre.inc.commentaires")}</span><span class="fort">${t(k.commentaires_inclus ? "comprises" : "non.comprises")}</span></li>`}
          <li><span>${t("offre.inc.concurrents")}</span><span class="fort">${t("comprise")}</span></li><li><span>${t(o.delegation ? "offre.inc.bilan.premium" : "offre.inc.bilan")}</span><span class="fort">${t("compris")}</span></li></ul>
          <p class="note pied">${t(o.reseaux_sociaux === false ? "offre.contenus.unite.google" : "offre.contenus.unite")} ${t("offre.idees.compte")}</p></section>
      ${o.prix_ht ? `<section class="carte" id="offre-prix"><h2>${t("offre.prix.titre")}</h2><p class="prix-offre"><span class="chiffre">${euros(o.prix_ht)}</span> ${t("offre.ht.mois.annuel")}</p>
        <p class="texte2 lecture" id="offre-annuel">${t("offre.annuel", { total: euros(o.prix_annuel_ht), gain: euros(gainAn) })}</p>
        <p class="texte2 lecture" id="offre-mensuel">${t("offre.mensuel", { prix: euros(o.prix_mensuel_ht) })}</p>
        <p class="texte2 lecture" id="offre-frais">${!o.frais_mise_en_route ? t("offre.frais.aucun") : offerts ? t("offre.frais.offerts", { prix: euros(mer.prix_ht), date: I.dateLongue(mer.offerts_jusqu_au) }) : t("offre.frais.factures", { prix: euros(mer.prix_ht) })}</p>
        <p class="note">${t("offre.sans.engagement")} ${t("offre.cgv")}</p></section>` : o.retiree ? `<section class="carte" id="offre-prix"><h2>${t("offre.prix.titre")}</h2><p class="texte2 lecture">${t("offre.retiree")}</p></section>` : ""}
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
          : D.mode === "demo" ? `<p class="note">${t("abo.demo")}</p>` : ""}
        ${baisse ? `<p class="note" id="offre-baisse">${t("offre.baisse")}</p>` : ""}</section>
      <section class="carte replis" id="offre-plus">${repli("offre-regle", t("offre.regle.titre"), `${regleAvisBlocs(c)}
        <p class="texte2 lecture" id="offre-regle-contenus">${t(delegationActive(c) ? "offre.regle.contenus.delegation" : o.delegation ? "offre.regle.contenus.delegation.option" : "offre.regle.contenus", { h: COND.delegation.publication_auto_heures })}</p>`)}
      ${repli("offre-processus", t("offre.processus.titre"), `<ol class="etapes-offre">${[1, 2, 3].map(n => `<li>${t("offre.processus." + n + (n === 1 && o.reseaux_sociaux === false ? ".google" : ""))}</li>`).join("")}</ol>`)}
      ${repli("offre-plafond", t("offre.plafond.titre"), `<p class="texte2 lecture">${t("offre.plafond.texte")}${offreCible(c) ? " " + t("offre.plafond.dessus", { nom: e(I.offre(offreCible(c))) }) : ""}</p>`)}
      ${repli("offre-historique", t("offre.historique"), j.length ? `<ul class="liste">${j.slice(0, 12).map(x => `<li><span>${e(ETAPES[x.type] || t("etape.autre"))}${x.detail && x.detail.raison ? `<span class="note">${t("deux.points")}${e(ph(x.detail.raison))}</span>` : ""}</span><span class="note">${cap(date(x.cree_le))}</span></li>`).join("")}</ul>` : `<p class="texte2">${t("offre.aucune.etape")}</p>`)}</section>`;
    if (/dessus/.test(paramRoute) && $("offre-dessus")) $("offre-dessus").scrollIntoView({ block: "start" });
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
    if (lg.statut === "ok") return t("lecture.ok", { h: lg.le ? ` (${heure(lg.le)})` : "" });
    if (lg.statut === "limite") return t("lecture.limite");
    if (lg.statut === "non_branchee") return t("lecture.non.branchee");
    return t("lecture.echec");
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
  async function resultats() {
    const [c, R, bilan, mr] = await Promise.all([D.commerce(), D.resultats(6), D.bilanMois().catch(() => null), D.miseEnRoute().catch(() => null)]), mois = (R && R.mois) || [], avecNote = mois.filter(m => m.note != null), lg = (R && R.lecture_google) || {};
    // Tant que BoostImpact n'a pas accès à la fiche Google (étape « google » de la mise en route), aucun chiffre ne peut arriver : le point de départ.
    const etapeGoogle = ((mr && mr.points) || []).find(x => x.point === "google");
    if (etapeGoogle && etapeGoogle.etat !== "fait") return pointDeDepart(c, R, mr);
    const prem = avecNote[0], dern = avecNote[avecNote.length - 1], rep = (R && R.reponses) || {}, audit = (R && R.audit) || [], conc = (R && R.concurrents) || [], themes = (R && R.themes) || [], col = (R && R.collecte) || {};
    const pts = k => mois.map(m => ({ v: m[k] == null ? null : +m[k], lib: moisLong(m.mois), court: moisCourt(m.mois) }));
    const periode = mois.length ? t("res.periode", { a: moisLong(mois[0].mois), b: moisLong(mois[mois.length - 1].mois) }) : "";
    const ecart = (a, b, d) => { const x = Math.round((b - a) * 10 ** d) / 10 ** d; return x > 0 ? "+" + nombre(x, d) : x < 0 ? "−" + nombre(-x, d) : t("res.stable"); };
    const taux = pctTaux(rep.taux), dernierAudit = audit[audit.length - 1];
    const maxTheme = Math.max(1, ...themes.map(x => (+x.positif || 0) + (+x.negatif || 0)));
    const actuelConc = x => (x.mois || [])[x.mois.length - 1] || {}, actuel = mois[mois.length - 1] || {}, enCours = dern && dern === actuel;
    const nonLu = t(lg.fiche === "non_reliee" ? "res.fiche.non.reliee" : "res.note.non.lue");
    const lecture = lectureTexte(lg), nonLue = t("non.lue"), nonLuM = t("non.lu");
    vue.innerHTML = `${entete(t("groupe.resultats"), t("res.titre"), t("res.chapo") + (periode ? ", " + periode : "") + ".")}
      ${bandeauDemo()}
      ${bilanBloc(bilan)}
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
          ${themes.length ? `<ul class="liste themes">${themes.map(x => { const p = +x.positif || 0, n = +x.negatif || 0; return `<li><div class="theme"><p class="fort"${lc()}>${e(x.theme)}</p><div class="t-barre" aria-hidden="true">${p ? `<span class="t-pos" style="width:${p / maxTheme * 100}%"></span>` : ""}${n ? `<span class="t-neg" style="width:${n / maxTheme * 100}%"></span>` : ""}</div></div><p class="note t-compte">${t("res.themes.compte", { p, n })}</p></li>`; }).join("")}</ul>
          <p class="note">${t("res.themes.legende")}</p>` : `<p class="texte2">${t(lg.themes === "insuffisants" ? "res.themes.insuffisants" : "res.themes.aucun")}</p>`}
          <p class="note" id="themes-note">${t("res.themes.note", { n: lg.themes_avis ? ` (${t("res.n.avis", { n: lg.themes_avis })})` : "" })}</p></section>
        <section class="carte moitie" aria-labelledby="r-col"><div class="carte-tete"><h2 id="r-col">${t("res.collecte.titre")}</h2><a href="#/collecte">${t("res.collecte.ouvrir")}</a></div>${chiffresCollecte(col, true)}
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
  const jourTexte = j => cap(date(j + "T12:00:00"));
  const resumeAction = (a, ph_) => { const d = a.donnees || {};
    if (a.type === "photos") { const noms = (d.photos || []).map(id => (ph_.find(p => p.id === id) || {}).nom_fichier).filter(Boolean); const n = (d.photos || []).length; return `${t("photos.n", { n })}${noms.length ? t("deux.points") + e(noms.join(", ")) : ""}`; }
    if (a.type === "horaires") return `${jourTexte(d.date)}${t("deux.points")}${d.ferme ? t("act.ferme.journee") : t("act.de.a", { a: hm(d.ouverture), b: hm(d.fermeture) })}`;
    return `<span${lc()}>${e(d.titre)}</span>${t("act.du.au", { a: date(d.debut + "T12:00:00"), b: date(d.fin + "T12:00:00") })}${d.conditions ? `${t("act.conditions")}<span${lc()}>${e(d.conditions)}</span>` : ""}`; };
  function champsAction(ph_) {
    const auj = M.aujourdhui(), dates = `<div class="champs deux"><div class="f"><label for="af-debut">${t("act.debut")}</label><input id="af-debut" type="date" min="${auj}" required></div><div class="f"><label for="af-fin">${t("act.fin")}</label><input id="af-fin" type="date" min="${auj}" required></div></div>`;
    const titre = lib => `<div class="f"><label for="af-titre">${lib}</label><input id="af-titre" type="text" maxlength="120" required></div>`;
    return { photos: ph_.length ? `<fieldset><legend>${t("act.photos.legend")}</legend>${ph_.slice(0, 12).map(p => `<label class="option"><input type="checkbox" name="af-photo" value="${e(p.id)}"><span class="casse">${t("act.photo.deposee", { nom: e(p.nom_fichier || t("photo")), d: date(p.cree_le) })}</span></label>`).join("")}</fieldset>`
        : `<p class="texte2">${t("act.aucune.photo")}</p>`,
      offre: titre(t("act.titre.offre")) + dates + `<div class="f"><label for="af-conditions">${t("act.conditions.lib")}</label><textarea id="af-conditions" maxlength="1500"></textarea><p class="aide">${t("act.conditions.aide")}</p></div>`,
      evenement: titre(t("act.titre.evenement")) + dates,
      horaires: `<div class="f"><label for="af-date">${t("cal.date")}</label><input id="af-date" type="date" min="${auj}" required></div>
        <label class="option"><input type="checkbox" id="af-ferme"><span>${t("act.ferme")}</span></label>
        <div class="champs deux" id="af-heures"><div class="f"><label for="af-ouverture">${t("act.ouverture")}</label><input id="af-ouverture" type="time"></div><div class="f"><label for="af-fermeture">${t("act.fermeture")}</label><input id="af-fermeture" type="time"></div></div>` }[typeAction];
  }
  async function ficheGoogle() {
    const [c, l, ph_] = await Promise.all([D.commerce(), D.actionsFiche(), D.photos()]);
    vue.innerHTML = `${pauseBandeau(c)}${retour("#/reglages", "reg.retour")}${entete(t("groupe.reglages"), t("act.titre"), t("act.chapo"))}
      <div class="rangee">
        <section class="carte moitie" aria-labelledby="af-titre-carte"><h2 id="af-titre-carte">${t("act.preparer.titre")}</h2>
          <form id="af"><div class="f"><label for="af-type">${t("act.quoi")}</label><select id="af-type">${Object.entries(TYPES_ACT).map(([k, lib]) => `<option value="${k}"${k === typeAction ? " selected" : ""}>${lib}</option>`).join("")}</select></div>
            <div class="pile" id="af-champs">${champsAction(ph_)}</div>
            <div class="actions"><button class="bouton" type="submit">${t("act.preparer")}</button></div><p class="msg" id="msg" role="status"></p></form></section>
        <section class="carte moitie" aria-labelledby="af-liste-titre"><div class="carte-tete"><h2 id="af-liste-titre">${t("act.vos")}</h2>${l.length ? `<span class="note">${l.length}</span>` : ""}</div>
          <p class="note">${t("act.note")}${D.mode === "demo" ? " " + t("act.demo") : ""}</p>
          ${l.length ? `<ul class="liste actions-fiche">${l.map(a => `<li data-action="${e(a.id)}"><div class="prog"><p><span class="fort">${TYPES_ACT[a.type] || e(a.type)}</span> · <span class="etat${a.statut === "a_valider" ? " actif" : ""}">${ST_ACT[a.statut] || e(a.statut)}</span></p>
            <p class="texte2">${resumeAction(a, ph_)}</p><p class="note">${a.statut === "publie" && a.publie_le ? t("act.publie.le", { d: date(a.publie_le) }) : t("act.prepare.le", { d: date(a.cree_le) })}${a.demo ? t("act.exemple.demo") : ""}</p>
            ${a.statut === "a_valider" ? `<div class="actions serre"><button type="button" class="bouton petit" data-d="approuve">${t("valider")}</button><button type="button" class="lien" data-d="refuse">${t("refuser")}</button></div>` : ""}</div></li>`).join("")}</ul>`
          : `<p class="texte2">${t("act.aucune")}</p>`}</section>
      </div>`;
    const brancherChamps = () => { const f = $("af-ferme"); if (f) f.onchange = () => { $("af-heures").hidden = f.checked; }; };
    brancherChamps();
    $("af-type").onchange = () => { typeAction = $("af-type").value; $("af-champs").innerHTML = champsAction(ph_); brancherChamps(); msg(""); };
    $("af").onsubmit = async ev => {
      ev.preventDefault(); const v = id => ($(id) ? $(id).value : "");
      const d = typeAction === "photos" ? { photos: [...document.querySelectorAll("input[name=af-photo]:checked")].map(x => x.value) }
        : typeAction === "horaires" ? { date: v("af-date"), ferme: $("af-ferme").checked, ouverture: v("af-ouverture"), fermeture: v("af-fermeture") }
        : { titre: v("af-titre"), debut: v("af-debut"), fin: v("af-fin"), conditions: v("af-conditions") };
      try { await D.creerActionFiche(typeAction, d); await ficheGoogle(); msg(t("act.preparee")); } catch (er) { msg(ph(er.message)); }
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
    vue.innerHTML = `${retour("#/reglages", "reg.retour")}${entete(t("groupe.reglages"), t("ecran.notifications"), t("notif.chapo"))}
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
  const champsWhatsapp = c => `<div class="f"><label for="awa-numero">${t("awa.numero")}</label><input id="awa-numero" type="tel" inputmode="tel" autocomplete="tel" maxlength="24" value="${e(c.whatsapp_numero || "")}" placeholder="+33 6 12 34 56 78" aria-describedby="awa-exemple"><p class="aide" id="awa-exemple">${t("awa.exemple")}</p></div>
      <label class="option consentement"><input type="checkbox" id="awa-case"${whatsappActif(c) ? " checked" : ""}><span>${t("awa.case", { n: `<span id="awa-echo" class="casse" translate="no">${e(c.whatsapp_numero || t("awa.vide"))}</span>` })}</span></label>
      ${whatsappActif(c) ? `<p class="note" id="awa-etat">${t("awa.actif", { n: `<span class="casse" translate="no">${e(c.whatsapp_numero)}</span>`, d: date(c.whatsapp_accord_le) })}</p>` : ""}`;
  function brancherEchoWhatsapp() { const i = $("awa-numero"); if (i) i.oninput = () => { $("awa-echo").textContent = i.value.trim() || t("awa.vide"); }; }
  // Rend l'état WhatsApp enregistré (vrai ou faux), ou null si la saisie est incomplète (message affiché).
  async function enregistrerWhatsapp(c) {
    const coche = $("awa-case").checked, num = $("awa-numero").value.trim();
    if (coche && !num) { msg(t("awa.cocher")); $("awa-numero").focus(); return null; }
    if (coche && whatsappActif(c) && window.RENOM_WHATSAPP.numero(num) === c.whatsapp_numero) return true;
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
    return `<div class="etape-tete"><span class="etape-num" aria-hidden="true">${n}</span><h2 id="${id}">${titre}</h2>${etat ? `<span class="etat${etat === "fait" ? " actif" : ""}">${etat === "demande" ? t("mer2.demande.etat") : ETATS_MR[etat] || e(etat)}</span>` : ""}</div>`;
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
    const tel = c.whatsapp_numero || (/^\s*(\+|00)/.test(c.contact || "") ? c.contact : "");
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
    vue.innerHTML = `${entete(t("ecran.demarrage"), e(c.nom), t(avecReseaux ? "mer2.chapo.3" : "mer2.chapo.2"))}
      <p class="msg" id="msg" role="status"></p>
      <ol class="etapes-mer" id="pour-demarrer">
        <li class="carte etape-mer" id="mer-google" data-etat="${e(eg)}">${etapeTete(1, t("mer2.google.titre"), eg, "mer-google-titre")}${google}</li>
        <li class="carte etape-mer" id="mer-photos" data-etat="${eph}">${etapeTete(2, t(g ? "mer2.photos.titre.google" : "mer2.photos.titre"), eph, "mer-photos-titre")}
          <p class="texte2">${ph_.length ? t("mer2.photos.fait", { n: ph_.length }) : t(g ? "mer2.photos.google" : "mer2.photos.texte", { n: pubGoogle(c) })}</p>
          <div class="actions"><a class="bouton second" href="#/photos">${APPAREIL}<span>${t("acc.envoyer.photo")}</span></a></div></li>
        ${reseaux}
      </ol>
      ${merSql(c) ? `<section class="carte rappel" id="rappel" aria-labelledby="rappel-titre"><h2 id="rappel-titre" class="vh">${t("rappel.bouton")}</h2>
        <button type="button" class="bouton second" id="rappel-ouvrir" aria-expanded="false" aria-controls="rappel-f">${t("rappel.bouton")}</button>
        <form id="rappel-f" class="pile serre" novalidate hidden><div class="f"><label for="rappel-tel">${t("rappel.tel")}</label><input id="rappel-tel" type="tel" inputmode="tel" autocomplete="tel" maxlength="24" value="${e(tel)}" placeholder="+33 6 12 34 56 78" aria-describedby="rappel-aide"><p class="aide" id="rappel-aide">${t("rappel.aide")}</p></div>
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
        m.textContent = t(r && r.deja ? "rappel.deja" : "rappel.merci", { tel: e($("rappel-tel").value.trim()) }); } catch (er) { m.textContent = ph(er.message); } };
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
          <p class="pied"><a class="bouton" href="#/style">${t("dem5.style.bouton")}</a></p></section>
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
    return `<section class="va-bloc" id="video-avis" aria-labelledby="va-titre"><div class="carte-tete"><h2 id="va-titre">${t("ecran.videoavis")}</h2><a href="#/photos" id="va-fermer">${t("fermer")}</a></div>
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

  // ---- Votre style (kit de marque) ---------------------------------------------------------------------------------
  // Le style est créé par BoostImpact (console, panneau « Style du commerce ») à partir du logo et des photos. Écran du groupe « Mon commerce » :
  // le style montré sur les photos du commerce (aperçus des 3 gabarits), le logo à déposer, « Ça me plaît », « Je voudrais un changement »,
  // et les expressions maison / à éviter en option repliée. Aucune couleur, police ni ambiance à choisir ici.
  // Tant que rien n'est validé, les contenus partent avec le style proposé. Écran partagé avec la console : marque.js, fonction ecran.
  const MQ = window.RENOM_MARQUE;
  Object.assign(ETAPES, I.carte("etape", ["MARQUE_PROPOSEE", "MARQUE_ENREGISTREE", "MARQUE_VALIDEE", "MARQUE_REGLEE_RENOM", "MARQUE_VALIDEE_RENOM", "STYLE_CHANGEMENT_DEMANDE",
    "MARQUE_APERCUS", "LOGO_ILLISIBLE", "VIDEO_GENEREE_REFUSEE"]));
  const styleEcran = MQ.ecran({ vue, I, mode: "commercant", entete: () => retour("#/reglages", "reg.retour") + entete(t("groupe.reglages"), t("ecran.style"), t("sty.chapo")),
    commerce: () => D.commerce(), marque: () => D.marque(), deposerLogo: f => D.deposerLogo(f),
    regler: (p, v) => D.reglerMaMarque(p, v), demander: x => D.demanderChangementStyle(x), apres: async () => majCompteurs() });
  // Carte du style : « Votre style est prêt » quand BoostImpact l'a validé, « Nous créons votre style » avant ; rien une fois que le commerçant l'a validé.
  // Accueil (25/10/2026) : seulement « prêt » (le commerçant a quelque chose à regarder) ; Réglages : les deux états.
  const carteStyle = (c, surAccueil) => {
    const m = c.marque, pret = !!(m && m.verrouille && m.valide_par === "renom");
    if (m && m.verrouille && !pret) return "";
    if (surAccueil && !pret) return "";
    const k = pret ? "acc.style.pret" : "acc.style";
    return `<section class="carte style-accueil" id="carte-style" aria-labelledby="carte-style-titre"><div class="style-accueil-corps">
      <div><h2 id="carte-style-titre">${t(k + ".titre")}</h2><p class="texte2">${t(k + ".texte")}</p></div>
      ${m && m.couleurs ? `<div class="style-nuancier" aria-hidden="true">${["principale", "secondaire", "fond", "texte"].map(x => `<span style="background:${e(m.couleurs[x])}"></span>`).join("")}</div>` : ""}</div>
      <p class="pied"><a class="bouton" href="#/style">${t("acc.style.bouton")}</a></p></section>`;
  };
  const style = () => styleEcran.rendre();
  // ---- fin du bloc Votre style ------------------------------------------------------------------------------------

  // ---------------- Routage
  const ROUTES = { connexion, accueil, resultats, fiche, photos, avalider, contenus, calendrier, avis, commentaires, collecte, fichegoogle: ficheGoogle, comptes, offre, notifications, demarrage, videoavis: videoAvis, style, reglages };
  // Administrateur arrivé dans l'espace des commerçants (25/10/2026) : il le dit, avec « Ouvrir la console » et « Se connecter avec un autre compte »
  // (déconnexion, puis le formulaire de connexion). Même écran que la console pour un commerçant (console.js, refuse).
  function reserveCommercants() {
    connecte = false; derniere = null; dessinerNav();
    vue.innerHTML = `<div class="connexion"><div class="carte" id="acces-reserve"><div class="connexion-tete"><p class="logo" translate="no">boostimpact<span class="logo-point">.</span><span class="logo-suffixe">agency</span></p>${I.selecteur()}</div>
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
    if (derniere !== route) { filtre = null; window.scrollTo(0, 0); if (route !== "contenus") ideesOuvertes = false; if (route !== "videoavis") vaOuvert = false; if (derniere === "demarrage") { dem.vue = null; if (dem.fini) dem.pour = null; } } derniere = route;
    ecranCourant = ROUTES[route];
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
