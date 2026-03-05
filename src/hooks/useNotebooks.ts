'use client'

import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Notebook, NotebookPage } from '@/types/notebook'
import { SetlistNoteData } from '@/hooks/useSetlistNotes'

// ===== 변환 유틸 =====

// SetlistNoteData (콘티 필기) → NotebookPage[] 변환
// 콘티에서 노트북으로 복사 시 사용
export function convertSetlistNoteToPages(noteData: SetlistNoteData): NotebookPage[] {
  return Object.entries(noteData)
    .sort(([, a], [, b]) => (a.order ?? 999) - (b.order ?? 999))
    .map(([songId, data], index) => ({
      id: crypto.randomUUID(),
      pageType: 'sheet' as const,
      order: index,
      songId,
      songName: data.song_name,
      teamName: data.team_name,
      fileUrl: data.file_url,
      fileType: data.file_type,
      songForms: data.songForms,
      annotations: data.annotations || [],
      songFormEnabled: data.songFormEnabled ?? false,
      songFormStyle: data.songFormStyle || { x: 50, y: 10, fontSize: 24, color: '#000000', opacity: 1 },
      partTags: data.partTags || [],
      pianoScores: data.pianoScores,
      drumScores: data.drumScores,
    }))
}

// ===== 훅 =====

export function useNotebooks() {
  // 사용자의 노트북 목록 조회 (my-page용)
  const fetchNotebooks = useCallback(async (userId: string): Promise<Notebook[]> => {
    try {
      const { data, error } = await supabase
        .from('notebooks')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('❌ 노트북 목록 조회 실패:', error.message)
        return []
      }

      return (data as Notebook[]) || []
    } catch (err) {
      console.error('❌ 노트북 목록 조회 예외:', err)
      return []
    }
  }, [])

  // 단일 노트북 조회
  const fetchNotebook = useCallback(async (notebookId: string): Promise<Notebook | null> => {
    try {
      const { data, error } = await supabase
        .from('notebooks')
        .select('*')
        .eq('id', notebookId)
        .is('deleted_at', null)
        .maybeSingle()

      if (error) {
        console.error('❌ 노트북 조회 실패:', error.message)
        return null
      }

      return data as Notebook | null
    } catch (err) {
      console.error('❌ 노트북 조회 예외:', err)
      return null
    }
  }, [])

  // 노트북 생성
  const createNotebook = useCallback(async (params: {
    userId: string
    title: string
    pages: NotebookPage[]
    sourceSetlistId?: string
    sourceSetlistTitle?: string
    teamId?: string
  }): Promise<Notebook | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.error('❌ 노트북 생성 실패: 로그인 세션 만료')
        alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.')
        return null
      }

      const { data, error } = await supabase
        .from('notebooks')
        .insert({
          user_id: params.userId,
          title: params.title,
          pages: params.pages,
          source_setlist_id: params.sourceSetlistId ?? null,
          source_setlist_title: params.sourceSetlistTitle ?? null,
          team_id: params.teamId ?? null,
        })
        .select()
        .single()

      if (error) {
        console.error('❌ 노트북 생성 실패:', error.message)
        return null
      }

      console.log(`✅ 노트북 생성 완료: id=${data.id}`)
      return data as Notebook
    } catch (err) {
      console.error('❌ 노트북 생성 예외:', err)
      return null
    }
  }, [])

  // 노트북 pages 전체 업데이트
  const updateNotebook = useCallback(async (
    notebookId: string,
    pages: NotebookPage[]
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('notebooks')
        .update({
          pages,
          updated_at: new Date().toISOString(),
        })
        .eq('id', notebookId)

      if (error) {
        console.error('❌ 노트북 업데이트 실패:', error.message)
        return false
      }

      console.log(`✅ 노트북 업데이트 완료: id=${notebookId}`)
      return true
    } catch (err) {
      console.error('❌ 노트북 업데이트 예외:', err)
      return false
    }
  }, [])

  // 노트북 제목 변경
  const renameNotebook = useCallback(async (
    notebookId: string,
    title: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('notebooks')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', notebookId)

      if (error) {
        console.error('❌ 노트북 이름 변경 실패:', error.message)
        return false
      }

      return true
    } catch (err) {
      console.error('❌ 노트북 이름 변경 예외:', err)
      return false
    }
  }, [])

  // 노트북 soft delete
  const deleteNotebook = useCallback(async (notebookId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('notebooks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', notebookId)

      if (error) {
        console.error('❌ 노트북 삭제 실패:', error.message)
        return false
      }

      console.log(`✅ 노트북 soft delete 완료: id=${notebookId}`)
      return true
    } catch (err) {
      console.error('❌ 노트북 삭제 예외:', err)
      return false
    }
  }, [])

  // 페이지 추가 (위치 지정)
  const addPage = useCallback(async (
    notebookId: string,
    currentPages: NotebookPage[],
    newPage: Omit<NotebookPage, 'id' | 'order'>,
    position: 'before' | 'after' | 'last',
    currentIndex: number
  ): Promise<NotebookPage[] | null> => {
    const page: NotebookPage = {
      ...newPage,
      id: crypto.randomUUID(),
      order: 0, // 아래에서 재계산
    }

    let inserted: NotebookPage[]
    if (position === 'last') {
      inserted = [...currentPages, page]
    } else if (position === 'before') {
      inserted = [
        ...currentPages.slice(0, currentIndex),
        page,
        ...currentPages.slice(currentIndex),
      ]
    } else {
      // 'after'
      inserted = [
        ...currentPages.slice(0, currentIndex + 1),
        page,
        ...currentPages.slice(currentIndex + 1),
      ]
    }

    // order 재계산
    const reordered = inserted.map((p, i) => ({ ...p, order: i }))

    const success = await updateNotebook(notebookId, reordered)
    return success ? reordered : null
  }, [updateNotebook])

  // 여러 페이지 한 번에 추가 (다중 페이지 PDF 펼침 시 사용)
  const addPages = useCallback(async (
    notebookId: string,
    currentPages: NotebookPage[],
    newPages: Omit<NotebookPage, 'id' | 'order'>[],
    position: 'before' | 'after' | 'last',
    currentIndex: number
  ): Promise<NotebookPage[] | null> => {
    const pages: NotebookPage[] = newPages.map(p => ({
      ...p,
      id: crypto.randomUUID(),
      order: 0,
    }))

    let inserted: NotebookPage[]
    if (position === 'last') {
      inserted = [...currentPages, ...pages]
    } else if (position === 'before') {
      inserted = [
        ...currentPages.slice(0, currentIndex),
        ...pages,
        ...currentPages.slice(currentIndex),
      ]
    } else {
      inserted = [
        ...currentPages.slice(0, currentIndex + 1),
        ...pages,
        ...currentPages.slice(currentIndex + 1),
      ]
    }

    const reordered = inserted.map((p, i) => ({ ...p, order: i }))
    const success = await updateNotebook(notebookId, reordered)
    return success ? reordered : null
  }, [updateNotebook])

  // 페이지 삭제 (최소 1페이지 유지)
  const removePage = useCallback(async (
    notebookId: string,
    currentPages: NotebookPage[],
    pageIndex: number
  ): Promise<NotebookPage[] | null> => {
    if (currentPages.length <= 1) {
      console.warn('⚠️ 마지막 페이지는 삭제할 수 없습니다.')
      return null
    }

    const updated = currentPages
      .filter((_, i) => i !== pageIndex)
      .map((p, i) => ({ ...p, order: i }))

    const success = await updateNotebook(notebookId, updated)
    return success ? updated : null
  }, [updateNotebook])

  // 페이지 순서 변경 (드래그앤드롭 후 호출)
  const reorderPages = useCallback(async (
    notebookId: string,
    pages: NotebookPage[]
  ): Promise<boolean> => {
    const reordered = pages.map((p, i) => ({ ...p, order: i }))
    return updateNotebook(notebookId, reordered)
  }, [updateNotebook])

  // source_setlist_id로 기존 노트북 찾기 (콘티 재저장 시 중복 확인)
  const findBySetlistId = useCallback(async (
    userId: string,
    setlistId: string
  ): Promise<Notebook | null> => {
    try {
      const { data, error } = await supabase
        .from('notebooks')
        .select('*')
        .eq('user_id', userId)
        .eq('source_setlist_id', setlistId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('❌ 노트북(setlistId) 조회 실패:', error.message)
        return null
      }

      return data as Notebook | null
    } catch (err) {
      console.error('❌ 노트북(setlistId) 조회 예외:', err)
      return null
    }
  }, [])

  // ===== 파일 업로드 (Phase 4) =====

  // 이미지/PDF를 Supabase Storage에 업로드하고 public URL 반환
  // 경로: notebooks/{sessionUserId}/{notebookId}/{uuid}.{ext}
  // userId 파라미터는 유지하되, 세션 userId와 일치하는지 검증하여 path injection 방지
  const uploadNotebookFile = useCallback(async (
    userId: string,
    notebookId: string,
    file: File
  ): Promise<{ url: string; fileName: string } | null> => {
    // 세션에서 userId 추출 후 파라미터와 일치 여부 검증
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.error('❌ 노트북 파일 업로드 실패: 로그인 세션 만료')
      alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.')
      return null
    }
    if (session.user.id !== userId) {
      console.error('❌ 노트북 파일 업로드 거부: userId 불일치')
      return null
    }

    // MIME 타입 검증
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!ALLOWED_TYPES.includes(file.type)) {
      console.error('❌ 허용되지 않는 파일 형식:', file.type)
      alert('jpg, png, webp 이미지 또는 PDF 파일만 업로드할 수 있습니다.')
      return null
    }

    // 파일 크기 제한 (10MB)
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      console.error('❌ 파일 크기 초과:', file.size)
      alert('파일 크기는 10MB 이하여야 합니다.')
      return null
    }

    // 확장자 추출
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const uuid = crypto.randomUUID()
    const storagePath = `notebooks/${userId}/${notebookId}/${uuid}.${ext}`

    try {
      const { error } = await supabase.storage
        .from('sheetmusic')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
          cacheControl: '3600',
        })

      if (error) {
        console.error('❌ 노트북 파일 업로드 실패:', error.message)
        return null
      }

      const { data: { publicUrl } } = supabase.storage
        .from('sheetmusic')
        .getPublicUrl(storagePath)

      console.log(`✅ 노트북 파일 업로드 완료: ${storagePath}`)
      return { url: publicUrl, fileName: file.name }
    } catch (err) {
      console.error('❌ 노트북 파일 업로드 예외:', err)
      return null
    }
  }, [])

  // upload 타입 페이지 삭제 시 Storage 파일도 제거
  // 세션 userId로 경로 prefix 검증 — 타인 파일 삭제 차단
  const deleteNotebookFile = useCallback(async (fileUrl: string): Promise<boolean> => {
    try {
      // 현재 세션 userId 확인
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.error('❌ 노트북 파일 삭제 실패: 로그인 세션 만료')
        return false
      }
      const userId = session.user.id

      // publicUrl에서 버킷 이후 경로 추출
      // 예: https://xxx.supabase.co/storage/v1/object/public/sheetmusic/notebooks/uid/nid/uuid.jpg
      const marker = '/object/public/sheetmusic/'
      const idx = fileUrl.indexOf(marker)
      if (idx === -1) {
        console.error('❌ Storage URL 파싱 실패:', fileUrl)
        return false
      }
      const storagePath = fileUrl.slice(idx + marker.length)

      // 본인 경로인지 사전 검증 (소유권 확인)
      const expectedPrefix = `notebooks/${userId}/`
      if (!storagePath.startsWith(expectedPrefix)) {
        console.error('❌ 접근 거부: 본인 파일이 아님', storagePath)
        return false
      }

      const { error } = await supabase.storage
        .from('sheetmusic')
        .remove([storagePath])

      if (error) {
        console.error('❌ 노트북 파일 삭제 실패:', error.message)
        return false
      }

      console.log(`✅ 노트북 파일 삭제 완료: ${storagePath}`)
      return true
    } catch (err) {
      console.error('❌ 노트북 파일 삭제 예외:', err)
      return false
    }
  }, [])

  // ===== 콘티 → 노트북 복사 (Phase 2) =====

  // 신규 노트북 생성 — 콘티 저장 후 처음 복사할 때
  const createNotebookFromSetlist = useCallback(async (params: {
    userId: string
    setlistId: string
    setlistTitle: string
    teamId?: string
    noteData: SetlistNoteData
  }): Promise<Notebook | null> => {
    const pages = convertSetlistNoteToPages(params.noteData)
    console.log(`📋 콘티 → 노트북 신규 생성: setlist=${params.setlistId}, 페이지=${pages.length}`)
    return createNotebook({
      userId: params.userId,
      title: params.setlistTitle,
      pages,
      sourceSetlistId: params.setlistId,
      sourceSetlistTitle: params.setlistTitle,
      teamId: params.teamId,
    })
  }, [createNotebook])

  // 기존 노트북 덮어쓰기 — 콘티 재저장 시 사용자가 "업데이트" 선택한 경우
  const overwriteNotebookFromSetlist = useCallback(async (
    notebookId: string,
    noteData: SetlistNoteData
  ): Promise<boolean> => {
    const pages = convertSetlistNoteToPages(noteData)
    console.log(`📋 콘티 → 노트북 덮어쓰기: notebookId=${notebookId}, 페이지=${pages.length}`)
    return updateNotebook(notebookId, pages)
  }, [updateNotebook])

  return {
    fetchNotebooks,
    fetchNotebook,
    createNotebook,
    updateNotebook,
    renameNotebook,
    deleteNotebook,
    addPage,
    addPages,
    removePage,
    reorderPages,
    findBySetlistId,
    createNotebookFromSetlist,
    overwriteNotebookFromSetlist,
    uploadNotebookFile,
    deleteNotebookFile,
  }
}
