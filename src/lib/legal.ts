import { DATA_INVENTORY, type LegalBasis } from './security/inventory'

// Textes juridiques de PermaJardin : source unique. L'interface les rend en React (aucun HTML injecté) et
// docs/{CONFIDENTIALITE,MENTIONS-LEGALES,CGU}.md en reprennent les titres (vérifié par legal.test.ts).
// Ce sont des BROUILLONS : ils ne constituent pas un avis juridique.

export const DRAFT_BANNER = 'BROUILLON À FAIRE VALIDER PAR UN PROFESSIONNEL'
export const DRAFT_NOTE = 'Texte provisoire, à faire valider par un professionnel avant publication. Il ne constitue pas un avis juridique.'

export const LEGAL_VERSION = '1.0'
/** Dernière mise à jour (AAAA-MM-JJ). */
export const LEGAL_UPDATED = '2026-10-23'

// ---------- Champs à compléter par l'éditeur (aucune donnée personnelle pré-remplie) ----------
export const TO_COMPLETE = '[à compléter]'
export const EDITEUR_NOM = TO_COMPLETE
export const EDITEUR_STATUT = TO_COMPLETE
export const EDITEUR_ADRESSE = TO_COMPLETE
export const CONTACT_EMAIL = TO_COMPLETE
export const DIRECTEUR_PUBLICATION = TO_COMPLETE

export const LEGAL_FIELDS = {
  EDITEUR_NOM,
  EDITEUR_STATUT,
  EDITEUR_ADRESSE,
  CONTACT_EMAIL,
  DIRECTEUR_PUBLICATION,
} as const

/** Noms des champs encore à compléter (vide quand le texte est prêt). */
export function getMissingFields(fields: Record<string, string> = LEGAL_FIELDS): string[] {
  return Object.entries(fields)
    .filter(([, v]) => !v.trim() || v.includes(TO_COMPLETE) || /\[.*\]/.test(v))
    .map(([k]) => k)
}

// ---------- Structure des documents ----------
export type Block = { t: 'p'; text: string } | { t: 'ul'; items: string[] }
export interface LegalSection {
  titre: string
  blocs: Block[]
}
export type LegalId = 'confidentialite' | 'mentions' | 'cgu'
export interface LegalDoc {
  id: LegalId
  titre: string
  /** Nom du fichier dans docs/. */
  fichier: string
  sections: LegalSection[]
}

const p = (text: string): Block => ({ t: 'p', text })
const ul = (...items: string[]): Block => ({ t: 'ul', items })

const BASE_LABEL: Record<LegalBasis, string> = {
  execution: 'exécution du service demandé',
  consentement: 'votre consentement',
  'interet-legitime': 'intérêt légitime (sécurité, confort d’usage)',
}

const inventoryItems = DATA_INVENTORY.map(
  (d) =>
    `${d.donnee}. Stockage : ${d.stockage}. ` +
    (d.destinataires.length ? `Destinataires : ${d.destinataires.join(' ; ')}. ` : 'Aucun destinataire extérieur. ') +
    `Finalité : ${d.finalite}. Base : ${BASE_LABEL[d.base]}. Durée : ${d.duree}. Effacement : ${d.effacement}.`,
)

