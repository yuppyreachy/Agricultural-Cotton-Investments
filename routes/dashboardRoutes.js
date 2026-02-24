// ==========================
// ADMIN DASHBOARD JS
// ==========================

// Connect to Socket.io
const socket = io();

// ==========================
// Live Support Elements
// ==========================
const chatWindow = document.getElementById("chatWindow");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const onlineUsersList = document.getElementById("onlineUsers"); // optional: a div to show online users

// Tell server this is admin
socket.emit("admin-join");

// Listen for online users
socket.on("online-users", (users) => {
  if(onlineUsersList){
    onlineUsersList.innerHTML = '';
    users.forEach(uid => {
      const li = document.createElement("div");
      li.textContent = uid;
      onlineUsersList.appendChild(li);
    });
  }
  console.log("Online Users:", users);
});

// Listen for messages from users
socket.on("receive-message", (data) => {
  appendMessage(data.sender, data.text);
});

// Send message to user
chatSend.addEventListener("click", () => {
  const text = chatInput.value.trim();
  if(!text) return;

  // Select user to reply
  const userId = prompt("Enter user ID to reply:"); 
  if(!userId) return alert("User ID required!");

  socket.emit("admin-message", { userId, text });
  appendMessage("Admin", text);
  chatInput.value = "";
});

// Helper function to append message to chat window
function appendMessage(sender, text){
  const div = document.createElement("div");
  div.style.marginBottom = "8px";
  div.innerHTML = `<b>${sender}:</b> ${text}`;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight; // auto scroll
}

// ==========================
// Fetch User Data
// ==========================
fetch("/api/user")
  .then(res => res.json())
  .then(user => {
    const fullname = user.fullname || "User";
    const email = user.email || "";
    const tier = user.tier || "Standard";
    const balance = user.balance || 100;
    const profit = user.profit || 0;
    const loanEligible = user.loanEligible || "No";
    const kycStatus = user.kycStatus || "Pending";
    const welcomeBonus = user.welcomeBonus || 100;

    // Inject into HTML
    document.getElementById("userFullname").textContent = fullname;
    document.getElementById("userEmail").textContent = email;
    document.getElementById("userTier").textContent = tier;
    document.getElementById("balance").textContent = balance.toLocaleString();
    document.getElementById("profit").textContent = profit.toLocaleString();
    document.getElementById("loanStatus").textContent = loanEligible;
    document.getElementById("kycStatus").textContent = kycStatus;
    document.getElementById("welcomeBonus").textContent = welcomeBonus;

    // ==================
    // Profit Chart
    // ==================
    const profitData = [
      profit,
      profit + 2000,
      profit + 5000,
      profit + 10000,
      profit + 15000,
      profit + 20000
    ];

    const ctx = document.getElementById('dashboardChart').getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan','Feb','Mar','Apr','May','Jun'],
        datasets: [{
          label: 'Profit ($)',
          data: profitData,
          borderColor: 'rgba(255,215,0,1)',
          backgroundColor: 'rgba(255,215,0,0.2)',
          fill: true,
          tension: 0.3
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    setInterval(() => {
      chart.data.datasets[0].data = chart.data.datasets[0].data.map(v => v + Math.floor(Math.random()*1000 - 500));
      chart.update();
    }, 5000);

    // ==================
    // Elite Welcome Bonus Popup
    // ==================
    const elitePopup = document.getElementById("eliteBonusPopup");
    document.getElementById("bonusAmount").textContent = welcomeBonus;
    document.getElementById("userNamePopup").textContent = fullname;

    setTimeout(() => elitePopup.classList.add("show"), 500);
    setTimeout(() => elitePopup.classList.remove("show"), 4500);

    // ==================
    // Investment Plans
    // ==================
    const investments = [
      {plan:"Elite Plan A", amount:200000, roiMonthly:250},
      {plan:"Elite Plan B", amount:250000, roiMonthly:250}
    ];

    const investmentContainer = document.getElementById("investmentList");
    investments.forEach(inv => {
      const profitCalc = (inv.amount * inv.roiMonthly / 100).toLocaleString();
      const div = document.createElement("div");
      div.className = "vip-card";
      div.innerHTML = `<p>${inv.plan}: Investment $${inv.amount.toLocaleString()} | ROI: ${inv.roiMonthly}% | Profit: $${profitCalc}</p>`;
      investmentContainer.appendChild(div);
    });

    // ==================
    // Top VIP Investors
    // ==================
    const vipInvestors = [
      {name:"Alice Gold", investment:10000000, roi:700},
      {name:"Bob Silver", investment:5000000, roi:550},
      {name:"Michael Robinson", investment:3000000, roi:400}
    ];

    const vipContainer = document.getElementById("vipInvestors");
    vipInvestors.forEach(inv => {
      const div = document.createElement("div");
      div.className = "vip-card";
      div.innerHTML = `<h4>${inv.name}</h4><p>Investment: $${inv.investment.toLocaleString()}</p><p>ROI: ${inv.roi}%</p>`;
      vipContainer.appendChild(div);
    });

    // ==================
    // Company Achievements
    // ==================
    const achievements = [
      {title:"Reached $50M Investment", desc:"Elite investors trust us.", img:"https://via.placeholder.com/400x150"},
      {title:"1000+ Elite Investors", desc:"Top investors onboarded.", img:"https://via.placeholder.com/400x150"},
      {title:"10 Years in Operation", desc:"Sustained premium growth.", img:"https://via.placeholder.com/400x150"}
    ];

    const achContainer = document.getElementById("achievementsList");
    achievements.forEach(a => {
      const div = document.createElement("div");
      div.className = "vip-card";
      div.style.background = "rgba(59,130,246,0.2)";
      div.style.color = "#fff";
      div.style.marginBottom = "10px";
      div.style.padding = "15px";
      div.style.borderRadius = "15px";
      div.innerHTML = `<h4>${a.title}</h4><p>${a.desc}</p><img src="${a.img}" style="width:100%;border-radius:12px;margin-top:5px;">`;
      achContainer.appendChild(div);
    });
  })
  .catch(err => console.error("Error fetching user data:", err));
