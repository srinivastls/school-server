import { Request, Response } from "express";
import { prisma } from "../config";
import { handleErr } from "../utils";

export const WHATSAPP_SERVICES = [
  "student_attendance",
  "student_marks",
  "announcements",
  "fee_due_reminders",
  "fee_payment_receipts",
  "principal_student_attendance",
  "principal_teacher_attendance",
  "principal_fee_collection",
] as const;

type WhatsAppService = (typeof WHATSAPP_SERVICES)[number];

const getSettings = (featureFlags: unknown) => {
  const flags =
    featureFlags && typeof featureFlags === "object"
      ? (featureFlags as Record<string, unknown>)
      : {};
  const configured = flags.whatsapp;
  const enabled =
    configured && typeof configured === "object"
      ? (configured as Record<string, unknown>).enabled
      : {};

  return {
    enabled: Object.fromEntries(
      WHATSAPP_SERVICES.map((service) => [
        service,
        enabled &&
        typeof enabled === "object" &&
        (enabled as Record<string, unknown>)[service] === true,
      ])
    ),
  };
};

const parseEnabled = (value: unknown): Partial<Record<WhatsAppService, boolean>> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("enabled must be an object");
  }

  const input = value as Record<string, unknown>;
  const unknownServices = Object.keys(input).filter(
    (service) => !WHATSAPP_SERVICES.includes(service as WhatsAppService)
  );
  if (unknownServices.length > 0) {
    throw new Error(`Unknown WhatsApp service: ${unknownServices[0]}`);
  }

  return Object.fromEntries(
    Object.entries(input).map(([service, enabled]) => {
      if (typeof enabled !== "boolean") {
        throw new Error(`${service} must be a boolean`);
      }
      return [service, enabled];
    })
  ) as Partial<Record<WhatsAppService, boolean>>;
};

export const getWhatsAppSettings = async (
  req: Request,
  res: Response
) => {
  try {
    const school = await prisma.school.findUnique({
      where: { id: req.params.schoolId },
      select: { id: true, name: true, featureFlags: true },
    });

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    return res.json({
      schoolId: school.id,
      schoolName: school.name,
      services: WHATSAPP_SERVICES,
      ...getSettings(school.featureFlags),
    });
  } catch (error) {
    return handleErr(error, res);
  }
};

export const updateWhatsAppSettings = async (
  req: Request,
  res: Response
) => {
  try {
    const enabled = parseEnabled(req.body?.enabled);
    const school = await prisma.school.findUnique({
      where: { id: req.params.schoolId },
      select: { id: true, name: true, featureFlags: true },
    });

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    const flags =
      school.featureFlags &&
      typeof school.featureFlags === "object" &&
      !Array.isArray(school.featureFlags)
        ? (school.featureFlags as Record<string, unknown>)
        : {};
    const whatsapp =
      flags.whatsapp &&
      typeof flags.whatsapp === "object" &&
      !Array.isArray(flags.whatsapp)
        ? (flags.whatsapp as Record<string, unknown>)
        : {};
    const currentEnabled =
      whatsapp.enabled &&
      typeof whatsapp.enabled === "object" &&
      !Array.isArray(whatsapp.enabled)
        ? (whatsapp.enabled as Record<string, unknown>)
        : {};

    const updated = await prisma.school.update({
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
      services: WHATSAPP_SERVICES,
      ...getSettings(updated.featureFlags),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("must be")) {
      return res.status(400).json({ message: error.message });
    }
    return handleErr(error, res);
  }
};
