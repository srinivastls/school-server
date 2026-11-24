# Oxford EMUP School Server

This document is the maintained, repository-level guide to the server. It
describes the runtime, source layout, request flow, authentication model,
database model, operational jobs, import/export behavior, configuration,
development commands, and the complete source inventory. The generated
TypeDoc site remains the detailed symbol reference for exported TypeScript
members.

## 1. Product and responsibilities

The server is an Express and TypeScript API for a multi-tenant school
management platform. A tenant is a `School`. The application supports:

- platform administration and school onboarding;
- school users, roles, profiles, and authentication;
- academic years, classes, sections, subjects, and teacher mappings;
- student records, parent links, promotion, transfer certificates, and ID
  cards;
- student and teacher attendance, leave, dashboards, and reports;
- examinations, exam subjects, timetables, marks, results, report cards, and
  performance trends;
- coupons, fees, transactions, and payment reports;
- announcements, notifications, complaints, and audit history;
- bulk import/export of school data;
- school data lifecycle operations and automatic backups;
- optional Google Drive backup storage; and
- an independent WhatsApp scheduler under `whatsapp-scheduler/`.

The API is stateful only through PostgreSQL and external storage. The
application process itself should be treated as disposable: all durable
business data belongs in PostgreSQL, while generated exports belong in the
configured export directory and/or Google Drive.

## 2. Runtime architecture

```text
HTTP request
  -> Express middleware (CORS, JSON, URL encoded bodies)
  -> route registration in index.ts
  -> authentication/authorization middleware
  -> controller
  -> service/helper logic
  -> Prisma Client or parameterized PostgreSQL query
  -> JSON, file, or generated report response
```

### Startup sequence

1. `index.ts` creates the Express application.
2. CORS, JSON parsing, URL-encoded parsing, and the access-header response
   middleware are installed.
3. The root health endpoint is registered.
4. Every route registration function from `routes/` is called.
5. The OpenAPI document is built from the registered Express route stack.
6. `/api-docs.json` and Swagger UI at `/api-docs` are registered.
7. Prisma connects to PostgreSQL and executes `SELECT 1`.
8. The server listens on `0.0.0.0` and the configured port.

If database connection or the health query fails, startup logs the error,
disconnects Prisma, and exits with status 1. The backup scheduler call is
present but intentionally commented out in the current bootstrap code; enable
it only when the deployment is ready for automatic backups.

### Built-in endpoints

| Endpoint | Purpose |
|---|---|
| `GET /` | Returns `Oxford EMUP - <DEPLOY_ENV>` |
| `GET /api-docs` | Interactive Swagger UI |
| `GET /api-docs.json` | Runtime-generated OpenAPI 3.0.3 document |

The OpenAPI generator discovers routes from Express internals. It converts
`:parameter` segments to `{parameter}`, marks routes containing the
`verifyToken` handler as bearer-protected, and provides generic 200, 400, 401,
and 500 responses. It does not infer detailed request or response schemas;
use controller behavior and TypeDoc for those details.

## 3. Authentication and authorization

### Token transport

Clients send the JWT in the `x-access-token` header. The token is verified with
the secret configured in `config/auth.config.ts`. A valid payload must contain
`id` and may contain `schoolId`, `schoolCode`, `role`, and `type`.

The middleware attaches both `req.userId` and `req.user`:

- `type: "PLATFORM_ADMIN"` identifies a platform-level identity.
- `type: "SCHOOL_USER"` identifies a school tenant identity.
- `role` is the Prisma `RoleName` value for school users.

The project README also describes an `Authorization: Bearer <token>` workflow
for Swagger. Verify the route middleware in the target deployment before
relying on that header: the current `verifyToken` implementation reads
`x-access-token`.

### Token outcomes

| Condition | Status | Code |
|---|---:|---|
| Header absent | 403 | `TOKEN_MISSING` |
| JWT expired | 401 | `TOKEN_EXPIRED` |
| JWT malformed or invalid | 401 | `INVALID_TOKEN` |
| Decoded token has no `id` | 401 | `INVALID_TOKEN` |
| User/platform identity missing | 401/403 | `Unauthorized` or role-specific message |

### Authorization layers

