---
description: 로컬 개발 서버(3000) 재실행
allowed-tools: Bash(lsof:*), Bash(kill:*), Bash(npm run dev:*)
---

로컬 개발 서버를 재실행합니다.

## 실행 단계

1. 포트 3000에서 실행 중인 프로세스 종료
2. `npm run dev` 백그라운드 실행
3. 서버 시작 확인 후 결과 보고

## 명령어

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null
npm run dev
```

## 참고

- 서버는 백그라운드에서 실행됩니다
- http://localhost:3000 에서 접속 가능
