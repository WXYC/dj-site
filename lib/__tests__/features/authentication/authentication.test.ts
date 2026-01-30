import { describe, it, expect } from "vitest";
import {
  authenticationSlice,
  defaultAuthenticationState,
} from "@/lib/features/authentication/frontend";
import { describeSlice } from "@/lib/test-utils";

describeSlice(authenticationSlice, defaultAuthenticationState, ({ harness, actions }) => {
  describe("verify action", () => {
    it.each(["username", "password", "realName", "djName", "confirmPassword", "code", "currentPassword"] as const)(
      "should set %s verification to true",
      (key) => {
        const result = harness().reduce(actions.verify({ key, value: true }));
        expect(result.verifications[key]).toBe(true);
      }
    );

    it("should set verification back to false", () => {
      const result = harness().chain(
        actions.verify({ key: "username", value: true }),
        actions.verify({ key: "username", value: false })
      );
      expect(result.verifications.username).toBe(false);
    });

    it("should preserve other verification states when updating one", () => {
      const result = harness().chain(
        actions.verify({ key: "username", value: true }),
        actions.verify({ key: "password", value: true })
      );
      expect(result.verifications.username).toBe(true);
      expect(result.verifications.password).toBe(true);
    });
  });

  describe("modify action", () => {
    it.each(["realName", "djName", "email"] as const)(
      "should set %s modification to true",
      (key) => {
        const result = harness().reduce(actions.modify({ key, value: true }));
        expect(result.modifications[key]).toBe(true);
      }
    );

    it("should set modification back to false", () => {
      const result = harness().chain(
        actions.modify({ key: "realName", value: true }),
        actions.modify({ key: "realName", value: false })
      );
      expect(result.modifications.realName).toBe(false);
    });
  });

  describe("reset action", () => {
    it("should reset verifications to default", () => {
      const result = harness().chain(
        actions.verify({ key: "username", value: true }),
        actions.verify({ key: "password", value: true }),
        actions.reset()
      );
      expect(result.verifications).toEqual(defaultAuthenticationState.verifications);
    });

    it("should reset required credentials to default", () => {
      const result = harness().chain(
        actions.addRequiredCredentials(["realName", "djName"]),
        actions.reset()
      );
      expect(result.required).toEqual(defaultAuthenticationState.required);
    });

    it("should not reset modifications", () => {
      const result = harness().chain(
        actions.modify({ key: "realName", value: true }),
        actions.reset()
      );
      expect(result.modifications.realName).toBe(true);
    });
  });

  describe("addRequiredCredentials action", () => {
    it("should add single credential", () => {
      const result = harness().reduce(actions.addRequiredCredentials(["realName"]));
      expect(result.required).toContain("realName");
    });

    it("should add multiple credentials", () => {
      const result = harness().reduce(
        actions.addRequiredCredentials(["realName", "djName"])
      );
      expect(result.required).toContain("realName");
      expect(result.required).toContain("djName");
    });

    it("should preserve existing required credentials", () => {
      const result = harness().reduce(actions.addRequiredCredentials(["realName"]));
      expect(result.required).toContain("username");
      expect(result.required).toContain("password");
      expect(result.required).toContain("realName");
    });
  });

  describe("resetModifications action", () => {
    it("should reset all modifications to false", () => {
      const result = harness().chain(
        actions.modify({ key: "realName", value: true }),
        actions.modify({ key: "djName", value: true }),
        actions.modify({ key: "email", value: true }),
        actions.resetModifications()
      );
      expect(result.modifications).toEqual(defaultAuthenticationState.modifications);
    });

    it("should not affect verifications", () => {
      const result = harness().chain(
        actions.verify({ key: "username", value: true }),
        actions.modify({ key: "realName", value: true }),
        actions.resetModifications()
      );
      expect(result.verifications.username).toBe(true);
    });
  });

  describe("selectors", () => {
    describe("getVerification", () => {
      it("should return verification state for a field", () => {
        const { dispatch, select } = harness().withStore();
        dispatch(actions.verify({ key: "username", value: true }));
        expect(
          select((state) => authenticationSlice.selectors.getVerification(state, "username"))
        ).toBe(true);
      });

      it("should return false for unverified fields", () => {
        const { select } = harness().withStore();
        expect(
          select((state) => authenticationSlice.selectors.getVerification(state, "username"))
        ).toBe(false);
      });
    });

    describe("getModifications", () => {
      it("should return empty array when nothing is modified", () => {
        const { select } = harness().withStore();
        expect(select(authenticationSlice.selectors.getModifications)).toEqual([]);
      });

      it("should return array of modified keys", () => {
        const { dispatch, select } = harness().withStore();
        dispatch(actions.modify({ key: "realName", value: true }));
        dispatch(actions.modify({ key: "djName", value: true }));

        const modifications = select(authenticationSlice.selectors.getModifications);
        expect(modifications).toContain("realName");
        expect(modifications).toContain("djName");
        expect(modifications).not.toContain("email");
      });
    });

    describe("requiredCredentialsVerified", () => {
      it("should return false when no credentials are verified", () => {
        const { select } = harness().withStore();
        expect(select(authenticationSlice.selectors.requiredCredentialsVerified)).toBe(false);
      });

      it("should return false when only some required credentials are verified", () => {
        const { dispatch, select } = harness().withStore();
        dispatch(actions.verify({ key: "username", value: true }));
        expect(select(authenticationSlice.selectors.requiredCredentialsVerified)).toBe(false);
      });

      it("should return true when all required credentials are verified", () => {
        const { dispatch, select } = harness().withStore();
        dispatch(actions.verify({ key: "username", value: true }));
        dispatch(actions.verify({ key: "password", value: true }));
        dispatch(actions.verify({ key: "confirmPassword", value: true }));
        expect(select(authenticationSlice.selectors.requiredCredentialsVerified)).toBe(true);
      });

      it("should account for added required credentials", () => {
        const { dispatch, select } = harness().withStore();
        dispatch(actions.verify({ key: "username", value: true }));
        dispatch(actions.verify({ key: "password", value: true }));
        dispatch(actions.verify({ key: "confirmPassword", value: true }));
        dispatch(actions.addRequiredCredentials(["realName"]));
        expect(select(authenticationSlice.selectors.requiredCredentialsVerified)).toBe(false);

        dispatch(actions.verify({ key: "realName", value: true }));
        expect(select(authenticationSlice.selectors.requiredCredentialsVerified)).toBe(true);
      });
    });

    describe("allCredentialsVerified", () => {
      it("should return false when no credentials are verified", () => {
        const { select } = harness().withStore();
        expect(select(authenticationSlice.selectors.allCredentialsVerified)).toBe(false);
      });

      it("should return true when username and password are verified", () => {
        const { dispatch, select } = harness().withStore();
        dispatch(actions.verify({ key: "username", value: true }));
        dispatch(actions.verify({ key: "password", value: true }));
        expect(select(authenticationSlice.selectors.allCredentialsVerified)).toBe(true);
      });
    });

    describe("isModified", () => {
      it("should return false when nothing is modified", () => {
        const { select } = harness().withStore();
        expect(select(authenticationSlice.selectors.isModified)).toBe(false);
      });

      it("should return true when any field is modified", () => {
        const { dispatch, select } = harness().withStore();
        dispatch(actions.modify({ key: "realName", value: true }));
        expect(select(authenticationSlice.selectors.isModified)).toBe(true);
      });

      it("should return false after resetting modifications", () => {
        const { dispatch, select } = harness().withStore();
        dispatch(actions.modify({ key: "realName", value: true }));
        dispatch(actions.resetModifications());
        expect(select(authenticationSlice.selectors.isModified)).toBe(false);
      });
    });
  });

  describe("default state", () => {
    it("should have all verifications set to false", () => {
      expect(harness().initialState.verifications).toEqual({
        username: false,
        realName: false,
        djName: false,
        password: false,
        currentPassword: false,
        confirmPassword: false,
        code: false,
      });
    });

    it("should have all modifications set to false", () => {
      expect(harness().initialState.modifications).toEqual({
        realName: false,
        djName: false,
        email: false,
      });
    });

    it("should have default required credentials", () => {
      expect(harness().initialState.required).toEqual([
        "username",
        "password",
        "confirmPassword",
      ]);
    });
  });
});
