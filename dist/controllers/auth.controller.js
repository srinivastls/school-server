"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const client_1 = require("@prisma/client");
const config_1 = require("../config");
const utils_1 = require("../utils");
/* ============================================================
   CONSTANTS
============================================================ */
const ACCESS_TOKEN_TTL = 86400;
/* ============================================================
   HELPERS
============================================================ */
const normalizeEmail = (email) => {
    return email.trim().toLowerCase();
};
const normalizeSchoolCode = (schoolCode) => {
    return schoolCode.trim().toUpperCase();
};
const getAuthenticatedSchoolId = (req) => {
    return req.user?.schoolId;
};
const ACCESS_TOKEN_EXPIRES_IN = 60 * 60;
const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60;
const createAccessToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, config_1.authConfig.secret, {
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });
};
const createRefreshToken = (payload) => {
    return jsonwebtoken_1.default.sign({ id: payload.id, type: payload.type }, config_1.authConfig.secret, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
};
/* ============================================================
   SCHOOL USER SIGN IN
   ------------------------------------------------------------
   Login:
      schoolCode + email + password
============================================================ */
const signin = async (req, res) => {
    try {
        const { schoolCode, identifier, password, } = req.body;
        /* --------------------------------------------------------
           VALIDATION
        -------------------------------------------------------- */
        if (!schoolCode ||
            !identifier ||
            !password) {
            return res.status(400).json({
                message: "schoolCode, identifier and password are required",
            });
        }
        const normalizedSchoolCode = normalizeSchoolCode(schoolCode);
        const normalizedIdentifier = identifier.trim();
        /* --------------------------------------------------------
           FIND SCHOOL
        -------------------------------------------------------- */
        const school = await config_1.prisma.school.findUnique({
            where: {
                code: normalizedSchoolCode,
            },
        });
        if (!school) {
            return res.status(401).json({
                message: "Invalid school code or credentials",
            });
        }
        /* --------------------------------------------------------
           SCHOOL STATUS
        -------------------------------------------------------- */
        if (school.status !== "ACTIVE") {
            return res.status(403).json({
                message: "School account is not active",
            });
        }
        /* --------------------------------------------------------
           FIND USER
           
           Email:
             Principal
             Admin
             Teacher
             Parent
    
           Mobile:
             Parent only
        -------------------------------------------------------- */
        let user;
        /* --------------------------------------------------------
           EMAIL LOGIN
        -------------------------------------------------------- */
        if (normalizedIdentifier.includes("@")) {
            const normalizedEmail = normalizeEmail(normalizedIdentifier);
            user =
                await config_1.prisma.user.findUnique({
                    where: {
                        schoolId_email: {
                            schoolId: school.id,
                            email: normalizedEmail,
                        },
                    },
                });
        }
        /* --------------------------------------------------------
           MOBILE LOGIN
           
           Parent login only
        -------------------------------------------------------- */
        else {
            const normalizedPhone = normalizedIdentifier.replace(/\D/g, "");
            if (normalizedPhone.length !== 10) {
                return res.status(400).json({
                    message: "Please enter a valid 10-digit mobile number",
                });
            }
            user =
                await config_1.prisma.user.findFirst({
                    where: {
                        schoolId: school.id,
                        phone: normalizedPhone,
                        role: client_1.RoleName.PARENT,
                    },
                });
        }
        /* --------------------------------------------------------
           USER NOT FOUND
        -------------------------------------------------------- */
        if (!user) {
            return res.status(401).json({
                message: "Invalid school code or credentials",
            });
        }
        /* --------------------------------------------------------
           USER STATUS
        -------------------------------------------------------- */
        if (!user.isActive) {
            return res.status(403).json({
                message: "User account is inactive",
            });
        }
        /* --------------------------------------------------------
           PASSWORD
        -------------------------------------------------------- */
        const passwordValid = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!passwordValid) {
            return res.status(401).json({
                message: "Invalid school code or credentials",
            });
        }
        /* --------------------------------------------------------
           LAST LOGIN
        -------------------------------------------------------- */
        await config_1.prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                lastLogin: new Date(),
            },
        });
        const accessToken = createAccessToken({
            id: user.id,
            schoolId: school.id,
            schoolCode: school.code,
            role: user.role,
            type: "SCHOOL_USER",
        });
        const refreshToken = createRefreshToken({
            id: user.id,
            type: "SCHOOL_USER",
        });
        /* --------------------------------------------------------
           RESPONSE
        -------------------------------------------------------- */
        return res.status(200).json({
            id: user.id,
            accessToken,
            accessTokenTTL: ACCESS_TOKEN_EXPIRES_IN,
            refreshToken,
            refreshTokenTTL: REFRESH_TOKEN_EXPIRES_IN,
            name: user.name,
            email: user.email,
            role: user.role,
            designation: user.designation,
            schoolId: school.id,
            schoolCode: school.code,
            schoolName: school.name,
            mustChangePassword: user.mustChangePassword,
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
const refresh = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(401).json({
                message: "Refresh token required",
                code: "REFRESH_TOKEN_REQUIRED",
            });
        }
        const decoded = jsonwebtoken_1.default.verify(refreshToken, config_1.authConfig.secret);
        if (!decoded.id || !decoded.type) {
            return res.status(401).json({
                message: "Invalid refresh token",
                code: "INVALID_REFRESH_TOKEN",
            });
        }
        if (decoded.type === "PLATFORM_ADMIN") {
            const admin = await config_1.prisma.platformAdmin.findUnique({
                where: { id: decoded.id },
            });
            if (!admin) {
                return res.status(401).json({
                    message: "Platform admin not found",
                    code: "SESSION_INVALID",
                });
            }
            if (!admin.isActive) {
                return res.status(403).json({
                    message: "Platform admin account is inactive",
                    code: "ACCOUNT_INACTIVE",
                });
            }
            const accessToken = createAccessToken({
                id: admin.id,
                role: admin.role,
                type: "PLATFORM_ADMIN",
            });
            return res.status(200).json({
                accessToken,
                accessTokenTTL: ACCESS_TOKEN_EXPIRES_IN,
            });
        }
        const user = await config_1.prisma.user.findUnique({
            where: { id: decoded.id },
            include: { school: true },
        });
        if (!user) {
            return res.status(401).json({
                message: "User not found",
                code: "SESSION_INVALID",
            });
        }
        if (!user.isActive) {
            return res.status(403).json({
                message: "User account is inactive",
                code: "ACCOUNT_INACTIVE",
            });
        }
        if (user.school.status !== "ACTIVE") {
            return res.status(403).json({
                message: "School account is not active",
                code: "SCHOOL_INACTIVE",
            });
        }
        const accessToken = createAccessToken({
            id: user.id,
            schoolId: user.school.id,
            schoolCode: user.school.code,
            role: user.role,
            type: "SCHOOL_USER",
        });
        return res.status(200).json({
            accessToken,
            accessTokenTTL: ACCESS_TOKEN_EXPIRES_IN,
        });
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            return res.status(401).json({
                message: "Refresh token expired",
                code: "REFRESH_TOKEN_EXPIRED",
            });
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            return res.status(401).json({
                message: "Invalid refresh token",
                code: "INVALID_REFRESH_TOKEN",
            });
        }
        return (0, utils_1.handleErr)(error, res);
    }
};
const changePassword = async (req, res) => {
    try {
        const userId = req.userId;
        const { currentPassword, newPassword, } = req.body;
        if (!userId) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        if (!currentPassword ||
            !newPassword) {
            return res.status(400).json({
                message: "Current password and new password are required",
            });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({
                message: "New password must be at least 8 characters",
            });
        }
        if (currentPassword === newPassword) {
            return res.status(400).json({
                message: "New password must be different from current password",
            });
        }
        const user = await config_1.prisma.user.findUnique({
            where: {
                id: userId,
            },
        });
        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }
        if (!user.isActive) {
            return res.status(403).json({
                message: "User account is inactive",
            });
        }
        const passwordValid = await bcrypt_1.default.compare(currentPassword, user.passwordHash);
        if (!passwordValid) {
            return res.status(401).json({
                message: "Current password is incorrect",
            });
        }
        const passwordHash = await bcrypt_1.default.hash(newPassword, 10);
        await config_1.prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                passwordHash,
                mustChangePassword: false,
            },
        });
        return res.status(200).json({
            message: "Password changed successfully",
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   PLATFORM ADMIN SIGN IN
============================================================ */
const platformAdminSignin = async (req, res) => {
    try {
        const { email, password, } = req.body;
        /* --------------------------------------------------------
           VALIDATION
        -------------------------------------------------------- */
        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }
        const normalizedEmail = normalizeEmail(email);
        /* --------------------------------------------------------
           FIND PLATFORM ADMIN
        -------------------------------------------------------- */
        const platformAdmin = await config_1.prisma.platformAdmin.findUnique({
            where: {
                email: normalizedEmail,
            },
        });
        if (!platformAdmin) {
            return res.status(401).json({
                message: "Invalid credentials",
            });
        }
        /* --------------------------------------------------------
           ACTIVE CHECK
        -------------------------------------------------------- */
        if (!platformAdmin.isActive) {
            return res.status(403).json({
                message: "Platform admin account is inactive",
            });
        }
        /* --------------------------------------------------------
           PASSWORD
        -------------------------------------------------------- */
        const passwordValid = await bcrypt_1.default.compare(password, platformAdmin.passwordHash);
        if (!passwordValid) {
            return res.status(401).json({
                message: "Invalid credentials",
            });
        }
        /* --------------------------------------------------------
           LAST LOGIN
        -------------------------------------------------------- */
        await config_1.prisma.platformAdmin.update({
            where: {
                id: platformAdmin.id,
            },
            data: {
                lastLogin: new Date(),
            },
        });
        const accessToken = createAccessToken({
            id: platformAdmin.id,
            role: platformAdmin.role,
            type: "PLATFORM_ADMIN",
        });
        const refreshToken = createRefreshToken({
            id: platformAdmin.id,
            type: "PLATFORM_ADMIN",
        });
        /* --------------------------------------------------------
           RESPONSE
        -------------------------------------------------------- */
        return res.status(200).json({
            id: platformAdmin.id,
            accessToken,
            accessTokenTTL: ACCESS_TOKEN_EXPIRES_IN,
            refreshToken,
            refreshTokenTTL: REFRESH_TOKEN_EXPIRES_IN,
            name: platformAdmin.name,
            email: platformAdmin.email,
            role: platformAdmin.role,
            type: "PLATFORM_ADMIN",
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   CREATE PRINCIPAL
   ------------------------------------------------------------
   PLATFORM ADMIN ONLY
============================================================ */
const createPrincipal = async (req, res) => {
    try {
        const { name, email, password, designation, phone, department, employeeId, } = req.body;
        const schoolId = req.params.schoolId;
        const platformAdminId = req.userId;
        if (!platformAdminId) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        if (!schoolId ||
            !name ||
            !email ||
            !password) {
            return res.status(400).json({
                message: "schoolId, name, email and password are required",
            });
        }
        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters",
            });
        }
        const normalizedEmail = email.trim().toLowerCase();
        const school = await config_1.prisma.school.findUnique({
            where: {
                id: schoolId,
            },
        });
        if (!school) {
            return res.status(404).json({
                message: "School not found",
            });
        }
        if (school.status === "SUSPENDED" ||
            school.status === "EXPIRED") {
            return res.status(403).json({
                message: "Cannot create principal for a suspended or expired school",
            });
        }
        const existingPrincipal = await config_1.prisma.user.findFirst({
            where: {
                schoolId,
                role: "PRINCIPAL",
            },
        });
        if (existingPrincipal) {
            // If a principal already exists for this school
            // call the updatePrincipal function instead of creating a new one
            const updatedPrincipal = await config_1.prisma.user.update({
                where: {
                    id: existingPrincipal.id,
                },
                data: {
                    name: name.trim(),
                    email: normalizedEmail,
                    phone: phone?.trim() || null,
                    designation: designation?.trim() || "Principal",
                    department: department?.trim() || null,
                    employeeId: employeeId?.trim() || null,
                },
            });
            return res.status(200).json({
                message: "Principal already exists. Updated the existing principal's details.",
                principal: {
                    id: updatedPrincipal.id,
                    name: updatedPrincipal.name,
                    email: updatedPrincipal.email,
                    designation: updatedPrincipal.designation,
                    schoolId: updatedPrincipal.schoolId,
                    mustChangePassword: updatedPrincipal.mustChangePassword,
                },
            });
        }
        const existingUser = await config_1.prisma.user.findUnique({
            where: {
                schoolId_email: {
                    schoolId,
                    email: normalizedEmail,
                },
            },
        });
        if (existingUser) {
            return res.status(409).json({
                message: "User with this email already exists in this school",
            });
        }
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const principal = await config_1.prisma.$transaction(async (tx) => {
            const createdPrincipal = await tx.user.create({
                data: {
                    schoolId,
                    name: name.trim(),
                    email: normalizedEmail,
                    passwordHash,
                    role: "PRINCIPAL",
                    designation: designation?.trim() || "Principal",
                    phone: phone?.trim() || null,
                    department: department?.trim() || null,
                    employeeId: employeeId?.trim() || null,
                    mustChangePassword: true,
                },
            });
            // Activate the school after principal creation
            const updatedSchool = await tx.school.update({
                where: {
                    id: schoolId,
                },
                data: {
                    status: "ACTIVE",
                },
            });
            await tx.schoolOnboardingLog.create({
                data: {
                    schoolId,
                    platformAdminId,
                    action: "CREDENTIALS_GENERATED",
                    details: {
                        principalId: createdPrincipal.id,
                        email: createdPrincipal.email,
                    },
                },
            });
            return {
                principal: createdPrincipal,
                school: updatedSchool,
            };
        });
        return res.status(201).json({
            message: "Principal created successfully",
            principal: {
                id: principal.principal.id,
                name: principal.principal.name,
                email: principal.principal.email,
                designation: principal.principal.designation,
                schoolId: principal.principal.schoolId,
                mustChangePassword: principal.principal.mustChangePassword,
            },
            school: {
                id: principal.school.id,
                code: principal.school.code,
                name: principal.school.name,
                status: principal.school.status,
            },
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   CREATE SCHOOL ADMIN
   ------------------------------------------------------------
   PRINCIPAL ONLY
============================================================ */
const createAdmin = async (req, res) => {
    try {
        const { name, email, password, designation, phone, department, employeeId, } = req.body;
        const schoolId = getAuthenticatedSchoolId(req);
        if (!schoolId ||
            !name ||
            !email ||
            !password) {
            return res.status(400).json({
                message: "name, email and password are required",
            });
        }
        const normalizedEmail = normalizeEmail(email);
        /* --------------------------------------------------------
           SCHOOL
        -------------------------------------------------------- */
        const school = await config_1.prisma.school.findUnique({
            where: {
                id: schoolId,
            },
        });
        if (!school) {
            return res.status(404).json({
                message: "School not found",
            });
        }
        if (school.status !== "ACTIVE") {
            return res.status(403).json({
                message: "School account is not active",
            });
        }
        /* --------------------------------------------------------
           DUPLICATE EMAIL
        -------------------------------------------------------- */
        const existingUser = await config_1.prisma.user.findUnique({
            where: {
                schoolId_email: {
                    schoolId,
                    email: normalizedEmail,
                },
            },
        });
        if (existingUser) {
            return res.status(409).json({
                message: "User with this email already exists in this school",
            });
        }
        /* --------------------------------------------------------
           CREATE ADMIN
        -------------------------------------------------------- */
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const admin = await config_1.prisma.user.create({
            data: {
                schoolId,
                name,
                email: normalizedEmail,
                passwordHash,
                role: client_1.RoleName.ADMIN,
                designation: designation ??
                    "School Admin",
                phone: phone ?? null,
                department: department ?? null,
                employeeId: employeeId ?? null,
            },
        });
        return res.status(201).json({
            message: "School admin created successfully",
            id: admin.id,
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   CREATE TEACHER
   ------------------------------------------------------------
   PRINCIPAL / ADMIN
============================================================ */
const createTeacher = async (req, res) => {
    try {
        const { name, email, password, designation, phone, department, employeeId, } = req.body;
        const schoolId = getAuthenticatedSchoolId(req);
        if (!schoolId ||
            !name ||
            !email ||
            !password) {
            return res.status(400).json({
                message: "name, email and password are required",
            });
        }
        const normalizedEmail = normalizeEmail(email);
        /* --------------------------------------------------------
           DUPLICATE
        -------------------------------------------------------- */
        const existingUser = await config_1.prisma.user.findUnique({
            where: {
                schoolId_email: {
                    schoolId,
                    email: normalizedEmail,
                },
            },
        });
        if (existingUser) {
            return res.status(409).json({
                message: "User with this email already exists in this school",
            });
        }
        /* --------------------------------------------------------
           CREATE TEACHER
        -------------------------------------------------------- */
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const teacher = await config_1.prisma.user.create({
            data: {
                schoolId,
                name,
                email: normalizedEmail,
                passwordHash,
                role: client_1.RoleName.TEACHER,
                designation: designation ??
                    "Teacher",
                phone: phone ?? null,
                department: department ?? null,
                employeeId: employeeId ?? null,
            },
        });
        return res.status(201).json({
            message: "Teacher created successfully",
            id: teacher.id,
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
const getTeachers = async (req, res) => {
    try {
        const schoolId = getAuthenticatedSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "Authenticated school is missing",
            });
        }
        const teachers = await config_1.prisma.user.findMany({
            where: {
                schoolId,
                role: client_1.RoleName.TEACHER,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                designation: true,
                department: true,
                employeeId: true,
                profilePhotoUrl: true,
                isActive: true,
                lastLogin: true,
                createdAt: true,
            },
            orderBy: {
                name: "asc",
            },
        });
        return res.status(200).json({
            teachers,
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
const updateTeacherStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { isActive } = req.body;
        const schoolId = getAuthenticatedSchoolId(req);
        if (!schoolId) {
            return res.status(401).json({
                message: "Authenticated school is missing",
            });
        }
        if (!userId || typeof isActive !== "boolean") {
            return res.status(400).json({
                message: "userId and isActive are required",
            });
        }
        const teacher = await config_1.prisma.user.findFirst({
            where: {
                id: userId,
                schoolId,
                role: client_1.RoleName.TEACHER,
            },
        });
        if (!teacher) {
            return res.status(404).json({
                message: "Teacher not found",
            });
        }
        const updatedTeacher = await config_1.prisma.user.update({
            where: {
                id: teacher.id,
            },
            data: {
                isActive,
            },
        });
        return res.status(200).json({
            message: isActive
                ? "Teacher account activated successfully"
                : "Teacher account deactivated successfully",
            teacher: {
                id: updatedTeacher.id,
                name: updatedTeacher.name,
                email: updatedTeacher.email,
                isActive: updatedTeacher.isActive,
            },
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   CREATE PARENT
   ------------------------------------------------------------
   PRINCIPAL / ADMIN
============================================================ */
const createParent = async (req, res) => {
    try {
        const { name, email, password, phone, } = req.body;
        const schoolId = getAuthenticatedSchoolId(req);
        if (!schoolId ||
            !name ||
            !email ||
            !password) {
            return res.status(400).json({
                message: "name, email and password are required",
            });
        }
        const normalizedEmail = normalizeEmail(email);
        /* --------------------------------------------------------
           DUPLICATE
        -------------------------------------------------------- */
        const existingUser = await config_1.prisma.user.findUnique({
            where: {
                schoolId_email: {
                    schoolId,
                    email: normalizedEmail,
                },
            },
        });
        if (existingUser) {
            return res.status(409).json({
                message: "User with this email already exists in this school",
            });
        }
        /* --------------------------------------------------------
           CREATE PARENT
        -------------------------------------------------------- */
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const parent = await config_1.prisma.user.create({
            data: {
                schoolId,
                name,
                email: normalizedEmail,
                passwordHash,
                role: client_1.RoleName.PARENT,
                phone: phone ?? null,
            },
        });
        return res.status(201).json({
            message: "Parent account created successfully",
            id: parent.id,
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   GET SCHOOL ADMINS
   ------------------------------------------------------------
   PRINCIPAL ONLY
============================================================ */
const getAdmins = async (req, res) => {
    try {
        const schoolId = getAuthenticatedSchoolId(req);
        if (!schoolId) {
            return res.status(401).json({
                message: "Authenticated school is missing",
            });
        }
        const admins = await config_1.prisma.user.findMany({
            where: {
                schoolId,
                role: client_1.RoleName.ADMIN,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                designation: true,
                department: true,
                employeeId: true,
                profilePhotoUrl: true,
                isActive: true,
                mustChangePassword: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: {
                name: "asc",
            },
        });
        return res.status(200).json({
            admins,
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
const updateAdminStatus = async (req, res) => {
    try {
        const schoolId = getAuthenticatedSchoolId(req);
        if (!schoolId) {
            return res.status(401).json({
                message: "Authenticated school is missing",
            });
        }
        const { userId } = req.params;
        const { isActive } = req.body;
        const user = await config_1.prisma.user.findUnique({
            where: {
                id: userId,
            },
        });
        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }
        if (user.role !== client_1.RoleName.ADMIN) {
            return res.status(400).json({
                message: "Only admin users can have their status updated",
            });
        }
        const updatedUser = await config_1.prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                isActive,
            },
        });
        return res.status(200).json({
            message: "Admin status updated successfully",
            user: updatedUser,
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   DELETE SCHOOL USER
   ------------------------------------------------------------
   PRINCIPAL ONLY
============================================================ */
const deleteUser = async (req, res) => {
    try {
        const { email, } = req.body;
        const schoolId = getAuthenticatedSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "Authenticated school is missing",
            });
        }
        if (!email) {
            return res.status(400).json({
                message: "Email is required",
            });
        }
        const normalizedEmail = normalizeEmail(email);
        /* --------------------------------------------------------
           FIND USER
        -------------------------------------------------------- */
        const user = await config_1.prisma.user.findUnique({
            where: {
                schoolId_email: {
                    schoolId,
                    email: normalizedEmail,
                },
            },
        });
        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }
        /* --------------------------------------------------------
           NEVER DELETE PRINCIPAL HERE
           
           Principal should be managed by Platform Admin.
        -------------------------------------------------------- */
        if (user.role ===
            client_1.RoleName.PRINCIPAL) {
            return res.status(403).json({
                message: "Principal account can only be managed by platform admin",
            });
        }
        /* --------------------------------------------------------
           DELETE
        -------------------------------------------------------- */
        await config_1.prisma.user.delete({
            where: {
                id: user.id,
            },
        });
        return res.status(200).json({
            message: "User deleted successfully",
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   EXPORT
============================================================ */
exports.authController = {
    signin,
    platformAdminSignin,
    createPrincipal,
    createAdmin,
    createTeacher,
    createParent,
    changePassword,
    getAdmins,
    getTeachers,
    updateTeacherStatus,
    updateAdminStatus,
    refresh,
    delete: deleteUser,
};
