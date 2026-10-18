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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.maeva.immobilier.MaevaApp
import com.maeva.immobilier.data.api.FicheLocataire
import com.maeva.immobilier.data.api.LocataireBody
import com.maeva.immobilier.data.api.Unite
import com.maeva.immobilier.data.api.messageErreur
import com.maeva.immobilier.ui.theme.EnTete
import com.maeva.immobilier.ui.theme.fcfa
import com.maeva.immobilier.ui.theme.moisFr
import kotlinx.coroutines.launch
import java.time.LocalDate

/**
 * Création (uniteIdPrechoisi ou choix d'une porte libre) et édition d'un
 * locataire. Réservé aux rôles admin/gérant (le backend le vérifie aussi).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocataireFormScreen(
    app: MaevaApp,
    locataireId: Int?,
    uniteIdPrechoisi: Int?,
    onRetour: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val moisCourant = LocalDate.now().toString().substring(0, 7)
    val edition = locataireId != null

    // Champs
    var nom by remember { mutableStateOf("") }
    var telephone by remember { mutableStateOf("") }
    var loyer by remember { mutableStateOf("") }
    var dateEntree by remember { mutableStateOf("") }
    var debutSuivi by remember { mutableStateOf(moisCourant) }
    var loyerAPartirDe by remember { mutableStateOf(moisCourant) }
    var caution by remember { mutableStateOf("") }
    var avance by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var uniteChoisie by remember { mutableStateOf<Unite?>(null) }
    var menuUnitesOuvert by remember { mutableStateOf(false) }
    var charge by remember { mutableStateOf(edition) }
    var enCours by remember { mutableStateOf(false) }
    var erreur by remember { mutableStateOf<String?>(null) }

    val unitesLibres by produceState<List<Unite>>(initialValue = emptyList()) {
        try {
            value = app.reseau.api().unites().filter { it.statut == "libre" }
            if (uniteIdPrechoisi != null) uniteChoisie = value.firstOrNull { it.id == uniteIdPrechoisi }
            uniteChoisie?.let { loyer = (it.loyer_base ?: 0).toString() }
        } catch (_: Exception) { }
    }

    // En édition, pré-remplir depuis la fiche
    produceState<FicheLocataire?>(initialValue = null, locataireId) {
        if (locataireId == null) return@produceState
        try {
            val f = app.reseau.api().ficheLocataire(locataireId, moisCourant)
            nom = f.nom_locataire
            telephone = f.telephone ?: ""
            loyer = f.loyer_mensuel.toString()
            caution = (f.caution ?: 0).toString()
            charge = false
        } catch (e: Exception) { erreur = messageErreur(e); charge = false }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        EnTete(if (edition) "Modifier le locataire" else "Nouveau locataire") {
            TextButton(onClick = onRetour) { Text("Annuler") }
        }

        Column(Modifier.padding(horizontal = 16.dp)) {
        if (charge) { CircularProgressIndicator(); return@Column }

        if (!edition) {
            // La porte physique dicte le bâtiment : on choisit une porte libre
            ExposedDropdownMenuBox(expanded = menuUnitesOuvert, onExpandedChange = { menuUnitesOuvert = it }) {
                OutlinedTextField(
                    value = uniteChoisie?.let { "${it.batiment ?: ""} · ${it.porte ?: "sans porte"}" } ?: "",
                    onValueChange = {}, readOnly = true,
                    label = { Text("Porte à occuper") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(menuUnitesOuvert) },
                    modifier = Modifier.fillMaxWidth().menuAnchor(),
                )
                ExposedDropdownMenu(expanded = menuUnitesOuvert, onDismissRequest = { menuUnitesOuvert = false }) {
                    if (unitesLibres.isEmpty()) {
                        DropdownMenuItem(
                            text = { Text("Aucune porte libre — créez-la dans l'onglet Portes") },
                            onClick = { menuUnitesOuvert = false },
                        )
                    }
                    unitesLibres.forEach { u ->
                        DropdownMenuItem(
                            text = {
                                Column {
                                    Text("${u.batiment ?: ""} · ${u.porte ?: "sans porte"}")
                                    u.loyer_base?.let { Text("Loyer : ${fcfa(it)}", style = MaterialTheme.typography.bodySmall) }
                                }
                            },
                            onClick = {
                                uniteChoisie = u
                                if (loyer.isBlank() || loyer == "0") loyer = (u.loyer_base ?: 0).toString()
                                menuUnitesOuvert = false
                            },
                        )
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
        }

        OutlinedTextField(value = nom, onValueChange = { nom = it },
            label = { Text("Nom du locataire") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(value = telephone, onValueChange = { telephone = it },
            label = { Text("Téléphone") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(value = loyer, onValueChange = { loyer = it.filter { c -> c.isDigit() } },
            label = { Text("Loyer mensuel (FCFA)") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))

        if (edition) {
            OutlinedTextField(
                value = loyerAPartirDe, onValueChange = { loyerAPartirDe = it },
                label = { Text("Nouveau loyer à partir de (AAAA-MM)") }, singleLine = true,
                modifier = Modifier.fillMaxWidth())
        } else {
            OutlinedTextField(value = dateEntree, onValueChange = { dateEntree = it },
                label = { Text("Date d'entrée (AAAA-MM-JJ)") }, singleLine = true,
                modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(value = debutSuivi, onValueChange = { debutSuivi = it },
                label = { Text("Suivi des loyers à partir de (AAAA-MM)") }, singleLine = true,
                modifier = Modifier.fillMaxWidth())
        }
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(value = caution, onValueChange = { caution = it.filter { c -> c.isDigit() } },
            label = { Text("Caution (FCFA)") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth())
        if (!edition) {
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(value = avance, onValueChange = { avance = it.filter { c -> c.isDigit() } },
                label = { Text("Avance versée à l'entrée (FCFA)") }, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth())
        }
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(value = note, onValueChange = { note = it },
            label = { Text("Note (optionnel)") }, modifier = Modifier.fillMaxWidth())

        erreur?.let { Spacer(Modifier.height(8.dp)); Text(it, color = MaterialTheme.colorScheme.error) }
        Spacer(Modifier.height(16.dp))

        Button(
            enabled = !enCours && nom.isNotBlank() && (edition || uniteChoisie != null),
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                enCours = true; erreur = null
                scope.launch {
                    try {
                        if (edition) {
                            app.reseau.api().majLocataire(locataireId!!, LocataireBody(
                                nom_locataire = nom,
                                telephone = telephone.ifBlank { null },
                                loyer_mensuel = loyer.toIntOrNull(),
                                loyer_a_partir_de = loyerAPartirDe.ifBlank { null },
                                caution = caution.toIntOrNull(),
                                note = note.ifBlank { null },
                            ))
                        } else {
                            app.reseau.api().creerLocataire(LocataireBody(
                                unite_id = uniteChoisie!!.id,
                                nom_locataire = nom,
                                loyer_mensuel = loyer.toIntOrNull(),
                                date_entree = dateEntree.ifBlank { null },
                                debut_suivi = debutSuivi.ifBlank { null },
                                telephone = telephone.ifBlank { null },
                                caution = caution.toIntOrNull(),
                                avance = avance.toIntOrNull(),
                                note = note.ifBlank { null },
                            ))
                        }
                        onRetour()
                    } catch (e: Exception) { erreur = messageErreur(e) }
                    enCours = false
                }
            },
        ) { Text(if (enCours) "Enregistrement…" else if (edition) "Enregistrer" else "Créer le locataire") }
        }
    }
}
