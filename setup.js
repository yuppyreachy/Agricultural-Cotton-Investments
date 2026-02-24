// setup.js
const db = require("./database");
const bcrypt = require("bcrypt");
const readline = require("readline");

// Create initial admin if not exists
db.get("SELECT * FROM admin LIMIT 1", async (err,row)=>{
    if(err) return console.error(err);

    if(!row){
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question("Create admin username: ", async (username)=>{
            rl.question("Create admin password: ", async (password)=>{
                const hashed = await bcrypt.hash(password,10);
                db.run("INSERT INTO admin (username,password) VALUES (?,?)",[username,hashed], ()=>{
                    console.log("✅ Admin created successfully!");
                    rl.close();
                    process.exit(0);
                });
            });
        });
    } else {
        console.log("✅ Admin already exists.");
        process.exit(0);
    }
});
