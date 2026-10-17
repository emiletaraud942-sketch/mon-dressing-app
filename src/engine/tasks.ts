// Moteur de tâches : quoi faire cette semaine (tailler, désherber, arroser, protéger…)
// à partir des règles des espèces, de la saison et de la météo.
import type {
  DailyWeather,
  Garden,
  GeneratedTask,
  Month,
  Plant,
  Species,
  TaskCondition,
  TaskDone,
  TaskRule,
  TaskType,
  WeatherBundle,
} from '../types'
import { plantAgeYears } from './growth'
import { MONTH_NAMES, plantingCalendar } from './calendar'

export interface TaskContext {
  garden: Garden
  plants: Plant[]
  speciesById: Record<string, Species>
  weather?: WeatherBundle
  today: Date
  tasksDone: TaskDone[]
}

const DAY_MS = 86400000
const TYPE_ORDER: TaskType[] = [
  'protection', 'arrosage', 'recolte', 'plantation', 'semis', 'taille', 'traitement',
  'desherbage', 'paillage', 'fertilisation', 'tuteurage', 'division',
]
const PRIORITY_ORDER = { haute: 0, normale: 1, basse: 2 } as const

const TYPE_NOUN: Record<TaskType, string> = {
  semis: 'semis', plantation: 'plantation', taille: 'taille', desherbage: 'désherbage',
  arrosage: 'arrosage', paillage: 'paillage', recolte: 'récolte', fertilisation: 'fertilisation',
  traitement: 'traitement', division: 'division', protection: 'protection', tuteurage: 'tuteurage',
}

/** Verbe + forme d'article : « les » → les X / votre X ; « des » → des X / de votre X. */
const TYPE_VERB: Record<TaskType, [string, 'les' | 'des']> = {
  semis: ['Semer', 'les'], plantation: ['Planter', 'les'], taille: ['Tailler', 'les'],
  desherbage: ['Désherber au pied', 'des'], arrosage: ['Arroser', 'les'], paillage: ['Pailler', 'les'],
  recolte: ['Récolter', 'les'], fertilisation: ['Fertiliser', 'les'], traitement: ['Traiter', 'les'],
  division: ['Diviser', 'les'], protection: ['Protéger', 'les'], tuteurage: ['Tuteurer', 'les'],
}

const CONDITION_LABEL: Record<TaskCondition, string> = {
  'hors-gel': 'hors gel',
  'apres-pluie': 'de préférence après une pluie',
  'temps-sec': 'par temps sec',
  chaleur: 'par fortes chaleurs (> 25 °C)',
  'apres-recolte': 'après la récolte',
}

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

// ---------- Dates ----------

const pad = (n: number) => String(n).padStart(2, '0')

/** Date locale au format YYYY-MM-DD. */
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Semaine ISO 8601, ex. "2026-W42". */
export function weekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dow = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dow) // jeudi de la même semaine
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((t.getTime() - yearStart) / DAY_MS + 1) / 7)
  return `${t.getUTCFullYear()}-W${pad(week)}`
}

/** « aujourd'hui », « demain » ou le nom du jour. */
function dayLabel(date: string, todayIso: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const [ty, tm, td] = todayIso.split('-').map(Number)
  const diff = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / DAY_MS)
  if (diff === 0) return "aujourd'hui"
  if (diff === 1) return 'demain'
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')
const fmtT = (n: number) => String(Math.round(n) || 0)

// ---------- Fenêtres de mois ----------

/** Découpe une liste de mois en fenêtres contiguës (circulaires : décembre → mars). */
function monthWindows(months: Month[]): { start: Month; end: Month }[] {
  const set = new Set(months)
  if (set.size >= 12) return [{ start: 1, end: 12 }]
  const out: { start: Month; end: Month }[] = []
  for (const m of [...set].sort((a, b) => a - b)) {
    const prev = (m === 1 ? 12 : m - 1) as Month
    if (set.has(prev)) continue
    let end = m
    for (let next = (end % 12) + 1; set.has(next as Month); next = (next % 12) + 1) end = next as Month
    out.push({ start: m, end })
  }
  return out
}