- `verifyToken` validates the signature and creates request identity.
- `isSuperAdmin` requires a platform-admin token, an active
  `PlatformAdmin`, and the `PLATFORM_ADMIN` platform role.
- `getAuthenticatedSchoolUser` loads the user from PostgreSQL, rejects missing
  or inactive users, and refreshes the request's school-user context.
- Role-specific middleware enforces principal, teacher, parent, admin, and
  related permissions.
- Tenant-scoped controllers must use the authenticated `schoolId` when
  reading or writing school data.

Never put JWT secrets, database URLs, service-account keys, or API tokens in
source control. The current secret is a source-level default and should be
externalized before production use.

## 4. Source layout

### Application entry and configuration

| Path | Responsibility |
|---|---|
| `index.ts` | Express construction, middleware, route registration, Swagger, startup |
| `config/index.ts` | Re-exports configuration modules |
| `config/auth.config.ts` | JWT authentication configuration |
| `config/prisma.config.ts` | Singleton Prisma Client and environment loading |
| `prisma.config.ts` | Root Prisma configuration entry point |
| `utils.ts` | Shared top-level utility exports |
| `utils/index.ts` | Utility barrel |
| `utils/attendanceDate.ts` | Attendance date helpers |
| `utils/paymentMode.ts` | Payment mode helpers |
| `docs/openapi.ts` | Runtime OpenAPI document generation |
| `models/models.ts` | Model-name enum used by model-oriented code |

### Route modules

Every route module exports a `use...Routes(app)` registration function. The
route module selects middleware and controller handlers; controllers contain
the request-level business logic.

| Route module | Domain |
|---|---|
| `auth.routes.ts` | Login, token/session authentication |
| `user.routes.ts` | Users and school staff |
| `platform.routes.ts` | Platform administration and onboarding |
| `academicYear.routes.ts` | Academic years |
| `class.routes.ts` | Classes |
| `section` routes in `class.routes.ts` and related controllers | Sections |
| `classTeacher.routes.ts` | Class-teacher assignment |
| `subject.routes.ts` | Subjects |
| `teacherStudentMapping.routes.ts` | Teacher-subject mappings |
| `student.routes.ts` | Student records |
| `studentPromotion.routes.ts` | Promotion between academic years |
| `parent.routes.ts` | Parent-facing student operations |
| `parentResults.routes.ts` | Parent result views |
| `attendance.routes.ts` | Student attendance |
| `attendance` dashboard/report handlers | Attendance analytics and reports |
| `teacherAttendance.routes.ts` | Teacher attendance |
| `adminAttendanceLeave.routes.ts` | Administrative attendance and leave |
| `leave.routes.ts` | School leave requests |
| `teacherLeave.routes.ts` | Teacher leave workflows |
| `teacherMarks.routes.ts` | Teacher mark entry |
| `teacherProfile.routes.ts` | Teacher profiles |
| `teacherTimetable.routes.ts` | Teacher timetable |
| `teacherStudentPerformanceTrend.routes.ts` | Teacher performance trends |
| `teacherReportCardRoutes.ts` | Teacher report cards |
| `principal.routes.ts` | Principal operations |
| `principalTimetable.routes.ts` | Principal timetable administration |
| `principalExam.routes.ts` | Exams |
| `principalExamSubject.routes.ts` | Exam subjects |
| `principalExamTimetable.routes.ts` | Exam timetable |
| `principalResults.routes.ts` | Principal result management |
| `principalReportCard.routes.ts` | Principal report cards |
| `principalReportCardAnalytics.routes.ts` | Report-card analytics |
| `principalStudentPerformanceTrend.routes.ts` | Principal performance trends |
| `transaction.routes.ts` | Transactions and fees |
| `coupon.routes.ts` | Coupons |
| `report.routes.ts` | General reports |
| `adminDashboard.routes.ts` | Administrative dashboard |
| `bulkImport.routes.ts` | Legacy/direct bulk import |
| `bulkImportSession.routes.ts` | Import session lifecycle |
| `persistentBulkImportSession.routes.ts` | Persistent import sessions |
| `bulkImportExport.routes.ts` | Metadata, staged import, export |

### Student ID cards

