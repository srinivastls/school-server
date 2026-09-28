"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBackupScheduler = startBackupScheduler;
exports.stopBackupScheduler = stopBackupScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
const schoolDataLifecycle_service_1 = require("./schoolDataLifecycle.service");
const config_1 = require("../config");
let backupJob = null;
let backupRunning = false;
function startBackupScheduler() {
    if (backupJob) {
        console.log("[Backup Scheduler] Already running");
        return;
    }
    backupJob = node_cron_1.default.schedule("* */3 * * *", // Run every 3 hours
    async () => {
        // ------------------------------------------------
        // Prevent overlapping jobs
        // ------------------------------------------------
        if (backupRunning) {
            console.log("[Backup Scheduler] Previous backup is still running. Skipping this cycle.");
            return;
        }
        backupRunning = true;
        console.log(`[Backup Scheduler] Starting backup cycle at ${new Date().toISOString()}`);
        try {
            // ----------------------------------------------
            // Get all active schools
            // ----------------------------------------------
            const schools = await config_1.prisma.school.findMany({
                select: {
                    id: true,
                    code: true,
                    name: true,
                },
            });
            console.log(`[Backup Scheduler] Found ${schools.length} schools`);
            // ----------------------------------------------
            // Backup each school
            // ----------------------------------------------
            for (const school of schools) {
                try {
                    const result = await (0, schoolDataLifecycle_service_1.runAutomaticSchoolBackup)(school.id);
                    if (result.skipped) {
                        console.log(`[Backup Scheduler] ${school.code}: skipped`);
                    }
                    else {
                        console.log(`[Backup Scheduler] ${school.code}: backup completed`);
                    }
                }
                catch (error) {
                    console.error(`[Backup Scheduler] ${school.code}: backup failed:`, error?.message || error);
                }
            }
            // ----------------------------------------------
            // Cleanup backups older than 24 hours
            // ----------------------------------------------
            await (0, schoolDataLifecycle_service_1.cleanupOldAutomaticBackups)();
            console.log(`[Backup Scheduler] Backup cycle completed at ${new Date().toISOString()}`);
        }
        catch (error) {
            console.error("[Backup Scheduler] Backup cycle failed:", error?.message || error);
        }
        finally {
            backupRunning = false;
        }
    }, {
        timezone: "Asia/Kolkata",
    });
    console.log("[Backup Scheduler] Started. Automatic backups run every 3 hours.");
}
function stopBackupScheduler() {
    if (!backupJob) {
        return;
    }
    backupJob.stop();
    backupJob = null;
    console.log("[Backup Scheduler] Stopped");
}
