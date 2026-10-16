"use client";

import { useMutation } from "@tanstack/react-query";
import { uploadAudio, type AudioUploadCapability } from "@/lib/upload-audio";

export function useUploadAudio() {
  return useMutation({
    mutationFn: ({ file, capability, options }: {
      file: File;
      capability: AudioUploadCapability;
      options: Parameters<typeof uploadAudio>[2];
    }) => uploadAudio(file, capability, options),
    retry: false,
    gcTime: 0,
  });
}
