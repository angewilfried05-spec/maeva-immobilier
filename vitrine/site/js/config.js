/* ============================================================
   MAEVA IMMOBILIER — Réglages du site vitrine
   Modifiez uniquement les valeurs entre guillemets.
   Si une valeur est vide (""), l'élément correspondant
   disparaît automatiquement de la page.
   ============================================================ */

window.VITRINE = {

  /* ---- Numéro de téléphone (OBLIGATOIRE pour les boutons) ---- */
  telephoneAffiche: "+225 01 02 03 04 05",        // tel qu'affiché aux visiteurs
  telephoneInternational: "2250102030405",        // chiffres uniquement, SANS "+" ni espaces (code pays inclus)

  /* ---- Email de contact ---- */
  email: "contact@maeva-immobilier.com",          // vide "" = masqué
  emailAffiche: "contact@maeva-immobilier.com",   // texte affiché (peut être identique)

  /* ---- Adresse et horaires ---- */
  adresse: "Abidjan, Côte d'Ivoire",              // ex. "Angré, Abidjan"
  horaires: "Lundi – vendredi : 8h – 17h",        // vide "" = masqué

  /* ---- Lien vers l'application de gestion (pied de page) ---- */
  appUrl: "https://gestion.maeva-immobilier.com", // vide "" = lien "Espace gestion" masqué

  /* ---- Photos de réalisations (section + lien de menu masqués si vide) ----
     Déposez les fichiers dans assets/photos/ puis ajoutez une ligne par photo.
     "src"  : chemin du fichier
     "alt"  : courte description affichée si l'image ne se charge pas  */
  photos: [
    // { src: "assets/photos/chantier-1.jpg", alt: "Chantier de clôture, Abidjan" },
    // { src: "assets/photos/chantier-2.jpg", alt: "Rénovation d'un bâtiment" },
  ],

};
