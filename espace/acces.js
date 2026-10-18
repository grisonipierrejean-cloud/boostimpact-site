// Accès par mot de passe (17/10/2026, décision de PJ) : avoir accès à la boîte mail ne suffit plus pour entrer dans l'espace ni dans la console.
// - Connexion = adresse email + mot de passe (signInWithPassword). Le lien magique n'est plus une façon d'entrer.
// - Toute session née d'un lien reçu par email (invitation, récupération, lien magique, code) n'ouvre QUE l'écran « Choisissez votre mot de passe ».
// - Critère : la revendication amr du jeton d'accès contient « password » (ou « totp », réservé à une double authentification future).
//   Format, lu dans le code source officiel de Supabase Auth (github.com/supabase/auth, commit ce9a8ee du 22/09/2026) :
//   internal/models/sessions.go, type AMREntry { Method string `json:"method"`; Timestamp int64 `json:"timestamp"`; Provider string `json:"provider,omitempty"` } ;
//   internal/tokens/service.go, AccessTokenClaims.AuthenticationMethodReference `json:"amr"` = liste d'AMREntry ; noms des méthodes :
//   internal/models/factor.go (« password », « otp », « totp », « recovery », « invite », « magiclink », « email/signup »…). Un lien d'email ouvert en flux
//   implicite (celui de l'espace) donne « otp » (internal/api/verify.go, issueRefreshToken(…, models.OTP, …)). Doc : supabase.com/docs/guides/auth/jwt-fields.
//   Le décodage accepte aussi une liste de chaînes (forme RFC 8176, acceptée par Supabase en entrée d'un « access token hook ») : même critère.
// - Le vrai verrou est dans la base (schema.sql, bloc « Mot de passe obligatoire (17/10/2026) », fonction session_par_mot_de_passe()) : l'interface
//   ne fait que suivre la même règle pour montrer le bon écran.
// Fonctions pures (décodage, critère, règles du mot de passe) testées sous Node : espace/test/acces.test.mjs.
(function (racine) {
  "use strict";
  const METHODES_FORTES = ["password", "totp"];
  const MIN = 10, MAX_OCTETS = 72;   // 72 : limite de bcrypt, refusée au-delà par Supabase Auth (internal/api/password.go, MaxPasswordLength, en octets)

  // Charge utile d'un jeton JWT (sans vérifier la signature : c'est la base qui la vérifie). null si le jeton est illisible.
  function decoderJwt(jeton) {
    try {
      const p = String(jeton || "").split(".");
      if (p.length !== 3 || !p[1]) return null;
      let b = p[1].replace(/-/g, "+").replace(/_/g, "/"); b += "===".slice((b.length + 3) % 4);
      const bin = typeof atob === "function" ? atob(b) : Buffer.from(b, "base64").toString("binary");
      const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
      return o && typeof o === "object" && !Array.isArray(o) ? o : null;
    } catch (e) { return null; }
  }
  // Méthodes d'authentification de la session : [{ method, timestamp }] (Supabase) ou ["password"] (RFC 8176).
  function methodes(charge) {
    const amr = charge && charge.amr;
    if (!Array.isArray(amr)) return [];
    return amr.map(x => typeof x === "string" ? x : x && typeof x === "object" && typeof x.method === "string" ? x.method : null).filter(Boolean);
  }
  const accesOuvert = charge => methodes(charge).some(m => METHODES_FORTES.includes(m));
  const accesDuJeton = jeton => accesOuvert(decoderJwt(jeton));

  // Règles du mot de passe : 10 caractères au moins, une lettre (a à z, comme le réglage « lettres et chiffres » de Supabase, qui ne compte pas
  // les lettres accentuées), un chiffre, 72 octets au plus. Les mêmes règles sont à régler dans Supabase (ordres/BRANCHEMENT.md, étape 70).
  const octets = s => new TextEncoder().encode(s).length;
  function controlerMotDePasse(mdp) {
    const s = String(mdp == null ? "" : mdp);
    const r = { longueur: Array.from(s).length >= MIN, lettre: /[A-Za-z]/.test(s), chiffre: /[0-9]/.test(s), taille: octets(s) <= MAX_OCTETS };
    r.ok = r.longueur && r.lettre && r.chiffre && r.taille;
    return r;
  }
  // Retour d'un lien d'email : fragment « #access_token=…&type=invite » ou « #error=…&error_code=otp_expired ».
  function lienRecu(hash) {
    try {
      const q = new URLSearchParams(String(hash || "").replace(/^#/, ""));
      return { type: q.get("type") || null, erreur: q.get("error_code") || q.get("error") || null };
    } catch (e) { return { type: null, erreur: null }; }
  }

  const A = { METHODES_FORTES, MIN, MAX_OCTETS, decoderJwt, methodes, accesOuvert, accesDuJeton, controlerMotDePasse, lienRecu };
  if (typeof module === "object" && module.exports) module.exports = A;
  if (!racine || !racine.document) return;

  // ---------------------------------------------------------------- Écrans (espace et console)
  // Lu AVANT que la bibliothèque Supabase ne lise puis n'efface le fragment (ce fichier est chargé avant donnees.js).
  A.lien = lienRecu(racine.location.hash);
  const $ = id => document.getElementById(id);
  const e = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tete = I => `<div class="connexion-tete"><p class="logo" translate="no">boostimpact<span class="logo-point">.</span><span class="logo-suffixe">agency</span></p>${I.selecteur()}</div>`;
  const EMAIL = /^[^\s@]+@[^\s@]+$/;   // contrôle léger : Supabase valide l'adresse ; les adresses de démonstration n'ont pas de point dans le domaine
  const texteErreur = (I, er) => er && er.code && I.a("acc.err." + er.code) ? I.t("acc.err." + er.code) : I.phrase(er && er.message || "");
  const message = x => { const m = $("msg"); if (m) m.textContent = x; };
  const voir = (case_, champs) => { case_.onchange = () => champs.forEach(c => { if (c) c.type = case_.checked ? "text" : "password"; }); };
  // Fragment d'erreur lu une fois : retiré de l'adresse (rien d'autre n'est touché).
  function oublierErreurLien() {
    if (!A.lien || !A.lien.erreur) return;
    A.lien.erreur = null;
    try { const u = new URL(location.href); u.hash = ""; history.replaceState(null, "", u.href); } catch (x) {}
  }

  // Connexion. o : { vue, I, D, titre, chapo, extra (HTML sous le formulaire, démonstration), pied (HTML après la carte), apres() : après l'entrée }.
  // mode « mdp » (adresse + mot de passe) ou « lien » (recevoir un lien pour choisir son mot de passe : première connexion, oubli).
  function connexion(o, mode, email) {
    const { vue, I, D } = o, t = I.t, erreurLien = !!(A.lien && A.lien.erreur);
    if (erreurLien) mode = "lien";
    const lien = mode === "lien";
    vue.innerHTML = `<div class="connexion"><div class="carte">${tete(I)}
      <div class="entete"><h1>${lien ? t("acc.lien.titre") : o.titre}</h1><p class="chapo">${lien ? t("acc.lien.chapo") : o.chapo}</p></div>
      <form id="f" novalidate data-acces="${lien ? "lien" : "mdp"}"><div class="f"><label for="email">${t("cx.email")}</label><input id="email" name="email" type="email" autocomplete="${lien ? "email" : "username"}" required value="${e(email || "")}"></div>
      ${lien ? "" : `<div class="f"><label for="mdp">${t("acc.mdp")}</label><input id="mdp" name="mdp" type="password" autocomplete="current-password" required></div>
      <label class="option"><input type="checkbox" id="voir-mdp"><span>${t("acc.afficher")}</span></label>`}
      <button class="bouton plein" type="submit">${t(lien ? "cx.recevoir" : "acc.entrer")}</button><p class="msg" id="msg" role="status"></p></form>
      <p class="acces-bascule"><button type="button" class="lien" id="bascule">${t(lien ? "acc.retour.connexion" : "acc.oubli")}</button></p>
      ${lien ? "" : o.extra || ""}</div>${o.pied || ""}</div>`;
    if (erreurLien) { message(t("acc.err.lien")); oublierErreurLien(); }
    if (!lien) voir($("voir-mdp"), [$("mdp")]);
    $("bascule").onclick = () => { connexion(o, lien ? "mdp" : "lien", $("email").value.trim()); const c = $("email"); if (c) c.focus(); };
    const bouton = $("f").querySelector("button[type=submit]");
    $("f").onsubmit = async ev => {
      ev.preventDefault();
      const adr = $("email").value.trim();
      if (lien) {
        if (!EMAIL.test(adr)) { message(t("acc.err.email")); $("email").focus(); return; }
        bouton.disabled = true; message(t("envoi.en.cours"));
        try {
          const r = await D.demanderLienMotDePasse(adr);
          // Démonstration : aucun email ne part ; le lien s'ouvre ici.
          if (D.mode === "demo" && r && r.lien) {
            $("msg").innerHTML = `${t("cx.lien.pret")} <button type="button" class="lien" id="ouvrir">${t("cx.ouvrir.lien")}</button>`;
            $("ouvrir").onclick = async () => { await D.ouvrirLienMotDePasse(r.lien); await o.apres(); };
          } else message(t("acc.lien.envoye"));   // même message que l'adresse ait un compte ou non
        } catch (er) { message(texteErreur(I, er)); }
        bouton.disabled = false;
        return;
      }
      const mdp = $("mdp").value;
      if (!adr || !mdp) { message(t("acc.err.champs")); (adr ? $("mdp") : $("email")).focus(); return; }
      bouton.disabled = true; message(t("acc.connexion.en.cours"));
      try { await D.connecter(adr, mdp); await o.apres(); }
      catch (er) { message(texteErreur(I, er)); bouton.disabled = false; const c = $("mdp"); if (c) { c.value = ""; c.focus(); } }
    };
  }

  // Choix du mot de passe (session née d'un lien d'email). o : { vue, I, D, email, apres() : après l'entrée, annuler() : déconnexion }.
  function choixMotDePasse(o) {
    const { vue, I, D } = o, t = I.t;
    const regle = (k, cache) => `<li data-regle="${k}" data-ok="0"${cache ? " hidden" : ""}><span class="vh" data-etat>${t("acc.regle.afaire")}, </span>${t("acc.regle." + k)}</li>`;
    vue.innerHTML = `<div class="connexion"><div class="carte">${tete(I)}
      <div class="entete"><h1>${t("acc.choix.titre")}</h1><p class="chapo">${t("acc.choix.chapo")}</p></div>
      <form id="f-mdp" novalidate>
        <input type="email" class="vh" name="username" autocomplete="username" value="${e(o.email || "")}" readonly tabindex="-1" aria-hidden="true">
        <p class="note">${t("acc.choix.compte", { email: `<span class="casse">${e(o.email || "")}</span>` })}</p>
        <div class="f"><label for="mdp1">${t("acc.choix.nouveau")}</label><input id="mdp1" name="nouveau" type="password" autocomplete="new-password" required aria-describedby="regles"></div>
        <ul class="regles" id="regles">${regle("longueur")}${regle("lettre")}${regle("chiffre")}${regle("taille", true)}</ul>
        <div class="f"><label for="mdp2">${t("acc.choix.confirmer")}</label><input id="mdp2" name="confirmation" type="password" autocomplete="new-password" required aria-describedby="regle-identiques"></div>
        <ul class="regles"><li id="regle-identiques" data-regle="identiques" data-ok="0"><span class="vh" data-etat>${t("acc.regle.afaire")}, </span>${t("acc.regle.identiques")}</li></ul>
        <label class="option"><input type="checkbox" id="voir-mdp"><span>${t("acc.afficher")}</span></label>
        <button class="bouton plein" type="submit">${t("acc.choix.enregistrer")}</button><p class="msg" id="msg" role="status"></p></form>
      ${D.mode === "demo" ? `<p class="note">${t("acc.demo.mdp")}</p>` : ""}
      <p class="acces-bascule"><button type="button" class="lien" id="annuler-mdp">${t("acc.choix.annuler")}</button></p></div></div>`;
    const m1 = $("mdp1"), m2 = $("mdp2"), bouton = $("f-mdp").querySelector("button[type=submit]");
    const poser = (li, ok) => { li.dataset.ok = ok ? "1" : "0"; li.querySelector("[data-etat]").textContent = t(ok ? "acc.regle.fait" : "acc.regle.afaire") + ", "; };
    const maj = () => {
      const r = controlerMotDePasse(m1.value);
      document.querySelectorAll("#regles [data-regle]").forEach(li => poser(li, r[li.dataset.regle]));
      const taille = document.querySelector('#regles [data-regle="taille"]'); taille.hidden = r.taille;
      poser($("regle-identiques"), m2.value !== "" && m2.value === m1.value);
      return r;
    };
    m1.oninput = m2.oninput = () => { maj(); message(""); };   // un message d'erreur ne reste pas affiché pendant la correction
    voir($("voir-mdp"), [m1, m2]);
    $("annuler-mdp").onclick = () => o.annuler();
    $("f-mdp").onsubmit = async ev => {
      ev.preventDefault();
      const r = maj();
      if (!r.ok) { message(t("acc.err.regles")); m1.focus(); return; }
      if (m1.value !== m2.value) { message(t("acc.err.differents")); m2.focus(); return; }
      bouton.disabled = true; message(t("acc.choix.enregistrement"));
      try { await D.choisirMotDePasse(m1.value); message(t("acc.choix.enregistre")); await o.apres(); }
      catch (er) { message(texteErreur(I, er)); bouton.disabled = false; }
    };
    m1.focus();
  }

  A.connexion = connexion;
  A.choixMotDePasse = choixMotDePasse;
  racine.RENOM_ACCES = A;
})(typeof window !== "undefined" ? window : globalThis);
