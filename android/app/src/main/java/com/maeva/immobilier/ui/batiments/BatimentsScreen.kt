package com.maeva.immobilier.ui.batiments

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Domain
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
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
import androidx.compose.ui.unit.dp
import com.maeva.immobilier.MaevaApp
import com.maeva.immobilier.data.api.Batiment
import com.maeva.immobilier.data.api.BatimentBody
import com.maeva.immobilier.data.api.Unite
import com.maeva.immobilier.data.api.messageErreur
import com.maeva.immobilier.ui.theme.CarteMaeva
import com.maeva.immobilier.ui.theme.EnTete
import com.maeva.immobilier.ui.theme.PastilleIcone
import com.maeva.immobilier.ui.theme.Puce
import kotlinx.coroutines.launch

/** Bâtiments : liste + nombre de portes/libres ; appui → portes du bâtiment. */
@Composable
fun BatimentsScreen(app: MaevaApp, onOuvrir: (Int) -> Unit = {}) {
    val scope = rememberCoroutineScope()
    var rafraichi by remember { mutableStateOf(0) }
    var edition by remember { mutableStateOf<Batiment?>(null) }
    var creation by remember { mutableStateOf(false) }
    var suppression by remember { mutableStateOf<Batiment?>(null) }
    var erreur by remember { mutableStateOf<String?>(null) }

    val role by produceState<String?>(initialValue = null) { value = app.session.role() }
    val gestion = role == "admin" || role == "gerant"

    val batiments by produceState<List<Batiment>?>(initialValue = null, rafraichi) {
        try { value = app.reseau.api().batiments() } catch (_: Exception) { }
    }
    val unites by produceState<List<Unite>>(initialValue = emptyList(), rafraichi) {
        try { value = app.reseau.api().unites() } catch (_: Exception) { }
    }

    Column(Modifier.fillMaxSize()) {
        EnTete("Bâtiments") {
            if (gestion) TextButton(onClick = { creation = true }) { Text("+ Nouveau") }
        }
        erreur?.let {
            Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(horizontal = 16.dp))
        }

        val liste = batiments
        if (liste == null) {
            CircularProgressIndicator(Modifier.padding(top = 40.dp).align(Alignment.CenterHorizontally))
        } else {
            LazyColumn(
                Modifier.padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(liste, key = { it.id }) { b ->
                    val portesDuBatiment = unites.filter { it.batiment_id == b.id }
                    val libres = portesDuBatiment.count { it.statut == "libre" }
                    CarteMaeva(Modifier.fillMaxWidth(), onClick = { onOuvrir(b.id) }) {
                        Row(
                            Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            PastilleIcone(Icons.Default.Domain)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(b.nom, fontWeight = FontWeight.SemiBold)
                                Spacer(Modifier.padding(1.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Puce("${portesDuBatiment.size} porte(s)")
                                    if (libres > 0) Puce(
                                        "$libres libre(s)",
                                        fond = MaterialTheme.colorScheme.tertiaryContainer,
                                        couleur = MaterialTheme.colorScheme.onTertiaryContainer,
                                    )
                                }
                            }
                            if (gestion) {
                                Row {
                                    TextButton(onClick = { edition = b }) { Text("Modifier") }
                                    TextButton(onClick = { suppression = b }) {
                                        Text("Suppr.", color = MaterialTheme.colorScheme.error)
                                    }
                                }
                            } else {
                                Icon(
                                    Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (creation || edition != null) {
        val b = edition
        var nom by remember { mutableStateOf(b?.nom ?: "") }
        var adresse by remember { mutableStateOf(b?.adresse ?: "") }
        var note by remember { mutableStateOf(b?.note ?: "") }
        AlertDialog(
            onDismissRequest = { creation = false; edition = null },
            title = { Text(if (b == null) "Nouveau bâtiment" else "Modifier ${b.nom}") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(value = nom, onValueChange = { nom = it },
                        label = { Text("Nom") }, singleLine = true)
                    OutlinedTextField(value = adresse, onValueChange = { adresse = it },
                        label = { Text("Adresse (optionnel)") }, singleLine = true)
                    OutlinedTextField(value = note, onValueChange = { note = it },
                        label = { Text("Note (optionnel)") })
                }
            },
            confirmButton = {
                TextButton(
                    enabled = nom.isNotBlank(),
                    onClick = {
                        scope.launch {
                            try {
                                val body = BatimentBody(nom.trim(), adresse.ifBlank { null }, note.ifBlank { null })
                                if (b == null) app.reseau.api().creerBatiment(body)
                                else app.reseau.api().majBatiment(b.id, body)
                                creation = false; edition = null; rafraichi++
                            } catch (e: Exception) {
                                erreur = messageErreur(e); creation = false; edition = null
                            }
                        }
                    },
                ) { Text("Enregistrer") }
            },
            dismissButton = {
                TextButton(onClick = { creation = false; edition = null }) { Text("Annuler") }
            },
        )
    }

    suppression?.let { b ->
        AlertDialog(
            onDismissRequest = { suppression = null },
            title = { Text("Supprimer ${b.nom} ?") },
            text = { Text("Attention : les portes, contrats et versements liés seront supprimés en cascade. Impossible si un mois clôturé y touche.") },
            confirmButton = {
                TextButton(onClick = {
                    suppression = null
                    scope.launch {
                        try {
                            val rep = app.reseau.api().supprBatiment(b.id)
                            if (rep.isSuccessful) rafraichi++
                            else erreur = "Suppression refusée (${rep.code()})"
                        } catch (e: Exception) { erreur = messageErreur(e) }
                    }
                }) { Text("Supprimer", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { suppression = null }) { Text("Annuler") } },
        )
    }
}
