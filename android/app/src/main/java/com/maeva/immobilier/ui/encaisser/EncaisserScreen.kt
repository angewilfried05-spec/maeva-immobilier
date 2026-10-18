package com.maeva.immobilier.ui.encaisser

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.maeva.immobilier.MaevaApp
import com.maeva.immobilier.data.api.Dashboard
import com.maeva.immobilier.data.api.Locataire
import com.maeva.immobilier.data.api.VersementBody
import com.maeva.immobilier.data.local.VersementEnAttente
import com.maeva.immobilier.data.sync.SyncWorker
import com.maeva.immobilier.ui.theme.AvatarInitiales
import com.maeva.immobilier.ui.theme.CarteMaeva
import com.maeva.immobilier.ui.theme.EnTete
import com.maeva.immobilier.ui.theme.Puce
import com.maeva.immobilier.ui.theme.Vert
import com.maeva.immobilier.ui.theme.fcfa
import com.maeva.immobilier.ui.theme.moisFr
import kotlinx.coroutines.launch
import java.text.Normalizer
import java.time.LocalDate
import java.util.UUID

private val MODES = listOf("Espèces", "Mobile Money", "Virement", "Chèque")
private val OBJETS = listOf("loyer" to "Loyer", "arriere" to "Arriéré", "avance" to "Avance")
private val MOIS_RE = Regex("\\d{4}-\\d{2}")
private val DATE_RE = Regex("\\d{4}-\\d{2}-\\d{2}")

private fun sansAccent(s: String): String =
    Normalizer.normalize(s, Normalizer.Form.NFD).replace("\\p{M}".toRegex(), "").lowercase()

