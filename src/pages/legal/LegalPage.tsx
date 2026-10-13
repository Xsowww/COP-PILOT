import { Link } from 'react-router-dom';
import Logo from '../../components/Logo';
import { LEGAL_LINKS } from './links';

// Pages légales, lisibles sans compte. Les passages [À COMPLÉTER] dépendent de l'éditeur du site
// (identité, adresse, hébergeur) : ils sont listés dans AVANT-LANCEMENT.md.

export type LegalDoc = 'mentions' | 'confidentialite' | 'conditions';

const UPDATED = '14 octobre 2026';
const CONTACT = '[À COMPLÉTER : adresse e-mail de contact]';

type Section = { title: string; body: string[] };

const DOCS: Record<LegalDoc, { title: string; sections: Section[] }> = {
  mentions: {
    title: 'Mentions légales',
    sections: [
      {
        title: 'Éditeur du site',
        body: [
          'COP-PILOT est édité par [À COMPLÉTER : nom et prénom, ou nom de la structure, forme juridique et numéro SIREN le cas échéant].',
          'Adresse : [À COMPLÉTER : adresse postale]. Contact : ' + CONTACT + '.',
          'Directeur de la publication : [À COMPLÉTER : nom].',
        ],
      },
      {
        title: 'Hébergement',
        body: [
          'Site : [À COMPLÉTER : nom, adresse et téléphone de l’hébergeur du site].',
          'Données et fichiers : Supabase Inc. (supabase.com), serveurs situés dans l’Union européenne [À VÉRIFIER : région du projet Supabase].',
        ],
      },
      {
        title: 'Propriété intellectuelle',
        body: [
          'Le nom, le logo, le personnage Copilot et l’interface de COP-PILOT sont protégés. Les contenus que tu ajoutes (fichiers, notes, événements) restent ta propriété.',
        ],
      },
    ],
  },
  confidentialite: {
    title: 'Politique de confidentialité',
    sections: [
      {
        title: 'En bref',
        body: [
          'COP-PILOT collecte seulement ce qu’il faut pour faire fonctionner ton espace de travail. Pas de publicité, pas de revente de données, pas de traceurs publicitaires.',
          'Responsable du traitement : l’éditeur indiqué dans les mentions légales. Contact : ' + CONTACT + '.',
        ],
      },
      {
        title: 'Données collectées',
        body: [
          'Compte : prénom, adresse e-mail, mot de passe (enregistré sous forme chiffrée, jamais lisible), double authentification.',
          'Contenus : fichiers du Drive, notes, événements, tâches, sessions de concentration, groupes et ce que tu y partages, réglages (thème, profil d’études facultatif).',
          'Technique : journaux d’erreurs du serveur (page concernée et message d’erreur, sans le contenu de tes documents) pour corriger les bugs.',
        ],
      },
      {
        title: 'Pourquoi et sur quelle base',
        body: [
          'Fournir le service que tu demandes en créant ton compte (exécution du contrat) : stocker et synchroniser tes contenus, les partager dans les groupes que tu rejoins, sécuriser ton compte.',
          'Garder le service sûr et fiable (intérêt légitime) : limites anti-abus, journaux d’erreurs.',
        ],
      },
      {
        title: 'Copilot et l’intelligence artificielle',
        body: [
          'Quand tu poses une question à Copilot en mode intelligent, ton message et les éléments nécessaires pour y répondre (par exemple le texte d’un fichier que tu lui demandes de lire) sont envoyés au fournisseur d’IA : [À COMPLÉTER : Groq Inc., États-Unis, ou le fournisseur choisi].',
          'Ce transfert hors de l’Union européenne est encadré par [À COMPLÉTER : garanties du fournisseur, par exemple clauses contractuelles types de la Commission européenne]. Le mode simple de Copilot fonctionne sans rien envoyer.',
          'N’envoie pas à Copilot d’informations sensibles (santé, données d’autres personnes…).',
        ],
      },
      {
        title: 'Qui y a accès',
        body: [
          'Toi seul pour ton espace personnel. Les membres d’un groupe voient ce qui est partagé dans ce groupe. Nos sous-traitants techniques (hébergement, base de données, IA) les traitent uniquement pour faire fonctionner le service.',
        ],
      },
      {
        title: 'Durée de conservation',
        body: [
          'Tant que ton compte existe. Ce que tu mets à la corbeille est supprimé définitivement au bout de 30 jours.',
          '« Supprimer mon compte » (Profil › Compte) efface immédiatement ton compte, tes contenus et tes fichiers en ligne. Les journaux d’erreurs sont gardés au plus 12 mois.',
        ],
      },
      {
        title: 'Stockage sur ton appareil',
        body: [
          'COP-PILOT garde une copie de tes données dans ton navigateur pour fonctionner vite et hors ligne, et pour rester connecté. Il s’agit uniquement de stockage nécessaire au service : aucun cookie publicitaire ni de mesure d’audience, donc pas de bandeau de consentement. La déconnexion efface cette copie.',
        ],
      },
      {
        title: 'Tes droits',
        body: [
          'Tu peux accéder à tes données, les corriger, les exporter (Profil › Données › Exporter) et les supprimer (Profil › Compte). Tu peux aussi t’opposer à un traitement ou en demander la limitation en écrivant à ' + CONTACT + '.',
          'Si tu estimes que tes droits ne sont pas respectés, tu peux saisir la CNIL (cnil.fr).',
          'Si tu as moins de 15 ans, demande à un parent de lire cette page avec toi.',
        ],
      },
    ],
  },
  conditions: {
    title: 'Conditions d’utilisation',
    sections: [
      {
        title: 'Le service',
        body: [
          'COP-PILOT est un espace de travail pour étudiants : Drive, calendrier, notes, tâches, groupes et l’assistant Copilot. Il est proposé gratuitement, en l’état, et peut évoluer.',
          'En créant un compte, tu acceptes ces conditions et la politique de confidentialité.',
        ],
      },
      {
        title: 'Ton compte',
        body: [
          'Tu es responsable de ton mot de passe et de ton téléphone de double authentification. Garde ta clé de secours en lieu sûr : sans elle, un téléphone perdu peut bloquer l’accès au compte.',
          'Limites actuelles : 50 Mo par fichier, [À COMPLÉTER : espace de stockage par compte], un nombre limité de questions par jour à Copilot en mode intelligent.',
        ],
      },
      {
        title: 'Ce qui est interdit',
        body: [
          'Déposer ou partager des contenus illégaux, haineux, violents, ou qui portent atteinte aux droits d’autrui (droit d’auteur, vie privée).',
          'Tenter de contourner la sécurité, les limites ou d’accéder aux données d’autres utilisateurs ; utiliser le service de façon automatisée ou abusive.',
          'Nous pouvons supprimer un contenu signalé comme illicite et suspendre un compte qui ne respecte pas ces règles. Pour signaler un contenu : ' + CONTACT + '.',
        ],
      },
      {
        title: 'Copilot',
        body: [
          'Copilot peut se tromper. Vérifie ce qu’il te dit, surtout pour tes cours, tes dates d’examen et tes rendus. Il te demande toujours de confirmer avant de supprimer quelque chose.',
        ],
      },
      {
        title: 'Responsabilité',
        body: [
          'Nous faisons le maximum pour que le service soit disponible et que tes données soient protégées, sans pouvoir le garantir à 100 %. Exporte régulièrement une sauvegarde de ce qui compte pour toi.',
        ],
      },
      {
        title: 'Fin et modifications',
        body: [
          'Tu peux supprimer ton compte à tout moment. Si ces conditions changent de façon importante, tu en seras informé dans l’appli.',
          'Ces conditions sont soumises au droit français.',
        ],
      },
    ],
  },
};

export default function LegalPage({ doc }: { doc: LegalDoc }) {
  const { title, sections } = DOCS[doc];
  return (
    <div className="h-full overflow-y-auto bg-paper px-6 py-6 sm:px-10">
      <Link to="/" aria-label="Accueil">
        <Logo />
      </Link>
      <article className="mx-auto max-w-[680px] py-10">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="mt-1 text-[12px] text-stone-500">Mise à jour : {UPDATED}</p>
        {sections.map(s => (
          <section key={s.title} className="mt-8">
            <h2 className="text-[15px] font-semibold">{s.title}</h2>
            {s.body.map(p => (
              <p key={p} className="mt-2 text-[14px] leading-relaxed text-stone-700">
                {p}
              </p>
            ))}
          </section>
        ))}
        <nav className="mt-12 flex flex-wrap gap-x-4 gap-y-1 border-t border-stone-200 pt-4 text-[13px] text-stone-500">
          {LEGAL_LINKS.map(l => (
            <Link key={l.to} to={l.to} className="underline decoration-stone-300 underline-offset-4 hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
      </article>
    </div>
  );
}