`POST /api/student/:studentId/id-card` generates an inline PDF ID card for a
student in the authenticated school. The optional `academicYearId` may be
provided in a multipart form body; when omitted, the current academic year is
used. An optional `photo` multipart field accepts JPEG, PNG, or WebP images up
to 5 MB. The photo is uploaded to Google Drive and its direct view URL is
stored in `students.photo_url`.
The generated card is recorded in `id_cards`, older active cards for the
student are deactivated, and the response is returned as `application/pdf`.
This endpoint requires a principal or admin school-user token.

`POST /api/students/id-cards/bulk` accepts a JSON body containing
`studentIds` (1-200 IDs) and an optional `academicYearId`. It returns one PDF
containing all requested cards and records each generated card in `id_cards`.

For exact paths, HTTP methods, middleware order, and handler names, use the
live `/api-docs.json` generated from the current route registration. This
avoids stale hand-maintained endpoint lists when a route changes.

The source tree contains a few route/controller modules that are not currently
called by `index.ts`: `persistentBulkImportSession.routes.ts` is not exported
from the route barrel, and the standalone `teacher.routes.ts` module is not
registered by the bootstrap. `adminLeave.controller.ts` and
`adminTeacherAttendance.controller.ts` are used by the administrative
workflow files where imported, but their names do not imply an additional
top-level route group. Treat `index.ts` and the live OpenAPI document as the
authoritative definition of deployed endpoints.

### Controllers

The controller layer is intentionally split by business role and workflow:

`academicYear`, `adminDashboard`, `adminLeave`, `adminTeacherAttendance`,
`attendance`, `attendanceDashboard`, `attendanceReports`, `auth`,
`bulkImport`, `bulkImportExportController`, `bulkImportSession`, `class`,
`classTeacher`, `coupon`, `leave`, `parent`, `parentResults`,
`persistentBulkImportSession`, `platform`, `platformDataLifecycle`, `principal`,
`principalExam`, `principalExamSubject`, `principalExamTimetable`,
`principalReportCardAnalyticsControllers`, `principalReportCardControllers`,
`principalResults`, `principalStudentPerformanceTrendControllers`,
`principalTimetable`, `report`, `section`, `student`, `studentPromotion`,
`subject`, `teacher`, `teacherAttendance`, `teacherLeave`, `teacherMarks`,
`teacherProfile`, `teacherReportCardControllers`,
`teacherStudentMapping`, `teacherStudentPerformanceTrendControllers`,
`teacherTimetable`, `transaction`, and `user`.

`controllers/index.ts` is the controller barrel. File names ending in
`Controllers` or `controllers` are plural because they group related
principal/teacher report operations rather than represent a single class.

### Services

| Service | Responsibility |
|---|---|
| `backupScheduler.service.ts` | Every-three-hours backup orchestration with overlap protection |
| `schoolDataLifecycle.service.ts` | School export, checksum, retention, restore/lifecycle operations |
| `googleDrive.service.ts` | Optional Google Drive upload and deletion |
| `bulkAdapters.ts` | Import/export module definitions, fields, keys, conversions |
| `bulkImportExport.service.ts` | Validation, relation checks, staging, upsert-oriented bulk processing |
| `bulkImportExportService (3).ts` | Historical/alternate service copy; verify usage before modifying |
| `bulkImportSession.service.ts` | In-memory/session import workflow support |
| `persistentBulkImportSession.service.ts` | Database-backed import session persistence |
| `bulkTabular.service.ts` | Spreadsheet/tabular parsing and formatting |

The file with `(3)` in its name is a source artifact, not a recommended new
implementation target. Confirm imports before deleting or consolidating it.

### Type modules

The `types/` directory contains domain contracts for attendance, auth, class,
core entities, coupons, reports, students, transactions, and users.
`types/express.d.ts` augments Express request types with authenticated identity
fields. `types/index.ts` re-exports shared types.

## 5. Database documentation

Prisma uses PostgreSQL and reads `DATABASE_URL`; migrations may use
`SHADOW_DATABASE_URL`. The schema contains 35 persisted models and 32 enums.
All tenant-owned records are associated with `School` directly or through a
school-owned parent relation.

