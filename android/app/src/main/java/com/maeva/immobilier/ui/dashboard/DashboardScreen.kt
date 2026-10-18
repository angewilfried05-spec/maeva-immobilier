package com.maeva.immobilier.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MeetingRoom
import androidx.compose.material.icons.filled.MoneyOff
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Savings
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.maeva.immobilier.MaevaApp
import com.maeva.immobilier.data.api.Dashboard
import com.maeva.immobilier.data.api.RefreshBody
import com.maeva.immobilier.ui.theme.Bleu
import com.maeva.immobilier.ui.theme.BleuFonce
import com.maeva.immobilier.ui.theme.CarteMaeva
import com.maeva.immobilier.ui.theme.EnTete
import com.maeva.immobilier.ui.theme.Or
import com.maeva.immobilier.ui.theme.PastilleIcone
import com.maeva.immobilier.ui.theme.Puce
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
    val role by produceState<String?>(initialValue = null) { value = app.session.role() }
    val enAttente by app.db.fileDao().observerToutes().collectAsState(initial = emptyList())

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
    ) {
        // En-tête dégradé identité MAEVA
        Box(
            Modifier
                .fillMaxWidth()
                .background(
                    Brush.linearGradient(
                        listOf(BleuFonce, Bleu, Color(0xFF2E6FB5)),
                    )
                )
                .padding(horizontal = 20.dp, vertical = 22.dp),
        ) {
            Column {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column {
                        Text(
                            "Bonjour,",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color.White.copy(alpha = 0.75f),
                        )
                        Text(
                            nom ?: "…",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                    }
                    IconButton(onClick = {
                        scope.launch {
                            try { app.session.refresh()?.let { app.reseau.api().logout(RefreshBody(it)) } } catch (_: Exception) { }
                            app.session.effacer()
                        }
                    }) {
                        Icon(
                            Icons.AutoMirrored.Filled.Logout,
                            contentDescription = "Déconnexion",
                            tint = Color.White,
                        )
                    }
                }
                Spacer(Modifier.height(14.dp))
                val r = dash?.resume
                Text(
                    "Solde — ${moisFr(mois)}",
                    style = MaterialTheme.typography.labelLarge,
                    color = Color.White.copy(alpha = 0.75f),
                )
                Text(
                    fcfa(r?.solde ?: 0),
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White,
                )
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Puce(
                        "Perçu ${fcfa(r?.total_loyers_percus ?: 0)}",
                        fond = Color.White.copy(alpha = 0.16f),
                        couleur = Color.White,
                    )
                    Puce(
                        "Attendu ${fcfa(r?.total_loyers_attendus ?: 0)}",
                        fond = Or.copy(alpha = 0.9f),
                        couleur = Color.White,
                    )
                }
            }
        }

        Column(Modifier.padding(horizontal = 16.dp, vertical = 14.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Vue d'ensemble",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Puce(
                    role ?: "",
                    fond = MaterialTheme.colorScheme.tertiaryContainer,
                    couleur = MaterialTheme.colorScheme.onTertiaryContainer,
                )
            }
            Spacer(Modifier.height(4.dp))

            val d = dash
            if (d == null) {
                Text(
                    "Chargement… ou serveur injoignable",
                    modifier = Modifier.padding(20.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                if (d.alertes?.mois_cloture == true) {
                    Banniere(Icons.Default.Lock, "Mois clôturé — écritures figées",
                        MaterialTheme.colorScheme.surfaceVariant,
                        MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (enAttente.isNotEmpty()) {
                    Banniere(Icons.Default.Payments,
                        "${enAttente.size} encaissement(s) hors-ligne en attente d'envoi",
                        MaterialTheme.colorScheme.tertiaryContainer,
                        MaterialTheme.colorScheme.onTertiaryContainer)
                }
                if ((d.alertes?.dette_totale ?: 0) > 0) {
                    Banniere(Icons.Default.WarningAmber,
                        "Dette locataires : ${fcfa(d.alertes?.dette_totale)}",
                        MaterialTheme.colorScheme.errorContainer,
                        MaterialTheme.colorScheme.onErrorContainer)
                }
                Spacer(Modifier.height(4.dp))

                val tuiles = listOf(
                    Tuile("Loyers perçus", fcfa(d.resume?.total_loyers_percus ?: 0), Icons.Default.Payments,
                        MaterialTheme.colorScheme.secondaryContainer, Vert),
                    Tuile("Loyers attendus", fcfa(d.resume?.total_loyers_attendus ?: 0), Icons.AutoMirrored.Filled.ReceiptLong,
                        MaterialTheme.colorScheme.primaryContainer, Bleu),
                    Tuile("Dépenses", fcfa(d.resume?.total_depenses ?: 0), Icons.Default.MoneyOff,
                        MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.onSurfaceVariant),
                    Tuile("Portes libres", "${d.alertes?.portes_libres ?: 0}", Icons.Default.MeetingRoom,
                        MaterialTheme.colorScheme.tertiaryContainer, Or),
                    Tuile("Cautions détenues", fcfa(d.cautions_detenues), Icons.Default.Savings,
                        MaterialTheme.colorScheme.primaryContainer, Bleu),
                    Tuile("Dette locataires", fcfa(d.alertes?.dette_totale ?: 0), Icons.Default.WarningAmber,
                        MaterialTheme.colorScheme.errorContainer, Rouge),
                )
                tuiles.chunked(2).forEach { paire ->
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        TuileStat(paire[0], Modifier.weight(1f))
                        paire.getOrNull(1)?.let { TuileStat(it, Modifier.weight(1f)) }
                            ?: Spacer(Modifier.weight(1f))
                    }
                }
            }

            Spacer(Modifier.height(8.dp))
            androidx.compose.material3.TextButton(
                onClick = onHistorique,
                modifier = Modifier.align(Alignment.CenterHorizontally),
            ) { Text("Historique des mois →") }
            Spacer(Modifier.height(12.dp))
        }
    }
}

private data class Tuile(
    val libelle: String,
    val valeur: String,
    val icone: ImageVector,
    val fond: Color,
    val accent: Color,
)

@Composable
private fun TuileStat(t: Tuile, modifier: Modifier = Modifier) {
    CarteMaeva(modifier = modifier) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            PastilleIcone(t.icone, fond = t.fond, couleur = t.accent, taille = 38)
            Spacer(Modifier.width(10.dp))
            Column {
                Text(
                    t.valeur,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = t.accent,
                )
                Text(
                    t.libelle,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                )
            }
        }
    }
}

@Composable
private fun Banniere(icone: ImageVector, texte: String, fond: Color, couleur: Color) {
    Card(
        Modifier.fillMaxWidth().padding(vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = fond),
        shape = MaterialTheme.shapes.medium,
    ) {
        Row(
            Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(icone, contentDescription = null, tint = couleur)
            Spacer(Modifier.width(10.dp))
            Text(texte, color = couleur, fontWeight = FontWeight.Medium,
                style = MaterialTheme.typography.bodyMedium)
        }
    }
}
