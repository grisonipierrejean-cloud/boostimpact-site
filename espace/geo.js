// Visibilité IA dans la console (15/11/2026, décision de PJ : processus de livraison enregistré et livrable, ordres/PROCESSUS-VISIBILITE-IA.md).
// Ce fichier dessine le bloc « Visibilité IA » de la fiche client et la carte de « À faire », et branche leurs gestes. Il ne lit et n'écrit que par
// la couche de données (donnees.js : adminDossierGeo, adminGeoEtape…, mêmes règles en démonstration et dans la base, bloc SQL « Visibilité IA :
// dossier de livraison »). Les 10 étapes viennent de la base (geo_etapes_def) : libellés geo.e.<clé> de i18n.js, même ordre.
(function () {
  const I = window.RENOM_I18N, t = I.t, ph = I.phrase;
  const e = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MOTEURS = ["openai", "gemini", "perplexity"];
  const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  const ETATS_PF = ["a_faire", "code_attendu", "fait", "sans_objet"];
  const date = d => d ? I.date(d) : "";
  const jour = d => d ? I.dateLongue(String(d).slice(0, 10)) : "";
  const qui = l => (l || []).map(x => t("con.pa.qui." + x)).join(" + ");
  const AUTO = ["declenchement", "mesure_j0", "mesure_j7", "mesure_j30", "mesure_j90"];

  // ---------------- Échéance (lot 9, 16/11/2026) : garantie de 7 jours après la réunion du paiement, de l'accès Google et des 10 questions validées
  // (options.json, livraison_jours) ; objectif interne de 72 heures ouvrées (objectif_heures_ouvrees) ; dossiers ouverts avant : 14 jours.
  // Prochaine mesure : J+7 (jamais avant la livraison), J+30, J+90 depuis J0, Premium tous les 90 jours.
  const heureEch = d => d ? I.heure(d) : "";
  const echeance = d => { if (d.livre_le) return t("con.geo.livre", { d: date(d.livre_le) }) + (d.delai_respecte === true ? " " + t("con.geo.delai.tenu", { n: I.nombre(d.heures_ouvrees_livraison ?? 0, 1) }) : d.delai_respecte === false ? " " + t("con.geo.delai.depasse") : "")
      + (d.objectif_tenu === true ? " " + t("con.geo.objectif.tenu") : d.objectif_tenu === false ? " " + t("con.geo.objectif.rate") : "") + (d.garantie ? " " + t("con.geo.garantie." + d.garantie) : "");
    if (d.regle_delai === "14_jours") return (d.en_retard ? t("con.geo.retard", { d: jour(d.livraison_prevue_le) }) : t("con.geo.echeance", { d: jour(d.livraison_prevue_le) })) + " " + t("con.geo.regle14");
    if (!d.chrono_demarre) return t("con.geo.chrono.attend", { l: [d.acces_google_le ? "" : t("con.geo.attend.acces"), d.questions_validees_le ? "" : t("con.geo.attend.questions")].filter(Boolean).join(" + "), d: jour(d.livraison_prevue_le) });
    if (d.en_retard) return t("con.geo.retard.heure", { d: jour(d.livraison_prevue_le), h: heureEch(d.livraison_prevue_a) });
    return t("con.geo.echeance.heure", { d: jour(d.livraison_prevue_le), h: heureEch(d.livraison_prevue_a), h0: date(d.depart_le) }) + " "
      + (d.objectif_manque ? t("con.geo.objectif.manque") : t("con.geo.objectif", { d: jour(d.objectif_a), h: heureEch(d.objectif_a), n: I.nombre(d.heures_ouvrees_restantes ?? 0, 1) })); };
  const prochaine = d => d.prochaine_mesure_type === "j7" && !d.prochaine_mesure_le ? `<p class="note" data-geo-prochaine>${t("con.geo.prochaine.j7.livraison")}</p>`
    : d.prochaine_mesure_le ? `<p class="note" data-geo-prochaine>${d.prochaine_mesure_type === "trimestrielle" ? t("con.geo.prochaine.premium", { d: jour(d.prochaine_mesure_le) })
    : t("con.geo.prochaine", { d: jour(d.prochaine_mesure_le), t: t("con.geo.mesure.libelle." + (d.prochaine_mesure_type || "j90")) })}</p>` : "";

  // ---------------- Étapes : case à cocher (sauf les étapes du robot, les questions et une livraison notée), qui agit, mode, date, note.
  const NOTE = ["captures", "coherence", "fiche_google", "contenus_site", "rapport"];
  const ligneEtape = (d, x, i) => { const fait = x.etat === "fait", bloque = AUTO.includes(x.cle) || x.cle === "questions" || (x.cle === "rapport" && fait),
      st = fait ? "fait" : x.qui.includes("vous") ? "vous" : x.qui.includes("client") ? "client" : "robot";
    return `<li data-geo-etape="${x.cle}" data-st="${st}"><label class="option"><input type="checkbox" data-geo-cocher="${x.cle}"${fait ? " checked" : ""}${bloque ? " disabled" : ""}><span class="fort">${i + 1}. ${t("geo.e." + x.cle)}</span></label>
      <p class="note geo-qui"><span class="etat-dos etat-dos-${st}">${fait ? t("con.dos.st.fait") : qui(x.qui)}</span> ${fait ? qui(x.qui) + " · " : ""}${t("con.geo.mode." + x.mode)}${fait && x.le ? " · " + t(x.par === "robot" ? "con.geo.fait.robot" : "con.geo.fait.le", { d: date(x.le) }) : ""}</p>
      ${x.note ? `<p class="note casse" data-geo-note-lue lang="fr" translate="no">${e(x.note)}</p>` : ""}
      ${!fait && !bloque && NOTE.includes(x.cle) ? `<div class="f"><label for="geo-note-${x.cle}" class="note">${t("con.geo.note." + (x.cle === "captures" ? "captures" : x.cle === "coherence" ? "coherence" : "autre"))}</label><input id="geo-note-${x.cle}" type="text" maxlength="1000" data-geo-note="${x.cle}"></div>` : ""}
      ${(x.cle === "coherence" && d.coherence_garantie_le && !fait) ? `<p class="note" data-geo-garantie>${t("con.geo.coherence.garantie", { d: date(d.coherence_garantie_le) })}</p>` : ""}
      ${(x.cle === "fiche_google" && d.fiche_optimisee_le && !fait) ? `<p class="note" data-geo-garantie>${t("con.geo.fiche.garantie", { d: date(d.fiche_optimisee_le) })}</p>` : ""}</li>`; };

  // ---------------- Les 10 questions : éditables jusqu'au lancement de la mesure de départ.
  const blocQuestions = d => { const q = Array.isArray(d.questions) ? d.questions : [], fige = !!d.questions_figees;
    const etat = d.questions_validees_le ? t("con.geo.q.validees", { d: date(d.questions_validees_le) }) : d.questions_proposees_le ? t("con.geo.q.proposees." + (d.questions_source || "modele"), { d: date(d.questions_proposees_le) }) : t("con.geo.q.aucune");
    return `<h3 id="geo-questions-titre">${t("con.geo.q.titre")}</h3><p class="note" data-geo-q-etat>${etat}${fige ? " " + t("con.geo.q.figees") : ""}</p>
      <ol class="geo-questions">${Array.from({ length: 10 }, (_, i) => `<li><label class="vh" for="geo-q-${i}">${t("con.geo.q.n", { n: i + 1 })}</label><input id="geo-q-${i}" type="text" maxlength="200" data-geo-q value="${e(q[i] || "")}"${fige ? " readonly" : ""}></li>`).join("")}</ol>
      ${fige ? "" : `<div class="actions">${d.questions_validees_le ? "" : `<button type="button" class="bouton second petit" data-geo-demander="questions">${t("con.geo.q.proposer")}</button>`}<button type="button" class="bouton second petit" data-geo-q-enregistrer>${t("con.geo.q.enregistrer")}</button><button type="button" class="bouton petit" data-geo-q-valider>${t("con.geo.q.valider")}</button></div>`}`; };

  // ---------------- Mesures : synthèse question par question (cité x fois sur 3, par moteur), moteurs non mesurés, coût, rapport.
  const caseSyn = s => !s ? `<td data-l="">${t("con.geo.m.non")}</td>` : !s.sur ? `<td>${t(s.erreurs ? "con.geo.m.erreur" : "con.geo.m.non")}</td>`
    : `<td class="${s.cite ? "fort" : ""}">${t(s.cite ? "con.geo.m.cite" : "con.geo.m.absent", { a: s.cite, b: s.sur })}${s.position_moyenne ? `<br><span class="note">${t("con.geo.m.rang", { n: I.nombre(s.position_moyenne, Number.isInteger(+s.position_moyenne) ? 0 : 1) })}</span>` : ""}</td>`;
  const blocMesure = m => { const non = Object.entries(m.moteurs || {}).filter(([, v]) => v.etat !== "mesure"), syn = Array.isArray(m.synthese) ? m.synthese : [];
    return `<div class="geo-mesure" data-geo-mesure="${e(m.id)}" data-statut="${e(m.statut)}"><p class="fort">${t("con.geo.m.type." + m.type)} · ${t("con.geo.m.st." + m.statut, { d: date(m.faite_le || m.demandee_le) })}${m.cout_usd != null && m.statut === "faite" ? " · " + t("con.geo.m.cout", { n: I.nombre(m.cout_usd, 2) }) : ""}</p>
      ${m.erreur ? `<p class="note fort" data-geo-erreur>${e(ph(m.erreur))}</p>` : ""}${m.avertissement ? `<p class="note" lang="fr" translate="no">${e(m.avertissement)}</p>` : ""}
      ${non.length ? `<p class="note" data-geo-non-mesure>${non.map(([k, v]) => t("con.geo.m.non.mesure", { m: t("geo.moteur." + k), r: e(v.raison || "") })).join(" · ")}</p>` : ""}
      ${syn.length ? `<table class="geo-syn"><thead><tr><th>${t("con.geo.m.question")}</th>${MOTEURS.map(k => `<th>${t("geo.moteur." + k)}</th>`).join("")}</tr></thead><tbody>
        ${syn.map(s => `<tr><td>${t("con.geo.m.q", { n: s.question_index + 1 })}</td>${MOTEURS.map(k => caseSyn((s.par_moteur || {})[k])).join("")}</tr>`).join("")}</tbody></table>` : ""}
      ${m.rapport ? `<div class="actions"><button type="button" class="bouton second petit" data-geo-rapport="${e(m.id)}">${t("con.geo.m.rapport")}</button></div>` : ""}</div>`; };

  // ---------------- Import Bing Places (lot 9, décision du fondateur) : fait par l'équipe avec l'accès gestionnaire Google ; une date par état ;
  // le dépôt est exigé avant le rapport de livraison, il ne bouge pas le chrono des 72 h (admin_geo_bing).
  const ETATS_BING = ["a_faire", "depose", "publie", "bloque"];
  const blocBing = d => { const b = d.bing || {};
    if (!b.etat) return `<h3 id="geo-bing-titre">${t("con.geo.bing.titre")}</h3><p class="note" data-geo-bing-attente>${t("con.geo.bing.attente")}</p>`;
    return `<h3 id="geo-bing-titre">${t("con.geo.bing.titre")}</h3><p class="note">${t("con.geo.bing.chapo")}</p>
      <div class="champs deux" data-geo-bing-ligne data-etat="${e(b.etat)}"><div class="f"><label for="geo-bing-etat">${t("con.geo.bing.etat")}</label><select id="geo-bing-etat" data-geo-bing>${ETATS_BING.map(s => `<option value="${s}"${b.etat === s ? " selected" : ""}>${t("con.geo.bing.e." + s)}</option>`).join("")}</select></div>
      <div class="f"><label for="geo-bing-note">${t("con.geo.bing.note")}</label><input id="geo-bing-note" type="text" maxlength="500" value="${e(b.note || "")}"></div></div>
      <p class="note" data-geo-bing-dates>${ETATS_BING.filter(s => b[s + "_le"]).map(s => `${t("con.geo.bing.e." + s)} : ${date(b[s + "_le"])}, ${heureEch(b[s + "_le"])}`).join(" · ")}</p>`; };

  // ---------------- Plateformes : France ou Belgique (geo_plateformes_def) ; « code attendu » s'affiche dans l'espace du client.
  const blocPlateformes = d => `<h3>${t("con.geo.pf.titre")}</h3><p class="note">${t("con.geo.pf.chapo")}</p><ul class="geo-plateformes">${(d.plateformes || []).map(p => `<li data-geo-pf-ligne="${p.cle}" data-etat="${p.etat}">
      <label for="geo-pf-${p.cle}">${t("geo.pf." + p.cle)}</label><select id="geo-pf-${p.cle}" data-geo-pf="${p.cle}">${ETATS_PF.map(s => `<option value="${s}"${p.etat === s ? " selected" : ""}>${t("geo.pf.etat." + s)}</option>`).join("")}</select></li>`).join("")}</ul>`;

  // ---------------- Référence relevée à l'audit de cohérence : seule source des contenus du site (rien d'inventé).
  const horairesTexte = h => JOURS.map(j => [j, h && Array.isArray(h[j]) ? h[j].map(c => c.join("-")).join(", ") : ""]);
  const blocReference = d => { const r = d.reference || {}, hs = horairesTexte(r.horaires), champ = (k, type = "text", aide = "") => `<div class="f"><label for="geo-ref-${k}">${t("con.geo.ref." + k)}</label><input id="geo-ref-${k}" type="${type}" data-geo-ref="${k}" value="${e(r[k] || "")}" maxlength="300">${aide ? `<p class="aide">${aide}</p>` : ""}</div>`;
    return `<details class="geo-ref" id="geo-reference"${Object.keys(r).length ? "" : " open"}><summary>${t("con.geo.ref.titre")}</summary><p class="note">${t("con.geo.ref.chapo")}</p><form id="f-geo-ref" class="pile serre" novalidate>
      ${champ("nom")}${champ("adresse")}<div class="champs deux">${champ("code_postal")}${champ("ville")}</div>${champ("telephone", "tel", t("con.geo.ref.telephone.aide"))}${champ("site", "url")}${champ("menu_url", "url")}
      <div class="f"><label for="geo-ref-cuisine">${t("con.geo.ref.cuisine")}</label><input id="geo-ref-cuisine" type="text" data-geo-ref-liste="cuisine" value="${e((r.cuisine || []).join(", "))}" maxlength="300"><p class="aide">${t("con.geo.ref.cuisine.aide")}</p></div>
      <fieldset class="geo-horaires"><legend>${t("con.geo.ref.horaires")}</legend><p class="aide">${t("con.geo.ref.horaires.aide")}</p>${hs.map(([j, v]) => `<div class="f"><label for="geo-h-${j}">${t("geo.jour." + j)}</label><input id="geo-h-${j}" type="text" data-geo-h="${j}" value="${e(v)}" maxlength="60" inputmode="numeric"></div>`).join("")}</fieldset>
      <div class="f"><label for="geo-ref-menu">${t("con.geo.ref.menu")}</label><textarea id="geo-ref-menu" rows="5" data-geo-ref-menu>${e((r.menu || []).map(p => p.nom + (p.prix != null && p.prix !== "" ? " ; " + p.prix : "")).join("\n"))}</textarea><p class="aide">${t("con.geo.ref.menu.aide")}</p></div>
      <button class="bouton second petit" type="submit">${t("con.geo.ref.enregistrer")}</button></form></details>`; };
  // Horaires saisis « 12:00-14:30, 19:00-22:30 » (ou 12h-14h30) ; vide ou « fermé » : fermé ; les 7 jours vides : horaires non relevés.
  const heure = s => { const m = String(s).trim().replace(/h/i, ":").match(/^(\d{1,2})(?::(\d{2}))?$/); if (!m || +m[1] > 23 || +(m[2] || 0) > 59) return null; return String(m[1]).padStart(2, "0") + ":" + (m[2] || "00"); };
  function lireReference(z) {
    const r = {}; z.querySelectorAll("[data-geo-ref]").forEach(i => { r[i.dataset.geoRef] = i.value.trim(); });
    r.cuisine = z.querySelector("[data-geo-ref-liste=cuisine]").value.split(",").map(x => x.trim()).filter(Boolean);
    const brut = JOURS.map(j => [j, z.querySelector(`[data-geo-h="${j}"]`).value.trim()]);
    if (brut.some(([, v]) => v)) { r.horaires = {};
      for (const [j, v] of brut) { r.horaires[j] = [];
        if (!v || /^(ferm|gesloten|closed)/i.test(v)) continue;
        for (const c of v.split(/[,;]/)) { const [a, b] = c.split(/[-–]/), ha = heure(a || ""), hb = heure(b || "");
          if (!ha || !hb) throw new Error(t("con.geo.ref.horaires.err", { j: t("geo.jour." + j) })); r.horaires[j].push([ha, hb]); } } }
    r.menu = z.querySelector("[data-geo-ref-menu]").value.split("\n").map(l => l.trim()).filter(Boolean).map(l => { const [nom, prix] = l.split(";").map(x => x.trim()); return prix ? { nom, prix } : { nom }; });
    return r;
  }

  // ---------------- Contenus du site, générés par le robot depuis la référence : à copier et remettre au client.
  const blocContenus = d => { const k = d.contenus_site; if (!k) return "";
    return `<details class="geo-contenus" id="geo-contenus"><summary>${t("con.geo.c.titre", { d: date(d.contenus_le) })}</summary>
      ${(k.manquants || []).length ? `<p class="note fort" data-geo-manquants>${t("con.geo.c.manquants", { l: e(k.manquants.join(", ")) })}</p>` : `<p class="note">${t("con.geo.c.complet")}</p>`}
      ${d.site_web ? "" : `<p class="note fort" data-geo-sans-site>${t("con.geo.c.sans.site")}</p>`}
      ${k.menu_texte ? `<div class="f"><label for="geo-c-menu">${t("con.geo.c.menu")}</label><textarea id="geo-c-menu" rows="6" readonly>${e(k.menu_texte)}</textarea><button type="button" class="lien" data-geo-copier="geo-c-menu">${t("con.coh.copier")}</button></div>` : ""}
      ${(k.faq || []).length ? `<div class="f"><label for="geo-c-faq">${t("con.geo.c.faq")}</label><textarea id="geo-c-faq" rows="6" readonly>${e(k.faq.map(x => x.q + "\n" + x.r).join("\n\n"))}</textarea><button type="button" class="lien" data-geo-copier="geo-c-faq">${t("con.coh.copier")}</button></div>` : ""}
      <div class="f"><label for="geo-c-ld">${t("con.geo.c.jsonld")}</label><textarea id="geo-c-ld" rows="8" readonly translate="no" class="casse">${e(k.jsonld_html || "")}</textarea><button type="button" class="lien" data-geo-copier="geo-c-ld">${t("con.coh.copier")}</button></div>
      <p class="note">${e(k.mode_emploi || "")}</p></details>`; };

  // ---------------- Bloc de la fiche client
  function bloc(c, d, o = {}) {
    if (!d) { const peut = ["standard", "premium"].includes(c.offre_id) || o.optionPayee;
      return `<section class="carte" id="client-geo"><h2>${t("geo.titre")}</h2><p class="note" data-geo-absent>${t(peut ? "con.geo.absent.ouvrir" : "con.geo.absent.essentiel")}</p>
        ${peut && o.peutOuvrir ? `<div class="actions"><button type="button" class="bouton second petit" data-geo-ouvrir>${t("con.geo.ouvrir")}</button></div>` : ""}</section>`; }
    const enCours = (d.demandes || []).filter(x => x.statut === "a_traiter"), echec = (d.demandes || []).find(x => x.statut === "echec");
    const mesures = [...(d.mesures || [])].reverse();
    // « Lancer la mesure » : départ dès les 10 questions validées ; ensuite seulement à partir de 7 jours avant la prochaine mesure (même règle que la base).
    const j0 = (d.mesures || []).some(m => m.type === "j0" && m.statut === "faite"), auj = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
    // Lot 9 : à la main à partir de 1 jour (J+7), 3 jours (J+30) ou 7 jours (J+90, trimestrielle) avant la date (geo_demander).
    const tol = { j7: 1, j30: 3 }[d.prochaine_mesure_type] || 7;
    const due = !j0 || (d.prochaine_mesure_le && auj >= new Date(Date.parse(d.prochaine_mesure_le) - tol * 864e5).toISOString().slice(0, 10));
    const enAttente = (d.mesures || []).some(m => m.statut === "demandee");
    return `<section class="carte geo" id="client-geo" data-geo="${e(d.id)}" aria-labelledby="geo-titre"><div class="carte-tete"><h2 id="geo-titre">${t("geo.titre")}</h2><span class="note" data-geo-n>${t("con.dos.n", { a: d.faites, b: d.total })}</span></div>
      <p class="note">${t("con.geo.origine." + d.origine)}</p>
      <p class="${d.en_retard ? "fort " : ""}geo-echeance" data-geo-echeance>${echeance(d)}</p>${prochaine(d)}
      <ol class="geo-etapes">${(d.etapes || []).map((x, i) => ligneEtape(d, x, i)).join("")}</ol>
      ${blocQuestions(d)}
      <h3>${t("con.geo.m.titre")}</h3>
      <div class="actions"><button type="button" class="bouton petit" data-geo-demander="mesure"${d.questions_validees_le && due && !enAttente ? "" : " disabled"}>${t("con.geo.m.lancer")}</button><button type="button" class="bouton second petit" data-geo-demander="contenus">${t("con.geo.c.generer")}</button></div>
      ${d.questions_validees_le ? "" : `<p class="note">${t("con.geo.m.avant")}</p>`}${d.questions_validees_le && !due ? `<p class="note" data-geo-pas-due>${t(d.prochaine_mesure_le ? "con.geo.m.pas.due" : "con.geo.m.apres.livraison", { d: jour(d.prochaine_mesure_le) })}</p>` : ""}
      ${enCours.length ? `<p class="note fort" data-geo-en-cours>${enCours.map(x => t("con.geo.d.en.cours." + x.type, { d: I.heure(x.cree_le) })).join(" · ")}</p>` : ""}
      ${echec && !enCours.length ? `<p class="note" data-geo-echec>${t("con.geo.d.echec", { e: e(ph(echec.erreur || "")) })}</p>` : ""}
      ${mesures.length ? mesures.map(blocMesure).join("") : `<p class="note">${t("con.geo.m.aucune")}</p>`}
      ${blocContenus(d)}
      ${blocBing(d)}
      ${blocPlateformes(d)}
      ${blocReference(d)}</section>`;
  }

  // ---------------- Carte de « À faire » : une étape VOUS attend, l'échéance approche (3 jours), une mesure est due, ou la dernière a échoué.
  const aFaire = x => (!x.livre_le && (x.etape_vous || x.jours_restants <= 3)) || x.mesure_due || !!x.derniere_erreur;
  const carte = x => `<article class="carte${x.en_retard ? " attention" : ""}" data-geo-af="${e(x.id)}" data-cid="${e(x.commerce_id)}">
      <div class="carte-tete"><h2>${e(x.commerce || "")}</h2><span class="etat${x.en_retard ? "" : " actif"}">${x.livre_le ? t("con.geo.livre", { d: date(x.livre_le) }) : x.en_retard ? t("con.geo.retard", { d: jour(x.livraison_prevue_le) }) : t("con.geo.echeance", { d: jour(x.livraison_prevue_le) })}</span></div>
      <p class="note">${t("geo.titre")} · ${t("con.dos.n", { a: x.faites, b: x.total })}</p>
      ${x.etape_vous && !x.livre_le ? `<p class="fort" data-geo-af-etape="${x.etape_vous}"><span class="pastille">${t("con.pa.qui.vous")}</span> ${t("geo.e." + x.etape_vous)}</p>` : ""}
      ${x.mesure_due ? `<p class="fort" data-geo-af-mesure><span class="pastille">${t("con.pa.qui.robot")}</span> ${t("con.geo.af.mesure", { d: jour(x.prochaine_mesure_le) })}</p>` : ""}
      ${(x.codes_attendus || []).length ? `<p class="note">${t("con.geo.af.codes", { l: I.liste(x.codes_attendus.map(k => t("geo.pf." + k))) })}</p>` : ""}
      ${x.derniere_erreur ? `<p class="note">${t("con.geo.af.erreur", { e: e(ph(x.derniere_erreur)) })}</p>` : ""}
      <div class="actions"><a class="bouton second petit" href="#/client/${encodeURIComponent(x.commerce_id)}/geo" data-geo-ouvrir-fiche>${t("con.geo.af.ouvrir")}</a></div></article>`;

  // ---------------- Gestes. ctx : { cid, dossier, D, faire(bouton, fonction, message), msg }. faire() redessine la fiche et écrit le message près du bouton.
  function brancher(vue, ctx) {
    const { D, faire } = ctx, d = ctx.dossier, z = vue.querySelector("#client-geo"); if (!z) return;
    const sur = (sel, f) => z.querySelectorAll(sel).forEach(b => { b[b.tagName === "SELECT" || b.type === "checkbox" ? "onchange" : "onclick"] = () => f(b); });
    sur("[data-geo-ouvrir]", b => faire(b, () => D.adminGeoOuvrir(ctx.cid), t("con.geo.ouvert")));
    if (!d) return;
    const questions = () => [...z.querySelectorAll("[data-geo-q]")].map(i => i.value.trim()).filter(Boolean);
    sur("[data-geo-cocher]", b => { const k = b.dataset.geoCocher, n = z.querySelector(`[data-geo-note="${k}"]`);
      if (k === "rapport" && b.checked && !window.confirm(t("con.geo.rapport.confirmer"))) { b.checked = false; return; }
      faire(b, () => D.adminGeoEtape(d.id, k, b.checked, n ? n.value : null), r => t(r && r.livre_le && k === "rapport" ? "con.geo.livre.ok" : b.checked ? "con.geo.coche" : "con.geo.decoche", { x: t("geo.e." + k), d: r && r.prochaine_mesure_le ? jour(r.prochaine_mesure_le) : "" })); });
    sur("[data-geo-q-enregistrer]", b => faire(b, () => D.adminGeoQuestions(d.id, questions(), false), t("con.geo.q.ok")));
    sur("[data-geo-q-valider]", b => faire(b, () => { const q = questions(); if (q.length !== 10) throw new Error(t("con.geo.q.dix", { n: q.length })); return D.adminGeoQuestions(d.id, q, true); },
      r => t("con.geo.q.valide.ok", { d: jour(r && r.livraison_prevue_le) })));
    sur("[data-geo-demander]", b => faire(b, () => D.adminGeoDemander(d.id, b.dataset.geoDemander), r => t(r && r.webhook === false ? "con.geo.d.ok.sans" : "con.geo.d.ok." + b.dataset.geoDemander)));
    sur("[data-geo-bing]", s => faire(s, () => D.adminGeoBing(d.id, s.value, (z.querySelector("#geo-bing-note") || {}).value || null), t("con.geo.bing.ok", { e: t("con.geo.bing.e." + s.value) })));
    sur("[data-geo-pf]", s => faire(s, () => D.adminGeoPlateforme(d.id, s.dataset.geoPf, s.value, null), r => t("con.geo.pf.ok", { p: t("geo.pf." + s.dataset.geoPf), e: t("geo.pf.etat." + s.value) })));
    const f = z.querySelector("#f-geo-ref"); if (f) f.onsubmit = ev => { ev.preventDefault(); faire(ev.submitter || f.querySelector("[type=submit]"), () => D.adminGeoReference(d.id, lireReference(f)), t("con.geo.ref.ok")); };
    sur("[data-geo-rapport]", async b => { b.disabled = true;
      try { const h = await D.adminGeoRapport(b.dataset.geoRapport); if (!h) throw new Error(t("con.geo.m.sans.rapport"));
        const u = URL.createObjectURL(new Blob([h], { type: "text/html;charset=utf-8" })), a = document.createElement("a"); a.href = u; a.target = "_blank"; a.rel = "noopener";
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); }
      catch (er) { ctx.msg(ph(er.message)); } finally { b.disabled = false; } });
    sur("[data-geo-copier]", async b => { const x = z.querySelector("#" + b.dataset.geoCopier); try { await navigator.clipboard.writeText(x.value); ctx.msg(t("con.copiee")); } catch (er) { x.select(); ctx.msg(t("con.selectionnee")); } });
  }

  window.RENOM_GEO = { bloc, carte, aFaire, brancher, lireReference };
})();
