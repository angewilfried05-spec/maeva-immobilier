package com.maeva.immobilier.ui.utilisateurs

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.maeva.immobilier.MaevaApp
import com.maeva.immobilier.data.api.Utilisateur
import com.maeva.immobilier.data.api.UtilisateurBody
import com.maeva.immobilier.data.api.UtilisateurMajBody
import com.maeva.immobilier.data.api.messageErreur
import kotlinx.coroutines.launch

private val ROLES = listOf("admin", "gerant", "comptable", "lecteur")
private fun libelleRole(role: String) = when (role) {
    "admin" -> "Administrateur"
    "gerant" -> "Gérant"
    "comptable" -> "Comptable"
    else -> "Lecteur"
}

/** Gestion des comptes utilisateurs (admin). */
@Composable
fun UtilisateursScreen(app: MaevaApp) {
    val scope = rememberCoroutineScope()
    var rafraichi by remember { mutableStateOf(0) }
    var creationOuverte by remember { mutableStateOf(false) }
    var edition by remember { mutableStateOf<Utilisateur?>(null) }
    var suppression by remember { mutableStateOf<Utilisateur?>(null) }
    var erreur by remember { mutableStateOf<String?>(null) }

    val role by produceState<String?>(initialValue = null) { value = app.session.role() }
    val users by produceState<List<Utilisateur>?>(initialValue = null, rafraichi) {
        try { value = app.reseau.api().utilisateurs() } catch (_: Exception) { }
    }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically) {
            Text("Utilisateurs", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            if (role == "admin") {
                TextButton(onClick = { creationOuverte = true }) { Text("+ Nouveau") }
            }
        }
        erreur?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Spacer(Modifier.height(8.dp))

        if (role != null && role != "admin") {
            Text("La gestion des comptes est réservée à l'administrateur.",
                style = MaterialTheme.typography.bodyMedium)
            return@Column
        }
        val liste = users
        if (liste == null) {
            Text("Chargement…", style = MaterialTheme.typography.bodyMedium)
        } else {
            LazyColumn {
                items(liste, key = { it.id }) { u ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(u.nom_complet ?: u.username, fontWeight = FontWeight.SemiBold)
                            Text(
                                "@${u.username} · ${libelleRole(u.role)}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                            )
                        }
                        if (u.actif == false) {
                            Badge(containerColor = MaterialTheme.colorScheme.errorContainer) {
                                Text("Inactif", Modifier.padding(4.dp))
                            }
                        }
                        TextButton(onClick = { edition = u }) { Text("Gérer") }
                    }
                    HorizontalDivider()
                }
            }
        }
    }

    if (creationOuverte) {
        DialogUtilisateur(
            titre = "Nouvel utilisateur",
            onFermer = { creationOuverte = false },
            onValider = { username, nom, r, mdp, _ ->
                scope.launch {
                    try {
                        app.reseau.api().creerUtilisateur(
                            UtilisateurBody(username, nom, r, mdp!!)
                        )
                        creationOuverte = false; rafraichi++
                    } catch (e: Exception) { erreur = messageErreur(e); creationOuverte = false }
                }
            },
        )
    }
    edition?.let { u ->
        DialogUtilisateur(
            titre = "Modifier — ${u.nom_complet ?: u.username}",
            existant = u,
            onFermer = { edition = null },
            onSupprimer = { suppression = u },
            onValider = { _, nom, r, mdp, actif ->
                scope.launch {
                    try {
                        app.reseau.api().majUtilisateur(
                            u.id,
                            UtilisateurMajBody(
                                nom_complet = nom,
                                role = r,
                                actif = actif,
                                password = mdp?.takeIf { it.isNotBlank() },
                            )
                        )
                        edition = null; rafraichi++
                    } catch (e: Exception) { erreur = messageErreur(e); edition = null }
                }
            },
        )
    }
    suppression?.let { u ->
        AlertDialog(
            onDismissRequest = { suppression = null },
            title = { Text("Supprimer ${u.nom_complet ?: u.username} ?") },
            text = { Text("Le compte @${u.username} sera supprimé définitivement.") },
            confirmButton = {
                TextButton(onClick = {
                    suppression = null
                    scope.launch {
                        try {
                            val rep = app.reseau.api().supprUtilisateur(u.id)
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DialogUtilisateur(
    titre: String,
    existant: Utilisateur? = null,
    onFermer: () -> Unit,
    onSupprimer: (() -> Unit)? = null,
    onValider: (username: String, nom: String, role: String, mdp: String?, actif: Boolean) -> Unit,
) {
    var username by remember { mutableStateOf(existant?.username ?: "") }
    var nom by remember { mutableStateOf(existant?.nom_complet ?: "") }
    var role by remember { mutableStateOf(existant?.role ?: "comptable") }
    var mdp by remember { mutableStateOf("") }
    var actif by remember { mutableStateOf(existant?.actif ?: true) }
    var menuOuvert by remember { mutableStateOf(false) }
    val creation = existant == null

    AlertDialog(
        onDismissRequest = onFermer,
        title = { Text(titre) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (creation) {
                    OutlinedTextField(value = username, onValueChange = { username = it.trim() },
                        label = { Text("Nom d'utilisateur") }, singleLine = true)
                }
                OutlinedTextField(value = nom, onValueChange = { nom = it },
                    label = { Text("Nom complet") }, singleLine = true)
                ExposedDropdownMenuBox(expanded = menuOuvert, onExpandedChange = { menuOuvert = it }) {
                    OutlinedTextField(
                        value = libelleRole(role), onValueChange = {}, readOnly = true,
                        label = { Text("Rôle") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(menuOuvert) },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                    )
                    ExposedDropdownMenu(expanded = menuOuvert, onDismissRequest = { menuOuvert = false }) {
                        ROLES.forEach { r ->
                            DropdownMenuItem(text = { Text(libelleRole(r)) },
                                onClick = { role = r; menuOuvert = false })
                        }
                    }
                }
                OutlinedTextField(
                    value = mdp, onValueChange = { mdp = it },
                    label = { Text(if (creation) "Mot de passe (8+ caractères)" else "Nouveau mot de passe (vide = inchangé)") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation())
                if (creation) {
                    Text("L'utilisateur devra changer ce mot de passe à sa première connexion.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Compte actif", Modifier.weight(1f))
                        Switch(checked = actif, onCheckedChange = { actif = it })
                    }
                }
            }
        },
        confirmButton = {
            Row {
                if (!creation && onSupprimer != null) {
                    TextButton(onClick = onSupprimer) {
                        Text("Supprimer", color = MaterialTheme.colorScheme.error)
                    }
                }
                TextButton(
                    enabled = nom.isNotBlank() && (!creation || (username.isNotBlank() && mdp.length >= 8))
                        && (creation || mdp.isEmpty() || mdp.length >= 8),
                    onClick = { onValider(username, nom.trim(), role, mdp, actif) },
                ) { Text("Enregistrer") }
            }
        },
        dismissButton = { TextButton(onClick = onFermer) { Text("Annuler") } },
    )
}
