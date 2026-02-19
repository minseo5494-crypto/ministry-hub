// 사용자 친화적 에러 메시지 매핑

export const ERROR_MESSAGES: Record<string, string> = {
  // 네트워크 에러
  'Failed to fetch': '네트워크 연결을 확인해주세요.',
  'NetworkError': '네트워크 연결을 확인해주세요.',
  'Network request failed': '네트워크 연결을 확인해주세요.',
  
  // 인증 에러
  'JWT expired': '세션이 만료되었습니다. 다시 로그인해주세요.',
  'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
  'Email not confirmed': '이메일 인증이 필요합니다. 메일함을 확인해주세요.',
  'User already registered': '이미 가입된 이메일입니다.',
  'Invalid email or password': '이메일 또는 비밀번호가 올바르지 않습니다.',
  
  // 권한 에러
  'permission denied': '접근 권한이 없습니다.',
  'Forbidden': '접근 권한이 없습니다.',
  'Unauthorized': '로그인이 필요합니다.',
  '권한이 없습니다': '권한이 없습니다. 팀 리더에게 문의하세요.',
  
  // 데이터 에러
  'duplicate key': '이미 존재하는 데이터입니다.',
  'violates foreign key': '연결된 데이터가 존재하지 않습니다.',
  'not found': '요청한 데이터를 찾을 수 없습니다.',
  
  // 파일 에러
  'File too large': '파일 크기가 너무 큽니다.',
  'Invalid file type': '지원하지 않는 파일 형식입니다.',
  
  // 기타
  'Rate limit exceeded': '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
};

/**
 * 에러 메시지를 사용자 친화적으로 변환
 */
export const getErrorMessage = (error: any): string => {
  // 에러가 문자열인 경우
  const errorMessage = typeof error === 'string' 
    ? error 
    : error?.message || error?.error_description || '알 수 없는 오류가 발생했습니다.';

  // 매핑된 메시지 찾기
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  // 한국어 메시지는 서버 API에서 이미 사용자 친화적으로 작성된 것이므로 그대로 반환
  if (/[가-힣]/.test(errorMessage)) {
    return errorMessage;
  }

  // 영문 에러: 개발 환경에서는 원본 반환, 프로덕션에서는 기본 메시지
  if (process.env.NODE_ENV === 'development') {
    return errorMessage;
  }

  return '오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
};

/**
 * 에러를 콘솔에 로깅 (개발용)
 */
export const logError = (context: string, error: any) => {
  console.error(`[${context}]`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    error
  });
};