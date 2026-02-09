import { supabase } from './supabase';

/**
 * 신규 사용자를 데모 팀(is_demo=true)에 자동 가입시킴.
 * - 중복 가입 방지 (이미 멤버면 스킵)
 * - 실패해도 회원가입 흐름을 막지 않음
 */
export async function joinDemoTeam(userId: string): Promise<void> {
  try {
    // 1. 데모 팀 조회
    const { data: demoTeam, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('is_demo', true)
      .limit(1)
      .maybeSingle();

    if (teamError || !demoTeam) {
      console.warn('데모 팀을 찾을 수 없습니다:', teamError?.message);
      return;
    }

    // 2. 이미 가입되어 있는지 확인
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', demoTeam.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return; // 이미 가입됨
    }

    // 3. 멤버로 추가
    const { error: insertError } = await supabase
      .from('team_members')
      .insert({
        team_id: demoTeam.id,
        user_id: userId,
        role: 'member',
        status: 'active',
      });

    if (insertError) {
      console.warn('데모 팀 가입 실패:', insertError.message);
    }
  } catch (err) {
    console.warn('데모 팀 자동 가입 중 오류:', err);
  }
}
