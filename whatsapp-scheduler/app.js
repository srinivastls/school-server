
require("dotenv").config();

const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();

app.use(express.json({ limit: "20kb" }));

// --------------------------------------------------
// Configuration
// --------------------------------------------------

const PORT = Number(process.env.PORT || 3000);

const SCHOOL_API_BASE_URL =
  process.env.SCHOOL_API_BASE_URL;

const SCHOOL_API_TOKEN =
  process.env.SCHOOL_API_TOKEN;

const WHATSAPP_TOKEN =
  process.env.WHATSAPP_TOKEN;

const PHONE_NUMBER_ID =
  process.env.PHONE_NUMBER_ID;

const GRAPH_API_VERSION =
  process.env.GRAPH_API_VERSION || "v25.0";

const DEFAULT_TEMPLATE_LANGUAGE =
  process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en";

const INTERNAL_WEBHOOK_SECRET =
  process.env.INTERNAL_WEBHOOK_SECRET;

if (!SCHOOL_API_BASE_URL) {
  throw new Error("SCHOOL_API_BASE_URL is required");
}

// --------------------------------------------------
// School API client
// Uses the same x-access-token header as your app
// --------------------------------------------------

const schoolApi = axios.create({
  baseURL: SCHOOL_API_BASE_URL.replace(/\/+$/, ""),
  timeout: 50000,
  headers: {
    "Content-Type": "application/json",
  },
});

schoolApi.interceptors.request.use((config) => {
  if (SCHOOL_API_TOKEN) {
    config.headers["x-access-token"] = SCHOOL_API_TOKEN;
  }

  return config;
});

// --------------------------------------------------
// WhatsApp Cloud API client
// --------------------------------------------------

const whatsappApi = axios.create({
  baseURL: `https://graph.facebook.com/${GRAPH_API_VERSION}`,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// --------------------------------------------------
// Health check
// --------------------------------------------------

app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "school-whatsapp-service",
    status: "running",
  });
});

// --------------------------------------------------
// Test school API connection
// GET /test-school-api
// --------------------------------------------------

app.get("/test-school-api", async (req, res) => {
  try {
    const response = await schoolApi.get(
      "/academic-year/current"
    );

    res.json({
      success: true,
      message: "School API connection successful",
      data: response.data,
    });
  } catch (error) {
    const status = error.response?.status;

    console.error("School API request failed:", {
      status: status || null,
      message: error.message,
    });

    res.status(502).json({
      success: false,
      message: "Could not retrieve academic year",
      upstreamStatus: status || null,
    });
  }
});



app.post("/send-academic-year-whatsapp", async (req, res) => {
  try {
    const { recipient } = req.body || {};

    if (!recipient) {
      return res.status(400).json({
        success: false,
        message: "recipient is required",
      });
    }

    // Get the current academic year from your school backend.
    const response = await schoolApi.get(
      "/academic-year/current"
    );

    const academicYear = response.data;

    if (
      !academicYear?.name ||
      !academicYear?.startDate ||
      !academicYear?.endDate
    ) {
      return res.status(502).json({
        success: false,
        message: "Academic-year data is incomplete",
      });
    }

    // Format dates in India time.
    const formatDate = (dateString) =>
      new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(new Date(dateString));

    // const result = await sendSchoolTemplate({
    //   recipient,
    //   templateName: "school_academic_year_update",
    //   language: "en",
    //   parameters: [
    //     academicYear.name,
    //     formatDate(academicYear.startDate),
    //     formatDate(academicYear.endDate),
    //   ],
    // });

    const result = await sendSchoolTemplate({
  recipient,
  templateName: "school_academic_year_update",
  language: "en_US",
  parameters: [
    academicYear.name,
    formatDate(academicYear.startDate),
    formatDate(academicYear.endDate),
  ],
});

    return res.json({
      success: true,
      message: "Academic-year WhatsApp message submitted",
      academicYear: academicYear.name,
      messageId: result.messageId,
    });
  } catch (error) {
  console.error("Academic-year WhatsApp failed:", {
    status: error.response?.status ?? null,
    url: error.config?.url ?? null,
    method: error.config?.method ?? null,
    response: error.response?.data ?? null,
    message: error.message,
  });

  return res.status(502).json({
    success: false,
    message: "Academic-year WhatsApp request failed",
    upstreamStatus: error.response?.status ?? null,
    failedRequest: error.config?.url ?? null,
  });
}
});


// --------------------------------------------------
// Send an approved WhatsApp template
// --------------------------------------------------

