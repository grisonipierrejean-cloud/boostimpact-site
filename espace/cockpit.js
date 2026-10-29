// Cockpit de la console (29/10/2026, demande de PJ : « savoir en quelques secondes si chaque client est bien servi, dans les délais garantis, sans
// rien oublier »). Ce fichier ne lit rien et n'écrit rien : il CALCULE, à partir des lectures de la console (donnees.js), tout ce que l'écran
// affiche. Les mêmes règles tournent dans le navigateur (console.js) et dans le test sans navigateur (espace/test/cockpit.test.mjs).
//
// Règles de référence :
// - Garantie sur les délais : CGV article 10 (fiche optimisée sous 7 jours ; premier contenu sous 72 h en Croissance et Premium ; chaque avis traité
//   sous 24 h). Départ : accès à la fiche Google (Essentiel), accès ET premières photos, la plus tardive des deux dates (Croissance, Premium).
//   Contrepartie : le mois qui suit l'échéance manquée est offert, un seul mois offert par mois même si plusieurs délais sont manqués ; il
//   s'applique À LA MAIN dans Stripe (ordres/BRANCHEMENT.md). Échéances et états : fonction SQL admin_garantie_delais (delais_etat), lue telle quelle.
// - « À risque » : l'échéance tombe dans la fenêtre d'alerte de la base (conditions_offre : fiche 48 h avant, premier contenu 24 h avant, avis 4 h
//   avant), comme garantie_delais_controle et la file « À faire ».
// - MRR : abonnements Stripe ACTIFS (table abonnements) multipliés par la grille des offres (RENOM_OFFRES, égale à moteur/offres.json) : annuel =
//   prix mensuel de base, mensuel = +20 %, remise de lancement en cours = moitié prix. Hors taxes. Ce n'est PAS le montant encaissé par Stripe
//   (codes promo, prorata) : l'écran le dit.
// - Client de test : commerce créé par un paiement Stripe en mode test (journal COMMERCE_CREE, detail.test). Jamais compté comme client ni dans
//   le MRR ; signalé à supprimer.
(function (racine) {
  const H = 3600000, J = 86400000;
  const jourParis = t => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
  // Mois offert si l'échéance est manquée : 1er jour du mois qui suit l'échéance, heure de Paris (même règle que manquements_garantie.mois_offert).
  const moisOffert = t => { const [a, m] = jourParis(t).split("-").map(Number); return m === 12 ? (a + 1) + "-01-01" : a + "-" + String(m + 1).padStart(2, "0") + "-01"; };
  const ms = x => { const v = x == null ? NaN : Date.parse(x); return isNaN(v) ? null : v; };
  const PERIODES = { "7": 7, "30": 30, "90": 90, tout: null };
  const periodeValide = p => Object.prototype.hasOwnProperty.call(PERIODES, String(p)) ? String(p) : "7";
  const debutPeriode = (p, maintenant) => PERIODES[periodeValide(p)] == null ? null : maintenant - PERIODES[periodeValide(p)] * J;
  const dansPeriode = (x, debut, maintenant) => { const t = ms(x); return t != null && t <= maintenant + 60000 && (debut == null || t >= debut); };

  // Codes d'alertes qui signalent qu'une automatisation a échoué ou qu'un paiement est en souffrance (adminAlertes de donnees.js).
  const CODES_TECHNIQUES = ["ERREUR_WORKFLOW", "PUBLICATION_ECHEC", "ECHEC_PUBLICATION", "SCHEMA_INCOMPLET", "ECHEC_RELANCE_PROSPECT"];
  const CODES_PAIEMENT = ["PAIEMENT_REFUSE", "ABONNEMENT_SANS_COMMERCE", "OPTION_SANS_COMMERCE"];
  const INVITATION_BLOQUEE_MIN = 30;      // une invitation « à envoyer » depuis plus de 30 minutes : le workflow d'invitation n'est pas passé
  const ATTENTE_LONGUE_JOURS = 5;         // même seuil que la mise en route bloquée (alerte MISE_EN_ROUTE_BLOQUEE, score de santé)
  const ECHECS_JOURS = 7;                 // emails et WhatsApp en échec : 7 derniers jours

  function calculer(x) {
    const maintenant = x.maintenant || Date.now(), periode = periodeValide(x.periode), debut = debutPeriode(periode, maintenant);
    const brut = x.brut || {}, OFFRES = x.offres || {}, GD = (x.conditions || {}).garantie_delais || {};
    const AVANT = { fiche: (GD.alerte_fiche_avant_heures ?? 48) * H, premier_contenu: (GD.alerte_contenu_avant_heures ?? 24) * H, avis: (GD.alerte_avis_avant_heures ?? 4) * H };
    const commerces = x.commerces || [], parId = Object.fromEntries(commerces.map(c => [c.id, c]));
    const nom = cid => (parId[cid] || {}).nom || "";
    const creations = brut.creations || [];
    // Clients de test : créés par un paiement Stripe en mode test.
    const tests = new Set(creations.filter(j => j.detail && (j.detail.test === true || j.detail.test === "true")).map(j => j.commerce_id).filter(Boolean));
    // Dernier abonnement de chaque commerce (le plus récent ; un abonnement actif passe devant un ancien résilié).
    // Abonnement retenu pour chaque commerce : le meilleur statut d'abord (actif, impayé, en attente, résilié), puis le plus récent. L'ordre de lecture
    // de la base ne compte pas : un ancien abonnement résilié ne fait jamais passer pour perdu un client qui s'est réabonné (relecture du 29/10/2026).
    const RANG_AB = { actif: 0, impaye: 1, en_attente: 2, resilie: 3 }, aboDe = {};
    (brut.abonnements || []).forEach(a => { if (!a.commerce_id) return; const p = aboDe[a.commerce_id], ra = RANG_AB[a.statut] ?? 4;
      if (!p || ra < (RANG_AB[p.statut] ?? 4) || (ra === (RANG_AB[p.statut] ?? 4) && (ms(a.maj_le || a.cree_le) || 0) > (ms(p.maj_le || p.cree_le) || 0))) aboDe[a.commerce_id] = a; });
    // Abonnements Stripe payés en mode test (alertes et journal marqués « test », avec la référence de l'abonnement) : jamais dans le MRR.
    const subsTest = new Set((brut.tests || []).map(t => t.detail && t.detail.abonnement).filter(Boolean));
    const invitationsDe = {}; (brut.invitations || []).forEach(i => { (invitationsDe[i.commerce_id] = invitationsDe[i.commerce_id] || []).push(i); });
    const perdu = c => (aboDe[c.id] || {}).statut === "resilie";
    const servis = commerces.filter(c => !tests.has(c.id) && !perdu(c));          // clients servis (actifs, en pause compris)
    const actifs = servis.filter(c => !c.en_pause);
    const merFinie = c => { const m = c.sante && c.sante.mise_en_route; return !m || m.faits >= m.total; };
    const delaisDe = Object.fromEntries((x.delais || []).map(g => [g.commerce_id, g]));

    // ------------------------------------------------------------ Garanties (le cœur anti-erreur)
    const danger = [], attente = [], aAppliquer = []; let suivis = 0, tenus = 0;
    (x.delais || []).forEach(g => {
      const c = parId[g.commerce_id]; if (!c || tests.has(c.id) || perdu(c)) return;
      const pause = !!c.en_pause;   // CGV art. 10 : la garantie ne joue pas pendant une pause ; l'écran le montre, sans alarme
      const depart = ms(g.depart);
      const engagement = (k, d, debutBarre) => { if (!d) return; const ech = ms(d.echeance);
        if (d.fait_le) { tenus += d.etat === "manque" ? 0 : 1; return; }
        if (ech == null) return; suivis++;
        const etat = d.etat === "manque" || ech < maintenant ? "depasse" : ech - maintenant <= AVANT[k] ? "risque" : "en_cours";
        if (etat !== "en_cours") danger.push({ cid: c.id, nom: c.nom, offre: c.offre_id, engagement: k, etat, echeance: ech, debut: debutBarre, mois_offert: moisOffert(ech), pause }); };
      engagement("fiche", g.fiche, depart); engagement("premier_contenu", g.premier_contenu, depart);
      (g.avis_en_cours || []).forEach(a => { const ech = ms(a.echeance); if (ech == null) return; suivis++;
        const etat = a.en_retard || ech < maintenant ? "depasse" : ech - maintenant <= AVANT.avis ? "risque" : "en_cours";
        if (etat !== "en_cours") danger.push({ cid: c.id, nom: c.nom, offre: c.offre_id, engagement: "avis", etat, echeance: ech, debut: ms(a.recu_le), note: a.note, mois_offert: moisOffert(ech), pause }); });
      // Mois offerts à appliquer dans Stripe : un seul par client et par mois (CGV art. 10), même si plusieurs délais sont manqués.
      // Un mois déjà appliqué (statut « applique ») couvre tout autre délai manqué du même mois : la ligne reste à clore, sans rien changer dans Stripe.
      const vus = new Set(), deja = new Set((g.manquements || []).filter(m => m.statut === "applique").map(m => m.mois_offert));
      (g.manquements || []).filter(m => m.statut === "a_appliquer").forEach(m => {
        const k = m.mois_offert; if (vus.has(k)) { const e = aAppliquer.find(y => y.cid === c.id && y.mois_offert === k); if (e) e.engagements.push(m.engagement); return; }
        vus.add(k); aAppliquer.push({ cid: c.id, nom: c.nom, mois_offert: k, echeance: ms(m.echeance), engagements: [m.engagement], rythme: (aboDe[c.id] || {}).rythme || null, deja: deja.has(k) }); });
    });
    danger.sort((a, b) => (a.etat === "depasse" ? 0 : 1) - (b.etat === "depasse" ? 0 : 1) || a.echeance - b.echeance);
    // Délais pas encore démarrés : un client paie, mais l'horloge de la garantie ne tourne pas (accès Google ou photos pas remis, fiche à faire
    // vérifier par Google). Pas un manquement, mais un client qui attend : c'est là que naît la frustration.
    actifs.forEach(c => { const g = delaisDe[c.id]; if (g && g.depart) return; const o = OFFRES[c.offre_id] || {};
      const raisons = [];
      if (c.fiche_google_demande_le && !c.fiche_google_verifiee_le) raisons.push("fiche_a_verifier");
      else if (!g || !g.acces_remis_le) raisons.push("acces");
      if (o.reseaux_sociaux !== false && !(g && g.photos_recues_le)) raisons.push("photos");
      const depuis = ms(c.cree_le), jours = depuis == null ? null : Math.floor((maintenant - depuis) / J);
      attente.push({ cid: c.id, nom: c.nom, offre: c.offre_id, raisons, depuis, jours, long: jours != null && jours >= ATTENTE_LONGUE_JOURS }); });
    attente.sort((a, b) => (b.jours ?? -1) - (a.jours ?? -1));

    // ------------------------------------------------------------ Indicateurs
    const items = x.afaire || [];
    const enRetard = items.filter(i => i.retard);
    let mrr = 0, mrrNb = 0, mrrEstime = false; const inconnues = [];
    const auj = jourParis(maintenant);
    const remplaces = (brut.abonnements || []).filter(a => a.statut === "actif" && a.remplace_par);
    (brut.abonnements || []).filter(a => a.statut === "actif" && !a.remplace_par && !tests.has(a.commerce_id) && !subsTest.has(a.stripe_subscription)).forEach(a => { const o = OFFRES[a.offre];
      if (!o || o.prix_ht == null) { inconnues.push(a.offre || "?"); return; }
      let p = a.rythme === "annuel" ? o.prix_ht : o.prix_mensuel_ht != null ? o.prix_mensuel_ht : o.prix_ht;
      if (!a.rythme) mrrEstime = true;
      if (a.remise_lancement_fin && String(a.remise_lancement_fin).slice(0, 10) >= auj) p = p / 2;
      mrr += p; mrrNb++; });
    const impayes = (brut.abonnements || []).filter(a => a.statut === "impaye" && !tests.has(a.commerce_id));
    const avisPeriode = (brut.avis || []).filter(a => !tests.has(a.commerce_id) && dansPeriode(a.traite_le || a.repondu_le, debut, maintenant));
    const avis24 = avisPeriode.filter(a => { const r = ms(a.traite_le || a.repondu_le), c = ms(a.cree_le); return r != null && c != null && r - c <= (GD.avis_traite_heures ?? 24) * H; }).length;

    // ------------------------------------------------------------ Pipeline : où en est chaque prospect et chaque client AUJOURD'HUI ; « Perdu » sur la période
    const convertis = new Set(creations.map(j => j.detail && j.detail.prospect).filter(Boolean));
    const P = { demande: [], envoye: [], relance: [], paye: [], onboarding: [], actif: [], perdu: [] };
    let rdv = 0, pauses = 0;
    (x.prospects || []).forEach(p => {
      if (convertis.has(p.id)) return;
      const perte = d => { if (dansPeriode(d, debut, maintenant)) P.perdu.push({ id: p.id, nom: p.commerce, quand: ms(d), de: "prospect" }); };
      if (p.desinscrit_le) return perte(p.desinscrit_le);
      if (p.origine === "tournee") {
        const r = p.resultat || "propose";
        if (r === "pas_interesse") return perte(p.resultat_le);
        if (r === "rappeler" && (p.relances || 0) >= 3) return perte(p.derniere_relance_le || p.resultat_le);
        if (r === "propose") return P.envoye.push(p);
        if (r === "rdv" || r === "pilote") rdv++;
        return P.relance.push(p);
      }
      if (p.rdv_le) { rdv++; return P.relance.push(p); }
      if (p.repondu_le) return P.relance.push(p);
      if (!p.rapport_envoye_le) return P.demande.push(p);
      if ((p.relances || 0) >= 3) return perte(p.derniere_relance_le || p.rapport_envoye_le);
      if ((p.relances || 0) > 0) return P.relance.push(p);
      return P.envoye.push(p);
    });
    commerces.forEach(c => {
      if (tests.has(c.id)) return; const a = aboDe[c.id];
      if (perdu(c)) { if (dansPeriode(a.maj_le || a.cree_le, debut, maintenant)) P.perdu.push({ id: c.id, nom: c.nom, quand: ms(a.maj_le || a.cree_le), de: "client" }); return; }
      const paye = a && ["actif", "impaye"].includes(a.statut), invs = invitationsDe[c.id] || [];
      if (paye && invs.length && !invs.some(i => i.statut === "acceptee")) return P.paye.push(c);
      if (!merFinie(c) || !(delaisDe[c.id] && delaisDe[c.id].depart)) return P.onboarding.push(c);
      if (c.en_pause) pauses++;
      P.actif.push(c);
    });
    const pipeline = ["demande", "envoye", "relance", "paye", "onboarding", "actif", "perdu"].map(k => ({ k, n: P[k].length, noms: P[k].slice(0, 3).map(y => y.commerce || y.nom || "") }));

    // ------------------------------------------------------------ Provenance (période)
    const prov = { site: 0, tournee: 0 }, provC = { paiement_site: 0, prospect: 0, console: 0 };
    (x.prospects || []).filter(p => dansPeriode(p.audit_le || p.cree_le, debut, maintenant)).forEach(p => { prov[p.origine === "tournee" ? "tournee" : "site"]++; });
    creations.filter(j => j.commerce_id && !tests.has(j.commerce_id) && dansPeriode(j.cree_le, debut, maintenant)).forEach(j => { const d = j.detail || {};
      provC[d.origine === "paiement_en_ligne" ? "paiement_site" : d.prospect ? "prospect" : "console"]++; });

    // ------------------------------------------------------------ File de travail, par client (cartes de « À faire »)
    const groupes = {};
    items.forEach(i => { const k = i.cid || ""; const g = groupes[k] || (groupes[k] = { cid: i.cid || null, nom: i.cid ? nom(i.cid) || "" : "", n: 0, retard: 0, prochaine: Infinity, prises: 0 });
      g.n++; if (i.retard) g.retard++; if (i.quand !== Infinity && i.quand < g.prochaine) g.prochaine = i.quand; if (i.cle && x.prises && x.prises[i.cle]) g.prises++; });
    const file = Object.values(groupes).map(g => ({ ...g, cle: g.cid ? "client:" + g.cid : null, prise: g.cid && x.prises ? x.prises["client:" + g.cid] || null : null }))
      .sort((a, b) => (a.cid ? 0 : 1) - (b.cid ? 0 : 1) || b.retard - a.retard || a.prochaine - b.prochaine || b.n - a.n || a.nom.localeCompare(b.nom));

    // ------------------------------------------------------------ Contrôles techniques : tout ce qui ferait rater un client sans bruit
    const controles = [];
    const ctl = (k, etat, details, n) => controles.push({ k, etat, details: details || [], n: n == null ? (details || []).length : n });
    const illisible = (brut.illisible || []).slice();
    ["commerces", "delais", "prospects", "alertes"].forEach(k => { if (x[k] == null) illisible.push(k); });
    // File « À faire » dont une lecture a échoué : ses tâches manqueraient au compte du retard ; jamais un « tout est tenu » sur une file incomplète.
    if (x.afaireIllisible) illisible.push("afaire");
    if (illisible.length) ctl("donnees", "alerte", illisible.map(s => ({ texte: s })));
    // Listes lues en partie (limite de lignes atteinte) : les chiffres qui en dépendent sont incomplets, et l'écran le dit.
    const tronques = [...(brut.tronques || []), ...(x.prospectsTronques ? ["prospects"] : [])];
    if (tronques.length) ctl("limites", "a_verifier", tronques.map(s => ({ texte: s })));
    // Invitations : un client qui n'a jamais reçu son accès.
    const invs = brut.invitations || [];
    const invKo = invs.filter(i => i.statut === "echec").map(i => ({ cid: i.commerce_id, nom: nom(i.commerce_id), cle: "echec", texte: i.erreur || "", quand: ms(i.cree_le) }))
      .concat(invs.filter(i => i.statut === "a_envoyer" && maintenant - (ms(i.cree_le) || maintenant) > INVITATION_BLOQUEE_MIN * 60000)
        .map(i => ({ cid: i.commerce_id, nom: nom(i.commerce_id), cle: "bloquee", quand: ms(i.cree_le) })));
    ctl("invitations", brut.invitations == null ? "inconnu" : invKo.length ? "alerte" : "ok", invKo);
    // Automatisations (n8n, webhooks, publications) en erreur, alertes non traitées.
    const alertes = x.alertes || [];
    const techs = alertes.filter(a => CODES_TECHNIQUES.includes(a.code) && !(a.journal && (ms(a.date) || 0) < maintenant - ECHECS_JOURS * J)).map(a => ({ cid: a.commerce_id || null, nom: a.commerce || "", cle: a.code, texte: a.texte || "", quand: ms(a.date) }));
    ctl("workflows", x.alertes == null ? "inconnu" : techs.length ? "alerte" : "ok", techs);
    // Paiements Stripe : mode test, boutons de paiement, paiements en souffrance.
    const st = [], cfgS = x.stripe || null, liens = [];
    const parcourir = o => { if (!o || typeof o !== "object") return; Object.values(o).forEach(v => typeof v === "string" ? liens.push(v) : parcourir(v)); };
    if (cfgS) parcourir(cfgS.liens);
    (brut.tests || []).forEach(t => { const q = ms(t.cree_le); st.push({ cle: q != null && maintenant - q > 48 * H ? "mode_test_ancien" : "mode_test", cid: t.commerce_id || null, nom: nom(t.commerce_id), quand: q }); });
    if (liens.some(u => /\/test_/i.test(u))) st.push({ cle: "liens_test" });
    alertes.filter(a => CODES_PAIEMENT.includes(a.code)).forEach(a => st.push({ cle: a.code, cid: a.commerce_id || null, nom: a.commerce || "", quand: ms(a.date) }));
    impayes.forEach(a => st.push({ cle: "impaye", cid: a.commerce_id, nom: nom(a.commerce_id), quand: ms(a.maj_le || a.cree_le) }));
    const sansLiens = x.mode === "supabase" && cfgS && !liens.length, stGrave = st.some(y => y.cle !== "mode_test_ancien");
    ctl("stripe", stGrave ? "alerte" : st.length ? "a_verifier" : sansLiens ? "a_verifier" : brut.abonnements == null ? "inconnu" : !(brut.abonnements || []).length ? "a_verifier" : "ok",
      st.length ? st : sansLiens ? [{ cle: "sans_liens" }] : !(brut.abonnements || []).length ? [{ cle: "aucun_paiement" }] : [], st.length);
    // Fiche Google : un client servi sans identifiant de fiche n'a ni relevé d'avis, ni réponse : rien ne se passe pour lui, sans aucun bruit.
    const etatFiche = x.etatFiche || (c => /^[A-Za-z0-9_-]{10,255}$/.test(c.google_place_id || "") ? "reconnue" : "aucune");
    const sansFiche = actifs.filter(c => etatFiche(c) !== "reconnue").map(c => ({ cid: c.id, nom: c.nom, cle: etatFiche(c) }));
    ctl("fiche_google", sansFiche.length ? "alerte" : "ok", sansFiche);
    // Emails aux commerçants et alertes WhatsApp en échec (7 jours).
    const depuis7 = maintenant - ECHECS_JOURS * J;
    const env = (brut.envois || []).filter(e => e.statut === "echec" && (ms(e.cree_le) || 0) >= depuis7).map(e => ({ cid: e.commerce_id, nom: nom(e.commerce_id), cle: e.categorie, texte: e.erreur || "", quand: ms(e.cree_le) }));
    ctl("emails", brut.envois == null ? "inconnu" : env.length ? "alerte" : "ok", env);
    const wa = (brut.whatsapp || []).filter(w => ["echec", "abandonne"].includes(w.statut) && (ms(w.cree_le) || 0) >= depuis7).map(w => ({ cid: w.commerce_id, nom: nom(w.commerce_id), cle: w.type, texte: w.erreur || "", quand: ms(w.cree_le) }));
    ctl("whatsapp", brut.whatsapp == null ? "inconnu" : wa.length ? "alerte" : "ok", wa);
    // Metricool : Croissance et Premium sans marque Metricool = publications à faire à la main (file « À publier »).
    const sansMc = actifs.filter(c => (OFFRES[c.offre_id] || {}).reseaux_sociaux && !c.metricool_blog_id).map(c => ({ cid: c.id, nom: c.nom }));
    ctl("metricool", sansMc.length ? "a_verifier" : "ok", sansMc);
    // Clients de test encore présents.
    const restes = commerces.filter(c => tests.has(c.id)).map(c => ({ cid: c.id, nom: c.nom }));
    if (restes.length) ctl("tests_restants", "a_verifier", restes);
    const ORDRE = { alerte: 0, a_verifier: 1, inconnu: 2, ok: 3 };
    controles.sort((a, b) => ORDRE[a.etat] - ORDRE[b.etat]);

    // ------------------------------------------------------------ Verdict (la phrase en tête)
    const depasses = danger.filter(d => d.etat === "depasse" && !d.pause).length, risques = danger.filter(d => d.etat === "risque" && !d.pause).length;
    const systeme = controles.filter(c => c.etat === "alerte").length;
    const vide = !servis.length && !(x.prospects || []).length;
    // Ordre : une vraie alerte d'abord ; sans aucun client ni prospect, « vide » (l'absence de paiement n'est pas encore un point à vérifier) ;
    // puis ce qui arrive bientôt ou reste à vérifier ; sinon « calme ».
    const aStripe = aAppliquer.filter(m => !m.deja).length;
    const niveau = enRetard.length || depasses || systeme || aStripe ? "rouge" : vide ? "vide" : risques || attente.some(a => a.long) || controles.some(c => c.etat === "a_verifier") ? "or" : "calme";

    return {
      maintenant, periode, debut, niveau,
      verdict: { retard: enRetard.length, depasses, risques, systeme, a_appliquer: aStripe, attente_longue: attente.filter(a => a.long).length, vide },
      kpi: {
        retard: { n: enRetard.length, garanties: enRetard.filter(i => i.type === "garanties").length, total: items.length },
        clients: { n: actifs.length, pause: servis.length - actifs.length, mise_en_route: actifs.filter(c => !merFinie(c)).length },
        mrr: { total: Math.round(mrr * 100) / 100, n: mrrNb, estime: mrrEstime, inconnues, impayes: impayes.length, remplaces: remplaces.length },
        // Audits en cours : demandes venues du formulaire du site, ni perdues ni devenues clientes (la tournée du jour n'est pas un audit demandé).
        audits: { n: [...P.demande, ...P.envoye, ...P.relance].filter(p => p.origine !== "tournee").length, a_envoyer: P.demande.length },
        avis: { n: avisPeriode.length, dans24: avis24 },
      },
      garanties: { danger, attente, a_appliquer: aAppliquer, suivis, tenus },
      pipeline, rdv, pauses,
      provenance: { prospects: prov, clients: provC },
      file, controles,
    };
  }

  const api = { calculer, moisOffert, periodeValide, PERIODES, jourParis };
  if (typeof module === "object" && module.exports) module.exports = api; else racine.RENOM_COCKPIT = api;
})(typeof window !== "undefined" ? window : globalThis);
