"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateWhatsAppSettings = exports.getWhatsAppSettings = exports.WHATSAPP_SERVICES = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
exports.WHATSAPP_SERVICES = [
    "student_attendance",
    "student_marks",
    "announcements",
    "fee_due_reminders",
    "fee_payment_receipts",
    "principal_student_attendance",
    "principal_teacher_attendance",
    "principal_fee_collection",
];
const getSettings = (featureFlags) => {
    const flags = featureFlags && typeof featureFlags === "object"
        ? featureFlags
        : {};
    const configured = flags.whatsapp;
    const enabled = configured && typeof configured === "object"
        ? configured.enabled
        : {};
    return {
        enabled: Object.fromEntries(exports.WHATSAPP_SERVICES.map((service) => [
            service,
            enabled &&
                typeof enabled === "object" &&
                enabled[service] === true,
        ])),
    };
};
const parseEnabled = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("enabled must be an object");
    }
    const input = value;
    const unknownServices = Object.keys(input).filter((service) => !exports.WHATSAPP_SERVICES.includes(service));
    if (unknownServices.length > 0) {
        throw new Error(`Unknown WhatsApp service: ${unknownServices[0]}`);
    }
    return Object.fromEntries(Object.entries(input).map(([service, enabled]) => {
        if (typeof enabled !== "boolean") {
            throw new Error(`${service} must be a boolean`);
        }
        return [service, enabled];
    }));
};
const getWhatsAppSettings = async (req, res) => {
    try {
        const school = await config_1.prisma.school.findUnique({
            where: { id: req.params.schoolId },
            select: { id: true, name: true, featureFlags: true },
        });
        if (!school) {
            return res.status(404).json({ message: "School not found" });
        }
        return res.json({
            schoolId: school.id,
            schoolName: school.name,
            services: exports.WHATSAPP_SERVICES,
            ...getSettings(school.featureFlags),
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.getWhatsAppSettings = getWhatsAppSettings;
const updateWhatsAppSettings = async (req, res) => {
    try {
        const enabled = parseEnabled(req.body?.enabled);
        const school = await config_1.prisma.school.findUnique({
            where: { id: req.params.schoolId },
            select: { id: true, name: true, featureFlags: true },
        });
        if (!school) {
            return res.status(404).json({ message: "School not found" });
        }
        const flags = school.featureFlags &&
            typeof school.featureFlags === "object" &&
            !Array.isArray(school.featureFlags)
            ? school.featureFlags
            : {};
        const whatsapp = flags.whatsapp &&
            typeof flags.whatsapp === "object" &&
            !Array.isArray(flags.whatsapp)
            ? flags.whatsapp
            : {};
        const currentEnabled = whatsapp.enabled &&
            typeof whatsapp.enabled === "object" &&
            !Array.isArray(whatsapp.enabled)
            ? whatsapp.enabled
            : {};
        const updated = await config_1.prisma.school.update({
            where: { id: school.id },
            data: {
                featureFlags: {
                    ...flags,
                    whatsapp: {
                        ...whatsapp,
                        enabled: {
                            ...currentEnabled,
                            ...enabled,
                        },
                    },
                },
            },
            select: { id: true, name: true, featureFlags: true },
        });
        return res.json({
            schoolId: updated.id,
            schoolName: updated.name,
            services: exports.WHATSAPP_SERVICES,
            ...getSettings(updated.featureFlags),
        });
    }
    catch (error) {
        if (error instanceof Error && error.message.includes("must be")) {
            return res.status(400).json({ message: error.message });
        }
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.updateWhatsAppSettings = updateWhatsAppSettings;
