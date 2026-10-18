package com.maeva.immobilier.data

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.maeva.immobilier.MaevaApp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Request
import java.io.File
import java.io.IOException

/**
 * Télécharge une quittance PDF via l'API authentifiée, puis l'ouvre dans
 * le lecteur PDF du téléphone (ou la partage). Les fichiers restent dans
 * le cache privé de l'app.
 */
object Quittances {

    suspend fun telecharger(context: Context, app: MaevaApp, versementId: Int, numero: String?): File =
        withContext(Dispatchers.IO) {
            val url = app.session.serveur() + "/api/v1/versements/$versementId/quittance"
            val req = Request.Builder().url(url).build()
            app.reseau.client().newCall(req).execute().use { rep ->
                if (!rep.isSuccessful) throw IOException("Quittance indisponible (${rep.code})")
                val dir = File(context.cacheDir, "quittances").apply { mkdirs() }
                val f = File(dir, "quittance-${numero ?: versementId}.pdf")
                val body = rep.body ?: throw IOException("Réponse vide")
                body.byteStream().use { entree -> f.outputStream().use { entree.copyTo(it) } }
                f
            }
        }

    fun ouvrir(context: Context, fichier: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fichiers", fichier)
        val intent = Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, "application/pdf")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        try {
            context.startActivity(intent)
        } catch (e: Exception) {
            // Pas de lecteur PDF : on propose le partage à la place
            val partage = Intent(Intent.ACTION_SEND)
                .setType("application/pdf")
                .putExtra(Intent.EXTRA_STREAM, uri)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            context.startActivity(Intent.createChooser(partage, "Quittance"))
        }
    }
}
