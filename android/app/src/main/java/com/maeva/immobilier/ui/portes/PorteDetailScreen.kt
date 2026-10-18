package com.maeva.immobilier.ui.portes

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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.maeva.immobilier.MaevaApp
import com.maeva.immobilier.data.api.UniteDetail
import com.maeva.immobilier.ui.theme.fcfa
import com.maeva.immobilier.ui.theme.moisFr

/** Détail d'une porte : historique complet de ses occupations. */
@Composable
fun PorteDetailScreen(app: MaevaApp, uniteId: Int) {
    val unite by produceState<UniteDetail?>(initialValue = null) {
        try { value = app.reseau.api().unite(uniteId) } catch (_: Exception) { }
    }

    Column(Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState())) {
        val u = unite
        if (u == null) {
            CircularProgressIndicator(Modifier.padding(top = 40.dp))
            return@Column
        }

        Text(
            listOfNotNull(u.batiment, u.porte).joinToString(" · "),
            style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold,
        )
        u.loyer_base?.let {
            Text("Loyer de base : ${fcfa(it)}", style = MaterialTheme.typography.bodyMedium)
        }
        Spacer(Modifier.height(14.dp))

        Text("Historique des occupations", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        Card {
            Column {
                if (u.occupations.isEmpty()) {
                    Text("Jamais occupée", Modifier.padding(16.dp))
                }
                u.occupations.forEachIndexed { i, o ->
                    Column(Modifier.fillMaxWidth().padding(16.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(o.nom_locataire, fontWeight = FontWeight.SemiBold)
                            Text(
                                if (o.statut == "Actif") "En place" else "Parti",
                                style = MaterialTheme.typography.bodySmall,
                                color = if (o.statut == "Actif") MaterialTheme.colorScheme.secondary
                                else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                            )
                        }
                        Text(
                            listOfNotNull(
                                "Loyer ${fcfa(o.loyer_mensuel)}",
                                o.debut_suivi?.take(7)?.let { "depuis ${moisFr(it)}" },
                                o.mois_sortie?.let { "sortie ${moisFr(it)}" },
                            ).joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                        )
                    }
                    if (i < u.occupations.size - 1) HorizontalDivider()
                }
            }
        }
    }
}
