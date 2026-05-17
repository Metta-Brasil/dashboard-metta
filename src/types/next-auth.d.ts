import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    provider?: "google" | "credentials";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    provider?: "google" | "credentials";
  }
}