export const CONFIDENTIALITE: LegalDoc = {
  id: 'confidentialite',
  titre: 'Politique de confidentialité',
  fichier: 'CONFIDENTIALITE.md',
  sections: [
    {
      titre: 'En bref',
      blocs: [
        ul(
          'Vos jardins, plantes et photos restent sur votre appareil, dans votre navigateur.',
          'Pas de compte obligatoire, pas de publicité, pas de cookie, pas de traceur.',
          'Quelques services extérieurs reçoivent une partie de vos données uniquement quand la fonction l’exige : carte, météo, identification d’une plante, sauvegarde en ligne facultative.',
          'Vous pouvez tout exporter ou tout effacer à tout moment depuis les Réglages.',
        ),
      ],
    },
    {
      titre: 'Qui est responsable',
      blocs: [
        p(`Éditeur et responsable du traitement : ${EDITEUR_NOM} (${EDITEUR_STATUT}), ${EDITEUR_ADRESSE}. Contact : ${CONTACT_EMAIL}.`),
        p('Les données conservées uniquement sur votre appareil ne sont pas accessibles à l’éditeur.'),
      ],
    },
    {
      titre: 'Données, finalités, destinataires et durées',
      blocs: [p('Pour chaque donnée : où elle est stockée, qui la reçoit, pourquoi, sur quelle base et combien de temps.'), { t: 'ul', items: inventoryItems }, p('Aucune de ces données n’est vendue, ni utilisée pour de la publicité ou du profilage.')],
    },
    {
      titre: 'Bases légales',
      blocs: [
        ul(
          'Exécution du service que vous demandez : carte, météo locale, calendrier d’entretien (RGPD, art. 6.1.b).',
          'Votre consentement : envoi d’une photo à Pl@ntNet pour l’identification, et sauvegarde en ligne. Il est demandé avant le premier envoi et vous pouvez le retirer à tout moment dans Réglages > Vie privée (art. 6.1.a).',
          'Intérêt légitime : journaux techniques de sécurité de l’hébergeur et préférences d’usage (art. 6.1.f).',
        ),
        p('Information sans blocage : pour afficher la carte et la météo, les coordonnées de votre jardin sont envoyées à l’IGN (Géoplateforme, API Carto) et à Open-Meteo, par l’intermédiaire de notre hébergeur. Ces envois ne contiennent ni votre nom ni votre e-mail.'),
      ],
    },
    {
      titre: 'Destinataires',
      blocs: [
        ul(
          'Vercel Inc. (États-Unis) : hébergement du site, relais des requêtes vers l’IGN et Open-Meteo, fonction d’identification.',
          'IGN Géoplateforme et API Carto : cartes, géocodage, parcelles, altitude.',
          'Open-Meteo : prévisions et historique météo.',
          'Pl@ntNet (Cirad, INRAE, Inria, IRD) : identification des plantes à partir des photos que vous envoyez.',
          'Supabase : compte et sauvegarde en ligne, seulement si vous activez la synchronisation.',
        ),
        p('Chaque service applique sa propre politique de confidentialité.'),
      ],
    },
    {
      titre: 'Transferts hors Union européenne',
      blocs: [
        p('Vercel est une société américaine : des données techniques (adresse IP, requêtes) peuvent être traitées aux États-Unis. Les garanties applicables (clauses contractuelles types ou cadre de protection des données UE-États-Unis) sont à confirmer par l’éditeur auprès de Vercel.'),
        p('Le lieu d’hébergement du projet Supabase et d’Open-Meteo est également à confirmer.'),
      ],
    },
    {
      titre: 'Cookies et traceurs',
      blocs: [p('PermaJardin ne dépose aucun cookie et n’utilise ni mesure d’audience ni traceur publicitaire. Le stockage du navigateur (IndexedDB, localStorage, cache de l’appli) sert uniquement à faire fonctionner l’appli.')],
    },
    {
      titre: 'Vos droits',
      blocs: [
        ul(
          'Accès et portabilité : Réglages > Sauvegarde > Exporter (fichier JSON lisible).',
          'Rectification : directement dans l’appli.',
          'Effacement : Réglages > Vie privée > Effacer toutes mes données, avec suppression de la sauvegarde en ligne si vous êtes connecté.',
          'Opposition, limitation et retrait du consentement : Réglages > Vie privée > Retirer mon consentement, ou par e-mail à l’éditeur.',
          'Réclamation : auprès de la CNIL (www.cnil.fr).',
        ),
        p(`Pour toute demande : ${CONTACT_EMAIL}. Pour les données détenues par un prestataire (par exemple Pl@ntNet), vous pouvez aussi vous adresser à lui.`),
      ],
    },
    {
      titre: 'Sécurité',
      blocs: [p('Connexions chiffrées (HTTPS), aucune clé secrète dans l’appli, accès à la sauvegarde en ligne limité à son propriétaire, validation de tout fichier importé.')],
    },
    {
      titre: 'Modifications',
      blocs: [p('Toute modification importante de cette politique sera signalée dans l’appli. La date de dernière mise à jour figure en haut de la page.')],
    },
  ],
}

export const MENTIONS: LegalDoc = {
  id: 'mentions',
  titre: 'Mentions légales',
  fichier: 'MENTIONS-LEGALES.md',
  sections: [
    {
      titre: 'Éditeur du service',
      blocs: [
        ul(`Nom ou raison sociale : ${EDITEUR_NOM}`, `Statut : ${EDITEUR_STATUT}`, `Adresse ou domiciliation : ${EDITEUR_ADRESSE}`, `Contact : ${CONTACT_EMAIL}`),
      ],
    },
    { titre: 'Directeur de la publication', blocs: [p(DIRECTEUR_PUBLICATION)] },
    {
      titre: 'Hébergeur',
      blocs: [p('Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis. Site : vercel.com.')],
    },
    {
      titre: 'Sources de données et licences',
      blocs: [
        ul(
          'Photo aérienne, plan, cadastre, bâtiments (BD TOPO), relief (RGE ALTI) : © IGN – Géoplateforme, Licence Ouverte 2.0.',
          'Météo et historique climatique : Open-Meteo, licence CC BY 4.0.',
          'Identification des plantes : Pl@ntNet (Cirad, INRAE, Inria, IRD).',
          'Fonds de carte et logiciels libres : voir leurs licences respectives.',
        ),
      ],
    },
    {
      titre: 'Propriété intellectuelle',
      blocs: [p('Le code, les fiches espèces et les textes de PermaJardin sont protégés. Les données tierces restent soumises à leurs licences.')],
    },
    {
      titre: 'Données personnelles',
      blocs: [p('Voir la politique de confidentialité, accessible depuis les Réglages.')],
    },
  ],
}

