---
description: Vercel 배포 전 빌드 테스트 및 에러 수정
allowed-tools: Bash(npm:*), Read, Edit, Grep
---

배포 전 빌드 테스트를 실행합니다.

## 실행 단계

1. `npm run build` 실행
2. 타입 에러나 빌드 에러 발생 시 원인 분석
3. 에러 수정 후 다시 빌드
4. 성공할 때까지 반복
5. 최종 결과 보고

## 주의사항

- iOS Safari 호환성 유지
- 타입 안전성 확보
- 기존 기능에 영향 없도록 수정
