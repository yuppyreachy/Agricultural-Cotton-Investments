/**
 * Generates a unique ID for users, deposits, transactions
 * Example: UID-20260215-4567
 */
const generateUID = (prefix="UID") => {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,"0");
  const d = String(date.getDate()).padStart(2,"0");
  const rand = Math.floor(Math.random()*9000)+1000; // 4 digit
  return `${prefix}-${y}${m}${d}-${rand}`;
};

module.exports = generateUID;
