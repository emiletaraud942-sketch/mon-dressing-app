// Fournisseur Météo-France : SQUELETTE, non implémenté (voir docs/METEO.md).
// Rien n'est inventé ici : endpoints, authentification et format restent à vérifier sur
// portail-api.meteofrance.fr. Une clé d'API ne doit JAMAIS être dans le navigateur :
// l'appel passera par une future fonction serveur `api/` (non écrite).
import type { WeatherProvider } from './types'

const NON_CONFIGURE = 'Fournisseur Météo-France non configuré'

export const meteoFrance: WeatherProvider = {
  id: 'meteo-france',
  label: 'Météo-France',
  license: {
    // À CONFIRMER sur le portail officiel avant tout usage commercial.
    commercialUse: true,
    attribution: 'Météo : Météo-France',
    url: 'https://portail-api.meteofrance.fr',
  },
  async fetchForecast() {
    throw new Error(NON_CONFIGURE)
  },
  async fetchArchive() {
    throw new Error(NON_CONFIGURE)
  },
}