function monthsLabel(months: Month[]): string {
  const ws = monthWindows(months)
  if (ws.length === 1 && ws[0].start === 1 && ws[0].end === 12) return "toute l'année"
  return ws
    .map((w) => (w.start === w.end ? MONTH_NAMES[w.start - 1] : `${MONTH_NAMES[w.start - 1]} à ${MONTH_NAMES[w.end - 1]}`))
    .join(' et ')
}

/** Clé de période d'une tâche saisonnière : année de début de la fenêtre (2026, ou 2026-09 s'il y a plusieurs fenêtres). */
function seasonKey(months: Month[], today: Date): string {
  const month = (today.getMonth() + 1) as Month
  const year = today.getFullYear()
  const ws = monthWindows(months)
  const w = ws.find((w) => (w.start <= w.end ? month >= w.start && month <= w.end : month >= w.start || month <= w.end))
  if (!w || (w.start === 1 && w.end === 12)) return String(year)
  const startYear = w.start > month ? year - 1 : year
  return ws.length > 1 ? `${startYear}-${pad(w.start)}` : String(startYear)
}

/** Clé sans le préfixe de période. */
const baseOf = (key: string) => key.slice(key.indexOf(':') + 1)

// ---------- Noms ----------

const INVARIABLE = /[sxz]$/
const OU_X = new Set(['chou', 'genou', 'caillou', 'bijou', 'hibou', 'joujou', 'pou'])
const PREPOSITIONS = new Set(['de', 'des', 'du', "d'", 'à', 'au', 'aux', 'en', 'sur'])

function pluralWord(w: string): string {
  return w
    .split('-')
    .map((p) => {
      const l = p.toLowerCase()
      if (!p || INVARIABLE.test(l)) return p
      if (/(eau|au|eu)$/.test(l) && l !== 'pneu' && l !== 'bleu') return p + 'x'
      if (OU_X.has(l)) return p + 'x'
      return p + 's'
    })
    .join('-')
}

/** Pluriel simple d'un nom commun : « Tomate cerise » → « tomates cerises », « Fraisier des bois » → « fraisiers des bois ». */
export function pluralFr(name: string): string {
  const words = lowerFirst(name).split(' ')
  let stop = false
  return words
    .map((w) => {
      if (stop) return w
      if (PREPOSITIONS.has(w.toLowerCase()) || w.toLowerCase().startsWith("d'")) {
        stop = true
        return w
      }
      return pluralWord(w)
    })
    .join(' ')
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

function taskTitle(type: TaskType, sp: Species, n: number): string {
  const [verb, art] = TYPE_VERB[type]
  if (n > 1) return `${verb} ${art} ${pluralFr(sp.nomCommun)} (${n})`
  return `${verb} ${art === 'des' ? 'de votre' : 'votre'} ${lowerFirst(sp.nomCommun)}`
}

// ---------- Météo ----------

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)
const round1 = (n: number) => Math.round(n * 10) / 10

interface WeatherView {
  past: DailyWeather[]
  upcoming: DailyWeather[]
}

function viewOf(weather: WeatherBundle, today?: Date): WeatherView {
  const byDate = (a: DailyWeather, b: DailyWeather) => a.date.localeCompare(b.date)
  const iso = today ? isoDate(today) : undefined
  const past = [...weather.past].filter((d) => !iso || d.date < iso).sort(byDate).slice(-7)
  let upcoming = [...weather.forecast].sort(byDate)
  if (iso) {
    const f = upcoming.filter((d) => d.date >= iso)
    if (f.length) upcoming = f
  }
  return { past, upcoming }
}

/**
 * Bilan hydrique sur les 7 derniers jours : ETP (et0) − pluie.
 * deficitMm négatif = excédent d'eau. forecastRain3 = pluie prévue sur les 3 prochains jours.
 */
export function waterBalance(
  weather: WeatherBundle,
  today?: Date,
): { rain7: number; et07: number; deficitMm: number; forecastRain3: number } {
  const { past, upcoming } = viewOf(weather, today)
  const rain7 = round1(sum(past.map((d) => d.rainMm)))
  const et07 = round1(sum(past.map((d) => d.et0Mm)))
  const forecastRain3 = round1(sum(upcoming.slice(0, 3).map((d) => d.rainMm)))
  return { rain7, et07, deficitMm: round1(et07 - rain7), forecastRain3 }
}

