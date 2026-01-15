---
description: Supabase 테이블 스키마 및 타입 정의 확인
allowed-tools: Read, Grep, Glob
---

현재 데이터베이스 스키마를 분석합니다.

## 분석 대상

1. `src/types/` 폴더의 타입 정의
2. Supabase 관련 코드에서 테이블 구조
3. 마이그레이션 파일 (있는 경우)

## 출력 형식

테이블별로 다음 정보를 마크다운 테이블로 정리:
- 테이블명
- 주요 컬럼
- 관계 (FK)
- 용도 설명