export const CGU: LegalDoc = {
  id: 'cgu',
  titre: 'Conditions d’utilisation',
  fichier: 'CGU.md',
  sections: [
    {
      titre: 'Objet du service',
      blocs: [p('PermaJardin est une application gratuite pour cartographier un jardin, y placer ses plantes et savoir quand tailler, désherber, arroser et récolter.')],
    },
    {
      titre: 'Gratuité et absence de compte',
      blocs: [p('Le service est gratuit et s’utilise sans compte. Un compte n’est nécessaire que pour la synchronisation facultative entre appareils.')],
    },
    {
      titre: 'Conseils indicatifs',
      blocs: [
        p('Les calendriers, tailles, associations de plantes et distances de plantation sont fournis à titre indicatif. Ils ne remplacent ni l’observation de votre jardin ni l’avis d’un professionnel.'),
        p('Les distances de plantation s’appuient sur l’article 671 du Code civil. Des règlements locaux, des usages ou un règlement de copropriété peuvent s’appliquer : vérifiez-les.'),
      ],
    },
    {
      titre: 'Identification de plantes',
      blocs: [
        p('L’identification par photo est fournie par Pl@ntNet et peut être fausse. Aucune garantie n’est donnée sur son exactitude.'),
        p('Ne consommez jamais une plante, un fruit ou un champignon sur la seule foi de l’application : certaines plantes sont toxiques.'),
      ],
    },
    {
      titre: 'Disponibilité',
      blocs: [p('Le service est fourni « en l’état », sans garantie de disponibilité continue. Il peut être interrompu ou modifié. Exportez régulièrement une sauvegarde de vos données.')],
    },
    {
      titre: 'Données de sources tierces',
      blocs: [p('Les cartes, le cadastre, le relief et la météo viennent de services tiers (IGN, Open-Meteo). Ils peuvent être inexacts, incomplets ou indisponibles.')],
    },
    {
      titre: 'Propriété intellectuelle',
      blocs: [p('Vos données (jardins, plantes, photos) vous appartiennent. Le code et les contenus de PermaJardin restent la propriété de l’éditeur, sauf licences contraires.')],
    },
    {
      titre: 'Droit applicable',
      blocs: [p('Les présentes conditions sont soumises au droit français.')],
    },
    {
      titre: 'Contact',
      blocs: [p(`Pour toute question : ${CONTACT_EMAIL}.`)],
    },
  ],
}

export const LEGAL_DOCS: readonly LegalDoc[] = [CONFIDENTIALITE, MENTIONS, CGU]
export const LEGAL_DOC: Record<LegalId, LegalDoc> = { confidentialite: CONFIDENTIALITE, mentions: MENTIONS, cgu: CGU }
export const LEGAL_LINK_LABEL: Record<LegalId, string> = { confidentialite: 'Confidentialité', mentions: 'Mentions légales', cgu: 'Conditions d’utilisation' }

export function formatLegalDate(iso = LEGAL_UPDATED): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Rendu texte d'un document (même contenu que docs/*.md). */
export function toMarkdown(doc: LegalDoc): string {
  const out = [
    `# ${doc.titre}`,
    '',
    `> **${DRAFT_BANNER}.** ${DRAFT_NOTE}`,
    `> Version ${LEGAL_VERSION} · Dernière mise à jour : ${formatLegalDate()}.`,
    '',
  ]
  for (const s of doc.sections) {
    out.push(`## ${s.titre}`, '')
    for (const b of s.blocs) {
      out.push(...(b.t === 'p' ? [b.text] : b.items.map((i) => `- ${i}`)), '')
    }
  }
  return out.join('\n')
}

// ---------- Textes de consentement ----------
export interface ConsentText {
  titre: string
  paragraphes: string[]
  accepter: string
}

const idf = DATA_INVENTORY.find((d) => d.id === 'identification')
const compte = DATA_INVENTORY.find((d) => d.id === 'compte')

export const CONSENT_TEXT: Record<'plantnet' | 'sync', ConsentText> = {
  plantnet: {
    titre: 'Envoyer la photo à Pl@ntNet ?',
    paragraphes: [
      'Votre photo sera envoyée à Pl@ntNet (service d’identification, France/Europe) via notre serveur. Elle est ré-encodée, sans position GPS. Elle n’est pas conservée par PermaJardin.',
      `Destinataires : ${(idf?.destinataires ?? []).join(' ; ')}.`,
      'Vous pouvez retirer ce consentement à tout moment dans Réglages > Vie privée.',
    ],
    accepter: 'Accepter et identifier',
  },
  sync: {
    titre: 'Enregistrer vos données en ligne ?',
    paragraphes: [
      'Vos jardins, plantes et tâches (sans les photos) seront enregistrés sur un serveur (Supabase, UE) lié à votre adresse e-mail, pour les retrouver sur un autre appareil.',
      `Destinataire : ${(compte?.destinataires ?? []).join(' ; ')}.`,
      'Vous pouvez retirer ce consentement et supprimer vos données en ligne à tout moment dans Réglages.',
    ],
    accepter: 'Accepter et continuer',
  },
}

/** Information sans blocage affichée dans Réglages > Vie privée. */
export const NETWORK_INFO =
  'Pour afficher la carte et la météo, les coordonnées de votre jardin sont envoyées à l’IGN (Géoplateforme) et à Open-Meteo, par l’intermédiaire de notre hébergeur. Ni votre nom ni votre e-mail ne sont transmis.'
