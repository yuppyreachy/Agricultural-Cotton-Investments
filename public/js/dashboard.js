// dashboard.js
document.addEventListener("DOMContentLoaded",()=>{

    const balanceEl = document.getElementById("balance");
    const profitEl = document.getElementById("profit");
    const investmentTable = document.getElementById("investmentTable");

    // Fetch user data
    async function fetchDashboard(){
        try{
            const res = await fetch("/api/user-data");
            const data = await res.json();

            balanceEl.textContent = `$${data.balance.toLocaleString()}`;
            profitEl.textContent = `$${data.profit.toLocaleString()}`;

            // populate investments
            investmentTable.innerHTML="";
            data.investments.forEach(inv=>{
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${inv.plan}</td>
                    <td>$${inv.amount.toLocaleString()}</td>
                    <td>$${inv.profit.toLocaleString()}</td>
                    <td>${inv.status}</td>
                    <td>${new Date(inv.created_at).toLocaleDateString()}</td>
                `;
                investmentTable.appendChild(tr);
            });

        } catch(err){
            console.error("Dashboard fetch error:", err);
        }
    }

    fetchDashboard();

    // Auto refresh every 30s
    setInterval(fetchDashboard,30000);

});
