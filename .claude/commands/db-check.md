---
description: Supabase 테이블 스키마 및 타입 정의 확인
allowed-tools: Read, Grep, Glob, mcp__supabase__list_tables, mcp__supabase__execute_sql, mcp__supabase__generate_typescript_types, mcp__supabase__get_advisors
---

현재 Supabase 데이터베이스 스키마를 직접 조회하여 분석합니다.

## Supabase 프로젝트

- **Project ID**: `uoneiotepfmikprknxhk`
- **Name**: ministry-hub

## 분석 단계

### 1. 테이블 목록 조회
`mcp__supabase__list_tables`를 사용하여 public 스키마의 테이블 목록 조회

### 2. 테이블 상세 스키마 조회
`mcp__supabase__execute_sql`로 다음 쿼리 실행:
```sql
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

### 3. 외래키 관계 조회
```sql
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

### 4. RLS 정책 확인
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies WHERE schemaname = 'public';
```

### 5. TypeScript 타입 생성
`mcp__supabase__generate_typescript_types`로 최신 타입 생성

### 6. 보안 점검
`mcp__supabase__get_advisors`로 보안 취약점 확인

## 출력 형식

테이블별로 다음 정보를 마크다운 테이블로 정리:
- 테이블명
- 주요 컬럼 (타입 포함)
- 관계 (FK)
- RLS 정책 유무
- 용도 설명
