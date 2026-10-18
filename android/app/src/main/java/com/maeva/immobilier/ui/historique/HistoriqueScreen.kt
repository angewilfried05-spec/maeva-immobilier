package com.maeva.immobilier.ui.historique

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Badge
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import com.maeva.immobilier.data.api.ClotureBody
import com.maeva.immobilier.data.api.ResumeMois
import com.maeva.immobilier.ui.theme.Vert
import com.maeva.immobilier.ui.theme.fcfa
import com.maeva.immobilier.ui.theme.moisFr
import kotlinx.coroutines.launch

/** Historique des mois : chiffres + état de clôture. Clôturer = admin/gérant, déclôturer = admin. */
@Composable
fun HistoriqueScreen(app: MaevaApp) {
    val scope = rememberCoroutineScope()
    var rafraichi by remember { mutableStateOf(0) }
    var enCours by remember { mutableStateOf<String?>(null) }
    var erreur by remember { mutableStateOf<String?>(null) }

    val resumes by produceState<List<ResumeMois>?>(initialValue = null, rafraichi) {
        try { value = app.reseau.api().resumes() } catch (_: Exception) { }
    }
    val role by produceState<String?>(initialValue = null) { value = app.session.role() }
    val peutCloturer = role == "admin" || role == "gerant"
    val peutDecloturer = role == "admin"

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Historique des mois", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        erreur?.let { Text(it, color = MaterialTheme.colorScheme.error) }

        val liste = resumes
        if (liste == null) {
            CircularProgressIndicator(Modifier.padding(top = 40.dp))
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(liste, key = { it.mois }) { r ->
                    Card(
                        Modifier.fillMaxWidth(),
                        colors = if (r.cloture) CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant
                        ) else CardDefaults.cardColors(),
                    ) {
                        Column(Modifier.padding(14.dp)) {
                            Row(
                                Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(moisFr(r.mois), fontWeight = FontWeight.Bold,
                                    style = MaterialTheme.typography.titleMedium)
                                if (r.cloture) {
                                    Badge(containerColor = MaterialTheme.colorScheme.secondaryContainer) {
                                        Text("Clôturé", Modifier.padding(4.dp))
                                    }
                                }
                            }
                            Text(
                                "Perçus ${fcfa(r.total_loyers_percus)} / attendus ${fcfa(r.total_loyers_attendus)}",
                                style = MaterialTheme.typography.bodySmall,
                            )
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(
                                    "Dépenses ${fcfa(r.total_depenses)}",
                                    style = MaterialTheme.typography.bodySmall,
                                )
                                Text(
                                    "Solde ${fcfa(r.solde)}",
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.SemiBold,
                                    color = if ((r.solde ?: 0) >= 0) Vert else MaterialTheme.colorScheme.error,
                                )
                            }
                            r.montant_remis_au_proprietaire?.let {
                                Text("Remis au propriétaire : ${fcfa(it)}",
                                    style = MaterialTheme.typography.bodySmall)
                            }
                            if (r.cloture && r.cloture_par != null) {
                                Text("Clôturé par ${r.cloture_par}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
                            }

                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                                when {
                                    enCours == r.mois -> CircularProgressIndicator(
                                        Modifier.padding(4.dp).height(20.dp), strokeWidth = 2.dp)
                                    !r.cloture && peutCloturer -> TextButton(onClick = {
                                        enCours = r.mois; erreur = null
                                        scope.launch {
                                            try {
                                                app.reseau.api().cloturer(r.mois, ClotureBody())
                                                rafraichi++
                                            } catch (e: Exception) {
                                                erreur = "Clôture impossible"
                                            }
                                            enCours = null
                                        }
                                    }) { Text("Clôturer") }
                                    r.cloture && peutDecloturer -> TextButton(onClick = {
                                        enCours = r.mois; erreur = null
                                        scope.launch {
                                            try {
                                                app.reseau.api().decloturer(r.mois)
                                                rafraichi++
                                            } catch (e: Exception) {
                                                erreur = "Déclôture impossible"
                                            }
                                            enCours = null
                                        }
                                    }) { Text("Déclôturer") }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