### Models

| Model | Purpose |
|---|---|
| `PlatformAdmin` | Platform-level administrators and onboarding ownership |
| `School` | Tenant, subscription, locale, limits, and feature flags |
| `AcademicYear` | School academic-year boundary and current-year marker |
| `User` | School staff identity, role, and profile |
| `Class` | Academic class/grade |
| `StudentAcademicEnrollment` | Student enrollment in an academic year |
| `Section` | Class section and class-teacher association |
| `Subject` | School/class subjects |
| `TeacherSubjectMapping` | Teacher, subject, class, and academic-year mapping |
| `Student` | Student demographic and academic record |
| `StudentParentLink` | Student-to-parent relationship |
| `RefreshSession` | Refresh-token/session persistence |
| `Coupon` | Coupon lifecycle and approval |
| `Transaction` | Financial transaction/payment record |
| `Attendance` | Student daily attendance |
| `TeacherAttendance` | Teacher daily attendance |
| `Exam` | Examination definition |
| `ExamSubject` | Subject included in an exam |
| `Mark` | Student marks for an exam subject |
| `Complaint` | Complaint submission, assignment, and status |
| `LeaveRequest` | Student/staff leave request and approval |
| `Timetable` | Regular class timetable |
| `ExamTimetable` | Exam schedule |
| `Announcement` | School announcements and target roles |
| `Notification` | User notifications |
| `TransferCertificate` | Student transfer certificate |
| `IDCardTemplate` | ID-card layout/template |
| `IDCard` | Generated student/teacher ID card |
| `AuditLog` | School audit trail |
| `SchoolOnboardingLog` | Platform onboarding audit trail |
| `StudentPromotion` | Promotion between academic years |
| `prisma_migrations_backup_20260827` | Migration backup bookkeeping |
| `bulk_import_sessions` | Bulk import session state |
| `SchoolDataOperation` | Export/restore/lifecycle operation state |
| `PlatformDataDeletionAudit` | Platform data deletion audit |

### Enums

`EnrollmentStatus`, `PromotionStatus`, `RoleName`, `StudentStatus`,
`CouponStatus`, `PaymentMode`, `AttendanceStatus`,
`TeacherAttendanceStatus`, `LeaveType`, `LeaveStatus`, `ExamType`,
`ComplaintCategory`, `ComplaintStatus`, `NotificationType`,
`AnnouncementTargetRole`, `SubscriptionPlan`, `FeatureFlag`,
`PlatformAdminRole`, `PlatformAuditAction`, `StudentParentRelationship`,
`TCReason`, `TCConduct`, `TCFeeClearanceStatus`, `IDCardType`,
`IDCardReissueReason`, `DayOfWeek`, `AuditAction`, `BulkImportSessionStatus`,
`BulkImportStatus`, `SchoolDataOperationType`, `SchoolDataOperationStatus`,
and `SchoolStatus`.

The authoritative field definitions, defaults, indexes, relation names,
database column mappings, and enum values are in
`prisma/schema.prisma`. Do not duplicate those definitions in application
documentation when implementing a schema change; update the schema and
regenerate the client.

## 6. Bulk import and export

The bulk data API is metadata-driven. `bulkAdapters.ts` defines supported
modules, writable/export-only behavior, fields, required-on-create fields,
unique keys, date/number/boolean conversion rules, and relation checks.

Import behavior:

1. Authenticate a school user and obtain `schoolId` and `userId`.
2. Parse a tabular upload.
3. Resolve headers directly or through known aliases.
4. Reject empty files, missing headers, unsupported modules, and more than
   10,000 rows.
5. Convert dates, numbers, booleans, and JSON fields.
6. Validate school-scoped foreign-key relations.
7. Identify existing records using adapter keys.
8. Require `requiredOnCreate` fields only for new records; partial updates may
   omit fields.
9. Stage or apply rows through the import session workflow.

Exports are generated as tabular data or ZIP archives depending on the
endpoint. Lifecycle exports use JSON-safe serialization, convert BigInt values
to strings, write a ZIP, calculate a SHA-256 checksum, and can upload the
result to Google Drive.

## 7. Backup and lifecycle operations

