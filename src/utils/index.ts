export function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export function formatWinRate(wins: number, losses: number): string {
  const total = wins + losses
  if (total === 0) return '0%'
  return `${Math.round((wins / total) * 100)}%`
}

export function formatScore(sets: { score_team1: number; score_team2: number }[]): string {
  return sets.map((s) => `${s.score_team1}–${s.score_team2}`).join(', ')
}
