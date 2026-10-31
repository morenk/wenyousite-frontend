import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Progress } from "../progress";

afterEach(cleanup);
test("真实范围映射视觉进度，完成与重试不强加等待", () => {
  const view = render(<Progress value={15} min={10} max={30} aria-label="下载" />);
  const indicator = () => view.container.querySelector<HTMLElement>('[data-slot="progress-indicator"]')!;
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "15");
  expect(indicator().style.width).toBe("100%");
  expect(indicator().style.transform).toBe("scaleX(0.25)");
  view.rerender(<Progress value={30} min={10} max={30} aria-label="下载" />);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "30");
  expect(indicator().style.transform).toBe("scaleX(1)");
  view.rerender(<Progress value={null} aria-label="重试" />);
  expect(screen.getByRole("progressbar", { name: "重试" })).not.toHaveAttribute("aria-valuenow");
  view.unmount();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});
