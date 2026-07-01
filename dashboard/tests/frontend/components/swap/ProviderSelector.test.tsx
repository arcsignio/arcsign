import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProviderSelector } from "@/components/swap/ProviderSelector";

describe("ProviderSelector", () => {
  it("shows the selected provider name", () => {
    render(
      <ProviderSelector
        selectedProvider="openocean"
        showDropdown={false}
        onToggleDropdown={() => {}}
        onSelectProvider={() => {}}
      />,
    );
    // AVAILABLE_PROVIDERS has OpenOcean with name "OpenOcean"
    const names = screen.getAllByText(/OpenOcean/i);
    expect(names.length).toBeGreaterThan(0);
  });

  it("fires onToggleDropdown when the trigger button is clicked", () => {
    const onToggle = vi.fn();
    render(
      <ProviderSelector
        selectedProvider="openocean"
        showDropdown={false}
        onToggleDropdown={onToggle}
        onSelectProvider={() => {}}
      />,
    );
    // Click the provider-badge button (the trigger)
    const badge = document.querySelector(".provider-badge") as HTMLElement;
    fireEvent.click(badge);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("renders dropdown options when showDropdown is true", () => {
    render(
      <ProviderSelector
        selectedProvider="openocean"
        showDropdown={true}
        onToggleDropdown={() => {}}
        onSelectProvider={() => {}}
      />,
    );
    // Should render the provider dropdown
    expect(document.querySelector(".provider-dropdown")).toBeTruthy();
  });

  it("fires onSelectProvider when a provider option is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ProviderSelector
        selectedProvider="openocean"
        showDropdown={true}
        onToggleDropdown={() => {}}
        onSelectProvider={onSelect}
      />,
    );
    const options = document.querySelectorAll(".provider-option");
    expect(options.length).toBeGreaterThan(0);
    fireEvent.click(options[0]);
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
