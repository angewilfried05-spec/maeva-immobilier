package com.maeva.immobilier.data.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.maeva.immobilier.MaevaApp
import com.maeva.immobilier.data.api.VersementBody
import java.util.concurrent.TimeUnit

/**
 * Envoie les encaissements faits hors-ligne, dans l'ordre de saisie.
 * La clé d'idempotence garantit qu'un versement déjà envoyé (réponse perdue)
 * n'est jamais compté en double : le serveur renvoie l'existant.
 */
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val app = applicationContext as MaevaApp
        val dao = app.db.fileDao()
        val enAttente = dao.toutes()
        if (enAttente.isEmpty()) return Result.success()
        val api = try { app.reseau.api() } catch (e: Exception) { return Result.retry() }

        for (v in enAttente) {
            try {
                api.versement(
                    VersementBody(
                        locataire_id = v.locataireId, mois = v.mois, montant = v.montant,
                        mode = v.mode, note = v.note, cle_idempotence = v.cleIdempotence,
                    )
                )
                dao.retirer(v)
            } catch (e: retrofit2.HttpException) {
                // Refus métier (mois clôturé, locataire parti…) : on garde en file, visible dans l'app
                dao.marquerEchec(v.cleIdempotence, "HTTP ${e.code()}")
            } catch (e: Exception) {
                return Result.retry() // réseau : réessayer plus tard
            }
        }
        return Result.success()
    }

    companion object {
        private const val NOM = "sync-versements"

        fun programmer(context: Context) {
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                NOM, ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
                    .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                    .build()
            )
        }

        fun lancerMaintenant(context: Context) {
            WorkManager.getInstance(context).enqueue(
                androidx.work.OneTimeWorkRequestBuilder<SyncWorker>()
                    .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                    .build()
            )
        }
    }
}
