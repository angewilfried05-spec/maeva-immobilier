package com.maeva.immobilier.data.api

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.PUT
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

    @POST("api/locataires")
    suspend fun creerLocataire(@Body body: LocataireBody): Locataire

    @PUT("api/locataires/{id}")
    suspend fun majLocataire(@retrofit2.http.Path("id") id: Int, @Body body: LocataireBody): Locataire

    @POST("api/locataires/{id}/depart")
    suspend fun departLocataire(@retrofit2.http.Path("id") id: Int, @Body body: DepartBody): Response<Unit>

    @DELETE("api/locataires/{id}")
    suspend fun supprLocataire(@retrofit2.http.Path("id") id: Int): Response<Unit>

    @GET("api/batiments")
    suspend fun batiments(): List<Batiment>

    @POST("api/batiments")
    suspend fun creerBatiment(@Body body: BatimentBody): Batiment

    @PUT("api/batiments/{id}")
    suspend fun majBatiment(@retrofit2.http.Path("id") id: Int, @Body body: BatimentBody): Batiment

    @DELETE("api/batiments/{id}")
    suspend fun supprBatiment(@retrofit2.http.Path("id") id: Int): Response<Unit>

    @POST("api/unites")
    suspend fun creerUnite(@Body body: UniteBody): Unite

    @PUT("api/unites/{id}")
    suspend fun majUnite(@retrofit2.http.Path("id") id: Int, @Body body: UniteBody): Unite

    @DELETE("api/unites/{id}")
    suspend fun supprUnite(@retrofit2.http.Path("id") id: Int): Response<Unit>

    @POST("api/v1/versements")
    suspend fun versement(@Body body: VersementBody): Versement

    @GET("api/relances")
    suspend fun relances(@Query("mois") mois: String): RelancesReponse

    @GET("api/unites")
    suspend fun unites(): List<Unite>

    @GET("api/unites/{id}")
    suspend fun unite(@retrofit2.http.Path("id") id: Int): UniteDetail

    @GET("api/resumes")
    suspend fun resumes(): List<ResumeMois>

    @POST("api/resumes/{mois}/cloturer")
    suspend fun cloturer(@retrofit2.http.Path("mois") mois: String, @Body body: ClotureBody): Response<Unit>

    @POST("api/resumes/{mois}/decloturer")
    suspend fun decloturer(@retrofit2.http.Path("mois") mois: String): Response<Unit>
}
