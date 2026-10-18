package com.maeva.immobilier.ui.portes

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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import com.maeva.immobilier.data.api.Unite
import com.maeva.immobilier.ui.theme.Vert
import com.maeva.immobilier.ui.theme.fcfa

/** Portes physiques : libres / occupées, filtrables. Appui → historique des occupations. */
@Composable
fun PortesScreen(app: MaevaApp, onOuvrir: (Int) -> Unit) {
    var filtre by remember { mutableStateOf("toutes") }
    val unites by produceState<List<Unite>?>(initialValue = null) {
        try { value = app.reseau.api().unites() } catch (_: Exception) { }
    }

    val liste = unites?.filter {
        filtre == "toutes" ||
            (filtre == "libres" && it.statut == "libre") ||
            (filtre == "occupees" && it.statut == "occupee")
    } ?: emptyList()
    val libres = unites?.count { it.statut == "libre" } ?: 0

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Portes", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text("$libres libre(s) sur ${unites?.size ?: 0}", style = MaterialTheme.typography.bodyMedium)
        Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("toutes" to "Toutes", "libres" to "Libres", "occupees" to "Occupées").forEach { (f, label) ->
                FilterChip(selected = filtre == f, onClick = { filtre = f }, label = { Text(label) })
            }
        }
        if (unites == null) {
            Text("Chargement…", style = MaterialTheme.typography.bodyMedium)
        } else {
            LazyColumn {
                items(liste, key = { it.id }) { u ->
                    Row(
                        Modifier.fillMaxWidth().clickable { onOuvrir(u.id) }.padding(vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                listOfNotNull(u.batiment, u.porte).joinToString(" · "),
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                u.nom_locataire
                                    ?: (u.loyer_base?.takeIf { it > 0 }?.let { "Loyer : ${fcfa(it)}" } ?: "—"),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                            )
                        }
                        if (u.statut == "libre") {
                            Badge(containerColor = MaterialTheme.colorScheme.tertiaryContainer) {
                                Text("Libre", Modifier.padding(4.dp))
                            }
                        } else {
                            Badge(containerColor = MaterialTheme.colorScheme.secondaryContainer) {
                                Text("Occupée", Modifier.padding(4.dp), color = Vert)
                            }
                        }
                    }
                    HorizontalDivider()
                }
            }
        }
    }
}
