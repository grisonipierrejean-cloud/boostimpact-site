// Accès par mot de passe (17/10/2026, décision de PJ) : avoir accès à la boîte mail ne suffit plus pour entrer dans l'espace ni dans la console.
// - Connexion = adresse email + mot de passe (signInWithPassword). Le lien magique n'est plus une façon d'entrer.
// - Toute session née d'un lien reçu par email (invitation, récupération, lien magique, code) n'ouvre QUE l'écran « Choisissez votre mot de passe ».
// - Critère : la revendication amr du jeton d'accès contient « password » (ou « totp » : double authentification de l'administrateur, exigée
//   du 18/10/2026 au 22/10/2026 en plus de « password », retirée depuis et gardée derrière DOUBLE_AUTH_ADMIN : voir plus bas).
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
  const MIN = 8, MAX_OCTETS = 72;    // 72 : limite de bcrypt, refusée au-delà par Supabase Auth (internal/api/password.go, MaxPasswordLength, en octets)

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

  // Règles du mot de passe (8 caractères au moins depuis le 18/10/2026, décision de PJ ; 10 avant) : 8 caractères au moins, une lettre (a à z, comme le réglage « lettres et chiffres » de Supabase, qui ne compte pas
  // les lettres accentuées), un chiffre, 72 octets au plus. Les mêmes règles sont à régler dans Supabase (ordres/BRANCHEMENT.md, étape 70).
  const octets = s => new TextEncoder().encode(s).length;
  function controlerMotDePasse(mdp) {
    const s = String(mdp == null ? "" : mdp);
    const r = { longueur: Array.from(s).length >= MIN, lettre: /[A-Za-z]/.test(s), chiffre: /[0-9]/.test(s), taille: octets(s) <= MAX_OCTETS };
    r.ok = r.longueur && r.lettre && r.chiffre && r.taille;
    return r;
  }
  // Retour d'un lien d'email À L'ANCIEN FORMAT (emails partis avant le 26/10/2026) : fragment « #access_token=…&type=invite » ou
  // « #error=…&error_code=otp_expired ».
  function lienRecu(hash) {
    try {
      const q = new URLSearchParams(String(hash || "").replace(/^#/, ""));
      return { type: q.get("type") || null, erreur: q.get("error_code") || q.get("error") || null };
    } catch (e) { return { type: null, erreur: null }; }
  }
  // Lien d'email AU NOUVEAU FORMAT (26/10/2026, moteur/courriels/supabase.js) : « ?jeton=<hash du jeton>&type=invite|recovery|email ». L'ouvrir
  // ne consomme rien (un robot de messagerie qui pré-ouvre les liens ne peut plus le « griller ») : le jeton n'est vérifié qu'au clic de la
  // personne, par supabase.auth.verifyOtp({ token_hash, type }). Types acceptés : ceux de verifyOtp pour un lien d'email (EmailOtpType de
  // supabase-js, hors email_change). Rend { token_hash, type }, { invalide: true } (adresse abîmée : traité comme un lien expiré) ou null.
  const TYPES_LIEN = ["invite", "recovery", "email", "magiclink", "signup"];
  function jetonRecu(search) {
    try {
      const q = new URLSearchParams(String(search || "").replace(/^\?/, ""));
      if (!q.has("jeton")) return null;
      const j = q.get("jeton") || "", type = q.get("type") || "";
      return /^[A-Za-z0-9_-]{8,256}$/.test(j) && TYPES_LIEN.includes(type) ? { token_hash: j, type } : { invalide: true };
    } catch (e) { return null; }
  }
  // Adresse sans « jeton » ni « type » (le reste de la requête et le fragment sont gardés).
  function sansJeton(href) {
    try { const u = new URL(href); u.searchParams.delete("jeton"); u.searchParams.delete("type"); return u.href; } catch (e) { return href; }
  }

  // ---------------------------------------------------------------- Double authentification de l'administrateur (18/10/2026, décision de PJ)
  // Console seulement : code TOTP à 6 chiffres (Google Authenticator ou équivalent), facteur « totp » de Supabase Auth MFA. Les commerçants : mot
  // de passe seul, rien ne change pour eux. Critère, le même que la base (schema.sql, bloc « Double authentification de l'administrateur
  // (18/10/2026) », session_double_authentification()) : aal = « aal2 » ET amr contient « password » ET « totp ». Un lien d'email suivi d'un
  // code donnerait aussi aal2 (amr « totp » + « otp ») : refusé, le mot de passe reste exigé.
  // Sources, code de Supabase Auth (github.com/supabase/auth, commit ce9a8ee du 22/09/2026) : internal/models/sessions.go, CalculateAALAndAMR
  // (amr = toutes les méthodes de la session, la plus récente en tête ; aal2 dès qu'une méthode MFA y figure, internal/models/amr.go, IsAAL2Claim) ;
  // internal/api/token.go, updateMFASessionAndClaims (le code vérifié AJOUTE « totp » à la session ouverte par mot de passe) ; revendication
  // « aal » : internal/tokens/service.go. Doc : supabase.com/docs/guides/auth/auth-mfa (exemple amr [{totp}, {password}], la plus récente en tête).
  // INTERRUPTEUR (22/10/2026, décision de PJ : « enlève la double authentification pour l'instant » ; le compte de la console est partagé par
  // deux personnes) : false = la console s'ouvre à l'adresse + mot de passe seuls, comme avant le 18/10/2026 ; aucun écran d'activation ni de code.
  // Risque accepté : le mot de passe partagé suffit à ouvrir toutes les données de la console. Pour REMETTRE le code : passer à true ET recoller
  // dans l'éditeur SQL le bloc « Double authentification de l'administrateur (18/10/2026) » de schema.sql APRÈS le bloc « Administrateur sans
  // double authentification (22/10/2026) » (ordres/BRANCHEMENT.md, étape 81). L'un sans l'autre : console fermée (base) ou code décoratif (écran).
  const DOUBLE_AUTH_ADMIN = false;
  const forteAdmin = charge => { const m = methodes(charge); return !!charge && charge.aal === "aal2" && m.includes("password") && m.includes("totp"); };
  // Étape de la console pour un administrateur dont la session porte « password » ou « totp » : « ok » (console ouverte), « code » (facteur
  // déjà activé : code de l'application), « activer » (aucun facteur : QR code), « mot_de_passe » (session née d'un lien + code : choisir le mot de passe).
  // exiger : la double authentification est-elle demandée (DOUBLE_AUTH_ADMIN par défaut) ? Sans elle, le mot de passe suffit : « ok ».
  function etapeAdmin(charge, facteurVerifie, exiger = DOUBLE_AUTH_ADMIN) {
    if (!methodes(charge).includes("password")) return "mot_de_passe";
    if (!exiger || forteAdmin(charge)) return "ok";
    return facteurVerifie ? "code" : "activer";
  }
  // Facteur TOTP vérifié sur le compte (user.factors de Supabase Auth : { factor_type, status }).
  const facteurTotpVerifie = user => !!(user && Array.isArray(user.factors) && user.factors.some(f => f && f.factor_type === "totp" && f.status === "verified"));
  // Saisie du code : espaces et tirets retirés (« 123 456 »), 6 chiffres exactement.
  const codeSaisi = s => String(s == null ? "" : s).replace(/[\s-]/g, "");
  const codeValide = s => /^[0-9]{6}$/.test(codeSaisi(s));
  // Clé affichée par groupes de 4 caractères (plus sûre à recopier dans l'application).
  const cleGroupee = s => String(s || "").replace(/\s/g, "").replace(/(.{4})(?=.)/g, "$1 ");
  // TOTP de la RFC 6238 (HMAC-SHA1, pas de 30 s, 6 chiffres : réglages de Supabase Auth, bibliothèque pquerna/otp, totp.Generate par défaut dans
  // internal/api/mfa.go) : SEULEMENT pour la démonstration, qui n'a pas de serveur. En service, Supabase Auth vérifie le code.
  const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const base32 = o => { let b = "", s = ""; for (const x of o) b += x.toString(2).padStart(8, "0"); for (let i = 0; i < b.length; i += 5) s += B32[parseInt(b.slice(i, i + 5).padEnd(5, "0"), 2)]; return s; };
  function debase32(s) {
    const b = [...String(s || "").toUpperCase().replace(/[\s=]/g, "")].map(c => { const i = B32.indexOf(c); if (i < 0) throw new Error("clé illisible"); return i.toString(2).padStart(5, "0"); }).join("");
    return Uint8Array.from({ length: Math.floor(b.length / 8) }, (_, i) => parseInt(b.slice(i * 8, i * 8 + 8), 2));
  }
  async function totp(secret, ms = Date.now()) {
    const cle = await crypto.subtle.importKey("raw", debase32(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    let c = Math.floor(ms / 30000); const m = new Uint8Array(8); for (let i = 7; i >= 0; i--) { m[i] = c % 256; c = Math.floor(c / 256); }
    const h = new Uint8Array(await crypto.subtle.sign("HMAC", cle, m)), o = h[h.length - 1] & 15;
    return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, "0");
  }
  // Code accepté s'il est celui de la période en cours, de la précédente ou de la suivante (décalage d'horloge du téléphone).
  async function verifierTotp(secret, code, ms = Date.now()) {
    if (!codeValide(code)) return false;
    for (const d of [0, -1, 1]) if (await totp(secret, ms + d * 30000) === codeSaisi(code)) return true;
    return false;
  }
  const secretTotp = () => base32(crypto.getRandomValues(new Uint8Array(20)));
  const uriTotp = (secret, compte, emetteur) => `otpauth://totp/${encodeURIComponent(emetteur)}:${encodeURIComponent(compte)}?algorithm=SHA1&digits=6&issuer=${encodeURIComponent(emetteur)}&period=30&secret=${secret}`;

  const A = { DOUBLE_AUTH_ADMIN, METHODES_FORTES, MIN, MAX_OCTETS, decoderJwt, methodes, accesOuvert, accesDuJeton, controlerMotDePasse, lienRecu, jetonRecu, sansJeton, TYPES_LIEN,
    forteAdmin, etapeAdmin, facteurTotpVerifie, codeSaisi, codeValide, cleGroupee, base32, debase32, totp, verifierTotp, secretTotp, uriTotp };
  if (typeof module === "object" && module.exports) module.exports = A;
  if (!racine || !racine.document) return;

  // ---------------------------------------------------------------- Écrans (espace et console)
  // Lu AVANT que la bibliothèque Supabase ne lise puis n'efface le fragment (ce fichier est chargé avant donnees.js).
  A.lien = lienRecu(racine.location.hash);
  A.jeton = jetonRecu(racine.location.search);
  const $ = id => document.getElementById(id);
  const e = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tete = I => `<div class="connexion-tete"><p class="logo" translate="no"><img class="logo-img" src="icones/logo-ligne-encre.png?v=pascal" width="482" height="80" alt="boost impact."></p>${I.selecteur()}</div>`;
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

  // Lien d'email au nouveau format (?jeton=…&type=…, 26/10/2026) : un écran, UN bouton ; le jeton n'est vérifié qu'au clic (D.verifierLien,
  // verifyOtp), puis o.apres() (l'espace montre alors « Choisissez votre mot de passe » : la session née du lien n'a pas « password »).
  // Lien expiré, déjà servi ou abîmé : o.echec() (écran de connexion en mode « recevoir un nouveau lien », message acc.err.lien). Réseau coupé :
  // le message, et le bouton reste là (le jeton n'a pas servi). L'adresse est nettoyée dès que le jeton a été présenté à Supabase.
  // o : { vue, I, D, apres(), echec() }.
  function oublierJeton() { A.jeton = null; try { history.replaceState(null, "", sansJeton(location.href)); } catch (x) {} }
  function lienEmail(o) {
    const { vue, I, D } = o, t = I.t, j = A.jeton;
    const perdu = () => { oublierJeton(); A.lien = { type: null, erreur: "lien" }; return o.echec(); };
    if (!j || j.invalide) return perdu();
    const invite = j.type === "invite";
    vue.innerHTML = `<div class="connexion"><div class="carte" id="lien-email" data-type="${e(j.type)}">${tete(I)}
      <div class="entete"><h1>${t(invite ? "acc.jeton.titre.invite" : "acc.jeton.titre")}</h1><p class="chapo">${t(invite ? "acc.jeton.chapo.invite" : "acc.jeton.chapo")}</p></div>
      <button class="bouton plein" type="button" id="jeton-ok">${t("acc.jeton.bouton")}</button><p class="msg" id="msg" role="status"></p></div></div>`;
    const b = $("jeton-ok");
    b.onclick = async () => {
      b.disabled = true; message(t("acc.jeton.verification"));
      try { await D.verifierLien(j.token_hash, j.type); }
      catch (er) {
        if (er && er.code === "service") { message(texteErreur(I, er)); b.disabled = false; return; }   // réseau : le jeton n'a pas servi, on peut réessayer
        return perdu();
      }
      oublierJeton(); await o.apres();
    };
    b.focus();
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

  // Double authentification de l'administrateur (console seulement ; montrée seulement si DOUBLE_AUTH_ADMIN, ou si Supabase exige le code :
  // lien d'email d'un compte qui a encore un facteur, voir console.js). o : { vue, I, D, mode (« activer » ou « code »), email, apres() : après le
  // code accepté, annuler() : déconnexion }. « activer » : QR code rendu par Supabase (enroll, image SVG en adresse data:, aucune bibliothèque),
  // clé en texte, puis le premier code ; « code » : le code du moment. La base n'ouvre rien à l'administrateur sans ce code (est_admin()).
  function doubleAuthentification(o) {
    const { vue, I, D } = o, t = I.t, activer = o.mode === "activer";
    vue.innerHTML = `<div class="connexion"><div class="carte">${tete(I)}
      <div class="entete"><h1>${t(activer ? "acc.2fa.activer.titre" : "acc.2fa.code.titre")}</h1><p class="chapo">${t(activer ? "acc.2fa.activer.chapo" : "acc.2fa.code.chapo")}</p></div>
      ${activer ? `<ol class="etapes-2fa"><li>${t("acc.2fa.etape.app")}</li><li>${t("acc.2fa.etape.scanner")}</li><li>${t("acc.2fa.etape.code")}</li></ol>
        <div class="qr-2fa" id="qr-2fa" hidden><img id="qr-2fa-img" alt="${e(t("acc.2fa.qr.alt"))}" width="200" height="200"></div>
        <div class="pile serre"><p class="note" id="cle-2fa-lib">${t("acc.2fa.cle")}</p><p class="cle-2fa" id="cle-2fa" translate="no" aria-labelledby="cle-2fa-lib"></p></div>` : ""}
      <form id="f-2fa" novalidate data-2fa="${activer ? "activer" : "code"}" aria-busy="true">
        <p class="note">${t("acc.choix.compte", { email: `<span class="casse">${e(o.email || "")}</span>` })}</p>
        <div class="f"><label for="code-2fa">${t("acc.2fa.code.lib")}</label><input id="code-2fa" class="code-2fa" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="7" spellcheck="false" autocapitalize="off" required aria-describedby="aide-2fa"></div>
        <p class="note" id="aide-2fa">${t("acc.2fa.code.aide")}</p>
        <button class="bouton plein" type="submit" disabled>${t("acc.2fa.verifier")}</button><p class="msg" id="msg" role="status"></p></form>
      ${D.mode === "demo" ? `<p class="note" id="demo-2fa"></p>` : ""}
      ${activer ? "" : `<p class="note">${t("acc.2fa.perdu")}</p>`}
      <p class="acces-bascule"><button type="button" class="lien" id="annuler-2fa">${t("quitter")}</button></p></div></div>`;
    const champ = $("code-2fa"), f = $("f-2fa"), bouton = f.querySelector("button[type=submit]");
    let facteur = null;
    $("annuler-2fa").onclick = () => o.annuler();
    champ.oninput = () => message("");
    // Démonstration : le code du moment est affiché (aucune application nécessaire ; une application réelle marche aussi avec la clé affichée).
    const demo = $("demo-2fa");
    const majDemo = async () => { if (!demo || !document.body.contains(demo)) return false; const c = D.codeDemo && await D.codeDemo(); demo.textContent = c ? t("acc.2fa.demo", { code: c.slice(0, 3) + " " + c.slice(3) }) : ""; return true; };
    (async () => {
      try {
        const p = await D.doubleAuthPreparer(o.mode);
        if (p.mode && p.mode !== o.mode) return doubleAuthentification({ ...o, mode: p.mode });   // l'état a changé (facteur retiré ou déjà activé)
        facteur = p.factorId;
        if (activer) { if (p.qr) { $("qr-2fa-img").src = p.qr; $("qr-2fa").hidden = false; } $("cle-2fa").textContent = cleGroupee(p.secret); }
        bouton.disabled = false; f.removeAttribute("aria-busy"); champ.focus();
        if (demo && await majDemo()) { const h = setInterval(async () => { if (!await majDemo()) clearInterval(h); }, 2000); }
      } catch (er) { message(texteErreur(I, er)); }
    })();
    f.onsubmit = async ev => {
      ev.preventDefault();
      if (!facteur) return;
      if (!codeValide(champ.value)) { message(t("acc.err.format")); champ.focus(); return; }
      bouton.disabled = true; message(t("acc.2fa.verification"));
      try { await D.doubleAuthVerifier(facteur, codeSaisi(champ.value)); message(t("acc.2fa.accepte")); await o.apres(); }
      catch (er) { message(texteErreur(I, er)); bouton.disabled = false; champ.value = ""; champ.focus(); }
    };
  }

  A.connexion = connexion;
  A.lienEmail = lienEmail;
  A.choixMotDePasse = choixMotDePasse;
  A.doubleAuthentification = doubleAuthentification;
  racine.RENOM_ACCES = A;
})(typeof window !== "undefined" ? window : globalThis);
