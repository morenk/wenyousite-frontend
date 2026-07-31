/** 图片上传 API hook */

import { useMutation } from "@tanstack/react-query";
import { uploadImage } from "@/lib/upload-image";

export function useUploadImage() {
  return useMutation({
    mutationFn: uploadImage,
  });
}
