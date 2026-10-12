import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import styled from "@emotion/styled";
import { renderWithProviders, rulesOf } from "@/tests/helpers";

const Sticky = styled("div")`
  color: red;
  @media screen {
    background: white;
  }
  @media print {
    background: none;
  }
  @container (min-width: 800px) {
    position: sticky;
  }
`;

const Plain = styled("div")`
  margin: 3px;
  @container (min-width: 800px) {
    top: 7px;
  }
`;

describe("rulesOf", () => {
  const renderBoth = () => {
    renderWithProviders(
      <>
        <Sticky data-testid="sticky" />
        <Plain data-testid="plain" />
      </>,
    );
    return { sticky: screen.getByTestId("sticky"), plain: screen.getByTestId("plain") };
  };

  it("groups an element's rules by the at-rule they sit in", () => {
    const { sticky } = renderBoth();
    const rules = rulesOf(sticky);
    expect(rules.base).toMatch(/color:\s*red/);
    expect(rules.base).not.toMatch(/background|sticky/);
    expect(Object.keys(rules.media).sort()).toEqual(["print", "screen"]);
    expect(rules.media.screen).toMatch(/background:\s*white/);
    expect(rules.media.print).toMatch(/background:\s*none/);
    expect(rules.container["(min-width: 800px)"]).toMatch(/position:\s*sticky/);
    expect(rules.container["(min-width: 800px)"]).not.toMatch(/color/);
  });

  it("leaves another element's rules out, and merges rules when given both", () => {
    const { sticky, plain } = renderBoth();
    const own = rulesOf(sticky);
    expect(own.base).not.toMatch(/margin/);
    expect(own.container["(min-width: 800px)"]).not.toMatch(/top:/);

    const both = rulesOf(sticky, plain);
    expect(both.base).toMatch(/color:\s*red/);
    expect(both.base).toMatch(/margin:\s*3px/);
    expect(both.container["(min-width: 800px)"]).toMatch(/position:\s*sticky/);
    expect(both.container["(min-width: 800px)"]).toMatch(/top:\s*7px/);
  });

  it("returns empty groups for an element with no emotion classes", () => {
    renderBoth();
    expect(rulesOf(document.body)).toEqual({ base: "", media: {}, container: {} });
  });
});
