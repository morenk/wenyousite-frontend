import { Fragment } from "react";
import { tokenizeInternalReferenceText } from "@/lib/internal-reference";
import { InternalReferenceLink } from "@/components/shared/internal-reference-link";

/** 在纯文本内容中只激活站内传送门；其余 Markdown 与外链保持原样。 */
export function InternalReferenceText({ content }: { content: string }) {
  return tokenizeInternalReferenceText(content).map((segment, index) => (
    <Fragment key={`${index}:${segment.type}`}>
      {segment.type === "portal" ? (
        <InternalReferenceLink
          href={segment.reference.href}
          label={segment.label}
        />
      ) : segment.value}
    </Fragment>
  ));
}
