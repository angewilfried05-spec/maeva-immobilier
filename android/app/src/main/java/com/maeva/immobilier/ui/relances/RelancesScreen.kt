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
import android.widget.Toast
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.maeva.immobilier.MaevaApp
import com.maeva.immobilier.data.api.RelancesReponse
import com.maeva.immobilier.data.api.messageErreur
import com.maeva.immobilier.ui.theme.AvatarInitiales
import com.maeva.immobilier.ui.theme.CarteMaeva
import com.maeva.immobilier.ui.theme.EnTete
import com.maeva.immobilier.ui.theme.Puce
import com.maeva.immobilier.ui.theme.fcfa
import com.maeva.immobilier.ui.theme.moisFr
import kotlinx.coroutines.launch
import java.time.LocalDate

@Composable
fun RelancesScreen(app: MaevaApp) {
    val mois = LocalDate.now().toString().substring(0, 7)
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var envoiEnCours by remember { mutableStateOf<Int?>(null) }
    val data by produceState<RelancesReponse?>(initialValue = null) {
        try { value = app.reseau.api().relances(mois) } catch (_: Exception) { }
    }

    Column(Modifier.fillMaxSize()) {
        EnTete("Relances", moisFr(mois))
        val d = data
        Column(Modifier.padding(horizontal = 16.dp)) {
        when {
            d == null -> Text("Chargement…", color = MaterialTheme.colorScheme.onSurfaceVariant)
            d.relances.isEmpty() -> Text(
                "Aucun locataire en dette. Tout est à jour.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            else -> {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Puce(
                        "${d.relances.size} locataire(s)",
                        fond = MaterialTheme.colorScheme.errorContainer,
                        couleur = MaterialTheme.colorScheme.onErrorContainer,
                    )
                    Puce(
                        "${fcfa(d.total_dette)} dus",
                        fond = MaterialTheme.colorScheme.errorContainer,
                        couleur = MaterialTheme.colorScheme.onErrorContainer,
                    )
                }
                Spacer(Modifier.height(10.dp))
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(d.relances) { r ->
                        CarteMaeva(Modifier.fillMaxWidth()) {
                            Row(
                                Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                AvatarInitiales(r.nom_locataire,
                                    fond = MaterialTheme.colorScheme.errorContainer,
                                    couleur = MaterialTheme.colorScheme.onErrorContainer)
                                Spacer(Modifier.width(12.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(r.nom_locataire, fontWeight = FontWeight.SemiBold)
                                    Text(
                                        "${r.batiment ?: ""} ${r.porte ?: ""}".trim(),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                    Text(
                                        "Doit ${fcfa(r.dette)} · ${r.dette_mois.toInt()} mois",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.error,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    if (r.whatsapp != null) {
                                        Button(
                                            onClick = {
                                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(r.whatsapp)))
                                            },
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = com.maeva.immobilier.ui.theme.Vert,
                                            ),
                                        ) { Text("WhatsApp") }
                                        TextButton(
                                            enabled = envoiEnCours == null,
                                            onClick = {
                                                envoiEnCours = r.locataire_id
                                                scope.launch {
                                                    try {
                                                        val rep = app.reseau.api().envoyerRelance(
                                                            r.locataire_id, mapOf("mois" to mois))
                                                        Toast.makeText(context,
                                                            if (rep.isSuccessful) "Relance envoyée au locataire"
                                                            else "WhatsApp du serveur non connecté",
                                                            Toast.LENGTH_LONG).show()
                                                    } catch (e: Exception) {
                                                        Toast.makeText(context, messageErreur(e), Toast.LENGTH_LONG).show()
                                                    }
                                                    envoiEnCours = null
                                                }
                                            },
                                        ) { Text(if (envoiEnCours == r.locataire_id) "Envoi…" else "Envoyer") }
                                    } else Text("pas de n°", style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                }
            }
        }
        }
    }
}
