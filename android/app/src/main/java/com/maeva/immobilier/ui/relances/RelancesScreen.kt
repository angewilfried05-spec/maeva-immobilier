package com.maeva.immobilier.ui.relances

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.maeva.immobilier.MaevaApp
import com.maeva.immobilier.data.api.RelancesReponse
import com.maeva.immobilier.ui.theme.fcfa
import com.maeva.immobilier.ui.theme.moisFr
import java.time.LocalDate

@Composable
fun RelancesScreen(app: MaevaApp) {
    val mois = LocalDate.now().toString().substring(0, 7)
    val context = LocalContext.current
    val data by produceState<RelancesReponse?>(initialValue = null) {
        try { value = app.reseau.api().relances(mois) } catch (_: Exception) { }
    }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Relances", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(moisFr(mois), style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(12.dp))
        val d = data
        when {
            d == null -> Text("Chargement…")
            d.relances.isEmpty() -> Text("Aucun locataire en dette.")
            else -> {
                Text(
                    "${d.relances.size} locataire(s) · ${fcfa(d.total_dette)} dus",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
                Spacer(Modifier.height(10.dp))
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(d.relances) { r ->
                        Card(Modifier.fillMaxWidth()) {
                            Row(
                                Modifier.fillMaxWidth().padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(Modifier.weight(1f)) {
                                    Text(r.nom_locataire, fontWeight = FontWeight.SemiBold)
                                    Text(
                                        "${r.batiment ?: ""} ${r.porte ?: ""} — doit ${fcfa(r.dette)} (${r.dette_mois} mois)",
                                        style = MaterialTheme.typography.bodySmall,
                                    )
                                }
                                if (r.whatsapp != null) {
                                    Button(onClick = {
                                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(r.whatsapp)))
                                    }) { Text("WhatsApp") }
                                } else Text("pas de n°", style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
            }
        }
    }
}
