package com.maeva.immobilier.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "maeva_session")

/** Session locale : URL serveur + jeton d'accès court + refresh token (30 j). */
class SessionStore(private val context: Context) {

    private val SERVEUR = stringPreferencesKey("serveur")
    private val ACCESS = stringPreferencesKey("access")
    private val REFRESH = stringPreferencesKey("refresh")
    private val NOM = stringPreferencesKey("nom_complet")
    private val ROLE = stringPreferencesKey("role")

    suspend fun serveur(): String =
        context.dataStore.data.map { it[SERVEUR] }.first()
            ?: "https://maeva-immobilier.com"

    suspend fun access(): String? = context.dataStore.data.map { it[ACCESS] }.first()
    suspend fun refresh(): String? = context.dataStore.data.map { it[REFRESH] }.first()
    suspend fun nomComplet(): String? = context.dataStore.data.map { it[NOM] }.first()
    suspend fun role(): String? = context.dataStore.data.map { it[ROLE] }.first()
    fun connecte() = context.dataStore.data.map { !it[ACCESS].isNullOrEmpty() }

    suspend fun enregistrerSession(serveur: String, access: String, refresh: String, nom: String?, role: String?) {
        context.dataStore.edit {
            it[SERVEUR] = serveur.trimEnd('/')
            it[ACCESS] = access
            it[REFRESH] = refresh
            if (nom != null) it[NOM] = nom
            if (role != null) it[ROLE] = role
        }
    }

    suspend fun majJetons(access: String, refresh: String) {
        context.dataStore.edit { it[ACCESS] = access; it[REFRESH] = refresh }
    }

    suspend fun effacer() = context.dataStore.edit { it.remove(ACCESS); it.remove(REFRESH) }
}
