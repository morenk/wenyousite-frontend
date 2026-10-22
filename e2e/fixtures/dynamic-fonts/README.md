# 动态字体隔离样本

两份 TTF 由同目录 `generate.py` 使用 FontTools 从原创轮廓生成，按 CC0-1.0 提供，仅用于隔离测试。第一版 A/a 为三角轮廓，第二版为矩形轮廓；二者覆盖空格及 A/a，可从实际画面区分版本。未嵌入第三方字体，不请求远程来源。

真实验收必须经管理员原始上传、沙箱处理、预览和发布取得动态 ID；这些文件不是预制 manifest，不代替实际处理链路。执行 `python3 e2e/fixtures/dynamic-fonts/generate.py` 可重建固定时间戳的样本。
