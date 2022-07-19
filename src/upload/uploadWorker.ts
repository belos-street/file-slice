import { FileAccept, FileSlice } from './type'
import SparkMD5 from 'spark-md5'

const MAX_CHUNK_NUM = 100

/**
 * chunkNum : 切片数量
 * CHUNK_SIZE : 切片大小
 * currentChunk : 当前切片指针
 * fileHash : 文件的哈希值
 * fileSliceArr : 存储切片的数组
 */
self.onmessage = (info) => {
  let { file, CHUNK_SIZE } = info.data as FileSlice
  let blobSlice = File.prototype.slice,
    chunkNum = 0,
    currentChunk = 0,
    spark = new SparkMD5.ArrayBuffer(), //追加数组缓冲区
    fileReader = new FileReader(),
    fileSliceArr: Blob[] = []

  if (file.size > Math.pow(1024, 3)) {
    chunkNum = MAX_CHUNK_NUM
    CHUNK_SIZE = Math.ceil(file.size / MAX_CHUNK_NUM)
  } else {
    chunkNum = Math.ceil(file.size / CHUNK_SIZE)
  }

  function loadNext() {
    let start = currentChunk * CHUNK_SIZE,
      end = start + CHUNK_SIZE >= file.size ? file.size : start + CHUNK_SIZE
    let chunk = blobSlice.call(file, start, end)
    fileSliceArr.push(chunk)
    fileReader.readAsArrayBuffer(chunk)
  }

  fileReader.onload = function (e: ProgressEvent<FileReader>) {
    if (!e.target) return
    const chunk = e.target.result
    spark.append(chunk as ArrayBuffer)
    currentChunk++
    if (currentChunk < chunkNum) {
      loadNext()
    } else {
      let fileHash = spark.end()
      self.postMessage(packFileData(fileHash, fileSliceArr))
    }
  }

  fileReader.onerror = function () {
    console.warn('oops, something went wrong.')
  }

  const packFileData = (hash: string, fileSliceArr: Blob[]): FileAccept[] => {
    let arr: FileAccept[] = []
    let chunk_number = fileSliceArr.length.toString(),
      name = file.name as string
    fileSliceArr.map((item, index) => arr.push({ file_chunk: item, chunk_index: index.toString(), chunk_number, file_hash: hash, name }))
    return arr
  }

  loadNext()
}
