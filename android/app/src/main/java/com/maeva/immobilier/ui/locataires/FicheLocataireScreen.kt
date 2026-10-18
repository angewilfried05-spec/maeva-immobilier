package com.maeva.immobilier.ui.locataires

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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.maeva.immobilier.MaevaApp
import com.maeva.immobilier.data.Quittances
import com.maeva.immobilier.data.api.DepartBody
import com.maeva.immobilier.data.api.FicheLocataire
import com.maeva.immobilier.data.api.messageErreur
import com.maeva.immobilier.ui.theme.Vert
import com.maeva.immobilier.ui.theme.fcfa
import com.maeva.immobilier.ui.theme.moisFr
import kotlinx.coroutines.launch
import java.time.LocalDate

/** Fiche locataire : situation du compte + historique des versements + quittances. */
@Composable
fun FicheLocataireScreen(app: MaevaApp, locataireId: Int, onModifier: () -> Unit = {}) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val mois = LocalDate.now().toString().substring(0, 7)
    var telechargement by remember { mutableStateOf<Int?>(null) }
    var erreur by remember { mutableStateOf<String?>(null) }
    var departOuvert by remember { mutableStateOf(false) }
    var rafraichi by remember { mutableStateOf(0) }

    val role by produceState<String?>(initialValue = null) { value = app.session.role() }
    val gestion = role == "admin" || role == "gerant"

    val fiche by produceState<FicheLocataire?>(initialValue = null, rafraichi) {
        try { value = app.reseau.api().ficheLocataire(locataireId, mois) } catch (_: Exception) { }
    }

    Column(Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState())) {
        val f = fiche
        if (f == null) {
            CircularProgressIndicator(Modifier.padding(top = 40.dp))
            return@Column
        }

        Text(f.nom_locataire, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(
            listOfNotNull(f.numero_porte?.let { "Porte $it" }, f.telephone).joinToString(" · "),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
        )
        if (gestion) {
            Row {
                TextButton(onClick = onModifier) { Text("Modifier") }
                if (f.statut == "Actif") {
                    TextButton(onClick = { departOuvert = true }) {
                        Text("Départ", color = MaterialTheme.colorScheme.error)
                    }
                }
            }
        }
        Spacer(Modifier.height(6.dp))

        f.situation?.let { s ->
            Card {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Loyer")
                        Text(fcfa(s.loyer), fontWeight = FontWeight.SemiBold)
                    }
                    if (s.dette > 0) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Dette", color = MaterialTheme.colorScheme.error)
                            Text("${fcfa(s.dette)} (${s.dette_mois} mois)",
                                fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.error)
                        }
                    }
                    if (s.avance > 0) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Avance", color = Vert)
                            Text(fcfa(s.avance), fontWeight = FontWeight.SemiBold, color = Vert)
                        }
                    }
                    s.paye_jusqu_a?.let {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Payé jusqu'à")
                            Text(moisFr(it), fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
            Spacer(Modifier.height(14.dp))
        }

        Text("Versements", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        Card {
            Column {
                if (f.versements.isEmpty()) {
                    Text("Aucun versement", Modifier.padding(16.dp))
                }
                f.versements.forEachIndexed { i, v ->
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(fcfa(v.montant), fontWeight = FontWeight.SemiBold)
                            Text(
                                listOfNotNull(
                                    moisFr(v.mois),
                                    v.date_versement?.take(10),
                                    v.mode,
                                    v.numero_quittance,
                                ).joinToString(" · "),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                            )
                            v.note?.let {
                                Text(it, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                        if (telechargement == v.id) {
                            CircularProgressIndicator(Modifier.height(24.dp), strokeWidth = 2.dp)
                        } else {
                            TextButton(onClick = {
                                telechargement = v.id; erreur = null
                                scope.launch {
                                    try {
                                        val pdf = Quittances.telecharger(context, app, v.id, v.numero_quittance)
                                        Quittances.ouvrir(context, pdf)
                                    } catch (e: Exception) {
                                        erreur = e.message ?: "Téléchargement impossible"
                                    }
                                    telechargement = null
                                }
                            }) { Text("Quittance") }
                        }
                    }
                    if (i < f.versements.size - 1) HorizontalDivider()
                }
            }
        }
        erreur?.let {
            Spacer(Modifier.height(8.dp))
            Text(it, color = MaterialTheme.colorScheme.error)
        }
    }

    if (departOuvert && fiche != null) {
        DialogDepart(
            f = fiche!!,
            moisDefaut = mois,
            onFermer = { departOuvert = false },
            onConfirmer = { body ->
                departOuvert = false; erreur = null
                scope.launch {
                    try {
                        val rep = app.reseau.api().departLocataire(locataireId, body)
                        if (rep.isSuccessful) rafraichi++ else erreur = "Départ refusé (${rep.code()})"
                    } catch (e: Exception) { erreur = messageErreur(e) }
                }
            },
        )
    }
}

/** Sortie du locataire : retenue sur la dette, remboursement caution, porte libérée. */
@Composable
private fun DialogDepart(
    f: FicheLocataire,
    moisDefaut: String,
    onFermer: () -> Unit,
    onConfirmer: (DepartBody) -> Unit,
) {
    val dette = f.situation?.dette ?: 0
    val cautionDispo = (f.caution ?: 0)
    var moisSortie by remember { mutableStateOf(moisDefaut) }
    var retenue by remember { mutableStateOf(minOf(dette, cautionDispo).toString()) }
    var remboursement by remember { mutableStateOf((cautionDispo - minOf(dette, cautionDispo)).coerceAtLeast(0).toString()) }
    var porteVide by remember { mutableStateOf(true) }
    var depenseRemb by remember { mutableStateOf(true) }

    AlertDialog(
        onDismissRequest = onFermer,
        title = { Text("Départ de ${f.nom_locataire}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (dette > 0) Text("Dette : ${fcfa(dette)}", color = MaterialTheme.colorScheme.error)
                Text("Caution : ${fcfa(cautionDispo)}")
                OutlinedTextField(value = moisSortie, onValueChange = { moisSortie = it },
                    label = { Text("Mois de sortie (AAAA-MM)") }, singleLine = true)
                if (cautionDispo > 0) {
                    OutlinedTextField(
                        value = retenue, onValueChange = { retenue = it.filter { c -> c.isDigit() } },
                        label = { Text("Retenue sur caution (solde la dette)") }, singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                    OutlinedTextField(
                        value = remboursement, onValueChange = { remboursement = it.filter { c -> c.isDigit() } },
                        label = { Text("Caution remboursée") }, singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = porteVide, onCheckedChange = { porteVide = it })
                    Text("Marquer la porte comme libre")
                }
                if (cautionDispo > 0 && (remboursement.toIntOrNull() ?: 0) > 0) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = depenseRemb, onCheckedChange = { depenseRemb = it })
                        Text("Comptabiliser le remboursement en dépense")
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                onConfirmer(DepartBody(
                    mois_sortie = moisSortie,
                    retenue = retenue.toIntOrNull() ?: 0,
                    remboursement = remboursement.toIntOrNull() ?: 0,
                    depense_remboursement = depenseRemb,
                    porte_vide = porteVide,
                ))
            }) { Text("Confirmer le départ", color = MaterialTheme.colorScheme.error) }
        },
        dismissButton = { TextButton(onClick = onFermer) { Text("Annuler") } },
    )
}
