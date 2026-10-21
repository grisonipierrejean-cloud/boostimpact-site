// Page de vente en trois langues : les textes générés ici suivent <html lang> (fr ; en pour site/en/ ; nl-BE pour site/nl/, 17/10/2026).
var RENOM_EN=document.documentElement.lang==='en';
var RENOM_NL=/^nl\b/.test(document.documentElement.lang);

// ---- Envoi des formulaires (17/10/2026). Le site est servi par GitHub Pages, qui refuse tout POST (405) : aucun hébergeur ne reçoit plus les formulaires.
// Chaque formulaire envoie DIRECTEMENT au webhook n8n de production écrit dans son attribut action (https://peejay.app.n8n.cloud/webhook/<path>),
// en JSON. Réussite seulement si n8n répond 2xx ET {"ok":true} (nœud « Respond to Webhook ») ; sinon le formulaire affiche une erreur
// avec l'adresse de contact. Rien de secret ici : les protections sont côté n8n (origine https://boostimpact.agency, champ piège website,
// contrôle strict des champs, limite d'audits par email et par jour) : n8n/build_audit.py, n8n/build_formulaires.py.
var BOOST_CONTACT='info@boostimpact.agency';
// Champs du formulaire en objet ; un nom répété (cases à cocher) devient une liste.
function boostDonnees(form){var o={};new FormData(form).forEach(function(v,k){o[k]=(k in o)?[].concat(o[k],v):v});return o}
function boostEnvoyer(form,donnees){
  var H={'Content-Type':'application/json'};
  return fetch(form.getAttribute('action'),{method:'POST',headers:H,body:JSON.stringify(donnees)})
  .then(function(r){return r.json().catch(function(){return null}).then(function(j){if(!r.ok||!j||j.ok!==true)throw new Error('envoi refusé');return j})});
}
function boostEchec(EN){return RENOM_NL?'Uw aanvraag is niet verstuurd. Probeer het zo meteen opnieuw, of mail ons op '+BOOST_CONTACT+'.'
  :EN?'Your request didn\u2019t go through. Try again in a moment, or email us at '+BOOST_CONTACT+'.'
  :"L'envoi n'a pas abouti. Réessayez dans un instant, ou écrivez-nous à "+BOOST_CONTACT+'.'}
