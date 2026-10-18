package com.maeva.immobilier.data.local

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Delete
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase

/** Encaissement saisi hors-ligne : envoyé dès que le réseau revient. */
@Entity(tableName = "versements_en_attente")
data class VersementEnAttente(
    @PrimaryKey val cleIdempotence: String,   // même clé côté serveur : jamais de doublon
    val locataireId: Int,
    val nomLocataire: String,
    val mois: String,
    val montant: Int,
    val mode: String,
    val note: String?,
    val creeLe: Long = System.currentTimeMillis(),
    val tentatives: Int = 0,
    val derniereErreur: String? = null,
)

@Dao
interface FileDao {
    @Insert
    suspend fun ajouter(v: VersementEnAttente)

    @Delete
    suspend fun retirer(v: VersementEnAttente)

    @Query("SELECT * FROM versements_en_attente ORDER BY creeLe")
    suspend fun toutes(): List<VersementEnAttente>

    @Query("SELECT * FROM versements_en_attente ORDER BY creeLe")
    fun observerToutes(): kotlinx.coroutines.flow.Flow<List<VersementEnAttente>>

    @Query("UPDATE versements_en_attente SET tentatives = tentatives + 1, derniereErreur = :erreur WHERE cleIdempotence = :cle")
    suspend fun marquerEchec(cle: String, erreur: String?)
}

@Database(entities = [VersementEnAttente::class], version = 1)
abstract class AppDatabase : RoomDatabase() {
    abstract fun fileDao(): FileDao

    companion object {
        @Volatile private var instance: AppDatabase? = null
        fun get(context: Context): AppDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(context, AppDatabase::class.java, "maeva.db")
                .build().also { instance = it }
        }
    }
}
