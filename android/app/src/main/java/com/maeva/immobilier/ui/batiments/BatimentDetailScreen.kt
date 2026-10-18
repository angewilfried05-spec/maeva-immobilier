package com.maeva.immobilier.ui.batiments

import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Badge
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.maeva.immobilier.MaevaApp
import com.maeva.immobilier.data.api.Batiment
import com.maeva.immobilier.data.api.Unite
import com.maeva.immobilier.data.api.UniteBody
import com.maeva.immobilier.data.api.messageErreur
import com.maeva.immobilier.ui.portes.DialogPorte
import com.maeva.immobilier.ui.theme.Vert
import com.maeva.immobilier.ui.theme.fcfa
import kotlinx.coroutines.launch

/** Détail d'un bâtiment : ses portes et leurs occupants. */
@Composable
fun BatimentDetailScreen(app: MaevaApp, batimentId: Int, onOuvrirPorte: (Int) -> Unit) {
    val scope = rememberCoroutineScope()
    var rafraichi by remember { mutableStateOf(0) }
    var creationOuverte by remember { mutableStateOf(false) }
    var erreur by remember { mutableStateOf<String?>(null) }

    val role by produceState<String?>(initialValue = null) { value = app.session.role() }
    val gestion = role == "admin" || role == "gerant"

    val batiment by produceState<Batiment?>(initialValue = null, rafraichi) {
        try { value = app.reseau.api().batiments().firstOrNull { it.id == batimentId } } catch (_: Exception) { }
    }
    val portes by produceState<List<Unite>?>(initialValue = null, rafraichi) {
        try { value = app.reseau.api().unites().filter { it.batiment_id == batimentId } } catch (_: Exception) { }
    }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(batiment?.nom ?: "Bâtiment", style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold)
                batiment?.adresse?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                }
            }
            if (gestion) TextButton(onClick = { creationOuverte = true }) { Text("+ Porte") }
        }
        val libres = portes?.count { it.statut == "libre" } ?: 0
        Text("$libres libre(s) sur ${portes?.size ?: 0} portes",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
        erreur?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Spacer(Modifier.height(8.dp))

        val liste = portes
        if (liste == null) {
            Text("Chargement…", style = MaterialTheme.typography.bodyMedium)
        } else {
            LazyColumn {
                items(liste, key = { it.id }) { u ->
                    Row(
                        Modifier.fillMaxWidth().clickable { onOuvrirPorte(u.id) }
                            .padding(vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(u.porte ?: "(sans nom)", fontWeight = FontWeight.SemiBold)
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

    if (creationOuverte && batiment != null) {
        DialogPorte(
            batiments = listOf(batiment!!),
            titre = "Nouvelle porte — ${batiment!!.nom}",
            batimentFixe = batimentId,
            onFermer = { creationOuverte = false },
            onValider = { bid, porte, loyerBase ->
                scope.launch {
                    try {
                        app.reseau.api().creerUnite(UniteBody(bid, porte.ifBlank { null }, loyerBase))
                        creationOuverte = false; rafraichi++
                    } catch (e: Exception) { erreur = messageErreur(e); creationOuverte = false }
                }
            },
        )
    }
}
