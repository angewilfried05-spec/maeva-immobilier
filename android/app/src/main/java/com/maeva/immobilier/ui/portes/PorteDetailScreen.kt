package com.maeva.immobilier.ui.portes

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
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
import com.maeva.immobilier.ui.theme.AvatarInitiales
import com.maeva.immobilier.ui.theme.CarteMaeva
import com.maeva.immobilier.ui.theme.EnTete
import com.maeva.immobilier.ui.theme.Puce
import com.maeva.immobilier.ui.theme.Vert
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
    onOuvrirLocataire: (Int) -> Unit = {},
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

    val u0 = unite
    if (u0 == null) {
        Column(Modifier.fillMaxSize()) {
            EnTete("Porte")
            CircularProgressIndicator(Modifier.padding(top = 40.dp, start = 20.dp))
        }
        return
    }
    val occupee = u0.occupations.any { it.statut == "Actif" }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        EnTete(
            titre = listOfNotNull(u0.batiment, u0.porte).joinToString(" · "),
            sousTitre = u0.loyer_base?.let { "Loyer de base : ${fcfa(it)}" },
        ) {
            if (occupee) {
                Puce("Occupée", fond = MaterialTheme.colorScheme.secondaryContainer,
                    couleur = MaterialTheme.colorScheme.onSecondaryContainer)
            } else {
                Puce("Libre", fond = MaterialTheme.colorScheme.tertiaryContainer,
                    couleur = MaterialTheme.colorScheme.onTertiaryContainer)
            }
        }

        Column(Modifier.padding(horizontal = 16.dp)) {
        if (gestion) {
            Row {
                TextButton(onClick = { modifOuverte = true }) { Text("Modifier") }
                if (!occupee) {
                    TextButton(onClick = { onOccuper(u0.id) }) { Text("Occuper") }
                }
                if (admin && u0.occupations.isEmpty()) {
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
        CarteMaeva {
            Column {
                if (u0.occupations.isEmpty()) {
                    Text("Jamais occupée", Modifier.padding(16.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                u0.occupations.forEachIndexed { i, o ->
                    Row(
                        Modifier.fillMaxWidth().clickable { onOuvrirLocataire(o.id) }.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        AvatarInitiales(o.nom_locataire, taille = 38)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(o.nom_locataire, fontWeight = FontWeight.SemiBold)
                            Text(
                                listOfNotNull(
                                    "Loyer ${fcfa(o.loyer_mensuel)}",
                                    o.debut_suivi?.take(7)?.let { "depuis ${moisFr(it)}" },
                                    o.mois_sortie?.let { "sortie ${moisFr(it)}" },
                                ).joinToString(" · "),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        if (o.statut == "Actif") {
                            Puce("En place", fond = MaterialTheme.colorScheme.secondaryContainer,
                                couleur = Vert)
                        } else {
                            Puce("Parti")
                        }
                    }
                    if (i < u0.occupations.size - 1) HorizontalDivider()
                }
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
