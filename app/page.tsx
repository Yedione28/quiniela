'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type RoundName =
  | 'round_of_32'
  | 'round_of_16'
  | 'quarterfinal'
  | 'semifinal'
  | 'final'

type Match = {
  id: number
  home_team: string
  away_team: string
  kickoff: string
  status?: string | null
  home_score?: number | null
  away_score?: number | null
  round_name?: RoundName | null
  bracket_order?: number | null
  winner_team?: string | null
}

type Participant = {
  id: string
  name: string
}

type CurrentParticipant = {
  id: string
  name: string
}

type LeaderboardEntry = {
  position: number
  id: string
  name: string
  total_points: number
  exact_scores: number
  correct_results: number
}

type RoundLeaderboardEntry = LeaderboardEntry & {
  round_name: RoundName
  round_label: string
  round_sort: number
}

type RankingMovementEntry = {
  id: string
  name: string
  current_position: number
  previous_position: number | null
  movement: number
  movement_type: 'subio' | 'bajo' | 'igual' | 'nuevo'
  total_points: number
  exact_scores: number
  correct_results: number
}

type AdminMatchPrediction = {
  participant_name: string
  match_id: number
  home_team: string
  away_team: string
  kickoff: string
  predicted_home: number | null
  predicted_away: number | null
  predicted_advancing_team: string | null
  created_at: string | null
}

const APP_TIME_ZONE = 'America/Mexico_City'

const ROUND_ORDER: RoundName[] = [
  'round_of_32',
  'round_of_16',
  'quarterfinal',
  'semifinal',
  'final'
]

const ROUND_LABELS: Record<RoundName, string> = {
  round_of_32: 'Dieciseisavos de final',
  round_of_16: 'Octavos de final',
  quarterfinal: 'Cuartos de final',
  semifinal: 'Semifinales',
  final: 'Final'
}

const TEAM_TRANSLATIONS: Record<string, string> = {
  algeria: 'Argelia',
  australia: 'Australia',
  austria: 'Austria',
  belgium: 'Bélgica',
  'bosnia and herzegovina': 'Bosnia y Herzegovina',
  brazil: 'Brasil',
  canada: 'Canadá',
  'cape verde': 'Cabo Verde',
  colombia: 'Colombia',
  croatia: 'Croacia',
  'dr congo': 'RD Congo',
  ecuador: 'Ecuador',
  egypt: 'Egipto',
  england: 'Inglaterra',
  france: 'Francia',
  germany: 'Alemania',
  ghana: 'Ghana',
  'ivory coast': 'Costa de Marfil',
  japan: 'Japón',
  mexico: 'México',
  morocco: 'Marruecos',
  netherlands: 'Países Bajos',
  norway: 'Noruega',
  paraguay: 'Paraguay',
  portugal: 'Portugal',
  senegal: 'Senegal',
  'south africa': 'Sudáfrica',
  spain: 'España',
  sweden: 'Suecia',
  switzerland: 'Suiza',
  'united states': 'Estados Unidos'
}

const TEAM_FLAGS: Record<string, string> = {
  algeria: '🇩🇿',
  alemania: '🇩🇪',
  argentina: '🇦🇷',
  australia: '🇦🇺',
  austria: '🇦🇹',
  belgica: '🇧🇪',
  belgium: '🇧🇪',
  'bosnia and herzegovina': '🇧🇦',
  'bosnia y herzegovina': '🇧🇦',
  brasil: '🇧🇷',
  brazil: '🇧🇷',
  canada: '🇨🇦',
  'cape verde': '🇨🇻',
  'cabo verde': '🇨🇻',
  colombia: '🇨🇴',
  croacia: '🇭🇷',
  croatia: '🇭🇷',
  'costa de marfil': '🇨🇮',
  'ivory coast': '🇨🇮',
  'dr congo': '🇨🇩',
  'rd congo': '🇨🇩',
  ecuador: '🇪🇨',
  egipto: '🇪🇬',
  egypt: '🇪🇬',
  england: '🇬🇧',
  inglaterra: '🇬🇧',
  españa: '🇪🇸',
  espana: '🇪🇸',
  spain: '🇪🇸',
  'estados unidos': '🇺🇸',
  'united states': '🇺🇸',
  francia: '🇫🇷',
  france: '🇫🇷',
  ghana: '🇬🇭',
  germany: '🇩🇪',
  japon: '🇯🇵',
  'japón': '🇯🇵',
  japan: '🇯🇵',
  marruecos: '🇲🇦',
  morocco: '🇲🇦',
  mexico: '🇲🇽',
  'méxico': '🇲🇽',
  netherlands: '🇳🇱',
  'países bajos': '🇳🇱',
  'paises bajos': '🇳🇱',
  noruega: '🇳🇴',
  norway: '🇳🇴',
  paraguay: '🇵🇾',
  portugal: '🇵🇹',
  senegal: '🇸🇳',
  south_africa: '🇿🇦',
  'south africa': '🇿🇦',
  sudafrica: '🇿🇦',
  'sudáfrica': '🇿🇦',
  suecia: '🇸🇪',
  sweden: '🇸🇪',
  suiza: '🇨🇭',
  switzerland: '🇨🇭'
}

