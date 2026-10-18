package com.maeva.immobilier

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Domain
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.maeva.immobilier.ui.batiments.BatimentDetailScreen
import com.maeva.immobilier.ui.batiments.BatimentsScreen
import com.maeva.immobilier.ui.connexion.ConnexionScreen
import com.maeva.immobilier.ui.dashboard.DashboardScreen
import com.maeva.immobilier.ui.encaisser.EncaisserScreen
import com.maeva.immobilier.ui.historique.HistoriqueScreen
import com.maeva.immobilier.ui.locataires.FicheLocataireScreen
import com.maeva.immobilier.ui.locataires.LocataireFormScreen
import com.maeva.immobilier.ui.portes.PorteDetailScreen
import com.maeva.immobilier.ui.relances.RelancesScreen
import com.maeva.immobilier.ui.utilisateurs.UtilisateursScreen
import com.maeva.immobilier.ui.theme.MaevaTheme
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MaevaTheme { Racine() } }
    }
}

private val ONGLETS = listOf(
    Triple("dashboard", "Accueil", Icons.Default.Home),
    Triple("encaisser", "Encaisser", Icons.Default.Payments),
    Triple("batiments", "Bâtiments", Icons.Default.Domain),
    Triple("relances", "Relances", Icons.AutoMirrored.Filled.Send),
    Triple("utilisateurs", "Utilisateurs", Icons.Default.Group),
)

@Composable
fun Racine() {
    val context = LocalContext.current
    val app = context.applicationContext as MaevaApp
    val nav = rememberNavController()
    val scope = rememberCoroutineScope()
    val connecte by remember { app.session.connecte() }.collectAsState(initial = null)

    when (connecte) {
        null -> {}
        false -> ConnexionScreen(
            session = app.session,
            onConnecte = { /* connecte repasse à true via le DataStore */ },
        )
        true -> {
            val backStack by nav.currentBackStackEntryAsState()
            val route = backStack?.destination?.route
            val role by produceState<String?>(initialValue = null) { value = app.session.role() }
            val onglets = ONGLETS.filter { it.first != "utilisateurs" || role == "admin" }
            Scaffold(
                bottomBar = {
                    NavigationBar(
                        containerColor = MaterialTheme.colorScheme.surface,
                        tonalElevation = 6.dp,
                    ) {
                        onglets.forEach { (r, label, icone) ->
                            NavigationBarItem(
                                selected = route == r,
                                onClick = {
                                    nav.navigate(r) {
                                        popUpTo("dashboard") { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                },
                                icon = { Icon(icone, contentDescription = label) },
                                label = { Text(label, maxLines = 1, fontSize = 10.sp) },
                                colors = NavigationBarItemDefaults.colors(
                                    indicatorColor = MaterialTheme.colorScheme.primaryContainer,
                                    selectedIconColor = MaterialTheme.colorScheme.onPrimaryContainer,
                                    selectedTextColor = MaterialTheme.colorScheme.primary,
                                    unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                    unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                ),
                            )
                        }
                    }
                },
            ) { padding ->
                NavHost(
                    navController = nav as NavHostController,
                    startDestination = "dashboard",
                    modifier = Modifier.padding(padding),
                ) {
                    composable("dashboard") {
                        DashboardScreen(app, onHistorique = { nav.navigate("historique") })
                    }
                    composable("encaisser") { EncaisserScreen(app) }
                    composable("locataire/nouveau?unite={unite}",
                        arguments = listOf(navArgument("unite") { type = NavType.StringType; nullable = true })
                    ) { entree ->
                        LocataireFormScreen(
                            app,
                            locataireId = null,
                            uniteIdPrechoisi = entree.arguments?.getString("unite")?.toIntOrNull(),
                            onRetour = { nav.popBackStack() },
                        )
                    }
                    composable("locataire/{id}") { entree ->
                        val id = entree.arguments?.getString("id")?.toIntOrNull() ?: 0
                        FicheLocataireScreen(app, id, onModifier = { nav.navigate("locataire/$id/edit") })
                    }
                    composable("locataire/{id}/edit") { entree ->
                        LocataireFormScreen(
                            app,
                            locataireId = entree.arguments?.getString("id")?.toIntOrNull(),
                            uniteIdPrechoisi = null,
                            onRetour = { nav.popBackStack() },
                        )
                    }
                    composable("batiments") {
                        BatimentsScreen(app, onOuvrir = { id -> nav.navigate("batiment/$id") })
                    }
                    composable("batiment/{id}") { entree ->
                        BatimentDetailScreen(
                            app,
                            batimentId = entree.arguments?.getString("id")?.toIntOrNull() ?: 0,
                            onOuvrirPorte = { id -> nav.navigate("porte/$id") },
                        )
                    }
                    composable("porte/{id}") { entree ->
                        PorteDetailScreen(
                            app,
                            uniteId = entree.arguments?.getString("id")?.toIntOrNull() ?: 0,
                            onOccuper = { uid -> nav.navigate("locataire/nouveau?unite=$uid") },
                            onSupprimee = { nav.popBackStack() },
                            onOuvrirLocataire = { lid -> nav.navigate("locataire/$lid") },
                        )
                    }
                    composable("relances") { RelancesScreen(app) }
                    composable("utilisateurs") { UtilisateursScreen(app) }
                    composable("historique") { HistoriqueScreen(app) }
                }
            }
        }
    }
}
