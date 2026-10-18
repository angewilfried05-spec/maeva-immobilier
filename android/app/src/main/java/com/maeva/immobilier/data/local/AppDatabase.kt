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
    val type: String = "loyer",
    val dateVersement: String? = null,
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

@Database(entities = [VersementEnAttente::class], version = 2)
abstract class AppDatabase : RoomDatabase() {
    abstract fun fileDao(): FileDao

    companion object {
        // v1 → v2 : objet du versement + date de paiement sur la file hors-ligne
        private val MIGRATION_1_2 = object : androidx.room.migration.Migration(1, 2) {
            override fun migrate(db: androidx.sqlite.db.SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE versements_en_attente ADD COLUMN type TEXT NOT NULL DEFAULT 'loyer'")
                db.execSQL("ALTER TABLE versements_en_attente ADD COLUMN dateVersement TEXT")
            }
        }

        @Volatile private var instance: AppDatabase? = null
        fun get(context: Context): AppDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(context, AppDatabase::class.java, "maeva.db")
                .addMigrations(MIGRATION_1_2)
                .build().also { instance = it }
        }
    }
}
