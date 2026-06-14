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

export default function Home() {
  const [matches, setMatches] = useState<Match[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [movements, setMovements] = useState<RankingMovementEntry[]>([])

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
    const savedParticipantName = localStorage.getItem('quiniela_participant_name')
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

  const openMatches = matches.filter(
    (match) => new Date(match.kickoff) > new Date()
  )

  const closedMatches = matches.filter(
    (match) => new Date(match.kickoff) <= new Date()
  )

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
      localStorage.removeItem('quiniela_admin_pin')

      if (showSuccess) {
        alert('PIN de admin incorrecto')
      }

      return
    }

    setIsAdmin(true)
    setAdminPin(pinToCheck)
    localStorage.setItem('quiniela_admin_pin', pinToCheck)

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

    if (Number.isNaN(kickoffDate.getTime())) {
      alert('La fecha/hora no es válida')
      return
    }

    const { error } = await supabase.rpc('admin_add_match_pin', {
      p_admin_pin: adminPin,
      p_home_team: newMatchHome.trim(),
      p_away_team: newMatchAway.trim(),
      p_kickoff: kickoffDate.toISOString()
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
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          justifyContent: 'flex-end',
          alignItems: 'center'
        }}
      >
        {currentParticipant ? (
          <div>
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
          <>
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
          </>
        )}

        {isAdmin ? (
          <div>
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
          <>
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
          </>
        )}
      </div>
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

  function renderMatchCard(match: Match, locked: boolean) {
    const hasFinalScore =
      match.home_score !== null &&
      match.home_score !== undefined &&
      match.away_score !== null &&
      match.away_score !== undefined

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
        style={{
          border: '2px solid #e5e5e5',
          borderRadius: '14px',
          padding: '18px',
          marginBottom: '15px',
          background: '#fafafa',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            fontSize: '1.15rem',
            fontWeight: 'bold',
            marginBottom: '15px',
            color: locked ? '#777' : '#006847'
          }}
        >
          {locked ? '🔒 Partido Cerrado' : '⚽ Pronóstico Abierto'}
        </div>

        <div
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
          📅 {new Date(match.kickoff).toLocaleString('es-MX')}
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

  function renderMovementList(
    entries: RankingMovementEntry[],
    emptyText: string
  ) {
    if (entries.length === 0) {
      return <p style={{ color: '#777', marginTop: '10px' }}>{emptyText}</p>
    }

    return entries.map((entry) => (
      <div
        key={entry.id}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '1px solid #eee',
          padding: '8px 0'
        }}
      >
        <span>
          <strong>{entry.name}</strong>
          <br />
          <small style={{ color: '#777' }}>
            #{entry.previous_position ?? '-'} → #{entry.current_position}
          </small>
        </span>

        <strong
          style={{
            color:
              entry.movement_type === 'subio'
                ? '#006847'
                : entry.movement_type === 'bajo'
                  ? '#b00020'
                  : '#777'
          }}
        >
          {entry.movement_type === 'subio'
            ? `+${entry.movement}`
            : entry.movement_type === 'bajo'
              ? entry.movement
              : '0'}
        </strong>
      </div>
    ))
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#006847 0%,#004d36 100%)',
        color: 'white',
        padding: '30px',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <div
        style={{
          maxWidth: '1600px',
          margin: '0 auto'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '20px'
          }}
        >
          {renderLoginBox()}
        </div>

        <h1
          style={{
            textAlign: 'center',
            fontSize: '3rem',
            marginBottom: '10px'
          }}
        >
          IPAM 🏆 Quiniela Mundialista 2026
        </h1>

        <p
          style={{
            textAlign: 'center',
            opacity: 0.9,
            marginBottom: '40px'
          }}
        >
          Predice los resultados y compite por el primer lugar
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '25px',
            alignItems: 'start'
          }}
        >
          <section
            style={{
              background: 'white',
              color: '#222',
              borderRadius: '20px',
              padding: '25px',
              maxHeight: '82vh',
              overflowY: 'auto'
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

            {openMatches.length === 0 ? (
              <p style={{ color: '#777', marginBottom: '20px' }}>
                No hay partidos abiertos
              </p>
            ) : (
              openMatches.map((match) => renderMatchCard(match, false))
            )}

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

            {closedMatches.length === 0 ? (
              <p style={{ color: '#777' }}>No hay partidos cerrados</p>
            ) : (
              closedMatches.map((match) => renderMatchCard(match, true))
            )}
          </section>

          <section
            style={{
              background: 'white',
              color: '#222',
              borderRadius: '20px',
              padding: '25px',
              maxHeight: '82vh',
              overflowY: 'auto',
              position: 'sticky',
              top: '20px'
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

                return (
                  <div
                    key={entry.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '60px 1fr 90px',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px 0',
                      borderBottom: '1px solid #eee'
                    }}
                  >
                    <strong>{medal}</strong>

                    <div>
                      <strong>{entry.name}</strong>

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
          style={{
            marginTop: '25px',
            background: 'white',
            color: '#222',
            borderRadius: '20px',
            padding: '25px',
            maxWidth: '1100px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}
        >
          <h2 style={{ marginBottom: '15px' }}>📈 Movimiento en la Tabla</h2>

          <p style={{ color: '#666', marginBottom: '15px' }}>
            Cambios de posición comparando el ranking actual contra el snapshot
            anterior.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '15px',
              alignItems: 'start'
            }}
          >
            <div
              style={{
                border: '1px solid #e5e5e5',
                borderRadius: '12px',
                padding: '15px',
                background: '#f8fff8'
              }}
            >
              <h3>⬆️ Subieron</h3>
              {renderMovementList(wentUp, 'Nadie subió todavía')}
            </div>

            <div
              style={{
                border: '1px solid #e5e5e5',
                borderRadius: '12px',
                padding: '15px',
                background: '#fffdf5'
              }}
            >
              <h3>➡️ Sin Cambio / Nuevos</h3>
              {renderMovementList(stayedSame, 'Sin movimientos todavía')}
            </div>

            <div
              style={{
                border: '1px solid #e5e5e5',
                borderRadius: '12px',
                padding: '15px',
                background: '#fff8f8'
              }}
            >
              <h3>⬇️ Bajaron</h3>
              {renderMovementList(wentDown, 'Nadie bajó todavía')}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}