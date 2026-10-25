# Vitrine MAEVA IMMOBILIER — Guide de déploiement

Site statique (HTML/CSS/JS, aucune base, aucun framework).
Le dossier `site/` est le seul à publier ; il suffit de le copier sur le serveur.

## 1. Architecture cible

| Domaine | Rôle | Technique |
|---|---|---|
| `maeva-immobilier.com` (+ `www.`) | **Vitrine publique** | nginx sert `/var/www/maeva-vitrine` (statique) |
| `gestion.maeva-immobilier.com` | **Application de gestion** | nginx → `proxy_pass http://127.0.0.1:4001` |

La vitrine et l'application sont indépendantes : aucun appel API entre les deux.
Le seul pont est le lien discret « Espace gestion » en pied de page (réglable dans `site/js/config.js` → `appUrl`).

## 2. Mettre les fichiers en place (une fois)

```bash
# Sur le VPS
sudo mkdir -p /var/www/maeva-vitrine
sudo chown -R www-data:www-data /var/www/maeva-vitrine
```

Puis, depuis votre PC, à la racine du projet :

```bash
bash vitrine/deployer-vitrine.sh
```

Le script envoie le contenu de `site/` vers `/var/www/maeva-vitrine` par rsync
(ou scp si rsync n'est pas disponible).

## 3. Configuration nginx — vitrine (domaine principal)

Le bloc actuel sert l'application sur le domaine principal. Après la bascule
vers le sous-domaine, remplacer le contenu par :

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name maeva-immobilier.com www.maeva-immobilier.com;

    root /var/www/maeva-vitrine;
    index index.html;

    server_tokens off;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(), usb=()" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;

    # Le site est statique : pas de fallback SPA, 404 propre
    location / {
        try_files $uri $uri/ =404;
    }

    # Cache raisonnable pour les polices et images, pas pour le HTML
    location ~* \.(woff2|png|jpe?g|svg)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
```

## 4. Configuration nginx — application (sous-domaine)

Créer `/etc/nginx/sites-available/maeva-gestion` :

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name gestion.maeva-immobilier.com;

    server_tokens off;
    client_max_body_size 200m;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(), usb=()" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;

    location / {
        proxy_pass http://127.0.0.1:4001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

Puis :

```bash
sudo ln -s /etc/nginx/sites-available/maeva-gestion /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 5. DNS (à faire chez le registrar)

Créer un enregistrement **A** :

```
gestion.maeva-immobilier.com  →  62.238.52.27
```

## 6. HTTPS avec certbot (les deux domaines)

```bash
sudo certbot --nginx -d maeva-immobilier.com -d www.maeva-immobilier.com
sudo certbot --nginx -d gestion.maeva-immobilier.com
```

## 7. Réglages côté application (obligatoire après la bascule)

1. **CORS** : dans `/etc/maeva/maeva.env`, ajouter le sous-domaine :
   ```
   CORS_ORIGINES=https://gestion.maeva-immobilier.com
   ```
   puis `sudo systemctl restart maeva`.
2. **Electron** : `electron/config.json` → `{ "serveur": "https://gestion.maeva-immobilier.com" }`,
   puis rebuild de l'installateur (`npm run dist`).
3. **Android** : l'URL serveur se règle à la connexion — saisir `https://gestion.maeva-immobilier.com`.
4. **Vitrine** : `site/js/config.js` → `appUrl: "https://gestion.maeva-immobilier.com"`.

## 8. Ordre de bascule recommandé (sans coupure)

1. DNS : créer l'enregistrement `gestion.` (propagation ~5 min – 1 h).
2. Ajouter le bloc nginx `maeva-gestion` (port 80) + certbot.
3. Ajouter le sous-domaine à `CORS_ORIGINES` et redémarrer `maeva`.
4. Vérifier `https://gestion.maeva-immobilier.com` → l'app répond.
5. Basculer le bloc du domaine principal vers la vitrine (`root /var/www/maeva-vitrine`), `nginx -t && reload`.
6. Rebuilder + republier l'installateur Electron avec la nouvelle URL.

## 9. Éditer le site plus tard

Tout se passe dans `site/js/config.js` : numéro, email, adresse, horaires,
lien de l'app, photos. Aucune compilation — sauvegarder puis relancer
`deployer-vitrine.sh` (ou copier le fichier modifié par scp).
