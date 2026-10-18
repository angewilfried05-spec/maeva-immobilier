package com.maeva.immobilier.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// Identité MAEVA : bleu nuit + or du logo, verts/rouges métier.
val Bleu = Color(0xFF1A4F8B)
val BleuFonce = Color(0xFF123A68)
val Or = Color(0xFFB9872C)
val Vert = Color(0xFF1E8A4C)
val Rouge = Color(0xFFC0392B)
val Orange = Color(0xFFD68910)
val Gris = Color(0xFFF3F5F9)

private val clair = lightColorScheme(
    primary = Bleu,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDCE9F8),
    onPrimaryContainer = BleuFonce,
    secondary = Vert,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFD5EFDF),
    onSecondaryContainer = Color(0xFF0C5A2F),
    tertiary = Or,
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFF6E9CB),
    onTertiaryContainer = Color(0xFF6E4F0A),
    error = Rouge,
    errorContainer = Color(0xFFF9DEDC),
    onErrorContainer = Color(0xFF8C1D12),
    background = Gris,
    surface = Color.White,
    onSurface = Color(0xFF1C2733),
    surfaceVariant = Color(0xFFE7ECF3),
    onSurfaceVariant = Color(0xFF54616F),
    outlineVariant = Color(0xFFD7DEE8),
)

private val sombre = darkColorScheme(
    primary = Color(0xFF9CC3F0),
    onPrimary = BleuFonce,
    primaryContainer = Bleu,
    onPrimaryContainer = Color.White,
    secondary = Color(0xFF7BC998),
    onSecondary = Color(0xFF0C3B1F),
    secondaryContainer = Color(0xFF134B2C),
    onSecondaryContainer = Color(0xFFB8E6CB),
    tertiary = Color(0xFFD9B258),
    onTertiary = Color(0xFF453207),
    tertiaryContainer = Color(0xFF5A4210),
    onTertiaryContainer = Color(0xFFF0DDAE),
    error = Color(0xFFE77A6B),
    errorContainer = Color(0xFF6E2015),
    onErrorContainer = Color(0xFFF6C8C0),
    background = Color(0xFF101822),
    surface = Color(0xFF18222E),
    onSurface = Color(0xFFE4E9EF),
    surfaceVariant = Color(0xFF232E3B),
    onSurfaceVariant = Color(0xFFAAB6C2),
    outlineVariant = Color(0xFF3A4655),
)

private val Formes = Shapes(
    extraSmall = RoundedCornerShape(10.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(18.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(30.dp),
)

@Composable
fun MaevaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) sombre else clair,
        shapes = Formes,
        content = content,
    )
}

fun fcfa(n: Number?): String =
    "%,d".format((n?.toInt() ?: 0)).replace(',', ' ') + " F"

fun moisFr(mois: String): String {
    val noms = listOf("janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre")
    val p = mois.split("-")
    return if (p.size == 2) "${noms.getOrElse(p[1].toInt() - 1) { p[1] }} ${p[0]}" else mois
}
