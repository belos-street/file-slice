<script setup lang="ts">
import { InboxOutlined } from '@ant-design/icons-vue'
import { notification } from 'ant-design-vue'
import { ref } from 'vue'
import { FileInfo, FileItem, FileAccept } from './upload/type'
import axios from 'axios'

import worker from './upload/uploadWorker?worker'
import { obj2FormData } from './upload/obj2FormData'

const uploadWorker = new worker()
const fileList = ref<FileItem[]>([]) //文件选择组件的数据
const percent = ref<number>(0)
const modalShow = ref<boolean>(false)
const CHUNK_SIZE = 1 * 1024 * 1024 * 10 //切片大小 10m
const EXISTS = 'EXISTS' //文件已存在且合并成功
const POST_UPLOAD_NUM = 6 //并发请求最大数
let uploadChunkList: string[] = [] //已经上传成功的切片
let queueIndex = POST_UPLOAD_NUM //当前切片上传请求数的指针
let fileAcceptArr: FileAccept[] = [] //文件切片数组

const handleChange = (info: FileInfo) => {
  if (info.fileList.length >= 2) fileList.value = [info.fileList.pop() as FileItem]
}

const beforeUpload = () => false
const getArrLength2Str = (arr: string[]): string => [...new Set(arr)].length.toString()

const handleClickSubmit = () => {
  if (fileList.value.length !== 1) return
  uploadChunkList.length = 0
  percent.value = 0
  modalShow.value = true
  fileAcceptArr = []
  queueIndex = POST_UPLOAD_NUM
  uploadWorker.postMessage({ file: fileList.value[0].originFileObj, CHUNK_SIZE })
}

/**
 * 接受webworker传过来的文件切片
 * 获取已上传的切片 httpGetUploadChunks
 */
uploadWorker.onmessage = async ({ data }) => {
  fileAcceptArr = data as FileAccept[]
  if (fileAcceptArr.length === 0) return
  let fileAcceptFrist = fileAcceptArr[0]
  let msg = (await httpGetUploadChunks(fileAcceptFrist.file_hash, fileAcceptFrist.name)) as string | string[]
  if (msg === EXISTS) return uploadSuccess() //uc_1
  if (!Array.isArray(msg)) return
  if (getArrLength2Str(msg) === fileAcceptFrist.chunk_number) return httpGetChunkMerge(fileAcceptFrist) //uc_2
  uploadChunkList = msg //uc_3 uc_4
  fileAcceptArr.slice(0, POST_UPLOAD_NUM).map((item) => httpPostAcceptFileChunk(item)) //并发控制 一开始上传前六个切片
}

/**
 * 获取已上传的切片
 * 四种种情况
 *  uc_1.全部已经上传完成 EXISTS xxx.zip
 *  uc_2.上传过全部切片 msg = ['0', '1', '2', '3' ... , '99']  通知后端合并切片
 *  uc_4.上传过一部分的切片 msg = ['0', '1', '2', '3' ...]
 *  uc_4.新文件，从未上传过 msg = []
 */
const httpGetUploadChunks = async (file_hash: string, name: string) => {
  let result = (await axios.get('api/get_chunks_info/', { params: { file_hash, name } })) as any
  return new Promise((resolve) => {
    resolve(result.data.msg)
  })
}

/**
 * httpPostAcceptFileChunk 上传切片
 *  uploadChunkList.includes(chunk_index)  已上传的切片跳过
 */
const httpPostAcceptFileChunk = (fileAccept: FileAccept) => {
  const { chunk_index, chunk_number } = fileAccept
  if (uploadChunkList.includes(chunk_index)) return setNextFileAccept(fileAccept) //也得更新队列
  axios({
    method: 'post',
    url: 'api/accept_file_chunk/',
    data: obj2FormData(fileAccept),
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 2 * 60 * 1000 //2分钟超时
  })
    .then((res) => {
      uploadChunkList.push(res.data.msg)
      percent.value = parseInt(((uploadChunkList.length / parseInt(chunk_number)) * 100).toFixed(2))
    })
    .finally(() => {
      setNextFileAccept(fileAccept)
    })
}

/**
 * 并发控制 执行成功/失败一个切片后在请求下一个
 * queueIndex - POST_UPLOAD_NUM === fileAcceptArr.length - 1  说明执行到了最后一个切片
 *   getArrLength2Str(uploadChunkList) === fileAccept.chunk_number
 *    *true  说明全部切片都上传成功 请求合并切片
 *    *false 说明有未上传成功的切片 需要提示用户继续上传
 */
const setNextFileAccept = (fileAccept: FileAccept) => {
  if (queueIndex - POST_UPLOAD_NUM === fileAcceptArr.length - 1)
    return getArrLength2Str(uploadChunkList) === fileAccept.chunk_number ? httpGetChunkMerge(fileAccept) : handleUploadFail()
  const nextFileAccept = fileAcceptArr.find((item) => item.chunk_index === queueIndex.toString())
  queueIndex++
  if (nextFileAccept) httpPostAcceptFileChunk(nextFileAccept)
}

/** 上传失败处理 */
const handleUploadFail = () => {
  notification.warn({ message: '上传失败，请继续上传' })
  modalShow.value = false
}

/** 通知后端合并切片 */
const httpGetChunkMerge = (fileAccept: FileAccept) => {
  const { file_hash, name, chunk_number } = fileAccept
  axios.get('api/merge_file_chunk/', { params: { file_hash, name, chunk_number } }).then((res) => {
    uploadSuccess(res.data.msg)
  })
}

/** 上传成功处理 */
const uploadSuccess = (msg: string = '上传成功') => {
  notification.success({ message: msg })
  fileList.value.length = 0
  modalShow.value = false
}
</script>

<template>
  <div id="container">
    <h1>大文件切片上传</h1>
    <a-upload-dragger
      accept=".wfp, .zip, .gz, .tar, .jar, .war, .rar , .mp4"
      v-model:fileList="fileList"
      :disabled="false"
      :multiple="false"
      @change="handleChange"
      :before-upload="beforeUpload"
    >
      <p class="ant-upload-drag-icon">
        <inbox-outlined></inbox-outlined>
      </p>
      <p class="ant-upload-text">Click or drag file to this area to upload</p>
      <p class="ant-upload-hint">Support for a single or bulk upload. Strictly prohibit from uploading company data or other band files</p>
    </a-upload-dragger>
    <button class="btn" @click="handleClickSubmit">submit</button>
  </div>
  <div class="modal" v-show="modalShow">
    <div class="modal-div">
      <a-progress type="circle" :percent="percent" />
    </div>
  </div>
</template>
