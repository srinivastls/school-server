import { prisma } from "../config";

type WhatsAppService =
  | "student_attendance"
  | "student_marks"
  | "announcements"
  | "fee_due_reminders"
  | "fee_payment_receipts"
  | "principal_student_attendance"
  | "principal_teacher_attendance"
  | "principal_fee_collection";

type Recipient = {
  phone: string;
  parameters: Array<string | number>;
};

const schedulerUrl = process.env.WHATSAPP_SCHEDULER_URL?.replace(/\/+$/, "");
const webhookSecret = process.env.WHATSAPP_INTERNAL_WEBHOOK_SECRET;

const isEnabled = (flags: unknown, service: WhatsAppService) => {
  if (!flags || typeof flags !== "object" || Array.isArray(flags)) {
    return false;
  }
  const whatsapp = (flags as Record<string, unknown>).whatsapp;
  if (!whatsapp || typeof whatsapp !== "object" || Array.isArray(whatsapp)) {
    return false;
  }
  const enabled = (whatsapp as Record<string, unknown>).enabled;
  return (
    !!enabled &&
    typeof enabled === "object" &&
    !Array.isArray(enabled) &&
    (enabled as Record<string, unknown>)[service] === true
  );
};

const emit = async (
  schoolId: string,
  service: WhatsAppService,
  recipients: Recipient[]
) => {
  if (
    !schedulerUrl ||
    !webhookSecret ||
    recipients.length === 0
  ) {
    return;
  }

  const school = await prisma.school.findUnique({
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
  } catch (error) {
    console.error("WhatsApp scheduler is unavailable", {
      schoolId,
      service,
      error: error instanceof Error ? error.message : error,
    });
  }
};

export const emitStudentWhatsAppEvent = async ({
  schoolId,
  service,
  studentIds,
  parameters,
}: {
  schoolId: string;
  service: "student_attendance" | "student_marks" | "fee_payment_receipts";
  studentIds: string[];
  parameters: (student: { id: string; name: string }) => Array<string | number>;
}) => {
  try {
    const students = await prisma.student.findMany({
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

    const recipients = students.flatMap((student) =>
      student.parentLinks
        .filter((link) => !!link.parentUser.phone)
        .map((link) => ({
          phone: link.parentUser.phone as string,
          parameters: parameters(student),
        }))
    );

    await emit(schoolId, service, recipients);
  } catch (error) {
    console.error("Could not prepare WhatsApp student event", {
      schoolId,
      service,
      error: error instanceof Error ? error.message : error,
    });
  }
};

export const emitPrincipalWhatsAppEvent = async ({
  schoolId,
  service,
  parameters,
}: {
  schoolId: string;
  service:
    | "principal_student_attendance"
    | "principal_teacher_attendance"
    | "principal_fee_collection";
  parameters: Array<string | number>;
}) => {
  try {
    const principals = await prisma.user.findMany({
      where: {
        schoolId,
        role: "PRINCIPAL",
        isActive: true,
        phone: { not: null },
      },
      select: { phone: true },
    });

    await emit(
      schoolId,
      service,
      principals.map((principal) => ({
        phone: principal.phone as string,
        parameters,
      }))
    );
  } catch (error) {
    console.error("Could not prepare WhatsApp principal event", {
      schoolId,
      service,
      error: error instanceof Error ? error.message : error,
    });
  }
};
