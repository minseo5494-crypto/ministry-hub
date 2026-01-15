---
description: iOS Safari 호환성 문제 검사
allowed-tools: Read, Grep, Glob
---

변경된 파일들의 iOS Safari 호환성을 검사합니다.

## 체크 항목

1. **appearance 속성**
   - 체크박스/라디오에 `appearance: none` 적용되지 않았는지
   - `appearance: checkbox` 또는 기본값 유지 확인

2. **폰트 크기**
   - input/textarea의 font-size가 16px 이상인지
   - 자동 줌 방지를 위해 필수

3. **터치 영역**
   - 버튼의 최소 높이가 44px 이상인지
   - touch-action: manipulation 적용 여부

4. **터치 피드백**
   - -webkit-tap-highlight-color 설정
   - active 상태 스타일 확인

5. **이미지**
   - max-width: 100% 설정
   - -webkit-transform: translateZ(0) 적용

## 문제 발견 시

각 문제에 대해:
- 파일 경로와 라인 번호
- 문제 설명
- 수정 방안 제시