`startBackupScheduler()` schedules `* */3 * * *` in the
`Asia/Kolkata` timezone. It:

1. loads all schools;
2. runs an automatic backup for each school;
3. logs per-school success, skip, or failure;
4. cleans automatic backups older than 24 hours; and
5. prevents overlapping cycles with an in-process flag.

`stopBackupScheduler()` stops and clears the scheduled task. Scheduler state
is process-local, so multiple server replicas can run duplicate jobs unless
deployment coordination is added.

The export directory is `SCHOOL_EXPORT_DIR` when set, otherwise
`storage/school-exports` under the current working directory. Google Drive
requires the configured service-account email/private key and backup folder
ID. Keep those values in deployment secrets.

## 8. WhatsApp scheduler

`whatsapp-scheduler/` is a separate Node application, not part of the
TypeScript server build. It uses Express, Axios, SQLite, dotenv, and
node-cron. Its runtime configuration includes:

| Variable | Purpose |
|---|---|
| `PORT` | Scheduler HTTP port, default 3000 |
| `SCHOOL_API_BASE_URL` | School server base URL |
| `SCHOOL_API_TOKEN` | Token used to call the school API |
| `WHATSAPP_TOKEN` | Meta WhatsApp API token |
| `PHONE_NUMBER_ID` | WhatsApp phone number ID |
| `GRAPH_API_VERSION` | Graph API version, default `v25.0` |
| `WHATSAPP_TEMPLATE_LANGUAGE` | Template language, default `en` |
| `INTERNAL_WEBHOOK_SECRET` | Secret for authenticated school-server event delivery |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Used by template helper scripts |

The helper scripts `create-template.js` and `list-templates.js` manage
WhatsApp templates. The scheduler has its own `package.json` and lockfile;
install its dependencies from that directory rather than the root project.

The scheduler exposes `GET /health`, `GET /templates`, `GET /test-school-api`,
`POST /events`, `POST /send-template`, `POST /test-whatsapp`, and
`POST /send-academic-year-whatsapp`, plus the following typed send endpoints:

| Endpoint | Template |
|---|---|
| `POST /send-academic-year-whatsapp` | `school_academic_year_update` |
| `POST /send-student-attendance-whatsapp` | `student_attendance_update` |
| `POST /send-student-marks-whatsapp` | `student_marks_update` |
| `POST /send-school-announcement-whatsapp` | `school_announcement` |
| `POST /send-school-fee-due-reminder-whatsapp` | `school_fee_due_reminder` |
| `POST /send-school-fee-payment-receipt-whatsapp` | `school_fee_payment_receipt` |
| `POST /send-principal-student-attendance-daily-whatsapp` | `principal_student_attendance_daily` |
| `POST /send-principal-teacher-attendance-daily-whatsapp` | `principal_teacher_attendance_daily` |
| `POST /send-principal-fee-collection-daily-whatsapp` | `principal_fee_collection_daily` |

Typed endpoints accept `recipient` plus the fields listed by `GET /templates`.
The generic `POST /send-template` endpoint accepts `recipient`,
`templateName`, `language`, and a `parameters` array.

`POST /events` is intended for the Railway school server. It requires the
`x-internal-webhook-secret` header and accepts `schoolId`, a service key or
template name, and `recipients: [{ phone, parameters, language? }]`. The
school server must resolve parent/principal phone numbers and check the
school's enabled service flags before submitting an event.

Platform admins configure services per school with:

- `GET /api/platform/schools/:schoolId/whatsapp`
- `PATCH /api/platform/schools/:schoolId/whatsapp`

The patch body is `{ "enabled": { "<service>": true|false } }`. Updates are
partial, so omitted services keep their existing state. All services default to
disabled until explicitly enabled.

## 9. Configuration and environment

