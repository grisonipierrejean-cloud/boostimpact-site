// Espace client en application (15/11/2026, étape 1 : une PWA qui se comporte comme une app, base commune si l'espace est emballé plus tard
// avec Capacitor). Règles PURES, sans DOM ni réseau, lues par app.js et par les tests (espace/test/pwa.test.mjs) :
//   - quel téléphone (iPhone / iPad, Android, autre) et quelle version d'iOS ;
//   - l'espace est-il déjà installé (ouvert depuis son icône, mode « standalone ») ;
//   - quel guide d'installation montrer, et QUAND le montrer d'office (une fois, à la première connexion sur un téléphone) ;
//   - quand proposer les notifications : jamais d'office, toujours après un geste du client (bouton), et sur iPhone seulement quand l'espace est
//     installé sur l'écran d'accueil avec iOS 16.4 ou plus récent (Apple n'envoie les notifications web qu'aux applications installées) ;
//   - la clé publique VAPID (config.js, vapidPublic) convertie pour PushManager.subscribe.
// Rien ici n'appelle Notification.requestPermission ni PushManager : app.js le fait, au clic.
(function (racine) {
  // ---- Téléphone
  // iPadOS 13 et plus se présente comme un Mac (« Macintosh », platform MacIntel) : on le reconnaît à l'écran tactile.
  function plateforme(nav) {
    const n = nav || {}, ua = String(n.userAgent || "");
    if (/iPhone|iPad|iPod/.test(ua) || (n.platform === "MacIntel" && (n.maxTouchPoints || 0) > 1)) return "ios";
    if (/Android/i.test(ua)) return "android";
    return "autre";
  }
  // Version d'iOS lue dans « CPU iPhone OS 16_4 like Mac OS X » ; iPad en mode ordinateur : « Version/17.2 ». [majeure, mineure] ou null.
  function versionIos(ua) {
    const s = String(ua || ""), m = s.match(/(?:iPhone|CPU) OS (\d+)[_.](\d+)/) || s.match(/OS (\d+)_(\d+)(?:_\d+)? like Mac OS X/) || s.match(/Version\/(\d+)\.(\d+)/);
    return m ? [+m[1], +m[2]] : null;
  }
  const iosAuMoins = (v, maj, min) => !!v && (v[0] > maj || (v[0] === maj && v[1] >= min));
  // Sur iPhone, le guide parle de Safari : Chrome, Firefox, Edge et les navigateurs intégrés (Instagram, Facebook, Gmail, WhatsApp) n'offrent pas
  // tous « Sur l'écran d'accueil », ou pas au même endroit. Safari le fait toujours.
  const NAVIGATEURS_IOS_AUTRES = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|YaBrowser|DuckDuckGo|FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Line\/|MicroMessenger|WhatsApp|Snapchat|TikTok|musical_ly|Pinterest/;
  const safariIos = ua => !NAVIGATEURS_IOS_AUTRES.test(String(ua || "")) && /Safari\//.test(String(ua || ""));
  // Navigateur intégré d'une application Android (Instagram, Facebook… « ; wv) ») : pas d'installation possible, il faut ouvrir Chrome.
  const integreAndroid = ua => /; wv\)|FBAN|FBAV|Instagram|Line\//.test(String(ua || ""));

  // ---- Installée ?
  // Ouverte depuis l'icône de l'écran d'accueil : display-mode standalone (Android, iOS 16.4+, ordinateur) ou navigator.standalone (Safari iOS).
  const estInstallee = e => !!(e && (e.standalone === true || e.navigatorStandalone === true || e.fullscreen === true || e.minimalUi === true));
  // Lit l'environnement du navigateur (appelé par app.js ; les tests passent un objet tout fait).
  function environnement(w) {
    const win = w || (typeof window !== "undefined" ? window : {}), nav = win.navigator || {};
    const mm = q => { try { return !!(win.matchMedia && win.matchMedia(q).matches); } catch (e) { return false; } };
    return {
      userAgent: String(nav.userAgent || ""), platform: nav.platform || "", maxTouchPoints: nav.maxTouchPoints || 0,
      standalone: mm("(display-mode: standalone)"), fullscreen: mm("(display-mode: fullscreen)"), minimalUi: mm("(display-mode: minimal-ui)"), navigatorStandalone: nav.standalone === true,
      push: !!(nav.serviceWorker && "PushManager" in win), notification: "Notification" in win,
      permission: "Notification" in win ? win.Notification.permission : "absent",
      badge: typeof nav.setAppBadge === "function",
    };
  }

  // ---- Guide d'installation
  // Ce que l'écran « Installer l'application » montre :
  //   installee       : déjà installée (on le dit, plus de guide) ;
  //   ios_safari      : iPhone dans Safari : Partager, puis « Sur l'écran d'accueil », puis « Ajouter » ;
  //   ios_autre       : iPhone dans un autre navigateur ou une application : ouvrir la page dans Safari d'abord (bouton « Copier le lien ») ;
  //   android_bouton  : Android, le navigateur propose l'installation (beforeinstallprompt reçu) : un bouton « Installer » ;
  //   android_menu    : Android sans proposition (déjà refusée, navigateur sans support) : menu ⋮ puis « Installer l'application » ;
  //   android_autre   : Android dans le navigateur intégré d'une application : ouvrir dans Chrome ;
  //   ordinateur      : ni iPhone ni Android : ouvrir l'espace sur le téléphone (code QR).
  function etapeGuide(env, invitation) {
    const e = env || {};
    if (estInstallee(e)) return "installee";
    const p = plateforme(e);
    if (p === "ios") return safariIos(e.userAgent) ? "ios_safari" : "ios_autre";
    if (p === "android") return invitation ? "android_bouton" : integreAndroid(e.userAgent) ? "android_autre" : "android_menu";
    return invitation ? "android_bouton" : "ordinateur";
  }
  // Montré d'office une seule fois : sur un téléphone (iPhone ou Android), espace pas encore installé, client connecté, guide jamais vu sur cet
  // appareil, et seulement sur l'accueil (jamais par-dessus un lien précis : email « À valider », lien d'avis, démarrage en cours).
  function guideAMontrer(o) {
    const x = o || {};
    if (!x.connecte || x.dejaVu || x.route !== "accueil") return false;
    const p = plateforme(x.env || {});
    return (p === "ios" || p === "android") && !estInstallee(x.env || {});
  }

  // ---- Notifications
  // État du bloc « Notifications sur ce téléphone » :
  //   indisponible     : pas de clé publique VAPID dans config.js (notifications pas encore branchées) : bloc caché ;
  //   ios_ancien       : iPhone sous iOS 16.4 : pas de notifications web, on dit de mettre l'iPhone à jour ;
  //   installer_dabord : iPhone pas encore installé sur l'écran d'accueil : on renvoie au guide (Apple l'exige) ;
  //   non_supporte     : navigateur sans Push API ;
  //   refusee          : le client a bloqué les notifications dans les réglages du téléphone : on dit où les rouvrir ;
  //   actif            : abonnement enregistré sur ce téléphone : bouton « Arrêter » ;
  //   proposer         : tout est prêt : bouton « Recevoir les notifications » (la demande d'autorisation part AU CLIC, jamais avant).
  function etatNotifications(o) {
    const x = o || {}, e = x.env || {}, p = plateforme(e);
    if (!cleVapidValide(x.vapid)) return "indisponible";
    if (p === "ios") {
      const v = versionIos(e.userAgent);
      if (v && !iosAuMoins(v, 16, 4)) return "ios_ancien";
      if (!estInstallee(e)) return "installer_dabord";
    }
    if (!e.push || !e.notification) return "non_supporte";
    if (e.permission === "denied") return "refusee";
    if (x.abonne) return "actif";
    return "proposer";
  }
  // La demande d'autorisation n'est permise que dans le geste du client (clic sur le bouton) et seulement dans l'état « proposer ».
  const peutDemander = (etat, geste) => etat === "proposer" && geste === true;

  // ---- Clé VAPID : clé PUBLIQUE P-256 non compressée, 65 octets (0x04 puis X et Y), en base64url sans remplissage (87 caractères).
  // Une clé privée (32 octets, 43 caractères) est refusée : elle ne doit jamais se trouver dans l'espace.
  function octetsBase64Url(s) {
    const b = String(s || "").replace(/-/g, "+").replace(/_/g, "/"), p = b + "===".slice((b.length + 3) % 4);
    if (!/^[A-Za-z0-9+/]*=*$/.test(p)) return null;
    let bin; try { bin = typeof atob === "function" ? atob(p) : Buffer.from(p, "base64").toString("binary"); } catch (e) { return null; }
    const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u;
  }
  function cleVapidValide(s) {
    if (typeof s !== "string" || !/^[A-Za-z0-9_-]{87}$/.test(s)) return false;
    const u = octetsBase64Url(s); return !!u && u.length === 65 && u[0] === 4;
  }
  const cleVapidOctets = s => cleVapidValide(s) ? octetsBase64Url(s) : null;
  // Abonnement prêt pour la base (enregistrer_abonnement_push) : adresse https du service de push et ses deux clés, rien d'autre.
  function abonnementPourBase(sub) {
    const j = sub && typeof sub.toJSON === "function" ? sub.toJSON() : sub || {}, k = j.keys || {};
    if (!/^https:\/\/[^\s]+$/.test(String(j.endpoint || "")) || !k.p256dh || !k.auth) return null;
    return { endpoint: j.endpoint, p256dh: k.p256dh, auth: k.auth };
  }

  // ---- Pastille de l'icône (nombre de contenus à valider) : un entier positif, ou 0 pour l'effacer.
  const pastille = n => { const v = Math.floor(Number(n)); return Number.isFinite(v) && v > 0 ? Math.min(v, 99) : 0; };

  const API = { plateforme, versionIos, iosAuMoins, safariIos, integreAndroid, estInstallee, environnement, etapeGuide, guideAMontrer, etatNotifications, peutDemander,
    cleVapidValide, cleVapidOctets, abonnementPourBase, pastille, CLE_GUIDE_VU: "renom-guide-app-vu" };
  if (typeof module === "object" && module.exports) module.exports = API;
  else racine.RENOM_PWA = API;
})(typeof self !== "undefined" ? self : this);
