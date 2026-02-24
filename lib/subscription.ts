import { WorkspacePlanType } from '@/types/database.types';

export const PLAN_LIMITS = {
    free: {
        maxGuests: Infinity, // No block on scans, but cron disabled 
        canRunCron: false,
        canSendAlerts: false,
        minHoursBetweenScans: 24,
    },
    starter: {
        maxGuests: 500,
        canRunCron: true,
        canSendAlerts: true,
        minHoursBetweenScans: 0, // No scanning limit, always allowed
    },
    growth: {
        maxGuests: 5000,
        canRunCron: true,
        canSendAlerts: true,
        minHoursBetweenScans: 0,
    },
    scale: {
        maxGuests: Infinity,
        canRunCron: true,
        canSendAlerts: true,
        minHoursBetweenScans: 0,
    },
};

/**
 * Validates if the workspace is allowed to execute an on-demand manual scan
 * based on their plan type and the timestamp of their last scan.
 */
export function canRunManualScan(
    planType: WorkspacePlanType,
    lastScanAt: string | null
): { allowed: boolean; reason?: string } {
    const limits = PLAN_LIMITS[planType];

    if (limits.minHoursBetweenScans > 0 && lastScanAt) {
        const hoursSinceLastScan = (Date.now() - new Date(lastScanAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastScan < limits.minHoursBetweenScans) {
            const waitHours = Math.ceil(limits.minHoursBetweenScans - hoursSinceLastScan);
            return {
                allowed: false,
                reason: `Free plan limit: You can scan once every 24 hours. Please wait ${waitHours} more hours or upgrade your plan.`,
            };
        }
    }

    return { allowed: true };
}

/**
 * Validates if the workspace is allowed to execute an automated background cron audit
 * based on their plan type and the total number of members in their Slack workspace.
 */
export function canRunBackgroundAudit(
    planType: WorkspacePlanType,
    totalMembers: number
): { allowed: boolean; reason?: string; requiresUpgrade?: boolean } {
    const limits = PLAN_LIMITS[planType];

    // 1. Is cron enabled for this plan?
    if (!limits.canRunCron) {
        return {
            allowed: false,
            reason: 'Background audits are not included in the Free plan.',
            requiresUpgrade: true,
        };
    }

    // 2. Does the workspace exceed the tier limit?
    if (totalMembers > limits.maxGuests) {
        return {
            allowed: false,
            reason: `Workspace exceeds the guest-account limit for the ${planType.toUpperCase()} plan (max ${limits.maxGuests} guests, found ${totalMembers}).`,
            requiresUpgrade: true,
        };
    }

    return { allowed: true };
}

/**
 * Determines if we should send DM alerts when flag conditions are met.
 */
export function canSendAlerts(
    planType: WorkspacePlanType,
    totalMembers: number
): boolean {
    // Alerts and cron audits share the same logic restrictions essentially
    return canRunBackgroundAudit(planType, totalMembers).allowed;
}
