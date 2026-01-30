import { describe, it, expect, vi } from "vitest";
import { renderHook, render, screen } from "@testing-library/react";
import { ExperienceProvider, useExperienceContext } from "./ExperienceProvider";

describe("ExperienceProvider", () => {
  describe("ExperienceProvider component", () => {
    it("should render children", () => {
      render(
        <ExperienceProvider experience="classic">
          <div data-testid="child">Child content</div>
        </ExperienceProvider>
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByText("Child content")).toBeInTheDocument();
    });

    it("should provide classic experience context", () => {
      const TestComponent = () => {
        const { experience } = useExperienceContext();
        return <div data-testid="experience">{experience}</div>;
      };

      render(
        <ExperienceProvider experience="classic">
          <TestComponent />
        </ExperienceProvider>
      );

      expect(screen.getByTestId("experience")).toHaveTextContent("classic");
    });

    it("should provide modern experience context", () => {
      const TestComponent = () => {
        const { experience } = useExperienceContext();
        return <div data-testid="experience">{experience}</div>;
      };

      render(
        <ExperienceProvider experience="modern">
          <TestComponent />
        </ExperienceProvider>
      );

      expect(screen.getByTestId("experience")).toHaveTextContent("modern");
    });
  });

  describe("useExperienceContext hook", () => {
    it("should return experience context when used within provider", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ExperienceProvider experience="classic">{children}</ExperienceProvider>
      );

      const { result } = renderHook(() => useExperienceContext(), { wrapper });

      expect(result.current.experience).toBe("classic");
    });

    it("should return modern experience when set", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ExperienceProvider experience="modern">{children}</ExperienceProvider>
      );

      const { result } = renderHook(() => useExperienceContext(), { wrapper });

      expect(result.current.experience).toBe("modern");
    });

    it("should throw error when used outside provider", () => {
      // Suppress console.error for this test since we expect an error
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        renderHook(() => useExperienceContext());
      }).toThrow("useExperienceContext must be used within an ExperienceProvider");

      consoleSpy.mockRestore();
    });
  });
});
