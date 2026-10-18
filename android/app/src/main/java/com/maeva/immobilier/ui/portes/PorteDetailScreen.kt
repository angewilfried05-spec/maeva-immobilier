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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
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
import com.maeva.immobilier.data.api.UniteBody
import com.maeva.immobilier.data.api.UniteDetail
import com.maeva.immobilier.data.api.messageErreur
import com.maeva.immobilier.ui.theme.fcfa
import com.maeva.immobilier.ui.theme.moisFr
import kotlinx.coroutines.launch

/** Détail d'une porte : historique des occupations + modifier/supprimer/occuper. */
@Composable
fun PorteDetailScreen(
    app: MaevaApp,
    uniteId: Int,
    onOccuper: (Int) -> Unit = {},
    onSupprimee: () -> Unit = {},
) {
    val scope = rememberCoroutineScope()
    var rafraichi by remember { mutableStateOf(0) }
    var modifOuverte by remember { mutableStateOf(false) }
    var supprOuverte by remember { mutableStateOf(false) }
    var erreur by remember { mutableStateOf<String?>(null) }

    val role by produceState<String?>(initialValue = null) { value = app.session.role() }
    val gestion = role == "admin" || role == "gerant"
    val admin = role == "admin"

    val unite by produceState<UniteDetail?>(initialValue = null, rafraichi) {
        try { value = app.reseau.api().unite(uniteId) } catch (_: Exception) { }
    }
    val batiments by produceState<List<Batiment>>(initialValue = emptyList()) {
        try { value = app.reseau.api().batiments() } catch (_: Exception) { }
    }

    Column(Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState())) {
        val u = unite
        if (u == null) {
            CircularProgressIndicator(Modifier.padding(top = 40.dp))
            return@Column
        }

        val occupee = u.occupations.any { it.statut == "Actif" }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically) {
            Text(
                listOfNotNull(u.batiment, u.porte).joinToString(" · "),
                style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold,
            )
            if (!occupee) {
                Badge(containerColor = MaterialTheme.colorScheme.tertiaryContainer) {
                    Text("Libre", Modifier.padding(4.dp))
                }
            }
        }
        u.loyer_base?.let {
            Text("Loyer de base : ${fcfa(it)}", style = MaterialTheme.typography.bodyMedium)
        }

        if (gestion) {
            Row {
                TextButton(onClick = { modifOuverte = true }) { Text("Modifier") }
                if (!occupee) {
                    TextButton(onClick = { onOccuper(u.id) }) { Text("Occuper") }
                }
                if (admin && u.occupations.isEmpty()) {
                    TextButton(onClick = { supprOuverte = true }) {
                        Text("Supprimer", color = MaterialTheme.colorScheme.error)
                    }
                }
            }
        }
        erreur?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Spacer(Modifier.height(8.dp))

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

    val u = unite ?: return
    if (modifOuverte) {
        DialogPorte(
            batiments = batiments,
            titre = "Modifier la porte",
            porteInit = u.porte ?: "",
            loyerInit = (u.loyer_base ?: 0).toString(),
            batimentFixe = null,
            onFermer = { modifOuverte = false },
            onValider = { batimentId, porte, loyerBase ->
                scope.launch {
                    try {
                        app.reseau.api().majUnite(u.id, UniteBody(batimentId, porte.ifBlank { null }, loyerBase))
                        modifOuverte = false; rafraichi++
                    } catch (e: Exception) { erreur = messageErreur(e); modifOuverte = false }
                }
            },
        )
    }
    if (supprOuverte) {
        AlertDialog(
            onDismissRequest = { supprOuverte = false },
            title = { Text("Supprimer cette porte ?") },
            text = { Text("La porte ${u.porte ?: ""} sera supprimée définitivement.") },
            confirmButton = {
                TextButton(onClick = {
                    supprOuverte = false
                    scope.launch {
                        try {
                            val rep = app.reseau.api().supprUnite(u.id)
                            if (rep.isSuccessful) onSupprimee() else erreur = "Suppression refusée (${rep.code()})"
                        } catch (e: Exception) { erreur = messageErreur(e) }
                    }
                }) { Text("Supprimer", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { supprOuverte = false }) { Text("Annuler") } },
        )
    }
}
