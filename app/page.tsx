'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Match = {
  id: number
  home_team: string
  away_team: string
  kickoff: string
  status?: string
  home_score?: number | null
  away_score?: number | null
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

type MatchGroup = {
  dateKey: string
  dateLabel: string
  matches: Match[]
}

type ChampionPrediction = {
  team_name: string
  created_at: string
}

type AdminChampionPrediction = {
  user_id: string
  participant_name: string
  team_name: string | null
  created_at: string | null
  has_prediction: boolean
}

type AdminMatchPrediction = {
  participant_name: string
  match_id: number
  home_team: string
  away_team: string
  kickoff: string
  predicted_home: number | null
  predicted_away: number | null
  created_at: string | null
}

type LivePredictionEntry = {
  match_id: number
  home_team: string
  away_team: string
  kickoff: string
  participant_name: string
  predicted_home: number | null
  predicted_away: number | null
  has_prediction: boolean
}

const APP_TIME_ZONE = 'America/Mexico_City'

export default function Home() {
  const [matches, setMatches] = useState<Match[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [movements, setMovements] = useState<RankingMovementEntry[]>([])

  const [championInput, setChampionInput] = useState('')
  const [championPrediction, setChampionPrediction] =
    useState<ChampionPrediction | null>(null)

  const [adminChampionPredictions, setAdminChampionPredictions] = useState<
    AdminChampionPrediction[]
  >([])

  const [adminMatchPredictions, setAdminMatchPredictions] = useState<
    AdminMatchPrediction[]
  >([])

  const [adminParticipantSearch, setAdminParticipantSearch] = useState('')
  const [adminMatchFilter, setAdminMatchFilter] = useState('all')
  const [adminStatusFilter, setAdminStatusFilter] = useState('all')

  const [livePredictions, setLivePredictions] = useState<LivePredictionEntry[]>(
    []
  )

  const [currentParticipant, setCurrentParticipant] =
    useState<CurrentParticipant | null>(null)

  const [participantPin, setParticipantPin] = useState('')
  const [selectedLoginName, setSelectedLoginName] = useState('')
  const [loginPinInput, setLoginPinInput] = useState('')

  const [isAdmin, setIsAdmin] = useState(false)
  const [adminPin, setAdminPin] = useState('')
  const [adminPinInput, setAdminPinInput] = useState('')

  const [newMatchHome, setNewMatchHome] = useState('')
  const [newMatchAway, setNewMatchAway] = useState('')
  const [newMatchKickoff, setNewMatchKickoff] = useState('')

  const [resultInputs, setResultInputs] = useState<
    Record<number, { home: string; away: string }>
  >({})

  const [predictions, setPredictions] = useState<
    Record<number, { home: string; away: string }>
  >({})

  useEffect(() => {
    loadMatches()
    loadParticipants()
    loadLeaderboard()
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
      loadChampionPrediction(savedParticipantId, savedParticipantPin)
      loadLivePredictions(savedParticipantId, savedParticipantPin)
    }

    const savedAdminPin = localStorage.getItem('quiniela_admin_pin')

    if (savedAdminPin) {
      checkAdminPin(savedAdminPin, false)
    }
  }, [])

  useEffect(() => {
    if (!currentParticipant || !participantPin) {
      return
    }

    loadLivePredictions(currentParticipant.id, participantPin)

    const intervalId = window.setInterval(() => {
      loadLivePredictions(currentParticipant.id, participantPin)
    }, 60000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [currentParticipant, participantPin])

  const openMatches = matches.filter(
    (match) => new Date(match.kickoff) > new Date()
  )

  const closedMatches = matches.filter(
    (match) => new Date(match.kickoff) <= new Date()
  )

  const openMatchGroups = groupMatchesByDate(openMatches)
  const closedMatchGroups = groupMatchesByDate(closedMatches)

  const wentUp = movements.filter(
    (movement) => movement.movement_type === 'subio'
  )

  const wentDown = movements.filter(
    (movement) => movement.movement_type === 'bajo'
  )

  const stayedSame = movements.filter(
    (movement) =>
      movement.movement_type === 'igual' ||
      movement.movement_type === 'nuevo'
  )

  const currentLeaderboardEntry = currentParticipant
    ? leaderboard.find((entry) => entry.id === currentParticipant.id)
    : null

  const savedPredictionCount = Object.values(predictions).filter(
    (prediction) => prediction.home !== '' && prediction.away !== ''
  ).length

  function groupMatchesByDate(matchesToGroup: Match[]): MatchGroup[] {
    const groups: Record<string, Match[]> = {}

    matchesToGroup.forEach((match) => {
      const date = new Date(match.kickoff)

      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(date)

      const year = parts.find((part) => part.type === 'year')?.value
      const month = parts.find((part) => part.type === 'month')?.value
      const day = parts.find((part) => part.type === 'day')?.value

      const dateKey = `${year}-${month}-${day}`

      if (!groups[dateKey]) {
        groups[dateKey] = []
      }

      groups[dateKey].push(match)
    })

    return Object.keys(groups)
      .sort()
      .map((dateKey) => {
        const firstMatchDate = new Date(groups[dateKey][0].kickoff)

        return {
          dateKey,
          dateLabel: firstMatchDate.toLocaleDateString('es-MX', {
            timeZone: APP_TIME_ZONE,
            weekday: 'long',
            day: 'numeric',
            month: 'long'
          }),
          matches: groups[dateKey]
        }
      })
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

    const loggedUser = data[0]

    setCurrentParticipant({
      id: loggedUser.user_id,
      name: loggedUser.user_name
    })

    setParticipantPin(loginPinInput.trim())

    localStorage.setItem('quiniela_participant_id', loggedUser.user_id)
    localStorage.setItem('quiniela_participant_name', loggedUser.user_name)
    localStorage.setItem('quiniela_participant_pin', loginPinInput.trim())

    setLoginPinInput('')

    loadPredictionsForParticipant(loggedUser.user_id, loginPinInput.trim())
    loadChampionPrediction(loggedUser.user_id, loginPinInput.trim())
    loadLivePredictions(loggedUser.user_id, loginPinInput.trim())
  }

  function logoutParticipant() {
    setChampionPrediction(null)
    setChampionInput('')
    setLivePredictions([])
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
      localStorage.removeItem('quiniela_admin_pin')

      if (showSuccess) {
        alert('PIN de admin incorrecto')
      }

      return
    }

    setIsAdmin(true)
    setAdminPin(pinToCheck)
    localStorage.setItem('quiniela_admin_pin', pinToCheck)

    loadAdminChampionPredictions(pinToCheck)
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
    setAdminChampionPredictions([])
    setAdminMatchPredictions([])
    setAdminParticipantSearch('')
    setAdminMatchFilter('all')
    setAdminStatusFilter('all')
    setIsAdmin(false)
    setAdminPin('')
    localStorage.removeItem('quiniela_admin_pin')
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

    setParticipants(data || [])
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

    const loaded: Record<number, { home: string; away: string }> = {}

    data.forEach((prediction: any) => {
      loaded[prediction.match_id] = {
        home: String(prediction.predicted_home),
        away: String(prediction.predicted_away)
      }
    })

    setPredictions(loaded)
  }

  async function loadChampionPrediction(userId: string, pinCode: string) {
    const { data, error } = await supabase.rpc(
      'get_champion_prediction_by_pin',
      {
        p_user_id: userId,
        p_pin_code: pinCode
      }
    )

    if (error) {
      console.error(error)
      return
    }

    if (data && data.length > 0) {
      setChampionPrediction(data[0])
      setChampionInput(data[0].team_name)
    } else {
      setChampionPrediction(null)
      setChampionInput('')
    }
  }

  async function loadLivePredictions(userId: string, pinCode: string) {
    const { data, error } = await supabase.rpc('get_live_predictions_by_pin', {
      p_user_id: userId,
      p_pin_code: pinCode
    })

    if (error) {
      console.error(error)
      return
    }

    setLivePredictions(data || [])
  }

  async function saveChampionPrediction() {
    if (!currentParticipant) {
      alert('Debes entrar con tu nombre y PIN')
      return
    }

    if (championInput.trim() === '') {
      alert('Escribe el nombre del equipo campeón')
      return
    }

    const confirmed = window.confirm(
      'Solo puedes elegir un equipo campeón. Después de guardar esta respuesta, quedará bloqueada y no podrás cambiarla. ¿Confirmas tu elección?'
    )

    if (!confirmed) {
      return
    }

    const { error } = await supabase.rpc('save_champion_prediction_by_pin', {
      p_user_id: currentParticipant.id,
      p_pin_code: participantPin,
      p_team_name: championInput.trim()
    })

    if (error) {
      console.error(error)
      alert(`Error: ${error.message}`)
      return
    }

    alert('✅ Campeón guardado. Esta elección ya quedó bloqueada.')

    loadChampionPrediction(currentParticipant.id, participantPin)

    if (isAdmin) {
      loadAdminChampionPredictions(adminPin)
    }
  }

  async function loadAdminChampionPredictions(pinToUse: string) {
    const { data, error } = await supabase.rpc(
      'get_admin_champion_predictions',
      {
        p_admin_pin: pinToUse
      }
    )

    if (error) {
      console.error(error)
      return
    }

    setAdminChampionPredictions(data || [])
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
      return
    }

    setAdminMatchPredictions(data || [])
  }

  async function savePrediction(matchId: number) {
    if (!currentParticipant) {
      alert('Debes entrar con tu nombre y PIN')
      return
    }

    const prediction = predictions[matchId]

    if (!prediction || prediction.home === '' || prediction.away === '') {
      alert('Ingresa ambos marcadores')
      return
    }

    const { error } = await supabase.rpc('save_prediction_by_pin', {
      p_user_id: currentParticipant.id,
      p_pin_code: participantPin,
      p_match_id: matchId,
      p_home: Number(prediction.home),
      p_away: Number(prediction.away)
    })

    if (error) {
      console.error(error)
      alert(`Error: ${error.message}`)
      return
    }

    alert('✅ Pronóstico guardado')
    loadPredictionsForParticipant(currentParticipant.id, participantPin)

    if (isAdmin) {
      loadAdminMatchPredictions(adminPin)
    }

    loadLivePredictions(currentParticipant.id, participantPin)
  }

  async function addNewMatch() {
    if (!isAdmin) {
      alert('No tienes permisos de administrador')
      return
    }

    if (
      newMatchHome.trim() === '' ||
      newMatchAway.trim() === '' ||
      newMatchKickoff === ''
    ) {
      alert('Completa equipo local, equipo visitante, fecha y hora')
      return
    }

    const kickoffDate = new Date(newMatchKickoff)
    const kickoffForDatabase = `${newMatchKickoff.replace('T', ' ')}:00`

    if (Number.isNaN(kickoffDate.getTime())) {
      alert('La fecha/hora no es válida')
      return
    }

    const { error } = await supabase.rpc('admin_add_match_pin', {
      p_admin_pin: adminPin,
      p_home_team: newMatchHome.trim(),
      p_away_team: newMatchAway.trim(),
      p_kickoff: kickoffForDatabase
    })

    if (error) {
      console.error(error)
      alert(`Error: ${error.message}`)
      return
    }

    alert('✅ Partido agregado')

    setNewMatchHome('')
    setNewMatchAway('')
    setNewMatchKickoff('')

    loadMatches()
  }

  async function saveFinalResult(match: Match) {
    if (!isAdmin) {
      alert('No tienes permisos de administrador')
      return
    }

    const result = resultInputs[match.id]

    const homeValue =
      result?.home ??
      (match.home_score !== null && match.home_score !== undefined
        ? String(match.home_score)
        : '')

    const awayValue =
      result?.away ??
      (match.away_score !== null && match.away_score !== undefined
        ? String(match.away_score)
        : '')

    if (homeValue === '' || awayValue === '') {
      alert('Ingresa ambos marcadores finales')
      return
    }

    const { error } = await supabase.rpc('admin_finish_match_pin', {
      p_admin_pin: adminPin,
      p_match_id: match.id,
      p_home_score: Number(homeValue),
      p_away_score: Number(awayValue)
    })

    if (error) {
      console.error(error)
      alert(`Error: ${error.message}`)
      return
    }

    alert('✅ Resultado guardado, puntos calculados y ranking actualizado')

    loadMatches()
    loadLeaderboard()
    loadMovements()

    if (currentParticipant) {
      loadLivePredictions(currentParticipant.id, participantPin)
    }
  }

  async function loadMatches() {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .order('kickoff', { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    setMatches(data || [])
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

    setLeaderboard(data || [])
  }

  async function loadMovements() {
    const { data, error } = await supabase
      .from('ranking_movement_view')
      .select('*')

    if (error) {
      console.error(error)
      return
    }

    setMovements(data || [])
  }

  function renderLoginBox() {
    return (
      <div
        className="login-box"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          justifyContent: 'flex-end',
          alignItems: 'center'
        }}
      >
        {currentParticipant ? (
          <div className="login-pill">
            👤 {currentParticipant.name}

            <button
              onClick={logoutParticipant}
              style={{
                marginLeft: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Salir
            </button>
          </div>
        ) : (
          <div className="participant-login-card">
            <span className="mobile-login-title">Entrar a la quiniela</span>

            <select
              value={selectedLoginName}
              onChange={(e) => setSelectedLoginName(e.target.value)}
              style={{
                padding: '9px',
                borderRadius: '8px',
                border: 'none'
              }}
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
              style={{
                width: '90px',
                padding: '9px',
                borderRadius: '8px',
                border: 'none'
              }}
            />

            <button
              onClick={loginWithPin}
              style={{
                padding: '9px 13px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Entrar
            </button>
          </div>
        )}

        {isAdmin ? (
          <div className="login-pill">
            🛠️ Admin activo

            <button
              onClick={logoutAdmin}
              style={{
                marginLeft: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Cerrar admin
            </button>
          </div>
        ) : (
          <div className="admin-login-card">
            <input
              type="password"
              placeholder="PIN admin"
              value={adminPinInput}
              onChange={(e) => setAdminPinInput(e.target.value)}
              style={{
                width: '115px',
                padding: '9px',
                borderRadius: '8px',
                border: 'none'
              }}
            />

            <button
              onClick={activateAdmin}
              style={{
                padding: '9px 13px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Activar admin
            </button>
          </div>
        )}
      </div>
    )
  }

  function renderNavBar() {
    return (
      <nav className="quick-nav">
        <a href="#inicio">Inicio</a>

        {currentParticipant && <a href="#mi-quiniela">Mi Quiniela</a>}

        {currentParticipant && <a href="#campeon">Campeón</a>}

        {currentParticipant && <a href="#predicciones-en-vivo">En curso</a>}

        <a href="#partidos">Partidos</a>
        <a href="#tabla">Tabla</a>

        {isAdmin && <a href="#admin-pronosticos">Admin</a>}

        <a href="#movimiento">Movimiento</a>
      </nav>
    )
  }

  function renderMySummaryBox() {
    if (!currentParticipant) {
      return null
    }

    const isTopThree =
      currentLeaderboardEntry && currentLeaderboardEntry.position <= 3

    return (
      <section
        id="mi-quiniela"
        className="my-summary-card"
        style={{
          background: 'white',
          color: '#222',
          borderRadius: '24px',
          padding: '24px',
          marginBottom: '25px',
          border: isTopThree ? '3px solid #f7c948' : 'none',
          scrollMarginTop: '90px'
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 0.8fr) 1.2fr',
            gap: '20px',
            alignItems: 'center'
          }}
          className="my-summary-grid"
        >
          <div
            style={{
              borderRadius: '22px',
              padding: '22px',
              background: 'linear-gradient(135deg,#006847,#004d36)',
              color: 'white',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>👤</div>

            <div style={{ opacity: 0.85, fontSize: '0.9rem' }}>
              Participante
            </div>

            <h2 style={{ margin: '6px 0 14px' }}>
              {currentParticipant.name}
            </h2>

            <div
              style={{
                display: 'inline-block',
                padding: '8px 14px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.16)',
                fontWeight: 'bold'
              }}
            >
              {currentLeaderboardEntry
                ? `#${currentLeaderboardEntry.position}`
                : 'Sin posición'}
            </div>
          </div>

          <div
            className="my-stat-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px'
            }}
          >
            <div className="my-stat-card">
              <span>Puntos</span>
              <strong>
                {currentLeaderboardEntry
                  ? currentLeaderboardEntry.total_points
                  : 0}
              </strong>
            </div>

            <div className="my-stat-card">
              <span>Pronósticos</span>
              <strong>{savedPredictionCount}</strong>
            </div>

            <div className="my-stat-card">
              <span>Exactos</span>
              <strong>
                {currentLeaderboardEntry
                  ? currentLeaderboardEntry.exact_scores
                  : 0}
              </strong>
            </div>

            <div className="my-stat-card">
              <span>Acertados</span>
              <strong>
                {currentLeaderboardEntry
                  ? currentLeaderboardEntry.correct_results
                  : 0}
              </strong>
            </div>

            <div className="my-stat-card">
              <span>Partidos abiertos</span>
              <strong>{openMatches.length}</strong>
            </div>

            <div className="my-stat-card">
              <span>Partidos cerrados</span>
              <strong>{closedMatches.length}</strong>
            </div>
          </div>
        </div>
      </section>
    )
  }

  function renderChampionPredictionBox() {
    if (!currentParticipant) {
      return null
    }

    const isLocked = !!championPrediction

    return (
      <section
        id="campeon"
        style={{
          background: 'white',
          color: '#222',
          borderRadius: '20px',
          padding: '22px',
          marginBottom: '25px',
          border: isLocked ? '2px solid #006847' : '2px solid #f7c948',
          scrollMarginTop: '90px'
        }}
      >
        <h2 style={{ marginBottom: '8px', textAlign: 'center' }}>
          🏆 ¿Quién gana el Mundial?
        </h2>

        <p
          style={{
            color: '#666',
            textAlign: 'center',
            marginBottom: '16px'
          }}
        >
          Solo puedes elegir un equipo. Después de guardar tu respuesta, quedará
          bloqueada y no podrás cambiarla.
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '10px',
            flexWrap: 'wrap'
          }}
        >
          <input
            type="text"
            placeholder="Ejemplo: México, Brasil, Argentina..."
            value={championInput}
            disabled={isLocked}
            onChange={(e) => setChampionInput(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '360px',
              padding: '11px',
              borderRadius: '10px',
              border: '1px solid #ccc',
              background: isLocked ? '#f1f1f1' : 'white'
            }}
          />

          <button
            onClick={saveChampionPrediction}
            disabled={isLocked}
            style={{
              padding: '11px 16px',
              border: 'none',
              borderRadius: '10px',
              cursor: isLocked ? 'not-allowed' : 'pointer',
              background: isLocked ? '#999' : '#006847',
              color: 'white',
              fontWeight: 'bold'
            }}
          >
            {isLocked ? '🔒 Elección bloqueada' : 'Guardar campeón'}
          </button>
        </div>

        {isLocked && (
          <p
            style={{
              textAlign: 'center',
              marginTop: '14px',
              color: '#006847',
              fontWeight: 'bold'
            }}
          >
            Tu campeón elegido: {championPrediction.team_name}
          </p>
        )}
      </section>
    )
  }

  function renderLivePredictionsBox() {
    if (!currentParticipant) {
      return null
    }

    const groupedMatches = Array.from(
      new Map(
        livePredictions.map((entry) => [
          String(entry.match_id),
          {
            match_id: entry.match_id,
            home_team: entry.home_team,
            away_team: entry.away_team,
            kickoff: entry.kickoff,
            entries: livePredictions.filter(
              (prediction) => prediction.match_id === entry.match_id
            )
          }
        ])
      ).values()
    )

    return (
      <section
        id="predicciones-en-vivo"
        style={{
          background: 'white',
          color: '#222',
          borderRadius: '20px',
          padding: '22px',
          marginBottom: '25px',
          border: '2px solid #006847',
          scrollMarginTop: '90px'
        }}
      >
        <h2 style={{ marginBottom: '8px', textAlign: 'center' }}>
          👀 Pronósticos en curso
        </h2>

        <p
          style={{
            color: '#666',
            textAlign: 'center',
            marginBottom: '18px'
          }}
        >
          Aquí puedes ver los pronósticos de todos únicamente cuando el partido
          ya empezó. Los partidos futuros permanecen ocultos.
        </p>

        {groupedMatches.length === 0 ? (
          <p
            style={{
              color: '#777',
              textAlign: 'center',
              margin: 0
            }}
          >
            No hay partidos en curso en este momento.
          </p>
        ) : (
          groupedMatches.map((match) => {
            const savedCount = match.entries.filter(
              (entry) => entry.has_prediction
            ).length

            return (
              <div
                key={match.match_id}
                style={{
                  border: '1px solid #e5e5e5',
                  borderRadius: '14px',
                  padding: '16px',
                  marginBottom: '16px',
                  background: '#fafafa'
                }}
              >
                <h3 style={{ marginBottom: '5px', textAlign: 'center' }}>
                  {match.home_team} vs {match.away_team}
                </h3>

                <p
                  style={{
                    color: '#777',
                    textAlign: 'center',
                    marginBottom: '12px',
                    fontSize: '0.9rem'
                  }}
                >
                  {formatMatchDate(match.kickoff)} · {savedCount}/
                  {match.entries.length} pronósticos guardados
                </p>

                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.9rem'
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px' }}>
                          Participante
                        </th>
                        <th style={{ textAlign: 'center', padding: '8px' }}>
                          Pronóstico
                        </th>
                        <th style={{ textAlign: 'center', padding: '8px' }}>
                          Estado
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {match.entries.map((entry) => (
                        <tr key={`${entry.match_id}-${entry.participant_name}`}>
                          <td
                            style={{
                              padding: '8px',
                              borderTop: '1px solid #eee'
                            }}
                          >
                            {entry.participant_name}
                            {currentParticipant.name === entry.participant_name
                              ? ' 👈 Tú'
                              : ''}
                          </td>

                          <td
                            style={{
                              padding: '8px',
                              borderTop: '1px solid #eee',
                              textAlign: 'center',
                              fontWeight: 'bold'
                            }}
                          >
                            {entry.has_prediction
                              ? `${entry.predicted_home} - ${entry.predicted_away}`
                              : '-'}
                          </td>

                          <td
                            style={{
                              padding: '8px',
                              borderTop: '1px solid #eee',
                              textAlign: 'center',
                              color: entry.has_prediction
                                ? '#006847'
                                : '#b00020',
                              fontWeight: 'bold'
                            }}
                          >
                            {entry.has_prediction ? 'Guardado' : 'Pendiente'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })
        )}
      </section>
    )
  }

  function renderAdminPredictionsSection() {
    if (!isAdmin) {
      return null
    }

    const championCompleted = adminChampionPredictions.filter(
      (entry) => entry.has_prediction
    ).length

    const adminMatchOptions = Array.from(
      new Map(
        adminMatchPredictions.map((entry) => [
          String(entry.match_id),
          {
            match_id: entry.match_id,
            home_team: entry.home_team,
            away_team: entry.away_team,
            kickoff: entry.kickoff
          }
        ])
      ).values()
    )

    const filteredAdminMatchPredictions = adminMatchPredictions.filter(
      (entry) => {
        const hasPrediction =
          entry.predicted_home !== null &&
          entry.predicted_home !== undefined &&
          entry.predicted_away !== null &&
          entry.predicted_away !== undefined

        const matchesParticipant =
          adminParticipantSearch.trim() === '' ||
          entry.participant_name
            .toLowerCase()
            .includes(adminParticipantSearch.trim().toLowerCase())

        const matchesMatch =
          adminMatchFilter === 'all' ||
          String(entry.match_id) === adminMatchFilter

        const matchesStatus =
          adminStatusFilter === 'all' ||
          (adminStatusFilter === 'saved' && hasPrediction) ||
          (adminStatusFilter === 'pending' && !hasPrediction)

        return matchesParticipant && matchesMatch && matchesStatus
      }
    )

    const savedFilteredCount = filteredAdminMatchPredictions.filter((entry) => {
      return (
        entry.predicted_home !== null &&
        entry.predicted_home !== undefined &&
        entry.predicted_away !== null &&
        entry.predicted_away !== undefined
      )
    }).length

    function clearAdminFilters() {
      setAdminParticipantSearch('')
      setAdminMatchFilter('all')
      setAdminStatusFilter('all')
    }

    return (
      <section
        id="admin-pronosticos"
        style={{
          marginTop: '25px',
          background: 'white',
          color: '#222',
          borderRadius: '20px',
          padding: '25px',
          maxWidth: '1100px',
          marginLeft: 'auto',
          marginRight: 'auto',
          scrollMarginTop: '90px'
        }}
      >
        <h2 style={{ marginBottom: '8px' }}>🛠️ Admin: Pronósticos</h2>

        <p style={{ color: '#666', marginBottom: '18px' }}>
          Revisión de los pronósticos guardados por los participantes.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '20px'
          }}
        >
          <div
            style={{
              border: '1px solid #e5e5e5',
              borderRadius: '14px',
              padding: '16px',
              background: '#fafafa'
            }}
          >
            <h3 style={{ marginBottom: '10px' }}>
              🏆 Campeón del Mundial ({championCompleted}/
              {adminChampionPredictions.length})
            </h3>

            {adminChampionPredictions.length === 0 ? (
              <p style={{ color: '#777' }}>No hay datos todavía</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.9rem'
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px' }}>
                        Participante
                      </th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>
                        Campeón elegido
                      </th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>
                        Estado
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {adminChampionPredictions.map((entry) => (
                      <tr key={entry.user_id}>
                        <td
                          style={{
                            padding: '8px',
                            borderTop: '1px solid #eee'
                          }}
                        >
                          {entry.participant_name}
                        </td>

                        <td
                          style={{
                            padding: '8px',
                            borderTop: '1px solid #eee',
                            fontWeight: entry.has_prediction
                              ? 'bold'
                              : 'normal'
                          }}
                        >
                          {entry.team_name || '-'}
                        </td>

                        <td
                          style={{
                            padding: '8px',
                            borderTop: '1px solid #eee',
                            color: entry.has_prediction ? '#006847' : '#b00020',
                            fontWeight: 'bold'
                          }}
                        >
                          {entry.has_prediction ? 'Guardado' : 'Pendiente'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div
            style={{
              border: '1px solid #e5e5e5',
              borderRadius: '14px',
              padding: '16px',
              background: '#fafafa'
            }}
          >
            <h3 style={{ marginBottom: '10px' }}>
              ⚽ Pronósticos de partidos
            </h3>

            <p style={{ color: '#666', marginBottom: '12px' }}>
              Muestra todos los participantes por partido. Si alguien no ha
              guardado pronóstico, aparece como pendiente.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr auto',
                gap: '10px',
                marginBottom: '14px',
                alignItems: 'end'
              }}
              className="admin-filter-grid"
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    color: '#666',
                    marginBottom: '5px'
                  }}
                >
                  Buscar participante
                </label>

                <input
                  type="text"
                  placeholder="Ejemplo: Atenea"
                  value={adminParticipantSearch}
                  onChange={(e) => setAdminParticipantSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px',
                    borderRadius: '8px',
                    border: '1px solid #ccc'
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    color: '#666',
                    marginBottom: '5px'
                  }}
                >
                  Filtrar partido
                </label>

                <select
                  value={adminMatchFilter}
                  onChange={(e) => setAdminMatchFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px',
                    borderRadius: '8px',
                    border: '1px solid #ccc'
                  }}
                >
                  <option value="all">Todos los partidos</option>

                  {adminMatchOptions.map((match) => (
                    <option key={match.match_id} value={String(match.match_id)}>
                      {match.home_team} vs {match.away_team}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    color: '#666',
                    marginBottom: '5px'
                  }}
                >
                  Estado
                </label>

                <select
                  value={adminStatusFilter}
                  onChange={(e) => setAdminStatusFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px',
                    borderRadius: '8px',
                    border: '1px solid #ccc'
                  }}
                >
                  <option value="all">Todos</option>
                  <option value="saved">Solo guardados</option>
                  <option value="pending">Solo pendientes</option>
                </select>
              </div>

              <button
                onClick={clearAdminFilters}
                style={{
                  padding: '10px 13px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: '#777',
                  color: 'white',
                  fontWeight: 'bold'
                }}
              >
                Limpiar
              </button>
            </div>

            <div
              style={{
                marginBottom: '12px',
                color: '#666',
                fontSize: '0.9rem'
              }}
            >
              Mostrando {filteredAdminMatchPredictions.length} de{' '}
              {adminMatchPredictions.length} filas · Guardados en filtro:{' '}
              {savedFilteredCount}
            </div>

            {adminMatchPredictions.length === 0 ? (
              <p style={{ color: '#777' }}>
                No hay partidos o participantes todavía
              </p>
            ) : filteredAdminMatchPredictions.length === 0 ? (
              <p style={{ color: '#777' }}>
                No hay resultados con esos filtros
              </p>
            ) : (
              <div
                style={{
                  maxHeight: '420px',
                  overflow: 'auto'
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.86rem'
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px' }}>
                        Partido
                      </th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>
                        Participante
                      </th>
                      <th style={{ textAlign: 'center', padding: '8px' }}>
                        Pronóstico
                      </th>
                      <th style={{ textAlign: 'center', padding: '8px' }}>
                        Estado
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredAdminMatchPredictions.map((entry, index) => {
                      const hasPrediction =
                        entry.predicted_home !== null &&
                        entry.predicted_home !== undefined &&
                        entry.predicted_away !== null &&
                        entry.predicted_away !== undefined

                      return (
                        <tr
                          key={`${entry.match_id}-${entry.participant_name}-${index}`}
                        >
                          <td
                            style={{
                              padding: '8px',
                              borderTop: '1px solid #eee'
                            }}
                          >
                            <strong>
                              {entry.home_team} vs {entry.away_team}
                            </strong>
                            <br />
                            <small style={{ color: '#777' }}>
                              {formatMatchDate(entry.kickoff)}
                            </small>
                          </td>

                          <td
                            style={{
                              padding: '8px',
                              borderTop: '1px solid #eee'
                            }}
                          >
                            {entry.participant_name}
                          </td>

                          <td
                            style={{
                              padding: '8px',
                              borderTop: '1px solid #eee',
                              textAlign: 'center',
                              fontWeight: 'bold'
                            }}
                          >
                            {hasPrediction
                              ? `${entry.predicted_home} - ${entry.predicted_away}`
                              : '-'}
                          </td>

                          <td
                            style={{
                              padding: '8px',
                              borderTop: '1px solid #eee',
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
          </div>
        </div>
      </section>
    )
  }

  function renderAdminAddMatchBox() {
    if (!isAdmin) {
      return null
    }

    return (
      <div
        style={{
          marginBottom: '22px',
          padding: '18px',
          borderRadius: '14px',
          background: '#fff7e6',
          border: '1px solid #f0c36d',
          textAlign: 'center'
        }}
      >
        <h3 style={{ marginBottom: '15px' }}>🛠️ Admin: Agregar Partido</h3>

        <div
          className="admin-add-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '12px'
          }}
        >
          <input
            type="text"
            placeholder="Equipo local"
            value={newMatchHome}
            onChange={(e) => setNewMatchHome(e.target.value)}
            style={{
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid #ccc'
            }}
          />

          <input
            type="text"
            placeholder="Equipo visitante"
            value={newMatchAway}
            onChange={(e) => setNewMatchAway(e.target.value)}
            style={{
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid #ccc'
            }}
          />
        </div>

        <input
          type="datetime-local"
          value={newMatchKickoff}
          onChange={(e) => setNewMatchKickoff(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '360px',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid #ccc',
            marginBottom: '12px'
          }}
        />

        <br />

        <button
          onClick={addNewMatch}
          style={{
            padding: '10px 15px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            background: '#ce1126',
            color: 'white',
            fontWeight: 'bold'
          }}
        >
          Agregar partido
        </button>
      </div>
    )
  }

  function getMatchBadge(match: Match, locked: boolean, hasFinalScore: boolean) {
    if (hasFinalScore || match.status === 'finished') {
      return {
        label: '✅ Resultado capturado',
        background: '#e9f8ef',
        color: '#006847'
      }
    }

    if (locked) {
      return {
        label: '🔒 Cerrado',
        background: '#eeeeee',
        color: '#555'
      }
    }

    return {
      label: '🟢 Abierto',
      background: '#e9f8ef',
      color: '#006847'
    }
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

  function renderMatchCard(match: Match, locked: boolean) {
    const hasFinalScore =
      match.home_score !== null &&
      match.home_score !== undefined &&
      match.away_score !== null &&
      match.away_score !== undefined

    const badge = getMatchBadge(match, locked, hasFinalScore)

    const adminHomeValue =
      resultInputs[match.id]?.home ??
      (match.home_score !== null && match.home_score !== undefined
        ? String(match.home_score)
        : '')

    const adminAwayValue =
      resultInputs[match.id]?.away ??
      (match.away_score !== null && match.away_score !== undefined
        ? String(match.away_score)
        : '')

    return (
      <div
        key={match.id}
        className="match-card"
        style={{
          border: '2px solid #e5e5e5',
          borderRadius: '16px',
          padding: '18px',
          marginBottom: '15px',
          background: '#fafafa',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '12px'
          }}
        >
          <span
            style={{
              padding: '7px 12px',
              borderRadius: '999px',
              background: badge.background,
              color: badge.color,
              fontWeight: 'bold',
              fontSize: '0.82rem'
            }}
          >
            {badge.label}
          </span>
        </div>

        <div
          className="match-score-row"
          style={{
            display: 'grid',
            gridTemplateColumns: '180px 80px',
            gap: '10px',
            alignItems: 'center',
            marginBottom: '10px',
            maxWidth: '320px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}
        >
          <strong>{match.home_team}</strong>

          <input
            type="number"
            min="0"
            value={predictions[match.id]?.home || ''}
            disabled={locked || !currentParticipant}
            style={{
              width: '70px',
              padding: '7px',
              borderRadius: '6px',
              border: '1px solid #ccc'
            }}
            onChange={(e) =>
              setPredictions({
                ...predictions,
                [match.id]: {
                  ...predictions[match.id],
                  home: e.target.value
                }
              })
            }
          />
        </div>

        <div
          className="match-score-row"
          style={{
            display: 'grid',
            gridTemplateColumns: '180px 80px',
            gap: '10px',
            alignItems: 'center',
            maxWidth: '320px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}
        >
          <strong>{match.away_team}</strong>

          <input
            type="number"
            min="0"
            value={predictions[match.id]?.away || ''}
            disabled={locked || !currentParticipant}
            style={{
              width: '70px',
              padding: '7px',
              borderRadius: '6px',
              border: '1px solid #ccc'
            }}
            onChange={(e) =>
              setPredictions({
                ...predictions,
                [match.id]: {
                  ...predictions[match.id],
                  away: e.target.value
                }
              })
            }
          />
        </div>

        <div
          style={{
            color: '#666',
            marginTop: '15px'
          }}
        >
          📅 {formatMatchDate(match.kickoff)}
        </div>

        {hasFinalScore && (
          <div
            style={{
              marginTop: '10px',
              fontWeight: 'bold',
              color: '#006847'
            }}
          >
            Resultado final: {match.home_team} {match.home_score} -{' '}
            {match.away_score} {match.away_team}
          </div>
        )}

        {!locked && (
          <button
            onClick={() => savePrediction(match.id)}
            style={{
              marginTop: '15px',
              padding: '10px 15px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              background: currentParticipant ? '#006847' : '#999',
              color: 'white',
              fontWeight: 'bold'
            }}
          >
            {currentParticipant
              ? 'Guardar Pronóstico'
              : 'Entra con tu PIN para guardar'}
          </button>
        )}

        {locked && (
          <button
            disabled
            style={{
              marginTop: '15px',
              padding: '10px 15px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'not-allowed',
              background: '#999',
              color: 'white',
              fontWeight: 'bold'
            }}
          >
            🔒 Pronóstico Cerrado
          </button>
        )}

        {isAdmin && (
          <div
            style={{
              marginTop: '18px',
              padding: '15px',
              borderRadius: '12px',
              background: '#fff7e6',
              border: '1px solid #f0c36d'
            }}
          >
            <strong>🛠️ Admin: Resultado Final</strong>

            <div
              className="admin-result-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '180px 80px',
                gap: '10px',
                alignItems: 'center',
                maxWidth: '320px',
                margin: '15px auto 10px'
              }}
            >
              <span>{match.home_team}</span>

              <input
                type="number"
                min="0"
                value={adminHomeValue}
                style={{
                  width: '70px',
                  padding: '7px',
                  borderRadius: '6px',
                  border: '1px solid #ccc'
                }}
                onChange={(e) =>
                  setResultInputs({
                    ...resultInputs,
                    [match.id]: {
                      ...resultInputs[match.id],
                      home: e.target.value
                    }
                  })
                }
              />

              <span>{match.away_team}</span>

              <input
                type="number"
                min="0"
                value={adminAwayValue}
                style={{
                  width: '70px',
                  padding: '7px',
                  borderRadius: '6px',
                  border: '1px solid #ccc'
                }}
                onChange={(e) =>
                  setResultInputs({
                    ...resultInputs,
                    [match.id]: {
                      ...resultInputs[match.id],
                      away: e.target.value
                    }
                  })
                }
              />
            </div>

            <button
              onClick={() => saveFinalResult(match)}
              style={{
                marginTop: '10px',
                padding: '10px 15px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                background: '#ce1126',
                color: 'white',
                fontWeight: 'bold'
              }}
            >
              Guardar resultado y calcular puntos
            </button>
          </div>
        )}
      </div>
    )
  }

  function renderMatchGroups(groups: MatchGroup[], emptyText: string) {
    if (groups.length === 0) {
      return <p style={{ color: '#777', marginBottom: '20px' }}>{emptyText}</p>
    }

    return groups.map((group) => (
      <div key={group.dateKey}>
        <div
          className="date-group-title"
          style={{
            margin: '18px 0 12px',
            padding: '9px 12px',
            borderRadius: '999px',
            background: '#f0f4f2',
            color: '#006847',
            fontWeight: 'bold',
            textAlign: 'center',
            textTransform: 'capitalize'
          }}
        >
          {group.dateLabel}
        </div>

        {group.matches.map((match) =>
          renderMatchCard(match, new Date(match.kickoff) <= new Date())
        )}
      </div>
    ))
  }

  function renderCompactMovementCard(
    title: string,
    entries: RankingMovementEntry[],
    emptyText: string,
    accentColor: string
  ) {
    return (
      <div
        className="movement-card"
        style={{
          border: '1px solid #e5e5e5',
          borderRadius: '14px',
          padding: '16px',
          background: '#fafafa'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px'
          }}
        >
          <h3 style={{ margin: 0 }}>{title}</h3>

          <span
            style={{
              minWidth: '34px',
              height: '34px',
              borderRadius: '999px',
              background: accentColor,
              color: 'white',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold'
            }}
          >
            {entries.length}
          </span>
        </div>

        {entries.length === 0 ? (
          <p style={{ color: '#777', margin: 0 }}>{emptyText}</p>
        ) : (
          <div
            style={{
              maxHeight: '170px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}
          >
            {entries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #eee',
                  padding: '8px 0'
                }}
              >
                <span>
                  <strong>{entry.name}</strong>
                  <br />
                  <small style={{ color: '#777' }}>
                    #{entry.previous_position ?? '-'} → #
                    {entry.current_position}
                  </small>
                </span>

                <strong style={{ color: accentColor }}>
                  {entry.movement_type === 'subio'
                    ? `+${entry.movement}`
                    : entry.movement_type === 'bajo'
                      ? entry.movement
                      : '0'}
                </strong>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <main
      id="inicio"
      className="app-main"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#006847 0%,#004d36 100%)',
        color: 'white',
        padding: '30px',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <div
        className="app-container"
        style={{
          maxWidth: '1600px',
          margin: '0 auto'
        }}
      >
        <div
          className="top-login-bar"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '20px'
          }}
        >
          {renderLoginBox()}
        </div>

        <h1
          className="main-title"
          style={{
            textAlign: 'center',
            fontSize: '3rem',
            marginBottom: '10px'
          }}
        >
          IPAM 🏆 Quiniela Mundialista 2026
        </h1>

        <p
          className="main-subtitle"
          style={{
            textAlign: 'center',
            opacity: 0.9,
            marginBottom: '22px'
          }}
        >
          Predice los resultados y compite por el primer lugar
        </p>

        {renderNavBar()}

        {renderMySummaryBox()}

        {renderChampionPredictionBox()}

        {renderLivePredictionsBox()}

        <div
          className="dashboard-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '25px',
            alignItems: 'start'
          }}
        >
          <section
            id="partidos"
            className="dashboard-panel"
            style={{
              background: 'white',
              color: '#222',
              borderRadius: '20px',
              padding: '25px',
              maxHeight: '82vh',
              overflowY: 'auto',
              scrollMarginTop: '90px'
            }}
          >
            <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>
              ⚽ Partidos
            </h2>

            {renderAdminAddMatchBox()}

            {!currentParticipant && (
              <p
                style={{
                  textAlign: 'center',
                  color: '#777',
                  marginBottom: '18px'
                }}
              >
                Selecciona tu nombre e ingresa tu PIN para guardar pronósticos.
              </p>
            )}

            <h3
              style={{
                marginBottom: '15px',
                color: '#006847',
                textAlign: 'center'
              }}
            >
              🟢 Abiertos
            </h3>

            {renderMatchGroups(openMatchGroups, 'No hay partidos abiertos')}

            <h3
              style={{
                marginTop: '25px',
                marginBottom: '15px',
                color: '#777',
                textAlign: 'center'
              }}
            >
              🔒 Cerrados
            </h3>

            {renderMatchGroups(closedMatchGroups, 'No hay partidos cerrados')}
          </section>

          <section
            id="tabla"
            className="dashboard-panel"
            style={{
              background: 'white',
              color: '#222',
              borderRadius: '20px',
              padding: '25px',
              maxHeight: '82vh',
              overflowY: 'auto',
              position: 'sticky',
              top: '20px',
              scrollMarginTop: '90px'
            }}
          >
            <h2 style={{ marginBottom: '10px' }}>🏅 Tabla General</h2>

            <p
              style={{
                color: '#777',
                fontSize: '0.9rem',
                marginBottom: '20px'
              }}
            >
              Desempate: puntos, exactos, resultados acertados
            </p>

            {leaderboard.length === 0 ? (
              <p>Aún no hay puntuaciones</p>
            ) : (
              leaderboard.map((entry, index) => {
                const medal =
                  index === 0
                    ? '🥇'
                    : index === 1
                      ? '🥈'
                      : index === 2
                        ? '🥉'
                        : `#${entry.position}`

                const isCurrentParticipant =
                  currentParticipant && entry.id === currentParticipant.id

                return (
                  <div
                    key={entry.id}
                    className="leaderboard-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '60px 1fr 90px',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px',
                      borderBottom: '1px solid #eee',
                      borderRadius: '12px',
                      background: isCurrentParticipant ? '#e9f8ef' : 'white'
                    }}
                  >
                    <strong>{medal}</strong>

                    <div>
                      <strong>
                        {entry.name}
                        {isCurrentParticipant ? ' 👈 Tú' : ''}
                      </strong>

                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: '#777',
                          marginTop: '3px'
                        }}
                      >
                        Exactos: {entry.exact_scores} · Acertados:{' '}
                        {entry.correct_results}
                      </div>
                    </div>

                    <strong style={{ textAlign: 'right' }}>
                      {entry.total_points} pts
                    </strong>
                  </div>
                )
              })
            )}
          </section>
        </div>

        <section
          id="movimiento"
          className="movement-section"
          style={{
            marginTop: '25px',
            background: 'white',
            color: '#222',
            borderRadius: '20px',
            padding: '25px',
            maxWidth: '1100px',
            marginLeft: 'auto',
            marginRight: 'auto',
            scrollMarginTop: '90px'
          }}
        >
          <h2 style={{ marginBottom: '8px' }}>📈 Movimiento en la Tabla</h2>

          <p style={{ color: '#666', marginBottom: '18px' }}>
            Resumen de cambios comparando el ranking actual contra el ranking
            anterior.
          </p>

          <div
            className="movement-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '15px',
              alignItems: 'start'
            }}
          >
            {renderCompactMovementCard(
              '⬆️ Subieron',
              wentUp,
              'Nadie subió todavía',
              '#006847'
            )}

            {renderCompactMovementCard(
              '➡️ Igual / Nuevos',
              stayedSame,
              'Sin movimientos todavía',
              '#777'
            )}

            {renderCompactMovementCard(
              '⬇️ Bajaron',
              wentDown,
              'Nadie bajó todavía',
              '#b00020'
            )}
          </div>
        </section>

        {renderAdminPredictionsSection()}

        <footer
          style={{
            textAlign: 'center',
            marginTop: '26px',
            padding: '18px',
            opacity: 0.85,
            fontSize: '0.9rem'
          }}
        >
          IPAM Quiniela Mundialista 2026 · Uso interno
        </footer>
      </div>
    </main>
  )
}
