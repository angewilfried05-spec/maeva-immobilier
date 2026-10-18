package com.maeva.immobilier.ui.portes

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.maeva.immobilier.MaevaApp
import com.maeva.immobilier.data.api.Batiment
import com.maeva.immobilier.data.api.Unite
import com.maeva.immobilier.data.api.UniteBody
import com.maeva.immobilier.data.api.messageErreur
import com.maeva.immobilier.ui.theme.Vert
import com.maeva.immobilier.ui.theme.fcfa
import kotlinx.coroutines.launch

/** Portes physiques : libres / occupées, filtrables + création. Appui → historique. */
@Composable
fun PortesScreen(app: MaevaApp, onOuvrir: (Int) -> Unit, onBatiments: () -> Unit = {}) {
    val scope = rememberCoroutineScope()
    var filtre by remember { mutableStateOf("toutes") }
    var rafraichi by remember { mutableStateOf(0) }
    var creationOuverte by remember { mutableStateOf(false) }
    var erreur by remember { mutableStateOf<String?>(null) }

    val role by produceState<String?>(initialValue = null) { value = app.session.role() }
    val gestion = role == "admin" || role == "gerant"

    val unites by produceState<List<Unite>?>(initialValue = null, rafraichi) {
        try { value = app.reseau.api().unites() } catch (_: Exception) { }
    }
    val batiments by produceState<List<Batiment>>(initialValue = emptyList()) {
        try { value = app.reseau.api().batiments() } catch (_: Exception) { }
    }

    val liste = unites?.filter {
        filtre == "toutes" ||
            (filtre == "libres" && it.statut == "libre") ||
            (filtre == "occupees" && it.statut == "occupee")
    } ?: emptyList()
    val libres = unites?.count { it.statut == "libre" } ?: 0

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text("Portes", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("$libres libre(s) sur ${unites?.size ?: 0}", style = MaterialTheme.typography.bodyMedium)
            }
            if (gestion) {
                Column(horizontalAlignment = Alignment.End) {
                    TextButton(onClick = onBatiments) { Text("Bâtiments") }
                    TextButton(onClick = { creationOuverte = true }) { Text("+ Porte") }
                }
            }
        }
        Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("toutes" to "Toutes", "libres" to "Libres", "occupees" to "Occupées").forEach { (f, label) ->
                FilterChip(selected = filtre == f, onClick = { filtre = f }, label = { Text(label) })
            }
        }
        erreur?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        if (unites == null) {
            Text("Chargement…", style = MaterialTheme.typography.bodyMedium)
        } else {
            LazyColumn {
                items(liste, key = { it.id }) { u ->
                    Row(
                        Modifier.fillMaxWidth().clickable { onOuvrir(u.id) }.padding(vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                listOfNotNull(u.batiment, u.porte).joinToString(" · "),
                                fontWeight = FontWeight.SemiBold,
                            )
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

    if (creationOuverte) {
        DialogPorte(
            batiments = batiments,
            titre = "Nouvelle porte",
            onFermer = { creationOuverte = false },
            onValider = { batimentId, porte, loyerBase ->
                scope.launch {
                    try {
                        app.reseau.api().creerUnite(UniteBody(batimentId, porte.ifBlank { null }, loyerBase))
                        creationOuverte = false; rafraichi++
                    } catch (e: Exception) { erreur = messageErreur(e); creationOuverte = false }
                }
            },
        )
    }
}

/** Dialog de création/édition d'une porte (unité). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DialogPorte(
    batiments: List<Batiment>,
    titre: String,
    porteInit: String = "",
    loyerInit: String = "",
    batimentFixe: Int? = null,
    onFermer: () -> Unit,
    onValider: (batimentId: Int, porte: String, loyerBase: Int?) -> Unit,
) {
    var batiment by remember { mutableStateOf(batiments.firstOrNull { it.id == batimentFixe } ?: batiments.firstOrNull()) }
    var porte by remember { mutableStateOf(porteInit) }
    var loyer by remember { mutableStateOf(loyerInit) }
    var menuOuvert by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onFermer,
        title = { Text(titre) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (batimentFixe == null) {
                    ExposedDropdownMenuBox(expanded = menuOuvert, onExpandedChange = { menuOuvert = it }) {
                        OutlinedTextField(
                            value = batiment?.nom ?: "", onValueChange = {}, readOnly = true,
                            label = { Text("Bâtiment") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(menuOuvert) },
                            modifier = Modifier.fillMaxWidth().menuAnchor(),
                        )
                        ExposedDropdownMenu(expanded = menuOuvert, onDismissRequest = { menuOuvert = false }) {
                            batiments.forEach { b ->
                                DropdownMenuItem(text = { Text(b.nom) },
                                    onClick = { batiment = b; menuOuvert = false })
                            }
                        }
                    }
                } else {
                    Text("Bâtiment : ${batiment?.nom ?: ""}")
                }
                OutlinedTextField(value = porte, onValueChange = { porte = it },
                    label = { Text("Porte / appartement (ex : P3, Appt 4)") }, singleLine = true)
                OutlinedTextField(
                    value = loyer, onValueChange = { loyer = it.filter { c -> c.isDigit() } },
                    label = { Text("Loyer de base (FCFA)") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
            }
        },
        confirmButton = {
            TextButton(
                enabled = batiment != null && porte.isNotBlank(),
                onClick = { onValider(batiment!!.id, porte.trim(), loyer.toIntOrNull()) },
            ) { Text("Enregistrer") }
        },
        dismissButton = { TextButton(onClick = onFermer) { Text("Annuler") } },
    )
}
