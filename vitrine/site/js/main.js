/* ============================================================
   MAEVA IMMOBILIER — Vitrine
   Branche la page sur js/config.js. Aucune dépendance externe.
   ============================================================ */
(function () {
  'use strict';
  var cfg = window.VITRINE || {};

  var tel = String(cfg.telephoneInternational || '').replace(/[^\d]/g, '');
  var telAffiche = String(cfg.telephoneAffiche || '').trim();
  var email = String(cfg.email || '').trim();
  var emailAffiche = String(cfg.emailAffiche || cfg.email || '').trim();
  var adresse = String(cfg.adresse || '').trim();
  var horaires = String(cfg.horaires || '').trim();
  var appUrl = String(cfg.appUrl || '').trim();
  var photos = Array.isArray(cfg.photos) ? cfg.photos.filter(function (p) { return p && p.src; }) : [];

  /* ---- Téléphone : tous les boutons "Appeler" ---- */
  var telOk = tel.length >= 8;
  document.querySelectorAll('[data-tel]').forEach(function (a) {
    if (!telOk) { a.hidden = true; return; }
    a.setAttribute('href', 'tel:+' + tel);
  });
  var telLien = document.querySelector('[data-tel-affiche]');
  if (telLien) telLien.textContent = telAffiche || ('+' + tel);
  if (!telOk) {
    var barreMobile = document.querySelector('.barre-mobile');
    if (barreMobile) barreMobile.querySelectorAll('.btn-plein').forEach(function (b) { b.hidden = true; });
  }

  /* ---- WhatsApp ---- */
  var waOk = telOk;
  document.querySelectorAll('[data-whatsapp]').forEach(function (a) {
    if (!waOk) { a.hidden = true; return; }
    a.setAttribute('href', 'https://wa.me/' + tel + '?text=' + encodeURIComponent('Bonjour MAEVA IMMOBILIER,'));
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
  });
  if (!waOk) {
    var barre = document.querySelector('.barre-mobile');
    if (barre && barre.querySelectorAll('.btn:not([hidden])').length === 0) barre.remove();
  }

  /* ---- Email ---- */
  var ligneEmail = document.querySelector('[data-email-ligne]');
  var aEmail = document.querySelector('[data-email]');
  if (email && aEmail && ligneEmail) {
    aEmail.textContent = emailAffiche;
    aEmail.setAttribute('href', 'mailto:' + email);
  } else if (ligneEmail) {
    ligneEmail.hidden = true;
  }
  var btnEmail = document.getElementById('btn-email');
  if (!email && btnEmail) btnEmail.hidden = true;

  /* ---- Adresse / horaires ---- */
  var ligneAdresse = document.querySelector('[data-adresse-ligne]');
  if (adresse) document.querySelector('[data-adresse]').textContent = adresse;
  else if (ligneAdresse) ligneAdresse.hidden = true;

  var ligneHoraires = document.querySelector('[data-horaires-ligne]');
  if (horaires) document.querySelector('[data-horaires]').textContent = horaires;
  else if (ligneHoraires) ligneHoraires.hidden = true;

  /* ---- Pied de page ---- */
  var annee = document.querySelector('[data-annee]');
  if (annee) annee.textContent = String(new Date().getFullYear());
  var lienApp = document.querySelector('[data-app-url]');
  if (appUrl && lienApp) lienApp.setAttribute('href', appUrl);
  else if (lienApp) lienApp.hidden = true;

  /* ---- Réalisations : section + lien de menu masqués sans photo ---- */
  var sectionPhotos = document.querySelector('section#realisations');
  var liensPhotos = document.querySelectorAll('.nav a[href="#realisations"]');
  if (photos.length === 0) {
    if (sectionPhotos) sectionPhotos.remove();
    liensPhotos.forEach(function (a) { a.remove(); });
  } else {
    if (sectionPhotos) sectionPhotos.hidden = false;
    var grille = document.querySelector('[data-photos]');
    photos.forEach(function (p) {
      var img = document.createElement('img');
      img.src = p.src;
      img.alt = p.alt || 'Réalisation MAEVA IMMOBILIER';
      img.loading = 'lazy';
      grille.appendChild(img);
    });
  }

  /* ---- Formulaire : validation + envoi WhatsApp / email ---- */
  var form = document.getElementById('form-contact');
  var erreur = document.getElementById('form-erreur');
  var champs = {
    nom: document.getElementById('f-nom'),
    telephone: document.getElementById('f-tel'),
    besoin: document.getElementById('f-besoin'),
    message: document.getElementById('f-message'),
  };
  var LIBELLES = { nom: 'votre nom', telephone: 'votre téléphone', besoin: 'votre besoin' };

  function valider() {
    var manquants = [];
    Object.keys(LIBELLES).forEach(function (cle) {
      var el = champs[cle];
      var vide = !String(el.value || '').trim();
      el.closest('.champ').classList.toggle('invalide', vide);
      if (vide) manquants.push(LIBELLES[cle]);
    });
    if (manquants.length) {
      erreur.textContent = 'Veuillez renseigner : ' + manquants.join(', ') + '.';
      erreur.hidden = false;
      return false;
    }
    erreur.hidden = true;
    return true;
  }

  function texteMessage() {
    var lignes = [
      'Bonjour MAEVA IMMOBILIER,',
      '',
      'Nom : ' + champs.nom.value.trim(),
      'Téléphone : ' + champs.telephone.value.trim(),
      'Besoin : ' + champs.besoin.value,
    ];
    if (champs.message.value.trim()) lignes.push('', champs.message.value.trim());
    return lignes.join('\n');
  }

  if (form) {
    Object.values(champs).forEach(function (el) {
      el.addEventListener('input', function () { el.closest('.champ').classList.remove('invalide'); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!valider()) return;
      if (!waOk) {
        erreur.textContent = "Le numéro WhatsApp n'est pas encore configuré. Utilisez l'envoi par email.";
        erreur.hidden = false;
        return;
      }
      window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(texteMessage()), '_blank', 'noopener');
    });
    if (btnEmail) {
      btnEmail.addEventListener('click', function () {
        if (!valider()) return;
        var sujet = 'Demande depuis le site — ' + champs.besoin.value;
        window.location.href = 'mailto:' + email
          + '?subject=' + encodeURIComponent(sujet)
          + '&body=' + encodeURIComponent(texteMessage());
      });
    }
  }
})();
