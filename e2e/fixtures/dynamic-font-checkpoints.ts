import { randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  closeSync,
  fstatSync,
  readSync,
  realpathSync,
  renameSync,
  writeFileSync,
  constants,
} from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";

const sha = z.string().regex(/^[a-f0-9]{64}$/u);
const versionId = z.string().regex(/^tfv_[a-f0-9]{32}$/u);
export const FONT_CHECKPOINTS = {
  "sessions-ready": [
    "fixed-build",
    "session-open",
    "isolated-backend-verified",
  ],
  "published-v1": ["discover", "select", "post", "read", "copy", "save-reopen"],
  "published-v2": [
    "select-v2",
    "save-reopen-v2",
    "history-still-v1",
    "copy-historical-v1",
  ],
  disabled: ["historical-render", "selection-disabled", "paste-default"],
  enabled: ["selection-restored"],
  rollback: ["selection-v1", "history-unchanged"],
  withdrawn: [
    "render-default",
    "download-denied",
    "source-preserved",
    "offline-default",
  ],
  "legacy-mapped": ["v1-v2-render", "shared-registration"],
  "legacy-withdrawn": [
    "v1-v2-default",
    "source-preserved",
    "no-legacy-download",
  ],
} as const;
type Phase = keyof typeof FONT_CHECKPOINTS;
const phases = Object.keys(FONT_CHECKPOINTS) as Phase[];
const identitySchema = z
  .object({
    runId: z.string().regex(/^e2e_[a-f0-9]{24}$/u),
    backendURL: z.string().url(),
    webBuildId: z.string().min(1).max(160),
    webBuildSha256: sha,
    sourceCommit: z.string().regex(/^[a-f0-9]{40}$/u),
    sourceDigest: sha,
    webSessionId: z.uuid(),
  })
  .strict();
type Identity = z.infer<typeof identitySchema>;
const ackSchema = z
  .object({
    schemaVersion: z.literal(1),
    runId: identitySchema.shape.runId,
    checkpointId: z.uuid(),
    sequence: z.number().int().nonnegative(),
    phase: z.enum(phases as [Phase, ...Phase[]]),
    versionIds: z.array(versionId).max(4),
    webBuildSha256: sha,
    webSessionId: z.uuid(),
    mobileApkSha256: sha,
    mobileSessionId: z.uuid(),
    mobileProcessId: z.number().int().positive(),
    mobileSessionOpenedAt: z.iso.datetime(),
    observedAt: z.iso.datetime(),
    completed: z.literal(true),
    checks: z.array(z.string().min(1).max(80)).max(12),
    evidenceSha256: sha,
  })
  .strict();
type Ack = z.infer<typeof ackSchema>;
type MobileSession = Pick<
  Ack,
  "mobileSessionId" | "mobileProcessId" | "mobileSessionOpenedAt"
>;

