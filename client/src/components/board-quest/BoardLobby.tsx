import { useEffect, useState } from 'react';
import { TEAM_NAME_STARTS, TEAM_NAME_ENDS, type View, type Team, type Level } from '@shared/boardQuest';

function TeamName({ view, team, myId, busy, act }: { view: View; team: Team; myId: number; busy: boolean; act: (action: unknown) => void }) {
  const name = view.teamNames[team];
  const [first, setFirst] = useState(name.split(' ')[0]), [last, setLast] = useState(name.split(' ')[1]);
  useEffect(() => { const words = name.split(' '); setFirst(words[0]); setLast(words[1]); }, [name]);
  if (view.captains[team] !== myId) return null;
  return <div className="bq-name-builder"><p>You’re the captain. Name your team!</p><div>
    <select aria-label={`${team} team first word`} value={first} onChange={e => setFirst(e.target.value)}>{TEAM_NAME_STARTS.map(w => <option key={w}>{w}</option>)}</select>
    <select aria-label={`${team} team second word`} value={last} onChange={e => setLast(e.target.value)}>{TEAM_NAME_ENDS.map(w => <option key={w}>{w}</option>)}</select>
  </div><button disabled={busy || name === `${first} ${last}`} onClick={() => act({ type: 'name', team, name: `${first} ${last}` })}>Save team name</button></div>;
}
export default function BoardLobby({ view, myId, busy, offline, error, act, leave }: { view: View; myId: number; busy: boolean; offline: boolean; error: string; act: (action: unknown) => void; leave: () => void }) {
  const host = view.hostId === myId;
  return <main className="bq-setup"><button className="bq-back" onClick={leave}>Exit to worlds</button><section className="bq-public-lobby">
    <p className="bq-eyebrow">BOARD QUEST LOBBY · {view.players.length}/6 PLAYERS</p><h1>Build your teams</h1>
    <p>{host ? 'You joined first! Choose the settings, split the teams, and start when you’re ready.' : `${view.players.find(p => p.id === view.hostId)?.name} joined first and manages the settings.`}</p>
    <div className="bq-lobby-settings"><label>Question grade level<select aria-label="Question grade level" disabled={!host || busy} value={view.level} onChange={e => act({ type: 'settings', level: e.target.value as Level })}>{(['K-2', '3-5', '6-8', '9-12'] as Level[]).map(l => <option key={l}>{l}</option>)}</select></label>
      <label className="bq-cpu-toggle"><input type="checkbox" checked={view.fillCpu} disabled={!host || busy} onChange={e => act({ type: 'settings', fillCpu: e.target.checked })} />Fill empty seats with CPUs</label>
    </div>
    <div className="bq-team-columns">{(['blue', 'gold'] as Team[]).map(team => <div key={team} className={`bq-lobby-team ${team}`}><h2>{view.teamNames[team]}</h2>
      {view.players.filter(p => p.team === team).map(p => <div className="bq-lobby-player" key={p.id}><div><strong>{p.name}{p.id === myId ? ' (you)' : ''}</strong><small>{view.captains[team] === p.id ? 'Team captain' : 'Player'}{p.id === view.hostId ? ' · Lobby host' : ''}</small></div>
        {host && p.id !== myId && <div className="bq-player-tools"><button disabled={busy} aria-label={`Move ${p.name} to ${team === 'blue' ? view.teamNames.gold : view.teamNames.blue}`} onClick={() => act({ type: 'assign', playerId: p.id, team: team === 'blue' ? 'gold' : 'blue' })}>Switch team</button>
          {team === 'gold' && view.captains.gold !== p.id && <button disabled={busy} onClick={() => act({ type: 'captain', playerId: p.id, team })}>Make captain</button>}</div>}
      </div>)}
      {!view.players.some(p => p.team === team) && <p>Waiting for players{view.fillCpu ? ' · CPUs can fill this team' : ''}</p>}
      <TeamName view={view} team={team} myId={myId} busy={busy} act={act} />
    </div>)}</div>
    <p className="bq-fine">Team names use approved words to keep the game friendly. Players can join this lobby without a code.</p>
    {host ? <button className="bq-primary" disabled={busy || offline} onClick={() => act({ type: 'start' })}>Start with {view.fillCpu ? `${view.players.length} players + ${6 - view.players.length} CPUs` : `${view.players.length} players`}</button> : <p>Waiting for the host to start…</p>}
    {(error || offline) && <p className="bq-error" role="alert">{offline ? 'Reconnecting to the lobby…' : error}</p>}
  </section></main>;
}
