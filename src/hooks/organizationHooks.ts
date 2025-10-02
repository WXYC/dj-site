"use client";

import { organizationClient } from "@/lib/features/authentication/client";
import { OrganizationRole } from "@/lib/features/authentication/types";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export const useOrganization = () => {
  const [loading, setLoading] = useState(false);

  const createWXYCOrganization = useCallback(async () => {
    setLoading(true);
    try {
      const result = await organizationClient.create({
        name: "WXYC Chapel Hill",
        slug: "wxyc",
        // description is not supported in the organization create API
      });

      if (result.error) {
        toast.error(result.error.message);
        return { success: false, error: result.error.message };
      }

      toast.success("WXYC organization created successfully");
      return { success: true, organization: result.data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to create organization: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const addUserToOrganization = useCallback(async (
    organizationId: string, 
    userId: string, 
    role: OrganizationRole = "member"
  ) => {
    setLoading(true);
    try {
      // TODO: Use proper organization client method when better-auth is configured
      const result = await organizationClient.addMember?.({
        organizationId,
        userId,
        role,
      }) || { error: { message: "Organization client not properly configured" } };

      if (result.error) {
        toast.error(result.error.message);
        return { success: false, error: result.error.message };
      }

      toast.success("User added to organization successfully");
      return { success: true, member: result.data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to add user to organization: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const updateUserRole = useCallback(async (
    organizationId: string, 
    userId: string, 
    role: OrganizationRole
  ) => {
    setLoading(true);
    try {
      // TODO: Use proper organization client method when better-auth is configured
      const result = await organizationClient.updateMemberRole?.({
        organizationId,
        userId,
        role,
      }) || { error: { message: "Organization client not properly configured" } };

      if (result.error) {
        toast.error(result.error.message);
        return { success: false, error: result.error.message };
      }

      toast.success("User role updated successfully");
      return { success: true, member: result.data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to update user role: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const removeUserFromOrganization = useCallback(async (
    organizationId: string, 
    userId: string
  ) => {
    setLoading(true);
    try {
      // TODO: Use proper organization client method when better-auth is configured
      const result = await organizationClient.removeMember?.({
        organizationId,
        userId,
      }) || { error: { message: "Organization client not properly configured" } };

      if (result.error) {
        toast.error(result.error.message);
        return { success: false, error: result.error.message };
      }

      toast.success("User removed from organization successfully");
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to remove user from organization: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const getOrganizationMembers = useCallback(async (organizationId: string) => {
    setLoading(true);
    try {
      // TODO: Use proper organization client method when better-auth is configured
      const result = await organizationClient.listMembers?.({ organizationId }) || { error: { message: "Organization client not properly configured" } };

      if (result.error) {
        toast.error(result.error.message);
        return { success: false, error: result.error.message };
      }

      return { success: true, members: result.data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to get organization members: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const getOrganizationDetails = useCallback(async (organizationId: string) => {
    setLoading(true);
    try {
      // TODO: Use proper organization client method when better-auth is configured
      const result = await organizationClient.getFullOrganization?.({ organizationId }) || { error: { message: "Organization client not properly configured" } };

      if (result.error) {
        toast.error(result.error.message);
        return { success: false, error: result.error.message };
      }

      return { success: true, organization: result.data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to get organization details: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    createWXYCOrganization,
    addUserToOrganization,
    updateUserRole,
    removeUserFromOrganization,
    getOrganizationMembers,
    getOrganizationDetails,
  };
};
