import type { ApprovedDomainRule, InternetMode } from "@srp/shared-types";
export interface InternetPolicy {
    readonly mode: InternetMode;
    readonly approvedDomains: readonly ApprovedDomainRule[];
}
export declare function createInternetPolicy(mode: InternetMode, approvedDomains: readonly ApprovedDomainRule[]): InternetPolicy;
export declare function canBrowseInternet(policy: InternetPolicy): boolean;
export declare function canUseOpenWeb(policy: InternetPolicy): boolean;
export declare function isHostnameAllowed(policy: InternetPolicy, hostname: string): boolean;
export declare function describeInternetPolicy(policy: InternetPolicy): string;
//# sourceMappingURL=index.d.ts.map