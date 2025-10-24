'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react'

export default function UploadPage() {
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState(0)

  // 엑셀 파일 처리
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadStatus('idle')
    setMessage('엑셀 파일을 읽는 중...')
    
    try {
      // 파일 읽기
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
      
      // 첫 번째 행은 헤더이므로 제외
      const headers = jsonData[0]
      const rows = jsonData.slice(1)
      
      setMessage(`${rows.length}개의 찬양 데이터를 처리 중...`)
      
      // 데이터 변환 및 업로드
      const songs = []
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        
        // 진행률 표시
        setProgress(Math.round((i / rows.length) * 100))
        
        // 빈 행 건너뛰기
        if (!row[0] || !row[1]) continue
        
        const song = {
          id: String(row[0] || ''),
          song_name: String(row[1] || ''),
          team_name: row[2] ? String(row[2]) : null,
          theme1: row[3] ? String(row[3]) : null,
          theme2: row[4] ? String(row[4]) : null,
          key: row[5] ? String(row[5]) : null,
          bpm: row[6] ? parseInt(String(row[6])) : null,
          time_signature: row[7] ? String(row[7]) : null,
          tempo: row[8] ? String(row[8]) : null,
          style: row[9] ? String(row[9]) : null,
          highest_note: row[10] ? String(row[10]) : null,
          lowest_note: row[11] ? String(row[11]) : null,
          lyrics: row[12] ? String(row[12]) : null
        }
        
        songs.push(song)
      }
      
      setMessage(`데이터베이스에 업로드 중...`)
      
      // Supabase에 배치로 업로드 (upsert 사용 - 중복 ID는 업데이트)
      const { error } = await supabase
        .from('songs')
        .upsert(songs, { onConflict: 'id' })
      
      if (error) throw error
      
      setUploadStatus('success')
      setMessage(`✅ ${songs.length}개의 찬양 데이터가 성공적으로 업로드되었습니다!`)
    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus('error')
      setMessage('❌ 업로드 중 오류가 발생했습니다: ' + (error as Error).message)
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  // 악보 파일 업로드 처리 - 개선된 버전
   const handleSheetMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
   const files = e.target.files
   if (!files || files.length === 0) return

   setUploading(true)
   setUploadStatus('idle')
    setMessage(`${files.length}개의 악보 파일 업로드 중...`)
  
   try {
     // 1단계: 모든 곡 정보를 한 번에 가져오기
      setMessage('데이터베이스에서 곡 목록 로딩 중...')
      const { data: allSongs, error: fetchError } = await supabase
        .from('songs')
        .select('id, file_url')
    
      if (fetchError) throw fetchError
    
     // ID를 키로 하는 Map 생성 (빠른 조회)
     const songMap = new Map()
     allSongs?.forEach(song => {
        songMap.set(song.id, song)
      })
    
      console.log(`총 ${songMap.size}개의 곡 정보 로딩 완료`)
    
      let uploadCount = 0
      let failedFiles: string[] = []
    
     // 2단계: 각 파일 처리
     for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setProgress(Math.round(((i + 1) / files.length) * 100))
        setMessage(`업로드 중... (${i + 1}/${files.length})`)
      
        try {
          const originalFileName = file.name
         const idMatch = originalFileName.match(/^(\d{3,4})/)

         if (!idMatch) {
            console.warn(`파일명에서 ID를 찾을 수 없음: ${originalFileName}`)
            failedFiles.push(`${originalFileName} (ID 형식 오류)`)
            continue
         }

          let songId = idMatch[1]
          console.log(`[${i+1}/${files.length}] 파일: ${originalFileName}, ID: ${songId}`)
        
          // Map에서 곡 찾기 (빠름!)
          let existingSong = songMap.get(songId)
         let targetId = songId
        
          // 못 찾으면 0으로 패딩해서 재시도
          if (!existingSong) {
            const paddedId = songId.padStart(4, '0')
            existingSong = songMap.get(paddedId)
            if (existingSong) {
              targetId = paddedId
             console.log(`ID 변환: ${songId} → ${paddedId}`)
           }
          }
        
         if (!existingSong) {
           console.warn(`곡을 찾을 수 없음: ${songId}`)
           failedFiles.push(`${originalFileName} (ID ${songId} 없음)`)
           continue
          }
        
        // 파일 확장자 추출
          const fileExtension = originalFileName.split('.').pop()?.toLowerCase() || 'pdf'
        
         const mimeTypes: { [key: string]: string } = {
           'pdf': 'application/pdf',
           'jpg': 'image/jpeg',
           'jpeg': 'image/jpeg',
           'png': 'image/png'
          }
        
          const contentType = mimeTypes[fileExtension] || 'application/octet-stream'
        
         // 안전한 파일명 생성
         const timestamp = Date.now()
         const cleanFileName = originalFileName.replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
          const safeFileName = `${targetId}/${timestamp}_${cleanFileName}`
        
         // Storage에 업로드
          const { error: uploadError } = await supabase.storage
           .from('sheetmusic')
           .upload(safeFileName, file, {
             contentType: contentType,
             upsert: true,
             cacheControl: '3600'
            })
        
         if (uploadError) {
           console.error(`Storage 업로드 실패 - ${originalFileName}:`, uploadError)
           failedFiles.push(`${originalFileName} (업로드 실패)`)
           continue
         }
        
         // 공개 URL 생성
         const { data: { publicUrl } } = supabase.storage
           .from('sheetmusic')
           .getPublicUrl(safeFileName)
        
         // DB 업데이트
          const { error: updateError } = await supabase
           .from('songs')
           .update({
             file_url: publicUrl,
             file_type: fileExtension,
             uploaded_at: new Date().toISOString()
           })
           .eq('id', targetId)
          
         if (updateError) {
           console.error(`DB 업데이트 실패 - ${targetId}:`, updateError)
           await supabase.storage.from('sheetmusic').remove([safeFileName])
           failedFiles.push(`${originalFileName} (DB 업데이트 실패)`)
         } else {
           uploadCount++
           console.log(`✅ [${uploadCount}] ${originalFileName} → ID: ${targetId}`)
         }

       } catch (fileError) {
         console.error(`파일 처리 오류 - ${file.name}:`, fileError)
         failedFiles.push(`${file.name} (처리 오류)`)
       }
     }

     // 결과 메시지
     if (uploadCount === files.length) {
       setUploadStatus('success')
       setMessage(`✅ ${uploadCount}개의 악보 파일이 모두 성공적으로 업로드되었습니다!`)
      } else if (uploadCount > 0) {
        setUploadStatus('success')
        setMessage(`⚠️ ${uploadCount}개 성공, ${failedFiles.length}개 실패\n\n실패 목록:\n${failedFiles.join('\n')}`)
      } else {
       setUploadStatus('error')
       setMessage(`❌ 모든 파일 업로드 실패\n\n실패 목록:\n${failedFiles.join('\n')}`)
     }

   } catch (error) {
     console.error('Upload error:', error)
     setUploadStatus('error')
      setMessage(`❌ 업로드 중 오류: ${(error as Error).message}`)
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  // Storage 연결 테스트
  const testStorageConnection = async () => {
    const testFileName = 'test_' + Date.now() + '.txt'
    const testContent = new Blob(['Hello World'], { type: 'text/plain' })
    
    try {
      const { data, error } = await supabase.storage
        .from('sheetmusic')
        .upload(testFileName, testContent)
      
      if (error) {
        console.error('테스트 업로드 실패:', error)
        alert('Storage 연결 실패: ' + error.message)
      } else {
        console.log('테스트 업로드 성공:', data)
        alert('Storage 연결 성공!')
        
        // 테스트 파일 삭제
        await supabase.storage.from('sheetmusic').remove([testFileName])
      }
    } catch (err) {
      console.error('테스트 오류:', err)
      alert('오류 발생: ' + (err as Error).message)
    }
  }

  // DB 연결 테스트
  const testDBConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .limit(1)
      
      if (error) {
        console.error('DB 테스트 실패:', error)
        alert('데이터베이스 연결 실패: ' + JSON.stringify(error))
      } else {
        console.log('DB 테스트 성공:', data)
        alert('데이터베이스 연결 성공!')
      }
    } catch (err) {
      console.error('테스트 오류:', err)
      alert('오류: ' + (err as Error).message)
    }
  }

  // Storage의 모든 파일을 스캔해서 DB 업데이트
  const syncStorageToDatabase = async () => {
    try {
      setUploading(true)
      setMessage('Storage 파일 목록을 가져오는 중...')
      
      // 1. Storage에서 모든 파일 목록 가져오기
      const { data: files, error: listError } = await supabase.storage
        .from('sheetmusic')
        .list('', {
          limit: 10000,
          offset: 0,
        })
      
      if (listError) throw listError
      
      setMessage(`${files.length}개의 폴더를 찾았습니다. 각 폴더의 파일을 확인 중...`)
      
      let updateCount = 0
      
      // 2. 각 폴더(ID)마다 파일 확인
      for (const folder of files) {
        if (!folder.name || folder.name === '.emptyFolderPlaceholder') continue
        
        const songId = folder.name
        
        // 폴더 내부의 파일들 가져오기
        const { data: folderFiles, error: folderError } = await supabase.storage
          .from('sheetmusic')
          .list(songId, {
            limit: 100,
            offset: 0,
          })
        
        if (folderError || !folderFiles || folderFiles.length === 0) continue
        
        // 첫 번째 파일 사용 (보통 1개만 있음)
        const firstFile = folderFiles[0]
        const filePath = `${songId}/${firstFile.name}`
        
        // 공개 URL 생성
        const { data: { publicUrl } } = supabase.storage
          .from('sheetmusic')
          .getPublicUrl(filePath)
        
        // 파일 확장자 추출
        const fileExtension = firstFile.name.split('.').pop()?.toLowerCase() || 'pdf'
        
        // DB 업데이트
        const { error: updateError } = await supabase
          .from('songs')
          .update({
            file_url: publicUrl,
            file_type: fileExtension,
            uploaded_at: new Date().toISOString()
          })
          .eq('id', songId)
        
        if (!updateError) {
          updateCount++
          console.log(`✅ [${updateCount}] ID: ${songId} → ${publicUrl}`)
        } else {
          console.error(`❌ ID: ${songId} 업데이트 실패:`, updateError)
        }
        
        setMessage(`처리 중... (${updateCount}개 완료)`)
      }
      
      setUploadStatus('success')
      setMessage(`✅ 총 ${updateCount}개의 곡 정보가 업데이트되었습니다!`)
      
    } catch (error) {
      console.error('Sync error:', error)
      setUploadStatus('error')
      setMessage('❌ 동기화 중 오류: ' + (error as Error).message)
    } finally {
      setUploading(false)
    }
  }

  // 테이블 구조 확인
  const checkTableSchema = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .limit(1)
      
      if (error) {
        console.error('테이블 조회 실패:', error)
        alert('테이블 조회 실패: ' + JSON.stringify(error))
      } else {
        console.log('테이블 구조 (샘플):', data)
        if (data && data.length > 0) {
          console.log('테이블 컬럼들:', Object.keys(data[0]))
        }
        alert('콘솔에서 테이블 구조를 확인하세요')
      }
    } catch (err) {
      console.error('스키마 확인 오류:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            <Upload className="inline-block mr-2 mb-1" />
            데이터 업로드
          </h1>
          <p className="text-gray-600">엑셀 파일과 악보 파일을 업로드하세요</p>
          
          {/* 테스트 버튼들 */}
          <div className="flex gap-2 mt-4 flex-wrap">
            <button
              onClick={testStorageConnection}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
            >
              Storage 연결 테스트
            </button>
            
            <button
              onClick={testDBConnection}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
            >
              DB 연결 테스트
            </button>
            
            <button
              onClick={checkTableSchema}
              className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
            >
              테이블 구조 확인
            </button>

            <button
              onClick={syncStorageToDatabase}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-bold"
            >
              🔄 Storage → DB 일괄 동기화
            </button>
          </div>
        </div>

        {/* 엑셀 업로드 섹션 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <FileSpreadsheet className="mr-2" />
            엑셀 데이터 업로드
          </h2>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              disabled={uploading}
              className="hidden"
              id="excel-upload"
            />
            <label
              htmlFor="excel-upload"
              className={`inline-block px-6 py-3 ${
                uploading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-500 hover:bg-blue-600 cursor-pointer'
              } text-white rounded-lg transition`}
            >
              {uploading ? '업로드 중...' : '엑셀 파일 선택'}
            </label>
            
            <p className="mt-4 text-sm text-gray-600">
              .xlsx 또는 .xls 파일만 가능합니다
            </p>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800 font-medium mb-2">📌 엑셀 파일 형식:</p>
            <p className="text-xs text-blue-700">
              ID | 곡명 | 팀명 | 주제1 | 주제2 | 키 | BPM | 박자 | 템포 | 스타일 | 최고음 | 최저음 | 가사
            </p>
          </div>
        </div>

        {/* 악보 파일 업로드 섹션 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <FileSpreadsheet className="mr-2" />
            악보 파일 업로드
          </h2>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".pdf,application/pdf,.jpg,.jpeg,.png,image/*"
              multiple
              onChange={handleSheetMusicUpload}
              disabled={uploading}
              className="hidden"
              id="sheet-upload"
            />
            <label
              htmlFor="sheet-upload"
              className={`inline-block px-6 py-3 ${
                uploading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-500 hover:bg-green-600 cursor-pointer'
              } text-white rounded-lg transition`}
            >
              {uploading ? '업로드 중...' : '악보 파일 선택 (여러 개 가능)'}
            </label>
            
            <p className="mt-4 text-sm text-gray-600">
              PDF, JPG, PNG 파일 가능 (여러 개 동시 선택 가능)
            </p>
          </div>

          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800 font-medium mb-2">📌 파일명 형식:</p>
            <div className="text-xs text-green-700 space-y-1">
              <p>파일명이 3-4자리 숫자로 시작해야 합니다</p>
              <p className="font-semibold">지원되는 형식:</p>
              <ul className="ml-4 space-y-1">
                <li>• 0655_주를바라보며.pdf ✅</li>
                <li>• 1234_찬양제목.pdf ✅</li>
                <li>• 001_찬송가.pdf ✅</li>
                <li>• 123-01_부제목.pdf ✅</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 진행 상태 표시 */}
        {uploading && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-2 flex justify-between text-sm text-gray-600">
              <span>업로드 진행중...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* 상태 메시지 */}
        {message && (
          <div className={`mt-6 p-4 rounded-lg flex items-start ${
            uploadStatus === 'success' ? 'bg-green-50 text-green-800' :
            uploadStatus === 'error' ? 'bg-red-50 text-red-800' :
            'bg-blue-50 text-blue-800'
          }`}>
            <div className="mr-2 mt-0.5">
              {uploadStatus === 'success' && <CheckCircle />}
              {uploadStatus === 'error' && <AlertCircle />}
            </div>
            <span className="whitespace-pre-line">{message}</span>
          </div>
        )}
      </div>
    </div>
  )
}