(function(){
var EN=RENOM_EN;
// Page de vente : formulaire d'audit (16/10/2026 : nom du commerce, ville, email ; plus de choix du métier ; 18/10/2026 : lien de la fiche Google obligatoire).
// 18/10/2026 : téléphone ou WhatsApp facultatif dans ce formulaire ; la page de remerciement ne demande plus rien.
var $=function(s,r){return (r||document).querySelector(s)};
var form=$('#form');if(!form)return;
var T=RENOM_NL?{
  commerce:'Vul de naam van uw zaak in.',ville:'Vul uw gemeente in, zodat we het juiste profiel vinden.',email:'Dit e-mailadres lijkt onvolledig.',
  tel:'Dit telefoonnummer lijkt niet te kloppen: alleen cijfers, spaties en + ( ) . / -, bijvoorbeeld +32 470 12 34 56. Laat het veld leeg als u dat liever hebt.',
  maps:'Plak de link die u kopieerde via Google of Google Maps (knop Delen).',
  mapsVide:'Plak de link naar uw Google-bedrijfsprofiel: zoek uw zaak op Google, tik op Delen en kopieer de link.',
  ok:'Vink het vakje aan, zodat we u de audit kunnen sturen.',envoi:'Bezig met verzenden…',bouton:'Ontvang mijn gratis audit',merci:'bedankt.html'
}:EN?{
  commerce:'Enter the name of your business.',ville:'Enter your town or city, so we find the right listing.',email:'This email address looks incomplete.',
  tel:'This phone number doesn\u2019t look right: digits, spaces and + ( ) . / - only, for example +33 6 12 34 56 78. Leave it empty if you prefer.',
  maps:'Paste the link copied from Google or Google Maps (Share button).',
  mapsVide:'Paste the link to your Google listing: search for your business on Google, tap Share, then copy the link.',
  ok:'Tick the box so we can send you the audit.',envoi:'Sending…',bouton:'Get my free audit',merci:'thank-you.html'
}:{
  commerce:'Indiquez le nom de votre commerce.',ville:"Indiquez votre ville, pour qu'on trouve la bonne fiche.",email:'Cette adresse email semble incomplète.',
  tel:'Ce numéro ne semble pas valide : chiffres, espaces et + ( ) . / - seulement, par exemple 06 12 34 56 78. Laissez le champ vide si vous préférez.',
  maps:'Collez le lien copié depuis Google ou Google Maps (bouton Partager).',
  mapsVide:'Collez le lien de votre fiche Google : sur Google, cherchez votre commerce, touchez Partager, puis copiez le lien.',
  ok:"Cochez la case pour qu'on puisse vous envoyer l'audit.",envoi:'Envoi en cours…',bouton:'Recevoir mon audit gratuit',merci:'merci.html'
};
// Téléphone ou WhatsApp : facultatif ; même règle que tel() de n8n (n8n/build_formulaires.py, reprise dans n8n/build_audit.py) :
// espaces regroupés, puis 6 à 40 caractères parmi chiffres, espaces et + ( ) . / -. Côté n8n, un numéro invalide est ignoré, la demande passe.
var TEL=/^[0-9 +().\/-]{6,40}$/;
// Lien de la fiche Google (18/10/2026) : OBLIGATOIRE (un nom seul est trop imprécis). Tous les liens Google sont acceptés :
// share.google/…, g.co/…, maps.app.goo.gl/…, goo.gl/maps…, google.<tld>/maps…, maps.google.<tld>…, google.<tld>/search?…, g.page/…,
// business.google.com/…. Même expression que le contrôle de n8n (JS_GOOGLE, n8n/build_audit.py) et que moteur/audit/lien_google.py (FORMAT).
// Texte autour du lien ou « https:// » oublié : nettoyés ici comme dans n8n ; 500 caractères au plus. Le moteur suit le lien pour trouver LA fiche.
var GOOGLE=/^https?:\/\/(?:(?:www\.)?google\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})\/(?:maps|search)(?:[\/?#]|$)|maps\.google\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})(?:[\/?#]|$)|(?:share\.google|g\.co|maps\.app\.goo\.gl|g\.page|business\.google\.com)\/|goo\.gl\/maps(?:[\/?#]|$))[^\s"<>]*$/i;
function lienGoogle(v){var t=String(v||'').replace(/\s+/g,' ').trim(),m=t.match(/https?:\/\/[^\s"<>]+/i);
  return (m?m[0]:/^(?:share\.google|g\.co|maps\.app\.goo\.gl|goo\.gl|g\.page|business\.google\.com|(?:www\.|maps\.)?google\.)/i.test(t)?'https://'+t.split(' ')[0]:'').slice(0,500)}
var err=$('#err'),btn=$('#envoi');
function erreur(m,champ){err.textContent=m;err.hidden=false;if(champ)champ.focus()}
// Le message d'erreur disparaît dès que le visiteur corrige : il ne reste pas affiché à tort.
function effacer(){if(!err.hidden){err.hidden=true;err.textContent=''}}
form.addEventListener('input',effacer);form.addEventListener('change',effacer);
form.addEventListener('submit',function(e){e.preventDefault();err.hidden=true;
  if(form.website.value)return;
  if(!form.commerce.value.trim())return erreur(T.commerce,form.commerce);
  if(!form.ville.value.trim())return erreur(T.ville,form.ville);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim()))return erreur(T.email,form.email);
  var t=form.telephone?form.telephone.value.replace(/\s+/g,' ').trim():'';if(t&&!TEL.test(t))return erreur(T.tel,form.telephone);
  var brut=form.lien_maps.value.trim(),m=lienGoogle(brut);
  if(!brut)return erreur(T.mapsVide,form.lien_maps);
  if(!GOOGLE.test(m))return erreur(T.maps,form.lien_maps);
  if(!form.consentement.checked)return erreur(T.ok,form.consentement);
  var d=boostDonnees(form);d.lien_maps=m;
  btn.disabled=true;btn.textContent=T.envoi;
  // Page de remerciement seulement si n8n a accepté la demande ; sinon, message d'erreur avec l'adresse de contact.
  boostEnvoyer(form,d)
  .then(function(){location.href=T.merci})
  .catch(function(){btn.disabled=false;btn.textContent=T.bouton;erreur(boostEchec(EN))});
});
})();

// ---- Fiche de mise en route (mise-en-route.html, en/getting-started.html, nl/aan-de-slag.html) -> webhook renom-fiche-client.
(function(){
var f=document.forms['fiche-client'];if(!f)return;
var EN=RENOM_EN,b=f.querySelector('button[type=submit]');
f.addEventListener('submit',function(e){e.preventDefault();if(f.website.value)return;
  var a=f.querySelector('.envoi-echec');if(a)a.parentNode.removeChild(a);
  b.disabled=true;
  boostEnvoyer(f,boostDonnees(f))
  .then(function(){f.innerHTML='<p>'+(RENOM_NL?'Formulier ontvangen. We sturen u per e-mail een link om het wachtwoord van uw klantenzone te kiezen: daar laadt u uw foto\u2019s op.':EN?'Form received. We\u2019ll email you a link to choose your client area password: that\u2019s where you upload your photos.':'Fiche reçue. Nous vous envoyons par email un lien pour choisir le mot de passe de votre espace : c\u2019est là que vous déposerez vos photos.')+'</p>'})
  .catch(function(){b.disabled=false;var p=document.createElement('p');p.className='envoi-echec';p.setAttribute('role','alert');p.textContent=boostEchec(EN);f.appendChild(p)});
});
})();

// ---- Offres : sélecteur Annuel / Mensuel (formule annuelle du 16/10/2026). Sans JavaScript, le sélecteur reste masqué et les deux prix sont affichés.
(function(){
var g=document.querySelector('.rythme'),o=document.querySelector('.offres');if(!g||!o)return;
var choix=g.querySelectorAll('.rythme-choix');
// Boutons « Choisir … » (21/10/2026, décision de PJ : paiement Stripe direct) : lien du rythme choisi ; frais de mise en route offerts jusqu'à la
// date de .offres (heure de Paris, incluse), facturés ensuite ; Essentiel : un seul lien, sans frais. Sans JavaScript : lien annuel, frais offerts.
var jusqu=o.getAttribute('data-frais-offerts-jusqu')||'',auj='';try{auj=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'})}catch(e){}
var cas=(auj&&jusqu&&auj>jusqu)?'factures':'offerts',boutons=o.querySelectorAll('.offre-choisir');
function liens(r){for(var i=0;i<boutons.length;i++){var b=boutons[i],u=b.getAttribute('data-'+r+'-'+cas)||b.getAttribute('data-'+r+'-sans-frais');if(u)b.setAttribute('href',u)}}
function choisir(r){o.setAttribute('data-rythme-actif',r);for(var i=0;i<choix.length;i++)choix[i].setAttribute('aria-pressed',choix[i].getAttribute('data-choix')===r?'true':'false');liens(r)}
g.hidden=false;choisir('annuel');
g.addEventListener('click',function(e){var b=e.target.closest('.rythme-choix');if(b)choisir(b.getAttribute('data-choix'))});
})();

// ---- Simulateur (page secondaire site/simulateur.html, en/simulator.html, nl/simulator.html ; retiré de la page de vente le 16/10/2026). Aucun réseau, rien n'est envoyé ni gardé.
// Fourchette : une étoile de plus = +5 à +9 % de chiffre d'affaires (Luca, Harvard Business School, working paper 12-016, 2011 :
// restaurants indépendants de Seattle, notes Yelp). Sources : ordres/SOURCES-PAGE.md.
// Objectif atteignable (décision du 14/10/2026) : 4,5 si la note est entre 3,5 et 4,4 ; note + 1 sous 3,5 ; à 4,5 ou plus, aucun chiffre.
// Gain = (objectif − note) × 5 à 9 % du chiffre d'affaires annuel.
// Seuils de note : BrightLocal, Local Consumer Review Survey 2026 (68 % : 4 étoiles ou plus ; 31 % : 4,5 ou plus ; États-Unis).
(function(){
var calc=document.getElementById('calc');if(!calc)return;
var EN=RENOM_EN,NL=RENOM_NL,LOC=EN?'en-GB':NL?'nl-BE':'fr-FR';
var BAS=0.05,HAUT=0.09,CIBLE=4.5,PALIER=3.5;
var el=function(id){return document.getElementById(id)};
var vide=el('calc-vide'),plein=el('calc-plein'),seuil=el('calc-seuil'),gain=el('calc-gain'),sommet=el('calc-sommet');
// « 180 000 », « 180000 € », « 4,2 » ou « 4.2 » : espaces, euros et séparateurs de milliers retirés, virgule décimale acceptée.
// En anglais, la virgule sépare les milliers (« 180,000 ») et le point est décimal (« 4.2 ») ; « 4,2 » reste lu 4,2.
// En néerlandais de Belgique, comme en français : point des milliers (« 180.000 »), virgule décimale (« 4,1 »).
function nombre(v){
  v=String(v||'').replace(/[\s\u00a0\u202f€]/g,'');
  v=EN?v.replace(/,(?=\d{3}(\D|$))/g,'').replace(',','.'):v.replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.');
  if(!/^\d+(\.\d+)?$/.test(v))return NaN;
  return parseFloat(v);
}
// Ordre de grandeur : arrondi à la centaine d'euros, jamais de fausse précision.
function euros(n){
  var r=n>=1000?Math.round(n/100)*100:Math.round(n);
  if(EN)return '€'+r.toLocaleString(LOC,{maximumFractionDigits:0});
  if(NL)return '€\u00a0'+r.toLocaleString(LOC,{maximumFractionDigits:0});
  return r.toLocaleString(LOC,{maximumFractionDigits:0}).replace(/\u202f/g,'\u00a0')+'\u00a0€';
}
function noteTexte(n){return n.toLocaleString(LOC,{minimumFractionDigits:1,maximumFractionDigits:1})}
var C=NL?{
  videCa:'Vul uw jaaromzet en uw score in: het resultaat verschijnt hier.',
  videClients:'Vul uw klanten per dag, uw gemiddelde besteding, uw openingsdagen en uw score in: het resultaat verschijnt hier.',
  videNote:'Vul nu uw huidige Google-score in: het resultaat verschijnt hier.',
  baseCa:function(x){return 'Voor '+x+' omzet per jaar.'},baseClients:function(x){return 'Uw geschatte omzet: '+x+' per jaar.'},
  passer:function(a,b){return 'Van '+a+' naar '+b+' gaan, levert op:'},
  sommet:function(n){return 'Met '+n+' staat u al aan de top: de uitdaging is boven de anderen te blijven.'},
  sous4:function(n){return 'Met '+n+' zit u onder de grens van 4 sterren. 68% van de consumenten die BrightLocal bevroeg (Verenigde Staten, 2026), kiest alleen een zaak met 4 sterren of meer.'},
  sous45:function(n){return 'Met '+n+' haalt u de grens van 4 sterren. Maar 31% van de consumenten die BrightLocal bevroeg (Verenigde Staten, 2026), kiest alleen een zaak met 4,5 sterren of meer.'},
  noteInvalide:'Een score ligt tussen 1 en 5, bijvoorbeeld 4,1.'
}:EN?{
  videCa:'Enter your annual turnover and your rating: your result appears here.',
  videClients:'Enter your customers per day, average spend, opening days and rating: your result appears here.',
  videNote:'Now enter your current Google rating: your result appears here.',
  baseCa:function(x){return 'For '+x+' of turnover a year.'},baseClients:function(x){return 'Your estimated turnover: '+x+' a year.'},
  passer:function(a,b){return 'Going from '+a+' to '+b+' is worth:'},
  sommet:function(n){return 'At '+n+', you’re already at the top: the challenge is to stay above the others.'},
  sous4:function(n){return 'At '+n+', you’re below the 4-star line. 68% of consumers surveyed by BrightLocal (US, 2026) will only use a business with four or more stars.'},
  sous45:function(n){return 'At '+n+', you clear the 4-star line. But 31% of consumers surveyed by BrightLocal (US, 2026) will only use a business with 4.5 stars or more.'},
  noteInvalide:'Ratings run from 1 to 5, for example 4.1.'
}:{
  videCa:'Indiquez votre chiffre d’affaires et votre note : le résultat s’affiche ici.',
  videClients:'Indiquez vos clients par jour, votre panier moyen, vos jours d’ouverture et votre note : le résultat s’affiche ici.',
  videNote:'Indiquez maintenant votre note Google actuelle : le résultat s’affiche ici.',
  baseCa:function(x){return 'Pour '+x+' de chiffre d’affaires par an.'},baseClients:function(x){return 'Votre chiffre d’affaires estimé : '+x+' par an.'},
  passer:function(a,b){return 'Passer de '+a+' à '+b+' représente :'},
  sommet:function(n){return 'À '+n+', vous êtes déjà en haut : l’enjeu est de rester au-dessus des autres.'},
  sous4:function(n){return 'À '+n+', vous êtes sous la barre des 4 étoiles. 68 % des clients interrogés par BrightLocal (États-Unis, 2026) ne choisissent qu’un commerce noté 4 ou plus.'},
  sous45:function(n){return 'À '+n+', vous passez la barre des 4 étoiles. Mais 31 % des clients interrogés par BrightLocal (États-Unis, 2026) ne choisissent qu’un commerce noté 4,5 ou plus.'},
  noteInvalide:'La note s’écrit entre 1 et 5, par exemple 4,1.'
};
// Objectif atteignable pour une note n (au dixième) ; null à 4,5 ou plus (rien à chiffrer).
function objectif(n){return n>=CIBLE?null:n>=PALIER?CIBLE:Math.round((n+1)*10)/10}
// Mode par défaut : clients par jour × panier moyen × jours d'ouverture ; le chiffre d'affaires annuel est le second choix.
function mode(){var r=calc.querySelector('input[name="calc-mode"]:checked');return r?r.value:'clients'}
function chiffreAffaires(){
  if(mode()==='ca')return nombre(el('c-ca').value);
  var c=nombre(el('c-clients').value),p=nombre(el('c-panier').value),j=nombre(el('c-jours').value);
  if(isNaN(c)||isNaN(p)||isNaN(j)||j>366)return NaN;
  return c*p*j;
}
function montrerVide(m){vide.textContent=m;vide.hidden=false;plein.hidden=true}
function maj(){
  var ca=chiffreAffaires(),m=mode();
  el('calc-ca').hidden=(m!=='ca');el('calc-clients').hidden=(m==='ca');
  if(isNaN(ca)||ca<=0)return montrerVide(m==='ca'?C.videCa:C.videClients);
  var brut=String(el('c-note').value).trim(),n=nombre(brut);
  if(!brut)return montrerVide(C.videNote);
  if(isNaN(n)||n<1||n>5)return montrerVide(C.noteInvalide);
  n=Math.round(n*10)/10;
  vide.hidden=true;plein.hidden=false;
  el('calc-base').textContent=m==='ca'?C.baseCa(euros(ca)):C.baseClients(euros(ca));
  var o=objectif(n);
  gain.hidden=(o===null);sommet.hidden=(o!==null);
  if(o===null){sommet.textContent=C.sommet(noteTexte(n))}
  else{
    var ecart=Math.round((o-n)*10)/10;
    el('calc-lib').textContent=C.passer(noteTexte(n),noteTexte(o));
    el('calc-bas').textContent=euros(ca*ecart*BAS);el('calc-haut').textContent=euros(ca*ecart*HAUT);
  }
  var s=n<4?C.sous4(noteTexte(n)):n<CIBLE?C.sous45(noteTexte(n)):'';
  seuil.textContent=s;seuil.hidden=!s;
}
calc.addEventListener('input',maj);calc.addEventListener('change',maj);
calc.addEventListener('submit',function(e){e.preventDefault();maj()});
maj();
})();

// ---- Premier écran : carrousel de photos (18/10/2026). Fondu enchaîné toutes les 5 s ; pause au survol, au focus et par le bouton.
// prefers-reduced-motion : aucun défilement automatique (points cliquables seulement). Sans JavaScript : la première photo seule.
// Les photos 2 à 5 (loading="lazy") ne sont affichées, donc chargées, qu'après le chargement de la page (classe .pret).
(function(){
var c=document.querySelector('.carrousel');if(!c)return;
var diapos=c.querySelectorAll('.diapo'),points=c.querySelectorAll('.carrousel-point'),pause=c.querySelector('.carrousel-pause'),liste=c.querySelector('.diapos');
var n=diapos.length,i=0,minuteur=null,arret=false,survol=false;
var calme=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
if(calme&&calme.matches)arret=true;
function montrer(k){i=(k+n)%n;
  for(var j=0;j<n;j++){var a=(j===i);diapos[j].classList.toggle('est-active',a);
    if(a){diapos[j].removeAttribute('aria-hidden');points[j].setAttribute('aria-current','true')}
    else{diapos[j].setAttribute('aria-hidden','true');points[j].removeAttribute('aria-current')}}}
function regler(){clearInterval(minuteur);minuteur=null;
  var tourne=!arret&&!survol&&!document.hidden;
  if(tourne)minuteur=setInterval(function(){montrer(i+1)},5000);
  liste.setAttribute('aria-live',tourne?'off':'polite');
  c.classList.toggle('en-pause',arret);pause.setAttribute('aria-label',pause.getAttribute(arret?'data-lecture':'data-pause'))}
function demarrer(){c.classList.add('pret');c.querySelector('.carrousel-ctrl').hidden=false;regler()}
if(document.readyState==='complete')demarrer();else window.addEventListener('load',demarrer);
pause.addEventListener('click',function(){arret=!arret;regler()});
Array.prototype.forEach.call(points,function(b,j){b.addEventListener('click',function(){montrer(j);regler()})});
c.addEventListener('mouseenter',function(){survol=true;regler()});
c.addEventListener('mouseleave',function(){survol=false;regler()});
c.addEventListener('focusin',function(){survol=true;regler()});
c.addEventListener('focusout',function(e){if(!c.contains(e.relatedTarget)){survol=false;regler()}});
document.addEventListener('visibilitychange',regler);
if(calme&&calme.addEventListener)calme.addEventListener('change',function(e){if(e.matches){arret=true;regler()}});
})();
