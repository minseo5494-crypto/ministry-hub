import { supabase } from './supabase';

// 초대 코드 생성 함수
export const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// 팀 생성
export const createTeam = async (
  name: string,
  type: 'church_internal' | 'external',
  churchName: string | null,
  userId: string
) => {
  try {
    console.log('Creating team with:', { name, type, churchName, userId });
    
    // 초대 코드 생성 (중복 체크)
    let inviteCode = generateInviteCode();
    let isUnique = false;
    
    while (!isUnique) {
      const { data: existing } = await supabase
        .from('teams')
        .select('id')
        .eq('invite_code', inviteCode)
        .single();
      
      if (!existing) {
        isUnique = true;
      } else {
        inviteCode = generateInviteCode();
      }
    }

    console.log('Generated invite code:', inviteCode);

    // 팀 생성
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name,
        type,
        church_name: churchName,
        invite_code: inviteCode,
        created_by: userId
      })
      .select()
      .single();

    if (teamError) {
      console.error('Team creation error:', teamError);
      throw teamError;
    }

    console.log('Team created:', team);

    // 생성자를 admin으로 추가
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: userId,
        role: 'admin',
        status: 'active'
      });

    if (memberError) {
      console.error('Member addition error:', memberError);
      throw memberError;
    }

    return team;
  } catch (error) {
    console.error('Full error in createTeam:', error);
    throw error;
  }
};

// 초대 코드로 팀 참여
export const joinTeam = async (inviteCode: string, userId: string) => {
  console.log('Attempting to join with code:', inviteCode, 'User:', userId);

  // 초대 코드로 팀 찾기
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();

  console.log('Team search result:', team, 'Error:', teamError);

  if (teamError || !team) {
    console.error('Team search error:', teamError);
    throw new Error('유효하지 않은 초대 코드입니다');
  }

  // 이미 가입되어 있는지 확인
  const { data: existing, error: existingError } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', team.id)
    .eq('user_id', userId)
    .single();

  console.log('Existing member check:', existing, 'Error:', existingError);

  // existingError가 없고 existing이 있으면 이미 가입된 상태
  if (existing && !existingError) {
    throw new Error('이미 가입된 팀입니다');
  }

  // 팀 멤버 추가
  const { error: memberError } = await supabase
    .from('team_members')
    .insert({
      team_id: team.id,
      user_id: userId,
      role: 'member',
      status: 'active'
    });

  if (memberError) {
    console.error('Member addition error:', memberError);
    throw memberError;
  }

  return team;
};

// 사용자의 팀 목록 가져오기
export const getUserTeams = async (userId: string) => {
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      team_id,
      role,
      teams!inner (
        id,
        name,
        type,
        church_name,
        invite_code
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) throw error;

  return data?.map(item => ({
    ...item.teams,
    role: item.role
  })) || [];
};

// 팀 멤버 목록
export const getTeamMembers = async (teamId: string) => {
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      *,
      users (
        id,
        name,
        email
      )
    `)
    .eq('team_id', teamId)
    .eq('status', 'active');

  if (error) throw error;

  return data || [];
};