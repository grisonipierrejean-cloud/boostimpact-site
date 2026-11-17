// Couche de données de l'espace : UNE interface, DEUX adaptateurs.
//   - démonstration (navigateur seulement, faux services) : config.js vide ;
//   - Supabase : config.js renseigné (supabaseUrl, publishableKey).
// Les écrans n'appellent que RENOM_DATA : passer de l'un à l'autre ne change aucun écran.
(function () {
  const cfg = window.RENOM_CONFIG || {};
  // Offres (moteur/offres.json et moteur/offres_retirees.json, égalité testée par moteur/tests/test_commentaires.js). Trois offres en vente depuis le 16/10/2026 :
  // Essentiel (fiche Google seule), Standard (réseaux retenus), Premium (20 contenus dont 8 vidéos depuis le lot 9 du 16/11/2026, mode délégation). Unité : contenus originaux par mois
  // (publications + vidéos). Croissance et Signature : retirées (retiree: true), gardées pour un ancien commerce ; jamais proposées. Aucun plafond de commentaires.
  const OFFRES = {
    essentiel: { nom: "Essentiel", nom_nl: "Essentieel", nom_en: "Essential", contenus: 4, publications: 4, videos: 0, reseaux_sociaux: false, commentaires: false, commentaires_disponible: false, tiktok: false, avis_auto: true, delegation: false, avis_equipe: true, frais_mise_en_route: false, prix_ht: 79, prix_annuel_ht: 948, prix_mensuel_ht: 95 },
    standard: { nom: "Croissance", nom_nl: "Groei", nom_en: "Growth", contenus: 8, publications: 8, videos: 0, reseaux_sociaux: true, commentaires: true, commentaires_disponible: false, tiktok: true, avis_auto: true, delegation: false, avis_equipe: true, frais_mise_en_route: true, prix_ht: 190, prix_annuel_ht: 2280, prix_mensuel_ht: 228 },
    premium: { nom: "Premium", nom_nl: "Premium", nom_en: "Premium", contenus: 20, publications: 12, videos: 8, reseaux_sociaux: true, commentaires: true, commentaires_disponible: false, tiktok: true, avis_auto: true, delegation: true, avis_equipe: true, frais_mise_en_route: true, prix_ht: 390, prix_annuel_ht: 4680, prix_mensuel_ht: 468 },
    croissance: { nom: "Croissance (ancienne offre)", contenus: 20, publications: 16, videos: 4, reseaux_sociaux: true, commentaires: true, tiktok: true, avis_auto: true, delegation: false, avis_equipe: false, retiree: true },
    signature: { nom: "Signature", contenus: 32, publications: 24, videos: 8, reseaux_sociaux: true, commentaires: true, tiktok: true, avis_auto: true, delegation: false, avis_equipe: false, retiree: true } };
  const OFFRES_EN_VENTE = Object.keys(OFFRES).filter(k => !OFFRES[k].retiree);
  // Version des CGV notée avec un accord donné dans l'espace (mode délégation, 27/10/2026) : documents.version de site/legal.json, comme regler_delegation
  // (schema.sql, bloc « Carrousels TikTok, paiement depuis l'espace et CGV du 2 novembre 2026, version 2 ») ; égalité testée par espace/test_ecrans.py.
  const VERSION_CGV = "16 novembre 2026, version 2";   // 16/11/2026, version 2 : lot 9 et musique (Visibilité IA en 7 jours, Premium 12 + 8, vidéos sur Instagram et TikTok) ; 16/11/2026 : CGV du lot 8 (alerte WhatsApp, OK écrit, retouches, droit du pays du Client) ;   // 15/11/2026 : bloc « Visibilité IA comprise dans Croissance et Premium » (regler_delegation, même version) ; avant : 14 novembre 2026
  const MSG_OFFRES = "Offres en vente : " + OFFRES_EN_VENTE.map(k => OFFRES[k].nom).join(", ") + ".";   // même phrase que schema.sql
  // Chiffres de la garantie des délais, des relances, de la délégation et du paiement (moteur/conditions_offre.json, conditions_offre() de schema.sql)
  // et frais de mise en route (site/legal.json : Standard et Premium seulement).
  const CONDITIONS = { garantie_delais: { fiche_optimisee_jours: 7, premier_contenu_heures: 72, avis_traite_heures: 24, alerte_fiche_avant_heures: 48, alerte_contenu_avant_heures: 24,
      alerte_avis_avant_heures: 4, contrepartie: "mois_suivant_offert" },
    avis: { collecte_minutes: 15, relances_client_heures: [4, 24] }, delegation: { publication_auto_heures: 48 }, annuel: { mois_couverts: 12, majoration_mensuel_pct: 20 },
    objectif_interne_pilotes: { nouveaux_avis: 10, jours: 60, rappel_jour: 45, en_vue_pct: 75, fermeture_prolonge_au_dela_de_jours: 7 },
    mise_en_route: { prix_ht: 190, offerts_paiement: "annuel", offres: ["standard", "premium"], offerts_apres_option: "visibilite_ia" } };
  // « Appelez-moi avant de publier » (15/11/2026, CGV art. 9 et 10 ; même règle que echeance_avis de schema.sql, bloc « délai de 24 h suspendu ») :
  // échéance = reçu + 24 h ; chaque retenue commencée AVANT l'échéance du moment la suspend (ouverte : aucune échéance, null) ; levée par
  // l'appel, l'échéance devient « appel + 24 h ». Une retenue commencée après l'échéance n'efface pas le retard. Rend des millisecondes ou null.
  function echeanceAvis(recu, retenues, heures) {
    const h = (heures != null ? heures : CONDITIONS.garantie_delais.avis_traite_heures) * 3600000, r0 = Date.parse(recu);
    if (!Number.isFinite(r0)) return null;
    let e = r0 + h;
    for (const r of [...(retenues || [])].filter(x => x && x.retenue_le).sort((a, b) => Date.parse(a.retenue_le) - Date.parse(b.retenue_le))) {
      if (Date.parse(r.retenue_le) >= e) continue;
      if (!r.liberee_le) return null;
      e = Math.max(e, Date.parse(r.liberee_le) + h);
    }
    return e;
  }
  // Appel promis (lot 5 B, 15/11/2026, revue exploitant : « l'appel promis au commerçant n'apparaît jamais dans À sortir aujourd'hui ») : un avis
  // retenu porte le jour du rappel choisi par le commerçant (retenue_jour, rendu rappel_jour par admin_file_avis) et sa plage (« 9-18 », ou
  // « 15-17 »). L'appel est dû ce jour-là avant la fin de la plage : 18 h, heure de Paris (17 h pour 15-17). C'est une tâche de l'équipe, à part de
  // la garantie des 24 h (suspendue pendant la retenue, CGV art. 10) : un appel en retard ne crée jamais de mois offert. Rend des millisecondes ou null.
  function echeanceAppel(jour, creneau) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(jour || ""))) return null;
    const h = creneau === "15-17" ? 17 : 18;
    for (const off of [1, 2]) { const ms = Date.parse(`${jour}T${String(h - off).padStart(2, "0")}:00:00Z`);
      const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23", hour: "2-digit" }).format(new Date(ms));
      if (+p === h) return ms; }
    return null;
  }
  // Retenues d'un avis de la démonstration : son historique (a.retenues), plus une retenue en cours posée avant cet historique.
  // Lot 9d : logo joint à la dernière demande de changement non traitée (« Nouveau logo : <commerce>/marque/… », écrit par « Vos publications »).
  // Seul un chemin du dossier marque du commerce est repris ; la console le montre et le reprend dans le panneau, sans rien enregistrer.
  function logoDemande(c, demandes) {
    const d = (demandes || []).find(x => !x.traitee_le && /Nouveau logo : /.test(x.texte || "")); if (!d) return null;
    const m = /Nouveau logo : (\S+)/.exec(d.texte), ch = m && m[1];
    return ch && ch.startsWith(c.id + "/marque/") && !/\.\./.test(ch) ? { chemin: ch, cree_le: d.cree_le } : null;
  }
  const RETENUE_SANS_MESSAGE_HEURES = 48;   // lot 8 : même valeur que retenue_sans_message_heures() (schema.sql)
  const RETOUCHE_DELAI_HEURES = 48;   // lot 8 : CGV art. 3, nouvelle proposition sous 48 h après une demande de retouche
  const retenuesDe = a => { const l = Array.isArray(a.retenues) ? a.retenues.slice() : []; if (a.retenue_le && !l.some(x => x.retenue_le === a.retenue_le)) l.push({ retenue_le: a.retenue_le, liberee_le: null }); return l; };
  // Options ponctuelles (22/10/2026, CGV article 3 bis) : mêmes noms et délais que moteur/options.json et options_ponctuelles de schema.sql
  // (égalité testée par espace/test_ecrans.py et rls.test.mjs). Livraison : jours après le paiement ou la réception des éléments du client, le plus tardif.
  // Modèle hybride (décision de PJ du 15/11/2026, CGV du 15 novembre 2026, article 3 bis) : la Visibilité IA est COMPRISE dans la mise en route de
  // Croissance (standard) et Premium, mesure refaite tous les 90 jours en Premium (remesure_jours_premium).
  // 15/11/2026, 12 h 29 (décision de PJ) : comprise SEULEMENT en paiement annuel (inclus_annuel) ; au mois, option pour toutes les offres.
  const OPTIONS = { visibilite_ia: { nom: "Visibilité IA", nom_en: "AI visibility", nom_nl: "Zichtbaarheid in AI", prix_ht: 490, livraison_jours: 7, objectif_heures_ouvrees: 72,
      mesures_jours: [7, 30, 90], second_test_jours: 90,
      inclus_annuel: ["standard", "premium"], achetable_par: ["essentiel", "standard", "premium"], remesure_jours_premium: 90 },
    site_restaurant: { nom: "Site du restaurant", nom_en: "Restaurant website", nom_nl: "Website van het restaurant", prix_ht: 990, livraison_jours: 14, second_test_jours: null } };
  // Une option s'achète-t-elle pour cette offre, à ce rythme de paiement ? Non quand l'offre la comprend déjà (Visibilité IA en Croissance et Premium
  // payés à l'année) ; même règle que option_achetable(offre, rythme, option) de schema.sql (bloc « Visibilité IA comprise dans Croissance et Premium »).
  // L'espace ne vend aucune option (paiement par lien). Rythme inconnu : mensuel (rien de compris).
  const optionIncluse = (offre, rythme, opt) => rythme === "annuel" && ((OPTIONS[opt] || {}).inclus_annuel || []).includes(offre);
  const optionAchetable = (offre, rythme, opt) => { const o = OPTIONS[opt]; if (!o || optionIncluse(offre, rythme, opt)) return false; return !o.achetable_par || o.achetable_par.includes(offre); };
  // Option payée par le commerce (commandes_options : à livrer ou livrée ; lecture du commerçant, mesCommandesOptions) : décide des frais de mise en
  // route offerts à la montée depuis l'Essentiel (site/legal.json offerts_apres_option ; la base revérifie : lire_jeton_paiement, checkout.js).
  const optionPayee = (cmds, opt) => (cmds || []).some(k => k && k.option_id === opt && (k.statut === "a_livrer" || k.statut === "livree"));
  // Réseaux où un commerce peut publier (même règle que reseaux_autorises() de schema.sql et redaction.reseaux_du_commerce) : la fiche Google toujours ;
  // Instagram, Facebook, TikTok si l'offre comprend les réseaux sociaux ET s'ils sont retenus (aucun choix enregistré : ceux de l'offre).
  const reseauxAutorises = c => { const o = OFFRES[(c || {}).offre_id] || {}, ret = Array.isArray((c || {}).reseaux_retenus) ? c.reseaux_retenus : ["instagram", "facebook", "tiktok"];
    return ["instagram", "facebook", "google", "tiktok"].filter(r => r === "google" || (o.reseaux_sociaux && ret.includes(r) && (r !== "tiktok" || o.tiktok))); };
  const METIER_EQUIPE = "Le métier de votre commerce se change par l'équipe BoostImpact : remettez le métier d'avant et écrivez-nous, nous le corrigeons.";
  const FICHE = ["nom", "metier", "ville", "ton", "specialites", "horaires", "mots_cles", "mentions_autorisees", "contact", "email_validation", "couleurs", "reglage_avis", "lien_avis", "notifications", "commentaires_compliments_auto"];
  const RESEAUX = ["instagram", "facebook", "tiktok", "google"];   // ordre fixe d'affichage (31/10/2026) : Instagram, Facebook, TikTok, Fiche Google
  // Même refus que le déclencheur a_reseaux_retenus de schema.sql : un réseau hors de l'offre ou non retenu à la mise en route ne se programme pas.
  const horsOffre = (c, r) => { if (!reseauxAutorises(c).includes(r)) throw new Error("réseau non compris dans l'offre ou non retenu pour ce commerce : " + r); };
  // Journal : types INTERNES, jamais montrés au commerçant (objectif interne des pilotes, ancienne garantie « 10 avis », saisies et décisions de
  // l'équipe, alertes et emails de l'exploitant). Même liste que journal_interne() de schema.sql (bloc « Programmation à l'approbation »), qui les
  // refuse déjà au commerçant (règle journal_lecture) ; ce filtre couvre la démonstration et une base pas encore à jour. Égalité testée par rls.test.mjs.
  // Mode de secours des avis (20/10/2026) : une réponse « à publier sur Google » qui attend depuis 4 h déclenche une alerte à l'équipe (même valeur
  // que secours_alerte_heures() de schema.sql, égalité testée par rls.test.mjs) ; la console met la carte en évidence à partir de là.
  const SECOURS_ALERTE_HEURES = 4;
  // Numéro WhatsApp ou de rappel au format international E.164 (même règle que numero_international de schema.sql, bloc « Créneaux réels » ;
  // égalité testée par supabase/test/creneaux.test.mjs) : espaces, points, tirets et parenthèses retirés, « 00 » lu comme « + ». Numéro national
  // qui commence par 0 (31/10/2026, test client Premium belge) : indicatif du pays du commerce (+32 pour 'BE', +33 pour 'FR') ; pays inconnu : refusé.
  const INDICATIFS = { BE: "+32", FR: "+33" }, EXEMPLES_NUMERO = { BE: "+32 470 12 34 56", FR: "+33 6 12 34 56 78" };
  // Jour civil à Paris (« AAAA-MM-JJ ») et relance d'une version du commerçant restée 48 h sans reprise (01/11/2026, tour 6 Premium).
  const jourParisDemo = ms => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
  const relanceVersion = a => !!a.version_client && !!a.version_client_le && Date.now() > Date.parse(a.version_client_le) + 48 * 36e5 && !(a.propose_le && a.propose_le >= a.version_client_le);
  const numeroWhatsapp = (v, pays) => { let n = String(v == null ? "" : v).replace(/[\s().-]/g, ""), ind = INDICATIFS[String(pays || "").toUpperCase()];
    if (n.startsWith("00")) n = "+" + n.slice(2); else if (ind && /^0[1-9]/.test(n)) n = ind + n.slice(1); return /^\+[1-9]\d{7,14}$/.test(n) ? n : null; };
  // Exemple de numéro selon le pays du commerce (champs, aides, phrases d'erreur) : Belgique +32 470 12 34 56, sinon +33 6 12 34 56 78.
  const exempleNumero = pays => EXEMPLES_NUMERO[String(pays || "").toUpperCase() === "BE" ? "BE" : "FR"];
  // Fixe ou mobile (31/10/2026, test client Essentiel, tour 5) : même règle que numero_fixe de schema.sql (bloc « Créneaux réels », égalité testée) :
  // Belgique, mobile = +324 et 8 chiffres ; France, mobile = +336 ou +337 ; autre pays : jamais compté comme fixe. WhatsApp ne reçoit pas un fixe.
  const numeroFixe = n => { n = String(n || ""); return n.startsWith("+32") ? !/^\+324\d{8}$/.test(n) : n.startsWith("+33") ? !/^\+33[67]\d{8}$/.test(n) : false; };
  const PHRASE_FIXE = "Ce numéro ressemble à un fixe : WhatsApp ne le recevra pas.";
  // Lot 10 (17/11/2026) : numéro de TVA FACULTATIF, demandé à la mise en route s'il est absent, jamais bloquant. Même règle que regler_numero_tva
  // (bloc « Lot 10 » de schema.sql) : lettres en capitales, espaces, points et tirets retirés ; un numéro belge à 10 chiffres reçoit « BE », un
  // SIREN français ne suffit pas (le numéro de TVA commence par FR et 2 caractères de clé) ; code pays de 2 lettres, puis 8 à 13 caractères.
  const PHRASE_TVA = "Numéro de TVA illisible : écrivez-le avec le code du pays, par exemple FR12345678901 ou BE0123456789.";
  const numeroTva = (x, pays) => { let v = String(x || "").toUpperCase().replace(/[\s.\-\/]/g, ""); if (/^[01]\d{9}$/.test(v) && pays === "BE") v = "BE" + v;
    return /^(FR[0-9A-Z]{2}\d{9}|BE[01]\d{9}|(?!FR|BE)[A-Z]{2}[0-9A-Z]{8,13})$/.test(v) ? v : null; };
  // Numéro tel qu'enregistré, mis en forme pour la lecture : +32 472 12 34 56, +33 6 12 34 56 78 ; un autre numéro reste tel quel.
  const numeroLisible = n => { n = String(n || ""); let m = n.match(/^\+32(4\d{2})(\d{2})(\d{2})(\d{2})$/); if (m) return "+32 " + m.slice(1).join(" ");
    m = n.match(/^\+32(\d)(\d{3})(\d{2})(\d{2})$/); if (m) return "+32 " + m.slice(1).join(" ");
    m = n.match(/^\+33(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/); return m ? "+33 " + m.slice(1).join(" ") : n; };
  const PHRASES_MARQUE = { invalide: "Identifiant de marque Metricool invalide : des chiffres seulement (blogId, lu dans l'adresse de la marque sur Metricool).",
    prise: "Cette marque Metricool est déjà celle d'un autre commerce." };
  const phraseWhatsapp = pays => "Numéro WhatsApp invalide : indiquez l'indicatif du pays, par exemple " + exempleNumero(pays) + ".";
  // Numéro WhatsApp obligatoire au démarrage (11/11/2026, décision de PJ ; même phrase que enregistrer_demarrage, bloc « Numéro WhatsApp obligatoire
  // au démarrage » de schema.sql) : WhatsApp actif = numéro E.164, accord daté, notifications.whatsapp vrai (whatsapp_actif de schema.sql).
  const PHRASE_WA_MANQUANT = "Numéro WhatsApp manquant : indiquez votre numéro WhatsApp et cochez la case d'accord, puis terminez le démarrage.";
  // Case de l'équipe (12/11/2026, admin_regler_whatsapp) : même phrase que la base.
  const PHRASE_WA_ACCORD_EQUIPE = "Cochez la case : le client doit avoir donné son accord pour recevoir ses alertes par WhatsApp.";
  const PHRASE_PHOTOS_ACCORD_EQUIPE = "Cochez la case : le client doit avoir donné son accord pour que BoostImpact utilise ses photos.";
  // Accord vidéo IA noté par l'équipe (14/11/2026) : même phrase que admin_regler_accord_video_ia (schema.sql).
  const PHRASE_VIA_ACCORD_EQUIPE = "Cochez la case : le client doit avoir donné son accord pour que ses photos soient animées par IA chez Higgsfield.";
  const whatsappActifDe = c => !!(c && c.whatsapp_numero && c.whatsapp_accord_le && (c.notifications || {}).whatsapp);
  // ---- Mise en route claire (27/10/2026, bloc SQL « Mise en route claire et travail visible ») : mêmes règles et mêmes phrases que la base.
  const MER = { SUJETS: ["mise_en_route", "google", "reseaux", "avis_sensible", "changement_offre"], CAS_FICHE: ["pas_de_fiche", "pas_a_mon_nom"],
    TEXTES: { nom_vide: "Indiquez le nom de votre commerce.", nom_long: "Le nom est trop long (120 caractères au plus).",
      telephone: "Numéro de téléphone invalide : indiquez l'indicatif du pays, par exemple +33 6 12 34 56 78.",
      telephone_be: "Numéro de téléphone invalide : indiquez l'indicatif du pays, par exemple +32 470 12 34 56.", sujet: "Sujet inconnu.",
      cas: "Cas inconnu : pas de fiche, ou fiche pas à votre nom.", deja_verifiee: "Votre fiche est déjà vérifiée par Google.",
      fiche_en_creation: "Fiche Google en création : la garantie démarre à sa vérification par Google (console, « Fiche vérifiée par Google »).",
      date_verif: "Date de vérification invalide (aujourd'hui au plus tard).", decision: "Décision inconnue : approuver ou en parler.",
      avis_introuvable: "Avis introuvable.", avis_equipe: "Avec votre offre, notre équipe répond elle-même à cet avis.", rien_a_approuver: "Aucune réponse proposée à approuver pour cet avis." },
    nom(v) { const n = String(v == null ? "" : v).replace(/\s+/g, " ").trim(); if (n.length < 2) throw new Error(MER.TEXTES.nom_vide); if (n.length > 120) throw new Error(MER.TEXTES.nom_long); return n; },
    telephone(v, pays) { const n = numeroWhatsapp(v, pays); if (!n) throw new Error(MER.TEXTES[String(pays || "").toUpperCase() === "BE" ? "telephone_be" : "telephone"]); return n; } };
  window.RENOM_MER = MER;
  // ---- Fiche Google du client venu du site (28/10/2026, bloc SQL « Fiche Google du client venu du site et photos hors sujet ») : mêmes règles et
  // mêmes phrases que lien_fiche_google, place_id_de_lien et etat_fiche_google de schema.sql (et que moteur/audit/lien_google.py : FORMAT, extraire).
  const FG = { TEXTES: { vide: "Collez le lien de votre fiche Google.",
      format: "Ce lien ne vient pas de Google. Ouvrez votre fiche dans Google Maps, touchez « Partager », puis « Copier le lien ».",
      identifiant: "Identifiant de lieu illisible : collez le place_id (ChIJ…) ou un lien Google Maps qui le contient (query_place_id=…)." },
    GOOGLE: /^https?:\/\/(?:(?:www\.)?google\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})\/(?:maps|search)(?:[\/?#]|$)|maps\.google\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})(?:[\/?#]|$)|(?:share\.google|g\.co|maps\.app\.goo\.gl|g\.page|business\.google\.com)\/|goo\.gl\/maps(?:[\/?#]|$))[^\s"<>]*$/i,
    SANS_SCHEMA: /^(share\.google|g\.co|maps\.app\.goo\.gl|goo\.gl|g\.page|business\.google\.com|(www\.|maps\.)?google\.)/i,
    ID: /^[A-Za-z0-9_-]{10,255}$/,
    lien(v) { const t = String(v == null ? "" : v).replace(/\s+/g, " ").trim(), m = t.match(/https?:\/\/[^\s"<>]+/i);
      let u = m ? m[0] : FG.SANS_SCHEMA.test(t) ? "https://" + t.split(" ")[0] : null; if (!u) return null; u = u.slice(0, 500); return FG.GOOGLE.test(u) ? u : null; },
    placeId(u) { if (!u) return null; for (const re of [/[?&]query_place_id=([A-Za-z0-9_-]{10,255})(?:[&#]|$)/, /[?&]place_id=([A-Za-z0-9_-]{10,255})(?:[&#]|$)/,
        /[?&](?:q|query)=place_id(?::|%3[Aa])(?:\+|%20)?([A-Za-z0-9_-]{10,255})(?:[&#]|$)/, /!19s(ChIJ[A-Za-z0-9_-]{10,255})/]) { const m = String(u).match(re); if (m) return m[1]; } return null; },
    etat(c) { return !c ? "aucune" : c.fiche_google_a_identifier_le ? "equipe" : c.fiche_google_a_resoudre_le ? "recherche" : FG.ID.test(c.google_place_id || "") ? "reconnue" : c.fiche_google_lien ? "equipe" : "aucune"; },
    // Le bloc SQL est-il appliqué ? (la colonne fiche_google_lien_le existe) : sinon, aucun champ dans l'espace ni dans la console.
    sql: c => !!c && "fiche_google_lien_le" in c,
    // Recherche automatique sans réponse depuis 2 h (n8n ou GitHub Actions en panne) : carte « Identifier la fiche Google » dans la console.
    ATTENTE_HEURES: 2 };
  window.RENOM_FICHE = FG;
  window.RENOM_WHATSAPP = { numero: numeroWhatsapp, exemple: exempleNumero, fixe: numeroFixe, lisible: numeroLisible, actif: whatsappActifDe, PHRASE_FIXE, PHRASE_WA_MANQUANT };
  const JOURNAL_INTERNE = window.RENOM_JOURNAL_INTERNE = { types: ["GARANTIE_DELAIS_SAISIE", "MANQUEMENT_ECARTE", "MOIS_OFFERT_A_APPLIQUER",
    "VALIDATION_TACITE_A_PROGRAMMER", "MISE_EN_ROUTE_BLOQUEE", "ERREUR_WORKFLOW", "ECHEC_RELANCE_PROSPECT", "RELEVE_ECHEC", "AVIS_SENSIBLE_A_EFFACER",
    "COMMENTAIRE_SENSIBLE_A_EFFACER", "PAIEMENT_REFUSE", "ABONNEMENT_SANS_COMMERCE", "REMISE_LANCEMENT_DEJA_UTILISEE", "ALERTE_PAR_EMAIL", "ALERTE_EMAIL_ECHEC", "ALERTE_SANS_CANAL", "EFFACEMENT_AUTOMATIQUE", "CONTACT_REGLE", "LIEN_AVIS_REGLE", "AVIS_VERSION_CLIENT", "AVIS_RETENU", "AVIS_LIBERE", "METRICOOL_MARQUE_NOTEE"], prefixes: ["OBJECTIF_PILOTE_", "GARANTIE_AVIS_", "DELAI_", "EMAIL_ALERTE_", "SECOURS_", "PUBLICATION_A_LA_MAIN_", "WHATSAPP_"] };   // SECOURS_ : mode de secours des avis (20/10/2026) ; PUBLICATION_A_LA_MAIN_ : publication sans Metricool (22/10/2026) ; WHATSAPP_ et ALERTE_ : alertes WhatsApp au commerçant (22/10/2026)
  const journalInterne = t => JOURNAL_INTERNE.types.includes(t) || JOURNAL_INTERNE.prefixes.some(p => String(t || "").startsWith(p));
  const journalCommercant = l => (l || []).filter(j => !journalInterne(j.type));
  // Contrôle d'une photo : RENOM_ENVOI.controler (espace/web/envoi.js, type annoncé ou extension, 50 Mo), règles de l'envoi : PHOTOS plus bas.
  // Mois en cours à l'heure de Paris (01/11/2026, vu à 0 h 03 le 1er novembre : le mois UTC était encore octobre, compteurs à zéro).
  const mois0 = () => { const p = partiesParis(Date.now()); return ymd(p.a, p.m, 1); };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  const REGLES = { programme: "Seul un contenu approuvé se programme.", futur: "La date doit être dans le futur." };

  // ---- Collecte : règles communes aux deux adaptateurs (les mêmes que dans schema.sql)
  const RETOUR = { message: 1000, prenom: 60, parHeure: 20, parJour: 100 };
  // Lien d'avis réellement proposé au public : celui de la fiche s'il est en https, sinon celui construit sur l'identifiant de lieu.
  const lienAvisPublic = c => {
    const l = String((c && c.lien_avis) || "").trim(); if (/^https:\/\/[^\s"<>]+$/i.test(l)) return l;
    return c && /^[A-Za-z0-9_-]+$/.test(c.google_place_id || "") ? "https://search.google.com/local/writereview?placeid=" + c.google_place_id : null;
  };
  const nettoyerRetour = r => {
    const note = Number(r && r.note), message = String((r && r.message) || "").trim(), prenom = String((r && r.prenom) || "").trim();
    if (!Number.isInteger(note) || note < 1 || note > 5) throw new Error("Choisissez une note de 1 à 5.");
    if (message.length > RETOUR.message) throw new Error("Votre message est trop long (1 000 caractères au plus).");
    if (prenom.length > RETOUR.prenom) throw new Error("Votre prénom est trop long (60 caractères au plus).");
    return { note, message: message || null, prenom: prenom || null };
  };
  // Page publique avis.html branchée sur Supabase : deux appels de fonctions SQL, sans session et sans la bibliothèque Supabase.
  const rpcPublic = async (nom, args) => {
    const r = await fetch(String(cfg.supabaseUrl).replace(/\/+$/, "") + "/rest/v1/rpc/" + nom, { method: "POST", headers: { apikey: cfg.publishableKey, "Content-Type": "application/json" }, body: JSON.stringify(args) });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error((d && d.message) || "Le service ne répond pas. Réessayez dans un instant.");
    return d;
  };
  const premierDe = l => (Array.isArray(l) ? l[0] : l) || null;
  const publicSupabase = {
    mode: "supabase",
    async avisPublic(jeton) { return premierDe(await rpcPublic("avis_public", { p_jeton: String(jeton || "") })); },
    async deposerRetour(jeton, r) { const v = nettoyerRetour(r); await rpcPublic("deposer_retour_prive", { p_jeton: String(jeton || ""), p_note: v.note, p_message: v.message, p_prenom: v.prenom }); },
    // ---- Mise à jour de l'espace membre : mesure de la collecte et validation par lien (fonctions publiques, rôle anon)
    async compterCollecte(jeton, type, canal) {
      if (!TYPES_COLLECTE.includes(type)) return;
      // Automatisations de service : page ouverte depuis l'email de demande d'avis (avis.html?source=email&envoi=<jeton>), comptée avec sa source.
      if (canal && canal.source === "email" && /^[0-9a-f]{32}$/.test(canal.envoi || "")) return void await rpcPublic("compter_collecte_email", { p_jeton: String(jeton || ""), p_type: type, p_envoi: canal.envoi });
      await rpcPublic("compter_collecte", { p_jeton: String(jeton || ""), p_type: type });
    },
    // ---- Automatisations de service : page de désinscription (desinscription.html#<jeton>), sans connexion
    async desinscriptionInfo(jeton) { return premierDe(await rpcPublic("desinscription_info", { p_jeton: String(jeton || "") })); },
    async seDesinscrire(jeton) { return premierDe(await rpcPublic("se_desinscrire", { p_jeton: String(jeton || "") })); },
    // La base renvoie l'objet imbriqué ({contenu:{…}} ou {avis:{…}}) ; la page attend une forme à plat, comme en démonstration.
    async objetParJeton(jeton) {
      const r = premierDe(await rpcPublic("objet_par_jeton", { p_jeton: String(jeton || "") })); if (!r) return null;
      const base = { etat: "a_valider", objet: r.objet, commerce: r.commerce, expire_le: r.expire_le, langue: r.langue || null };
      // apercu_9x16_url : visuel TikTok d'une publication photo (bloc SQL « Aperçus par réseau », 15/10/2026) ; absent d'un lien plus ancien.
      if (r.contenu) { const c = r.contenu; return { ...base, type: c.type, format: c.format, legende: c.legende || "", legendes: c.legendes || null, visuel_url: c.apercu_url || null, visuel_9x16_url: c.apercu_9x16_url || null, video_url: null, ia: c.ia === true,
        // reseaux : réseaux où ce commerce publie (bloc SQL « Réseaux de l'offre sur la page de validation », 30/10/2026) ; absent avant ce bloc.
        reseaux: Array.isArray(c.reseaux) ? c.reseaux : null,
        // connectes : comptes connectés (bloc « Créneaux réels », 31/10/2026) ; absent avant ce bloc : la page compte alors tous les réseaux comme partants.
        connectes: Array.isArray(c.connectes) ? c.connectes : null, tiktok_demande_le: c.tiktok_demande_le || null }; }
      if (r.avis) { const a = r.avis; return { ...base, note: a.note, texte: a.texte || "", auteur: a.auteur || "", reponse_proposee: a.reponse_proposee || "" }; }
      if (r.commentaire) { const m = r.commentaire; return { ...base, reseau: m.reseau, categorie: m.categorie, texte: m.texte || "", auteur: m.auteur || "", reponse_proposee: m.reponse_proposee || "", recu_le: m.recu_le }; }
      return r;
    },
    // Réponse : {objet, id, statut, prevu_le, reseaux} ; prevu_le et reseaux : la programmation faite à l'approbation (bloc « Programmation à l'approbation »).
    async validerParJeton(jeton, decision, texte) { return premierDe(await rpcPublic("valider_par_jeton", { p_jeton: String(jeton || ""), p_decision: decision, p_texte: texte == null ? null : String(texte) })); },
    // ---- Tournée du jour (bloc « Prospection quotidienne » de schema.sql) : lien « résultat » de l'email de PJ (resultat.html#<jeton>), sans connexion
    async prospectParJeton(jeton) { return premierDe(await rpcPublic("prospect_par_jeton", { p_jeton: String(jeton || "") })); },
    async resultatParJeton(jeton, resultat, note) { return premierDe(await rpcPublic("resultat_par_jeton", { p_jeton: String(jeton || ""), p_resultat: resultat, p_note: note == null ? null : String(note) })); },
  };
  // Résultats possibles d'un prospect de la tournée et effet (mêmes règles que appliquer_resultat_prospect de schema.sql).
  const RESULTATS_TOURNEE = ["pas_interesse", "rappeler", "rdv", "pilote"];
  // ---- Collecte : fin des règles communes

  // ---- Mise à jour de l'espace membre : règles communes aux deux adaptateurs (contrat : ordres/CONTRAT-MAJ-MEMBRE.md)
  const TYPES_COLLECTE = ["passage", "clic_google"];
  // Créneaux de départ par métier, heure de Paris. Ce sont des réglages de départ, pas une étude : ils seront remplacés par les
  // meilleurs horaires réels quand les statistiques des réseaux seront branchées.
  const CRENEAUX = { restaurant: ["11:30", "18:30"], beaute: ["10:00", "19:00"], sport: ["07:00", "18:00"], autre: ["12:00", "18:00"] };
  const DELAI_MIN_CRENEAU = 2 * 3600000;
  // Limite de l'API Google Business Profile pour le texte (summary) d'une publication sur la fiche : 1 500 caractères.
  const LIMITE_GOOGLE = 1500;
  const formatDe = c => (c && c.format) || (c && c.type === "video" ? "video" : "publication");
  // Une vidéo ou une story ne se publie pas sur la fiche Google.
  // Story : Instagram et Facebook seulement (même règle que reseaux_tacites() et verifier_programmation de schema.sql, 31/10/2026 : l'aperçu
  // montrait un onglet TikTok pour une story qui n'y part jamais).
  // Lot 9d (16/11/2026, CGV version 2, article 3) : une vidéo part sur Instagram et TikTok seulement, jamais sur Facebook (ni sur la fiche Google) ;
  // même règle que reseaux_tacites() et verifier_programmation de schema.sql (bloc « Lot 9d : aucune vidéo programmée vers Facebook »)
  // et que metricool_api.RESEAUX_SANS_VIDEO. Avant : la case Facebook était proposée, puis la vidéo était écartée en silence à la publication.
  const reseauxPour = c => formatDe(c) === "publication" ? RESEAUX.slice() : formatDe(c) === "story" ? ["facebook", "instagram"] : RESEAUX.filter(r => r !== "google" && r !== "facebook");
  // Réseaux où CE contenu part pour CE commerce (30/10/2026, bug vu par PJ : un Essentiel voyait Instagram, Facebook et TikTok à la validation) :
  // ceux du format (reseauxPour) ET ceux de l'offre et retenus (autorises : reseauxAutorises du commerce, ou « reseaux » rendu par objet_par_jeton).
  // autorises absent (lien d'avant le bloc SQL) : le format seul, comme avant.
  const reseauxDuContenu = (c, autorises) => reseauxPour(c).filter(r => !Array.isArray(autorises) || autorises.includes(r));
  // Visuel d'un contenu dans le seau « contenus », par réseau : même règle que la publication (moteur/metricool_api.chemin_media,
  // n8n/build_ordre10.py CHEMIN_MEDIA) : story -> visuel-story.jpg ; publication photo -> visuel-9x16.jpg pour TikTok (15/10/2026),
  // visuel-4x5.jpg pour les autres réseaux et sans réseau. Vidéo : son affiche (visuel-4x5.jpg du dossier), jamais le MP4.
  const photoPublication = c => !!c && c.type !== "video" && formatDe(c) === "publication";
  const cheminVisuel = (c, reseau) => {
    if (!c || !c.fichier) return null;
    if (c.type === "video") return c.fichier.slice(0, c.fichier.lastIndexOf("/")) + "/visuel-4x5.jpg";
    return c.fichier + (formatDe(c) === "story" ? "/visuel-story.jpg" : reseau === "tiktok" ? "/visuel-9x16.jpg" : "/visuel-4x5.jpg");
  };
  // Blocs « Photos » et « Contenus » de la fiche client de la console (v52, 13/11/2026) : mêmes champs dans les deux adaptateurs.
  // Photo : id, statut, refus_motif, cree_le, chemin, nom_fichier, source (« equipe » ou client : « espace », « email »), controle_force, url
  // (adresse de la vignette, seulement pour les PHOTOS_VUES plus récentes), controle ({motif, categorie, detail} du journal PHOTO_HORS_SUJET).
  // Contenu : id, type, format, statut, legende, fichier, cree_le, photo_id, url (visuel), prevu_le.
  const PHOTOS_VUES = 20, CONTENUS_VUS = 12, TYPES_PHOTO_JOURNAL = ["PHOTO_HORS_SUJET"];
  const PHRASE_LOGO_ILLISIBLE = "Fichier illisible dans ce navigateur : ouvrez « Style du commerce » et déposez le logo à la main.";
  const photoConsole = x => ({ id: x.id, statut: x.statut, refus_motif: x.refus_motif || null, cree_le: x.cree_le, chemin: x.chemin || null, nom_fichier: x.nom_fichier || null,
    source: x.source || "espace", controle_force: x.controle_force === true, url: null, controle: null });
  const controleDe = (j, pid) => { const x = (j || []).find(y => y.type === "PHOTO_HORS_SUJET" && y.detail && String(y.detail.photo) === String(pid));
    return x ? { motif: x.detail.motif || null, categorie: x.detail.categorie || null, detail: x.detail.detail || null, le: x.cree_le } : null; };
  // Légende propre au réseau, avec repli sur la légende unique (contenus créés avant la mise à jour).
  const legendeDe = (c, r) => { const l = c && c.legendes && c.legendes[r]; return typeof l === "string" && l.trim() ? l : (c && c.legende) || ""; };
  const longueur = t => Array.from(String(t || "")).length;
  // Vidéo animée par IA (24/10/2026) : drapeau {"drapeau": "ia"} posé par le moteur (moteur/video_ia.py) dans contenus.drapeaux, ou « ia » rendu
  // par objet_par_jeton et admin_publications_a_publier. La légende d'un réseau doit garder une des trois mentions (mêmes textes que
  // moteur/video_ia.json et mentions_ia_par_langue() de schema.sql, égalité testée par moteur/tests/test_video_ia.py) ; même phrase que la base.
  const MENTIONS_IA = { fr: "Vidéo animée par IA à partir de notre photo.", en: "AI-animated video from our photo.", nl: "Video met AI geanimeerd op basis van onze foto." };
  const estIA = c => !!c && (c.ia === true || (Array.isArray(c.drapeaux) && c.drapeaux.some(d => d && d.drapeau === "ia" && d.ia !== false)));
  const controlerMentionIA = (c, t, langue) => {
    if (!estIA(c) || !String(t || "").trim() || Object.values(MENTIONS_IA).some(m => String(t).includes(m))) return;
    throw new Error(`La mention « ${MENTIONS_IA[langue] || MENTIONS_IA.fr} » doit rester dans la légende d'une vidéo animée par IA.`);
  };
  // Numéro de téléphone (01/11/2026, tour 7 Premium) : même vérification que le moteur (moteur/redaction.py, TELEPHONE et NUMERO : français ou
  // belge, national ou international). Google peut retirer une publication de fiche qui en contient un (support.google.com/business/answer/7213077).
  const RE_TELEPHONE = [/(?:\+33\s?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b/, /(?:\+3[23]\s?(?:\(0\)\s?)?|\b0)[1-9](?:[\s./-]?\d){7,8}\b/];
  const contientTelephone = t => RE_TELEPHONE.some(r => r.test(String(t || "")));
  // Taux de réponse depuis le début du service (lot 2, 15/11/2026) : même calcul que taux_reponse_de() de schema.sql (bloc « Taux de réponse
  // depuis le début du service »). depuis : garantie_delais.acces_remis_le (null : tous les avis comptent). Un avis sans réponse de moins de 24 h est
  // « en cours » (hors du taux) ; les avis plus anciens que le début du service sont comptés à part, jamais dans le taux. Avis sensibles compris.
  function tauxReponseDe(avis, depuis, maintenant) {
    const d = depuis ? Date.parse(depuis) : null, now = maintenant == null ? Date.now() : maintenant, cree = a => Date.parse(a.cree_le);
    const apres = (avis || []).filter(a => d == null || cree(a) >= d), avant = d == null ? [] : (avis || []).filter(a => cree(a) < d);
    const rep = apres.filter(a => a.repondu_le), enCours = apres.filter(a => !a.repondu_le && cree(a) > now - 24 * 3600000).length, base = apres.length - enCours;
    const delai = rep.length ? Math.round(rep.reduce((s, a) => s + (Date.parse(a.repondu_le) - cree(a)), 0) / rep.length / 360000) / 10 : null;
    return { depuis: depuis || null, recus: apres.length, repondus: rep.length, en_cours: enCours, taux: base > 0 ? Math.round(100 * rep.length / base) : null,
      delai_moyen_h: delai, anciens: avant.length, anciens_repondus: avant.filter(a => a.repondu_le).length };
  }
  const PHRASE_TEL_GOOGLE = "Sur la fiche Google, le texte ne peut pas contenir de numéro de téléphone : Google peut retirer la publication. Le bouton « Appeler » de la fiche suffit.";
  const controlerLegende = (r, t) => {
    if (!RESEAUX.includes(r)) throw new Error("Réseau inconnu.");
    t = String(t || "").trim(); if (!t) throw new Error("La légende ne peut pas être vide.");
    if (r === "google" && longueur(t) > LIMITE_GOOGLE) throw new Error(`Sur la fiche Google, le texte est limité à 1 500 caractères. Celui-ci en compte ${longueur(t)}.`);
    if (r === "google" && contientTelephone(t)) throw new Error(PHRASE_TEL_GOOGLE);
    return t;
  };
  // Relecture par l'équipe avant le client (14/11/2026, bloc SQL du même nom) : alerte de la console sous RELECTURE_ALERTE_H heures restantes avant
  // l'échéance du premier contenu (relecture_alerte_heures() de schema.sql : 12). « Corriger la légende » : mêmes contrôles que
  // admin_corriger_legende (réseaux du contenu, legende_fautes, mention IA gardée) ; rend les légendes par réseau retenues (vides retirées).
  const RELECTURE_ALERTE_H = 12;
  const reseauxCorrection = x => x.type === "video" ? ["instagram", "facebook", "tiktok"] : formatDe(x) === "story" ? ["instagram", "facebook"] : ["instagram", "facebook", "google", "tiktok"];
  const hashtags = t => (String(t).match(/#[^\s#]+/g) || []).length;
  const controlerCorrection = (x, t, legendes, langue) => {
    if (!t) throw new Error("La légende ne peut pas être vide.");
    const res = reseauxCorrection(x), l = {};
    for (const [k, v] of Object.entries(legendes || {})) { if (!res.includes(k)) throw new Error(`Réseau ${k} : ce contenu n'y part pas.`); const w = String(v || "").trim(); if (w) l[k] = w; }
    for (const r of res) { const v = l[r] || t, n = longueur(v), f = [];
      if (r === "instagram" && n > 2200) f.push("Instagram : 2 200 caractères au plus"); if (r === "instagram" && hashtags(v) > 30) f.push("Instagram : 30 hashtags au plus");
      if (r === "tiktok" && n > 2200) f.push("TikTok : 2 200 caractères au plus"); if (r === "google" && n > 1500) f.push("fiche Google : 1 500 caractères au plus");
      if (r === "google" && /#[^\s#]/.test(v)) f.push("fiche Google : pas de hashtag"); if (r === "facebook" && n > 10000) f.push("Facebook : 10 000 caractères au plus (garde-fou BoostImpact)");
      if (f.length) throw new Error(f.join(" ; ")); controlerMentionIA(x, v, langue); }
    return l;
  };
  // Heure de Paris : décalage réel du fuseau à cet instant (heure d'été comprise), sans bibliothèque.
  const FMT_JOUR_PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });
  const FMT_PARIS = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const partiesParis = t => { const p = {}; FMT_PARIS.formatToParts(new Date(t)).forEach(x => { p[x.type] = +x.value; }); return { a: p.year, m: p.month - 1, j: p.day, h: p.hour, mi: p.minute, s: p.second }; };
  const decalageParis = t => { const p = partiesParis(t); return Date.UTC(p.a, p.m, p.j, p.h, p.mi, p.s) - Math.floor(t / 1000) * 1000; };
  const instantParis = (a, m, j, h, mi) => { const g = Date.UTC(a, m, j, h, mi); let t = g - decalageParis(g); t = g - decalageParis(t); return t; };
  // ---- Jours où l'on publie (31/10/2026, test client « dix sur dix » : une publication tombait un lundi, jour de fermeture du restaurant).
  // Mêmes règles que jours_ouverts(), est_ferie_fr() et programmer_au_creneau() de schema.sql (bloc « Créneaux réels », cas communs testés par
  // espace/test/creneaux.test.mjs et supabase/test/creneaux.test.mjs) :
  //   - jours d'ouverture lus dans les horaires de la fiche (texte libre, français, anglais ou néerlandais : « Du mardi au samedi », « fermé le lundi »,
  //     « Closed on Mondays », « maandag gesloten ») ; horaires illisibles ou sans jour : aucun jour exclu (null) ;
  //   - jours fériés de France (Code du travail, article L3133-1 : 1er janvier, lundi de Pâques, 1er mai, 8 mai, Ascension, lundi de Pentecôte,
  //     14 juillet, 15 août, 1er novembre, 11 novembre, 25 décembre) ou de Belgique selon le pays du commerce (commerces.pays, 'FR' par défaut,
  //     'BE' : 1er janvier, lundi de Pâques, 1er mai, Ascension, lundi de Pentecôte, 21 juillet, 15 août, 1er novembre, 11 novembre, 25 décembre) ;
  //   - au plus une publication par jour (heure de Paris).
  const sansAccents = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const NOMS_JOURS = [["lundi", "monday", "maandag"], ["mardi", "tuesday", "dinsdag"], ["mercredi", "wednesday", "woensdag"], ["jeudi", "thursday", "donderdag"],
    ["vendredi", "friday", "vrijdag"], ["samedi", "saturday", "zaterdag"], ["dimanche", "sunday", "zondag"]];
  function joursOuverts(texte) {
    let s = sansAccents(texte); if (!s.trim()) return null;
    NOMS_JOURS.forEach((l, i) => l.forEach(n => { s = s.replace(new RegExp("\\b" + n + "s?\\b", "g"), "#" + (i + 1)); }));
    const LISTE = "#[1-7](?:\\s*(?:,|et|and|en|&|/)\\s*#[1-7])*", FERME = "(?:fermee?s?|closed|gesloten)";
    const jours = x => (x.match(/#[1-7]/g) || []).map(y => +y[1]), fermes = new Set(), ouverts = new Set();
    s = s.replace(new RegExp(FERME + "\\s*(?:le |les |on |op |the )?(" + LISTE + ")", "g"), (m, l) => { jours(l).forEach(j => fermes.add(j)); return " "; });
    s = s.replace(new RegExp("(" + LISTE + ")\\s*:?\\s*" + FERME, "g"), (m, l) => { jours(l).forEach(j => fermes.add(j)); return " "; });
    s = s.replace(/#([1-7])\s*(?:au|a|-|–|to|until|through|tot|t\/m)\s*#([1-7])/g, (m, a, b) => { for (let j = +a, k = 0; k < 7; k++, j = j % 7 + 1) { ouverts.add(j); if (j === +b) break; } return " "; });
    jours(s).forEach(j => ouverts.add(j));
    if (!ouverts.size && !fermes.size) return null;
    const l = (ouverts.size ? [...ouverts] : [1, 2, 3, 4, 5, 6, 7]).filter(j => !fermes.has(j)).sort((a, b) => a - b);
    return l.length ? l : null;   // tout fermé : texte mal compris, aucun jour exclu (jamais de programmation bloquée)
  }
  const ymd = (a, m, j) => a + "-" + String(m + 1).padStart(2, "0") + "-" + String(j).padStart(2, "0");
  function feriesFr(an) {
    const a = an % 19, b = Math.floor(an / 100), c = an % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const p = Date.UTC(an, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1), dec = n => new Date(p + n * 86400000).toISOString().slice(0, 10);
    return new Set([ymd(an, 0, 1), dec(1), ymd(an, 4, 1), ymd(an, 4, 8), dec(39), dec(50), ymd(an, 6, 14), ymd(an, 7, 15), ymd(an, 10, 1), ymd(an, 10, 11), ymd(an, 11, 25)]);
  }
  function feriesBe(an) {
    const fr = [...feriesFr(an)], ascension = fr[4], lundiPaques = fr[1], pentecote = fr[5];
    return new Set([ymd(an, 0, 1), lundiPaques, ymd(an, 4, 1), ascension, pentecote, ymd(an, 6, 21), ymd(an, 7, 15), ymd(an, 10, 1), ymd(an, 10, 11), ymd(an, 11, 25)]);
  }
  // Nom du jour férié (31/10/2026, test client Croissance : « Ce jour est férié » ne disait pas lequel) : identifiant traduit par i18n.js (ferie.<id>).
  function ferieDe(jour, pays) {
    const an = +jour.slice(0, 4), fr = [...feriesFr(an)], be = paysDe(pays) === "BE";
    const ids = be ? [[ymd(an, 0, 1), "nouvel-an"], [fr[1], "lundi-paques"], [ymd(an, 4, 1), "1er-mai"], [fr[4], "ascension"], [fr[5], "lundi-pentecote"], [ymd(an, 6, 21), "21-juillet"],
        [ymd(an, 7, 15), "15-aout"], [ymd(an, 10, 1), "toussaint"], [ymd(an, 10, 11), "armistice"], [ymd(an, 11, 25), "noel"]]   // BE (01/11/2026, tour 7 Premium) : « Armistice »
      : [[fr[0], "nouvel-an"], [fr[1], "lundi-paques"], [fr[2], "1er-mai"], [fr[3], "8-mai"], [fr[4], "ascension"], [fr[5], "lundi-pentecote"], [fr[6], "14-juillet"],
        [fr[7], "15-aout"], [fr[8], "toussaint"], [fr[9], "11-novembre"], [fr[10], "noel"]];
    return (ids.find(x => x[0] === jour) || [])[1] || null;
  }
  const paysDe = pays => String(pays || "FR").toUpperCase() === "BE" ? "BE" : "FR";
  const estFerie = (jour, pays) => (paysDe(pays) === "BE" ? feriesBe : feriesFr)(+jour.slice(0, 4)).has(jour);
  // Jour ouvré (01/11/2026, tour 7 Croissance) : à partir de jour (AAAA-MM-JJ) inclus, le premier qui n'est ni un dimanche ni un jour férié du pays.
  // Tour 11 (v37, décision de PJ) : ni un samedi non plus, jour de plus gros service d'un restaurant. Même règle que jour_ouvre() (bloc « Tour 11 »
  // de schema.sql). joursRappel() : les deux jours proposés à partir d'un jour donné (« aujourdhui » et « demain » au sens de retenir_reponse_avis).
  const jourOuvre = (jour, pays) => { const d = new Date(jour + "T12:00:00Z"); let j = jour;
    for (let i = 0; i < 14; i++, d.setUTCDate(d.getUTCDate() + 1)) { j = d.toISOString().slice(0, 10); if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !estFerie(j, pays)) return j; } return j; };
  // Lot 9 (16/11/2026) : 72 heures ouvrées de la Visibilité IA. Mêmes règles que heures_ouvrees_ajouter et heures_ouvrees_entre (bloc « Lot 9 » de
  // schema.sql) et que moteur/geo.py : seules les heures des jours ouvrés (lundi au vendredi, hors fériés du pays) comptent, à l'heure locale (horloge
  // murale, comme le type timestamp de la base) ; départ un samedi, un dimanche ou un férié : jour ouvré suivant à 0 h. Cas communs :
  // moteur/tests/heures_ouvrees_cas.json (espace/test/lot9.test.mjs).
  const fuseauDe = pays => paysDe(pays) === "BE" ? "Europe/Brussels" : "Europe/Paris";
  const decalageTz = (t, tz) => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(t)).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(t / 1000) * 1000; };
  const versMur = (t, tz) => t + decalageTz(t, tz);
  const depuisMur = (w, tz) => { let t = w - decalageTz(w, tz); t = w - decalageTz(t, tz); return t; };
  const ouvreGeo = (j, pays) => { const d = new Date(j + "T12:00:00Z").getUTCDay(); return d !== 0 && d !== 6 && !estFerie(j, pays); };
  const heuresOuvreesAjouter = (debut, heures, pays) => { if (!debut) return null; const tz = fuseauDe(pays); let w = versMur(Date.parse(debut), tz), reste = heures * 3600e3;
    for (let i = 0; i < 4000; i++) { const j = new Date(w).toISOString().slice(0, 10), fin = Date.parse(j + "T00:00:00Z") + 864e5;
      if (ouvreGeo(j, pays)) { if (w + reste <= fin) return new Date(depuisMur(w + reste, tz)).toISOString(); reste -= fin - w; } w = fin; }
    throw new Error("heures ouvrées : calcul hors limites"); };
  const heuresOuvreesEntre = (a, b, pays) => { if (!a || !b) return null; if (Date.parse(b) < Date.parse(a)) return -heuresOuvreesEntre(b, a, pays);
    const tz = fuseauDe(pays); let w = versMur(Date.parse(a), tz), s = 0; const f = versMur(Date.parse(b), tz);
    while (w < f) { const j = new Date(w).toISOString().slice(0, 10), fin = Date.parse(j + "T00:00:00Z") + 864e5; if (ouvreGeo(j, pays)) s += Math.min(fin, f) - w; w = fin; }
    return Math.round(s / 36e3) / 100; };
  // Jour affiché d'une échéance (une échéance à 0 h pile compte pour la veille), comme geo_jour_echeance.
  const jourEcheance = (a, pays) => new Intl.DateTimeFormat("en-CA", { timeZone: fuseauDe(pays), year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.parse(a) - 1));
  const lendemain = j => { const d = new Date(j + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
  const joursRappel = (auj, pays) => { const a = jourOuvre(auj, pays); return { aujourdhui: a, demain: jourOuvre(lendemain(a), pays) }; };
  // Les deux jours proposés à l'instant t (tour 11, v37) : à partir d'aujourd'hui (heure de Paris), ou de demain à 17 h et après ; donc toujours deux
  // jours ouvrés, même tard (avant : un seul jour après 17 h). Même règle que jours_rappel() de schema.sql (bloc « Tour 11 »), appelée par
  // retenir_reponse_avis et preciser_rappel : « aujourdhui » vaut le premier jour proposé, « demain » le second.
  const HEURE_RAPPEL_TARDIVE = 17;
  const joursRappelA = (t, pays) => { const p = partiesParis(t), auj = ymd(p.a, p.m, p.j); return joursRappel(p.h >= HEURE_RAPPEL_TARDIVE ? lendemain(auj) : auj, pays); };
  const jourParisDe = t => { const p = partiesParis(t); return ymd(p.a, p.m, p.j); };
  // Rythme selon l'offre : Essentiel (4 par mois depuis le 02/11/2026) 3 jours d'écart au moins, Croissance 2 jours, Premium 1 jour (espacement_offre
  // de schema.sql). Avant : 7 jours pour 2 par mois ; avec 4 par mois, 7 jours d'écart repoussaient au mois suivant les publications validées après le 9.
  const ESPACEMENT = { essentiel: 3, standard: 2, premium: 1 };
  // Moment du texte (31/10/2026, capture v26 : « l'heure du déjeuner » programmée à 18 h 30) : midi, soir, ou null (les deux ou aucun).
  // Mêmes mots que moment_legende de schema.sql (égalité testée) ; sert à la programmation automatique ET à la suggestion de « Programmer à la main ».
  const MOTS_MIDI = /\b(midi|dejeuner|dejeuners|lunch|lunchen|middag|noon)\b/;
  const MOTS_SOIR = /\b(soir|soiree|soirees|diner|diners|dinner|tonight|evening|avond|vanavond|avondeten|apero|aperos|aperitif|aperitifs|borrel)\b/;
  function momentLegende(texte) {
    const s = String(texte || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(), mi = MOTS_MIDI.test(s), so = MOTS_SOIR.test(s);
    return mi && !so ? "midi" : so && !mi ? "soir" : null;
  }
  // Texte lu d'un contenu : la légende commune et celles par réseau (comme programmer_au_creneau).
  const texteDuContenu = ct => [ct && ct.legende, ...Object.values((ct && ct.legendes) || {})].filter(Boolean).join(" ");
  // Contenu « du jour » (01/11/2026, tour 8) : une story, ou une légende qui parle d'aujourd'hui (« du jour », « aujourd'hui », « ce midi »,
  // « ce soir »…, en français, anglais et néerlandais). « Programmer tout » le met au PREMIER créneau libre, jamais étalé sur le mois. Mêmes mots
  // que contenu_du_jour() de schema.sql (bloc « Tour 8 », égalité testée par supabase/test/creneaux.test.mjs).
  const MOTS_JOUR = /\b(du jour|aujourdhui|ce midi|ce soir|ce matin|cet apres midi|today|tonight|this evening|this morning|this afternoon|vandaag|vanavond|vanmiddag|vanochtend|vanmorgen)\b/;
  const duJour = ct => !!ct && (formatDe(ct) === "story" || MOTS_JOUR.test(String(texteDuContenu(ct)).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['’`]/g, "").replace(/-/g, " ")));
  // Prochain créneau libre du métier, à au moins 2 h d'ici, un jour d'ouverture, jamais un jour férié, au plus une publication par jour.
  // pris : instants (ms) déjà occupés par une publication du commerce ; regles : { horaires } (texte de la fiche), { pays } ('FR' par défaut, 'BE'),
  // { unParJour: false } pour l'ancienne règle.
  // { offre } (31/10/2026, test client Essentiel, tour 5) : écart minimal entre deux publications, ESPACEMENT (même valeur que espacement_offre).
  // { duJour: true } (01/11/2026, tour 9 : une story validée le dimanche partait le jeudi 5 au lieu du mardi 3, en Croissance) : story ou contenu
  // « du jour » au PREMIER créneau ouvert ; l'écart de l'offre et la règle d'une publication par jour sont ignorés, seul le créneau exact déjà
  // occupé est pris. Même règle que programmer_au_creneau de schema.sql (bloc « Tour 9 », égalité testée par supabase/test/creneaux.test.mjs).
  function prochainCreneau(metier, pris, maintenant, regles) {
    const r = regles || {}, ouverts = joursOuverts(r.horaires), unParJour = r.unParJour !== false && !r.duJour, ecart = unParJour ? ESPACEMENT[r.offre] || 1 : 0;
    const now = maintenant || Date.now(), occupe = new Set(pris || []), joursPris = new Set([...occupe].map(jourParisDe)), p = partiesParis(now), base = CRENEAUX[metier] || CRENEAUX.autre;
    // Alternance (31/10/2026, test client Croissance, tour 5) : on commence par le créneau qui suit celui de la dernière publication
    // (restaurant : 11 h 30 puis 18 h 30, puis 11 h 30...), même règle que programmer_au_creneau de schema.sql.
    const dern = occupe.size ? partiesParis(Math.max(...occupe)) : null, k = dern ? base.indexOf(String(dern.h).padStart(2, "0") + ":" + String(dern.mi).padStart(2, "0")) + 1 : 0;
    const tournes = base.slice(k).concat(base.slice(0, k));
    // { moment } : « midi » garde le créneau d'avant 15 h, « soir » celui de 17 h ou après (momentLegende) ; sinon l'alternance.
    const voulus = r.moment === "midi" ? tournes.filter(x => +x.slice(0, 2) < 15) : r.moment === "soir" ? tournes.filter(x => +x.slice(0, 2) >= 17) : tournes;
    const heures = voulus.length ? voulus : tournes;
    const numJour = j => Date.parse(j + "T00:00:00Z") / 864e5, numsPris = [...joursPris].map(numJour), tropPres = j => numsPris.some(x => Math.abs(x - numJour(j)) < ecart);
    for (let k = 0; k < 60; k++) {
      const d = new Date(Date.UTC(p.a, p.m, p.j + k)), jour = d.toISOString().slice(0, 10), js = d.getUTCDay() || 7;
      if ((ouverts && !ouverts.includes(js)) || estFerie(jour, r.pays) || (unParJour && tropPres(jour))) continue;
      for (const hm of heures) {
        const [h, mi] = hm.split(":").map(Number), t = instantParis(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, mi);
        if (t >= now + DELAI_MIN_CRENEAU && !occupe.has(t)) return t;
      }
    }
    throw new Error("Aucun créneau libre dans les 60 prochains jours.");
  }
  // « Programmer tout » étalé sur le mois (01/11/2026, tour 7 Premium ; même calcul que jour_lot de schema.sql) : jour (AAAA-MM-JJ) à partir duquel
  // part le contenu de rang i sur n. Pas = le plus grand de l'écart de l'offre et des jours restants du mois divisés par n.
  const jourLot = (rang, nombre, ecart, debut) => { const d0 = Date.parse(debut + "T12:00:00Z"), dm = new Date(d0), fin = Date.UTC(dm.getUTCFullYear(), dm.getUTCMonth() + 1, 1, 12);
    const reste = Math.round((fin - d0) / 864e5), pas = Math.max(ecart || 1, 1, nombre > 0 ? Math.floor(reste / nombre) : 1);
    return new Date(d0 + Math.max(0, rang) * pas * 864e5).toISOString().slice(0, 10); };
  // Créneau d'un contenu pour un commerce (01/11/2026, tour 6 Essentiel : « Si vous validez : mercredi 4 novembre » puis « prévue mardi 10 novembre ») :
  // UNE fonction pour la date annoncée (Contenus, Calendrier) et la date programmée (programmation automatique) : horaires, pays, rythme de
  // l'offre et moment du texte. ct absent : sans moment.
  function creneauPour(c, pris, ct, maintenant) {
    c = c || {};
    return prochainCreneau(c.metier, pris, maintenant || null, { horaires: c.horaires, pays: c.pays, offre: c.offre_id, moment: ct ? momentLegende(texteDuContenu(ct)) : null, duJour: duJour(ct) });
  }
  // ---- Où un contenu part vraiment (31/10/2026) : UNE règle pour l'aperçu (onglets), la programmation, valider.html et les textes.
  //   reseaux : réseaux de l'offre et retenus où ce format part (reseauxDuContenu) ; partent : ceux-là qui sont connectés ;
  //   absents : ceux de l'offre pas encore connectés (le contenu n'y partira pas tant qu'ils ne le sont pas) ;
  //   formats : visuel réel par réseau (« 4:5 », « 9:16 ») ; comptes absent (page de validation : connexions inconnues) : tous comptés comme partants.
  function destinations(ct, autorises, comptes) {
    const reseaux = ["instagram", "facebook", "tiktok", "google"].filter(r => reseauxDuContenu(ct, autorises).includes(r));
    const etat = r => comptes == null ? "connecte" : ((Array.isArray(comptes) ? comptes.find(k => k.reseau === r) : comptes[r]) || {}).etat;
    const f = formatDe(ct), formats = Object.fromEntries(reseaux.map(r => [r, f !== "publication" || r === "tiktok" ? "9:16" : "4:5"]));
    return { reseaux, partent: reseaux.filter(r => etat(r) === "connecte"), absents: reseaux.filter(r => etat(r) !== "connecte"), formats };
  }
  // Dernier créneau du métier à l'instant t ou avant (publication passée de la graine de démonstration).
  function creneauAvant(metier, pris, t) {
    const occupe = new Set(pris || []), p = partiesParis(t), heures = (CRENEAUX[metier] || CRENEAUX.autre).slice().reverse();
    for (let k = 0; k < 60; k++) {
      const d = new Date(Date.UTC(p.a, p.m, p.j - k));
      for (const hm of heures) {
        const [h, mi] = hm.split(":").map(Number), u = instantParis(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, mi);
        if (u <= t && !occupe.has(u)) return u;
      }
    }
    return t;
  }
  // Actions propres à la fiche Google : contrôles de forme, les mêmes avant l'appel à la base.
  const TYPES_ACTION = ["photos", "offre", "evenement", "horaires"];
  const aujourdhui = () => { const p = partiesParis(Date.now()); return `${p.a}-${String(p.m + 1).padStart(2, "0")}-${String(p.j).padStart(2, "0")}`; };
  const JOUR = /^\d{4}-\d{2}-\d{2}$/, HEURE = /^\d{2}:\d{2}$/;
  function controlerAction(type, d) {
    if (!TYPES_ACTION.includes(type)) throw new Error("Action inconnue.");
    d = d || {}; const t = String(d.titre || "").trim(), auj = aujourdhui();
    if (type === "photos") { if (!Array.isArray(d.photos) || !d.photos.length) throw new Error("Choisissez au moins une photo."); return { photos: d.photos.map(String) }; }
    if (type === "offre" || type === "evenement") {
      if (!t) throw new Error("Écrivez un titre."); if (longueur(t) > 120) throw new Error("Titre trop long (120 caractères au plus).");
      if (!JOUR.test(d.debut || "") || !JOUR.test(d.fin || "")) throw new Error("Indiquez la date de début et la date de fin.");
      if (d.fin < d.debut) throw new Error("La date de fin doit suivre la date de début."); if (d.fin < auj) throw new Error("La date de fin est déjà passée.");
      const r = { titre: t, debut: d.debut, fin: d.fin };
      if (type === "offre") { const cond = String(d.conditions || "").trim(); if (longueur(cond) > LIMITE_GOOGLE) throw new Error("Conditions trop longues (1 500 caractères au plus)."); r.conditions = cond; }
      return r;
    }
    if (!JOUR.test(d.date || "")) throw new Error("Indiquez la date."); if (d.date < auj) throw new Error("Cette date est déjà passée.");
    if (d.ferme) return { date: d.date, ferme: true };
    if (!HEURE.test(d.ouverture || "") || !HEURE.test(d.fermeture || "")) throw new Error("Indiquez l'heure d'ouverture et l'heure de fermeture, ou cochez « Fermé ».");
    if (d.fermeture <= d.ouverture) throw new Error("L'heure de fermeture doit suivre l'heure d'ouverture.");
    return { date: d.date, ferme: false, ouverture: d.ouverture, fermeture: d.fermeture };
  }
  // Réponses aux 5 questions de démarrage : chaque réponse est facultative (on peut passer une question).
  const TONS = ["chaleureux", "sobre", "enjoue"], ACTIONS = ["reserver", "appeler", "venir", "acheter"];
  // 6e question « Vos réseaux sociaux » (13/11/2026, console v49) : rangée dans commerces.demarrage.reseaux, mêmes valeurs que admin_reponses_demarrage
  // (schema.sql, bloc « Console : réponses du démarrage remplies par l'équipe… ») : instagram, facebook, tiktok « oui » ou « non » ; instagram_pro
  // « oui », « non » ou « nsp » (je ne sais pas) et facebook_page « oui » ou « non », gardés seulement si le réseau est « oui ». Facultative.
  const RSC = window.RENOM_RESEAUX_CLIENT = {
    RESEAUX: ["instagram", "facebook", "tiktok"],
    normaliser(r) { r = r && typeof r === "object" ? r : {}; const o = {};
      for (const k of RSC.RESEAUX) if (["oui", "non"].includes(r[k])) o[k] = r[k];
      if (o.instagram === "oui" && ["oui", "non", "nsp"].includes(r.instagram_pro)) o.instagram_pro = r.instagram_pro;
      if (o.facebook === "oui" && ["oui", "non"].includes(r.facebook_page)) o.facebook_page = r.facebook_page;
      return o; },
    // Répondue : les trois réseaux ont « oui » ou « non ».
    repondu: r => !!r && typeof r === "object" && RSC.RESEAUX.every(k => ["oui", "non"].includes(r[k])),
    // Réseaux que le client a (à relier dans Metricool) ; Instagram pas (ou pas sûr d'être) professionnel : à passer en compte professionnel avec lui.
    aRelier: r => r && typeof r === "object" ? RSC.RESEAUX.filter(k => r[k] === "oui") : [],
    proAFaire: r => !!r && r.instagram === "oui" && r.instagram_pro !== "oui" };
  // Lot 3 (15/11/2026, revue : « 1 sur 3 » au-dessus d'une liste de 6 lignes, « 5 questions (0 réponses sur 6) », la console à « 0 sur 3 » et
  // « Dossier 0 sur 5 » pour le même commerce) : UN seul compte de la mise en route, le même dans l'espace et dans la console (window.RENOM_ETAPES).
  // - Questions : les 5 questions du démarrage (la 6e, « Vos réseaux sociaux », facultative, est suivie par l'étape réseaux, jamais dans ce compte).
  // - Étapes : les points de la base (commerces.sante.mise_en_route / ma_mise_en_route : compte, fiche Google, questions, réseaux selon l'offre),
  //   plus les trois points du dossier que l'espace et la console montrent sur la même liste : autorisation photos, au moins une photo utilisable
  //   (une suffit, cinq recommandées), WhatsApp réglé (numéro et accord). Fait = « fait » pour un point de la base.
  const ETP = window.RENOM_ETAPES = {
    QUESTIONS: ["phrase", "distinctions", "ton", "interdits", "action"],
    repondue(r, k) { if (!r || typeof r !== "object") return false; if (k === "action" && typeof r.action_detail === "string" && r.action_detail.trim()) return true;
      const v = r[k]; return Array.isArray(v) ? v.some(x => String(x || "").trim()) : typeof v === "string" ? !!v.trim() : !!v; },
    nbReponses: r => r && typeof r === "object" ? ETP.QUESTIONS.filter(k => ETP.repondue(r, k)).length : 0,
    photosUtilisables: l => Array.isArray(l) ? l.filter(p => p && (p.statut !== "refusee" || p.refus_motif === "plafond")).length : null,
    whatsappRegle: c => !!(c && c.whatsapp_numero && (c.notifications || {}).whatsapp && (c.whatsapp_accord_le || !("whatsapp_accord_le" in c))),
    // points : [{ point, etat }] de la base ; photos : liste lue (null si illisible). Rend { faits, total, etapes: [{ k, fait }] }.
    etapes(c, points, photos) {
      const l = (points || []).map(x => ({ k: x.point, fait: x.etat === "fait" }));
      const n = ETP.photosUtilisables(photos);
      l.push({ k: "autorisation", fait: !!(c && c.photos_autorisees_le) }, { k: "photos", fait: n != null && n >= 1 }, { k: "whatsapp", fait: ETP.whatsappRegle(c) });
      return { faits: l.filter(x => x.fait).length, total: l.length, etapes: l };
    } };
  function controlerDemarrage(r) {
    r = r || {}; const txt = (k, n) => { const v = String(r[k] || "").trim(); if (longueur(v) > n) throw new Error("Réponse trop longue (" + n + " caractères au plus)."); return v; };
    const ton = TONS.includes(r.ton) ? r.ton : "", action = ACTIONS.includes(r.action) ? r.action : "", rs = RSC.normaliser(r.reseaux);
    return { phrase: txt("phrase", 300), distinctions: txt("distinctions", 600), ton, interdits: txt("interdits", 600), action, action_detail: action ? txt("action_detail", 200) : "",
      ...(Object.keys(rs).length ? { reseaux: rs } : {}) };
  }
  // Réponses saisies par l'équipe (admin_reponses_demarrage) : seulement les clés fournies, mêmes contrôles que la base ; vide : réponse effacée.
  const CLES_DEMARRAGE = { phrase: 300, distinctions: 600, interdits: 600, action_detail: 200 };
  function fusionnerDemarrage(avant, p) {
    if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("Réponses invalides.");
    const o = { ...(avant && typeof avant === "object" ? avant : {}) }, champs = [];
    for (const [k, v] of Object.entries(p)) {
      const s = typeof v === "string" ? v.trim() : v, vide = s == null || s === "";
      if (!(k in CLES_DEMARRAGE) && !["ton", "action", "reseaux"].includes(k)) throw new Error("Réponse inconnue : " + k + ".");
      let n;
      if (vide) n = undefined;
      else if (k in CLES_DEMARRAGE) { if (typeof s !== "string") throw new Error("Réponse « " + k + " » : texte attendu."); if (longueur(s) > CLES_DEMARRAGE[k]) throw new Error("Réponse trop longue : " + CLES_DEMARRAGE[k] + " caractères au plus."); n = s; }
      else if (k === "ton") { if (!TONS.includes(s)) throw new Error("Ton possible : chaleureux, sobre ou enjoué."); n = s; }
      else if (k === "action") { if (!ACTIONS.includes(s)) throw new Error("Action possible : réserver, appeler, venir sur place ou acheter en ligne."); n = s; }
      else { if (typeof s !== "object" || Array.isArray(s)) throw new Error("Réseaux sociaux : réponses invalides.");
        for (const [rk, rv] of Object.entries(s)) if (rv != null && rv !== "" && !((["instagram", "facebook", "facebook_page", "tiktok"].includes(rk) && ["oui", "non"].includes(rv)) || (rk === "instagram_pro" && ["oui", "non", "nsp"].includes(rv))))
          throw new Error("Réseaux sociaux : réponse « " + rk + " » invalide.");
        n = RSC.normaliser(s); if (!Object.keys(n).length) n = undefined; }
      if (JSON.stringify(o[k]) !== JSON.stringify(n)) champs.push(k);
      if (n === undefined) delete o[k]; else o[k] = n;
    }
    return { demarrage: o, champs: champs.sort() };
  }
  // Les 5 premières questions répondues (mêmes règles que admin_reponses_demarrage et la console).
  const repondues5 = r => !r ? 0 : ["phrase", "distinctions", "ton", "interdits", "action"].filter(k => (k === "action" && String(r.action_detail || "").trim()) || (Array.isArray(r[k]) ? r[k].some(x => String(x || "").trim()) : String(r[k] || "").trim())).length;
  // ---- fin des règles communes de la mise à jour

  // ---- Vidéo d'avis : règles communes aux deux adaptateurs. Mêmes valeurs et mêmes phrases que moteur/video_avis.py et que le
  // déclencheur SQL verifier_demande_video_avis (égalité vérifiée par moteur/tests/test_video_avis.py et espace/test_ecrans.py).
  const VIDEO_AVIS = { MIN: 2, MAX: 4, NOTE_MIN: 4, LIMITE: 240,
    // Durée de conservation des avis (règle « Content storage » de l'API Business Profile : « no more than 30 calendar days »)
    AGE_MAX_JOURS: 30, MOTIF_ANCIEN: "Avis reçu il y a plus de 30 jours : Google ne permet pas de conserver un avis plus longtemps, il n'est donc plus proposé.",
    PLAGES: "0020-007E 00A0-00A3 00A5-00AC 00AE-0107 010A-0113 0116-011B 011E-0123 0126-0127 012A-012B 012E-0133 0136-0137 0139-013E 0141-0148 014A-014D 0150-015B 015E-0161 0164-0165 016A-017E 2013-2014 2018-201A 201C-201E 2022 2026 2039-203A 20AC 2122 2212",
    // Cinq styles, bâtis sur les DEUX familles libres du moteur (Bricolage Grotesque et Figtree) : graisses et largeurs différentes.
    STYLES: [
      { id: "franc", nom: "Franc", titre: ["Bricolage Grotesque", "'opsz' 48, 'wght' 800, 'wdth' 100"], texte: ["Figtree", "'wght' 500"], auteur: ["Figtree", "'wght' 700"] },
      { id: "pose", nom: "Posé", titre: ["Figtree", "'wght' 700"], texte: ["Figtree", "'wght' 400"], auteur: ["Figtree", "'wght' 600"] },
      { id: "etroit", nom: "Étroit", titre: ["Bricolage Grotesque", "'opsz' 48, 'wght' 700, 'wdth' 75"], texte: ["Bricolage Grotesque", "'opsz' 24, 'wght' 500, 'wdth' 75"], auteur: ["Bricolage Grotesque", "'opsz' 24, 'wght' 700, 'wdth' 75"] },
      { id: "fin", nom: "Fin", titre: ["Bricolage Grotesque", "'opsz' 96, 'wght' 300, 'wdth' 100"], texte: ["Bricolage Grotesque", "'opsz' 36, 'wght' 300, 'wdth' 100"], auteur: ["Bricolage Grotesque", "'opsz' 24, 'wght' 500, 'wdth' 100"] },
      { id: "fort", nom: "Fort", titre: ["Bricolage Grotesque", "'opsz' 96, 'wght' 800, 'wdth' 100"], texte: ["Bricolage Grotesque", "'opsz' 36, 'wght' 700, 'wdth' 100"], auteur: ["Figtree", "'wght' 600"] },
    ],
    FONDS: [
      { id: "photos", nom: "Vos photos", note: "Vos photos déposées, assombries pour que le texte reste lisible, avec un mouvement lent." },
      { id: "uni", nom: "Fond uni, votre couleur de fond", note: "La couleur de fond de votre fiche." },
      { id: "accent", nom: "Fond uni, votre couleur d'accent", note: "La couleur d'accent de votre fiche." },
    ],
  };
  const VA_BLANCS = " \t\r\n\f\v\u00a0\u202f", VA_OK = new Set();
  VIDEO_AVIS.PLAGES.split(" ").forEach(p => { const [a, b] = p.split("-").map(x => parseInt(x, 16)); for (let i = a; i <= (b || a); i++) VA_OK.add(i); });
  VIDEO_AVIS.longueur = t => Array.from(t || "").length;
  // Raison pour laquelle un avis ne peut pas entrer dans une vidéo ; null s'il est proposable.
  // Avis effacé, ou reçu (entrée dans BoostImpact) il y a plus de 30 jours. Sans date connue : non.
  VIDEO_AVIS.tropAncien = (a, maintenant) => !!a.efface_le || (!!a.cree_le && (maintenant || Date.now()) - Date.parse(a.cree_le) > VIDEO_AVIS.AGE_MAX_JOURS * 86400000);
  VIDEO_AVIS.motif = (a, maintenant) => {
    const t = a.texte || "", n = VIDEO_AVIS.longueur(t);
    if (a.sensible) return "Avis marqué sensible : il n'est jamais proposé.";
    if (VIDEO_AVIS.tropAncien(a, maintenant)) return VIDEO_AVIS.MOTIF_ANCIEN;
    if ((a.note || 0) < VIDEO_AVIS.NOTE_MIN) return `Note de ${a.note || 0} sur 5 : seuls les avis de ${VIDEO_AVIS.NOTE_MIN} et 5 étoiles sont proposés.`;
    if (!t.trim()) return "Avis sans texte : il n'y a rien à citer.";
    if (!(a.auteur || "").trim()) return "Auteur inconnu : un avis n'est cité qu'avec le prénom de son auteur.";
    if (n > VIDEO_AVIS.LIMITE) return `Avis de ${n} caractères : la limite est de ${VIDEO_AVIS.LIMITE} pour qu'il tienne à l'écran sans être coupé.`;
    const refuses = [...new Set(Array.from(t).filter(ch => !VA_BLANCS.includes(ch) && !VA_OK.has(ch.codePointAt(0))))].sort();
    if (refuses.length) return `Cet avis contient un caractère que la vidéo ne sait pas afficher (${refuses.slice(0, 5).join(" ")}). Un avis n'est jamais modifié : il n'est donc pas proposé.`;
    return null;
  };
  const vaControle = (avis_ids, fond, style) => {
    if (avis_ids.length < VIDEO_AVIS.MIN || avis_ids.length > VIDEO_AVIS.MAX) throw new Error(`Choisissez de ${VIDEO_AVIS.MIN} à ${VIDEO_AVIS.MAX} avis (vous en avez choisi ${avis_ids.length}).`);
    if (new Set(avis_ids).size !== avis_ids.length) throw new Error("Un même avis ne peut pas être choisi deux fois.");
    if (!VIDEO_AVIS.FONDS.some(f => f.id === fond)) throw new Error("Choisissez un fond.");
    if (!VIDEO_AVIS.STYLES.some(s => s.id === style)) throw new Error("Choisissez un style de typographie.");
  };

  // ---- Son de plateforme d'une vidéo à poser À LA MAIN dans Metricool (aucun champ de l'API Metricool documenté : moteur/metricool_api.py,
  // son_plateforme ; même calcul dans n8n/renom-publication.json, « Préparer les posts »). La démonstration imite le workflow à la programmation.
  const SON_METRICOOL = ["instagram", "tiktok"];
  const sonPlateforme = (ct, reseaux) => {
    const m = ct && ct.type === "video" ? (ct.musique || { mode: "plateforme", ambiance: null, volume_video: null, volume_musique: null }) : null;
    const avec = m && m.mode === "plateforme" ? reseaux.filter(r => SON_METRICOOL.includes(r)) : [];
    return avec.length ? { code: "MUSIQUE_PLATEFORME_NON_POSEE", reseaux: avec, ambiance: m.ambiance ?? null, volume_video: m.volume_video ?? null,
      volume_musique: m.volume_musique ?? null, sans_bibliotheque: reseaux.filter(r => !SON_METRICOOL.includes(r)) } : null; };

  // ---- Dépôt de vidéos : règles communes aux deux adaptateurs (valeurs dans espace/web/envoi.js, RENOM_ENVOI.REGLES ; mêmes valeurs et
  // mêmes refus que le bloc « Dépôt de vidéos » de schema.sql, égalité testée par moteur/tests/test_depot_video.py et rls.test.mjs).
  const DEPOT_VIDEO = {
    STATUTS: ["en_envoi", "envoye", "en_montage", "a_valider", "valide", "refuse", "annule", "abandonne"],
    ATTENTE: ["en_envoi", "envoye", "en_montage"],
    OUVERT_MS: 24 * 3600000,
    PHRASES: { sans_video: "Votre offre ne comprend pas de vidéo.", plafond: "Le plafond de vidéos de votre offre est atteint ce mois-ci.",
      ouvert: "Un envoi de vidéos est déjà en cours : terminez-le ou annulez-le.", ferme: "Ce dépôt n'est plus en cours d'envoi.", introuvable: "Dépôt introuvable.",
      nb_videos: "Un dépôt contient de 1 à 10 vidéos.", nb_photos: "Un dépôt contient 10 photos au plus.", longue: "Une vidéo dépasse 60 secondes.",
      refus_commercant: "Vous avez refusé ce montage.", abandon: "Envoi non terminé en 24 h.", efface: "Vidéos d'origine déjà effacées : montage impossible.",
      relance: "Seul un dépôt envoyé, en montage ou refusé se relance.", note: "Votre note est trop longue (500 caractères au plus)." },
  };
  // Refus de la base (Supabase) ramenés aux mêmes phrases que la démonstration ; une phrase inconnue reste telle quelle.
  const phraseDepot = m => { const P = DEPOT_VIDEO.PHRASES, x = String(m || "");
    return /ne comprend pas de vidéo/.test(x) ? P.sans_video : /plafond de l'offre atteint/.test(x) ? P.plafond : /déjà en cours/.test(x) ? P.ouvert
      : /plus en cours d'envoi/.test(x) ? P.ferme : /dépôt introuvable/.test(x) ? P.introuvable : /de 1 à 10 vidéos/.test(x) ? P.nb_videos : /10 photos au plus/.test(x) ? P.nb_photos
      : /60 secondes/.test(x) ? P.longue : /déjà effacées/.test(x) ? P.efface : /seul un dépôt/.test(x) ? P.relance : /commerce en pause/.test(x) ? "Votre commerce est en pause : contactez BoostImpact."
      : /fichier non reçu : (.*)$/.test(x) ? "Fichier non reçu : " + x.match(/fichier non reçu : (.*)$/)[1] + "." : /réservé à l'administrateur/.test(x) ? "Réservé à l'administrateur." : x; };
  // ---- fin des règles communes du dépôt de vidéos

  // ---- Montage à la main (31/10/2026, console) : filet de sécurité de l'administrateur. Mêmes règles que les fonctions admin_plans_depot et
  // admin_deposer_montage_main (schema.sql, bloc « Montage à la main ») dans les deux adaptateurs. Valeurs du dépôt du commerçant
  // (RENOM_ENVOI.REGLES : 1 à 60 s, VIDEO_MAX_MO), plus : MP4 seulement (seau « contenus », storage.sql), vertical 9:16 à 2 % près.
  const MONTAGE_MAIN = {
    STATUTS: ["envoye", "en_montage", "a_valider", "refuse"],   // dépôts qui reçoivent un montage fait à la main
    TOLERANCE: 0.02, LIEN_S: 600,                                 // écart au 9:16 ; durée des liens signés des plans (10 minutes)
    PHRASES: { format: "Format non accepté : un montage fait à la main est un fichier MP4.", lourde: "Fichier trop lourd pour le stockage.",
      longue: "Montage trop long : 60 secondes au plus.", courte: "Montage trop court : 1 seconde au moins.",
      vertical: "Vidéo non verticale : un réel est en 9:16 (par exemple 1080 x 1920).", legende: "Légende obligatoire.",
      legende_longue: "Légende trop longue : 2 200 caractères au plus (Instagram, TikTok).", statut: "Ce dépôt ne reçoit pas de montage fait à la main (déjà validé, annulé ou abandonné).",
      efface: "Vidéos d'origine déjà effacées : plans indisponibles.", recu: "Fichier non reçu : recommencez l'envoi.", hors: "Fichier hors du dossier de montage de ce dépôt.",
      introuvable: "Dépôt introuvable.", admin: "Réservé à l'administrateur." },
    plansDispo: d => !!d && (d.nb_fichiers || 0) > 0 && !d.rushes_effaces_le && !d.effacement_demande_le,
    possible: d => !!d && MONTAGE_MAIN.STATUTS.includes(d.statut),
    // Durée et dimensions lues par un élément vidéo (métadonnées seulement). null si le navigateur ne sait pas les lire : la base contrôle alors
    // ce qu'elle reçoit (chemin, fichier présent) et la vidéo est vérifiée par l'équipe, qui l'a faite.
    lire(f, delai) {
      return new Promise(res => {
        let fini = false, url = null; const v = document.createElement("video");
        const fin = m => { if (fini) return; fini = true; try { v.removeAttribute("src"); v.load(); } catch (e) {} if (url) URL.revokeObjectURL(url); res(m); };
        v.preload = "metadata"; v.muted = true; v.playsInline = true;
        v.onloadedmetadata = () => fin({ duree_s: isFinite(v.duration) && v.duration > 0 ? Math.round(v.duration * 10) / 10 : null, largeur: v.videoWidth || null, hauteur: v.videoHeight || null });
        v.onerror = () => fin({ duree_s: null, largeur: null, hauteur: null });
        setTimeout(() => fin({ duree_s: null, largeur: null, hauteur: null }), delai || 8000);
        try { url = URL.createObjectURL(f); v.src = url; } catch (e) { fin({ duree_s: null, largeur: null, hauteur: null }); }
      });
    },
    // Contrôle d'un fichier avant envoi : rend { infos, raison } (raison : clé de PHRASES, ou null).
    async controler(f) {
      const R = window.RENOM_ENVOI.REGLES, x = window.RENOM_ENVOI.extension(f), t = String(f.type || "").toLowerCase(), taille = +f.size || 0;
      const infos = { nom: String(f.name || "").slice(0, 200), taille, duree_s: null, largeur: null, hauteur: null };
      if (!["mp4", "m4v"].includes(x) || (t && !["video/mp4", "video/x-m4v"].includes(t))) return { infos, raison: "format" };
      if (taille > R.VIDEO_MAX_MO * window.RENOM_ENVOI.MO) return { infos, raison: "lourde" };
      Object.assign(infos, await MONTAGE_MAIN.lire(f));
      if (infos.duree_s != null && Math.round(infos.duree_s) > R.DUREE_MAX_S) return { infos, raison: "longue" };
      if (infos.duree_s != null && infos.duree_s < R.DUREE_MIN_S) return { infos, raison: "courte" };
      if (infos.largeur && infos.hauteur && Math.abs(infos.largeur * 16 - infos.hauteur * 9) > MONTAGE_MAIN.TOLERANCE * infos.hauteur * 9) return { infos, raison: "vertical" };
      return { infos, raison: null };
    },
    // Légende : saisie, ou celle du contenu déjà lié (reprise) ; obligatoire quand il n'y en a aucune.
    legende(texte, reprise) { const l = String(texte || "").trim(); if (!l && !String(reprise || "").trim()) return { raison: "legende" }; if (l.length > 2200) return { raison: "legende_longue" }; return { legende: l || null, raison: null }; },
    chemin: (cid, depot) => cid + "/montage-" + depot + "/main-" + Date.now() + ".mp4",
    nomPlan: (d, x, i) => { const n = String(x.nom || x.chemin.split("/").pop()).replace(/[^\w.-]+/g, "-"); return String(d.commerce || "commerce").normalize("NFD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40) + "-plan-" + String(i + 1).padStart(2, "0") + "-" + n; },
  };
  const phraseMontageMain = m => { const P = MONTAGE_MAIN.PHRASES, x = String(m || "");
    return /réservé à l'administrateur/.test(x) ? P.admin : /dépôt introuvable/.test(x) ? P.introuvable : /déjà effacées/.test(x) ? P.efface : /reçoit un montage fait à la main/.test(x) ? P.statut
      : /fichier non reçu/.test(x) ? P.recu : /hors du dossier de montage/.test(x) ? P.hors : /1 à 60 secondes/.test(x) ? P.longue : /9:16/.test(x) ? P.vertical
      : /légende obligatoire/.test(x) ? P.legende : /légende refusée/.test(x) ? P.legende_longue : /commerce en pause/.test(x) ? "Ce commerce est en pause." : phraseDepot(x); };
  // ---- fin des règles communes du montage à la main

  // Demande d'idées : hors plafond depuis le 22/10/2026, une par 24 heures au plus (verifier_plafond, schema.sql). Même phrase dans les deux adaptateurs.
  const PHRASE_IDEES_JOUR = "Vous avez déjà demandé des idées aujourd'hui. Réessayez demain.";
  // ---- Photos déposées dans l'espace (17/10/2026 : SEUL chemin des photos, plus aucune par email) : mêmes règles et mêmes refus que la fonction
  // deposer_photos (bloc « Photos par l'espace » de schema.sql) dans les deux adaptateurs. Valeurs : RENOM_ENVOI.REGLES (PHOTOS_MAX, EXT_PHOTO).
  const PHOTOS = {
    PHRASES: { nb: "Un envoi contient de 1 à 10 photos.", hors: "Photo hors du dossier de votre commerce.", format: "Format non accepté (JPEG, PNG, WebP ou HEIC).",
      lourde: "Fichier trop lourd (50 Mo au plus).", nom: "Nom de fichier non accepté.", double: "Une même photo est déclarée deux fois.", deja: "Photo déjà enregistrée.",
      introuvable: "Commerce introuvable pour ce compte.", pause: "Votre commerce est en pause : contactez BoostImpact.",
      // Console (22/10/2026) : « Déposer des photos pour ce client », refusé sans l'autorisation photos du commerçant (admin_deposer_photos).
      sans_autorisation: "Ce client n'a pas coché l'autorisation photos dans son espace (ou l'a retirée) : impossible de déposer ses photos.",
      precision: "Le plat et son prix : 200 caractères au plus.",
      // 01/11/2026 (tour 7 Premium) : un numéro dans le plat et son prix irait tel quel sur la fiche Google, qui peut retirer la publication.
      precision_tel: "Le plat et son prix : pas de numéro de téléphone (il serait repris sur la fiche Google, qui peut retirer la publication). Le numéro de votre fiche est ajouté là où il faut.",
      // 14/11/2026 (décision de PJ) : l'occasion ou le message (photos.occasion), mêmes règles que le plat, 120 caractères au plus.
      occasion: "L'occasion ou le message : 120 caractères au plus.",
      occasion_tel: "L'occasion ou le message : pas de numéro de téléphone (il serait repris sur la fiche Google, qui peut retirer la publication). Le numéro de votre fiche est ajouté là où il faut." },
    // Plat et prix (01/11/2026, tour 7 Croissance) : comme enregistrer_photos, espaces resserrés, vide = null, 200 caractères au plus.
    precision: v => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "") || null,
    // Contrôle d'un envoi (liste de {chemin, nom, taille}) pour le commerce cid, dans l'ordre de deposer_photos. recu(chemin) : fichier présent dans le
    // seau ; connu(chemin) : photo déjà enregistrée. Rend la phrase du premier refus, ou null.
    controler(cid, details, recu, connu) {
      const P = PHOTOS.PHRASES, R = window.RENOM_ENVOI.REGLES, l = Array.isArray(details) ? details : [], vus = [];
      if (l.length < 1 || l.length > R.PHOTOS_MAX) return P.nb;
      for (const x of l) {
        const ch = x && typeof x.chemin === "string" ? x.chemin : null, fichier = ch && ch.startsWith(cid + "/") ? ch.slice(cid.length + 1) : null;
        if (!fichier || fichier.includes("/")) return P.hors;
        const ext = (fichier.toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1];
        if (!R.EXT_PHOTO.includes(ext)) return P.format;
        if (!/^[A-Za-z0-9_-]{1,100}\.[A-Za-z]{3,4}$/.test(fichier)) return P.nom;
        if (vus.includes(ch)) return P.double;
        if ((PHOTOS.precision(x.precision) || "").length > 200) return P.precision;
        if (contientTelephone(PHOTOS.precision(x.precision) || "")) return P.precision_tel;
        if ((PHOTOS.precision(x.occasion) || "").length > 120) return P.occasion;
        if (contientTelephone(PHOTOS.precision(x.occasion) || "")) return P.occasion_tel;
        if (!recu(ch)) return "Fichier non reçu : " + fichier + ".";
        if (connu(ch)) return P.deja;
        vus.push(ch);
      }
      return null;
    },
  };
  // Refus de deposer_photos (Supabase) ramenés aux mêmes phrases que la démonstration ; une phrase inconnue reste telle quelle.
  const phrasePhotos = m => { const P = PHOTOS.PHRASES, x = String(m || "");
    return /de 1 à 10 photos/.test(x) ? P.nb : /hors du dossier/.test(x) ? P.hors : /format non accepté/.test(x) ? P.format : /nom de fichier non accepté/.test(x) ? P.nom
      : /déclarée deux fois/.test(x) ? P.double : /déjà enregistrée/.test(x) ? P.deja : /occasion ou le message : pas de numéro/i.test(x) ? P.occasion_tel : /occasion ou le message/i.test(x) ? P.occasion : /pas de numéro de téléphone/.test(x) ? P.precision_tel : /plat et son prix/.test(x) ? P.precision : /autorisation photos absente/.test(x) ? P.sans_autorisation : /commerce introuvable/i.test(x) ? P.introuvable : /commerce en pause/.test(x) ? P.pause
      : /fichier non reçu : (.*)$/.test(x) ? "Fichier non reçu : " + x.match(/fichier non reçu : (.*)$/)[1] + "." : x; };
  // ---- fin des règles communes de l'envoi de photos

  // ---- Réponses aux commentaires : règles communes aux deux adaptateurs (mêmes valeurs que le bloc « Réponses aux commentaires » de schema.sql)
  const COMMENTAIRES = {
    LIMITE: 1000, CONSERVATION_JOURS: 30,
    CATEGORIES: { question: "Question", compliment: "Compliment", reclamation: "Réclamation", spam: "Spam", sensible: "Sensible" },
    ETATS: { a_valider: "À valider", valide: "Validée, publication en cours", a_publier_main: "Validée, publiée par notre équipe sous peu", publie: "Réponse publiée", humain: "À traiter par vous", ignore: "Sans réponse", clos: "Traité par vous" },
    RESEAUX: { instagram: "Instagram", facebook: "Facebook" },
  };
  function controlerDecisionCommentaire(x, decision, texte) {
    if (!x) throw new Error("Commentaire introuvable.");
    if (x.statut === "humain") { if (decision !== "clos") throw new Error("Un commentaire sensible ne reçoit pas de réponse de BoostImpact : répondez-y vous-même sur le réseau, puis marquez-le comme traité."); return { statut: "clos" }; }
    if (x.statut !== "a_valider") throw new Error("Ce commentaire a déjà été traité.");
    if (decision === "ignore") return { statut: "ignore" };
    if (decision !== "valide") throw new Error("Décision inconnue : valider la réponse ou ne pas répondre.");
    const t = String(texte ?? x.reponse_proposee ?? "").trim();
    if (!t) throw new Error("Écrivez une réponse, ou choisissez de ne pas répondre.");
    if (longueur(t) > COMMENTAIRES.LIMITE) throw new Error("La réponse est trop longue (1 000 caractères au plus).");
    return { statut: "valide", reponse_proposee: t };
  }
  // ---- fin des règles communes des commentaires

  // ---- Automatisations de service : règles communes aux deux adaptateurs (mêmes valeurs et mêmes phrases que le bloc
  // « Automatisations de service » de espace/supabase/schema.sql ; textes de la mise en route repris de moteur/courriels/service.js).
  const AUTO = {
    MAX_CLIENTS: 500, PASSAGE_MAX_JOURS: 14, ECART_JOURS: 90,
    POINTS: [
      { point: "compte", titre: "Activer votre compte", aide: "C'est fait dès votre première visite dans l'espace." },
      { point: "google", titre: "Donner à BoostImpact l'accès administrateur à votre fiche Google", aide: "Sur Google, connecté au compte de votre fiche, cherchez le nom de votre établissement, menu ⋮ du panneau « Votre établissement sur Google », Paramètres de la fiche d'établissement, Utilisateurs et accès, Ajouter, l'adresse team@boostimpact.agency, rôle Administrateur, Inviter. Vous restez propriétaire.", declarable: true },
      { point: "metricool", titre: "Connecter vos réseaux à notre outil de programmation", aide: "Nous créons votre espace dans notre outil de programmation. Au démarrage, l'équipe vous envoie le lien de connexion par WhatsApp. Il est valable 71 heures (un peu moins de 3 jours) : ouvrez-le et connectez vos réseaux. S'il a expiré, demandez-en un nouveau à l'équipe sur WhatsApp.", declarable: true },
      { point: "demarrage", titre: "Répondre aux 5 questions de démarrage", aide: "Cinq questions courtes pour que BoostImpact écrive comme vous. Chacune peut être passée." },
    ],
    ETATS: { a_faire: "À faire", declare: "Fait selon vous, BoostImpact vérifie", fait: "Fait" },
    // Étapes d'une offre (26/10/2026) : sans réseaux sociaux (Essentiel, OFFRES[...].reseaux_sociaux false), pas d'étape « metricool ».
    // Même règle que la base (mise_en_route_avec_reseaux, schema.sql) et que les emails (pointsOffre, moteur/courriels/service.js) ;
    // offre inconnue : avec réseaux.
    pointsOffre(offre) { const o = OFFRES[offre]; return AUTO.POINTS.map(x => x.point).filter(p => p !== "metricool" || !o || o.reseaux_sociaux !== false); },
  };
  const emailValide = e => /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]{2,}$/.test(e || "") && String(e).length <= 254;
  const dateValide = d => /^\d{4}-\d{2}-\d{2}$/.test(d || "") && !isNaN(Date.parse(d + "T00:00:00Z")) && new Date(d + "T00:00:00Z").toISOString().slice(0, 10) === d;
  // Fichier CSV de clients : une ligne d'en-tête (prénom, email, date de passage, dans n'importe quel ordre), séparateur « ; », « , » ou tabulation,
  // dates AAAA-MM-JJ ou JJ/MM/AAAA. Les erreurs de forme du fichier sont refusées ici ; les règles ligne par ligne sont celles de la base.
  // En-têtes acceptés en français, en anglais et en néerlandais (17/10/2026 : voornaam, e-mail, datum van het bezoek ; visit date pour l'anglais).
  const COLONNES = { prenom: ["prenom", "prenom du client", "first name", "firstname", "voornaam"], email: ["email", "e mail", "mail", "courriel", "adresse email", "adresse e mail", "adresse mail", "e mailadres", "emailadres"],
    date: ["date", "date de passage", "date passage", "passage", "date de visite", "date visite", "visite", "visit date", "date of visit", "datum", "datum bezoek", "datum van het bezoek", "bezoekdatum", "bezoek"] };
  function lireCsvClients(texte) {
    const l = String(texte || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n").filter(x => x.trim());
    if (!l.length) throw new Error("Le fichier est vide.");
    const sep = [";", ",", "\t"].map(s => [s, l[0].split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
    const cellules = ligne => { const r = []; let c = "", q = false;
      for (let i = 0; i < ligne.length; i++) { const ch = ligne[i];
        if (q) { if (ch === '"' && ligne[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; }
        else if (ch === '"') q = true; else if (ch === sep) { r.push(c); c = ""; } else c += ch; }
      r.push(c); return r.map(x => x.trim()); };
    const norme = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const tete = cellules(l[0]).map(norme), col = k => tete.findIndex(h => COLONNES[k].includes(h)), ip = col("prenom"), ie = col("email"), id = col("date");
    if (ip < 0 || ie < 0 || id < 0) throw new Error("La première ligne doit nommer les colonnes : prénom, email, date de passage.");
    if (l.length < 2) throw new Error("Le fichier ne contient aucun client.");
    if (l.length - 1 > AUTO.MAX_CLIENTS) throw new Error("Le fichier doit contenir de 1 à " + AUTO.MAX_CLIENTS + " clients.");
    const date = s => { const m = String(s || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : String(s || ""); };
    return l.slice(1).map(x => { const c = cellules(x); return { prenom: c[ip] || "", email: String(c[ie] || "").toLowerCase(), date_passage: date(c[id]) }; });
  }
  const TYPES_ALERTE = { ERREUR_WORKFLOW: "Automatisation arrêtée", MISE_EN_ROUTE_BLOQUEE: "Mise en route bloquée", ECHEC_RELANCE_PROSPECT: "Relance de prospect en échec",
    AVIS_SENSIBLE_A_EFFACER: "Avis sensible bientôt effacé (30 jours)", COMMENTAIRE_SENSIBLE_A_EFFACER: "Commentaire sensible bientôt effacé (30 jours)",
    // Paiement Stripe (fonction appliquer_evenement_stripe de schema.sql)
    PAIEMENT_REFUSE: "Paiement refusé", ABONNEMENT_SANS_COMMERCE: "Paiement sans commerce rattaché", REMISE_LANCEMENT_DEJA_UTILISEE: "Remise de lancement utilisée deux fois",
    ABONNEMENT_RESILIE: "Abonnement résilié", NOUVEAU_CLIENT_EN_LIGNE: "Nouveau client en ligne", ABONNEMENT_CLIENT_EXISTANT: "Paiement d'un client déjà connu",
    // Trois offres (bloc « Trois offres » de schema.sql) : garantie des délais, mode délégation, objectif interne des pilotes
    DELAI_FICHE_BIENTOT: "Garantie : fiche à optimiser bientôt", DELAI_CONTENU_BIENTOT: "Garantie : premier contenu à proposer bientôt", DELAI_AVIS_BIENTOT: "Garantie : avis à traiter bientôt",
    MOIS_OFFERT_A_APPLIQUER: "Garantie manquée : mois offert à appliquer", OBJECTIF_PILOTE_J45: "Objectif interne des pilotes : J+45, pas en vue",
    OBJECTIF_PILOTE_NON_ATTEINT: "Objectif interne des pilotes : non atteint", VALIDATION_TACITE_A_PROGRAMMER: "Mode délégation : contenu validé, à programmer",
    // Mode de secours des avis (20/10/2026, secours_avis_controle de schema.sql)
    AVIS_A_PUBLIER_ATTENTE: "Avis Google : réponse à publier depuis 4 h", AVIS_NON_REDIGE: "Avis Google : avis relevé sans réponse rédigée",
    AVIS_NON_VISIBLES: "Avis Google : nouveaux avis non lus par le relevé",
    // Options commandées (22/10/2026, enregistrer_commande_option de schema.sql)
    OPTION_COMMANDEE: "Option commandée : à livrer", OPTION_SANS_COMMERCE: "Option payée sans commerce rattaché", OPTION_DEJA_INCLUSE: "Option payée alors que l'offre la comprend",
    // Frais de mise en route offerts après la Visibilité IA payée (15/11/2026, bloc SQL du même nom) : montée de l'Essentiel faite, facture à vérifier
    FRAIS_OFFERTS_A_VERIFIER: "Frais de mise en route offerts : facture à vérifier",
    // Mise en route claire (27/10/2026, bloc SQL « Mise en route claire et travail visible ») : demandes du commerçant depuis son espace
    RAPPEL_DEMANDE: "Demande du commerçant : lui écrire sur WhatsApp", TVA_A_REPORTER: "Numéro de TVA à reporter dans Stripe", FICHE_GOOGLE_A_CREER: "Fiche Google à créer ou récupérer", FICHE_GOOGLE_A_IDENTIFIER: "Identifier la fiche Google",
    FICHE_GOOGLE_RECHERCHE_BLOQUEE: "Identifier la fiche Google", AVIS_ACCORD_A_PUBLIER: "Avis : le commerçant a répondu OK, réponse à publier",
    AVIS_EN_PARLER: "Avis sensible : le commerçant veut en parler", AVIS_VERSION_CLIENT: "Avis : message du commerçant à lire avant de publier",
    AVIS_RETENU: "Avis : le commerçant répond par message, rien n'est publié avant de l'avoir lu",
    // Lot 8 (16/11/2026, décision du fondateur) : alerte WhatsApp garantie, réponses du commerçant par message, surveillance de WaSender
    AVIS_SANS_MESSAGE_48H: "Avis : 48 h sans message du commerçant, décision à prendre", ALERTE_WHATSAPP_ECHEC: "Alerte WhatsApp non délivrée : publication bloquée",
    ALERTE_AVIS_SANS_WHATSAPP: "Commerce sans numéro WhatsApp : alerte d'avis impossible", WASENDER_EN_PANNE: "WhatsApp (WaSender) en panne",
    AVIS_FAUX_SIGNALE: "Avis signalé « pas un client » par le commerçant", WHATSAPP_RECU: "Message WhatsApp reçu sans avis en attente",
    // Fiches Google reliées automatiquement (02/11/2026, rapprocher_fiches_google de schema.sql) : une fiche du compte Google sans commerce sûr
    FICHE_A_RELIER: "Fiche Google à relier",
    // Carrousel TikTok (02/11/2026, reprendre_carrousel_tiktok de schema.sql) : la publication qui portait le carrousel est annulée ou en échec.
    TIKTOK_CARROUSEL_A_REPRENDRE: "TikTok : photos d'un carrousel à reprendre",
    // Changement d'offre (27/10/2026, bloc SQL « Changement d'offre en libre-service et mode délégation dans l'espace »)
    STRIPE_A_METTRE_A_JOUR: "Mettre Stripe à jour", PUBLICATIONS_A_RETIRER: "Publications à retirer de Metricool", OFFRE_CHANGEE: "Offre changée par Stripe",
    ANCIEN_ABONNEMENT_A_ARRETER: "Arrêter l'ancien abonnement", OFFRE_INFERIEURE_PAYEE: "Offre plus basse payée",
    // Test IA de l'audit gratuit (15/11/2026, moteur/audit/assistants_ia.py) : moteur en erreur, réponse vide ou retiré pour plafond ; une par jour au plus
    TEST_IA_ERREUR: "Test IA de l'audit : moteur en erreur",
    // Lot 9 (16/11/2026, geo_controle_echeances, n8n chaque heure) : échéance de 72 h ouvrées de la Visibilité IA
    BING_A_IMPORTER: "Import Bing Places (Visibilité IA)",
    VISIBILITE_IA_OBJECTIF_MANQUE: "Visibilité IA : objectif interne de 72 h ouvrées dépassé", VISIBILITE_IA_ECHEANCE_PROCHE: "Visibilité IA : échéance garantie (7 jours) dans moins de 24 h",
    VISIBILITE_IA_EN_RETARD: "Visibilité IA : échéance garantie (7 jours) dépassée", VISIBILITE_IA_GARANTIE: "Visibilité IA livrée en retard : garantie à appliquer",
    // Musique tendance (16/11/2026, publication_envoyee et musique_relancer de schema.sql) : aucune musique après le nouvel essai, vidéo non publiée sur ce réseau
    MUSIQUE_INTROUVABLE: "Vidéo non publiée : aucune musique autorisée trouvée",
    // Lot 9d (16/11/2026, relances_whatsapp_photos de schema.sql, CGV version 2 art. 3) : Premium sans photo ni vidéo depuis 7 puis 14 jours ; l'équipe écrit.
    RELANCE_WHATSAPP_PHOTOS: "Premium sans photo ni vidéo : relance WhatsApp à envoyer" };
  // Numéro lisible pour l'équipe : +33 6 12 34 56 78 (France) ; un autre pays reste tel quel.
  // Titre d'une alerte (28/10/2026) : les tâches de la fiche Google portent le nom du commerce (« Identifier la fiche Google de <commerce> »,
  // « Accompagner la création de la fiche Google de <commerce> »).
  const titreAlerte = (a, nomC) => { const n = nomC || "ce commerce";
    if (a.type === "FICHE_GOOGLE_A_IDENTIFIER" || a.type === "FICHE_GOOGLE_RECHERCHE_BLOQUEE") return "Identifier la fiche Google de " + n;
    if (a.type === "FICHE_GOOGLE_A_CREER") return ((a.detail || {}).cas === "pas_a_mon_nom" ? "Accompagner la récupération de la fiche Google de " : "Accompagner la création de la fiche Google de ") + n;
    return TYPES_ALERTE[a.type] || a.type; };
  const MOTIFS_FICHE = { introuvable: "aucune fiche trouvée", ambigu: "plusieurs fiches possibles", nom: "le nom de la fiche trouvée ne correspond pas au commerce",
    ville: "la fiche trouvée n'est pas dans la ville du commerce", sans_ville: "ville du commerce inconnue, recherche par nom impossible", cle_absente: "clé Google Places absente",
    erreur_google: "erreur de Google Places", lien_illisible: "lien illisible", different: "le lien désigne une autre fiche que l'identifiant déjà posé", inconnu: "motif inconnu" };
  // Fiche Google à relier (02/11/2026) : pourquoi la fiche n'a pas été reliée seule (rapprocher_fiches_google, relier_fiche_google).
  const MOTIFS_RELIER = { aucun: "aucun commerce n'a ce place_id, ni dans son identifiant ni dans le lien de sa fiche", plusieurs: "plusieurs commerces ont ce place_id",
    sans_place_id: "Google ne donne pas de place_id pour cette fiche", different: "ce commerce est déjà relié à une autre fiche", prise: "cette fiche est déjà reliée à un autre commerce",
    invitation: "invitation de Google non acceptée" };
  const telLisible = n => /^\+33[1-9]\d{8}$/.test(n || "") ? "+33 " + n.slice(3, 4) + " " + n.slice(4).replace(/(\d\d)(?=\d)/g, "$1 ") : n;
  const POINTS_MER = { compte: "Compte", google: "Accès Google", metricool: "Réseaux", demarrage: "5 questions" };
  const texteAlerte = a => { const d = a.detail || {};
    if (a.type === "RAPPEL_DEMANDE" && d.sujet === "changement_offre") return `Changement d'offre demandé : ${(OFFRES[d.offre_actuelle] || {}).nom || d.offre_actuelle || "offre actuelle"} vers ${(OFFRES[d.offre] || {}).nom || d.offre || "?"}. Confirmer par message (WhatsApp au ${telLisible(d.telephone) || "numéro du commerçant"}, ou email), jamais par appel (lot 8), puis changer l'abonnement dans Stripe (prorata), sans second paiement.${d.frais_offerts_option ? " Visibilité IA déjà payée : NE PAS ajouter les frais de mise en route (offerts, CGV art. 3 bis et 4)." : ""}`;
    if (a.type === "RAPPEL_DEMANDE") return `Écrire sur WhatsApp (aucun appel promis) au ${telLisible(d.telephone) || "numéro inconnu"} (sujet : ${({ mise_en_route: "mise en route", google: "accès à la fiche Google", reseaux: "connexion des réseaux", avis_sensible: "avis sensible" })[d.sujet] || d.sujet || "mise en route"}).`;
    if (a.type === "FICHE_GOOGLE_A_CREER") return `${d.cas === "pas_a_mon_nom" ? "Fiche existante, pas au nom du commerçant : écrire au commerçant sur WhatsApp (aucun appel promis, lot 9d) et demander l'accès avec lui" : "Pas de fiche : écrire au commerçant sur WhatsApp (aucun appel promis, lot 9d) et la créer avec lui (Google vérifie ensuite lui-même le commerce)"}, puis noter sa vérification par Google (la garantie démarre à cette date).`;
    // Fiche Google du client venu du site (28/10/2026) : lien collé, motif, identifiants proches ; l'identifiant se pose dans la fiche du client.
    if (a.type === "FICHE_GOOGLE_A_IDENTIFIER") return `Recherche automatique sans résultat sûr (${MOTIFS_FICHE[d.motif] || d.motif || "motif inconnu"}). Lien collé par le commerçant : ${d.lien || "aucun"}.${(d.candidats || []).length ? " Fiches proches : " + d.candidats.join(", ") + "." : ""} Ouvrir le lien, trouver la fiche, puis coller son identifiant (place_id) dans la fiche du client, Comptes.`;
    // Fiche Google à relier (02/11/2026) : jamais reliée par le nom ; le place_id posé dans la fiche du bon client la relie au passage suivant.
    if (a.type === "FICHE_A_RELIER") {
      const f = `« ${d.titre || "fiche sans titre"} »${d.adresse ? ", " + d.adresse : ""}`, m = MOTIFS_RELIER[d.motif] || d.motif || "motif inconnu";
      if (d.motif === "invitation") return `Invitation ${f}${d.type ? " (" + d.type + ")" : ""} : ${m}${d.erreur ? " (" + d.erreur + ")" : ""}. Elle reste en attente chez Google et sera retentée dans 30 minutes ; si l'erreur revient, l'accepter à la main (business.google.com, connecté en team@boostimpact.agency).`;
      if (d.motif === "different" || d.motif === "prise") return `Fiche ${f} (${d.location || d.cle || "?"}) : ${m}${d.actuelle ? " (" + d.actuelle + ")" : ""}${d.commerce_actuel_nom ? " (" + d.commerce_actuel_nom + ")" : ""}${d.commerce_vise_nom ? ", visée par " + d.commerce_vise_nom : ""}. Rien n'a été remplacé. Vérifier, puis, pour remplacer : éditeur SQL, select relier_fiche_google('<commerce>', '${d.location || d.cle || ""}', true);`;
      return `Fiche ${f} accessible au compte Google de BoostImpact, non reliée : ${m}${(d.noms || []).length ? " (" + d.noms.join(", ") + ")" : ""}.${d.place_id ? " place_id : " + d.place_id + "." : ""} Coller ce place_id dans la fiche du bon client, Comptes : la fiche se relie au passage suivant (30 minutes au plus). Fiche d'un autre établissement : « Traité ».`; }
    if (a.type === "TIKTOK_CARROUSEL_A_REPRENDRE") return `La publication qui portait le carrousel TikTok est ${d.statut === "echec" ? "en échec" : "annulée"}. ${(d.contenus || []).length} photo(s) déjà envoyée(s) ou entamée(s) ne paraîtront pas sur TikTok : les publier à la main sur TikTok si le commerçant le veut${d.reprises ? ` (${d.reprises} autre(s) ont retrouvé TikTok seules)` : ""}.`;
    if (a.type === "FICHE_GOOGLE_RECHERCHE_BLOQUEE") return `Recherche automatique sans réponse depuis ${d.heures} h (n8n « RENOM, identification de la fiche Google » ou GitHub Actions). Lien collé : ${d.lien || "aucun"}. Coller l'identifiant (place_id) dans la fiche du client, Comptes.`;
    if (a.type === "AVIS_ACCORD_A_PUBLIER") return `Réponse approuvée ${d.canal === "whatsapp" ? "par WhatsApp" : "dans l'espace"} (avis ${d.note || "?"} étoile${d.note > 1 ? "s" : ""}) : la publier telle quelle sur la fiche, puis la noter publiée.`;
    if (a.type === "AVIS_SANS_MESSAGE_48H") return `${d.note || "?"} étoile(s)${d.sensible ? ", avis sensible" : ""} : le commerçant a demandé d'attendre et n'a pas écrit depuis 48 h. ${d.sensible ? "Jamais publié sans son OK écrit : le relancer par WhatsApp et décider avec lui." : "Réponse proposée absente : la rédiger, puis relancer le commerçant."}`;
    if (a.type === "ALERTE_WHATSAPP_ECHEC") return `L'alerte WhatsApp ${d.type ? "« " + d.type + " » " : ""}n'a pas été délivrée${d.erreur ? " (" + d.erreur + ")" : ""}. Rien n'est publié d'office : vérifier le numéro du commerçant et WaSender, puis le prévenir à la main.`;
    if (a.type === "ALERTE_AVIS_SANS_WHATSAPP") return `Avis de ${d.note || "?"} étoile(s) arrivé alors que le commerce n'a pas de numéro WhatsApp : l'alerte garantie n'a pas pu partir. Obtenir le numéro (fiche du client, Comptes), puis prévenir le commerçant.`;
    if (a.type === "BING_A_IMPORTER") return `${d.commerce || "Ce commerce"} : importer la fiche Google dans Bing Places (bing.com/forbusiness, avec l'accès gestionnaire Google). État : ${({ a_faire: "à faire", depose: "déposé", publie: "publié", bloque: "bloqué" })[d.etat] || "à faire"}${d.note ? " (" + d.note + ")" : ""}. Le noter dans la fiche du client, bloc Visibilité IA ; le dépôt est exigé avant le rapport de livraison.`;
    const dateGeo = x => x ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" }).format(new Date(x)) : "date inconnue";
    const garantieGeo = g => g === "remboursement" ? "rembourser l'option (490 € HT)" : g === "mois_offert" ? "offrir un mois d'abonnement" : "voir la garantie";
    if (a.type === "VISIBILITE_IA_OBJECTIF_MANQUE") return `${d.commerce || "Ce commerce"} : objectif interne de 72 h ouvrées dépassé (${dateGeo(d.echeance)}). Échéance garantie : ${dateGeo(d.echeance_garantie)}. Étape à faire : ${d.etape_vous || "voir le dossier"}.`;
    if (a.type === "VISIBILITE_IA_ECHEANCE_PROCHE" || a.type === "VISIBILITE_IA_EN_RETARD")
      return `${d.commerce || "Ce commerce"} : livraison garantie de la Visibilité IA due le ${dateGeo(d.echeance)}${a.type === "VISIBILITE_IA_EN_RETARD" ? `, échéance dépassée : à la livraison, ${garantieGeo(d.garantie)}` : `, il reste ${String(d.heures_restantes ?? "?").replace(".", ",")} heure(s)`}. Étape à faire : ${d.etape_vous || "voir le dossier"}. Finir le travail, puis « Rapport de livraison remis ».`;
    if (a.type === "VISIBILITE_IA_GARANTIE") return `${d.commerce || "Ce commerce"} : Visibilité IA livrée le ${dateGeo(d.livre_le)}, après l'échéance garantie du ${dateGeo(d.echeance)}. Garantie à appliquer : ${garantieGeo(d.garantie)}.`;
    // Lot 9d : relance WhatsApp promise par les CGV (Premium, 7 puis 14 jours sans envoi) ; rien n'est envoyé d'office, l'équipe écrit puis marque vue.
    if (a.type === "RELANCE_WHATSAPP_PHOTOS") return `Relance WhatsApp de J+${d.palier || "?"} promise par les CGV (Premium) : aucune photo ni vidéo depuis ${d.jours != null ? d.jours + " jours" : "le début du mois"}. Écrire au commerçant sur WhatsApp au ${telLisible(d.telephone) || "numéro inconnu (le demander par email)"} pour lui demander ses photos et vidéos du mois, puis marquer comme vue.`;
    if (a.type === "MUSIQUE_INTROUVABLE") { const rs = (d.reseaux || []).map(r => ({ instagram: "Instagram", tiktok: "TikTok" })[r] || r).join(" et ") || "un réseau";
      return `${d.commerce || "Ce commerce"} : la vidéo prévue le ${dateGeo(d.prevu_le)} n'est pas partie sur ${rs}, faute de musique tendance autorisée après un nouvel essai (${Object.values(d.raisons || {}).join(" ; ") || "raison inconnue"}). Jamais publiée sans son : vérifier les catalogues musicaux dans Metricool (compte TikTok Business, Instagram relié par Facebook), puis reprogrammer la vidéo.`; }
    if (a.type === "WASENDER_EN_PANNE") return `${d.raison || "Session ou envois en échec"}. Ouvrir WaSender, reconnecter la session (QR code) ; tant que la panne dure, les alertes d'avis ne partent pas et rien n'est publié d'office.`;
    if (a.type === "AVIS_FAUX_SIGNALE") return `Avis de ${d.note || "?"} étoile(s) : le commerçant dit que ce n'est pas un client (${d.canal === "whatsapp" ? "par WhatsApp" : "dans son espace"}). Rien n'est publié : vérifier l'avis, le signaler à Google si besoin, répondre au commerçant.`;
    if (a.type === "WHATSAPP_RECU") return `Message WhatsApp reçu ${d.recu_le ? "le " + String(d.recu_le).slice(0, 16).replace("T", " ") + " (UTC) " : ""}sans avis en attente : le lire dans WhatsApp et répondre à la main (le texte n'est pas gardé).`;
    // Lot 10 (doctrine « zéro appel ») : on écrit au commerçant sur WhatsApp, on ne l'appelle jamais.
    if (a.type === "AVIS_EN_PARLER") return `Écrire au commerçant sur WhatsApp${d.telephone ? " au " + telLisible(d.telephone) : ""} au sujet de la réponse proposée (avis ${d.note || "?"} étoile${d.note > 1 ? "s" : ""}).`;
    if (a.type === "TVA_A_REPORTER") return `Le commerçant a donné son numéro de TVA (${d.numero || "?"}) : l'ajouter à son client dans Stripe (fiche du client, Numéros fiscaux) pour ses prochaines factures.`;
    // Changement d'offre (27/10/2026) : ce qu'il reste à faire à la main, avec les noms des offres (moteur/offres.json) et les clés de prix du catalogue.
    const nomO = k => (OFFRES[k] || {}).nom || k || "offre inconnue";
    if (a.type === "STRIPE_A_METTRE_A_JOUR") return `Offre changée dans la console : ${nomO(d.offre)}. Dans Stripe, l'abonnement ${d.abonnement || ""}${d.client_stripe ? " (client " + d.client_stripe + ")" : ""} est encore en ${nomO(d.offre_stripe)} : « Mettre à jour l'abonnement », remplacer le prix par boost_${d.offre}_mois ou boost_${d.offre}_an (même rythme), enregistrer. La tâche se ferme seule quand Stripe confirme.`;
    if (a.type === "PUBLICATIONS_A_RETIRER") return `${d.nombre || 1} publication(s) déjà envoyée(s) à Metricool sur un réseau hors de l'offre ${nomO(d.offre)} : les supprimer dans Metricool.`;
    if (a.type === "OFFRE_CHANGEE") return `${nomO(d.ancienne)} vers ${nomO(d.offre)} (${d.sens === "descente" ? "descente" : "montée"}), par Stripe (lien de paiement payé, ou prix changé). Espace déjà à jour ; suivre la mise en route.${d.test ? " (mode test)" : ""}`;
    // Montée payée par le lien de l'offre du dessus : l'ancien abonnement reste actif dans Stripe tant qu'il n'est pas arrêté (n8n le fait si la clé existe).
    if (a.type === "ANCIEN_ABONNEMENT_A_ARRETER") { const j = d.depuis ? String(d.depuis).slice(0, 10).split("-").reverse().join("/") : "date inconnue";
      return `${nomO(d.offre)}, souscrit le ${j} : abonnement ${d.abonnement || ""}${d.client_stripe ? " (client " + d.client_stripe + ")" : ""}, remplacé par ${d.nouveau || "le nouvel abonnement"} (${nomO(d.nouvelle_offre)}). Dans Stripe : l'annuler tout de suite, au prorata, puis rembourser le crédit de l'ancien client. La tâche se ferme seule quand Stripe confirme l'arrêt.${d.test ? " (mode test)" : ""}`; }
    if (a.type === "OFFRE_INFERIEURE_PAYEE") return `Lien de l'offre ${nomO(d.offre)} payé alors que le commerce est en ${nomO(d.offre_commerce)} avec un abonnement en cours : rien n'a changé. Écrire au commerçant sur WhatsApp ; une baisse se fait par la console, à la fin de la période payée.${d.test ? " (mode test)" : ""}`;
    if (a.type === "TEST_IA_ERREUR") return `Test IA : ${d.nom || d.moteur || "moteur"} ${({ erreur: "en erreur", vide: "réponse vide", plafond: "retiré pour plafond" })[d.cas] || "en erreur"} (${d.motif || "motif inconnu"}). Audit de ${d.commerce || "?"}${d.ville ? ", " + d.ville : ""}. Les suivants du jour (même moteur, même cas) ne sont pas répétés ; le reste de l'audit est parti normalement.`;
    if (a.type === "ERREUR_WORKFLOW") return `${d.workflow || "Workflow inconnu"}, nœud ${d.noeud || "inconnu"} : ${d.message || ""}`;
    // Libellés lisibles (26/10/2026, audit du parcours, constat 32) : « Accès Google, Réseaux » au lieu de « google, metricool ».
    if (a.type === "MISE_EN_ROUTE_BLOQUEE") return `${d.jours} jours après la création, il reste : ${(d.restants || []).map(r => POINTS_MER[r.point] || r.point).join(", ")}.`;
    if (a.type === "PAIEMENT_REFUSE") return `Abonnement ${d.abonnement || ""} : écrire au commerçant sur WhatsApp sous 24 h.${d.test ? " (mode test)" : ""}`;
    if (a.type === "ABONNEMENT_SANS_COMMERCE") return `Abonnement ${d.abonnement || ""} payé sans commerce rattaché : le rattacher dans l'éditeur SQL.${d.test ? " (mode test)" : ""}`;
    // Client en ligne (21/10/2026, client_en_ligne de schema.sql) : information seulement, ou cas d'une adresse déjà connue à vérifier.
    if (a.type === "NOUVEAU_CLIENT_EN_LIGNE") return `Abonnement ${d.abonnement || ""} (${d.offre || "offre inconnue"}) : commerce créé et invitation lancée automatiquement. Information, rien à faire.${d.test ? " (mode test)" : ""}`;
    if (a.type === "ABONNEMENT_CLIENT_EXISTANT") return `Abonnement ${d.abonnement || ""} (${d.offre || "offre inconnue"}) rattaché au commerce de cette adresse, sans nouvelle invitation : vérifier paiement en double, changement d'offre ou accès à rouvrir.${d.test ? " (mode test)" : ""}`;
    if (a.type === "REMISE_LANCEMENT_DEJA_UTILISEE") return `Abonnement ${d.abonnement || ""} : retirer la remise dans Stripe (une fois par commerce).${d.test ? " (mode test)" : ""}`;
    if (a.type === "OBJECTIF_PILOTE_J45") return `${d.gagnes} nouveau(x) avis sur ${d.objectif} au jour ${d.jour} (seuil en vue : ${d.seuil_en_vue}). Objectif interne, aucune conséquence de facturation.`;
    if (a.type === "OBJECTIF_PILOTE_NON_ATTEINT") return `${d.gagnes} nouveau(x) avis sur ${d.objectif} à l'échéance du ${d.echeance}. Objectif interne, aucune conséquence de facturation.`;
    if (/^DELAI_/.test(a.type)) return `Échéance : ${String(d.echeance || "").slice(0, 16).replace("T", " ")} (UTC).${(d.manque || []).includes("coherence") ? " Cohérence nom, adresse, téléphone, horaires pas encore vérifiée." : ""}`;
    if (a.type === "MOIS_OFFERT_A_APPLIQUER") return `Mois offert : ${d.mois_offert}. L'appliquer à la main dans Stripe, puis le noter dans la console.`;
    if (a.type === "VALIDATION_TACITE_A_PROGRAMMER") return `Contenu validé sans réponse en 48 h, non programmé : ${d.raison || "raison inconnue"}. Le programmer à la main.`;
    if (a.type === "ABONNEMENT_RESILIE") return `Abonnement ${d.abonnement || ""} : arrêter les publications en fin de période, retirer les accès sous 7 jours ouvrés.${d.test ? " (mode test)" : ""}`;
    if (a.type === "AVIS_A_PUBLIER_ATTENTE") return `${d.note} étoile(s), à publier depuis le ${String(d.depuis || "").slice(0, 16).replace("T", " ")} (UTC)${d.echeance ? `, échéance des 24 h : ${String(d.echeance).slice(0, 16).replace("T", " ")} (UTC)` : ", garantie déjà tenue"}. Console, À publier.`;
    if (a.type === "AVIS_NON_REDIGE") return `${d.note} étoile(s), relevé le ${String(d.recu_le || "").slice(0, 16).replace("T", " ")} (UTC) : aucune réponse rédigée. Vérifier n8n (réponse aux avis relevés).`;
    if (a.type === "AVIS_NON_VISIBLES") return `${d.nombre} avis apparu(s) sur la fiche sans être lu(s) par le relevé (Places ne rend que 5 avis) : ouvrir la fiche et y répondre à la main.`;
    if (a.type === "OPTION_COMMANDEE") return `${d.option_nom || d.option || "Option"}${d.montant_ht_centimes != null ? ` (${(d.montant_ht_centimes / 100).toFixed(2).replace(".", ",")} € HT)` : ""} : livraison ${d.livraison_jours || 14} jours après les éléments du client, au plus tôt le ${String(d.livraison_prevue_le || "").slice(0, 10)}. Console, Commerces, Options commandées.${d.test ? " (mode test)" : ""}`;
    if (a.type === "OPTION_SANS_COMMERCE") return `${d.option_nom || d.option || "Option"} payée sans commerce reconnu (session ${d.session || ""}) : la rattacher dans la console, Commerces, Options commandées.${d.test ? " (mode test)" : ""}`;
    // 15/11/2026 (modèle hybride) : Visibilité IA payée par un commerce Croissance ou Premium, qui la reçoit déjà avec la mise en route.
    if (a.type === "OPTION_DEJA_INCLUSE") return `${d.option_nom || d.option || "Option"} payée (session ${d.session || ""}) alors que l'offre ${d.offre_nom || d.offre || ""} la comprend déjà (CGV, article 3 bis) : rien à livrer en double ; rembourser le paiement dans Stripe ou en parler avec le client.${d.test ? " (mode test)" : ""}`;
    // 15/11/2026 : Essentiel qui avait payé la Visibilité IA, passé en Croissance ou Premium hors paiement annuel : les 190 € HT ne sont pas dus.
    if (a.type === "FRAIS_OFFERTS_A_VERIFIER") return `${nomO(d.ancienne)} vers ${nomO(d.offre)}${d.rythme ? " (" + d.rythme + ")" : ""}, Visibilité IA déjà payée : les frais de mise en route sont offerts (CGV art. 3 bis et 4). Dans Stripe, ouvrir la première facture de l'abonnement ${d.abonnement || "de la nouvelle offre"} : si une ligne « Frais de mise en route » y figure, la rembourser (Paiements, ce paiement, Rembourser, montant partiel) ; sinon, rien à faire.`;
    if (/_A_EFFACER$/.test(a.type)) return `Toujours en attente d'une personne. Texte effacé le ${String(d.efface_le || "").slice(0, 10)} (règle des 30 jours) : à traiter avant.`;
    return JSON.stringify(d); };
  // Commerces dont la recherche automatique de la fiche attend depuis plus de FG.ATTENTE_HEURES : carte « Identifier la fiche Google » (sans
  // ligne en base : elle disparaît dès que la recherche répond ou que la console pose l'identifiant).
  const rechercheBloquee = cs => (cs || []).filter(c => c && c.fiche_google_a_resoudre_le && Date.now() - Date.parse(c.fiche_google_a_resoudre_le) >= FG.ATTENTE_HEURES * 3600000)
    .map(c => ({ type: "FICHE_GOOGLE_RECHERCHE_BLOQUEE", code: "FICHE_GOOGLE_RECHERCHE_BLOQUEE", commerce_id: c.id, date: c.fiche_google_a_resoudre_le,
      detail: { heures: Math.floor((Date.now() - Date.parse(c.fiche_google_a_resoudre_le)) / 3600000), lien: c.fiche_google_lien || null } }));
  // ---- Paiement Stripe : lien du bouton « Payer / gérer mon abonnement » (adresses publiques de config.js, stripe : {liens, portail, fraisOffertsJusquAu},
  // écrites par outils/stripe_catalogue.py ; liens[offre][rythme][frais], rythme « mensuel » (sans engagement) ou « annuel » (12 mois payés d'avance), frais
  // « offerts » (Standard et Premium, souscription jusqu'au 30/11/2026 inclus), « factures » (190 € HT une fois) ou « sans_frais » (Essentiel). Abonnement en cours : portail client ; aucun abonnement ou
  // abonnement résilié : lien de paiement de l'offre, avec l'identifiant du commerce (client_reference_id, relu par le webhook). Aucun code promotionnel.
  // Rien de configuré : pas de bouton (null). Source : https://docs.stripe.com/payment-links/url-parameters, lue le 14/10/2026.
  const STATUTS_ABONNEMENT = ["en_attente", "actif", "impaye", "resilie"];
  // Frais de mise en route (29/10/2026, décision de PJ ; site/legal.json « offerts_paiement ») : offerts en paiement annuel, facturés une fois en
  // paiement mensuel, à toute date. stripe.fraisOffertsJusquAu (catalogue du 19/10/2026) n'est plus lu.
  const fraisOfferts = rythme => rythme === CONDITIONS.mise_en_route.offerts_paiement;
  // Langue de la page de paiement Stripe : celle de l'espace (fr, en ou nl, toutes reconnues par Stripe), plus le français forcé (24/10/2026).
  const langueStripe = () => { const l = window.RENOM_I18N && window.RENOM_I18N.langue; return ["fr", "en", "nl"].includes(l) ? l : "fr"; };
  // fraisDejaPayes (montée d'offre, 27/10/2026) : le commerce a déjà payé (ou s'est vu offrir) la mise en route : variante « offerts » quelle que soit la date.
  function lienAbonnement(ab, c, offre, maintenant, rythme, fraisDejaPayes) {
    const s = cfg.stripe || {}, https = u => typeof u === "string" && /^https:\/\/[^\s"<>]+$/.test(u) ? u : null;
    // Abonnement en cours (même impayé) : jamais le lien de paiement, qui créerait un second abonnement ; seulement le portail.
    if (ab && ab.statut !== "resilie") return https(s.portail);
    if (!OFFRES_EN_VENTE.includes(offre)) return null;   // offre retirée : aucun lien de paiement
    const r = ((s.liens || {})[offre] || {})[rythme === "annuel" ? "annuel" : "mensuel"] || {};
    // Essentiel : aucuns frais de mise en route, un seul lien (« sans_frais ») ; Standard et Premium : « offerts » en paiement annuel, « factures » au mois.
    const base = https(!(OFFRES[offre] || {}).frais_mise_en_route ? r.sans_frais : fraisDejaPayes ? r.offerts : fraisOfferts(rythme === "annuel" ? "annuel" : "mensuel") ? (r.offerts || r.factures) : r.factures);
    if (!base || !c || !/^[A-Za-z0-9_-]{1,200}$/.test(String(c.id || ""))) return null;
    return base + (base.includes("?") ? "&" : "?") + ["client_reference_id=" + encodeURIComponent(c.id), "locale=" + langueStripe()].join("&");
  }
  // ---- Montée d'offre en libre-service (27/10/2026, audit du parcours, constats 6 et 22 ; décision de PJ révisée le même jour) : lien du bouton
  // « Passer à <offre> » de l'écran Offre = LIEN DE PAIEMENT de l'offre du dessus, jamais le portail client (qui ne change plus d'abonnement).
  // Même rythme que l'abonnement en cours (abonnements.rythme ; inconnu : mensuel) ; frais de mise en route « offerts » jusqu'à fraisOffertsJusquAu,
  // puis « factures » (190 € HT une fois, sur la première facture) : même règle que lienAbonnement. Paramètres d'URL des liens de paiement
  // (docs.stripe.com/payment-links/customize, « Customize checkout with URL parameters », et docs.stripe.com/payment-links/url-parameters, lus le
  // 27/10/2026) : client_reference_id = le commerce (« sent in the checkout.session.completed webhook » : la base y reconnaît la montée et arrête
  // l'ancien abonnement), prefilled_email (« enter an email address on the payment page automatically », modifiable par le client), locale.
  // Rien de configuré : null.
  // UNE règle de rythme pour la montée d'offre (01/11/2026, tour 8 : prix affiché à l'année mais 190 € de mise en route comptés, car le prix et les
  // frais ne lisaient pas le même rythme par défaut) : celui de l'abonnement en cours ; inconnu ou sans abonnement en cours : MENSUEL (sans
  // engagement), comme le lien de paiement. Partagée par le prix (prixMontee), les frais de mise en route (app.js, offreDessus) et ce lien.
  const rythmeMontee = ab => ab && ab.statut !== "resilie" && ab.rythme === "annuel" ? "annuel" : "mensuel";
  // cmds (15/11/2026, décision de PJ) : options commandées du commerce ; l'Essentiel qui a payé la Visibilité IA monte avec les frais « offerts ».
  function lienMonteeOffre(ab, c, offreSuivante, maintenant, cmds) {
    if (!(OFFRES[offreSuivante] && OFFRES_EN_VENTE.includes(offreSuivante))) return null;
    const rythme = rythmeMontee(ab);
    // Mise en route déjà payée (correctif du 27/10/2026, décision de PJ) : un commerce dont l'offre comprend la mise en route (Croissance) ne la repaie
    // jamais : Croissance -> Premium prend TOUJOURS la variante « offerts » (sans ligne de frais), quelle que soit la date. Seule la montée depuis
    // l'Essentiel (offre sans mise en route) prend « factures » après fraisOffertsJusquAu.
    const optF = CONDITIONS.mise_en_route.offerts_apres_option;
    const dejaPayes = !!(OFFRES[(c || {}).offre_id] || {}).frais_mise_en_route || (!!optF && optionPayee(cmds, optF));
    const base = lienAbonnement(null, c, offreSuivante, maintenant, rythme, dejaPayes); if (!base) return null;
    const em = String((c || {}).email_validation || "").trim().toLowerCase();
    return /^[^\s@"<>]+@[^\s@"<>]+\.[^\s@"<>]+$/.test(em) ? base + "&prefilled_email=" + encodeURIComponent(em) : base;
  }
  // ---- Paiement en euros depuis l'espace (02/11/2026, décision de PJ) : les boutons « Payer mon abonnement » (lienAbonnement, aucun abonnement ou
  // abonnement résilié) et « Passer à <offre> » sans abonnement en cours (lienMonteeOffre) demandent une session Checkout en euros au webhook n8n
  // renom-checkout (n8n/build_checkout.py : tarification adaptative coupée, comme le site), au lieu d'ouvrir le lien buy.stripe.com (qui peut montrer
  // une autre devise hors zone euro). Le navigateur n'envoie qu'un JETON (jeton_paiement de schema.sql : membre du commerce, usage unique,
  // 15 minutes) et l'offre, le rythme et le cas de frais du lien ; n8n relit le commerce dans la base (lire_jeton_paiement) : référence,
  // offre actuelle, abonnement et adresse viennent de la base, jamais du navigateur. REPLI : le lien de paiement du bouton (app.js).
  // Le site et l'espace sont servis sur la même origine (https://boostimpact.agency, espace sous /espace/) : l'origine autorisée du webhook ne change pas.
  const CHECKOUT_URL = "https://peejay.app.n8n.cloud/webhook/renom-checkout";
  // Lien de paiement (tel que lienAbonnement / lienMonteeOffre le rendent) -> {offre, rythme, frais} d'après config.js (stripe.liens) ; inconnu : null.
  function demandeDeLien(u) {
    const base = String(u || "").split(/[?#]/)[0], L = (cfg.stripe || {}).liens || {};
    if (!/^https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+$/.test(base)) return null;
    for (const o of Object.keys(L)) for (const r of Object.keys(L[o] || {})) for (const f of Object.keys(L[o][r] || {})) if (L[o][r][f] === base) return { offre: o, rythme: r, frais: f };
    return null;
  }
  // Abonnement à montrer : le plus récent qui n'est pas résilié (après une montée, l'ancien, arrêté, reste dans la table), sinon le plus récent.
  const abonnementCourant = l => (l || []).find(x => x.statut !== "resilie") || (l || [])[0] || null;
  const MODELE_CSV = "prenom;email;date_passage\nCamille;camille@exemple.fr;" + new Date().toISOString().slice(0, 10) + "\n";
  // ---- fin des règles communes des automatisations

  // =============================================================== DÉMONSTRATION
  function demo() {
    // Deux graines : celle du parcours (demo/etat.json, générée par demo/parcours.py) et la graine PUBLIQUE, entièrement fictive
    // (demo/etat-public.json), choisie par window.RENOM_GRAINE = "public" dans config.js. Chacune a son propre stockage.
    const PUBLIQUE = window.RENOM_GRAINE === "public";
    // Lot 8 (James, tour 6 : démo EN/NL française et lyonnaise) : en anglais ou en néerlandais, la graine publique est bruxelloise
    // (demo/etat-public-be.json : +32, avis et réponses en néerlandais, un avis en anglais, légendes en néerlandais), avec son propre stockage.
    // La langue est relue à chaque ouverture : changer de langue sur l'écran d'entrée recharge la bonne graine (init remise à zéro).
    const familleGraine = () => PUBLIQUE && ["en", "nl"].includes((window.RENOM_I18N || {}).langue) ? "-be" : "";
    let famille = familleGraine();
    const cle = () => "renom-demo-v18" + (PUBLIQUE ? "-public" + famille : "");
    let K = cle();   // v16 (16/11/2026, lot 7) : légendes de l'entrée sans « l'heure du déjeuner » (programmée le soir). v15 : visuels au nom de chaque commerce.
    let E = null, session = null, aChoisir = false, pret = null, TF = null;   // aChoisir : session ouverte par un lien, mot de passe à choisir (acces.js)
    let aal2 = false;   // double authentification de l'administrateur (18/10/2026) : code vérifié dans cette session (comme aal2 de Supabase)
    // Interrupteur de la double authentification (acces.js, DOUBLE_AUTH_ADMIN ; false depuis le 22/10/2026) : sans lui, ni code, ni facteur.
    const doubleAuthExigee = () => !!(window.RENOM_ACCES && window.RENOM_ACCES.DOUBLE_AUTH_ADMIN);
    // Calendrier des temps forts (copie exacte de moteur/temps_forts/, vérifiée par moteur/tests/test_service.js) : l'idée de la semaine de la démonstration
    // est calculée par le même code que le workflow n8n du lundi. Absent (page sans vendor/temps-forts.js) : pas d'idée de la semaine, rien d'inventé.
    const chargerTempsForts = async () => { try { if (typeof ideeDeLaSemaine !== "function") return null; const r = await fetch("vendor/temps-forts.json", { cache: "no-store" }); return r.ok ? await r.json() : null; } catch (e) { return null; } };
    const sauver = () => { try { localStorage.setItem(K, JSON.stringify(E)); } catch (e) {} };
    // Deux onglets ouverts (l'espace et la page de validation par lien) : chacun reprend l'état écrit par l'autre.
    try { window.addEventListener("storage", ev => { if (ev.key === K && ev.newValue && E) { try { E = JSON.parse(ev.newValue); } catch (x) {} } }); } catch (e) {}
    const graine = async () => {
      try { const r = await fetch(PUBLIQUE ? "demo/etat-public" + famille + ".json" : "demo/etat.json", { cache: "no-store" }); if (r.ok) return await r.json(); } catch (e) {}
      if (PUBLIQUE) throw new Error("La démonstration n'a pas pu se charger. Rechargez la page.");   // jamais de repli sur les données du parcours
      return { users: { "commerce@demo": { role: "commerçant", commerce: "c-demo" }, "autre@demo": { role: "commerçant", commerce: "c-autre" }, "admin@demo": { role: "administrateur" } },
        commerces: { "c-demo": { id: "c-demo", nom: "Commerce de démonstration", metier: "autre", ville: "", offre_id: "essentiel", en_pause: false, mots_cles: [], mentions_autorisees: [], couleurs: { fond: "#FFFFFF", texte: "#000000", accent: "#2438FF" }, reglage_avis: "auto_des_4_etoiles" },
          "c-autre": { id: "c-autre", nom: "Salle de démonstration", metier: "sport", ville: "Orléans", offre_id: "premium", en_pause: false, mots_cles: [], mentions_autorisees: [], couleurs: { fond: "#FFFFFF", texte: "#000000", accent: "#2438FF" }, reglage_avis: "auto_des_4_etoiles" } },
        photos: [], contenus: [], publications: [], idees_demandes: [], idees: [], avis: [], journal: [], invitations: [],
        comptes: { "c-demo": { google: { etat: "non_connecte" }, facebook: { etat: "non_connecte" }, instagram: { etat: "non_connecte" }, tiktok: { etat: "non_connecte" } }, "c-autre": { google: { etat: "non_connecte" }, facebook: { etat: "non_connecte" }, instagram: { etat: "non_connecte" }, tiktok: { etat: "non_connecte" } } } };
    };
    const init = () => { if (familleGraine() !== famille) { famille = familleGraine(); K = cle(); pret = null; E = null; session = null; } return initGraine(); };
    const initGraine = () => pret || (pret = (async () => {
      const reset = /[?&]reset\b/.test(location.search + location.hash);
      try { if (!reset) E = JSON.parse(localStorage.getItem(K)); } catch (e) { E = null; }
      if (!E) {
        E = completerGraine(await graine());
        // Retours privés fournis par la graine : rangés dans leur propre stockage, comme ceux déposés depuis la page d'avis
        if (Array.isArray(E.retours_prives)) { ecrireRetours([...E.retours_prives.map(x => ({ id: uid(), lu: false, ...x })), ...lireRetours()]); delete E.retours_prives; }
        sauver();
      }
      conserver();   // règle des 30 jours, appliquée à chaque ouverture comme le passage quotidien du serveur
      assurerMiseEnRouteClaire(); assurerFicheGoogle();
      TF = TF || await chargerTempsForts(); assurerIdeeSemaine(); assurerMoisDemo();
      // Session durable : elle reste d'une visite à l'autre dans ce navigateur (localStorage), jusqu'à « Quitter ».
      try { if (reset) { localStorage.removeItem(K + ":session"); localStorage.removeItem(K + ":choisir"); localStorage.removeItem(K + ":aal2"); } const s = localStorage.getItem(K + ":session"); if (s && E.users[s]) { session = s; aChoisir = localStorage.getItem(K + ":choisir") === "1"; aal2 = localStorage.getItem(K + ":aal2") === "1"; } } catch (e) {}
    })());
    // fort : session déjà au niveau de la double authentification (code vérifié, ou visite directe de la démonstration).
    const ouvrir = (e, choisir, fort = false) => { assurerCompteOffre(e); session = e; aChoisir = choisir; aal2 = fort; try { localStorage.setItem(K + ":session", e); if (choisir) localStorage.setItem(K + ":choisir", "1"); else localStorage.removeItem(K + ":choisir"); if (fort) localStorage.setItem(K + ":aal2", "1"); else localStorage.removeItem(K + ":aal2"); } catch (x) {} };
    const listeComptes = () => { const l = Object.keys(E.users); return l.length > 1 ? l.slice(0, -1).join(", ") + " ou " + l[l.length - 1] : l.join(""); };
    // Lot 3 (15/11/2026, revue EN/NL : « 0470 refusé avec l'exemple +33 6 12 34 56 78 » sur le compte de démonstration, sans pays) : un commerce de la
    // graine sans pays prend celui de la langue de l'espace (néerlandais ou anglais : Belgique, +32 ; français : France, +33), relu à chaque
    // fois et jamais enregistré (propriété non énumérable : sauver() ne l'écrit pas) ; un pays réglé par la console (adminPays) la remplace.
    const paysDeLaLangue = () => { const l = (window.RENOM_I18N || {}).langue; return l === "nl" || l === "en" ? "BE" : "FR"; };
    const paysParDefaut = c => { if (c && typeof c === "object" && !c.pays) { delete c.pays; Object.defineProperty(c, "pays", { get: paysDeLaLangue, configurable: true, enumerable: false,
      set(v) { Object.defineProperty(this, "pays", { value: v, writable: true, enumerable: true, configurable: true }); } }); } return c; };
    const cur = () => { const u = E.users[session]; return u && u.commerce ? paysParDefaut(E.commerces[u.commerce]) : null; };
    // Relecture par l'équipe (14/11/2026, règle contenus_lecture) : un contenu « a_relire » n'est jamais rendu au commerçant.
    const mine = t => E[t].filter(x => x.commerce_id === cur().id && !(t === "contenus" && x.statut === "a_relire"));
    // Démonstration : la graine n'a pas la colonne. Lot 3 (15/11/2026, revue exploitant) : relecture active par défaut, comme la base (colonne
    // « default true », bloc du 14/11) ; seule l'équipe la coupe (adminReglerRelecture, relecture_equipe = false).
    const relectureDemo = c => !!c && c.relecture_equipe !== false;
    const jour = (cid, type, detail) => { E.journal.unshift({ id: uid(), commerce_id: cid, type, detail: detail || {}, cree_le: new Date().toISOString() }); };
    // Publications du mois (fonction usage_publications de schema.sql) : depuis le 22/10/2026, ni les demandes d'idées ni l'avis de la semaine (hors_plafond).
    const usage = c => E.contenus.filter(x => x.commerce_id === c.id && x.type === "publication" && x.mois === mois0() && x.statut !== "refuse" && !x.hors_plafond).length;
    const usageVideos = c => E.contenus.filter(x => x.commerce_id === c.id && x.type === "video" && x.mois === mois0() && x.statut !== "refuse").length;
    // Dépôts de vidéos en attente de montage (sans contenu encore) : ils réservent leur place, comme la fonction SQL videos_reservees.
    const depotsAttente = (c, sauf) => liste("depots_video").filter(d => d.commerce_id === c.id && d.mois === mois0() && !d.contenu_id && d.id !== sauf
      && (["envoye", "en_montage"].includes(d.statut) || (d.statut === "en_envoi" && Date.now() - Date.parse(d.cree_le) < DEPOT_VIDEO.OUVERT_MS))).length;
    const reserveesVideos = c => usageVideos(c) + (E.videos_avis_demandes || []).filter(x => x.commerce_id === c.id && x.mois === mois0() && ["a_traiter", "en_cours"].includes(x.statut)).length + depotsAttente(c);
    const pasEnPause = c => { if (c.en_pause) throw new Error("Votre commerce est en pause : contactez BoostImpact."); };
    const repondusCommentaires = c => liste("commentaires").filter(x => x.commerce_id === c.id && ["valide", "a_publier_main", "publie"].includes(x.statut) && x.decide_le && x.decide_le.slice(0, 7) === mois0().slice(0, 7)).length;
    // Photos en préparation (01/11/2026, tour 6 Premium ; même règle que la vue SQL compteur, colonne publications_preparation) : photos du mois
    // reçues ou en cours de rendu, sans contenu encore ; au plus les places restantes (au-delà, le rendu les garde pour le mois suivant).
    const photosPreparation = c => { const o = OFFRES[c.offre_id], t0 = debutMois(mois0()), n = E.photos.filter(p => p.commerce_id === c.id && ["a_traiter", "en_cours"].includes(p.statut)
      && Date.parse(p.cree_le) >= t0 && !E.contenus.some(x => x.photo_id === p.id)).length; return Math.max(0, Math.min(n, (+o.publications || 0) - usage(c))); };
    // « À valider » du bilan (01/11/2026, tour 6 Premium ; même règle que bilan_mois_de) : le compteur unique de l'espace (compteDe, app.js).
    const aValiderBilan = c => { const o = OFFRES[c.offre_id] || {}, av = mine("avis");
      return mine("contenus").filter(x => x.statut === "a_valider").length + av.filter(x => x.statut === "a_valider" && !x.sensible).length
        + av.filter(x => !(o.avis_equipe || o.delegation) && x.sensible && x.statut === "humain" && x.propose_le && String(x.reponse_proposee || "").trim() && !(x.decision_client && x.decision_client_le && x.decision_client_le >= x.propose_le)).length
        + (o.commentaires ? liste("commentaires").filter(x => x.commerce_id === c.id && ["a_valider", "humain"].includes(x.statut)).length : 0); };
    const vc = c => { const o = OFFRES[c.offre_id]; return { publications_preparation: photosPreparation(c), commerce_id: c.id, mois: mois0(), offre: c.offre_id, offre_nom: o.nom, en_pause: !!c.en_pause, publications_plafond: o.publications, videos_plafond: o.videos, publications_utilisees: usage(c), videos_utilisees: usageVideos(c), idees_demandees: E.idees_demandes.filter(x => x.commerce_id === c.id && x.mois === mois0() && x.statut !== "refusee").length,
      commentaires_inclus: !!o.commentaires, commentaires_repondus: repondusCommentaires(c) }; };
    // Comme est_admin() dans la base : compte administrateur, session par mot de passe (et double authentification faite dans cette session,
    // seulement si DOUBLE_AUTH_ADMIN).
    const admin = () => { const u = E.users[session]; if (!u || u.role !== "administrateur" || aChoisir || (doubleAuthExigee() && !aal2)) throw new Error("Réservé à l'administrateur."); };
    // Facteur TOTP de démonstration, rangé avec l'état (E.mfa[email] = { secret, verifie }) : effacé par « ?reset ». Ignoré sans DOUBLE_AUTH_ADMIN.
    const facteurDemo = () => doubleAuthExigee() ? (E.mfa || {})[session] || null : null;
    const qrDemo = async texte => {   // QR code de la démonstration : vendor/qrcode.js (déjà servi à l'espace), chargé seulement ici
      try {
        if (typeof qrcode !== "function") await new Promise((ok, ko) => { const s = document.createElement("script"); s.src = "vendor/qrcode.js"; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
        const q = qrcode(0, "M"); q.addData(texte); q.make(); return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }));
      } catch (e) { return null; }   // sans QR code, la clé en texte suffit
    };

    // ---- Collecte (démonstration) : jeton public et retours privés
    // Le jeton de démonstration se calcule à partir de l'identifiant : il est donc le même dans tous les navigateurs, et devinable.
    // En production, le jeton vient de la base (colonne jeton_avis, tirée au hasard).
    const jetonDemo = id => { let h = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b]; for (const ch of "renom-demo:" + id) h = h.map((x, i) => Math.imul(x ^ (ch.charCodeAt(0) + 31 * i), 16777619) >>> 0); return h.map(x => x.toString(16).padStart(8, "0")).join(""); };
    const jetonDe = c => c.jeton_avis || (c.jeton_avis = jetonDemo(c.id));
    const parJeton = j => Object.values(E.commerces).find(c => jetonDe(c) === j) || null;
    // Les retours ont leur propre clé de stockage : la page publique et l'espace, ouverts dans deux onglets, ne s'écrasent pas.
    const KR = K + ":retours"; let retoursMem = [];
    try { if (/[?&]reset\b/.test(location.search + location.hash)) localStorage.removeItem(KR); } catch (e) {}
    const lireRetours = () => { try { const l = JSON.parse(localStorage.getItem(KR)); retoursMem = Array.isArray(l) ? l : []; } catch (e) {} return retoursMem; };
    const ecrireRetours = l => { retoursMem = l; try { localStorage.setItem(KR, JSON.stringify(l)); } catch (e) {} };
    const collecteDemo = {
      async jetonAvis() { await init(); return jetonDe(cur()); },
      async avisPublic(jeton) { await init(); const c = parJeton(String(jeton || "")); return c ? { nom: c.nom, couleurs: c.couleurs || {}, lien_avis: lienAvisPublic(c), langue: c.langue || "fr" } : null; },
      async deposerRetour(jeton, r) {
        await init(); const c = parJeton(String(jeton || "")); if (!c) throw new Error("Ce lien n'est pas reconnu.");
        if (!lienAvisPublic(c)) throw new Error("Cette page n'est pas encore active.");
        const v = nettoyerRetour(r), l = lireRetours(), depuis = ms => l.filter(x => x.commerce_id === c.id && Date.now() - new Date(x.cree_le).getTime() < ms).length;
        if (depuis(3600000) >= RETOUR.parHeure || depuis(86400000) >= RETOUR.parJour) throw new Error("Trop de messages ont été envoyés à ce commerce. Réessayez plus tard.");
        l.push({ id: uid(), commerce_id: c.id, note: v.note, message: v.message, prenom: v.prenom, lu: false, cree_le: new Date().toISOString() }); ecrireRetours(l);
      },
      async retoursPrives() { await init(); const c = cur(); return lireRetours().filter(x => x.commerce_id === c.id).sort((a, b) => b.cree_le.localeCompare(a.cree_le)); },
      async marquerRetour(id, lu) { await init(); const c = cur(), l = lireRetours(), r = l.find(x => x.id === id && x.commerce_id === c.id); if (!r) throw new Error("Retour introuvable."); r.lu = !!lu; ecrireRetours(l); },
    };
    // ---- Collecte (démonstration) : fin

    // Kit de marque proposé à la première photo (rôle du moteur, rendu_cloud.proposer_kit) : même calcul, dans le navigateur.
    async function proposerKitDemo(c, url) {
      const MQ = window.RENOM_MARQUE; if (!MQ) return; const cat = await MQ.charger(), img = await MQ.chargerImage(url);
      if (c.marque) return;
      const k = MQ.garderCouleurs(MQ.proposer({ photos: [MQ.pixels(img)], metier: c.metier, ton: c.ton || "", cat }), c.couleurs);
      c.marque = { ...k, version: 1, maj: new Date().toISOString() }; c.couleurs = MQ.couleursCommerce(c.marque);
      jour(c.id, "MARQUE_PROPOSEE", { source: "photos", version: 1, simule: true }); sauver();
    }
    // Kit de marque d'un commerce : écran « Votre style » (le commerçant) et panneau « Style du commerce » de la console (BoostImpact, par = "renom").
    // Mêmes règles que la base : fautes refusées, version posée ici, auteur (valide_par) posé ici et jamais repris du navigateur, journal du commerce.
    async function marqueDemo(c) {
      const MQ = window.RENOM_MARQUE, cat = await MQ.charger();
      const src = ((c.marque && c.marque.source && c.marque.source.photos) || []).filter(u => /^demo\//.test(u)).map(u => ({ url: u, nom: u.split("/").pop() }));
      const photos = [...E.photos.filter(p => p.commerce_id === c.id && (p.statut !== "refusee" || p.refus_motif === "plafond") && /^data:image\//.test(p.url || "")).map(p => ({ url: p.url, nom: p.nom_fichier })), ...src].slice(0, 9); // photos refusées exclues de la grille (31/10/2026), sauf celles gardées pour le mois suivant (plafond), 9 au plus
      return { kit: c.marque ? MQ.normaliser(c.marque, c.couleurs, c.metier, c.ton || "", cat) : null, brut: c.marque || null, photos,
        logo: c.marque && c.marque.logo ? ((E.logos || {})[c.marque.logo] || null) : null, demandes: demandesStyleDemo(c),
        logo_demande: (() => { const d = logoDemande(c, demandesStyleDemo(c)); return d && (E.logos || {})[d.chemin] ? { ...d, url: E.logos[d.chemin] } : null; })() };
    }
    const demandesStyleDemo = c => liste("demandes_style").filter(x => x.commerce_id === c.id).sort((a, b) => b.cree_le.localeCompare(a.cree_le)).slice(0, 20);
    async function logoDemo(c, f) {
      const MQ = window.RENOM_MARQUE, e = MQ.controlerLogo(f); if (e) throw Object.assign(new Error("logo " + e), { code: "sty.logo." + e });
      // Démonstration : le logo est gardé dans ce navigateur, réduit à 512 px (en production : fichier d'origine dans le seau « photos », SVG converti en PNG).
      const blob = await MQ.enPng(f, 512), url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      const chemin = c.id + "/marque/logo-" + uid().replace(/[^a-z0-9]/gi, "").slice(0, 12) + ".png";
      E.logos = E.logos || {}; E.logos[chemin] = url; sauver(); return { chemin, url };
    }
    // verrouille : état voulu ; explicite : validation demandée par un bouton (« Ça me plaît », « Enregistrer et valider pour le client »).
    async function enregistrerMarqueDemo(c, kit, verrouille, par, explicite) {
      const MQ = window.RENOM_MARQUE, cat = await MQ.charger();
      const m = { ...MQ.sansBase({ ...kit, verrouille: !!verrouille, auto: false }) }; delete m.valide_par;
      const ancien = c.marque || null, maintenant = new Date().toISOString(), avant = !!(ancien && ancien.verrouille), parAvant = (ancien && ancien.valide_par) || "commercant";
      // Auteur et date de validation : mêmes règles que le déclencheur regler_marque
      let vl = m.verrouille ? maintenant : null; m.valide_par = par;
      if (m.verrouille && avant && !explicite) { m.valide_par = parAvant; vl = ancien.verrouille_le; }
      else if (m.verrouille && avant && par === parAvant) vl = ancien.verrouille_le;
      const f = MQ.fautes(m, c.id, cat);
      if (f.length) throw Object.assign(new Error("Kit de marque refusé : " + f.join(", ")), { codes: f });
      if (!ancien || MQ.canon(MQ.sansBase(ancien)) !== MQ.canon(m)) {
        m.version = (+(ancien && ancien.version) || 0) + 1; m.maj = maintenant; m.verrouille_le = vl;
        const deja = avant && parAvant === "commercant";   // même règle que journaliser_marque
        jour(c.id, par === "renom" ? (m.verrouille ? "MARQUE_VALIDEE_RENOM" : "MARQUE_REGLEE_RENOM") : m.verrouille && (explicite || !avant) && !deja ? "MARQUE_VALIDEE" : "MARQUE_ENREGISTREE", { version: m.version, par });
        c.marque = m; c.couleurs = MQ.couleursCommerce(m); sauver();
      }
      return c.marque;
    }
    // Ce que le commerçant règle lui-même (fonction SQL regler_ma_marque) : logo, expressions, validation. Le reste est réglé par BoostImpact.
    // « Texte sur vos photos » (écran « Vos publications », 31/10/2026) : jamais, annonces ou souvent, comme regler_ma_marque (liste fermée).
    const CLES_COMMERCANT = ["logo", "logo_fond", "mots_signature", "a_eviter", "texte_photos"];
    async function reglerMaMarqueDemo(c, p, valider) {
      const MQ = window.RENOM_MARQUE, cat = await MQ.charger(); p = p || {};
      if (Object.keys(p).some(k => !CLES_COMMERCANT.includes(k)) || valider === false) throw new Error("Votre style est réglé par BoostImpact : demandez-lui un changement.");
      if ("texte_photos" in p && !MQ.TEXTE_PHOTOS.includes(p.texte_photos)) throw new Error("Ce réglage n'est pas proposé : jamais, annonces ou souvent.");
      const base = c.marque ? { ...c.marque } : MQ.normaliser(null, c.couleurs, c.metier, c.ton || "", cat);
      return enregistrerMarqueDemo(c, { ...base, ...p }, valider ? true : !!base.verrouille, "commercant", valider === true);
    }
    function demanderChangementStyleDemo(c, texte) {
      const x = String(texte || "").trim(); if (!x || x.length > 1000) throw new Error("Écrivez votre demande (1 000 caractères au plus).");
      if (liste("demandes_style").filter(d => d.commerce_id === c.id && Date.now() - Date.parse(d.cree_le) < 86400000).length >= 10) throw new Error("Trop de demandes aujourd'hui. Réessayez demain.");
      const d = { id: uid(), commerce_id: c.id, texte: x, cree_le: new Date().toISOString(), traitee_le: null }; E.demandes_style.unshift(d);
      jour(c.id, "STYLE_CHANGEMENT_DEMANDE", { demande: d.id }); sauver(); return d.id;
    }
    // Faux services (jouent le rôle de n8n, GitHub Actions, Claude, Metricool, Google : rien de réel)
    const faux = {
      creation(photo) {
        const c = E.commerces[photo.commerce_id];
        if (usage(c) >= OFFRES[c.offre_id].publications) { photo.statut = "refusee"; photo.refus_motif = "plafond"; jour(c.id, "REFUS", { photo: photo.id, raison: "plafond de publications atteint" }); return; }
        // Plat et prix (01/11/2026, tour 7 Croissance) : repris tel quel en tête de la légende, comme le moteur (redaction.fautes_precision).
        // Français et néerlandais (01/11/2026, tour 7 Premium ; commerces.langues_publication) : le texte français, une ligne vide, puis le néerlandais,
        // comme le moteur (redaction.fautes_bilingue).
        const pr = (photo.occasion ? photo.occasion.replace(/[.!\s]+$/, "") + ". " : "") + (photo.precision ? photo.precision.replace(/[.!\s]+$/, "") + ". " : ""), lgs = Array.isArray(c.langues_publication) ? c.langues_publication : [];
        const legFr = pr + "Légende de démonstration : en service, notre IA l'écrit à partir de votre photo et de votre fiche.", legNl = pr + "Demotekst: in gebruik schrijft onze AI hem op basis van uw foto en uw gegevens.";
        const legende = lgs.includes("fr") && lgs.includes("nl") ? legFr + "\n\n" + legNl : lgs.length === 1 && lgs[0] === "nl" ? legNl : legFr, id = uid();
        E.contenus.unshift({ id, commerce_id: c.id, photo_id: photo.id, type: "publication", format: "publication", legende, legendes: legendesDemo(c, legende), visuel_url: photo.url || null, visuel_9x16_url: photo.url || null, note_modification: null, statut: relectureDemo(c) ? "a_relire" : "a_valider", mois: mois0(), cree_le: new Date().toISOString(), demo: true,
          marque_version: (c.marque && c.marque.version) || null });
        // Relecture par l'équipe (14/11/2026) : contenu « a_relire », ni jeton ni email tant que l'équipe ne l'a pas envoyé (admin_envoyer_au_client).
        photo.statut = "traitee"; jour(c.id, "PRODUIT", { photo: photo.id, simule: true }); if (!relectureDemo(c)) emettreJeton(c.id, "contenu", id);
      },
      // ---- Vidéo d'avis : FAUX rendu. Aucune vidéo n'est fabriquée dans le navigateur. Si la démonstration a été préparée
      // (python3 demo/video_avis_demo.py), le contenu montre une vidéo d'EXEMPLE rendue par le vrai moteur avec les avis fictifs.
      videoAvis(d) {
        if (d.statut !== "a_traiter") return; const c = E.commerces[d.commerce_id], o = OFFRES[c.offre_id];
        const refuser = motif => { d.statut = "refusee"; d.motif = motif; jour(c.id, "VIDEO_AVIS_REFUSEE", { demande: d.id, raison: motif, simule: true }); };
        if (!o.videos) return refuser("Votre offre ne comprend pas de vidéo.");
        if (usageVideos(c) + depotsAttente(c) >= o.videos) return refuser("Le plafond de vidéos de votre offre est atteint ce mois-ci.");
        const ex = E.video_avis_exemple || {}, id = uid();
        E.contenus.unshift({ id, commerce_id: c.id, photo_id: null, type: "video", format: "video", legende: "Vidéo d'avis de démonstration : rendu simulé par un faux service." + (ex.video_url ? " La vidéo montrée est un exemple produit par le vrai moteur avec des avis fictifs, pas avec votre sélection." : ""),
          visuel_url: ex.visuel_url || null, video_url: ex.video_url || null, note_modification: null, statut: "a_valider", mois: mois0(), cree_le: new Date().toISOString(), demo: true });
        d.statut = "traitee"; d.contenu_id = id; jour(c.id, "VIDEO_AVIS", { demande: d.id, contenu: id, simule: true });
        emettreJeton(c.id, "contenu", id);
      },
    };
    // ---- Dépôt de vidéos : FAUX montage. Aucune vidéo n'est montée dans le navigateur : le contenu montre une vidéo d'EXEMPLE de la graine
    // (montage_exemple), jamais les fichiers déposés, et sa légende le dit.
    faux.montage = d => {
      if (!["envoye", "en_montage"].includes(d.statut)) return; const c = E.commerces[d.commerce_id], ex = E.montage_exemple || E.video_avis_exemple || {}, id = uid();
      E.contenus.unshift({ id, commerce_id: c.id, photo_id: null, depot_video_id: d.id, type: "video", format: "video",
        legende: "Montage de démonstration : rendu simulé par un faux service." + (ex.video_url ? " La vidéo montrée est un exemple, pas un montage de vos fichiers." : ""),
        visuel_url: ex.visuel_url || null, video_url: ex.video_url || null, note_modification: null, statut: "a_valider", mois: d.mois, cree_le: new Date().toISOString(), demo: true });
      Object.assign(d, { statut: "a_valider", contenu_id: id, motif: null, maj_le: new Date().toISOString() }); jour(c.id, "MONTAGE", { depot: d.id, contenu: id, simule: true });
      emettreJeton(c.id, "contenu", id);
    };
    // Décision sur le contenu d'un montage : le dépôt suit (même règle que le déclencheur SQL suivre_contenu_depot).
    const suivreDepot = ct => { const d = ct.depot_video_id && liste("depots_video").find(x => x.id === ct.depot_video_id && x.contenu_id === ct.id); if (!d) return;
      d.statut = ["approuve", "programme", "publie"].includes(ct.statut) ? "valide" : ct.statut === "refuse" ? "refuse" : ct.statut === "modification" ? "en_montage" : "a_valider";
      d.motif = ct.statut === "refuse" ? DEPOT_VIDEO.PHRASES.refus_commercant : null; if (d.statut === "valide") d.valide_le = d.valide_le || new Date().toISOString(); d.maj_le = new Date().toISOString(); };
    // Programmation à l'approbation : mêmes règles que le déclencheur programmation_approbation de schema.sql. Un contenu qui vient d'être approuvé
    // part au prochain créneau libre du métier, sur les réseaux connectés, compris dans l'offre et compatibles avec le format (vidéo : jamais la fiche
    // Google ; story : Instagram et Facebook seulement). Jamais bloquant : rien de programmé, une entrée APPROUVE_NON_PROGRAMME au journal, avec le motif.
    // tacite (01/11/2026, tour 7 Premium) : validation par la délégation, programmée au créneau comme en service (valider_tacitement -> programmer_au_creneau).
    function programmerALApprobation(ct, tacite) {
      const c = E.commerces[ct.commerce_id]; if (!c || ct.statut !== "approuve" || (ct.valide_tacitement_le && !tacite)) return null;
      if (E.publications.some(p => p.contenu_id === ct.id && ["programme", "envoye", "publie"].includes(p.statut))) return null;
      const f = formatDe(ct), k = E.comptes[c.id] || {};
      const res = destinations(ct, reseauxAutorises(c), k).partent;   // f : format, gardé pour la lecture
      let t = null, raison = null;
      if (!res.length) raison = "Aucun réseau connecté pour ce contenu.";
      else if (c.en_pause) raison = "commerce en pause";
      else {
        const pris = E.publications.filter(p => p.commerce_id === c.id && ["programme", "envoye", "publie"].includes(p.statut)).map(p => new Date(p.prevu_le).getTime());
        try { t = iso(creneauPour(c, pris, ct)); } catch (er) { raison = "Aucun créneau libre dans les 60 prochains jours."; }
      }
      if (!t) { jour(c.id, "APPROUVE_NON_PROGRAMME", { contenu: ct.id, raison, reseaux: res }); return null; }
      E.publications.push({ id: uid(), commerce_id: c.id, contenu_id: ct.id, reseaux: res, prevu_le: t, statut: "programme", auto: true, cree_le: iso(Date.now()) });
      ct.statut = "programme"; jour(c.id, "PROGRAMMATION_AUTO", { contenu: ct.id, prevu_le: t, reseaux: res }); suivreDepot(ct);
      return { prevu_le: t, reseaux: res };
    }
    const vaDemandes = () => (E.videos_avis_demandes = E.videos_avis_demandes || []);
    // Décision sur un commentaire (espace ou lien) puis, si elle est validée, le faux workflow de publication : accès de Meta non accordé, donc file manuelle.
    function appliquerDecisionCommentaire(x, decision, texte) {
      const d = controlerDecisionCommentaire(x, decision, texte), maintenant = iso(Date.now());
      Object.assign(x, d, { decide_le: maintenant }); if (d.statut === "ignore") x.decision = "ignore";
      if (d.statut === "valide") Object.assign(x, { statut: "a_publier_main", erreur: "Accès de Meta pas encore accordé : publication par l'équipe BoostImpact." });
    }

    // =========================================================== Mise à jour de l'espace membre (démonstration)
    const MS_H = 3600000, iso = t => new Date(t).toISOString();
    const debutMois = m => Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1, 1);
    const finMois = m => Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 1);
    const moisDecale = n => { const m = mois0(); return new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 10); };
    const dans = (t, m) => { t = new Date(t).getTime(); return t >= debutMois(m) && t < finMois(m); };
    const liste = k => (E[k] = E[k] || []);
    // Vidéos IA du mois et compte API Higgsfield (14/11/2026) : même calcul que admin_video_ia_mois() de schema.sql (bloc « Compte API Higgsfield
    // visible »), sur le journal et la liste higgsfield_verifications de l'état de démonstration (vide dans les graines : « jamais vérifiée »).
    const videoIaMoisDemo = () => { const m = mois0(), moisDe = x => FMT_JOUR_PARIS.format(new Date(x)).slice(0, 7) + "-01", nb = x => typeof x === "number" ? x : /^[0-9]+(\.[0-9]+)?$/.test(String(x || "")) ? Number(x) : null;
      const l = E.journal.filter(j => j.type === "PRODUIT" && j.detail && j.detail.video_ia && typeof j.detail.video_ia === "object").map(j => ({ j, x: j.detail.video_ia, usd: nb(j.detail.video_ia.usd_estime), du: moisDe(j.cree_le) === m }))
        .map(o => ({ ...o, fact: o.x.etat === "faite" || o.x.facture === "oui", poss: o.x.facture === "possible" }));
      const somme = f => Math.round(l.filter(f).reduce((a, o) => a + (o.usd || 0), 0) * 1e4) / 1e4, du = l.filter(o => o.du), motifs = {};
      du.filter(o => o.x.etat === "plan_b").forEach(o => { const k = o.x.motif || "inconnu"; motifs[k] = (motifs[k] || 0) + 1; });
      const vs = liste("higgsfield_verifications").slice().sort((a, b) => Date.parse(b.verifie_le) - Date.parse(a.verifie_le));
      return { mois: m, faites: du.filter(o => o.x.etat === "faite").length, plan_b: du.filter(o => o.x.etat === "plan_b").length, desactivees: du.filter(o => o.x.etat === "desactivee").length, facturees: du.filter(o => o.fact).length, motifs,
        depense_usd: somme(o => o.du && o.fact), depense_possible_usd: somme(o => o.du && o.poss), facturees_sans_cout: du.filter(o => o.fact && o.usd == null).length, depense_totale_usd: somme(o => o.fact),
        dernieres: du.sort((a, b) => Date.parse(b.j.cree_le) - Date.parse(a.j.cree_le)).slice(0, 12).map(o => ({ commerce_id: o.j.commerce_id, nom: (E.commerces[o.j.commerce_id] || {}).nom || null, quand: o.j.cree_le,
          etat: o.x.etat || null, motif: o.x.motif || null, usd_estime: o.usd, facture: o.x.facture || null, modele: o.x.modele || null })),
        verification: vs[0] || null, verifications: vs.length }; };
    // Légende propre à chaque réseau, construite à partir de la légende unique et des mots-clés de la fiche (démonstration).
    const legendesDemo = (c, l) => {
      const tags = (c.mots_cles || []).map(m => "#" + m.replace(/[^\p{L}\p{N}]+/gu, "")).filter(t => t.length > 1).join(" ");
      const court = (l.match(/^[^.!?]+[.!?]/) || [l])[0];
      return { instagram: tags ? l + "\n\n" + tags : l, facebook: l, google: l, tiktok: tags ? court + " " + tags : court };
    };
    // ---- Validation par lien : un jeton par objet « à valider », usage unique, 7 jours. Jamais pour un avis sensible.
    const nouveauJeton = () => { const a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a, x => x.toString(16).padStart(2, "0")).join(""); };
    function emettreJeton(cid, objet, id) {
      const c = E.commerces[cid]; if (!c || (c.notifications && c.notifications.email === false)) return;
      if (objet === "avis") { const a = E.avis.find(x => x.id === id); if (!a || a.sensible) return; }
      if (objet === "commentaire") { const m = liste("commentaires").find(x => x.id === id); if (!m || m.categorie === "sensible") return; }
      const l = liste("jetons_validation"), maintenant = Date.now();
      if (l.some(j => j.objet_id === id && !j.utilise_le && new Date(j.expire_le).getTime() > maintenant)) return;
      l.push({ jeton: nouveauJeton(), commerce_id: cid, objet, objet_id: id, expire_le: iso(maintenant + 7 * 24 * MS_H), utilise_le: null, cree_le: iso(maintenant) });
      jour(cid, "EMAIL_VALIDATION", { objet, simule: true });
    }
    const objetDuJeton = j => j.objet === "contenu" ? E.contenus.find(x => x.id === j.objet_id) : j.objet === "commentaire" ? liste("commentaires").find(x => x.id === j.objet_id) : E.avis.find(x => x.id === j.objet_id);
    function lireJeton(jeton) {
      const j = liste("jetons_validation").find(x => x.jeton === String(jeton || "")); if (!j) return { etat: "inconnu" };
      const o = objetDuJeton(j), c = E.commerces[j.commerce_id];
      if (!o || !c || (j.objet === "avis" && o.sensible) || (j.objet === "commentaire" && o.categorie === "sensible")) return { etat: "inconnu" };
      if (j.utilise_le) return { etat: "utilise", j };
      if (new Date(j.expire_le).getTime() <= Date.now()) return { etat: "expire", j };
      if (o.statut !== "a_valider") return { etat: "traite", j };
      return { etat: "a_valider", j, o, c };
    }
    // ---- Génération des données de démonstration de la mise à jour (6 mois). Rien de réel : tout est marqué « démonstration ».
    // Dates relatives de la graine publique (il_y_a_h, dans_h, prevu_il_y_a_h, repondu_apres_h, mois « courant » ou « precedent »),
    // converties au chargement : la démonstration reste à jour quel que soit le jour où on l'ouvre.
    function datesRelatives(G, maintenant) {
      const H = 3600000;
      ["photos", "contenus", "publications", "idees_demandes", "idees", "avis", "journal", "videos_avis_demandes", "retours_prives", "commentaires", "depots_video"].forEach(k => (G[k] || []).forEach(x => {
        if (x.il_y_a_h != null) { x.cree_le = iso(maintenant - x.il_y_a_h * H); delete x.il_y_a_h; }
        // Publications (24/10/2026) : l'heure prévue tombe sur un créneau du métier (CRENEAUX : 11 h 30 et 18 h 30 pour un restaurant), le premier
        // à partir de l'échéance de la graine (ou le dernier avant, pour une publication passée), jamais à l'heure exacte d'ouverture de la page.
        const metier = ((G.commerces || {})[x.commerce_id] || {}).metier, horaires = ((G.commerces || {})[x.commerce_id] || {}).horaires, pays = ((G.commerces || {})[x.commerce_id] || {}).pays, pris = (G[k] || []).filter(y => y !== x && y.prevu_le && y.commerce_id === x.commerce_id).map(y => Date.parse(y.prevu_le));
        if (x.dans_h != null) { const t = maintenant + x.dans_h * H; x.prevu_le = iso(k === "publications" ? prochainCreneau(metier, pris, t - DELAI_MIN_CRENEAU, { horaires, pays, moment: momentLegende(texteDuContenu((G.contenus || []).find(y => y.id === x.contenu_id))) }) : t); delete x.dans_h; }
        if (x.prevu_il_y_a_h != null) { const t = maintenant - x.prevu_il_y_a_h * H; x.prevu_le = iso(k === "publications" ? creneauAvant(metier, pris, t) : t); delete x.prevu_il_y_a_h; }
        if (x.repondu_apres_h != null) { x.repondu_le = iso(new Date(x.cree_le).getTime() + x.repondu_apres_h * H); delete x.repondu_apres_h; }
        if (x.decide_apres_h != null) { x.decide_le = iso(new Date(x.cree_le).getTime() + x.decide_apres_h * H); delete x.decide_apres_h; }
        // Lot 5 B : avis retenu de la graine (« Appelez-moi avant de publier », rappel promis aujourd'hui) et dates du détail d'une ligne du journal
        // (« recu_le_il_y_a_h » devient « recu_le », « livraison_prevue_le_dans_h » devient « livraison_prevue_le »).
        if (x.retenue_il_y_a_h != null) { x.retenue_le = iso(maintenant - x.retenue_il_y_a_h * H); delete x.retenue_il_y_a_h; }
        if (x.retenue_jour === "aujourdhui") x.retenue_jour = jourParisDemo(maintenant);
        if (k === "journal" && x.detail && typeof x.detail === "object") Object.keys(x.detail).forEach(c => { const m = /^(.+)_(il_y_a_h|dans_h)$/.exec(c); if (!m || typeof x.detail[c] !== "number") return;
          x.detail[m[1]] = iso(maintenant + (m[2] === "dans_h" ? 1 : -1) * x.detail[c] * H); delete x.detail[c]; });
        // Tour 11 (v37, 1er novembre : « 2 sur 4 vidéos utilisées » avec deux vidéos créées le 31 octobre) : « courant » = le mois de création
        // (cree_le, heure de Paris), comme la base qui date chaque contenu du mois où il est créé ; sans date de création, le mois en cours.
        if (x.mois === "courant") x.mois = x.cree_le ? (p_ => ymd(p_.a, p_.m, 1))(partiesParis(Date.parse(x.cree_le))) : mois0(); else if (x.mois === "precedent") x.mois = moisDecale(-1);
      }));
      // Abonnement fictif de la graine publique : fin de la remise de lancement dans n jours (date du jour décalée), jamais une vraie date de Stripe.
      (G.abonnements || []).forEach(x => { if (x.remise_fin_dans_j != null) { x.remise_lancement_fin = iso(maintenant + x.remise_fin_dans_j * 24 * H).slice(0, 10); delete x.remise_fin_dans_j; }
        if (x.maj_il_y_a_h != null) { x.maj_le = iso(maintenant - x.maj_il_y_a_h * H); delete x.maj_il_y_a_h; } });
    }
    function completerGraine(G) {
      if (G.maj_membre) return G; G.maj_membre = 1; E = G;
      ["avis_historique", "google_demo", "concurrents", "audits_mensuels", "collecte_evenements", "actions_fiche", "jetons_validation"].forEach(liste);
      G.bases = G.bases || {};
      Object.values(G.commerces).forEach(c => { if (c.demarrage_fini == null) c.demarrage_fini = c.id !== "c-autre"; if (!("demarrage" in c)) c.demarrage = null; c.notifications = c.notifications || { email: true, whatsapp: false }; });
      const maintenant = Date.now(); datesRelatives(G, maintenant);
      G.contenus.forEach(x => { x.format = x.format || (x.type === "video" ? "video" : "publication"); });
      // Trois offres (16/10/2026) : une réponse proposée ou publiée vaut « traitée » (garantie des 24 h) ; plus de réglage « tout automatique ».
      (G.avis || []).forEach(a => { if (!a.traite_le && ["a_valider", "valide", "publie", "refuse"].includes(a.statut)) a.traite_le = a.cree_le; });
      // Mode de secours des avis (20/10/2026) : une réponse validée par le commerçant, en attente de publication à la main, était déjà « traitée »
      // (proposée) ; une réponse automatique ne l'est qu'à sa publication. Heure d'entrée dans la file : a_publier_apres_h après l'arrivée de l'avis.
      (G.avis || []).forEach(a => { if (a.statut !== "a_publier_main") return; if (!a.traite_le && a.decision !== "publication_automatique") a.traite_le = a.cree_le;
        if (!a.a_publier_le) a.a_publier_le = iso(Date.parse(a.cree_le) + (a.a_publier_apres_h || 0) * 3600000); delete a.a_publier_apres_h; });
      // Avis sensible dont l'équipe a déjà proposé une réponse au commerçant (graine : propose_apres_h) : traité au sens de la garantie des 24 h.
      (G.avis || []).forEach(a => { if (a.propose_apres_h != null && !a.propose_le) { a.propose_le = a.traite_le = new Date(Date.parse(a.cree_le) + a.propose_apres_h * 3600000).toISOString(); } delete a.propose_apres_h; });
      Object.values(G.commerces).forEach(c => { if (c.reglage_avis && c.reglage_avis !== "auto_des_4_etoiles") c.reglage_avis = "auto_des_4_etoiles";
        // Graine du parcours générée avant le 16/10/2026 (offre Croissance, retirée) : la démonstration montre l'offre en vente qui la remplace, Premium.
        if ((OFFRES[c.offre_id] || {}).retiree) c.offre_id = "premium"; });
      // Avis de la graine : même règle que le déclencheur regler_avis_offre de la base (22/10/2026) : en Standard et en Premium, un avis non sensible
      // « à valider » va à l'équipe (statut « escalade ») dès son arrivée ; jamais de « Valider et publier » côté commerçant (24/10/2026).
      (G.avis || []).forEach(a => { if (reglerAvisOffre(a)) jour(a.commerce_id, "AVIS_EQUIPE", { avis: a.id, note: a.note }); });
      // Commerce principal de la démonstration : celui que désigne la graine (demo_maj), sinon celui du premier compte commerçant.
      // Les textes propres au commerce du parcours viennent de sa propre fiche : aucun nom de commerce n'est écrit ici.
      const prof = G.demo_maj || null, premier = Object.values(G.users).find(u => u.commerce), er = G.commerces[prof ? prof.principal : premier && premier.commerce];
      if (er) {
        // Réponses au démarrage, tirées des faits publics de la fiche
        const phrase1 = t => ((String(t || "").match(/^[^.!?]+[.!?]/) || [String(t || "")])[0]).trim();
        if (!prof) er.demarrage = er.demarrage || { phrase: phrase1(er.specialites), distinctions: "", ton: /enthousias|enjou/i.test(er.ton || "") ? "enjoue" : /chaleur/i.test(er.ton || "") ? "chaleureux" : "sobre",
          interdits: "", action: /réserv/i.test(er.horaires || "") ? "reserver" : "venir", action_detail: er.contact || "" };
        // Légendes par réseau : la graine du parcours en donne à chaque contenu, sauf la publication « p-velo-pins », créée avant les légendes
        // par réseau (demo/parcours.py la garde avec sa seule légende unique) : elle reste ainsi, pour montrer le repli des anciens contenus.
        // Une graine plus ancienne, sans aucune légende par réseau, en reçoit sur la vidéo « p-fat-bike-foret » seulement.
        if (!prof) G.contenus.filter(x => x.commerce_id === er.id && x.photo_id === "p-fat-bike-foret" && x.type === "video" && !x.legendes)
          .forEach(x => { x.legendes = legendesDemo(er, x.legende || ""); if (x.type === "video") delete x.legendes.google; });
        // Une story à valider (format 9:16), produite à la fin du mois dernier
        const pins = G.contenus.find(x => x.photo_id === "p-velo-pins" && x.type === "publication");
        if (!prof && !G.contenus.some(x => x.format === "story")) {
          const l = er.horaires || "Horaires de démonstration.";
          G.contenus.push({ id: "story-demo", commerce_id: er.id, photo_id: pins ? pins.photo_id : null, type: "publication", format: "story", legende: l, legendes: { instagram: l, facebook: l, tiktok: l },
            visuel_url: pins ? pins.visuel_url : null, note_modification: null, statut: "a_valider", mois: moisDecale(-1), cree_le: iso(debutMois(mois0()) - 6 * MS_H), demo: true });
        }
        // Date de réponse des avis déjà répondus (pour le délai de réponse)
        G.avis.filter(a => a.commerce_id === er.id && ["publie", "valide"].includes(a.statut) && !a.repondu_le)
          .forEach((a, i) => { a.repondu_le = iso(new Date(a.cree_le).getTime() + (a.decision === "publication_automatique" ? 2 + (i % 4) : 19) * MS_H); });
        // Avis des 5 mois précédents (historique, seulement pour les résultats) : la note et le nombre d'avis en découlent
        const RECUS = [3, 4, 5, 6, 8], REPONDUS = [1, 2, 5, 6, 8], DELAIS = [70, 52, 20, 9, 5], NOTES = [5, 4, 5, 5, 3, 5, 4, 5, 5, 4, 5, 5, 4, 5, 5, 3, 5, 5, 4, 5, 5, 4, 5, 5, 4, 5];
        let k = 0;
        RECUS.forEach((n, i) => { const d0 = debutMois(moisDecale(i - 5));
          for (let j = 0; j < n; j++, k++) { const cree = d0 + Math.round((1 + j * 26 / n) * 24 + 9) * MS_H, rep = j < REPONDUS[i] ? cree + Math.round(DELAIS[i] * (0.7 + 0.15 * ((j * 3) % 5))) * MS_H : null;
            G.avis_historique.push({ id: "h-" + k, commerce_id: er.id, note: NOTES[k % NOTES.length], cree_le: iso(cree), repondu_le: rep ? iso(rep) : null, demo: true }); } });
        G.bases[er.id] = (prof && prof.base) || { nb: 31, somme: 133 };   // avis plus anciens que la période : 31 avis, moyenne 4,29
        // Trois concurrents fictifs. La base ne garde que leur identifiant de lieu et un libellé ; « google_demo » joue le rôle de Google
        // (ce que la lecture à la demande renverrait aujourd'hui : nom, note, nombre d'avis), comme n8n/renom-resultats-google.json en service.
        [["Concurrent A", 131, 4.6], ["Concurrent B", 58, 4.1], ["Concurrent C", 29, 4.5]]
          .forEach(([nom, nb, note], o) => { const pid = "demo-concurrent-" + "abc"[o];
            G.concurrents.push({ id: "conc-" + o, commerce_id: er.id, place_id: pid, nom, ordre: o + 1 });
            G.google_demo.push({ type: "concurrent", commerce_id: er.id, place_id: pid, nom, note, nb_avis: nb }); });
        // Score actuel de la fiche (5 piliers notés sur 20), tel que la lecture à la demande le calculerait : jamais gardé mois après mois
        const P = { profil: 17, categories: 15, photos: 16, avis: 15, engagement: 14 };
        const NOMS = { profil: "Complétude du profil", categories: "Catégories et attributs", photos: "Photos", avis: "Avis", engagement: "Signaux d'engagement" };
        G.google_demo.push({ type: "fiche", commerce_id: er.id, piliers: Object.keys(P).map(cle => ({ cle, nom: NOMS[cle], note: P[cle], sur: 20 })) });
        // Thèmes des avis : plus rien de rangé (règle de Google, aucune agrégation conservée) ; calculés à l'ouverture de Résultats (themesDemo).
        // Passages sur la page d'avis et clics vers Google depuis le début du mois
        const d0 = debutMois(mois0()), duree = Math.max(MS_H, maintenant - d0 - MS_H);
        for (let i = 0; i < 46; i++) G.collecte_evenements.push({ commerce_id: er.id, type: "passage", cree_le: iso(d0 + Math.floor(duree * (i + 0.5) / 46)), demo: true });
        for (let i = 0; i < 17; i++) G.collecte_evenements.push({ commerce_id: er.id, type: "clic_google", cree_le: iso(d0 + Math.floor(duree * (i + 0.7) / 17)), demo: true });
        // Actions de fiche Google : une publiée le mois dernier, une à valider (exemples de démonstration)
        const dans12 = new Date(maintenant + 12 * 24 * MS_H).toISOString().slice(0, 10);
        G.actions_fiche.push({ id: "af-demo-1", commerce_id: er.id, type: "photos", donnees: { photos: (prof && prof.photos_fiche) || ["p-velo-pins", "p-fat-bike-foret"] }, statut: "publie", cree_le: iso(debutMois(moisDecale(-1)) + 19 * 24 * MS_H), publie_le: iso(debutMois(moisDecale(-1)) + 20 * 24 * MS_H), demo: true },
          { id: "af-demo-2", commerce_id: er.id, type: "horaires", donnees: { date: dans12, ferme: true }, statut: "a_valider", cree_le: iso(maintenant - 2 * MS_H), publie_le: null, demo: true });
      }
      G.contenus.filter(x => x.statut === "a_valider").forEach(x => emettreJeton(x.commerce_id, "contenu", x.id));
      G.avis.filter(x => x.statut === "a_valider" && !x.sensible).forEach(x => emettreJeton(x.commerce_id, "avis", x.id));
      liste("commentaires").filter(x => x.statut === "a_valider" && x.categorie !== "sensible").forEach(x => emettreJeton(x.commerce_id, "commentaire", x.id));
      completerAutomatisations(G, maintenant, er || null);
      return G;
    }
    // ---- Mesures (démonstration) : calculées à partir des avis, des relevés et des événements, jamais tirées au hasard
    const KC = K + ":collecte"; let collecteMem = [];
    try { if (/[?&]reset\b/.test(location.search + location.hash)) localStorage.removeItem(KC); } catch (e) {}
    const lireCollecte = () => { try { const l = JSON.parse(localStorage.getItem(KC)); collecteMem = Array.isArray(l) ? l : []; } catch (e) {} return collecteMem; };
    // Ce que la lecture de Google à la demande renverrait : l'historique fictif, plus les avis de la table (ceux effacés par BoostImpact à 30 jours restent
    // chez Google : leur copie « google » est rangée dans l'historique fictif au moment de l'effacement, voir conserver()).
    const avisTous = c => [...liste("avis_historique").filter(x => x.commerce_id === c.id), ...E.avis.filter(x => x.commerce_id === c.id && !x.efface_le)];
    function etatAvis(c, t) {
      const b = (E.bases || {})[c.id], l = avisTous(c).filter(a => a.note && new Date(a.cree_le).getTime() < t);
      if (!b && !l.length) return { note: null, nb_avis: null };
      const nb = (b ? b.nb : 0) + l.length, s = (b ? b.somme : 0) + l.reduce((x, a) => x + a.note, 0);
      return { note: Math.round(s / nb * 10) / 10, nb_avis: nb };
    }
    const moyenneH = l => l.length ? Math.round(l.reduce((s, a) => s + (new Date(a.repondu_le) - new Date(a.cree_le)) / MS_H, 0) / l.length * 10) / 10 : null;
    const publiees = (c, m) => E.publications.filter(p => p.commerce_id === c.id && p.statut === "publie" && dans(p.prevu_le, m)).length;
    function mesureCollecte(c) {
      const m = mois0(), ev = [...liste("collecte_evenements"), ...lireCollecte()].filter(x => x.commerce_id === c.id && dans(x.cree_le, m));
      const avant = etatAvis(c, debutMois(m)).nb_avis, apres = etatAvis(c, Date.now() + 1).nb_avis;
      return { passages: ev.filter(x => x.type === "passage").length, clics_google: ev.filter(x => x.type === "clic_google").length,
        retours_prives: lireRetours().filter(x => x.commerce_id === c.id && dans(x.cree_le, m)).length, nouveaux_avis: apres == null ? 0 : apres - (avant || 0) };
    }
    // ---- Conservation (démonstration) : même règle que la base (effacer_contenus_expires) : au-delà de 30 jours, texte, note et auteur d'un avis,
    // texte et auteur d'un commentaire sont effacés ; l'identifiant, notre réponse et nos dates restent. La copie « Google » d'un avis effacé rejoint
    // l'historique fictif (en service, Google garde l'avis : seul BoostImpact l'oublie).
    function conserver() {
      if (!E) return; const limite = Date.now() - VIDEO_AVIS.AGE_MAX_JOURS * 86400000, maintenant = iso(Date.now()); let n = 0;
      (E.avis || []).forEach(a => { if (a.efface_le || Date.parse(a.cree_le) >= limite) return;
        if (a.note) liste("avis_historique").push({ id: "g-" + a.id, commerce_id: a.commerce_id, note: a.note, cree_le: a.cree_le, repondu_le: a.repondu_le || null, demo: true });
        a.texte = null; a.note = null; a.auteur = null; a.efface_le = maintenant; n++; jour(a.commerce_id, "AVIS_EFFACES_30_JOURS", { nombre: 1 }); });
      liste("commentaires").forEach(x => { if (x.efface_le || Date.parse(x.cree_le) >= limite) return; x.texte = null; x.auteur = null; x.efface_le = maintenant; n++; });
      if (n) sauver();
    }
    // ---- Thèmes des avis (démonstration) : calculés à l'ouverture de Résultats sur les avis présents (30 jours au plus, non sensibles), jamais rangés.
    // FAUX service : un repérage par mots, pas Claude. En service, n8n/renom-resultats-google.json envoie ces avis à Claude (moteur/resultats/themes.js),
    // avec la même règle : un thème doit revenir dans au moins deux avis.
    const FAMILLES = [["L'accueil et le service", /accueil|explication|souri|sympa|gentil|serveu|equipe|service/], ["Le matériel", /velo|materiel|batterie|en bon etat|recent|regle/],
      ["Le parcours et les paysages", /balade|parcours|foret|paysage|\bmer\b|sortie|vue/], ["L'attente", /attente|attendu|retard/], ["Les plats", /plat|pates|cuisine|dessert|entree|assiette|saveur|mijot/],
      ["L'ambiance", /ambiance|cadre|decor|terrasse|calme|bruit/], ["Les prix", /prix|cher|tarif|addition/]];
    function themesDemo(c) {
      const plat = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const avis = E.avis.filter(a => a.commerce_id === c.id && !a.efface_le && !a.sensible && (a.texte || "").trim() && Date.now() - Date.parse(a.cree_le) <= VIDEO_AVIS.AGE_MAX_JOURS * 86400000);
      if (avis.length < 2) return { themes: [], statut: "insuffisants", analyses: avis.length };
      const themes = FAMILLES.map(([theme, re]) => { const l = avis.filter(a => re.test(plat(a.texte))); return { theme, positif: l.filter(a => a.note >= 4).length, negatif: l.filter(a => a.note < 4).length }; })
        .filter(t => t.positif + t.negatif >= 2).sort((a, b) => (b.positif + b.negatif) - (a.positif + a.negatif)).slice(0, 5);
      return { themes, statut: "calcules", analyses: avis.length };
    }
    // Statistiques fictives d'un mois complet pour la démonstration (appels, itinéraires, clics vers le site, vues) : jamais tirées au hasard.
    const PERF_DEMO = { appels: 38, itineraires: 61, clics_site: 24, vues: 2140 };
    const majDemo = {
      async resultats(n) {
        await init(); const c = cur(); n = Math.max(1, Math.min(12, +n || 6));
        const L = Array.from({ length: n }, (_, i) => moisDecale(i - n + 1)), tous = avisTous(c), maintenant = Date.now();
        const mois = L.map(m => { const st = etatAvis(c, Math.min(finMois(m), maintenant + 1)), recus = tous.filter(a => dans(a.cree_le, m));
          return { mois: m, note: st.note, nb_avis: st.nb_avis, avis_recus: recus.length, reponses: tous.filter(a => a.repondu_le && dans(a.repondu_le, m)).length,
            delai_moyen_h: moyenneH(recus.filter(a => a.repondu_le)), publications: publiees(c, m) }; });
        const periode = tous.filter(a => new Date(a.cree_le).getTime() >= debutMois(L[0])), repondus = periode.filter(a => a.repondu_le);
        // Comme en service : l'historique de la fiche est recalculé depuis les avis présents, les concurrents et le score n'ont que l'état du jour.
        const gd = liste("google_demo").filter(x => x.commerce_id === c.id), fiche = gd.find(x => x.type === "fiche"), m1 = mois0();
        const conc = liste("concurrents").filter(x => x.commerce_id === c.id).sort((a, b) => a.ordre - b.ordre).map(x => { const g = gd.find(y => y.type === "concurrent" && y.place_id === x.place_id);
          return { nom: (g && g.nom) || x.nom, mois: [{ mois: m1, note: g ? g.note : null, nb_avis: g ? g.nb_avis : null }] }; });
        const th = themesDemo(c);
        const lue = mois.some(m => m.note != null);
        // « Ce que votre fiche vous a rapporté » (01/11/2026, tour 8) : chiffres FICTIFS, au format de la lecture à la demande (fusionner de
        // moteur/resultats/lecture_google.js : mois précédent complet, puis mois en cours au prorata des jours écoulés, heure de Paris).
        const pj = partiesParis(maintenant), jours = new Date(Date.UTC(pj.a, pj.m + 1, 0)).getUTCDate(), f = pj.j / jours;
        const performance = fiche ? [[moisDecale(-1), 1], [m1, f]].map(([mo, k]) => ({ mois: mo, appels: Math.round(PERF_DEMO.appels * k), itineraires: Math.round(PERF_DEMO.itineraires * k),
          clics_site: Math.round(PERF_DEMO.clics_site * k), vues: Math.round(PERF_DEMO.vues * k), demo: true })) : [];
        return { mois, reponses: { taux: periode.length ? Math.round(repondus.length / periode.length * 100) : null, delai_moyen_h: moyenneH(repondus) },
          audit: fiche ? [{ mois: m1, score: fiche.piliers.reduce((s, x) => s + x.note, 0), piliers: fiche.piliers }] : [], concurrents: conc, themes: th.themes,
          collecte: mesureCollecte(c), portee: null, performance,
          lecture_google: { le: iso(maintenant), statut: "ok", fiche: lue ? "lue" : "non_reliee", concurrents: conc.length ? "lus" : "aucun", score: fiche ? "calcule" : "non_reliee", historique_reconstitue: lue && n > 1,
            themes: th.statut, themes_avis: th.analyses, performance: fiche ? "lue" : "non_reliee", demo: true } };
      },
      // Taux de réponse depuis le début du service (lot 2) : début = accès remis (garantie des délais) du commerce, sinon celui du commerce principal
      // de la démonstration (les comptes par offre en sont des copies, mêmes avis).
      async tauxReponse() {
        await init(); const c = cur(); assurerDelaisDemo(); const G = liste("garantie_delais"), g = G.find(x => x.commerce_id === c.id) || G.find(x => x.commerce_id === principalDemo());
        return tauxReponseDe(avisTous(c), g ? g.acces_remis_le : null, Date.now());
      },
      async bilanMois(mois) {   // mois : « AAAA-MM-01 » (01/11/2026 : bilan du mois écoulé), sinon le mois en cours
        await init(); const c = cur(), m = mois || mois0(), debut = etatAvis(c, debutMois(m)), fin = etatAvis(c, Date.now() + 1);
        return { mois: m, reponses_publiees: avisTous(c).filter(a => a.repondu_le && dans(a.repondu_le, m)).length, publications: publiees(c, m), note_debut: debut.note, note_fin: fin.note,
          avis_obtenus: avisTous(c).filter(a => dans(a.cree_le, m)).length, a_valider: aValiderBilan(c) };
      },
      async modifierLegende(id, reseau, texte) {
        await init(); const ct = mine("contenus").find(x => x.id === id); if (!ct) throw new Error("Contenu introuvable.");
        if (!["a_valider", "approuve"].includes(ct.statut)) throw new Error("Seul un contenu à valider ou approuvé se modifie.");
        if (!reseauxPour(ct).includes(reseau)) throw new Error("Ce format ne se publie pas sur la fiche Google.");
        const t = controlerLegende(reseau, texte); controlerMentionIA(ct, t, cur().langue); ct.legendes = Object.assign({}, ct.legendes || {}, { [reseau]: t });
        jour(cur().id, "LEGENDE_MODIFIEE", { contenu: id, reseau }); sauver();
      },
      async programmerAuto(id, reseaux, lot) {
        await init(); const c = cur(); pasEnPause(c); const ct = mine("contenus").find(x => x.id === id);
        if (!ct || ct.statut !== "approuve") throw new Error(REGLES.programme);
        reseaux = (reseaux || []).filter(r => RESEAUX.includes(r)); if (!reseaux.length) throw new Error("Choisissez où publier.");
        for (const r of reseaux) { horsOffre(c, r); if ((E.comptes[c.id][r] || {}).etat !== "connecte") throw new Error("Réseau non connecté : " + r + "."); if (!reseauxPour(ct).includes(r)) throw new Error(ct.type === "video" ? "Une vidéo part sur Instagram et TikTok seulement : ni sur Facebook, ni sur la fiche Google." : "Une vidéo ou une story ne se programme pas sur la fiche Google."); }
        const pris = mine("publications").filter(p => ["programme", "envoye", "publie"].includes(p.statut)).map(p => new Date(p.prevu_le).getTime());
        // Lot (« Programmer tout ») : au plus tôt le jour jourLot(rang, nombre), comme programmer_auto_lot en service.
        if (lot && duJour(ct)) lot = null;   // story ou contenu du jour : premier créneau libre, comme programmer_auto_lot (bloc « Tour 8 »)
        let des = null; if (lot) { const auj = FMT_JOUR_PARIS.format(new Date()), j = jourLot(lot.rang, lot.nombre, ESPACEMENT[c.offre_id] || 1, auj); if (j > auj) des = instantParis(+j.slice(0, 4), +j.slice(5, 7) - 1, +j.slice(8, 10), 0, 0); }
        const t = iso(creneauPour(c, pris, ct, des || undefined));
        E.publications.push({ id: uid(), commerce_id: c.id, contenu_id: id, reseaux, prevu_le: t, statut: "programme", auto: true, cree_le: iso(Date.now()) });
        ct.statut = "programme"; jour(c.id, "PROGRAMME", { contenu: id, reseaux, auto: true }); sauver(); return t;
      },
      async actionsFiche() { await init(); return mine("actions_fiche").sort((a, b) => b.cree_le.localeCompare(a.cree_le)); },
      async creerActionFiche(type, donnees) {
        await init(); const c = cur(); pasEnPause(c); const d = controlerAction(type, donnees);
        if (type === "photos" && d.photos.some(id => !mine("photos").some(p => p.id === id))) throw new Error("Photo introuvable.");
        const a = { id: uid(), commerce_id: c.id, type, donnees: d, statut: "a_valider", cree_le: iso(Date.now()), publie_le: null, par_commerce: true }; liste("actions_fiche").unshift(a);
        jour(c.id, "ACTION_FICHE", { type }); sauver(); return a.id;
      },
      async validerActionFiche(id, decision) {
        await init(); const a = mine("actions_fiche").find(x => x.id === id); if (!a) throw new Error("Action introuvable.");
        if (a.statut !== "a_valider") throw new Error("Cette action est déjà traitée."); if (!["approuve", "refuse"].includes(decision)) throw new Error("Décision refusée.");
        a.statut = decision === "approuve" ? "a_publier" : "refuse"; jour(cur().id, decision === "approuve" ? "ACTION_FICHE_VALIDEE" : "ACTION_FICHE_REFUSEE", { type: a.type }); sauver();
      },
      async enregistrerDemarrage(rep) { await init(); const c = cur(); if (!whatsappActifDe(c)) throw new Error(PHRASE_WA_MANQUANT); c.demarrage = controlerDemarrage(rep); c.demarrage_fini = true; jour(c.id, "DEMARRAGE", {}); sauver(); },
      // ---- publiques (pages avis.html et valider.html)
      async compterCollecte(jeton, type, canal) {
        await init(); const c = parJeton(String(jeton || "")); if (!c || !TYPES_COLLECTE.includes(type)) return;
        if (canal && canal.source === "email") return compterEmailDemo(c, type, canal.envoi);
        const l = lireCollecte(); if (l.filter(x => x.commerce_id === c.id && Date.now() - new Date(x.cree_le).getTime() < MS_H).length >= 300) return;   // limite de fréquence
        l.push({ commerce_id: c.id, type, cree_le: iso(Date.now()) }); collecteMem = l; try { localStorage.setItem(KC, JSON.stringify(l)); } catch (e) {}
      },
      async objetParJeton(jeton) {
        await init(); const r = lireJeton(jeton); if (r.etat === "inconnu") return null;
        if (r.etat !== "a_valider") return { etat: r.etat, objet: r.j.objet, langue: (E.commerces[r.j.commerce_id] || {}).langue || "fr" };
        const { o, c, j } = r, base = { etat: "a_valider", objet: j.objet, commerce: c.nom, expire_le: j.expire_le, langue: c.langue || "fr" };
        if (j.objet === "commentaire") return { ...base, reseau: o.reseau, categorie: o.categorie, texte: o.texte || "", auteur: o.auteur || "", reponse_proposee: o.reponse_proposee || "", recu_le: o.cree_le };
        return j.objet === "contenu" ? { ...base, type: o.type, format: formatDe(o), legende: o.legende || "", legendes: o.legendes || null, visuel_url: o.visuel_url || null,
            visuel_9x16_url: photoPublication(o) ? o.visuel_9x16_url || null : null, video_url: o.video_url || null, ia: estIA(o), reseaux: reseauxAutorises(c),
            connectes: RESEAUX.filter(r => ((E.comptes[c.id] || {})[r] || {}).etat === "connecte"),
            tiktok_demande_le: liste("alertes_exploitant").filter(a => a.commerce_id === c.id && a.type === "RAPPEL_DEMANDE" && (a.detail || {}).sujet === "reseaux").map(a => a.cree_le).sort().pop() || null }
          : { ...base, note: o.note, texte: o.texte || "", auteur: o.auteur || "", reponse_proposee: o.reponse_proposee || "" };
      },
      async validerParJeton(jeton, decision, texte) {
        await init(); const r = lireJeton(jeton);
        if (r.etat === "inconnu") throw new Error("Ce lien n'est pas reconnu."); if (r.etat === "utilise") throw new Error("Ce lien a déjà servi.");
        if (r.etat === "expire") throw new Error("Ce lien a expiré."); if (r.etat === "traite") throw new Error("Cet élément a déjà été traité dans votre espace.");
        const { o, j } = r; let prog = null;
        if (j.objet === "contenu") {
          if (!["approuve", "modification", "refuse"].includes(decision)) throw new Error("Décision refusée.");
          if (decision === "modification" && !String(texte || "").trim()) throw new Error("Écrivez un mot pour dire ce qu'il faut modifier.");
          o.statut = decision; o.note_modification = decision === "modification" ? String(texte).trim() : null; o.decide_le = iso(Date.now());
        } else if (j.objet === "commentaire") {
          appliquerDecisionCommentaire(o, decision, texte);
        } else {
          if (!["valide", "refuse"].includes(decision)) throw new Error("Décision refusée.");
          if (decision === "valide") { const t = String(texte ?? o.reponse_proposee ?? "").trim(); if (!t) throw new Error("Réponse vide."); o.reponse_proposee = t; }
          o.statut = decision;
        }
        j.utilise_le = iso(Date.now()); jour(j.commerce_id, ({ contenu: "CONTENU_", commentaire: "COMMENTAIRE_" }[j.objet] || "AVIS_") + decision.toUpperCase(), { par_lien: true });
        if (j.objet === "contenu" && decision === "approuve") prog = programmerALApprobation(o);
        sauver();
        // Même réponse que valider_par_jeton : la date et les réseaux programmés (null si rien n'est parti).
        return { objet: j.objet, id: o.id, statut: decision, prevu_le: prog ? prog.prevu_le : null, reseaux: prog ? prog.reseaux : null };
      },
    };

    // =========================================================== Automatisations de service (démonstration)
    const HEURE = 3600000, JOUR_MS = 86400000;
    const jourIso = t => { const p = partiesParis(t); return `${p.a}-${String(p.m + 1).padStart(2, "0")}-${String(p.j).padStart(2, "0")}`; };
    const ecartJours = (a, b) => Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / JOUR_MS);
    const plusJours = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * JOUR_MS).toISOString().slice(0, 10);
    const a9h = d => { const [a, m, j] = d.split("-").map(Number); return instantParis(a, m - 1, j, 9, 0); };
    const nouvelleDemande = (cid, cl, etape, t) => ({ id: uid(), commerce_id: cid, client_id: cl.id, email: cl.email, prenom: cl.prenom, etape, prevu_le: iso(t), statut: "a_envoyer", motif: null,
      jeton: nouveauJeton(), envoye_le: null, ouvert_le: null, clic_le: null, cree_le: iso(Date.now()) });
    const ORDRE_POINTS = AUTO.POINTS.map(x => x.point);
    const tableMR = () => (E.mise_en_route = E.mise_en_route && !Array.isArray(E.mise_en_route) ? E.mise_en_route : {});   // {commerce: {point: état}}
    // Même logique que les déclencheurs SQL (blocs « Automatisations de service » et « Mise en route selon l'offre ») : Google connecté, un réseau
    // social connecté (Facebook, Instagram ou TikTok : étape « metricool »), démarrage fini. Étape « metricool » seulement si l'offre comprend les
    // réseaux sociaux (26/10/2026 : la démonstration l'affichait aussi à l'Essentiel, « 2 sur 4 » au lieu de « 2 sur 3 »).
    function etatMiseEnRoute(cid) {
      const m = tableMR(), k = E.comptes[cid] || {}, c = E.commerces[cid] || {}, co = r => (k[r] || {}).etat === "connecte";
      const e = (m[cid] = m[cid] || { compte: "a_faire", google: "a_faire", metricool: "a_faire", demarrage: "a_faire" });
      if (co("google")) e.google = "fait"; if (co("facebook") || co("instagram") || co("tiktok")) e.metricool = "fait"; if (c.demarrage_fini) e.demarrage = "fait";
      // Lien de connexion aux réseaux envoyé par l'équipe (27/10/2026, colonne mise_en_route.lien_envoye_le de la base) : E.liens_reseaux[commerce].
      const liens = E.liens_reseaux || {};
      // Date du dernier changement d'état (colonne mise_en_route.maj de la base, 11/11/2026 : « Fait le … », « Déclaré par le client le … » dans la
      // console). Un état trouvé sans historique (graine) n'a pas de date inventée : la console écrit alors « Fait », sans date.
      const dm = (E.mer_maj = E.mer_maj || {})[cid] = (E.mer_maj[cid] || {});
      AUTO.pointsOffre(c.offre_id).forEach(point => { const et = e[point] || "a_faire"; if (!dm[point]) dm[point] = { etat: et, maj: null }; else if (dm[point].etat !== et) dm[point] = { etat: et, maj: new Date().toISOString() }; });
      const points = AUTO.pointsOffre(c.offre_id).map(point => Object.assign({ point, etat: e[point] || "a_faire" }, dm[point].maj ? { maj: dm[point].maj } : {}, point === "metricool" ? { lien_envoye_le: liens[cid] || null } : {}));
      return { faits: points.filter(x => x.etat === "fait").length, total: points.length, points };
    }
    function santeDemo(c) {
      const now = Date.now(), age = ecartJours(aujourdhui(), jourIso(Date.parse(c.cree_le || iso(now)))), rouge = [], orange = [];
      const ph = E.photos.filter(x => x.commerce_id === c.id).map(x => Date.parse(x.cree_le)), derniere = ph.length ? Math.max(...ph) : -Infinity;
      const dc = E.contenus.filter(x => x.commerce_id === c.id && x.decide_le).map(x => Date.parse(x.decide_le)), decision = dc.length ? Math.max(...dc) : -Infinity;
      // Console, garantie des 24 h (26/10/2026, bloc « Console : garantie des 24 h tenue à deux » de schema.sql) : un avis sensible sans réponse
      // PUBLIÉE (proposée ne suffit pas) met le client en orange dès son arrivée, en rouge à 20 h (échéance moins le délai d'alerte de 4 h).
      const graves = E.avis.filter(a => a.commerce_id === c.id && a.sensible && !["publie", "refuse"].includes(a.statut)), GDs = CONDITIONS.garantie_delais;
      let n = graves.length;
      if (n) { const plusAncien = Math.min(...graves.map(a => Date.parse(a.cree_le))), h = Math.max(0, Math.floor((now - plusAncien) / HEURE)), d = GDs.avis_traite_heures;
        const r = n > 1 ? `${n} avis graves sans réponse publiée, le plus ancien depuis ${h} h, échéance ${d} h` : `avis grave sans réponse publiée depuis ${h} h, échéance ${d} h`;
        (now - plusAncien >= (d - GDs.alerte_avis_avant_heures) * HEURE ? rouge : orange).push(r); }
      const inactif = age > 14 && derniere < now - 14 * JOUR_MS && decision < now - 14 * JOUR_MS; if (inactif) rouge.push("rien déposé ni validé depuis 14 jours");
      n = E.publications.filter(p => p.commerce_id === c.id && p.statut === "echec" && Date.parse(p.prevu_le) > now - 14 * JOUR_MS).length;
      if (n) rouge.push(`${n} ${n > 1 ? "publications en échec" : "publication en échec"}`);
      const mr = etatMiseEnRoute(c.id), reste = mr.total - mr.faits;
      if (reste && age >= 5) rouge.push(`mise en route pas finie après ${age} jours (${mr.faits} sur ${mr.total})`); else if (reste) orange.push(`mise en route en cours (${mr.faits} sur ${mr.total})`);
      if (c.en_pause) orange.push("en pause");
      if (age > 10 && !inactif && derniere < now - 10 * JOUR_MS) orange.push("aucune photo depuis 10 jours");
      n = E.contenus.filter(x => x.commerce_id === c.id && x.statut === "a_valider" && now - Date.parse(x.cree_le) > 48 * HEURE).length
        + E.avis.filter(a => a.commerce_id === c.id && a.statut === "a_valider" && !a.sensible && now - Date.parse(a.cree_le) > 48 * HEURE).length
        + liste("commentaires").filter(x => x.commerce_id === c.id && x.statut === "a_valider" && now - Date.parse(x.cree_le) > 48 * HEURE).length;
      if (n) orange.push(`${n} ${n > 1 ? "éléments attendent" : "élément attend"} une validation depuis plus de 48 h`);
      if (usage(c) >= OFFRES[c.offre_id].publications) orange.push("plafond de publications atteint ce mois-ci");
      n = RESEAUX.filter(r => ((E.comptes[c.id] || {})[r] || {}).etat === "erreur").length; if (n) orange.push(`${n} ${n > 1 ? "réseaux en erreur" : "réseau en erreur"}`);
      const cm = liste("commentaires").filter(x => x.commerce_id === c.id);
      n = cm.filter(x => x.categorie === "sensible" && x.statut === "humain" && now - Date.parse(x.cree_le) > 48 * HEURE).length; if (n) orange.push(`${n} ${n > 1 ? "commentaires sensibles attendent" : "commentaire sensible attend"} le commerçant depuis plus de 48 h`);

      return { commerce_id: c.id, nom: c.nom, niveau: rouge.length ? "rouge" : orange.length ? "orange" : "vert", raisons: [...rouge, ...orange], mise_en_route: mr };
    }
    function compterEmailDemo(c, type, envoi) {
      const d = liste("demandes_avis").find(x => x.jeton === envoi && x.commerce_id === c.id && x.statut === "envoye"); if (!d) return;
      const l = lireCollecte(); if (l.filter(x => x.commerce_id === c.id && Date.now() - new Date(x.cree_le).getTime() < HEURE).length >= 300) return;
      l.push({ commerce_id: c.id, type, source: "email", cree_le: iso(Date.now()) }); collecteMem = l; try { localStorage.setItem(KC, JSON.stringify(l)); } catch (e) {}
      d.ouvert_le = d.ouvert_le || iso(Date.now()); if (type === "clic_google") d.clic_le = d.clic_le || iso(Date.now()); sauver();
    }
    // Graine : clients, demandes, mise en route, idée de la semaine, prospects, alertes. Tout est fictif et marqué « demo ».
    function completerAutomatisations(G, maintenant, principal) {
      if (G.automatisations_v) return; G.automatisations_v = 1; E = G;
      ["clients_commerce", "demandes_avis", "oppositions", "prospects", "alertes_exploitant"].forEach(liste);
      Object.values(G.commerces).forEach(c => {
        if (c.cree_il_y_a_h != null) { c.cree_le = iso(maintenant - c.cree_il_y_a_h * HEURE); delete c.cree_il_y_a_h; }
        if (!c.cree_le) c.cree_le = iso(maintenant - (principal && c.id === principal.id ? 120 : 30) * 24 * HEURE);
        etatMiseEnRoute(c.id); if (principal && c.id === principal.id) { tableMR()[c.id].compte = "fait"; if (E.mer_maj) delete E.mer_maj[c.id]; }   // graine : pas de date inventée
      });
      G.contenus.forEach(x => { if (x.statut !== "a_valider" && !x.decide_le) x.decide_le = iso(new Date(x.cree_le).getTime() + 3 * HEURE); });
      if (!principal) return;
      // Clients importés il y a 1 à 16 jours, avec leurs demandes, comme si le service du jour était passé chaque matin.
      if (!G.clients_commerce.some(x => x.commerce_id === principal.id)) {
        const P = ["Camille", "Hugo", "Inès", "Léo", "Manon", "Nathan", "Chloé", "Louis", "Emma", "Jules", "Sarah", "Tom", "Lina", "Adam"], auj = jourIso(maintenant), ev = liste("collecte_evenements");
        P.forEach((prenom, i) => {
          const passage = plusJours(auj, -(1 + i)), cl = { id: "cl-" + i, commerce_id: principal.id, prenom, email: prenom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() + "." + (i + 1) + "@client-exemple.invalid",
            date_passage: passage, consentement: true, importe_le: iso(a9h(passage) - 2 * HEURE), demo: true };
          G.clients_commerce.push(cl);
          const d = Object.assign(nouvelleDemande(principal.id, cl, "demande", a9h(plusJours(passage, 1))), { demo: true }), r = Object.assign(nouvelleDemande(principal.id, cl, "relance", a9h(plusJours(passage, 5))), { demo: true });
          if (Date.parse(d.prevu_le) <= maintenant) {
            d.statut = "envoye"; d.envoye_le = iso(Date.parse(d.prevu_le) + 5 * 60000);
            if (i % 3 !== 2) { d.ouvert_le = iso(Date.parse(d.envoye_le) + (2 + i % 4) * HEURE); ev.push({ commerce_id: principal.id, type: "passage", source: "email", cree_le: d.ouvert_le, demo: true }); }
            if (i % 3 === 0) { d.clic_le = iso(Date.parse(d.ouvert_le) + 60000); ev.push({ commerce_id: principal.id, type: "clic_google", source: "email", cree_le: d.clic_le, demo: true }); }
            if (prenom === "Tom") { G.oppositions.push({ commerce_id: principal.id, email: cl.email, motif: "lien_email", cree_le: iso(Date.parse(d.envoye_le) + HEURE), demo: true }); r.statut = "annule"; r.motif = "désinscription"; }
            else if (Date.parse(r.prevu_le) <= maintenant) {
              if (d.ouvert_le) { r.statut = "annule"; r.motif = "page d'avis déjà ouverte"; }
              else { r.statut = "envoye"; r.envoye_le = iso(Date.parse(r.prevu_le) + 5 * 60000); if (i % 2) { r.ouvert_le = iso(Date.parse(r.envoye_le) + 3 * HEURE); ev.push({ commerce_id: principal.id, type: "passage", source: "email", cree_le: r.ouvert_le, demo: true }); } }
            }
          }
          G.demandes_avis.push(d, r);
        });
      }
      // Console : prospects de la page de vente et alertes de l'exploitant (fictifs) si la graine n'en donne pas
      if (!G.prospects.length) G.prospects.push(
        { id: "pr-1", email: "contact@boulangerie-exemple.invalid", commerce: "Boulangerie d'exemple", ville: "", metier: "autre", audit_il_y_a_h: 40, rapport_envoye_il_y_a_h: 40, relances: 0, demo: true },
        { id: "pr-2", email: "bonjour@coiffure-exemple.invalid", commerce: "Coiffure d'exemple", ville: "", metier: "beaute", audit_il_y_a_h: 150, rapport_envoye_il_y_a_h: 150, relances: 2, derniere_relance_il_y_a_h: 30, demo: true },
        { id: "pr-3", email: "studio@sport-exemple.invalid", commerce: "Studio d'exemple", ville: "", metier: "sport", audit_il_y_a_h: 80, rapport_envoye_il_y_a_h: 80, relances: 1, rdv_il_y_a_h: 20, demo: true },
        { id: "pr-4", email: "fleurs@fleuriste-exemple.invalid", commerce: "Fleuriste d'exemple", ville: "", metier: "autre", audit_il_y_a_h: 30, rapport_envoye_il_y_a_h: null, relances: 0, demo: true });
      // Tournée du jour (fictifs) : sans adresse email, identifiés par SIRET ; le lien « résultat » de démonstration a un jeton fixe (64 caractères).
      if (!G.prospects.some(x => x.origine === "tournee")) G.prospects.push(
        { id: "pr-t1", origine: "tournee", email: null, commerce: "RESTAURANT D'EXEMPLE", ville: "VILLEURBANNE", code_postal: "69100", siren: "812000001", siret: "81200000100011", canal: "visite",
          resultat: "propose", audit_il_y_a_h: 6, propose_il_y_a_h: 6, relances: 0, jeton_tournee: "d".repeat(64), place_id: "ChIJexempleTournee1", demo: true },
        { id: "pr-t2", origine: "tournee", email: null, commerce: "BRASSERIE D'EXEMPLE", ville: "VILLEURBANNE", code_postal: "69100", siren: "812000002", siret: "81200000200011", canal: "appel",
          resultat: "rappeler", audit_il_y_a_h: 76, propose_il_y_a_h: 76, resultat_il_y_a_h: 50, relances: 1, derniere_relance_il_y_a_h: 4, note_pj: "Rappeler après 15 h", jeton_tournee: "e".repeat(64), demo: true });
      G.prospects.forEach(x => { [["audit", "audit_le"], ["rapport_envoye", "rapport_envoye_le"], ["rdv", "rdv_le"], ["repondu", "repondu_le"], ["desinscrit", "desinscrit_le"], ["derniere_relance", "derniere_relance_le"],
        ["propose", "propose_le"], ["resultat", "resultat_le"]].forEach(([k, c]) => {
        const h = x[k + "_il_y_a_h"]; if (h !== undefined) { x[c] = h == null ? null : iso(maintenant - h * HEURE); delete x[k + "_il_y_a_h"]; } }); x.jeton = x.jeton || nouveauJeton(); });
      if (!G.alertes_exploitant.length) G.alertes_exploitant.push(
        { id: "al-1", type: "MISE_EN_ROUTE_BLOQUEE", commerce_id: null, detail: { jours: 6, restants: [{ point: "google", etat: "a_faire" }, { point: "metricool", etat: "a_faire" }] }, cree_le: iso(maintenant - 20 * HEURE), demo: true },
        { id: "al-2", type: "ERREUR_WORKFLOW", commerce_id: null, detail: { workflow: "BoostImpact, service du jour", noeud: "Envoyer", message: "Exemple de démonstration : connexion au serveur d'envoi refusée." }, cree_le: iso(maintenant - 70 * HEURE), demo: true });
    }
    // Idée de la semaine du commerce principal : calculée par le même code que le workflow du lundi (calendrier versionné), sans météo
    // (option désactivée par défaut). Une par semaine : une démonstration ouverte la semaine suivante reçoit la nouvelle.
    // Démonstration (01/11/2026, tour 7 Premium) : des publications parties le mois écoulé (le bilan d'octobre en montrait 0), et les publications
    // programmées du mois en cours étalées sur le mois (même pas que « Programmer tout », jourLot), une seule fois par état.
    // Tour 8 (01/11/2026) : plus 15 fois le même contenu. Autant de publications que l'offre en compte (Essentiel 2, Croissance 8, Premium 12),
    // chacune avec SON contenu (visuel du commerce et légende propre, rangés « publiés » au mois écoulé), sur les réseaux de l'offre où ce format
    // part. Le bilan d'octobre (bilanMois) et le temps gagné les comptent tels quels. Un état écrit en v32 (15 copies) est repris.
    const LEGENDES_MOIS = { "spaghetti": ["Pâtes fraîches roulées le matin même, herbes et sauce crémeuse : le classique de la maison.", "Nos pâtes fraîches reviennent à la carte cette semaine. Une assiette simple, préparée sur place.", "Des pâtes fraîches pour finir la semaine en douceur, avec la sauce du moment."],
      "bol-sauce": ["Le plat du soir mijote depuis l'après-midi : servi bien chaud, dans une assiette creuse.", "Cuisson lente et sauce maison : le plat du soir a pris son temps, comme il se doit.", "Ce soir, un plat de saison qui réchauffe. À partager, ou pas."],
      "entree-marbre": ["L'entrée du jour, dressée à la minute sur notre table de marbre.", "Des produits du marché, une assiette légère : l'entrée du jour ouvre le repas.", "Nouvelle entrée cette semaine, préparée avec les légumes de saison."],
      "avis-semaine": ["Merci pour vos avis : ils font plaisir à toute l'équipe.", "Vos mots comptent : merci à celles et ceux qui prennent le temps d'écrire.", "Un avis cinq étoiles cette semaine. Merci, nous continuons."] };
    function moisDemoPour(c, etale) {
      const m1 = moisDecale(-1), t0 = debutMois(m1), t1 = finMois(m1), auj = FMT_JOUR_PARIS.format(new Date());
      const pubs = E.publications.filter(p => p.commerce_id === c.id), parties = pubs.filter(p => p.statut === "publie" && Date.parse(p.prevu_le) >= t0 && Date.parse(p.prevu_le) < t1).length;
      const cts = E.contenus.filter(x => x.commerce_id === c.id && x.type === "publication" && formatDe(x) === "publication" && x.visuel_url); if (!cts.length || !pubs.some(p => p.statut === "publie")) return;   // commerce déjà en service seulement (jamais un commerce en mise en route)
      const visuels = [...new Map(cts.map(x => [x.visuel_url, x])).values()], res = reseauxAutorises(c).filter(r => RESEAUX.includes(r) && ((((E.comptes || {})[c.id] || {})[r] || {}).etat === "connecte"));   // réseaux connectés seulement
      if (!res.length) return;
      const heures = CRENEAUX[c.metier] || CRENEAUX.autre, nb = Math.max(0, (+(OFFRES[c.offre_id] || {}).publications || 0) - parties), jours = Math.round((t1 - t0) / 864e5);
      for (let i = 0; i < nb; i++) {
        const src = visuels[i % visuels.length], cle = (/\/([a-z-]+)-visuel-4x5\.jpg$/.exec(src.visuel_url) || [])[1], l = LEGENDES_MOIS[cle], k = Math.floor(i / visuels.length);
        const legende = l ? l[k % l.length] : src.legende, mo = momentLegende(legende);
        const d = new Date(t0 + Math.floor((i + 0.5) * jours / nb) * 864e5), hm = mo === "midi" ? heures[0] : mo === "soir" ? heures[heures.length - 1] : heures[i % heures.length], [h, mi] = hm.split(":").map(Number);
        const t = instantParis(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, mi), id = "demo-mois-" + c.id + "-" + i;
        E.contenus.push({ id, commerce_id: c.id, photo_id: src.photo_id || null, type: "publication", format: "publication", legende, legendes: Object.fromEntries(res.map(r => [r, legende])), visuel_url: src.visuel_url,
        visuel_9x16_url: src.visuel_9x16_url || null, note_modification: null, statut: "publie", mois: m1, cree_le: iso(t - 2 * 864e5), decide_le: iso(t - 864e5), demo: true });
        E.publications.push({ id: uid(), commerce_id: c.id, contenu_id: id, reseaux: res, prevu_le: iso(t), publie_le: iso(t), statut: "publie", auto: true, cree_le: iso(t - 864e5), demo: true, demo_mois: true });
      }
      const aVenir = pubs.filter(p => p.statut === "programme" && Date.parse(p.prevu_le) > Date.now()).sort((a, b) => a.prevu_le.localeCompare(b.prevu_le));
      if (etale) aVenir.forEach((p, i) => { const j = jourLot(i, aVenir.length, ESPACEMENT[c.offre_id] || 1, auj), [h, mi] = heures[i % heures.length].split(":").map(Number);
        const t = instantParis(+j.slice(0, 4), +j.slice(5, 7) - 1, +j.slice(8, 10), h, mi); if (t > Date.now() + 2 * MS_H) p.prevu_le = iso(t); });
    }
    function assurerMoisDemo() {
      if (E.demo_mois_v33) return; E.demo_mois_v33 = true;
      const t0 = debutMois(moisDecale(-1)), t1 = finMois(moisDecale(-1));
      // État de la v32 : ses 15 copies (même contenu, publiées le jour même, créées la veille) sont retirées avant de refaire le mois.
      if (E.demo_mois_v32) E.publications = E.publications.filter(p => !(p.demo && p.auto && p.statut === "publie" && p.publie_le === p.prevu_le && p.cree_le === iso(Date.parse(p.prevu_le) - 864e5)
        && Date.parse(p.prevu_le) >= t0 && Date.parse(p.prevu_le) < t1));
      Object.values(E.commerces).forEach(c => moisDemoPour(c, !E.demo_mois_v32));
      E.demo_mois_v32 = true; sauver();
    }
    // Un compte par offre dans la graine publique (01/11/2026, tour 8) : essentiel@demo et croissance@demo (demo_maj.comptes_offres de
    // demo/etat-public.json) ouvrent une COPIE du commerce principal (La Table d'exemple) à l'offre dite ; premium@demo ouvre le commerce principal
    // (Premium). La copie est faite à la première connexion à ce compte (rien ne change pour les autres comptes ni pour la console avant), avec de
    // nouveaux identifiants et de nouveaux jetons, puis ramenée à ce que l'offre permet : Essentiel, ni vidéo ni story, la fiche Google seule ;
    // Croissance, pas de vidéo.
    // Lot 5 B (revue : « L'équipe de Le Bistrot d'exemple ») : « de » devant le nom copié suit l'élision du français (du, des, de l', d').
    function elisionDe(v, nom) {
      const m = /^(Les|Le|La)\s+(.+)$/.exec(nom), ap = /^L['’](.+)$/.exec(nom);
      const forme = m ? { Le: "du ", Les: "des ", La: "de la " }[m[1]] + m[2] : ap ? "de l'" + ap[1] : /^[AEIOUYÉÈÊÂÎaeiouyéèêâî]/.test(nom) ? "d'" + nom : "de " + nom;
      return v.split("de " + nom).join(forme).split("De " + nom).join(forme.charAt(0).toUpperCase() + forme.slice(1));
    }
    function assurerCompteOffre(email) {
      const def = (((E && E.demo_maj) || {}).comptes_offres || {})[email], src = def && E.commerces[E.demo_maj.principal];
      if (!def || !src || E.commerces[def.commerce] || !OFFRES[def.offre]) return;
      const id = def.commerce, suffixe = "-" + def.offre, ids = new Map([[src.id, id]]), tables = Object.keys(E).filter(k => Array.isArray(E[k]));
      tables.forEach(k => E[k].forEach(x => { if (x && x.commerce_id === src.id && x.id != null) ids.set(String(x.id), String(x.id) + suffixe); }));
      const copie = v => Array.isArray(v) ? v.map(copie) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, y]) => [k, k === "jeton" && typeof y === "string" ? nouveauJeton() : copie(y)]))
        : typeof v === "string" && ids.has(v) ? ids.get(v)
        // Lot 6 B (revue design : « La Table d'exemple » imprimé sur le visuel du Comptoir) : chaque commerce copié a ses visuels, à son nom
        // (demo/files/public/<photo>-visuel-<format>-<visuels>.jpg, rendus par le moteur ; demo_maj.comptes_offres.<compte>.visuels).
        : typeof v === "string" && def.visuels && /^demo\/files\/public\/[a-z-]+-visuel-(4x5|9x16)(-nl)?\.jpg$/.test(v) ? v.replace(/\.jpg$/, "-" + def.visuels + ".jpg")
        : typeof v === "string" && def.nom && src.nom && def.nom !== src.nom && v.includes(src.nom) ? elisionDe(v.split(src.nom).join(def.nom), def.nom) : v;   // lot 4 B : signatures au nom du commerce copié
      tables.forEach(k => { E[k].push(...E[k].filter(x => x && x.commerce_id === src.id).map(copie)); });
      // Lot 8 (Sophie, tour 6 : les mêmes clients dans les trois commerces de démonstration) : chaque copie a ses auteurs d'avis
      // (demo_maj.comptes_offres.<compte>.auteurs : « Prénom I. » d'origine -> nouveau), dans l'avis et dans la réponse (prénom seul).
      if (def.auteurs) (E.avis || []).filter(a => a.commerce_id === id).forEach(a => Object.entries(def.auteurs).filter(([de]) => a.auteur === de).forEach(([de, vers]) => {   // seulement l'avis de cet auteur
        const p0 = de.split(" ")[0], p1 = vers.split(" ")[0];
        // 16/11/2026 (contrôle sans contexte : « Hanne J. » recevait « Dank u, Sofie! ») : prénom seul remplacé comme mot entier, quelle que soit
        // la ponctuation qui suit (« Sofie! », « Sofie, », « Sofie ! »).
        const mot = new RegExp("(^|[^\\p{L}])" + p0.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\p{L}])", "gu");
        ["auteur", "texte", "reponse", "reponse_proposee"].forEach(k => { if (typeof a[k] === "string") a[k] = a[k].split(de).join(vers).replace(mot, (m, avant) => avant + p1); }); }));
      ["comptes", "bases"].forEach(k => { if (E[k] && E[k][src.id]) E[k][id] = copie(E[k][src.id]); });
      const c = E.commerces[id] = Object.assign(copie(src), { id, nom: def.nom || src.nom, offre_id: def.offre, delegation_signee_le: null });
      const o = OFFRES[def.offre], du = k => (E[k] || []).filter(x => x.commerce_id === id);
      const retirer = (k, f) => { if (Array.isArray(E[k])) E[k] = E[k].filter(x => !(x.commerce_id === id && f(x))); };
      const sansVideo = du("contenus").filter(x => x.type === "video" || (!o.reseaux_sociaux && formatDe(x) === "story")).map(x => x.id);
      retirer("contenus", x => sansVideo.includes(x.id)); retirer("publications", x => sansVideo.includes(x.contenu_id)); retirer("jetons_validation", x => sansVideo.includes(x.objet_id));
      if (!(+o.videos > 0)) { retirer("videos_avis_demandes", () => true); retirer("depots_video", () => true);
        // Lot 6 B (revue copywriter : « Vidéo d'avis créée » dans l'historique de l'Essentiel, qui n'a aucune vidéo) : lignes vidéo retirées aussi.
        retirer("journal", x => /^(VIDEO_|DEPOT_VIDEO|MONTAGE_)/.test(String(x.type || ""))); }
      if (!o.commentaires) retirer("commentaires", () => true);
      // Mois écoulé refait à la mesure de l'offre (moisDemoPour) : les copies des publications du mois du commerce principal sont retirées.
      retirer("publications", x => x.demo_mois); retirer("contenus", x => String(x.id).startsWith("demo-mois-"));
      if (!o.reseaux_sociaux) { c.reseaux_retenus = []; du("publications").forEach(p => { p.reseaux = ["google"]; }); du("contenus").forEach(x => { if (x.legendes) x.legendes = { google: x.legendes.google || x.legende }; }); }
      (E.abonnements || []).filter(a => a.commerce_id === id).forEach(a => { a.offre = def.offre; });
      E.users[email] = E.users[email] || { role: "commerçant", commerce: id };
      moisDemoPour(c, false); sauver();
    }
    function assurerIdeeSemaine() {
      if (!TF || !E) return; const pr = E.demo_maj ? E.commerces[E.demo_maj.principal] : (() => { const u = Object.values(E.users).find(x => x.commerce); return u && E.commerces[u.commerce]; })();
      if (!pr) return; const maintenant = Date.now(), lundi = lundiDeParis(new Date(maintenant));
      if (liste("idees").some(x => x.commerce_id === pr.id && x.semaine === lundi)) return;
      const x = ideeDeLaSemaine(TF, { ...pr, jours_ouverts: joursOuverts(pr.horaires) }, lundi, null, pr.ville);   // pas de férié un jour de fermeture
      E.idees.unshift({ id: "idee-semaine-" + lundi, commerce_id: pr.id, titre: x.titre, texte: x.texte, origine: x.origine, statut: "a_valider", semaine: lundi, motif: x.motif,
        cree_le: iso(Math.min(maintenant - HEURE, instantParis(+lundi.slice(0, 4), +lundi.slice(5, 7) - 1, +lundi.slice(8, 10), 7, 0))), demo: true });
      sauver();
    }
    function resultatDemo(p, resultat, note) {
      if (!p || p.origine !== "tournee") throw new Error("Prospect de la tournée introuvable.");
      if (!RESULTATS_TOURNEE.includes(resultat)) throw new Error("Résultat inconnu : pas intéressé, rappeler, rendez-vous ou pilote signé.");
      const n = String(note || "").trim(); if (n.length > 500) throw new Error("La note est trop longue (500 caractères au plus).");
      const maintenant = iso(Date.now());
      Object.assign(p, { resultat, resultat_le: maintenant });
      if (resultat === "rappeler") Object.assign(p, { relances: 0, derniere_relance_le: null });
      if (resultat === "rdv" || resultat === "pilote") p.rdv_le = p.rdv_le || maintenant;
      if (resultat === "pas_interesse") p.desinscrit_le = p.desinscrit_le || maintenant;
      if (n) p.note_pj = [p.note_pj, new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Europe/Paris" }) + " : " + n].filter(Boolean).join("\n").slice(0, 1000);
      sauver(); return { id: p.id, commerce: p.commerce, resultat };
    }
    const autoDemo = {
      async importerClients(lignes, consentement) {
        await init(); const c = cur(); pasEnPause(c);
        if (consentement !== true) throw new Error("Cochez la case qui confirme que chaque client de ce fichier a accepté de recevoir cette demande par email.");
        if (!lienAvisPublic(c)) throw new Error("Ajoutez d'abord votre lien d'avis Google dans votre fiche : la demande y renvoie.");
        if (!Array.isArray(lignes) || !lignes.length || lignes.length > AUTO.MAX_CLIENTS) throw new Error("Le fichier doit contenir de 1 à " + AUTO.MAX_CLIENTS + " clients.");
        const auj = aujourdhui(), D_ = liste("demandes_avis"), ign = []; let n = 0;
        lignes.forEach((x, k) => {
          const p = String((x && x.prenom) || "").trim(), em = String((x && x.email) || "").trim().toLowerCase(), d = String((x && x.date_passage) || "");
          const raison = !p || longueur(p) > 60 ? "prénom manquant ou trop long" : !emailValide(em) ? "adresse email invalide" : !dateValide(d) ? "date de passage invalide"
            : d > auj ? "date de passage dans le futur" : ecartJours(auj, d) > AUTO.PASSAGE_MAX_JOURS ? "passage de plus de 14 jours : la demande arriverait trop tard"
            : liste("oppositions").some(o => o.commerce_id === c.id && o.email === em) ? "cette personne a demandé à ne plus recevoir de demande"
            : D_.some(a => a.commerce_id === c.id && a.email === em && a.etape === "demande" && (["a_envoyer", "en_cours"].includes(a.statut) || (a.statut === "envoye" && Date.now() - Date.parse(a.envoye_le) < AUTO.ECART_JOURS * JOUR_MS)))
              ? "déjà sollicitée il y a moins de 90 jours" : null;
          if (raison) { ign.push({ ligne: k + 1, raison }); return; }
          const cl = { id: uid(), commerce_id: c.id, prenom: p, email: em, date_passage: d, consentement: true, importe_le: iso(Date.now()) }; liste("clients_commerce").push(cl);
          const t1 = Math.max(a9h(plusJours(d, 1)), Date.now()), t2 = Math.max(a9h(plusJours(d, 5)), a9h(plusJours(jourIso(t1), 4)));
          D_.push(nouvelleDemande(c.id, cl, "demande", t1), nouvelleDemande(c.id, cl, "relance", t2)); n++;
        });
        jour(c.id, "CLIENTS_IMPORTES", { importes: n, ignores: ign.length }); sauver(); return { importes: n, ignores: ign };
      },
      async demandesAvis() {
        await init(); const c = cur(), t0 = Date.now() - 30 * JOUR_MS, l = liste("demandes_avis").filter(x => x.commerce_id === c.id), dans30 = x => x.envoye_le && Date.parse(x.envoye_le) >= t0;
        const ev = [...liste("collecte_evenements"), ...lireCollecte()].filter(x => x.commerce_id === c.id && x.source === "email" && Date.parse(x.cree_le) >= t0);
        return { periode_jours: 30, clients: liste("clients_commerce").filter(x => x.commerce_id === c.id).length, a_venir: l.filter(x => ["a_envoyer", "en_cours"].includes(x.statut)).length,
          envois: l.filter(x => x.etape === "demande" && x.statut === "envoye" && dans30(x)).length, relances: l.filter(x => x.etape === "relance" && x.statut === "envoye" && dans30(x)).length,
          ouvertures: ev.filter(x => x.type === "passage").length, clics_google: ev.filter(x => x.type === "clic_google").length, oppositions: liste("oppositions").filter(x => x.commerce_id === c.id).length,
          dernieres: l.slice().sort((a, b) => b.prevu_le.localeCompare(a.prevu_le)).slice(0, 20).map(x => ({ prenom: x.prenom, etape: x.etape, statut: x.statut, motif: x.motif, prevu_le: x.prevu_le, envoye_le: x.envoye_le, ouverte: !!(x.ouvert_le || x.clic_le) })) };
      },
      async ajouterOpposition(email) {
        await init(); const c = cur(), em = String(email || "").trim().toLowerCase(); if (!emailValide(em)) throw new Error("Adresse email invalide.");
        if (!liste("oppositions").some(o => o.commerce_id === c.id && o.email === em)) E.oppositions.push({ commerce_id: c.id, email: em, motif: "commercant", cree_le: iso(Date.now()) });
        liste("demandes_avis").forEach(x => { if (x.commerce_id === c.id && x.email === em && x.statut === "a_envoyer") { x.statut = "annule"; x.motif = "opposition"; } });
        jour(c.id, "OPPOSITION_AJOUTEE", {}); sauver();
      },
      async miseEnRoute() { await init(); const c = cur(); etatMiseEnRoute(c.id); tableMR()[c.id].compte = "fait"; sauver(); return etatMiseEnRoute(c.id); },
      async declarerMiseEnRoute(point) {
        await init(); const c = cur(); if (!["google", "metricool"].includes(point)) throw new Error("Seuls l'accès Google et la connexion Metricool se déclarent ici.");
        etatMiseEnRoute(c.id); const e = tableMR()[c.id]; if (e[point] === "a_faire") e[point] = "declare"; jour(c.id, "MISE_EN_ROUTE_DECLAREE", { point }); sauver(); return etatMiseEnRoute(c.id);
      },
      async deciderIdee(id, decision) {
        await init(); const x = mine("idees").find(i => i.id === id); if (!x) throw new Error("Idée introuvable.");
        if (x.statut !== "a_valider") throw new Error("Cette idée est déjà traitée."); if (!["retenue", "ecartee"].includes(decision)) throw new Error("Décision inconnue : retenir ou écarter.");
        x.statut = decision; jour(cur().id, "IDEE_" + decision.toUpperCase(), { idee: id }); sauver();
      },
      // ---- publiques (desinscription.html)
      async desinscriptionInfo(jeton) {
        await init(); const j = String(jeton || ""), d = liste("demandes_avis").find(x => x.jeton === j);
        if (d) return { objet: "demande_avis", emetteur: (E.commerces[d.commerce_id] || {}).nom, langue: (E.commerces[d.commerce_id] || {}).langue || "fr", fait: liste("oppositions").some(o => o.commerce_id === d.commerce_id && o.email === d.email) };
        const p = liste("prospects").find(x => x.jeton === j); if (p) return { objet: "prospect", emetteur: "BoostImpact", fait: !!p.desinscrit_le };
        throw new Error("Ce lien n'est pas reconnu.");
      },
      async seDesinscrire(jeton) {
        await init(); const j = String(jeton || ""), d = liste("demandes_avis").find(x => x.jeton === j);
        if (d) { if (!E.oppositions.some(o => o.commerce_id === d.commerce_id && o.email === d.email)) E.oppositions.push({ commerce_id: d.commerce_id, email: d.email, motif: "lien_email", cree_le: iso(Date.now()) });
          E.demandes_avis.forEach(x => { if (x.commerce_id === d.commerce_id && x.email === d.email && x.statut === "a_envoyer") { x.statut = "annule"; x.motif = "désinscription"; } });
          jour(d.commerce_id, "DESINSCRIPTION", {}); sauver(); return autoDemo.desinscriptionInfo(j); }
        const p = liste("prospects").find(x => x.jeton === j); if (p) { p.desinscrit_le = p.desinscrit_le || iso(Date.now()); sauver(); return autoDemo.desinscriptionInfo(j); }
        throw new Error("Ce lien n'est pas reconnu.");
      },
      // ---- console
      async adminSante() { await init(); admin(); return Object.values(E.commerces).map(santeDemo).sort((a, b) => a.nom.localeCompare(b.nom)); },
      async adminProspects() { await init(); admin(); return liste("prospects").slice().sort((a, b) => (b.audit_le || "").localeCompare(a.audit_le || "")); },
      async adminProspect(id, action) {
        await init(); admin(); const p = liste("prospects").find(x => x.id === id), k = { rdv: "rdv_le", reponse: "repondu_le", arreter: "desinscrit_le", rapport_envoye: "rapport_envoye_le" }[action];
        if (!p || !k) throw new Error("Prospect ou action inconnus."); p[k] = p[k] || iso(Date.now()); sauver();
      },
      // ---- Tournée du jour : résultat noté depuis la console ou par le lien de l'email (resultat.html), mêmes règles que appliquer_resultat_prospect
      async adminResultatProspect(id, resultat, note) { await init(); admin(); const p = liste("prospects").find(x => x.id === id); return resultatDemo(p, resultat, note); },
      async prospectParJeton(jeton) {
        await init(); const j = String(jeton || ""), p = /^[0-9a-f]{64}$/.test(j) && liste("prospects").find(x => x.jeton_tournee === j);
        if (!p) throw new Error("Ce lien n'est pas reconnu.");
        if (p.jeton_tournee_utilise) throw new Error("Ce lien a déjà servi. Le résultat se change dans la console, onglet Prospects.");
        return { commerce: p.commerce, ville: p.ville, code_postal: p.code_postal, canal: p.canal, resultat: p.resultat, expire_le: iso(Date.now() + 7 * 24 * 3600000) };
      },
      async resultatParJeton(jeton, resultat, note) {
        const info = await autoDemo.prospectParJeton(jeton), p = liste("prospects").find(x => x.jeton_tournee === String(jeton));
        const r = resultatDemo(p, resultat, note); p.jeton_tournee_utilise = true; sauver(); return Object.assign(r, { commerce: info.commerce });
      },
      async adminMiseEnRoute(cid, point, etat) {
        await init(); admin(); if (!["a_faire", "declare", "fait"].includes(etat) || !ORDRE_POINTS.includes(point)) throw new Error("Point ou état inconnu.");
        etatMiseEnRoute(cid); tableMR()[cid][point] = etat; jour(cid, "MISE_EN_ROUTE", { point, etat }); sauver(); return etatMiseEnRoute(cid);
      },
      // Même règle que admin_lien_reseaux (schema.sql, 27/10/2026) : seulement pour une offre avec réseaux sociaux.
      async adminLienReseaux(cid, envoye = true) {
        await init(); admin(); if (!AUTO.pointsOffre((E.commerces[cid] || {}).offre_id).includes("metricool")) throw new Error("Ce commerce n'a pas d'étape réseaux (offre sans réseaux sociaux).");
        E.liens_reseaux = E.liens_reseaux || {}; E.liens_reseaux[cid] = envoye ? new Date().toISOString() : null; jour(cid, "MISE_EN_ROUTE_LIEN_RESEAUX", { envoye: !!envoye }); sauver(); return etatMiseEnRoute(cid);
      },
    };

    // ---- Trois offres (démonstration) : mêmes règles que le bloc « Trois offres » de schema.sql. Le passage du serveur (n8n toutes les heures :
    // avis Premium à l'équipe, relances du commerçant, mode délégation à 48 h, garantie des délais, objectif interne des pilotes) est simulé à
    // l'ouverture de l'écran « Avis et garanties » de la console et de l'écran Offre de l'espace.
    const J_GAR = 24 * MS_H, jourParis = t => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
    const ajouterJours = (d, n) => new Date(Date.parse(d + "T12:00:00Z") + n * J_GAR).toISOString().slice(0, 10);
    const offreDe = cid => OFFRES[(E.commerces[cid] || {}).offre_id] || {};
    // Accord donné dans l'espace (27/10/2026, decider_avis_sensible) : valable s'il suit la dernière proposition de l'équipe.
    const accordEspace = a => a.decision_client === "approuve" && !!a.propose_le && !!a.decision_client_le && a.decision_client_le >= a.propose_le;
    // Déclencheur regler_avis_offre (schema.sql) : avis non sensible « à valider » d'une offre avis_equipe ou delegation -> équipe. Rend vrai s'il passe à l'équipe.
    function reglerAvisOffre(a) {
      if (a.statut !== "a_valider" || a.sensible || !(offreDe(a.commerce_id).avis_equipe || offreDe(a.commerce_id).delegation)) return false;
      a.statut = "escalade"; a.decision = "equipe"; a.escalade_le = a.escalade_le || a.cree_le || iso(Date.now()); a.traite_le = null; return true;
    }
    const principalDemo = () => { const prof = E.demo_maj || null, premier = Object.values(E.users).find(u => u.commerce); return prof ? prof.principal : premier && premier.commerce; };
    // Objectif INTERNE des pilotes (ancienne garantie « 10 avis ») : suivi pour l'administrateur seulement, jamais montré au commerçant.
    function assurerGarantieDemo() {
      if (E.garanties_avis) return; E.garanties_avis = [];
      const cid = principalDemo(); if (!cid || !E.commerces[cid]) return;
      const depart = ajouterJours(jourParis(Date.now()), PUBLIQUE ? -20 : -46);
      E.garanties_avis.push({ commerce_id: cid, depart_le: depart, avis_depart: PUBLIQUE ? 40 : 30, capture: cid + "/garantie/capture-depart.png", cartes_en_place_le: depart,
        prolongation_jours: 0, avis_releve: null, releve_le: null, rappel_j45_le: null, echue_le: null, atteinte_le: null, demo: true });
    }
    function garantieEtat(g) {
      const k = CONDITIONS.objectif_interne_pilotes, nouveaux = E.avis.filter(a => a.commerce_id === g.commerce_id && jourParis(a.cree_le) >= g.depart_le).length;
      const actuel = g.avis_releve != null ? g.avis_releve : g.avis_depart + nouveaux, gagnes = Math.max(actuel - g.avis_depart, 0), ech = ajouterJours(g.depart_le, k.jours + (g.prolongation_jours || 0));
      const auj = jourParis(Date.now()), jourN = Math.round((Date.parse(auj) - Date.parse(g.depart_le)) / J_GAR), seuil = Math.ceil(k.nouveaux_avis * k.en_vue_pct / 100);
      const etat = gagnes >= k.nouveaux_avis ? "atteinte" : !g.cartes_en_place_le ? "condition_manquante" : auj > ech ? "non_atteint" : "en_cours";
      return { commerce_id: g.commerce_id, commerce: (E.commerces[g.commerce_id] || {}).nom, depart_le: g.depart_le, avis_depart: g.avis_depart, capture: g.capture, cartes_en_place_le: g.cartes_en_place_le,
        prolongation_jours: g.prolongation_jours || 0, avis_releve: g.avis_releve, releve_le: g.releve_le, nouveaux_recus: nouveaux, avis_actuel: actuel, gagnes, objectif: k.nouveaux_avis,
        objectif_total: g.avis_depart + k.nouveaux_avis, echeance: ech, jour: jourN, en_vue: gagnes >= seuil, seuil_en_vue: seuil, etat, source: g.avis_releve != null ? "releve" : "avis_recus",
        rappel_j45_le: g.rappel_j45_le, echue_le: g.echue_le, atteinte_le: g.atteinte_le, demo: !!g.demo };
    }
    // Garantie sur les délais : départ = remise des accès ET premières photos (Croissance, Premium) ; accès seul en Essentiel (26/10/2026, comme
    // depart_garantie_delais de la base) ; fiche sous 7 jours, premier contenu sous 72 h (Croissance, Premium), avis traité sous 24 h.
    const departDelais = (g, o) => !g.acces_remis_le ? null : o.reseaux_sociaux === false ? Date.parse(g.acces_remis_le)
      : g.photos_recues_le ? Math.max(Date.parse(g.acces_remis_le), Date.parse(g.photos_recues_le)) : null;
    function assurerDelaisDemo() {
      if (E.garantie_delais) return; E.garantie_delais = []; E.manquements_garantie = E.manquements_garantie || [];
      const cid = principalDemo(); if (!cid || !E.commerces[cid]) return;
      const dep = Date.now() - 12 * J_GAR;
      E.garantie_delais.push({ commerce_id: cid, acces_remis_le: iso(dep), photos_recues_le: iso(dep), fiche_optimisee_le: iso(dep + 4 * J_GAR), premier_contenu_le: iso(dep + 30 * MS_H), alerte_fiche_le: null, alerte_contenu_le: null, demo: true });
    }
    const etatDelai = (ech, fait) => ech == null ? "non_demarre" : fait != null && fait <= ech ? "tenu" : (fait != null ? fait : Date.now()) > ech ? "manque" : "en_cours";
    function delaisEtat(g) {
      const k = CONDITIONS.garantie_delais, o = offreDe(g.commerce_id), ha = k.avis_traite_heures * MS_H;
      const dep = departDelais(g, o);
      const ef = dep == null ? null : dep + k.fiche_optimisee_jours * J_GAR, ec = dep == null || !o.reseaux_sociaux ? null : dep + k.premier_contenu_heures * MS_H;
      const soumis = E.contenus.filter(x => x.commerce_id === g.commerce_id && (x.soumis_le || x.cree_le)).map(x => Date.parse(x.soumis_le || x.cree_le));
      const pc = g.premier_contenu_le ? Date.parse(g.premier_contenu_le) : soumis.length ? Math.min(...soumis) : null;
      const ms = (E.manquements_garantie || []).filter(m => m.commerce_id === g.commerce_id);
      return { commerce_id: g.commerce_id, commerce: (E.commerces[g.commerce_id] || {}).nom, offre: (E.commerces[g.commerce_id] || {}).offre_id, langue: (E.commerces[g.commerce_id] || {}).langue || "fr", depart: dep == null ? null : iso(dep),
        acces_remis_le: g.acces_remis_le, photos_recues_le: g.photos_recues_le,
        fiche: { echeance: ef == null ? null : iso(ef), fait_le: g.fiche_optimisee_le, etat: etatDelai(ef, g.fiche_optimisee_le ? Date.parse(g.fiche_optimisee_le) : null),
          coherence: { verifiee_le: g.coherence_verifiee_le || null, ecarts: g.coherence_ecarts || null } },
        premier_contenu: o.reseaux_sociaux ? { echeance: ec == null ? null : iso(ec), fait_le: pc == null ? null : iso(pc), etat: etatDelai(ec, pc == null ? null : Math.max(pc, dep)) } : null,
        avis_en_cours: dep == null ? [] : E.avis.filter(a => a.commerce_id === g.commerce_id && !a.traite_le && Date.parse(a.cree_le) >= dep).sort((a, b) => a.cree_le.localeCompare(b.cree_le))
          .map(a => { const ech = echeanceAvis(a.cree_le, retenuesDe(a)); return { id: a.id, note: a.note, recu_le: a.cree_le, echeance: ech == null ? null : iso(ech),
            en_retard: ech != null && Date.now() > ech, /* lot 8 : retenue posée après l'échéance = en retard */ retenue_le: a.retenue_le || null, liberee_le: a.liberee_le || null }; }),
        manquements: ms.map(m => ({ id: m.id, engagement: m.engagement, objet_id: m.objet_id, echeance: m.echeance, mois_offert: m.mois_offert, statut: m.statut, motif: m.motif || null })),
        mois_offerts: [...new Set(ms.filter(m => m.statut !== "ecarte").map(m => m.mois_offert))], demo: !!g.demo,
        // Lot 8 (CGV art. 3) : retouches sans limite, nouvelle proposition sous RETOUCHE_DELAI_HEURES (même calcul que delais_etat en base).
        retouches: E.contenus.filter(x => x.commerce_id === g.commerce_id && x.statut === "modification" && x.decide_le).map(x => { const ech = Date.parse(x.decide_le) + RETOUCHE_DELAI_HEURES * 3600000;
          return { id: x.id, demande_le: x.decide_le, echeance: iso(ech), en_retard: Date.now() > ech }; }) };
    }
    const moisSuivant = t => { const d = jourParis(t), [a, m] = d.split("-").map(Number); return (m === 12 ? (a + 1) + "-01" : a + "-" + String(m + 1).padStart(2, "0")) + "-01"; };
    function noterManquement(cid, engagement, objet, echeance, l) {
      const ms = (E.manquements_garantie = E.manquements_garantie || []);
      if (ms.some(m => m.commerce_id === cid && m.engagement === engagement && (m.objet_id || null) === (objet || null))) return;
      const mo = moisSuivant(echeance), nouveau = !ms.some(m => m.commerce_id === cid && m.mois_offert === mo && m.statut !== "ecarte"), id = ms.length + 1;
      ms.push({ id, commerce_id: cid, engagement, objet_id: objet || null, echeance: iso(echeance), mois_offert: mo, statut: "a_appliquer", motif: null, constate_le: iso(Date.now()) });
      jour(cid, "GARANTIE_MANQUEMENT", { engagement, objet: objet || null, echeance: iso(echeance), mois_offert: mo });
      if (nouveau) liste("alertes_exploitant").unshift({ id: uid(), type: "MOIS_OFFERT_A_APPLIQUER", commerce_id: cid, detail: { mois_offert: mo, engagement, echeance: iso(echeance), manquement: id }, cree_le: iso(Date.now()) });
      l.push({ manquement: id, commerce_id: cid, engagement, mois_offert: mo, nouveau_mois_offert: nouveau });
    }
    function passageServeurDemo() {
      const maintenant = Date.now(), l = { escalades: [], relances_avis: [], validations_tacites: [], rappels: [], delais: { alertes: [], manquements: [] } };
      // Standard et Premium (avis_equipe, 22/10/2026) : un avis « à valider » va à l'équipe, tout de suite. Essentiel : le client garde la main (relances).
      E.avis.filter(a => a.statut === "a_valider" && !a.sensible && (offreDe(a.commerce_id).avis_equipe || offreDe(a.commerce_id).delegation)).forEach(a => {
        a.statut = "escalade"; a.decision = "equipe"; a.escalade_le = iso(maintenant); a.traite_le = null; jour(a.commerce_id, "AVIS_EQUIPE", { avis: a.id, note: a.note }); l.escalades.push(a.id);
        liste("jetons_validation").filter(j => j.objet === "avis" && j.objet_id === a.id && !j.utilise_le).forEach(j => { j.expire_le = iso(maintenant); }); });
      const hs = CONDITIONS.avis.relances_client_heures;
      E.avis.filter(a => a.statut === "a_valider" && !a.sensible && (a.relances || 0) < hs.length && maintenant - Date.parse(a.traite_le || a.cree_le) >= hs[a.relances || 0] * MS_H).forEach(a => {
        a.relances = (a.relances || 0) + 1; a.derniere_relance_le = iso(maintenant); jour(a.commerce_id, "AVIS_RELANCE", { avis: a.id, numero: a.relances }); l.relances_avis.push(a.id); });
      // Mode délégation (Premium signé seulement) : approuvé 48 h après l'envoi sans réponse, puis programmé au créneau (01/11/2026, tour 7 Premium,
      // comme valider_tacitement en service ; avant : marqué approuvé seulement).
      E.contenus.filter(x => x.statut === "a_valider" && !(E.commerces[x.commerce_id] || {}).en_pause && offreDe(x.commerce_id).delegation && (E.commerces[x.commerce_id] || {}).delegation_signee_le
          && maintenant - Date.parse(x.soumis_le || x.cree_le) >= CONDITIONS.delegation.publication_auto_heures * MS_H).forEach(x => {
        x.statut = "approuve"; x.valide_tacitement_le = iso(maintenant); jour(x.commerce_id, "VALIDATION_TACITE", { contenu: x.id, heures: CONDITIONS.delegation.publication_auto_heures, mode: "delegation" }); l.validations_tacites.push(x.id); programmerALApprobation(x, true); });
      // Lot 8 (décision du fondateur du 16/11/2026, même calcul que retenues_sans_message) : 48 h après la demande d'attendre sans message du
      // commerçant, la réponse proposée part d'office dans la file de publication (« à publier sur Google ») ; un avis sensible jamais : alerte urgente.
      E.avis.filter(a => a.retenue_le && !a.traite_le && ["escalade", "humain"].includes(a.statut) && maintenant - Date.parse(a.retenue_le) >= RETENUE_SANS_MESSAGE_HEURES * MS_H
          && !(a.version_client_le && Date.parse(a.version_client_le) >= Date.parse(a.retenue_le))).forEach(a => {
        if (a.sensible || a.statut === "humain" || !String(a.reponse_proposee || "").trim()) {
          if (!liste("alertes_exploitant").some(x => x.type === "AVIS_SANS_MESSAGE_48H" && (x.detail || {}).avis === a.id && (x.detail || {}).retenue_le === a.retenue_le)) {
            liste("alertes_exploitant").unshift({ id: uid(), type: "AVIS_SANS_MESSAGE_48H", commerce_id: a.commerce_id, detail: { avis: a.id, note: a.note, sensible: !!a.sensible, retenue_le: a.retenue_le, urgent: true }, cree_le: iso(maintenant) });
            jour(a.commerce_id, "AVIS_SANS_MESSAGE_48H", { avis: a.id, sensible: !!a.sensible, retenue_le: a.retenue_le }); }
          return; }
        const avant = a.retenue_le, l = retenuesDe(a), ouverte = l.find(x => !x.liberee_le); a.retenue_le = null; a.liberee_le = iso(maintenant); a.alerte_delai_le = null;
        if (ouverte) ouverte.liberee_le = a.liberee_le; a.retenues = l; a.statut = "a_publier_main"; a.a_publier_le = iso(maintenant);
        liste("alertes_exploitant").filter(x => x.type === "AVIS_RETENU" && x.commerce_id === a.commerce_id && (x.detail || {}).avis === a.id && !x.vue_le).forEach(x => { x.vue_le = iso(maintenant); });
        jour(a.commerce_id, "AVIS_PUBLIE_48H_SANS_MESSAGE", { avis: a.id, retenue_le: avant }); });
      // Garantie des délais : alertes avant dépassement, manquements après.
      assurerDelaisDemo(); const k = CONDITIONS.garantie_delais, ha = k.avis_traite_heures * MS_H;
      E.garantie_delais.forEach(g => { const c = E.commerces[g.commerce_id], dep = c ? departDelais(g, offreDe(g.commerce_id)) : null; if (!c || c.en_pause || dep == null) return;
        const ef = dep + k.fiche_optimisee_jours * J_GAR, fo = g.fiche_optimisee_le ? Date.parse(g.fiche_optimisee_le) : null;
        if ((fo != null ? fo : maintenant) > ef) noterManquement(g.commerce_id, "fiche_7j", null, ef, l.delais.manquements);
        else if (fo == null && !g.alerte_fiche_le && maintenant > ef - k.alerte_fiche_avant_heures * MS_H) { g.alerte_fiche_le = iso(maintenant); liste("alertes_exploitant").unshift({ id: uid(), type: "DELAI_FICHE_BIENTOT", commerce_id: g.commerce_id, detail: { echeance: iso(ef), manque: g.coherence_verifiee_le ? [] : ["coherence"] }, cree_le: iso(maintenant) }); l.delais.alertes.push("DELAI_FICHE_BIENTOT"); }
        if (offreDe(g.commerce_id).reseaux_sociaux) { const e = delaisEtat(g).premier_contenu, ec = Date.parse(e.echeance);
          if (e.etat === "manque") noterManquement(g.commerce_id, "premier_contenu_72h", null, ec, l.delais.manquements);
          else if (!e.fait_le && !g.alerte_contenu_le && maintenant > ec - k.alerte_contenu_avant_heures * MS_H) { g.alerte_contenu_le = iso(maintenant); liste("alertes_exploitant").unshift({ id: uid(), type: "DELAI_CONTENU_BIENTOT", commerce_id: g.commerce_id, detail: { echeance: iso(ec) }, cree_le: iso(maintenant) }); l.delais.alertes.push("DELAI_CONTENU_BIENTOT"); } }
        E.avis.filter(a => a.commerce_id === g.commerce_id && Date.parse(a.cree_le) >= dep).forEach(a => { const ech = echeanceAvis(a.cree_le, retenuesDe(a)), tr = a.traite_le ? Date.parse(a.traite_le) : null;
          // 15/11/2026 : « Appelez-moi avant de publier » suspend le délai (échéance nulle pendant la retenue : jamais de manquement). Lot 8 (exploitant,
          // tour 6) : une retenue posée APRÈS l'échéance ne suspend rien (echeanceAvis rend l'échéance d'origine) : le manquement est noté dès qu'elle passe.
          if (ech == null || (tr != null && tr <= ech)) return;
          if ((tr != null ? tr : maintenant) > ech) noterManquement(g.commerce_id, "avis_24h", a.id, ech, l.delais.manquements);
          else if (tr == null && !a.alerte_delai_le && maintenant > ech - k.alerte_avis_avant_heures * MS_H) { a.alerte_delai_le = iso(maintenant); liste("alertes_exploitant").unshift({ id: uid(), type: "DELAI_AVIS_BIENTOT", commerce_id: g.commerce_id, detail: { avis: a.id, note: a.note, echeance: iso(ech) }, cree_le: iso(maintenant) }); l.delais.alertes.push("DELAI_AVIS_BIENTOT"); } });
      });
      // Objectif interne des pilotes (aucune conséquence de facturation)
      assurerGarantieDemo();
      E.garanties_avis.forEach(g => { const e = garantieEtat(g);
        if (e.etat === "atteinte" && !g.atteinte_le) { g.atteinte_le = iso(maintenant); jour(g.commerce_id, "OBJECTIF_PILOTE_ATTEINT", { gagnes: e.gagnes, jour: e.jour }); }
        else if (e.etat !== "atteinte") {
          if (e.jour >= CONDITIONS.objectif_interne_pilotes.rappel_jour && !g.rappel_j45_le && !e.en_vue) { g.rappel_j45_le = iso(maintenant); liste("alertes_exploitant").unshift({ id: uid(), type: "OBJECTIF_PILOTE_J45", commerce_id: g.commerce_id, detail: e, cree_le: iso(maintenant) }); l.rappels.push("OBJECTIF_PILOTE_J45"); }
          if (e.etat === "non_atteint" && !g.echue_le) { g.echue_le = iso(maintenant); liste("alertes_exploitant").unshift({ id: uid(), type: "OBJECTIF_PILOTE_NON_ATTEINT", commerce_id: g.commerce_id, detail: e, cree_le: iso(maintenant) }); l.rappels.push("OBJECTIF_PILOTE_NON_ATTEINT"); }
        } });
      sauver(); return l;
    }
    const dansFile = a => a && ["escalade", "humain"].includes(a.statut);
    // Lien de l'avis, sinon de la fiche (lien_avis_fiche de schema.sql) : file des avis et mode de secours.
    const lienAvisFiche = (a, c) => /^https:\/\/([a-z0-9-]+\.)*google\.[a-z]{2,3}(\.[a-z]{2})?\/[^\s"<>]*$/.test(a.lien_google || "") ? a.lien_google
      : /^[A-Za-z0-9_-]+$/.test((c && c.google_place_id) || "") ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(c.nom || "").replace(/[!'()*]/g, x => "%" + x.charCodeAt(0).toString(16).toUpperCase()) + "&query_place_id=" + c.google_place_id : null;
    const texteReponse = r => { const t = String(r || "").trim(); if (!t) throw new Error("Écrivez la réponse publiée."); if (t.length > 2000) throw new Error("La réponse est trop longue (2 000 caractères au plus)."); return t; };
    const dateSaisie = v => { if (v == null || v === "") return null; const t = /^\d{4}-\d{2}-\d{2}$/.test(v) ? Date.parse(v + "T12:00:00Z") : Date.parse(v); if (isNaN(t)) throw new Error("Date illisible (AAAA-MM-JJ)."); return iso(t); };
    // Jour de Paris (AAAA-MM-JJ) et échéance d'une option : (paiement ou éléments reçus, le plus tardif) + délai (echeance_option de schema.sql).
    const jourParisDemo = t => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
    const plusJoursDemo = (d, n) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n)).toISOString().slice(0, 10);
    const echeanceOptionDemo = (opt, paye, elements) => plusJoursDemo(jourParisDemo(Math.max(Date.parse(paye), elements ? Date.parse(elements) : 0)), (OPTIONS[opt] || {}).livraison_jours || 14);
    // ---- Visibilité IA (15/11/2026) : mêmes règles que le bloc « Visibilité IA : dossier de livraison » de schema.sql (étapes, plateformes,
    // échéance de 14 jours, questions figées après la mesure de départ, J+90, trimestrielle en Premium). Le ROBOT est faux ici : questions modèles,
    // mesure aux résultats FICTIFS dits tels (aucun moteur interrogé), contenus du site tirés de la référence comme moteur/geo.py (rien d'inventé).
    // Lot 9 (16/11/2026) : 13 étapes (accès Google avant les questions ; J+7 et J+30), chrono de 72 h ouvrées à la réunion du paiement, de l'accès
    // Google et des questions validées (geo_calcul_echeance), mesures comptées depuis J0 (geo_mesure_suivante), respect du délai à la livraison.
    const GEO_ETAPES = [["declenchement", ["robot"], "auto"], ["acces_google", ["client", "vous"], "semi"], ["questions", ["robot", "vous", "client"], "semi"], ["mesure_j0", ["robot"], "auto"],
      ["captures", ["vous"], "manuel"], ["coherence", ["vous"], "manuel"], ["fiche_google", ["vous"], "manuel"], ["plateformes", ["vous", "client"], "manuel"], ["contenus_site", ["robot", "vous"], "semi"],
      ["rapport", ["vous"], "manuel"], ["mesure_j7", ["robot"], "auto"], ["mesure_j30", ["robot"], "auto"], ["mesure_j90", ["robot"], "auto"]];
    const GEO_AUTO = ["declenchement", "mesure_j0", "mesure_j7", "mesure_j30", "mesure_j90"];
    const geoPf = pays => ["google", "apple", "tripadvisor", "yelp", "bing", "thefork", pays === "BE" ? "pagesdor" : "pagesjaunes", "facebook"];
    const geoAuj = () => jourParisDemo(Date.now());
    const geoDebut = d => { const k = d.commande_id && liste("commandes_options").find(x => x.id === d.commande_id); return k ? k.paye_le : d.ouvert_le; };
    const geoTrouver = id => { const d = liste("dossiers_geo").find(x => x.id === id); if (!d) throw new Error("Dossier Visibilité IA introuvable."); return d; };
    const geoFait = (d, k) => ((d.etapes || {})[k] || {}).etat === "fait";
    const geoEtat = d => ({ faites: GEO_ETAPES.filter(([k]) => geoFait(d, k)).length, total: GEO_ETAPES.length,
      etape_vous: (GEO_ETAPES.find(([k, q]) => !geoFait(d, k) && q.includes("vous")) || [null])[0] });
    const geoMesures = d => liste("mesures_geo").filter(m => m.dossier_id === d.id);
    const geoFigees = d => geoMesures(d).some(m => m.type === "j0" && ["demandee", "faite"].includes(m.statut));
    const geoPays = d => (E.commerces[d.commerce_id] || {}).pays || "FR";
    const geoCalcul = d => { const c = E.commerces[d.commerce_id] || {};
      if (!d.acces_google_le && c.google_location_id) { d.acces_google_le = iso(Date.now()); d.etapes.acces_google = { etat: "fait", le: iso(Date.now()), par: "robot" }; }
      if (d.acces_google_le && !d.bing_etat && ((d.plateformes || {}).bing || {}).etat !== "sans_objet") {   // tâche « Import Bing Places » (geo_tache_bing)
        d.bing_etat = "a_faire"; d.bing_a_faire_le = iso(Date.now()); alerteDemo("BING_A_IMPORTER", d.commerce_id, { dossier: d.id, commerce: c.nom, etat: "a_faire", a_faire_le: d.bing_a_faire_le }); }
      if (d.livre_le) return d;
      const debut = geoDebut(d), pays = geoPays(d), max = (...l) => iso(Math.max(...l.filter(Boolean).map(Date.parse)));
      if (d.regle_delai === "14_jours") { d.depart_le = d.questions_validees_le ? max(debut, d.questions_validees_le) : null;
        d.livraison_prevue_le = plusJoursDemo(jourParisDemo(Date.parse(max(debut, d.questions_validees_le))), 14); d.livraison_prevue_a = null; d.objectif_a = null; }
      else { d.depart_le = d.acces_google_le && d.questions_validees_le ? max(debut, d.acces_google_le, d.questions_validees_le) : null;
        const h0 = d.depart_le || max(debut, d.acces_google_le, d.questions_validees_le);
        d.livraison_prevue_a = iso(Date.parse(h0) + (OPTIONS.visibilite_ia.livraison_jours || 7) * 864e5);            // garanti : 7 jours calendaires
        d.objectif_a = heuresOuvreesAjouter(h0, OPTIONS.visibilite_ia.objectif_heures_ouvrees || 72, pays);           // objectif interne : 72 h ouvrées
        d.livraison_prevue_le = jourParisDemo(Date.parse(d.livraison_prevue_a)); }
      const cmd = d.commande_id && liste("commandes_options").find(x => x.id === d.commande_id && x.statut === "a_livrer");
      if (cmd) { cmd.livraison_prevue_le = d.livraison_prevue_le; if (d.depart_le) cmd.elements_recus_le = max(d.acces_google_le, d.questions_validees_le); }
      return d; };
    const geoJ0 = d => { const m = geoMesures(d).filter(x => x.type === "j0" && x.statut === "faite").map(x => x.faite_le).sort()[0]; return m ? jourParisDemo(Date.parse(m)) : null; };
    const geoSuivante = d => { const j0 = geoJ0(d), auj = geoAuj(), plan = OPTIONS.visibilite_ia.mesures_jours || [7, 30, 90], rem = OPTIONS.visibilite_ia.remesure_jours_premium || 90;
      if (!j0) return { type: "j0", le: null };
      const faite = t => geoMesures(d).some(x => x.type === t && x.statut === "faite");
      for (let i = 0; i < plan.length; i++) { const t = "j" + plan[i]; if (faite(t)) continue; if (plan[i + 1] != null && auj >= plusJoursDemo(j0, plan[i + 1])) continue;
        // J+7 jamais avant la livraison : en attente du rapport remis, puis au plus tôt le lendemain de la livraison (geo_mesure_suivante).
        if (i === 0 && !d.livre_le) return { type: t, le: null, attend_livraison: true };
        if (i === 0) { const l1 = plusJoursDemo(jourParisDemo(Date.parse(d.livre_le)), 1), l7 = plusJoursDemo(j0, plan[0]); return { type: t, le: l1 > l7 ? l1 : l7 }; }
        return { type: t, le: plusJoursDemo(j0, plan[i]) }; }
      const n = plan[plan.length - 1], der = geoMesures(d).filter(x => ["j90", "trimestrielle"].includes(x.type) && x.statut === "faite").map(x => jourParisDemo(Date.parse(x.faite_le))).sort().slice(-1)[0];
      const ecart = der ? Math.round((Date.parse(der) - Date.parse(plusJoursDemo(j0, n))) / 864e5) : 0, k = Math.max(1, Math.floor(ecart / rem) + 1), c = E.commerces[d.commerce_id] || {};
      return { type: "trimestrielle", le: plusJoursDemo(j0, n + rem * k), comprise: c.offre_id === "premium" }; };
    const geoMajProchaine = d => { const s = geoSuivante(d), sans = s.type === "j0" || (s.type === "trimestrielle" && !s.comprise);
      d.prochaine_mesure_type = sans ? null : s.type; d.prochaine_mesure_le = sans ? null : s.le; return s; };
    const geoComplements = d => { const j0 = geoJ0(d), auj = geoAuj(), pays = geoPays(d), plan = OPTIONS.visibilite_ia.mesures_jours || [7, 30, 90];
      const prevues = j0 ? [{ type: "j0", le: j0, etat: "faite" }, ...plan.map(n => { const t = "j" + n, f = geoMesures(d).filter(x => x.type === t && x.statut === "faite").map(x => x.faite_le).sort().slice(-1)[0] || null;
        const enAttente = t === "j7" && !f && d.prochaine_mesure_type === "j7";
        return { type: t, le: enAttente ? d.prochaine_mesure_le : plusJoursDemo(j0, n), etat: f ? "faite" : enAttente && !d.prochaine_mesure_le ? "apres_livraison"
          : d.prochaine_mesure_type !== t && auj > plusJoursDemo(j0, n) ? "sautee" : "prevue", faite_le: f }; })] : [];
      const ech = d.livraison_prevue_a || (d.livraison_prevue_le ? iso(Date.parse(plusJoursDemo(d.livraison_prevue_le, 1) + "T00:00:00+01:00")) : null);
      return { regle_delai: d.regle_delai || "7_jours", acces_google_le: d.acces_google_le || null, depart_le: d.depart_le || null, chrono_demarre: !!d.depart_le, livraison_prevue_a: ech,
        livraison_jours: d.regle_delai === "14_jours" ? 14 : OPTIONS.visibilite_ia.livraison_jours || 7, objectif_a: d.objectif_a || null,
        objectif_heures_ouvrees: d.objectif_a ? OPTIONS.visibilite_ia.objectif_heures_ouvrees || 72 : null,
        heures_ouvrees_restantes: !d.livre_le && d.depart_le && d.objectif_a ? heuresOuvreesEntre(iso(Date.now()), d.objectif_a, pays) : null,
        objectif_manque: !d.livre_le && !!d.depart_le && !!d.objectif_a && Date.now() > Date.parse(d.objectif_a),
        en_retard: !d.livre_le && (!!d.depart_le || d.regle_delai === "14_jours") && Date.now() > Date.parse(ech), delai_respecte: d.delai_respecte ?? null,
        objectif_tenu: d.objectif_tenu ?? null, garantie: d.garantie || null,
        heures_ouvrees_livraison: d.heures_ouvrees_livraison ?? null, j0_le: d.j0_le || null, prochaine_mesure_type: d.prochaine_mesure_type || null, mesures_prevues: prevues,
        bing: { etat: d.bing_etat || null, a_faire_le: d.bing_a_faire_le || null, depose_le: d.bing_depose_le || null, publie_le: d.bing_publie_le || null, bloque_le: d.bing_bloque_le || null, note: d.bing_note || null } }; };
    const geoOuvrir = (cid, origine, commande) => {
      const c = E.commerces[cid], deja = liste("dossiers_geo").find(x => x.commerce_id === cid);
      if (deja) { if (commande && !deja.commande_id) deja.commande_id = commande; return deja; }
      const k = commande && liste("commandes_options").find(x => x.id === commande), debut = k ? k.paye_le : iso(Date.now());
      const d = { id: uid(), commerce_id: cid, origine, commande_id: commande || null, ouvert_le: iso(Date.now()), etapes: { declenchement: { etat: "fait", le: iso(Date.now()), par: "robot" } },
        plateformes: Object.fromEntries(geoPf(c.pays).map(x => [x, { etat: "a_faire" }])), reference: {}, questions: [], questions_source: null, questions_proposees_le: null,
        questions_validees_le: null, contenus_site: null, contenus_le: null, livraison_prevue_le: echeanceOptionDemo("visibilite_ia", debut, null), livre_le: null, prochaine_mesure_le: null,
        regle_delai: "7_jours", acces_google_le: null, depart_le: null, livraison_prevue_a: null, j0_le: null, prochaine_mesure_type: null, delai_respecte: null, heures_ouvrees_livraison: null };
      liste("dossiers_geo").push(d); geoCalcul(d); jour(cid, "VISIBILITE_IA_OUVERTE", { dossier: d.id, origine, commande: commande || null, livraison_prevue_le: d.livraison_prevue_le }); return d;
    };
    const geoVille = c => (c.ville || "").trim() || "votre ville";
    const geoQuestionsModeles = c => { const v = geoVille(c);
      return c.langue === "nl" ? [`Waar kan ik goed eten in ${v}?`, `Welk restaurant raad je aan in ${v} voor een diner?`, `Een restaurant in ${v} voor een snelle lunch?`, `Waar romantisch dineren in ${v}?`,
        `Welk restaurant in ${v} voor een etentje met familie of een groep?`, `Een goed restaurant in ${v} dat op zondag open is?`, `Een restaurant met terras in ${v}?`, `Welk restaurant in ${v} heeft de beste reviews?`,
        `Waar kan ik vanavond een tafel reserveren in ${v}?`, `Een restaurant in ${v} met een goede prijs-kwaliteitverhouding?`]
        : [`Où bien manger à ${v} ?`, `Quel restaurant recommandes-tu à ${v} pour un dîner ?`, `Un restaurant à ${v} pour un déjeuner rapide le midi ?`, `Où dîner en amoureux à ${v} ?`,
        `Quel restaurant à ${v} pour un repas en famille ou en groupe ?`, `Un bon restaurant ouvert le dimanche à ${v} ?`, `Un restaurant avec terrasse à ${v} ?`, `Quel restaurant à ${v} a les meilleurs avis ?`,
        `Où réserver une table ce soir à ${v} ?`, `Un restaurant à ${v} avec un bon rapport qualité-prix ?`]; };
    // Mesure FICTIVE de la démonstration : une tendance plausible, jamais présentée comme réelle (avertissement et rapport le disent).
    const geoMesureFictive = (d, c, type) => { const n = type === "j0" ? 0 : 1, M = ["openai", "gemini", "perplexity"];
      const synthese = d.questions.map((q, i) => ({ question_index: i, question: q, par_moteur: Object.fromEntries(M.map((m, j) => { const cite = Math.min(3, Math.max(0, ((i + j * 2) % 4 === 0 ? 2 : (i + j) % 3 === 0 ? 1 : 0) + n));
        return [m, { cite, sur: 3, erreurs: 0, position_moyenne: cite ? 2 + ((i + j) % 3) : null }]; })) }));
      return { synthese, moteurs: Object.fromEntries(M.map(m => [m, { etat: "mesure", modele: "démonstration" }])), cout_usd: 0,
        avertissement: `Démonstration : résultats fictifs, aucun moteur interrogé. Mesure standardisée par API, localisée sur ${geoVille(c)}, répétée 3 fois par question ; une tendance, pas ce que voit chaque client dans son appli.` }; };
    const geoRapportDemo = (c, m, depart) => { const M = ["openai", "gemini", "perplexity"], N = { openai: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity" }, esc = s => String(s).replace(/[&<>]/g, x => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[x]));
      const cas = s => s ? `${s.cite} sur ${s.sur}` : "non mesuré";
      return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Visibilité IA</title><style>body{font-family:system-ui,sans-serif;max-width:900px;margin:24px auto;padding:0 16px;color:#1d1d1f;background:#fff}table{border-collapse:collapse;width:100%}th,td{border:1px solid #c8c8cc;padding:6px 8px;text-align:left}th{background:#f2f2f4}</style></head><body>`
        + `<h1>Visibilité dans les assistants IA : ${esc(c.nom)}</h1><p><strong>${esc(m.resultats.avertissement)}</strong></p><table><thead><tr><th>Question</th>${M.map(k => `<th>${N[k]}${depart ? "<br><small>départ / maintenant</small>" : ""}</th>`).join("")}</tr></thead><tbody>`
        + m.synthese.map((s, i) => `<tr><td>${i + 1}. ${esc(s.question)}</td>${M.map(k => `<td>${depart ? cas(depart.synthese[i].par_moteur[k]) + " / " : ""}${cas(s.par_moteur[k])}</td>`).join("")}</tr>`).join("") + `</tbody></table></body></html>`; };
    const GEO_JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"], GEO_JOURS_SCHEMA = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    // Contenus du site : même règle que moteur/geo.py, generer_contenus_site (seuls les faits de la fiche et de la référence ; champs manquants listés).
    const geoContenus = (c, r) => { const nl = c.langue === "nl", nom = (r.nom || c.nom || "").trim(), manquants = [], ld = { "@context": "https://schema.org", "@type": { restaurant: "Restaurant", beaute: "BeautySalon", sport: "SportsActivityLocation" }[c.metier] || "LocalBusiness", name: nom };
      const adr = { "@type": "PostalAddress" }; if (r.adresse) adr.streetAddress = r.adresse; else manquants.push("adresse"); if (r.code_postal) adr.postalCode = r.code_postal; else manquants.push("code_postal");
      const ville = (r.ville || c.ville || "").trim(); if (ville) adr.addressLocality = ville; else manquants.push("ville"); adr.addressCountry = c.pays === "BE" ? "BE" : "FR"; ld.address = adr;
      const tel = String(r.telephone || "").replace(/[\s.\-]/g, ""); if (/^\+[1-9]\d{7,14}$/.test(tel)) ld.telephone = tel; else manquants.push(tel ? "telephone (format international attendu, ex. +33 6 12 34 56 78)" : "telephone");
      const site = (r.site || c.site_web || "").trim(); if (/^https?:\/\//.test(site)) ld.url = site;
      const resto = c.metier === "restaurant", cu = Array.isArray(r.cuisine) ? r.cuisine : [];
      if (resto) { if (cu.length) ld.servesCuisine = cu; else manquants.push("cuisine"); if (/^https?:\/\//.test(r.menu_url || "")) ld.menu = r.menu_url; else manquants.push("menu_url"); }
      const h = r.horaires && GEO_JOURS.every(j => Array.isArray(r.horaires[j])) ? GEO_JOURS.flatMap((j, i) => r.horaires[j].map(x => [i, x[0], x[1]])) : null;
      if (h) ld.openingHoursSpecification = h.map(([i, o, f]) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: GEO_JOURS_SCHEMA[i], opens: o, closes: f })); else manquants.push("horaires (structurés, jour par jour)");
      const plats = (r.menu || []).filter(p => p && p.nom); let menu = "";
      if (resto) { if (plats.length) menu = (nl ? "Menukaart" : "Menu") + "\n" + plats.map(p => p.nom + (p.prix ? ` (${String(p.prix).replace(".", ",")} €)` : "")).join("\n"); else manquants.push("menu (plats relevés)"); }
      const faq = [];
      if (h) faq.push({ q: nl ? `Wat zijn de openingsuren van ${nom}?` : `Quels sont les horaires de ${nom} ?`, r: GEO_JOURS.map((j, i) => `${j} : ${(r.horaires[j] || []).map(x => x.join("-")).join(", ") || (nl ? "gesloten" : "fermé")}`).join("; ") + "." });
      if (adr.streetAddress && ville) faq.push({ q: nl ? `Waar is ${nom} gelegen?` : `Où se trouve ${nom} ?`, r: `${adr.streetAddress}, ${adr.postalCode ? adr.postalCode + " " : ""}${ville}.` });
      if (ld.telephone) faq.push({ q: nl ? "Hoe kan ik reserveren?" : "Comment réserver ?", r: (nl ? "Bel ons op " : "Par téléphone au ") + ld.telephone + "." });
      if (resto && cu.length) faq.push({ q: nl ? `Welke keuken serveert ${nom}?` : `Quelle cuisine propose ${nom} ?`, r: cu.join(", ") + "." });
      return { langue: nl ? "nl" : "fr", menu_texte: menu, faq, jsonld: ld, jsonld_html: '<script type="application/ld+json">\n' + JSON.stringify(ld, null, 2) + "\n</" + "script>", manquants,
        mode_emploi: "1. Copiez le bloc JSON-LD tel quel dans la balise <head> de la page d'accueil (ou dans le champ « code personnalisé » de votre outil : WordPress, Wix, Squarespace...). 2. Publiez le menu en TEXTE sur une page du site (pas seulement une photo ou un PDF). 3. Ajoutez les questions-réponses en texte visible sur la page d'accueil ou une page « Infos pratiques ». 4. Vérifiez le bloc avec le test des résultats enrichis de Google (https://search.google.com/test/rich-results) puis le validateur de schema.org (https://validator.schema.org).",
        genere_le: iso(Date.now()) }; };
    // Graine : un dossier pour chaque Croissance et Premium de la démonstration, et pour une option payée ; le commerce Premium principal est
    // déjà à mi-chemin (questions validées, mesure de départ fictive faite, captures et cohérence faites, code Apple attendu).
    const assurerGeoDemo = () => { if (E.geo_demo_v1) return; E.geo_demo_v1 = true;
      Object.values(E.commerces).filter(c => ["standard", "premium"].includes(c.offre_id)).forEach(c => geoOuvrir(c.id, "mise_en_route", null));
      liste("commandes_options").filter(k => k.option_id === "visibilite_ia" && k.commerce_id && E.commerces[k.commerce_id]).forEach(k => geoOuvrir(k.commerce_id, "option", k.id));
      const p = Object.values(E.commerces).find(c => c.offre_id === "premium"); if (!p) return;
      const d = liste("dossiers_geo").find(x => x.commerce_id === p.id), il = h => iso(Date.now() - h * 3600000);
      d.ouvert_le = il(96); d.etapes.declenchement.le = il(96); d.questions = geoQuestionsModeles(p); d.questions_source = "modele"; d.questions_proposees_le = il(90); d.questions_validees_le = il(72);
      // Lot 8 (DA, tour 6 : « 30 novembre » au journal, « 27 novembre » partout ailleurs) : la ligne d'ouverture de la graine prend la date
      // d'ouverture du dossier et son échéance d'alors ; une ligne « questions validées » note le changement d'échéance, comme en base.
      const avant = echeanceOptionDemo("visibilite_ia", d.ouvert_le, null), jo = E.journal.find(j => j.type === "VISIBILITE_IA_OUVERTE" && j.detail && j.detail.dossier === d.id);
      if (jo) { jo.cree_le = d.ouvert_le; jo.detail.livraison_prevue_le = avant; }
      d.acces_google_le = il(80); d.etapes.acces_google = { etat: "fait", le: il(80), par: "robot" }; geoCalcul(d);
      E.journal.push({ id: uid(), commerce_id: p.id, type: "VISIBILITE_IA_QUESTIONS", detail: { dossier: d.id, nombre: d.questions.length, validees: true, livraison_prevue_le: d.livraison_prevue_le, livraison_prevue_avant: avant !== d.livraison_prevue_le ? avant : null }, cree_le: d.questions_validees_le });
      d.etapes.questions = { etat: "fait", le: il(72), par: "console" }; d.etapes.mesure_j0 = { etat: "fait", le: il(70), par: "robot" };
      d.etapes.captures = { etat: "fait", le: il(69), par: "console", note: "ChatGPT 10 h 02, Gemini 10 h 05, Perplexity 10 h 07 (question 1)" };
      d.etapes.coherence = { etat: "fait", le: il(48), par: "console", note: "Horaires du dimanche différents sur TripAdvisor" };
      d.plateformes.google = { etat: "fait", le: il(47) }; d.plateformes.apple = { etat: "code_attendu", le: il(46), note: "code par appel" };
      d.reference = { nom: p.nom, ville: p.ville || "", cuisine: ["bistronomique"], menu_url: "" };
      const r = geoMesureFictive(d, p, "j0"), m = { id: uid(), dossier_id: d.id, commerce_id: p.id, type: "j0", statut: "faite", demandee_le: il(70.2), faite_le: il(70), resultats: r, synthese: r.synthese, cout_usd: 0, erreur: null };
      m.rapport_html = geoRapportDemo(p, m, null); liste("mesures_geo").push(m); d.j0_le = m.faite_le; geoMajProchaine(d); };
    const geoLecture = d => { const c = E.commerces[d.commerce_id] || {}, g = (E.garantie_delais || []).find(x => x.commerce_id === d.commerce_id) || {}, auj = geoAuj();
      return { id: d.id, commerce_id: d.commerce_id, commerce: c.nom, pays: c.pays || "FR", langue: c.langue || "fr", offre: c.offre_id, origine: d.origine, commande_id: d.commande_id, ouvert_le: d.ouvert_le,
        livraison_prevue_le: d.livraison_prevue_le, livre_le: d.livre_le, prochaine_mesure_le: d.prochaine_mesure_le, en_retard: !d.livre_le && auj > d.livraison_prevue_le,
        etapes: GEO_ETAPES.map(([cle, qui, mode]) => ({ cle, qui, mode, etat: geoFait(d, cle) ? "fait" : "a_faire", le: (d.etapes[cle] || {}).le || null, par: (d.etapes[cle] || {}).par || null, note: (d.etapes[cle] || {}).note || null })),
        plateformes: geoPf(c.pays).map(cle => ({ cle, etat: (d.plateformes[cle] || {}).etat || "a_faire", le: (d.plateformes[cle] || {}).le || null, note: (d.plateformes[cle] || {}).note || null })),
        reference: d.reference, questions: d.questions, questions_source: d.questions_source, questions_proposees_le: d.questions_proposees_le, questions_validees_le: d.questions_validees_le,
        questions_figees: geoFigees(d), contenus_site: d.contenus_site, contenus_le: d.contenus_le, site_web: c.site_web || null, coherence_garantie_le: g.coherence_verifiee_le || null, fiche_optimisee_le: g.fiche_optimisee_le || null,
        mesures: geoMesures(d).map(m => ({ id: m.id, type: m.type, statut: m.statut, demandee_le: m.demandee_le, faite_le: m.faite_le, synthese: m.synthese || null, moteurs: (m.resultats || {}).moteurs || null,
          avertissement: (m.resultats || {}).avertissement || null, cout_usd: m.cout_usd, erreur: m.erreur, rapport: !!m.rapport_html })),
        demandes: liste("demandes_geo").filter(q => q.dossier_id === d.id).slice(-10).reverse(), ...geoEtat(d), ...geoComplements(d) }; };
    const garantiesDemo = {
      async maGarantieDelais() { await init(); passageServeurDemo(); const g = E.garantie_delais.find(x => x.commerce_id === cur().id); return g ? delaisEtat(g) : null; },
      async adminFileAvis() {
        await init(); admin(); passageServeurDemo(); const d = CONDITIONS.garantie_delais.avis_traite_heures * MS_H;
        // 01/11/2026 (comme admin_file_avis) : un avis retenu (« Appelez-moi avant de publier ») passe en tête.
        return E.avis.filter(dansFile).sort((a, b) => (a.retenue_le ? 0 : 1) - (b.retenue_le ? 0 : 1) || a.cree_le.localeCompare(b.cree_le)).map(a => ({ id: a.id, commerce_id: a.commerce_id, commerce: (E.commerces[a.commerce_id] || {}).nom,
          offre: (E.commerces[a.commerce_id] || {}).offre_id, email_client: (E.commerces[a.commerce_id] || {}).email_validation || null, mode: offreDe(a.commerce_id).delegation || offreDe(a.commerce_id).avis_equipe ? "equipe" : "proposer",
          note: a.note, texte: a.texte, auteur: a.auteur || "", reponse_proposee: a.reponse_proposee || "", statut: a.statut, sensible: !!a.sensible, raisons: a.raisons || [], recu_le: a.cree_le, escalade_le: a.escalade_le || null,
          propose_le: a.propose_le || null, traite_le: a.traite_le || null, decision_client: a.decision_client || null, decision_client_le: a.decision_client_le || null, accord_espace: accordEspace(a),
          version_client: a.version_client || null, version_client_le: a.version_client_le || null,
          retenue_le: a.retenue_le || null, telephone_client: a.retenue_le ? a.retenue_telephone || (k => numeroWhatsapp(k.whatsapp_numero, paysDe(k.pays)) || numeroWhatsapp(k.contact, paysDe(k.pays)))(E.commerces[a.commerce_id] || {}) || null : null, rappel_jour: a.retenue_le ? a.retenue_jour || null : null, rappel_creneau: a.retenue_le ? a.retenue_creneau || "9-18" : null,
          // Version reçue (01/11/2026, tour 6 Premium ; même règle que admin_file_avis) : suspendue 48 h au plus, puis « en retard » sans reprise.
          ...(v => ({ suspendue: !!a.version_client && !v, relance_version: v, relance_le: a.version_client_le ? iso(Date.parse(a.version_client_le) + 48 * 36e5) : null,
            en_retard: (!a.version_client && !a.traite_le && !a.retenue_le && (e => e != null && Date.now() > e)(echeanceAvis(a.cree_le, retenuesDe(a)))) || (v && !a.retenue_le) }))(relanceVersion(a)),
          echeance: (e => e == null ? null : iso(e))(echeanceAvis(a.cree_le, retenuesDe(a))), liberee_le: a.liberee_le || null, retenues: retenuesDe(a).length,
          lien: lienAvisFiche(a, E.commerces[a.commerce_id]), demo: !!a.demo }));
      },
      async adminAvisProposer(id, reponse) {
        await init(); admin(); const a = E.avis.find(x => x.id === id); if (!dansFile(a)) throw new Error("Cet avis n'est pas dans la file de BoostImpact.");
        a.reponse_proposee = texteReponse(reponse); a.propose_le = iso(Date.now()); a.traite_le = a.traite_le || a.propose_le;
        // Lot 10 (mêmes règles que admin_avis_proposer) : la réponse part au commerçant sur WhatsApp (démonstration : rien ne part, elle est notée
        // comme reçue) ; 1 à 3 étoiles : nouvelle heure de publication annoncée, 1 h au moins après l'envoi ; avis sensible : jamais sans OK écrit.
        const k = E.commerces[a.commerce_id] || {}, wa = whatsappActifDe(k), pa = !a.sensible && wa ? iso(Math.max(Date.parse(a.publication_pas_avant || 0) || 0, Date.now() + 3 * 36e5)) : null;
        if (wa) { a.reponse_annoncee = a.reponse_proposee; a.reponse_annoncee_le = a.propose_le; if (pa) a.publication_pas_avant = pa; }
        jour(a.commerce_id, "AVIS_PROPOSE", { avis: a.id, sensible: !!a.sensible, whatsapp: wa }); sauver();
        return { id: a.id, propose_le: a.propose_le, email_client: k.email_validation || null, whatsapp: wa, sensible: !!a.sensible, pas_avant: pa };
      },
      async adminAvisPublie(id, reponse, accord) {
        await init(); admin(); const a = E.avis.find(x => x.id === id); if (!dansFile(a)) throw new Error("Cet avis n'est pas dans la file de BoostImpact.");
        if (a.retenue_le) throw new Error("Le commerçant répond par message : lisez son message, puis « Message lu » pour pouvoir publier.");   // lot 8
        if (a.sensible && !accord && !(a.decision_client === "approuve")) throw new Error("Avis sensible : jamais publié sans le OK écrit du commerçant. Cochez « Le commerçant a répondu OK par écrit ».");
        if (a.publication_pas_avant && Date.parse(a.publication_pas_avant) > Date.now() && !accord && !a.version_client && !(a.decision_client === "approuve"))
          throw new Error("Le commerçant a été prévenu de cet avis : publication possible à partir du " + new Date(a.publication_pas_avant).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) + ", sauf s'il approuve la réponse.");
        const txt = texteReponse(reponse), espace = accordEspace(a);
        // Lot 10 (comme admin_avis_publie) : le texte publié est celui que le commerçant a reçu sur WhatsApp, sauf accord écrit ou message de sa part.
        if (a.reponse_annoncee && !accord && !a.version_client && !espace && txt !== String(a.reponse_annoncee).trim())
          throw new Error("Le texte a changé depuis l'envoi au commerçant : envoyez-lui la nouvelle réponse (« Envoyer au commerçant »), puis publiez à l'heure annoncée.");
        // 27/10/2026 (comme admin_avis_publie) : l'accord donné dans l'espace vaut accord, pour le texte approuvé exactement.
        if (espace && !accord && txt !== String(a.reponse_proposee || "").trim()) throw new Error("Le texte publié doit être celui que le commerçant a approuvé dans son espace.");
        accord = accord || espace;
        if (!(offreDe(a.commerce_id).delegation || offreDe(a.commerce_id).avis_equipe) && !accord) throw new Error("Offre Essentiel : rien n'est publié sans l'accord du commerçant. Proposez la réponse, puis publiez-la après son accord.");
        const depuis = a.statut, tr = a.traite_le ? Date.parse(a.traite_le) : Date.now(); a.reponse = txt; a.reponse_proposee = a.reponse_proposee || txt; a.statut = "publie"; a.repondu_le = iso(Date.now()); a.traite_le = a.traite_le || a.repondu_le;
        jour(a.commerce_id, "AVIS_PUBLIE", { avis: a.id, par: "renomia", depuis, accord_client: !!accord, recu_le: a.cree_le, echeance: (e => e == null ? null : iso(e))(echeanceAvis(a.cree_le, retenuesDe(a))), dans_les_24h: (e => e == null || tr <= e)(echeanceAvis(a.cree_le, retenuesDe(a))) }); sauver();
      },
      // « Appelez-moi avant de publier » (01/11/2026) : mêmes règles que admin_liberer_avis (bloc « Créneaux réels »).
      // Lot 8 : mêmes règles que admin_retenir_avis (le commerçant a demandé d'attendre sur WhatsApp).
      async adminRetenirAvis(id) {
        await init(); admin(); const a = E.avis.find(x => x.id === id); if (!dansFile(a)) throw new Error("Cet avis n'est pas dans la file de BoostImpact.");
        if (a.retenue_le) return { id: a.id, retenue_le: a.retenue_le, deja: true };
        a.retenue_le = iso(Date.now()); a.retenues = retenuesDe(a); jour(a.commerce_id, "AVIS_RETENU", { avis: a.id, mode: "message", par: "equipe" }); sauver(); return { id: a.id, retenue_le: a.retenue_le };
      },
      async adminLibererAvis(id) {
        await init(); admin(); const a = E.avis.find(x => x.id === id); if (!a) throw new Error("Avis introuvable."); if (!a.retenue_le) return { id: a.id, retenue_le: null };
        const avant = a.retenue_le, l = retenuesDe(a), ouverte = l.find(x => !x.liberee_le); a.retenue_le = null; a.liberee_le = iso(Date.now()); a.alerte_delai_le = null;
        if (ouverte) ouverte.liberee_le = a.liberee_le; a.retenues = l;   // 15/11/2026 : historique gardé, le délai repart pour 24 h (CGV art. 10)
        liste("alertes_exploitant").filter(x => x.type === "AVIS_RETENU" && x.commerce_id === a.commerce_id && (x.detail || {}).avis === a.id && !x.vue_le).forEach(x => { x.vue_le = iso(Date.now()); });
        jour(a.commerce_id, "AVIS_LIBERE", { avis: a.id, retenue_le: avant }); sauver(); return { id: a.id, retenue_le: null };
      },
      // Mode de secours des avis (20/10/2026) : mêmes règles que admin_avis_a_publier et admin_avis_marquer_publie (schema.sql). Lien : celui de l'avis s'il
      // est connu, sinon la fiche par son identifiant de lieu (adresse « Maps URLs »), sinon aucun.
      async adminAvisAPublier() {
        await init(); admin(); const d = CONDITIONS.garantie_delais.avis_traite_heures * MS_H, h = SECOURS_ALERTE_HEURES * MS_H, maintenant = Date.now();
        const lien = lienAvisFiche;
        return E.avis.filter(a => a.statut === "a_publier_main").map(a => { const c = E.commerces[a.commerce_id] || {}, apl = a.a_publier_le || a.cree_le, ech = a.traite_le ? null : Date.parse(a.cree_le) + d;
          return { id: a.id, commerce_id: a.commerce_id, commerce: c.nom, offre: c.offre_id, note: a.note, texte: a.texte, auteur: a.auteur || "", reponse: a.reponse_proposee || "", decision: a.decision || null,
            source: a.source || "api", recu_le: a.cree_le, a_publier_le: apl, lien: lien(a, c), efface: !!a.efface_le, traite_le: a.traite_le || null, echeance: ech ? iso(ech) : null,
            en_retard: !!ech && maintenant > ech, attente_longue: maintenant > Date.parse(apl) + h, _tri: ech || Date.parse(apl) + d }; })
          .sort((x, y) => x._tri - y._tri || String(x.a_publier_le).localeCompare(String(y.a_publier_le))).map(({ _tri, ...x }) => x);
      },
      async adminAvisMarquerPubliee(id) {
        await init(); admin(); const a = E.avis.find(x => x.id === id);
        if (!a || a.statut !== "a_publier_main") throw new Error("Cette réponse n'est pas dans la file « À publier sur Google ».");
        const t = iso(Date.now()); Object.assign(a, { statut: "publie", reponse: a.reponse_proposee, publie_par: "equipe", erreur: null, repondu_le: t, traite_le: a.traite_le || t });
        jour(a.commerce_id, "AVIS_PUBLIE", { avis: a.id, par: "equipe", decision: a.decision || null, dans_les_24h: Date.parse(a.traite_le) <= Date.parse(a.cree_le) + CONDITIONS.garantie_delais.avis_traite_heures * MS_H });
        sauver(); return { id: a.id, statut: "publie", repondu_le: t, traite_le: a.traite_le };
      },
      // ---- Publication à la main, sans Metricool (22/10/2026) : mêmes règles que admin_publications_a_publier et admin_publication_publiee (schema.sql).
      // La démonstration n'a pas de Metricool : toute publication « programmée » est dans la file (branche n8n sans Metricool). Une carte par réseau restant.
      async adminPublicationsAPublier() {
        await init(); admin(); const maintenant = Date.now();
        return liste("publications").filter(p => p.statut === "programme").flatMap(p => {
          const c = E.commerces[p.commerce_id] || {}, ct = E.contenus.find(x => x.id === p.contenu_id) || {}, deja = Object.keys(p.publie_reseaux || {}), m = ct.musique;
          return (p.reseaux || []).filter(r => !deja.includes(r)).map(r => ({ id: p.id, commerce_id: p.commerce_id, commerce: c.nom, reseau: r, prevu_le: p.prevu_le, type: ct.type, format: formatDe(ct),
            legende: ((ct.legendes || {})[r]) || ct.legende || "", chemin: null,
            url_demo: ct.type === "video" ? ct.video_url || null : (r === "tiktok" && photoPublication(ct) ? ct.visuel_9x16_url : ct.visuel_url) || null,
            son: ct.type === "video" && m && m.mode === "plateforme" && ["instagram", "tiktok"].includes(r) ? { ambiance: m.ambiance || null } : null,
            a_publier_le: p.a_publier_main_le || p.cree_le, en_retard: maintenant > Date.parse(p.prevu_le) + 2 * MS_H, deja, ia: estIA(ct) }));
        }).sort((a, b) => Date.parse(a.prevu_le) - Date.parse(b.prevu_le) || String(a.commerce).localeCompare(String(b.commerce)) || a.reseau.localeCompare(b.reseau));
      },
      async adminPublicationPubliee(id, reseau) {
        await init(); admin(); const p = liste("publications").find(x => x.id === id);
        if (!p || p.statut !== "programme") throw new Error("Cette publication n'est pas dans la file « À publier à la main ».");
        if (!(p.reseaux || []).includes(reseau)) throw new Error("Réseau absent de cette publication.");
        p.publie_reseaux = p.publie_reseaux || {}; if (p.publie_reseaux[reseau]) throw new Error("Déjà marquée comme publiée sur ce réseau.");
        const t = iso(Date.now()); p.publie_reseaux[reseau] = t;
        jour(p.commerce_id, "PUBLICATION_A_LA_MAIN_PUBLIEE", { publication: p.id, reseau, prevu_le: p.prevu_le, publie_le: t, retard_minutes: Math.max(0, Math.floor((Date.parse(t) - Date.parse(p.prevu_le)) / 60000)) });
        if (p.reseaux.every(r => p.publie_reseaux[r])) { p.statut = "publie"; const ct = E.contenus.find(x => x.id === p.contenu_id); if (ct) ct.statut = "publie"; }   // déclencheur « suivi »
        sauver(); return { id: p.id, statut: p.statut, reseau, publie_le: t };
      },
      async adminLienMedia(x) { return x.url_demo || null; },
      // Accès vérifié (22/10/2026) : mêmes règles que admin_acces_reseau (schema.sql) ; à l'accès vérifié, les contenus approuvés restés sans
      // programmation partent au prochain créneau, comme à l'approbation.
      async adminAccesReseau(cid, reseau, acces) {
        await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable.");
        if (!reseauxAutorises(c).includes(reseau)) throw new Error("Réseau non compris dans l'offre de ce commerce, ou non retenu : " + reseau);
        E.comptes[cid] = E.comptes[cid] || {}; const avant = (E.comptes[cid][reseau] || {}).etat || "non_connecte", maj = iso(Date.now());
        E.comptes[cid][reseau] = { etat: acces ? "connecte" : "non_connecte", detail: acces ? "Accès vérifié par l'équipe" : "Accès retiré", maj };
        jour(cid, acces ? "ACCES_RESEAU_VERIFIE" : "ACCES_RESEAU_RETIRE", { reseau, avant, apres: E.comptes[cid][reseau].etat, par: "administrateur" });
        let n = 0;
        if (acces) for (const ct of E.contenus.filter(x => x.commerce_id === cid && x.statut === "approuve" && !E.publications.some(p => p.contenu_id === x.id && ["programme", "envoye", "publie"].includes(p.statut))))
          if (programmerALApprobation(ct)) n++;
        sauver(); return { reseau, etat: E.comptes[cid][reseau].etat, maj, programmes: n };
      },
      // ---- Options commandées (22/10/2026) : mêmes règles que admin_commandes_options, admin_commande_option_* et la lecture du commerçant (schema.sql,
      // bloc « Options commandées »). En démonstration, une commande n'arrive que par la graine (aucun paiement Stripe).
      async mesCommandesOptions() {
        await init(); const c = cur(); if (!c) return [];
        return liste("commandes_options").filter(k => k.commerce_id === c.id).sort((a, b) => String(a.paye_le).localeCompare(String(b.paye_le)))
          .map(({ id, option_id, statut, paye_le, elements_recus_le, livraison_prevue_le, livree_le, second_test_prevu_le, second_test_fait_le }) =>
            ({ id, option_id, statut, paye_le, elements_recus_le: elements_recus_le || null, livraison_prevue_le, livree_le: livree_le || null, second_test_prevu_le: second_test_prevu_le || null, second_test_fait_le: second_test_fait_le || null }));
      },
      async adminCommandesOptions() {
        await init(); admin(); const auj = jourParisDemo(Date.now());
        return liste("commandes_options").filter(k => k.statut === "a_livrer" || (k.second_test_prevu_le && !k.second_test_fait_le)).map(k => {
          const o = OPTIONS[k.option_id] || {}, etape = k.statut === "a_livrer" ? "livraison" : "second_test", echeance = etape === "livraison" ? k.livraison_prevue_le : k.second_test_prevu_le;
          return { id: k.id, commerce_id: k.commerce_id || null, commerce: k.commerce_id ? (E.commerces[k.commerce_id] || {}).nom || null : null, option: k.option_id, option_nom: o.nom || k.option_id,
            email: k.commerce_id ? null : k.email || null, paye_le: k.paye_le, montant_ht_centimes: k.montant_ht_centimes ?? null, test: !!k.test, elements_recus_le: k.elements_recus_le || null,
            livraison_prevue_le: k.livraison_prevue_le, livraison_jours: o.livraison_jours, statut: k.statut, livree_le: k.livree_le || null, second_test_prevu_le: k.second_test_prevu_le || null,
            etape, echeance, en_retard: auj > echeance };
        }).sort((a, b) => a.echeance.localeCompare(b.echeance) || String(a.paye_le).localeCompare(String(b.paye_le)));
      },
      async adminCommandeOptionElements(id, le) {
        await init(); admin(); const k = liste("commandes_options").find(x => x.id === id), auj = jourParisDemo(Date.now()), d = le || auj;
        if (!k || k.statut !== "a_livrer") throw new Error("Cette commande n'est plus à livrer.");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Date illisible (AAAA-MM-JJ).");
        if (d > auj) throw new Error("Date de réception dans le futur.");
        k.elements_recus_le = iso(Date.parse(d + "T10:00:00Z")); k.livraison_prevue_le = echeanceOptionDemo(k.option_id, k.paye_le, k.elements_recus_le);
        if (k.commerce_id) jour(k.commerce_id, "OPTION_ELEMENTS_RECUS", { option: k.option_id, commande: k.id, livraison_prevue_le: k.livraison_prevue_le });
        sauver(); return { id: k.id, elements_recus_le: k.elements_recus_le, livraison_prevue_le: k.livraison_prevue_le };
      },
      async adminCommandeOptionLivree(id) {
        await init(); admin(); const k = liste("commandes_options").find(x => x.id === id), auj = jourParisDemo(Date.now());
        if (!k || k.statut !== "a_livrer") throw new Error("Cette commande n'est plus à livrer.");
        if (!k.commerce_id) throw new Error("Rattachez d'abord la commande à un commerce.");
        // Lot 3 (15/11/2026) : mêmes refus que admin_commande_option_livree (bloc « Options : livraison après les éléments reçus »).
        if (!k.elements_recus_le) throw new Error("Notez d'abord la réception des éléments du client.");
        if (k.option_id === "visibilite_ia" && !liste("dossiers_geo").some(d => d.commande_id === k.id && d.livre_le)) throw new Error("Visibilité IA : la livraison se note par « Rapport remis » dans le dossier du client.");
        const o = OPTIONS[k.option_id] || {}; k.statut = "livree"; k.livree_le = iso(Date.now()); k.second_test_prevu_le = o.second_test_jours ? plusJoursDemo(auj, o.second_test_jours) : null;
        jour(k.commerce_id, "OPTION_LIVREE", { option: k.option_id, commande: k.id, livraison_prevue_le: k.livraison_prevue_le, en_retard: auj > k.livraison_prevue_le, second_test_prevu_le: k.second_test_prevu_le });
        sauver(); return { id: k.id, statut: k.statut, livree_le: k.livree_le, second_test_prevu_le: k.second_test_prevu_le };
      },
      async adminCommandeOptionSecondTest(id) {
        await init(); admin(); const k = liste("commandes_options").find(x => x.id === id);
        if (!k || k.statut !== "livree" || !k.second_test_prevu_le || k.second_test_fait_le) throw new Error("Aucun second test à noter pour cette commande.");
        k.second_test_fait_le = iso(Date.now()); jour(k.commerce_id, "OPTION_SECOND_TEST_REMIS", { option: k.option_id, commande: k.id, prevu_le: k.second_test_prevu_le });
        sauver(); return { id: k.id, second_test_fait_le: k.second_test_fait_le };
      },
      async adminCommandeOptionRattacher(id, cid) {
        await init(); admin(); if (!cid || !E.commerces[cid]) throw new Error("Commerce introuvable.");
        const k = liste("commandes_options").find(x => x.id === id); if (!k || k.commerce_id) throw new Error("Cette commande est déjà rattachée à un commerce.");
        k.commerce_id = cid; k.email = null; jour(cid, "OPTION_COMMANDEE", { option: k.option_id, commande: k.id, livraison_prevue_le: k.livraison_prevue_le, test: !!k.test, rattachee: true });
        if (k.option_id === "visibilite_ia") geoOuvrir(cid, "option", k.id);   // déclencheur geo_dossier_option de la base
        sauver(); return { id: k.id, commerce_id: cid };
      },
      // ---- Visibilité IA (15/11/2026) : mêmes règles que admin_dossiers_geo, admin_dossier_geo, admin_geo_* et ma_visibilite_ia (schema.sql). Le robot
      // de la démonstration répond tout de suite (questions modèles, mesure fictive dite telle, contenus depuis la référence).
      async adminDossiersGeo() {
        await init(); admin(); assurerGeoDemo(); const auj = geoAuj();
        return liste("dossiers_geo").map(d => { const c = E.commerces[d.commerce_id] || {};
          return { id: d.id, commerce_id: d.commerce_id, commerce: c.nom, offre: c.offre_id, origine: d.origine, ouvert_le: d.ouvert_le, livraison_prevue_le: d.livraison_prevue_le, livre_le: d.livre_le,
            en_retard: !d.livre_le && auj > d.livraison_prevue_le, jours_restants: Math.round((Date.parse(d.livraison_prevue_le) - Date.parse(auj)) / 864e5), prochaine_mesure_le: d.prochaine_mesure_le,
            mesure_due: !!d.prochaine_mesure_le && d.prochaine_mesure_le <= plusJoursDemo(auj, 3) && !geoMesures(d).some(m => m.statut === "demandee"),
            codes_attendus: Object.keys(d.plateformes).filter(k => d.plateformes[k].etat === "code_attendu").sort(), demande_en_cours: liste("demandes_geo").some(q => q.dossier_id === d.id && q.statut === "a_traiter"),
            derniere_erreur: (geoMesures(d).slice(-1)[0] || {}).erreur || null, ...geoEtat(d), ...geoComplements(d) }; }).sort((a, b) => String(a.livre_le ? a.prochaine_mesure_le : a.livraison_prevue_le).localeCompare(String(b.livre_le ? b.prochaine_mesure_le : b.livraison_prevue_le)));
      },
      async adminDossierGeo(cid) { await init(); admin(); assurerGeoDemo(); const d = liste("dossiers_geo").find(x => x.commerce_id === cid); sauver(); return d ? geoLecture(d) : null; },
      async adminGeoOuvrir(cid) {
        await init(); admin(); assurerGeoDemo(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable.");
        const k = liste("commandes_options").filter(x => x.commerce_id === cid && x.option_id === "visibilite_ia").slice(-1)[0], inclus = ["standard", "premium"].includes(c.offre_id);
        if (!inclus && !k) throw new Error("Visibilité IA : comprise en Croissance et en Premium ; en Essentiel, seulement après le paiement de l'option.");
        const d = geoOuvrir(cid, inclus ? "mise_en_route" : "option", inclus ? null : k.id); sauver(); return { dossier: d.id };
      },
      async adminGeoEtape(id, k, fait, note) {
        await init(); admin(); const d = geoTrouver(id), n = String(note || "").trim() || null, auj = geoAuj();
        if (!GEO_ETAPES.some(([x]) => x === k)) throw new Error(`Étape inconnue : ${k}.`);
        if (GEO_AUTO.includes(k)) throw new Error("Cette étape se coche seule (robot).");
        if (k === "questions") throw new Error("Les questions se valident avec « Valider les 10 questions ».");
        if (n && n.length > 1000) throw new Error("Note trop longue (1 000 caractères au plus).");
        if (k === "rapport" && !fait && d.livre_le) throw new Error("Livraison notée : elle ne s'annule pas ici.");
        if (k === "rapport" && fait && !geoMesures(d).some(m => m.type === "j0" && m.statut === "faite")) throw new Error("La mesure de départ doit être faite avant le rapport de livraison.");
        if (k === "rapport" && fait && !d.livre_le && ((d.plateformes || {}).bing || {}).etat !== "sans_objet" && (d.bing_etat || "a_faire") === "a_faire")
          throw new Error("Import Bing Places pas encore déposé : il fait partie du travail à livrer (ou passez Bing en « sans objet »).");
        if (k === "acces_google" && !fait && ((E.commerces[d.commerce_id] || {}).google_location_id || d.livre_le)) throw new Error("Accès Google constaté (fiche reliée) ou livraison notée : il ne se retire pas ici.");
        if (fait) d.etapes[k] = { etat: "fait", le: iso(Date.now()), par: "console", note: n }; else delete d.etapes[k];
        if (k === "acces_google") d.acces_google_le = fait ? d.acces_google_le || iso(Date.now()) : null;
        geoCalcul(d);
        if (k === "rapport" && fait && !d.livre_le) { const x = geoComplements(d); d.livre_le = iso(Date.now()); d.delai_respecte = Date.now() <= Date.parse(x.livraison_prevue_a);
          d.objectif_tenu = d.objectif_a ? Date.now() <= Date.parse(d.objectif_a) : null; d.garantie = d.delai_respecte ? null : d.origine === "option" ? "remboursement" : "mois_offert"; geoMajProchaine(d);
          if (d.garantie) alerteDemo("VISIBILITE_IA_GARANTIE", d.commerce_id, { dossier: d.id, commerce: (E.commerces[d.commerce_id] || {}).nom, garantie: d.garantie, echeance: x.livraison_prevue_a, livre_le: d.livre_le, urgent: true });
          d.heures_ouvrees_livraison = d.depart_le ? heuresOuvreesEntre(d.depart_le, d.livre_le, geoPays(d)) : null;
          jour(d.commerce_id, "VISIBILITE_IA_LIVREE", { dossier: d.id, livraison_prevue_le: d.livraison_prevue_le, livraison_prevue_a: x.livraison_prevue_a, regle_delai: x.regle_delai,
            en_retard: !d.delai_respecte, delai_respecte: d.delai_respecte, objectif_a: d.objectif_a || null, objectif_tenu: d.objectif_tenu, garantie: d.garantie, heures_ouvrees: d.heures_ouvrees_livraison, prochaine_mesure_le: d.prochaine_mesure_le });
          const cmd = liste("commandes_options").find(x => x.id === d.commande_id && x.statut === "a_livrer"), st = plusJoursDemo(geoJ0(d), OPTIONS.visibilite_ia.second_test_jours || 90);
          if (cmd) { cmd.statut = "livree"; cmd.livree_le = iso(Date.now()); cmd.second_test_prevu_le = st;
            jour(d.commerce_id, "OPTION_LIVREE", { option: cmd.option_id, commande: cmd.id, livraison_prevue_le: cmd.livraison_prevue_le, en_retard: !d.delai_respecte, second_test_prevu_le: st, par: "visibilite_ia" }); } }
        else jour(d.commerce_id, k === "acces_google" ? "VISIBILITE_IA_ACCES_GOOGLE" : "VISIBILITE_IA_ETAPE", { dossier: d.id, etape: k, fait: !!fait, par: "console", livraison_prevue_a: d.livraison_prevue_a });
        sauver(); return { id: d.id, etape: k, fait: !!fait, livre_le: d.livre_le, prochaine_mesure_le: d.prochaine_mesure_le };
      },
      async adminGeoQuestions(id, qs, valider) {
        await init(); admin(); const d = geoTrouver(id);
        if (geoFigees(d)) throw new Error("Les questions sont figées après le lancement de la mesure de départ.");
        if (!Array.isArray(qs) || qs.length > 10) throw new Error("10 questions au plus.");
        const q = qs.filter(x => typeof x === "string").map(x => x.trim().replace(/\s+/g, " ")).filter(Boolean);
        if (q.some(x => x.length > 200)) throw new Error("Une question fait 200 caractères au plus.");
        if (valider && q.length !== 10) throw new Error("Il faut exactement 10 questions pour les valider.");
        if (JSON.stringify(q) !== JSON.stringify(d.questions)) d.questions_source = "equipe";
        d.questions = q; d.questions_validees_le = valider ? iso(Date.now()) : null;
        if (valider) d.etapes.questions = { etat: "fait", le: iso(Date.now()), par: "console" }; else delete d.etapes.questions;
        const avant = d.livraison_prevue_le; geoCalcul(d);
        // Lot 8 (DA, tour 6) : la ligne trace le changement d'échéance (livraison_prevue_avant), comme admin_geo_questions en base.
        jour(d.commerce_id, "VISIBILITE_IA_QUESTIONS", { dossier: d.id, nombre: q.length, validees: !!valider, livraison_prevue_le: d.livraison_prevue_le, livraison_prevue_a: d.livraison_prevue_a,
          chrono_demarre: !!d.depart_le, livraison_prevue_avant: avant !== d.livraison_prevue_le ? avant : null });
        sauver(); return { id: d.id, questions: d.questions, questions_validees_le: d.questions_validees_le, livraison_prevue_le: d.livraison_prevue_le, livraison_prevue_a: d.livraison_prevue_a, chrono_demarre: !!d.depart_le };
      },
      async adminGeoReference(id, r) {
        await init(); admin(); const d = geoTrouver(id), out = {};
        if (!r || typeof r !== "object" || Array.isArray(r) || JSON.stringify(r).length > 20000) throw new Error("Référence invalide.");
        for (const [k, v] of Object.entries(r)) {
          if (!["nom", "adresse", "code_postal", "ville", "region", "telephone", "site", "menu_url", "cuisine", "horaires", "menu"].includes(k)) throw new Error(`Champ de référence inconnu : ${k}.`);
          if (typeof v === "string" && v.trim()) out[k] = v.trim(); else if (v && typeof v === "object") out[k] = v; }
        d.reference = out; jour(d.commerce_id, "VISIBILITE_IA_REFERENCE", { dossier: d.id, champs: Object.keys(out) }); sauver(); return { id: d.id, reference: out };
      },
      async adminGeoBing(id, etat, note) {
        await init(); admin(); const d = geoTrouver(id), n = String(note || "").trim() || null;
        if (!["a_faire", "depose", "publie", "bloque"].includes(etat)) throw new Error("État de l'import Bing inconnu.");
        if (!d.acces_google_le) throw new Error("Import Bing : il faut d'abord l'accès gestionnaire à la fiche Google.");
        if (etat === "bloque" && !n) throw new Error("Import Bing bloqué : écrivez pourquoi (note).");
        if (n && n.length > 500) throw new Error("Note trop longue (500 caractères au plus).");
        d.bing_etat = etat; if (n) d.bing_note = n; d["bing_" + etat + "_le"] = iso(Date.now());
        if (etat === "publie") d.plateformes.bing = { etat: "fait", le: iso(Date.now()), note: n || "Import depuis Google publié" };
        liste("alertes_exploitant").filter(a => a.type === "BING_A_IMPORTER" && (a.detail || {}).dossier === d.id).forEach(a => {
          a.vue_le = ["depose", "publie"].includes(etat) ? a.vue_le || iso(Date.now()) : null; a.detail = Object.assign({}, a.detail, { etat, le: iso(Date.now()), note: d.bing_note || null }); });
        jour(d.commerce_id, "VISIBILITE_IA_BING", { dossier: d.id, etat }); sauver();
        return { id: d.id, bing_etat: d.bing_etat, bing_a_faire_le: d.bing_a_faire_le || null, bing_depose_le: d.bing_depose_le || null, bing_publie_le: d.bing_publie_le || null, bing_bloque_le: d.bing_bloque_le || null, bing_note: d.bing_note || null };
      },
      async adminGeoPlateforme(id, cle, etat, note) {
        await init(); admin(); const d = geoTrouver(id), c = E.commerces[d.commerce_id] || {}, n = String(note || "").trim() || null;
        if (!geoPf(c.pays).includes(cle)) throw new Error(`Plateforme inconnue pour ce pays : ${cle}.`);
        if (!["a_faire", "code_attendu", "fait", "sans_objet"].includes(etat)) throw new Error("État de plateforme inconnu.");
        d.plateformes[cle] = { etat, le: iso(Date.now()), note: n };
        const toutes = geoPf(c.pays).every(x => ["fait", "sans_objet"].includes((d.plateformes[x] || {}).etat));
        if (toutes) d.etapes.plateformes = { etat: "fait", le: iso(Date.now()), par: "console" }; else delete d.etapes.plateformes;
        jour(d.commerce_id, "VISIBILITE_IA_PLATEFORME", { dossier: d.id, plateforme: cle, etat }); sauver(); return { id: d.id, plateforme: cle, etat, plateformes_faites: toutes };
      },
      async adminGeoDemander(id, type) {
        await init(); admin(); const d = geoTrouver(id), c = E.commerces[d.commerce_id] || {}, auj = geoAuj();
        if (!["questions", "mesure", "contenus"].includes(type)) throw new Error(`Demande inconnue : ${type}.`);
        let mt = null, m = null;
        if (type === "questions" && (d.questions_validees_le || geoFigees(d))) throw new Error("Les questions sont déjà validées.");
        if (type === "mesure") {
          if (!d.questions_validees_le || d.questions.length !== 10) throw new Error("Validez d'abord les 10 questions.");
          const su = geoSuivante(d); mt = su.type;
          if (mt === "j7" && !su.le) throw new Error("Mesure J+7 : après la livraison (rapport de livraison remis d'abord).");
          if (mt === "trimestrielle" && !su.comprise) throw new Error("La mesure tous les 90 jours est comprise en Premium payé à l'année seulement.");
          if (mt !== "j0" && auj < plusJoursDemo(su.le, -({ j7: 1, j30: 3 }[mt] || 7)))
            throw new Error(`Prochaine mesure (${mt === "trimestrielle" ? "tous les 90 jours" : "J+" + mt.slice(1)}) prévue le ${su.le.split("-").reverse().join("/")}.`);
        }
        const q = { id: uid(), commerce_id: d.commerce_id, dossier_id: d.id, type, mesure_id: null, statut: "traitee", erreur: null, cree_le: iso(Date.now()), traitee_le: iso(Date.now()) };
        // Faux robot : réponse immédiate.
        if (type === "questions") { d.questions = geoQuestionsModeles(c); d.questions_source = "modele"; d.questions_proposees_le = iso(Date.now()); }
        if (type === "contenus") { d.contenus_site = geoContenus(c, d.reference || {}); d.contenus_le = iso(Date.now()); }
        if (type === "mesure") { const r = geoMesureFictive(d, c, mt), depart = mt === "j0" ? null : geoMesures(d).find(x => x.type === "j0" && x.statut === "faite");
          m = { id: uid(), dossier_id: d.id, commerce_id: d.commerce_id, type: mt, statut: "faite", demandee_le: iso(Date.now()), faite_le: iso(Date.now()), resultats: r, synthese: r.synthese, cout_usd: 0, erreur: null };
          m.rapport_html = geoRapportDemo(c, m, depart); liste("mesures_geo").push(m); q.mesure_id = m.id;
          if (mt === "j0") { d.etapes.mesure_j0 = { etat: "fait", le: iso(Date.now()), par: "robot" }; d.j0_le = d.j0_le || m.faite_le;
            const cmd = liste("commandes_options").find(x => x.id === d.commande_id && !x.second_test_fait_le); if (cmd) cmd.second_test_prevu_le = plusJoursDemo(geoJ0(d), OPTIONS.visibilite_ia.second_test_jours || 90); }
          else if (["j7", "j30", "j90"].includes(mt)) d.etapes["mesure_" + mt] = { etat: "fait", le: iso(Date.now()), par: "robot" };
          geoMajProchaine(d); }
        liste("demandes_geo").push(q); jour(d.commerce_id, "VISIBILITE_IA_DEMANDE", { dossier: d.id, demande: q.id, type, mesure: mt, par: "console" });
        sauver(); return { demande: q.id, type, mesure: m && m.id, mesure_type: mt, webhook: true };
      },
      async adminGeoRapport(mid) { await init(); admin(); const m = liste("mesures_geo").find(x => x.id === mid); return m ? m.rapport_html || null : null; },
      async maVisibiliteIa() {
        await init(); assurerGeoDemo(); const c = cur(); if (!c) return null; const d = liste("dossiers_geo").find(x => x.commerce_id === c.id); if (!d) return null;
        return { origine: d.origine, ouvert_le: d.ouvert_le, livraison_prevue_le: d.livraison_prevue_le, livre_le: d.livre_le, prochaine_mesure_le: d.prochaine_mesure_le, questions_validees: !!d.questions_validees_le,
          etapes: GEO_ETAPES.map(([cle]) => ({ cle, fait: geoFait(d, cle) })), codes_attendus: Object.keys(d.plateformes).filter(k => d.plateformes[k].etat === "code_attendu").sort(),
          mesures: geoMesures(d).filter(m => m.statut === "faite").map(m => ({ type: m.type, faite_le: m.faite_le })), faites: geoEtat(d).faites, total: GEO_ETAPES.length,
          acces_google: !!d.acces_google_le, chrono_demarre: !!d.depart_le, livraison_prevue_a: geoComplements(d).livraison_prevue_a,
          prochaine_mesure_type: d.prochaine_mesure_type || null, mesures_prevues: geoComplements(d).mesures_prevues, regle_delai: d.regle_delai || "7_jours" };
      },
      async adminGarantieDelais() { await init(); admin(); passageServeurDemo(); return E.garantie_delais.map(delaisEtat).sort((a, b) => String(a.commerce).localeCompare(String(b.commerce))); },
      async adminDelais(cid, p) {
        await init(); admin(); if (!E.commerces[cid]) throw new Error("Commerce introuvable."); assurerDelaisDemo(); p = p || {};
        let g = E.garantie_delais.find(x => x.commerce_id === cid); if (!g) { g = { commerce_id: cid, acces_remis_le: null, photos_recues_le: null, fiche_optimisee_le: null }; E.garantie_delais.push(g); }
        // Cohérence des informations (22/10/2026) : mêmes règles que admin_delais (bloc « Cohérence des informations » de schema.sql).
        const v = {}; ["acces_remis_le", "photos_recues_le", "fiche_optimisee_le", "coherence_verifiee_le"].forEach(k => { if (k in p) v[k] = dateSaisie(p[k]); });
        if ("coherence_ecarts" in p) { const x = String(p.coherence_ecarts || "").trim(); if (x.length > 2000) throw new Error("Écarts trop longs (2 000 caractères au plus)."); v.coherence_ecarts = x || null; }
        const apres = Object.assign({}, g, v), k = E.commerces[cid];
        // Fiche en création (27/10/2026, déclencheur garantie_acces_fiche) : aucune date d'accès avant la vérification par Google, ensuite au plus tôt celle-ci.
        if (v.acces_remis_le && v.acces_remis_le !== g.acces_remis_le && k.fiche_google_demande_le) {
          if (!k.fiche_google_verifiee_le) throw new Error(MER.TEXTES.fiche_en_creation);
          if (v.acces_remis_le < k.fiche_google_verifiee_le) v.acces_remis_le = k.fiche_google_verifiee_le;
        }
        // Lot 1 (15/11/2026) : mêmes règles que admin_delais (bloc « Console : garde-fous ») : une date notée ou changée jamais dans le futur ;
        // une date de livraison (fiche optimisée, cohérence vérifiée) pas antidatée de plus de 7 jours ; les dates inchangées passent.
        const auj = jourParisDemo(Date.now()), ilYa7 = jourParisDemo(Date.now() - 7 * 24 * 3600000);
        // Lot 4 B (revue exploitant : sur un commerce de démonstration, tout enregistrement refusé « Date de livraison de plus de 7 jours ») : une date au jour renvoyée telle
        // qu'affichée (même jour de Paris que la date gardée, qui porte une heure) n'est pas un changement ; la date gardée reste.
        ["photos_recues_le", "fiche_optimisee_le", "coherence_verifiee_le"].forEach(k => { if (v[k] && g[k] && jourParisDemo(v[k]) === jourParisDemo(g[k])) v[k] = apres[k] = g[k]; });
        const change = k => v[k] && v[k] !== g[k];
        if (["acces_remis_le", "photos_recues_le", "fiche_optimisee_le", "coherence_verifiee_le"].some(k => change(k) && jourParisDemo(v[k]) > auj))
          throw new Error("Date dans le futur : notez le jour où c'est fait, aujourd'hui au plus tard.");
        // Lot 4 B (comme admin_delais) : « Accès remis le » au plus 7 jours en arrière, jamais déplacé une fois posé, sauf motif écrit (5 caractères).
        const motifD = String(p.motif || "").trim();
        if (motifD.length > 500) throw new Error("Motif trop long (500 caractères au plus).");
        const accesChange = "acces_remis_le" in v && v.acces_remis_le !== g.acces_remis_le && !(v.acces_remis_le && g.acces_remis_le && String(v.acces_remis_le).slice(0, 16) === new Date(g.acces_remis_le).toISOString().slice(0, 16));
        if (!accesChange && "acces_remis_le" in v) v.acces_remis_le = g.acces_remis_le;
        if (accesChange && motifD.length < 5) {
          if (v.acces_remis_le && jourParisDemo(v.acces_remis_le) < ilYa7) throw new Error("Accès remis il y a plus de 7 jours : écrivez le motif (5 caractères au moins), il est gardé au journal.");
          if (g.acces_remis_le) throw new Error("La date d'accès est déjà posée : pour la déplacer, écrivez le motif (5 caractères au moins), il est gardé au journal.");
        }
        if (accesChange && motifD) v.acces_motif = motifD;
        if (["fiche_optimisee_le", "coherence_verifiee_le"].some(k => change(k) && jourParisDemo(v[k]) < ilYa7))
          throw new Error("Date de livraison de plus de 7 jours : notez le vrai jour, au plus 7 jours en arrière.");
        if (apres.fiche_optimisee_le && !apres.coherence_verifiee_le && (apres.fiche_optimisee_le !== g.fiche_optimisee_le || g.coherence_verifiee_le))
          throw new Error("Vérifiez d'abord la cohérence du nom, de l'adresse, du téléphone et des horaires (fiche, site, Facebook, Instagram, Apple Plans), puis notez-la.");
        Object.assign(g, v);
        jour(cid, "GARANTIE_DELAIS_SAISIE", p); sauver(); return delaisEtat(g);
      },
      async adminManquement(id, statut, motif, reference) {
        await init(); admin(); const m = (E.manquements_garantie || []).find(x => String(x.id) === String(id) && x.statut === "a_appliquer"), t = String(motif || "").trim(), rf = String(reference || "").trim();
        if (!["applique", "ecarte"].includes(statut)) throw new Error("Décision inconnue : appliqué ou écarté.");
        if (statut === "ecarte" && !t) throw new Error("Écrivez pourquoi ce manquement est écarté.");
        // Lot 4 B (comme admin_manquement, bloc « Console : accès remis borné et référence Stripe ») : la référence Stripe est exigée.
        if (statut === "applique" && rf.length < 4) throw new Error("Notez la référence Stripe du mois offert (coupon, avoir ou facture), par exemple promo_… ou cn_….");
        if (rf.length > 120) throw new Error("Référence trop longue (120 caractères au plus).");
        if (m && statut === "applique") m.reference_stripe = rf;
        if (!m) throw new Error("Ce manquement est introuvable ou déjà traité.");
        m.statut = statut; m.motif = t || m.motif || null; m.decide_le = iso(Date.now());
        jour(m.commerce_id, statut === "applique" ? "MOIS_OFFERT_APPLIQUE" : "MANQUEMENT_ECARTE", { manquement: m.id, mois_offert: m.mois_offert, motif: t || null, reference: statut === "applique" ? rf : null }); sauver(); return { id: m.id, statut, mois_offert: m.mois_offert };
      },
      async adminReseaux(cid, reseaux) {
        await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable.");
        if (!Array.isArray(reseaux) || reseaux.some(r => !["instagram", "facebook", "tiktok"].includes(r))) throw new Error("Réseaux possibles : Instagram, Facebook, TikTok.");
        c.reseaux_retenus = [...new Set(reseaux)]; jour(cid, "RESEAUX_RETENUS", { reseaux: c.reseaux_retenus }); sauver(); return reseauxAutorises(c);
      },
      // Pays du commerce (31/10/2026) : mêmes règles que admin_pays (schema.sql, bloc « Créneaux réels ») : 'FR' ou 'BE', rien d'autre.
      async adminPays(cid, pays) {
        await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable.");
        const p = String(pays || "").trim().toUpperCase(); if (!["FR", "BE"].includes(p)) throw new Error("Pays possibles : France, Belgique.");
        c.pays = p; jour(cid, "PAYS_COMMERCE", { pays: p }); sauver(); return p;
      },
      // Métier du commerce (11/11/2026) : mêmes règles que admin_metier (schema.sql, bloc « Métier du commerce modifiable par l'administrateur »).
      async adminMetier(cid, metier) {
        await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable.");
        const m = String(metier || "").trim().toLowerCase(); if (!["restaurant", "beaute", "sport", "autre"].includes(m)) throw new Error("Métiers possibles : restaurant, beauté, sport, autre commerce.");
        if (c.metier !== m) { jour(cid, "METIER_COMMERCE", { avant: c.metier, apres: m }); c.metier = m; sauver(); } return m;
      },
      // WhatsApp saisi par l'équipe (12/11/2026, console v48) : mêmes règles que admin_regler_whatsapp (schema.sql, bloc « Console : WhatsApp saisi par
      // l'équipe et passage du robot des fiches Google ») ; numéro vide et case décochée : numéro effacé.
      async adminReglerWhatsapp(cid, numero, accord) {
        await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable.");
        const brut = String(numero == null ? "" : numero).trim(), wa = () => ({ whatsapp: whatsappActifDe(c), numero: c.whatsapp_numero || null, accord_le: c.whatsapp_accord_le || null });
        if (!brut && !accord) { if (!c.whatsapp_numero && !(c.notifications || {}).whatsapp) return { etat: "rien", ...wa() };
          const avant = c.whatsapp_numero || null; c.whatsapp_numero = null; c.whatsapp_accord_le = null; c.notifications = { ...(c.notifications || { email: true }), whatsapp: false };
          jour(cid, "WHATSAPP_EFFACE_PAR_EQUIPE", { avant, par: "console" }); sauver(); return { etat: "efface", ...wa() }; }
        if (!accord) throw new Error(PHRASE_WA_ACCORD_EQUIPE);
        const n = numeroWhatsapp(brut, paysDe(c.pays)); if (!n) throw new Error(phraseWhatsapp(paysDe(c.pays))); if (numeroFixe(n)) throw new Error(PHRASE_FIXE);
        if (whatsappActifDe(c) && c.whatsapp_numero === n) return { etat: "deja", ...wa() };
        const avant = c.whatsapp_numero || null; c.whatsapp_numero = n; c.whatsapp_accord_le = iso(Date.now()); c.notifications = { ...(c.notifications || { email: true }), whatsapp: true };
        jour(cid, "WHATSAPP_SAISI_PAR_EQUIPE", { numero: n, avant, par: "console", accord: "recueilli par l'équipe", texte: "Le client a donné son accord à l'équipe pour recevoir les alertes de BoostImpact sur WhatsApp au numéro " + n });
        sauver(); return { etat: avant ? "modifie" : "saisi", ...wa() };
      },
      // Passage du robot des fiches Google (12/11/2026, table passages_robots) : la démonstration n'a pas de robot ; elle simule un passage à la dernière
      // demi-heure (bilan « demonstration »), sauf si la graine en porte un (E.passages_robots).
      async adminPassagesRobots() { await init(); admin(); return E.passages_robots || { liens_google: { passe_le: iso(Math.floor(Date.now() / 18e5) * 18e5), bilan: { demonstration: true } } }; },
      // Alertes ouvertes utiles à la fiche d'un client (12/11/2026) : celles de CE commerce, et les fiches Google reçues sans commerce trouvé.
      async adminAlertesClient(cid) { await init(); admin();
        return liste("alertes_exploitant").filter(a => !a.vue_le && (a.commerce_id === cid || (a.type === "FICHE_A_RELIER" && !a.commerce_id))).map(a => ({ id: a.id, type: a.type, commerce_id: a.commerce_id || null, detail: a.detail || {}, texte: texteAlerte(a), date: a.cree_le })); },
      async adminDelegation(cid, signee) {
        await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable.");
        if (signee && !offreDe(cid).delegation) throw new Error("Le mode délégation est réservé à l'offre Premium.");
        c.delegation_signee_le = signee ? (c.delegation_signee_le || iso(Date.now())) : null; jour(cid, signee ? "DELEGATION_SIGNEE" : "DELEGATION_RETIREE", {}); sauver();
        return { commerce_id: cid, delegation_signee_le: c.delegation_signee_le };
      },
      async adminCommentairesEquipe() {
        await init(); admin();
        return liste("commentaires").filter(x => x.statut === "a_valider" && offreDe(x.commerce_id).delegation).map(x => ({ id: x.id, commerce_id: x.commerce_id, commerce: (E.commerces[x.commerce_id] || {}).nom,
          reseau: x.reseau, categorie: x.categorie, auteur: x.auteur, texte: x.texte, reponse_proposee: x.reponse_proposee, recu_le: x.cree_le }));
      },
      async adminCommentaireDecider(id, decision, texte) {
        await init(); admin(); const x = liste("commentaires").find(y => y.id === id);
        if (!x || !offreDe(x.commerce_id).delegation) throw new Error("Réservé aux commerces Premium : ailleurs, le commerçant décide.");
        appliquerDecisionCommentaire(x, decision, texte); jour(x.commerce_id, "COMMENTAIRE_" + String(decision).toUpperCase(), { commentaire: id, par: "equipe" }); sauver(); return x.statut;
      },
      async adminGaranties() { await init(); admin(); passageServeurDemo(); return E.garanties_avis.map(garantieEtat); },
      async adminGarantie(cid, p) {
        await init(); admin(); if (!E.commerces[cid]) throw new Error("Commerce introuvable."); assurerGarantieDemo(); p = p || {};
        const date = s => { if (s == null || s === "") return null; if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s + "T12:00:00Z"))) throw new Error("Date (AAAA-MM-JJ) ou nombre illisible."); return s; };
        const nb = s => { if (s == null || s === "") return null; const n = Number(s); if (!Number.isInteger(n) || n < 0) throw new Error("Date (AAAA-MM-JJ) ou nombre illisible."); return n; };
        if (p.capture && !String(p.capture).startsWith(cid + "/garantie/")) throw new Error("La capture se range dans le dossier du commerce, sous garantie/.");
        let g = E.garanties_avis.find(x => x.commerce_id === cid);
        if (!g) { if (!date(p.depart_le) || nb(p.avis_depart) == null) throw new Error("Pour démarrer la garantie : la date de mise en route et le nombre d'avis de la capture datée.");
          g = { commerce_id: cid, depart_le: p.depart_le, avis_depart: nb(p.avis_depart), capture: null, cartes_en_place_le: null, prolongation_jours: 0, avis_releve: null, releve_le: null, rappel_j45_le: null, echue_le: null, atteinte_le: null };
          E.garanties_avis.push(g); jour(cid, "GARANTIE_AVIS_DEMARREE", { depart_le: g.depart_le, avis_depart: g.avis_depart }); }
        if ("depart_le" in p && date(p.depart_le)) g.depart_le = date(p.depart_le);
        if ("avis_depart" in p && nb(p.avis_depart) != null) g.avis_depart = nb(p.avis_depart);
        if ("capture" in p) g.capture = p.capture || null;
        if ("cartes_en_place_le" in p) g.cartes_en_place_le = date(p.cartes_en_place_le);
        if ("avis_releve" in p) { g.avis_releve = nb(p.avis_releve); g.releve_le = g.avis_releve == null ? null : date(p.releve_le) || jourParis(Date.now()); }
        if ("prolongation_jours" in p && nb(p.prolongation_jours) != null) { if (nb(p.prolongation_jours) > 365) throw new Error("Date (AAAA-MM-JJ) ou nombre illisible."); g.prolongation_jours = nb(p.prolongation_jours); }
        sauver(); return garantieEtat(g);
      },
    };

    // ---- Photos (démonstration) : envoi SIMULÉ (RENOM_ENVOI.simuler, rien ne quitte le navigateur), puis mêmes règles que deposer_photos ; chaque
    // photo enregistrée suit la même chaîne que dans le service (faux n8n + faux rendu : un contenu « à valider »).
    const photosRecues = new Map();   // chemin -> fichier « reçu dans le seau » (simulé, mémoire de la page)
    const photosDemo = {
      async envoyerPhoto(f, o = {}) {
        await init(); const c = cur(); pasEnPause(c);
        const k = await window.RENOM_ENVOI.controler(f); if (k.genre !== "photo") throw new Error(PHOTOS.PHRASES.format); if (k.raison) throw new Error(PHOTOS.PHRASES.lourde);
        const chemin = c.id + "/" + (o.nom || window.RENOM_ENVOI.nomPhoto(f));
        if (photosRecues.has(chemin)) { if (o.onProgress) o.onProgress(f.size, f.size); return { chemin, deja: true }; }
        await window.RENOM_ENVOI.simuler({ fichier: f, onProgress: o.onProgress, onEtat: o.onEtat, signal: o.signal, debit: o.debit || window.RENOM_DEBIT_DEMO || 64 * 1024 * 1024 });
        photosRecues.set(chemin, f); return { chemin, deja: false };
      },
      async deposerPhotos(details) {
        await init(); const c = cur(); pasEnPause(c);
        const refus = PHOTOS.controler(c.id, details, ch => photosRecues.has(ch), ch => mine("photos").some(p => p.chemin === ch)); if (refus) throw new Error(refus);
        const ids = [];
        // Places calculées avant l'enregistrement (01/11/2026, tour 7 Premium ; même règle que enregistrer_photos) : au-delà, la photo est gardée
        // d'emblée pour le mois suivant (« refusee », motif « plafond »), sans rendu.
        const t0 = debutMois(mois0()), enPrep = E.photos.filter(p => p.commerce_id === c.id && ["a_traiter", "en_cours"].includes(p.statut) && Date.parse(p.cree_le) >= t0 && !E.contenus.some(x => x.photo_id === p.id)).length;
        let places = Math.max(0, (+(OFFRES[c.offre_id] || {}).publications || 0) - usage(c) - enPrep), gardees = 0;
        for (const x of details) {
          const f = photosRecues.get(x.chemin), url = f && f.size < 1.5e6 ? await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }) : null;
          const garde = places-- <= 0; if (garde) gardees++;
          const p = Object.assign({ id: uid(), commerce_id: c.id, chemin: x.chemin, nom_fichier: String(x.nom || "").trim().slice(0, 200) || null, precision: PHOTOS.precision(x.precision), occasion: PHOTOS.precision(x.occasion), statut: "a_traiter", source: "espace", cree_le: new Date().toISOString(), url }, garde ? { statut: "refusee", refus_motif: "plafond" } : {});
          E.photos.unshift(p); ids.push(p.id);
          if (!garde) setTimeout(() => { if (p.statut === "a_traiter") { faux.creation(p); sauver(); } }, 1200);   // faux n8n + faux rendu
          if (!c.marque && url) proposerKitDemo(c, url).catch(() => {});   // premières photos : le kit de marque est proposé (comme le moteur)
        }
        jour(c.id, "PHOTOS_DEPOSEES", { photos: details.length, ce_mois: details.length - gardees, gardees, simule: true }); sauver();
        return { nb_photos: details.length, ids, ce_mois: details.length - gardees, gardees };
      },
      async deposer(f) { const r = await photosDemo.envoyerPhoto(f); return photosDemo.deposerPhotos([{ chemin: r.chemin, nom: f.name, taille: f.size }]); },
      // ---- Autorisation photos (22/10/2026, CGV article 11) : mêmes règles que autoriser_photos, admin_retirer_autorisation_photos et
      // admin_deposer_photos (bloc « Autorisation photos » de schema.sql). Dépôt de l'équipe : envoi SIMULÉ, puis la même chaîne qu'une photo du commerçant.
      // ---- Alertes WhatsApp (22/10/2026) : mêmes règles que regler_whatsapp (bloc « Alertes WhatsApp » de schema.sql). Démonstration : rien ne part.
      async reglerWhatsapp(numero, accord) {
        await init(); const c = cur(); if (!c) throw new Error(PHOTOS.PHRASES.introuvable);
        if (accord) { const n = numeroWhatsapp(numero, paysDe(c.pays)); if (!n) throw new Error(phraseWhatsapp(paysDe(c.pays)));   // pays absent de la graine : France, comme commerces.pays par défaut (v47)
          if (numeroFixe(n)) throw new Error(PHRASE_FIXE);
          if (!(c.notifications && c.notifications.whatsapp && c.whatsapp_numero === n)) { c.whatsapp_numero = n; c.whatsapp_accord_le = iso(Date.now()); c.notifications = { ...(c.notifications || { email: true }), whatsapp: true };
            jour(c.id, "WHATSAPP_ACCORD", { numero: n, texte: "Je souhaite recevoir les alertes de BoostImpact sur WhatsApp au numéro " + n, version_cgv: "26 octobre 2026" }); } }
        else if (c.whatsapp_numero || (c.notifications || {}).whatsapp) { c.whatsapp_numero = null; c.whatsapp_accord_le = null; c.notifications = { ...(c.notifications || { email: true }), whatsapp: false }; jour(c.id, "WHATSAPP_RETRAIT", {}); }
        sauver(); return { whatsapp: !!(c.notifications || {}).whatsapp, numero: c.whatsapp_numero || null, accord_le: c.whatsapp_accord_le || null };
      },
      // ---- Notifications de l'application (15/11/2026) : mêmes règles que enregistrer_abonnement_push et retirer_abonnement_push (bloc « Notifications
      // push de l'application » de schema.sql). Démonstration : l'abonnement est noté dans ce navigateur, rien ne part.
      async enregistrerPush(a) {
        await init(); const c = cur(); if (!c) throw new Error(PHOTOS.PHRASES.introuvable);
        if (!a || !/^https:\/\//.test(a.endpoint || "") || !a.p256dh || !a.auth) throw new Error("Abonnement illisible.");
        c.push_abonnements = (c.push_abonnements || []).filter(x => x.endpoint !== a.endpoint).concat([{ endpoint: a.endpoint, cree_le: iso(Date.now()) }]);
        jour(c.id, "PUSH_ABONNEMENT", { simule: true }); sauver(); return { id: "demo-" + c.push_abonnements.length, commerce_id: c.id };
      },
      async retirerPush(endpoint) {
        await init(); const c = cur(); if (!c) return false; const avant = (c.push_abonnements || []).length;
        c.push_abonnements = (c.push_abonnements || []).filter(x => x.endpoint !== endpoint); if (c.push_abonnements.length === avant) return false;
        jour(c.id, "PUSH_RETRAIT", {}); sauver(); return true;
      },
      async autoriserPhotos() {
        await init(); const c = cur(); if (!c) throw new Error(PHOTOS.PHRASES.introuvable);
        // Comme autoriser_photos (26/10/2026) : périmètre selon l'offre ; une autorisation « fiche_google » s'étend quand le commerçant recoche en Croissance ou Premium.
        const per = (OFFRES[c.offre_id] || {}).reseaux_sociaux === false ? "fiche_google" : "fiche_site_reseaux";
        if (!c.photos_autorisees_le || (per === "fiche_site_reseaux" && c.photos_autorisees_perimetre !== per)) {
          c.photos_autorisees_le = new Date().toISOString(); c.photos_autorisees_perimetre = per; jour(c.id, "PHOTOS_AUTORISEES", { version_cgv: "26 octobre 2026", perimetre: per }); sauver(); }
        return { photos_autorisees_le: c.photos_autorisees_le, perimetre: c.photos_autorisees_perimetre || per };
      },
      // Autorisation photos enregistrée par l'équipe (12/11/2026, console v48) : mêmes règles que admin_autoriser_photos (même écriture que
      // autoriser_photos, case de l'équipe obligatoire, journal PHOTOS_AUTORISEES_PAR_EQUIPE).
      async adminAutoriserPhotos(cid, accord) {
        await init(); admin(); if (!accord) throw new Error(PHRASE_PHOTOS_ACCORD_EQUIPE); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable.");
        const per = (OFFRES[c.offre_id] || {}).reseaux_sociaux === false ? "fiche_google" : "fiche_site_reseaux";
        if (!c.photos_autorisees_le || (per === "fiche_site_reseaux" && c.photos_autorisees_perimetre !== per)) {
          c.photos_autorisees_le = iso(Date.now()); c.photos_autorisees_perimetre = per; jour(cid, "PHOTOS_AUTORISEES_PAR_EQUIPE", { version_cgv: "26 octobre 2026", perimetre: per, par: "console", accord: "recueilli par l'équipe" }); sauver();
          return { etat: "autorisee", photos_autorisees_le: c.photos_autorisees_le, perimetre: per }; }
        return { etat: "deja", photos_autorisees_le: c.photos_autorisees_le, perimetre: c.photos_autorisees_perimetre || per };
      },
      // Accord vidéo IA (14/11/2026) : mêmes règles que regler_accord_video_ia et admin_regler_accord_video_ia (schema.sql, bloc « Accord vidéo IA
      // et CGV du 14 novembre 2026 ») : date ou null, journal VIDEO_IA_ACCORDEE, VIDEO_IA_RETIREE, VIDEO_IA_ACCORD_PAR_EQUIPE ; « deja », « rien ».
      async reglerAccordVideoIa(oui) {
        await init(); const c = cur(); if (!c) throw new Error(PHOTOS.PHRASES.introuvable);
        if (oui) { if (c.video_ia_accord_le) return { etat: "deja", video_ia_accord_le: c.video_ia_accord_le };
          c.video_ia_accord_le = iso(Date.now()); jour(c.id, "VIDEO_IA_ACCORDEE", { origine: "espace", version_cgv: VERSION_CGV, outil: "Higgsfield" }); sauver(); return { etat: "accorde", video_ia_accord_le: c.video_ia_accord_le }; }
        if (!c.video_ia_accord_le) return { etat: "rien", video_ia_accord_le: null };
        const avant = c.video_ia_accord_le; c.video_ia_accord_le = null; jour(c.id, "VIDEO_IA_RETIREE", { origine: "espace", avant }); sauver(); return { etat: "retire", video_ia_accord_le: null };
      },
      async adminReglerAccordVideoIa(cid, donner, accordClient) {
        await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable.");
        if (donner) { if (!accordClient) throw new Error(PHRASE_VIA_ACCORD_EQUIPE); if (c.video_ia_accord_le) return { etat: "deja", video_ia_accord_le: c.video_ia_accord_le };
          c.video_ia_accord_le = iso(Date.now()); jour(cid, "VIDEO_IA_ACCORD_PAR_EQUIPE", { version_cgv: VERSION_CGV, outil: "Higgsfield", par: "console", accord: "recueilli par l'équipe" }); sauver(); return { etat: "accorde", video_ia_accord_le: c.video_ia_accord_le }; }
        if (!c.video_ia_accord_le) return { etat: "rien", video_ia_accord_le: null };
        const avant = c.video_ia_accord_le; c.video_ia_accord_le = null; jour(cid, "VIDEO_IA_RETIREE", { par: "console", avant }); sauver(); return { etat: "retire", video_ia_accord_le: null };
      },
      async adminRetirerAutorisationPhotos(cid) {
        await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable.");
        if (c.photos_autorisees_le) { c.photos_autorisees_le = null; c.photos_autorisees_perimetre = null; jour(cid, "PHOTOS_AUTORISATION_RETIREE", {}); sauver(); } return { photos_autorisees_le: null };
      },
      async adminEnvoyerPhoto(cid, f, o = {}) {
        await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable."); if (!c.photos_autorisees_le) throw new Error(PHOTOS.PHRASES.sans_autorisation);
        const k = await window.RENOM_ENVOI.controler(f); if (k.genre !== "photo") throw new Error(PHOTOS.PHRASES.format); if (k.raison) throw new Error(PHOTOS.PHRASES.lourde);
        const chemin = cid + "/" + (o.nom || window.RENOM_ENVOI.nomPhoto(f));
        await window.RENOM_ENVOI.simuler({ fichier: f, onProgress: o.onProgress, onEtat: o.onEtat, signal: o.signal, debit: o.debit || window.RENOM_DEBIT_DEMO || 64 * 1024 * 1024 });
        photosRecues.set(chemin, f); return { chemin, deja: false };
      },
      async adminDeposerPhotos(cid, details) {
        await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable."); if (!c.photos_autorisees_le) throw new Error(PHOTOS.PHRASES.sans_autorisation);
        pasEnPause(c);
        const refus = PHOTOS.controler(cid, details, ch => photosRecues.has(ch), ch => E.photos.some(p => p.chemin === ch)); if (refus) throw new Error(refus);
        const ids = [];
        for (const x of details) {
          const f = photosRecues.get(x.chemin), url = f && f.size < 1.5e6 ? await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }) : null;
          const p = { id: uid(), commerce_id: cid, chemin: x.chemin, nom_fichier: String(x.nom || "").trim().slice(0, 200) || null, statut: "a_traiter", source: "equipe", cree_le: new Date().toISOString(), url };
          E.photos.unshift(p); ids.push(p.id);
          setTimeout(() => { if (p.statut === "a_traiter") { faux.creation(p); sauver(); } }, 1200);   // faux n8n + faux rendu
        }
        jour(cid, "PHOTOS_DEPOSEES", { photos: details.length, par: "equipe", simule: true }); sauver();
        return { nb_photos: details.length, ids };
      },
    };

    // ---- Mise en route claire (27/10/2026) : mêmes règles que le bloc SQL « Mise en route claire et travail visible ». Graine : un commerce sans la
    // colonne (graine écrite avant ce bloc) a son nom tenu pour confirmé ; « nom_confirme_le: null » dans la graine (nouveau@demo) le laisse à confirmer.
    function assurerMiseEnRouteClaire() {
      if (!E || E.mer_claire_v) return; E.mer_claire_v = 1;
      Object.values(E.commerces || {}).forEach(c => { if (!("nom_confirme_le" in c)) c.nom_confirme_le = c.cree_le || iso(Date.now());
        ["fiche_google_demande_le", "fiche_google_cas", "fiche_google_verifiee_le", "photos_autorisation_refusee_le"].forEach(k => { if (!(k in c)) c[k] = null; }); });
      sauver();
    }
    // ---- Fiche Google du client venu du site (28/10/2026) : colonnes du bloc SQL ajoutées à une graine plus ancienne (vides).
    function assurerFicheGoogle() {
      if (!E || E.fiche_google_v) return; E.fiche_google_v = 1;
      Object.values(E.commerces || {}).forEach(c => { ["fiche_google_lien", "fiche_google_lien_le", "fiche_google_a_resoudre_le", "fiche_google_a_identifier_le", "google_place_id_source"].forEach(k => { if (!(k in c)) c[k] = null; });
        if (!("google_place_id" in c)) c.google_place_id = null; });
      (E.photos || []).forEach(x => { if (!("refus_motif" in x)) x.refus_motif = null; });
      sauver();
    }
    // Une seule tâche ouverte « Identifier la fiche Google » par commerce (tache_identifier_fiche de schema.sql).
    const tacheIdentifierDemo = (c, detail) => { const a = liste("alertes_exploitant").find(x => x.commerce_id === c.id && x.type === "FICHE_GOOGLE_A_IDENTIFIER" && !x.vue_le);
      if (a) a.detail = detail; else alerteDemo("FICHE_GOOGLE_A_IDENTIFIER", c.id, detail);
      c.fiche_google_a_resoudre_le = null; c.fiche_google_a_identifier_le = c.fiche_google_a_identifier_le || iso(Date.now()); };
    const fermerTachesDemo = (cid, type) => liste("alertes_exploitant").filter(x => x.commerce_id === cid && x.type === type && !x.vue_le).forEach(x => { x.vue_le = iso(Date.now()); });
    const alerteDemo = (type, cid, detail) => { const a = { id: uid(), type, commerce_id: cid, detail, vue_le: null, cree_le: iso(Date.now()) }; liste("alertes_exploitant").unshift(a); return a; };
    // ---- Changement d'offre complet (27/10/2026) : même logique que changer_offre_commerce (bloc SQL « Changement d'offre en libre-service et mode
    // délégation dans l'espace ») : réseaux retenus recalculés, publications hors offre annulées ou réduites (déjà envoyées : alerte), dépôts vidéo
    // et demandes de vidéo d'avis arrêtés sans vidéo, délégation retirée hors Premium, journal OFFRE_CHANGEE. L'étape « réseaux » suit l'offre d'elle-même.
    const MOTIF_SANS_VIDEO = "Votre offre ne comprend plus de vidéo.", MOTIF_HORS_OFFRE = "Offre changée : réseau hors de la nouvelle offre.";
    function changerOffreDemo(cid, offre, origine) {
      const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable."); const av = OFFRES[c.offre_id] || {}, ap = OFFRES[offre];
      if (!ap) throw new Error("Offre inconnue : " + offre);
      if (c.offre_id === offre) return { change: false, offre };
      const ancienne = c.offre_id, sens = (ap.publications + ap.videos) >= ((av.publications || 0) + (av.videos || 0)) ? "montee" : "descente";
      c.offre_id = offre;
      const ret = ap.reseaux_sociaux === false ? [] : !Array.isArray(c.reseaux_retenus) || !c.reseaux_retenus.length ? null : c.reseaux_retenus.filter(r => r !== "tiktok" || ap.tiktok !== false);
      c.reseaux_retenus = ret;
      const aut = reseauxAutorises(c); let annulees = 0, reduites = 0, aRetirer = 0, depots = 0, va = 0, deleg = false;
      E.publications.filter(x => x.commerce_id === cid && ["programme", "envoye"].includes(x.statut) && x.reseaux.some(r => !aut.includes(r))).forEach(x => {
        if (x.statut === "envoye" || Object.keys(x.publie_reseaux || {}).length) { aRetirer++; return; }
        const reste = x.reseaux.filter(r => aut.includes(r));
        if (reste.length) { x.reseaux = reste; reduites++; return; }
        x.statut = "annule"; x.erreur = MOTIF_HORS_OFFRE; annulees++;
        const ct = E.contenus.find(y => y.id === x.contenu_id); if (ct && ct.statut === "programme") ct.statut = "approuve";
      });
      if (!ap.videos) {
        liste("depots_video").filter(d => d.commerce_id === cid && !d.contenu_id && ["en_envoi", "envoye", "en_montage"].includes(d.statut)).forEach(d => {
          d.statut = "annule"; d.motif = MOTIF_SANS_VIDEO; jour(cid, "DEPOT_VIDEO_ANNULE", { depot: d.id, raison: "offre_sans_video" }); depots++; });
        vaDemandes().filter(x => x.commerce_id === cid && x.statut === "a_traiter").forEach(x => { x.statut = "refusee"; x.motif = MOTIF_SANS_VIDEO; va++; });
      }
      if (!ap.delegation && c.delegation_signee_le) { c.delegation_signee_le = null; c.delegation_version_cgv = null; jour(cid, "DELEGATION_RETIREE", { raison: "changement_offre", origine }); deleg = true; }
      const r = { change: true, offre, ancienne, sens, origine, reseaux_retenus: ret, publications_annulees: annulees, publications_reduites: reduites, publications_a_retirer: aRetirer,
        depots_annules: depots, videos_avis_refusees: va, delegation_retiree: deleg };
      jour(cid, "OFFRE_CHANGEE", Object.assign({}, r, { change: undefined }));
      if (aRetirer) alerteDemo("PUBLICATIONS_A_RETIRER", cid, { nombre: aRetirer, offre, ancienne });
      return r;
    }
    const offresDemo = {
      // Mode délégation activé ou désactivé par le commerçant (Premium) : mêmes règles que regler_delegation.
      async reglerDelegation(active) {
        await init(); const c = cur(); if (!c) throw new Error(PHOTOS.PHRASES.introuvable);
        if (active) {
          if (!(OFFRES[c.offre_id] || {}).delegation) throw new Error("Le mode délégation est réservé à l'offre Premium.");
          if (!c.delegation_signee_le) { c.delegation_signee_le = iso(Date.now()); c.delegation_version_cgv = VERSION_CGV;
            jour(c.id, "DELEGATION_SIGNEE", { origine: "espace", version_cgv: VERSION_CGV, heures: CONDITIONS.delegation.publication_auto_heures }); }
        } else if (c.delegation_signee_le) { c.delegation_signee_le = null; c.delegation_version_cgv = null; jour(c.id, "DELEGATION_RETIREE", { origine: "espace" }); }
        sauver(); return { delegation_signee_le: c.delegation_signee_le, version_cgv: c.delegation_version_cgv || null };
      },
    };
    // Langue des publications (01/11/2026, tour 7 Premium ; mêmes règles que regler_langues_publication) : fr, nl, ou les deux, dans cet ordre.
    const languesNormales = l => { if (!Array.isArray(l) || l.some(x => !["fr", "nl"].includes(x))) throw new Error("Langue de publication inconnue : français, néerlandais, ou les deux.");
      const r = ["fr", "nl"].filter(x => l.includes(x)); if (!r.length) throw new Error("Choisissez au moins une langue de publication."); return r; };
    const reglerLanguesDemo = (c, l, par) => { const r = languesNormales(l); if (JSON.stringify(c.langues_publication || ["fr"]) !== JSON.stringify(r)) { c.langues_publication = r; jour(c.id, "LANGUES_PUBLICATION", { langues: r, par }); sauver(); } return r; };
    const merDemo = {
      async reglerLanguesPublication(l) { await init(); const c = cur(); if (!c) throw new Error(PHOTOS.PHRASES.introuvable); return reglerLanguesDemo(c, l, "commercant"); },
      async adminReglerLanguesPublication(cid, l) { await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable."); return reglerLanguesDemo(c, l, "equipe"); },
      async confirmerNom(nom) {
        await init(); const c = cur(); if (!c) throw new Error(PHOTOS.PHRASES.introuvable); const n = MER.nom(nom), t = iso(Date.now());
        jour(c.id, "NOM_CONFIRME", { nom: n, modifie: c.nom !== n }); c.nom = n; c.nom_confirme_le = t; sauver(); return { nom: n, nom_confirme_le: t };
      },
      async demanderRappel(sujet, telephone, offre) {
        await init(); const c = cur(); if (!c) throw new Error(PHOTOS.PHRASES.introuvable); const s_ = sujet || "mise_en_route";
        if (!MER.SUJETS.includes(s_)) throw new Error(MER.TEXTES.sujet);
        // Changement d'offre (01/11/2026, comme demander_rappel(p_sujet, p_telephone, p_offre)) : offre plus haute, numéro facultatif (celui du commerce).
        const ordre = ["essentiel", "standard", "premium"], chg = s_ === "changement_offre", o = chg ? offre : null;
        if (chg && (ordre.indexOf(o) < 0 || ordre.indexOf(o) <= ordre.indexOf(c.offre_id))) throw new Error("Offre demandée inconnue, ou déjà la vôtre.");
        const n = chg ? numeroWhatsapp(telephone, paysDe(c.pays)) || c.whatsapp_numero || numeroWhatsapp(c.contact, paysDe(c.pays)) || null : MER.telephone(telephone, paysDe(c.pays));   // pays absent de la graine : France, comme commerces.pays par défaut
        const deja = liste("alertes_exploitant").find(a => a.commerce_id === c.id && a.type === "RAPPEL_DEMANDE" && (a.detail || {}).sujet === s_ && !a.vue_le && Date.now() - Date.parse(a.cree_le) < 24 * 3600000);   // même sujet seulement
        if (deja) { deja.detail = Object.assign({}, deja.detail, { telephone: n }, o ? { offre: o } : {}); sauver(); return { deja: true, cree_le: deja.cree_le, telephone: n, offre: o }; }   // « Modifier le numéro »
        const a = alerteDemo("RAPPEL_DEMANDE", c.id, Object.assign({ sujet: s_, telephone: n }, o ? { offre: o, offre_actuelle: c.offre_id } : {})); jour(c.id, "RAPPEL_DEMANDE", Object.assign({ sujet: s_ }, o ? { offre: o } : {})); sauver();
        return { deja: false, cree_le: a.cree_le, telephone: n, offre: o };
      },
      // Jour et heure du rappel (01/11/2026, tour 7 Premium ; mêmes règles que preciser_rappel) : jour ouvré, 9-18 ou 15-17.
      async preciserRappel(sujet, jour) {
        await init(); const c = cur(); if (!c) throw new Error(PHOTOS.PHRASES.introuvable); const v = String(jour || "aujourdhui"), cr = /_15_17$/.test(v) ? "15-17" : "9-18";
        const jr = joursRappelA(Date.now(), c.pays), j = jr[v.replace(/_15_17$/, "")];   // tour 11 : deux jours ouvrés, décalés après 17 h
        if (!j) throw new Error("Choisissez un des jours proposés.");
        const a = liste("alertes_exploitant").filter(x => x.commerce_id === c.id && x.type === "RAPPEL_DEMANDE" && (x.detail || {}).sujet === sujet && !x.vue_le && Date.now() - Date.parse(x.cree_le) < 24 * 3600000).sort((x, y) => y.cree_le.localeCompare(x.cree_le))[0];
        if (!a) throw new Error("Aucune demande de rappel en cours sur ce sujet.");
        a.detail = Object.assign({}, a.detail, { jour: j, creneau: cr }); sauver(); return { jour: j, creneau: cr, telephone: a.detail.telephone };
      },
      // Même lecture que ma_demande_rappel : date de la dernière demande de rappel du commerce sur ce sujet, vue ou non par l'équipe ; "" sinon.
      async demandeRappel(sujet) {
        await init(); const c = cur(); if (!c) return "";
        return liste("alertes_exploitant").filter(a => a.commerce_id === c.id && a.type === "RAPPEL_DEMANDE" && (a.detail || {}).sujet === sujet).map(a => a.cree_le).sort().pop() || "";
      },
      async demanderFicheGoogle(cas) {
        await init(); const c = cur(); if (!c) throw new Error(PHOTOS.PHRASES.introuvable);
        if (cas === "annuler") { if (c.fiche_google_verifiee_le) throw new Error(MER.TEXTES.deja_verifiee);
          if (c.fiche_google_demande_le) { c.fiche_google_demande_le = null; c.fiche_google_cas = null; fermerTachesDemo(c.id, "FICHE_GOOGLE_A_CREER"); jour(c.id, "FICHE_GOOGLE_DEMANDE_ANNULEE", {}); sauver(); } return { demande_le: null }; }
        if (!MER.CAS_FICHE.includes(cas)) throw new Error(MER.TEXTES.cas);
        if (c.fiche_google_demande_le) return { demande_le: c.fiche_google_demande_le, cas: c.fiche_google_cas, deja: true };
        c.fiche_google_demande_le = iso(Date.now()); c.fiche_google_cas = cas;
        // 28/10/2026 : une seule tâche ouverte par commerce (bloc SQL « Fiche Google du client venu du site et photos hors sujet »).
        const ouverte = liste("alertes_exploitant").find(a => a.commerce_id === c.id && a.type === "FICHE_GOOGLE_A_CREER" && !a.vue_le);
        if (ouverte) ouverte.detail = { cas }; else alerteDemo("FICHE_GOOGLE_A_CREER", c.id, { cas });
        jour(c.id, "FICHE_GOOGLE_DEMANDEE", { cas }); sauver();
        return { demande_le: c.fiche_google_demande_le, cas, deja: false };
      },
      // Lien de la fiche Google collé par le commerçant : mêmes règles que enregistrer_fiche_google (schema.sql). En démonstration, aucune recherche
      // automatique ne part (ni n8n, ni GitHub Actions) : un lien court reste « recherche » ; serveurFicheGoogleResolue imite le retour du moteur.
      async enregistrerFicheGoogle(texte) {
        await init(); const c = cur(); if (!c) throw new Error(PHOTOS.PHRASES.introuvable);
        if (!String(texte == null ? "" : texte).trim()) throw new Error(FG.TEXTES.vide);
        const u = FG.lien(texte); if (!u) throw new Error(FG.TEXTES.format);
        if (c.fiche_google_lien === u && c.fiche_google_lien_le) return { lien: u, etat: FG.etat(c), deja: true };
        const pid = FG.placeId(u), t = iso(Date.now());
        fermerTachesDemo(c.id, "FICHE_GOOGLE_A_IDENTIFIER");
        const garde = !!pid && !!c.google_place_id && c.google_place_id !== pid && (c.google_place_id_source || "console") === "console";
        Object.assign(c, { fiche_google_lien: u, fiche_google_lien_le: t, fiche_google_a_identifier_le: null, fiche_google_a_resoudre_le: pid ? null : t });
        if (pid && !garde) { if (c.google_place_id !== pid) c.google_place_id_source = "lien"; c.google_place_id = pid; }
        if (garde) tacheIdentifierDemo(c, { lien: u, motif: "different", candidats: [pid] });
        jour(c.id, "FICHE_GOOGLE_LIEN", { etat: FG.etat(c), identifiant_dans_le_lien: !!pid }); sauver();
        return { lien: u, etat: FG.etat(c), deja: false };
      },
      // Démonstration et tests seulement : imite fiche_google_resolue (appelée en vrai par GitHub Actions avec la clé secrète).
      async serveurFicheGoogleResolue(cid, lien, placeId, motif, candidats) {
        await init(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable."); if (c.fiche_google_lien !== lien) return { perime: true };
        const pid = FG.ID.test(placeId || "") ? placeId : null;
        if (pid && (!c.google_place_id || c.google_place_id === pid || (c.google_place_id_source || "console") !== "console")) {
          if (c.google_place_id !== pid) c.google_place_id_source = "recherche"; Object.assign(c, { google_place_id: pid, fiche_google_a_resoudre_le: null, fiche_google_a_identifier_le: null });
          fermerTachesDemo(cid, "FICHE_GOOGLE_A_IDENTIFIER"); jour(cid, "FICHE_GOOGLE_IDENTIFIEE", { par: "recherche" }); sauver(); return { etat: "reconnue" };
        }
        const m = pid ? "different" : (motif in MOTIFS_FICHE ? motif : "inconnu"), cand = (pid ? [pid] : []).concat((candidats || []).filter(x => FG.ID.test(x)).slice(0, 3));
        tacheIdentifierDemo(c, { lien, motif: m, candidats: cand }); jour(cid, "FICHE_GOOGLE_A_IDENTIFIER", { motif: m }); sauver(); return { etat: "equipe", motif: m };
      },
      async refuserAutorisationPhotos() {
        await init(); const c = cur(); if (!c) throw new Error(PHOTOS.PHRASES.introuvable); c.photos_autorisation_refusee_le = c.photos_autorisation_refusee_le || iso(Date.now());
        jour(c.id, "PHOTOS_AUTORISATION_REFUSEE", {}); sauver(); return { photos_autorisation_refusee_le: c.photos_autorisation_refusee_le };
      },
      async deciderAvisSensible(id, decision) {
        await init(); const c = cur(); if (!c) throw new Error(PHOTOS.PHRASES.introuvable); if (!["approuve", "en_parler"].includes(decision)) throw new Error(MER.TEXTES.decision);
        const a = mine("avis").find(x => x.id === id); if (!a) throw new Error(MER.TEXTES.avis_introuvable);
        const o = OFFRES[c.offre_id] || {}; if (o.avis_equipe || o.delegation) throw new Error(MER.TEXTES.avis_equipe);
        if (a.statut !== "humain" || !a.propose_le || !String(a.reponse_proposee || "").trim()) throw new Error(MER.TEXTES.rien_a_approuver);
        a.decision_client = decision; a.decision_client_le = iso(Date.now());
        jour(c.id, decision === "approuve" ? "AVIS_REPONSE_APPROUVEE" : "AVIS_EN_PARLER", { avis: a.id });
        alerteDemo(decision === "approuve" ? "AVIS_ACCORD_A_PUBLIER" : "AVIS_EN_PARLER", c.id, Object.assign({ avis: a.id, note: a.note }, decision === "en_parler" && (c.whatsapp_numero || c.contact) ? { telephone: c.whatsapp_numero || c.contact } : {}));
        sauver(); return { decision, le: a.decision_client_le };
      },
      // Avis sensible (31/10/2026, décision) : la version du commerçant, mêmes règles que donner_version_avis (bloc « Créneaux réels »).
      async donnerVersionAvis(id, texte) {
        await init(); const c = cur(); if (!c) throw new Error(PHOTOS.PHRASES.introuvable); const a = mine("avis").find(x => x.id === id); if (!a) throw new Error(MER.TEXTES.avis_introuvable);
        const o = OFFRES[c.offre_id] || {}, equipe = !a.sensible && a.statut === "escalade" && a.note <= 3 && !!(o.avis_equipe || o.delegation);   // 1 à 3 étoiles traités par l'équipe
        if (!(a.sensible && a.statut === "humain") && !equipe) throw new Error("Cet avis n'attend plus votre version."); const x = String(texte || "").trim();
        if (!x) throw new Error("Écrivez votre version en quelques mots."); if (x.length > 2000) throw new Error("Votre version est trop longue (2 000 caractères au plus).");
        a.version_client = x; a.version_client_le = iso(Date.now()); jour(c.id, "AVIS_VERSION_CLIENT", { avis: a.id });
        if (!a.retenue_le) { a.retenue_le = a.version_client_le; a.retenues = retenuesDe(a); }   /* lot 8 : rien n'est publié avant que l'équipe l'ait lu */ alerteDemo("AVIS_VERSION_CLIENT", c.id, { avis: a.id, note: a.note });
        sauver(); return { le: a.version_client_le };
      },
      // « Appelez-moi avant de publier » (01/11/2026) : mêmes règles que retenir_reponse_avis (bloc « Créneaux réels »), numéro et jour du rappel compris
      // (tour 6 Premium) : numéro mis au format du pays (vide : celui du commerce), jour « aujourdhui » ou « demain » (heure de Paris).
      // Lot 8 (décision du fondateur du 16/11/2026) : « Je réponds par message », mêmes règles que retenir_reponse_avis (bloc « Lot 8 ») : plus de
      // numéro, de jour ni de créneau ; la publication attend le message du commerçant (rien d'office avant RETENUE_SANS_MESSAGE_HEURES).
      async retenirReponseAvis(id) {
        await init(); const c = cur(); if (!c) throw new Error(PHOTOS.PHRASES.introuvable); const a = mine("avis").find(x => x.id === id); if (!a) throw new Error(MER.TEXTES.avis_introuvable);
        const o = OFFRES[c.offre_id] || {};
        if (!((a.sensible && a.statut === "humain") || (!a.sensible && a.statut === "escalade" && a.note <= 3)) || !(o.avis_equipe || o.delegation)) throw new Error("Cet avis n'attend plus de réponse de notre équipe.");
        if (a.retenue_le) return { le: a.retenue_le, deja: true };
        a.retenue_le = iso(Date.now()); a.retenue_telephone = null; a.retenue_jour = null; a.retenue_creneau = null; jour(c.id, "AVIS_RETENU", { avis: a.id, mode: "message" });
        a.retenues = retenuesDe(a);
        alerteDemo("AVIS_RETENU", c.id, { avis: a.id, note: a.note, mode: "message" });
        sauver(); return { le: a.retenue_le, deja: false };
      },
      // Lot 8 : boutons de l'espace, MÊME effet qu'une réponse WhatsApp (avis_message_commercant) : « ok » = accord écrit (la retenue est levée,
      // tâche « à publier » au cockpit) ; « faux » = avis non reconnu (rien n'est publié, tâche urgente) ; « attends » = retenirReponseAvis.
      async repondreAvisCommercant(id, choix) {
        await init(); const c = cur(); if (!c) throw new Error(PHOTOS.PHRASES.introuvable); const a = mine("avis").find(x => x.id === id); if (!a) throw new Error(MER.TEXTES.avis_introuvable);
        if (!["escalade", "humain"].includes(a.statut) || a.traite_le) return { etat: "plus_en_attente" };
        if (!["ok", "attends", "faux"].includes(choix)) throw new Error("Choix inconnu.");
        if (choix === "ok" && !String(a.reponse_proposee || "").trim()) choix = "attends";
        const t = iso(Date.now());
        if (choix === "attends") return this.retenirReponseAvis(id);
        if (choix === "ok") { a.decision_client = "approuve"; a.decision_client_le = t; if (!a.propose_le) a.propose_le = a.cree_le;
          a.retenues = retenuesDe(a); a.retenues.forEach(r => { if (!r.liberee_le) r.liberee_le = t; }); if (a.retenue_le) a.liberee_le = t; a.retenue_le = null;
          alerteDemo("AVIS_ACCORD_A_PUBLIER", c.id, { avis: a.id, note: a.note, canal: "espace", urgent: true }); }
        else { a.faux_signale_le = t; if (!a.retenue_le) { a.retenue_le = t; a.retenues = retenuesDe(a); }
          alerteDemo("AVIS_FAUX_SIGNALE", c.id, { avis: a.id, note: a.note, canal: "espace", urgent: true }); }
        jour(c.id, "AVIS_MESSAGE_COMMERCANT", { avis: a.id, choix, canal: "espace" });
        sauver(); return { etat: "ok", choix, avis: a.id };
      },
      // Votre contact (31/10/2026) : mêmes règles que mon_contact, admin_contact, admin_regler_contact (bloc « Créneaux réels »).
      // Rien de réglé (01/11/2026) : PJ et le numéro officiel, sans photo (comme mon_contact).
      async monContact() { await init(); const c = cur(); return (c && c.contact_equipe) || E.contact_equipe || { prenom: "Pierre-Jean", telephone: "+33699080539", photo: null }; },
      async adminContact(cid) { await init(); admin(); return { global: E.contact_equipe || null, commerce: cid && E.commerces[cid] ? E.commerces[cid].contact_equipe || null : null }; },
      async adminReglerContact(cid, p) {
        await init(); admin(); p = p || {}; const pr = String(p.prenom || "").trim(); let v = null;
        if (pr) { if (pr.length > 40) throw new Error("Prénom du contact requis (40 caractères au plus)."); // Pays du commerce réglé (31/10/2026) ; réglage pour tous : aucun pays, un numéro national est refusé (même règle que contact_valide).
          const py = cid && E.commerces[cid] ? paysDe(E.commerces[cid].pays) : null, tel = numeroWhatsapp(p.telephone, py);
          if (!tel && !py) throw new Error("Numéro WhatsApp du contact : pour tous les commerces, écrivez l'indicatif du pays (+33 pour la France, +32 pour la Belgique), par exemple +33 6 12 34 56 78.");
          if (!tel) throw new Error("Numéro WhatsApp du contact invalide : indiquez l'indicatif du pays, par exemple " + exempleNumero(py) + "."); const ph = String(p.photo || "").trim() || null;
          if (ph && (ph.length > 500 || !/^https:\/\/[^\s"<>]+$/i.test(ph))) throw new Error("Photo du contact : adresse https attendue."); v = { prenom: pr, telephone: tel, photo: ph }; }
        if (!cid) E.contact_equipe = v; else { const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable."); c.contact_equipe = v; jour(cid, "CONTACT_REGLE", { prenom: v && v.prenom }); }
        sauver(); return v;
      },
      // WhatsApp de l'équipe (lot 6 B, 15/11/2026) : mêmes règles que admin_equipe_whatsapp et admin_regler_equipe_whatsapp (bloc « Équipe prévenue
      // sur WhatsApp ») : numéros avec indicatif, pas de fixe, 1 à 5 numéros ; graine : Pierre-Jean au numéro officiel.
      async adminEquipeWhatsapp() { await init(); admin(); if (!E.equipe_whatsapp) E.equipe_whatsapp = [{ id: 1, prenom: "Pierre-Jean", numero: "+33699080539", actif: true }];
        return E.equipe_whatsapp.filter(x => x.actif).map(x => ({ ...x })); },
      async adminReglerEquipeWhatsapp(liste) {
        await init(); admin(); const vus = [], l = [];
        for (const x of Array.isArray(liste) ? liste : []) { const pr = String((x || {}).prenom || "").trim(), brut = String((x || {}).numero || "").trim(), n = numeroWhatsapp(brut, null);
          if (!pr && !brut) continue;
          if (!pr || pr.length > 40) throw new Error("Prénom requis pour chaque numéro (40 caractères au plus).");
          if (!n) throw new Error(`Numéro WhatsApp de ${pr} invalide : écrivez l'indicatif du pays, par exemple +33 6 12 34 56 78 ou +32 470 12 34 56.`);
          if (numeroFixe(n)) throw new Error(`Le numéro de ${pr} ressemble à un fixe : WhatsApp ne le recevra pas.`);
          if (!vus.includes(n)) { vus.push(n); l.push({ prenom: pr, numero: n }); } }
        if (!vus.length) throw new Error("Gardez au moins un numéro : sinon personne n'est prévenu quand un commerçant demande un appel.");
        if (vus.length > 5) throw new Error("Cinq numéros au plus.");
        const avant = E.equipe_whatsapp || []; let id = Math.max(0, ...avant.map(x => x.id || 0));
        E.equipe_whatsapp = [...avant.filter(x => !vus.includes(x.numero)).map(x => ({ ...x, actif: false })), ...l.map(x => ({ id: (avant.find(y => y.numero === x.numero) || {}).id || ++id, ...x, actif: true }))];
        sauver(); return E.equipe_whatsapp.filter(x => x.actif).map(x => ({ ...x })); },
      // Lien d'avis Google renseigné par BoostImpact (31/10/2026) : mêmes règles que admin_lien_avis.
      async adminLienAvis(cid, lien) {
        await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable."); const l = String(lien || "").trim() || null;
        if (l && (l.length > 500 || !/^https:\/\/[^\s"<>]+$/i.test(l))) throw new Error("Lien d'avis : adresse https attendue.");
        c.lien_avis = l; jour(cid, "LIEN_AVIS_REGLE", { rempli: !!l }); sauver(); return l;
      },
      async adminConfirmerNom(cid, nom) {
        await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable."); const n = MER.nom(nom), t = iso(Date.now());
        jour(cid, "NOM_CONFIRME", { nom: n, modifie: c.nom !== n, par: "console" }); c.nom = n; c.nom_confirme_le = t; sauver(); return { nom: n, nom_confirme_le: t };
      },
      // Console : poser ou corriger l'identifiant de la fiche de n'importe quel commerce (admin_fiche_google_lieu de schema.sql).
      async adminFicheGoogleLieu(cid, valeur) {
        await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable."); const v = String(valeur == null ? "" : valeur).trim();
        const pid = !v ? null : FG.ID.test(v) ? v : FG.placeId(FG.lien(v)); if (v && !pid) throw new Error(FG.TEXTES.identifiant);
        Object.assign(c, { google_place_id: pid, google_place_id_source: pid ? "console" : null, fiche_google_a_resoudre_le: null, fiche_google_a_identifier_le: null });
        fermerTachesDemo(cid, "FICHE_GOOGLE_A_IDENTIFIER"); jour(cid, "FICHE_GOOGLE_IDENTIFIEE", { par: "console", retire: !pid }); sauver(); return { google_place_id: pid };
      },
      async adminFicheGoogleVerifiee(cid, le) {
        await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable.");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(le || "") || le > aujourdhui()) throw new Error(MER.TEXTES.date_verif);
        const v = le + "T00:00:00.000Z"; c.fiche_google_verifiee_le = v; c.fiche_google_demande_le = c.fiche_google_demande_le || v; assurerDelaisDemo();
        let g = E.garantie_delais.find(x => x.commerce_id === cid); if (!g) { g = { commerce_id: cid, acces_remis_le: null, photos_recues_le: null, fiche_optimisee_le: null }; E.garantie_delais.push(g); }
        g.acces_remis_le = g.acces_remis_le && g.acces_remis_le > v ? g.acces_remis_le : v;
        etatMiseEnRoute(cid); tableMR()[cid].google = "fait"; jour(cid, "FICHE_GOOGLE_VERIFIEE", { le }); sauver(); return { fiche_google_verifiee_le: v };
      },
    };

    return {
      mode: "demo",
      // Accès par mot de passe (17/10/2026, acces.js) : mêmes écrans qu'en service. En démonstration, n'importe quel mot de passe ouvre un compte
      // de la graine ; « Première connexion ou mot de passe oublié ? » prépare un lien local (aucun email) qui ouvre seulement le choix du mot de
      // passe, comme une session née d'un lien d'email en service (amr sans « password »).
      // Double authentification de l'administrateur (18/10/2026) : mêmes étapes qu'en service (doubleAuth, codeRequis : voir l'adaptateur
      // Supabase). Le code est un vrai TOTP (RFC 6238, acces.js) : une application réelle marche avec la clé affichée ; l'écran affiche aussi le
      // code du moment (codeDemo). La visite directe (boutons de l'écran de connexion) entre sans mot de passe ni code, comme avant.
      // Depuis le 22/10/2026 (DOUBLE_AUTH_ADMIN = false) : le mot de passe suffit à la console, aucun écran de code.
      async session() { await init(); if (!session) return null;
        const u = E.users[session], f = facteurDemo(), facteur = !!(f && f.verifie);
        if (aChoisir) return { email: session, role: null, motDePasseRequis: true, codeRequis: facteur && !aal2 };
        if (u.role !== "administrateur") return { email: session, role: u.role };
        return { email: session, role: u.role, doubleAuth: aal2 || !doubleAuthExigee() ? "ok" : facteur ? "code" : "activer" }; },
      async connecter(e, mdp) { await init(); e = String(e || "").trim().toLowerCase(); if (!E.users[e]) throw new Error("En démonstration : " + listeComptes() + ".");
        if (!mdp) throw Object.assign(new Error("mot de passe vide"), { code: "champs" }); ouvrir(e, false); },
      async demanderLienMotDePasse(e) { await init(); e = String(e || "").trim().toLowerCase(); if (!E.users[e]) throw Object.assign(new Error("compte inconnu"), { code: "inconnu" }); return { lien: e }; },
      async ouvrirLienMotDePasse(e) { await init(); if (E.users[e]) ouvrir(e, true); },
      // Lien d'email au nouveau format (26/10/2026, acces.js, lienEmail) : jeton de démonstration à usage unique, valable 24 heures comme en
      // service (MAILER_OTP_EXP = 86400). lienDemo(email, type) le fabrique (outil des tests et de la démonstration ; en service, c'est Supabase
      // qui l'écrit dans l'email) ; verifierLien le consomme et ouvre la session « lien » (mot de passe à choisir), comme verifyOtp.
      async lienDemo(e, type = "invite") { await init(); e = String(e || "").trim().toLowerCase(); if (!E.users[e]) throw new Error("compte inconnu");
        const j = nouveauJeton() + nouveauJeton(); E.liens_email = Object.assign({}, E.liens_email, { [j]: { email: e, type, cree_le: iso(Date.now()), utilise_le: null } }); sauver();
        return "index.html?jeton=" + j + "&type=" + type; },
      async verifierLien(j, type) { await init(); const x = (E.liens_email || {})[j];
        if (!x || x.utilise_le || x.type !== type || Date.now() - Date.parse(x.cree_le) > 24 * 3600000 || !E.users[x.email]) throw Object.assign(new Error("lien expiré ou déjà servi"), { code: "lien" });
        x.utilise_le = iso(Date.now()); sauver(); ouvrir(x.email, true); },
      // Comme en service : le mot de passe enregistré, la session du lien est fermée et une nouvelle s'ouvre par mot de passe (sans code).
      async choisirMotDePasse(mdp) { await init(); if (!session) throw Object.assign(new Error("session absente"), { code: "session" });
        if (!window.RENOM_ACCES.controlerMotDePasse(mdp).ok) throw Object.assign(new Error("règles du mot de passe"), { code: "regles" });
        const f = facteurDemo(); if (f && f.verifie && !aal2) throw Object.assign(new Error("code exigé"), { code: "session" }); ouvrir(session, false); },
      async doubleAuthPreparer(mode) { await init(); if (!session) throw Object.assign(new Error("session absente"), { code: "session" });
        const f = facteurDemo();
        if (f && f.verifie) return mode === "code" ? { factorId: "demo-totp" } : { mode: "code" };
        if (mode === "code") return { mode: "activer" };
        const secret = window.RENOM_ACCES.secretTotp(); E.mfa = Object.assign({}, E.mfa, { [session]: { secret, verifie: false } }); sauver();
        return { factorId: "demo-totp", secret, qr: await qrDemo(window.RENOM_ACCES.uriTotp(secret, session, "BoostImpact")) };
      },
      async doubleAuthVerifier(factorId, code) { await init(); const ACC = window.RENOM_ACCES, f = facteurDemo();
        if (!ACC.codeValide(code)) throw Object.assign(new Error("code à 6 chiffres"), { code: "format" });
        if (!f || factorId !== "demo-totp") throw Object.assign(new Error("facteur introuvable"), { code: "facteur" });
        if (!await ACC.verifierTotp(f.secret, code)) throw Object.assign(new Error("code faux"), { code: "code" });
        f.verifie = true; sauver(); ouvrir(session, aChoisir, true); },
      async codeDemo() { await init(); const f = facteurDemo(); return f ? window.RENOM_ACCES.totp(f.secret) : null; },
      // Comptes de la graine chargée, pour l'écran de connexion (aucune adresse écrite en dur dans les écrans)
      async comptesDemo() { await init(); const co = (E.demo_maj || {}).comptes_offres || {};   // compte par offre pas encore ouvert : le nom prévu par la graine
        // Lot 5 B (entrée de la démo : un bouton par offre) : l'offre, le commerce et « nouveau client » (démarrage pas fini) de chaque compte.
        return Object.entries(E.users).map(([email, u]) => { const c = u.commerce ? E.commerces[u.commerce] || null : null;
          return { email, role: u.role, commerce: u.commerce ? (c || {}).nom || (co[email] || {}).nom || "" : "", commerce_id: u.commerce || (co[email] || {}).commerce || null,
            offre: c ? c.offre_id : (co[email] || {}).offre || null, nouveau: !!c && c.demarrage_fini === false }; }); },
      async ouvrirLien(e) { await init(); ouvrir(e, false, true); },   // visite directe de la démonstration (boutons de l'écran de connexion)
      async quitter() { session = null; aChoisir = false; aal2 = false; try { localStorage.removeItem(K + ":session"); localStorage.removeItem(K + ":choisir"); localStorage.removeItem(K + ":aal2"); } catch (x) {} },
      async estAdmin() { await init(); return !!session && !aChoisir && E.users[session].role === "administrateur"; },
      async commerce() { await init(); const c = cur(); if (c && !("numero_tva" in c)) c.numero_tva = null; return c; },   // lot 10 : colonne numero_tva (facultative)
      // ---- Lot 10 : numéro de TVA facultatif (mêmes règles que regler_numero_tva). Démonstration : noté dans ce navigateur.
      async reglerNumeroTva(numero, ignorer) {
        await init(); const c = cur(); if (!c) throw new Error(PHOTOS.PHRASES.introuvable);
        if (ignorer) { c.tva_ignoree_le = iso(Date.now()); jour(c.id, "TVA_IGNOREE", {}); sauver(); return { numero_tva: c.numero_tva || null, ignoree: true }; }
        const n = numeroTva(numero, paysDe(c.pays)); if (!n) throw new Error(PHRASE_TVA);
        c.numero_tva = n; jour(c.id, "TVA_RENSEIGNEE", {}); alerteDemo("TVA_A_REPORTER", c.id, { numero: n }); sauver(); return { numero_tva: n, ignoree: false };
      },
      async enregistrer(ch) { await init(); const c = cur(); if ("reglage_avis" in ch && ch.reglage_avis !== "auto_des_4_etoiles") throw new Error("Ce réglage n'existe plus : rien n'est publié sans votre validation, sauf ce que prévoit votre offre.");
        FICHE.forEach(k => { if (k in ch) c[k] = ch[k]; }); sauver(); },
      // 15/11/2026 (retour de PJ) : photo « traitee » dont aucun contenu n'est encore visible (tous « a_relire ») -> en_relecture (affichée « En préparation »).
      async photos() { await init(); const vus = new Set(mine("contenus").map(x => x.photo_id).filter(Boolean));
        return mine("photos").map(p => Object.assign({}, p, { en_relecture: p.statut === "traitee" && !vus.has(p.id) })).sort((a, b) => b.cree_le.localeCompare(a.cree_le)); },
      ...photosDemo,
      // ---- Kit de marque (écran « Votre style ») : mêmes règles que le moteur et la base (espace/web/marque.js, fonction SQL marque_fautes)
      async marque() { await init(); return marqueDemo(cur()); },
      async deposerLogo(f) { await init(); return logoDemo(cur(), f); },
      async reglerMaMarque(p, valider) { await init(); return reglerMaMarqueDemo(cur(), p, valider); },
      async demanderChangementStyle(texte) { await init(); return demanderChangementStyleDemo(cur(), texte); },
      async contenus() { await init(); return mine("contenus").sort((a, b) => b.cree_le.localeCompare(a.cree_le)); },
      // reseau « tiktok » : le visuel 9:16 d'une publication photo (visuel_9x16_url de la graine), comme cheminVisuel pour Supabase.
      async urlVisuel(c, reseau) { return reseau === "tiktok" && photoPublication(c) ? c.visuel_9x16_url || null : c.visuel_url || null; },
      async urlVideo(c) { return c.video_url || null; },
      async valider(id, statut, note) {
        await init(); const c = mine("contenus").find(x => x.id === id);
        if (!c) throw new Error("Contenu introuvable."); if (c.statut !== "a_valider") throw new Error("Ce contenu est déjà traité.");
        if (!["approuve", "modification", "refuse"].includes(statut)) throw new Error("Statut refusé.");
        if (statut === "modification" && !(note || "").trim()) throw new Error("Écrivez un mot pour dire ce qu'il faut modifier.");
        // Motif de refus (31/10/2026) : facultatif, gardé dans note_modification comme le mot d'une demande de modification.
        c.statut = statut; c.note_modification = statut === "modification" ? note.trim() : statut === "refuse" && String(note || "").trim() ? String(note).trim().slice(0, 500) : null; c.decide_le = new Date().toISOString(); jour(cur().id, "CONTENU_" + statut.toUpperCase(), { contenu: id }); suivreDepot(c);
        if (statut === "approuve") programmerALApprobation(c);
        sauver();
      },
      // Remettre à valider un contenu refusé (même règle que remettre_a_valider de schema.sql, limite du mois comprise).
      async remettreAValider(id) {
        await init(); const k = cur(); const c = mine("contenus").find(x => x.id === id);
        if (!c) throw new Error("Contenu introuvable."); if (c.statut !== "refuse") throw new Error("Seul un contenu refusé peut être remis à valider.");
        if (k && k.en_pause) throw new Error("Votre abonnement est en pause : rien ne peut être remis à valider pour l'instant.");
        if (c.type === "publication" && !c.hors_plafond && c.mois === mois0()) { const o = (window.RENOM_OFFRES || {})[k.offre_id] || {};
          const n = mine("contenus").filter(x => x.type === "publication" && x.mois === mois0() && x.statut !== "refuse" && !x.hors_plafond).length;
          if (o.publications && n >= o.publications) throw new Error("Limite de publications du mois atteinte : ce contenu ne peut pas être remis à valider ce mois-ci."); }
        c.statut = "a_valider"; c.note_modification = null; jour(k.id, "CONTENU_REMIS_A_VALIDER", { contenu: id }); sauver(); return "a_valider";
      },
      async idees() { await init(); return mine("idees").sort((a, b) => b.cree_le.localeCompare(a.cree_le)); },
      async demanderIdees() {
        await init(); const c = cur(); pasEnPause(c);
        // Hors plafond depuis le 22/10/2026 ; garde-fou de la base : une demande par 24 heures (verifier_plafond).
        if (E.idees_demandes.some(x => x.commerce_id === c.id && Date.now() - Date.parse(x.cree_le) < 24 * 3600e3)) throw new Error(PHRASE_IDEES_JOUR);
        const d = { id: uid(), commerce_id: c.id, statut: "traitee", mois: mois0(), cree_le: new Date().toISOString() }; E.idees_demandes.push(d);
        ["Une idée de démonstration (faux service) : les coulisses avant l'ouverture", "Une idée de démonstration (faux service) : le geste que vos clients préfèrent"].forEach(t => E.idees.unshift({ id: uid(), commerce_id: c.id, titre: t, texte: "Texte de démonstration : en service, notre IA propose ici une idée liée à votre fiche.", cree_le: new Date().toISOString(), demo: true }));
        jour(c.id, "IDEES", { simule: true }); sauver();
      },
      async calendrier() { await init(); const cs = mine("contenus"); return mine("publications").map(p => ({ ...p, contenu: cs.find(c => c.id === p.contenu_id) })).sort((a, b) => a.prevu_le.localeCompare(b.prevu_le)); },
      async programmer({ contenu_id, reseaux, prevu_le }) {
        await init(); const c = cur(); pasEnPause(c); const ct = mine("contenus").find(x => x.id === contenu_id);
        if (!ct || ct.statut !== "approuve") throw new Error(REGLES.programme);
        if (!(new Date(prevu_le) > new Date())) throw new Error(REGLES.futur);
        if (!reseaux.length) throw new Error("Choisissez où publier.");
        for (const r of reseaux) { horsOffre(c, r); if ((E.comptes[c.id][r] || {}).etat !== "connecte") throw new Error("Réseau non connecté : " + r + "."); }
        if (reseaux.some(r => !reseauxPour(ct).includes(r))) throw new Error(ct.type === "video" ? "Une vidéo part sur Instagram et TikTok seulement : ni sur Facebook, ni sur la fiche Google." : "Une story (format vertical 24 h) ne se programme pas sur la fiche Google.");
        const son = sonPlateforme(ct, reseaux), pid = uid();
        E.publications.push({ id: pid, commerce_id: c.id, contenu_id, reseaux, prevu_le: new Date(prevu_le).toISOString(), statut: "programme", cree_le: new Date().toISOString(), musique_a_poser: son, musique_posee_le: null });
        ct.statut = "programme"; jour(c.id, "PROGRAMME", { contenu: contenu_id, reseaux }); if (son) jour(c.id, son.code, { publication: pid, reseaux: son.reseaux, simule: true }); suivreDepot(ct); sauver();
      },
      // Publication restée sur un réseau sorti de l'offre (audit Essentiel du 31/10/2026) : elle part sur la fiche Google à la place, même date.
      async publierSurGoogle(id) { await init(); const c = cur(); pasEnPause(c); const p = mine("publications").find(x => x.id === id); if (!p || p.statut !== "programme") throw new Error("Programmation introuvable.");
        const ct = mine("contenus").find(x => x.id === p.contenu_id); horsOffre(c, "google");
        if (((E.comptes[c.id] || {}).google || {}).etat !== "connecte") throw new Error("Réseau non connecté : google.");
        if (!ct || !reseauxPour(ct).includes("google")) throw new Error("Une story (format vertical 24 h) ne se programme pas sur la fiche Google.");
        p.reseaux = ["google"]; jour(c.id, "PROGRAMME", { contenu: p.contenu_id, reseaux: p.reseaux }); sauver(); },
      async deplacer(id, prevu_le) { await init(); const p = mine("publications").find(x => x.id === id); if (!p || p.statut !== "programme") throw new Error("Programmation introuvable."); if (!(new Date(prevu_le) > new Date())) throw new Error(REGLES.futur); p.prevu_le = new Date(prevu_le).toISOString(); sauver(); },
      async annuler(id) { await init(); const p = mine("publications").find(x => x.id === id); if (!p || p.statut !== "programme") throw new Error("Programmation introuvable."); p.statut = "annule"; const ct = mine("contenus").find(x => x.id === p.contenu_id); if (ct) ct.statut = "approuve"; jour(cur().id, "PROGRAMMATION_ANNULEE", { contenu: p.contenu_id }); sauver(); },
      async avis() { await init(); return mine("avis").sort((a, b) => b.cree_le.localeCompare(a.cree_le)); },
      async validerAvis(id, statut, texte) {
        await init(); const a = mine("avis").find(x => x.id === id); if (!a) throw new Error("Avis introuvable.");
        if (a.statut !== "a_valider" || a.sensible) throw new Error("Cet avis ne se valide pas ici.");
        if (!["valide", "refuse"].includes(statut)) throw new Error("Statut refusé.");
        if (statut === "valide") { if (!(texte || a.reponse_proposee || "").trim()) throw new Error("Réponse vide."); a.reponse_proposee = (texte ?? a.reponse_proposee).trim(); }
        a.statut = statut; jour(cur().id, "AVIS_" + statut.toUpperCase(), { avis: id }); sauver();
      },
      async comptes() { await init(); const c = cur(); return RESEAUX.map(r => ({ reseau: r, etat: ((E.comptes[c.id] || {})[r] || {}).etat || "non_connecte", detail: ((E.comptes[c.id] || {})[r] || {}).detail || "", maj: ((E.comptes[c.id] || {})[r] || {}).maj || null })); },
      async compteur() { await init(); return vc(cur()); },
      // Abonnement (table abonnements, écrite par le seul webhook Stripe) : en démonstration, celui de la graine s'il y en a un, sinon aucun.
      async abonnement() { await init(); const c = cur(); const a = abonnementCourant((E.abonnements || []).filter(x => x.commerce_id === c.id).sort((x, y) => String(y.maj_le || "").localeCompare(String(x.maj_le || ""))));
        return a && STATUTS_ABONNEMENT.includes(a.statut) ? { offre: a.offre, statut: a.statut, rythme: a.rythme || null, stripe_customer: a.stripe_customer || null, remise_lancement_fin: a.remise_lancement_fin || null, maj_le: a.maj_le || null, demo: true } : null; },
      lienAbonnement, lienMonteeOffre, demandeDeLien,
      // Mode délégation par bouton (bloc SQL « Changement d'offre en libre-service et mode délégation dans l'espace ») : toujours en démonstration.
      delegationParBouton() { return true; },
      // Lot 6 B (revue copywriter : historique de la démo « 15, 14, 12, 14, 15 nov. ») : le plus récent d'abord, comme la base (order by cree_le desc).
      async journal() { await init(); return journalCommercant([...mine("journal")].sort((a, b) => (Date.parse(b.cree_le) || 0) - (Date.parse(a.cree_le) || 0))).slice(0, 100); },
      // ---- Collecte : page publique et retours privés (voir collecteDemo plus haut)
      ...collecteDemo,
      // ---- Mise à jour de l'espace membre (voir majDemo plus haut)
      ...majDemo,
      // ---- Automatisations de service (voir autoDemo plus haut)
      ...autoDemo,
      // ---- Garanties (voir garantiesDemo plus haut)
      ...garantiesDemo,
      // ---- Mise en route claire (voir merDemo plus haut)
      ...merDemo,
      // ---- Mode délégation dans l'espace (voir offresDemo plus haut)
      ...offresDemo,
      // ---- Vidéo d'avis
      async avisVideo() { await init(); return mine("avis").map(a => ({ id: a.id, note: a.note, texte: a.texte, auteur: a.auteur || "", sensible: !!a.sensible, cree_le: a.cree_le, demo: !!a.demo })).sort((a, b) => b.cree_le.localeCompare(a.cree_le)); },
      async demandesVideoAvis() { await init(); const c = cur(); return vaDemandes().filter(x => x.commerce_id === c.id).sort((a, b) => b.cree_le.localeCompare(a.cree_le)); },
      async demanderVideoAvis({ avis_ids, fond, style }) {
        await init(); const c = cur(), o = OFFRES[c.offre_id]; pasEnPause(c);
        if (!o.videos) throw new Error("Votre offre ne comprend pas de vidéo.");
        if (reserveesVideos(c) >= o.videos) throw new Error("Le plafond de vidéos de votre offre est atteint ce mois-ci.");
        vaControle(avis_ids, fond, style);
        const choisis = avis_ids.map(id => mine("avis").find(a => a.id === id));
        if (choisis.some(a => !a)) throw new Error("Avis introuvable.");
        for (const a of choisis) { const m = VIDEO_AVIS.motif(a); if (m) throw new Error(m); }
        if (fond === "photos" && !mine("photos").length) throw new Error("Aucune photo déposée : déposez une photo ou choisissez un fond uni.");
        const d = { id: uid(), commerce_id: c.id, avis_ids: [...avis_ids], fond, style, statut: "a_traiter", motif: null, contenu_id: null, mois: mois0(), cree_le: new Date().toISOString(), demo: true };
        vaDemandes().unshift(d); jour(c.id, "VIDEO_AVIS_DEMANDEE", { demande: d.id, simule: true }); sauver();
        setTimeout(() => { faux.videoAvis(d); sauver(); }, 1500);   // faux n8n + faux rendu
        return d.id;
      },
      // ---- Dépôt de vidéos (démonstration) : mêmes règles que la base ; l'envoi des fichiers est SIMULÉ (RENOM_ENVOI.simuler), rien ne quitte le navigateur.
      async depotsVideo() { await init(); const c = cur(); return liste("depots_video").filter(x => x.commerce_id === c.id).sort((a, b) => b.cree_le.localeCompare(a.cree_le)); },
      async compteurVideos() { await init(); const c = cur(), o = OFFRES[c.offre_id];
        return { commerce_id: c.id, mois: mois0(), videos_plafond: o.videos, videos_utilisees: usageVideos(c), videos_reservees: reserveesVideos(c),
          envois_ouverts: liste("depots_video").filter(d => d.commerce_id === c.id && d.statut === "en_envoi" && Date.now() - Date.parse(d.cree_le) < DEPOT_VIDEO.OUVERT_MS).length }; },
      async creerDepotVideo({ note } = {}) {
        await init(); const c = cur(), o = OFFRES[c.offre_id], P = DEPOT_VIDEO.PHRASES; pasEnPause(c);
        const n = String(note || "").trim(); if (n.length > window.RENOM_ENVOI.REGLES.NOTE_MAX) throw new Error(P.note);
        if (!o.videos) throw new Error(P.sans_video);
        if (liste("depots_video").some(d => d.commerce_id === c.id && d.statut === "en_envoi" && Date.now() - Date.parse(d.cree_le) < DEPOT_VIDEO.OUVERT_MS)) throw new Error(P.ouvert);
        if (reserveesVideos(c) >= o.videos) throw new Error(P.plafond);
        const d = { id: "dv-" + uid().slice(0, 8), commerce_id: c.id, fichiers: [], details: [], note: n || null, nb_fichiers: 0, nb_videos: 0, duree_totale_s: null, statut: "en_envoi", motif: null,
          contenu_id: null, mois: mois0(), essais: 0, cree_le: new Date().toISOString(), maj_le: new Date().toISOString(), demo: true, recus: {} };
        E.depots_video.unshift(d); sauver(); return { id: d.id };
      },
      // Fichiers déjà complets dans le dossier du dépôt (reprise après rechargement) : nom -> taille.
      async fichiersRecus(depot) { await init(); const d = liste("depots_video").find(x => x.id === depot && x.commerce_id === cur().id); return d ? { ...(d.recus || {}) } : {}; },
      async envoyerFichierDepot(depot, f, rang, o = {}) {
        await init(); const c = cur(), d = liste("depots_video").find(x => x.id === depot && x.commerce_id === c.id), P = DEPOT_VIDEO.PHRASES;
        if (!d) throw new Error(P.introuvable); if (d.statut !== "en_envoi") throw new Error(P.ferme);
        const nom = window.RENOM_ENVOI.nomDansDepot(rang, f), chemin = c.id + "/rushes/" + d.id + "/" + nom;
        if (o.deja || (d.recus && d.recus[nom] === f.size)) { if (o.onProgress) o.onProgress(f.size, f.size); return { chemin, deja: true }; }
        await window.RENOM_ENVOI.simuler({ fichier: f, onProgress: o.onProgress, onEtat: o.onEtat, signal: o.signal, debit: o.debit || window.RENOM_DEBIT_DEMO });
        d.recus = d.recus || {}; d.recus[nom] = f.size; sauver(); return { chemin, deja: false };
      },
      async finaliserDepotVideo(depot, details) {
        await init(); const c = cur(), d = liste("depots_video").find(x => x.id === depot && x.commerce_id === c.id), P = DEPOT_VIDEO.PHRASES, R = window.RENOM_ENVOI.REGLES;
        if (!d) throw new Error(P.introuvable); if (d.statut !== "en_envoi" || Date.now() - Date.parse(d.cree_le) >= DEPOT_VIDEO.OUVERT_MS) throw new Error(P.ferme);
        const l = (details || []).map(x => ({ chemin: x.chemin, nom: String(x.nom || "").slice(0, 200), type: /\.(mp4|mov|m4v|webm|3gp)$/i.test(x.chemin) ? "video" : "photo", taille: x.taille, duree_s: x.duree_s == null ? null : +x.duree_s }));
        for (const x of l) if (!d.recus || !d.recus[x.chemin.split("/").pop()]) throw new Error("Fichier non reçu : " + x.chemin.split("/").pop() + ".");
        const nv = l.filter(x => x.type === "video").length, np = l.length - nv;
        if (nv < R.VIDEOS_MIN || nv > R.VIDEOS_MAX) throw new Error(P.nb_videos); if (np > R.PHOTOS_MAX) throw new Error(P.nb_photos);
        if (l.some(x => x.type === "video" && x.duree_s != null && Math.round(x.duree_s) > R.DUREE_MAX_S)) throw new Error(P.longue);
        const durees = l.filter(x => x.type === "video" && x.duree_s != null);
        Object.assign(d, { fichiers: l.map(x => x.chemin), details: l, nb_fichiers: l.length, nb_videos: nv, duree_totale_s: durees.length ? Math.round(durees.reduce((a, x) => a + x.duree_s, 0) * 10) / 10 : null,
          statut: "envoye", envoye_le: new Date().toISOString(), maj_le: new Date().toISOString() });
        jour(c.id, "DEPOT_VIDEO", { depot: d.id, videos: nv, photos: np, simule: true }); sauver();
        // Faux n8n puis faux moteur : « en montage » tout de suite, contenu « à valider » ensuite.
        setTimeout(() => { if (d.statut === "envoye") { d.statut = "en_montage"; sauver(); } }, 800);
        setTimeout(() => { faux.montage(d); sauver(); }, window.RENOM_MONTAGE_DEMO_MS || 4000);
        return { id: d.id, statut: d.statut, nb_videos: nv, nb_photos: np, duree_totale_s: d.duree_totale_s };
      },
      async annulerDepotVideo(depot) {
        await init(); const c = cur(), d = liste("depots_video").find(x => x.id === depot && x.commerce_id === c.id), P = DEPOT_VIDEO.PHRASES;
        if (!d) throw new Error(P.introuvable); if (d.statut !== "en_envoi") throw new Error(P.ferme);
        Object.assign(d, { statut: "annule", recus: {}, rushes_effaces_le: new Date().toISOString(), maj_le: new Date().toISOString() }); jour(c.id, "DEPOT_VIDEO_ANNULE", { depot: d.id }); sauver();
      },
      async adminDepotsVideo() { await init(); admin(); return liste("depots_video").map(d => { const ct = d.contenu_id && liste("contenus").find(x => x.id === d.contenu_id);
        return { ...d, commerce: (E.commerces[d.commerce_id] || {}).nom, contenu_legende: ct ? ct.legende || null : null, contenu_statut: ct ? ct.statut : null }; }).sort((a, b) => b.cree_le.localeCompare(a.cree_le)); },
      async adminRelancerMontage(id) {
        await init(); admin(); const d = liste("depots_video").find(x => x.id === id), P = DEPOT_VIDEO.PHRASES; if (!d) throw new Error(P.introuvable);
        if (!["envoye", "en_montage", "refuse"].includes(d.statut)) throw new Error(P.relance); if (d.rushes_effaces_le) throw new Error(P.efface);
        const c = E.commerces[d.commerce_id]; if (d.statut === "refuse" && usageVideos(c) + depotsAttente(c, d.id) + vaDemandes().filter(x => x.commerce_id === c.id && ["a_traiter", "en_cours"].includes(x.statut)).length >= OFFRES[c.offre_id].videos) throw new Error(P.plafond);
        Object.assign(d, { statut: "envoye", motif: null, contenu_id: null, essais: (d.essais || 0) + 1, maj_le: new Date().toISOString() }); jour(d.commerce_id, "MONTAGE_RELANCE", { depot: d.id, essai: d.essais }); sauver();
        setTimeout(() => { faux.montage(d); sauver(); }, window.RENOM_MONTAGE_DEMO_MS || 4000);
      },
      // ---- Montage à la main (démonstration) : mêmes règles que admin_plans_depot et admin_deposer_montage_main. Les rushes de la démonstration
      // ne sont jamais conservés (envoi simulé) : les plans sont listés sans lien. Le fichier du montage n'est pas gardé non plus : le contenu
      // montre la vidéo d'EXEMPLE de la graine, comme le faux montage.
      async adminPlansDepot(id) {
        await init(); admin(); const d = liste("depots_video").find(x => x.id === id), P = MONTAGE_MAIN.PHRASES; if (!d) throw new Error(P.introuvable);
        if (d.rushes_effaces_le || d.effacement_demande_le) throw new Error(P.efface);
        return (d.details || []).filter(x => x && typeof x.chemin === "string" && x.chemin.startsWith(d.commerce_id + "/rushes/" + d.id + "/"))
          .map((x, i) => ({ chemin: x.chemin, nom: x.nom || x.chemin.split("/").pop(), type: x.type, taille: x.taille ?? null, duree_s: x.duree_s ?? null, url: x.url_demo || null, fichier: MONTAGE_MAIN.nomPlan({ commerce: (E.commerces[d.commerce_id] || {}).nom }, x, i) }));
      },
      async adminEnvoyerMontageMain(depot, f, o = {}) {
        await init(); admin(); const d = liste("depots_video").find(x => x.id === depot), P = MONTAGE_MAIN.PHRASES; if (!d) throw new Error(P.introuvable);
        if (!MONTAGE_MAIN.possible(d)) throw new Error(P.statut);
        const k = await MONTAGE_MAIN.controler(f); if (k.raison) throw new Error(P[k.raison]);
        const chemin = MONTAGE_MAIN.chemin(d.commerce_id, d.id);
        await window.RENOM_ENVOI.simuler({ fichier: f, onProgress: o.onProgress, onEtat: o.onEtat, signal: o.signal, debit: o.debit || window.RENOM_DEBIT_DEMO || 64 * 1024 * 1024 });
        liste("fichiers_montage_main").push(chemin); sauver(); return { chemin, infos: k.infos };
      },
      async adminDeposerMontageMain(depot, chemin, legende, infos = {}) {
        await init(); admin(); const d = liste("depots_video").find(x => x.id === depot), P = MONTAGE_MAIN.PHRASES; if (!d) throw new Error(P.introuvable);
        if (!MONTAGE_MAIN.possible(d)) throw new Error(P.statut);
        if (!new RegExp("^" + d.commerce_id + "/montage-" + d.id + "/main-[0-9]{13}\\.mp4$").test(chemin || "")) throw new Error(P.hors);
        if (!liste("fichiers_montage_main").includes(chemin)) throw new Error(P.recu);
        const c = E.commerces[d.commerce_id], x = d.contenu_id && liste("contenus").find(y => y.id === d.contenu_id && y.commerce_id === d.commerce_id), ex = E.montage_exemple || E.video_avis_exemple || {};
        const remplace = !!x && ["a_valider", "modification"].includes(x.statut), l = MONTAGE_MAIN.legende(legende, remplace ? x.legende : null); if (l.raison) throw new Error(P[l.raison]);
        if (infos.duree_s != null && (infos.duree_s < 1 || Math.round(infos.duree_s) > 60)) throw new Error(P.longue);
        if (infos.largeur && infos.hauteur && Math.abs(infos.largeur * 16 - infos.hauteur * 9) > MONTAGE_MAIN.TOLERANCE * infos.hauteur * 9) throw new Error(P.vertical);
        const avant = d.statut; let id, v = 1;
        if (remplace) {
          v = (x.version || 1) + 1; Object.assign(x, { fichier: chemin, version: v, legende: l.legende || x.legende, legendes: l.legende ? null : x.legendes, drapeaux: null, musique: { mode: "aucune" }, statut: "a_valider", soumis_le: new Date().toISOString(), video_url: ex.video_url || x.video_url || null });
          liste("jetons_validation").filter(j => j.objet_id === x.id && !j.utilise_le).forEach(j => { j.expire_le = new Date().toISOString(); }); id = x.id;
        } else {
          if (d.statut === "refuse" && usageVideos(c) + depotsAttente(c, d.id) + vaDemandes().filter(y => y.commerce_id === c.id && ["a_traiter", "en_cours"].includes(y.statut)).length >= OFFRES[c.offre_id].videos) throw new Error(DEPOT_VIDEO.PHRASES.plafond);
          id = uid(); E.contenus.unshift({ id, commerce_id: c.id, photo_id: null, depot_video_id: d.id, type: "video", format: "video", legende: l.legende, fichier: chemin, musique: { mode: "aucune" },
            visuel_url: ex.visuel_url || null, video_url: ex.video_url || null, note_modification: null, statut: "a_valider", mois: d.mois, cree_le: new Date().toISOString(), version: 1, demo: true });
        }
        Object.assign(d, { statut: "a_valider", contenu_id: id, motif: null, maj_le: new Date().toISOString() });
        jour(c.id, "MONTAGE", { depot: d.id, contenu: id, version: v, main: true, remplace, statut_depot_avant: avant, fichier: chemin, duree_s: infos.duree_s ?? null, simule: true });
        emettreJeton(c.id, "contenu", id); sauver();
        return { depot: d.id, contenu: id, version: v, remplace, statut: "a_valider" };
      },
      // ---- Réponses aux commentaires (démonstration). Aucun réseau n'est appelé : l'accès de Meta n'étant pas accordé, une réponse validée passe
      // dans la file « à publier à la main » de la console, comme le ferait n8n/renom-commentaires-publication.json sans accès.
      async commentaires() { await init(); return liste("commentaires").filter(x => x.commerce_id === cur().id).sort((a, b) => b.cree_le.localeCompare(a.cree_le)); },
      async deciderCommentaire(id, decision, texte) {
        await init(); const x = liste("commentaires").find(y => y.id === id && y.commerce_id === cur().id);
        appliquerDecisionCommentaire(x, decision, texte); jour(cur().id, "COMMENTAIRE_" + String(decision).toUpperCase(), { commentaire: id }); sauver(); return x.statut;
      },
      async adminCommentairesAPublier() { await init(); admin(); return liste("commentaires").filter(x => x.statut === "a_publier_main").map(x => ({ ...x, commerce: (E.commerces[x.commerce_id] || {}).nom })).sort((a, b) => (a.decide_le || "").localeCompare(b.decide_le || "")); },
      async adminCommentairePublie(id) {
        await init(); admin(); const x = liste("commentaires").find(y => y.id === id);
        if (!x || x.statut !== "a_publier_main") throw new Error("Cette réponse n'est pas dans la file à publier à la main.");
        Object.assign(x, { statut: "publie", publie_par: "equipe", reponse: x.reponse_proposee, repondu_le: iso(Date.now()) }); jour(x.commerce_id, "COMMENTAIRE_PUBLIE", { par: "equipe" }); sauver();
      },
      async adminMusiquesAPoser() { await init(); admin(); return liste("publications").filter(x => x.musique_a_poser && !x.musique_posee_le && ["programme", "envoye"].includes(x.statut)).map(x => ({ ...x, commerce: (E.commerces[x.commerce_id] || {}).nom })).sort((a, b) => a.prevu_le.localeCompare(b.prevu_le)); },
      async adminMusiquePosee(id) {
        await init(); admin(); const x = liste("publications").find(y => y.id === id);
        if (!x || !x.musique_a_poser || x.musique_posee_le) throw new Error("Aucun son à poser pour cette publication.");
        x.musique_posee_le = iso(Date.now()); jour(x.commerce_id, "MUSIQUE_PLATEFORME_POSEE", { publication: x.id, par: "equipe" }); sauver();
      },
      // ---- console de PJ
      // Marque Metricool du commerce (22/10/2026) : mêmes règles que admin_metricool_marque (chiffres seulement, une marque par commerce).
      async adminMetricoolMarque(cid, blog) {
        await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable."); const b = String(blog == null ? "" : blog).trim() || null;
        if (b && !/^[0-9]{1,20}$/.test(b)) throw new Error(PHRASES_MARQUE.invalide);
        if (b && Object.values(E.commerces).some(x => x.id !== cid && x.metricool_blog_id === b)) throw new Error(PHRASES_MARQUE.prise);
        // Journal (v46, 11/11/2026, bloc « Journal de la marque Metricool » de schema.sql) : une ligne interne, seulement si le blogId change.
        if ((c.metricool_blog_id || null) !== b) jour(cid, "METRICOOL_MARQUE_NOTEE", { blog_id: b, avant: c.metricool_blog_id || null, par: "console" });
        c.metricool_blog_id = b; sauver(); return { commerce_id: cid, metricool_blog_id: b };
      },
      async adminCommerces() { await init(); admin(); return Object.values(E.commerces).map(c => ({ ...c, relecture_equipe: relectureDemo(c), compteur: vc(c), comptes: E.comptes[c.id] || {}, alertes: E.avis.filter(a => a.commerce_id === c.id && a.sensible && a.statut === "humain").length, sante: santeDemo(c),
        demandes_style: liste("demandes_style").filter(d => d.commerce_id === c.id && !d.traitee_le).length })); },
      async adminJournal() { await init(); admin(); return E.journal.slice(0, 300).map(j => ({ ...j, commerce: (E.commerces[j.commerce_id] || {}).nom })); },
      // Journal d'UN client (v46) : lu à part, adminJournal s'arrête aux 300 lignes les plus récentes de TOUS les clients.
      async adminJournalClient(cid) { await init(); admin(); return E.journal.filter(j => j.commerce_id === cid).slice(0, 500).map(j => ({ ...j, commerce: (E.commerces[j.commerce_id] || {}).nom })); },
      async adminAlertes() {
        await init(); admin(); const nom = id => (E.commerces[id] || {}).nom;
        // 26/10/2026 (console, garantie des 24 h) : chaque alerte porte son code, son commerce et, selon sa source, l'avis (« Ouvrir l'avis ») ou
        // l'identifiant de l'alerte de l'exploitant (« Traité » : admin_alerte_vue) ; une alerte traitée (vue_le) n'est plus listée.
        return [...E.avis.filter(a => a.sensible && a.statut === "humain").map(a => ({ type: "Avis sensible", code: "AVIS_SENSIBLE", avis_id: a.id, commerce_id: a.commerce_id, commerce: nom(a.commerce_id), texte: (a.raisons || []).join(", ") + " : " + (a.texte || "").slice(0, 100), date: a.cree_le })),
          ...liste("commentaires").filter(x => x.categorie === "sensible" && x.statut === "humain").map(x => ({ type: "Commentaire sensible", code: "COMMENTAIRE_SENSIBLE", commentaire_id: x.id, commerce_id: x.commerce_id, commerce: nom(x.commerce_id), texte: (x.raisons || []).join(", ") + " : " + (x.texte || "texte effacé après 30 jours").slice(0, 100), date: x.cree_le })),
          ...E.journal.filter(j => ["REFUS", "LEGENDE_REFUSEE", "PHOTO_HORS_SUJET", "LOGO_RECU_DANS_PHOTOS", "PHOTO_CONTROLE_PANNE", "ECHEC_PUBLICATION", "SCHEMA_INCOMPLET"].includes(j.type)).map(j => ({ type: j.type, code: j.type, journal: true, detail: j.detail, commerce_id: j.commerce_id, commerce: nom(j.commerce_id), texte: JSON.stringify(j.detail), date: j.cree_le })),
          ...E.publications.filter(p => p.statut === "echec").map(p => ({ type: "Publication en échec", code: "PUBLICATION_ECHEC", publication_id: p.id, commerce_id: p.commerce_id, commerce: nom(p.commerce_id), texte: p.erreur || "", date: p.prevu_le })),
          ...liste("alertes_exploitant").filter(a => !a.vue_le).map(a => ({ type: titreAlerte(a, nom(a.commerce_id)), code: a.type, id: a.id, commerce_id: a.commerce_id || null, commerce: nom(a.commerce_id) || "", texte: texteAlerte(a), date: a.cree_le, detail_alerte: a.detail || {} })),
          ...rechercheBloquee(Object.values(E.commerces)).map(x => ({ ...x, commerce: nom(x.commerce_id) || "", type: titreAlerte(x, nom(x.commerce_id)), texte: texteAlerte(x) }))];
      },
      // Réponses du démarrage saisies par l'équipe (13/11/2026, console v49) : mêmes règles que admin_reponses_demarrage (schema.sql).
      async adminReponsesDemarrage(cid, rep) {
        await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable.");
        const { demarrage, champs } = fusionnerDemarrage(c.demarrage, rep), n = repondues5(demarrage);
        if (!champs.length) return { etat: "rien", champs, demarrage, repondues: n, fini: !!c.demarrage_fini };
        c.demarrage = demarrage;
        if (!String(c.ton || "").trim() && TONS.includes(demarrage.ton)) c.ton = demarrage.ton;
        if (!String(c.specialites || "").trim() && String(demarrage.distinctions || "").trim()) c.specialites = String(demarrage.distinctions).trim();
        if (n === 5) c.demarrage_fini = true;   // le point « demarrage » de la mise en route suit demarrage_fini (etatMiseEnRoute)
        jour(cid, "REPONSES_DEMARRAGE_PAR_EQUIPE", { champs, par: "console", repondues: n, demarrage_fini: !!c.demarrage_fini }); sauver();
        return { etat: "modifie", champs, demarrage, repondues: n, fini: !!c.demarrage_fini };
      },
      // Fiche Google reçue sans client, ignorée (13/11/2026) : mêmes règles que admin_ignorer_fiche_google.
      async adminIgnorerFicheGoogle(id) {
        await init(); admin(); const a = liste("alertes_exploitant").find(x => String(x.id) === String(id));
        if (!a || a.type !== "FICHE_A_RELIER") throw new Error("Alerte « Fiche Google à relier » introuvable.");
        if (a.commerce_id) throw new Error("Cette fiche est rattachée à un client : traitez-la depuis sa fiche.");
        if (a.vue_le) return { etat: "deja", vue_le: a.vue_le };
        a.vue_le = iso(Date.now()); a.detail = { ...(a.detail || {}), ignoree: true, ignoree_par: "console" };
        E.journal.unshift({ id: uid(), commerce_id: null, type: "FICHE_GOOGLE_IGNOREE", detail: { alerte: a.id, titre: (a.detail || {}).titre || null, adresse: (a.detail || {}).adresse || null, cle: (a.detail || {}).cle || null, par: "console" }, cree_le: iso(Date.now()) });
        sauver(); return { etat: "ignoree", vue_le: a.vue_le };
      },
      // Photos d'un client (dossier de démarrage de la console, v49) : statut et motif de refus seulement.
      // v52 : mêmes champs que l'adaptateur Supabase (photoConsole) ; vignette : l'image gardée dans ce navigateur (url de la graine ou du dépôt).
      async adminPhotosClient(cid) { await init(); admin();
        const l = liste("photos").filter(x => x.commerce_id === cid).sort((a, b) => String(b.cree_le).localeCompare(String(a.cree_le))).slice(0, 200);
        return l.map((x, i) => Object.assign(photoConsole(x), i < PHOTOS_VUES ? { url: x.url || null, controle: controleDe(E.journal, x.id) } : {})); },
      async adminContenusClient(cid) { await init(); admin();
        return E.contenus.filter(x => x.commerce_id === cid).sort((a, b) => String(b.cree_le).localeCompare(String(a.cree_le))).slice(0, CONTENUS_VUS).map(x => {
          const p = E.publications.find(y => y.contenu_id === x.id && ["programme", "envoye", "publie"].includes(y.statut));
          return { id: x.id, type: x.type, format: x.format || "publication", statut: x.statut, legende: x.legende || "", fichier: x.fichier || null, cree_le: x.cree_le, photo_id: x.photo_id || null,
            url: x.visuel_url || null, prevu_le: p ? p.prevu_le : null, musique: (x.musique && x.musique.plateforme) || null }; }); },
      // « C'est le logo » : mêmes règles que admin_logo_depuis_photo (kit verrouillé ou réglé à la main jamais écrasé ; sinon kit proposé depuis le
      // logo, NON verrouillé, choix déjà faits gardés). Démonstration : logo gardé dans ce navigateur, réduit à 512 px (comme logoDemo).
      async adminLogoDepuisPhoto(pid) {
        await init(); admin(); const p = liste("photos").find(x => x.id === pid); if (!p) throw new Error("Photo introuvable.");
        if (p.statut === "refusee" && p.refus_motif === "logo") return { etat: "deja" };
        if (!(p.statut === "refusee" && ["doute", "hors_sujet"].includes(p.refus_motif))) throw new Error("Seule une photo refusée par le contrôle (doute ou hors sujet) peut devenir le logo.");
        const c = E.commerces[p.commerce_id]; if (!c) throw new Error("Commerce introuvable.");
        const m = c.marque, raison = m && m.verrouille ? "verrouille" : m && m.auto === false ? "main" : null, motif = p.refus_motif; let chemin = null;
        if (!raison) {
          if (!p.url) throw new Error(PHRASE_LOGO_ILLISIBLE);
          const MQ = window.RENOM_MARQUE, cat = await MQ.charger(), img = await MQ.chargerImage(p.url).catch(() => { throw new Error(PHRASE_LOGO_ILLISIBLE); });
          const r = Math.min(1, 512 / Math.max(img.naturalWidth || 512, img.naturalHeight || 512)), cv = document.createElement("canvas");
          cv.width = Math.max(1, Math.round((img.naturalWidth || 512) * r)); cv.height = Math.max(1, Math.round((img.naturalHeight || 512) * r)); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          chemin = c.id + "/marque/logo-photo-" + (String(pid).replace(/[^A-Za-z0-9]/g, "").slice(0, 40) || "x") + ".png";
          const garde = {}; ["mots_signature", "a_eviter", "gabarit_prefere", "gabarit_impose", "texte_photos"].forEach(x => { const v = m && m[x]; if (v != null && v !== false && !(Array.isArray(v) && !v.length)) garde[x] = v; });
          const k = { ...MQ.proposer({ logo: MQ.pixels(img), metier: c.metier, ton: c.ton || "", logoChemin: chemin, cat }), ...garde, logo: chemin, auto: true, verrouille: false, source: { type: "logo" } };
          delete k.valide_par; const f = MQ.fautes(MQ.sansBase(k), c.id, cat); if (f.length) throw new Error("Kit de marque refusé : " + f.join(", "));
          E.logos = E.logos || {}; E.logos[chemin] = cv.toDataURL("image/png");
          c.marque = { ...k, version: (+(m && m.version) || 0) + 1, maj: iso(Date.now()), verrouille_le: null }; c.couleurs = MQ.couleursCommerce(c.marque);
        }
        p.refus_motif = "logo";
        jour(c.id, "LOGO_POSE_PAR_EQUIPE", { photo: p.id, fichier: p.chemin || null, motif_avant: motif, logo_pose: !raison, logo: chemin, marque_version: raison ? null : c.marque.version, par: "console", simule: true });
        sauver(); return { etat: raison ? "garde" : "pose", raison, logo: chemin, marque_version: raison ? null : c.marque.version };
      },
      // « Accepter quand même » : mêmes règles que admin_accepter_photo ; démonstration : le faux rendu part tout de suite, sans contrôle.
      async adminAccepterPhoto(pid) {
        await init(); admin(); const p = liste("photos").find(x => x.id === pid); if (!p) throw new Error("Photo introuvable.");
        if (p.controle_force && p.statut !== "refusee") return { etat: "deja", statut: p.statut };
        if (!(p.statut === "refusee" && ["doute", "hors_sujet"].includes(p.refus_motif))) throw new Error("Seule une photo refusée par le contrôle (doute ou hors sujet) peut être acceptée sans contrôle.");
        const motif = p.refus_motif; Object.assign(p, { statut: "a_traiter", refus_motif: null, controle_force: true });
        jour(p.commerce_id, "PHOTO_ACCEPTEE_PAR_EQUIPE", { photo: p.id, fichier: p.chemin || null, motif_avant: motif, par: "console", simule: true });
        faux.creation(p); sauver(); return { etat: "relancee", webhook: true };
      },
      // ---- Relecture par l'équipe avant le client (14/11/2026) : mêmes règles que admin_contenus_a_relire, admin_envoyer_au_client,
      // admin_corriger_legende, admin_refaire_contenu et admin_regler_relecture (schema.sql, bloc « Relecture par l'équipe avant le client »).
      async adminContenusARelire() { await init(); admin();
        const l = E.contenus.filter(x => x.statut === "a_relire"), plusAncien = {};
        l.forEach(x => { plusAncien[x.commerce_id] = plusAncien[x.commerce_id] && plusAncien[x.commerce_id] < x.cree_le ? plusAncien[x.commerce_id] : x.cree_le; });
        return l.map(x => { const c = E.commerces[x.commerce_id] || {}, g = liste("garantie_delais").find(y => y.commerce_id === x.commerce_id), pc = g ? delaisEtat(g).premier_contenu : null;
          const ech = pc && !pc.fait_le && pc.echeance ? Date.parse(pc.echeance) : null, ph = x.photo_id ? liste("photos").find(y => y.id === x.photo_id) : null;
          return { id: x.id, commerce_id: x.commerce_id, commerce: c.nom || "", type: x.type, format: x.format || "publication", statut: x.statut, legende: x.legende || "", legendes: x.legendes || null,
            fichier: x.fichier || null, photo_id: x.photo_id || null, precision_photo: ph ? ph.precision || null : null, depot_video_id: x.depot_video_id || null, version: x.version || 1,
            drapeaux: x.drapeaux || null, ia: estIA(x), gabarit: x.gabarit || null, cree_le: x.cree_le, echeance: ech == null ? null : iso(ech),
            heures_restantes: ech == null ? null : Math.round((ech - Date.now()) / 360000) / 10, urgent: ech != null && ech - Date.now() < RELECTURE_ALERTE_H * MS_H, en_retard: ech != null && Date.now() > ech,
            refaire: x.depot_video_id ? "montage" : x.photo_id ? "photo" : "non", url: x.visuel_url || null, video_url: x.video_url || null }; })
          .sort((a, b) => String(plusAncien[a.commerce_id]).localeCompare(String(plusAncien[b.commerce_id])) || String(a.commerce_id).localeCompare(String(b.commerce_id)) || String(a.cree_le).localeCompare(String(b.cree_le))); },
      async adminEnvoyerAuClient(id) { await init(); admin(); const x = E.contenus.find(y => y.id === id); if (!x) throw new Error("Contenu introuvable.");
        if (x.statut === "a_valider") return { etat: "deja", statut: x.statut }; if (x.statut !== "a_relire") throw new Error(`Ce contenu n'est plus en relecture (${x.statut}).`);
        x.statut = "a_valider"; x.soumis_le = iso(Date.now()); jour(x.commerce_id, "RELU_PAR_EQUIPE", { contenu: x.id, type: x.type, format: x.format || "publication", par: "console" });
        emettreJeton(x.commerce_id, "contenu", x.id); if (x.depot_video_id) { const d = liste("depots_video").find(y => y.id === x.depot_video_id); if (d) d.statut = "a_valider"; }
        sauver(); return { etat: "envoye", statut: x.statut, soumis_le: x.soumis_le }; },
      async adminCorrigerLegende(id, legende, legendes) { await init(); admin(); const x = E.contenus.find(y => y.id === id); if (!x) throw new Error("Contenu introuvable.");
        if (x.statut !== "a_relire") throw new Error(`Ce contenu n'est plus en relecture (${x.statut}).`);
        const t = String(legende || "").trim(), l = controlerCorrection(x, t, legendes, (E.commerces[x.commerce_id] || {}).langue || "fr");
        // Lot 1 (15/11/2026) : même garde-fou que admin_corriger_legende : légende commune changée, légende d'un réseau renvoyée telle quelle.
        const inch = t !== String(x.legende || "").trim() && x.legendes ? Object.keys(x.legendes).filter(k => k in l && String(l[k]).trim() === String(x.legendes[k]).trim() && String(x.legendes[k]).trim() !== t).sort() : [];
        if (inch.length) throw new Error(`La légende commune a changé, mais pas celle de ${inch.map(k => ({ instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", google: "Google" })[k] || k).join(", ")} : corrigez-la aussi, ou videz sa case pour reprendre la légende commune.`);
        jour(x.commerce_id, "LEGENDE_CORRIGEE_PAR_EQUIPE", { contenu: x.id, avant: x.legende || null, reseaux: Object.keys(l).sort(), par: "console" });
        x.legende = t; x.legendes = Object.keys(l).length ? l : null; const r = await this.adminEnvoyerAuClient(id); return { ...r, legende: t, legendes: x.legendes }; },   // Lot 3 : « self » visait window (bug de démonstration « adminEnvoyerAuClient is not a function »)
      async adminRefaireContenu(id) { await init(); admin(); const x = E.contenus.find(y => y.id === id); if (!x) throw new Error("Contenu introuvable.");
        if (x.statut !== "a_relire") throw new Error(`Ce contenu n'est plus en relecture (${x.statut}) : il ne se refait plus d'ici.`);
        if (x.depot_video_id) { const d = liste("depots_video").find(y => y.id === x.depot_video_id);
          if ((x.version || 1) > 1) x.statut = "modification"; else E.contenus.splice(E.contenus.indexOf(x), 1);
          if (d) Object.assign(d, { statut: "envoye", motif: null, contenu_id: (x.version || 1) > 1 ? x.id : null, essais: (d.essais || 0) + 1 });
          jour(x.commerce_id, "CONTENU_A_REFAIRE", { contenu: x.id, depot: x.depot_video_id, mecanisme: "admin_relancer_montage", reprise: (x.version || 1) > 1, par: "console" });
          if (d) setTimeout(() => { faux.montage(d); sauver(); }, 1200); sauver(); return { etat: "relance", mecanisme: "montage", reprise: (x.version || 1) > 1 }; }
        if (!x.photo_id) throw new Error("Ce contenu (vidéo d'avis) ne se refait pas automatiquement : corrigez la légende ou envoyez-le au client.");
        if (E.contenus.some(y => y.photo_id === x.photo_id && y.statut !== "a_relire")) throw new Error("Un autre contenu de cette photo est déjà parti chez le client : refaire la photo créerait un doublon.");
        const eff = E.contenus.filter(y => y.photo_id === x.photo_id && y.statut === "a_relire"); eff.forEach(y => E.contenus.splice(E.contenus.indexOf(y), 1));
        const p = liste("photos").find(y => y.id === x.photo_id); if (p && p.statut === "traitee") p.statut = "a_traiter";
        jour(x.commerce_id, "CONTENU_A_REFAIRE", { contenu: x.id, photo: x.photo_id, contenus_effaces: eff.map(y => y.id), mecanisme: "photo_a_traiter", par: "console" });
        if (p) setTimeout(() => { if (p.statut === "a_traiter") { faux.creation(p); sauver(); } }, 1200);   // faux n8n + faux rendu
        sauver(); return { etat: "relance", mecanisme: "photo", photo: x.photo_id, contenus_effaces: eff.length, webhook: true }; },
      // Typographie du réel par client (14/11/2026) : mêmes règles que admin_regler_typo (clés permises, note obligatoire pour « site » et « supports »,
      // textes nettoyés, vide = retiré, site web en https://, polices de la liste fermée) ; journal TYPO_RELEVEE.
      async adminReglerTypo(cid, p) { await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable.");
        const MQ = window.RENOM_MARQUE, cat = await MQ.charger(), q = { ...(p || {}) }, permis = ["police_titres", "police_texte", "source_typo", "typo_note", "supports_fournis", "surtitre", "site_web"];
        Object.keys(q).forEach(k => { if (!permis.includes(k)) throw new Error("Typographie refusée : clé inconnue : " + k); });
        let site = c.site_web || null; if ("site_web" in q) { site = String(q.site_web || "").trim() || null; if (site && !/^https?:\/\//i.test(site)) site = "https://" + site;
          if (site && (!/^https?:\/\/\S+$/.test(site) || site.length > 300)) throw new Error("Site web : une adresse comme https://www.exemple.be (300 caractères au plus)."); delete q.site_web; }
        const m = { ...(c.marque || MQ.normaliser(null, c.couleurs, c.metier, c.ton || "", cat)) };
        ["typo_note", "supports_fournis", "surtitre"].forEach(k => { if (k in q) { const v = String(q[k] || "").replace(/\s+/g, " ").trim(); if (v) q[k] = v; else { delete q[k]; delete m[k]; } } });
        const src = q.source_typo || m.source_typo; if (["site", "supports"].includes(src) && !(q.typo_note || m.typo_note)) throw new Error("Notez qui a relevé la typographie et où (site, carte, flyer…).");
        const k = { ...m, ...q, auto: false }; const f = MQ.fautes(k, cid, cat); if (f.length) throw new Error("Kit de marque refusé : " + f.map(x => window.RENOM_I18N ? window.RENOM_I18N.t("sty.f." + x) : x).join(", "));
        c.marque = { ...k, version: (+m.version || 0) + 1, maj: iso(Date.now()), valide_par: "renom" }; c.site_web = site;
        jour(cid, "TYPO_RELEVEE", { par: "console", source_typo: c.marque.source_typo || null, police_titres: c.marque.police_titres, police_texte: c.marque.police_texte, note: c.marque.typo_note || null, marque_version: c.marque.version, site_web: site });
        sauver(); return { ...c.marque, site_web: site }; },
      async adminReglerRelecture(cid, active) { await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable.");
        const v = active !== false; if (relectureDemo(c) === v) return { etat: "deja", relecture_equipe: v };
        c.relecture_equipe = v; const n = E.contenus.filter(x => x.commerce_id === cid && x.statut === "a_relire").length;
        jour(cid, "RELECTURE_EQUIPE_REGLEE", { relecture_equipe: v, par: "console", en_relecture: n }); sauver(); return { etat: "regle", relecture_equipe: v, en_relecture: n }; },
      // Lot 1 (15/11/2026) : mêmes règles que admin_alerte_vue (bloc « Console : garde-fous ») : une erreur de workflow se ferme avec une note.
      async adminAlerteVue(id, note) {
        await init(); admin(); const a = liste("alertes_exploitant").find(x => String(x.id) === String(id)); if (!a) throw new Error("Alerte introuvable.");
        const n = String(note || "").trim(); if (n.length > 500) throw new Error("Note trop longue (500 caractères au plus).");
        if (a.type === "ERREUR_WORKFLOW" && !a.vue_le && n.length < 5) throw new Error("Écrivez en quelques mots ce qui a été fait avant de fermer cette erreur.");
        a.vue_le = a.vue_le || iso(Date.now()); if (n) a.note_cloture = n; sauver();
      },
      // Prises en charge (« Je prends », 26/10/2026) : mêmes règles que admin_prises et admin_prendre (schema.sql).
      async adminPrises() { await init(); admin(); const lim = Date.now() - 30 * 24 * HEURE; return liste("prises_en_charge").filter(x => Date.parse(x.pris_le) >= lim).map(x => ({ ...x })); },
      async adminPrendre(cle, par, prendre = true) {
        await init(); admin(); const k = String(cle || ""), nomP = String(par || "").trim();
        if (!/^[a-z_]+:[A-Za-z0-9:_.-]{1,160}$/.test(k)) throw new Error("Carte inconnue.");
        const l = liste("prises_en_charge"), lim = Date.now() - 30 * 24 * HEURE; E.prises_en_charge = l.filter(x => Date.parse(x.pris_le) >= lim && x.cle !== k);
        if (!prendre) { sauver(); return { cle: k, par: null, pris_le: null }; }
        if (nomP.length < 1 || nomP.length > 40) throw new Error("Indiquez votre prénom (40 caractères au plus).");
        const x = { cle: k, par: nomP, pris_le: iso(Date.now()) }; E.prises_en_charge.push(x); sauver(); return { ...x };
      },
      // Nouveau client (26/10/2026) : mêmes règles que admin_creer_client (schema.sql) : ville, langue, lien de la fiche Google, prospect d'origine.
      async adminCreerClient(p) {
        await init(); admin(); p = p || {}; const nomC = String(p.nom || "").trim(), email = String(p.email || "").trim().toLowerCase(), lg = p.langue || "fr", fiche = String(p.fiche || "").trim() || null;
        if (!nomC || !/^[^\s@]+@[^\s@]+$/.test(email)) throw new Error("Nom et email valides requis.");
        if (!["fr", "en", "nl"].includes(lg)) throw new Error("Langue inconnue (fr, en ou nl).");
        const py = String(p.pays || "").trim().toUpperCase(); if (!["FR", "BE"].includes(py)) throw new Error("Pays du commerce requis : France ou Belgique.");
        if (fiche && (fiche.length > 500 || !/^https:\/\/([a-z0-9-]+\.)*(google\.[a-z]{2,3}(\.[a-z]{2})?|goo\.gl|g\.page)\/[^\s"<>]*$/.test(fiche))) throw new Error("Lien de la fiche Google illisible (adresse https de Google Maps).");
        const pr = p.prospect ? liste("prospects").find(x => x.id === p.prospect) : null, m = fiche && fiche.match(/(?:query_place_id=|place_id[:=])([A-Za-z0-9_-]+)/);
        const id = await this.adminCreer(nomC, p.metier, p.offre, email), c = E.commerces[id];
        Object.assign(c, { ville: String(p.ville || "").trim(), langue: lg, pays: py, fiche_google_lien: fiche, google_place_id: (m && m[1]) || (pr && /^[A-Za-z0-9_-]+$/.test(pr.place_id || "") ? pr.place_id : null) || null });
        const j = E.journal.find(x => x.commerce_id === id && x.type === "COMMERCE_CREE"); if (j) Object.assign(j.detail, { langue: lg, prospect: pr ? pr.id : null, pays: py });
        sauver(); return id;
      },
      async adminCreer(nom, metier, offre, email) {
        await init(); admin(); if (!nom.trim() || !/.+@.+/.test(email)) throw new Error("Nom et email valides requis.");
        if (!OFFRES_EN_VENTE.includes(offre)) throw new Error("Offre plus vendue : " + offre + ". " + MSG_OFFRES);
        const id = "c-" + uid().slice(0, 8); E.commerces[id] = { id, nom: nom.trim(), metier, ville: "", offre_id: offre, en_pause: false, mots_cles: [], mentions_autorisees: [], couleurs: { fond: "#FFFFFF", texte: "#000000", accent: "#2438FF" }, reglage_avis: "auto_des_4_etoiles", email_validation: email.toLowerCase() };
        E.comptes[id] = Object.fromEntries(RESEAUX.map(r => [r, { etat: "non_connecte" }])); E.invitations.push({ id: uid(), email: email.toLowerCase(), commerce_id: id, statut: "a_envoyer", cree_le: new Date().toISOString() });
        E.users[email.toLowerCase()] = { role: "commerçant", commerce: id }; jour(id, "COMMERCE_CREE", { offre }); sauver(); return id;
      },
      // Changement d'offre (console, 27/10/2026) : changement complet (changerOffreDemo, comme admin_changer_offre) et tâche « Mettre Stripe à jour »
      // si le commerce a un abonnement Stripe non résilié d'une autre offre.
      async adminOffre(id, offre) { await init(); admin(); if (!OFFRES_EN_VENTE.includes(offre) && E.commerces[id].offre_id !== offre) throw new Error("Offre plus vendue : " + offre + ". " + MSG_OFFRES);
        const r = changerOffreDemo(id, offre, "console"); if (!r.change) return r;
        liste("alertes_exploitant").filter(a => a.commerce_id === id && a.type === "STRIPE_A_METTRE_A_JOUR" && !a.vue_le).forEach(a => { a.vue_le = iso(Date.now()); });
        const ab = (E.abonnements || []).filter(x => x.commerce_id === id && x.statut !== "resilie").sort((x, y) => String(y.maj_le || "").localeCompare(String(x.maj_le || "")))[0];
        if (ab && ab.offre !== offre) { alerteDemo("STRIPE_A_METTRE_A_JOUR", id, { abonnement: ab.stripe_subscription || null, client_stripe: ab.stripe_customer || null, offre, offre_stripe: ab.offre, sens: r.sens }); r.tache_stripe = true; }
        sauver(); return r; },
      async adminPause(id, pause) { await init(); admin(); E.commerces[id].en_pause = !!pause; jour(id, pause ? "MISE_EN_PAUSE" : "REPRISE", {}); sauver(); },
      async adminInvitations() { await init(); admin(); return E.invitations.map(i => ({ ...i, commerce: (E.commerces[i.commerce_id] || {}).nom })); },
      // Cockpit (29/10/2026) : mêmes lectures que l'adaptateur Supabase, sur l'état de démonstration (rien n'est inventé ici : ce que la graine ou les
      // gestes de la démonstration ont écrit).
      async adminCockpit(depuis) {
        await init(); admin(); const d7 = Date.now() - 7 * 864e5, d30 = Date.now() - 30 * 864e5, t = x => Date.parse(x || 0) || 0;
        const estTest = x => !!(x && x.detail && (x.detail.test === true || x.detail.test === "true"));
        return {
          abonnements: liste("abonnements").map(a => ({ commerce_id: a.commerce_id || null, offre: a.offre, statut: a.statut, rythme: a.rythme || null, remise_lancement_fin: a.remise_lancement_fin || null, stripe_subscription: a.stripe_subscription || null, remplace_par: a.remplace_par || null, cree_le: a.cree_le || null, maj_le: a.maj_le || null })),
          invitations: (E.invitations || []).map(i => ({ id: i.id, commerce_id: i.commerce_id, statut: i.statut, erreur: i.erreur || null, cree_le: i.cree_le })),
          envois: liste("envois_service").filter(x => x.statut === "echec" && t(x.cree_le) >= d7),
          whatsapp: liste("alertes_whatsapp").filter(x => ["echec", "abandonne"].includes(x.statut) && t(x.cree_le) >= d7),
          avis: (E.avis || []).filter(a => { const r = a.traite_le || a.repondu_le; return r && (!depuis || t(r) >= depuis); }).map(a => ({ id: a.id, commerce_id: a.commerce_id, cree_le: a.cree_le, traite_le: a.traite_le || null, repondu_le: a.repondu_le || null, retenues: retenuesDe(a) })),
          equipe_whatsapp: (E.equipe_whatsapp || [{ prenom: "Pierre-Jean", numero: "+33699080539", actif: true }]).filter(x => x.actif),
          creations: E.journal.filter(j => j.type === "COMMERCE_CREE").map(j => ({ commerce_id: j.commerce_id, type: j.type, detail: j.detail || {}, cree_le: j.cree_le })),
          tests: [...E.journal.filter(x => t(x.cree_le) >= d7), ...liste("alertes_exploitant").filter(x => !x.vue_le && t(x.cree_le) >= d30)].filter(estTest).map(x => ({ commerce_id: x.commerce_id || null, type: x.type, detail: x.detail || {}, cree_le: x.cree_le })),
          // Avis reçus ce mois-ci (heure de Paris) au-delà de 100 par commerce : même règle que admin_avis_du_mois() de schema.sql.
          avis_mois: (() => { const m = FMT_JOUR_PARIS.format(new Date()).slice(0, 7), n = {};
            (E.avis || []).forEach(a => { if (a.cree_le && FMT_JOUR_PARIS.format(new Date(a.cree_le)).slice(0, 7) === m) n[a.commerce_id] = (n[a.commerce_id] || 0) + 1; });
            return Object.entries(n).filter(([, k]) => k > 100).map(([cid, k]) => ({ commerce_id: cid, nom: (E.commerces[cid] || {}).nom || "", avis: k })); })(),
          // Vidéo IA (11/11/2026) : dernière ligne PRODUIT du journal qui porte « video_ia » (moteur/rendu_cloud.py), comme l'adaptateur Supabase.
          video_ia: (() => { const j = E.journal.filter(x => x.type === "PRODUIT" && x.detail && x.detail.video_ia).sort((a, b) => t(b.cree_le) - t(a.cree_le))[0];
            return { derniere: j ? { ...j.detail.video_ia, quand: j.cree_le, commerce_id: j.commerce_id || null } : null, mois: videoIaMoisDemo() }; })(),
          // Photos (v51, 13/11/2026) : statut et motif de refus, pour dire pourquoi l'horloge de la garantie ne tourne pas (cockpit.js), comme Supabase.
          photos: liste("photos").map(x => ({ commerce_id: x.commerce_id, statut: x.statut, refus_motif: x.refus_motif || null })),
          illisible: [], tronques: [],
        };
      },
      // ---- Style du commerce réglé par BoostImpact (console) : mêmes règles que « Votre style », auteur « renom » (fonction SQL admin_regler_marque)
      async adminMarque(cid) { await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable."); return { commerce: c, ...(await marqueDemo(c)) }; },
      async adminDeposerLogo(cid, f) { await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable."); return logoDemo(c, f); },
      async adminEnregistrerMarque(cid, kit, valider) { await init(); admin(); const c = E.commerces[cid]; if (!c) throw new Error("Commerce introuvable."); const m = await enregistrerMarqueDemo(c, kit, !!valider, "renom", !!valider);
        demandesStyleDemo(c).forEach(d => { if (!d.traitee_le) d.traitee_le = new Date().toISOString(); }); sauver(); return m; },
      // ---- outils de démonstration (n'existent qu'ici)
      outilsDemo: {
        // Aperçu des emails de validation que le commerçant recevrait (aucun email ne part en démonstration)
        async emailsValidation() {
          await init(); const c = cur(); if (c.notifications && c.notifications.email === false) return [];
          const court = t => { t = String(t || ""); return t.length > 160 ? t.slice(0, t.lastIndexOf(" ", 160)) + "…" : t; };
          // Lot 5 B (revue James : la démo montrait « Une réponse à un commentaire attend votre accord » alors que l'espace dit « disponible
          // prochainement ») : aucun email de réponse à un commentaire tant que les réponses aux commentaires ne sont pas disponibles pour l'offre.
          return liste("jetons_validation").filter(j => j.commerce_id === c.id && (j.objet !== "commentaire" || !!offreDe(c.id).commentaires_disponible)).map(j => lireJeton(j.jeton)).filter(r => r.etat === "a_valider").reverse().map(({ j, o }) => ({
            jeton: j.jeton, objet: j.objet, expire_le: j.expire_le, extrait: court(j.objet === "contenu" ? o.legende : o.texte),
            objet_email: j.objet === "avis" ? "Une réponse d'avis attend votre accord" : j.objet === "commentaire" ? "Une réponse à un commentaire attend votre accord"
              : ({ story: "Une story attend votre accord", video: "Une vidéo attend votre accord" })[formatDe(o)] || "Une publication attend votre accord",
            phrase: j.objet === "avis" ? `Un avis de ${o.note} sur 5 a reçu une proposition de réponse. Ouvrez le lien pour la lire, la modifier si besoin, puis décider.`
              : j.objet === "commentaire" ? `Un commentaire ${COMMENTAIRES.RESEAUX[o.reseau] ? "sur " + COMMENTAIRES.RESEAUX[o.reseau] + " " : ""}a reçu une proposition de réponse. Ouvrez le lien pour la lire, la modifier si besoin, puis décider.`
              : `Un nouveau contenu pour ${c.nom} attend votre accord. Ouvrez le lien pour le voir réseau par réseau, puis décider.` }));
        },
        async avisFictif() {
          await init(); const c = cur(); const sens = false, id = uid(); E.avis.unshift({ id, commerce_id: c.id, google_review_id: "demo-" + uid().slice(0, 6), auteur: "Alex D.", note: 2, texte: "L'attente au départ nous a semblé longue.", reponse_proposee: "Bonjour Alex, merci d'avoir pris le temps de nous écrire. Nous sommes désolés que l'attente au départ vous ait semblé longue. Pour en parler, " + (!c.contact ? "écrivez-nous à l'adresse de contact de votre fiche" : /@/.test(c.contact) ? "écrivez-nous à " + c.contact : "contactez-nous par " + c.contact) + ". Nous espérons vous revoir bientôt.", sensible: sens, raisons: [], statut: "a_valider", decision: "validation_commercant", cree_le: new Date().toISOString(), demo: true }); jour(c.id, "AVIS_RECU", { simule: true });
          if (reglerAvisOffre(E.avis[0])) jour(c.id, "AVIS_EQUIPE", { avis: id, note: 2 }); else emettreJeton(c.id, "avis", id); sauver();
        },
        async echeances() { await init(); let n = 0; E.publications.forEach(p => { if (p.statut === "programme") { p.statut = "publie"; p.prevu_le = new Date(Date.now() - 60000).toISOString(); n++; const ct = E.contenus.find(c => c.id === p.contenu_id); if (ct) ct.statut = "publie"; jour(p.commerce_id, "PUBLIE", { simule: true }); } });
          // Réponses d'avis validées et actions de fiche validées : publiées (simulé)
          E.avis.forEach(a => { if (a.statut === "valide") { a.statut = "publie"; a.reponse = a.reponse_proposee; a.repondu_le = iso(Date.now()); jour(a.commerce_id, "AVIS_PUBLIE", { simule: true }); n++; } });
          liste("actions_fiche").forEach(a => { if (a.statut === "a_publier") { a.statut = "publie"; a.publie_le = iso(Date.now()); jour(a.commerce_id, "ACTION_FICHE_PUBLIEE", { type: a.type, simule: true }); n++; } });
          sauver(); return n; },
        async rendus() { await init(); E.photos.filter(p => p.statut === "a_traiter").forEach(p => faux.creation(p)); vaDemandes().forEach(d => faux.videoAvis(d)); liste("depots_video").forEach(d => faux.montage(d)); sauver(); },
        // Le service du jour, joué dans le navigateur : les demandes échues passent « envoyées » (rien ne part), avec les mêmes règles d'annulation.
        async serviceDuJour() {
          await init(); let n = 0; const now = Date.now();
          liste("demandes_avis").filter(x => x.statut === "a_envoyer" && Date.parse(x.prevu_le) <= now).sort((a, b) => a.prevu_le.localeCompare(b.prevu_le)).forEach(x => {
            const c = E.commerces[x.commerce_id] || {}, freres = E.demandes_avis.filter(y => y.client_id === x.client_id);
            const motif = c.en_pause ? "commerce en pause" : !lienAvisPublic(c) ? "lien d'avis Google absent" : liste("oppositions").some(o => o.commerce_id === x.commerce_id && o.email === x.email) ? "opposition"
              : x.etape === "relance" && !freres.some(y => y.etape === "demande" && y.statut === "envoye") ? "demande non envoyée"
              : x.etape === "relance" && freres.some(y => y.ouvert_le || y.clic_le) ? "page d'avis déjà ouverte" : null;
            if (motif) { x.statut = "annule"; x.motif = motif; } else { x.statut = "envoye"; x.envoye_le = iso(now); n++; }
          });
          sauver(); return n;
        },
        async reinitialiser() { try { localStorage.removeItem(K); localStorage.removeItem(K + ":retours"); localStorage.removeItem(K + ":collecte"); } catch (e) {} E = null; pret = null; await init(); },
      },
    };
  }

  // =============================================================== SUPABASE
  // Adresse de retour du lien reçu par email (choix du mot de passe : invitation, mot de passe oublié) : la page ouverte (index.html ou console.html), dans son dossier, sans fragment ni « ?reset ».
  // Jamais une origine écrite en dur : marche sous un sous-dossier (https://hote/dossier/) comme à la racine d'un domaine.
  // Elle doit figurer dans Supabase, Authentication, URL Configuration, Redirect URLs (sinon Supabase renvoie vers la Site URL).
  function retourConnexion() { const u = new URL(location.href); u.hash = ""; u.searchParams.delete("reset"); return u.href; }
  // config.js renseigné mais bibliothèque Supabase absente (vendor/supabase.js non servi) : JAMAIS la démonstration à la place.
  // L'écran de connexion s'affiche ; toute action dit que le service est indisponible.
  function indisponible() {
    const msg = "Le service ne répond pas (bibliothèque de connexion absente). Rechargez la page ; si cela continue, contactez-nous.";
    return new Proxy({ mode: "indisponible", async session() { return null; }, async estAdmin() { return false; } },
      { get: (o, k) => k in o ? o[k] : k === "then" || typeof k === "symbol" ? undefined : async () => { throw new Error(msg); } });
  }
  function supabase() {
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.publishableKey);
    let cache = null;
    // Langue choisie dans l'espace (sélecteur FR / EN / NL) : enregistrée sur le compte (user_metadata.langue), lue par les modèles d'email de
    // Supabase (.Data.langue). langue_choisie : le choix de la personne prime sur la langue du commerce (déclencheurs de schema.sql).
    if (window.RENOM_I18N) window.RENOM_I18N.surChoix = async l => {
      const { data } = await sb.auth.getSession(); if (!data.session) return;
      await sb.auth.updateUser({ data: { langue: l, langue_choisie: true } });
    };
    const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
    // ---- Accès par mot de passe (17/10/2026, acces.js). Une session dont le jeton n'a pas « password » (ou « totp ») dans amr est née d'un lien
    // d'email : elle n'ouvre que le choix du mot de passe, et la base lui refuse tout (schema.sql, session_par_mot_de_passe()).
    const ACC = window.RENOM_ACCES;
    const lireSession = async () => { const { data } = await sb.auth.getSession(); return (data && data.session) || null; };
    const parMotDePasse = s => !!s && ACC.accesDuJeton(s.access_token);
    // Erreurs de Supabase Auth (champ code, https://supabase.com/docs/guides/auth/debugging/error-codes) -> code affiché par acces.js (acc.err.<code>).
    // Réseau coupé : AuthRetryableFetchError, statut 0 (supabase-js). Jamais le texte brut de Supabase (anglais, parfois révélateur).
    // Double authentification (18/10/2026) : codes de Supabase Auth (internal/api/apierrors/errorcode.go, commit ce9a8ee) : code faux
    // (mfa_verification_failed, « Invalid TOTP code entered ») ou défi expiré -> « code » ; facteur retiré -> « facteur » ; TOTP désactivé dans le
    // tableau de bord (mfa_totp_enroll_not_enabled, mfa_totp_verify_not_enabled) -> « desactive ».
    const erreurAuth = er => {
      const c = (er && er.code) || "", st = er && er.status, reseau = (er && er.name === "AuthRetryableFetchError") || st === 0 || st >= 500;
      const code = reseau ? "service" : ["mfa_verification_failed", "mfa_challenge_expired"].includes(c) ? "code" : c === "mfa_factor_not_found" ? "facteur"
        : ["mfa_totp_enroll_not_enabled", "mfa_totp_verify_not_enabled"].includes(c) ? "desactive"
        : ["invalid_credentials", "email_not_confirmed", "user_banned", "user_not_found"].includes(c) ? "identifiants"
        : c === "weak_password" ? "faible" : st === 429 || /rate_limit/.test(c) ? "trop"
        : ["otp_expired", "flow_state_expired", "flow_state_not_found"].includes(c) ? "lien"
        : ["reauthentication_needed", "session_not_found", "session_expired", "bad_jwt", "no_authorization"].includes(c) || st === 401 ? "session" : "autre";
      return Object.assign(new Error((er && er.message) || code), { code, codeSupabase: c });
    };
    // Compte connu ? (15/11/2026, décision de PJ : « aucun compte n'existe avec cette adresse » en rouge) ; null si la base ne répond pas.
    const compteExiste = async email => { try { const r = await sb.rpc("compte_existe", { p_email: String(email || "").trim() }); return r.error ? null : r.data === true; } catch (x) { return null; } };
    const entrerParMotDePasse = async (email, mdp) => {
      const r = await sb.auth.signInWithPassword({ email, password: mdp });
      if (r.error) { const er = erreurAuth(r.error); if (er.code === "identifiants" && await compteExiste(email) === false) er.code = "inconnu"; throw er; }
      if (!parMotDePasse(r.data && r.data.session)) { await sb.auth.signOut({ scope: "local" }); throw Object.assign(new Error("jeton sans mot de passe"), { code: "autre" }); }
      cache = null;
    };
    // Kit de marque d'un commerce (espace du commerçant et console) : photos et logo du seau « photos » par adresses signées d'une heure.
    const signe = async ch => { try { const r = await sb.storage.from("photos").createSignedUrl(ch, 3600); return r.data && r.data.signedUrl; } catch (e) { return null; } };
    async function marqueDe(c) {
      const MQ = window.RENOM_MARQUE, cat = await MQ.charger();
      const ph = ok(await sb.from("photos").select("id,chemin,nom_fichier,cree_le").eq("commerce_id", c.id).or("statut.neq.refusee,refus_motif.eq.plafond").order("cree_le", { ascending: false }).limit(9));
      const urls = await Promise.all(ph.map(p => signe(p.chemin)));
      return { kit: c.marque ? MQ.normaliser(c.marque, c.couleurs, c.metier, c.ton || "", cat) : null, brut: c.marque || null,
        photos: ph.map((p, i) => ({ url: urls[i], nom: p.nom_fichier })).filter(p => p.url), logo: c.marque && c.marque.logo ? await signe(c.marque.logo) : null,
        demandes: ok(await sb.from("demandes_style").select("id,texte,cree_le,traitee_le").eq("commerce_id", c.id).order("cree_le", { ascending: false }).limit(20)) };
    }
    async function marqueDeAvecLogo(c) {   // lot 9d : plus le logo joint à la dernière demande non traitée (voir logoDemande)
      const m = await marqueDe(c), d = logoDemande(c, m.demandes), url = d ? await signe(d.chemin).catch(() => null) : null;
      return { ...m, logo_demande: d && url ? { ...d, url } : null };
    }
    // Logo : seau « photos », <commerce>/marque/logo-<aléa>.<ext> (règles de stockage : storage.sql pour le commerçant, schema.sql pour BoostImpact). Un SVG est converti en PNG.
    async function logoDe(c, f) {
      const MQ = window.RENOM_MARQUE, e = MQ.controlerLogo(f); if (e) throw Object.assign(new Error("logo " + e), { code: "sty.logo." + e });
      const blob = MQ.estSvg(f) ? await MQ.enPng(f, 1024) : f;
      const ext = MQ.estSvg(f) ? "png" : ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[f.type] || (f.name.split(".").pop() || "png").toLowerCase().replace("jpeg", "jpg"));
      const chemin = c.id + "/marque/logo-" + uid().replace(/[^a-z0-9]/gi, "").slice(0, 12) + "." + ext;
      ok(await sb.storage.from("photos").upload(chemin, blob, { contentType: MQ.estSvg(f) ? "image/png" : f.type }));
      return { chemin, url: URL.createObjectURL(blob) };
    }
    // Contrôle avant l'envoi (mêmes règles que la base, qui a le dernier mot) : rend le kit sans les champs posés par la base.
    async function kitControle(kit, cid) {
      const MQ = window.RENOM_MARQUE, cat = await MQ.charger(), m = MQ.sansBase(kit), f = MQ.fautes(m, cid, cat);
      if (f.length) throw Object.assign(new Error("Kit de marque refusé : " + f.join(", ")), { codes: f });
      return m;
    }
    const self = {
      mode: "supabase",
      // Double authentification de l'administrateur (18/10/2026, acces.js) : doubleAuth = étape de la console (« ok », « code », « activer »,
      // « mot_de_passe ») ; la base n'ouvre rien à l'administrateur avant « ok » (est_admin(), bloc SQL du 18/10/2026). codeRequis : session née
      // d'un lien d'email sur un compte qui a déjà un facteur : Supabase exige le code avant de changer le mot de passe (internal/api/user.go :
      // « AAL2 session is required to update email or password when MFA is enabled. »). Rien ne change pour un commerçant (aucun facteur).
      // Depuis le 22/10/2026 (DOUBLE_AUTH_ADMIN = false, acces.js) : etapeAdmin rend « ok » dès le mot de passe ; codeRequis reste (contrainte
      // de Supabase, tant qu'un facteur vérifié existe sur le compte).
      async session() {
        const s = await lireSession(); if (!s) return null;
        const charge = ACC.decoderJwt(s.access_token), facteur = ACC.facteurTotpVerifie(s.user);
        if (!parMotDePasse(s)) return { email: s.user.email, role: null, motDePasseRequis: true, codeRequis: facteur && !(charge && charge.aal === "aal2") };
        if (!(await self.estAdmin())) return { email: s.user.email, role: "commerçant" };
        return { email: s.user.email, role: "administrateur", doubleAuth: ACC.etapeAdmin(charge, facteur) };
      },
      // Écran de la double authentification. « activer » : un éventuel facteur non vérifié (activation interrompue) est retiré, sinon Supabase
      // refuse le même nom (mfa_factor_name_conflict, internal/api/mfa.go, validateFactors), puis enroll rend le QR code (SVG en adresse data:,
      // posée par supabase-js) et la clé. « code » : le facteur vérifié. listFactors relit le compte (getUser) : un facteur retiré depuis le
      // tableau de bord n'y est plus. Rend { mode } si l'étape a changé entre-temps.
      async doubleAuthPreparer(mode) {
        const l = await sb.auth.mfa.listFactors(); if (l.error) throw erreurAuth(l.error);
        const verifies = l.data.totp || [];
        if (verifies.length) return mode === "code" ? { factorId: verifies[0].id } : { mode: "code" };
        if (mode === "code") return { mode: "activer" };
        for (const x of (l.data.all || []).filter(x => x.factor_type === "totp" && x.status !== "verified")) {
          const u = await sb.auth.mfa.unenroll({ factorId: x.id }); if (u.error) throw erreurAuth(u.error);
        }
        const r = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "BoostImpact console", issuer: "BoostImpact" });
        if (r.error) throw erreurAuth(r.error);
        return { factorId: r.data.id, qr: r.data.totp && r.data.totp.qr_code, secret: r.data.totp && r.data.totp.secret };
      },
      // Code de l'application : défi puis vérification (challengeAndVerify) ; la session passe en aal2 avec amr [totp, password].
      async doubleAuthVerifier(factorId, code) {
        if (!ACC.codeValide(code)) throw Object.assign(new Error("code à 6 chiffres"), { code: "format" });
        const r = await sb.auth.mfa.challengeAndVerify({ factorId, code: ACC.codeSaisi(code) });
        if (r.error) throw erreurAuth(r.error);
        cache = null;
      },
      // Connexion : adresse + mot de passe. Le lien magique n'est plus une façon d'entrer (plus aucun appel au lien magique de Supabase Auth).
      async connecter(email, mdp) { await entrerParMotDePasse(String(email || "").trim(), String(mdp || "")); },
      // « Première connexion ou mot de passe oublié ? » : lien de récupération, qui revient sur la page ouverte. Même réponse que l'adresse ait un
      // compte ou non (Supabase répond 200 pour une adresse inconnue ; son 429 « déjà envoyé » ne vise qu'un compte existant : il est tu lui
      // aussi, sinon il trahirait l'existence du compte). Seule une panne du réseau est dite.
      // 15/11/2026 (décision de PJ) : une adresse sans compte est dite (« inconnu », ligne rouge), vérifiée par compte_existe() (schema.sql) ;
      // un envoi limité (429 : un email est déjà parti il y a moins d'une minute) est dit aussi (« deja »). Base injoignable : on envoie quand même.
      async demanderLienMotDePasse(email) {
        const adr = String(email || "").trim();
        if (await compteExiste(adr) === false) throw Object.assign(new Error("compte inconnu"), { code: "inconnu" });
        const r = await sb.auth.resetPasswordForEmail(adr, { redirectTo: retourConnexion() });
        if (r.error) { const er = erreurAuth(r.error); if (er.code === "service") throw er; if (er.code === "trop") throw Object.assign(er, { code: "deja" }); }
        return {};
      },
      // Lien d'email au nouveau format (26/10/2026, acces.js, lienEmail) : vérifié seulement au clic de la personne. verifyOtp({ token_hash, type })
      // (supabase.com/docs/reference/javascript/auth-verifyotp) ouvre une session née du lien (amr « otp », internal/api/verify.go, verifyPost) :
      // elle n'ouvre que le choix du mot de passe, comme avant. Jeton expiré, déjà servi ou inconnu : 403 otp_expired -> code « lien ».
      async verifierLien(token_hash, type) {
        if (!ACC.TYPES_LIEN.includes(type)) throw Object.assign(new Error("type de lien inconnu"), { code: "lien" });
        await sb.auth.signOut({ scope: "local" }).catch(() => {});   // une autre session ouverte sur cet appareil ne se mélange pas au lien
        const r = await sb.auth.verifyOtp({ token_hash, type });
        if (r.error) throw erreurAuth(r.error);
        if (!r.data || !r.data.session) throw Object.assign(new Error("lien sans session"), { code: "lien" });
        cache = null;
      },
      // Choix du mot de passe depuis la session d'un lien d'email : updateUser, puis la session du lien est fermée (révoquée côté Supabase) et une
      // nouvelle s'ouvre par signInWithPassword : son jeton porte amr « password » (updateUser ne change pas l'amr de la session en cours).
      async choisirMotDePasse(mdp) {
        mdp = String(mdp || ""); if (!ACC.controlerMotDePasse(mdp).ok) throw Object.assign(new Error("règles du mot de passe"), { code: "regles" });
        const s = await lireSession(); if (!s) throw Object.assign(new Error("session absente"), { code: "session" });
        const email = s.user.email, u = await sb.auth.updateUser({ password: mdp });
        if (u.error && u.error.code !== "same_password") throw erreurAuth(u.error);   // same_password : c'est déjà son mot de passe, il ouvre donc la session
        await sb.auth.signOut({ scope: "local" });
        await entrerParMotDePasse(email, mdp);
      },
      async quitter() { cache = null; await sb.auth.signOut(); },
      async estAdmin() { const s = await lireSession(); if (!parMotDePasse(s)) return false; const r = ok(await sb.from("admins").select("user_id").eq("user_id", s.user.id).maybeSingle()); return !!r; },
      async commerce() {
        if (cache) return cache;
        const m = ok(await sb.from("membres").select("commerce_id").limit(1).maybeSingle());
        if (!m) throw new Error("Aucun commerce n'est rattaché à ce compte. Contactez BoostImpact.");
        return (cache = ok(await sb.from("commerces").select("*").eq("id", m.commerce_id).single()));
      },
      // Métier (11/11/2026) : la colonne metier n'est dans aucun « grant update » (schema.sql) ; l'envoyer faisait refuser TOUTE la mise à jour de
      // « Ma fiche » (permission denied, prouvé dans espace/supabase/test/metier_admin.test.mjs). Inchangé : il n'est plus envoyé ; changé : message
      // clair, rien n'est envoyé (l'équipe le corrige par admin_metier, console, État et offre).
      async enregistrer(ch) { const c = await self.commerce(); const m = {}; FICHE.forEach(k => { if (k in ch) m[k] = ch[k]; });
        if ("metier" in m) { if (m.metier && m.metier !== c.metier) throw new Error(METIER_EQUIPE); delete m.metier; }
        if (Object.keys(m).length) ok(await sb.from("commerces").update(m).eq("id", c.id)); cache = null; },
      // « * » (28/10/2026) : refus_motif (photo hors sujet) quand le bloc SQL est appliqué, sans erreur avant.
      // Vignettes de Photos (01/11/2026, tour 9) : une version de 200 px, seulement si le stockage la fournit, c'est-à-dire la transformation
      // d'image de Supabase (forfait payant ; le projet est sur le forfait gratuit, voir ordres/BRANCHEMENT.md) et RENOM_CONFIG.vignettes200 à
      // true. Sinon aucune adresse : la vignette reste vide, jamais la photo d'origine (jusqu'à 50 Mo) chargée pour une vignette de 48 px.
      async photos() { const c = await self.commerce(), l = ok(await sb.from("photos").select("*").eq("commerce_id", c.id).order("cree_le", { ascending: false }).limit(100));
        // 15/11/2026 (retour de PJ : « Contenu prêt » alors que rien n'arrive) : la règle contenus_lecture cache au commerçant les contenus « a_relire » ;
        // une photo « traitee » sans aucun contenu visible est donc encore relue par l'équipe -> en_relecture (affichée « En préparation »).
        try { const ids = l.filter(p => p.statut === "traitee").map(p => p.id);
          if (ids.length) { const vus = new Set((ok(await sb.from("contenus").select("photo_id").in("photo_id", ids)) || []).map(x => x.photo_id)); l.forEach(p => { p.en_relecture = p.statut === "traitee" && !vus.has(p.id); }); } } catch (x) {}
        if (cfg.vignettes200 === true) await Promise.all(l.map(async p => { try { const r = await sb.storage.from("photos").createSignedUrl(p.chemin, 3600, { transform: { width: 200, height: 200, resize: "cover", quality: 70 } }); if (r.data && r.data.signedUrl) p.url = r.data.signedUrl; } catch (e) {} }));
        return l; },
      // ---- Photos (17/10/2026 : SEUL chemin des photos, plus aucune par email). Envoi résumable TUS dans le seau « photos », directement dans le
      // dossier du commerce (<commerce>/<aléa>.<ext> : espace/web/envoi.js, même envoi que le dépôt de vidéos), puis la fonction deposer_photos
      // enregistre l'envoi entier : une ligne « photos » par fichier, qui lance la création de contenus (hook_photo -> n8n « RENOM, création de
      // contenus »), exactement comme une photo reçue par email avant. L'insertion directe dans « photos » n'est plus permise au commerçant.
      async envoyerPhoto(f, o = {}) {
        const k = await window.RENOM_ENVOI.controler(f); if (k.genre !== "photo") throw new Error(PHOTOS.PHRASES.format); if (k.raison) throw new Error(PHOTOS.PHRASES.lourde);
        const c = await self.commerce(), chemin = c.id + "/" + (o.nom || window.RENOM_ENVOI.nomPhoto(f));
        const jeton = async () => { const { data } = await sb.auth.getSession(); return data && data.session ? data.session.access_token : null; };
        const r = await window.RENOM_ENVOI.envoyer({ fichier: f, seau: "photos", objet: chemin, url: cfg.supabaseUrl, cle: cfg.publishableKey, jeton, onProgress: o.onProgress, onEtat: o.onEtat, signal: o.signal });
        return { chemin, deja: r.deja };
      },
      async deposerPhotos(details) {
        const c = await self.commerce(), r = await sb.rpc("deposer_photos", { p_commerce: c.id, p_details: details });
        if (r.error) throw new Error(phrasePhotos(r.error.message)); return r.data;
      },
      async deposer(f) { const r = await self.envoyerPhoto(f); return self.deposerPhotos([{ chemin: r.chemin, nom: f.name, taille: f.size }]); },
      // ---- Autorisation photos (22/10/2026, CGV article 11) : la case du commerçant (autoriser_photos) ; côté console, le retrait demandé par email
      // et « Déposer des photos pour ce client » : envoi TUS dans le dossier du commerce (règle photos_seau_depot de storage.sql, administrateur et
      // autorisation), puis admin_deposer_photos (mêmes contrôles que deposer_photos, source « equipe »).
      async autoriserPhotos() { const c = await self.commerce(), r = await sb.rpc("autoriser_photos", { p_commerce: c.id }); if (r.error) throw new Error(phrasePhotos(r.error.message)); cache = null; return r.data; },
      // ---- Alertes WhatsApp (22/10/2026) : la case du commerçant (regler_whatsapp : numéro E.164, heure de l'accord, journal WHATSAPP_ACCORD).
      // ---- Lot 10 : numéro de TVA facultatif (regler_numero_tva) ; « Je n'en ai pas… » le note pour ne plus le demander.
      async reglerNumeroTva(numero, ignorer) {
        const c = await self.commerce(), n = ignorer ? null : numeroTva(numero, paysDe(c.pays)); if (!ignorer && !n) throw new Error(PHRASE_TVA);
        const r = await sb.rpc("regler_numero_tva", { p_numero: n, p_ignorer: !!ignorer }); if (r.error) throw new Error(r.error.message); cache = null; return r.data;
      },
      async reglerWhatsapp(numero, accord) {
        const c = await self.commerce(), n = accord ? numeroWhatsapp(numero, paysDe(c.pays)) : null; if (accord && !n) throw new Error(phraseWhatsapp(paysDe(c.pays))); if (accord && numeroFixe(n)) throw new Error(PHRASE_FIXE);
        const r = await sb.rpc("regler_whatsapp", { p_commerce: c.id, p_numero: n, p_accord: !!accord });
        if (r.error) throw new Error(/indicatif du pays/.test(r.error.message) ? phraseWhatsapp(c.pays) : r.error.message); cache = null; return r.data;
      },
      // ---- Notifications de l'application (15/11/2026) : abonnement de CE téléphone, enregistré après l'accord du client (bouton, puis la question du
      // téléphone) ; retiré par « Arrêter les notifications ». Le commerce est celui du compte (mon_commerce), jamais choisi par l'espace.
      async enregistrerPush(a) { return ok(await sb.rpc("enregistrer_abonnement_push", { p_endpoint: a.endpoint, p_p256dh: a.p256dh, p_auth: a.auth, p_user_agent: String(navigator.userAgent || "").slice(0, 400) })); },
      async retirerPush(endpoint) { return ok(await sb.rpc("retirer_abonnement_push", { p_endpoint: endpoint })); },
      async adminAutoriserPhotos(cid, accord) { if (!accord) throw new Error(PHRASE_PHOTOS_ACCORD_EQUIPE); return ok(await sb.rpc("admin_autoriser_photos", { p_commerce: cid, p_accord: true })); },
      async adminRetirerAutorisationPhotos(cid) { return ok(await sb.rpc("admin_retirer_autorisation_photos", { p_commerce: cid })); },
      // ---- Accord vidéo IA (14/11/2026) : interrupteur du commerçant (regler_accord_video_ia) et accord noté par l'équipe (admin_regler_accord_video_ia).
      async reglerAccordVideoIa(oui) { const c = await self.commerce(), r = await sb.rpc("regler_accord_video_ia", { p_commerce: c.id, p_accord: !!oui }); if (r.error) throw new Error(r.error.message); cache = null; return r.data; },
      async adminReglerAccordVideoIa(cid, donner, accordClient) { if (donner && !accordClient) throw new Error(PHRASE_VIA_ACCORD_EQUIPE);
        return ok(await sb.rpc("admin_regler_accord_video_ia", { p_commerce: cid, p_donner: !!donner, p_accord_client: !!accordClient })); },
      async adminEnvoyerPhoto(cid, f, o = {}) {
        const k = await window.RENOM_ENVOI.controler(f); if (k.genre !== "photo") throw new Error(PHOTOS.PHRASES.format); if (k.raison) throw new Error(PHOTOS.PHRASES.lourde);
        const chemin = cid + "/" + (o.nom || window.RENOM_ENVOI.nomPhoto(f));
        const jeton = async () => { const { data } = await sb.auth.getSession(); return data && data.session ? data.session.access_token : null; };
        const r = await window.RENOM_ENVOI.envoyer({ fichier: f, seau: "photos", objet: chemin, url: cfg.supabaseUrl, cle: cfg.publishableKey, jeton, onProgress: o.onProgress, onEtat: o.onEtat, signal: o.signal });
        return { chemin, deja: r.deja };
      },
      async adminDeposerPhotos(cid, details) { const r = await sb.rpc("admin_deposer_photos", { p_commerce: cid, p_details: details }); if (r.error) throw new Error(phrasePhotos(r.error.message)); return r.data; },
      async contenus() { const c = await self.commerce(); return ok(await sb.from("contenus").select("id,type,format,statut,legende,legendes,fichier,note_modification,cree_le,decide_le,depot_video_id,drapeaux,gabarit,photo_id").eq("commerce_id", c.id).order("cree_le", { ascending: false }).limit(100)); },
      // ---- Kit de marque (écran « Votre style ») : colonne commerces.marque ; la base contrôle le kit, pose la version, l'auteur et aligne commerces.couleurs.
      async marque() { return marqueDe(await self.commerce()); },
      async deposerLogo(f) { return logoDe(await self.commerce(), f); },
      // Le commerçant ne règle que son logo, ses expressions et la validation (fonction regler_ma_marque) ; le reste est réglé par BoostImpact.
      async reglerMaMarque(p, valider) { const r = ok(await sb.rpc("regler_ma_marque", { p: p || {}, p_valider: valider == null ? null : !!valider })); cache = null; return r; },
      async demanderChangementStyle(texte) { return ok(await sb.rpc("demander_changement_style", { p_texte: String(texte || "") })); },
      // ---- Style du commerce réglé par BoostImpact (console) : fonction admin_regler_marque (n'écrit que commerces.marque ; auteur « renom » posé par la base)
      async adminMarque(cid) { const c = ok(await sb.from("commerces").select("*").eq("id", cid).single()); return { commerce: c, ...(await marqueDeAvecLogo(c)) }; },
      async adminDeposerLogo(cid, f) { return logoDe({ id: cid }, f); },
      async adminEnregistrerMarque(cid, kit, valider) {
        const m = await kitControle({ ...kit, verrouille: !!valider, auto: false }, cid); delete m.valide_par;
        return ok(await sb.rpc("admin_regler_marque", { p_commerce: cid, p_marque: m, p_valider: !!valider }));
      },
      // Fichier publié sur le réseau demandé (cheminVisuel) : une story montre visuel-story.jpg (celui qui part, gabarit « plein »), plus le 9x16
      // de la publication ; une publication photo montre le 9x16 pour TikTok, le 4x5 sinon.
      async urlVisuel(ct, reseau) { const ch = cheminVisuel(ct, reseau); if (!ch) return null; const r = ok(await sb.storage.from("contenus").createSignedUrl(ch, 3600)); return r.signedUrl; },
      async urlVideo(ct) { if (ct.type !== "video" || !ct.fichier) return null; const r = ok(await sb.storage.from("contenus").createSignedUrl(ct.fichier, 3600)); return r.signedUrl; },
      async valider(id, statut, note) {
        if (statut === "modification" && !(note || "").trim()) throw new Error("Écrivez un mot pour dire ce qu'il faut modifier.");
        const motif = statut === "refuse" && String(note || "").trim() ? String(note).trim().slice(0, 500) : null;   // motif de refus facultatif (31/10/2026)
        const r = ok(await sb.from("contenus").update({ statut, note_modification: statut === "modification" ? note.trim() : motif }).eq("id", id).select());
        if (!r.length) throw new Error("Ce contenu est déjà traité.");
      },
      async remettreAValider(id) { return ok(await sb.rpc("remettre_a_valider", { p_contenu: id })); },
      async idees() { const c = await self.commerce(); return ok(await sb.from("idees").select("id,titre,texte,cree_le,origine,statut,semaine,motif").eq("commerce_id", c.id).order("cree_le", { ascending: false }).limit(50)); },
      async demanderIdees() { const c = await self.commerce(), r = await sb.from("idees_demandes").insert({ commerce_id: c.id });
        if (r.error) throw new Error(/une demande d'idées par jour/.test(r.error.message || "") ? PHRASE_IDEES_JOUR : r.error.message); },
      async calendrier() { const c = await self.commerce(); return ok(await sb.from("publications").select("*, contenu:contenus(id,type,legende,fichier,statut,hors_plafond,mois)").eq("commerce_id", c.id).order("prevu_le")); },
      async programmer({ contenu_id, reseaux, prevu_le }) { if (!Array.isArray(reseaux) || !reseaux.length) throw new Error("Choisissez où publier."); const c = await self.commerce(); ok(await sb.from("publications").insert({ commerce_id: c.id, contenu_id, reseaux, prevu_le: new Date(prevu_le).toISOString() })); },
      // La base vérifie l'offre, la connexion et le format (déclencheurs verifier_programmation et verifier_reseaux_retenus).
      async publierSurGoogle(id) { ok(await sb.from("publications").update({ reseaux: ["google"] }).eq("id", id)); },
      async deplacer(id, prevu_le) { ok(await sb.from("publications").update({ prevu_le: new Date(prevu_le).toISOString() }).eq("id", id)); },
      async annuler(id) { ok(await sb.from("publications").update({ statut: "annule" }).eq("id", id)); },
      // Toutes les colonnes (22/10/2026) : propose_le (réponse d'un avis sensible envoyée par email) et publie_par (mode de secours) sont lues si la base
      // les a, sans casser l'écran si un bloc n'est pas encore collé. Le commerçant lit déjà toute la ligne de ses avis (règle avis_lecture).
      async avis() { const c = await self.commerce(); return ok(await sb.from("avis").select("*").eq("commerce_id", c.id).order("cree_le", { ascending: false }).limit(100)); },
      async validerAvis(id, statut, texte) { const m = { statut }; if (texte != null) m.reponse_proposee = texte; const r = ok(await sb.from("avis").update(m).eq("id", id).select()); if (!r.length) throw new Error("Cet avis ne se valide pas ici."); },
      async comptes() { const c = await self.commerce(); const l = ok(await sb.from("comptes_connectes").select("reseau,etat,detail,maj").eq("commerce_id", c.id)); return RESEAUX.map(r => l.find(x => x.reseau === r) || { reseau: r, etat: "non_connecte", detail: "" }); },
      // Photos en préparation (01/11/2026) : vue compteur_photos (bloc « Créneaux réels ») ; base sans la vue : 0, l'ancien compte.
      async compteur() { const c = await self.commerce(), [k, ph] = await Promise.all([sb.from("compteur").select("*").eq("commerce_id", c.id).single(), sb.from("compteur_photos").select("publications_preparation").eq("commerce_id", c.id).maybeSingle()]);
        return Object.assign(ok(k), { publications_preparation: ph && !ph.error && ph.data ? +ph.data.publications_preparation || 0 : 0 }); },
      // Abonnement Stripe du commerce (lecture seule : la table n'est écrite que par le webhook, schema.sql, bloc « abonnements Stripe »).
      // « * » : la colonne rythme n'existe qu'avec le bloc SQL du 27/10/2026 (sans lui : lien de montée mensuel).
      async abonnement() { const c = await self.commerce(); return abonnementCourant(ok(await sb.from("abonnements").select("*").eq("commerce_id", c.id).order("maj_le", { ascending: false }).limit(5))); },
      lienAbonnement, lienMonteeOffre, demandeDeLien,
      // Session Checkout en euros (voir CHECKOUT_URL) : jeton de la base, puis le webhook ; toute erreur remonte (app.js retombe sur le lien).
      async sessionPaiement(c, d) {
        const j = ok(await sb.rpc("jeton_paiement", { p_commerce: c.id }));
        if (!j || !/^[0-9a-f]{64}$/.test(j.jeton || "")) throw new Error("jeton de paiement illisible");
        const r = await fetch(CHECKOUT_URL, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jeton: j.jeton, offre: d.offre, rythme: d.rythme, frais: d.frais, langue: langueStripe() }) });
        const x = await r.json().catch(() => null);
        if (!r.ok || !x || x.ok !== true || typeof x.url !== "string" || !/^https:\/\/checkout\.stripe\.com\/[^\s"<>]+$/.test(x.url)) throw new Error("session de paiement refusée");
        return x.url;
      },
      // Mode délégation par bouton (27/10/2026) : seulement si la base a le bloc « Changement d'offre en libre-service et mode délégation dans
      // l'espace » (colonne delegation_version_cgv lue par select *). Sans lui : l'écran Offre garde « écrivez-nous ».
      delegationParBouton(c) { return !!c && Object.prototype.hasOwnProperty.call(c, "delegation_version_cgv"); },
      async reglerDelegation(active) {
        const c = await self.commerce(), r = await sb.rpc("regler_delegation", { p_commerce: c.id, p_active: !!active });
        if (r.error) throw new Error(r.error.message); cache = null; return r.data;
      },
      async journal() { const c = await self.commerce(); return journalCommercant(ok(await sb.from("journal").select("*").eq("commerce_id", c.id).order("cree_le", { ascending: false }).limit(100))); },
      // ---- Collecte : page publique et retours privés
      async jetonAvis() { return (await self.commerce()).jeton_avis; },
      avisPublic: jeton => publicSupabase.avisPublic(jeton),
      deposerRetour: (jeton, r) => publicSupabase.deposerRetour(jeton, r),
      async retoursPrives() { const c = await self.commerce(); return ok(await sb.from("retours_prives").select("id,note,message,prenom,lu,cree_le").eq("commerce_id", c.id).order("cree_le", { ascending: false }).limit(200)); },
      async marquerRetour(id, lu) { const r = ok(await sb.from("retours_prives").update({ lu: !!lu }).eq("id", id).select("id")); if (!r.length) throw new Error("Retour introuvable."); },
      // ---- Collecte : fin
      // ---- Vidéo d'avis (la base refuse elle-même une demande hors règles : déclencheur verifier_demande_video_avis)
      async avisVideo() { const c = await self.commerce(); return ok(await sb.from("avis").select("id,note,texte,auteur,sensible,cree_le,efface_le").eq("commerce_id", c.id).order("cree_le", { ascending: false }).limit(100)); },
      // ---- Réponses aux commentaires : table commentaires (lecture), décisions par la fonction decider_commentaire (la base revérifie tout)
      async commentaires() { const c = await self.commerce(); return ok(await sb.from("commentaires").select("id,reseau,lien,auteur,texte,categorie,raisons,reponse_proposee,reponse,refus,statut,decision,publie_par,erreur,cree_le,ecrit_le,decide_le,repondu_le,efface_le").eq("commerce_id", c.id).order("cree_le", { ascending: false }).limit(100)); },
      async deciderCommentaire(id, decision, texte) { if (decision === "valide" && texte != null) controlerDecisionCommentaire({ statut: "a_valider" }, decision, texte); return ok(await sb.rpc("decider_commentaire", { p_id: id, p_decision: decision, p_texte: texte == null ? null : String(texte) })); },
      async adminCommentairesAPublier() { const cs = ok(await sb.from("commerces").select("id,nom")); return ok(await sb.from("commentaires").select("*").eq("statut", "a_publier_main").order("decide_le")).map(x => ({ ...x, commerce: (cs.find(c => c.id === x.commerce_id) || {}).nom })); },
      async adminCommentairePublie(id) { ok(await sb.rpc("admin_commentaire_publie", { p_id: id })); },
      // Son de plateforme à poser à la main dans Metricool (publications.musique_a_poser, rempli par n8n ; fonction admin_musique_posee).
      async adminMusiquesAPoser() { const cs = ok(await sb.from("commerces").select("id,nom")); return ok(await sb.from("publications").select("id,commerce_id,contenu_id,reseaux,prevu_le,statut,musique_a_poser").not("musique_a_poser", "is", null).is("musique_posee_le", null).in("statut", ["programme", "envoye"]).order("prevu_le")).map(x => ({ ...x, commerce: (cs.find(c => c.id === x.commerce_id) || {}).nom })); },
      async adminMusiquePosee(id) { ok(await sb.rpc("admin_musique_posee", { p_id: id })); },
      // ---- Dépôt de vidéos : table depots_video (lecture, création), fonctions finaliser_depot_video et annuler_depot_video ; fichiers envoyés en TUS
      // (espace/web/envoi.js) dans le seau « photos », <commerce>/rushes/<dépôt>/. La base revérifie tout ; ses refus sont ramenés aux phrases communes.
      async depotsVideo() { const c = await self.commerce(); return ok(await sb.from("depots_video").select("id,statut,motif,note,nb_fichiers,nb_videos,duree_totale_s,details,contenu_id,mois,cree_le,envoye_le,valide_le,rushes_effaces_le").eq("commerce_id", c.id).order("cree_le", { ascending: false }).limit(30)); },
      async compteurVideos() { const c = await self.commerce(); return ok(await sb.from("compteur_videos").select("*").eq("commerce_id", c.id).single()); },
      async creerDepotVideo({ note } = {}) {
        const c = await self.commerce(), n = String(note || "").trim(); if (n.length > window.RENOM_ENVOI.REGLES.NOTE_MAX) throw new Error(DEPOT_VIDEO.PHRASES.note);
        const r = await sb.from("depots_video").insert({ commerce_id: c.id, note: n || null }).select("id").single(); if (r.error) throw new Error(phraseDepot(r.error.message)); return r.data;
      },
      async fichiersRecus(depot) {
        const c = await self.commerce(), r = await sb.storage.from("photos").list(c.id + "/rushes/" + depot, { limit: 100 });
        return Object.fromEntries((r.data || []).filter(x => x.metadata && x.metadata.size != null).map(x => [x.name, +x.metadata.size]));
      },
      async envoyerFichierDepot(depot, f, rang, o = {}) {
        const c = await self.commerce(), chemin = c.id + "/rushes/" + depot + "/" + window.RENOM_ENVOI.nomDansDepot(rang, f);
        if (o.deja) { if (o.onProgress) o.onProgress(f.size, f.size); return { chemin, deja: true }; }
        const jeton = async () => { const { data } = await sb.auth.getSession(); return data && data.session ? data.session.access_token : null; };
        const r = await window.RENOM_ENVOI.envoyer({ fichier: f, seau: "photos", objet: chemin, url: cfg.supabaseUrl, cle: cfg.publishableKey, jeton, onProgress: o.onProgress, onEtat: o.onEtat, signal: o.signal });
        return { chemin, deja: r.deja };
      },
      async finaliserDepotVideo(depot, details) { const r = await sb.rpc("finaliser_depot_video", { p_depot: depot, p_details: details }); if (r.error) throw new Error(phraseDepot(r.error.message)); return r.data; },
      async annulerDepotVideo(depot) { const r = await sb.rpc("annuler_depot_video", { p_depot: depot }); if (r.error) throw new Error(phraseDepot(r.error.message)); },
      // contenu_legende, contenu_statut : légende reprise par « Déposer un montage fait à la main » (lecture des contenus par l'administrateur, contenus_lecture).
      async adminDepotsVideo() { const cs = ok(await sb.from("commerces").select("id,nom")), ds = ok(await sb.from("depots_video").select("*").order("cree_le", { ascending: false }).limit(200));
        const ids = [...new Set(ds.map(d => d.contenu_id).filter(Boolean))], cts = ids.length ? ok(await sb.from("contenus").select("id,legende,statut").in("id", ids)) : [];
        return ds.map(d => { const ct = cts.find(x => x.id === d.contenu_id); return { ...d, commerce: (cs.find(c => c.id === d.commerce_id) || {}).nom, contenu_legende: ct ? ct.legende || null : null, contenu_statut: ct ? ct.statut : null }; }); },
      async adminRelancerMontage(id) { const r = await sb.rpc("admin_relancer_montage", { p_depot: id }); if (r.error) throw new Error(phraseDepot(r.error.message)); return r.data; },
      // ---- Montage à la main (31/10/2026) : admin_plans_depot (liste des rushes encore présents), liens signés de 10 minutes (règle
      // photos_seau_admin_lecture), envoi TUS du MP4 dans « contenus » (règle contenus_seau_montage_main), puis admin_deposer_montage_main.
      async adminPlansDepot(id) {
        const r = await sb.rpc("admin_plans_depot", { p_depot: id }); if (r.error) throw new Error(phraseMontageMain(r.error.message));
        const l = r.data || [], d = { commerce: ((await sb.from("depots_video").select("commerce_id").eq("id", id).single()).data || {}).commerce_id };
        const cs = d.commerce ? ok(await sb.from("commerces").select("nom").eq("id", d.commerce)) : [], nomC = (cs[0] || {}).nom;
        return Promise.all(l.map(async (x, i) => { const fichier = MONTAGE_MAIN.nomPlan({ commerce: nomC }, x, i);
          const s = await sb.storage.from("photos").createSignedUrl(x.chemin, MONTAGE_MAIN.LIEN_S, { download: fichier });
          return { ...x, fichier, url: s.data ? s.data.signedUrl : null }; }));
      },
      async adminEnvoyerMontageMain(depot, f, o = {}) {
        const P = MONTAGE_MAIN.PHRASES, d = ok(await sb.from("depots_video").select("id,commerce_id,statut").eq("id", depot)).find(Boolean); if (!d) throw new Error(P.introuvable);
        if (!MONTAGE_MAIN.possible(d)) throw new Error(P.statut);
        const k = await MONTAGE_MAIN.controler(f); if (k.raison) throw new Error(P[k.raison]);
        const chemin = MONTAGE_MAIN.chemin(d.commerce_id, d.id);
        const jeton = async () => { const { data } = await sb.auth.getSession(); return data && data.session ? data.session.access_token : null; };
        await window.RENOM_ENVOI.envoyer({ fichier: f, seau: "contenus", objet: chemin, url: cfg.supabaseUrl, cle: cfg.publishableKey, jeton, onProgress: o.onProgress, onEtat: o.onEtat, signal: o.signal });
        return { chemin, infos: k.infos };
      },
      async adminDeposerMontageMain(depot, chemin, legende, infos = {}) {
        const r = await sb.rpc("admin_deposer_montage_main", { p_depot: depot, p_chemin: chemin, p_legende: String(legende || "").trim() || null, p_infos: infos || {} });
        if (r.error) throw new Error(phraseMontageMain(r.error.message)); return r.data;
      },
      async demandesVideoAvis() { const c = await self.commerce(); return ok(await sb.from("videos_avis_demandes").select("id,avis_ids,fond,style,statut,motif,contenu_id,cree_le").eq("commerce_id", c.id).order("cree_le", { ascending: false }).limit(20)); },
      async demanderVideoAvis({ avis_ids, fond, style }) { vaControle(avis_ids, fond, style); const c = await self.commerce(); ok(await sb.from("videos_avis_demandes").insert({ commerce_id: c.id, avis_ids, fond, style })); },
      // ---- Mise à jour de l'espace membre : uniquement les tables et fonctions du contrat (ordres/CONTRAT-MAJ-MEMBRE.md)
      // Résultats : Google interdit de conserver note, nombre d'avis, noms et historique (ordres/BRANCHEMENT.md, « Conformité des résultats »).
      // L'écran Résultats (n >= 2) demande donc une lecture à la demande au workflow n8n renom-resultats-google (config.js, lectureGoogleUrl),
      // avec la session du commerçant ; la base plafonne ces lectures. Rien n'est gardé dans le navigateur. Sans adresse ou en échec : les chiffres
      // de la base seuls, et la raison dans « lecture_google ». Les autres écrans (Collecte : n = 1) ne déclenchent aucune lecture de Google.
      // Lot 2 : mon_taux_reponse() (bloc « Taux de réponse depuis le début du service ») ; null tant que le bloc n'est pas appliqué (l'écran garde
      // alors resultats().reponses).
      async tauxReponse() { try { return ok(await sb.rpc("mon_taux_reponse", {})); } catch (e) { return null; } },
      async resultats(n) {
        n = Math.max(1, Math.min(12, +n || 6));
        if (n >= 2 && cfg.lectureGoogleUrl) {
          try {
            const { data } = await sb.auth.getSession(), jeton = data && data.session && data.session.access_token;
            if (jeton) {
              const r = await fetch(cfg.lectureGoogleUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + jeton }, body: JSON.stringify({ p_mois: n }) });
              const R = r.ok ? await r.json() : null;
              if (R && Array.isArray(R.mois)) return R;
            }
          } catch (e) {}
        }
        const R = ok(await sb.rpc("resultats", { p_mois: n }));
        R.lecture_google = { le: new Date().toISOString(), statut: n < 2 ? "non_demandee" : cfg.lectureGoogleUrl ? "indisponible" : "non_branchee" };
        return R;
      },
      async bilanMois(mois) { return ok(await sb.rpc("bilan_mois", mois ? { p_mois: mois } : {})); },
      async modifierLegende(id, reseau, texte) { ok(await sb.rpc("modifier_legende", { p_contenu: id, p_reseau: reseau, p_texte: controlerLegende(reseau, texte) })); },
      async programmerAuto(id, reseaux, lot) { return lot ? ok(await sb.rpc("programmer_auto_lot", { p_contenu: id, p_reseaux: reseaux, p_rang: lot.rang, p_nombre: lot.nombre }))
        : ok(await sb.rpc("programmer_auto", { p_contenu: id, p_reseaux: reseaux })); },
      async actionsFiche() { const c = await self.commerce(); return ok(await sb.from("actions_fiche").select("id,type,donnees,statut,cree_le,publie_le").eq("commerce_id", c.id).order("cree_le", { ascending: false }).limit(50)); },
      async creerActionFiche(type, donnees) { return ok(await sb.rpc("creer_action_fiche", { p_type: type, p_donnees: controlerAction(type, donnees) })); },
      async validerActionFiche(id, decision) { ok(await sb.rpc("valider_action_fiche", { p_id: id, p_decision: decision })); },
      async enregistrerDemarrage(rep) { ok(await sb.rpc("enregistrer_demarrage", { p_reponses: controlerDemarrage(rep) })); cache = null; },
      compterCollecte: (jeton, type, canal) => publicSupabase.compterCollecte(jeton, type, canal),
      // ---- Automatisations de service : uniquement les tables et fonctions du bloc « Automatisations de service » de schema.sql
      async importerClients(lignes, consentement) { return ok(await sb.rpc("importer_clients", { p_lignes: lignes, p_consentement: consentement === true })); },
      async demandesAvis() { return ok(await sb.rpc("mes_demandes_avis", {})); },
      async ajouterOpposition(email) { ok(await sb.rpc("ajouter_opposition", { p_email: String(email || "") })); },
      async miseEnRoute() { return ok(await sb.rpc("ma_mise_en_route", {})); },
      // ---- Mise en route claire (27/10/2026, bloc SQL « Mise en route claire et travail visible » ; les écrans ne les appellent que si la colonne
      // commerces.nom_confirme_le existe, c'est-à-dire quand le bloc est appliqué)
      async confirmerNom(nom) { const r = ok(await sb.rpc("confirmer_nom_commerce", { p_nom: MER.nom(nom) })); cache = null; return r; },
      async reglerLanguesPublication(l) { const c = await self.commerce(), r = await sb.rpc("regler_langues_publication", { p_commerce: c.id, p_langues: l }); if (r.error) throw new Error(r.error.message); cache = null; return r.data; },
      async adminReglerLanguesPublication(cid, l) { return ok(await sb.rpc("regler_langues_publication", { p_commerce: cid, p_langues: l })); },
      async demanderRappel(sujet, telephone, offre) { const c = await self.commerce().catch(() => ({}));
        if (sujet === "changement_offre") return ok(await sb.rpc("demander_rappel", { p_sujet: sujet, p_telephone: telephone || null, p_offre: offre }));   // 01/11/2026 : numéro facultatif
        return ok(await sb.rpc("demander_rappel", { p_sujet: sujet || "mise_en_route", p_telephone: MER.telephone(telephone, c.pays) })); },
      // Demande de rappel déjà enregistrée sur ce sujet (ma_demande_rappel, bloc « Créneaux réels ») : sa date, ou "" ; base sans la fonction : null.
      async demandeRappel(sujet) { const r = await sb.rpc("ma_demande_rappel", { p_sujet: sujet }); return r.error ? null : r.data || ""; },
      async preciserRappel(sujet, jour) { return ok(await sb.rpc("preciser_rappel", { p_sujet: sujet, p_jour: jour })); },
      async demanderFicheGoogle(cas) { const r = ok(await sb.rpc("demander_creation_fiche", { p_cas: cas })); cache = null; return r; },
      async refuserAutorisationPhotos() { const r = ok(await sb.rpc("refuser_autorisation_photos", {})); cache = null; return r; },
      async deciderAvisSensible(id, decision) { return ok(await sb.rpc("decider_avis_sensible", { p_avis: id, p_decision: decision })); },
      async donnerVersionAvis(id, texte) { return ok(await sb.rpc("donner_version_avis", { p_avis: id, p_texte: texte })); },
      async retenirReponseAvis(id) { return ok(await sb.rpc("retenir_reponse_avis", { p_avis: id })); },
      async repondreAvisCommercant(id, choix) { return ok(await sb.rpc("repondre_avis_commercant", { p_avis: id, p_choix: choix })); },
      // Votre contact : sans le bloc SQL (fonction absente), null (l'espace affiche l'équipe et le numéro officiel).
      async monContact() { const r = await sb.rpc("mon_contact"); return r.error ? null : r.data; },
      async adminContact(cid) { return ok(await sb.rpc("admin_contact", { p_commerce: cid || null })); },
      async adminReglerContact(cid, p) { return ok(await sb.rpc("admin_regler_contact", { p_commerce: cid || null, p: p || {} })); },
      async adminEquipeWhatsapp() { return ok(await sb.rpc("admin_equipe_whatsapp")) || []; },
      async adminReglerEquipeWhatsapp(liste) { return ok(await sb.rpc("admin_regler_equipe_whatsapp", { p: Array.isArray(liste) ? liste : [] })) || []; },
      async adminLienAvis(cid, lien) { return ok(await sb.rpc("admin_lien_avis", { p_commerce: cid, p_lien: lien })); },
      async adminConfirmerNom(cid, nom) { return ok(await sb.rpc("admin_confirmer_nom", { p_commerce: cid, p_nom: MER.nom(nom) })); },
      // Fiche Google (28/10/2026, bloc SQL « Fiche Google du client venu du site et photos hors sujet »)
      async adminFicheGoogleLieu(cid, valeur) { return ok(await sb.rpc("admin_fiche_google_lieu", { p_commerce: cid, p_valeur: String(valeur == null ? "" : valeur).trim() })); },
      async enregistrerFicheGoogle(texte) {
        if (!String(texte == null ? "" : texte).trim()) throw new Error(FG.TEXTES.vide); const u = FG.lien(texte); if (!u) throw new Error(FG.TEXTES.format);
        const r = ok(await sb.rpc("enregistrer_fiche_google", { p_lien: u })); cache = null; return r; },
      async adminFicheGoogleVerifiee(cid, le) { return ok(await sb.rpc("admin_fiche_google_verifiee", { p_commerce: cid, p_le: le })); },
      async declarerMiseEnRoute(point) { return ok(await sb.rpc("declarer_mise_en_route", { p_point: point })); },
      async deciderIdee(id, decision) { ok(await sb.rpc("decider_idee", { p_id: id, p_decision: decision })); },
      desinscriptionInfo: jeton => publicSupabase.desinscriptionInfo(jeton),
      seDesinscrire: jeton => publicSupabase.seDesinscrire(jeton),
      async adminSante() { return ok(await sb.rpc("admin_sante_clients", {})); },
      async adminProspects() { return ok(await sb.from("prospects").select("*").order("audit_le", { ascending: false }).limit(200)); },
      async adminProspect(id, action) { ok(await sb.rpc("admin_prospect", { p_id: id, p_action: action })); },
      async adminResultatProspect(id, resultat, note) { return ok(await sb.rpc("admin_resultat_prospect", { p_id: id, p_resultat: resultat, p_note: note == null ? null : String(note) })); },
      prospectParJeton: jeton => publicSupabase.prospectParJeton(jeton),
      resultatParJeton: (jeton, resultat, note) => publicSupabase.resultatParJeton(jeton, resultat, note),
      async adminMiseEnRoute(cid, point, etat) { return ok(await sb.rpc("admin_mise_en_route", { p_commerce: cid, p_point: point, p_etat: etat })); },
      async adminLienReseaux(cid, envoye = true) { return ok(await sb.rpc("admin_lien_reseaux", { p_commerce: cid, p_envoye: !!envoye })); },
      objetParJeton: jeton => publicSupabase.objetParJeton(jeton),
      validerParJeton: (jeton, decision, texte) => publicSupabase.validerParJeton(jeton, decision, texte),
      async adminMetricoolMarque(cid, blog) { return ok(await sb.rpc("admin_metricool_marque", { p_commerce: cid, p_blog_id: String(blog == null ? "" : blog).trim() || null })); },
      async adminCommerces() {
        const cs = ok(await sb.from("commerces").select("*")), ks = ok(await sb.from("compteur").select("*")), cc = ok(await sb.from("comptes_connectes").select("*")), av = ok(await sb.from("avis").select("commerce_id,statut,sensible"));
        const sa = ok(await sb.rpc("admin_sante_clients", {})) || [], ds = ok(await sb.from("demandes_style").select("commerce_id").is("traitee_le", null));
        return cs.map(c => ({ ...c, compteur: ks.find(k => k.commerce_id === c.id), comptes: Object.fromEntries(cc.filter(x => x.commerce_id === c.id).map(x => [x.reseau, x])), alertes: av.filter(a => a.commerce_id === c.id && a.sensible && a.statut === "humain").length,
          sante: sa.find(s => s.commerce_id === c.id) || null, demandes_style: ds.filter(d => d.commerce_id === c.id).length }));
      },
      async adminJournal() { const cs = ok(await sb.from("commerces").select("id,nom")), j = ok(await sb.from("journal").select("*").order("cree_le", { ascending: false }).limit(300)); return j.map(x => ({ ...x, commerce: (cs.find(c => c.id === x.commerce_id) || {}).nom })); },
      // Journal d'UN client (v46, fiche client) : requête à part, la lecture de tous les clients s'arrête à 300 lignes (un client actif en sortait vite).
      async adminJournalClient(cid) { const c = ok(await sb.from("commerces").select("id,nom").eq("id", cid)), j = ok(await sb.from("journal").select("*").eq("commerce_id", cid).order("cree_le", { ascending: false }).limit(500)); const nom = ((c || [])[0] || {}).nom; return j.map(x => ({ ...x, commerce: nom })); },
      // 26/10/2026 (console, garantie des 24 h) : chaque alerte porte son code, son commerce, l'avis (« Ouvrir l'avis ») ou l'identifiant de l'alerte
      // de l'exploitant (« Traité » : admin_alerte_vue, fonction du bloc « Automatisations de service ») ; une alerte traitée (vue_le) n'est plus lue.
      async adminAlertes() {
        const cs = ok(await sb.from("commerces").select("id,nom")), n = id => (cs.find(c => c.id === id) || {}).nom;
        const av = ok(await sb.from("avis").select("*").eq("sensible", true).eq("statut", "humain")), j = ok(await sb.from("journal").select("*").in("type", ["REFUS", "LEGENDE_REFUSEE", "PHOTO_HORS_SUJET", "LOGO_RECU_DANS_PHOTOS", "PHOTO_CONTROLE_PANNE", "ECHEC_PUBLICATION", "SCHEMA_INCOMPLET"]).order("cree_le", { ascending: false }).limit(50)), p = ok(await sb.from("publications").select("*").eq("statut", "echec"));
        const ae = ok(await sb.from("alertes_exploitant").select("*").is("vue_le", null).order("cree_le", { ascending: false }).limit(50));
        // Recherche de fiche bloquée (28/10/2026) : colonne absente tant que le bloc SQL n'est pas appliqué -> rien (jamais d'erreur à l'écran).
        const fb = await sb.from("commerces").select("id,fiche_google_lien,fiche_google_a_resoudre_le").lt("fiche_google_a_resoudre_le", new Date(Date.now() - FG.ATTENTE_HEURES * 3600000).toISOString())
          .then(r => r.error ? [] : r.data || [], () => []);
        const cm = ok(await sb.from("commentaires").select("id,commerce_id,raisons,texte,cree_le").eq("categorie", "sensible").eq("statut", "humain"));
        return [...av.map(a => ({ type: "Avis sensible", code: "AVIS_SENSIBLE", avis_id: a.id, commerce_id: a.commerce_id, commerce: n(a.commerce_id), texte: (a.raisons || []).join(", ") + " : " + (a.texte || "").slice(0, 100), date: a.cree_le })),
          ...j.map(x => ({ type: x.type, code: x.type, journal: true, detail: x.detail, commerce_id: x.commerce_id, commerce: n(x.commerce_id), texte: JSON.stringify(x.detail), date: x.cree_le })),
          ...p.map(x => ({ type: "Publication en échec", code: "PUBLICATION_ECHEC", publication_id: x.id, commerce_id: x.commerce_id, commerce: n(x.commerce_id), texte: x.erreur || "", date: x.prevu_le })),
          ...ae.map(a => ({ type: titreAlerte(a, n(a.commerce_id)), code: a.type, id: a.id, commerce_id: a.commerce_id || null, commerce: n(a.commerce_id) || "", texte: texteAlerte(a), date: a.cree_le, detail_alerte: a.detail || {} })),
          ...rechercheBloquee(fb).map(x => ({ ...x, commerce: n(x.commerce_id) || "", type: titreAlerte(x, n(x.commerce_id)), texte: texteAlerte(x) })),
          ...cm.map(x => ({ type: "Commentaire sensible", code: "COMMENTAIRE_SENSIBLE", commentaire_id: x.id, commerce_id: x.commerce_id, commerce: n(x.commerce_id), texte: (x.raisons || []).join(", ") + " : " + (x.texte || "texte effacé après 30 jours").slice(0, 100), date: x.cree_le }))];
      },
      async adminAlerteVue(id, note) { ok(await sb.rpc("admin_alerte_vue", note ? { p_id: id, p_note: note } : { p_id: id })); },
      // Console v49 (13/11/2026, bloc « Console : réponses du démarrage remplies par l'équipe et fiche Google ignorée ») : contrôle d'abord ici (mêmes
      // phrases que la base), puis la fonction (est_admin, journal).
      async adminReponsesDemarrage(cid, rep) { fusionnerDemarrage({}, rep); return ok(await sb.rpc("admin_reponses_demarrage", { p_commerce: cid, p_reponses: rep })); },
      async adminIgnorerFicheGoogle(id) { return ok(await sb.rpc("admin_ignorer_fiche_google", { p_id: id })); },
      // Photos d'un client (v52, 13/11/2026, blocs « Photos » et « Contenus » de la fiche client) : plus récentes d'abord, 200 au plus (compteurs du
      // dossier de démarrage). « * » : controle_force n'existe qu'avec le bloc SQL « Console : photos et contenus d'un client » (sans lui : faux).
      // Les PHOTOS_VUES plus récentes reçoivent une adresse signée d'une heure, créée à l'affichage (seau « photos », règle photos_seau_admin_lecture),
      // en 200 px si la transformation d'image est disponible (RENOM_CONFIG.vignettes200), sinon le fichier d'origine (chargé à la demande par la
      // console, loading="lazy"). controle : dernière ligne PHOTO_HORS_SUJET du journal rattachée par detail.photo (motif, catégorie, phrase exacte).
      async adminPhotosClient(cid) {
        const l = (ok(await sb.from("photos").select("*").eq("commerce_id", cid).order("cree_le", { ascending: false }).limit(200)) || []).map(photoConsole);
        const j = await sb.from("journal").select("type,detail,cree_le").eq("commerce_id", cid).in("type", TYPES_PHOTO_JOURNAL).order("cree_le", { ascending: false }).limit(300).then(r => r.error ? [] : r.data || [], () => []);
        await Promise.all(l.slice(0, PHOTOS_VUES).map(async p => { p.controle = controleDe(j, p.id);
          try { const r = await sb.storage.from("photos").createSignedUrl(p.chemin, 3600, cfg.vignettes200 === true ? { transform: { width: 400, height: 400, resize: "cover", quality: 70 } } : undefined); p.url = (r.data && r.data.signedUrl) || null; } catch (e) { p.url = null; } }));
        return l;
      },
      // Contenus d'un client (v52) : les CONTENUS_VUS derniers, visuel du seau « contenus » (règle contenus_seau_lecture, administrateur compris) par
      // adresse signée d'une heure : même fichier que la publication (cheminVisuel : story -> visuel-story.jpg, publication -> visuel-4x5.jpg, vidéo ->
      // son affiche visuel-4x5.jpg du dossier, jamais le MP4). prevu_le : programmation en cours ou passée (publications « programme », « envoye », « publie »).
      async adminContenusClient(cid) {
        const l = ok(await sb.from("contenus").select("id,type,format,statut,legende,fichier,cree_le,photo_id,musique").eq("commerce_id", cid).order("cree_le", { ascending: false }).limit(CONTENUS_VUS)) || [];
        const pubs = l.length ? await sb.from("publications").select("contenu_id,prevu_le,statut").in("contenu_id", l.map(x => x.id)).in("statut", ["programme", "envoye", "publie"]).then(r => r.error ? [] : r.data || [], () => []) : [];
        // Musique tendance posée à la publication (16/11/2026, contenus.musique.plateforme, écrit par publication_envoyee) : seulement les morceaux, pas le reste du champ.
        l.forEach(x => { const m = x.musique; x.musique = m && typeof m === "object" && m.plateforme && typeof m.plateforme === "object" ? m.plateforme : null; });
        await Promise.all(l.map(async x => { const p = pubs.find(y => y.contenu_id === x.id); x.prevu_le = p ? p.prevu_le : null; x.url = null; const ch = cheminVisuel(x);
          if (ch) try { const r = await sb.storage.from("contenus").createSignedUrl(ch, 3600); x.url = (r.data && r.data.signedUrl) || null; } catch (e) {} }));
        return l;
      },
      // « C'est le logo » (v52) : photo refusée « doute » ou « hors_sujet ». Kit verrouillé ou réglé à la main : rien n'est copié, la base garde le kit
      // et note le geste. Sinon : fichier lu dans le seau « photos », copié en <commerce>/marque/logo-photo-<id>.<ext> (même nom que le moteur,
      // rendu_cloud.logo_recu ; règle photos_seau_admin_logo ; PNG, JPEG ou WebP gardés tels quels, autre format converti en PNG), couleurs proposées
      // depuis le logo (marque.js proposer, même calcul que moteur/marque.py), puis admin_logo_depuis_photo (kit NON verrouillé, motif « logo », journal).
      async adminLogoDepuisPhoto(pid) {
        const p = ok(await sb.from("photos").select("id,commerce_id,chemin,statut,refus_motif").eq("id", pid).single());
        if (p.statut === "refusee" && p.refus_motif === "logo") return { etat: "deja" };
        const c = ok(await sb.from("commerces").select("id,metier,ton,marque").eq("id", p.commerce_id).single()), m = c.marque;
        if (m && (m.verrouille || m.auto === false)) return ok(await sb.rpc("admin_logo_depuis_photo", { p_photo: pid, p_logo: null, p_kit: null }));
        const MQ = window.RENOM_MARQUE, cat = await MQ.charger(), blob = ok(await sb.storage.from("photos").download(p.chemin)), url = URL.createObjectURL(blob);
        try {
          const img = await MQ.chargerImage(url).catch(() => { throw new Error(PHRASE_LOGO_ILLISIBLE); });
          let type = ({ "image/png": "image/png", "image/jpeg": "image/jpeg", "image/jpg": "image/jpeg", "image/webp": "image/webp" })[blob.type] || ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" })[(p.chemin.split(".").pop() || "").toLowerCase()], corps = blob;
          if (!type) { corps = await MQ.enPng(blob, 1024); type = "image/png"; }
          const chemin = c.id + "/marque/logo-photo-" + (String(pid).replace(/[^A-Za-z0-9]/g, "").slice(0, 40) || "x") + "." + { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[type];
          const u = await sb.storage.from("photos").upload(chemin, corps, { contentType: type, upsert: false });
          if (u.error && !/exist|duplicate|409/i.test(String(u.error.message || "") + " " + String(u.error.statusCode || ""))) throw new Error(u.error.message);   // déjà copié (geste repris) : on continue
          const k = MQ.proposer({ logo: MQ.pixels(img), metier: c.metier, ton: c.ton || "", logoChemin: chemin, cat });
          return ok(await sb.rpc("admin_logo_depuis_photo", { p_photo: pid, p_logo: chemin, p_kit: k }));
        } finally { URL.revokeObjectURL(url); }
      },
      // « Accepter quand même » (v52) : admin_accepter_photo (photo « a_traiter », controle_force vrai ; webhook hook_photo_forcee -> n8n -> rendu sans contrôle).
      async adminAccepterPhoto(pid) { return ok(await sb.rpc("admin_accepter_photo", { p_photo: pid })); },
      // Relecture par l'équipe avant le client (14/11/2026, bloc SQL du même nom) : file « À relire » (admin_contenus_a_relire) et aperçus par adresse
      // signée d'une heure (seau « contenus », règle contenus_seau_lecture ouverte à l'administrateur) : le visuel (cheminVisuel, comme la fiche client)
      // et, pour une vidéo, le MP4 lui-même. Actions : admin_envoyer_au_client, admin_corriger_legende (contrôle d'abord ici, mêmes phrases que la
      // base), admin_refaire_contenu, admin_regler_relecture.
      async adminContenusARelire() {
        const l = ok(await sb.rpc("admin_contenus_a_relire", {})) || [];
        const signe = async ch => { if (!ch) return null; try { const r = await sb.storage.from("contenus").createSignedUrl(ch, 3600); return (r.data && r.data.signedUrl) || null; } catch (e) { return null; } };
        await Promise.all(l.map(async x => { [x.url, x.video_url] = await Promise.all([signe(cheminVisuel(x)), x.type === "video" && /\.mp4$/i.test(x.fichier || "") ? signe(x.fichier) : null]); }));
        return l;
      },
      async adminEnvoyerAuClient(id) { return ok(await sb.rpc("admin_envoyer_au_client", { p_contenu: id })); },
      async adminCorrigerLegende(id, legende, legendes, x) { const t = String(legende || "").trim(); if (x) controlerCorrection(x, t, legendes, x.langue || "fr");
        return ok(await sb.rpc("admin_corriger_legende", { p_contenu: id, p_legende: t, p_legendes: legendes && Object.keys(legendes).length ? legendes : null })); },
      async adminRefaireContenu(id) { return ok(await sb.rpc("admin_refaire_contenu", { p_contenu: id })); },
      async adminReglerRelecture(cid, active) { return ok(await sb.rpc("admin_regler_relecture", { p_commerce: cid, p_active: active !== false })); },
      // Typographie du réel par client (14/11/2026, bloc SQL du même nom) : polices, source, note, supports fournis, surtitre, site web (admin_regler_typo).
      async adminReglerTypo(cid, p) { return ok(await sb.rpc("admin_regler_typo", { p_commerce: cid, p: p || {} })); },
      // Prises en charge (« Je prends ») et nouveau client complet : bloc « Console : garantie des 24 h tenue à deux » de schema.sql. Tant que ce bloc
      // n'est pas collé, adminPrises rend null (la console masque « Je prends ») et adminCreerClient crée le commerce par admin_creer_commerce, sans
      // ville, langue ni fiche (rend { id, partiel: true } : la console le dit).
      async adminPrises() { const r = await sb.rpc("admin_prises", {}); return r.error ? null : (r.data || []); },
      async adminPrendre(cle, par, prendre = true) { return ok(await sb.rpc("admin_prendre", { p_cle: cle, p_par: par, p_prendre: !!prendre })); },
      async adminCreerClient(p) {
        const r = await sb.rpc("admin_creer_client", { p: p || {} });
        if (!r.error) return r.data;
        if (r.error.code === "PGRST202" || /could not find the function/i.test(r.error.message || "")) return { id: await self.adminCreer(p.nom, p.metier, p.offre, p.email), partiel: true };
        throw new Error(r.error.message);
      },
      async adminCreer(nom, metier, offre, email) { return ok(await sb.rpc("admin_creer_commerce", { p_nom: nom, p_metier: metier, p_offre: offre, p_email: email })); },
      async adminOffre(id, offre) { ok(await sb.rpc("admin_changer_offre", { p_commerce: id, p_offre: offre })); },
      // ---- Garanties (bloc « Modèle Vincent » de schema.sql) : file des avis de BoostImpact, publication notée, garantie des 10 avis
      async maGarantieDelais() { const c = await self.commerce(); return ok(await sb.rpc("ma_garantie_delais", { p_commerce: c.id })); },
      async adminFileAvis() { return ok(await sb.rpc("admin_file_avis", {})) || []; },
      // Mode de secours des avis (20/10/2026) : file « À publier sur Google » et « Marquer comme publiée » (bloc « Mode de secours des avis » de schema.sql).
      async adminAvisAPublier() { return ok(await sb.rpc("admin_avis_a_publier", {})) || []; },
      async adminAvisMarquerPubliee(id) { return ok(await sb.rpc("admin_avis_marquer_publie", { p_id: id })); },
      // Publication à la main, sans Metricool (22/10/2026) : file et « Marquer comme publiée » (schema.sql) ; lien de téléchargement signé au clic, valable
      // une heure, dans le seau « contenus » (règle contenus_seau_lecture de storage.sql, ouverte à l'administrateur), nom de fichier lisible.
      async adminPublicationsAPublier() { return ok(await sb.rpc("admin_publications_a_publier", {})) || []; },
      // Options commandées (22/10/2026, bloc « Options commandées » de schema.sql) : lecture du commerçant (colonnes permises seulement) et console.
      async mesCommandesOptions() { const c = await self.commerce(); return ok(await sb.from("commandes_options").select("id,option_id,statut,paye_le,elements_recus_le,livraison_prevue_le,livree_le,second_test_prevu_le,second_test_fait_le").eq("commerce_id", c.id).order("paye_le")) || []; },
      async adminCommandesOptions() { return ok(await sb.rpc("admin_commandes_options", {})) || []; },
      async adminCommandeOptionElements(id, le) { return ok(await sb.rpc("admin_commande_option_elements", { p_id: id, p_le: le || null })); },
      async adminCommandeOptionLivree(id) { return ok(await sb.rpc("admin_commande_option_livree", { p_id: id })); },
      async adminCommandeOptionSecondTest(id) { return ok(await sb.rpc("admin_commande_option_second_test", { p_id: id })); },
      async adminCommandeOptionRattacher(id, cid) { return ok(await sb.rpc("admin_commande_option_rattacher", { p_id: id, p_commerce: cid })); },
      // Visibilité IA (15/11/2026, bloc « Visibilité IA : dossier de livraison » de schema.sql) : console (est_admin) et carte du commerçant.
      async adminDossiersGeo() { return ok(await sb.rpc("admin_dossiers_geo", {})) || []; },
      async adminDossierGeo(cid) { return ok(await sb.rpc("admin_dossier_geo", { p_commerce: cid })) || null; },
      async adminGeoOuvrir(cid) { return ok(await sb.rpc("admin_geo_ouvrir", { p_commerce: cid })); },
      async adminGeoEtape(id, etape, fait, note) { return ok(await sb.rpc("admin_geo_etape", { p_dossier: id, p_etape: etape, p_fait: !!fait, p_note: note == null ? null : String(note) })); },
      async adminGeoQuestions(id, questions, valider) { return ok(await sb.rpc("admin_geo_questions", { p_dossier: id, p_questions: questions, p_valider: !!valider })); },
      async adminGeoReference(id, ref) { return ok(await sb.rpc("admin_geo_reference", { p_dossier: id, p_reference: ref })); },
      async adminGeoBing(id, etat, note) { return ok(await sb.rpc("admin_geo_bing", { p_dossier: id, p_etat: etat, p_note: note == null ? null : String(note) })); },
      async adminGeoPlateforme(id, cle, etat, note) { return ok(await sb.rpc("admin_geo_plateforme", { p_dossier: id, p_cle: cle, p_etat: etat, p_note: note == null ? null : String(note) })); },
      async adminGeoDemander(id, type) { return ok(await sb.rpc("admin_geo_demander", { p_dossier: id, p_type: type })); },
      async adminGeoRapport(mid) { return ok(await sb.rpc("admin_geo_rapport", { p_mesure: mid })) || null; },
      async maVisibiliteIa() { return ok(await sb.rpc("ma_visibilite_ia", {})) || null; },
      async adminAccesReseau(cid, reseau, acces) { return ok(await sb.rpc("admin_acces_reseau", { p_commerce: cid, p_reseau: reseau, p_acces: !!acces })); },
      async adminPublicationPubliee(id, reseau) { return ok(await sb.rpc("admin_publication_publiee", { p_id: id, p_reseau: reseau })); },
      async adminLienMedia(x) {
        if (!x.chemin) return null; const ext = (x.chemin.match(/\.([a-z0-9]{2,4})$/i) || [, "jpg"])[1].toLowerCase();
        const nom = [String(x.commerce || "commerce").normalize("NFD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40), x.reseau, String(x.prevu_le || "").slice(0, 10),
          x.rang ? String(x.rang) : ""].filter(Boolean).join("-") + "." + ext;   // rang : image d'un carrousel TikTok (1, 2, 3… dans l'ordre de l'envoi)
        const r = ok(await sb.storage.from("contenus").createSignedUrl(x.chemin, 3600, { download: nom })); return r.signedUrl;
      },
      async adminLibererAvis(id) { return ok(await sb.rpc("admin_liberer_avis", { p_avis: id })); },
      async adminRetenirAvis(id) { return ok(await sb.rpc("admin_retenir_avis", { p_avis: id })); },
      async adminAvisPublie(id, reponse, accord) { ok(await sb.rpc("admin_avis_publie", { p_id: id, p_reponse: reponse, p_accord_client: !!accord })); },
      async adminAvisProposer(id, reponse) { return ok(await sb.rpc("admin_avis_proposer", { p_id: id, p_reponse: reponse })); },
      async adminGarantieDelais() { return ok(await sb.rpc("admin_garantie_delais", {})) || []; },
      async adminDelais(cid, p) { return ok(await sb.rpc("admin_delais", { p_commerce: cid, p: p || {} })); },
      async adminManquement(id, statut, motif, reference) { return ok(await sb.rpc("admin_manquement", Object.assign({ p_id: id, p_statut: statut, p_motif: motif || null }, reference ? { p_reference: reference } : {}))); },
      async adminReseaux(cid, reseaux) { return ok(await sb.rpc("admin_reseaux", { p_commerce: cid, p_reseaux: reseaux })); },
      async adminPays(cid, pays) { return ok(await sb.rpc("admin_pays", { p_commerce: cid, p_pays: pays })); },
      async adminMetier(cid, metier) { return ok(await sb.rpc("admin_metier", { p_commerce: cid, p_metier: metier })); },
      // WhatsApp saisi par l'équipe (12/11/2026) : contrôle d'abord ici (mêmes phrases que la base), puis admin_regler_whatsapp (est_admin, journal).
      async adminReglerWhatsapp(cid, numero, accord) {
        const brut = String(numero == null ? "" : numero).trim();
        if (brut || accord) { if (!accord) throw new Error(PHRASE_WA_ACCORD_EQUIPE);
          const c = ok(await sb.from("commerces").select("pays").eq("id", cid).single()), n = numeroWhatsapp(brut, paysDe(c.pays));
          if (!n) throw new Error(phraseWhatsapp(paysDe(c.pays))); if (numeroFixe(n)) throw new Error(PHRASE_FIXE); }
        return ok(await sb.rpc("admin_regler_whatsapp", { p_commerce: cid, p_numero: brut || null, p_accord: !!accord })); },
      // Dernier passage des robots (table passages_robots, lisible par l'administrateur) ; table absente (bloc SQL du 12/11 pas collé) : null.
      async adminPassagesRobots() { const r = await sb.from("passages_robots").select("robot,passe_le,bilan").then(x => x, () => ({ error: true }));
        return r.error ? null : Object.fromEntries((r.data || []).map(x => [x.robot, x])); },
      async adminAlertesClient(cid) {
        const r = await sb.from("alertes_exploitant").select("id,type,commerce_id,detail,cree_le").is("vue_le", null).or(`commerce_id.eq.${cid},and(type.eq.FICHE_A_RELIER,commerce_id.is.null)`).order("cree_le", { ascending: false }).limit(50);
        return (ok(r) || []).map(a => ({ id: a.id, type: a.type, commerce_id: a.commerce_id || null, detail: a.detail || {}, texte: texteAlerte(a), date: a.cree_le })); },
      async adminDelegation(cid, signee) { return ok(await sb.rpc("admin_delegation", { p_commerce: cid, p_signee: !!signee })); },
      async adminCommentairesEquipe() { return ok(await sb.rpc("admin_commentaires_equipe", {})) || []; },
      async adminCommentaireDecider(id, decision, texte) { return ok(await sb.rpc("admin_commentaire_decider", { p_id: id, p_decision: decision, p_texte: texte || null })); },
      async adminGaranties() { return ok(await sb.rpc("admin_garanties", {})) || []; },
      async adminGarantie(cid, p) { return ok(await sb.rpc("admin_garantie", { p_commerce: cid, p: p || {} })); },
      async adminPause(id, pause) { ok(await sb.rpc("admin_mettre_en_pause", { p_commerce: id, p_pause: !!pause })); },
      async adminInvitations() { const cs = ok(await sb.from("commerces").select("id,nom")); return ok(await sb.from("invitations").select("*").order("cree_le", { ascending: false })).map(i => ({ ...i, commerce: (cs.find(c => c.id === i.commerce_id) || {}).nom })); },
      // Cockpit (29/10/2026) : lectures SEULES, sur les tables déjà ouvertes à l'administrateur (règles abonnements_lecture, invitations_lecture,
      // envois_service_admin, alertes_whatsapp_admin, avis_lecture, journal_lecture, alertes_exploitant_admin de schema.sql). Aucune fonction SQL
      // nouvelle. Une table illisible (bloc SQL pas encore collé, panne) ne casse pas l'écran : son nom part dans « illisible » et le cockpit le dit.
      async adminCockpit(depuis) {
        const illisible = [], d7 = new Date(Date.now() - 7 * 864e5).toISOString(), d30 = new Date(Date.now() - 30 * 864e5).toISOString();
        const lire = (nom, q) => q.then(r => { if (r.error) { illisible.push(nom); return null; } return r.data || []; }, () => { illisible.push(nom); return null; });
        // Avis : plus récents d'abord ; Supabase plafonne une réponse (max_rows, 1000 par défaut) : une liste pleine est signalée « lue en partie ».
        const AVIS_MAX = 1000, avis = sb.from("avis").select("id,commerce_id,cree_le,traite_le,repondu_le").order("cree_le", { ascending: false }).limit(AVIS_MAX);
        const [abonnements, invitations, envois, whatsapp, av, creations, testsJ, testsA, avisMois, videoIa, photosCk, videoIaMois, retenuesCk, equipeWa] = await Promise.all([
          lire("abonnements", sb.from("abonnements").select("commerce_id,offre,statut,rythme,remise_lancement_fin,stripe_subscription,remplace_par,cree_le,maj_le")),
          lire("invitations", sb.from("invitations").select("id,commerce_id,statut,erreur,cree_le")),
          lire("envois_service", sb.from("envois_service").select("id,commerce_id,categorie,statut,erreur,cree_le").eq("statut", "echec").gte("cree_le", d7)),
          lire("alertes_whatsapp", sb.from("alertes_whatsapp").select("id,commerce_id,type,statut,erreur,cree_le").in("statut", ["echec", "abandonne"]).gte("cree_le", d7)),
          lire("avis", depuis ? avis.or(`traite_le.gte.${new Date(depuis).toISOString()},repondu_le.gte.${new Date(depuis).toISOString()}`) : avis.or("traite_le.not.is.null,repondu_le.not.is.null")),
          lire("journal", sb.from("journal").select("commerce_id,type,detail,cree_le").eq("type", "COMMERCE_CREE").limit(5000)),
          // Mode test de Stripe : chaque événement reçu avec livemode faux porte « test » : true (appliquer_evenement_stripe, client_en_ligne).
          lire("journal", sb.from("journal").select("commerce_id,type,detail,cree_le").eq("detail->>test", "true").gte("cree_le", d7).limit(20)),
          // Alerte de test déjà notée « Traité » (vue_le) : plus comptée.
          lire("alertes_exploitant", sb.from("alertes_exploitant").select("commerce_id,type,detail,cree_le").eq("detail->>test", "true").is("vue_le", null).gte("cree_le", d30).limit(20)),
          // Avis reçus dans le mois de Paris au-delà de l'usage raisonnable (CGV art. 9) : compte fait par la base (admin_avis_du_mois, bloc du
          // 02/11/2026), donc jamais limité par le plafond de lignes de Supabase. Fonction absente (bloc pas encore collé) : « admin_avis_du_mois » illisible.
          lire("admin_avis_du_mois", sb.rpc("admin_avis_du_mois", { p_seuil: 100 })),
          // Vidéo IA (11/11/2026) : la dernière ligne PRODUIT du journal qui porte « video_ia » (moteur/rendu_cloud.py : faite, plan_b avec son motif,
          // ou desactivee). Seul état lisible depuis le navigateur : la clé Higgsfield est un secret GitHub, le solde ne se lit pas d'ici. Lecture
          // à part : un échec donne « inconnu » sur ce seul contrôle, jamais une alerte « données illisibles ».
          sb.from("journal").select("commerce_id,detail,cree_le").eq("type", "PRODUIT").not("detail->video_ia", "is", null).order("cree_le", { ascending: false }).limit(1).then(r => r.error ? null : r.data || [], () => null),
          // Photos (v51, 13/11/2026) : statut et motif de refus seulement, pour dire dans « Délais pas encore démarrés » qu'un fichier est arrivé mais a
          // été refusé, au lieu de « pas encore reçues ». Lecture à part : un échec donne null (phrase d'avant), jamais une alerte « données illisibles ».
          sb.from("photos").select("commerce_id,statut,refus_motif").order("cree_le", { ascending: false }).limit(5000).then(r => r.error ? null : r.data || [], () => null),
          // Compte API Higgsfield (14/11/2026) : vidéos IA et dépense du mois de Paris, dernière vérification du workflow GitHub (admin_video_ia_mois,
          // bloc SQL « Compte API Higgsfield visible »). Lecture à part : fonction absente ou panne = null, le cockpit dit « bloc SQL à coller ».
          sb.rpc("admin_video_ia_mois", {}).then(r => r.error ? null : r.data || null, () => null),
          // Lot 6 B : retenues des avis (« Appelez-moi avant de publier », table avis_retenues, lisible par l'administrateur) pour compter « en moins de
          // 24 h » avec l'échéance suspendue, comme le journal ; numéros WhatsApp de l'équipe. Lectures à part : un échec rend null (règle d'avant).
          sb.from("avis_retenues").select("avis_id,retenue_le,liberee_le").order("retenue_le", { ascending: false }).limit(5000).then(r => r.error ? null : r.data || [], () => null),
          sb.rpc("admin_equipe_whatsapp").then(r => r.error ? null : r.data || [], () => null),
        ]);
        const parAvis = {}; (retenuesCk || []).forEach(x => (parAvis[x.avis_id] || (parAvis[x.avis_id] = [])).push(x));
        (av || []).forEach(a => { a.retenues = parAvis[a.id] || []; });
        const vi = videoIa && videoIa[0];
        return { abonnements, invitations, envois, whatsapp, avis: av, creations, equipe_whatsapp: equipeWa, avis_mois: avisMois ? (avisMois.commerces || []) : null, photos: photosCk,
          video_ia: videoIa == null ? null : { derniere: vi ? { ...((vi.detail || {}).video_ia || {}), quand: vi.cree_le, commerce_id: vi.commerce_id || null } : null, mois: videoIaMois }, tests: testsJ || testsA ? [...(testsJ || []), ...(testsA || [])] : null, illisible: [...new Set(illisible)],
          tronques: av && av.length >= AVIS_MAX ? ["avis"] : [] };
      },
    };
    return self;
  }

  window.RENOM_DATA = cfg.supabaseUrl && cfg.publishableKey ? (window.supabase && window.supabase.createClient ? supabase() : indisponible()) : demo();
  // Prix de la montée d'offre (01/11/2026, tour 7 Essentiel : 79 et 190 affichés, différence 228 − 95 = 133 calculée au mois) : UNE base, le rythme
  // de la montée (rythmeMontee : celui de l'abonnement en cours ; inconnu ou sans abonnement : mensuel, tour 8), pour le prix, la différence, les
  // frais de mise en route et le lien de paiement. actuel, cible et ecart sont toujours sur cette même base ; autre = le prix de l'offre visée dans
  // l'autre rythme.
  const prixMontee = (o, s_, ab) => { const enCours = !!(ab && ab.statut !== "resilie"), rythme = rythmeMontee(ab);
    const cle = rythme === "mensuel" ? "prix_mensuel_ht" : "prix_ht", actuel = +(o || {})[cle] || 0, cible = +(s_ || {})[cle] || 0;
    return { rythme, enCours, actuel, cible, autre: +(s_ || {})[rythme === "mensuel" ? "prix_ht" : "prix_mensuel_ht"] || 0, ecart: actuel && cible ? cible - actuel : 0 }; };
  window.RENOM_PRIX_MONTEE = prixMontee; window.RENOM_RYTHME_MONTEE = rythmeMontee;
  window.RENOM_OPTIONS = OPTIONS; window.RENOM_OPTION_ACHETABLE = optionAchetable; window.RENOM_OPTION_INCLUSE = optionIncluse; window.RENOM_OPTION_PAYEE = optionPayee; window.RENOM_OFFRES = OFFRES; window.RENOM_OFFRES_EN_VENTE = OFFRES_EN_VENTE; window.RENOM_RESEAUX_AUTORISES = reseauxAutorises; window.RENOM_CONDITIONS = CONDITIONS; window.RENOM_RESEAUX = RESEAUX; window.RENOM_VIDEO_AVIS = VIDEO_AVIS; window.RENOM_COMMENTAIRES = COMMENTAIRES; window.RENOM_DEPOT_VIDEO = DEPOT_VIDEO; window.RENOM_MONTAGE_MAIN = MONTAGE_MAIN;
  // ---- Collecte : ce dont la page publique a besoin (aucune session, aucune bibliothèque), et la règle du lien d'avis pour l'espace
  window.RENOM_PUBLIC = cfg.supabaseUrl && cfg.publishableKey ? publicSupabase : window.RENOM_DATA;
  window.RENOM_LIEN_AVIS = lienAvisPublic; window.RENOM_RETOUR = RETOUR;
  // ---- Mise à jour de l'espace membre : règles partagées par les écrans et les pages publiques
  window.RENOM_MAJ = { contientTelephone, tauxReponseDe, jourLot, duJour, CRENEAUX, ESPACEMENT, momentLegende, texteDuContenu, creneauPour, LIMITE_GOOGLE, formatDe, reseauxPour, reseauxDuContenu, legendeDe, longueur, partiesParis, prochainCreneau, joursOuverts, feriesFr, feriesBe, estFerie, jourOuvre, joursRappel, joursRappelA, HEURE_RAPPEL_TARDIVE, ferieDe, paysDe, heuresOuvreesAjouter, heuresOuvreesEntre, jourEcheance, destinations, TYPES_ACTION, aujourdhui, photoPublication, cheminVisuel, MENTIONS_IA, estIA };
  // ---- Automatisations de service : règles partagées par les écrans
  window.RENOM_AUTO = { AUTO, lireCsvClients, MODELE_CSV, emailValide };
  // ---- Mode de secours des avis (20/10/2026) : délai avant l'alerte d'une réponse « à publier sur Google » (console)
  window.RENOM_ECHEANCE_AVIS = echeanceAvis; window.RENOM_ECHEANCE_APPEL = echeanceAppel; window.RENOM_RETENUE_SANS_MESSAGE_HEURES = RETENUE_SANS_MESSAGE_HEURES;
  window.RENOM_SECOURS = { ALERTE_HEURES: SECOURS_ALERTE_HEURES };
})();
