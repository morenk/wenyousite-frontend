# 图片容器回归样本

样本均为本任务生成的 2×2 红色/蓝色像素，不含用户数据。

- Pillow 10.2.0 `Image.new("RGB", (2, 2), "red")` 生成 static.jpeg/png/webp/gif。
- Pillow `save_all=True, append_images=[blue], duration=100, loop=0` 生成 animated.gif/png/webp，均为 2 帧；animated.png 是真实 APNG。
- single-frame-apng.png 从 animated.png 保留首帧控制/像素块、将 acTL 帧数改为 1 并重算 CRC，验证单帧 APNG 的一致策略。
- static-markers.png 通过 PngInfo.add_text 写入 `acTL fcTL fdAT ANIM ANMF avis`，证明载荷字符串不会被误识别。
- static.avif 由仓库现有 Next.js 传递依赖 sharp 0.35.4 从 static.png 编码；未新增依赖。

容器截断、CRC 损坏、MIME 冲突、JPEG 尾随数据和 AVIF 序列品牌在测试中从这些真实编码样本派生。完整浏览器解码与线上用户原图的验收仍需候选环境记录，不能由容器测试替代。
