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
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
      
      const headers = jsonData[0]
      const rows = jsonData.slice(1)
      
      setMessage(`${rows.length}개의 찬양 데이터를 처리 중...`)
      
      const songs = []
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        setProgress(Math.round((i / rows.length) * 100))
        
        if (!row[0] || !row[1]) continue
        
        const song = {
          id: String(row[0] || ''),
          song_name: String(row[1] || ''),
          team_name: row[2] ? String(row[2]) : null,
          key: row[3] ? String(row[3]) : null,
          bpm: row[4] ? parseInt(String(row[4])) : null,
          time_signature: row[5] ? String(row[5]) : null,
          tempo: row[6] ? String(row[6]) : null,
          lyrics: row[7] ? String(row[7]) : null,
          season: row[8] ? String(row[8]) : null,
          themes: row[9] ? String(row[9]) : null,
          youtube_url: row[10] ? String(row[10]) : null,
          visibility: row[11] ? String(row[11]) : 'public'
        }
        
        songs.push(song)
      }
      
      setMessage(`데이터베이스에 업로드 중...`)
      
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

  // 악보 파일 업로드 처리 - 실시간 DB 조회 방식으로 개선
  const handleSheetMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setUploadStatus('idle')
    setMessage(`${files.length}개의 악보 파일 업로드 중...`)
    
    let uploadCount = 0
    let failedFiles: string[] = []
    
    try {
      // 각 파일 처리
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
          
          const rawId = idMatch[1]
          console.log(`[${i+1}/${files.length}] 파일: ${originalFileName}, 추출된 ID: ${rawId}`)
          
          // ⭐ 핵심 변경: 각 파일마다 실시간으로 DB 조회
          // 3자리든 4자리든 모두 처리 가능하도록 OR 조건 사용
          const { data: songData, error: queryError } = await supabase
            .from('songs')
            .select('id, song_name, file_url')
            .or(`id.eq.${rawId},id.eq.${rawId.padStart(4, '0')}`)
            .limit(1)
            .single()
          
          if (queryError) {
            console.error(`DB 조회 오류 - ID ${rawId}:`, queryError)
            
            // 다시 한 번 시도 (정확한 ID로)
            const paddedId = rawId.padStart(4, '0')
            const { data: retryData, error: retryError } = await supabase
              .from('songs')
              .select('id, song_name, file_url')
              .eq('id', paddedId)
              .single()
            
            if (retryError || !retryData) {
              console.warn(`곡을 찾을 수 없음: ${rawId} (패딩 시도: ${paddedId})`)
              failedFiles.push(`${originalFileName} (ID ${rawId} 없음)`)
              continue
            }
            
            // 재시도 성공
            const targetId = retryData.id
            console.log(`재시도 성공 - ID 변환: ${rawId} → ${targetId}`)
            
            // 파일 업로드 진행
            await uploadFileToStorage(file, targetId, originalFileName)
            uploadCount++
            console.log(`✅ [${uploadCount}] ${originalFileName} → ID: ${targetId}`)
          } else if (songData) {
            // 첫 시도에서 성공
            const targetId = songData.id
            console.log(`DB 조회 성공 - ID: ${targetId}, 곡명: ${songData.song_name}`)
            
            // 파일 업로드 진행
            const uploadSuccess = await uploadFileToStorage(file, targetId, originalFileName)
            if (uploadSuccess) {
              uploadCount++
              console.log(`✅ [${uploadCount}] ${originalFileName} → ID: ${targetId}`)
            } else {
              failedFiles.push(`${originalFileName} (업로드 실패)`)
            }
          } else {
            console.warn(`곡 데이터가 비어있음: ${rawId}`)
            failedFiles.push(`${originalFileName} (데이터 없음)`)
          }
          
        } catch (fileError) {
          console.error(`파일 처리 오류 - ${file.name}:`, fileError)
          failedFiles.push(`${file.name} (처리 오류: ${(fileError as Error).message})`)
        }
      }
      
      // 결과 메시지
      if (uploadCount === files.length) {
        setUploadStatus('success')
        setMessage(`✅ ${uploadCount}개의 악보 파일이 모두 성공적으로 업로드되었습니다!`)
        
        // 로그 기록은 일단 스킵 (타입 오류)
        console.log('Upload success:', { count: uploadCount })
      } else if (uploadCount > 0) {
        setUploadStatus('success')
        const failedList = failedFiles.map((f, idx) => `  ${idx + 1}. ${f}`).join('\n')
        setMessage(`⚠️ 부분 성공\n\n✅ 성공: ${uploadCount}개\n❌ 실패: ${failedFiles.length}개\n\n실패 목록:\n${failedList}`)
      } else {
        setUploadStatus('error')
        const failedList = failedFiles.map((f, idx) => `  ${idx + 1}. ${f}`).join('\n')
        setMessage(`❌ 모든 파일 업로드 실패\n\n실패 목록:\n${failedList}`)
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
  
  // 파일을 Storage에 업로드하고 DB를 업데이트하는 헬퍼 함수
  const uploadFileToStorage = async (
    file: File, 
    songId: string, 
    originalFileName: string
  ): Promise<boolean> => {
    try {
      // 파일 확장자 추출
      const fileExtension = originalFileName.split('.').pop()?.toLowerCase() || 'pdf'
      
      const mimeTypes: { [key: string]: string } = {
        'pdf': 'application/pdf',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png'
      }
      
      const contentType = mimeTypes[fileExtension] || 'application/octet-stream'
      
      // 안전한 파일명 생성 (특수문자 제거)
      const cleanFileName = originalFileName.replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
      const safeFileName = `${songId}/${cleanFileName}`
      
      console.log(`Storage 업로드 시작: ${safeFileName}`)
      
      // Storage에 업로드
      const { error: uploadError } = await supabase.storage
        .from('sheetmusic')
        .upload(safeFileName, file, {
          contentType: contentType,
          upsert: true,  // 기존 파일 덮어쓰기
          cacheControl: '3600'
        })
      
      if (uploadError) {
        console.error(`Storage 업로드 실패 - ${originalFileName}:`, uploadError)
        return false
      }
      
      // 공개 URL 생성
      const { data: { publicUrl } } = supabase.storage
        .from('sheetmusic')
        .getPublicUrl(safeFileName)
      
      console.log(`생성된 URL: ${publicUrl}`)
      
      // DB 업데이트
      const { error: updateError } = await supabase
        .from('songs')
        .update({
          file_url: publicUrl,
          file_type: fileExtension,
          uploaded_at: new Date().toISOString()
        })
        .eq('id', songId)
      
      if (updateError) {
        console.error(`DB 업데이트 실패 - ${songId}:`, updateError)
        // 실패 시 Storage에서 파일 삭제
        await supabase.storage.from('sheetmusic').remove([safeFileName])
        return false
      }
      
      return true
    } catch (error) {
      console.error(`파일 업로드 처리 오류:`, error)
      return false
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

  // Storage → DB 동기화 개선
  const syncStorageToDatabase = async () => {
    try {
      setUploading(true)
      setMessage('Storage 파일 목록을 가져오는 중...')

      const { data: folders, error: listError } = await supabase.storage
        .from('sheetmusic')
        .list('', {
          limit: 10000,
          offset: 0,
        })

      if (listError) throw listError

      setMessage(`${folders?.length || 0}개의 폴더를 찾았습니다. 처리 중...`)

      let updateCount = 0
      let skipCount = 0
      let processedCount = 0

      for (const folder of folders || []) {
        if (!folder.name || folder.name === '.emptyFolderPlaceholder') continue

        processedCount++
        setProgress(Math.round((processedCount / folders.length) * 100))
        
        const songId = folder.name

        // 해당 곡 정보 가져오기
        const { data: songData, error: songError } = await supabase
          .from('songs')
          .select('id, song_name')
          .eq('id', songId)
          .single()

        if (songError || !songData) {
          console.log(`곡 정보 없음: ${songId}`)
          skipCount++
          continue
        }

        // Storage에서 파일 목록 가져오기
        const { data: files, error: filesError } = await supabase.storage
          .from('sheetmusic')
          .list(songId)

        if (filesError || !files || files.length === 0) {
          console.log(`파일 없음: ${songId}`)
          skipCount++
          continue
        }

        // 첫 번째 파일 사용 (보통 하나만 있음)
        const actualFile = files[0]
        
        // Public URL 생성
        const { data: { publicUrl } } = supabase.storage
          .from('sheetmusic')
          .getPublicUrl(`${songId}/${actualFile.name}`)

        // DB 업데이트
        const { error: updateError } = await supabase
          .from('songs')
          .update({
            file_url: publicUrl,
            file_type: actualFile.name.split('.').pop(),
            uploaded_at: new Date().toISOString()
          })
          .eq('id', songId)

        if (!updateError) {
          updateCount++
          console.log(`✅ ${songId}: ${actualFile.name}`)
        } else {
          console.error(`업데이트 실패 ${songId}:`, updateError)
          skipCount++
        }

        setMessage(`처리 중... (${updateCount}개 완료, ${skipCount}개 스킵)`)
      }

      setUploadStatus('success')
      setMessage(`✅ 동기화 완료!\n\n성공: ${updateCount}개\n스킵: ${skipCount}개`)

    } catch (error) {
      console.error('Sync error:', error)
      setUploadStatus('error')
      setMessage('❌ 동기화 중 오류: ' + (error as Error).message)
    } finally {
      setUploading(false)
      setProgress(0)
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
              disabled={uploading}
            >
              Storage 연결 테스트
            </button>
            
            <button
              onClick={testDBConnection}
              className="px-4 py-2 bg-[#C4BEE2] text-white rounded hover:bg-[#C4BEE2] text-sm"
              disabled={uploading}
            >
              DB 연결 테스트
            </button>
            
            <button
              onClick={checkTableSchema}
              className="px-4 py-2 bg-[#C4BEE2] text-white rounded hover:bg-[#A9A1D1] text-sm"
              disabled={uploading}
            >
              테이블 구조 확인
            </button>

            <button
              onClick={syncStorageToDatabase}
              className="px-4 py-2 bg-[#E26559] text-white rounded hover:bg-[#D14E42] text-sm font-bold"
              disabled={uploading}
            >
              🔄 Storage → DB 일괄 동기화
            </button>
          </div>
        </div>

        {/* 엑셀 업로드 섹션 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <FileSpreadsheet className="mr-2" />
            엑셀 데이터 업로드 (CSV)
          </h2>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
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
                  : 'bg-[#C5D7F2] hover:bg-[#A8C4E8] cursor-pointer'
              } text-white rounded-lg transition`}
            >
              {uploading ? '업로드 중...' : '엑셀/CSV 파일 선택'}
            </label>
            
            <p className="mt-4 text-sm text-gray-600">
              .xlsx, .xls, .csv 파일 가능
            </p>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800 font-medium mb-2">📌 CSV 파일 형식:</p>
            <p className="text-xs text-blue-700">
              id | song_name | team_name | key | bpm | time_signature | tempo | lyrics | season | themes | youtube_url | visibility
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
                  : 'bg-[#84B9C0] hover:bg-[#6FA5AC] cursor-pointer'
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
              <p className="font-semibold">예시:</p>
              <ul className="ml-4 space-y-1">
                <li>✅ 3454_성령이여_내_영혼을.png</li>
                <li>✅ 0001_만복의_근원.jpg</li>
                <li>✅ 123_찬양제목.pdf</li>
                <li>❌ 찬양제목.pdf (숫자 없음)</li>
              </ul>
            </div>
            
            <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
              <p className="text-xs text-yellow-800 font-semibold">
                ⚠️ 중요: CSV 업로드 후 악보를 업로드하세요!
              </p>
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
                className="bg-[#C5D7F2] h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* 상태 메시지 */}
        {message && (
          <div className={`mt-6 p-4 rounded-lg flex items-start ${
            uploadStatus === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
            uploadStatus === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
            'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            <div className="mr-2 mt-0.5">
              {uploadStatus === 'success' && <CheckCircle className="w-5 h-5" />}
              {uploadStatus === 'error' && <AlertCircle className="w-5 h-5" />}
            </div>
            <span className="whitespace-pre-line text-sm">{message}</span>
          </div>
        )}
      </div>
    </div>
  )
}