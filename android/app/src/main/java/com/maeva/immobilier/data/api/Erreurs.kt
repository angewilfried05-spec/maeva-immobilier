package com.maeva.immobilier.data.api

import org.json.JSONObject
import retrofit2.HttpException

/** Message lisible d'une erreur API : le {message} du backend sinon un générique. */
fun messageErreur(e: Throwable): String = when (e) {
    is HttpException -> try {
        JSONObject(e.response()?.errorBody()?.string() ?: "")
            .optString("message").ifBlank { "Erreur ${e.code()}" }
    } catch (_: Exception) { "Erreur ${e.code()}" }
    else -> "Serveur injoignable"
}