function normalizeTeamName(team: string) {
  return team
    .trim()
    .toLocaleLowerCase('es-MX')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function isPlaceholderTeam(team: string | null | undefined) {
  return !team || normalizeTeamName(team).startsWith('por definir')
}

function displayTeamName(team: string | null | undefined) {
  if (isPlaceholderTeam(team)) {
    return 'Por definir'
  }

  const original = team || ''
  return TEAM_TRANSLATIONS[normalizeTeamName(original)] || original
}

function getTeamFlag(team: string | null | undefined) {
  if (isPlaceholderTeam(team)) {
    return '🏆'
  }

  return TEAM_FLAGS[normalizeTeamName(team || '')] || '🏳️'
}

function formatMatchDate(kickoff: string) {
  const date = new Date(kickoff)

  const datePart = date.toLocaleDateString('es-MX', {
    timeZone: APP_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  })

  const timePart = date
    .toLocaleTimeString('en-US', {
      timeZone: APP_TIME_ZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    .toLowerCase()

  return `${datePart} · ${timePart}`
}

export default function Home() {
  const [matches, setMatches] = useState<Match[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [roundLeaderboard, setRoundLeaderboard] = useState<
    RoundLeaderboardEntry[]
  >([])
  const [selectedRound, setSelectedRound] =
    useState<RoundName>('round_of_32')
  const [movements, setMovements] = useState<RankingMovementEntry[]>([])
  const [adminMatchPredictions, setAdminMatchPredictions] = useState<
    AdminMatchPrediction[]
  >([])
  const [adminReviewMatchId, setAdminReviewMatchId] = useState<number | null>(
    null
  )
  const [adminReviewError, setAdminReviewError] = useState('')

  const [currentParticipant, setCurrentParticipant] =
    useState<CurrentParticipant | null>(null)
  const [participantPin, setParticipantPin] = useState('')
  const [selectedLoginName, setSelectedLoginName] = useState('')
  const [loginPinInput, setLoginPinInput] = useState('')

  const [isAdmin, setIsAdmin] = useState(false)
  const [adminPin, setAdminPin] = useState('')
  const [adminPinInput, setAdminPinInput] = useState('')

  const [predictions, setPredictions] = useState<
    Record<number, { home: string; away: string; advancing: string }>
  >({})

  const [resultInputs, setResultInputs] = useState<
    Record<number, { home: string; away: string }>
  >({})

  const [winnerInputs, setWinnerInputs] = useState<Record<number, string>>({})

  useEffect(() => {
    loadMatches()
    loadParticipants()
    loadLeaderboard()
    loadRoundLeaderboard()
    loadMovements()

    const savedParticipantId = localStorage.getItem('quiniela_participant_id')
    const savedParticipantName = localStorage.getItem(
      'quiniela_participant_name'
    )
    const savedParticipantPin = localStorage.getItem('quiniela_participant_pin')

    if (savedParticipantId && savedParticipantName && savedParticipantPin) {
      setCurrentParticipant({
        id: savedParticipantId,
        name: savedParticipantName
      })

      setParticipantPin(savedParticipantPin)
      loadPredictionsForParticipant(savedParticipantId, savedParticipantPin)
    }

    const savedAdminPin = localStorage.getItem('quiniela_admin_pin')

    if (savedAdminPin) {
      checkAdminPin(savedAdminPin, false)
    }
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadMatches()
      loadLeaderboard()
      loadRoundLeaderboard()
      loadMovements()

      if (currentParticipant && participantPin) {
        loadPredictionsForParticipant(currentParticipant.id, participantPin)
      }

      if (isAdmin && adminPin) {
        loadAdminMatchPredictions(adminPin)
      }
    }, 60000)

    return () => window.clearInterval(intervalId)
  }, [currentParticipant, participantPin, isAdmin, adminPin])

  useEffect(() => {
    if (!isAdmin) {
      return
    }

    const reviewMatches = matches
      .filter((match) => isMatchConfirmed(match))
      .sort(
        (a, b) =>
          new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
      )

    if (reviewMatches.length === 0) {
      setAdminReviewMatchId(null)
      return
    }

    const hasSavedPrediction = (match: Match) =>
      adminMatchPredictions.some(
        (entry) =>
          String(entry.match_id) === String(match.id) &&
          entry.predicted_home !== null &&
          entry.predicted_home !== undefined &&
          entry.predicted_away !== null &&
          entry.predicted_away !== undefined
      )

    const firstMatchWithPredictions = reviewMatches.find(hasSavedPrediction)

    const now = new Date()
    const activeOrNextMatch =
      reviewMatches.find((match) => {
        const kickoff = new Date(match.kickoff).getTime()
        const sixHoursAgo = now.getTime() - 6 * 60 * 60 * 1000

        return kickoff >= sixHoursAgo && kickoff <= now.getTime()
      }) ||
      reviewMatches.find(
        (match) => new Date(match.kickoff).getTime() > now.getTime()
      )

    setAdminReviewMatchId((currentId) => {
      const currentStillExists = reviewMatches.some(
        (match) => String(match.id) === String(currentId)
      )

      if (currentStillExists) {
        return currentId
      }

      return (
        firstMatchWithPredictions?.id ||
        activeOrNextMatch?.id ||
        reviewMatches[0].id
      )
    })
  }, [isAdmin, matches, adminMatchPredictions])

  const currentLeaderboardEntry = currentParticipant
    ? leaderboard.find((entry) => entry.id === currentParticipant.id)
    : null

  const savedPredictionCount = Object.values(predictions).filter(
    (prediction) => prediction.home !== '' && prediction.away !== ''
  ).length

  const finalMatch = matches.find(
    (match) =>
      match.round_name === 'final' &&
      match.status === 'finished' &&
      !!match.winner_team
  )

  const tournamentIsFinished = !!finalMatch

  async function loadMatches() {
    const { data, error } = await supabase.from('matches').select('*')

    if (error) {
      console.error(error)
      return
    }

    setMatches((data || []) as Match[])
  }

  async function loadParticipants() {
    const { data, error } = await supabase
      .from('leaderboard_view')
      .select('id, name')
      .order('name', { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    setParticipants((data || []) as Participant[])
  }

  async function loadLeaderboard() {
    const { data, error } = await supabase
      .from('leaderboard_view')
      .select('*')
      .order('position', { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    setLeaderboard((data || []) as LeaderboardEntry[])
  }

  async function loadRoundLeaderboard() {
    const { data, error } = await supabase
      .from('round_leaderboard_view')
      .select('*')
      .order('round_sort', { ascending: true })
      .order('position', { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    setRoundLeaderboard((data || []) as RoundLeaderboardEntry[])
  }

  async function loadMovements() {
    const { data, error } = await supabase
      .from('ranking_movement_view')
      .select('*')

    if (error) {
      console.error(error)
      return
    }

    setMovements((data || []) as RankingMovementEntry[])
  }

  async function loadPredictionsForParticipant(userId: string, pinCode: string) {
    const { data, error } = await supabase.rpc('get_predictions_by_pin', {
      p_user_id: userId,
      p_pin_code: pinCode
    })

    if (error) {
      console.error(error)
      return
    }

    const loaded: Record<
      number,
      { home: string; away: string; advancing: string }
    > = {}

    ;(data || []).forEach((prediction: any) => {
      loaded[prediction.match_id] = {
        home: String(prediction.predicted_home),
        away: String(prediction.predicted_away),
        advancing: prediction.predicted_advancing_team || ''
      }
    })

    setPredictions(loaded)
  }

  async function loadAdminMatchPredictions(pinToUse: string) {
    const { data, error } = await supabase.rpc(
      'get_admin_all_match_predictions',
      {
        p_admin_pin: pinToUse
      }
    )

    if (error) {
      console.error(error)
      setAdminReviewError(error.message)
      return
    }

    setAdminReviewError('')
    setAdminMatchPredictions((data || []) as AdminMatchPrediction[])
  }

  async function loginWithPin() {
    if (selectedLoginName === '' || loginPinInput.trim() === '') {
      alert('Selecciona tu nombre e ingresa tu PIN')
      return
    }

    const { data, error } = await supabase.rpc('login_with_pin', {
      p_name: selectedLoginName,
      p_pin_code: loginPinInput.trim()
    })

    if (error) {
      console.error(error)
      alert(`Error: ${error.message}`)
      return
    }

    if (!data || data.length === 0) {
      alert('Nombre o PIN incorrecto')
      return
    }

    const loggedUser = data[0] as {
      user_id: string
      user_name: string
    }

    setCurrentParticipant({
      id: loggedUser.user_id,
      name: loggedUser.user_name
    })

    setParticipantPin(loginPinInput.trim())

    localStorage.setItem('quiniela_participant_id', loggedUser.user_id)
    localStorage.setItem('quiniela_participant_name', loggedUser.user_name)
    localStorage.setItem('quiniela_participant_pin', loginPinInput.trim())

    loadPredictionsForParticipant(loggedUser.user_id, loginPinInput.trim())
    setLoginPinInput('')
  }

  function logoutParticipant() {
    setCurrentParticipant(null)
    setParticipantPin('')
    setPredictions({})

    localStorage.removeItem('quiniela_participant_id')
    localStorage.removeItem('quiniela_participant_name')
    localStorage.removeItem('quiniela_participant_pin')
  }

  async function checkAdminPin(pinToCheck: string, showSuccess: boolean) {
    const { data, error } = await supabase.rpc('admin_check_pin', {
      p_admin_pin: pinToCheck
    })

    if (error) {
      console.error(error)
      alert(`Error: ${error.message}`)
      return
    }

    if (!data) {
      setIsAdmin(false)
      setAdminPin('')
      setAdminMatchPredictions([])
      localStorage.removeItem('quiniela_admin_pin')

      if (showSuccess) {
        alert('PIN de admin incorrecto')
      }

      return
    }

    setIsAdmin(true)
    setAdminPin(pinToCheck)
    localStorage.setItem('quiniela_admin_pin', pinToCheck)
    loadAdminMatchPredictions(pinToCheck)

    if (showSuccess) {
      alert('✅ Admin activado')
    }
  }

  async function activateAdmin() {
    if (adminPinInput.trim() === '') {
      alert('Ingresa el PIN de admin')
      return
    }

    await checkAdminPin(adminPinInput.trim(), true)
    setAdminPinInput('')
  }

  function logoutAdmin() {
    setIsAdmin(false)
    setAdminPin('')
    setResultInputs({})
    setWinnerInputs({})
    setAdminMatchPredictions([])
    setAdminReviewMatchId(null)
    setAdminReviewError('')
    localStorage.removeItem('quiniela_admin_pin')
  }

  function isMatchConfirmed(match: Match) {
    return (
      !isPlaceholderTeam(match.home_team) && !isPlaceholderTeam(match.away_team)
    )
  }

  function isMatchLocked(match: Match) {
    return match.status === 'finished' || new Date(match.kickoff) <= new Date()
  }

  function getRoundMatches(round: RoundName) {
    return matches
      .filter((match) => match.round_name === round)
      .sort((a, b) => (a.bracket_order || 0) - (b.bracket_order || 0))
  }

  function getInputValue(
    source: Record<number, { home: string; away: string }>,
    match: Match,
    side: 'home' | 'away',
    fallback?: number | null
  ) {
    const currentValue = source[match.id]?.[side]

    if (currentValue !== undefined) {
      return currentValue
    }

    if (fallback !== undefined && fallback !== null) {
      return String(fallback)
    }

    return ''
  }

  function updatePredictionScore(
    matchId: number,
    side: 'home' | 'away',
    value: string
  ) {
    setPredictions((previous) => {
      const current = previous[matchId] || {
        home: '',
        away: '',
        advancing: ''
      }

      const next = {
        ...current,
        [side]: value
      }

      if (
        next.home !== '' &&
        next.away !== '' &&
        Number(next.home) !== Number(next.away)
      ) {
        next.advancing = ''
      }

      return {
        ...previous,
        [matchId]: next
      }
    })
  }

  function updatePredictionAdvancing(matchId: number, advancing: string) {
    setPredictions((previous) => ({
      ...previous,
      [matchId]: {
        ...(previous[matchId] || {
          home: '',
          away: '',
          advancing: ''
        }),
        advancing
      }
    }))
  }

  async function savePrediction(match: Match) {
    if (!currentParticipant) {
      alert('Debes entrar con tu nombre y PIN')
      return
    }

    if (!isMatchConfirmed(match) || isMatchLocked(match)) {
      alert('Este partido no está disponible para pronósticos')
      return
    }

    const prediction = predictions[match.id]

    if (!prediction || prediction.home === '' || prediction.away === '') {
      alert('Ingresa ambos marcadores')
      return
    }

    const predictionIsDraw =
      Number(prediction.home) === Number(prediction.away)

    if (predictionIsDraw && prediction.advancing === '') {
      alert(
        'Como pronosticaste un empate tras 90 minutos, selecciona el equipo que avanza.'
      )
      return
    }

    const { error } = await supabase.rpc('save_prediction_by_pin', {
      p_user_id: currentParticipant.id,
      p_pin_code: participantPin,
      p_match_id: match.id,
      p_home: Number(prediction.home),
      p_away: Number(prediction.away),
      p_advancing_team: predictionIsDraw ? prediction.advancing : null
    })

    if (error) {
      console.error(error)
      alert(`Error: ${error.message}`)
      return
    }

    alert('✅ Pronóstico guardado')
    loadPredictionsForParticipant(currentParticipant.id, participantPin)

    if (isAdmin && adminPin) {
      loadAdminMatchPredictions(adminPin)
    }
  }

  async function saveKnockoutResult(match: Match) {
    if (!isAdmin) {
      alert('No tienes permisos de administrador')
      return
    }

    if (!isMatchConfirmed(match)) {
      alert('Todavía faltan equipos por confirmar en este partido')
      return
    }

    const homeText = getInputValue(
      resultInputs,
      match,
      'home',
      match.home_score
    )
    const awayText = getInputValue(
      resultInputs,
      match,
      'away',
      match.away_score
    )

    if (homeText === '' || awayText === '') {
      alert('Ingresa ambos marcadores finales')
      return
    }

    const homeScore = Number(homeText)
    const awayScore = Number(awayText)

    if (
      Number.isNaN(homeScore) ||
      Number.isNaN(awayScore) ||
      homeScore < 0 ||
      awayScore < 0
    ) {
      alert('Los marcadores no son válidos')
      return
    }

    let advancingTeam = winnerInputs[match.id] || ''

    if (homeScore > awayScore) {
      advancingTeam = match.home_team
    }

    if (awayScore > homeScore) {
      advancingTeam = match.away_team
    }

    if (homeScore === awayScore && advancingTeam === '') {
      alert(
        'El partido terminó empatado. Selecciona el equipo que avanzó por penales.'
      )
      return
    }

    const { error } = await supabase.rpc('admin_finish_knockout_match_pin', {
      p_admin_pin: adminPin,
      p_match_id: match.id,
      p_home_score: homeScore,
      p_away_score: awayScore,
      p_winner_team: advancingTeam
    })

    if (error) {
      console.error(error)
      alert(`Error: ${error.message}`)
      return
    }

    alert('✅ Resultado guardado. El ganador avanzó automáticamente.')

    loadMatches()
    loadLeaderboard()
    loadMovements()
    loadAdminMatchPredictions(adminPin)

    if (currentParticipant) {
      loadPredictionsForParticipant(currentParticipant.id, participantPin)
    }
  }

  function renderTeamLabel(team: string) {
    if (isPlaceholderTeam(team)) {
      return (
        <span style={{ color: '#888', fontStyle: 'italic' }}>
          🏆 Por definir
        </span>
      )
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          minWidth: 0
        }}
      >
        <span style={{ fontSize: '1.15rem' }}>{getTeamFlag(team)}</span>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {displayTeamName(team)}
        </span>
      </span>
    )
  }

  function renderLoginBox() {
    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          justifyContent: 'flex-end',
          alignItems: 'center'
        }}
      >
        {currentParticipant ? (
          <div
            style={{
              background: 'rgba(255,255,255,0.14)',
              padding: '8px 10px',
              borderRadius: '12px'
            }}
          >
            👤 {currentParticipant.name}

            <button
              onClick={logoutParticipant}
              style={smallHeaderButtonStyle}
            >
              Salir
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              justifyContent: 'flex-end'
            }}
          >
            <select
              value={selectedLoginName}
              onChange={(e) => setSelectedLoginName(e.target.value)}
              style={headerInputStyle}
            >
              <option value="">Selecciona tu nombre</option>
              {participants.map((participant) => (
                <option key={participant.id} value={participant.name}>
                  {participant.name}
                </option>
              ))}
            </select>

            <input
              type="password"
              placeholder="PIN"
              value={loginPinInput}
              onChange={(e) => setLoginPinInput(e.target.value)}
              style={{ ...headerInputStyle, width: '86px' }}
            />

            <button onClick={loginWithPin} style={headerButtonStyle}>
              Entrar
            </button>
          </div>
        )}

        {isAdmin ? (
          <div
            style={{
              background: 'rgba(255,255,255,0.14)',
              padding: '8px 10px',
              borderRadius: '12px'
            }}
          >
            🛠️ Admin activo

            <button
              onClick={logoutAdmin}
              style={smallHeaderButtonStyle}
            >
              Cerrar admin
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="password"
              placeholder="PIN admin"
              value={adminPinInput}
              onChange={(e) => setAdminPinInput(e.target.value)}
              style={{ ...headerInputStyle, width: '112px' }}
            />

            <button onClick={activateAdmin} style={headerButtonStyle}>
              Admin
            </button>
          </div>
        )}
      </div>
    )
  }

  function renderNavBar() {
    return (
      <nav
        style={{
          position: 'sticky',
          top: '0',
          zIndex: 10,
          display: 'flex',
          gap: '8px',
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: '22px',
          padding: '10px',
          borderRadius: '14px',
          background: 'rgba(0,0,0,0.14)',
          backdropFilter: 'blur(6px)'
        }}
      >
        <a href="#llaves" style={navLinkStyle}>
          Llaves
        </a>
        <a href="#tabla" style={navLinkStyle}>
          Tabla general
        </a>
        <a href="#por-ronda" style={navLinkStyle}>
          Por ronda
        </a>
        {tournamentIsFinished && (
          <a href="#campeones" style={navLinkStyle}>
            Campeones
          </a>
        )}
        <a href="#movimiento" style={navLinkStyle}>
          Movimiento
        </a>
        {isAdmin && (
          <a href="#admin-en-curso" style={navLinkStyle}>
            Admin: Pronósticos
          </a>
        )}
      </nav>
    )
  }

  function renderProfileSummary() {
    if (!currentParticipant) {
      return null
    }

    return (
      <section
        style={{
          background: 'white',
          color: '#222',
          borderRadius: '20px',
          padding: '18px',
          marginBottom: '22px'
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
            alignItems: 'center'
          }}
        >
          <div>
            <div style={{ color: '#777', fontSize: '0.82rem' }}>
              Participante
            </div>
            <strong style={{ fontSize: '1.15rem' }}>
              👤 {currentParticipant.name}
            </strong>
          </div>

          <SummaryStat
            label="Posición"
            value={
              currentLeaderboardEntry
                ? `#${currentLeaderboardEntry.position}`
                : 'Sin posición'
            }
          />
          <SummaryStat
            label="Puntos"
            value={currentLeaderboardEntry?.total_points || 0}
          />
          <SummaryStat
            label="Pronósticos guardados"
            value={savedPredictionCount}
          />
        </div>
      </section>
    )
  }

  function renderBracketMatch(match: Match) {
    const confirmed = isMatchConfirmed(match)
    const locked = isMatchLocked(match)
    const finished = match.status === 'finished'

    const predictionHome = getInputValue(predictions, match, 'home')
    const predictionAway = getInputValue(predictions, match, 'away')
    const predictionAdvancing = predictions[match.id]?.advancing || ''

    const predictionIsDraw =
      predictionHome !== '' &&
      predictionAway !== '' &&
      Number(predictionHome) === Number(predictionAway)

    const resultHome = getInputValue(
      resultInputs,
      match,
      'home',
      match.home_score
    )
    const resultAway = getInputValue(
      resultInputs,
      match,
      'away',
      match.away_score
    )

    const resultHomeNumber = Number(resultHome)
    const resultAwayNumber = Number(resultAway)

    const isDrawInput =
      resultHome !== '' &&
      resultAway !== '' &&
      !Number.isNaN(resultHomeNumber) &&
      !Number.isNaN(resultAwayNumber) &&
      resultHomeNumber === resultAwayNumber

    const statusLabel = finished
      ? '✅ Finalizado'
      : confirmed && !locked
        ? '🟢 Pronóstico abierto'
        : confirmed
          ? '🔒 Pronóstico cerrado'
          : '⏳ Esperando ganadores'

    const statusColor = finished
      ? '#006847'
      : confirmed && !locked
        ? '#006847'
        : confirmed
          ? '#666'
          : '#9a6700'

    return (
      <article
        key={match.id}
        style={{
          width: '100%',
          borderRadius: '14px',
          border: finished ? '2px solid #b7dfc8' : '1px solid #dcdcdc',
          background: finished ? '#f4fbf6' : 'white',
          boxShadow: '0 3px 10px rgba(0,0,0,0.08)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '9px 11px',
            background: '#f7f7f7',
            borderBottom: '1px solid #e7e7e7'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '8px',
              alignItems: 'center',
              fontSize: '0.75rem',
              color: '#666'
            }}
          >
            <strong style={{ color: '#333' }}>
              Partido {match.bracket_order || '-'}
            </strong>
            <span>{formatMatchDate(match.kickoff)}</span>
          </div>
        </div>

        <div style={{ padding: '10px 11px 11px' }}>
          <div style={teamPredictionRowStyle}>
            <strong style={{ minWidth: 0 }}>{renderTeamLabel(match.home_team)}</strong>
            <input
              aria-label={`Pronóstico ${displayTeamName(match.home_team)}`}
              type="number"
              min="0"
              value={predictionHome}
              disabled={!confirmed || locked || !currentParticipant}
              onChange={(e) =>
                updatePredictionScore(match.id, 'home', e.target.value)
              }
              style={scoreInputStyle(!confirmed || locked || !currentParticipant)}
            />
          </div>

          <div style={{ ...teamPredictionRowStyle, paddingTop: '8px', borderTop: 'none' }}>
            <strong style={{ minWidth: 0 }}>{renderTeamLabel(match.away_team)}</strong>
            <input
              aria-label={`Pronóstico ${displayTeamName(match.away_team)}`}
              type="number"
              min="0"
              value={predictionAway}
              disabled={!confirmed || locked || !currentParticipant}
              onChange={(e) =>
                updatePredictionScore(match.id, 'away', e.target.value)
              }
              style={scoreInputStyle(!confirmed || locked || !currentParticipant)}
            />
          </div>

          {confirmed && predictionIsDraw && (
            <div
              style={{
                marginTop: '10px',
                padding: '9px',
                borderRadius: '9px',
                background: '#fff7e6',
                border: '1px solid #efd29a'
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  color: '#7a4d00',
                  marginBottom: '6px'
                }}
              >
                Si empatan tras 90 minutos, ¿quién avanza?
              </div>

              {locked ? (
                <div style={{ fontSize: '0.8rem', color: '#555' }}>
                  {predictionAdvancing
                    ? `Avanza pronosticado: ${getTeamFlag(
                        predictionAdvancing
                      )} ${displayTeamName(predictionAdvancing)}`
                    : 'No se guardó un equipo que avanza.'}
                </div>
              ) : (
                <select
                  value={predictionAdvancing}
                  disabled={!currentParticipant}
                  onChange={(e) =>
                    updatePredictionAdvancing(match.id, e.target.value)
                  }
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '7px',
                    border: '1px solid #d4b26a',
                    background: currentParticipant ? 'white' : '#eeeeee'
                  }}
                >
                  <option value="">Selecciona el equipo que avanza</option>
                  <option value={match.home_team}>
                    {getTeamFlag(match.home_team)}{' '}
                    {displayTeamName(match.home_team)}
                  </option>
                  <option value={match.away_team}>
                    {getTeamFlag(match.away_team)}{' '}
                    {displayTeamName(match.away_team)}
                  </option>
                </select>
              )}
            </div>
          )}

          <div
            style={{
              marginTop: '10px',
              color: statusColor,
              fontWeight: 'bold',
              fontSize: '0.76rem',
              textAlign: 'center'
            }}
          >
            {statusLabel}
          </div>

          {!confirmed && (
            <p
              style={{
                margin: '8px 0 0',
                fontSize: '0.74rem',
                color: '#777',
                textAlign: 'center'
              }}
            >
              Los ganadores aparecerán aquí automáticamente.
            </p>
          )}

          {finished && (
            <div
              style={{
                marginTop: '8px',
                fontSize: '0.82rem',
                color: '#444',
                textAlign: 'center'
              }}
            >
              Marcador 90': <strong>{match.home_score} - {match.away_score}</strong>
              <br />
              Avanza: <strong>{getTeamFlag(match.winner_team)} {displayTeamName(match.winner_team)}</strong>
            </div>
          )}

          {confirmed && !locked && (
            <button
              onClick={() => savePrediction(match)}
              disabled={!currentParticipant}
              style={{
                width: '100%',
                marginTop: '11px',
                padding: '9px',
                border: 'none',
                borderRadius: '8px',
                cursor: currentParticipant ? 'pointer' : 'not-allowed',
                background: currentParticipant ? '#006847' : '#aaa',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.8rem'
              }}
            >
              {currentParticipant
                ? 'Guardar pronóstico'
                : 'Entra para pronosticar'}
            </button>
          )}

          {isAdmin && confirmed && (
            <details
              style={{
                marginTop: '12px',
                borderTop: '1px solid #e5d2a6',
                paddingTop: '10px'
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.8rem',
                  color: '#8a5600'
                }}
              >
                🛠️ Capturar resultado (marcador al minuto 90)
              </summary>

              <p
                style={{
                  margin: '8px 0 0',
                  color: '#666',
                  fontSize: '0.74rem'
                }}
              >
                Captura el marcador tras 90 minutos. Si empatan, selecciona quién
                avanzó por tiempo extra o penales.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 48px',
                  gap: '8px',
                  alignItems: 'center',
                  marginTop: '10px'
                }}
              >
                <span>{renderTeamLabel(match.home_team)}</span>
                <input
                  type="number"
                  min="0"
                  value={resultHome}
                  onChange={(e) =>
                    setResultInputs({
                      ...resultInputs,
                      [match.id]: {
                        home: e.target.value,
                        away: resultAway
                      }
                    })
                  }
                  style={adminScoreInputStyle}
                />

                <span>{renderTeamLabel(match.away_team)}</span>
                <input
                  type="number"
                  min="0"
                  value={resultAway}
                  onChange={(e) =>
                    setResultInputs({
                      ...resultInputs,
                      [match.id]: {
                        home: resultHome,
                        away: e.target.value
                      }
                    })
                  }
                  style={adminScoreInputStyle}
                />
              </div>

              {isDrawInput && (
                <select
                  value={winnerInputs[match.id] || match.winner_team || ''}
                  onChange={(e) =>
                    setWinnerInputs({
                      ...winnerInputs,
                      [match.id]: e.target.value
                    })
                  }
                  style={{
                    width: '100%',
                    marginTop: '9px',
                    padding: '8px',
                    borderRadius: '7px',
                    border: '1px solid #d4b26a'
                  }}
                >
                  <option value="">
                    Selecciona equipo que avanza (TE / penales)
                  </option>
                  <option value={match.home_team}>
                    {getTeamFlag(match.home_team)} {displayTeamName(match.home_team)}
                  </option>
                  <option value={match.away_team}>
                    {getTeamFlag(match.away_team)} {displayTeamName(match.away_team)}
                  </option>
                </select>
              )}

              {!isDrawInput &&
                resultHome !== '' &&
                resultAway !== '' &&
                !Number.isNaN(resultHomeNumber) &&
                !Number.isNaN(resultAwayNumber) && (
                  <p
                    style={{
                      color: '#666',
                      fontSize: '0.74rem',
                      margin: '8px 0 0'
                    }}
                  >
                    Avanza automáticamente:{' '}
                    <strong>
                      {displayTeamName(
                        resultHomeNumber > resultAwayNumber
                          ? match.home_team
                          : match.away_team
                      )}
                    </strong>
                  </p>
                )}

              <button
                onClick={() => saveKnockoutResult(match)}
                style={{
                  width: '100%',
                  marginTop: '10px',
                  padding: '9px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: '#ce1126',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '0.8rem'
                }}
              >
                Guardar y avanzar ganador
              </button>
            </details>
          )}
        </div>
      </article>
    )
  }

  function renderBracketColumn(round: RoundName) {
    const roundMatches = getRoundMatches(round)

    return (
      <div
        key={round}
        style={{
          minWidth: '248px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '1660px',
          padding: '0 4px'
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: '12px',
            zIndex: 2,
            textAlign: 'center',
            marginBottom: '10px',
            padding: '10px',
            borderRadius: '10px',
            background:
              round === 'final'
                ? 'linear-gradient(135deg,#f7c948,#c89300)'
                : '#006847',
            color: 'white',
            fontWeight: 'bold',
            boxShadow: '0 3px 8px rgba(0,0,0,0.18)'
          }}
        >
          {round === 'final' ? '🏆 ' : ''}
          {ROUND_LABELS[round]}
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: round === 'final' ? 'center' : 'space-around',
            gap: '16px'
          }}
        >
          {roundMatches.length === 0 ? (
            <p
              style={{
                textAlign: 'center',
                color: '#777',
                fontSize: '0.82rem'
              }}
            >
              Sin partidos
            </p>
          ) : (
            roundMatches.map((match) => renderBracketMatch(match))
          )}
        </div>
      </div>
    )
  }

  function renderKnockoutBracket() {
    return (
      <section
        id="llaves"
        style={{
          background: 'white',
          color: '#222',
          borderRadius: '24px',
          padding: '24px',
          marginBottom: '25px',
          scrollMarginTop: '90px'
        }}
      >
        <h2
          style={{
            margin: 0,
            textAlign: 'center',
            fontSize: '1.8rem'
          }}
        >
          🏆 Llaves de Eliminación Directa
        </h2>

        <p
          style={{
            textAlign: 'center',
            color: '#666',
            margin: '9px auto 18px',
            maxWidth: '860px'
          }}
        >
          El marcador se pronostica al finalizar los 90 minutos. Si pronosticas
          empate, elige también el equipo que avanzará por tiempo extra o penales.
        </p>

        {isAdmin && (
          <div
            style={{
              margin: '0 auto 18px',
              maxWidth: '900px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: '#fff7e6',
              border: '1px solid #efc26a',
              color: '#704300',
              textAlign: 'center',
              fontSize: '0.9rem'
            }}
          >
            <strong>Modo administrador:</strong> captura el marcador al minuto
            90. Si hay empate, selecciona el equipo que avanzó por tiempo extra o
            penales para moverlo a la siguiente ronda.
          </div>
        )}

        <div
          style={{
            overflowX: 'auto',
            paddingBottom: '10px',
            borderRadius: '16px',
            background: '#f7f5f1',
            border: '1px solid #e9e3d9'
          }}
        >
          <div
            style={{
              minWidth: '1330px',
              display: 'grid',
              gridTemplateColumns: 'repeat(5, minmax(248px, 1fr))',
              gap: '12px',
              padding: '14px'
            }}
          >
            {ROUND_ORDER.map((round) => renderBracketColumn(round))}
          </div>
        </div>

        <p
          style={{
            margin: '12px 0 0',
            textAlign: 'center',
            color: '#777',
            fontSize: '0.82rem'
          }}
        >
          En celular, desliza horizontalmente para recorrer todas las rondas.
        </p>
      </section>
    )
  }

  function renderAdminCurrentMatchPredictions() {
    if (!isAdmin) {
      return null
    }

    const reviewMatches = matches
      .filter((match) => isMatchConfirmed(match))
      .sort(
        (a, b) =>
          new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
      )

    if (reviewMatches.length === 0) {
      return (
        <section id="admin-en-curso" style={secondarySectionStyle}>
          <h2 style={{ marginTop: 0, textAlign: 'center' }}>
            🛠️ Admin: Revisión de pronósticos
          </h2>
          <p style={{ marginBottom: 0, color: '#777', textAlign: 'center' }}>
            No hay partidos confirmados disponibles.
          </p>
        </section>
      )
    }

    const selectedMatch =
      reviewMatches.find(
        (match) => String(match.id) === String(adminReviewMatchId)
      ) || reviewMatches[0]

    const currentEntries = adminMatchPredictions.filter(
      (entry) => String(entry.match_id) === String(selectedMatch.id)
    )

    const savedCount = currentEntries.filter(
      (entry) =>
        entry.predicted_home !== null &&
        entry.predicted_home !== undefined &&
        entry.predicted_away !== null &&
        entry.predicted_away !== undefined
    ).length

    return (
      <section id="admin-en-curso" style={secondarySectionStyle}>
        <h2 style={{ marginTop: 0, textAlign: 'center' }}>
          🛠️ Admin: Revisión de pronósticos
        </h2>

        <p
          style={{
            textAlign: 'center',
            color: '#666',
            margin: '8px auto 14px',
            maxWidth: '760px'
          }}
        >
          Selecciona cualquier partido confirmado para revisar todos los
          pronósticos guardados. Por defecto se abre el primero que ya tenga
          pronósticos.
        </p>

        {adminReviewError && (
          <div
            style={{
              margin: '0 auto 14px',
              maxWidth: '760px',
              padding: '10px 12px',
              borderRadius: '10px',
              color: '#9b1c1c',
              background: '#fff0f0',
              border: '1px solid #f0b4b4',
              textAlign: 'center'
            }}
          >
            No se pudieron cargar los pronósticos: {adminReviewError}
          </div>
        )}

        <select
          value={String(selectedMatch.id)}
          onChange={(event) => setAdminReviewMatchId(Number(event.target.value))}
          style={{
            display: 'block',
            width: 'min(100%, 720px)',
            margin: '0 auto 15px',
            padding: '10px',
            borderRadius: '9px',
            border: '1px solid #cfcfcf',
            background: 'white',
            color: '#222'
          }}
        >
          {reviewMatches.map((match) => (
            <option key={match.id} value={match.id}>
              {getTeamFlag(match.home_team)} {displayTeamName(match.home_team)} vs{' '}
              {getTeamFlag(match.away_team)} {displayTeamName(match.away_team)} ·{' '}
              {formatMatchDate(match.kickoff)}
            </option>
          ))}
        </select>

        <p
          style={{
            textAlign: 'center',
            color: '#666',
            margin: '8px 0 18px'
          }}
        >
          {getTeamFlag(selectedMatch.home_team)}{' '}
          <strong>{displayTeamName(selectedMatch.home_team)}</strong> vs{' '}
          {getTeamFlag(selectedMatch.away_team)}{' '}
          <strong>{displayTeamName(selectedMatch.away_team)}</strong>
          <br />
          <small>
            {formatMatchDate(selectedMatch.kickoff)} · {savedCount}/
            {currentEntries.length} guardados
          </small>
        </p>

        {currentEntries.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#777', marginBottom: 0 }}>
            Este partido aún no tiene filas de revisión. Cierra y vuelve a
            entrar como admin, o revisa el mensaje de error arriba.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: '640px'
              }}
            >
              <thead>
                <tr>
                  <th style={tableHeadStyle}>Participante</th>
                  <th style={{ ...tableHeadStyle, textAlign: 'center' }}>
                    Pronóstico
                  </th>
                  <th style={{ ...tableHeadStyle, textAlign: 'center' }}>
                    Avanza si empatan
                  </th>
                  <th style={{ ...tableHeadStyle, textAlign: 'center' }}>
                    Estado
                  </th>
                </tr>
              </thead>

              <tbody>
                {currentEntries.map((entry) => {
                  const hasPrediction =
                    entry.predicted_home !== null &&
                    entry.predicted_home !== undefined &&
                    entry.predicted_away !== null &&
                    entry.predicted_away !== undefined

                  return (
                    <tr key={`${entry.match_id}-${entry.participant_name}`}>
                      <td style={tableCellStyle}>{entry.participant_name}</td>
                      <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                        <strong>
                          {hasPrediction
                            ? `${entry.predicted_home} - ${entry.predicted_away}`
                            : '-'}
                        </strong>
                      </td>
                      <td
                        style={{
                          ...tableCellStyle,
                          textAlign: 'center'
                        }}
                      >
                        {entry.predicted_advancing_team
                          ? `${getTeamFlag(
                              entry.predicted_advancing_team
                            )} ${displayTeamName(
                              entry.predicted_advancing_team
                            )}`
                          : '—'}
                      </td>
                      <td
                        style={{
                          ...tableCellStyle,
                          textAlign: 'center',
                          color: hasPrediction ? '#006847' : '#b00020',
                          fontWeight: 'bold'
                        }}
                      >
                        {hasPrediction ? 'Guardado' : 'Pendiente'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    )
  }

  function renderLeaderboard() {
    return (
      <section
        id="tabla"
        style={{ ...secondarySectionStyle, marginBottom: 0 }}
      >
        <h2 style={{ marginTop: 0, textAlign: 'center' }}>🏅 Tabla General</h2>

        <p
          style={{
            textAlign: 'center',
            color: '#777',
            margin: '8px 0 18px',
            fontSize: '0.9rem'
          }}
        >
          Desempate: puntos, marcadores exactos y resultados acertados.
        </p>

        {leaderboard.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#777', marginBottom: 0 }}>
            Aún no hay participantes en la tabla.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '9px'
            }}
          >
            {leaderboard.map((entry, index) => {
              const medal =
                index === 0
                  ? '🥇'
                  : index === 1
                    ? '🥈'
                    : index === 2
                      ? '🥉'
                      : `#${entry.position}`

              const isCurrent = currentParticipant?.id === entry.id

              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '45px 1fr auto',
                    gap: '8px',
                    alignItems: 'center',
                    padding: '13px',
                    borderRadius: '14px',
                    border: '1px solid #eee',
                    background: isCurrent ? '#e9f8ef' : '#fafafa'
                  }}
                >
                  <strong>{medal}</strong>

                  <div>
                    <strong>
                      {entry.name}
                      {isCurrent ? ' 👈 Tú' : ''}
                    </strong>
                    <div
                      style={{
                        fontSize: '0.76rem',
                        color: '#777',
                        marginTop: '3px'
                      }}
                    >
                      Exactos: {entry.exact_scores} · Acertados:{' '}
                      {entry.correct_results}
                    </div>
                  </div>

                  <strong>{entry.total_points} pts</strong>
                </div>
              )
            })}
          </div>
        )}
      </section>
    )
  }

  function renderRoundLeaderboard() {
    const entries = roundLeaderboard.filter(
      (entry) => entry.round_name === selectedRound
    )

    return (
      <section
        id="por-ronda"
        style={{ ...secondarySectionStyle, marginBottom: 0 }}
      >
        <h2 style={{ marginTop: 0, textAlign: 'center' }}>
          🗂️ Tabla por Ronda
        </h2>

        <p
          style={{
            textAlign: 'center',
            color: '#777',
            margin: '8px 0 16px'
          }}
        >
          Muestra únicamente los puntos obtenidos en la ronda seleccionada.
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '18px'
          }}
        >
          {ROUND_ORDER.map((round) => (
            <button
              key={round}
              onClick={() => setSelectedRound(round)}
              style={{
                padding: '9px 12px',
                border: 'none',
                borderRadius: '999px',
                cursor: 'pointer',
                fontWeight: 'bold',
                background: selectedRound === round ? '#006847' : '#eeeeee',
                color: selectedRound === round ? 'white' : '#333'
              }}
            >
              {ROUND_LABELS[round]}
            </button>
          ))}
        </div>

        {entries.length === 0 ? (
          <p style={{ marginBottom: 0, textAlign: 'center', color: '#777' }}>
            Esta tabla aparecerá después de ejecutar la actualización de base de
            datos.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '9px'
            }}
          >
            {entries.map((entry, index) => {
              const medal =
                index === 0
                  ? '🥇'
                  : index === 1
                    ? '🥈'
                    : index === 2
                      ? '🥉'
                      : `#${entry.position}`

              const isCurrent = currentParticipant?.id === entry.id

              return (
                <div
                  key={`${entry.round_name}-${entry.id}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '45px 1fr auto',
                    gap: '8px',
                    alignItems: 'center',
                    padding: '13px',
                    borderRadius: '14px',
                    border: '1px solid #eee',
                    background: isCurrent ? '#e9f8ef' : '#fafafa'
                  }}
                >
                  <strong>{medal}</strong>

                  <div>
                    <strong>
                      {entry.name}
                      {isCurrent ? ' 👈 Tú' : ''}
                    </strong>
                    <div
                      style={{
                        fontSize: '0.76rem',
                        color: '#777',
                        marginTop: '3px'
                      }}
                    >
                      Exactos: {entry.exact_scores} · Acertados:{' '}
                      {entry.correct_results}
                    </div>
                  </div>

                  <strong>{entry.total_points} pts</strong>
                </div>
              )
            })}
          </div>
        )}
      </section>
    )
  }

  function renderChampionBadges() {
    if (!finalMatch || leaderboard.length === 0) {
      return null
    }

    const quinielaWinner = leaderboard[0]
    const maxExactScores = Math.max(
      ...leaderboard.map((entry) => entry.exact_scores)
    )
    const exactScoreLeaders =
      maxExactScores > 0
        ? leaderboard.filter(
            (entry) => entry.exact_scores === maxExactScores
          )
        : []

    return (
      <section id="campeones" style={secondarySectionStyle}>
        <h2 style={{ marginTop: 0, textAlign: 'center' }}>
          🏆 Campeones de la Quiniela
        </h2>

        <p
          style={{
            textAlign: 'center',
            color: '#777',
            margin: '8px 0 18px'
          }}
        >
          La Final ya terminó. Estos son los reconocimientos del torneo.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '14px'
          }}
        >
          <div style={championCardStyle}>
            <div style={{ fontSize: '2rem' }}>
              {getTeamFlag(finalMatch.winner_team)}
            </div>
            <div style={{ color: '#777', fontSize: '0.8rem' }}>
              Campeón del Mundial
            </div>
            <strong style={{ fontSize: '1.25rem', color: '#006847' }}>
              {displayTeamName(finalMatch.winner_team)}
            </strong>
          </div>

          <div style={championCardStyle}>
            <div style={{ fontSize: '2rem' }}>🥇</div>
            <div style={{ color: '#777', fontSize: '0.8rem' }}>
              Ganador de la Quiniela
            </div>
            <strong style={{ fontSize: '1.25rem', color: '#006847' }}>
              {quinielaWinner.name}
            </strong>
            <small style={{ color: '#666' }}>
              {quinielaWinner.total_points} puntos
            </small>
          </div>

          <div style={championCardStyle}>
            <div style={{ fontSize: '2rem' }}>🎯</div>
            <div style={{ color: '#777', fontSize: '0.8rem' }}>
              Más marcadores exactos
            </div>
            <strong style={{ fontSize: '1.05rem', color: '#006847' }}>
              {exactScoreLeaders.length > 0
                ? exactScoreLeaders.map((entry) => entry.name).join(', ')
                : 'Sin marcadores exactos'}
            </strong>
            {exactScoreLeaders.length > 0 && (
              <small style={{ color: '#666' }}>
                {maxExactScores} marcador{maxExactScores === 1 ? '' : 'es'}{' '}
                exacto{maxExactScores === 1 ? '' : 's'}
              </small>
            )}
          </div>
        </div>
      </section>
    )
  }

  function renderMovement() {
    const wentUp = movements.filter(
      (movement) => movement.movement_type === 'subio'
    )
    const stayedSame = movements.filter(
      (movement) =>
        movement.movement_type === 'igual' ||
        movement.movement_type === 'nuevo'
    )
    const wentDown = movements.filter(
      (movement) => movement.movement_type === 'bajo'
    )

    return (
      <section id="movimiento" style={secondarySectionStyle}>
        <h2 style={{ marginTop: 0, textAlign: 'center' }}>
          📈 Movimiento en la Tabla
        </h2>

        <p
          style={{
            textAlign: 'center',
            color: '#666',
            margin: '8px 0 18px'
          }}
        >
          Se actualiza cada vez que el administrador captura un resultado.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '14px'
          }}
        >
          {renderMovementCard('⬆️ Subieron', wentUp, '#006847')}
          {renderMovementCard('➡️ Igual / Nuevos', stayedSame, '#777')}
          {renderMovementCard('⬇️ Bajaron', wentDown, '#b00020')}
        </div>
      </section>
    )
  }

  function renderMovementCard(
    title: string,
    entries: RankingMovementEntry[],
    color: string
  ) {
    return (
      <div
        style={{
          border: '1px solid #e5e5e5',
          borderRadius: '14px',
          padding: '14px',
          background: '#fafafa'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '10px',
            alignItems: 'center'
          }}
        >
          <h3 style={{ margin: 0 }}>{title}</h3>
          <span
            style={{
              display: 'inline-flex',
              minWidth: '32px',
              height: '32px',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: color,
              color: 'white',
              fontWeight: 'bold'
            }}
          >
            {entries.length}
          </span>
        </div>

        {entries.length === 0 ? (
          <p style={{ color: '#777', marginBottom: 0 }}>
            Sin cambios todavía.
          </p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '10px',
                borderTop: '1px solid #e8e8e8',
                paddingTop: '9px',
                marginTop: '9px'
              }}
            >
              <span>
                <strong>{entry.name}</strong>
                <br />
                <small style={{ color: '#777' }}>
                  #{entry.previous_position ?? '-'} → #{entry.current_position}
                </small>
              </span>

              <strong style={{ color }}>
                {entry.movement_type === 'subio'
                  ? `+${entry.movement}`
                  : entry.movement_type === 'bajo'
                    ? entry.movement
                    : '0'}
              </strong>
            </div>
          ))
        )}
      </div>
    )
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#006847 0%,#004d36 100%)',
        color: 'white',
        padding: '24px',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <div style={{ maxWidth: '1800px', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '16px'
          }}
        >
          {renderLoginBox()}
        </div>

        <h1
          style={{
            margin: 0,
            textAlign: 'center',
            fontSize: 'clamp(2rem, 4vw, 3.25rem)'
          }}
        >
          IPAM 🏆 Quiniela Mundialista 2026
        </h1>

        <p
          style={{
            textAlign: 'center',
            margin: '8px 0 20px',
            opacity: 0.9
          }}
        >
          Eliminación directa · Dieciseisavos hasta la Final
        </p>

        {renderNavBar()}
        {renderProfileSummary()}
        {renderKnockoutBracket()}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '25px',
            alignItems: 'start',
            marginBottom: '25px'
          }}
        >
          {renderLeaderboard()}
          {renderRoundLeaderboard()}
        </div>

        {renderChampionBadges()}
        {renderAdminCurrentMatchPredictions()}
        {renderMovement()}

        <footer
          style={{
            textAlign: 'center',
            marginTop: '24px',
            opacity: 0.85,
            fontSize: '0.88rem'
          }}
        >
          IPAM Quiniela Mundialista 2026 · Uso interno
        </footer>
      </div>
    </main>
  )
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: '12px',
        background: '#f6f6f6'
      }}
    >
      <div style={{ color: '#777', fontSize: '0.78rem' }}>{label}</div>
      <strong style={{ color: '#006847', fontSize: '1.15rem' }}>{value}</strong>
    </div>
  )
}

const navLinkStyle = {
  color: 'white',
  textDecoration: 'none',
  padding: '8px 12px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.13)',
  fontWeight: 'bold',
  fontSize: '0.88rem'
} as const

const headerInputStyle = {
  padding: '9px',
  borderRadius: '8px',
  border: 'none',
  maxWidth: '180px'
} as const

const headerButtonStyle = {
  padding: '9px 13px',
  borderRadius: '8px',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 'bold'
} as const

const smallHeaderButtonStyle = {
  marginLeft: '10px',
  padding: '8px 12px',
  borderRadius: '8px',
  border: 'none',
  cursor: 'pointer'
} as const

const teamPredictionRowStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 42px',
  gap: '8px',
  alignItems: 'center',
  paddingBottom: '8px',
  borderBottom: '1px solid #eee'
} as const

function scoreInputStyle(disabled: boolean) {
  return {
    width: '42px',
    padding: '7px 3px',
    textAlign: 'center' as const,
    borderRadius: '7px',
    border: '1px solid #cfcfcf',
    background: disabled ? '#eeeeee' : 'white',
    color: '#222',
    fontWeight: 'bold',
    cursor: disabled ? 'not-allowed' : 'text'
  }
}

const adminScoreInputStyle = {
  width: '48px',
  padding: '7px 3px',
  textAlign: 'center' as const,
  borderRadius: '7px',
  border: '1px solid #c7a95f',
  background: 'white',
  color: '#222',
  fontWeight: 'bold'
}

const secondarySectionStyle = {
  background: 'white',
  color: '#222',
  borderRadius: '22px',
  padding: '22px',
  marginBottom: '25px',
  scrollMarginTop: '90px'
} as const

const championCardStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  gap: '7px',
  textAlign: 'center' as const,
  padding: '20px',
  borderRadius: '16px',
  background: '#fafafa',
  border: '1px solid #e6e6e6'
}

const tableHeadStyle = {
  padding: '9px',
  textAlign: 'left' as const,
  borderBottom: '2px solid #e6e6e6'
}

const tableCellStyle = {
  padding: '9px',
  borderBottom: '1px solid #eeeeee'
}
