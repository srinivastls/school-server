import cron, { ScheduledTask } from "node-cron";

import {
  runAutomaticSchoolBackup,
  cleanupOldAutomaticBackups,
} from "./schoolDataLifecycle.service";

import { prisma } from "../config";

let backupJob: ScheduledTask | null = null;

let backupRunning = false;

export function startBackupScheduler(): void {
  if (backupJob) {
    console.log(
      "[Backup Scheduler] Already running"
    );

    return;
  }

  backupJob = cron.schedule(
    "* */3 * * *", // Run every 3 hours

    async () => {
      // ------------------------------------------------
      // Prevent overlapping jobs
      // ------------------------------------------------

      if (backupRunning) {
        console.log(
          "[Backup Scheduler] Previous backup is still running. Skipping this cycle."
        );

        return;
      }

      backupRunning = true;

      console.log(
        `[Backup Scheduler] Starting backup cycle at ${new Date().toISOString()}`
      );

      try {
        // ----------------------------------------------
        // Get all active schools
        // ----------------------------------------------

        const schools =
          await prisma.school.findMany({

            select: {
              id: true,
              code: true,
              name: true,
            },
          });

        console.log(
          `[Backup Scheduler] Found ${schools.length} schools`
        );

        // ----------------------------------------------
        // Backup each school
        // ----------------------------------------------

        for (const school of schools) {
          try {
            const result =
              await runAutomaticSchoolBackup(
                school.id
              );

            if (result.skipped) {
              console.log(
                `[Backup Scheduler] ${school.code}: skipped`
              );
            } else {
              console.log(
                `[Backup Scheduler] ${school.code}: backup completed`
              );
            }
          } catch (error: any) {
            console.error(
              `[Backup Scheduler] ${school.code}: backup failed:`,
              error?.message || error
            );
          }
        }

        // ----------------------------------------------
        // Cleanup backups older than 24 hours
        // ----------------------------------------------

        await cleanupOldAutomaticBackups();

        console.log(
          `[Backup Scheduler] Backup cycle completed at ${new Date().toISOString()}`
        );
      } catch (error: any) {
        console.error(
          "[Backup Scheduler] Backup cycle failed:",
          error?.message || error
        );
      } finally {
        backupRunning = false;
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

  console.log(
    "[Backup Scheduler] Started. Automatic backups run every 3 hours."
  );
}

export function stopBackupScheduler(): void {
  if (!backupJob) {
    return;
  }

  backupJob.stop();

  backupJob = null;

  console.log(
    "[Backup Scheduler] Stopped"
  );
}