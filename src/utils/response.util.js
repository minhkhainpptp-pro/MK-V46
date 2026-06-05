
function ok(res,data=null,extra={}){ return res.json({ok:true,data,...extra}); }
function fail(res,message='Error',status=400){ return res.status(status).json({ok:false,message}); }
module.exports={ok,fail};
