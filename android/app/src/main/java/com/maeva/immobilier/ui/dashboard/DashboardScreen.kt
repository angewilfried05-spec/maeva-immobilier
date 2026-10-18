package com.maeva.immobilier.ui.dashboard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.maeva.immobilier.MaevaApp
import com.maeva.immobilier.data.api.Dashboard
import com.maeva.immobilier.data.api.RefreshBody
import com.maeva.immobilier.ui.theme.Rouge
import com.maeva.immobilier.ui.theme.Vert
import com.maeva.immobilier.ui.theme.fcfa
import com.maeva.immobilier.ui.theme.moisFr
import kotlinx.coroutines.launch
import java.time.LocalDate

@Composable
fun DashboardScreen(app: MaevaApp, onHistorique: () -> Unit = {}) {
    val mois = LocalDate.now().toString().substring(0, 7)
    val scope = rememberCoroutineScope()
    val dash by produceState<Dashboard?>(initialValue = null) {
        try { value = app.reseau.api().dashboard(mois) } catch (_: Exception) { }
    }
    val nom by produceState<String?>(initialValue = null) { value = app.session.nomComplet() }
    val enAttente by app.db.fileDao().observerToutes().collectAsState(initial = emptyList())

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column {
                Text("Tableau de bord", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text(moisFr(mois), style = MaterialTheme.typography.bodyMedium)
            }
            TextButton(onClick = {
                scope.launch {
                    try { app.session.refresh()?.let { app.reseau.api().logout(RefreshBody(it)) } } catch (_: Exception) { }
                    app.session.effacer()
                }
            }) { Text("Déconnexion") }
        }
        nom?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        TextButton(onClick = onHistorique) { Text("Historique des mois →") }

        Spacer(Modifier.height(6.dp))
        val d = dash
        if (d == null) {
            Text("Chargement… ou serveur injoignable", modifier = Modifier.padding(20.dp))
        } else {
            val r = d.resume
            if (d.alertes?.mois_cloture == true) {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                    Text("Mois clôturé — écritures figées", modifier = Modifier.padding(12.dp))
                }
                Spacer(Modifier.height(10.dp))
            }
            if (enAttente.isNotEmpty()) {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)) {
                    Text(
                        "${enAttente.size} encaissement(s) hors-ligne en attente d'envoi",
                        modifier = Modifier.padding(12.dp),
                    )
                }
                Spacer(Modifier.height(10.dp))
            }
            Carte("Loyers perçus", fcfa(r?.total_loyers_percus ?: 0), Vert)
            Carte("Loyers attendus", fcfa(r?.total_loyers_attendus ?: 0), null)
            Carte("Dépenses", fcfa(r?.total_depenses ?: 0), null)
            Carte("Solde", fcfa(r?.solde ?: 0), if ((r?.solde ?: 0) >= 0) Vert else Rouge)
            Carte("Dette des locataires", fcfa(d.alertes?.dette_totale ?: 0), Rouge)
            Carte("Portes libres", "${d.alertes?.portes_libres ?: 0}", null)
            Carte("Cautions détenues", fcfa(d.cautions_detenues), null)
        }
    }
}

@Composable
private fun Carte(libelle: String, valeur: String, couleur: androidx.compose.ui.graphics.Color?) {
    Card(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Column(Modifier.padding(14.dp)) {
            Text(libelle, style = MaterialTheme.typography.labelMedium)
            Text(valeur, style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold, color = couleur ?: MaterialTheme.colorScheme.onSurface)
        }
    }
}
