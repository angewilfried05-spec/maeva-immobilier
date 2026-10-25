/* ============================================================
   MAEVA IMMOBILIER — Réglages du site vitrine
   Modifiez uniquement les valeurs entre guillemets.
   Si une valeur est vide (""), l'élément correspondant
   disparaît automatiquement de la page.
   ============================================================ */

window.VITRINE = {

  /* ---- Numéro de téléphone principal (OBLIGATOIRE pour les boutons) ---- */
  telephoneAffiche: "+225 07 07 15 43 36",        // tel qu'affiché aux visiteurs
  telephoneInternational: "2250707154336",        // chiffres uniquement, SANS "+" ni espaces (code pays inclus)

  /* ---- Second numéro (affiché dans la page Contact ; vide "" = masqué) ---- */
  telephone2Affiche: "+225 05 46 71 69 74",
  telephone2International: "2250546716974",

  /* ---- Email de contact ---- */
  email: "tahbiarmand86@gmail.com",               // vide "" = masqué
  emailAffiche: "tahbiarmand86@gmail.com",        // texte affiché (peut être identique)

  /* ---- Adresse et horaires ---- */
  adresse: "Abidjan, Côte d'Ivoire",              // ex. "Angré, Abidjan"
  horaires: "Lundi – vendredi : 8h – 17h",        // vide "" = masqué

  /* ---- Lien vers l'application de gestion (pied de page) ---- */
  appUrl: "https://maeva-immobilier.com",         // vide "" = lien "Espace gestion" masqué

  /* ---- Envoi du formulaire directement sur le WhatsApp professionnel ----
     Quand renseigné, le formulaire envoie la demande au serveur qui la fait
     parvenir sur le WhatsApp de l'entreprise (le visiteur n'a pas besoin de
     WhatsApp). Vide "" = le formulaire retombe sur l'ouverture de wa.me. */
  apiUrl: "https://maeva-immobilier.com/api/vitrine/contact",

  /* ---- Photos de réalisations (page + lien de menu masqués si vide) ----
     1. Déposez la photo dans le dossier assets/photos/
     2. Ajoutez une ligne comme celles d'en-dessous, une par photo :
        "src"    : chemin du fichier (assets/photos/nom-du-fichier.jpg)
        "alt"    : courte description (affichée si l'image ne se charge pas)
        "titre"  : nom du projet — optionnel, affiché sous la photo
        "texte"  : 1-2 phrases sur le projet — optionnel, affiché sous le titre
     Décommentez les exemples (retirez les "//" en début de ligne) puis remplacez.  */
  photos: [
    // { src: "assets/photos/chantier-1.jpg", alt: "Clôture d'une cour, Abidjan",
    //   titre: "Clôture d'une cour", texte: "Clôture en parpaings avec portail, livrée à Angré." },
    // { src: "assets/photos/chantier-2.jpg", alt: "Rénovation d'un bâtiment",
    //   titre: "Rénovation complète", texte: "Reprise toiture, électricité et peinture d'un R+2." },
  ],

};
