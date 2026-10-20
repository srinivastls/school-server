/** Schema-grounded adapters for the supplied Prisma schema. Never pass arbitrary spreadsheet keys to Prisma. */
export type Adapter = {
  model: string; label: string; key: string; fields: string[]; requiredOnCreate: string[];
  writable: boolean; exportOnly?: boolean; dates?: string[]; booleans?: string[]; numbers?: string[];
};
export const ADAPTERS: Record<string, Adapter> = {
  students: { model:'student', label:'Students', key:'admissionNo', writable:true,
    fields:['admissionNo','name','fatherName','motherName','dob','doj','gender','bloodGroup','aadhaar','category','religion','phone','emergencyContact','photoUrl','previousSchool','rollNumber','status','classId','sectionId','tieAmount','tiePendingAmount','beltAmount','beltPendingAmount','arrearsAmount','arrearsPendingAmount','pendingTuitionFee','pendingTextbookFee','pendingNotebookFee','pendingDiaryAmount','pendingAmount','siblings'],
    requiredOnCreate:['admissionNo','name','fatherName','dob','doj','classId','sectionId','tieAmount','tiePendingAmount','beltAmount','beltPendingAmount','arrearsAmount','arrearsPendingAmount','pendingTuitionFee','pendingTextbookFee','pendingNotebookFee','pendingDiaryAmount','pendingAmount','siblings'], dates:[], numbers:[], booleans:[] },
  classes: { model:'class', label:'Classes', key:'classNumber+academicYearId', writable:true,
    fields:['classNumber','displayName','tuitionFee','textBookFee','noteBookFee','diaryFee','isCompleted'],
    requiredOnCreate:['classNumber','displayName','tuitionFee','textBookFee','noteBookFee','diaryFee'], booleans:['isCompleted'] },
  sections: { model:'section', label:'Sections', key:'classId+sectionName', writable:true,
    fields:['classId','sectionName','classTeacherId'], requiredOnCreate:['classId','sectionName'] },
  subjects: { model:'subject', label:'Subjects', key:'classId+code', writable:true,
    fields:['classId','name','code','isOptional'], requiredOnCreate:['classId','name','code'], booleans:['isOptional'] },
  exams: { model:'exam', label:'Exams', key:'name+academicYearId', writable:true,
    fields:['name','type','termNumber','startDate','endDate'], requiredOnCreate:['name','type','termNumber','startDate','endDate'], dates:['startDate','endDate'], numbers:['termNumber'], booleans:['isPublished'] },
  examSubjects: { model:'examSubject', label:'Exam subjects', key:'id', writable:true,
    fields:['examId','subjectId','classId','maxMarks','passingMarks','weightage'], requiredOnCreate:['examId','subjectId','classId','maxMarks','passingMarks'], numbers:['maxMarks','passingMarks','weightage'] },
  examTimetables: { model:'examTimetable', label:'Exam timetable', key:'id', writable:true,
    fields:['examId','classId','subjectId','examDate','startTime','endTime'], requiredOnCreate:['examId','classId','subjectId','examDate'], dates:['examDate'] },
  attendance: { model:'attendance', label:'Student attendance', key:'studentId+date', writable:true,
    fields:['studentId','date','status','remark','academicYearId','classId','sectionId'], requiredOnCreate:['studentId','date','status','academicYearId','classId','sectionId'], dates:['date'] },
  marks: { model:'mark', label:'Marks', key:'studentId+examSubjectId', writable:true,
    fields:['studentId','examSubjectId','marksObtained','isAbsent'], requiredOnCreate:['studentId','examSubjectId'], numbers:['marksObtained'], booleans:['isAbsent'] },
  teachers: { model:'user', label:'Teachers & staff (accounts auto-created)', key:'email', writable:true,
    fields:['name','email','phone','role','designation','department','employeeId','isActive'], requiredOnCreate:['name','email','role'], booleans:['isActive'] },
  transactions: { model:'transaction', label:'Fee transactions / payments', key:'id', writable:false, exportOnly:true,
    fields:['id','studentId','date','amount','pendingAmount','paymentMode','transactionId','receiptNumber','classNumber','recordedByUserId','tieAmount','diaryAmount','beltAmount','arrearsAmount','tuitionFeeAmount','textBookFeeAmount','noteBookFeeAmount','createdAt','updatedAt'], requiredOnCreate:[] }
};
export const IMPORT_MODULES = Object.entries(ADAPTERS).filter(([,a])=>a.writable).map(([key,a])=>({key,label:a.label,fields:a.fields,requiredOnCreate:a.requiredOnCreate,keyField:a.key}));
export const EXPORT_MODULES = Object.entries(ADAPTERS).map(([key,a])=>({key,label:a.label,fields:a.fields}));
