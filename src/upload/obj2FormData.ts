export function obj2FormData(obj: any) {
  const formData = new FormData()
  for (const key in obj) {
    formData.append(key, obj[key])
  }
  return formData
}
