import { supabase } from './supabase';
import { logActivity } from './activityLogger';

// ============================================
// 기존 함수들 (그대로 유지)
// ============================================

// 회원가입
export const signUp = async (email: string, password: string, name: string, churchName?: string, captchaToken?: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name,
      },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      captchaToken: captchaToken,
    }
  });

  if (error) throw error;

  // users 테이블에 사용자 정보 저장 (트리거가 기본 정보를 이미 넣었으므로 UPDATE)
  if (data.user) {
    const { error: updateError } = await supabase
      .from('users')
      .update({
        church_name: churchName || null,
        auth_provider: 'email',
        email_verified: false
      })
      .eq('id', data.user.id);

    if (updateError) {
      console.error('Error updating user:', updateError);
    }
    
    // 📊 회원가입 로깅
    logActivity({ 
      actionType: 'user_signup', 
      userId: data.user.id 
    }).catch(err => console.error('회원가입 로깅 실패:', err));
  }

  return data;
};


// 로그인
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;

  // last_login 업데이트
  if (data.user) {
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', data.user.id);
  // 📊 로그인 로깅
    logActivity({ 
      actionType: 'user_login', 
      userId: data.user.id 
    }).catch(err => console.error('로그인 로깅 실패:', err));
  }

  return data;
};

// 로그아웃
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// 현재 세션 가져오기
export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
};

// 현재 사용자 정보 가져오기
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  // users 테이블에서 추가 정보 가져오기
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  // ✅ 이렇게 수정
  return {
    ...user,
    ...profile,  // 이렇게 하면 is_admin이 최상위로 올라옴
    profile
  };
};

// 비밀번호 재설정 이메일 전송
export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  
  if (error) throw error;
};

// 이메일 변경
export const updateEmail = async (newEmail: string) => {
  const { error } = await supabase.auth.updateUser({
    email: newEmail
  });
  
  if (error) throw error;
};

// 비밀번호 변경
export const updatePassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });
  
  if (error) throw error;
};

// 프로필 업데이트
export const updateProfile = async (userId: string, updates: any) => {
  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId);
  
  if (error) throw error;
};

// ============================================
// Phase 4: Google OAuth 추가 함수들
// ============================================

/**
 * Google OAuth 로그인
 * @param redirectTo - 로그인 후 리다이렉트할 URL (선택사항)
 */
export const signInWithGoogle = async (redirectTo?: string) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo || `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      }
    }
  });

  if (error) {
    throw error;
  }

  return data;
};

/**
 * OAuth 콜백 처리
 * 로그인 후 자동으로 호출되며, 사용자 정보를 users 테이블에 동기화
 */
export const handleOAuthCallback = async () => {
  try {
    console.log('🔄 Starting OAuth callback processing...');
    
    // 1. 현재 세션 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      throw sessionError;
    }

    if (!session?.user) {
      console.error('❌ No session or user found');
      throw new Error('세션 정보를 찾을 수 없습니다');
    }

    const user = session.user;
    console.log('✅ User from session:', {
      id: user.id,
      email: user.email,
      metadata: user.user_metadata
    });

    // 2. users 테이블에서 사용자 확인
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle(); // ⚠️ single() 대신 maybeSingle() 사용

    if (checkError) {
      console.error('❌ User check error:', checkError);
      throw checkError;
    }

    console.log('📊 Existing user check:', existingUser ? '기존 사용자' : '신규 사용자');

    // 3. 사용자 이름 및 프로필 이미지 추출
    const userName = user.user_metadata?.full_name 
      || user.user_metadata?.name 
      || user.email?.split('@')[0] 
      || 'User';
    
    const profileImageUrl = user.user_metadata?.avatar_url 
      || user.user_metadata?.picture 
      || null;

    console.log('👤 User info to save:', { userName, profileImageUrl });

    // 4. 신규 사용자인 경우 users 테이블에 추가
    if (!existingUser) {
      console.log('➕ Creating new user record...');
      
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          name: userName,
          profile_image_url: profileImageUrl,
          email_verified: true, // OAuth는 이메일이 자동 인증됨
          auth_provider: 'google',
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString()
        });

      if (insertError) {
        console.error('❌ Insert error:', JSON.stringify(insertError, null, 2));
        throw insertError;
      }
      
      console.log('✅ New user created successfully!');
    } else {
      // 5. 기존 사용자인 경우 last_login 업데이트 & 프로필 이미지 동기화
      console.log('🔄 Updating existing user...');
      
      const updateData: any = {
        last_login: new Date().toISOString()
      };

      // Google 프로필 이미지가 있고, 기존에 없거나 다르면 업데이트
      if (profileImageUrl && existingUser.profile_image_url !== profileImageUrl) {
        updateData.profile_image_url = profileImageUrl;
        console.log('🖼️ Updating profile image');
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);

      if (updateError) {
        console.error('❌ Update error:', JSON.stringify(updateError, null, 2));
        // ⚠️ 업데이트 실패는 치명적이지 않으므로 경고만 표시
        console.warn('⚠️ Failed to update user, but login will proceed');
      } else {
        console.log('✅ User updated successfully!');
      }
    }

    console.log('✅ OAuth callback completed successfully');
    return session;
    
  } catch (error: any) {
    console.error('💥 OAuth callback error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw error;
  }
};

/**
 * 이메일 인증 재발송
 */
export const resendVerificationEmail = async (email: string) => {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`
    }
  });

  if (error) {
    throw error;
  }
};

/**
 * 비밀번호 재설정 (별칭 - 기존 resetPassword와 동일)
 */
export const sendPasswordResetEmail = async (email: string) => {
  return resetPassword(email);
};