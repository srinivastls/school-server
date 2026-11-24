"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitPrincipalWhatsAppEvent = exports.emitStudentWhatsAppEvent = void 0;
const config_1 = require("../config");
const schedulerUrl = process.env.WHATSAPP_SCHEDULER_URL?.replace(/\/+$/, "");
const webhookSecret = process.env.WHATSAPP_INTERNAL_WEBHOOK_SECRET;
const isEnabled = (flags, service) => {
    if (!flags || typeof flags !== "object" || Array.isArray(flags)) {
        return false;
    }
    const whatsapp = flags.whatsapp;
    if (!whatsapp || typeof whatsapp !== "object" || Array.isArray(whatsapp)) {
        return false;
    }
    const enabled = whatsapp.enabled;
    return (!!enabled &&
        typeof enabled === "object" &&
        !Array.isArray(enabled) &&
        enabled[service] === true);
};
const emit = async (schoolId, service, recipients) => {
    if (!schedulerUrl ||
        !webhookSecret ||
        recipients.length === 0) {
        return;
    }
    const school = await config_1.prisma.school.findUnique({
        where: { id: schoolId },
        select: { featureFlags: true },
    });
    if (!school || !isEnabled(school.featureFlags, service)) {
        return;
    }
    try {
        const response = await fetch(`${schedulerUrl}/events`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-internal-webhook-secret": webhookSecret,
            },
            body: JSON.stringify({ schoolId, service, recipients }),
        });
        if (!response.ok) {
            console.error("WhatsApp event delivery failed", {
                schoolId,
                service,
                status: response.status,
            });
        }
    }
    catch (error) {
        console.error("WhatsApp scheduler is unavailable", {
            schoolId,
            service,
            error: error instanceof Error ? error.message : error,
        });
    }
};
const emitStudentWhatsAppEvent = async ({ schoolId, service, studentIds, parameters, }) => {
    try {
        const students = await config_1.prisma.student.findMany({
            where: { schoolId, id: { in: studentIds } },
            select: {
                id: true,
                name: true,
                parentLinks: {
                    where: { parentUser: { isActive: true } },
                    select: { parentUser: { select: { phone: true } } },
                },
            },
        });
        const recipients = students.flatMap((student) => student.parentLinks
            .filter((link) => !!link.parentUser.phone)
            .map((link) => ({
            phone: link.parentUser.phone,
            parameters: parameters(student),
        })));
        await emit(schoolId, service, recipients);
    }
    catch (error) {
        console.error("Could not prepare WhatsApp student event", {
            schoolId,
            service,
            error: error instanceof Error ? error.message : error,
        });
    }
};
exports.emitStudentWhatsAppEvent = emitStudentWhatsAppEvent;
const emitPrincipalWhatsAppEvent = async ({ schoolId, service, parameters, }) => {
    try {
        const principals = await config_1.prisma.user.findMany({
            where: {
                schoolId,
                role: "PRINCIPAL",
                isActive: true,
                phone: { not: null },
            },
            select: { phone: true },
        });
        await emit(schoolId, service, principals.map((principal) => ({
            phone: principal.phone,
            parameters,
        })));
    }
    catch (error) {
        console.error("Could not prepare WhatsApp principal event", {
            schoolId,
            service,
            error: error instanceof Error ? error.message : error,
        });
    }
};
exports.emitPrincipalWhatsAppEvent = emitPrincipalWhatsAppEvent;
