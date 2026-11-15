import { useQuery } from '@tanstack/react-query'
import { hojeISO, parseData } from './format'
import type { Jogo } from './types'

/**
 * Previsão do tempo via Open-Meteo (gratuita, sem chave, aceita chamadas do navegador).
 * https://open-meteo.com — previsão horária por latitude/longitude, até ~16 dias à frente.
 */
const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const GEOCODING = 'https://geocoding-api.open-meteo.com/v1/search'
const FUSO = 'America/Sao_Paulo'

/** A previsão só existe para os próximos ~16 dias (hoje = dia 0). */
export const DIAS_DE_PREVISAO = 15

export interface Clima {
  temperatura: number
  codigo: number
  dia: boolean
}

export interface Condicao {
  icone: string
  rotulo: string
}

/** Códigos WMO usados pela Open-Meteo → ícone e descrição em português. */
export function condicao(codigo: number, dia = true): Condicao {
  if (codigo === 0) return { icone: dia ? '☀️' : '🌙', rotulo: 'Céu limpo' }
  if (codigo === 1) return { icone: dia ? '🌤️' : '🌙', rotulo: 'Poucas nuvens' }
  if (codigo === 2) return { icone: dia ? '⛅' : '☁️', rotulo: 'Parcialmente nublado' }
  if (codigo === 3) return { icone: '☁️', rotulo: 'Nublado' }
  if (codigo === 45 || codigo === 48) return { icone: '🌫️', rotulo: 'Neblina' }
  if (codigo >= 51 && codigo <= 55) return { icone: '🌦️', rotulo: 'Garoa' }
  if (codigo === 56 || codigo === 57) return { icone: '🌧️', rotulo: 'Garoa gelada' }
  if (codigo === 61) return { icone: '🌦️', rotulo: 'Chuva fraca' }
  if (codigo === 63) return { icone: '🌧️', rotulo: 'Chuva' }
  if (codigo === 65) return { icone: '🌧️', rotulo: 'Chuva forte' }
  if (codigo === 66 || codigo === 67) return { icone: '🌧️', rotulo: 'Chuva gelada' }
  if (codigo >= 71 && codigo <= 77) return { icone: '🌨️', rotulo: 'Neve' }
  if (codigo === 80) return { icone: '🌦️', rotulo: 'Pancadas de chuva fracas' }
  if (codigo === 81) return { icone: '🌧️', rotulo: 'Pancadas de chuva' }
  if (codigo === 82) return { icone: '🌧️', rotulo: 'Pancadas de chuva fortes' }
  if (codigo === 85 || codigo === 86) return { icone: '🌨️', rotulo: 'Pancadas de neve' }
  if (codigo === 95) return { icone: '⛈️', rotulo: 'Trovoadas' }
  if (codigo === 96 || codigo === 99) return { icone: '⛈️', rotulo: 'Trovoadas com granizo' }
  return { icone: '🌡️', rotulo: 'Tempo indefinido' }
}

/** Quantos dias faltam para a data (negativo = já passou). */
export function diasAte(data: string): number {
  return Math.round((parseData(data).getTime() - parseData(hojeISO()).getTime()) / 86_400_000)
}

/** Hora cheia mais próxima do horário do jogo ("08:30" → 9, "08:10" → 8), limitada a 0–23. */
export function horaDoJogo(horario: string): number {
  const [h, m] = horario.split(':').map(Number)
  return Math.min(23, h + (m >= 30 ? 1 : 0))
}

interface RespostaForecast {
  hourly?: {
    time?: string[]
    temperature_2m?: (number | null)[]
    weather_code?: (number | null)[]
    weathercode?: (number | null)[]
    is_day?: (number | null)[]
  }
}

/** Extrai da resposta horária a previsão da hora pedida (ex.: "2026-11-21T08:00"). */
export function extrairHora(r: RespostaForecast, data: string, hora: number): Clima | null {
  const h = r.hourly
  if (!h?.time) return null
  const chave = `${data}T${String(hora).padStart(2, '0')}:00`
  const i = h.time.indexOf(chave)
  const temp = h.temperature_2m?.[i]
  const codigo = (h.weather_code ?? h.weathercode)?.[i]
  if (i < 0 || temp == null || codigo == null) return null
  return { temperatura: Math.round(temp), codigo, dia: (h.is_day?.[i] ?? 1) === 1 }
}

export async function buscarClima(lat: number, lon: number, data: string, hora: number): Promise<Clima | null> {
  const url = new URL(FORECAST)
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'temperature_2m,weather_code,is_day',
    timezone: FUSO,
    start_date: data,
    end_date: data,
  }).toString()
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Previsão indisponível (${res.status})`)
  return extrairHora((await res.json()) as RespostaForecast, data, hora)
}

export interface Lugar {
  rotulo: string
  cidade: string
  latitude: number
  longitude: number
}

/** Busca cidades/bairros pelo nome para o admin escolher o local da pelada. */
export async function buscarLugar(nome: string): Promise<Lugar[]> {
  const url = new URL(GEOCODING)
  url.search = new URLSearchParams({ name: nome, count: '6', language: 'pt', format: 'json' }).toString()
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Busca indisponível (${res.status})`)
  const json = (await res.json()) as {
    results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[]
  }
  return (json.results ?? []).map((r) => ({
    rotulo: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    cidade: [r.name, r.admin1].filter(Boolean).join(', '),
    latitude: r.latitude,
    longitude: r.longitude,
  }))
}

type JogoClima = Pick<Jogo, 'data' | 'horario' | 'status' | 'peladas'>

/** Previsão para a data e a hora do jogo, só para jogos que ainda vão acontecer e estão no alcance da previsão. */
export function useClima(jogo: JogoClima | null | undefined) {
  const lat = jogo?.peladas?.latitude
  const lon = jogo?.peladas?.longitude
  const dias = jogo ? diasAte(jogo.data) : -1
  const hora = jogo ? horaDoJogo(jogo.horario) : 0
  const temLocal = lat != null && lon != null
  const noAlcance = jogo?.status === 'agendado' && dias >= 0 && dias <= DIAS_DE_PREVISAO

  const q = useQuery({
    queryKey: ['clima', lat, lon, jogo?.data, hora],
    enabled: temLocal && noAlcance,
    staleTime: 60 * 60_000, // previsão muda devagar: 1 h evita chamadas repetidas
    retry: 1,
    queryFn: () => buscarClima(Number(lat), Number(lon), jogo!.data, hora),
  })
  return { ...q, temLocal, dias, noAlcance }
}
