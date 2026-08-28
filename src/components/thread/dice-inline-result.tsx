"use client";

import { Popover } from "@base-ui/react/popover";
import {
  DICE_DETAIL_PRESENTATION,
  describeInlineDiceResultItem,
  describeInlineDiceRoll,
  formatInlineDiceModifier,
  formatInlineDiceRoll,
  type InlineDiceRoll,
} from "@/lib/dice-inline";
import { WenyouIcon } from "@/components/ui/wenyou-icon";

interface DiceInlineResultProps {
  roll: InlineDiceRoll;
}

/** 阅读态已结算骰子：正文只显示总计，逐骰结果按需在锚定浮层中展示。 */
export function DiceInlineResult({ roll }: DiceInlineResultProps) {
  const subtotal = roll.results.reduce((sum, value) => sum + value, 0);
  const detail = DICE_DETAIL_PRESENTATION;

  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <button
            type="button"
            className="dice-inline dice-inline-result"
            aria-label={describeInlineDiceRoll(roll)}
            data-dice-node-id={roll.nodeId}
            data-dice-notation={roll.notation}
          />
        }
      >
        {formatInlineDiceRoll(roll)}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="center"
          sideOffset={6}
          collisionPadding={8}
          className="isolate z-[var(--layer-nested-popup)]"
        >
          <Popover.Popup
            role="dialog"
            className="dice-detail-popover w-[min(var(--element-dice-detail-width,22rem),calc(100vw-1rem))] max-h-[min(var(--element-dice-detail-max-height,28rem),var(--available-height))] overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-popover outline-none"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Popover.Title className="text-sm font-bold text-foreground">
                  {detail.title}
                </Popover.Title>
                <p className="mt-0.5 font-utility text-sm tabular-nums text-muted-foreground">
                  {formatInlineDiceRoll(roll)}
                </p>
              </div>
              <Popover.Close
                aria-label="关闭骰子结果"
                className="icon-control -mr-1 -mt-1 shrink-0"
              >
                <WenyouIcon id="action.close" />
              </Popover.Close>
            </div>

            <section className="mt-3" aria-label={detail.resultsLabel}>
              <h3 className="text-xs font-medium text-muted-foreground">
                {detail.resultsLabel} · {roll.results.length}
              </h3>
              <ol className="dice-result-tray mt-2">
                {roll.results.map((value, offset) => {
                  const index = offset + detail.resultIndexOrigin;
                  return (
                    <li
                      key={index}
                      aria-label={describeInlineDiceResultItem(index, value)}
                      className="dice-result-cell"
                    >
                      {value}
                    </li>
                  );
                })}
              </ol>
            </section>

            <dl className="mt-3 divide-y divide-border border-t border-border text-sm tabular-nums">
              <div className="flex items-center justify-between gap-4 py-2">
                <dt className="text-muted-foreground">{detail.subtotalLabel}</dt>
                <dd className="font-utility">{subtotal}</dd>
              </div>
              {roll.modifier !== 0 && (
                <div className="flex items-center justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">{detail.modifierLabel}</dt>
                  <dd className="font-utility">{formatInlineDiceModifier(roll.modifier)}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-4 pt-2 font-bold text-foreground">
                <dt>{detail.totalLabel}</dt>
                <dd className="font-utility text-base">{roll.total}</dd>
              </div>
            </dl>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
