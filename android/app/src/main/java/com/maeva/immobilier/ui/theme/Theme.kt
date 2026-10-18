package com.maeva.immobilier.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Identité MAEVA : bleu nuit de la sidebar + accents de l'app de bureau.
val Bleu = Color(0xFF1A4F8B)
val BleuFonce = Color(0xFF123A68)
val Vert = Color(0xFF1E8A4C)
val Rouge = Color(0xFFC0392B)
val Orange = Color(0xFFD68910)
val Gris = Color(0xFFF2F4F7)

private val clair = lightColorScheme(
    primary = Bleu,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDCE9F8),
    onPrimaryContainer = BleuFonce,
    secondary = Vert,
    onSecondary = Color.White,
    error = Rouge,
    background = Gris,
    surface = Color.White,
    onSurface = Color(0xFF1C2733),
)

private val sombre = darkColorScheme(
    primary = Color(0xFF9CC3F0),
    onPrimary = BleuFonce,
    primaryContainer = Bleu,
    onPrimaryContainer = Color.White,
    secondary = Color(0xFF7BC998),
    error = Color(0xFFE77A6B),
    background = Color(0xFF101822),
    surface = Color(0xFF18222E),
    onSurface = Color(0xFFE4E9EF),
)

@Composable
fun MaevaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) sombre else clair,
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
