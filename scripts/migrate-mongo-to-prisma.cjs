const { MongoClient, ObjectId } = require("mongodb");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const toIdString = (value) => {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (value instanceof ObjectId) return value.toHexString();
  if (typeof value === "object" && value._id) return toIdString(value._id);
  return undefined;
};

const normalizeRoleName = (name) => {
  const lower = String(name || "").toLowerCase();
  if (lower === "owner" || lower === "admin" || lower === "superadmin") {
    return lower;
  }
  return "admin";
};

const normalizeCouponStatus = (status) => {
  const val = String(status || "ACTIVE").toUpperCase();
  return val === "APPLIED" ? "APPLIED" : "ACTIVE";
};

const normalizePaymentMode = (mode) => {
  const val = String(mode || "cash").toLowerCase();
  return val === "wallet" ? "wallet" : "cash";
};

const asText = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const asFeeLine = (obj) => ({
  amount: asText(obj?.amount, "0"),
  pendingAmount: asText(obj?.pendingAmount, "0"),
});

async function main() {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
  const mongoDbName = process.env.MONGO_DB;
  const clearPostgres = String(process.env.CLEAR_POSTGRES || "false").toLowerCase() === "true";

  if (!mongoDbName) {
    throw new Error("MONGO_DB is required. Example: set MONGO_DB=schooldb");
  }

  const mongoClient = new MongoClient(mongoUri);

  console.log("Connecting to MongoDB...");
  await mongoClient.connect();
  const mongoDb = mongoClient.db(mongoDbName);

  console.log("Connecting to PostgreSQL via Prisma...");
  await prisma.$connect();

  if (clearPostgres) {
    console.log("Clearing destination PostgreSQL tables...");
    await prisma.transaction.deleteMany();
    await prisma.student.deleteMany();
    await prisma.user.deleteMany();
    await prisma.coupon.deleteMany();
    await prisma.class.deleteMany();
    await prisma.role.deleteMany();
  }

  const classes = await mongoDb.collection("classes").find({}).toArray();
  const coupons = await mongoDb.collection("coupons").find({}).toArray();
  const roles = await mongoDb.collection("roles").find({}).toArray();
  const users = await mongoDb.collection("users").find({}).toArray();
  const students = await mongoDb.collection("students").find({}).toArray();
  const transactions = await mongoDb.collection("transactions").find({}).toArray();

  console.log(`Found data: classes=${classes.length}, coupons=${coupons.length}, roles=${roles.length}, users=${users.length}, students=${students.length}, transactions=${transactions.length}`);

  const classIdMap = new Map();
  for (const cls of classes) {
    const created = await prisma.class.upsert({
      where: { classNumber: asText(cls.classNumber) },
      update: {
        tuitionFee: asText(cls.tuitionFee, "0"),
        textBookFee: asText(cls.textBookFee, "0"),
        noteBookFee: asText(cls.noteBookFee, "0"),
        diary: asText(cls.diary, "0"),
        year: asText(cls.year, ""),
      },
      create: {
        classNumber: asText(cls.classNumber),
        tuitionFee: asText(cls.tuitionFee, "0"),
        textBookFee: asText(cls.textBookFee, "0"),
        noteBookFee: asText(cls.noteBookFee, "0"),
        diary: asText(cls.diary, "0"),
        year: asText(cls.year, ""),
      },
    });
    classIdMap.set(toIdString(cls._id), created.id);
  }

  const couponIdMap = new Map();
  for (const cp of coupons) {
    const classId = classIdMap.get(toIdString(cp.classNumber));
    const created = await prisma.coupon.upsert({
      where: { code: asText(cp.code) },
      update: {
        discount: asText(cp.discount, "0"),
        status: normalizeCouponStatus(cp.status),
        classId: classId || null,
      },
      create: {
        code: asText(cp.code),
        discount: asText(cp.discount, "0"),
        status: normalizeCouponStatus(cp.status),
        classId: classId || null,
      },
    });
    couponIdMap.set(toIdString(cp._id), created.id);
  }

  const roleIdMap = new Map();
  for (const rl of roles) {
    const name = normalizeRoleName(rl.name);
    const created = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    roleIdMap.set(toIdString(rl._id), created.id);
  }

  const userIdMap = new Map();
  for (const usr of users) {
    const roleIds = Array.isArray(usr.roles)
      ? usr.roles.map((rid) => roleIdMap.get(toIdString(rid))).filter(Boolean)
      : [];

    const created = await prisma.user.upsert({
      where: { email: asText(usr.email) },
      update: {
        name: asText(usr.name),
        designation: asText(usr.designation),
        adminId: asText(usr.adminId),
        password: asText(usr.password),
        roles: {
          set: roleIds.map((id) => ({ id })),
        },
      },
      create: {
        name: asText(usr.name),
        email: asText(usr.email),
        designation: asText(usr.designation),
        adminId: asText(usr.adminId),
        password: asText(usr.password),
        roles: {
          connect: roleIds.map((id) => ({ id })),
        },
      },
    });

    userIdMap.set(toIdString(usr._id), created.id);
  }

  const studentIdMap = new Map();
  for (const st of students) {
    const classId = classIdMap.get(toIdString(st.classNumber));
    if (!classId) {
      console.warn(`Skipping student ${st.admissionNo || "(unknown)"}: missing class relation`);
      continue;
    }

    const couponId = couponIdMap.get(toIdString(st.couponCode));

    const created = await prisma.student.upsert({
      where: { admissionNo: asText(st.admissionNo) },
      update: {
        name: asText(st.name),
        aadhaar: asText(st.aadhaar),
        fatherName: asText(st.fatherName),
        dob: asText(st.dob),
        doj: asText(st.doj),
        phoneNo: asText(st.phoneNo),
        classId,
        couponId: couponId || null,
        tieAmount: asFeeLine(st.tie).amount,
        tiePendingAmount: asFeeLine(st.tie).pendingAmount,
        beltAmount: asFeeLine(st.belt).amount,
        beltPendingAmount: asFeeLine(st.belt).pendingAmount,
        arrearsAmount: asFeeLine(st.arrears).amount,
        arrearsPendingAmount: asFeeLine(st.arrears).pendingAmount,
        pendingTuitionFee: asText(st.pendingTuitionFee, "0"),
        pendingTextbookFee: asText(st.pendingTextbookFee, "0"),
        pendingNotebookFee: asText(st.pendingNotebookFee, "0"),
        pendingDiaryAmount: asText(st.pendingDiaryAmount, "0"),
        pendingAmount: asText(st.pendingAmount, "0"),
        tcNo: st.tcNo ? asText(st.tcNo) : null,
        adminId: asText(st.adminId),
        siblings: Array.isArray(st.siblings) ? st.siblings : [],
      },
      create: {
        admissionNo: asText(st.admissionNo),
        name: asText(st.name),
        aadhaar: asText(st.aadhaar),
        fatherName: asText(st.fatherName),
        dob: asText(st.dob),
        doj: asText(st.doj),
        phoneNo: asText(st.phoneNo),
        classId,
        couponId: couponId || null,
        tieAmount: asFeeLine(st.tie).amount,
        tiePendingAmount: asFeeLine(st.tie).pendingAmount,
        beltAmount: asFeeLine(st.belt).amount,
        beltPendingAmount: asFeeLine(st.belt).pendingAmount,
        arrearsAmount: asFeeLine(st.arrears).amount,
        arrearsPendingAmount: asFeeLine(st.arrears).pendingAmount,
        pendingTuitionFee: asText(st.pendingTuitionFee, "0"),
        pendingTextbookFee: asText(st.pendingTextbookFee, "0"),
        pendingNotebookFee: asText(st.pendingNotebookFee, "0"),
        pendingDiaryAmount: asText(st.pendingDiaryAmount, "0"),
        pendingAmount: asText(st.pendingAmount, "0"),
        tcNo: st.tcNo ? asText(st.tcNo) : null,
        adminId: asText(st.adminId),
        siblings: Array.isArray(st.siblings) ? st.siblings : [],
      },
    });

    studentIdMap.set(toIdString(st._id), created.id);
  }

  for (const tx of transactions) {
    const studentId = studentIdMap.get(toIdString(tx.student)) || null;
    const details = tx.amountDetails || {};

    await prisma.transaction.create({
      data: {
        date: asText(tx.date),
        amount: asText(tx.amount, "0"),
        pendingAmount: asText(tx.pendingAmount, "0"),
        paymentMode: normalizePaymentMode(tx.paymentMode),
        transactionId: tx.transactionId ? asText(tx.transactionId) : null,
        classNumber: asText(tx.classNumber),
        adminId: asText(tx.adminId),
        studentId,
        tieAmount: asText(details.tie, "0"),
        diaryAmount: asText(details.diary, "0"),
        beltAmount: asText(details.belt, "0"),
        arrearsAmount: asText(details.arrears, "0"),
        tuitionFeeAmount: asText(details.tuitionFee, "0"),
        textBookFeeAmount: asText(details.textBookFee, "0"),
        noteBookFeeAmount: asText(details.noteBookFee, "0"),
      },
    });
  }

  console.log("Migration complete.");
  console.log(`Migrated: classes=${classIdMap.size}, coupons=${couponIdMap.size}, roles=${roleIdMap.size}, users=${userIdMap.size}, students=${studentIdMap.size}, transactions=${transactions.length}`);

  await mongoClient.close();
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("Migration failed:", error);
  try {
    await prisma.$disconnect();
  } catch (e) {
    // noop
  }
  process.exit(1);
});
