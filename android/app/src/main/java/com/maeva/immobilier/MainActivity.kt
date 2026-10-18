package com.maeva.immobilier

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MailOutline
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.maeva.immobilier.ui.connexion.ConnexionScreen
import com.maeva.immobilier.ui.dashboard.DashboardScreen
import com.maeva.immobilier.ui.encaisser.EncaisserScreen
import com.maeva.immobilier.ui.relances.RelancesScreen
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
    Triple("dashboard", "Tableau de bord", Icons.Default.Home),
    Triple("encaisser", "Encaisser", Icons.Default.ShoppingCart),
    Triple("relances", "Relances", Icons.Default.MailOutline),
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
            Scaffold(
                bottomBar = {
                    NavigationBar {
                        ONGLETS.forEach { (r, label, icone) ->
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
                                label = { Text(label) },
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
                    composable("dashboard") { DashboardScreen(app) }
                    composable("encaisser") { EncaisserScreen(app) }
                    composable("relances") { RelancesScreen(app) }
                }
            }
        }
    }
}
