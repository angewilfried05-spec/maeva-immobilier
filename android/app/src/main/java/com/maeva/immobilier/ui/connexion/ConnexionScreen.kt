package com.maeva.immobilier.ui.connexion

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.foundation.Image
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.maeva.immobilier.R
import com.maeva.immobilier.data.SessionStore
import com.maeva.immobilier.data.api.ErreurApi
import com.maeva.immobilier.data.api.LoginBody
import com.maeva.immobilier.data.api.MaevaApi
import com.maeva.immobilier.data.api.Reseau
import com.google.gson.Gson
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

/**
 * Connexion : URL du serveur (pré-remplie avec la production) + identifiants.
 * Si le serveur exige un changement de mot de passe, le formulaire bascule.
 */
@Composable
fun ConnexionScreen(session: SessionStore, onConnecte: () -> Unit) {
    val scope = rememberCoroutineScope()
    var serveur by remember { mutableStateOf("") }
    var serveurInit by remember { mutableStateOf(false) }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var erreur by remember { mutableStateOf<String?>(null) }
    var chargement by remember { mutableStateOf(false) }
    var afficherServeur by remember { mutableStateOf(false) }

    // Bascule "changement de mot de passe obligatoire"
    var mdpAChanger by remember { mutableStateOf(false) }
    var nouveau by remember { mutableStateOf("") }
    var tokenTemp by remember { mutableStateOf<String?>(null) }

    androidx.compose.runtime.LaunchedEffect(Unit) {
        serveur = session.serveur(); serveurInit = true
    }

    fun apiDirecte(): MaevaApi = Retrofit.Builder()
        .baseUrl(serveur.trimEnd('/') + "/")
        .client(OkHttpClient())
        .addConverterFactory(GsonConverterFactory.create())
        .build().create(MaevaApi::class.java)

    fun messageDe(e: Exception): String {
        if (e is retrofit2.HttpException) {
            try {
                val corps = e.response()?.errorBody()?.string()
                return Gson().fromJson(corps, ErreurApi::class.java)?.message ?: "Erreur ${e.code()}"
            } catch (_: Exception) { }
            return "Erreur ${e.code()}"
        }
        return "Serveur injoignable : ${e.message}"
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(28.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Image(
            painter = painterResource(R.drawable.logo),
            contentDescription = "MAEVA IMMOBILIER",
            modifier = Modifier.fillMaxWidth(0.72f),
        )
        Spacer(Modifier.height(28.dp))

        if (!mdpAChanger) {
            OutlinedTextField(
                value = username, onValueChange = { username = it },
                label = { Text("Nom d'utilisateur") }, singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = password, onValueChange = { password = it },
                label = { Text("Mot de passe") }, singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth(),
            )
            if (afficherServeur) {
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = serveur, onValueChange = { serveur = it },
                    label = { Text("Serveur") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            erreur?.let { Spacer(Modifier.height(10.dp)); Text(it, color = MaterialTheme.colorScheme.error) }
            Spacer(Modifier.height(20.dp))
            Button(
                enabled = !chargement && username.isNotBlank() && password.isNotBlank() && serveurInit,
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    chargement = true; erreur = null
                    scope.launch {
                        try {
                            val s = apiDirecte().login(LoginBody(username.trim(), password))
                            session.enregistrerSession(
                                serveur, s.token, s.refresh_token,
                                s.utilisateur?.nom_complet, s.utilisateur?.role,
                            )
                            if (s.utilisateur?.doit_changer_mdp == true) {
                                tokenTemp = s.token; mdpAChanger = true
                            } else onConnecte()
                        } catch (e: Exception) { erreur = messageDe(e) }
                        chargement = false
                    }
                },
            ) { Text(if (chargement) "Connexion…" else "Se connecter") }
            TextButton(onClick = { afficherServeur = !afficherServeur }) {
                Text(if (afficherServeur) "Masquer le serveur" else "Serveur : ${serveur.ifBlank { "…" }}")
            }
        } else {
            Text("Première connexion : choisissez un nouveau mot de passe.", style = MaterialTheme.typography.bodyLarge)
            Spacer(Modifier.height(14.dp))
            OutlinedTextField(
                value = nouveau, onValueChange = { nouveau = it },
                label = { Text("Nouveau mot de passe (8 caractères min.)") }, singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
            )
            erreur?.let { Spacer(Modifier.height(10.dp)); Text(it, color = MaterialTheme.colorScheme.error) }
            Spacer(Modifier.height(20.dp))
            Button(
                enabled = !chargement && nouveau.length >= 8,
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    chargement = true; erreur = null
                    scope.launch {
                        try {
                            val api = apiDirecte()
                            val r = api.changerMdp(
                                com.maeva.immobilier.data.api.ChangerMdpBody(password, nouveau),
                                "Bearer $tokenTemp",
                            )
                            session.majJetons(r.token, r.refresh_token)
                            onConnecte()
                        } catch (e: Exception) { erreur = messageDe(e) }
                        chargement = false
                    }
                },
            ) { Text("Enregistrer le mot de passe") }
        }
    }
}