/** 只存在于已核验的一次性隔离目录；等待本身不构成 Mobile 确认。 */
export class DynamicFontCheckpoints {
  readonly directory: string;
  readonly mode: "web-only" | "web-mobile";
  private readonly controller = new AbortController();
  private readonly identity: Identity;
  private readonly acknowledgements: Ack[] = [];
  private readonly completed: Phase[] = [];
  private mobileSession?: MobileSession;
  private sequence = 0;
  private waiting = false;
  private failedPhase?: Phase;
  private waitedMs = 0;
  constructor(
    private readonly options: {
      root: string;
      identity: Identity;
      mobileApkSha256?: string;
      verify: () => Promise<void>;
      timeoutMs?: number;
      totalWaitMs?: number;
    },
  ) {
    this.identity = identitySchema.parse(options.identity);
    if (options.mobileApkSha256 !== undefined)
      sha.parse(options.mobileApkSha256);
    this.mode = options.mobileApkSha256 ? "web-mobile" : "web-only";
    this.checkDirectory(options.root);
    this.directory = join(options.root, "dynamic-font-checkpoints");
    // 同 runId 的重复旅程也不能复用已有检查点或 ack。
    mkdirSync(this.directory, { mode: 0o700 });
  }
  private checkDirectory(path: string) {
    const stat = lstatSync(path);
    if (
      !stat.isDirectory() ||
      stat.uid !== process.getuid?.() ||
      (stat.mode & 0o777) !== 0o700 ||
      realpathSync(path) !== path
    )
      throw new Error("字体检查点目录身份无效");
  }
  private write(name: string, value: unknown) {
    this.checkDirectory(this.options.root);
    this.checkDirectory(this.directory);
    const temporary = join(this.directory, name + "." + randomUUID() + ".tmp");
    writeFileSync(temporary, JSON.stringify(value, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
    renameSync(temporary, join(this.directory, name));
  }
  private readAck(path: string): Ack {
    this.checkDirectory(this.options.root);
    this.checkDirectory(this.directory);
    const stat = lstatSync(path);
    if (
      !stat.isFile() ||
      stat.uid !== process.getuid?.() ||
      (stat.mode & 0o777) !== 0o600 ||
      stat.size > 16384 ||
      realpathSync(path) !== path
    )
      throw new Error("字体检查点 ack 文件身份无效");
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const opened = fstatSync(fd);
      if (
        opened.dev !== stat.dev ||
        opened.ino !== stat.ino ||
        opened.uid !== stat.uid ||
        opened.mode !== stat.mode ||
        opened.size > 16384
      )
        throw new Error("ack 文件已替换");
      const buffer = Buffer.alloc(16385);
      let count = 0;
      while (count < buffer.length) {
        const bytes = readSync(fd, buffer, count, buffer.length - count, null);
        if (bytes === 0) break;
        count += bytes;
      }
      if (count > 16384) throw new Error("ack 文件过大");
      return ackSchema.parse(
        JSON.parse(buffer.subarray(0, count).toString("utf8")),
      );
    } catch {
      throw new Error("字体检查点 ack 格式无效");
    } finally {
      closeSync(fd);
    }
  }
  get summary() {
    return {
      schemaVersion: 1,
      ...this.identity,
      mode: this.mode,
      mobileApkSha256: this.options.mobileApkSha256 ?? null,
      failedPhase: this.failedPhase ?? null,
      completedPhases: [...this.completed],
      acknowledgements: [...this.acknowledgements],
      jointAcceptance:
        this.mode === "web-mobile" &&
        !this.failedPhase &&
        this.completed.length === phases.length,
    };
  }
  dispose() {
    this.controller.abort();
  }
  async checkpoint(
    phase: Phase,
    versionIds: string[],
    context: { threadId?: string; fontName?: string } = {},
  ) {
    if (
      this.waiting ||
      this.failedPhase !== undefined ||
      phases[this.sequence] !== phase ||
      this.controller.signal.aborted
    )
      throw new Error("字体检查点顺序或生命周期无效");
    z.array(versionId).max(4).parse(versionIds);
    z.object({
      threadId: z
        .string()
        .regex(/^[a-zA-Z0-9_-]{1,100}$/u)
        .optional(),
      fontName: z.string().max(80).optional(),
    })
      .strict()
      .parse(context);
    this.waiting = true;
    const started = performance.now();
    const timeout = Math.min(
      this.options.timeoutMs ?? 300000,
      (this.options.totalWaitMs ?? 1200000) - this.waitedMs,
    );
    const issuedAt = Date.now(),
      checkpointId = randomUUID(),
      sequence = this.sequence;
    const filename = `${String(sequence).padStart(2, "0")}-${phase}`;
    const record = {
      schemaVersion: 1,
      ...this.identity,
      mode: this.mode,
      checkpointId,
      sequence,
      phase,
      versionIds,
      ...context,
      expectedMobileApkSha256: this.options.mobileApkSha256 ?? null,
      requiredChecks: FONT_CHECKPOINTS[phase],
      issuedAt: new Date(issuedAt).toISOString(),
      expiresAt: new Date(issuedAt + Math.max(0, timeout)).toISOString(),
      ackFile: filename + ".ack.json",
      mobileSession: this.mobileSession ?? null,
    };
    try {
      await this.options.verify();
      if (this.controller.signal.aborted) throw new Error("字体协作已终止");
      this.write(filename + ".json", record);
      this.write("current.json", record);
      if (this.mode === "web-mobile") {
        if (timeout <= 0) throw new Error("字体协作总等待超时");
        const path = join(this.directory, record.ackFile);
        while (true) {
          if (this.controller.signal.aborted) throw new Error("字体协作已终止");
          if (performance.now() - started >= timeout)
            throw new Error(`字体协作检查点超时：${phase}`);
          if (existsSync(path)) {
            const ack = this.readAck(path);
            const same =
              ack.runId === record.runId &&
              ack.checkpointId === checkpointId &&
              ack.sequence === sequence &&
              ack.phase === phase &&
              ack.webBuildSha256 === record.webBuildSha256 &&
              ack.webSessionId === record.webSessionId &&
              ack.mobileApkSha256 === this.options.mobileApkSha256 &&
              JSON.stringify(ack.versionIds) === JSON.stringify(versionIds) &&
              ack.checks.length === record.requiredChecks.length &&
              record.requiredChecks.every((check) =>
                ack.checks.includes(check),
              );
            const opened = Date.parse(ack.mobileSessionOpenedAt),
              observed = Date.parse(ack.observedAt);
            if (
              !same ||
              observed < issuedAt ||
              observed > Date.now() + 30000 ||
              opened > observed
            )
              throw new Error("字体检查点 ack 与本轮阶段或构建不匹配");
            const session = {
              mobileSessionId: ack.mobileSessionId,
              mobileProcessId: ack.mobileProcessId,
              mobileSessionOpenedAt: ack.mobileSessionOpenedAt,
            };
            if (
              this.mobileSession &&
              JSON.stringify(session) !== JSON.stringify(this.mobileSession)
            )
              throw new Error("Mobile 会话发生重启或替换");
            await this.options.verify();
            this.mobileSession = session;
            this.acknowledgements.push(ack);
            break;
          }
          await delay(
            Math.max(1, Math.min(250, timeout - (performance.now() - started))),
            undefined,
            { signal: this.controller.signal },
          );
        }
      }
      this.completed.push(phase);
      this.sequence++;
      this.write("summary.json", this.summary);
    } catch (error) {
      this.failedPhase = phase;
      throw error;
    } finally {
      this.waitedMs += performance.now() - started;
      this.waiting = false;
    }
  }
}
