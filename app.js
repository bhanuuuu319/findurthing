import { firebaseConfig, adminEmail } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const hasFirebaseConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
let fb = null;
let authMode = "login";
let authRole = "student";
let currentUser = null;
let currentProfile = null;
let reports = [];
let claims = [];
let localMode = !hasFirebaseConfig;
let currentModalReport = null;
let itemModal = null;
let currentPage = "dashboard";
const DEMO_KEY = "campusLostFoundDemoV1";
const categoryIcons = {
  "Electronics":"🎧", "Bags & Accessories":"🎒", "Cards & IDs":"💳",
  "Keys":"🔑", "Books & Stationery":"📚", "Clothing":"🧥", "Other":"📦"
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function dateLabel(value) {
  if (!value) return "Date not specified";
  const d = new Date(value + (String(value).length === 10 ? "T12:00:00" : ""));
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
}
function today() { return new Date().toISOString().slice(0,10); }
function uid() { return Math.random().toString(36).slice(2,9) + Date.now().toString(36); }
function toast(message, error = false) {
  const el = document.createElement("div");
  el.className = "app-toast" + (error ? " error" : "");
  el.textContent = message;
  $("toastArea").appendChild(el);
  setTimeout(() => el.remove(), 3800);
}
function setAuthError(message = "") { $("authError").textContent = message; }
function isAdmin() {
  return Boolean(currentUser && (currentProfile?.role === "admin" ||
    (adminEmail && currentUser.email?.toLowerCase() === adminEmail.toLowerCase())));
}
function demoState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEMO_KEY) || "{}");
    return {users: parsed.users || [], reports: parsed.reports || seedReports(), claims: parsed.claims || []};
  } catch { return {users:[], reports:seedReports(), claims:[]}; }
}
function saveDemo(state) { localStorage.setItem(DEMO_KEY, JSON.stringify(state)); }
function seedReports() {
  const d = today();
  return [
    {id:"seed1",ownerUid:"demo-user-1",ownerName:"Aarav S.",type:"lost",name:"Black wireless earbuds",category:"Electronics",description:"Black earbuds in a small matte charging case. May have been left after a study session.",location:"Central Library",date:d,status:"active",photoUrl:"",createdAt:Date.now()-100000},
    {id:"seed2",ownerUid:"demo-user-2",ownerName:"Mira K.",type:"found",name:"Wireless earbud case",category:"Electronics",description:"A black charging case with wireless earbuds found near the library study desks.",location:"Central Library, 2nd floor",date:d,status:"active",photoUrl:"",createdAt:Date.now()-80000},
    {id:"seed3",ownerUid:"demo-user-3",ownerName:"Rohan P.",type:"found",name:"Blue student backpack",category:"Bags & Accessories",description:"Blue backpack with notebooks inside. Handed in after class.",location:"Engineering Block, Room 204",date:d,status:"active",photoUrl:"",createdAt:Date.now()-50000},
    {id:"seed4",ownerUid:"demo-user-4",ownerName:"Nisha R.",type:"lost",name:"Blue backpack",category:"Bags & Accessories",description:"Lost my blue college bag around the engineering classrooms. Contains textbooks.",location:"Engineering Block",date:d,status:"active",photoUrl:"",createdAt:Date.now()-30000}
  ];
}
async function initFirebase() {
  if (!hasFirebaseConfig) return;
  try {
    const [appMod, authMod, storeMod, storageMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js")
    ]);
    const app = appMod.initializeApp(firebaseConfig);
    const auth = authMod.getAuth(app);
    const db = storeMod.getFirestore(app);
    const storage = storageMod.getStorage(app);
    fb = { ...authMod, ...storeMod, ...storageMod, auth, db, storage };
    authMod.onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user;
        await loadProfile();
        await loadCloudData();
        showApp();
      } else {
        currentUser = null; currentProfile = null;
        showAuth();
      }
    });
  } catch (err) {
    console.error(err);
    localMode = true;
    $("demoNote").textContent = "Firebase could not initialize. Check firebase-config.js and your internet connection. You can still try local demo mode after refreshing.";
    showAuth();
  }
}
async function loadProfile() {
  if (!fb || !currentUser) return;
  const ref = fb.doc(fb.db,"users",currentUser.uid);
  const snap = await fb.getDoc(ref);
  currentProfile = snap.exists() ? snap.data() : {
    name: currentUser.displayName || currentUser.email?.split("@")[0] || "Student",
    studentId: "", role: (adminEmail && currentUser.email?.toLowerCase() === adminEmail.toLowerCase()) ? "admin" : "student"
  };
  if (!snap.exists()) {
    await fb.setDoc(ref, {name:currentProfile.name, studentId:"", email:currentUser.email || "", role:currentProfile.role, createdAt:Date.now()});
  }
  if (adminEmail && currentUser.email?.toLowerCase() === adminEmail.toLowerCase() && currentProfile.role !== "admin") {
    currentProfile.role = "admin";
  }
}
async function loadCloudData() {
  if (!fb) return;
  const [rSnap,cSnap] = await Promise.all([
    fb.getDocs(fb.query(fb.collection(fb.db,"reports"),fb.orderBy("createdAt","desc"))),
    fb.getDocs(fb.collection(fb.db,"claims"))
  ]);
  reports = rSnap.docs.map(d=>({id:d.id,...d.data()}));
  claims = cSnap.docs.map(d=>({id:d.id,...d.data()}));
}
function refreshDemoData() {
  const state = demoState();
  reports = state.reports;
  claims = state.claims;
}
function showAuth() {
  $("authView").hidden = false; $("appView").hidden = true;
  setAuthError("");
}
function showApp() {
  $("authView").hidden = true; $("appView").hidden = false;
  const name = currentProfile?.name || currentUser?.displayName || currentUser?.email?.split("@")[0] || "Student";
  $("sidebarUserName").textContent = name;
  $("sidebarUserRole").textContent = isAdmin() ? "Administrator" : "Student account";
  $("userAvatar").textContent = name.slice(0,1).toUpperCase();
  $("topAvatar").textContent = name.slice(0,1).toUpperCase();
  $("welcomeName").textContent = name.split(" ")[0];
  $("welcomeEyebrow").textContent = isAdmin() ? "ADMINISTRATOR WORKSPACE" : "YOUR CAMPUS, CONNECTED";
  $("adminNav").hidden = !isAdmin(); $("adminSideLabel").hidden = !isAdmin();
  $("matchBadge").textContent = calculateMatches().length;
  renderAll();
  navigate(currentPage || "dashboard");
}
function showAuthRole(role) {
  authRole = role;
  $("studentTab").classList.toggle("active",role==="student");
  $("adminTab").classList.toggle("active",role==="admin");
  $("studentIdField").hidden = role==="admin" || authMode==="register";
  $("nameField").hidden = authMode!=="register";
  $("confirmField").hidden = authMode!=="register";
  $("forgotPasswordWrap").hidden = authMode==="register";
  $("termsField").hidden = authMode!=="register";
  $("authSwitch").hidden = role==="admin";
  $("authTitle").textContent = authMode==="register" ? "Create your account" : (role==="admin" ? "Administrator sign in" : "Sign in");
  $("authSubtitle").textContent = authMode==="register" ? "Join your campus recovery community." : (role==="admin" ? "Authorized campus staff only." : "Sign in to report, discover, and reunite.");
  $("authSubmit").innerHTML = authMode==="register" ? 'Create account <span>→</span>' : 'Sign in <span>→</span>';
  $("toggleRegister").textContent = authMode==="register" ? "Sign in instead" : "Create a student account";
  setAuthError("");
}
$("studentTab").addEventListener("click",()=>showAuthRole("student"));
$("adminTab").addEventListener("click",()=>showAuthRole("admin"));
$("toggleRegister").addEventListener("click",()=>{authMode=authMode==="register"?"login":"register";showAuthRole("student");});
$("forgotPasswordBtn").addEventListener("click", async () => {
  setAuthError("");
  const email = $("email").value.trim().toLowerCase();
  if (!email) {
    setAuthError("Enter your email address first, then select Forgot password?");
    $("email").focus();
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setAuthError("Please enter a valid email address.");
    $("email").focus();
    return;
  }
  if (!fb || localMode) {
    setAuthError("Password reset is available when Firebase Authentication is configured. Demo accounts do not use email passwords.");
    return;
  }
  const button = $("forgotPasswordBtn");
  button.disabled = true;
  try {
    await fb.sendPasswordResetEmail(fb.auth, email);
    setAuthError("");
    toast("Password reset email sent. Check your inbox and spam folder.");
  } catch (err) {
    setAuthError(friendlyAuthError(err));
  } finally {
    button.disabled = false;
  }
});

