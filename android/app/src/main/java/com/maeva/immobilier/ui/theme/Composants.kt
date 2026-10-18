package com.maeva.immobilier.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.material3.Icon
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** En-tête d'écran : titre fort + sous-titre + action(s) à droite. */
@Composable
fun EnTete(
    titre: String,
    sousTitre: String? = null,
    actions: @Composable RowScope.() -> Unit = {},
) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                titre,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            sousTitre?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) { actions() }
    }
}

/** Carte standard de l'app : coins très arrondis, surface unie. */
@Composable
fun CarteMaeva(
    modifier: Modifier = Modifier,
    couleur: Color = MaterialTheme.colorScheme.surface,
    onClick: (() -> Unit)? = null,
    contenu: @Composable ColumnScope.() -> Unit,
) {
    Card(
        modifier = modifier.then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = couleur),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) { contenu() }
}

/** Pastille de statut ("Libre", "Occupée", "À jour", dette…). */
@Composable
fun Puce(
    texte: String,
    fond: Color = MaterialTheme.colorScheme.surfaceVariant,
    couleur: Color = MaterialTheme.colorScheme.onSurfaceVariant,
) {
    Box(
        Modifier.clip(CircleShape).background(fond).padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(texte, style = MaterialTheme.typography.labelMedium, color = couleur,
            fontWeight = FontWeight.SemiBold)
    }
}

/** Avatar circulaire avec les initiales du nom. */
@Composable
fun AvatarInitiales(
    nom: String,
    fond: Color = MaterialTheme.colorScheme.primaryContainer,
    couleur: Color = MaterialTheme.colorScheme.onPrimaryContainer,
    taille: Int = 42,
) {
    val initiales = nom.trim().split(Regex("\\s+"))
        .take(2).mapNotNull { it.firstOrNull()?.uppercaseChar() }.joinToString("")
        .ifBlank { "?" }
    Box(
        Modifier.size(taille.dp).clip(CircleShape).background(fond),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            initiales,
            color = couleur,
            fontWeight = FontWeight.Bold,
            fontSize = (taille * 0.38).sp,
        )
    }
}

/** Pastille carrée arrondie contenant une icône (tuiles de stats, lignes de liste). */
@Composable
fun PastilleIcone(
    icone: ImageVector,
    fond: Color = MaterialTheme.colorScheme.primaryContainer,
    couleur: Color = MaterialTheme.colorScheme.onPrimaryContainer,
    taille: Int = 42,
) {
    Box(
        Modifier.size(taille.dp).clip(MaterialTheme.shapes.medium).background(fond),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icone, contentDescription = null, tint = couleur, modifier = Modifier.size((taille * 0.55).dp))
    }
}