async function sendSchoolTemplate({
  recipient,
  templateName,
  language = DEFAULT_TEMPLATE_LANGUAGE,
  parameters = [],
}) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    throw new Error(
      "WhatsApp credentials are not configured"
    );
  }

  if (!recipient || !templateName) {
    throw new Error(
      "Recipient and templateName are required"
    );
  }

  // Expect an international-format number, digits only.
  const normalizedRecipient = String(recipient).replace(
    /[+\s()-]/g,
    ""
  );

  if (!/^\d{8,15}$/.test(normalizedRecipient)) {
    throw new Error(
      "Recipient must be a valid international phone number"
    );
  }

  const bodyParameters = parameters.map((value) => ({
    type: "text",
    text: String(value),
  }));

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizedRecipient,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: language,
      },
      ...(bodyParameters.length > 0
        ? {
            components: [
              {
                type: "body",
                parameters: bodyParameters,
              },
            ],
          }
        : {}),
    },
  };

  const response = await whatsappApi.post(
    `/${PHONE_NUMBER_ID}/messages`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      },
    }
  );

  return {
    messageId: response.data.messages?.[0]?.id || null,
    status: "submitted",
  };
}

const TEMPLATE_DEFINITIONS = {
  academicYear: {
    key: "academicYear",
    name: "school_academic_year_update",
    fields: [],
  },
  studentAttendance: {
    key: "studentAttendance",
    name: "student_attendance_update",
    fields: ["studentName", "status", "date"],
  },
  studentMarks: {
    key: "studentMarks",
    name: "student_marks_update",
    fields: ["studentName", "subject", "marks", "maximumMarks"],
  },
  schoolAnnouncement: {
    key: "schoolAnnouncement",
    name: "school_announcement",
    fields: ["title", "details", "effectiveDate"],
  },
  feeDueReminder: {
    key: "feeDueReminder",
    name: "school_fee_due_reminder",
    fields: ["studentName", "amount", "dueDate"],
  },
  feePaymentReceipt: {
    key: "feePaymentReceipt",
    name: "school_fee_payment_receipt",
    fields: ["studentName", "amount", "receiptNumber", "paymentDate", "paymentMode"],
  },
  principalStudentAttendance: {
    key: "principalStudentAttendance",
    name: "principal_student_attendance_daily",
    fields: ["date", "summary"],
  },
  principalTeacherAttendance: {
    key: "principalTeacherAttendance",
    name: "principal_teacher_attendance_daily",
    fields: ["date", "summary"],
  },
  principalFeeCollection: {
    key: "principalFeeCollection",
    name: "principal_fee_collection_daily",
    fields: ["date", "amount", "paymentCount"],
  },
};

function missingFields(body, fields) {
  return fields.filter((field) => {
    const value = body?.[field];
    return value === undefined || value === null || String(value).trim() === "";
  });
}

function sendTemplateEndpoint(templateDefinition) {
  return async (req, res) => {
    try {
      const body = req.body || {};
      const missing = missingFields(body, [
        "recipient",
        ...templateDefinition.fields,
      ]);

      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Required fields are missing",
          fields: missing,
        });
      }

      const result = await sendSchoolTemplate({
        recipient: body.recipient,
        templateName: templateDefinition.name,
        language: body.language,
        parameters: templateDefinition.fields.map((field) => body[field]),
      });

      return res.json({
        success: true,
        templateName: templateDefinition.name,
        ...result,
      });
    } catch (error) {
      const status = error.response?.status;
      const isValidationError =
        error.message.includes("Recipient") ||
        error.message.includes("credentials");

      console.error("WhatsApp template send failed:", {
        templateName: templateDefinition.name,
        status: status || null,
        message: error.message,
        metaErrorCode: error.response?.data?.error?.code || null,
      });

      return res.status(isValidationError ? 400 : 502).json({
        success: false,
        message: isValidationError
          ? error.message
          : "WhatsApp message could not be submitted",
        upstreamStatus: status || null,
      });
    }
  };
}

app.get("/templates", (req, res) => {
  res.json({
    success: true,
    templates: Object.entries(TEMPLATE_DEFINITIONS).map(([key, definition]) => ({
      key,
      name: definition.name,
      fields: ["recipient", ...definition.fields],
    })),
  });
});

function hasValidWebhookSecret(req) {
  if (!INTERNAL_WEBHOOK_SECRET) {
    return false;
  }

  const provided = req.get("x-internal-webhook-secret") || "";
  const expected = Buffer.from(INTERNAL_WEBHOOK_SECRET);
  const actual = Buffer.from(provided);

  return (
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual)
  );
}

