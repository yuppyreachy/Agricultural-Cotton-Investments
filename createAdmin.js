const bcrypt = require("bcrypt");



async function createAdmin() {
  const hashedPassword = await bcrypt.hash("admin123", 10);


createAdmin();