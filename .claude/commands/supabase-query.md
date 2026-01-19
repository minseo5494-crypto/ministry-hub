---
description: Supabase 쿼리 작성 도우미
allowed-tools: Read, Grep, Glob, mcp__supabase__execute_sql, mcp__supabase__list_tables, mcp__supabase__search_docs, mcp__supabase__generate_typescript_types
argument-hint: [쿼리 설명]
---

Supabase 쿼리 작성을 도와줍니다. MCP를 통해 실제 DB 스키마를 확인하고 쿼리를 테스트할 수 있습니다.

## Supabase 프로젝트

- **Project ID**: `uoneiotepfmikprknxhk`
- **Name**: ministry-hub

## 요청

$ARGUMENTS

## 분석 단계

### 1. 스키마 확인
`mcp__supabase__list_tables`로 관련 테이블 확인

### 2. 테이블 구조 상세 조회
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = '테이블명';
```

### 3. 문서 검색 (필요시)
`mcp__supabase__search_docs`로 Supabase 공식 문서에서 관련 정보 검색

### 4. 쿼리 테스트 (SELECT만)
`mcp__supabase__execute_sql`로 SELECT 쿼리 테스트 가능
**주의**: INSERT/UPDATE/DELETE는 사용자 확인 후에만 실행

## 쿼리 작성 시 포함 사항

- TypeScript 타입 안전성
- 에러 처리 (try-catch 또는 .error 체크)
- RLS 정책 고려
- 적절한 select 필드 지정

## 출력 형식

```typescript
// 테이블 스키마 (실제 DB에서 확인)
// columns: id, title, created_at, ...

// Supabase 클라이언트 쿼리
const { data, error } = await supabase
  .from('테이블')
  .select('...')
  // ...

if (error) {
  console.error('쿼리 에러:', error)
  return
}

// 사용 예시
```

## 자주 사용하는 패턴

### 페이지네이션
```typescript
.range(offset, offset + limit - 1)
```

### 관계 조회
```typescript
.select('*, related_table(*)')
```

### 필터링
```typescript
.eq('column', value)
.ilike('column', `%${search}%`)
```
