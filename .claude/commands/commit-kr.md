---
description: 변경사항 분석 후 한국어 커밋 메시지 생성 및 커밋
allowed-tools: Bash(git:*)
---

현재 변경사항을 분석하고 한국어 커밋 메시지를 생성합니다.

## 실행 단계

1. `git status`로 변경 파일 확인
2. `git diff`로 변경 내용 분석
3. 변경 유형 파악
4. 한국어 커밋 메시지 작성
5. 사용자 확인 후 커밋 실행

## 커밋 메시지 형식

```
<type>: <한국어 설명>

- 상세 변경 내용 1
- 상세 변경 내용 2

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

## 타입 종류

- `feat`: 새 기능 추가
- `fix`: 버그 수정
- `style`: UI/스타일 변경 (기능 변경 없음)
- `refactor`: 코드 리팩토링
- `docs`: 문서 수정
- `chore`: 기타 작업 (빌드, 설정 등)
- `perf`: 성능 개선
