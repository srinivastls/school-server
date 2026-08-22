"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMonthDateRange = exports.handleErr = void 0;
const handleErr = (err, res) => {
    return res.status(500).json({ message: err });
};
exports.handleErr = handleErr;
const getMonthDateRange = (month, year) => {
    const days = [];
    const monthStr = month.length === 2 ? month : "0" + month;
    for (let i = 1; i <= 31; ++i) {
        const dayStr = i < 10 ? `0${i}` : `${i}`;
        days.push(`${dayStr}/${monthStr}/${year}`);
    }
    return days;
};
exports.getMonthDateRange = getMonthDateRange;
