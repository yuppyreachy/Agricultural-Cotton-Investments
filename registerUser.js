const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const path = require("path");
const sendMail = require("./utils/sendMail");
const generateUID = require("./utils/uidGenerator");

const dbFile = path.join(__dirname,"database.sqlite");
const db = new sqlite3.Database(dbFile);

const registerUser = async (fullname,email,password) => {
  try {
    // check if email exists
    db.get("SELECT * FROM users WHERE email=?", [email], async (err,row)=>{
      if(err) return console.error(err);
      if(row) return console.log("Email already exists");

      const hashedPassword = await bcrypt.hash(password,10);
      const uid = generateUID("USR");

      // Insert user
      db.run(`INSERT INTO users (uid, fullname, email, password, balance, profit) VALUES (?,?,?,?,?,?)`,
      [uid, fullname, email, hashedPassword, 0, 0], (err)=>{
        if(err) return console.error(err);

        console.log("✅ User registered:", email);

        // Send verification email
        const html = `<h3>Welcome ${fullname}</h3>
                      <p>Your account has been created successfully.</p>
                      <p>Please verify your email to activate your account.</p>`;
        sendMail(email,"Elite Investment - Verify Email",html);
      });
    });
  } catch(err) {
    console.error(err);
  }
};

module.exports = registerUser;
