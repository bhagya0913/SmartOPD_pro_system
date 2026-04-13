import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ShieldCheck, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import './ForgotPassword.css';

export default function ForgotPassword() {

const [email,setEmail]=useState('');
const [token,setToken]=useState('');
const [newPassword,setNewPassword]=useState('');
const [confirmPassword,setConfirmPassword]=useState('');
const [step,setStep]=useState(1);

const navigate=useNavigate();


const handleRequest=async(e)=>{
e.preventDefault();

try{
const res=await fetch('http://localhost:5001/api/forgot-password',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({email})
});

const data=await res.json();

if(data.success){
setStep(2);
toast.success("OTP sent to email");
}else{
toast.error(data.message);
}

}catch(err){
toast.error("Connection failed");
}
};



const handleVerifyToken=async(e)=>{
e.preventDefault();

try{
const res=await fetch('http://localhost:5001/api/verify-token',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({email,token})
});

const data=await res.json();

if(data.success){
setStep(3);
toast.success("OTP verified");
}else{
toast.error(data.message);
}

}catch(err){
toast.error("Verification failed");
}
};



const handleReset=async(e)=>{
e.preventDefault();

if(newPassword!==confirmPassword){
toast.error("Passwords do not match");
return;
}

try{

const res=await fetch('http://localhost:5001/api/reset-password',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({email,token,newPassword})
});

const data=await res.json();

if(data.success){
toast.success("Password updated");
navigate('/login');
}else{
toast.error(data.message);
}

}catch(err){
toast.error("Server error");
}

};



return(

<div className="fp-page">

<div className="fp-card">

{/* Header */}
<div className="fp-header">

<div className="fp-icon">
<ShieldCheck size={32}/>
</div>

<h1>Password Recovery</h1>
<p>Secure access to your SmartOPD account</p>

</div>


{/* Step Progress */}

<div className="fp-steps">

<div className={`step ${step>=1?'active':''}`}>1</div>
<div className={`line ${step>=2?'active':''}`}></div>

<div className={`step ${step>=2?'active':''}`}>2</div>
<div className={`line ${step>=3?'active':''}`}></div>

<div className={`step ${step>=3?'active':''}`}>3</div>

</div>



{/* Step 1 */}

{step===1 &&(

<form onSubmit={handleRequest} className="fp-form">

<h2>Enter your Email</h2>

<div className="fp-input">

<Mail size={18}/>

<input
type="email"
placeholder="example@email.com"
value={email}
onChange={(e)=>setEmail(e.target.value)}
required
/>

</div>

<button className="fp-btn">
Send Verification Code
</button>

</form>

)}



{/* Step 2 */}

{step===2 &&(

<form onSubmit={handleVerifyToken} className="fp-form">

<h2>Email Verification</h2>

<p>Enter the 6 digit code sent to</p>
<strong>{email}</strong>

<div className="otp-input">

<input maxLength="6"
value={token}
onChange={(e)=>setToken(e.target.value)}
placeholder="------"
/>

</div>

<button className="fp-btn">
Verify Code
</button>

<button
type="button"
className="fp-resend"
onClick={handleRequest}
>
Resend Code
</button>

</form>

)}



{/* Step 3 */}

{step===3 &&(

<form onSubmit={handleReset} className="fp-form">

<h2>Create New Password</h2>

<div className="fp-input">

<Lock size={18}/>

<input
type="password"
placeholder="New Password"
value={newPassword}
onChange={(e)=>setNewPassword(e.target.value)}
required
/>

</div>


<div className="fp-input">

<Lock size={18}/>

<input
type="password"
placeholder="Confirm Password"
value={confirmPassword}
onChange={(e)=>setConfirmPassword(e.target.value)}
required
/>

</div>


<button className="fp-btn">
Update Password
</button>

</form>

)}


<button
className="fp-back"
onClick={()=>navigate('/login')}
>

<ArrowLeft size={16}/>
Back to Login

</button>

</div>
</div>

);

}