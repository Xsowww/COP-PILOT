# E-mails Kompa pour Supabase

Six modèles aux couleurs de Kompa, en français :

| Fichier | Modèle Supabase | Sujet |
|---|---|---|
| `confirmation.html` | Confirm signup | Confirme ton adresse e-mail · Kompa |
| `recovery.html` | Reset password | Réinitialise ton mot de passe · Kompa |
| `magic_link.html` | Magic link | Ton lien de connexion · Kompa |
| `email_change.html` | Change email address | Confirme ta nouvelle adresse · Kompa |
| `invite.html` | Invite user | Tu es invité sur Kompa |
| `reauthentication.html` | Reauthentication | Ton code de confirmation · Kompa |

Le logo est l’icône du site (`{{ .SiteURL }}/icon-192.png`) : règle d’abord **Site URL** dans
Authentication › URL Configuration sur `https://kompa-app.onrender.com`.

## Option 1 : en une commande

1. Crée un jeton sur https://supabase.com/dashboard/account/tokens
2. Dans le dossier du projet :
   ```
   SUPABASE_ACCESS_TOKEN=sbp_ton_jeton node supabase/emails/appliquer.mjs
   ```
3. Révoque le jeton juste après.

## Option 2 : à la main

Supabase › Authentication › Emails › Templates. Pour chaque modèle du tableau : colle le sujet,
puis tout le contenu du fichier `.html` dans « Message body », et enregistre.
