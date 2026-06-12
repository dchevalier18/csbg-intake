// Main app — router + state + access control + tweaks
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "showCodes": true,
  "density": "regular"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [org, setOrg] = usePersistentState("csbg.org", DEFAULT_ORG);
  const [programs, setPrograms] = usePersistentState("csbg.programs", DEFAULT_PROGRAMS);
  const [users, setUsers] = usePersistentState("csbg.users", DEFAULT_USERS);
  const [currentUserId, setCurrentUserId] = usePersistentState("csbg.currentUser", "dr");
  const [fplHistory, setFplHistory] = usePersistentState("csbg.fplHistory", DEFAULT_FPL_HISTORY);
  const [lists, setLists] = usePersistentState("csbg.lists", DEFAULT_LISTS);
  const [fields, setFields] = usePersistentState("csbg.fields", DEFAULT_FIELDS);
  const currentUser = users.find(u => u.id === currentUserId) || users[0];

  const initial = (location.hash || "#dashboard").slice(1).split("/");
  const [route, setRoute] = useState(initial[0]);
  const [clientId, setClientId] = useState(initial[0] === "client" ? initial[1] : null);
  const [programId, setProgramId] = useState(initial[0] === "program" ? initial[1] : null);
  const [applicants, setApplicants] = useState(APPLICANTS);
  const [log, setLog] = useState(SERVICE_LOG);
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);

  // expose live state to global lookups (programById, staffById, access helpers)
  window.ACTIVE_PROGRAMS = programs;
  window.ACTIVE_USERS = users;
  window.CURRENT_USER = currentUser;
  window.ACTIVE_LISTS = lists;
  window.ACTIVE_FIELDS = fields;
  window.FPL_HISTORY = fplHistory;
  // apply the ACTIVE guideline schedule + state ceiling to the live calculator;
  // existing cases stay pinned to the schedule stored on their record
  const activeFpl = fplHistory.find(s => s.status === "active") || fplHistory[fplHistory.length - 1];
  FPL.year = activeFpl.year; FPL.base = activeFpl.base; FPL.perAdditional = activeFpl.perAdditional;
  FPL.csbgLimit = org.csbgCeiling;

  const isAdmin = isAdminUser(currentUser);
  const navPrograms = programs.filter(p => userCanSeeProgram(currentUser, p.id));
  const visibleApplicantCount = applicants.filter(a => userCanSeeProgram(currentUser, a.program)).length;

  function toast(msg) {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3800);
  }
  function parseTo(r) {
    const [rt, param] = r.split("/");
    setRoute(rt);
    setClientId(rt === "client" ? param : null);
    setProgramId(rt === "program" ? param : null);
  }
  function go(r) { parseTo(r); location.hash = r; window.scrollTo(0, 0); }
  function openClient(id) { go("client/" + id); }

  useEffect(() => {
    const onHash = () => parseTo((location.hash || "#dashboard").slice(1));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function switchUser(id) {
    setCurrentUserId(id);
    const u = users.find(x => x.id === id);
    toast("Now viewing as " + u.name + " — " + (u.access === "all" ? "all programs" : (u.programs || []).length + " assigned program" + ((u.programs || []).length === 1 ? "" : "s")) + ".");
    go("dashboard");
  }

  function submitIntake(applicant) {
    setApplicants(prev => [applicant, ...prev]);
    go("eligibility");
    toast("Application " + applicant.id + " submitted — now tracking documents in the eligibility queue.");
  }

  // client portal upload → updates Rosa's application in the eligibility queue
  function portalUpload(docKey) {
    setApplicants(prev => prev.map(a => a.id === PORTAL_USER.applicantId
      ? { ...a, docs: { ...a.docs, [docKey]: "submitted" } } : a));
  }

  const screens = {
    dashboard: <ScreenDashboard go={go} openClient={openClient} tweaks={t} />,
    eligibility: <ScreenEligibility applicants={applicants} setApplicants={setApplicants} toast={toast} tweaks={t} />,
    clients: <ScreenClients openClient={openClient} tweaks={t} />,
    client: <ScreenClientProfile clientId={clientId} back={() => go("clients")} tweaks={t} toast={toast} />,
    intake: <ScreenIntake onSubmit={submitIntake} toast={toast} tweaks={t} />,
    services: <ScreenServices log={log} addEntry={(e) => setLog(prev => [e, ...prev])} toast={toast} tweaks={t} />,
    reports: <ScreenReports toast={toast} tweaks={t} />,
    data: isAdmin ? <ScreenData toast={toast} /> : <Restricted what="Data & integrations" />,
    settings: isAdmin ? <ScreenSettings org={org} setOrg={setOrg} programs={programs} setPrograms={setPrograms} users={users} setUsers={setUsers} currentUserId={currentUser.id} fplHistory={fplHistory} setFplHistory={setFplHistory} lists={lists} setLists={setLists} fields={fields} setFields={setFields} applicants={applicants} toast={toast} tweaks={t} /> : <Restricted what="Settings" />,
    program: <ScreenProgram programId={programId} go={go} openClient={openClient} applicants={applicants} toast={toast} tweaks={t} />,
    gnx: <ScreenGnx openClient={openClient} toast={toast} tweaks={t} />,
    wx: <ScreenWx openClient={openClient} toast={toast} tweaks={t} />,
    shfb: <ScreenShfb toast={toast} tweaks={t} />,
    seminars: <ScreenSeminars toast={toast} tweaks={t} />,
    homes: <ScreenHomes toast={toast} tweaks={t} />,
    volunteers: <ScreenVolunteers openClient={openClient} toast={toast} tweaks={t} />,
    loans: <ScreenLoans openClient={openClient} toast={toast} tweaks={t} />,
    portal: <ScreenPortal toast={toast} tweaks={t} onUpload={portalUpload} />,
  };

  // tool routes: only valid while some configured program still activates them
  const toolRoutes = Object.values(CAP_TOOLS).map(x => x.route);
  const enabledCaps = new Set(programs.flatMap(p => p.caps || []));
  const routeOk = !toolRoutes.includes(route) ||
    Object.keys(CAP_TOOLS).some(c => CAP_TOOLS[c].route === route && enabledCaps.has(c));

  return (
    <div className={"app" + (t.density === "compact" ? " compact" : "")} style={{ "--brand": org.accent }}>
      <Sidebar route={route} programId={programId} go={go} applicantCount={visibleApplicantCount}
        onNewIntake={() => go("intake")} org={org} navPrograms={navPrograms} isAdmin={isAdmin} />
      <main className="content" key={currentUser.id}>
        <Topbar go={go} openClient={openClient} users={users} currentUser={currentUser} onSwitchUser={switchUser} />
        {toolRoutes.includes(route) ? (
          <div style={{ marginBottom: 12 }}>
            <a className="tlink" style={{ fontSize: 12.5, textDecoration: "none", cursor: "pointer" }} onClick={() => history.back()}>← Back</a>
          </div>
        ) : null}
        {(routeOk && screens[route]) || screens.dashboard}
      </main>
      <Toast msg={toastMsg} />
      <TweaksPanel>
        <TweakSection label="Data entry" />
        <TweakToggle label="Show CSBG codes" value={t.showCodes} onChange={(v) => setTweak("showCodes", v)} />
        <TweakRadio label="Density" value={t.density} options={["regular", "compact"]} onChange={(v) => setTweak("density", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
