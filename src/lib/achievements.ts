import { supabase } from '@/lib/supabase';

export type Badge = {
  key: string;
  title: string;
  description: string;
  icon: string;
  color: string;
};

export const ALL_BADGES: Badge[] = [
  { key: 'first_match', title: 'First Rally', description: 'Play your first match', icon: '🏸', color: '#6366f1' },
  { key: 'first_win', title: 'First Blood', description: 'Win your first match', icon: '🥇', color: '#f59e0b' },
  { key: 'five_wins', title: 'Sharp Shooter', description: 'Win 5 matches', icon: '🎯', color: '#10b981' },
  { key: 'ten_matches', title: 'Veteran', description: 'Play 10 matches', icon: '⚡', color: '#3b82f6' },
  { key: 'on_fire', title: 'On Fire', description: 'Win 3 or more matches', icon: '🔥', color: '#ef4444' },
  { key: 'court_legend', title: 'Court Legend', description: 'Play 25 matches', icon: '👑', color: '#f59e0b' },
];

export const checkAndAwardAchievements = async (
  userId: string,
  wins: number,
  losses: number
) => {
  const total = wins + losses;

  const earned: string[] = [];
  if (total >= 1) earned.push('first_match');
  if (wins >= 1) earned.push('first_win');
  if (wins >= 5) earned.push('five_wins');
  if (total >= 10) earned.push('ten_matches');
  if (wins >= 3) earned.push('on_fire');
  if (total >= 25) earned.push('court_legend');

  if (earned.length === 0) return;

  const { data: existing } = await (supabase.from('achievements') as any)
    .select('badge_key')
    .eq('user_id', userId);

  const alreadyEarned = (existing ?? []).map((a: any) => a.badge_key);
  const newBadges = earned.filter((key) => !alreadyEarned.includes(key));

  if (newBadges.length === 0) return;

  await (supabase.from('achievements') as any).insert(
    newBadges.map((key) => ({
      user_id: userId,
      badge_key: key,
      earned_at: new Date().toISOString(),
    }))
  );

  return newBadges;
};

export const getUserAchievements = async (userId: string): Promise<string[]> => {
  const { data } = await (supabase.from('achievements') as any)
    .select('badge_key')
    .eq('user_id', userId);
  return (data ?? []).map((a: any) => a.badge_key);
};