app.post("/events", async (req, res) => {
  if (!hasValidWebhookSecret(req)) {
    return res.status(401).json({
      success: false,
      message: "Invalid internal webhook credentials",
    });
  }

  const { service, schoolId, recipients, language } = req.body || {};
  const definition = Object.values(TEMPLATE_DEFINITIONS).find(
    (item) => item.key === service || item.name === service
  );

  if (
    !schoolId ||
    !definition ||
    !Array.isArray(recipients) ||
    recipients.length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: "schoolId, service and a non-empty recipients array are required",
    });
  }

  const results = await Promise.allSettled(
    recipients.map((recipient) =>
      sendSchoolTemplate({
        recipient: recipient.phone,
        templateName: definition.name,
        language: recipient.language || language,
        parameters: recipient.parameters,
      })
    )
  );
  const sent = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - sent;

  if (failed > 0) {
    console.error("WhatsApp event partially failed:", {
      schoolId,
      service: definition.name,
      sent,
      failed,
    });
  }

  return res.status(failed === results.length ? 502 : 202).json({
    success: failed === 0,
    schoolId,
    service: definition.name,
    sent,
    failed,
  });
});

app.post("/send-template", async (req, res) => {
  try {
    const {
      recipient,
      templateName,
      language,
      parameters,
    } = req.body || {};

    if (
      !recipient ||
      !templateName ||
      !Array.isArray(parameters)
    ) {
      return res.status(400).json({
        success: false,
        message: "recipient, templateName and a parameters array are required",
      });
    }

    const result = await sendSchoolTemplate({
      recipient,
      templateName,
      language,
      parameters,
    });

    return res.json({
      success: true,
      templateName,
      ...result,
    });
  } catch (error) {
    const status = error.response?.status;

    console.error("WhatsApp template send failed:", {
      status: status || null,
      message: error.message,
      metaErrorCode: error.response?.data?.error?.code || null,
    });

    return res.status(status ? 502 : 400).json({
      success: false,
      message: status
        ? "WhatsApp message could not be submitted"
        : error.message,
      upstreamStatus: status || null,
    });
  }
});

app.post(
  "/send-student-attendance-whatsapp",
  sendTemplateEndpoint(TEMPLATE_DEFINITIONS.studentAttendance)
);
app.post(
  "/send-student-marks-whatsapp",
  sendTemplateEndpoint(TEMPLATE_DEFINITIONS.studentMarks)
);
app.post(
  "/send-school-announcement-whatsapp",
  sendTemplateEndpoint(TEMPLATE_DEFINITIONS.schoolAnnouncement)
);
app.post(
  "/send-school-fee-due-reminder-whatsapp",
  sendTemplateEndpoint(TEMPLATE_DEFINITIONS.feeDueReminder)
);
app.post(
  "/send-school-fee-payment-receipt-whatsapp",
  sendTemplateEndpoint(TEMPLATE_DEFINITIONS.feePaymentReceipt)
);
app.post(
  "/send-principal-student-attendance-daily-whatsapp",
  sendTemplateEndpoint(TEMPLATE_DEFINITIONS.principalStudentAttendance)
);
app.post(
  "/send-principal-teacher-attendance-daily-whatsapp",
  sendTemplateEndpoint(TEMPLATE_DEFINITIONS.principalTeacherAttendance)
);
app.post(
  "/send-principal-fee-collection-daily-whatsapp",
  sendTemplateEndpoint(TEMPLATE_DEFINITIONS.principalFeeCollection)
);

// --------------------------------------------------
// Send a test WhatsApp template
//
// POST /test-whatsapp
//
// JSON body:
// {
//   "recipient": "91XXXXXXXXXX",
//   "templateName": "your_approved_template",
//   "language": "en",
//   "parameters": ["Example 1", "Example 2"]
// }
// --------------------------------------------------

app.post("/test-whatsapp", async (req, res) => {
  try {
    const {
      recipient,
      templateName,
      language,
      parameters = [],
    } = req.body || {};

    if (
      !recipient ||
      !templateName ||
      !Array.isArray(parameters)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "recipient, templateName and a parameters array are required",
      });
    }

    const result = await sendSchoolTemplate({
      recipient,
      templateName,
      language,
      parameters,
    });

    return res.json({
      success: true,
      message:
        "WhatsApp message submitted to Meta",
      ...result,
    });
  } catch (error) {
    const status = error.response?.status;

    // Do not return Meta's full error body or credentials
    // to callers of this endpoint.
    console.error("WhatsApp send failed:", {
      status: status || null,
      message: error.message,
      metaErrorCode:
        error.response?.data?.error?.code || null,
    });

    return res.status(502).json({
      success: false,
      message: "WhatsApp message could not be submitted",
      upstreamStatus: status || null,
    });
  }
});

// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(
    `School WhatsApp service listening on port ${PORT}`
  );
});
