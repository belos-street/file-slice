<script setup lang="ts">
import { InboxOutlined } from '@ant-design/icons-vue'
import { notification } from 'ant-design-vue'
import { ref } from 'vue'
import { FileInfo, FileItem, FileAccept } from './upload/type'
import axios from 'axios'

import worker from './upload/uploadWorker?worker'
import { obj2FormData } from './upload/obj2FormData'

const uploadWorker = new worker()
const fileList = ref<FileItem[]>([])
const fileSliceArr = ref([])
const percent = ref<number>(0)
const modalShow = ref<boolean>(false)
const CHUNK_SIZE = 1 * 1024 * 1024 * 10 //10m
const EXISTS = 'EXISTS' //文件已存在且合并成功
let uploadChunkList: string[] = [] //已经上传成功的切片
let postUploadChunkQueue: string[] = [] //控制上传切片的并发队列

const handleChange = (info: FileInfo) => {
  if (info.fileList.length >= 2) fileList.value = [info.fileList.pop() as FileItem]
}

const beforeUpload = () => false

const getArrLength2Str = (arr: string[]): string => [...new Set(arr)].length.toString()

const handleClickSubmit = () => {
  if (fileList.value.length !== 1) return
  uploadInit()
}

const uploadInit = () => {
  fileSliceArr.value = []
  uploadChunkList.length = 0
  percent.value = 0
  modalShow.value = true
  uploadWorker.postMessage({ file: fileList.value[0].originFileObj, CHUNK_SIZE })
}

/**
 * 接受webworker传过来的文件切片
 * 获取已上传的切片 httpGetUploadChunks
 */
uploadWorker.onmessage = async ({ data }) => {
  const fileAcceptArr: FileAccept[] = data as FileAccept[]
  if (fileAcceptArr.length === 0) return
  let fileAcceptFrist = fileAcceptArr[0]
  let msg = (await httpGetUploadChunks(fileAcceptFrist.file_hash, fileAcceptFrist.name)) as string | string[]
  if (msg === EXISTS) return uploadSuccess() //uc_1
  if (!Array.isArray(msg)) return
  if (getArrLength2Str(msg) === fileAcceptFrist.chunk_number) return httpGetChunkMerge(fileAcceptFrist) //uc_2
  uploadChunkList = msg //uc_3 uc_4
  fileAcceptArr.map((item) => httpPostAcceptFileChunk(item))
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
  try {
    let result = (await axios.get('api/get_chunks_info/', { params: { file_hash, name } })) as any
    return new Promise((resolve) => {
      resolve(result.data.msg)
    })
  } catch (err) {
    console.warn(err)
  }
}

/**
 * httpPostAcceptFileChunk 上传切片
 *  uploadChunkList.includes(chunk_index)  已上传的切片跳过
 *  getArrLength2Str(uploadChunkList) 用来判断是不是最后一片切片 是的话通知后端合并切片
 */
const httpPostAcceptFileChunk = (fileAccept: FileAccept) => {
  const { chunk_index, chunk_number } = fileAccept
  if (uploadChunkList.includes(chunk_index)) return
  axios({
    method: 'post',
    url: 'api/accept_file_chunk/',
    data: obj2FormData(fileAccept),
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 1 * 10 * 1000
  })
    .then(() => {
      uploadChunkList.push(chunk_index)
      percent.value = parseInt(((uploadChunkList.length / parseInt(chunk_number)) * 100).toFixed(2))
      if (getArrLength2Str(uploadChunkList) === chunk_number) httpGetChunkMerge(fileAccept)
    })
    .catch(() => {
      handleUploadFail()
    })
}

const handleUploadFail = () => {
  notification.warn({
    message: '上传失败，请重新上传'
  })
  modalShow.value = false
}

/**
 * 通知后端合并切片
 */
const httpGetChunkMerge = (fileAccept: FileAccept) => {
  const { file_hash, name } = fileAccept
  axios.get('api/merge_file_chunk/', { params: { file_hash, name } }).then((res) => {
    uploadSuccess(res.data.msg)
  })
}

const uploadSuccess = (msg: string = '上传成功') => {
  notification.success({
    message: msg
  })
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
    <button class="btn" @click="handleClickSubmit">提交</button>
  </div>
  <div class="modal" v-show="modalShow">
    <div class="modal-div">
      <a-progress type="circle" :percent="percent" />
    </div>
  </div>
</template>

<style>
#container {
  width: 500px;
  text-align: center;
  align-self: center;
}
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  display: flex;
  justify-content: center;
  color: #2c3e50;
  height: 100vh;
  width: 100vw;
  position: relative;
}

.modal {
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
}

.modal-div {
  margin-top: 100px;
}

.btn {
  margin-top: 20px;
}
</style>
