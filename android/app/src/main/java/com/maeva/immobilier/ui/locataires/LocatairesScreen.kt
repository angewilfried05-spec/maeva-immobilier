package com.maeva.immobilier.ui.locataires

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Badge
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.maeva.immobilier.MaevaApp
import com.maeva.immobilier.data.api.Dashboard
import com.maeva.immobilier.ui.theme.fcfa
import java.text.Normalizer
import java.time.LocalDate

private fun sansAccent(s: String): String =
    Normalizer.normalize(s, Normalizer.Form.NFD).replace("\\p{M}".toRegex(), "").lowercase()

/** Liste des locataires avec recherche et solde ; appui → fiche détaillée. */
@Composable
fun LocatairesScreen(app: MaevaApp, onOuvrir: (Int) -> Unit, onNouveau: () -> Unit = {}) {
    val mois = LocalDate.now().toString().substring(0, 7)
    var recherche by remember { mutableStateOf("") }
    val role by produceState<String?>(initialValue = null) { value = app.session.role() }
    val gestion = role == "admin" || role == "gerant"

    val dash by produceState<Dashboard?>(initialValue = null) {
        try { value = app.reseau.api().dashboard(mois) } catch (_: Exception) { }
    }

    val batiments = dash?.batiments?.associate { it.id to it.nom } ?: emptyMap()
    val liste = dash?.locataires
        ?.filter { it.statut != "Vide" }
        ?.filter {
            recherche.isBlank() || sansAccent("${it.nom_locataire} ${it.numero_porte ?: ""}")
                .contains(sansAccent(recherche))
        }
        ?.sortedBy { it.nom_locataire } ?: emptyList()

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically) {
            Text("Locataires", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            if (gestion) TextButton(onClick = onNouveau) { Text("+ Nouveau") }
        }
        OutlinedTextField(
            value = recherche, onValueChange = { recherche = it },
            label = { Text("Rechercher (nom ou porte)") }, singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
        )
        if (dash == null) {
            Text("Chargement…", style = MaterialTheme.typography.bodyMedium)
        } else {
            LazyColumn {
                items(liste, key = { it.id }) { l ->
                    val sit = dash?.situations?.get(l.id.toString())
                    Row(
                        Modifier.fillMaxWidth().clickable { onOuvrir(l.id) }
                            .padding(vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(l.nom_locataire, fontWeight = FontWeight.SemiBold)
                            Text(
                                listOfNotNull(batiments[l.batiment_id], l.numero_porte)
                                    .joinToString(" · "),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                            )
                        }
                        when {
                            l.statut == "Parti" -> Badge {
                                Text("Parti", Modifier.padding(4.dp))
                            }
                            sit == null -> {}
                            sit.dette > 0 -> Badge(containerColor = MaterialTheme.colorScheme.errorContainer) {
                                Text("Doit ${fcfa(sit.dette)}", Modifier.padding(4.dp))
                            }
                            sit.avance > 0 -> Badge(containerColor = MaterialTheme.colorScheme.secondaryContainer) {
                                Text("Avance ${fcfa(sit.avance)}", Modifier.padding(4.dp))
                            }
                            else -> Badge(containerColor = MaterialTheme.colorScheme.secondaryContainer) {
                                Text("À jour", Modifier.padding(4.dp))
                            }
                        }
                    }
                    HorizontalDivider()
                }
            }
        }
    }
}
