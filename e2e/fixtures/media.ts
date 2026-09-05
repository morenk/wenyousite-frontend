import { expect, type Page } from "@playwright/test";

/** 编辑器工具栏测试复用同一图片上传与处理响应。 */
export async function insertTestEditorImage(page: Page) {
  const mediaId = "e2e-editor-toolbar";
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const uploadUrl = new URL("/e2e-object-upload", page.url()).toString();
  const imageUrl = `data:image/png;base64,${pngBase64}`;
  const media = {
    id: mediaId,
    userId: "e2e-user",
    url: imageUrl,
    thumbnailUrl: null,
    feedUrl: null,
    mediumUrl: null,
    key: "e2e/editor-toolbar.png",
    contentType: "image/png",
    size: 68,
    width: 1,
    height: 1,
    status: "COMPLETED",
    createdAt: "1970-01-01T00:00:00.000Z",
  };
  await page.route("**/api/v1/media/upload-url", async (route) => {
    await route.fulfill({
      json: {
        code: 0,
        message: "ok",
        data: {
          uploadUrl,
          mediaId,
          objectKey: media.key,
          publicUrl: imageUrl,
        },
      },
    });
  });
  await page.route("**/e2e-object-upload", async (route) => {
    await route.fulfill({ status: 200, body: "" });
  });
  await page.route("**/api/v1/media/upload-done", async (route) => {
    await route.fulfill({
      json: {
        code: 0,
        message: "ok",
        data: { media: { ...media, status: "PROCESSING" }, processing: true },
      },
    });
  });
  await page.route(`**/api/v1/media/${mediaId}`, async (route) => {
    await route.fulfill({ json: { code: 0, message: "ok", data: media } });
  });

  const imageButton = page.locator('.milkdown-top-bar .top-bar-item[title="图片"]').first();
  await expect(imageButton).toBeVisible();
  const chooserPromise = page.waitForEvent("filechooser");
  await imageButton.click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "editor-toolbar.png",
    mimeType: "image/png",
    buffer: Buffer.from(pngBase64, "base64"),
  });

  return imageButton;
}
