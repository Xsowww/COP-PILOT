/** Ready-made note structures (French). `html()` is called at creation so dates are current. */
export interface NoteTemplate {
  id: string;
  label: string;
  /** One line shown in the « Nouvelle note » menu. */
  hint: string;
  /** Default note title. */
  title: string;
  html: () => string;
}

const today = () => new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const tasks = (items: string[]) =>
  `<ul data-type="taskList">${items.map(t => `<li data-type="taskItem" data-checked="false"><p>${t}</p></li>`).join('')}</ul>`;
const list = (items: string[]) => `<ul>${items.map(t => `<li><p>${t}</p></li>`).join('')}</ul>`;
const olist = (items: string[]) => `<ol>${items.map(t => `<li><p>${t}</p></li>`).join('')}</ol>`;

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'vide',
    label: 'Note vide',
    hint: 'Une page blanche',
    title: 'Sans titre',
    html: () => '',
  },
  {
    id: 'fiche',
    label: 'Fiche de révision',
    hint: 'Notions, définitions, formules, auto-test',
    title: 'Fiche de révision',
    html: () =>
      [
        '<p><strong>Matière :</strong> </p>',
        '<p><strong>Chapitre :</strong> </p>',
        '<h2>L’essentiel en 3 phrases</h2>',
        olist(['', '', '']),
        '<h2>Définitions</h2>',
        list(['<strong>Terme</strong> : ']),
        '<h2>Formules et règles</h2>',
        list(['']),
        '<h2>Exemple type</h2>',
        '<p></p>',
        '<h2>Pièges à éviter</h2>',
        list(['']),
        '<h2>Je sais…</h2>',
        tasks(['Réciter les définitions sans regarder', 'Refaire l’exemple type seul', 'Expliquer le chapitre à quelqu’un en 2 minutes']),
      ].join(''),
  },
  {
    id: 'tp',
    label: 'Compte-rendu de TP',
    hint: 'Objectif, protocole, résultats, analyse',
    title: 'Compte-rendu de TP',
    html: () =>
      [
        `<p><strong>Date :</strong> ${today()}</p>`,
        '<p><strong>Binôme :</strong> </p>',
        '<h2>Objectif</h2>',
        '<p>Ce que le TP cherche à mesurer ou à montrer.</p>',
        '<h2>Matériel</h2>',
        list(['']),
        '<h2>Protocole</h2>',
        olist(['']),
        '<h2>Résultats</h2>',
        '<p>Mesures, tableaux, observations (avec unités et incertitudes).</p>',
        '<h2>Analyse</h2>',
        '<p>Interprétation, comparaison avec la théorie, sources d’erreur.</p>',
        '<h2>Conclusion</h2>',
        '<p></p>',
        '<h2>Avant de rendre</h2>',
        tasks(['Unités et chiffres significatifs vérifiés', 'Schémas et graphiques légendés', 'Noms du binôme sur la première page']),
      ].join(''),
  },
  {
    id: 'dissertation',
    label: 'Plan de dissertation',
    hint: 'Problématique et plan en deux ou trois parties',
    title: 'Plan de dissertation',
    html: () =>
      [
        '<p><strong>Sujet :</strong> </p>',
        '<h2>Introduction</h2>',
        list(['<strong>Accroche</strong> : ', '<strong>Définition des termes</strong> : ', '<strong>Problématique</strong> : ', '<strong>Annonce du plan</strong> : ']),
        '<h2>I. </h2>',
        list(['<strong>A.</strong> Argument — exemple', '<strong>B.</strong> Argument — exemple']),
        '<p><em>Transition :</em> </p>',
        '<h2>II. </h2>',
        list(['<strong>A.</strong> Argument — exemple', '<strong>B.</strong> Argument — exemple']),
        '<p><em>Transition :</em> </p>',
        '<h2>III. </h2>',
        list(['<strong>A.</strong> Argument — exemple', '<strong>B.</strong> Argument — exemple']),
        '<h2>Conclusion</h2>',
        list(['<strong>Bilan</strong> : réponse à la problématique', '<strong>Ouverture</strong> : ']),
        '<h2>Références à placer</h2>',
        list(['']),
      ].join(''),
  },
  {
    id: 'cours',
    label: 'Cours magistral',
    hint: 'Prise de notes structurée, questions, à retenir',
    title: 'Cours',
    html: () =>
      [
        `<p><strong>Date :</strong> ${today()}</p>`,
        '<p><strong>Enseignant :</strong> </p>',
        '<h2>Plan du cours</h2>',
        olist(['']),
        '<h2>Notes</h2>',
        '<p></p>',
        '<h2>À retenir</h2>',
        '<blockquote><p>Les 3 idées à savoir pour l’examen.</p></blockquote>',
        '<h2>Questions à poser</h2>',
        list(['']),
        '<h2>Après le cours</h2>',
        tasks(['Relire et compléter les notes le soir même', 'Faire une fiche de révision', 'Chercher les points non compris']),
      ].join(''),
  },
  {
    id: 'expose',
    label: 'Exposé / oral',
    hint: 'Déroulé minuté, répartition, répétitions',
    title: 'Exposé',
    html: () =>
      [
        '<p><strong>Sujet :</strong> </p>',
        '<p><strong>Date de passage :</strong> </p>',
        '<p><strong>Durée :</strong> 10 min + questions</p>',
        '<h2>Message principal</h2>',
        '<p>Ce que le public doit retenir en une phrase.</p>',
        '<h2>Déroulé</h2>',
        olist(['<strong>Introduction</strong> (1 min) — ', '<strong>Partie 1</strong> (4 min) — ', '<strong>Partie 2</strong> (4 min) — ', '<strong>Conclusion</strong> (1 min) — ']),
        '<h2>Qui fait quoi</h2>',
        list(['']),
        '<h2>Questions probables</h2>',
        list(['']),
        '<h2>Préparation</h2>',
        tasks(['Diapositives terminées', 'Répétition chronométrée', 'Répétition devant quelqu’un', 'Support testé sur l’ordinateur de la salle']),
      ].join(''),
  },
];
