// Rapport d'audit en ligne (26/10/2026) : https://boostimpact.agency/audit/?r=<uuid v4>. Le rapport HTML est déposé par le moteur
// (moteur/audit/audit_places.py, publier_rapport) dans le seau PUBLIC « rapports » de Supabase, sous <uuid>.html ; Supabase le sert en text/plain
// (voulu) : il est affiché dans une iframe srcdoc sandbox, SANS allow-scripts ni allow-same-origin (aucun script ne s'exécute dans le rapport).
// Projet Supabase : le même que l'espace client (outils/deployer_boostimpact.sh, --supabase-url).
(function () {
  'use strict';
  var STOCKAGE = 'https://ydojahvxzgprlzigumjn.supabase.co/storage/v1/object/public/rapports/';
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  var TEXTES = {
    fr: {attente: 'Ouverture de votre audit…', titre: 'Votre audit, BoostImpact', absent: 'Cet audit n’est plus en ligne.',
         texte: 'Le lien est peut-être incomplet, ou l’audit a été retiré. Vous pouvez demander un nouvel audit, gratuit.',
         lien: 'Demander un audit gratuit', url: 'https://boostimpact.agency/#audit'},
    en: {attente: 'Opening your audit…', titre: 'Your audit, BoostImpact', absent: 'This audit is no longer online.',
         texte: 'The link may be incomplete, or the audit has been removed. You can request a new audit, free of charge.',
         lien: 'Request a free audit', url: 'https://boostimpact.agency/en/#audit'},
    nl: {attente: 'Uw audit wordt geopend…', titre: 'Uw audit, BoostImpact', absent: 'Deze audit staat niet meer online.',
         texte: 'De link is misschien onvolledig, of de audit werd verwijderd. U kunt gratis een nieuwe audit aanvragen.',
         lien: 'Een gratis audit aanvragen', url: 'https://boostimpact.agency/nl/#audit'}
  };
  function langue(code) {
    var c = String(code || '').toLowerCase().slice(0, 2);
    return TEXTES[c] ? c : 'fr';
  }
  var nav = langue((navigator.languages && navigator.languages[0]) || navigator.language);
  var el = function (id) { return document.getElementById(id); };
  el('attente').textContent = TEXTES[nav].attente;

  function absent() {
    var T = TEXTES[nav];
    document.documentElement.lang = nav === 'nl' ? 'nl-BE' : nav;
    document.title = T.titre;
    el('attente').hidden = true;
    el('absent-titre').textContent = T.absent;
    el('absent-texte').textContent = T.texte;
    el('absent-lien').textContent = T.lien;
    el('absent-lien').href = T.url;
    el('absent').hidden = false;
  }

  function afficher(page) {
    // Langue du rapport (attribut lang de sa balise html : fr, en, nl-BE) : titre et langue de cette page.
    var m = /<html[^>]*\slang="([a-zA-Z-]+)"/.exec(page);
    var lg = langue(m && m[1]), T = TEXTES[lg];
    // Liens du rapport (fiche Google, rendez-vous, offres) : nouvel onglet ; ouverts dans l'iframe, Google refuserait de s'y afficher.
    var base = '<base target="_blank">';
    page = /<head[^>]*>/i.test(page) ? page.replace(/<head[^>]*>/i, function (h) { return h + base; }) : base + page;
    var cadre = el('rapport');
    cadre.title = T.titre;
    cadre.srcdoc = page;
    document.documentElement.lang = lg === 'nl' ? 'nl-BE' : lg;
    document.title = T.titre;
    el('attente').hidden = true;
    cadre.hidden = false;
    document.body.className = 'rapport-ouvert';
  }

  var r = new URLSearchParams(location.search).get('r') || '';
  if (!UUID.test(r) || !window.fetch) { absent(); return; }
  fetch(STOCKAGE + r + '.html', {credentials: 'omit', referrerPolicy: 'no-referrer'})
    .then(function (rep) { if (!rep.ok) throw new Error('HTTP ' + rep.status); return rep.text(); })
    .then(function (page) {
      // Un rapport du moteur commence par <!doctype html> ; toute autre réponse (page d'erreur, fichier vide) : message d'absence.
      if (!/^\s*<!doctype html>/i.test(page) || page.indexOf('</html>') < 0) throw new Error('contenu inattendu');
      afficher(page);
    })
    .catch(absent);
})();
