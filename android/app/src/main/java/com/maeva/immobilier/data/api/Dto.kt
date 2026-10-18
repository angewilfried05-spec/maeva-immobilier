package com.maeva.immobilier.data.api

// Corps de requêtes et réponses de l'API v1 (/api/v1 + alias /api).

data class LoginBody(val username: String, val password: String)
data class RefreshBody(val refresh_token: String)
data class ChangerMdpBody(val ancien: String, val nouveau: String)

data class Utilisateur(
    val id: Int,
    val username: String,
    val nom_complet: String?,
    val role: String,
    val doit_changer_mdp: Boolean = false,
)

data class SessionReponse(
    val token: String,
    val refresh_token: String,
    val utilisateur: Utilisateur?,
)

data class ErreurApi(val message: String?, val code: String?)

data class Locataire(
    val id: Int,
    val batiment_id: Int,
    val numero_porte: String?,
    val nom_locataire: String,
    val loyer_mensuel: Int,
    val statut: String,
    val telephone: String?,
)

data class Situation(
    val dette: Int,
    val dette_mois: Double,
    val loyer: Int,
    val loyer_du_mois: Int,
    val paye_jusqu_a: String?,
    val avance: Int,
)

data class Batiment(val id: Int, val nom: String)

data class Alertes(
    val mois_cloture: Boolean = false,
    val portes_libres: Int = 0,
    val en_retard: Int = 0,
    val dette_totale: Int = 0,
)

data class Dashboard(
    val mois: String,
    val locataires: List<Locataire>,
    val situations: Map<String, Situation>,
    val batiments: List<Batiment>,
    val alertes: Alertes?,
    val cautions_detenues: Int,
    val resume: Resume?,
)

data class Resume(
    val total_loyers_attendus: Int?,
    val total_loyers_percus: Int?,
    val total_depenses: Int?,
    val solde: Int?,
    val montant_remis_au_proprietaire: Int?,
)

data class VersementBody(
    val locataire_id: Int,
    val mois: String,
    val montant: Int,
    val date_versement: String? = null,
    val mode: String = "Espèces",
    val note: String? = null,
    val cle_idempotence: String? = null,
)

data class Versement(
    val id: Int,
    val locataire_id: Int,
    val mois: String,
    val montant: Int,
    val numero_quittance: String?,
)

data class Relance(
    val locataire_id: Int,
    val nom_locataire: String,
    val telephone: String?,
    val batiment: String?,
    val porte: String?,
    val dette: Int,
    val dette_mois: Double,
    val loyer: Int,
    val whatsapp: String?,
    val sms: String?,
    val message: String,
)

data class RelancesReponse(val mois: String, val relances: List<Relance>, val total_dette: Int)

// Fiche locataire : GET /api/locataires/:id?mois=
data class VersementRow(
    val id: Int,
    val locataire_id: Int,
    val mois: String,
    val montant: Int,
    val date_versement: String?,
    val mode: String?,
    val note: String?,
    val numero_quittance: String?,
)

data class LoyerHist(val a_partir_de: String, val montant: Int)
data class NoteMois(val mois: String, val note: String?)

// Unités physiques (portes) : GET /api/v1/unites
data class Unite(
    val id: Int,
    val batiment_id: Int,
    val porte: String?,
    val loyer_base: Int?,
    val batiment: String?,
    val contrat_id: Int?,
    val nom_locataire: String?,
    val statut: String, // "occupee" ou "libre"
)

data class Occupation(
    val id: Int,
    val nom_locataire: String,
    val telephone: String?,
    val loyer_mensuel: Int,
    val date_entree: String?,
    val statut: String,
    val debut_suivi: String?,
    val mois_sortie: String?,
    val caution: Int?,
)

data class UniteDetail(
    val id: Int,
    val porte: String?,
    val loyer_base: Int?,
    val batiment: String?,
    val occupations: List<Occupation> = emptyList(),
)

// Résumés mensuels (historique + clôtures) : GET /api/resumes
data class ResumeMois(
    val mois: String,
    val total_loyers_attendus: Int?,
    val total_loyers_percus: Int?,
    val total_depenses: Int?,
    val solde: Int?,
    val montant_remis_au_proprietaire: Int?,
    val cloture: Boolean = false,
    val cloture_le: String?,
    val cloture_par: String?,
)

data class ClotureBody(val remis_proprietaire: Int? = null)

data class FicheLocataire(
    val id: Int,
    val nom_locataire: String,
    val numero_porte: String?,
    val loyer_mensuel: Int,
    val statut: String,
    val telephone: String?,
    val caution: Int?,
    val situation: Situation?,
    val versements: List<VersementRow> = emptyList(),
    val loyers: List<LoyerHist> = emptyList(),
    val notes: List<NoteMois> = emptyList(),
)
