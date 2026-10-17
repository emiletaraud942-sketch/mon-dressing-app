import { useEffect, useMemo, useState } from 'react'
import { SPECIES_BY_ID } from '../../data/species'
import { useGardenPlants, useStore } from '../../lib/store'
import { fetchWeather } from '../../lib/weather'
import { generateTasks } from '../../engine/tasks'
import type { Garden, GeneratedTask, WeatherBundle } from '../../types'

const weatherCache = new Map<string, Promise<WeatherBundle>>()

export function useWeather(garden?: Garden) {
  const [weather, setWeather] = useState<WeatherBundle>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (!garden) return
    const key = `${garden.center.lon.toFixed(3)},${garden.center.lat.toFixed(3)}`
    let p = weatherCache.get(key)
    if (!p) {
      p = fetchWeather(garden.center)
      weatherCache.set(key, p)
      p.catch(() => weatherCache.delete(key))
    }
    let alive = true
    p.then((w) => alive && (setWeather(w), setError(undefined))).catch((e) => alive && setError((e as Error).message))
    return () => {
      alive = false
    }
  }, [garden?.center.lon, garden?.center.lat]) // eslint-disable-line react-hooks/exhaustive-deps
  return { weather, error }
}

export function useTasks(garden?: Garden): { tasks: (GeneratedTask & { done?: boolean })[]; weather?: WeatherBundle; weatherError?: string } {
  const plants = useGardenPlants(garden?.id)
  const tasksDone = useStore((s) => s.tasksDone)
  const { weather, error } = useWeather(garden)
  const tasks = useMemo(() => {
    if (!garden) return []
    try {
      return generateTasks({
        garden,
        plants,
        speciesById: SPECIES_BY_ID,
        weather,
        today: new Date(),
        tasksDone: tasksDone.filter((t) => t.gardenId === garden.id),
      })
    } catch (e) {
      console.error('Moteur de tâches', e)
      return []
    }
  }, [garden, plants, weather, tasksDone])
  return { tasks, weather, weatherError: error }
}
