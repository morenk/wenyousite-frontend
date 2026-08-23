/** 图片上传 API hook */

import { useMutation } from "@tanstack/react-query";
import { uploadImage, type UploadImageOptions } from "@/lib/upload-image";

interface UploadImageVariables {
  file: File;
  options?: UploadImageOptions;
}

export function useUploadImage() {
  const mutation = useMutation({
    mutationFn: ({ file, options }: UploadImageVariables) =>
      uploadImage(file, { purpose: "RICH_CONTENT", ...options }),
  });

  return {
    ...mutation,
    mutateAsync: (file: File, options?: UploadImageOptions) => mutation.mutateAsync({ file, options }),
  };
}