// ---------- Génération ----------

interface Group {
  sp: Species
  rule: TaskRule
  idx: string
  plants: Plant[]
}

const isActive = (p: Plant) => p.status === 'en-place' || p.status === 'malade'
const isSowing = (t: TaskType) => t === 'semis' || t === 'plantation'

const HOWTO_SEMIS = 'Semer en place dans un sol ameubli et désherbé, recouvrir de terre fine puis arroser en pluie fine.'
const HOWTO_PLANTATION = 'Creuser un trou deux fois plus large que la motte, planter sans enterrer le collet, arroser copieusement puis pailler.'
const HOWTO_ARROSAGE =
  "Arroser au pied, le matin ou le soir : 10 à 15 L par m² ou par jeune arbre, en une fois plutôt qu'un peu chaque jour. Pailler pour garder l'humidité."
const HOWTO_GEL =
  "Poser un voile d'hivernage sur les plantes basses et les jeunes arbres, pailler épais au pied, rentrer les pots à l'abri. Retirer le voile en journée."

/** Règles de semis / plantation implicites tirées du calendrier de l'espèce (si elle n'en a pas). */
function implicitSowingRules(sp: Species, garden: Garden): { idx: string; rule: TaskRule }[] {
  if (sp.taches.some((r) => isSowing(r.type))) return []
  const cal = plantingCalendar(sp, garden)
  const condition: TaskCondition | undefined = sp.rusticiteC > -2 ? 'hors-gel' : undefined
  const out: { idx: string; rule: TaskRule }[] = []
  if (cal.semisPleineTerre.length) {
    out.push({ idx: 'cal-semis', rule: { type: 'semis', months: cal.semisPleineTerre, condition, howTo: HOWTO_SEMIS } })
  }
  if (cal.plantation.length) {
    out.push({ idx: 'cal-plantation', rule: { type: 'plantation', months: cal.plantation, condition, howTo: HOWTO_PLANTATION } })
  }
  return out
}

