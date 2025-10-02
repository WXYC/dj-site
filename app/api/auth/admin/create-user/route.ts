import { getSession } from "@/lib/features/authentication/client";
import { NextRequest, NextResponse } from "next/server";
import { BetterAuthUser, canManageUsers, OrganizationRole } from "@/lib/features/authentication/types";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    // Check if the requester is authenticated and has admin privileges
    const session = await getSession();
    if (!session?.data?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.data.user as BetterAuthUser;
    
    // Extract organization role from better-auth member data
    const organizationRole: OrganizationRole = user.member?.[0]?.role || "member";
    const userWithRole = {
      ...user,
      role: organizationRole,
      authority: user.role || "NO", // Fallback for legacy compatibility
    };

    // Check if user has admin privileges (station management)
    if (!canManageUsers(userWithRole as any)) {
      return NextResponse.json(
        { error: "Forbidden: Only station management can create user accounts" },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { email, username, realName, djName, role = "dj" } = body;
    
    // Validate role is a valid organization role
    const validRoles = ["member", "dj", "music-director", "admin"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role specified" },
        { status: 400 }
      );
    }

    // Only station management (admin) can assign admin or music-director roles
    if ((role === "admin" || role === "music-director") && organizationRole !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Only station management can assign admin or music director roles" },
        { status: 403 }
      );
    }

    if (!email || !username || !realName) {
      return NextResponse.json(
        { error: "Email, username, and real name are required" },
        { status: 400 }
      );
    }

    // For now, we'll create a simplified user creation process
    // In a real implementation, you would use better-auth's admin client
    // or create the user directly in your database
    
    // Simulate user creation (replace with actual better-auth admin API call)
    const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tempPassword = generateSecurePassword();
    
    // TODO: Replace this with actual better-auth user creation
    // For now, we'll simulate the response
    const userData = {
      user: {
        id: newUserId,
        email,
        username,
        name: realName,
        realName,
        djName: djName || realName,
        onboarded: false,
        appSkin: "modern-light",
        role,
        emailVerified: true,
      }
    };

    // TODO: Add actual user creation logic here
    // In a real implementation, you would:
    // 1. Create the user with better-auth
    // 2. Add them to the WXYC organization with the specified role
    // 3. Set their custom fields (realName, djName, etc.)
    
    // For now, we'll proceed with the simulated user data

    // Generate onboarding token for the new user
    const onboardingToken = generateOnboardingToken(userData.user.id);
    
    // TODO: Send onboarding email with link containing the token
    // For now, we'll return the token in the response for testing
    
    return NextResponse.json({
      success: true,
      user: {
        id: userData.user.id,
        email: userData.user.email,
        username: userData.user.username,
        realName: userData.user.realName,
        djName: userData.user.djName,
      },
      onboardingToken, // Remove this in production - send via email instead
    });

  } catch (error) {
    console.error(`[Admin] Error creating user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Generate a secure random password
function generateSecurePassword(): string {
  const length = 16;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  
  // Ensure at least one of each required character type
  password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)]; // Uppercase
  password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]; // Lowercase
  password += "0123456789"[Math.floor(Math.random() * 10)]; // Number
  password += "!@#$%^&*"[Math.floor(Math.random() * 8)]; // Special char
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Generate a secure onboarding token
function generateOnboardingToken(userId: string): string {
  // In production, use a proper JWT library with expiration
  const payload = {
    userId,
    type: "onboarding",
    exp: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
  };
  
  // This is a simplified token - use proper JWT signing in production
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}