/** Flux de caissier : locataire → montant → quittance (ou file hors-ligne). */
@Composable
fun EncaisserScreen(app: MaevaApp) {
    val mois = LocalDate.now().toString().substring(0, 7)
    val scope = rememberCoroutineScope()
    var recherche by remember { mutableStateOf("") }
    var choisi by remember { mutableStateOf<Locataire?>(null) }
    var montant by remember { mutableStateOf("") }
    var mode by remember { mutableStateOf("Espèces") }
    var note by remember { mutableStateOf("") }
    var objet by remember { mutableStateOf("loyer") }
    var moisConcerne by remember { mutableStateOf(mois) }
    var datePaiement by remember { mutableStateOf(LocalDate.now().toString()) }
    var enCours by remember { mutableStateOf(false) }
    var quittance by remember { mutableStateOf<String?>(null) }
    var info by remember { mutableStateOf<String?>(null) }
    var erreur by remember { mutableStateOf<String?>(null) }
    // Générée au choix du locataire : un renvoi ne crée jamais de doublon
    var cle by remember { mutableStateOf<String?>(null) }

    val dash by produceState<Dashboard?>(initialValue = null) {
        try { value = app.reseau.api().dashboard(mois) } catch (_: Exception) { }
    }
    val actifs = dash?.locataires?.filter { it.statut != "Vide" } ?: emptyList()
    val resultats = (if (recherche.isBlank()) actifs
        else actifs.filter {
            sansAccent("${it.nom_locataire} ${it.numero_porte ?: ""}").contains(sansAccent(recherche))
        }).sortedBy { it.nom_locataire }

    Column(Modifier.fillMaxSize()) {
        EnTete("Encaisser", "Mois comptable : ${moisFr(mois)}")

        Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        if (dash?.alertes?.mois_cloture == true) {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                Text("Mois clôturé : encaissement impossible", Modifier.padding(12.dp))
            }
            Spacer(Modifier.height(10.dp))
        }

        if (quittance != null) {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                Column(Modifier.padding(16.dp)) {
                    Text("Versement enregistré", fontWeight = FontWeight.Bold, color = Vert)
                    Text("Quittance $quittance", style = MaterialTheme.typography.bodyLarge)
                    Spacer(Modifier.height(10.dp))
                    Button(onClick = {
                        choisi = null; quittance = null; montant = ""; note = ""; cle = null
                        objet = "loyer"; moisConcerne = mois; datePaiement = LocalDate.now().toString()
                    }) { Text("Nouvel encaissement") }
                }
            }
        } else if (choisi == null) {
            OutlinedTextField(
                value = recherche, onValueChange = { recherche = it },
                label = { Text("Locataire (nom ou porte)") },
                singleLine = true, modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(resultats) { l ->
                    val sit = dash?.situations?.get(l.id.toString())
                    CarteMaeva(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            choisi = l; recherche = ""; erreur = null
                            cle = UUID.randomUUID().toString()
                            moisConcerne = mois
                            datePaiement = LocalDate.now().toString()
                            montant = when {
                                (sit?.dette ?: 0) > 0 -> sit!!.dette.toString()
                                else -> (sit?.loyer ?: l.loyer_mensuel).toString()
                            }
                            objet = if ((sit?.dette ?: 0) > 0) "arriere" else "loyer"
                        },
                    ) {
                        Row(
                            Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            AvatarInitiales(l.nom_locataire)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(l.nom_locataire, fontWeight = FontWeight.SemiBold)
                                Text(l.numero_porte ?: "", style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            when {
                                sit == null -> {}
                                sit.dette > 0 -> Puce(
                                    "Doit ${fcfa(sit.dette)}",
                                    fond = MaterialTheme.colorScheme.errorContainer,
                                    couleur = MaterialTheme.colorScheme.onErrorContainer,
                                )
                                else -> Puce(
                                    "À jour",
                                    fond = MaterialTheme.colorScheme.secondaryContainer,
                                    couleur = MaterialTheme.colorScheme.onSecondaryContainer,
                                )
                            }
                        }
                    }
                }
            }
        } else {
            val l = choisi!!
            CarteMaeva(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(18.dp).verticalScroll(rememberScrollState())) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(l.nom_locataire, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        TextButton(onClick = { choisi = null; cle = null }) { Text("Changer") }
                    }
                    val sit = dash?.situations?.get(l.id.toString())
                    sit?.let {
                        if (it.dette > 0) Text("Dette : ${fcfa(it.dette)} (${it.dette_mois.toInt()} mois)",
                            color = MaterialTheme.colorScheme.error)
                        else if (it.paye_jusqu_a != null) Text("Payé jusqu'à ${moisFr(it.paye_jusqu_a)}", color = Vert)
                    }
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = montant, onValueChange = { montant = it.filter { c -> c.isDigit() } },
                        label = { Text("Montant (FCFA)") }, singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        val loyer = sit?.loyer ?: l.loyer_mensuel
                        listOf(1, 2, 3).forEach { n ->
                            AssistChip(onClick = { montant = (loyer * n).toString() }, label = { Text("${n}m") })
                        }
                        if ((sit?.dette ?: 0) > 0) {
                            AssistChip(onClick = { montant = sit!!.dette.toString() }, label = { Text("Dette") })
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                    Text("Objet du versement", style = MaterialTheme.typography.labelMedium)
                    Row(
                        Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        OBJETS.forEach { (v, l) ->
                            FilterChip(selected = objet == v, onClick = { objet = v }, label = { Text(l) })
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = moisConcerne, onValueChange = { moisConcerne = it },
                            label = { Text("Mois concerné (AAAA-MM)") }, singleLine = true,
                            isError = moisConcerne.isNotBlank() && !MOIS_RE.matches(moisConcerne),
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = datePaiement, onValueChange = { datePaiement = it },
                            label = { Text("Date (AAAA-MM-JJ)") }, singleLine = true,
                            isError = datePaiement.isNotBlank() && !DATE_RE.matches(datePaiement),
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (objet == "arriere") {
                        Text("Arriéré : le versement sera rattaché au mois choisi.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    }
                    Spacer(Modifier.height(10.dp))
                    Text("Mode de paiement", style = MaterialTheme.typography.labelMedium)
                    Row(
                        Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        MODES.forEach { m ->
                            FilterChip(selected = mode == m, onClick = { mode = m }, label = { Text(m) })
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = note, onValueChange = { note = it },
                        label = { Text("Note (optionnel)") }, singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    erreur?.let { Spacer(Modifier.height(8.dp)); Text(it, color = MaterialTheme.colorScheme.error) }
                    info?.let { Spacer(Modifier.height(8.dp)); Text(it, color = Vert) }
                    Spacer(Modifier.height(14.dp))
                    Button(
                        enabled = !enCours && (montant.toIntOrNull() ?: 0) > 0
                            && MOIS_RE.matches(moisConcerne)
                            && dash?.alertes?.mois_cloture != true,
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            val m = montant.toIntOrNull() ?: return@Button
                            enCours = true; erreur = null; info = null
                            scope.launch {
                                try {
                                    val v = app.reseau.api().versement(
                                        VersementBody(
                                            locataire_id = l.id, mois = moisConcerne, montant = m,
                                            date_versement = datePaiement.takeIf { DATE_RE.matches(it) },
                                            mode = mode, note = note.ifBlank { null }, type = objet,
                                            cle_idempotence = cle,
                                        )
                                    )
                                    quittance = v.numero_quittance ?: "n°${v.id}"
                                } catch (e: Exception) {
                                    // Hors-ligne : on met en file — la clé d'idempotence
                                    // garantit qu'il ne sera jamais compté en double.
                                    app.db.fileDao().ajouter(
                                        VersementEnAttente(
                                            cleIdempotence = cle ?: UUID.randomUUID().toString(),
                                            locataireId = l.id, nomLocataire = l.nom_locataire,
                                            mois = moisConcerne, montant = m, mode = mode,
                                            note = note.ifBlank { null }, type = objet,
                                            dateVersement = datePaiement.takeIf { DATE_RE.matches(it) },
                                        )
                                    )
                                    SyncWorker.lancerMaintenant(app)
                                    info = "Pas de réseau : ${fcfa(m)} mis en file, envoyé automatiquement"
                                    quittance = "en attente d'envoi"
                                }
                                enCours = false
                            }
                        },
                    ) { Text(if (enCours) "Enregistrement…" else "Encaisser ${if (montant.isNotBlank()) fcfa(montant.toInt()) else ""}") }
                }
            }
        }
        }
    }
}
