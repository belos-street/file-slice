export interface FileItem {
  uid: string
  name?: string
  status?: string
  response?: string
  url?: string
  size: number
  originFileObj: any
  type: string
}

export interface FileInfo {
  file: FileItem
  fileList: FileItem[]
}

export interface FileSlice {
  file: FileItem
  CHUNK_SIZE: number
}

export interface FileAccept {
  file_chunk: Blob
  chunk_index: string
  chunk_number: string
  file_hash: string
  name: string
}
