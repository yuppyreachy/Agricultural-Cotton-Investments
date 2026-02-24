// script.js
document.addEventListener("DOMContentLoaded",()=>{

    // ====== GENERAL FORM VALIDATION ======
    const forms = document.querySelectorAll("form");
    forms.forEach(form=>{
        form.addEventListener("submit",(e)=>{
            const amount = form.querySelector("[name='amount']");
            if(amount){
                if(!amount.value || isNaN(amount.value) || Number(amount.value)<=0){
                    e.preventDefault();
                    alert("Please enter a valid amount!");
                }
            }
        });
    });

    // ====== DEPOSIT REQUEST ======
    const depositForm = document.getElementById("depositForm");
    if(depositForm){
        depositForm.addEventListener("submit",async (e)=>{
            e.preventDefault();
            const method = depositForm.querySelector("[name='method']").value;
            const amount = depositForm.querySelector("[name='amount']").value;
            const proof = depositForm.querySelector("[name='proof']").files[0];

            const formData = new FormData();
            formData.append("method", method);
            formData.append("amount", amount);
            if(proof) formData.append("proof", proof);

            const res = await fetch("/api/deposit",{
                method:"POST",
                body: formData
            });

            const data = await res.json();
            alert(data.message);
            depositForm.reset();
        });
    }

    // ====== WITHDRAW REQUEST ======
    const withdrawForm = document.getElementById("withdrawForm");
    if(withdrawForm){
        withdrawForm.addEventListener("submit",async (e)=>{
            e.preventDefault();
            const method = withdrawForm.querySelector("[name='method']").value;
            const amount = withdrawForm.querySelector("[name='amount']").value;
            const info = withdrawForm.querySelector("[name='info']").value;

            const res = await fetch("/api/withdraw",{
                method:"POST",
                headers:{"Content-Type":"application/json"},
                body: JSON.stringify({method, amount, info})
            });

            const data = await res.json();
            alert(data.message);
            withdrawForm.reset();
        });
    }

    // ====== KYC SUBMISSION ======
    const kycForm = document.getElementById("kycForm");
    if(kycForm){
        kycForm.addEventListener("submit",async (e)=>{
            e.preventDefault();
            const formData = new FormData(kycForm);

            const res = await fetch("/api/kyc",{
                method:"POST",
                body: formData
            });

            const data = await res.json();
            alert(data.message);
            kycForm.reset();
        });
    }

    // ====== ADMIN ACTIONS ======
    const approveBtns = document.querySelectorAll(".approve");
    approveBtns.forEach(btn=>{
        btn.addEventListener("click",async ()=>{
            const id = btn.dataset.id;
            const type = btn.dataset.type; // deposit/withdraw/loan/kyc
            const res = await fetch(`/api/admin/approve/${type}/${id}`,{method:"POST"});
            const data = await res.json();
            alert(data.message);
            location.reload();
        });
    });

    const rejectBtns = document.querySelectorAll(".reject");
    rejectBtns.forEach(btn=>{
        btn.addEventListener("click",async ()=>{
            const id = btn.dataset.id;
            const type = btn.dataset.type;
            const res = await fetch(`/api/admin/reject/${type}/${id}`,{method:"POST"});
            const data = await res.json();
            alert(data.message);
            location.reload();
        });
    });

});
