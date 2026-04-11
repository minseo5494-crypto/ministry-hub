-- setlist_notes → notebooks 데이터 마이그레이션
-- 목적: 기존 콘티 필기 데이터를 독립 필기노트(notebooks)로 복사
-- 원본 setlist_notes는 그대로 유지 (읽기 전용 참조용)
--
-- 실행 조건:
--   - deleted_at IS NULL인 setlist_notes만 대상
--   - note_data가 빈 경우('{}') → pages: '[]'로 생성 (빈 노트북)
--   - 이미 동일 (user_id, source_setlist_id)의 notebook이 있으면 스킵 (멱등성)
--
-- note_data 구조:
--   { [songId]: { order, song_name, file_url, file_type, team_name,
--                 songForms, annotations, songFormEnabled, songFormStyle,
--                 partTags, pianoScores, drumScores } }
-- → NotebookPage[] 구조로 변환 (pageType: 'sheet')

BEGIN;

INSERT INTO notebooks (
  user_id,
  title,
  source_setlist_id,
  source_setlist_title,
  team_id,
  pages,
  created_at,
  updated_at
)
SELECT
  sn.user_id,
  COALESCE(ts.title, sn.title, '제목 없는 노트')      AS title,
  sn.setlist_id                                        AS source_setlist_id,
  COALESCE(ts.title, sn.title, '제목 없는 콘티')       AS source_setlist_title,
  ts.team_id                                           AS team_id,

  -- note_data JSONB → NotebookPage[] 변환
  -- 빈 note_data('{}')이면 빈 배열('[]') 반환
  CASE
    WHEN sn.note_data IS NULL OR sn.note_data = '{}'::jsonb
    THEN '[]'::jsonb
    ELSE (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',              gen_random_uuid()::text,
          'pageType',        'sheet',
          'order',           COALESCE((entry.value->>'order')::int, 999),
          'songId',          entry.key,
          'songName',        entry.value->>'song_name',
          'teamName',        entry.value->>'team_name',
          'fileUrl',         entry.value->>'file_url',
          'fileType',        entry.value->>'file_type',
          'songForms',       COALESCE(entry.value->'songForms',    '[]'::jsonb),
          'annotations',     COALESCE(entry.value->'annotations',  '[]'::jsonb),
          'songFormEnabled', COALESCE((entry.value->>'songFormEnabled')::boolean, false),
          'songFormStyle',   COALESCE(
                               entry.value->'songFormStyle',
                               '{"x":50,"y":10,"fontSize":24,"color":"#000000","opacity":1}'::jsonb
                             ),
          'partTags',        COALESCE(entry.value->'partTags',     '[]'::jsonb),
          'pianoScores',     entry.value->'pianoScores',
          'drumScores',      entry.value->'drumScores'
        )
        ORDER BY COALESCE((entry.value->>'order')::int, 999)
      )
      FROM jsonb_each(sn.note_data) AS entry(key, value)
    )
  END                                                  AS pages,

  sn.created_at,
  sn.updated_at

FROM setlist_notes sn
LEFT JOIN team_setlists ts ON ts.id = sn.setlist_id

WHERE sn.deleted_at IS NULL

  -- 멱등성: 이미 동일 (user_id, source_setlist_id)로 notebooks가 있으면 건너뜀
  AND NOT EXISTS (
    SELECT 1
    FROM notebooks n
    WHERE n.user_id           = sn.user_id
      AND n.source_setlist_id = sn.setlist_id
      AND n.deleted_at IS NULL
  );

COMMIT;
