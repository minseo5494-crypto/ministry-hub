---
description: Supabase 쿼리 작성 도우미
allowed-tools: Read, Grep, Glob
argument-hint: [쿼리 설명]
---

Supabase 쿼리 작성을 도와줍니다.

## 요청

$ARGUMENTS

## 분석 단계

1. 기존 유사한 쿼리 패턴 검색
2. 프로젝트의 Supabase 클라이언트 사용법 확인
3. 관련 타입 정의 확인

## 쿼리 작성 시 포함 사항

- TypeScript 타입 안전성
- 에러 처리 (try-catch 또는 .error 체크)
- RLS 정책 고려
- 적절한 select 필드 지정

## 출력 형식

```typescript
// 쿼리 코드
const { data, error } = await supabase
  .from('테이블')
  .select('...')
  // ...

// 사용 예시
```
