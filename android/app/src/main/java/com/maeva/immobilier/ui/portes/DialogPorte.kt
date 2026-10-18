package com.maeva.immobilier.ui.portes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.maeva.immobilier.data.api.Batiment

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