export function generateTasks(ctx: TaskContext): GeneratedTask[] {
  const { garden, plants, speciesById, weather, today } = ctx
  const month = (today.getMonth() + 1) as Month
  const todayIso = isoDate(today)
  const week = weekKey(today)

  const done = ctx.tasksDone.filter((t) => !t.gardenId || t.gardenId === garden.id)
  const doneKeys = new Set(done.map((t) => t.taskKey))
  const lastDone = new Map<string, number>()
  for (const t of done) {
    const b = baseOf(t.taskKey)
    const at = new Date(t.doneAt).getTime()
    if (!(at <= (lastDone.get(b) ?? -Infinity))) lastDone.set(b, at)
  }
  const recentlyDone = (base: string, days: number) => {
    const at = lastDone.get(base)
    return at != null && today.getTime() - at < days * DAY_MS
  }

  const wx = weather ? viewOf(weather, today) : undefined
  const balance = weather ? waterBalance(weather, today) : undefined
  const next3 = wx?.upcoming.slice(0, 3) ?? []
  const rainPast3 = wx ? round1(sum(wx.past.slice(-3).map((d) => d.rainMm))) : 0
  const rainNext2 = wx ? round1(sum(wx.upcoming.slice(0, 2).map((d) => d.rainMm))) : 0
  const frostSoon = next3.find((d) => d.tMin <= 0)
  const heavyRain = balance != null && balance.forecastRain3 > 5
  const deficitHigh = balance != null && balance.deficitMm > 10

  const tasks: GeneratedTask[] = []

  // 1. Arrosage déclenché par le bilan hydrique
  let meteoWatering: GeneratedTask | undefined
  let meteoWateringHidden = false
  if (balance && deficitHigh) {
    const base = 'jardin:arrosage:meteo'
    const thirsty = plants.filter((p) => {
      const sp = speciesById[p.speciesId]
      if (!sp || !isActive(p)) return false
      const young = today.getTime() - new Date(p.plantedAt).getTime() < 365.25 * DAY_MS
      return sp.eau === 'moyen' || sp.eau === 'eleve' || young
    })
    meteoWateringHidden = recentlyDone(base, 3)
    if (thirsty.length && !meteoWateringHidden) {
      const deficit = `Déficit de ${fmt(balance.deficitMm)} mm sur 7 jours (pluie ${fmt(balance.rain7)} mm, évaporation ${fmt(balance.et07)} mm)`
      meteoWatering = {
        key: `${todayIso}:${base}`,
        type: 'arrosage',
        title: `Arroser les plantes sensibles au sec (${thirsty.length})`,
        howTo: HOWTO_ARROSAGE,
        plantIds: thirsty.map((p) => p.id),
        priority: 'haute',
        reason: heavyRain
          ? `${deficit}, mais la pluie annoncée devrait suffire.`
          : `${deficit} ; seulement ${fmt(balance.forecastRain3)} mm de pluie prévus sous 3 jours. Jeunes plantations et plantes gourmandes en eau d'abord.`,
        ...(heavyRain ? { blockedBy: `Pluie abondante prévue (${fmt(balance.forecastRain3)} mm sous 3 jours) : inutile d'arroser` } : {}),
      }
      tasks.push(meteoWatering)
    }
  }
  const meteoWateringActive = deficitHigh && !heavyRain

  // 2. Alerte gel : plantes en place moins rustiques que la température prévue
  if (wx) {
    const coldest = wx.upcoming.reduce<DailyWeather | undefined>((c, d) => (!c || d.tMin < c.tMin ? d : c), undefined)
    if (coldest && coldest.tMin <= 0) {
      const atRisk = plants.filter((p) => isActive(p) && speciesById[p.speciesId] && speciesById[p.speciesId].rusticiteC > coldest.tMin)
      const key = `${coldest.date}:jardin:protection:gel`
      if (atRisk.length && !doneKeys.has(key)) {
        const spNames = [...new Set(atRisk.map((p) => lowerFirst(speciesById[p.speciesId].nomCommun)))]
        const list = spNames.slice(0, 4).join(', ') + (spNames.length > 4 ? '…' : '')
        tasks.push({
          key,
          type: 'protection',
          title: `Protéger du gel : ${list}${atRisk.length > 1 ? ` (${atRisk.length})` : ''}`,
          howTo: HOWTO_GEL,
          plantIds: atRisk.map((p) => p.id),
          priority: 'haute',
          reason: `Gel prévu ${dayLabel(coldest.date, todayIso)} (${fmtT(coldest.tMin)} °C) : ${list} ${atRisk.length > 1 ? 'risquent' : 'risque'} de geler.`,
        })
      }
    }
  }

  // 3. Règles des espèces, regroupées par (espèce, règle)
  const groups = new Map<string, Group>()
  for (const p of plants) {
    const sp = speciesById[p.speciesId]
    if (!sp || p.status === 'mort') continue
    const rules = [
      ...sp.taches.map((rule, i) => ({ idx: String(i), rule })),
      ...(p.status === 'projet' ? implicitSowingRules(sp, garden) : []),
    ]
    for (const { idx, rule } of rules) {
      if (!rule.months.includes(month)) continue
      if (isSowing(rule.type) ? p.status !== 'projet' : !isActive(p)) continue
      if (rule.minAgeYears != null && plantAgeYears(p, today) < rule.minAgeYears) continue
      const id = `${sp.id}:${idx}`
      const g = groups.get(id) ?? { sp, rule, idx, plants: [] }
      g.plants.push(p)
      groups.set(id, g)
    }
  }

  for (const { sp, rule, idx, plants: gp } of groups.values()) {
    const base = `${sp.id}:${rule.type}:${idx}`
    const freq = rule.frequencyDays
    const prefix = freq ? (freq < 7 ? todayIso : week) : seasonKey(rule.months, today)
    const key = `${prefix}:${base}`
    if (freq ? recentlyDone(base, freq) : doneKeys.has(key)) continue

    // L'arrosage météo couvre déjà ces plantes : on les y rattache.
    if (rule.type === 'arrosage' && meteoWateringActive) {
      if (meteoWatering) {
        for (const p of gp) if (!meteoWatering.plantIds.includes(p.id)) meteoWatering.plantIds.push(p.id)
        meteoWatering.title = `Arroser les plantes sensibles au sec (${meteoWatering.plantIds.length})`
        continue
      }
      if (meteoWateringHidden) continue
    }

    const parts = [`Fenêtre de ${TYPE_NOUN[rule.type]} : ${monthsLabel(rule.months)}`]
    if (rule.condition) parts.push(CONDITION_LABEL[rule.condition])
    if (freq) parts.push(`tous les ${freq} jours`)
    let reason = parts.join(', ') + '.'
    let priority: GeneratedTask['priority'] = 'normale'
    let blockedBy: string | undefined

    if (rule.type === 'traitement' && gp.some((p) => p.status === 'malade')) {
      priority = 'haute'
      reason += ' Une plante est signalée malade.'
    }

    switch (rule.condition) {
      case 'hors-gel':
        if (frostSoon) blockedBy = `Gel prévu ${dayLabel(frostSoon.date, todayIso)} (${fmtT(frostSoon.tMin)} °C) : attendre`
        break
      case 'apres-pluie':
        if (wx) {
          if (rainPast3 >= 2) {
            priority = 'haute'
            reason += ` Sol humide (${fmt(rainPast3)} mm ces 3 derniers jours) : désherbage facile.`
          } else {
            reason += ' Sol sec, désherbage plus difficile.'
          }
        }
        break
      case 'temps-sec':
        if (rainNext2 > 1) blockedBy = `Pluie prévue sous 48 h (${fmt(rainNext2)} mm) : attendre un temps sec`
        break
      case 'chaleur': {
        if (wx) {
          const hot = next3.find((d) => d.tMax > 25)
          if (!hot) continue // pas de chaleur prévue : rien à faire
          priority = 'haute'
          reason += ` ${fmtT(hot.tMax)} °C prévus ${dayLabel(hot.date, todayIso)}.`
        } else {
          priority = 'basse'
        }
        break
      }
      default:
        break
    }

    if (rule.type === 'arrosage' && balance && !blockedBy) {
      if (heavyRain) blockedBy = `Pluie abondante prévue (${fmt(balance.forecastRain3)} mm sous 3 jours) : inutile d'arroser`
      else if (balance.deficitMm <= 0) {
        priority = 'basse'
        reason += ` Pluie récente suffisante (${fmt(balance.rain7)} mm sur 7 jours).`
      }
    }

    tasks.push({
      key,
      type: rule.type,
      title: taskTitle(rule.type, sp, gp.length),
      howTo: rule.howTo,
      ...(rule.tool ? { tool: rule.tool } : {}),
      plantIds: gp.map((p) => p.id),
      speciesId: sp.id,
      priority,
      reason,
      ...(blockedBy ? { blockedBy } : {}),
    })
  }

  return tasks.sort(
    (a, b) =>
      Number(!!a.blockedBy) - Number(!!b.blockedBy) ||
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
      a.title.localeCompare(b.title, 'fr'),
  )
}