| Variable | Required for | Default/notes |
|---|---|---|
| `DATABASE_URL` | Prisma/PostgreSQL | No safe default |
| `SHADOW_DATABASE_URL` | Prisma migrations | Required by migration workflows |
| `PORT` | HTTP server | `3000` |
| `DEPLOY_ENV` | Root health response | `dev` |
| `API_BASE_URL` | OpenAPI server URL | `http://localhost:3000` |
| `NODE_ENV` | Prisma singleton behavior | Non-production caches the client globally |
| `SCHOOL_EXPORT_DIR` | Lifecycle export location | `storage/school-exports` |
| `GOOGLE_DRIVE_BACKUP_FOLDER_ID` | Google Drive backups | Optional |
| `GOOGLE_DRIVE_STUDENT_PHOTO_FOLDER_ID` | Student photo uploads | Optional; falls back to the backup folder |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Drive backups | Secret |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Google Drive backups | Secret; preserve newlines |
| `WHATSAPP_SCHEDULER_URL` | School-server event destination | Optional |
| `WHATSAPP_INTERNAL_WEBHOOK_SECRET` | School-server event authentication | Must match scheduler `INTERNAL_WEBHOOK_SECRET` |

The source also contains commented Google service-account fields documenting
the broader credential shape. Prefer the active, minimal variables consumed
by `googleDrive.service.ts`.

## 10. Development workflow

From the repository root:

```bash
npm install
npm run prisma:generate
npm run build
npm run dev
```

Available scripts:

| Command | Action |
|---|---|
| `npm run build` | Generate Prisma Client, then compile TypeScript to `dist/` |
| `npm start` | Run compiled `dist/index.js` |
| `npm run dev` | Watch TypeScript and restart compiled output with nodemon |
| `npm run docs:generate` | Generate TypeDoc at `docs/reference` |
| `npm run docs:watch` | Watch TypeScript and regenerate TypeDoc |
| `npm test` | Currently exits with “no test specified” |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Run `prisma migrate dev` |

The root `typedoc.json` includes `index.ts`, `config`, `controllers`, `docs`,
`middlewares`, `models`, `routes`, `services`, `types`, and `utils.ts`, while
excluding generated code and test files. The generated site is derived output
and should not be hand-edited.

## 11. Database and migration assets

- `prisma/schema.prisma` is the current Prisma schema.
- `prisma/migrations/00000000000000_baseline/migration.sql` is the baseline.
- `prisma/migrations/20260927183000_school_data_lifecycle/migration.sql`
  contains lifecycle additions.
- `prisma/migrations_old/` contains historical migration references.
- `current_schema.sql` and `current_schema.backup.sql` are SQL snapshots.
- `railway_backup_2026-08-27.dump`, `school_backup_2026-08-31.dump`, and
  `school_backup_2026-09-25.dump` are database backup artifacts.
- `scripts/migrate-mongo-to-prisma.cjs` is the Mongo-to-Prisma migration
  utility and must be reviewed before running against a live database.

Use Prisma migrations for normal schema evolution. Treat SQL snapshots and
database dumps as recovery/input artifacts, not as application runtime files.

## 12. Deployment scripts

| File | Purpose |
|---|---|
| `start_prod.sh` | Production startup wrapper |
| `start_uat.sh` | UAT startup wrapper |
| `mongo-backup.sh` | General Mongo backup wrapper |
| `mongo-backup-prod-ubuntu.sh` | Production Ubuntu Mongo backup |
| `mongo-backup-uat-ubuntu.sh` | UAT Ubuntu Mongo backup |

These are shell scripts intended for Unix-like deployment hosts. On Windows,
use the equivalent npm commands and configure PostgreSQL/backup infrastructure
through the host environment.

## 13. Maintenance rules

When adding or changing functionality:

1. Update the Prisma schema and migration together for database changes.
2. Regenerate Prisma Client after schema changes.
3. Add or update the route registration and controller.
4. Preserve authentication and tenant scoping.
5. Add request/response details to controller-level TypeDoc where the generic
   OpenAPI generator cannot express them.
6. Run `npm run build`.
7. Run `npm run docs:generate` and inspect the generated reference.
8. Verify the route appears correctly in `/api-docs.json`.
9. Update this document when architecture, configuration, scripts, or module
   responsibilities change.

## 14. Reference links

- [Root README](../README.md)
- [Prisma schema](../prisma/schema.prisma)
- [Application entry point](../index.ts)
- [Route barrel](../routes/index.ts)
- [OpenAPI generator](./openapi.ts)
- [TypeDoc configuration](../typedoc.json)
