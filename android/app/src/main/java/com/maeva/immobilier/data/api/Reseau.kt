package com.maeva.immobilier.data.api

import com.maeva.immobilier.data.SessionStore
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.Authenticator
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Client HTTP de l'API : Bearer automatique, et sur 401 une rotation du
 * refresh token (une seule à la fois) puis nouvelle tentative.
 */
class Reseau(private val session: SessionStore) {

    private val rotation = Mutex()

    private val intercepteurAuth = Interceptor { chain ->
        val token = runBlocking { session.access() }
        val req = if (token != null) {
            chain.request().newBuilder().header("Authorization", "Bearer $token").build()
        } else chain.request()
        chain.proceed(req)
    }

    private val authenticator = object : Authenticator {
        override fun authenticate(route: Route?, response: Response): Request? {
            // Déjà une réponse après retry → on abandonne (la session sera nettoyée)
            if (response.request.header("X-Retry") != null) return null
            val nouvelAcces = runBlocking {
                rotation.withLock {
                    // Un autre appel a peut-être déjà rafraîchi pendant notre attente
                    val courant = session.access()
                    val utilise = response.request.header("Authorization")?.removePrefix("Bearer ")
                    if (courant != null && courant != utilise) return@withLock courant
                    val refresh = session.refresh() ?: return@withLock null
                    val api = apiSansAuth()
                    try {
                        val s = api.refresh(RefreshBody(refresh))
                        session.majJetons(s.token, s.refresh_token)
                        s.token
                    } catch (e: Exception) { null }
                }
            }
            return nouvelAcces?.let {
                response.request.newBuilder()
                    .header("Authorization", "Bearer $it")
                    .header("X-Retry", "1")
                    .build()
            }
        }
    }

    private fun apiSansAuth(): MaevaApi = Retrofit.Builder()
        .baseUrl(runBlocking { session.serveur() } + "/")
        .client(OkHttpClient.Builder().build())
        .addConverterFactory(GsonConverterFactory.create())
        .build().create(MaevaApi::class.java)

    fun client(): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(intercepteurAuth)
        .addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
        .authenticator(authenticator)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    // Le Retrofit est recréé si l'URL serveur change (rare : écran de connexion)
    @Volatile private var urlPrecedente: String? = null
    @Volatile private var apiCachee: MaevaApi? = null

    suspend fun api(): MaevaApi {
        val url = session.serveur()
        val cachee = apiCachee
        if (cachee != null && urlPrecedente == url) return cachee
        val api = Retrofit.Builder()
            .baseUrl(url + "/")
            .client(client())
            .addConverterFactory(GsonConverterFactory.create())
            .build().create(MaevaApi::class.java)
        apiCachee = api; urlPrecedente = url
        return api
    }
}
