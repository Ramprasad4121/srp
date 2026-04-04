import type { ApprovedDomainRule, InternetMode } from "@srp/shared-types";

export interface InternetPolicy {
  readonly mode: InternetMode;
  readonly approvedDomains: readonly ApprovedDomainRule[];
}

export function createInternetPolicy(
  mode: InternetMode,
  approvedDomains: readonly ApprovedDomainRule[]
): InternetPolicy {
  return {
    mode,
    approvedDomains
  };
}

export function canBrowseInternet(policy: InternetPolicy): boolean {
  return policy.mode !== "local-only";
}

export function canUseOpenWeb(policy: InternetPolicy): boolean {
  return policy.mode === "open-web";
}

export function isHostnameAllowed(policy: InternetPolicy, hostname: string): boolean {
  if (policy.mode === "open-web") {
    return true;
  }

  if (policy.mode === "local-only") {
    return false;
  }

  return policy.approvedDomains.some((rule) => rule.hostname === hostname);
}

export function describeInternetPolicy(policy: InternetPolicy): string {
  switch (policy.mode) {
    case "local-only":
      return "Local artifacts only";
    case "local-plus-docs":
      return "Local artifacts plus trusted documentation";
    case "local-plus-approved-web":
      return "Local artifacts plus approved web domains";
    case "open-web":
      return "Open web access enabled";
  }
}
