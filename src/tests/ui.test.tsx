import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ConfirmDialog, Tabs } from "@/components/ui";
it("exposes tab selection through accessible controls", () => {
  const onChange = vi.fn();
  render(<Tabs items={["All", "Pending"]} value="All" onChange={onChange} />);
  expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  fireEvent.click(screen.getByRole("tab", { name: "Pending" }));
  expect(onChange).toHaveBeenCalledWith("Pending");
});
it("requires a deliberate confirm action in an accessible dialog", () => {
  const onConfirm = vi.fn(),
    onOpenChange = vi.fn();
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Release result?"
      description="Learners can see it afterwards."
      onConfirm={onConfirm}
    />,
  );
  expect(screen.getByRole("dialog")).toHaveAccessibleName("Release result?");
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  expect(onConfirm).toHaveBeenCalledOnce();
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