$("authForm").addEventListener("submit",async(e)=>{
  e.preventDefault(); setAuthError("");
  const email=$("email").value.trim().toLowerCase(), password=$("password").value;
  const name=$("fullName").value.trim(), studentId=$("studentId").value.trim();
  if(authMode==="register"){
    if(!name){setAuthError("Please enter your full name.");return;}
    if(!studentId){setAuthError("Please enter your student ID.");return;}
    if(password!==$("confirmPassword").value){setAuthError("Passwords do not match.");return;}
    if(!$("terms").checked){setAuthError("Please agree to use the service responsibly.");return;}
  }
  if(authRole==="admin" && authMode==="register"){setAuthError("Administrator accounts cannot be created here.");return;}
  $("authSubmit").disabled=true;
  try{
    if(fb && !localMode){
      if(authMode==="register"){
        const cred=await fb.createUserWithEmailAndPassword(fb.auth,email,password);
        await fb.updateProfile(cred.user,{displayName:name});
        await fb.setDoc(fb.doc(fb.db,"users",cred.user.uid),{name,studentId,email,role:"student",createdAt:Date.now()});
        currentUser=cred.user;currentProfile={name,studentId,role:"student"};
      }else{
        const cred=await fb.signInWithEmailAndPassword(fb.auth,email,password);
        currentUser=cred.user;await loadProfile();
        if(authRole==="admin"&&!isAdmin()){await fb.signOut(fb.auth);currentUser=null;currentProfile=null;throw new Error("This account is not authorized as an administrator.");}
      }
      await loadCloudData();showApp();
    }else{
      const state=demoState();
      if(authMode==="register"){
        if(state.users.some(u=>u.email===email)){throw new Error("Email already exists. Please sign in.");}
        if(state.users.some(u=>u.studentId.toLowerCase()===studentId.toLowerCase())){throw new Error("Student ID already exists.");}
        const user={uid:uid(),email,password,name,studentId,role:"student"};
        state.users.push(user);saveDemo(state);
        currentUser={uid:user.uid,email:user.email};currentProfile={name,studentId,role:"student"};
      }else{
        const user=state.users.find(u=>u.email===email&&u.password===password);
        if(!user){
          if(authRole==="admin"){throw new Error("Demo admin: register a student first, then configure Firebase admin access. Demo mode has no built-in admin credentials.");}
          throw new Error("Invalid email or password. Create an account first, or use the demo account below.");
        }
        if(authRole==="admin"&&user.role!=="admin"){throw new Error("This account is not an administrator.");}
        currentUser={uid:user.uid,email:user.email};currentProfile={name:user.name,studentId:user.studentId,role:user.role};
      }
      refreshDemoData();showApp();
    }
  }catch(err){setAuthError(friendlyAuthError(err));}
  finally{$("authSubmit").disabled=false;}
});
function friendlyAuthError(err){
  const code=err?.code;
  const map={"auth/email-already-in-use":"Email already exists. Please sign in.","auth/invalid-email":"Please enter a valid email address.","auth/weak-password":"Password must contain at least 6 characters.","auth/invalid-credential":"Invalid email or password.","auth/user-not-found":"No account found for this email.","auth/invalid-email":"Please enter a valid email address.","auth/missing-email":"Enter your email address first.","auth/operation-not-allowed":"Email/password authentication is not enabled in Firebase.","auth/wrong-password":"Invalid email or password.","auth/too-many-requests":"Too many attempts. Try again later.","auth/network-request-failed":"Network error. Check your internet connection.","permission-denied":"Firebase permission denied. Check your Firestore rules."};
  return map[code]||err?.message||"Something went wrong. Please try again.";
}
$("logoutBtn").addEventListener("click",async()=>{
  if(fb&&!localMode){await fb.signOut(fb.auth);}else{currentUser=null;currentProfile=null;showAuth();}
});
function navigate(page){
  if(page==="admin"&&!isAdmin()){toast("Administrator access is required.",true);page="dashboard";}
  currentPage=page;
  document.querySelectorAll(".page-section").forEach(s=>s.hidden=s.id!=="page-"+page);
  document.querySelectorAll(".nav-item[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  const labels={dashboard:"Overview",browse:"Browse items",report:"Report an item",matches:"Smart matches",myreports:"My reports",claims:"Claim requests",admin:"Admin console"};
  $("pageCrumb").textContent=labels[page]||"Overview";
  $("sidebar").classList.remove("open");$("sidebarOverlay").classList.remove("show");
  if(page==="browse")renderBrowse();if(page==="matches")renderMatches();if(page==="myreports")renderMyReports();if(page==="claims")renderClaims();if(page==="admin")renderAdmin();
  window.scrollTo({top:0,behavior:"smooth"});
}
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-page]");
  if(b){e.preventDefault();if(b.dataset.prefill==="found")document.querySelector('input[name="reportType"][value="found"]').checked=true;navigate(b.dataset.page);}
});
$("menuToggle").addEventListener("click",()=>{$("sidebar").classList.add("open");$("sidebarOverlay").classList.add("show");});
$("sidebarOverlay").addEventListener("click",()=>{$("sidebar").classList.remove("open");$("sidebarOverlay").classList.remove("show");});
function reportById(id){return reports.find(r=>r.id===id);}
function activeReports(){return reports.filter(r=>r.status==="active");}
function calculateMatches(){
  const lost=activeReports().filter(r=>r.type==="lost"),found=activeReports().filter(r=>r.type==="found"),out=[];
  for(const l of lost)for(const f of found){
    const score=matchScore(l,f);
    if(score>=25)out.push({lost:l,found:f,score});
  }
  return out.sort((a,b)=>b.score-a.score);
}
function words(text){return new Set(String(text||"").toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(w=>w.length>2&&!["the","and","for","with","near","may","was","are","from","this","that","item","found","lost"].includes(w)));}
function textSimilarity(a,b){
  const wa=words(a),wb=words(b);if(!wa.size||!wb.size)return 0;
  let common=0;for(const w of wa)if(wb.has(w))common++;
  return common/(wa.size+wb.size-common);
}
function matchScore(a,b){
  let score=0;
  score+=Math.max(textSimilarity(a.name,b.name),textSimilarity(a.description,b.description))*45;
  score+=a.category===b.category?20:0;
  score+=textSimilarity(a.location,b.location)*25;
  const da=new Date(a.date||today()),db=new Date(b.date||today());
  const days=Math.abs((da-db)/86400000);
  score+=Math.max(0,10-days/3);
  return Math.min(99,Math.round(score));
}
function itemCard(r){
  const icon=categoryIcons[r.category]||"📦";
  const photo=r.photoUrl?`<img src="${escapeHtml(r.photoUrl)}" alt="${escapeHtml(r.name)}" loading="lazy">`:`<span class="placeholder-icon">${icon}</span>`;
  return `<article class="item-card" tabindex="0" role="button" data-open-item="${escapeHtml(r.id)}" aria-label="View ${escapeHtml(r.name)}"><div class="item-image">${photo}<span class="type-pill ${r.type}">${r.type}</span></div><div class="item-body"><h4>${escapeHtml(r.name)}</h4><div class="item-location">⌖ ${escapeHtml(r.location)}</div><div class="item-description">${escapeHtml(r.description)}</div><div class="item-meta"><span class="mini-user">${escapeHtml(r.ownerName||"Campus member")}</span><span>${dateLabel(r.date)}</span></div></div></article>`;
}
function renderAll(){
  const active=activeReports(),matches=calculateMatches(),mine=reports.filter(r=>r.ownerUid===currentUser?.uid);
  $("statActive").textContent=active.length;$("statMatches").textContent=matches.length;
  $("statReturned").textContent=reports.filter(r=>r.status==="returned").length;$("statMine").textContent=mine.length;
  $("matchBadge").textContent=matches.length;
  const recent=[...reports].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,4);
  $("recentItems").innerHTML=recent.map(itemCard).join("");$("recentEmpty").hidden=recent.length>0;
  renderBrowse();renderMyReports();renderMatches();renderClaims();
  if(isAdmin())renderAdmin();
}
function renderBrowse(){
  if(!$("browseItems"))return;
  const q=$("searchInput").value.trim().toLowerCase(),type=$("typeFilter").value,cat=$("categoryFilter").value,status=$("statusFilter").value;
  const list=[...reports].filter(r=>(!q||[r.name,r.description,r.location,r.category].some(v=>String(v||"").toLowerCase().includes(q)))&&(type==="all"||r.type===type)&&(cat==="all"||r.category===cat)&&(status==="all"||r.status===status)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  $("browseItems").innerHTML=list.map(itemCard).join("");$("browseEmpty").hidden=list.length>0;$("resultsCount").textContent=`${list.length} item${list.length===1?"":"s"}`;
}
["searchInput","typeFilter","categoryFilter","statusFilter"].forEach(id=>$(id).addEventListener(id==="searchInput"?"input":"change",renderBrowse));
function renderMyReports(){
  const list=reports.filter(r=>r.ownerUid===currentUser?.uid).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  $("myReportsList").innerHTML=list.map(r=>`<div>${itemCard(r)}<div class="mt-2 d-flex gap-2 align-items-center"><span class="status-pill ${r.status}">${escapeHtml(r.status)}</span>${r.status==="active"?`<button class="btn btn-sm btn-outline-secondary" data-mark-returned="${escapeHtml(r.id)}">Mark returned</button>`:""}</div></div>`).join("");
  $("myReportsEmpty").hidden=list.length>0;
}
function renderMatches(){
  const matches=calculateMatches().slice(0,40);
  $("matchesList").innerHTML=matches.map(m=>`<article class="match-card"><div class="match-side"><div class="match-thumb">${m.lost.photoUrl?`<img src="${escapeHtml(m.lost.photoUrl)}" alt="">`:categoryIcons[m.lost.category]||"📦"}</div><div><strong>${escapeHtml(m.lost.name)}</strong><small><span class="type-pill lost" style="position:static;display:inline-block;margin-bottom:5px">LOST</span><br>⌖ ${escapeHtml(m.lost.location)}<br>${dateLabel(m.lost.date)}</small></div></div><div class="match-link">↔</div><div class="match-side"><div class="match-thumb">${m.found.photoUrl?`<img src="${escapeHtml(m.found.photoUrl)}" alt="">`:categoryIcons[m.found.category]||"📦"}</div><div><strong>${escapeHtml(m.found.name)}</strong><small><span class="type-pill found" style="position:static;display:inline-block;margin-bottom:5px">FOUND</span><br>⌖ ${escapeHtml(m.found.location)}<br>${dateLabel(m.found.date)}</small></div></div><div class="match-score"><div class="score-ring">${m.score}%</div><small>similarity</small><div class="match-actions mt-2"><button class="btn btn-primary" data-open-item="${escapeHtml(m.found.id)}">Review</button></div></div></article>`).join("");
  $("matchesEmpty").hidden=matches.length>0;
}
function renderClaims(){
  const visible=claims.filter(c=>isAdmin()||c.claimantUid===currentUser?.uid||c.reportOwnerUid===currentUser?.uid).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  $("claimsList").innerHTML=visible.map(claimCard).join("");$("claimsEmpty").hidden=visible.length>0;
}
function claimCard(c){
  const r=reportById(c.reportId);
  return `<article class="claim-card"><div class="claim-symbol">◇</div><div class="claim-main"><strong>${escapeHtml(c.itemName||r?.name||"Item claim")}</strong><p>${escapeHtml(c.claimantName||"Campus member")} requested a claim · ${escapeHtml(c.message||"No message supplied")}<br><span class="status-pill ${escapeHtml(c.status)}">${escapeHtml(c.status)}</span></p></div><div class="claim-actions">${(isAdmin()||c.reportOwnerUid===currentUser?.uid)&&c.status==="pending"?`<button class="btn btn-primary" data-claim-action="approve" data-claim-id="${escapeHtml(c.id)}">Approve</button><button class="btn btn-outline-secondary" data-claim-action="reject" data-claim-id="${escapeHtml(c.id)}">Decline</button>`:""}</div></article>`;
}
function renderAdmin(){
  if(!isAdmin())return;
  $("adminPending").textContent=claims.filter(c=>c.status==="pending").length;
  $("adminActive").textContent=activeReports().length;
  $("adminReturned").textContent=reports.filter(r=>r.status==="returned").length;
  const filter=$("adminFilter").value;
  const list=[...reports].filter(r=>filter==="all"||r.status===filter).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  $("adminReports").innerHTML=list.map(r=>`<div class="admin-report-row"><div class="admin-item-icon">${r.photoUrl?`<img src="${escapeHtml(r.photoUrl)}" alt="">`:categoryIcons[r.category]||"📦"}</div><div class="admin-row-main"><strong>${escapeHtml(r.name)} <span class="type-pill ${r.type}" style="position:static;display:inline-block">${r.type}</span></strong><small>${escapeHtml(r.ownerName||"Campus member")} · ${escapeHtml(r.location)} · ${escapeHtml(r.status)}</small></div><div class="admin-row-actions">${r.status==="active"?`<button class="btn btn-sm btn-outline-success" data-mark-returned="${escapeHtml(r.id)}">Returned</button><button class="btn btn-sm btn-outline-secondary" data-hide-report="${escapeHtml(r.id)}">Hide</button>`:""}<button class="btn btn-sm btn-outline-danger" data-delete-report="${escapeHtml(r.id)}">Delete</button></div></div>`).join("")||'<div class="muted small py-3">No reports in this view.</div>';
  $("adminClaims").innerHTML=claims.map(claimCard).join("")||'<div class="muted small py-3">No claim requests.</div>';
}
$("adminFilter").addEventListener("change",renderAdmin);
function getDemoUser(){return demoState().users.find(u=>u.uid===currentUser?.uid);}
async function persistReport(report){
  if(fb&&!localMode){
    const {id,...data}=report;const ref=await fb.addDoc(fb.collection(fb.db,"reports"),data);report.id=ref.id;
  }else{
    const state=demoState();state.reports.unshift(report);saveDemo(state);reports=state.reports;claims=state.claims;
  }
}
async function persistClaim(claim){
  if(fb&&!localMode){const {id,...data}=claim;const ref=await fb.addDoc(fb.collection(fb.db,"claims"),data);claim.id=ref.id;claims.unshift(claim);}
  else{const state=demoState();state.claims.unshift(claim);saveDemo(state);claims=state.claims;}
}
async function updateReport(id,patch){
  const r=reportById(id);if(!r)return;
  if(fb&&!localMode){await fb.updateDoc(fb.doc(fb.db,"reports",id),patch);Object.assign(r,patch);}
  else{const state=demoState();const item=state.reports.find(x=>x.id===id);if(item)Object.assign(item,patch);saveDemo(state);reports=state.reports;}
}
async function updateClaim(id,patch){
  const c=claims.find(x=>x.id===id);if(!c)return;
  if(fb&&!localMode){await fb.updateDoc(fb.doc(fb.db,"claims",id),patch);Object.assign(c,patch);}
  else{const state=demoState();const item=state.claims.find(x=>x.id===id);if(item)Object.assign(item,patch);saveDemo(state);claims=state.claims;}
}
async function deleteReport(id){
  if(fb&&!localMode)await fb.deleteDoc(fb.doc(fb.db,"reports",id));
  else{const state=demoState();state.reports=state.reports.filter(r=>r.id!==id);saveDemo(state);}
  reports=reports.filter(r=>r.id!==id);
}
async function uploadPhoto(file){
  if(!file)return "";
  if(!file.type.match(/^image\/(png|jpeg|webp)$/))throw new Error("Please upload a JPG, PNG, or WebP image.");
  if(file.size>3*1024*1024)throw new Error("Image must be smaller than 3 MB.");
  if(fb&&!localMode){
    const ref=fb.ref(fb.storage,`item-photos/${currentUser.uid}/${uid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`);
    await fb.uploadBytes(ref,file,{contentType:file.type});
    return await fb.getDownloadURL(ref);
  }
  return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("Could not read image."));reader.readAsDataURL(file);});
}
$("itemDate").value=today();
$("itemPhoto").addEventListener("change",()=>{
  const file=$("itemPhoto").files[0],box=$("photoPreview");
  if(!file){box.hidden=true;box.innerHTML="";return;}
  if(file.size>3*1024*1024){toast("Image must be smaller than 3 MB.",true);$("itemPhoto").value="";box.hidden=true;return;}
  const url=URL.createObjectURL(file);box.innerHTML=`<img src="${url}" alt="Selected item preview">`;box.hidden=false;
});
$("reportForm").addEventListener("submit",async(e)=>{
  e.preventDefault();$("reportError").textContent="";
  if(!currentUser){$("reportError").textContent="Please sign in first.";return;}
  const submit=$("submitReport");submit.disabled=true;
  try{
    const file=$("itemPhoto").files[0];const photoUrl=await uploadPhoto(file);
    const report={id:uid(),ownerUid:currentUser.uid,ownerName:currentProfile?.name||currentUser.email?.split("@")[0]||"Student",
      type:document.querySelector('input[name="reportType"]:checked').value,
      name:$("itemName").value.trim(),category:$("itemCategory").value,description:$("itemDescription").value.trim(),
      location:$("itemLocation").value.trim(),date:$("itemDate").value,photoUrl,contactPreference:$("itemContact").value.trim(),
      status:"active",createdAt:Date.now()};
    await persistReport(report);
    if(fb&&!localMode)await loadCloudData();
    $("reportForm").reset();$("itemDate").value=today();$("photoPreview").hidden=true;$("photoPreview").innerHTML="";
    toast("Your report has been published.");renderAll();navigate("myreports");
  }catch(err){console.error(err);$("reportError").textContent=friendlyAuthError(err);}
  finally{submit.disabled=false;}
});
document.addEventListener("click",async(e)=>{
  const open=e.target.closest("[data-open-item]");
  if(open){e.preventDefault();openItem(open.dataset.openItem);return;}
  const returned=e.target.closest("[data-mark-returned]");
  if(returned){try{await updateReport(returned.dataset.markReturned,{status:"returned"});renderAll();toast("Item marked as returned.");}catch(err){toast(friendlyAuthError(err),true);}return;}
  const hide=e.target.closest("[data-hide-report]");
  if(hide){try{await updateReport(hide.dataset.hideReport,{status:"hidden"});renderAll();toast("Report hidden from active listings.");}catch(err){toast(friendlyAuthError(err),true);}return;}
  const del=e.target.closest("[data-delete-report]");
  if(del){if(!confirm("Delete this report permanently?"))return;try{await deleteReport(del.dataset.deleteReport);renderAll();toast("Report deleted.");}catch(err){toast(friendlyAuthError(err),true);}return;}
  const ca=e.target.closest("[data-claim-action]");
  if(ca){const c=claims.find(x=>x.id===ca.dataset.claimId);if(!c)return;const status=ca.dataset.claimAction==="approve"?"approved":"rejected";try{await updateClaim(c.id,{status,reviewedAt:Date.now()});if(status==="approved")await updateReport(c.reportId,{status:"returned"});renderAll();toast(`Claim ${status}.`);}catch(err){toast(friendlyAuthError(err),true);}return;}
});
document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches("[data-open-item]")){e.preventDefault();openItem(e.target.dataset.openItem);}});
function openItem(id){
  const r=reportById(id);if(!r)return;currentModalReport=r;
  if(!itemModal)itemModal=new bootstrap.Modal($("itemModal"));
  $("modalItemName").textContent=r.name;
  const photo=r.photoUrl?`<img class="detail-photo" src="${escapeHtml(r.photoUrl)}" alt="${escapeHtml(r.name)}">`:"";
  $("modalItemBody").innerHTML=`${photo}<span class="type-pill ${r.type}" style="position:static;display:inline-block;margin-bottom:12px">${r.type}</span> <span class="status-pill ${escapeHtml(r.status)}">${escapeHtml(r.status)}</span><p class="detail-description mt-3">${escapeHtml(r.description)}</p><div class="detail-facts"><div class="detail-fact"><small>CATEGORY</small><strong>${escapeHtml(r.category)}</strong></div><div class="detail-fact"><small>LOCATION</small><strong>${escapeHtml(r.location)}</strong></div><div class="detail-fact"><small>DATE</small><strong>${dateLabel(r.date)}</strong></div><div class="detail-fact"><small>REPORTED BY</small><strong>${escapeHtml(r.ownerName||"Campus member")}</strong></div></div><div class="small muted">Contact preference: ${escapeHtml(r.contactPreference||"Use the claim request and campus administrator to coordinate safely.")}</div>`;
  const own=r.ownerUid===currentUser?.uid;
  $("modalItemFooter").innerHTML=`<button class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>${r.status==="active"&&!own&&r.type==="found"?`<button class="btn btn-primary" data-claim-item="${escapeHtml(r.id)}">Request to claim</button>`:""}${r.status==="active"&&own?`<button class="btn btn-outline-success" data-mark-returned="${escapeHtml(r.id)}" data-bs-dismiss="modal">Mark returned</button>`:""}`;
  itemModal.show();
}
document.addEventListener("click",async(e)=>{
  const claimBtn=e.target.closest("[data-claim-item]");if(!claimBtn)return;
  const r=reportById(claimBtn.dataset.claimItem);if(!r)return;
  const message=prompt("To help verify ownership, describe a detail only the owner is likely to know. Do not include passwords or financial details:");
  if(message===null)return;
  if(message.trim().length<5){toast("Please provide a little more detail for verification.",true);return;}
  if(claims.some(c=>c.reportId===r.id&&c.claimantUid===currentUser.uid&&c.status==="pending")){toast("You already have a pending request for this item.",true);return;}
  try{
    await persistClaim({id:uid(),reportId:r.id,itemName:r.name,reportOwnerUid:r.ownerUid,claimantUid:currentUser.uid,claimantName:currentProfile?.name||"Campus member",message:message.trim(),status:"pending",createdAt:Date.now()});
    if(fb&&!localMode)await loadCloudData();
    itemModal.hide();renderAll();toast("Claim request sent. Wait for verification.");
  }catch(err){toast(friendlyAuthError(err),true);}
});
$("year").textContent=new Date().getFullYear();
showAuthRole("student");
if(hasFirebaseConfig){initFirebase();}else{
  localMode=true;refreshDemoData();
  $("demoNote").innerHTML='Demo mode: try <button type="button" id="demoLogin" class="text-button">open the sample dashboard</button>. Data stays in this browser only.';
  $("demoLogin").addEventListener("click",()=>{currentUser={uid:"demo-current",email:"demo@student.local"};currentProfile={name:"Demo Student",studentId:"DEMO001",role:"student"};refreshDemoData();showApp();});
}
