package com.maeva.immobilier.data.api

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Query

interface MaevaApi {

    @POST("api/v1/auth/login")
    suspend fun login(@Body body: LoginBody): SessionReponse

    @POST("api/v1/auth/refresh")
    suspend fun refresh(@Body body: RefreshBody): SessionReponse

    @POST("api/v1/auth/change-password")
    suspend fun changerMdp(@Body body: ChangerMdpBody, @Header("Authorization") auth: String): SessionReponse

    @POST("api/v1/auth/logout")
    suspend fun logout(@Body body: RefreshBody): Response<Unit>

    @GET("api/v1/auth/me")
    suspend fun me(): Utilisateur

    @GET("api/dashboard")
    suspend fun dashboard(@Query("mois") mois: String): Dashboard

    @GET("api/locataires")
    suspend fun locataires(): List<Locataire>

    @GET("api/locataires/{id}")
    suspend fun ficheLocataire(@retrofit2.http.Path("id") id: Int, @Query("mois") mois: String): FicheLocataire

    @POST("api/v1/versements")
    suspend fun versement(@Body body: VersementBody): Versement

    @GET("api/relances")
    suspend fun relances(@Query("mois") mois: String): RelancesReponse
}
