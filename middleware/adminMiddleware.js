/**
 * Protect admin routes
 */
const isAdmin = (req,res,next)=>{
    if(req.session && req.session.admin){
        return next();
    } else {
        return res.redirect("/login");
    }
};

module.exports = isAdmin;
