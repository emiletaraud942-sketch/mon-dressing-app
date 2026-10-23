import { LegalLink } from '../legal/LegalLinks'
import { GardenCreator } from './GardenCreator'

export function Onboarding() {
  return (
    <div className="hero">
      <div className="card" style={{ padding: 24 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <img src="/icon.svg" alt="" width={40} height={40} />
          <h1 style={{ margin: 0 }}>PermaJardin</h1>
        </div>
        <p>
          Votre jardin en 3D à partir de la photo aérienne et du cadastre de l'IGN, avec l'ombre réelle du soleil, vos plantes à leur
          place exacte et la liste de ce qu'il faut faire cette semaine : tailler, désherber, arroser, planter.
        </p>
        <p className="muted small">
          Gratuit, sans compte. Vos données restent dans ce navigateur (export possible à tout moment).
        </p>
        <GardenCreator allowDemo />
        <p className="muted small legal-accept">
          En continuant, vous acceptez les <LegalLink id="cgu" label="conditions d’utilisation" /> et la{' '}
          <LegalLink id="confidentialite" label="politique de confidentialité" />.
        </p>
      </div>
    </div>
  )
}