/** Calendrier annuel : pour chaque mois, les tâches prévues par (type, espèce) et le nombre de plantes concernées. */
export function yearPlan(
  plants: Plant[],
  speciesById: Record<string, Species>,
): { month: Month; tasks: { type: TaskType; speciesId: string; count: number }[] }[] {
  const out = Array.from({ length: 12 }, (_, i) => ({
    month: (i + 1) as Month,
    tasks: [] as { type: TaskType; speciesId: string; count: number }[],
  }))
  const counts = out.map(() => new Map<string, { type: TaskType; speciesId: string; plants: Set<string> }>())
  for (const p of plants) {
    const sp = speciesById[p.speciesId]
    if (!sp || p.status === 'mort') continue
    for (const rule of sp.taches) {
      if (isSowing(rule.type) ? p.status !== 'projet' : !isActive(p)) continue
      for (const m of new Set(rule.months)) {
        const map = counts[m - 1]
        const id = `${rule.type}:${sp.id}`
        const e = map.get(id) ?? { type: rule.type, speciesId: sp.id, plants: new Set<string>() }
        e.plants.add(p.id)
        map.set(id, e)
      }
    }
  }
  counts.forEach((map, i) => {
    out[i].tasks = [...map.values()]
      .map((e) => ({ type: e.type, speciesId: e.speciesId, count: e.plants.size }))
      .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.speciesId.localeCompare(b.speciesId))
  })
  return out
}
