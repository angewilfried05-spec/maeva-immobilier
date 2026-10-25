/* ============================================================
   MAEVA IMMOBILIER — Vitrine
   Branche la page sur js/config.js. Aucune dépendance externe.
   ============================================================ */
(function () {
  'use strict';
  var cfg = window.VITRINE || {};

  var tel = String(cfg.telephoneInternational || '').replace(/[^\d]/g, '');
  var telAffiche = String(cfg.telephoneAffiche || '').trim();
  var tel2 = String(cfg.telephone2International || '').replace(/[^\d]/g, '');
  var tel2Affiche = String(cfg.telephone2Affiche || '').trim();
  var email = String(cfg.email || '').trim();
  var emailAffiche = String(cfg.emailAffiche || cfg.email || '').trim();
  var adresse = String(cfg.adresse || '').trim();
  var horaires = String(cfg.horaires || '').trim();
  var appUrl = String(cfg.appUrl || '').trim();
  var photos = Array.isArray(cfg.photos) ? cfg.photos.filter(function (p) { return p && p.src; }) : [];

  /* ---- Téléphone principal : tous les boutons "Appeler" ---- */
  var telOk = tel.length >= 8;
  document.querySelectorAll('[data-tel]').forEach(function (a) {
    if (!telOk) { a.hidden = true; return; }
    a.setAttribute('href', 'tel:+' + tel);
  });
  var telLien = document.querySelector('[data-tel-affiche]');
  if (telLien && telOk) telLien.textContent = telAffiche || ('+' + tel);
  if (!telOk) {
    var barreMobile = document.querySelector('.barre-mobile');
    if (barreMobile) barreMobile.querySelectorAll('.btn-plein').forEach(function (b) { b.hidden = true; });
  }

  /* ---- Second numéro (page Contact) ---- */
  var tel2Ok = tel2.length >= 8;
  document.querySelectorAll('[data-tel2]').forEach(function (a) {
    if (!tel2Ok) { a.hidden = true; return; }
    a.setAttribute('href', 'tel:+' + tel2);
  });
  var tel2Lien = document.querySelector('[data-tel2-affiche]');
  if (tel2Lien && tel2Ok) tel2Lien.textContent = tel2Affiche || ('+' + tel2);

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
  var elAdresse = document.querySelector('[data-adresse]');
  if (adresse && elAdresse) elAdresse.textContent = adresse;
  else if (ligneAdresse) ligneAdresse.hidden = true;

  var ligneHoraires = document.querySelector('[data-horaires-ligne]');
  var elHoraires = document.querySelector('[data-horaires]');
  if (horaires && elHoraires) elHoraires.textContent = horaires;
  else if (ligneHoraires) ligneHoraires.hidden = true;

  /* ---- Pied de page ---- */
  var annee = document.querySelector('[data-annee]');
  if (annee) annee.textContent = String(new Date().getFullYear());
  document.querySelectorAll('[data-app-url]').forEach(function (lienApp) {
    if (appUrl) lienApp.setAttribute('href', appUrl);
    else lienApp.hidden = true;
  });

  /* ---- Réalisations : lien de menu masqué sans photo ; page remplie sinon ---- */
  var liensPhotos = document.querySelectorAll('[data-photo-section]');
  if (photos.length === 0) {
    liensPhotos.forEach(function (a) { a.hidden = true; });
    var pagePhotos = document.querySelector('[data-photo-page]');
    if (pagePhotos) {
      var vide = document.querySelector('[data-photos-vide]');
      if (vide) vide.hidden = false;
    }
  } else {
    var grille = document.querySelector('[data-photos]');
    if (grille) {
      photos.forEach(function (p) {
        var figure = document.createElement('figure');
        figure.className = 'photo-projet';
        var img = document.createElement('img');
        img.src = p.src;
        img.alt = p.alt || 'Réalisation MAEVA IMMOBILIER';
        img.loading = 'lazy';
        figure.appendChild(img);
        if (p.titre || p.texte) {
          var cap = document.createElement('figcaption');
          if (p.titre) {
            var t = document.createElement('strong');
            t.textContent = p.titre;
            cap.appendChild(t);
          }
          if (p.texte) {
            var tx = document.createElement('span');
            tx.textContent = p.texte;
            cap.appendChild(tx);
          }
          figure.appendChild(cap);
        }
        grille.appendChild(figure);
      });
    }
  }

  /* ---- Lien de menu de la page courante ---- */
  var page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('[data-nav]').forEach(function (a) {
    if (a.getAttribute('href') === page) {
      a.classList.add('actif');
      a.setAttribute('aria-current', 'page');
    }
  });

  /* ---- Formulaire : validation + envoi WhatsApp / email ---- */
  var form = document.getElementById('form-contact');
  var erreur = document.getElementById('form-erreur');
  if (form && erreur) {
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

    Object.values(champs).forEach(function (el) {
      el.addEventListener('input', function () { el.closest('.champ').classList.remove('invalide'); });
    });
    var apiUrl = String(cfg.apiUrl || '').trim();
    var succes = document.getElementById('form-succes');
    var boutonEnvoi = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!valider()) return;
      // Priorité à l'envoi direct sur le WhatsApp professionnel via le serveur ;
      // en cas d'échec ou d'absence de configuration, repli sur wa.me.
      if (apiUrl) {
        boutonEnvoi.disabled = true;
        boutonEnvoi.textContent = 'Envoi en cours…';
        fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nom: champs.nom.value.trim(),
            telephone: champs.telephone.value.trim(),
            besoin: champs.besoin.value,
            message: champs.message.value.trim(),
            site_web: (document.getElementById('f-siteweb') || {}).value || '',
          }),
        }).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          if (succes) succes.hidden = false;
          erreur.hidden = true;
          form.reset();
        }).catch(function () {
          if (waOk) {
            window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(texteMessage()), '_blank', 'noopener');
          } else {
            erreur.textContent = 'Envoi impossible pour le moment. Utilisez l\'envoi par email.';
            erreur.hidden = false;
          }
        }).finally(function () {
          boutonEnvoi.disabled = false;
          boutonEnvoi.textContent = 'Envoyer sur WhatsApp';
        });
        return;
      }
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
