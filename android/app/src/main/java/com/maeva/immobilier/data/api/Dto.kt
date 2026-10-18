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
